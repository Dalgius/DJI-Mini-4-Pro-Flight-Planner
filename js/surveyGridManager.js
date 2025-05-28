// File: surveyGridManager.js

// Depends on: config.js (for isDrawingSurveyArea, map, DOM elements for modal)
// Depends on: mapManager.js (for map object, and assumes handleMapClick is a global function from there)
// Depends on: utils.js (for showCustomAlert)

// Variabili di stato specifiche di questo modulo
let currentPolygonPoints = [];
let tempPolygonLayer = null;
let tempVertexMarkers = [];

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
    surveyGridAltitudeInputEl.value = defaultAltitudeSlider.value; // Pre-fill altitude
    
    cancelSurveyAreaDrawing(); // Resetta stato e UI del disegno

    // Assicura che la UI della modale sia nello stato iniziale corretto
    confirmSurveyGridBtnEl.disabled = true;
    finalizeSurveyAreaBtnEl.style.display = 'none';
    startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
    surveyAreaStatusEl.textContent = "Area not defined.";
    surveyGridInstructionsEl.textContent = 'Click "Start Drawing" then click on the map to define the survey area corners. Click the first point again to close the polygon, or use the "Finalize Area" button.';
    
    surveyGridModalOverlayEl.style.display = 'flex';
    console.log("[SurveyGrid] Survey Grid Modal displayed");
}

/**
 * Resetta lo stato del disegno del poligono e la UI della modale.
 * Riattiva il listener di click generico sulla mappa se era stato rimosso.
 */
function cancelSurveyAreaDrawing() {
    console.log("[SurveyGrid] cancelSurveyAreaDrawing called");
    const wasDrawing = isDrawingSurveyArea; // Salva lo stato prima di resettare
    isDrawingSurveyArea = false; // Imposta la variabile globale da config.js

    if (map) {
        map.off('click', handleSurveyAreaMapClick); // Rimuovi il nostro listener specifico per il disegno
        map.getContainer().style.cursor = '';
        console.log("[SurveyGrid] Survey drawing map click listener potentially removed.");

        // Riaggiungi il listener di click generale solo se stavamo effettivamente disegnando
        // per evitare di aggiungerlo più volte o quando non necessario.
        if (wasDrawing && typeof handleMapClick === 'function') {
            map.on('click', handleMapClick); // handleMapClick è da mapManager.js
            console.log("[SurveyGrid] Default map click listener (handleMapClick) RE-ADDED after cancel/finalize.");
        }
    }
    clearTemporaryDrawing();
    currentPolygonPoints = [];

    // Resetta la UI della modale
    if (startDrawingSurveyAreaBtnEl) startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
    if (finalizeSurveyAreaBtnEl) finalizeSurveyAreaBtnEl.style.display = 'none';
    if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = true;
    if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = "Area not defined.";
    if (surveyGridInstructionsEl) surveyGridInstructionsEl.textContent = 'Click "Start Drawing" then click on the map to define the survey area corners. Click the first point again to close the polygon, or use the "Finalize Area" button.';
}

/**
 * Avvia la modalità di disegno del poligono sulla mappa.
 * Rimuove temporaneamente il listener di click generico della mappa.
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

    // Rimuovi temporaneamente il listener di click generale dalla mappa
    if (typeof handleMapClick === 'function') {
        map.off('click', handleMapClick);
        console.log("[SurveyGrid] Default map click listener (handleMapClick) TEMPORARILY REMOVED.");
    } else {
        console.warn("[SurveyGrid] Could not remove default map click listener: handleMapClick not found globally. Drawing might conflict.");
    }

    map.on('click', handleSurveyAreaMapClick); // Aggiungi il nostro listener specifico per il disegno
    map.getContainer().style.cursor = 'crosshair';
    console.log("[SurveyGrid] Survey drawing map click listener ADDED. Cursor set to crosshair.");

    // Aggiorna UI della modale
    startDrawingSurveyAreaBtnEl.style.display = 'none';
    finalizeSurveyAreaBtnEl.style.display = 'none'; 
    surveyAreaStatusEl.textContent = "Drawing area: 0 points.";
    surveyGridInstructionsEl.textContent = "Click on the map to add corners. Click the first point to close or use 'Finalize Area' (min 3 points).";
    
    // showCustomAlert("Map drawing mode activated. Click to define polygon corners.", "Survey Area"); // Commentato per test
    console.log("[SurveyGrid] showCustomAlert for drawing mode activation SKIPPED for testing.");
}

/**
 * Gestisce i click sulla mappa durante la modalità di disegno del poligono.
 */
