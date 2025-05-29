// File: surveyGridManager.js

// Depends on: config.js (for isDrawingSurveyArea, map, DOM elements for modal, R_EARTH)
// Depends on: mapManager.js (for map object, and assumes handleMapClick is a global function from there)
// Depends on: utils.js (for showCustomAlert, and toRad if global)
// Depends on: waypointManager.js (for addWaypoint)

let currentPolygonPoints = [];
let tempPolygonLayer = null;
let tempVertexMarkers = [];
let nativeMapClickListener = null;

const MIN_POLYGON_POINTS = 3;

// --- PARAMETRI CAMERA PER DJI MINI 4 PRO (BASATI SUI TUOI DATI E LUNGHEZZA FOCALE CALCOLATA) ---
const FIXED_CAMERA_PARAMS = {
    sensorWidth_mm: 8.976,  // Calcolato: 4032 * 0.002225663181466
    sensorHeight_mm: 6.716, // Calcolato: 3024 * 0.002221383424304
    focalLength_mm: 6.88    // TUA LUNGHEZZA FOCALE CALCOLATA
};


// === HELPER FUNCTIONS ===
function clearTemporaryDrawing() { /* ... come prima ... */ }
function updateTempPolygonDisplay() { /* ... come prima ... */ }
function toRad(degrees) { return degrees * Math.PI / 180; }
function rotateLatLng(pointLatLng, centerLatLng, angleRadians) { /* ... come prima ... */ }
function isPointInPolygon(point, polygonVertices) { /* ... come prima ... */ }
function destinationPoint(startLatLng, bearingDeg, distanceMeters) { /* ... come prima ... */ }

// Incollo di nuovo le definizioni degli helper per completezza nel caso servissero modifiche interne
function clearTemporaryDrawing() {
    console.log("[SurveyGrid] clearTemporaryDrawing called");
    if (tempPolygonLayer) { map.removeLayer(tempPolygonLayer); tempPolygonLayer = null; }
    tempVertexMarkers.forEach(marker => map.removeLayer(marker)); tempVertexMarkers = [];
}

function updateTempPolygonDisplay() {
    console.log("[SurveyGrid] updateTempPolygonDisplay called");
    if (tempPolygonLayer) { map.removeLayer(tempPolygonLayer); tempPolygonLayer = null; }
    if (currentPolygonPoints.length < 2) return;
    const opts = { color: 'rgba(0, 100, 255, 0.7)', weight: 2, fillColor: 'rgba(0, 100, 255, 0.2)', fillOpacity: 0.3 };
    if (currentPolygonPoints.length === 2) tempPolygonLayer = L.polyline(currentPolygonPoints, opts).addTo(map);
    else if (currentPolygonPoints.length >= MIN_POLYGON_POINTS) tempPolygonLayer = L.polygon(currentPolygonPoints, opts).addTo(map);
}

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


/**
 * Calcola il footprint a terra della camera.
 */
function calculateFootprint(altitudeAGL, cameraParams) {
    if (!cameraParams || !cameraParams.focalLength_mm || cameraParams.focalLength_mm === 0) {
        console.error("Invalid camera parameters for footprint calculation.");
        return { width: 0, height: 0 };
    }
    // Assumiamo gimbal nadirale (-90 gradi)
    const footprintWidth = (cameraParams.sensorWidth_mm / cameraParams.focalLength_mm) * altitudeAGL;
    const footprintHeight = (cameraParams.sensorHeight_mm / cameraParams.focalLength_mm) * altitudeAGL; // Altezza del footprint è lungo la direzione di volo
    console.log(`[FootprintCalc] Alt: ${altitudeAGL}m, SW: ${cameraParams.sensorWidth_mm}, SH: ${cameraParams.sensorHeight_mm}, FL: ${cameraParams.focalLength_mm} => Footprint W (across track): ${footprintWidth.toFixed(1)}m, Footprint H (along track): ${footprintHeight.toFixed(1)}m`);
    return { width: footprintWidth, height: footprintHeight };
}


// === MAIN UI HANDLERS ===
function openSurveyGridModal() { /* ... come prima ... */ }
function cancelSurveyAreaDrawing() { /* ... come prima ... */ }
function handleStartDrawingSurveyArea() { /* ... come prima ... */ }
function handleSurveyAreaMapClick(e) { /* ... come prima ... */ }
function handleFinalizeSurveyArea() { /* ... come prima ... */ }
function handleCancelSurveyGrid() { /* ... come prima ... */ }

