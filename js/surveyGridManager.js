// File: surveyGridManager.js

// Global state and DOM element variables are expected to be available from config.js and domCache.js
// map, isDrawingSurveyArea, isDrawingGridAngleLine, gridAngleLinePoints
// surveyGridModalOverlayEl, surveyGridAltitudeInputEl, surveySidelapInputEl, surveyFrontlapInputEl, 
// surveyGridAngleInputEl, setGridAngleByLineBtn, surveyAreaStatusEl, 
// startDrawingSurveyAreaBtnEl, confirmSurveyGridBtnEl, cancelSurveyGridBtnEl, 
// defaultAltitudeSlider, flightSpeedSlider
// R_EARTH
// Global functions: addWaypoint, updateWaypointList, updateFlightPath, updateFlightStatistics, fitMapToWaypoints (from other managers)
// Global function: handleMapClick (from mapManager.js)
// Global function: showCustomAlert (from utils.js)


let currentPolygonPoints = [];        // Vertices of the survey area polygon
let tempPolygonLayer = null;          // Leaflet layer for the temporary survey polygon
let tempVertexMarkers = [];         // Leaflet markers for survey polygon vertices

let tempGridAngleLineLayer = null;    // Leaflet layer for the temporary angle direction line
let tempGridAnglePointMarkers = []; // Leaflet markers for angle direction line points
let nativeMapClickListener = null;    // Holds the native DOM event listener for map clicks (used for polygon drawing)

const MIN_POLYGON_POINTS = 3;         // Minimum points for a valid polygon

const FIXED_CAMERA_PARAMS = {
    sensorWidth_mm: 8.976,
    sensorHeight_mm: 6.716,
    focalLength_mm: 6.88
};

// === HELPER FUNCTIONS ===
function clearTemporaryDrawing() {
    console.log("[SurveyGrid] clearTemporaryDrawing (all polys/lines/markers)");
    if (tempPolygonLayer) { map.removeLayer(tempPolygonLayer); tempPolygonLayer = null; }
    tempVertexMarkers.forEach(marker => map.removeLayer(marker)); tempVertexMarkers = [];
    if (tempGridAngleLineLayer) { map.removeLayer(tempGridAngleLineLayer); tempGridAngleLineLayer = null; }
    tempGridAnglePointMarkers.forEach(marker => map.removeLayer(marker)); tempGridAnglePointMarkers = [];
}

function updateTempPolygonDisplay() {
    // console.log("[SurveyGrid] updateTempPolygonDisplay called");
    if (tempPolygonLayer) { map.removeLayer(tempPolygonLayer); tempPolygonLayer = null; }
    if (currentPolygonPoints.length < 2) return;
    const opts = { color: 'rgba(0, 100, 255, 0.7)', weight: 2, fillColor: 'rgba(0, 100, 255, 0.2)', fillOpacity: 0.3 };
    if (currentPolygonPoints.length === 2) tempPolygonLayer = L.polyline(currentPolygonPoints, opts).addTo(map);
    else if (currentPolygonPoints.length >= MIN_POLYGON_POINTS) tempPolygonLayer = L.polygon(currentPolygonPoints, opts).addTo(map);
}

function toRad(degrees) { return degrees * Math.PI / 180; }

function rotateLatLng(pointLatLng, centerLatLng, angleRadians) {
    const cosAngle = Math.cos(angleRadians); const sinAngle = Math.sin(angleRadians);
    const dLngScaled = (pointLatLng.lng - centerLatLng.lng) * Math.cos(toRad(centerLatLng.lat));
    const dLat = pointLatLng.lat - centerLatLng.lat;
    const rotatedDLngScaled = dLngScaled * cosAngle - dLat * sinAngle;
    const rotatedDLat = dLngScaled * sinAngle + dLat * cosAngle;
    const finalLng = centerLatLng.lng + (rotatedDLngScaled / Math.cos(toRad(centerLatLng.lat)));
    const finalLat = centerLatLng.lat + rotatedDLat;
    return L.latLng(finalLat, finalLng);
}

function isPointInPolygon(point, polygonVertices) {
    let isInside = false; const x = point.lng; const y = point.lat;
    for (let i = 0, j = polygonVertices.length - 1; i < polygonVertices.length; j = i++) {
        const xi = polygonVertices[i].lng, yi = polygonVertices[i].lat;
        const xj = polygonVertices[j].lng, yj = polygonVertices[j].lat;
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
    }
    return isInside;
}

