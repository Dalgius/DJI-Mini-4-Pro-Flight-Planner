// File: surveyGridManager.js
// ... (inizio del file invariato) ...

function openSurveyGridModal() {
    console.log("[SurveyGrid] openSurveyGridModal called"); // DEBUG
    if (!surveyGridModalOverlayEl /* ...altri controlli... */) {
        console.error("[SurveyGrid] Modal elements missing in openSurveyGridModal"); // DEBUG
        showCustomAlert("Survey grid modal elements not found.", "Error");
        return;
    }
    // ... resto della funzione ...
    surveyGridModalOverlayEl.style.display = 'flex';
    console.log("[SurveyGrid] Survey Grid Modal displayed"); // DEBUG
}

function handleStartDrawingSurveyArea() {
    console.log("[SurveyGrid] handleStartDrawingSurveyArea called"); // DEBUG
    if (!map || !startDrawingSurveyAreaBtnEl /* ...altri controlli... */) {
        console.error("[SurveyGrid] Map or button elements missing in handleStartDrawingSurveyArea"); // DEBUG
        return;
    }

    isDrawingSurveyArea = true;
    currentPolygonPoints = [];
    clearTemporaryDrawing();
    console.log("[SurveyGrid] Cleared temporary drawing, isDrawingSurveyArea set to true."); // DEBUG

    map.on('click', handleSurveyAreaMapClick);
    map.getContainer().style.cursor = 'crosshair';
    console.log("[SurveyGrid] Map click listener ADDED for survey area drawing. Cursor set to crosshair."); // DEBUG

    startDrawingSurveyAreaBtnEl.style.display = 'none';
    surveyAreaStatusEl.textContent = "Drawing area: 0 points.";
    surveyGridInstructionsEl.textContent = "Click on the map to add corners. Click the first point to close or use 'Finalize Area' (min 3 points).";
    showCustomAlert("Map drawing mode activated. Click to define polygon corners.", "Survey Area");
}

function handleSurveyAreaMapClick(e) {
    console.log("[SurveyGrid] handleSurveyAreaMapClick TRIGGERED!", e); // DEBUG
    if (!isDrawingSurveyArea) {
        console.log("[SurveyGrid] handleSurveyAreaMapClick: Not in drawing mode, exiting."); // DEBUG
        return;
    }
    console.log("[SurveyGrid] handleSurveyAreaMapClick: In drawing mode, proceeding."); // DEBUG

    L.DomEvent.stopPropagation(e.originalEvent);
    L.DomEvent.preventDefault(e.originalEvent);
    console.log("[SurveyGrid] handleSurveyAreaMapClick: Event propagation stopped."); // DEBUG

    const clickedLatLng = e.latlng;
    currentPolygonPoints.push(clickedLatLng);
    console.log("[SurveyGrid] handleSurveyAreaMapClick: Point added:", clickedLatLng, "Total points:", currentPolygonPoints.length); // DEBUG

    const vertexMarker = L.circleMarker(clickedLatLng, { /* ... stile ... */ }).addTo(map);
    console.log("[SurveyGrid] handleSurveyAreaMapClick: Vertex marker added to map."); // DEBUG

    if (tempVertexMarkers.length === 0) {
        vertexMarker.on('click', (markerClickEvent) => {
            console.log("[SurveyGrid] First vertex marker CLICKED."); // DEBUG
            if (isDrawingSurveyArea && currentPolygonPoints.length >= MIN_POLYGON_POINTS) {
                L.DomEvent.stopPropagation(markerClickEvent);
                L.DomEvent.preventDefault(markerClickEvent);
                handleFinalizeSurveyArea();
            }
        });
    }
    tempVertexMarkers.push(vertexMarker);
    updateTempPolygonDisplay();
    // ... resto della funzione ...
}

function handleFinalizeSurveyArea() {
    console.log("[SurveyGrid] handleFinalizeSurveyArea called"); // DEBUG
    if (!isDrawingSurveyArea) {
         console.log("[SurveyGrid] handleFinalizeSurveyArea: Not in drawing mode or already finalized."); // DEBUG
         return;
    }
    // ... resto della funzione ...
    map.off('click', handleSurveyAreaMapClick);
    console.log("[SurveyGrid] Map click listener REMOVED for survey area drawing."); // DEBUG
    // ...
}

function cancelSurveyAreaDrawing() {
    console.log("[SurveyGrid] cancelSurveyAreaDrawing called"); // DEBUG
    isDrawingSurveyArea = false;
    if (map) {
        map.off('click', handleSurveyAreaMapClick);
        map.getContainer().style.cursor = '';
        console.log("[SurveyGrid] cancelSurveyAreaDrawing: Map click listener potentially removed."); // DEBUG
    }
    // ... resto della funzione ...
}

// ... (altre funzioni come updateTempPolygonDisplay, clearTemporaryDrawing, ecc. rimangono) ...
// ... (handleConfirmSurveyGridGeneration, handleCancelSurveyGrid anche) ...
