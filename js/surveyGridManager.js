// File: surveyGridManager.js
// ... (helper functions and FIXED_CAMERA_PARAMS as before) ...

// === MAIN UI HANDLERS ===
function openSurveyGridModal() {
    console.log("[SurveyGrid] openSurveyGridModal called");
    // ... (DOM element checks) ...
    cancelSurveyAreaDrawing(); // Full reset on modal open

    surveyGridAltitudeInputEl.value = defaultAltitudeSlider.value;
    if (!surveySidelapInputEl.value) surveySidelapInputEl.value = 70;
    if (!surveyFrontlapInputEl.value) surveyFrontlapInputEl.value = 80;
    if (surveyGridAngleInputEl && (surveyGridAngleInputEl.value === "" || surveyGridAngleInputEl.value === null)) surveyGridAngleInputEl.value = 0;
    
    confirmSurveyGridBtnEl.disabled = true;
    startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
    surveyAreaStatusEl.textContent = "Area not defined.";
    surveyGridInstructionsEl.innerHTML = 'Set parameters. Click "Draw Direction" (optional) then "Draw Survey Area".';
    surveyGridModalOverlayEl.style.display = 'flex';
    console.log("[SurveyGrid] Modal displayed, all states reset.");
}

function cancelSurveyAreaDrawing() { // Resetta TUTTI gli stati di disegno survey
    console.log("[SurveyGrid] cancelSurveyAreaDrawing (full reset for all survey drawing states)");
    const wasInAnyInteractionMode = isDrawingSurveyArea || (typeof nativeMapClickListener === 'function') || isDrawingGridAngleLine;
    
    isDrawingSurveyArea = false; // Poligono non in disegno / non finalizzato
    isDrawingGridAngleLine = false; // Linea angolo non in disegno
    gridAngleLinePoints = [];
    currentPolygonPoints = []; // Resetta i punti del poligono

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
}

function handleCancelSurveyGrid() { /* ... come prima, chiama cancelSurveyAreaDrawing e nasconde modale ... */ }

// === LOGICA PER DISEGNARE LA LINEA DI DIREZIONE DELL'ANGOLO ===
function handleSetGridAngleByLine() {
    console.log("[SurveyGridAngle] handleSetGridAngleByLine called - START");
    // Non resettiamo currentPolygonPoints o isDrawingSurveyArea qui.
    // Lo stato del poligono (se definito) dovrebbe rimanere.
    // Dobbiamo solo assicurarci che la modalità di disegno del POLIGONO non sia attiva.
    if (map && typeof nativeMapClickListener === 'function') { // Se il listener del poligono era attivo
        const mapContainer = map.getContainer();
        mapContainer.removeEventListener('click', nativeMapClickListener, true);
        // nativeMapClickListener = null; // Non nullificarlo qui, potrebbe essere riattivato
        map.getContainer().style.cursor = ''; // Ripristina cursore dal disegno poligono
        console.log("[SurveyGridAngle] NATIVE DOM listener for polygon PAUSED to draw angle line.");
    }
     map.off('click', handleSurveyAreaMapClick); // Rimuovi anche il fallback Leaflet per il poligono

    isDrawingGridAngleLine = true; // Attiva la modalità per la linea dell'angolo
    gridAngleLinePoints = [];
    // Pulisci solo i layer/marker temporanei della *linea dell'angolo precedente*
    if (tempGridAngleLineLayer) { map.removeLayer(tempGridAngleLineLayer); tempGridAngleLineLayer = null; }
    tempGridAnglePointMarkers.forEach(marker => map.removeLayer(marker)); tempGridAnglePointMarkers = [];
    console.log("[SurveyGridAngle] State set: isDrawingGridAngleLine=true, angle line graphics cleared.");

    if (map && typeof handleMapClick === 'function') map.off('click', handleMapClick);
    
    if (map) {
        map.on('click', handleGridAngleLineMapClick);
        map.getContainer().style.cursor = 'crosshair';
        console.log("[SurveyGridAngle] 'handleGridAngleLineMapClick' listener ADDED.");
    } else { /* ... errore ... */ return; }
    
    if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'none'; 
    showCustomAlert("Draw Grid Direction: Click map for line start, click again for end.", "Set Angle");
    console.log("[SurveyGridAngle] Angle line drawing mode FULLY ACTIVATED.");
}

