// File: surveyGridManager.js
// Logica overshoot rimossa.

let currentPolygonPoints = [];
let tempPolygonLayer = null;
let tempVertexMarkers = [];
let nativeMapClickListener = null;

const MIN_POLYGON_POINTS = 3;

const FIXED_CAMERA_PARAMS = {
    sensorWidth_mm: 8.976,
    sensorHeight_mm: 6.716,
    focalLength_mm: 6.88
};

// === FUNZIONI HELPER (invariate) ===
function clearTemporaryDrawing() {
    if (tempPolygonLayer) { map.removeLayer(tempPolygonLayer); tempPolygonLayer = null; }
    tempVertexMarkers.forEach(marker => map.removeLayer(marker)); tempVertexMarkers = [];
}
function updateTempPolygonDisplay() {
    clearTemporaryDrawing();
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
function calculateFootprint(altitudeAGL, cameraParams) {
    if (!cameraParams || !cameraParams.focalLength_mm || cameraParams.focalLength_mm === 0) { return { width: 0, height: 0 }; }
    const footprintWidth = (cameraParams.sensorWidth_mm / cameraParams.focalLength_mm) * altitudeAGL;
    const footprintHeight = (cameraParams.sensorHeight_mm / cameraParams.focalLength_mm) * altitudeAGL;
    return { width: footprintWidth, height: footprintHeight };
}

// === GESTORI UI PRINCIPALI (aggiornati per i18n) ===
function openSurveyGridModal() {
    if (!surveyGridModalOverlayEl) {
        showCustomAlert(translate('errorTitle'), "Survey grid modal elements not found."); return;
    }
    surveyGridAltitudeInputEl.value = defaultAltitudeSlider.value;
    if (!surveySidelapInputEl.value) surveySidelapInputEl.value = 70;
    if (!surveyFrontlapInputEl.value) surveyFrontlapInputEl.value = 80;
    if (surveyGridAngleInputEl && !surveyGridAngleInputEl.value) surveyGridAngleInputEl.value = 0;

    cancelSurveyAreaDrawing();
    confirmSurveyGridBtnEl.disabled = true;
    finalizeSurveyAreaBtnEl.style.display = 'none';
    startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
    
    surveyAreaStatusEl.innerHTML = translate('surveyAreaStatusDefault');
    surveyGridInstructionsEl.innerHTML = translate('surveyGridInstructions');
    surveyGridModalOverlayEl.style.display = 'flex';
}

function cancelSurveyAreaDrawing() {
    const wasActive = isDrawingSurveyArea || nativeMapClickListener;
    isDrawingSurveyArea = false;
    if (map) {
        const mapContainer = map.getContainer();
        if (mapContainer && nativeMapClickListener) {
            mapContainer.removeEventListener('click', nativeMapClickListener, true);
            nativeMapClickListener = null;
        }
        map.off('click', handleSurveyAreaMapClick);
        map.getContainer().style.cursor = '';
        if ((wasActive || !map.hasEventListeners('click', handleMapClick)) && typeof handleMapClick === 'function') {
            map.on('click', handleMapClick);
        }
    }
    clearTemporaryDrawing();
    currentPolygonPoints = [];
    if (startDrawingSurveyAreaBtnEl) startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
    if (finalizeSurveyAreaBtnEl) finalizeSurveyAreaBtnEl.style.display = 'none';
    if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = true;
    if (surveyAreaStatusEl) surveyAreaStatusEl.innerHTML = translate('surveyAreaStatusDefault');
    if (surveyGridInstructionsEl) surveyGridInstructionsEl.innerHTML = translate('surveyGridInstructions');
}

function handleStartDrawingSurveyArea() {
    if (!map || !surveyGridModalOverlayEl) { return; }
    isDrawingSurveyArea = true; currentPolygonPoints = []; clearTemporaryDrawing();

    if (typeof handleMapClick === 'function') map.off('click', handleMapClick);
    map.off('click', handleSurveyAreaMapClick);

    const mapContainer = map.getContainer();
    if (mapContainer) {
        if (nativeMapClickListener) mapContainer.removeEventListener('click', nativeMapClickListener, true);
        nativeMapClickListener = function(event) {
            if (!isDrawingSurveyArea) return;
            if (event.target && (event.target === mapContainer || event.target.closest('.leaflet-pane') || event.target.closest('.leaflet-container'))) {
                try {
                    const latlng = map.mouseEventToLatLng(event);
                    handleSurveyAreaMapClick({ latlng: latlng, originalEvent: event });
                } catch (mapError) { console.error("Native click error:", mapError); }
            }
        };
        mapContainer.addEventListener('click', nativeMapClickListener, true);
    }
    map.getContainer().style.cursor = 'crosshair';
    surveyGridModalOverlayEl.style.display = 'none';
    showCustomAlert(translate('alert_surveyDrawingActive', {minPoints: MIN_POLYGON_POINTS}), translate('infoTitle'));
}

function handleSurveyAreaMapClick(e) {
    if (!isDrawingSurveyArea) return;
    const clickedLatLng = e.latlng;
    currentPolygonPoints.push(clickedLatLng);

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
}

function handleFinalizeSurveyArea() {
    if (!isDrawingSurveyArea) return;
    if (currentPolygonPoints.length < MIN_POLYGON_POINTS) {
        showCustomAlert(translate('alert_surveyAreaMinPoints', { minPoints: MIN_POLYGON_POINTS }), translate('infoTitle'));
        return;
    }
    const mapContainer = map.getContainer();
    if (mapContainer && nativeMapClickListener) {
        mapContainer.removeEventListener('click', nativeMapClickListener, true);
        nativeMapClickListener = null;
    }
    map.getContainer().style.cursor = '';
    if (surveyGridModalOverlayEl) {
        surveyGridModalOverlayEl.style.display = 'flex';
    }
    if (finalizeSurveyAreaBtnEl) finalizeSurveyAreaBtnEl.style.display = 'none';
    if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = false;
    if (surveyAreaStatusEl) surveyAreaStatusEl.innerHTML = translate('surveyAreaStatusDefined', { points: currentPolygonPoints.length });
    if (surveyGridInstructionsEl) surveyGridInstructionsEl.innerHTML = translate('surveyGridInstructionsFinalized');
    if (tempPolygonLayer) tempPolygonLayer.setStyle({ color: 'rgba(0, 50, 200, 0.9)', fillColor: 'rgba(0, 50, 200, 0.4)' });
    tempVertexMarkers.forEach(marker => marker.off('click'));
}

function handleCancelSurveyGrid() {
    cancelSurveyAreaDrawing();
    if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'none';
}

function generateSurveyGridWaypoints(polygonLatLngs, flightAltitudeAGL, sidelapPercent, frontlapPercent, gridAngleDeg, flightSpeed) {
    const finalWaypointsData = [];
    if (!polygonLatLngs || polygonLatLngs.length < MIN_POLYGON_POINTS) {
        showCustomAlert(translate('alert_surveyGridInvalidPoly'), translate('errorTitle'));
        return finalWaypointsData;
    }

    const footprint = calculateFootprint(flightAltitudeAGL, FIXED_CAMERA_PARAMS);
    if (footprint.width <= 0 || footprint.height <= 0) {
        showCustomAlert(translate('alert_surveyGridInvalidParams'), translate('errorTitle'));
        return finalWaypointsData;
    }
    const actualLineSpacing = footprint.width * (1 - sidelapPercent / 100);
    const actualDistanceBetweenPhotos = footprint.height * (1 - frontlapPercent / 100);
    if (actualLineSpacing <= 0.1 || actualDistanceBetweenPhotos <= 0.1) {
        showCustomAlert(translate('alert_surveyGridInvalidParams'), translate('errorTitle'));
        return finalWaypointsData;
    }
    
    const requiredPhotoInterval_s = actualDistanceBetweenPhotos / flightSpeed;
    if (requiredPhotoInterval_s < 1.8 && flightSpeed > 0) {
        // Avviso non bloccante, gestito altrove o loggato
    }

    const rotationCenter = polygonLatLngs[0];
    const angleRad = toRad(gridAngleDeg);
    const rotatedPolygonLatLngs = polygonLatLngs.map(p => rotateLatLng(p, rotationCenter, -angleRad));
    const rotatedBounds = L.latLngBounds(rotatedPolygonLatLngs);
    const rNE = rotatedBounds.getNorthEast(); const rSW = rotatedBounds.getSouthWest();
    if (rSW.lat >= rNE.lat - 1e-7 || rSW.lng >= rNE.lng - 1e-7) {
        showCustomAlert(translate('alert_surveyGridInvalidPoly'), translate('errorTitle'));
        return finalWaypointsData;
    }

    const earthR = (typeof R_EARTH !== 'undefined') ? R_EARTH : 6371000;
    const lineSpacingRotLat = (actualLineSpacing / earthR) * (180 / Math.PI);
    const photoSpacingRotLng = (actualDistanceBetweenPhotos / (earthR * Math.cos(toRad(rotationCenter.lat)))) * (180 / Math.PI);
    if (lineSpacingRotLat <= 1e-9 || photoSpacingRotLng <= 1e-9) {
        showCustomAlert(translate('alert_surveyGridInvalidParams'), translate('errorTitle'));
        return finalWaypointsData;
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

        let intendedLineBearing = (gridAngleDeg + (scanDir === 1 ? 0 : 180)) % 360;
        const wpOptions = { altitude: flightAltitudeAGL, cameraAction: 'takePhoto', headingControl: 'fixed', fixedHeading: Math.round(intendedLineBearing) };

        lineCandRot.forEach(rotPt => {
            const actualGeoPt = rotateLatLng(rotPt, rotationCenter, angleRad);
            if (isPointInPolygon(actualGeoPt, polygonLatLngs)) {
                finalWaypointsData.push({ latlng: actualGeoPt, options: wpOptions });
            }
        });
        
        currentRotLat += lineSpacingRotLat;
        if (lines > 2000) {
            showCustomAlert(translate('alert_surveyGridTooManyLines'), translate('errorTitle'));
            break;
        }
        scanDir *= -1;
    }
    
    const uniqueWaypoints = [];
    const seenKeys = new Set();
    for (const wp of finalWaypointsData) {
        const key = `${wp.latlng.lat.toFixed(7)},${wp.latlng.lng.toFixed(7)}`;
        if (!seenKeys.has(key)) {
            uniqueWaypoints.push(wp);
            seenKeys.add(key);
        }
    }
    
    if (uniqueWaypoints.length === 0 && polygonLatLngs.length >= MIN_POLYGON_POINTS && lines > 0) {
        showCustomAlert(translate('alert_surveyGridNoWps'), translate('infoTitle'));
    }
    return uniqueWaypoints;
}


function handleConfirmSurveyGridGeneration() {
    if (currentPolygonPoints.length < MIN_POLYGON_POINTS) { showCustomAlert(translate('alert_surveyGridInvalidPoly'), "Error"); return; }
    
    const altitude = parseInt(surveyGridAltitudeInputEl.value);
    const sidelap = parseFloat(surveySidelapInputEl.value);
    const frontlap = parseFloat(surveyFrontlapInputEl.value);
    const angle = parseFloat(surveyGridAngleInputEl.value);
    const speed = parseFloat(flightSpeedSlider.value);

    if (isNaN(altitude) || altitude < 1) { showCustomAlert(translate('alert_surveyGridInvalidInput_altitude'), translate('inputErrorTitle')); return; }
    if (isNaN(sidelap) || sidelap < 10 || sidelap > 95) { showCustomAlert(translate('alert_surveyGridInvalidInput_sidelap'), translate('inputErrorTitle')); return; }
    if (isNaN(frontlap) || frontlap < 10 || frontlap > 95) { showCustomAlert(translate('alert_surveyGridInvalidInput_frontlap'), translate('inputErrorTitle')); return; }
    if (isNaN(angle)) { showCustomAlert(translate('alert_surveyGridInvalidInput_angle'), translate('inputErrorTitle')); return; }
    if (isNaN(speed) || speed <= 0) {showCustomAlert(translate('alert_surveyGridInvalidInput_speed'), translate('inputErrorTitle')); return; }

    if (surveyGridInstructionsEl) surveyGridInstructionsEl.textContent = "Generating grid waypoints...";
    
    const surveyWaypoints = generateSurveyGridWaypoints(currentPolygonPoints, altitude, sidelap, frontlap, angle, speed);

    if (surveyWaypoints && surveyWaypoints.length > 0) {
       surveyWaypoints.forEach(wpData => addWaypoint(wpData.latlng, wpData.options));
       updateWaypointList(); updateFlightPath(); updateFlightStatistics(); fitMapToWaypoints();
       showCustomAlert(translate('alert_surveyGridSuccess', { count: surveyWaypoints.length }), translate('successTitle'));
    } else if (surveyWaypoints && surveyWaypoints.length === 0 ) {
        // L'avviso viene già mostrato da generateSurveyGridWaypoints
    } else if (!surveyWaypoints) {
        showCustomAlert(translate('alert_surveyGridError'), translate('errorTitle'));
    }
    handleCancelSurveyGrid();
}
