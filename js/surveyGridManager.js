// File: surveyGridManager.js

// Depends on: config.js, mapManager.js (per 'map'), utils.js (per showCustomAlert)
// Depends on: uiUpdater.js (per aggiornare le liste/statistiche dopo la generazione della griglia)

let isDrawingSurveyArea = false;
let currentPolygonPoints = []; // Array di L.LatLng per i vertici del poligono
let tempPolygonLayer = null;   // Layer Leaflet per visualizzare il poligono in costruzione
let tempVertexMarkers = [];  // Array di L.Marker per i vertici

const MIN_POLYGON_POINTS = 3; // Minimo punti per un poligono valido

/**
 * Inizializza i controlli per la griglia di mappatura (es. apre la modale).
 */
function openSurveyGridModal() {
    if (!surveyGridModalOverlayEl || !defaultAltitudeSlider || !surveyGridAltitudeInputEl || !confirmSurveyGridBtnEl || !finalizeSurveyAreaBtnEl || !startDrawingSurveyAreaBtnEl || !surveyAreaStatusEl) {
        showCustomAlert("Survey grid modal elements not found.", "Error");
        return;
    }
    surveyGridAltitudeInputEl.value = defaultAltitudeSlider.value;
    cancelSurveyAreaDrawing();
    confirmSurveyGridBtnEl.disabled = true;
    finalizeSurveyAreaBtnEl.style.display = 'none';
    startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
    surveyAreaStatusEl.textContent = "Area not defined.";
    surveyGridInstructionsEl.textContent = 'Click "Start Drawing" then click on the map to define the survey area corners. Click the first point again to close the polygon, or use the "Finalize Area" button.';
    surveyGridModalOverlayEl.style.display = 'flex';
}

/**
 * Avvia la modalità di disegno del poligono sulla mappa.
 */
function handleStartDrawingSurveyArea() {
    if (!map || !startDrawingSurveyAreaBtnEl || !finalizeSurveyAreaBtnEl || !surveyAreaStatusEl || !surveyGridInstructionsEl) return;

    isDrawingSurveyArea = true;
    currentPolygonPoints = [];
    clearTemporaryDrawing();

    map.on('click', handleSurveyAreaMapClick); // AGGIUNGE IL LISTENER DI CLICK PER IL DISEGNO
    map.getContainer().style.cursor = 'crosshair';

    startDrawingSurveyAreaBtnEl.style.display = 'none';
    surveyAreaStatusEl.textContent = "Drawing area: 0 points.";
    surveyGridInstructionsEl.textContent = "Click on the map to add corners. Click the first point to close or use 'Finalize Area' (min 3 points).";
    showCustomAlert("Map drawing mode activated. Click to define polygon corners.", "Survey Area");
}

/**
 * Gestisce i click sulla mappa durante la modalità di disegno del poligono.
 * @param {L.LeafletMouseEvent} e L'evento click di Leaflet.
 */