// Incollo le UI handlers per riferimento rapido, non dovrebbero cambiare molto
function openSurveyGridModal() {
    console.log("[SurveyGrid] openSurveyGridModal called");
    if (!surveyGridModalOverlayEl || !defaultAltitudeSlider || !surveyGridAltitudeInputEl || !surveySidelapInputEl || !surveyFrontlapInputEl || !confirmSurveyGridBtnEl || !finalizeSurveyAreaBtnEl || !startDrawingSurveyAreaBtnEl || !surveyAreaStatusEl || !surveyGridInstructionsEl) {
        showCustomAlert("Survey grid modal elements not found or incomplete.", "Error"); return;
    }
    surveyGridAltitudeInputEl.value = defaultAltitudeSlider.value;
    // Imposta valori di default per overlap se non presenti
    if (!surveySidelapInputEl.value) surveySidelapInputEl.value = 70;
    if (!surveyFrontlapInputEl.value) surveyFrontlapInputEl.value = 80;

    cancelSurveyAreaDrawing();
    confirmSurveyGridBtnEl.disabled = true;
    finalizeSurveyAreaBtnEl.style.display = 'none';
    startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
    surveyAreaStatusEl.textContent = "Area not defined.";
    surveyGridInstructionsEl.innerHTML = 'Click "Start Drawing", then click on map to define corners. Click first point to close.';
    surveyGridModalOverlayEl.style.display = 'flex';
    console.log("[SurveyGrid] Modal displayed");
}
function cancelSurveyAreaDrawing() {
    console.log("[SurveyGrid] cancelSurveyAreaDrawing called");
    const wasActive = isDrawingSurveyArea || nativeMapClickListener;
    isDrawingSurveyArea = false;
    if (map) {
        const mapContainer = map.getContainer();
        if (mapContainer && nativeMapClickListener) {
            mapContainer.removeEventListener('click', nativeMapClickListener, true);
            nativeMapClickListener = null; console.log("NATIVE DOM listener REMOVED.");
        }
        map.off('click', handleSurveyAreaMapClick);
        map.getContainer().style.cursor = '';
        console.log("All drawing listeners removed.");
        if ((wasActive || !map.hasEventListeners('click', handleMapClick)) && typeof handleMapClick === 'function') {
            map.on('click', handleMapClick); console.log("Default map click listener RE-ENSURED.");
        }
    }
    clearTemporaryDrawing(); currentPolygonPoints = [];
    if (startDrawingSurveyAreaBtnEl) startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
    if (finalizeSurveyAreaBtnEl) finalizeSurveyAreaBtnEl.style.display = 'none';
    if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = true;
    if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = "Area not defined.";
    if (surveyGridInstructionsEl) surveyGridInstructionsEl.innerHTML = 'Click "Start Drawing", then click on map to define corners. Click first point to close.';
}
function handleStartDrawingSurveyArea() {
    console.log("[SurveyGrid] handleStartDrawingSurveyArea called");
    if (!map || !surveyGridModalOverlayEl) { console.error("Map or Modal missing"); return; }
    isDrawingSurveyArea = true; currentPolygonPoints = []; clearTemporaryDrawing();
    console.log("Drawing started, isDrawingSurveyArea=true.");
    if (typeof handleMapClick === 'function') {
        map.off('click', handleMapClick); console.log("Default map listener REMOVED.");
    }
    map.off('click', handleSurveyAreaMapClick);
    const mapContainer = map.getContainer();
    if (mapContainer) {
        if (nativeMapClickListener) mapContainer.removeEventListener('click', nativeMapClickListener, true);
        nativeMapClickListener = function(event) {
            console.log("!!! NATIVE MAP CLICK !!! Target:", event.target);
            if (!isDrawingSurveyArea) { console.log("NATIVE CLICK: not drawing."); return; }
            if (event.target && (event.target === mapContainer || event.target.closest('.leaflet-pane') || event.target.closest('.leaflet-container'))) {
                try {
                    const latlng = map.mouseEventToLatLng(event);
                    handleSurveyAreaMapClick({ latlng: latlng, originalEvent: event });
                } catch (mapError) { console.error("NATIVE CLICK Error:", mapError); }
            } else { console.log("NATIVE CLICK: Target not map/pane."); }
        };
        mapContainer.addEventListener('click', nativeMapClickListener, true);
        console.log("NATIVE DOM listener ADDED.");
    }
    map.getContainer().style.cursor = 'crosshair';
    surveyGridModalOverlayEl.style.display = 'none';
    console.log("Modal HIDDEN for drawing.");
    showCustomAlert("Drawing survey area: Click on map to add corners. Click the first point (min 3 total) to finalize.", "Survey Drawing Active");
    console.log("Drawing mode activated.");
}
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
    if (!isDrawingSurveyArea) { console.log("Not in drawing mode or already finalized."); return; }
    if (currentPolygonPoints.length < MIN_POLYGON_POINTS) {
        showCustomAlert(`Area requires at least ${MIN_POLYGON_POINTS} points.`, "Info"); return;
    }
    const mapContainer = map.getContainer();
    if (mapContainer && nativeMapClickListener) {
        mapContainer.removeEventListener('click', nativeMapClickListener, true);
        nativeMapClickListener = null; console.log("NATIVE DOM listener REMOVED after finalize.");
    }
    map.getContainer().style.cursor = '';
    if (surveyGridModalOverlayEl) {
        surveyGridModalOverlayEl.style.display = 'flex';
        console.log("Modal SHOWN for confirmation.");
    }
    if (finalizeSurveyAreaBtnEl) finalizeSurveyAreaBtnEl.style.display = 'none';
    if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = false;
    if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = `Area defined: ${currentPolygonPoints.length} points.`;
    if (surveyGridInstructionsEl) surveyGridInstructionsEl.innerHTML = '<strong style="color: #2ecc71;">Area finalized!</strong> Adjust parameters or click "Generate Grid".';
    if (tempPolygonLayer) tempPolygonLayer.setStyle({ color: 'rgba(0, 50, 200, 0.9)', fillColor: 'rgba(0, 50, 200, 0.4)' });
    tempVertexMarkers.forEach(marker => marker.off('click'));
    console.log("Area finalized. Modal shown for confirmation.");
}
function handleCancelSurveyGrid() {
    console.log("[SurveyGrid] handleCancelSurveyGrid called");
    cancelSurveyAreaDrawing();
    if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'none';
}


