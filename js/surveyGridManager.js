// File: surveyGridManager.js

// Depends on: config.js (for isDrawingSurveyArea, map, DOM elements for modal, R_EARTH)
// Depends on: mapManager.js (for map object, and assumes handleMapClick is a global function from there)
// Depends on: utils.js (for showCustomAlert, and toRad if global)
// Depends on: waypointManager.js (for addWaypoint)

let currentPolygonPoints = [];
let tempPolygonLayer = null;
let tempVertexMarkers = [];
let nativeMapClickListener = null;

const MIN_POLYGON_POINTS = 3;

// === HELPER FUNCTIONS ===
function clearTemporaryDrawing() {
    console.log("[SurveyGrid] clearTemporaryDrawing called");
    if (tempPolygonLayer) { map.removeLayer(tempPolygonLayer); tempPolygonLayer = null; }
    tempVertexMarkers.forEach(marker => map.removeLayer(marker)); tempVertexMarkers = [];
}

function updateTempPolygonDisplay() {
    console.log("[SurveyGrid] updateTempPolygonDisplay called");
    if (tempPolygonLayer) { map.removeLayer(tempPolygonLayer); tempPolygonLayer = null; }
    if (currentPolygonPoints.length < 2) return;
    const opts = { color: 'rgba(0, 100, 255, 0.7)', weight: 2, fillColor: 'rgba(0, 100, 255, 0.2)', fillOpacity: 0.3 };
    if (currentPolygonPoints.length === 2) tempPolygonLayer = L.polyline(currentPolygonPoints, opts).addTo(map);
    else if (currentPolygonPoints.length >= MIN_POLYGON_POINTS) tempPolygonLayer = L.polygon(currentPolygonPoints, opts).addTo(map);
}

function toRad(degrees) { return degrees * Math.PI / 180; }

function rotateLatLng(pointLatLng, centerLatLng, angleRadians) {
    const cosAngle = Math.cos(angleRadians); const sinAngle = Math.sin(angleRadians);
    const dLngScaled = (pointLatLng.lng - centerLatLng.lng) * Math.cos(toRad(centerLatLng.lat));
    const dLat = pointLatLng.lat - centerLatLng.lat;
    const rotatedDLngScaled = dLngScaled * cosAngle - dLat * sinAngle;
    const rotatedDLat = dLngScaled * sinAngle + dLat * cosAngle;
    const finalLng = centerLatLng.lng + (rotatedDLngScaled / Math.cos(toRad(centerLatLng.lat)));
    const finalLat = centerLatLng.lat + rotatedDLat;
    return L.latLng(finalLat, finalLng);
}

function isPointInPolygon(point, polygonVertices) {
    let isInside = false; const x = point.lng; const y = point.lat;
    for (let i = 0, j = polygonVertices.length - 1; i < polygonVertices.length; j = i++) {
        const xi = polygonVertices[i].lng, yi = polygonVertices[i].lat;
        const xj = polygonVertices[j].lng, yj = polygonVertices[j].lat;
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
    }
    return isInside;
}

function destinationPoint(startLatLng, bearingDeg, distanceMeters) {
    const R = (typeof R_EARTH !== 'undefined') ? R_EARTH : 6371000;
    const angularDistance = distanceMeters / R;
    const bearingRad = toRad(bearingDeg);
    const lat1 = toRad(startLatLng.lat); const lon1 = toRad(startLatLng.lng);
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angularDistance) + Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRad));
    let lon2 = lon1 + Math.atan2(Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1), Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2));
    lon2 = (lon2 + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
    return L.latLng(lat2 * 180 / Math.PI, lon2 * 180 / Math.PI);
}

// === MAIN UI HANDLERS ===
function openSurveyGridModal() {
    console.log("[SurveyGrid] openSurveyGridModal called");
    if (!surveyGridModalOverlayEl || !defaultAltitudeSlider /*...*/) { showCustomAlert("Modal elements missing.", "Error"); return; }
    surveyGridAltitudeInputEl.value = defaultAltitudeSlider.value;
    cancelSurveyAreaDrawing();
    confirmSurveyGridBtnEl.disabled = true;
    finalizeSurveyAreaBtnEl.style.display = 'none';
    startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
    surveyAreaStatusEl.textContent = "Area not defined.";
    surveyGridInstructionsEl.innerHTML = 'Click "Start Drawing", then click on map to define corners. Click first point to close.';
    surveyGridModalOverlayEl.style.display = 'flex';
    console.log("[SurveyGrid] Modal displayed");
}

