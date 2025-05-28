// File: surveyGridManager.js

// Depends on: config.js (for isDrawingSurveyArea, map, DOM elements for modal, R_EARTH)
// Depends on: mapManager.js (for map object, and assumes handleMapClick is a global function from there)
// Depends on: utils.js (for showCustomAlert, and toRad if global)
// Depends on: waypointManager.js (for addWaypoint)

// Variabili di stato specifiche di questo modulo
let currentPolygonPoints = [];
let tempPolygonLayer = null;
let tempVertexMarkers = [];
let nativeMapClickListener = null;

const MIN_POLYGON_POINTS = 3;

// === HELPER FUNCTIONS ===

/**
 * Pulisce tutti i layer e i marker temporanei usati per il disegno.
 */
function clearTemporaryDrawing() {
    console.log("[SurveyGrid] clearTemporaryDrawing called");
    if (tempPolygonLayer) {
        map.removeLayer(tempPolygonLayer);
        tempPolygonLayer = null;
    }
    tempVertexMarkers.forEach(marker => map.removeLayer(marker));
    tempVertexMarkers = [];
}

/**
 * Aggiorna la visualizzazione del poligono/linea temporanea sulla mappa.
 */
function updateTempPolygonDisplay() {
    console.log("[SurveyGrid] updateTempPolygonDisplay called");
    if (tempPolygonLayer) {
        map.removeLayer(tempPolygonLayer);
        tempPolygonLayer = null;
    }
    if (currentPolygonPoints.length < 2) return;

    const polygonOptions = { color: 'rgba(0, 100, 255, 0.7)', weight: 2, fillColor: 'rgba(0, 100, 255, 0.2)', fillOpacity: 0.3 };
    if (currentPolygonPoints.length === 2) {
        tempPolygonLayer = L.polyline(currentPolygonPoints, polygonOptions).addTo(map);
    } else if (currentPolygonPoints.length >= MIN_POLYGON_POINTS) {
        tempPolygonLayer = L.polygon(currentPolygonPoints, polygonOptions).addTo(map);
    }
}

/**
 * Converte gradi in radianti.
 * @param {number} degrees Angolo in gradi.
 * @returns {number} Angolo in radianti.
 */
function toRad(degrees) { // Inclusa qui per assicurarne la disponibilità
    return degrees * Math.PI / 180;
}

/**
 * Ruota un L.LatLng attorno a un centro di un dato angolo.
 * ATTENZIONE: Approssimazione per aree piccole, non geodeticamente precisa.
 * L'angolo è in radianti. Rotazione positiva = antioraria.
 * @param {L.LatLng} pointLatLng Il punto da ruotare.
 * @param {L.LatLng} centerLatLng Il centro di rotazione.
 * @param {number} angleRadians L'angolo di rotazione in radianti.
 * @returns {L.LatLng} Il nuovo L.LatLng ruotato.
 */
function rotateLatLng(pointLatLng, centerLatLng, angleRadians) {
    const cosAngle = Math.cos(angleRadians);
    const sinAngle = Math.sin(angleRadians);

    // Converti differenze Lat/Lng in un sistema pseudo-cartesiano locale
    // Scalando la differenza di longitudine per il coseno della latitudine del centro
    // per approssimare una distanza metrica uniforme.
    const dLngScaled = (pointLatLng.lng - centerLatLng.lng) * Math.cos(toRad(centerLatLng.lat));
    const dLat = pointLatLng.lat - centerLatLng.lat;

    // Applica la rotazione 2D standard
    const rotatedDLngScaled = dLngScaled * cosAngle - dLat * sinAngle;
    const rotatedDLat = dLngScaled * sinAngle + dLat * cosAngle;

    // Riconverti le differenze ruotate in Lat/Lng
    const finalLng = centerLatLng.lng + (rotatedDLngScaled / Math.cos(toRad(centerLatLng.lat)));
    const finalLat = centerLatLng.lat + rotatedDLat;

    return L.latLng(finalLat, finalLng);
}


/**
 * Algoritmo Point-in-Polygon (Ray Casting).
 */