// === GRID GENERATION LOGIC ===
/**
 * Genera waypoint per la griglia di survey basata su overlap.
 * @param {L.LatLng[]} polygonLatLngs Vertici del poligono.
 * @param {number} flightAltitudeAGL Altitudine di volo AGL.
 * @param {number} sidelapPercent Percentuale di sovrapposizione laterale.
 * @param {number} frontlapPercent Percentuale di sovrapposizione frontale.
 * @param {number} gridAngleDeg Angolo della griglia.
 * @param {number} overshootDistance Distanza di overshoot.
 * @param {number} flightSpeed Velocità di volo (per info).
 * @returns {object[]} Array di oggetti waypoint.
 */
function generateSurveyGridWaypoints(polygonLatLngs, flightAltitudeAGL, sidelapPercent, frontlapPercent, gridAngleDeg, overshootDistance, flightSpeed) {
    console.log("[SurveyGridGen] Starting generation (OVERLAP BASED) with:", {
        polygonPts: polygonLatLngs ? polygonLatLngs.length : 0, flightAltitudeAGL, sidelapPercent, frontlapPercent, gridAngleDeg, overshootDistance, flightSpeed
    });
    const finalWaypointsData = [];
    if (!polygonLatLngs || polygonLatLngs.length < MIN_POLYGON_POINTS) {
        showCustomAlert("Invalid polygon for generation.", "Error"); return finalWaypointsData;
    }

    // Calcolo Footprint e Spaziature Basate su Overlap
    const footprint = calculateFootprint(flightAltitudeAGL, FIXED_CAMERA_PARAMS);
    if (footprint.width <= 0 || footprint.height <= 0) {
        showCustomAlert("Footprint calculation error.", "Grid Error"); return finalWaypointsData;
    }

    const actualLineSpacing = footprint.width * (1 - sidelapPercent / 100);      // Distanza tra le linee (basata su larghezza footprint e sidelap)
    const actualDistanceBetweenPhotos = footprint.height * (1 - frontlapPercent / 100); // Distanza tra foto sulla linea (basata su altezza footprint e frontlap)

    console.log(`[SurveyGridGen] Sidelap: ${sidelapPercent}%, Frontlap: ${frontlapPercent}%`);
    console.log(`[SurveyGridGen] Calculated Actual Line Spacing: ${actualLineSpacing.toFixed(1)}m`);
    console.log(`[SurveyGridGen] Calculated Actual Distance Between Photos: ${actualDistanceBetweenPhotos.toFixed(1)}m`);

    if (actualLineSpacing <= 0.1 || actualDistanceBetweenPhotos <= 0.1) {
        showCustomAlert("Calculated spacing/photo distance is too small. Check overlap/footprint.", "Grid Error"); return finalWaypointsData;
    }
    
    const requiredPhotoInterval_s = actualDistanceBetweenPhotos / flightSpeed;
    console.log(`[SurveyGridGen] Flight Speed: ${flightSpeed} m/s => Required Photo Interval: ${requiredPhotoInterval_s.toFixed(1)}s`);
    if (requiredPhotoInterval_s < 1.8 && flightSpeed > 0) { // Considera flightSpeed > 0
        showCustomAlert(`Warning: Flight speed may be too high for the camera's minimum interval (Photo interval: ${requiredPhotoInterval_s.toFixed(1)}s).`, "Speed Warning");
    }

    const rotationCenter = polygonLatLngs[0];
    const angleRad = toRad(gridAngleDeg);
    const rotatedPolygonLatLngs = polygonLatLngs.map(p => rotateLatLng(p, rotationCenter, -angleRad));
    const rotatedBounds = L.latLngBounds(rotatedPolygonLatLngs);
    const rNE = rotatedBounds.getNorthEast(); const rSW = rotatedBounds.getSouthWest();

    if (rSW.lat >= rNE.lat - 1e-7 || rSW.lng >= rNE.lng - 1e-7) { /* ... errore ... */ return finalWaypointsData; }

    const earthR = (typeof R_EARTH !== 'undefined') ? R_EARTH : 6371000;
    const lineSpacingRotLat = (actualLineSpacing / earthR) * (180 / Math.PI); // Usa actualLineSpacing
    const photoSpacingRotLng = (actualDistanceBetweenPhotos / (earthR * Math.cos(toRad(rotationCenter.lat)))) * (180 / Math.PI); // Usa actualDistanceBetweenPhotos

    if (lineSpacingRotLat <= 1e-9 || photoSpacingRotLng <= 1e-9) { /* ... errore ... */ return finalWaypointsData; }

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

        const actualGeoPtsOnLine = [];
        lineCandRot.forEach(rotPt => {
            const actualGeoPt = rotateLatLng(rotPt, rotationCenter, angleRad);
            if (isPointInPolygon(actualGeoPt, polygonLatLngs)) actualGeoPtsOnLine.push(actualGeoPt);
        });

        if (actualGeoPtsOnLine.length > 0) {
            console.log(`[SurveyGridGen] Line ${lines}: Found ${actualGeoPtsOnLine.length} internal points.`);
            let lineBear = gridAngleDeg; if (scanDir === -1) lineBear = (gridAngleDeg + 180);
            lineBear = (lineBear % 360 + 360) % 360;
            let oppositeLineBear = (lineBear + 180) % 360;
            
            let waypointsForThisLine = [];
            const photoWpOptions = { altitude: flightAltitudeAGL, cameraAction: 'takePhoto', headingControl: 'fixed', fixedHeading: Math.round(lineBear) };
            const noPhotoWpOptions = { altitude: flightAltitudeAGL, cameraAction: 'none', headingControl: 'fixed', fixedHeading: Math.round(lineBear) };

            const firstInternalGeo = actualGeoPtsOnLine[0];
            const lastInternalGeo = actualGeoPtsOnLine[actualGeoPtsOnLine.length - 1];

            if (overshootDistance > 0.1) {
                waypointsForThisLine.push({ latlng: destinationPoint(firstInternalGeo, oppositeLineBear, overshootDistance), options: noPhotoWpOptions });
            }
            actualGeoPtsOnLine.forEach(internalPt => {
                waypointsForThisLine.push({ latlng: internalPt, options: photoWpOptions });
            });
            if (overshootDistance > 0.1) {
                const endOvershootPoint = destinationPoint(lastInternalGeo, lineBear, overshootDistance);
                if (!waypointsForThisLine.length || waypointsForThisLine[waypointsForThisLine.length-1].latlng.distanceTo(endOvershootPoint) > 1) {
                    waypointsForThisLine.push({ latlng: endOvershootPoint, options: noPhotoWpOptions });
                }
            }
            
            const uniqueWaypointsOnLine = []; const seenLatLngsKeys = new Set();
            for (const wp of waypointsForThisLine) {
                const key = `${wp.latlng.lat.toFixed(7)},${wp.latlng.lng.toFixed(7)}`;
                if (!seenLatLngsKeys.has(key)) { uniqueWaypointsOnLine.push(wp); seenLatLngsKeys.add(key); }
            }
            finalWaypointsData.push(...uniqueWaypointsOnLine);
            console.log(`  Added ${uniqueWaypointsOnLine.length} waypoints for this line (incl. overshoot & filtering).`);
        }
        currentRotLat += lineSpacingRotLat;
        if (lines > 2000) { console.error("Too many lines"); break; }
        scanDir *= -1;
    }
    console.log(`[SurveyGridGen] Total waypoints generated (overlap based): ${finalWaypointsData.length}`);
    if (finalWaypointsData.length === 0 && polygonLatLngs.length >= MIN_POLYGON_POINTS && lines > 0) {
        showCustomAlert("No waypoints generated. Check parameters.", "Grid Warning");
    }
    return finalWaypointsData;
}

