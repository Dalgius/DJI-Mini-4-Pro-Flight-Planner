// File: surveyGridManager.js

// Depends on: config.js (for isDrawingSurveyArea, map, DOM elements for modal)
// Depends on: mapManager.js (for map object, and assumes handleMapClick is a global function from there)
// Depends on: utils.js (for showCustomAlert)

// Variabili di stato specifiche di questo modulo
let currentPolygonPoints = [];
let tempPolygonLayer = null;
let tempVertexMarkers = [];
let nativeMapClickListener = null; // Per tenere traccia del listener DOM nativo

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

// === MAIN HANDLERS ===

/**
 * Apre e inizializza la modale per la creazione della griglia di survey.
 */
function openSurveyGridModal() {
    console.log("[SurveyGrid] openSurveyGridModal called");
    if (!surveyGridModalOverlayEl || !defaultAltitudeSlider || !surveyGridAltitudeInputEl || !confirmSurveyGridBtnEl || !finalizeSurveyAreaBtnEl || !startDrawingSurveyAreaBtnEl || !surveyAreaStatusEl || !surveyGridInstructionsEl) {
        console.error("[SurveyGrid] Modal elements missing in openSurveyGridModal");
        showCustomAlert("Survey grid modal elements not found.", "Error");
        return;
    }
    surveyGridAltitudeInputEl.value = defaultAltitudeSlider.value;
    
    cancelSurveyAreaDrawing(); // Resetta stato, UI del disegno e listener

    confirmSurveyGridBtnEl.disabled = true;
    finalizeSurveyAreaBtnEl.style.display = 'none'; // Nascosto finché non ci sono abbastanza punti
    startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
    surveyAreaStatusEl.textContent = "Area not defined.";
    surveyGridInstructionsEl.innerHTML = 'Click "Start Drawing" then click on the map to define the survey area corners. Click the first point again to close the polygon.';
    
    surveyGridModalOverlayEl.style.display = 'flex'; // MOSTRA LA MODALE
    console.log("[SurveyGrid] Survey Grid Modal displayed");
}

/**
 * Resetta lo stato del disegno, la UI della modale e i listener della mappa.
 */
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

    // Ripristina UI Modale (per quando viene riaperta o se si annulla solo il disegno parziale)
    if (startDrawingSurveyAreaBtnEl) startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
    if (finalizeSurveyAreaBtnEl) finalizeSurveyAreaBtnEl.style.display = 'none';
    if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = true;
    if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = "Area not defined.";
    if (surveyGridInstructionsEl) surveyGridInstructionsEl.innerHTML = 'Click "Start Drawing" then click on the map to define the survey area corners. Click the first point again to close the polygon.';
}

/**
 * Avvia la modalità di disegno del poligono sulla mappa. Nasconde la modale.
 */
function handleStartDrawingSurveyArea() {
    console.log("[SurveyGrid] handleStartDrawingSurveyArea called");
    if (!map || !surveyGridModalOverlayEl) { // Controlli essenziali
        console.error("[SurveyGrid] Map or Survey Grid Modal Overlay not found in handleStartDrawingSurveyArea");
        return;
    }

    isDrawingSurveyArea = true;
    currentPolygonPoints = [];
    clearTemporaryDrawing(); 
    console.log("[SurveyGrid] Cleared temporary drawing, isDrawingSurveyArea set to true.");

    if (typeof handleMapClick === 'function') {
        map.off('click', handleMapClick);
        console.log("[SurveyGrid] Leaflet default map click listener TEMPORARILY REMOVED.");
    }
    map.off('click', handleSurveyAreaMapClick); // Rimuovi per sicurezza se c'era

    const mapContainer = map.getContainer();
    if (mapContainer) {
        if (nativeMapClickListener) {
             mapContainer.removeEventListener('click', nativeMapClickListener, true);
        }
        nativeMapClickListener = function(event) {
            console.log("!!! NATIVE MAP CONTAINER CLICKED !!! Target:", event.target);
            if (!isDrawingSurveyArea) { 
                console.log("!!! NATIVE CLICK: but isDrawingSurveyArea is false. Ignoring.");
                return;
            }
            if (event.target && (event.target === mapContainer || event.target.closest('.leaflet-pane') || event.target.closest('.leaflet-container'))) {
                try {
                    const latlng = map.mouseEventToLatLng(event); 
                    console.log("!!! NATIVE CLICK Converted to LatLng:", latlng);
                    const pseudoLeafletEvent = { latlng: latlng, originalEvent: event };
                    handleSurveyAreaMapClick(pseudoLeafletEvent); 
                } catch (mapError) { console.error("!!! NATIVE CLICK: Error:", mapError); }
            } else {
                 console.log("!!! NATIVE CLICK: Target was not map/pane. Target:", event.target);
            }
        };
        mapContainer.addEventListener('click', nativeMapClickListener, true);
        console.log("[SurveyGrid] NATIVE DOM click listener ADDED.");
    }

    map.getContainer().style.cursor = 'crosshair';
    console.log("[SurveyGrid] Cursor set to crosshair.");

    // NASCONDI LA MODALE PRINCIPALE DURANTE IL DISEGNO
    surveyGridModalOverlayEl.style.display = 'none';
    console.log("[SurveyGrid] Survey grid modal HIDDEN for drawing.");

    // Feedback all'utente che la modalità disegno è attiva, dato che la modale è nascosta
    showCustomAlert("Drawing survey area: Click on map to add corners. Click the first point (min 3 total) to finalize.", "Survey Drawing Active", );
    // Potremmo anche aggiungere un listener per il tasto 'Esc' per annullare/finalizzare
    // document.addEventListener('keydown', handleSurveyDrawingKeyDown);

    // Non aggiorniamo i testi nella modale (startDrawingSurveyAreaBtnEl, ecc.) perché è nascosta.
    console.log("[SurveyGrid] Drawing mode activated.");
}

