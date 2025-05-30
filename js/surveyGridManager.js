// File: surveyGridManager.js
// Aggiunta logica per disegnare la linea di direzione dell'angolo.

// Variabili globali da config.js: isDrawingSurveyArea, isDrawingGridAngleLine, gridAngleLinePoints, map
// Variabili DOM globali: surveyGridModalOverlayEl, surveyGridAngleInputEl, ecc.

let currentPolygonPoints = []; // Vertici del poligono di survey
let tempPolygonLayer = null;   // Layer per poligono di survey
let tempVertexMarkers = [];  // Marker per vertici poligono survey

let tempGridAngleLineLayer = null; // Layer per la linea di direzione angolo
let tempGridAnglePointMarkers = []; // Marker per i punti della linea angolo

const MIN_POLYGON_POINTS = 3;

const FIXED_CAMERA_PARAMS = { /* ... come prima ... */ };

// === HELPER FUNCTIONS (identiche a prima) ===
function clearTemporaryDrawing() { /* ... */ }
function updateTempPolygonDisplay() { /* ... */ }
function toRad(degrees) { return degrees * Math.PI / 180; }
function rotateLatLng(pointLatLng, centerLatLng, angleRadians) { /* ... */ }
function isPointInPolygon(point, polygonVertices) { /* ... */ }
function destinationPoint(startLatLng, bearingDeg, distanceMeters) { /* ... */ }
function calculateBearing(point1LatLng, point2LatLng) { /* ... */ }
function calculateFootprint(altitudeAGL, cameraParams) { /* ... */ }
// (Incollo le helper per completezza)
function clearTemporaryDrawing() {
    console.log("[SurveyGrid] clearTemporaryDrawing (all polys/lines/markers)");
    if (tempPolygonLayer) { map.removeLayer(tempPolygonLayer); tempPolygonLayer = null; }
    tempVertexMarkers.forEach(marker => map.removeLayer(marker)); tempVertexMarkers = [];
    
    if (tempGridAngleLineLayer) { map.removeLayer(tempGridAngleLineLayer); tempGridAngleLineLayer = null; }
    tempGridAnglePointMarkers.forEach(marker => map.removeLayer(marker)); tempGridAnglePointMarkers = [];
}
function updateTempPolygonDisplay() { /* ... come prima ... */ }
function toRad(degrees) { return degrees * Math.PI / 180; }
function rotateLatLng(pointLatLng, centerLatLng, angleRadians) { /* ... come prima ... */ }
function isPointInPolygon(point, polygonVertices) { /* ... come prima ... */ }
function destinationPoint(startLatLng, bearingDeg, distanceMeters) { /* ... come prima ... */ }
function calculateBearing(point1LatLng, point2LatLng) {
    const lat1 = toRad(point1LatLng.lat); const lon1 = toRad(point1LatLng.lng);
    const lat2 = toRad(point2LatLng.lat); const lon2 = toRad(point2LatLng.lng);
    const dLon = lon2 - lon1;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    let brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
}
function calculateFootprint(altitudeAGL, cameraParams) { /* ... come prima ... */ }


// === GESTIONE MODALE E STATO DISEGNO ===
function openSurveyGridModal() {
    console.log("[SurveyGrid] openSurveyGridModal called");
    // ... (controlli elementi DOM come prima) ...
    isDrawingGridAngleLine = false; // Assicura reset stato disegno linea angolo
    gridAngleLinePoints = [];
    // ... (resto della funzione come prima, imposta valori default, chiama cancelSurveyAreaDrawing) ...
    surveyGridModalOverlayEl.style.display = 'flex';
}

