// File: surveyGridManager.js

// Depends on: config.js (for isDrawingSurveyArea, map, DOM elements for modal)
// Depends on: mapManager.js (for map object, and assumes handleMapClick is a global function from there)
// Depends on: utils.js (for showCustomAlert - usato solo per errori ora)

let currentPolygonPoints = [];
let tempPolygonLayer = null;
let tempVertexMarkers = [];
let nativeMapClickListener = null;

const MIN_POLYGON_POINTS = 3;

function clearTemporaryDrawing() {
    console.log("[SurveyGrid] clearTemporaryDrawing called");
    if (tempPolygonLayer) { map.removeLayer(tempPolygonLayer); tempPolygonLayer = null; }
    tempVertexMarkers.forEach(marker => map.removeLayer(marker));
    tempVertexMarkers = [];
}

function updateTempPolygonDisplay() {
    console.log("[SurveyGrid] updateTempPolygonDisplay called");
    if (tempPolygonLayer) { map.removeLayer(tempPolygonLayer); tempPolygonLayer = null; }
    if (currentPolygonPoints.length < 2) return;
    const opts = { color: 'rgba(0, 100, 255, 0.7)', weight: 2, fillColor: 'rgba(0, 100, 255, 0.2)', fillOpacity: 0.3 };
    if (currentPolygonPoints.length === 2) tempPolygonLayer = L.polyline(currentPolygonPoints, opts).addTo(map);
    else if (currentPolygonPoints.length >= MIN_POLYGON_POINTS) tempPolygonLayer = L.polygon(currentPolygonPoints, opts).addTo(map);
}

function setModalInteractivity(isInteractive) {
    if (surveyGridModalOverlayEl) {
        const modalContent = surveyGridModalOverlayEl.querySelector('.modal-content');
        if (isInteractive) {
            surveyGridModalOverlayEl.style.pointerEvents = 'auto';
            if (modalContent) modalContent.style.pointerEvents = 'auto';
            console.log("[SurveyGrid] Modal set to INTERACTIVE.");
        } else {
            surveyGridModalOverlayEl.style.pointerEvents = 'none'; // Overlay non blocca i click sulla mappa
            if (modalContent) modalContent.style.pointerEvents = 'auto'; // Ma il contenuto della modale SÌ
            console.log("[SurveyGrid] Modal overlay set to NON-INTERACTIVE (content IS interactive).");
        }
    }
}

function openSurveyGridModal() {
    console.log("[SurveyGrid] openSurveyGridModal called");
    if (!surveyGridModalOverlayEl || !defaultAltitudeSlider /*...altri controlli DOM...*/) {
        showCustomAlert("Survey grid modal elements not found.", "Error"); return;
    }
    surveyGridAltitudeInputEl.value = defaultAltitudeSlider.value;
    cancelSurveyAreaDrawing(); // Resetta tutto, inclusi i listener e l'interattività della modale
    setModalInteractivity(true); // Assicura che la modale sia interattiva all'apertura
    confirmSurveyGridBtnEl.disabled = true;
    finalizeSurveyAreaBtnEl.style.display = 'none';
    startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
    surveyAreaStatusEl.textContent = "Area not defined.";
    surveyGridInstructionsEl.textContent = 'Click "Start Drawing" then click on the map to define the survey area corners. Click the first point again to close the polygon, or use the "Finalize Area" button.';
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
            map.on('click', handleMapClick); // Riaggiungi solo se necessario
            console.log("[SurveyGrid] Default Leaflet map click listener RE-ENSURED.");
        }
    }
    clearTemporaryDrawing();
    currentPolygonPoints = [];
    setModalInteractivity(true); // Modale torna interattiva
    if (startDrawingSurveyAreaBtnEl) startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
    if (finalizeSurveyAreaBtnEl) finalizeSurveyAreaBtnEl.style.display = 'none';
    if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = true;
    if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = "Area not defined.";
    if (surveyGridInstructionsEl) surveyGridInstructionsEl.innerHTML = 'Click "Start Drawing" then click on the map to define the survey area corners. Click the first point again to close the polygon, or use the "Finalize Area" button.';
}

function handleStartDrawingSurveyArea() {
    console.log("[SurveyGrid] handleStartDrawingSurveyArea called");
    if (!map /*...altri controlli DOM...*/) { return; }
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
            if (!isDrawingSurveyArea) return;
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
    setModalInteractivity(false); // Rendi l'overlay non interattivo, ma il contenuto sì
    startDrawingSurveyAreaBtnEl.style.display = 'none';
    finalizeSurveyAreaBtnEl.style.display = 'none';
    surveyAreaStatusEl.textContent = "Drawing area: 0 points.";
    surveyGridInstructionsEl.textContent = "Click on the map to add corners. Click the first point to close or use 'Finalize Area' (min 3 points).";
    console.log("[SurveyGrid] Drawing mode activated.");
}