/**
 * Gestisce i click (ora da listener nativo) per aggiungere punti del poligono.
 */
function handleSurveyAreaMapClick(e) { 
    console.log("[SurveyGrid] handleSurveyAreaMapClick (from NATIVE) TRIGGERED!", "LatLng:", e.latlng);
    if (!isDrawingSurveyArea) {
        console.log("[SurveyGrid] handleSurveyAreaMapClick: Not in drawing mode, exiting.");
        return;
    }
    console.log("[SurveyGrid] handleSurveyAreaMapClick: In drawing mode, proceeding.");

    const clickedLatLng = e.latlng;
    currentPolygonPoints.push(clickedLatLng);
    console.log("[SurveyGrid] Point added, total:", currentPolygonPoints.length);

    const vertexMarker = L.circleMarker(clickedLatLng, {
        radius: 6, color: 'rgba(255, 0, 0, 0.8)', fillColor: 'rgba(255,0,0,0.5)', fillOpacity: 0.7, pane: 'markerPane'
    }).addTo(map);

    if (tempVertexMarkers.length === 0) { // Solo per il primo marker
        vertexMarker.on('click', (markerClickEvent) => {
            console.log("[SurveyGrid] First vertex marker CLICKED for finalization.");
            if (isDrawingSurveyArea && currentPolygonPoints.length >= MIN_POLYGON_POINTS) {
                L.DomEvent.stopPropagation(markerClickEvent);
                L.DomEvent.preventDefault(markerClickEvent);
                handleFinalizeSurveyArea();
            }
        });
    }
    tempVertexMarkers.push(vertexMarker);
    updateTempPolygonDisplay();

    // Il feedback sul numero di punti ora è meno diretto se la modale è nascosta.
    // Potrebbe essere utile un piccolo elemento non modale sulla mappa.
}

/**
 * Finalizza il disegno dell'area del poligono. Fa riapparire la modale.
 */