function cancelSurveyAreaDrawing() { // Resetta TUTTO ciò che è relativo alla survey grid
    console.log("[SurveyGrid] cancelSurveyAreaDrawing (full reset for survey grid process)");
    const wasActive = isDrawingSurveyArea || nativeMapClickListener || isDrawingGridAngleLine;
    isDrawingSurveyArea = false;
    isDrawingGridAngleLine = false;
    gridAngleLinePoints = [];

    if (map) {
        const mapContainer = map.getContainer();
        if (mapContainer && nativeMapClickListener) { // Per disegno poligono
            mapContainer.removeEventListener('click', nativeMapClickListener, true);
            nativeMapClickListener = null;
        }
        map.off('click', handleSurveyAreaMapClick); // Per disegno poligono (Leaflet fallback)
        map.off('click', handleGridAngleLineMapClick); // Per disegno linea angolo
        map.off('mousemove', handleGridAngleLineMouseMove); // Per linea angolo che segue mouse
        map.getContainer().style.cursor = '';
        console.log("All survey-related map listeners removed.");

        if ((wasActive || !map.hasEventListeners('click', handleMapClick)) && typeof handleMapClick === 'function') {
            map.on('click', handleMapClick);
            console.log("Default map click listener RE-ENSURED.");
        }
    }
    clearTemporaryDrawing(); // Pulisce tutti i layer/marker temporanei
    currentPolygonPoints = [];
    // ... (reset UI modale come prima) ...
}

function handleCancelSurveyGrid() { // Chiamato dal pulsante "Cancel" della modale
    console.log("[SurveyGrid] handleCancelSurveyGrid called (modal cancel button)");
    cancelSurveyAreaDrawing(); // Fa il cleanup completo
    if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'none';
}


// === LOGICA PER DISEGNARE LA LINEA DI DIREZIONE DELL'ANGOLO ===
function handleSetGridAngleByLine() {
    console.log("[SurveyGridAngle] handleSetGridAngleByLine called");
    if (isDrawingSurveyArea) {
        showCustomAlert("Please finalize or cancel current survey area drawing first.", "Info");
        return;
    }
    isDrawingGridAngleLine = true;
    gridAngleLinePoints = [];
    clearTemporaryDrawing(); // Pulisce tutto, inclusi eventuali poligoni precedenti

    if (typeof handleMapClick === 'function') map.off('click', handleMapClick); // Disattiva click mappa default
    map.on('click', handleGridAngleLineMapClick);
    map.getContainer().style.cursor = 'crosshair';
    
    if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'none'; // Nascondi modale
    showCustomAlert("Draw Grid Direction: Click map for line start, click again for end.", "Set Angle");
    console.log("[SurveyGridAngle] Angle line drawing mode ACTIVATED.");
}

function handleGridAngleLineMouseMove(e) {
    if (!isDrawingGridAngleLine || gridAngleLinePoints.length !== 1) return;
    if (tempGridAngleLineLayer) map.removeLayer(tempGridAngleLineLayer);
    tempGridAngleLineLayer = L.polyline([gridAngleLinePoints[0], e.latlng], { color: 'cyan', weight: 2, dashArray: '5, 5' }).addTo(map);
}

function handleGridAngleLineMapClick(e) {
    console.log("[SurveyGridAngle] handleGridAngleLineMapClick TRIGGERED!", e.latlng);
    if (!isDrawingGridAngleLine) return;

    L.DomEvent.stopPropagation(e.originalEvent); // Per evitare che questo click faccia altro

    gridAngleLinePoints.push(e.latlng);
    const marker = L.circleMarker(e.latlng, { radius: 5, color: 'cyan' }).addTo(map);
    tempGridAnglePointMarkers.push(marker);

    if (gridAngleLinePoints.length === 1) { // Primo punto della linea
        map.on('mousemove', handleGridAngleLineMouseMove);
        console.log("[SurveyGridAngle] First point set. Move mouse for second point.");
    } else if (gridAngleLinePoints.length === 2) { // Secondo punto, linea definita
        const p1 = gridAngleLinePoints[0];
        const p2 = gridAngleLinePoints[1];
        const userDrawnBearing = calculateBearing(p1, p2);
        
        // La nostra generateSurveyGridWaypoints si aspetta: 0=E-W, 90=N-S
        // calculateBearing dà: 0=N, 90=E, 180=S, 270=W
        // Se l'utente disegna una linea E-W (bearing ~90), vogliamo angolo 0.
        // Se l'utente disegna una linea N-S (bearing ~0), vogliamo angolo 90.
        // Quindi, angleForGenerator = (userDrawnBearing - 90 + 360) % 360 se vogliamo linee // a quella disegnata.
        // No, più semplice: se l'utente disegna la direzione DELLE LINEE DI VOLO:
        let gridAngleForGenerator = userDrawnBearing;
        // E la nostra generazione è E-W per angolo 0, N-S per angolo 90.
        // Quindi l'angolo disegnato è direttamente l'angolo di rotazione del poligono.
        // L'heading sarà questo angolo.
        
        surveyGridAngleInputEl.value = Math.round(gridAngleForGenerator);
        console.log(`[SurveyGridAngle] Line drawn. Bearing: ${userDrawnBearing.toFixed(1)}°. Set Grid Angle to: ${surveyGridAngleInputEl.value}°`);
        
        finalizeGridAngleLineDrawing();
    }
}

