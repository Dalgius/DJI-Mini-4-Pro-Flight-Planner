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

/**
 * Ripristina l'interattività della modale (es. dopo il disegno).
 */
function resetModalInteractivity() {
    if (surveyGridModalOverlayEl) {
        surveyGridModalOverlayEl.style.pointerEvents = 'auto';
        console.log("[SurveyGrid] Survey grid modal overlay pointer-events RESET to auto.");
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
    
    cancelSurveyAreaDrawing(); // Resetta stato, UI del disegno e listener

    resetModalInteractivity(); // Assicura che la modale sia interattiva all'apertura

    confirmSurveyGridBtnEl.disabled = true;
    finalizeSurveyAreaBtnEl.style.display = 'none';
    startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
    surveyAreaStatusEl.textContent = "Area not defined.";
    surveyGridInstructionsEl.textContent = 'Click "Start Drawing" then click on the map to define the survey area corners. Click the first point again to close the polygon, or use the "Finalize Area" button.';
    
    surveyGridModalOverlayEl.style.display = 'flex';
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
            console.log("[SurveyGrid] NATIVE DOM click listener REMOVED from map container.");
        }
        map.off('click', handleSurveyAreaMapClick); // Rimuovi anche quello Leaflet per sicurezza

        map.getContainer().style.cursor = '';
        console.log("[SurveyGrid] All drawing-related map click listeners should be removed.");

        if (wasDrawingOrListenersActive && typeof handleMapClick === 'function') {
            map.on('click', handleMapClick);
            console.log("[SurveyGrid] Default Leaflet map click listener (handleMapClick) RE-ADDED.");
        } else if (!wasDrawingOrListenersActive && typeof handleMapClick === 'function') {
            map.on('click', handleMapClick);
            console.log("[SurveyGrid] Ensured default Leaflet map click listener is active.");
        }
    }
    clearTemporaryDrawing();
    currentPolygonPoints = [];

    resetModalInteractivity(); // Assicura che la modale sia interattiva se si annulla il disegno

    if (startDrawingSurveyAreaBtnEl) startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
    if (finalizeSurveyAreaBtnEl) finalizeSurveyAreaBtnEl.style.display = 'none';
    if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = true;
    if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = "Area not defined.";
    if (surveyGridInstructionsEl) surveyGridInstructionsEl.textContent = 'Click "Start Drawing" then click on the map to define the survey area corners. Click the first point again to close the polygon, or use the "Finalize Area" button.';
}

/**
 * Avvia la modalità di disegno del poligono sulla mappa usando un listener DOM nativo.
 */
function handleStartDrawingSurveyArea() {
    console.log("[SurveyGrid] handleStartDrawingSurveyArea called");
    if (!map || !startDrawingSurveyAreaBtnEl || !finalizeSurveyAreaBtnEl || !surveyAreaStatusEl || !surveyGridInstructionsEl) {
        console.error("[SurveyGrid] Map or button elements missing in handleStartDrawingSurveyArea");
        return;
    }

    isDrawingSurveyArea = true;
    currentPolygonPoints = [];
    clearTemporaryDrawing(); 
    console.log("[SurveyGrid] Cleared temporary drawing, isDrawingSurveyArea set to true.");

    if (typeof handleMapClick === 'function') {
        map.off('click', handleMapClick);
        console.log("[SurveyGrid] Leaflet default map click listener (handleMapClick) TEMPORARILY REMOVED.");
    }
    map.off('click', handleSurveyAreaMapClick); // Rimuovi per sicurezza se c'era

    const mapContainer = map.getContainer();
    if (mapContainer) {
        if (nativeMapClickListener) {
             mapContainer.removeEventListener('click', nativeMapClickListener, true);
        }
        nativeMapClickListener = function(event) {
            console.log("!!! NATIVE MAP CONTAINER CLICKED !!!", "X:", event.clientX, "Y:", event.clientY, "Target:", event.target);
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
                } catch (mapError) {
                    console.error("!!! NATIVE CLICK: Error in map.mouseEventToLatLng or subsequent call:", mapError);
                }
            } else {
                 console.log("!!! NATIVE CLICK: Target was not map container or pane. Target:", event.target);
            }
        };
        mapContainer.addEventListener('click', nativeMapClickListener, true);
        console.log("[SurveyGrid] NATIVE DOM click listener ADDED to map container.");
    }

    map.getContainer().style.cursor = 'crosshair';
    console.log("[SurveyGrid] Cursor set to crosshair.");

    // Rendi la modale non interattiva ai click per permettere il disegno sulla mappa
    if (surveyGridModalOverlayEl) {
        surveyGridModalOverlayEl.style.pointerEvents = 'none';
        console.log("[SurveyGrid] Survey grid modal overlay set to pointer-events: none.");
    }

    startDrawingSurveyAreaBtnEl.style.display = 'none';
    finalizeSurveyAreaBtnEl.style.display = 'none'; 
    surveyAreaStatusEl.textContent = "Drawing area: 0 points.";
    surveyGridInstructionsEl.textContent = "Click on the map to add corners. Click the first point to close or use 'Finalize Area' (min 3 points).";
    
    console.log("[SurveyGrid] showCustomAlert for drawing mode activation SKIPPED for testing.");
}