function destinationPoint(startLatLng, bearingDeg, distanceMeters) {
    const R = (typeof R_EARTH !== 'undefined') ? R_EARTH : 6371000;
    const angularDistance = distanceMeters / R;
    const bearingRad = toRad(bearingDeg);
    const lat1 = toRad(startLatLng.lat); const lon1 = toRad(startLatLng.lng);
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angularDistance) + Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRad));
    let lon2 = lon1 + Math.atan2(Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1), Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2));
    lon2 = (lon2 + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
    return L.latLng(lat2 * 180 / Math.PI, lon2 * 180 / Math.PI);
}

function calculateBearing(point1LatLng, point2LatLng) {
    const lat1 = toRad(point1LatLng.lat); const lon1 = toRad(point1LatLng.lng);
    const lat2 = toRad(point2LatLng.lat); const lon2 = toRad(point2LatLng.lng);
    const dLon = lon2 - lon1;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    let brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
}

function calculateFootprint(altitudeAGL, cameraParams) {
    if (!cameraParams || !cameraParams.focalLength_mm || cameraParams.focalLength_mm === 0) {
        console.error("Invalid camera parameters for footprint calculation."); return { width: 0, height: 0 };
    }
    const footprintWidth = (cameraParams.sensorWidth_mm / cameraParams.focalLength_mm) * altitudeAGL;
    const footprintHeight = (cameraParams.sensorHeight_mm / cameraParams.focalLength_mm) * altitudeAGL;
    console.log(`[FootprintCalc] Alt: ${altitudeAGL}m => FW: ${footprintWidth.toFixed(1)}m, FH: ${footprintHeight.toFixed(1)}m`);
    return { width: footprintWidth, height: footprintHeight };
}

// === MAP EVENT HANDLERS ===
function handleGridAngleLineMapClick(e) {
    console.log("[SurveyGridAngle] handleGridAngleLineMapClick ACTUALLY TRIGGERED!", e.latlng, "Current points count before add:", gridAngleLinePoints.length); 
    if (!isDrawingGridAngleLine) { 
        console.log("[SurveyGridAngle] Not in angle line drawing mode, exiting."); return;
    }
    L.DomEvent.stopPropagation(e.originalEvent); 
    console.log("[SurveyGridAngle] Event propagation stopped.");

    gridAngleLinePoints.push(e.latlng); 
    console.log("[SurveyGridAngle] Point pushed. New count:", gridAngleLinePoints.length);

    const marker = L.circleMarker(e.latlng, { radius: 5, color: 'cyan' }).addTo(map);
    tempGridAnglePointMarkers.push(marker);
    console.log("[SurveyGridAngle] Temp marker for angle line point added.");

    if (gridAngleLinePoints.length === 1) { 
        map.on('mousemove', handleGridAngleLineMouseMove);
        console.log("[SurveyGridAngle] First point set. Added mousemove listener. gridAngleLinePoints:", gridAngleLinePoints.map(p=>[p.lat,p.lng]));
    } else if (gridAngleLinePoints.length === 2) { 
        console.log("[SurveyGridAngle] Second point set. Attempting to finalize. gridAngleLinePoints:", gridAngleLinePoints.map(p=>[p.lat,p.lng]));
        const userDrawnBearing = calculateBearing(gridAngleLinePoints[0], gridAngleLinePoints[1]);
        let correctedAngleForInput = (userDrawnBearing - 90 + 360) % 360;
        surveyGridAngleInputEl.value = Math.round(correctedAngleForInput);
        console.log(`[SurveyGridAngle] User Bearing: ${userDrawnBearing.toFixed(1)}°. Corrected Angle for Input/Generator: ${surveyGridAngleInputEl.value}°`);
        finalizeGridAngleLineDrawing(); 
    } else {
        console.warn("[SurveyGridAngle] Unexpected number of points for angle line:", gridAngleLinePoints.length);
        finalizeGridAngleLineDrawing(); 
    }
}

function handleGridAngleLineMouseMove(e) {
    if (!isDrawingGridAngleLine || gridAngleLinePoints.length !== 1) return;
    if (tempGridAngleLineLayer) map.removeLayer(tempGridAngleLineLayer);
    tempGridAngleLineLayer = L.polyline([gridAngleLinePoints[0], e.latlng], { color: 'cyan', weight: 2, dashArray: '5, 5' }).addTo(map);
}