function isPointInPolygon(point, polygonVertices) {
    let isInside = false;
    const x = point.lng; const y = point.lat;
    for (let i = 0, j = polygonVertices.length - 1; i < polygonVertices.length; j = i++) {
        const xi = polygonVertices[i].lng, yi = polygonVertices[i].lat;
        const xj = polygonVertices[j].lng, yj = polygonVertices[j].lat;
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
    }
    return isInside;
}

// === MAIN UI HANDLERS ===

function openSurveyGridModal() {
    console.log("[SurveyGrid] openSurveyGridModal called");
    if (!surveyGridModalOverlayEl || !defaultAltitudeSlider /* ...altri controlli ... */) {
        showCustomAlert("Survey grid modal elements not found.", "Error"); return;
    }
    surveyGridAltitudeInputEl.value = defaultAltitudeSlider.value;
    cancelSurveyAreaDrawing();
    confirmSurveyGridBtnEl.disabled = true;
    finalizeSurveyAreaBtnEl.style.display = 'none';
    startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
    surveyAreaStatusEl.textContent = "Area not defined.";
    surveyGridInstructionsEl.innerHTML = 'Click "Start Drawing" then click on the map to define the survey area corners. Click the first point again to close the polygon.';
    surveyGridModalOverlayEl.style.display = 'flex';
    console.log("[SurveyGrid] Survey Grid Modal displayed");
}

function cancelSurveyAreaDrawing() {
    console.log("[SurveyGrid] cancelSurveyAreaDrawing called");
    const wasDrawingOrListenersActive = isDrawingSurveyArea || nativeMapClickListener;
    isDrawingSurveyArea = false;
    if (map) {
        const mapContainer = map.getContainer();
        if (mapContainer && nativeMapClickListener) {
            mapContainer.removeEventListener('click', nativeMapClickListener, true);
            nativeMapClickListener = null;
            console.log("[SurveyGrid] NATIVE DOM click listener REMOVED.");
        }
        map.off('click', handleSurveyAreaMapClick);
        map.getContainer().style.cursor = '';
        console.log("[SurveyGrid] All drawing-related map click listeners removed.");
        if ((wasDrawingOrListenersActive || !map.hasEventListeners('click', handleMapClick)) && typeof handleMapClick === 'function') {
            map.on('click', handleMapClick);
            console.log("[SurveyGrid] Default Leaflet map click listener RE-ENSURED.");
        }
    }
    clearTemporaryDrawing();
    currentPolygonPoints = [];
    if (startDrawingSurveyAreaBtnEl) startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
    if (finalizeSurveyAreaBtnEl) finalizeSurveyAreaBtnEl.style.display = 'none';
    if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = true;
    if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = "Area not defined.";
    if (surveyGridInstructionsEl) surveyGridInstructionsEl.innerHTML = 'Click "Start Drawing" then click on the map to define the survey area corners. Click the first point again to close the polygon.';
}

function handleStartDrawingSurveyArea() {
    console.log("[SurveyGrid] handleStartDrawingSurveyArea called");
    if (!map || !surveyGridModalOverlayEl) { console.error("Map or Modal Overlay missing"); return; }
    isDrawingSurveyArea = true;
    currentPolygonPoints = [];
    clearTemporaryDrawing();
    console.log("[SurveyGrid] Cleared temporary drawing, isDrawingSurveyArea set to true.");
    if (typeof handleMapClick === 'function') {
        map.off('click', handleMapClick);
        console.log("[SurveyGrid] Leaflet default map click listener TEMPORARILY REMOVED.");
    }
    map.off('click', handleSurveyAreaMapClick);
    const mapContainer = map.getContainer();
    if (mapContainer) {
        if (nativeMapClickListener) mapContainer.removeEventListener('click', nativeMapClickListener, true);
        nativeMapClickListener = function(event) {
            console.log("!!! NATIVE MAP CONTAINER CLICKED !!! Target:", event.target);
            if (!isDrawingSurveyArea) { console.log("!!! NATIVE CLICK: not in drawing mode."); return; }
            if (event.target && (event.target === mapContainer || event.target.closest('.leaflet-pane') || event.target.closest('.leaflet-container'))) {
                try {
                    const latlng = map.mouseEventToLatLng(event);
                    handleSurveyAreaMapClick({ latlng: latlng, originalEvent: event });
                } catch (mapError) { console.error("!!! NATIVE CLICK: Error:", mapError); }
            } else { console.log("!!! NATIVE CLICK: Target was not map/pane."); }
        };
        mapContainer.addEventListener('click', nativeMapClickListener, true);
        console.log("[SurveyGrid] NATIVE DOM click listener ADDED.");
    }
    map.getContainer().style.cursor = 'crosshair';
    surveyGridModalOverlayEl.style.display = 'none'; // NASCONDI MODALE
    console.log("[SurveyGrid] Survey grid modal HIDDEN for drawing.");
    showCustomAlert("Drawing survey area: Click on map to add corners. Click the first point (min 3 total) to finalize.", "Survey Drawing Active");
    console.log("[SurveyGrid] Drawing mode activated.");
}

