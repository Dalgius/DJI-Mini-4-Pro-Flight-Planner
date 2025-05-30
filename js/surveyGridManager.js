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
    // console.log("[SurveyGrid] updateTempPolygonDisplay called"); // Can be noisy
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

// === MAIN UI HANDLERS ===
function openSurveyGridModal() {
    console.log("[SurveyGrid] openSurveyGridModal called");
    if (!surveyGridModalOverlayEl || !defaultAltitudeSlider || !surveyGridAltitudeInputEl || !surveySidelapInputEl || !surveyFrontlapInputEl || !surveyGridAngleInputEl || !confirmSurveyGridBtnEl || !startDrawingSurveyAreaBtnEl || !surveyAreaStatusEl || !surveyGridInstructionsEl) {
        showCustomAlert("Survey grid modal elements not found or incomplete.", "Error"); return;
    }
    surveyGridAltitudeInputEl.value = defaultAltitudeSlider.value;
    if (!surveySidelapInputEl.value) surveySidelapInputEl.value = 70;
    if (!surveyFrontlapInputEl.value) surveyFrontlapInputEl.value = 80;
    if (surveyGridAngleInputEl && (surveyGridAngleInputEl.value === "" || surveyGridAngleInputEl.value === null)) surveyGridAngleInputEl.value = 0;
    
    cancelSurveyAreaDrawing(); // Full reset
    
    confirmSurveyGridBtnEl.disabled = true;
    startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
    surveyAreaStatusEl.textContent = "Area not defined.";
    surveyGridInstructionsEl.innerHTML = 'Set parameters. Click "Draw Direction" (optional) then "Draw Survey Area".';
    surveyGridModalOverlayEl.style.display = 'flex';
    console.log("[SurveyGrid] Modal displayed");
}

function cancelSurveyAreaDrawing() { // Questa funzione ora è il reset COMPLETO di TUTTI gli stati di disegno survey
    console.log("[SurveyGrid] cancelSurveyAreaDrawing (full reset for all survey drawing states)");
    const wasInAnyInteractionMode = isDrawingSurveyArea || (typeof nativeMapClickListener === 'function') || isDrawingGridAngleLine;
    
    isDrawingSurveyArea = false;
    isDrawingGridAngleLine = false;
    gridAngleLinePoints = [];
    currentPolygonPoints = [];

    if (map) {
        const mapContainer = map.getContainer();
        // Rimuovi listener nativo del poligono, se esiste
        if (mapContainer && typeof nativeMapClickListener === 'function') {
            mapContainer.removeEventListener('click', nativeMapClickListener, true);
            console.log("[SurveyGrid] NATIVE DOM listener for polygon REMOVED by cancel.");
        }
        nativeMapClickListener = null; 

        // Rimuovi listener Leaflet
        map.off('click', handleSurveyAreaMapClick);    // Per disegno poligono
        map.off('click', handleGridAngleLineMapClick);  // Per disegno linea angolo
        map.off('mousemove', handleGridAngleLineMouseMove); // Per linea angolo
        map.getContainer().style.cursor = '';
        console.log("All survey-related map click/mousemove listeners removed by cancel.");

        if ((wasInAnyInteractionMode || !map.hasEventListeners('click', handleMapClick)) && typeof handleMapClick === 'function') {
            map.on('click', handleMapClick);
            console.log("Default map click listener RE-ENSURED by cancel.");
        }
    }
    clearTemporaryDrawing(); // Pulisce tutti i layer/marker temporanei (poligono E linea angolo)
    
    // Ripristina UI modale
    if (startDrawingSurveyAreaBtnEl) startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
    if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = true; // Disabilita Generate perché l'area è stata resettata
    if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = "Area not defined.";
    if (surveyGridInstructionsEl) surveyGridInstructionsEl.innerHTML = 'Set parameters. Click "Draw Direction" (optional) then "Draw Survey Area".';
    // Anche l'input dell'angolo potrebbe essere resettato a 0 se lo si desidera quando si cancella tutto
    // if (surveyGridAngleInputEl) surveyGridAngleInputEl.value = 0;
}

function handleCancelSurveyGrid() { 
    console.log("[SurveyGrid] handleCancelSurveyGrid (modal cancel button)");
    cancelSurveyAreaDrawing();
    if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'none';
}