function handleSurveyAreaMapClick(e) {
    console.log("[SurveyGrid] handleSurveyAreaMapClick TRIGGERED! LatLng:", e.latlng);
    if (!isDrawingSurveyArea) { console.log("Not in drawing mode."); return; }
    const clickedLatLng = e.latlng; 
    currentPolygonPoints.push(clickedLatLng);
    console.log("Point added, total:", currentPolygonPoints.length);
    const vertexMarker = L.circleMarker(clickedLatLng, { radius: 6, color: 'rgba(255,0,0,0.8)',fillColor:'rgba(255,0,0,0.5)',fillOpacity:0.7,pane:'markerPane'}).addTo(map);
    if (tempVertexMarkers.length === 0) {
        vertexMarker.on('click', (ev) => { 
            L.DomEvent.stopPropagation(ev); 
            if (isDrawingSurveyArea && currentPolygonPoints.length >= MIN_POLYGON_POINTS) handleFinalizeSurveyArea(); 
        });
    }
    tempVertexMarkers.push(vertexMarker); 
    updateTempPolygonDisplay();
}

// === MAIN UI AND STATE HANDLERS ===
function openSurveyGridModal() {
    console.log("[SurveyGrid] openSurveyGridModal called");
    if (!surveyGridModalOverlayEl || !defaultAltitudeSlider || !surveyGridAltitudeInputEl || !surveySidelapInputEl || !surveyFrontlapInputEl || !surveyGridAngleInputEl || !confirmSurveyGridBtnEl || !startDrawingSurveyAreaBtnEl || !surveyAreaStatusEl || !surveyGridInstructionsEl) {
        showCustomAlert("Survey grid modal elements not found.", "Error"); return;
    }
    surveyGridAltitudeInputEl.value = defaultAltitudeSlider.value;
    if (!surveySidelapInputEl.value) surveySidelapInputEl.value = 70;
    if (!surveyFrontlapInputEl.value) surveyFrontlapInputEl.value = 80;
    if (surveyGridAngleInputEl && (surveyGridAngleInputEl.value === "" || surveyGridAngleInputEl.value === null)) surveyGridAngleInputEl.value = 0;
    
    cancelSurveyAreaDrawing(); // Full reset on open
    
    confirmSurveyGridBtnEl.disabled = true;
    startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
    surveyAreaStatusEl.textContent = "Area not defined.";
    surveyGridInstructionsEl.innerHTML = 'Set parameters. Click "Draw Direction" (optional) then "Draw Survey Area".';
    surveyGridModalOverlayEl.style.display = 'flex';
    console.log("[SurveyGrid] Modal displayed, all states reset.");
}

function cancelSurveyAreaDrawing() {
    console.log("[SurveyGrid] cancelSurveyAreaDrawing (full reset for all survey drawing states)");
    const wasInAnyInteractionMode = isDrawingSurveyArea || (typeof nativeMapClickListener === 'function') || isDrawingGridAngleLine;
    
    isDrawingSurveyArea = false; 
    isDrawingGridAngleLine = false;
    gridAngleLinePoints = [];
    currentPolygonPoints = []; 

    if (map) {
        const mapContainer = map.getContainer();
        if (mapContainer && typeof nativeMapClickListener === 'function') {
            mapContainer.removeEventListener('click', nativeMapClickListener, true);
        }
        nativeMapClickListener = null; 

        map.off('click', handleSurveyAreaMapClick);    
        map.off('click', handleGridAngleLineMapClick);  
        map.off('mousemove', handleGridAngleLineMouseMove); 
        map.getContainer().style.cursor = '';
        console.log("All survey-related map listeners removed by cancel.");

        if ((wasInAnyInteractionMode || !map.hasEventListeners('click', handleMapClick)) && typeof handleMapClick === 'function') {
            map.on('click', handleMapClick);
            console.log("Default map click listener RE-ENSURED by cancel.");
        }
    }
    clearTemporaryDrawing(); 
    
    if (startDrawingSurveyAreaBtnEl) startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
    if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = true; 
    if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = "Area not defined.";
    if (surveyGridInstructionsEl) surveyGridInstructionsEl.innerHTML = 'Set parameters. Click "Draw Direction" (optional) then "Draw Survey Area".';
    if (surveyGridAngleInputEl) surveyGridAngleInputEl.value = 0; // Reset angle on full cancel
}

