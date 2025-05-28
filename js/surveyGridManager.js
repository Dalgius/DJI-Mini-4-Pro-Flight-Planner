// File: surveyGridManager.js

// Global state variables for this module
let isDrawingSurveyArea = false;
let currentPolygonPoints = [];
let tempPolygonLayer = null;
let tempVertexMarkers = [];

const MIN_POLYGON_POINTS = 3;

// === HELPER FUNCTIONS (definite prima per chiarezza e hoisting) ===

/**
 * Pulisce tutti i layer e i marker temporanei usati per il disegno.
 */
function clearTemporaryDrawing() {
    console.log("[SurveyGrid] clearTemporaryDrawing called"); // DEBUG
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
    console.log("[SurveyGrid] updateTempPolygonDisplay called"); // DEBUG
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


// === MAIN HANDLERS (accessibili globalmente e da eventListeners.js) ===

/**
 * Inizializza i controlli per la griglia di mappatura (es. apre la modale).
 */
function openSurveyGridModal() {
    console.log("[SurveyGrid] openSurveyGridModal called");
    if (!surveyGridModalOverlayEl || !defaultAltitudeSlider || !surveyGridAltitudeInputEl || !confirmSurveyGridBtnEl || !finalizeSurveyAreaBtnEl || !startDrawingSurveyAreaBtnEl || !surveyAreaStatusEl) {
        console.error("[SurveyGrid] Modal elements missing in openSurveyGridModal");
        showCustomAlert("Survey grid modal elements not found.", "Error");
        return;
    }
    surveyGridAltitudeInputEl.value = defaultAltitudeSlider.value;
    
    cancelSurveyAreaDrawing(); // Chiama la funzione che resetta tutto, inclusa la UI della modale

    confirmSurveyGridBtnEl.disabled = true; // Assicurati che sia disabilitato all'inizio
    finalizeSurveyAreaBtnEl.style.display = 'none';
    startDrawingSurveyAreaBtnEl.style.display = 'inline-block'; // Assicurati che il pulsante start sia visibile
    surveyAreaStatusEl.textContent = "Area not defined.";
    surveyGridInstructionsEl.textContent = 'Click "Start Drawing" then click on the map to define the survey area corners. Click the first point again to close the polygon, or use the "Finalize Area" button.';
    
    surveyGridModalOverlayEl.style.display = 'flex';
    console.log("[SurveyGrid] Survey Grid Modal displayed");
}

/**
 * Resetta lo stato del disegno del poligono e la UI della modale.
 */
function cancelSurveyAreaDrawing() {
    console.log("[SurveyGrid] cancelSurveyAreaDrawing called");
    isDrawingSurveyArea = false;
    if (map) {
        map.off('click', handleSurveyAreaMapClick);
        map.getContainer().style.cursor = '';
        console.log("[SurveyGrid] cancelSurveyAreaDrawing: Map click listener potentially removed.");
    }
    clearTemporaryDrawing(); // Ora dovrebbe essere definita
    currentPolygonPoints = [];

    // Resetta la UI della modale qui se non viene già fatto da openSurveyGridModal o handleCancelSurveyGrid
    if (startDrawingSurveyAreaBtnEl) startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
    if (finalizeSurveyAreaBtnEl) finalizeSurveyAreaBtnEl.style.display = 'none';
    if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = true;
    if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = "Area not defined.";
    if (surveyGridInstructionsEl) surveyGridInstructionsEl.textContent = 'Click "Start Drawing" then click on the map to define the survey area corners. Click the first point again to close the polygon, or use the "Finalize Area" button.';
}


/**
 * Avvia la modalità di disegno del poligono sulla mappa.
 */
function handleStartDrawingSurveyArea() {
    console.log("[SurveyGrid] handleStartDrawingSurveyArea called");
    if (!map || !startDrawingSurveyAreaBtnEl || !finalizeSurveyAreaBtnEl || !surveyAreaStatusEl || !surveyGridInstructionsEl) {
        console.error("[SurveyGrid] Map or button elements missing in handleStartDrawingSurveyArea");
        return;
    }

    isDrawingSurveyArea = true;
    currentPolygonPoints = [];
    clearTemporaryDrawing(); // clearTemporaryDrawing è ora definita prima
    console.log("[SurveyGrid] Cleared temporary drawing, isDrawingSurveyArea set to true.");

    map.on('click', handleSurveyAreaMapClick);
    map.getContainer().style.cursor = 'crosshair';
    console.log("[SurveyGrid] Map click listener ADDED for survey area drawing. Cursor set to crosshair.");

    startDrawingSurveyAreaBtnEl.style.display = 'none';
    finalizeSurveyAreaBtnEl.style.display = 'none'; // Nascondi finché non ci sono abbastanza punti
    surveyAreaStatusEl.textContent = "Drawing area: 0 points.";
    surveyGridInstructionsEl.textContent = "Click on the map to add corners. Click the first point to close or use 'Finalize Area' (min 3 points).";
    showCustomAlert("Map drawing mode activated. Click to define polygon corners.", "Survey Area");
}

/**
 * Gestisce i click sulla mappa durante la modalità di disegno del poligono.
 */
function handleSurveyAreaMapClick(e) {
    console.log("[SurveyGrid] handleSurveyAreaMapClick TRIGGERED!", e);
    if (!isDrawingSurveyArea) {
        console.log("[SurveyGrid] handleSurveyAreaMapClick: Not in drawing mode, exiting.");
        return;
    }
    console.log("[SurveyGrid] handleSurveyAreaMapClick: In drawing mode, proceeding.");

    L.DomEvent.stopPropagation(e.originalEvent);
    L.DomEvent.preventDefault(e.originalEvent);
    console.log("[SurveyGrid] handleSurveyAreaMapClick: Event propagation stopped.");

    const clickedLatLng = e.latlng;
    currentPolygonPoints.push(clickedLatLng);
    console.log("[SurveyGrid] handleSurveyAreaMapClick: Point added:", clickedLatLng, "Total points:", currentPolygonPoints.length);

    const vertexMarker = L.circleMarker(clickedLatLng, {
        radius: 6, color: 'rgba(255, 0, 0, 0.8)', fillColor: 'rgba(255,0,0,0.5)', fillOpacity: 0.7, pane: 'markerPane'
    }).addTo(map);
    console.log("[SurveyGrid] handleSurveyAreaMapClick: Vertex marker added to map.");

    if (tempVertexMarkers.length === 0) { // Solo per il primo marker
        vertexMarker.on('click', (markerClickEvent) => {
            console.log("[SurveyGrid] First vertex marker CLICKED.");
            if (isDrawingSurveyArea && currentPolygonPoints.length >= MIN_POLYGON_POINTS) {
                L.DomEvent.stopPropagation(markerClickEvent);
                L.DomEvent.preventDefault(markerClickEvent);
                handleFinalizeSurveyArea();
            }
        });
    }
    tempVertexMarkers.push(vertexMarker);
    updateTempPolygonDisplay();

    if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = `Drawing area: ${currentPolygonPoints.length} points.`;
    if (finalizeSurveyAreaBtnEl && currentPolygonPoints.length >= MIN_POLYGON_POINTS) {
        finalizeSurveyAreaBtnEl.style.display = 'inline-block';
    }
}


/**
 * Finalizza il disegno dell'area del poligono.
 */
function handleFinalizeSurveyArea() {
    console.log("[SurveyGrid] handleFinalizeSurveyArea called");
    if (!isDrawingSurveyArea) {
         console.log("[SurveyGrid] handleFinalizeSurveyArea: Not in drawing mode or already finalized.");
         return;
    }
    if (currentPolygonPoints.length < MIN_POLYGON_POINTS) {
        showCustomAlert(`Area definition requires at least ${MIN_POLYGON_POINTS} points.`, "Info");
        return;
    }
    isDrawingSurveyArea = false;
    map.off('click', handleSurveyAreaMapClick);
    console.log("[SurveyGrid] Map click listener REMOVED for survey area drawing.");
    map.getContainer().style.cursor = '';

    if (finalizeSurveyAreaBtnEl) finalizeSurveyAreaBtnEl.style.display = 'none';
    if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = false;
    if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = `Area defined with ${currentPolygonPoints.length} points. Ready to generate grid.`;
    if (surveyGridInstructionsEl) surveyGridInstructionsEl.textContent = 'Area definition complete. Adjust parameters if needed and click "Generate Grid".';

    if (tempPolygonLayer) {
        tempPolygonLayer.setStyle({ color: 'rgba(0, 50, 200, 0.9)', fillColor: 'rgba(0, 50, 200, 0.4)' });
    }
    tempVertexMarkers.forEach(marker => marker.off('click'));

    showCustomAlert("Survey area finalized. You can now generate the grid.", "Area Defined");
}

/**
 * Annulla il processo di creazione della griglia di mappatura e chiude la modale.
 */
function handleCancelSurveyGrid() {
    console.log("[SurveyGrid] handleCancelSurveyGrid called");
    cancelSurveyAreaDrawing(); // Pulisce il disegno e lo stato di disegno
    if (surveyGridModalOverlayEl) {
        surveyGridModalOverlayEl.style.display = 'none'; // Chiude la modale
    }
}

/**
 * Gestisce la conferma e avvia la generazione della griglia (placeholder).
 */
function handleConfirmSurveyGridGeneration() {
    console.log("[SurveyGrid] handleConfirmSurveyGridGeneration called");
    if (currentPolygonPoints.length < MIN_POLYGON_POINTS) {
        showCustomAlert("Cannot generate grid: Survey area is not properly defined.", "Error");
        return;
    }
    // ... (resto dei controlli e logica di generazione come prima) ...
    const altitude = parseInt(surveyGridAltitudeInputEl.value);
    const spacing = parseFloat(surveyGridSpacingInputEl.value);
    const angle = parseFloat(surveyGridAngleInputEl.value);
    const overshoot = parseFloat(surveyGridOvershootInputEl.value);

    if (isNaN(altitude) || altitude < 1) { showCustomAlert("Invalid altitude.", "Input Error"); return; }
    if (isNaN(spacing) || spacing <= 0) { showCustomAlert("Invalid line spacing.", "Input Error"); return; }
    if (isNaN(angle)) { showCustomAlert("Invalid grid angle.", "Input Error"); return; }
    if (isNaN(overshoot) || overshoot < 0) { showCustomAlert("Invalid overshoot value.", "Input Error"); return; }

    console.log("Generating survey grid with params:", { polygon: currentPolygonPoints.map(p => [p.lat, p.lng]), altitude, spacing, angle, overshoot });
    showCustomAlert(`Grid generation started (Polygon: ${currentPolygonPoints.length} vertices, Alt: ${altitude}m, Spacing: ${spacing}m, Angle: ${angle}°). Actual generation logic is a TODO.`, "Info");
    
    // generateSurveyGridWaypoints(currentPolygonPoints, altitude, spacing, angle, overshoot);
    // updateWaypointList(); updateFlightPath(); updateFlightStatistics(); fitMapToWaypoints();

    handleCancelSurveyGrid(); // Chiude modale e pulisce il disegno dopo la (finta) generazione
}