// === LOGICA PER DISEGNARE LA LINEA DI DIREZIONE DELL'ANGOLO ===
function handleSetGridAngleByLine() {
    console.log("[SurveyGridAngle] handleSetGridAngleByLine called - START");

    // Se un'area era in corso o finalizzata, resettala prima di disegnare l'angolo.
    // Questo permette all'utente di cambiare l'angolo anche se aveva già un poligono.
    if (isDrawingSurveyArea || currentPolygonPoints.length > 0) {
        console.log("[SurveyGridAngle] Previous survey area existed. Resetting polygon state first.");
        isDrawingSurveyArea = false;
        currentPolygonPoints = [];
        // Pulisci solo le parti del poligono, non la linea dell'angolo se c'era
        if (tempPolygonLayer) { map.removeLayer(tempPolygonLayer); tempPolygonLayer = null; }
        tempVertexMarkers.forEach(marker => map.removeLayer(marker)); tempVertexMarkers = [];
        
        // Rimuovi il listener nativo del poligono se era attivo
        const mapContainer = map.getContainer();
        if (mapContainer && typeof nativeMapClickListener === 'function') {
            mapContainer.removeEventListener('click', nativeMapClickListener, true);
            // nativeMapClickListener = null; // Non nullificarlo qui, cancelSurveyAreaDrawing lo farà se necessario
            console.log("[SurveyGridAngle] NATIVE DOM listener for polygon REMOVED to draw angle line.");
        }
         map.off('click', handleSurveyAreaMapClick); // Rimuovi anche il fallback Leaflet per il poligono


        // Aggiorna UI per riflettere che l'area non è più definita
        if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = "Area not defined (reset for new angle).";
        if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = true;
        if (startDrawingSurveyAreaBtnEl) startDrawingSurveyAreaBtnEl.style.display = 'inline-block'; // Permetti di ridisegnare l'area dopo l'angolo
        console.log("[SurveyGridAngle] Polygon drawing state and visuals reset.");
    }
    // Ora isDrawingSurveyArea è sicuramente false.

    isDrawingGridAngleLine = true;
    gridAngleLinePoints = [];
    clearTemporaryDrawing(); // Pulisce specificamente i layer della linea dell'angolo
    console.log("[SurveyGridAngle] State set: isDrawingGridAngleLine=true, angle points/line cleared.");

    if (map && typeof handleMapClick === 'function') {
        map.off('click', handleMapClick);
        console.log("[SurveyGridAngle] Default map click listener (handleMapClick) REMOVED.");
    }
    
    if (map) {
        map.on('click', handleGridAngleLineMapClick);
        map.getContainer().style.cursor = 'crosshair';
        console.log("[SurveyGridAngle] 'handleGridAngleLineMapClick' listener ADDED to map. Cursor set.");
    } else { /* ... errore map non disponibile ... */ return; }
    
    if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'none'; 
    showCustomAlert("Draw Grid Direction: Click map for line start, click again for end.", "Set Angle");
    console.log("[SurveyGridAngle] Angle line drawing mode FULLY ACTIVATED.");
}

function handleGridAngleLineMouseMove(e) {
    if (!isDrawingGridAngleLine || gridAngleLinePoints.length !== 1) return;
    if (tempGridAngleLineLayer) map.removeLayer(tempGridAngleLineLayer);
    tempGridAngleLineLayer = L.polyline([gridAngleLinePoints[0], e.latlng], { color: 'cyan', weight: 2, dashArray: '5, 5' }).addTo(map);
}

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
        const p1 = gridAngleLinePoints[0];
        const p2 = gridAngleLinePoints[1];
        const userDrawnBearing = calculateBearing(p1, p2);
        
        surveyGridAngleInputEl.value = Math.round(userDrawnBearing);
        console.log(`[SurveyGridAngle] Line drawn. Bearing: ${userDrawnBearing.toFixed(1)}°. Set Grid Angle to: ${surveyGridAngleInputEl.value}°`);
        
        finalizeGridAngleLineDrawing(); 
    } else {
        console.warn("[SurveyGridAngle] Unexpected number of points for angle line:", gridAngleLinePoints.length);
        finalizeGridAngleLineDrawing(); // Finalizza comunque per resettare lo stato
    }
}