function handleCancelSurveyGrid() { 
    console.log("[SurveyGrid] handleCancelSurveyGrid (modal cancel button)");
    cancelSurveyAreaDrawing();
    if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'none';
}

function handleSetGridAngleByLine() {
    console.log("[SurveyGridAngle] handleSetGridAngleByLine called - START");
    // Se stiamo attivamente disegnando il poligono, non permettere di cambiare l'angolo finché non è finalizzato o cancellato.
    const mapContainer = map.getContainer();
    if (mapContainer && typeof nativeMapClickListener === 'function' && isDrawingSurveyArea && currentPolygonPoints.length > 0) {
         showCustomAlert("Please finalize or cancel current survey area drawing first before setting a new angle.", "Info");
        return;
    }
    // Non resettiamo currentPolygonPoints o isDrawingSurveyArea qui, perché l'utente potrebbe voler impostare l'angolo
    // per un'area già disegnata e finalizzata.

    isDrawingGridAngleLine = true; // Attiva la modalità per la linea dell'angolo
    gridAngleLinePoints = [];
    // Pulisci solo i layer/marker temporanei della *linea dell'angolo precedente*
    if (tempGridAngleLineLayer) { map.removeLayer(tempGridAngleLineLayer); tempGridAngleLineLayer = null; }
    tempGridAnglePointMarkers.forEach(marker => map.removeLayer(marker)); tempGridAnglePointMarkers = [];
    console.log("[SurveyGridAngle] State set: isDrawingGridAngleLine=true, previous angle line graphics cleared.");

    if (map && typeof handleMapClick === 'function') map.off('click', handleMapClick);
    // Disattiva anche il listener di disegno del poligono (nativo) se era in attesa
    if (mapContainer && typeof nativeMapClickListener === 'function') {
         mapContainer.removeEventListener('click', nativeMapClickListener, true);
         // Non impostare a null, potrebbe essere riattivato se si annulla il disegno dell'angolo.
    }
    map.off('click', handleSurveyAreaMapClick); // Rimuovi anche il fallback Leaflet per il poligono
    
    if (map) {
        map.on('click', handleGridAngleLineMapClick);
        map.getContainer().style.cursor = 'crosshair';
        console.log("[SurveyGridAngle] 'handleGridAngleLineMapClick' listener ADDED.");
    } else { /* ... errore ... */ return; }
    
    if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'none'; 
    showCustomAlert("Draw Grid Direction: Click map for line start, click again for end.", "Set Angle");
    console.log("[SurveyGridAngle] Angle line drawing mode FULLY ACTIVATED.");
}

function finalizeGridAngleLineDrawing() {
    console.log("[SurveyGridAngle] Finalizing grid angle line drawing.");
    isDrawingGridAngleLine = false; 
    map.off('click', handleGridAngleLineMapClick);
    map.off('mousemove', handleGridAngleLineMouseMove);
    map.getContainer().style.cursor = '';
    
    if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'flex';
    
    const angleVal = surveyGridAngleInputEl ? surveyGridAngleInputEl.value : 'N/A';
    // AGGIORNA LA UI DELLA MODALE IN BASE ALLO STATO DEL POLIGONO
    if (currentPolygonPoints.length >= MIN_POLYGON_POINTS && isDrawingSurveyArea) {
        // Un'area valida era stata finalizzata. Ora l'angolo è aggiornato.
        if (surveyGridInstructionsEl) surveyGridInstructionsEl.innerHTML = `<strong style="color: #2ecc71;">Area defined.</strong> Angle updated to ${angleVal}°. Click "Generate Grid".`;
        if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = `Area defined with ${currentPolygonPoints.length} points. Angle: ${angleVal}°`;
        if (startDrawingSurveyAreaBtnEl) startDrawingSurveyAreaBtnEl.style.display = 'none';
        if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = false; // ABILITA generazione
        console.log("[SurveyGridAngle] Angle set. Polygon area was already defined. Ready to generate.");
        // Non riattivare handleMapClick, l'utente deve usare i pulsanti della modale.
    } else {
        // Non c'era un'area valida. Chiedi di disegnare l'area.
        if (surveyGridInstructionsEl) surveyGridInstructionsEl.innerHTML = `Grid angle set to ${angleVal}°. Now click "Draw Survey Area" to define the polygon.`;
        if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = "Area not defined (angle has been set).";
        if (startDrawingSurveyAreaBtnEl) startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
        if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = true;
        console.log("[SurveyGridAngle] Angle set. No valid polygon area yet. Ready to draw survey area.");
        // Riattiva il listener di click di default se l'utente deve fare altre cose prima di disegnare l'area
        if (typeof handleMapClick === 'function') {
            map.on('click', handleMapClick);
        }
    }
    console.log("[SurveyGridAngle] Angle line drawing finalized. Modal UI updated.");
}