function handleSurveyAreaMapClick(e) {
    if (!isDrawingSurveyArea) return;

    // !!! MODIFICA CRUCIALE: Impedisce ad altri listener di click sulla mappa (es. addWaypoint) di attivarsi !!!
    L.DomEvent.stopPropagation(e.originalEvent); // Usare e.originalEvent per gli eventi DOM nativi
    L.DomEvent.preventDefault(e.originalEvent); // Opzionale, ma può aiutare a prevenire comportamenti predefiniti


    const clickedLatLng = e.latlng;
    currentPolygonPoints.push(clickedLatLng);

    const vertexMarker = L.circleMarker(clickedLatLng, {
        radius: 6,
        color: 'rgba(255, 0, 0, 0.8)',
        fillColor: 'rgba(255,0,0,0.5)',
        fillOpacity: 0.7,
        pane: 'markerPane'
    }).addTo(map);

    // Aggiungi listener al primo marker per chiudere il poligono
    if (tempVertexMarkers.length === 0) {
        vertexMarker.on('click', (markerClickEvent) => { // 'markerClickEvent' è l'evento del click sul marker
            if (isDrawingSurveyArea && currentPolygonPoints.length >= MIN_POLYGON_POINTS) {
                L.DomEvent.stopPropagation(markerClickEvent); // Usa l'evento del click sul marker
                L.DomEvent.preventDefault(markerClickEvent);  // Impedisce al click sul marker di propagare alla mappa
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
 * Aggiorna la visualizzazione del poligono/linea temporanea sulla mappa.
 */
function updateTempPolygonDisplay() {
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
 * Finalizza il disegno dell'area del poligono.
 */
function handleFinalizeSurveyArea() {
    if (!isDrawingSurveyArea) return; // Evita doppie finalizzazioni
    if (currentPolygonPoints.length < MIN_POLYGON_POINTS) {
        showCustomAlert(`Area definition requires at least ${MIN_POLYGON_POINTS} points.`, "Info");
        return;
    }
    isDrawingSurveyArea = false;
    map.off('click', handleSurveyAreaMapClick); // RIMUOVE IL LISTENER DI DISEGNO
    map.getContainer().style.cursor = '';

    if (finalizeSurveyAreaBtnEl) finalizeSurveyAreaBtnEl.style.display = 'none';
    if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = false;
    if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = `Area defined with ${currentPolygonPoints.length} points. Ready to generate grid.`;
    if (surveyGridInstructionsEl) surveyGridInstructionsEl.textContent = 'Area definition complete. Adjust parameters if needed and click "Generate Grid".';

    if (tempPolygonLayer) {
        tempPolygonLayer.setStyle({ color: 'rgba(0, 50, 200, 0.9)', fillColor: 'rgba(0, 50, 200, 0.4)' });
    }
    tempVertexMarkers.forEach(marker => marker.off('click')); // Rimuovi i listener dai marker una volta finalizzato

    showCustomAlert("Survey area finalized. You can now generate the grid.", "Area Defined");
}

/**
 * Annulla il processo di creazione della griglia di mappatura e chiude la modale.
 */
function handleCancelSurveyGrid() {
    cancelSurveyAreaDrawing(); // Pulisce il disegno e lo stato
    if (surveyGridModalOverlayEl) {
        surveyGridModalOverlayEl.style.display = 'none';
    }
}

/**
 * Pulisce tutti i layer e i marker temporanei usati per il disegno.
 */
function clearTemporaryDrawing() {
    if (tempPolygonLayer) { map.removeLayer(tempPolygonLayer); tempPolygonLayer = null; }
    tempVertexMarkers.forEach(marker => map.removeLayer(marker));
    tempVertexMarkers = [];
}

/**
 * Resetta lo stato del disegno del poligono e la UI della modale associata.
 */
function cancelSurveyAreaDrawing() {
    isDrawingSurveyArea = false;
    if (map) {
        map.off('click', handleSurveyAreaMapClick); // Assicura che il listener sia rimosso
        map.getContainer().style.cursor = '';
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
 * Placeholder per la funzione che genererà effettivamente la griglia.
 */
function handleConfirmSurveyGridGeneration() {
    if (currentPolygonPoints.length < MIN_POLYGON_POINTS) {
        showCustomAlert("Cannot generate grid: Survey area is not properly defined.", "Error");
        return;
    }
    if (!surveyGridAltitudeInputEl || !surveyGridSpacingInputEl || !surveyGridAngleInputEl || !surveyGridOvershootInputEl) {
         showCustomAlert("Cannot generate grid: Missing input elements.", "Error");
        return;
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
    
    // Qui verrà la logica di generazione vera e propria
    // generateSurveyGridWaypoints(currentPolygonPoints, altitude, spacing, angle, overshoot);
    // updateWaypointList(); updateFlightPath(); updateFlightStatistics(); fitMapToWaypoints();

    handleCancelSurveyGrid(); // Chiude modale e pulisce
}