function finalizeGridAngleLineDrawing() {
    console.log("[SurveyGridAngle] Finalizing grid angle line drawing.");
    // ... (rimozione listener) ...
    
    if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'flex';
    if (typeof handleMapClick === 'function') map.on('click', handleMapClick);
    
    const angleValue = surveyGridAngleInputEl ? surveyGridAngleInputEl.value : 'N/A';

    if (surveyGridInstructionsEl) {
        surveyGridInstructionsEl.innerHTML = `Grid angle set to ${angleValue}°. Now click "Draw Survey Area" to define the polygon.`;
        console.log("[SurveyGridAngle] Instructions updated:", surveyGridInstructionsEl.innerHTML);
    }
    if (surveyAreaStatusEl) {
        surveyAreaStatusEl.textContent = "Area not defined (angle has been set).";
        console.log("[SurveyGridAngle] Area status updated:", surveyAreaStatusEl.textContent);
    }
    if (startDrawingSurveyAreaBtnEl) {
        startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
        console.log("[SurveyGridAngle] Start Drawing Area button display:", startDrawingSurveyAreaBtnEl.style.display);
    }
    if (confirmSurveyGridBtnEl) {
        confirmSurveyGridBtnEl.disabled = true; 
        console.log("[SurveyGridAngle] Confirm Grid button disabled:", confirmSurveyGridBtnEl.disabled);
    }

    console.log("[SurveyGridAngle] Angle line drawing finalized. Modal UI should be updated. Ready to draw survey area.");
}

// === LOGICA PER DISEGNARE L'AREA DI SURVEY (POLIGONO) ===
function handleStartDrawingSurveyArea() {
    console.log("[SurveyGrid] handleStartDrawingSurveyArea called");
    if (isDrawingGridAngleLine) {
        showCustomAlert("Please finish drawing the grid angle line first or cancel it.", "Info"); return;
    }
    if (!map || !surveyGridModalOverlayEl) { console.error("Map or Modal missing"); return; }
    
    isDrawingSurveyArea = true; currentPolygonPoints = []; clearTemporaryDrawing();
    console.log("Drawing polygon started, isDrawingSurveyArea=true.");

    if (typeof handleMapClick === 'function') map.off('click', handleMapClick);
    map.off('click', handleGridAngleLineMapClick); 
    
    const mapContainer = map.getContainer();
    if (mapContainer) {
        if (typeof nativeMapClickListener === 'function') {
            mapContainer.removeEventListener('click', nativeMapClickListener, true);
        }
        nativeMapClickListener = function(event) {
            console.log("!!! NATIVE MAP CLICK (Polygon Mode) !!! Target:", event.target);
            if (!isDrawingSurveyArea) { console.log("NATIVE CLICK (Polygon): not drawing."); return; }
            if (event.target && (event.target === mapContainer || event.target.closest('.leaflet-pane') || event.target.closest('.leaflet-container'))) {
                try {
                    const latlng = map.mouseEventToLatLng(event);
                    handleSurveyAreaMapClick({ latlng: latlng, originalEvent: event });
                } catch (mapError) { console.error("NATIVE CLICK (Polygon) Error:", mapError); }
            } else { console.log("NATIVE CLICK (Polygon): Target not map/pane."); }
        };
        mapContainer.addEventListener('click', nativeMapClickListener, true);
        console.log("[SurveyGrid] NATIVE DOM listener for polygon ADDED.");
    }
    map.getContainer().style.cursor = 'crosshair';
    surveyGridModalOverlayEl.style.display = 'none';
    console.log("Modal HIDDEN for polygon drawing.");
    showCustomAlert("Drawing survey area: Click on map to add corners. Click the first point (min 3 total) to finalize.", "Survey Drawing Active");
    console.log("Polygon drawing mode activated.");
}

function handleSurveyAreaMapClick(e) { /* ... identica a prima ... */ }
function handleFinalizeSurveyArea() { /* ... identica a prima ... */ }
// (Incollo per completezza)
function handleSurveyAreaMapClick(e) {
    console.log("[SurveyGrid] handleSurveyAreaMapClick TRIGGERED! LatLng:", e.latlng);
    if (!isDrawingSurveyArea) { console.log("Not in drawing mode."); return; }
    const clickedLatLng = e.latlng;
    currentPolygonPoints.push(clickedLatLng);
    console.log("Point added, total:", currentPolygonPoints.length);
    const vertexMarker = L.circleMarker(clickedLatLng, { radius: 6, color: 'rgba(255,0,0,0.8)', fillColor: 'rgba(255,0,0,0.5)', fillOpacity: 0.7, pane: 'markerPane' }).addTo(map);
    if (tempVertexMarkers.length === 0) {
        vertexMarker.on('click', (markerClickEvent) => {
            console.log("First vertex marker CLICKED for finalization.");
            if (isDrawingSurveyArea && currentPolygonPoints.length >= MIN_POLYGON_POINTS) {
                L.DomEvent.stopPropagation(markerClickEvent); L.DomEvent.preventDefault(markerClickEvent);
                handleFinalizeSurveyArea();
            }
        });
    }
    tempVertexMarkers.push(vertexMarker);
    updateTempPolygonDisplay();
}