function handleStartDrawingSurveyArea() {
    console.log("[SurveyGrid] handleStartDrawingSurveyArea called");
    if (isDrawingGridAngleLine) { showCustomAlert("Finish drawing grid angle line first.", "Info"); return; }
    if (!map || !surveyGridModalOverlayEl) { console.error("Map or Modal missing"); return; }
    
    isDrawingSurveyArea = true; 
    currentPolygonPoints = [];  
    clearTemporaryDrawing();    
    console.log("Drawing polygon started, isDrawingSurveyArea=true, currentPolygonPoints reset.");

    if (typeof handleMapClick === 'function') map.off('click', handleMapClick);
    map.off('click', handleGridAngleLineMapClick); 
    
    const mapContainer = map.getContainer();
    if (mapContainer) {
        if (typeof nativeMapClickListener === 'function') { mapContainer.removeEventListener('click', nativeMapClickListener, true); }
        nativeMapClickListener = function(event) {
            if (!isDrawingSurveyArea) return;
            if (event.target === mapContainer || event.target.closest('.leaflet-pane') || event.target.closest('.leaflet-container')) {
                try { handleSurveyAreaMapClick({ latlng: map.mouseEventToLatLng(event), originalEvent: event }); }
                catch (mapError) { console.error("NATIVE CLICK (Polygon) Error:", mapError); }
            }
        };
        mapContainer.addEventListener('click', nativeMapClickListener, true);
        console.log("NATIVE DOM listener for polygon ADDED.");
    }
    map.getContainer().style.cursor = 'crosshair';
    surveyGridModalOverlayEl.style.display = 'none';
    showCustomAlert("Drawing survey area: Click map for corners. Click first point (min 3) to finalize.", "Survey Drawing Active");
    console.log("Polygon drawing mode activated.");
}

function handleFinalizeSurveyArea() {
    console.log("[SurveyGrid] handleFinalizeSurveyArea called");
    if (!isDrawingSurveyArea) { console.log("Not in polygon drawing mode or already finalized."); return; }
    if (currentPolygonPoints.length < MIN_POLYGON_POINTS) { showCustomAlert(`Area needs ${MIN_POLYGON_POINTS} points.`, "Info"); return; }
    
    const mapContainer = map.getContainer();
    if (mapContainer && typeof nativeMapClickListener === 'function') {
        mapContainer.removeEventListener('click', nativeMapClickListener, true);
        // Non impostare nativeMapClickListener = null qui; lo fa cancelSurveyAreaDrawing se si esce completamente.
        // Se l'utente ora clicca "Draw Direction", nativeMapClickListener (la funzione) esisterà ancora
        // e potrà essere rimossa da handleSetGridAngleByLine.
        console.log("[SurveyGrid] NATIVE DOM listener REMOVED after polygon finalize.");
    }
    map.getContainer().style.cursor = '';
    // isDrawingSurveyArea rimane true (area definita, in attesa di generazione o cancellazione)
    console.log("Polygon finalized. isDrawingSurveyArea is STILL TRUE (area defined).");

    if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'flex';
    if (startDrawingSurveyAreaBtnEl) startDrawingSurveyAreaBtnEl.style.display = 'none';
    if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = false;
    if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = `Area defined with ${currentPolygonPoints.length} points. Angle: ${surveyGridAngleInputEl.value}°`;
    if (surveyGridInstructionsEl) surveyGridInstructionsEl.innerHTML = '<strong style="color: #2ecc71;">Area finalized!</strong> Adjust parameters or click "Generate Grid".';
    if (tempPolygonLayer) tempPolygonLayer.setStyle({ color: 'rgba(0, 50, 200, 0.9)', fillColor: 'rgba(0, 50, 200, 0.4)' });
    tempVertexMarkers.forEach(marker => marker.off('click'));
    console.log("Area finalized. Modal UI updated for generation.");
}