function handleSurveyAreaMapClick(e) {
    console.log("[SurveyGrid] handleSurveyAreaMapClick TRIGGERED!", e);
    if (!isDrawingSurveyArea) { // isDrawingSurveyArea è la globale da config.js
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
 * Riattiva il listener di click generico sulla mappa.
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
    // Non impostare isDrawingSurveyArea a false qui, lo fa cancelSurveyAreaDrawing
    // che viene chiamato da handleCancelSurveyGrid o handleConfirmSurveyGridGeneration
    // Ma dobbiamo rimuovere il listener di disegno specifico e ripristinare quello di default.

    map.off('click', handleSurveyAreaMapClick);
    console.log("[SurveyGrid] Survey drawing map click listener REMOVED.");
    map.getContainer().style.cursor = '';

    // Riaggiungi il listener di click generale
    // Questo ora viene fatto in cancelSurveyAreaDrawing, che viene chiamato alla fine
    // if (typeof handleMapClick === 'function') {
    //     map.on('click', handleMapClick);
    //     console.log("[SurveyGrid] Default map click listener (handleMapClick) RE-ADDED after finalize.");
    // }
    // La chiamata a isDrawingSurveyArea = false e il ripristino del listener di default
    // avverrà quando si clicca "Generate Grid" (che chiama handleCancelSurveyGrid alla fine)
    // o "Cancel". Per ora, manteniamo lo stato di "disegno finalizzato ma non ancora generato".

    // Aggiorna UI della modale
    if (finalizeSurveyAreaBtnEl) finalizeSurveyAreaBtnEl.style.display = 'none';
    if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = false;
    if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = `Area defined with ${currentPolygonPoints.length} points. Ready to generate grid.`;
    if (surveyGridInstructionsEl) surveyGridInstructionsEl.textContent = 'Area definition complete. Adjust parameters if needed and click "Generate Grid".';

    if (tempPolygonLayer) {
        tempPolygonLayer.setStyle({ color: 'rgba(0, 50, 200, 0.9)', fillColor: 'rgba(0, 50, 200, 0.4)' });
    }
    tempVertexMarkers.forEach(marker => marker.off('click')); // Rimuovi listener dai marker

    showCustomAlert("Survey area finalized. You can now generate the grid.", "Area Defined");
    // isDrawingSurveyArea rimane true finché non si clicca Generate o Cancel,
    // ma il listener per handleSurveyAreaMapClick è stato rimosso.
    // Quindi i click sulla mappa non faranno più nulla finché non si esce dalla modale o si genera.
    // Forse è meglio impostare isDrawingSurveyArea = false qui e riattivare il listener di default.
    // Modificato: cancelSurveyAreaDrawing si occuperà di ripristinare lo stato e il listener di default.
    // Ma la logica di handleFinalizeSurveyArea è solo per dire "il poligono è pronto", non "esci dalla modalità survey".
    // Quindi isDrawingSurveyArea dovrebbe rimanere true, ma il listener per aggiungere punti viene rimosso.
    // Questo significa che la mappa non risponde ai click per disegnare *nuovi* punti.
    // Il listener generale è ancora disattivato. Questo stato è un po' intermedio.
    // Sarà cancelSurveyAreaDrawing (chiamato da Cancel o Generate) a fare il cleanup finale
    // e riattivare il listener generale e impostare isDrawingSurveyArea = false.
}

/**
 * Annulla il processo di creazione della griglia di mappatura e chiude la modale.
 */
function handleCancelSurveyGrid() {
    console.log("[SurveyGrid] handleCancelSurveyGrid called");
    cancelSurveyAreaDrawing(); // Pulisce il disegno, resetta lo stato e i listener
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
    
    // QUI VA LA LOGICA DI GENERAZIONE EFFETTIVA:
    // generateSurveyGridWaypoints(currentPolygonPoints, altitude, spacing, angle, overshoot);
    //POI AGGIORNAMENTI UI
    // updateWaypointList(); 
    // updateFlightPath(); 
    // updateFlightStatistics(); 
    // fitMapToWaypoints();

    handleCancelSurveyGrid(); // Chiude modale, pulisce disegno, resetta stato e listener
}