function finalizeGridAngleLineDrawing() {
    console.log("[SurveyGridAngle] Finalizing grid angle line drawing.");
    isDrawingGridAngleLine = false;
    map.off('click', handleGridAngleLineMapClick);
    map.off('mousemove', handleGridAngleLineMouseMove);
    map.getContainer().style.cursor = '';
    
    // Non cancellare tempGridAngleLineLayer e tempGridAnglePointMarkers qui,
    // lo farà clearTemporaryDrawing la prossima volta che si inizia un disegno
    // o si apre la modale. Potrebbe essere utile vederla brevemente.
    // Oppure, rimuovili se preferisci:
    // if (tempGridAngleLineLayer) map.removeLayer(tempGridAngleLineLayer); tempGridAngleLineLayer = null;
    // tempGridAnglePointMarkers.forEach(m => map.removeLayer(m)); tempGridAnglePointMarkers = [];


    if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'flex'; // Riapri modale
    if (typeof handleMapClick === 'function') map.on('click', handleMapClick); // Riattiva click mappa default
    showCustomAlert(`Grid angle set to ${surveyGridAngleInputEl.value}° based on drawn line. Now draw the survey area.`, "Angle Set");
}


// === LOGICA PER DISEGNARE L'AREA DI SURVEY (POLIGONO) ===
function handleStartDrawingSurveyArea() { /* ... come prima, ma assicurati che isDrawingGridAngleLine sia false ... */ }
function handleSurveyAreaMapClick(e) { /* ... come prima ... */ }
function handleFinalizeSurveyArea() { /* ... come prima ... */ }

// Riscrivo handleStartDrawingSurveyArea per il controllo
function handleStartDrawingSurveyArea() {
    console.log("[SurveyGrid] handleStartDrawingSurveyArea called");
    if (isDrawingGridAngleLine) {
        showCustomAlert("Please finish drawing the grid angle line first or cancel it.", "Info");
        return;
    }
    if (!map || !surveyGridModalOverlayEl) { console.error("Map or Modal missing"); return; }
    // ... (resto come l'ultima versione che funzionava per il disegno del poligono)
    isDrawingSurveyArea = true; currentPolygonPoints = []; clearTemporaryDrawing();
    console.log("Drawing polygon started, isDrawingSurveyArea=true.");
    if (typeof handleMapClick === 'function') {
        map.off('click', handleMapClick); console.log("Default map listener REMOVED.");
    }
    map.off('click', handleGridAngleLineMapClick); // Assicura che il listener per l'angolo sia off
    
    const mapContainer = map.getContainer();
    if (mapContainer) {
        if (nativeMapClickListener) mapContainer.removeEventListener('click', nativeMapClickListener, true);
        nativeMapClickListener = function(event) { /* ... come prima ... */ };
        mapContainer.addEventListener('click', nativeMapClickListener, true);
        console.log("NATIVE DOM listener for polygon ADDED.");
    }
    map.getContainer().style.cursor = 'crosshair';
    surveyGridModalOverlayEl.style.display = 'none';
    console.log("Modal HIDDEN for polygon drawing.");
    showCustomAlert("Drawing survey area: Click on map to add corners. Click the first point (min 3 total) to finalize.", "Survey Drawing Active");
    console.log("Polygon drawing mode activated.");
}