// === GRID GENERATION LOGIC (NO OVERSHOOT) ===
function generateSurveyGridWaypoints(polygonLatLngs, flightAltitudeAGL, sidelapPercent, frontlapPercent, gridAngleDeg, flightSpeed) { /* ... identica ... */ }
function handleConfirmSurveyGridGeneration() { /* ... identica ... */ }
// (Incollo per completezza, non dovrebbero esserci modifiche qui rispetto all'ultima versione funzionante)
function generateSurveyGridWaypoints(polygonLatLngs, flightAltitudeAGL, sidelapPercent, frontlapPercent, gridAngleDeg, flightSpeed) {
    console.log("[SurveyGridGen] Starting generation (NO OVERSHOOT) with:", {
        polygonPts: polygonLatLngs ? polygonLatLngs.length : 0, flightAltitudeAGL, sidelapPercent, frontlapPercent, gridAngleDeg, flightSpeed
    });
    const finalWaypointsData = [];
    if (!polygonLatLngs || polygonLatLngs.length < MIN_POLYGON_POINTS) {
        showCustomAlert("Invalid polygon for generation.", "Error"); return finalWaypointsData;
    }

    const footprint = calculateFootprint(flightAltitudeAGL, FIXED_CAMERA_PARAMS);
    if (footprint.width <= 0 || footprint.height <= 0) { showCustomAlert("Footprint calc error.", "Grid Error"); return finalWaypointsData; }
    const actualLineSpacing = footprint.width * (1 - sidelapPercent / 100);
    const actualDistanceBetweenPhotos = footprint.height * (1 - frontlapPercent / 100);
    console.log(`[SurveyGridGen] Actual Line Spacing: ${actualLineSpacing.toFixed(1)}m, Photo Distance: ${actualDistanceBetweenPhotos.toFixed(1)}m`);
    if (actualLineSpacing <= 0.1 || actualDistanceBetweenPhotos <= 0.1) { showCustomAlert("Calculated spacing too small.", "Grid Error"); return finalWaypointsData; }
    
    const requiredPhotoInterval_s = actualDistanceBetweenPhotos / flightSpeed;
    console.log(`[SurveyGridGen] Req. Photo Interval: ${requiredPhotoInterval_s.toFixed(1)}s`);
    if (requiredPhotoInterval_s < 1.8 && flightSpeed > 0) { showCustomAlert(`Speed warning (Interval: ${requiredPhotoInterval_s.toFixed(1)}s).`, "Speed Warning"); }

    const rotationCenter = polygonLatLngs[0];
    const angleRad = toRad(gridAngleDeg);
    const rotatedPolygonLatLngs = polygonLatLngs.map(p => rotateLatLng(p, rotationCenter, -angleRad));
    const rotatedBounds = L.latLngBounds(rotatedPolygonLatLngs);
    const rNE = rotatedBounds.getNorthEast(); const rSW = rotatedBounds.getSouthWest();
    if (rSW.lat >= rNE.lat - 1e-7 || rSW.lng >= rNE.lng - 1e-7) { showCustomAlert("Rotated bounds invalid.", "Grid Error"); return finalWaypointsData; }

    const earthR = (typeof R_EARTH !== 'undefined') ? R_EARTH : 6371000;
    const lineSpacingRotLat = (actualLineSpacing / earthR) * (180 / Math.PI);
    const photoSpacingRotLng = (actualDistanceBetweenPhotos / (earthR * Math.cos(toRad(rotationCenter.lat)))) * (180 / Math.PI);
    if (lineSpacingRotLat <= 1e-9 || photoSpacingRotLng <= 1e-9) { showCustomAlert("Degree spacing calc error.", "Grid Error"); return finalWaypointsData; }

    let currentRotLat = rSW.lat;
    let scanDir = 1; let lines = 0;

    while (currentRotLat <= rNE.lat + lineSpacingRotLat * 0.5) {
        lines++;
        const lineCandRot = [];
        if (scanDir === 1) {
            for (let curRotLng = rSW.lng; curRotLng <= rNE.lng; curRotLng += photoSpacingRotLng) lineCandRot.push(L.latLng(currentRotLat, curRotLng));
            if (!lineCandRot.length || lineCandRot[lineCandRot.length - 1].lng < rNE.lng - 1e-7) lineCandRot.push(L.latLng(currentRotLat, rNE.lng));
        } else {
            for (let curRotLng = rNE.lng; curRotLng >= rSW.lng; curRotLng -= photoSpacingRotLng) lineCandRot.push(L.latLng(currentRotLat, curRotLng));
            if (!lineCandRot.length || lineCandRot[lineCandRot.length - 1].lng > rSW.lng + 1e-7) lineCandRot.push(L.latLng(currentRotLat, rSW.lng));
        }

        let intendedLineBearing = gridAngleDeg; 
        if (scanDir === -1) intendedLineBearing = (gridAngleDeg + 180);
        intendedLineBearing = (intendedLineBearing % 360 + 360) % 360;
        const wpOptions = { altitude: flightAltitudeAGL, cameraAction: 'takePhoto', headingControl: 'fixed', fixedHeading: Math.round(intendedLineBearing) };

        lineCandRot.forEach(rotPt => {
            const actualGeoPt = rotateLatLng(rotPt, rotationCenter, angleRad);
            if (isPointInPolygon(actualGeoPt, polygonLatLngs)) {
                finalWaypointsData.push({ latlng: actualGeoPt, options: wpOptions });
            }
        });
        
        currentRotLat += lineSpacingRotLat;
        if (lines > 2000) { console.error("Too many lines"); break; }
        scanDir *= -1;
    }
    
    const uniqueWaypoints = []; const seenKeys = new Set();
    for (const wp of finalWaypointsData) {
        const key = `${wp.latlng.lat.toFixed(7)},${wp.latlng.lng.toFixed(7)}`;
        if (!seenKeys.has(key)) { uniqueWaypoints.push(wp); seenKeys.add(key); }
    }
    
    console.log(`[SurveyGridGen] Total unique waypoints generated: ${uniqueWaypoints.length}`);
    if (uniqueWaypoints.length === 0 && polygonLatLngs.length >= MIN_POLYGON_POINTS && lines > 0) {
        showCustomAlert("No waypoints generated. Check parameters.", "Grid Warning");
    }
    return uniqueWaypoints;
}