function cancelSurveyAreaDrawing() {
    console.log("[SurveyGrid] cancelSurveyAreaDrawing called");
    const wasActive = isDrawingSurveyArea || nativeMapClickListener;
    isDrawingSurveyArea = false;
    if (map) {
        const mapContainer = map.getContainer();
        if (mapContainer && nativeMapClickListener) {
            mapContainer.removeEventListener('click', nativeMapClickListener, true);
            nativeMapClickListener = null; console.log("NATIVE DOM listener REMOVED.");
        }
        map.off('click', handleSurveyAreaMapClick);
        map.getContainer().style.cursor = '';
        console.log("All drawing listeners removed.");
        if ((wasActive || !map.hasEventListeners('click', handleMapClick)) && typeof handleMapClick === 'function') {
            map.on('click', handleMapClick); console.log("Default map click listener RE-ENSURED.");
        }
    }
    clearTemporaryDrawing(); currentPolygonPoints = [];
    if (startDrawingSurveyAreaBtnEl) startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
    if (finalizeSurveyAreaBtnEl) finalizeSurveyAreaBtnEl.style.display = 'none';
    if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = true;
    if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = "Area not defined.";
    if (surveyGridInstructionsEl) surveyGridInstructionsEl.innerHTML = 'Click "Start Drawing", then click on map to define corners. Click first point to close.';
}

function handleStartDrawingSurveyArea() {
    console.log("[SurveyGrid] handleStartDrawingSurveyArea called");
    if (!map || !surveyGridModalOverlayEl) { console.error("Map or Modal missing"); return; }
    isDrawingSurveyArea = true; currentPolygonPoints = []; clearTemporaryDrawing();
    console.log("Drawing started, isDrawingSurveyArea=true.");
    if (typeof handleMapClick === 'function') {
        map.off('click', handleMapClick); console.log("Default map listener REMOVED.");
    }
    map.off('click', handleSurveyAreaMapClick);
    const mapContainer = map.getContainer();
    if (mapContainer) {
        if (nativeMapClickListener) mapContainer.removeEventListener('click', nativeMapClickListener, true);
        nativeMapClickListener = function(event) {
            console.log("!!! NATIVE MAP CLICK !!! Target:", event.target);
            if (!isDrawingSurveyArea) { console.log("NATIVE CLICK: not drawing."); return; }
            if (event.target && (event.target === mapContainer || event.target.closest('.leaflet-pane') || event.target.closest('.leaflet-container'))) {
                try {
                    const latlng = map.mouseEventToLatLng(event);
                    handleSurveyAreaMapClick({ latlng: latlng, originalEvent: event });
                } catch (mapError) { console.error("NATIVE CLICK Error:", mapError); }
            } else { console.log("NATIVE CLICK: Target not map/pane."); }
        };
        mapContainer.addEventListener('click', nativeMapClickListener, true);
        console.log("NATIVE DOM listener ADDED.");
    }
    map.getContainer().style.cursor = 'crosshair';
    surveyGridModalOverlayEl.style.display = 'none'; // NASCONDI MODALE
    console.log("Modal HIDDEN for drawing.");
    showCustomAlert("Drawing survey area: Click on map to add corners. Click the first point (min 3 total) to finalize.", "Survey Drawing Active");
    console.log("Drawing mode activated.");
}

function handleSurveyAreaMapClick(e) {
    console.log("[SurveyGrid] handleSurveyAreaMapClick TRIGGERED! LatLng:", e.latlng);
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
        showCustomAlert(`Area requires at least ${MIN_POLYGON_POINTS} points.`, "Info"); return;
    }
    const mapContainer = map.getContainer();
    if (mapContainer && nativeMapClickListener) {
        mapContainer.removeEventListener('click', nativeMapClickListener, true);
        nativeMapClickListener = null; console.log("NATIVE DOM listener REMOVED after finalize.");
    }
    map.getContainer().style.cursor = '';
    if (surveyGridModalOverlayEl) {
        surveyGridModalOverlayEl.style.display = 'flex'; // RIAPRI MODALE
        console.log("Modal SHOWN for confirmation.");
    }
    if (finalizeSurveyAreaBtnEl) finalizeSurveyAreaBtnEl.style.display = 'none';
    if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = false;
    if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = `Area defined: ${currentPolygonPoints.length} points.`;
    if (surveyGridInstructionsEl) surveyGridInstructionsEl.innerHTML = '<strong style="color: #2ecc71;">Area finalized!</strong> Adjust parameters or click "Generate Grid".';
    if (tempPolygonLayer) tempPolygonLayer.setStyle({ color: 'rgba(0, 50, 200, 0.9)', fillColor: 'rgba(0, 50, 200, 0.4)' });
    tempVertexMarkers.forEach(marker => marker.off('click'));
    console.log("Area finalized. Modal shown for confirmation.");
}

function handleCancelSurveyGrid() {
    console.log("[SurveyGrid] handleCancelSurveyGrid called");
    cancelSurveyAreaDrawing();
    if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'none';
}