/**
 * Gestisce i click (ora da listener nativo) per aggiungere punti del poligono.
 */
function handleSurveyAreaMapClick(e) { 
    console.log("[SurveyGrid] handleSurveyAreaMapClick (from NATIVE) TRIGGERED!", "LatLng:", e.latlng, "Target:", e.originalEvent.target);
    if (!isDrawingSurveyArea) {
        console.log("[SurveyGrid] handleSurveyAreaMapClick: Not in drawing mode, exiting.");
        return;
    }
    console.log("[SurveyGrid] handleSurveyAreaMapClick: In drawing mode, proceeding.");

    // Non è necessario stopPropagation/preventDefault qui perché il listener nativo è molto specifico
    // e gli altri listener Leaflet sulla mappa sono stati disattivati.

    const clickedLatLng = e.latlng;
    currentPolygonPoints.push(clickedLatLng);
    console.log("[SurveyGrid] Point added:", clickedLatLng, "Total points:", currentPolygonPoints.length);

    const vertexMarker = L.circleMarker(clickedLatLng, {
        radius: 6, color: 'rgba(255, 0, 0, 0.8)', fillColor: 'rgba(255,0,0,0.5)', fillOpacity: 0.7, pane: 'markerPane'
    }).addTo(map);
    console.log("[SurveyGrid] Vertex marker added to map.");

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
    if (!isDrawingSurveyArea) {
         console.log("[SurveyGrid] handleFinalizeSurveyArea: Not in drawing mode or already finalized.");
         return;
    }
    if (currentPolygonPoints.length < MIN_POLYGON_POINTS) {
        showCustomAlert(`Area definition requires at least ${MIN_POLYGON_POINTS} points.`, "Info");
        return;
    }
    
    // Rimuovi il listener di disegno nativo
    const mapContainer = map.getContainer();
    if (mapContainer && nativeMapClickListener) {
        mapContainer.removeEventListener('click', nativeMapClickListener, true);
        nativeMapClickListener = null;
        console.log("[SurveyGrid] NATIVE DOM click listener REMOVED after finalize.");
    }
    map.getContainer().style.cursor = '';
    console.log("[SurveyGrid] Drawing-specific map click listener removed after finalize. Cursor reset.");
    // isDrawingSurveyArea rimane true, l'utente è ancora nel flusso survey
    // ma non può più aggiungere punti. Il listener di default non è ancora attivo.

    resetModalInteractivity(); // Rendi la modale nuovamente cliccabile per "Generate" o "Cancel"

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
    cancelSurveyAreaDrawing(); 
    // resetModalInteractivity(); // Già chiamato da cancelSurveyAreaDrawing
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
    // ... (controlli input come prima) ...
    const altitude = parseInt(surveyGridAltitudeInputEl.value);
    const spacing = parseFloat(surveyGridSpacingInputEl.value);
    const angle = parseFloat(surveyGridAngleInputEl.value);
    const overshoot = parseFloat(surveyGridOvershootInputEl.value);

    if (isNaN(altitude) || altitude < 1) { /*...*/ return; }
    if (isNaN(spacing) || spacing <= 0) { /*...*/ return; }
    if (isNaN(angle)) { /*...*/ return; }
    if (isNaN(overshoot) || overshoot < 0) { /*...*/ return; }

    console.log("Generating survey grid with params:", { polygon: currentPolygonPoints.map(p => [p.lat, p.lng]), altitude, spacing, angle, overshoot });
    showCustomAlert(`Grid generation started... Actual generation logic is a TODO.`, "Info");
    
    // FUTURA LOGICA:
    // const surveyWaypoints = generateSurveyGridWaypoints(currentPolygonPoints, altitude, spacing, angle, overshoot);
    // if (surveyWaypoints && surveyWaypoints.length > 0) {
    //     surveyWaypoints.forEach(wpData => addWaypoint(wpData.latlng, wpData.options)); // addWaypoint da waypointManager
    //     updateWaypointList(); 
    //     updateFlightPath(); 
    //     updateFlightStatistics(); 
    //     fitMapToWaypoints();
    //     showCustomAlert("Survey grid waypoints generated and added to the mission!", "Success");
    // } else {
    //     showCustomAlert("Failed to generate survey grid waypoints or grid was empty.", "Error");
    // }

    handleCancelSurveyGrid(); // Chiude modale e resetta tutto
}