function handleSurveyAreaMapClick(e) {
    console.log("[SurveyGrid] handleSurveyAreaMapClick TRIGGERED!", "LatLng:", e.latlng);
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
        showCustomAlert(`Area definition requires at least ${MIN_POLYGON_POINTS} points.`, "Info"); return;
    }
    const mapContainer = map.getContainer();
    if (mapContainer && nativeMapClickListener) {
        mapContainer.removeEventListener('click', nativeMapClickListener, true);
        nativeMapClickListener = null;
        console.log("[SurveyGrid] NATIVE DOM click listener REMOVED after finalize.");
    }
    map.getContainer().style.cursor = '';
    if (surveyGridModalOverlayEl) {
        surveyGridModalOverlayEl.style.display = 'flex'; // RIAPRI MODALE
        console.log("[SurveyGrid] Survey grid modal SHOWN for confirmation.");
    }
    if (finalizeSurveyAreaBtnEl) finalizeSurveyAreaBtnEl.style.display = 'none';
    if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = false;
    if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = `Area defined with ${currentPolygonPoints.length} points.`;
    if (surveyGridInstructionsEl) surveyGridInstructionsEl.innerHTML = '<strong style="color: #2ecc71;">Area finalized!</strong> Adjust parameters or click "Generate Grid".';
    if (tempPolygonLayer) tempPolygonLayer.setStyle({ color: 'rgba(0, 50, 200, 0.9)', fillColor: 'rgba(0, 50, 200, 0.4)' });
    tempVertexMarkers.forEach(marker => marker.off('click'));
    console.log("[SurveyGrid] Area finalized. Modal shown for confirmation.");
}

function handleCancelSurveyGrid() {
    console.log("[SurveyGrid] handleCancelSurveyGrid called");
    cancelSurveyAreaDrawing();
    if (surveyGridModalOverlayEl) {
        surveyGridModalOverlayEl.style.display = 'none';
    }
}

// === GRID GENERATION LOGIC ===