// === GRID GENERATION LOGIC ===
function generateSurveyGridWaypoints(polygonLatLngs, flightAltitude, lineSpacing, gridAngleDeg, overshootDistance) {
    console.log("[SurveyGridGen] Starting generation (ANGLE + OVERSHOOT) with:", {
        polygonPts: polygonLatLngs ? polygonLatLngs.length : 0, flightAltitude, lineSpacing, gridAngleDeg, overshootDistance
    });
    const finalWaypointsData = [];
    if (!polygonLatLngs || polygonLatLngs.length < MIN_POLYGON_POINTS) {
        showCustomAlert("Invalid polygon for generation.", "Error"); return finalWaypointsData;
    }

    const rotationCenter = polygonLatLngs[0];
    const angleRad = toRad(gridAngleDeg);
    const rotatedPolygonLatLngs = polygonLatLngs.map(p => rotateLatLng(p, rotationCenter, -angleRad));
    const rotatedBounds = L.latLngBounds(rotatedPolygonLatLngs);
    const rNE = rotatedBounds.getNorthEast(); const rSW = rotatedBounds.getSouthWest();

    console.log(`[SurveyGridGen] Rotated Bounds: SW(${rSW.lat.toFixed(6)},${rSW.lng.toFixed(6)}) NE(${rNE.lat.toFixed(6)},${rNE.lng.toFixed(6)})`);
    if (rSW.lat >= rNE.lat - 1e-7 || rSW.lng >= rNE.lng - 1e-7) {
        showCustomAlert("Polygon too small or angle issue.", "Grid Error"); return finalWaypointsData;
    }

    const earthR = (typeof R_EARTH !== 'undefined') ? R_EARTH : 6371000;
    const lineSpacingRotLat = (lineSpacing / earthR) * (180 / Math.PI);
    const photoDist = lineSpacing; // Semplificazione
    const photoSpacingRotLng = (photoDist / (earthR * Math.cos(toRad(rotationCenter.lat)))) * (180 / Math.PI);

    if (lineSpacingRotLat <= 1e-9 || photoSpacingRotLng <= 1e-9) {
        showCustomAlert("Spacing calculation error.", "Grid Error"); return finalWaypointsData;
    }

    let currentRotLat = rSW.lat;
    let scanDir = 1; let lines = 0;

    while (currentRotLat <= rNE.lat + lineSpacingRotLat * 0.5) {
        lines++;
        const lineCandRot = [];
        if (scanDir === 1) {
            for (let curRotLng = rSW.lng; curRotLng <= rNE.lng; curRotLng += photoSpacingRotLng) lineCandRot.push(L.latLng(currentRotLat, curRotLng));
            if (!lineCandRot.length || lineCandRot[lineCandRot.length - 1].lng < rNE.lng - 1e-7) lineCandRot.push(L.latLng(currentRotLat, rNE.lng));
        } else {
            for (let curRotLng = rNE.lng; curRotLng >= rSW.lng; curRotLng -= photoSpacingRotLng) lineCandRot.push(L.latLng(currentRotLat, curRotLng));
            if (!lineCandRot.length || lineCandRot[lineCandRot.length - 1].lng > rSW.lng + 1e-7) lineCandRot.push(L.latLng(currentRotLat, rSW.lng));
        }

        const actualGeoPtsOnLine = [];
        lineCandRot.forEach(rotPt => {
            const actualGeoPt = rotateLatLng(rotPt, rotationCenter, angleRad);
            if (isPointInPolygon(actualGeoPt, polygonLatLngs)) actualGeoPtsOnLine.push(actualGeoPt);
        });

        if (actualGeoPtsOnLine.length > 0) {
            console.log(`[SurveyGridGen] Line ${lines}: ${actualGeoPtsOnLine.length} pts inside.`);
            let lineBear = gridAngleDeg; if (scanDir === -1) lineBear = (gridAngleDeg + 180);
            lineBear = (lineBear % 360 + 360) % 360;
            let oppositeLineBear = (lineBear + 180) % 360;
            
            let processedLineWps = [];

            if (actualGeoPtsOnLine.length === 1) {
                // Singolo punto, applica overshoot se > 0, altrimenti solo il punto
                const pt = actualGeoPtsOnLine[0];
                if (overshootDistance > 0.1) {
                    processedLineWps.push({ latlng: destinationPoint(pt, oppositeLineBear, overshootDistance), options: { altitude: flightAltitude, cameraAction: 'none', headingControl: 'fixed', fixedHeading: Math.round(lineBear) }});
                    processedLineWps.push({ latlng: pt, options: { altitude: flightAltitude, cameraAction: 'takePhoto', headingControl: 'fixed', fixedHeading: Math.round(lineBear) }});
                    processedLineWps.push({ latlng: destinationPoint(pt, lineBear, overshootDistance), options: { altitude: flightAltitude, cameraAction: 'none', headingControl: 'fixed', fixedHeading: Math.round(lineBear) }});
                } else {
                     processedLineWps.push({ latlng: pt, options: { altitude: flightAltitude, cameraAction: 'takePhoto', headingControl: 'fixed', fixedHeading: Math.round(lineBear) }});
                }
            } else { // Almeno due punti interni
                const firstInternal = actualGeoPtsOnLine[0];
                const lastInternal = actualGeoPtsOnLine[actualGeoPtsOnLine.length - 1];

                const startOvershoot = destinationPoint(firstInternal, oppositeLineBear, overshootDistance);
                processedLineWps.push({ latlng: startOvershoot, options: { altitude: flightAltitude, cameraAction: 'none', headingControl: 'fixed', fixedHeading: Math.round(lineBear) }});
                
                // Aggiungi i punti interni per le foto
                actualGeoPtsOnLine.forEach(internalPt => {
                     processedLineWps.push({ latlng: internalPt, options: { altitude: flightAltitude, cameraAction: 'takePhoto', headingControl: 'fixed', fixedHeading: Math.round(lineBear) }});
                });

                const endOvershoot = destinationPoint(lastInternal, lineBear, overshootDistance);
                if (startOvershoot.distanceTo(endOvershoot) > 1) { // Evita sovrapposizioni su linee cortissime
                    processedLineWps.push({ latlng: endOvershoot, options: { altitude: flightAltitude, cameraAction: 'none', headingControl: 'fixed', fixedHeading: Math.round(lineBear) }});
                }
                 // Semplice rimozione di duplicati basata su lat/lng esatti (potrebbe non essere perfetta per float)
                processedLineWps = processedLineWps.filter((wp, index, self) =>
                    index === self.findIndex(t => Math.abs(t.latlng.lat - wp.latlng.lat) < 1e-7 && Math.abs(t.latlng.lng - wp.latlng.lng) < 1e-7)
                );
            }
            finalWaypointsData.push(...processedLineWps);
        }
        currentRotLat += lineSpacingRotLat;
        if (lines > 2000) { console.error("Too many lines"); break; }
        scanDir *= -1;
    }
    console.log(`[SurveyGridGen] Total waypoints with overshoot: ${finalWaypointsData.length}`);
    if (finalWaypointsData.length === 0 && polygonLatLngs.length >= MIN_POLYGON_POINTS && lines > 0) {
        showCustomAlert("No waypoints generated. Check parameters.", "Grid Warning");
    }
    return finalWaypointsData;
}