function handleFinalizeSurveyArea() {
    console.log("[SurveyGrid] handleFinalizeSurveyArea called");
    if (!isDrawingSurveyArea) { 
        console.log("[SurveyGrid] Not in drawing mode or already finalized."); 
        // Se non stavamo disegnando l'area, ma forse l'angolo era appena stato finalizzato, 
        // la modale potrebbe essere aperta. Non fare nulla qui che possa sovrascrivere lo stato UI dell'angolo.
        return; 
    }
    if (currentPolygonPoints.length < MIN_POLYGON_POINTS) {
        showCustomAlert(`Area requires at least ${MIN_POLYGON_POINTS} points.`, "Info"); 
        // Non uscire dalla modalità disegno, permetti di aggiungere altri punti.
        // O se si vuole resettare:
        // cancelSurveyAreaDrawing(); // Potrebbe essere troppo drastico
        // if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'flex'; // Riapri modale
        return;
    }
    
    const mapContainer = map.getContainer();
    if (mapContainer && typeof nativeMapClickListener === 'function') {
        mapContainer.removeEventListener('click', nativeMapClickListener, true);
        nativeMapClickListener = null; 
        console.log("[SurveyGrid] NATIVE DOM listener REMOVED after polygon finalize.");
    }
    map.getContainer().style.cursor = '';
    // isDrawingSurveyArea rimane true (area definita, in attesa di generazione o cancellazione)
    // Il listener per *aggiungere* punti è rimosso.
    // Il listener di default handleMapClick è ancora disattivato.

    if (surveyGridModalOverlayEl) {
        surveyGridModalOverlayEl.style.display = 'flex'; // Riapri modale
        console.log("Modal SHOWN for confirmation after polygon finalization.");
    }

    // QUI È L'AGGIORNAMENTO CRUCIALE DELLA UI
    if (startDrawingSurveyAreaBtnEl) startDrawingSurveyAreaBtnEl.style.display = 'none'; // Hai finito di disegnare l'area
    if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = false; // ABILITA "Generate Grid"
    if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = `Area defined with ${currentPolygonPoints.length} points. Angle: ${surveyGridAngleInputEl.value}°`; // Aggiorna lo stato
    if (surveyGridInstructionsEl) surveyGridInstructionsEl.innerHTML = '<strong style="color: #2ecc71;">Area finalized!</strong> Adjust parameters or click "Generate Grid".';
    
    if (tempPolygonLayer) tempPolygonLayer.setStyle({ color: 'rgba(0, 50, 200, 0.9)', fillColor: 'rgba(0, 50, 200, 0.4)' });
    tempVertexMarkers.forEach(marker => marker.off('click'));
    console.log("[SurveyGrid] Area finalized. Modal UI updated for generation. isDrawingSurveyArea is STILL TRUE.");
}


// === GRID GENERATION LOGIC (NO OVERSHOOT) ===
function generateSurveyGridWaypoints(polygonLatLngs, flightAltitudeAGL, sidelapPercent, frontlapPercent, gridAngleDeg, flightSpeed) { /* ... identica all'ultima versione funzionante senza overshoot ... */ }
function handleConfirmSurveyGridGeneration() { /* ... identica all'ultima versione funzionante senza overshoot ... */ }
// (Incollo per completezza)
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
        // console.log(`  Added ${lineCandRot.filter(rotPt => isPointInPolygon(rotateLatLng(rotPt, rotationCenter, angleRad), polygonLatLngs)).length} waypoints for line ${lines}.`);
        
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
    if (currentPolygonPoints.length < MIN_POLYGON_POINTS) { showCustomAlert("Survey area not defined.", "Error"); return; }
    if (!surveyGridAltitudeInputEl || !surveySidelapInputEl || !surveyFrontlapInputEl || !surveyGridAngleInputEl || !flightSpeedSlider ) { 
        showCustomAlert("Missing input elements.", "Error"); return; 
    }
    const altitude = parseInt(surveyGridAltitudeInputEl.value);
    const sidelap = parseFloat(surveySidelapInputEl.value);
    const frontlap = parseFloat(surveyFrontlapInputEl.value);
    const angle = parseFloat(surveyGridAngleInputEl.value);
    // const overshoot = 0; // Non più un input
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
    handleCancelSurveyGrid();
}
