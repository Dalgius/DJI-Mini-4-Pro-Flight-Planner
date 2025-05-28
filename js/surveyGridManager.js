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

// === HELPER FUNCTIONS FOR DRAWING ===
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

// === POINT-IN-POLYGON ALGORITHM ===
/**
 * Algoritmo Point-in-Polygon (Ray Casting).
 * Verifica se un punto è all'interno di un poligono.
 * @param {L.LatLng} point Il punto da testare.
 * @param {L.LatLng[]} polygonVertices I vertici del poligono.
 * @returns {boolean} True se il punto è dentro il poligono, false altrimenti.
 */
function isPointInPolygon(point, polygonVertices) {
    let isInside = false;
    const x = point.lng; // Usiamo lng per x, lat per y
    const y = point.lat;
    const n = polygonVertices.length;

    // console.log(`[isPointInPolygon] Testing point: (${x.toFixed(6)}, ${y.toFixed(6)})`); // DEBUG ESTREMO

    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = polygonVertices[i].lng;
        const yi = polygonVertices[i].lat;
        const xj = polygonVertices[j].lng;
        const yj = polygonVertices[j].lat;

        // console.log(`  Segment: (${xi.toFixed(6)},${yi.toFixed(6)}) to (${xj.toFixed(6)},${yj.toFixed(6)})`); // DEBUG ESTREMO

        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) {
            // console.log(`    Intersection detected with segment ${i}`); // DEBUG ESTREMO
            isInside = !isInside;
        }
    }
    // console.log(`[isPointInPolygon] Result for (${x.toFixed(6)}, ${y.toFixed(6)}): ${isInside}`); // DEBUG ESTREMO
    return isInside;
}


// === MAIN HANDLERS ===

function openSurveyGridModal() {
    console.log("[SurveyGrid] openSurveyGridModal called");
    if (!surveyGridModalOverlayEl || !defaultAltitudeSlider || !surveyGridAltitudeInputEl || !confirmSurveyGridBtnEl || !finalizeSurveyAreaBtnEl || !startDrawingSurveyAreaBtnEl || !surveyAreaStatusEl || !surveyGridInstructionsEl) {
        console.error("[SurveyGrid] Modal elements missing in openSurveyGridModal");
        showCustomAlert("Survey grid modal elements not found.", "Error");
        return;
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
        console.log("[SurveyGrid] All drawing-related map click listeners should be removed.");
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
    if (!map || !surveyGridModalOverlayEl) {
        console.error("[SurveyGrid] Map or Survey Grid Modal Overlay not found"); return;
    }
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
            if (!isDrawingSurveyArea) { console.log("!!! NATIVE CLICK: but isDrawingSurveyArea is false. Ignoring."); return; }
            if (event.target && (event.target === mapContainer || event.target.closest('.leaflet-pane') || event.target.closest('.leaflet-container'))) {
                try {
                    const latlng = map.mouseEventToLatLng(event);
                    console.log("!!! NATIVE CLICK Converted to LatLng:", latlng);
                    handleSurveyAreaMapClick({ latlng: latlng, originalEvent: event });
                } catch (mapError) { console.error("!!! NATIVE CLICK: Error:", mapError); }
            } else { console.log("!!! NATIVE CLICK: Target was not map/pane. Target:", event.target); }
        };
        mapContainer.addEventListener('click', nativeMapClickListener, true);
        console.log("[SurveyGrid] NATIVE DOM click listener ADDED.");
    }
    map.getContainer().style.cursor = 'crosshair';
    surveyGridModalOverlayEl.style.display = 'none';
    console.log("[SurveyGrid] Survey grid modal HIDDEN for drawing.");
    showCustomAlert("Drawing survey area: Click on map to add corners. Click the first point (min 3 total) to finalize.", "Survey Drawing Active");
    console.log("[SurveyGrid] Drawing mode activated.");
}