function handleFinalizeSurveyArea() {
    console.log("[SurveyGrid] handleFinalizeSurveyArea called");
    if (!isDrawingSurveyArea) {
         console.log("[SurveyGrid] handleFinalizeSurveyArea: Not in drawing mode or already finalized.");
         return;
    }
    if (currentPolygonPoints.length < MIN_POLYGON_POINTS) {
        showCustomAlert(`Area definition requires at least ${MIN_POLYGON_POINTS} points.`, "Info"); 
        // Non uscire dalla modalità disegno, permetti all'utente di aggiungere altri punti o annullare.
        // Se si vuole forzare l'uscita, chiamare cancelSurveyAreaDrawing() o riaprire la modale.
        return;
    }
    
    // Rimuovi il listener di disegno nativo, il disegno è finito
    const mapContainer = map.getContainer();
    if (mapContainer && nativeMapClickListener) {
        mapContainer.removeEventListener('click', nativeMapClickListener, true);
        nativeMapClickListener = null; 
        console.log("[SurveyGrid] NATIVE DOM click listener REMOVED after finalize.");
    }
    map.getContainer().style.cursor = '';
    // isDrawingSurveyArea rimane true finché non si clicca "Generate" o "Cancel" nella modale che riappare.
    // Il listener di default handleMapClick è ancora disattivato.

    if (surveyGridModalOverlayEl) {
        surveyGridModalOverlayEl.style.display = 'flex'; // RIAPRI LA MODALE
        console.log("[SurveyGrid] Survey grid modal SHOWN for confirmation.");
    }

    if (finalizeSurveyAreaBtnEl) finalizeSurveyAreaBtnEl.style.display = 'none'; // Non serve più
    if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = false; // Abilita Generazione
    if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = `Area defined with ${currentPolygonPoints.length} points.`;
    if (surveyGridInstructionsEl) surveyGridInstructionsEl.innerHTML = '<strong style="color: #2ecc71;">Area finalized!</strong> Adjust parameters or click "Generate Grid".';
    
    if (tempPolygonLayer) tempPolygonLayer.setStyle({ color: 'rgba(0, 50, 200, 0.9)', fillColor: 'rgba(0, 50, 200, 0.4)' });
    tempVertexMarkers.forEach(marker => marker.off('click'));
    console.log("[SurveyGrid] Area finalized. Modal shown for confirmation.");
    // Rimuovi anche il listener di 'Esc' se ne avevamo aggiunto uno per il disegno
    // document.removeEventListener('keydown', handleSurveyDrawingKeyDown);
}

/**
 * Annulla il processo di creazione della griglia e chiude la modale.
 */
function handleCancelSurveyGrid() {
    console.log("[SurveyGrid] handleCancelSurveyGrid called");
    cancelSurveyAreaDrawing(); 
    if (surveyGridModalOverlayEl) {
        surveyGridModalOverlayEl.style.display = 'none';
    }
    // Rimuovi anche il listener di 'Esc'
    // document.removeEventListener('keydown', handleSurveyDrawingKeyDown);
}

/**
 * Gestisce la conferma e avvia la generazione della griglia.
 */
function handleConfirmSurveyGridGeneration() {
    console.log("[SurveyGrid] handleConfirmSurveyGridGeneration called");
    if (currentPolygonPoints.length < MIN_POLYGON_POINTS) {
        showCustomAlert("Cannot generate grid: Survey area is not properly defined.", "Error"); return;
    }
    if (!surveyGridAltitudeInputEl || !surveyGridSpacingInputEl /*...ecc*/) {
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
    
    if (surveyGridInstructionsEl) surveyGridInstructionsEl.textContent = "Generating grid... (Actual logic is a TODO)";
    
    // Qui la logica effettiva di generateSurveyGridWaypoints(...)
    // Ad esempio:
    // const waypointsToCreate = generateSurveyGridWaypoints(currentPolygonPoints, altitude, spacing, angle, overshoot);
    // if (waypointsToCreate && waypointsToCreate.length > 0) {
    //    waypointsToCreate.forEach(wp => addWaypoint(wp.latlng, wp.options));
    //    updateWaypointList(); updateFlightPath(); updateFlightStatistics(); fitMapToWaypoints();
    //    showCustomAlert("Survey grid generated and added!", "Success");
    // } else {
    //    showCustomAlert("Failed to generate survey grid or grid was empty.", "Error");
    // }

    // Per ora, simuliamo e chiudiamo:
    setTimeout(() => {
        handleCancelSurveyGrid(); // Chiude modale, resetta stato e listener
    }, 500); // Delay per vedere il messaggio "Generating..."
}

// TODO opzionale: Aggiungere un listener per il tasto 'Esc' per annullare/finalizzare
// function handleSurveyDrawingKeyDown(event) {
//     if (isDrawingSurveyArea && event.key === 'Escape') {
//         console.log("[SurveyGrid] Escape key pressed during drawing.");
//         if (currentPolygonPoints.length >= MIN_POLYGON_POINTS) {
//             handleFinalizeSurveyArea();
//         } else {
//             // Se non ci sono abbastanza punti, annulla completamente e riapri la modale iniziale
//             cancelSurveyAreaDrawing(); // Resetta disegno
            // openSurveyGridModal(); // Riapre la modale allo stato iniziale (già fatto da cancel?)
            // Bisogna gestire lo stato della modale (nascosta/visibile)
//             if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'flex'; // Forza riapertura
//         }
//     } else if (isDrawingSurveyArea && event.key === 'Enter' && currentPolygonPoints.length >= MIN_POLYGON_POINTS) {
//          handleFinalizeSurveyArea();
//     }
// }