function handleGridAngleLineMouseMove(e) { /* ... come prima ... */ }

function handleGridAngleLineMapClick(e) {
    // ... (logica come prima per aggiungere punti e marker) ...
    if (gridAngleLinePoints.length === 2) { 
        const userDrawnBearing = calculateBearing(gridAngleLinePoints[0], gridAngleLinePoints[1]);
        let correctedAngleForInput = (userDrawnBearing - 90 + 360) % 360; // Correzione offset 90°
        surveyGridAngleInputEl.value = Math.round(correctedAngleForInput);
        console.log(`[SurveyGridAngle] User Bearing: ${userDrawnBearing.toFixed(1)}°. Corrected Angle for Input: ${surveyGridAngleInputEl.value}°`);
        finalizeGridAngleLineDrawing(); 
    }
}

function finalizeGridAngleLineDrawing() {
    console.log("[SurveyGridAngle] Finalizing grid angle line drawing.");
    isDrawingGridAngleLine = false; // Disattiva modalità disegno linea angolo
    map.off('click', handleGridAngleLineMapClick);
    map.off('mousemove', handleGridAngleLineMouseMove);
    map.getContainer().style.cursor = '';
    
    if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'flex'; // Riapri modale

    // Ora, la UI della modale dipende se un'area era GIÀ definita e valida
    if (currentPolygonPoints.length >= MIN_POLYGON_POINTS && isDrawingSurveyArea) {
        // Un'area valida esiste (isDrawingSurveyArea è true dallo stato "finalized polygon")
        // Abbiamo solo aggiornato l'angolo. L'utente può generare.
        if (surveyGridInstructionsEl) surveyGridInstructionsEl.innerHTML = `<strong style="color: #2ecc71;">Area defined.</strong> Angle updated to ${surveyGridAngleInputEl.value}°. Click "Generate Grid".`;
        if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = `Area defined with ${currentPolygonPoints.length} points. Angle: ${surveyGridAngleInputEl.value}°`;
        if (startDrawingSurveyAreaBtnEl) startDrawingSurveyAreaBtnEl.style.display = 'none'; // L'area è già definita
        if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = false; // ABILITA generazione
        console.log("[SurveyGridAngle] Angle set. Polygon area was already defined. Ready to generate.");
    } else {
        // Non c'era un'area valida, o è stata resettata. Chiedi di disegnare l'area.
        if (surveyGridInstructionsEl) surveyGridInstructionsEl.innerHTML = `Grid angle set to ${surveyGridAngleInputEl.value}°. Now click "Draw Survey Area" to define the polygon.`;
        if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = "Area not defined (angle has been set).";
        if (startDrawingSurveyAreaBtnEl) startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
        if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = true;
        console.log("[SurveyGridAngle] Angle set. No valid polygon area yet. Ready to draw survey area.");
    }
    // Riattiva il listener di click di default SOLO se non siamo in uno stato di "area poligono finalizzata"
    // Se l'area è finalizzata, vogliamo che l'utente interagisca con "Generate" o "Cancel", non aggiunga waypoint.
    if (!(currentPolygonPoints.length >= MIN_POLYGON_POINTS && isDrawingSurveyArea) && typeof handleMapClick === 'function') {
        map.on('click', handleMapClick);
        console.log("[SurveyGridAngle] Default click listener restored as no complete area is ready for generation.");
    }
}