function handleSurveyAreaMapClick(e) {
    console.log("[SurveyGrid] handleSurveyAreaMapClick (from NATIVE) TRIGGERED!", "LatLng:", e.latlng);
    if (!isDrawingSurveyArea) { console.log("[SurveyGrid] handleSurveyAreaMapClick: Not in drawing mode, exiting."); return; }
    console.log("[SurveyGrid] handleSurveyAreaMapClick: In drawing mode, proceeding.");
    const clickedLatLng = e.latlng;
    currentPolygonPoints.push(clickedLatLng);
    console.log("[SurveyGrid] Point added, total:", currentPolygonPoints.length);
    const vertexMarker = L.circleMarker(clickedLatLng, { radius: 6, color: 'rgba(255,0,0,0.8)', fillColor: 'rgba(255,0,0,0.5)', fillOpacity: 0.7, pane: 'markerPane' }).addTo(map);
    if (tempVertexMarkers.length === 0) {
        vertexMarker.on('click', (markerClickEvent) => {
            console.log("[SurveyGrid] First vertex marker CLICKED for finalization.");
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
    if (!isDrawingSurveyArea) { console.log("[SurveyGrid] handleFinalizeSurveyArea: Not in drawing mode or already finalized."); return; }
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
        surveyGridModalOverlayEl.style.display = 'flex';
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

/**
 * Genera i waypoint per la griglia di survey (versione semplificata).
 */
function generateSurveyGridWaypoints(polygonLatLngs, flightAltitude, lineSpacing, gridAngleDeg, overshootDistance) {
    console.log("[SurveyGridGen] Starting generation with:", {
        polygonPointsCount: polygonLatLngs ? polygonLatLngs.length : 0,
        flightAltitude, lineSpacing, gridAngleDeg, overshootDistance
    });
    const waypointsData = [];

    if (!polygonLatLngs || polygonLatLngs.length < MIN_POLYGON_POINTS) {
        console.error("[SurveyGridGen] Invalid polygonLatLngs input for generation.");
        showCustomAlert("Invalid polygon for survey grid generation.", "Error");
        return waypointsData;
    }

    // console.log("[SurveyGridGen] Polygon Vertices (Lat, Lng):");
    // polygonLatLngs.forEach((p, index) => console.log(`  ${index}: (${p.lat.toFixed(6)}, ${p.lng.toFixed(6)})`));

    const bounds = L.latLngBounds(polygonLatLngs);
    const northEast = bounds.getNorthEast();
    const southWest = bounds.getSouthWest();

    console.log(`[SurveyGridGen] Bounds: SW(${southWest.lat.toFixed(6)}, ${southWest.lng.toFixed(6)}) NE(${northEast.lat.toFixed(6)}, ${northEast.lng.toFixed(6)})`);

    if (southWest.lat >= northEast.lat || southWest.lng >= northEast.lng) {
        console.error("[SurveyGridGen] Invalid bounds (min > max). Polygon might be too small, flat, or self-intersecting badly.");
        showCustomAlert("Polygon is too small or flat to generate a grid. Please redraw a larger area.", "Grid Generation Error");
        return waypointsData;
    }
    
    const earthRadius = (typeof R_EARTH !== 'undefined') ? R_EARTH : 6371000; // Usa R_EARTH da config se disponibile
    const lineSpacingLatDeg = (lineSpacing / earthRadius) * (180 / Math.PI);
    console.log(`[SurveyGridGen] lineSpacing: ${lineSpacing}m, lineSpacingLatDeg: ${lineSpacingLatDeg.toFixed(10)}`);

    if (lineSpacingLatDeg <= 1e-9) { // Tolleranza per valori molto piccoli
        console.error("[SurveyGridGen] Calculated lineSpacingLatDeg is zero or extremely small. Line spacing might be too small or an error occurred.");
        showCustomAlert("Line spacing is too small or resulted in a non-positive latitude degree conversion.", "Grid Generation Error");
        return waypointsData;
    }

    const midLatForLngCalc = (southWest.lat + northEast.lat) / 2;
    const distanceBetweenPhotos = lineSpacing; 
    const photoSpacingLngDeg = (distanceBetweenPhotos / (earthRadius * Math.cos(toRad(midLatForLngCalc)))) * (180 / Math.PI);
    console.log(`[SurveyGridGen] distanceBetweenPhotos: ${distanceBetweenPhotos}m, photoSpacingLngDeg (at midLat ${midLatForLngCalc.toFixed(6)}): ${photoSpacingLngDeg.toFixed(10)}`);

    if (photoSpacingLngDeg <= 1e-9) {
        console.error("[SurveyGridGen] Calculated photoSpacingLngDeg is zero or extremely small.");
        showCustomAlert("Photo spacing is too small or resulted in a non-positive longitude degree conversion.", "Grid Generation Error");
        return waypointsData;
    }

    let currentLat = southWest.lat;
    let scanDirection = 1;
    let linesGenerated = 0;
    let totalCandidatePoints = 0;

    while (currentLat <= northEast.lat) {
        linesGenerated++;
        console.log(`[SurveyGridGen] Generating line ${linesGenerated} at Lat: ${currentLat.toFixed(6)}, direction: ${scanDirection}`);
        const linePoints = [];
        let pointsOnThisLine = 0;

        if (scanDirection === 1) { // Ovest -> Est
            for (let currentLng = southWest.lng; currentLng <= northEast.lng; currentLng += photoSpacingLngDeg) {
                linePoints.push(L.latLng(currentLat, currentLng)); pointsOnThisLine++;
            }
            if (linePoints.length === 0 || linePoints[linePoints.length - 1].lng < northEast.lng - 1e-7) { // Tolleranza per float
                 linePoints.push(L.latLng(currentLat, northEast.lng)); if(pointsOnThisLine === 0) pointsOnThisLine++;
            }
        } else { // Est -> Ovest
            for (let currentLng = northEast.lng; currentLng >= southWest.lng; currentLng -= photoSpacingLngDeg) {
                linePoints.push(L.latLng(currentLat, currentLng)); pointsOnThisLine++;
            }
            if (linePoints.length === 0 || linePoints[linePoints.length - 1].lng > southWest.lng + 1e-7) { // Tolleranza per float
                 linePoints.push(L.latLng(currentLat, southWest.lng)); if(pointsOnThisLine === 0) pointsOnThisLine++;
            }
        }
        totalCandidatePoints += pointsOnThisLine;
        console.log(`  Generated ${pointsOnThisLine} candidate points for this line.`);

        let pointsAddedFromThisLine = 0;
        linePoints.forEach((point) => {
            if (isPointInPolygon(point, polygonLatLngs)) {
                waypointsData.push({
                    latlng: point,
                    options: { altitude: flightAltitude, cameraAction: 'takePhoto', headingControl: 'auto' }
                });
                pointsAddedFromThisLine++;
            }
        });
        console.log(`  Added ${pointsAddedFromThisLine} waypoints from this line after filtering.`);

        currentLat += lineSpacingLatDeg;
        if (linesGenerated > 2000) { // Safety break for too many lines
             console.error("[SurveyGridGen] Too many lines generated, aborting. Check line spacing and polygon size."); break;
        }
        scanDirection *= -1;
    }

    console.log(`[SurveyGridGen] Total lines processed: ${linesGenerated}. Total candidate points: ${totalCandidatePoints}. Total waypointsData generated (inside polygon): ${waypointsData.length}`);
    if (waypointsData.length === 0 && polygonLatLngs.length >= MIN_POLYGON_POINTS && linesGenerated > 0) {
        showCustomAlert("No waypoints generated within the polygon. The polygon might be too small for the given line/photo spacing, or parameters are misconfigured. Try a larger area or smaller spacing values.", "Grid Generation Warning");
    }
    return waypointsData;
}


function handleConfirmSurveyGridGeneration() {
    console.log("[SurveyGrid] handleConfirmSurveyGridGeneration called");
    if (currentPolygonPoints.length < MIN_POLYGON_POINTS) { showCustomAlert("Cannot generate grid: Survey area is not properly defined.", "Error"); return; }
    if (!surveyGridAltitudeInputEl || !surveyGridSpacingInputEl || !surveyGridAngleInputEl || !surveyGridOvershootInputEl) { showCustomAlert("Cannot generate grid: Missing input elements.", "Error"); return; }
    
    const altitude = parseInt(surveyGridAltitudeInputEl.value);
    const spacing = parseFloat(surveyGridSpacingInputEl.value);
    const angle = parseFloat(surveyGridAngleInputEl.value); 
    const overshoot = parseFloat(surveyGridOvershootInputEl.value);

    if (isNaN(altitude) || altitude < 1) { showCustomAlert("Invalid altitude.", "Input Error"); return; }
    if (isNaN(spacing) || spacing <= 1e-3) { showCustomAlert("Invalid line spacing. Must be a small positive number.", "Input Error"); return; } // Spacing > 0
    // Angle & Overshoot validation can be added if they are used.

    if (surveyGridInstructionsEl) surveyGridInstructionsEl.textContent = "Generating grid waypoints...";
    console.log("[SurveyGridGen] Calling generateSurveyGridWaypoints with currentPolygonPoints:", currentPolygonPoints.map(p=>[p.lat, p.lng]));

    const surveyWaypoints = generateSurveyGridWaypoints(currentPolygonPoints, altitude, spacing, angle, overshoot);

    console.log(`[SurveyGridGen] Received ${surveyWaypoints ? surveyWaypoints.length : 'null'} waypoints from generation function.`);

    if (surveyWaypoints && surveyWaypoints.length > 0) {
       surveyWaypoints.forEach(wpData => {
           addWaypoint(wpData.latlng, wpData.options);
       });
       updateWaypointList(); 
       updateFlightPath(); 
       updateFlightStatistics(); 
       fitMapToWaypoints();
       showCustomAlert(`${surveyWaypoints.length} survey grid waypoints generated and added!`, "Success");
    } else if (surveyWaypoints && surveyWaypoints.length === 0 && currentPolygonPoints.length >= MIN_POLYGON_POINTS){
        console.warn("[SurveyGridGen] generateSurveyGridWaypoints returned an empty array but polygon was valid.");
        // Alert viene già mostrato da generateSurveyGridWaypoints in questo caso.
    } else if (!surveyWaypoints) {
        console.error("[SurveyGridGen] generateSurveyGridWaypoints returned null or undefined.");
        showCustomAlert("An unexpected error occurred during grid generation.", "Error");
    }

    handleCancelSurveyGrid(); // Chiude modale, resetta stato e listener
}

// Helper function to convert degrees to radians, if not globally available from utils.js
// Assicurati che sia definita o che utils.js sia caricato prima e la esponga globalmente.
// Se R_EARTH è in config.js, usa quella: const earthRadius = R_EARTH;
function toRad(degrees) {
    return degrees * Math.PI / 180;
}
