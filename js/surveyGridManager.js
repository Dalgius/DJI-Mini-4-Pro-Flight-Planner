// File: surveyGridManager.js

// Depends on: config.js (for isDrawingSurveyArea, map, DOM elements for modal)
// Depends on: mapManager.js (for map object, and assumes handleMapClick is a global function from there)
// Depends on: utils.js (for showCustomAlert)

// Variabili di stato specifiche di questo modulo
let currentPolygonPoints = [];
let tempPolygonLayer = null;
let tempVertexMarkers = [];

const MIN_POLYGON_POINTS = 3;

// === HELPER FUNCTION FOR DEBUGGING ===
function debugMapClickListener(debugEvent) {
    console.log("!!! DEBUG MAP CLICK LISTENER TRIGGERED !!! LatLng:", debugEvent.latlng, "Target:", debugEvent.originalEvent.target);
    if(isDrawingSurveyArea) { // Legge la globale da config.js
        console.log("DEBUG: isDrawingSurveyArea is TRUE during debug click");
    } else {
        console.log("DEBUG: isDrawingSurveyArea is FALSE during debug click");
    }
}

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

// === MAIN HANDLERS ===

/**
 * Apre e inizializza la modale per la creazione della griglia di survey.
 */
function openSurveyGridModal() {
    console.log("[SurveyGrid] openSurveyGridModal called");
    if (!surveyGridModalOverlayEl || !defaultAltitudeSlider || !surveyGridAltitudeInputEl || !confirmSurveyGridBtnEl || !finalizeSurveyAreaBtnEl || !startDrawingSurveyAreaBtnEl || !surveyAreaStatusEl) {
        console.error("[SurveyGrid] Modal elements missing in openSurveyGridModal");
        showCustomAlert("Survey grid modal elements not found.", "Error");
        return;
    }
    surveyGridAltitudeInputEl.value = defaultAltitudeSlider.value;
    
    cancelSurveyAreaDrawing(); // Resetta stato e UI del disegno e i listener

    confirmSurveyGridBtnEl.disabled = true;
    finalizeSurveyAreaBtnEl.style.display = 'none';
    startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
    surveyAreaStatusEl.textContent = "Area not defined.";
    surveyGridInstructionsEl.textContent = 'Click "Start Drawing" then click on the map to define the survey area corners. Click the first point again to close the polygon, or use the "Finalize Area" button.';
    
    surveyGridModalOverlayEl.style.display = 'flex';
    console.log("[SurveyGrid] Survey Grid Modal displayed");
}

/**
 * Resetta lo stato del disegno del poligono, la UI della modale e i listener della mappa.
 */
function cancelSurveyAreaDrawing() {
    console.log("[SurveyGrid] cancelSurveyAreaDrawing called");
    const wasDrawing = isDrawingSurveyArea; // Legge la globale, la modificherà dopo
    isDrawingSurveyArea = false; // Imposta la globale da config.js a false

    if (map) {
        map.off('click', handleSurveyAreaMapClick); // Rimuovi il nostro listener specifico per il disegno
        map.off('click', debugMapClickListener);    // Rimuovi il listener di debug
        map.getContainer().style.cursor = '';
        console.log("[SurveyGrid] Survey drawing and debug map click listeners removed.");

        // Riaggiungi il listener di click generale solo se stavamo effettivamente disegnando
        if (wasDrawing && typeof handleMapClick === 'function') {
            map.on('click', handleMapClick); // handleMapClick è da mapManager.js
            console.log("[SurveyGrid] Default map click listener (handleMapClick) RE-ADDED after cancel/finalize.");
        } else if (!wasDrawing && typeof handleMapClick === 'function') {
            // Se non stavamo disegnando (es. apertura modale), assicurati che il listener di default sia attivo
            // Questo previene il caso in cui venga rimosso ma non riaggiunto.
            // Leaflet è idempotente con .on(), quindi aggiungerlo di nuovo non dovrebbe causare duplicati se già c'è.
            map.on('click', handleMapClick);
             console.log("[SurveyGrid] Ensured default map click listener (handleMapClick) is active.");
        }
    }
    clearTemporaryDrawing();
    currentPolygonPoints = [];

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

    isDrawingSurveyArea = true; // Imposta la globale da config.js
    currentPolygonPoints = [];
    clearTemporaryDrawing(); 
    console.log("[SurveyGrid] Cleared temporary drawing, isDrawingSurveyArea set to true.");

    if (typeof handleMapClick === 'function') {
        map.off('click', handleMapClick);
        console.log("[SurveyGrid] Default map click listener (handleMapClick) TEMPORARILY REMOVED.");
    } else {
        console.warn("[SurveyGrid] Could not remove default map click listener: handleMapClick not found globally.");
    }

    map.on('click', handleSurveyAreaMapClick); // Aggiungi il nostro listener specifico per il disegno
    map.on('click', debugMapClickListener);    // Aggiungi il listener di debug
    map.getContainer().style.cursor = 'crosshair';
    console.log("[SurveyGrid] Survey drawing and debug map click listeners ADDED. Cursor set to crosshair.");

    startDrawingSurveyAreaBtnEl.style.display = 'none';
    finalizeSurveyAreaBtnEl.style.display = 'none'; 
    surveyAreaStatusEl.textContent = "Drawing area: 0 points.";
    surveyGridInstructionsEl.textContent = "Click on the map to add corners. Click the first point to close or use 'Finalize Area' (min 3 points).";
    
    console.log("[SurveyGrid] showCustomAlert for drawing mode activation SKIPPED for testing.");
}

/**
 * Gestisce i click sulla mappa durante la modalità di disegno del poligono.
 */
function handleSurveyAreaMapClick(e) {
    console.log("[SurveyGrid] handleSurveyAreaMapClick TRIGGERED!", "LatLng:", e.latlng, "Target:", e.originalEvent.target);
    if (!isDrawingSurveyArea) { // Legge la globale da config.js
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

    if (tempVertexMarkers.length === 0) {
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
    if (!isDrawingSurveyArea) { // Controlla la globale
         console.log("[SurveyGrid] handleFinalizeSurveyArea: Not in drawing mode or already finalized.");
         return;
    }
    if (currentPolygonPoints.length < MIN_POLYGON_POINTS) {
        showCustomAlert(`Area definition requires at least ${MIN_POLYGON_POINTS} points.`, "Info");
        return;
    }
    // isDrawingSurveyArea rimane true per indicare che siamo ancora nella logica di survey,
    // ma abbiamo smesso di aggiungere punti. Sarà resettata a false da Cancel o Generate.
    
    map.off('click', handleSurveyAreaMapClick); // Rimuovi il listener per aggiungere punti
    map.off('click', debugMapClickListener);    // Rimuovi il listener di debug
    map.getContainer().style.cursor = '';
    console.log("[SurveyGrid] Survey drawing and debug map click listeners REMOVED after finalize.");

    // Non riaggiungiamo handleMapClick qui; lo farà cancelSurveyAreaDrawing quando si esce completamente.

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
    cancelSurveyAreaDrawing(); // Pulisce il disegno, resetta lo stato globale isDrawingSurveyArea, e ripristina i listener
    if (surveyGridModalOverlayEl) {
        surveyGridModalOverlayEl.style.display = 'none';
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
    if (!surveyGridAltitudeInputEl || !surveyGridSpacingInputEl || !surveyGridAngleInputEl || !surveyGridOvershootInputEl) {
         showCustomAlert("Cannot generate grid: Missing input elements.", "Error"); return;
    }
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

    handleCancelSurveyGrid(); // Chiude modale, pulisce disegno, resetta stato globale e listener
}