// === LOGICA PER DISEGNARE L'AREA DI SURVEY (POLIGONO) ===
function handleStartDrawingSurveyArea() {
    console.log("[SurveyGrid] handleStartDrawingSurveyArea called");
    if (isDrawingGridAngleLine) {
        showCustomAlert("Please finish drawing the grid angle line first or cancel it.", "Info"); return;
    }
    if (!map || !surveyGridModalOverlayEl) { console.error("Map or Modal missing"); return; }
    
    isDrawingSurveyArea = true; // Indica che stiamo INIZIANDO o CONTINUANDO a definire l'area
    currentPolygonPoints = [];  // Resetta sempre i punti quando si clicca "Draw Survey Area"
    clearTemporaryDrawing();    // Pulisce tutti i disegni precedenti (poligono e linea angolo)
    console.log("Drawing polygon started, isDrawingSurveyArea=true, currentPolygonPoints reset.");

    if (typeof handleMapClick === 'function') map.off('click', handleMapClick);
    map.off('click', handleGridAngleLineMapClick); 
    
    const mapContainer = map.getContainer();
    if (mapContainer) {
        if (typeof nativeMapClickListener === 'function') {
            mapContainer.removeEventListener('click', nativeMapClickListener, true);
        }
        nativeMapClickListener = function(event) { /* ... come prima ... */ };
        mapContainer.addEventListener('click', nativeMapClickListener, true);
        console.log("[SurveyGrid] NATIVE DOM listener for polygon ADDED.");
    }
    map.getContainer().style.cursor = 'crosshair';
    surveyGridModalOverlayEl.style.display = 'none';
    showCustomAlert("Drawing survey area: Click map for corners. Click first point (min 3) to finalize.", "Survey Drawing Active");
    console.log("Polygon drawing mode activated.");
}

function handleFinalizeSurveyArea() {
    console.log("[SurveyGrid] handleFinalizeSurveyArea called");
    if (!isDrawingSurveyArea) { console.log("Not in polygon drawing mode or already finalized."); return; }
    if (currentPolygonPoints.length < MIN_POLYGON_POINTS) { /* ... errore ... */ return; }
    
    const mapContainer = map.getContainer();
    if (mapContainer && typeof nativeMapClickListener === 'function') {
        mapContainer.removeEventListener('click', nativeMapClickListener, true);
        // nativeMapClickListener = null; // Non nullificare qui, verrà fatto da cancelSurveyAreaDrawing
        console.log("[SurveyGrid] NATIVE DOM listener REMOVED after polygon finalize.");
    }
    map.getContainer().style.cursor = '';
    // isDrawingSurveyArea rimane true! Significa "un'area valida è stata definita e finalizzata".
    // Il listener per *aggiungere* punti al poligono è stato rimosso.
    // Il listener di default handleMapClick è ancora disattivato.
    console.log("Polygon finalized. isDrawingSurveyArea is STILL TRUE (area defined).");

    if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'flex';

    if (startDrawingSurveyAreaBtnEl) startDrawingSurveyAreaBtnEl.style.display = 'none';
    if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = false; // ABILITA "Generate Grid"
    if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = `Area defined with ${currentPolygonPoints.length} points. Angle: ${surveyGridAngleInputEl.value}°`;
    if (surveyGridInstructionsEl) surveyGridInstructionsEl.innerHTML = '<strong style="color: #2ecc71;">Area finalized!</strong> Adjust parameters or click "Generate Grid".';
    
    if (tempPolygonLayer) tempPolygonLayer.setStyle({ color: 'rgba(0, 50, 200, 0.9)', fillColor: 'rgba(0, 50, 200, 0.4)' });
    tempVertexMarkers.forEach(marker => marker.off('click'));
    console.log("Area finalized. Modal UI updated for generation.");
}


// === GRID GENERATION LOGIC (NO OVERSHOOT) ===
function generateSurveyGridWaypoints(polygonLatLngs, flightAltitudeAGL, sidelapPercent, frontlapPercent, gridAngleDeg, flightSpeed) { /* ... identica ... */ }
function handleConfirmSurveyGridGeneration() { /* ... identica ... */ }

// (Incollo le funzioni di generazione e conferma per completezza)
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
        // Modificato il controllo: l'area deve essere definita E finalizzata (isDrawingSurveyArea=true)
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
    handleCancelSurveyGrid(); // Questo chiama cancelSurveyAreaDrawing che resetta tutto
}