function handleConfirmSurveyGridGeneration() {
    console.log("[SurveyGrid] handleConfirmSurveyGridGeneration called");
    if (!isDrawingSurveyArea || currentPolygonPoints.length < MIN_POLYGON_POINTS) { 
        showCustomAlert("Survey area not defined or not finalized.", "Error"); return; 
    }
    if (!surveyGridAltitudeInputEl || !surveySidelapInputEl || !surveyFrontlapInputEl || !surveyGridAngleInputEl || !flightSpeedSlider ) { 
        showCustomAlert("Missing input elements.", "Error"); return; 
    }
    const altitude = parseInt(surveyGridAltitudeInputEl.value);
    const sidelap = parseFloat(surveySidelapInputEl.value);
    const frontlap = parseFloat(surveyFrontlapInputEl.value);
    const angle = parseFloat(surveyGridAngleInputEl.value);
    const speed = parseFloat(flightSpeedSlider.value);

    if (isNaN(altitude) || altitude < 1) { showCustomAlert("Invalid altitude.", "Error"); return; }
    if (isNaN(sidelap) || sidelap < 10 || sidelap > 95) { showCustomAlert("Invalid Sidelap %.", "Error"); return; }
    if (isNaN(frontlap) || frontlap < 10 || frontlap > 95) { showCustomAlert("Invalid Frontlap %.", "Error"); return; }
    if (isNaN(angle)) { showCustomAlert("Invalid grid angle.", "Error"); return; }
    if (isNaN(speed) || speed <= 0) {showCustomAlert("Invalid flight speed.", "Error"); return; }

    if (surveyGridInstructionsEl) surveyGridInstructionsEl.textContent = "Generating grid waypoints...";
    const surveyWaypoints = generateSurveyGridWaypoints(currentPolygonPoints, altitude, sidelap, frontlap, angle, speed);

    if (surveyWaypoints && surveyWaypoints.length > 0) {
       surveyWaypoints.forEach(wpData => addWaypoint(wpData.latlng, wpData.options));
       updateWaypointList(); updateFlightPath(); updateFlightStatistics(); fitMapToWaypoints();
       showCustomAlert(`${surveyWaypoints.length} survey waypoints generated!`, "Success");
    } else if (surveyWaypoints && surveyWaypoints.length === 0 ) {
        console.warn("generateSurveyGridWaypoints returned empty array.");
    } else if (!surveyWaypoints) {
        showCustomAlert("Error during grid generation.", "Error");
    }
    handleCancelSurveyGrid(); // Chiama il reset completo e nasconde la modale
}