function handleSurveyAreaMapClick(e) {
    console.log("[SurveyGrid] handleSurveyAreaMapClick TRIGGERED!");
    if (!isDrawingSurveyArea) { console.log("Not in drawing mode."); return; }
    // L.DomEvent.stopPropagation(e.originalEvent); // Il listener nativo è già abbastanza isolato
    // L.DomEvent.preventDefault(e.originalEvent);
    const clickedLatLng = e.latlng;
    currentPolygonPoints.push(clickedLatLng);
    console.log("Point added, total:", currentPolygonPoints.length);
    const vertexMarker = L.circleMarker(clickedLatLng, { radius: 6, color: 'rgba(255,0,0,0.8)', fillColor: 'rgba(255,0,0,0.5)', fillOpacity: 0.7, pane: 'markerPane' }).addTo(map);
    if (tempVertexMarkers.length === 0) {
        vertexMarker.on('click', (markerClickEvent) => {
            if (isDrawingSurveyArea && currentPolygonPoints.length >= MIN_POLYGON_POINTS) {
                L.DomEvent.stopPropagation(markerClickEvent); L.DomEvent.preventDefault(markerClickEvent);
                handleFinalizeSurveyArea();
            }
        });
    }
    tempVertexMarkers.push(vertexMarker);
    updateTempPolygonDisplay();
    surveyAreaStatusEl.textContent = `Drawing area: ${currentPolygonPoints.length} points.`;
    if (finalizeSurveyAreaBtnEl && currentPolygonPoints.length >= MIN_POLYGON_POINTS) {
        finalizeSurveyAreaBtnEl.style.display = 'inline-block';
    }
}

function handleFinalizeSurveyArea() {
    console.log("[SurveyGrid] handleFinalizeSurveyArea called");
    if (!isDrawingSurveyArea) {
         console.log("[SurveyGrid] handleFinalizeSurveyArea: Not in drawing mode or already finalized.");
         return;
    }
    if (currentPolygonPoints.length < MIN_POLYGON_POINTS) {
        // Questo showCustomAlert è per un errore, ed è OK che rimanga
        showCustomAlert(`Area definition requires at least ${MIN_POLYGON_POINTS} points.`, "Info"); 
        return;
    }
    
    const mapContainer = map.getContainer();
    if (mapContainer && nativeMapClickListener) {
        mapContainer.removeEventListener('click', nativeMapClickListener, true);
        nativeMapClickListener = null; 
        console.log("[SurveyGrid] NATIVE DOM click listener REMOVED after finalize.");
    }
    map.getContainer().style.cursor = '';
    console.log("[SurveyGrid] Drawing-specific map click listener removed after finalize. Cursor reset.");

    setModalInteractivity(true); 

    finalizeSurveyAreaBtnEl.style.display = 'none';
    confirmSurveyGridBtnEl.disabled = false;
    surveyAreaStatusEl.textContent = `Area defined with ${currentPolygonPoints.length} points.`;
    
    // AGGIORNAMENTO DEL TESTO NELLA MODALE INVECE DELL'ALERT
    if (surveyGridInstructionsEl) {
        surveyGridInstructionsEl.innerHTML = '<strong style="color: #2ecc71;">Area finalized!</strong> Adjust parameters or click "Generate Grid".';
    }
    
    if (tempPolygonLayer) {
        tempPolygonLayer.setStyle({ color: 'rgba(0, 50, 200, 0.9)', fillColor: 'rgba(0, 50, 200, 0.4)' });
    }
    tempVertexMarkers.forEach(marker => marker.off('click'));
    console.log("[SurveyGrid] Area finalized. Modal interactive for confirmation.");

    // ASSICURATI CHE QUESTA RIGA SIA STATA RIMOSSA O COMMENTATA:
    // showCustomAlert("Survey area finalized. You can now generate the grid.", "Area Defined"); 
}

function handleCancelSurveyGrid() {
    console.log("[SurveyGrid] handleCancelSurveyGrid called");
    cancelSurveyAreaDrawing(); // Pulisce, resetta stato, ripristina listener e interattività modale
    if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'none';
}

function handleConfirmSurveyGridGeneration() {
    console.log("[SurveyGrid] handleConfirmSurveyGridGeneration called");
    if (currentPolygonPoints.length < MIN_POLYGON_POINTS) { /*...*/ return; }
    if (!surveyGridAltitudeInputEl /*...altri controlli input...*/) { /*...*/ return; }
    const altitude = parseInt(surveyGridAltitudeInputEl.value);
    // ... (get spacing, angle, overshoot e validazioni) ...
    console.log("Generating survey grid with params:", { /*...*/ });
    // showCustomAlert(`Grid generation started... Actual logic is a TODO.`, "Info"); // Commentato per ora
    if (surveyGridInstructionsEl) surveyGridInstructionsEl.textContent = "Generating grid... (TODO)";
    
    // generateSurveyGridWaypoints(...);
    // update UI...

    // Simula una generazione e poi chiude
    setTimeout(() => { // Per dare tempo di vedere il messaggio "Generating..."
        handleCancelSurveyGrid(); 
        if (surveyGridInstructionsEl) surveyGridInstructionsEl.textContent = "Grid generation (TODO) complete. Modal closed."; // Non si vedrà perché la modale si chiude
    }, 500);
}