function generateSurveyGridWaypoints(polygonLatLngs, flightAltitude, lineSpacing, gridAngleDeg, overshootDistance) {
    console.log("[SurveyGridGen] Starting generation (with ANGLE) with:", {
        polygonPointsCount: polygonLatLngs ? polygonLatLngs.length : 0,
        flightAltitude, lineSpacing, gridAngleDeg, overshootDistance
    });
    const waypointsData = [];

    if (!polygonLatLngs || polygonLatLngs.length < MIN_POLYGON_POINTS) {
        showCustomAlert("Invalid polygon for survey grid generation.", "Error"); return waypointsData;
    }

    const rotationCenter = polygonLatLngs[0]; 
    const angleRad = toRad(gridAngleDeg); // Usa la nostra funzione toRad
    console.log(`[SurveyGridGen] Grid Angle: ${gridAngleDeg}°, Radians: ${angleRad.toFixed(4)}, Center: (${rotationCenter.lat.toFixed(6)}, ${rotationCenter.lng.toFixed(6)})`);

    const rotatedPolygonLatLngs = polygonLatLngs.map(p => rotateLatLng(p, rotationCenter, -angleRad));
    // console.log("[SurveyGridGen] Rotated Polygon Vertices (pseudo-coords):", rotatedPolygonLatLngs.map(p=>[p.lat, p.lng]));


    const rotatedBounds = L.latLngBounds(rotatedPolygonLatLngs);
    const rNorthEast = rotatedBounds.getNorthEast();
    const rSouthWest = rotatedBounds.getSouthWest();
    console.log(`[SurveyGridGen] Rotated Bounds: SW(${rSouthWest.lat.toFixed(6)}, ${rSouthWest.lng.toFixed(6)}) NE(${rNorthEast.lat.toFixed(6)}, ${rNorthEast.lng.toFixed(6)})`);

    if (rSouthWest.lat >= rNorthEast.lat - 1e-7 || rSouthWest.lng >= rNorthEast.lng - 1e-7) { // Tolleranza
        console.error("[SurveyGridGen] Invalid rotated bounds. Polygon might be too small or angle causes issues.");
        showCustomAlert("Polygon is too small or the angle results in invalid bounds for grid generation.", "Grid Error");
        return waypointsData;
    }

    const earthRadius = (typeof R_EARTH !== 'undefined') ? R_EARTH : 6371000;
    const lineSpacingRotatedLatUnits = (lineSpacing / earthRadius) * (180 / Math.PI);
    console.log(`[SurveyGridGen] lineSpacing: ${lineSpacing}m, lineSpacingRotatedLatUnits: ${lineSpacingRotatedLatUnits.toFixed(10)}`);

    if (lineSpacingRotatedLatUnits <= 1e-9) { showCustomAlert("Line spacing too small.", "Grid Error"); return waypointsData; }

    // Usa la latitudine del centro di rotazione per la scala della longitudine nel sistema ruotato.
    const distanceBetweenPhotos = lineSpacing; 
    const photoSpacingRotatedLngUnits = (distanceBetweenPhotos / (earthRadius * Math.cos(toRad(rotationCenter.lat)))) * (180 / Math.PI);
    console.log(`[SurveyGridGen] photoSpacingRotatedLngUnits (at centerLat ${rotationCenter.lat.toFixed(6)}): ${photoSpacingRotatedLngUnits.toFixed(10)}`);

    if (photoSpacingRotatedLngUnits <= 1e-9) { showCustomAlert("Photo spacing too small.", "Grid Error"); return waypointsData; }

    let currentRotatedLat = rSouthWest.lat;
    let scanDirection = 1;
    let linesGenerated = 0;

    while (currentRotatedLat <= rNorthEast.lat + lineSpacingRotatedLatUnits * 0.5) { // Leggera tolleranza per l'ultima linea
        linesGenerated++;
        // console.log(`[SurveyGridGen] Line ${linesGenerated} at RotatedLat: ${currentRotatedLat.toFixed(6)}, direction: ${scanDirection}`);
        const lineCandidatePointsRotated = [];

        if (scanDirection === 1) {
            for (let currentRotatedLng = rSouthWest.lng; currentRotatedLng <= rNorthEast.lng; currentRotatedLng += photoSpacingRotatedLngUnits) {
                lineCandidatePointsRotated.push(L.latLng(currentRotatedLat, currentRotatedLng));
            }
            if (lineCandidatePointsRotated.length === 0 || lineCandidatePointsRotated[lineCandidatePointsRotated.length - 1].lng < rNorthEast.lng - 1e-7) {
                lineCandidatePointsRotated.push(L.latLng(currentRotatedLat, rNorthEast.lng));
            }
        } else {
            for (let currentRotatedLng = rNorthEast.lng; currentRotatedLng >= rSouthWest.lng; currentRotatedLng -= photoSpacingRotatedLngUnits) {
                lineCandidatePointsRotated.push(L.latLng(currentRotatedLat, currentRotatedLng));
            }
            if (lineCandidatePointsRotated.length === 0 || lineCandidatePointsRotated[lineCandidatePointsRotated.length - 1].lng > rSouthWest.lng + 1e-7) {
                lineCandidatePointsRotated.push(L.latLng(currentRotatedLat, rSouthWest.lng));
            }
        }
        // console.log(`  Generated ${lineCandidatePointsRotated.length} candidate points (rotated) for this line.`);

        let pointsAddedFromThisLine = 0;
        lineCandidatePointsRotated.forEach((rotatedPoint) => {
            const actualGeoPoint = rotateLatLng(rotatedPoint, rotationCenter, angleRad);
            if (isPointInPolygon(actualGeoPoint, polygonLatLngs)) {
                let headingForPoint = gridAngleDeg; // Direzione principale della linea
                if (scanDirection === -1) { // Se la linea va nella direzione opposta
                    headingForPoint = (gridAngleDeg + 180);
                }
                headingForPoint = (headingForPoint % 360 + 360) % 360; // Normalizza 0-359

                waypointsData.push({
                    latlng: actualGeoPoint,
                    options: { altitude: flightAltitude, cameraAction: 'takePhoto', headingControl: 'fixed', fixedHeading: Math.round(headingForPoint) }
                });
                pointsAddedFromThisLine++;
            }
        });
        // console.log(`  Added ${pointsAddedFromThisLine} waypoints from this line after filtering.`);

        currentRotatedLat += lineSpacingRotatedLatUnits;
        if (linesGenerated > 2000) { console.error("Too many lines, aborting."); break; }
        scanDirection *= -1;
    }

    console.log(`[SurveyGridGen] Total lines processed: ${linesGenerated}. Total waypointsData generated: ${waypointsData.length}`);
    if (waypointsData.length === 0 && polygonLatLngs.length >= MIN_POLYGON_POINTS && linesGenerated > 0) {
        showCustomAlert("No waypoints generated within the polygon. Try a larger area, smaller spacing, or different angle.", "Grid Warning");
    }
    return waypointsData;
}