// === GRID GENERATION LOGIC (SENZA OVERSHOOT) ===
function generateSurveyGridWaypoints(polygonLatLngs, flightAltitudeAGL, sidelapPercent, frontlapPercent, gridAngleDeg, flightSpeed) { /* ... come ultima versione funzionante ... */ }
function handleConfirmSurveyGridGeneration() { /* ... come ultima versione funzionante ... */ }

// Incollo generateSurveyGridWaypoints e handleConfirm per completezza
function generateSurveyGridWaypoints(polygonLatLngs, flightAltitudeAGL, sidelapPercent, frontlapPercent, gridAngleDeg, flightSpeed) {
    console.log("[SurveyGridGen] Starting generation (NO OVERSHOOT) with:", {
        polygonPts: polygonLatLngs ? polygonLatLngs.length : 0, flightAltitudeAGL, sidelapPercent, frontlapPercent, gridAngleDeg, flightSpeed
    });
    const finalWaypointsData = [];
    if (!polygonLatLngs || polygonLatLngs.length < MIN_POLYGON_POINTS) {
        showCustomAlert("Invalid polygon for generation.", "Error"); return finalWaypointsData;
    }

    const footprint = calculateFootprint(flightAltitudeAGL, FIXED_CAMERA_PARAMS);
    if (footprint.width <= 0 || footprint.height <= 0) { /* ... errore ... */ return finalWaypointsData; }
    const actualLineSpacing = footprint.width * (1 - sidelapPercent / 100);
    const actualDistanceBetweenPhotos = footprint.height * (1 - frontlapPercent / 100);
    console.log(`[SurveyGridGen] Actual Line Spacing: ${actualLineSpacing.toFixed(1)}m, Photo Distance: ${actualDistanceBetweenPhotos.toFixed(1)}m`);
    if (actualLineSpacing <= 0.1 || actualDistanceBetweenPhotos <= 0.1) { /* ... errore ... */ return finalWaypointsData; }
    
    const requiredPhotoInterval_s = actualDistanceBetweenPhotos / flightSpeed;
    console.log(`[SurveyGridGen] Req. Photo Interval: ${requiredPhotoInterval_s.toFixed(1)}s`);
    if (requiredPhotoInterval_s < 1.8 && flightSpeed > 0) { /* ... warning ... */ }

    const rotationCenter = polygonLatLngs[0];
    const angleRad = toRad(gridAngleDeg);
    const rotatedPolygonLatLngs = polygonLatLngs.map(p => rotateLatLng(p, rotationCenter, -angleRad));
    const rotatedBounds = L.latLngBounds(rotatedPolygonLatLngs);
    const rNE = rotatedBounds.getNorthEast(); const rSW = rotatedBounds.getSouthWest();
    if (rSW.lat >= rNE.lat - 1e-7 || rSW.lng >= rNE.lng - 1e-7) { /* ... errore ... */ return finalWaypointsData; }

    const earthR = (typeof R_EARTH !== 'undefined') ? R_EARTH : 6371000;
    const lineSpacingRotLat = (actualLineSpacing / earthR) * (180 / Math.PI);
    const photoSpacingRotLng = (actualDistanceBetweenPhotos / (earthR * Math.cos(toRad(rotationCenter.lat)))) * (180 / Math.PI);
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
        console.log(`  Added ${lineCandRot.filter(rotPt => isPointInPolygon(rotateLatLng(rotPt, rotationCenter, angleRad), polygonLatLngs)).length} waypoints for line ${lines}.`);
        
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
    const surveyWaypoints = generateSurveyGridWaypoints(currentPolygonPoints, altitude, sidelap, frontlap, angle, speed); // Rimosso overshoot

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