function handleConfirmSurveyGridGeneration() {
    console.log("[SurveyGrid] handleConfirmSurveyGridGeneration called");
    if (currentPolygonPoints.length < MIN_POLYGON_POINTS) { showCustomAlert("Survey area not defined.", "Error"); return; }
    if (!surveyGridAltitudeInputEl /*...ecc...*/) { showCustomAlert("Missing input elements.", "Error"); return; }
    
    const altitude = parseInt(surveyGridAltitudeInputEl.value);
    const spacing = parseFloat(surveyGridSpacingInputEl.value);
    const angle = parseFloat(surveyGridAngleInputEl.value);
    const overshoot = parseFloat(surveyGridOvershootInputEl.value);

    if (isNaN(altitude) || altitude < 1) { showCustomAlert("Invalid altitude.", "Input Error"); return; }
    if (isNaN(spacing) || spacing <= 1e-3) { showCustomAlert("Invalid line spacing.", "Input Error"); return; }
    if (isNaN(angle)) { showCustomAlert("Invalid grid angle.", "Input Error"); return; }
    if (isNaN(overshoot) || overshoot < 0) { showCustomAlert("Invalid overshoot.", "Input Error"); return; }


    if (surveyGridInstructionsEl) surveyGridInstructionsEl.textContent = "Generating grid waypoints...";
    const surveyWaypoints = generateSurveyGridWaypoints(currentPolygonPoints, altitude, spacing, angle, overshoot);

    if (surveyWaypoints && surveyWaypoints.length > 0) {
       surveyWaypoints.forEach(wpData => addWaypoint(wpData.latlng, wpData.options));
       updateWaypointList(); updateFlightPath(); updateFlightStatistics(); fitMapToWaypoints();
       showCustomAlert(`${surveyWaypoints.length} survey waypoints generated!`, "Success");
    } else if (surveyWaypoints && surveyWaypoints.length === 0) {
        console.warn("generateSurveyGridWaypoints returned empty array.");
        // Alert già mostrato da generateSurveyGridWaypoints
    } else {
        showCustomAlert("Error during grid generation.", "Error");
    }
    handleCancelSurveyGrid();
}