function handleConfirmSurveyGridGeneration() {
    console.log("[SurveyGrid] handleConfirmSurveyGridGeneration called");
    if (currentPolygonPoints.length < MIN_POLYGON_POINTS) { showCustomAlert("Survey area not properly defined.", "Error"); return; }
    if (!surveyGridAltitudeInputEl /* ... ecc ... */) { showCustomAlert("Missing input elements.", "Error"); return; }
    
    const altitude = parseInt(surveyGridAltitudeInputEl.value);
    const spacing = parseFloat(surveyGridSpacingInputEl.value);
    const angle = parseFloat(surveyGridAngleInputEl.value);
    const overshoot = parseFloat(surveyGridOvershootInputEl.value); // Non ancora usato

    if (isNaN(altitude) || altitude < 1) { showCustomAlert("Invalid altitude.", "Input Error"); return; }
    if (isNaN(spacing) || spacing <= 1e-3) { showCustomAlert("Invalid line spacing.", "Input Error"); return; }
    if (isNaN(angle)) { showCustomAlert("Invalid grid angle.", "Input Error"); return; } // Aggiunta validazione angolo

    if (surveyGridInstructionsEl) surveyGridInstructionsEl.textContent = "Generating grid waypoints...";
    console.log("[SurveyGridGen] Calling generateSurveyGridWaypoints with currentPolygonPoints:", currentPolygonPoints.map(p=>[p.lat, p.lng]));

    const surveyWaypoints = generateSurveyGridWaypoints(currentPolygonPoints, altitude, spacing, angle, overshoot);

    console.log(`[SurveyGridGen] Received ${surveyWaypoints ? surveyWaypoints.length : 'null'} waypoints from generation function.`);

    if (surveyWaypoints && surveyWaypoints.length > 0) {
       surveyWaypoints.forEach(wpData => addWaypoint(wpData.latlng, wpData.options));
       updateWaypointList(); updateFlightPath(); updateFlightStatistics(); fitMapToWaypoints();
       showCustomAlert(`${surveyWaypoints.length} survey grid waypoints generated and added!`, "Success");
    } else if (surveyWaypoints && surveyWaypoints.length === 0 && currentPolygonPoints.length >= MIN_POLYGON_POINTS){
        console.warn("[SurveyGridGen] generateSurveyGridWaypoints returned an empty array.");
        // L'alert specifico viene già mostrato da generateSurveyGridWaypoints
    } else if (!surveyWaypoints) {
        console.error("[SurveyGridGen] generateSurveyGridWaypoints returned null or undefined.");
        showCustomAlert("An unexpected error occurred during grid generation.", "Error");
    }

    handleCancelSurveyGrid();
}