function handleConfirmSurveyGridGeneration() {
    console.log("[SurveyGrid] handleConfirmSurveyGridGeneration called");
    if (currentPolygonPoints.length < MIN_POLYGON_POINTS) { showCustomAlert("Survey area not defined.", "Error"); return; }
    if (!surveyGridAltitudeInputEl || !surveySidelapInputEl || !surveyFrontlapInputEl || !surveyGridAngleInputEl || !surveyGridOvershootInputEl) { 
        showCustomAlert("Missing input elements for survey grid.", "Error"); return; 
    }
    
    const altitude = parseInt(surveyGridAltitudeInputEl.value);
    const sidelap = parseFloat(surveySidelapInputEl.value); // Nuovo
    const frontlap = parseFloat(surveyFrontlapInputEl.value); // Nuovo
    const angle = parseFloat(surveyGridAngleInputEl.value);
    const overshoot = parseFloat(surveyGridOvershootInputEl.value);
    const speed = parseFloat(flightSpeedSlider.value); // Globale

    if (isNaN(altitude) || altitude < 1) { showCustomAlert("Invalid altitude.", "Input Error"); return; }
    if (isNaN(sidelap) || sidelap < 10 || sidelap > 95) { showCustomAlert("Invalid Sidelap % (10-95).", "Input Error"); return; }
    if (isNaN(frontlap) || frontlap < 10 || frontlap > 95) { showCustomAlert("Invalid Frontlap % (10-95).", "Input Error"); return; }
    if (isNaN(angle)) { showCustomAlert("Invalid grid angle.", "Input Error"); return; }
    if (isNaN(overshoot) || overshoot < 0) { showCustomAlert("Invalid overshoot.", "Input Error"); return; }
    if (isNaN(speed) || speed <= 0) {showCustomAlert("Invalid flight speed.", "Input Error"); return; }


    if (surveyGridInstructionsEl) surveyGridInstructionsEl.textContent = "Generating grid waypoints...";
    const surveyWaypoints = generateSurveyGridWaypoints(currentPolygonPoints, altitude, sidelap, frontlap, angle, overshoot, speed);

    if (surveyWaypoints && surveyWaypoints.length > 0) {
       surveyWaypoints.forEach(wpData => addWaypoint(wpData.latlng, wpData.options));
       updateWaypointList(); updateFlightPath(); updateFlightStatistics(); fitMapToWaypoints();
       showCustomAlert(`${surveyWaypoints.length} survey waypoints generated!`, "Success");
    } else if (surveyWaypoints && surveyWaypoints.length === 0 ) { // Non serve più il controllo polygonLatLngs qui se generate lo fa
        console.warn("generateSurveyGridWaypoints returned empty array.");
    } else if (!surveyWaypoints) { // Caso in cui la funzione restituisce null/undefined (non dovrebbe)
        showCustomAlert("Error during grid generation (function returned null).", "Error");
    }
    handleCancelSurveyGrid();
}
