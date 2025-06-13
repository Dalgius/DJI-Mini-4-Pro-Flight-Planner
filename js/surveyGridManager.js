// ===================================================================================
// File: surveyGridManager.js
// Description: Manages the creation, editing, and deletion of survey grid missions.
// Version: 5.0 (Corrected ID renumbering logic for mission updates)
// ===================================================================================

// --- MODULE CONSTANTS ---
const CONSTANTS = {
    MIN_POLYGON_POINTS: 3,
    MAX_POLYGON_POINTS: 50,
    CAMERA: {
        sensorWidth_mm: 8.976,
        sensorHeight_mm: 6.716,
        focalLength_mm: 6.88
    },
    VALIDATION: {
        altitude: { min: 1, max: 500 },
        sidelap: { min: 10, max: 95 },
        frontlap: { min: 10, max: 95 },
        speed: { min: 0.1, max: 30 },
        angle: { min: -360, max: 360 }
    },
    COLORS: {
        DRAWING: '#0064ff',
        EDITING: '#f39c12',
        FINALIZED: '#009600',
        MISSION: '#1abc9c'
    }
};

// --- STATE MANAGEMENT ---
const surveyState = {
    isDrawingArea: false,
    isDrawingAngle: false,
    isEditingMissionId: null,
    polygonPoints: [],
    tempPolygonLayer: null,
    tempVertexMarkers: [],
    angleDrawStartPoint: null,
    tempAngleLineLayer: null
};


// ===================================================================================
//                        GEOMETRY & VALIDATION HELPERS
// ===================================================================================

function clearTemporaryDrawing() {
    if (surveyState.tempPolygonLayer) {
        map.removeLayer(surveyState.tempPolygonLayer);
        surveyState.tempPolygonLayer = null;
    }
    surveyState.tempVertexMarkers.forEach(marker => {
        marker.off();
        map.removeLayer(marker);
    });
    surveyState.tempVertexMarkers = [];
    if (surveyState.tempAngleLineLayer) { 
        map.removeLayer(surveyState.tempAngleLineLayer);
        surveyState.tempAngleLineLayer = null;
    }
}

function rotateLatLng(pointLatLng, centerLatLng, angleRadians) {
    const cosAngle = Math.cos(angleRadians);
    const sinAngle = Math.sin(angleRadians);
    const dLngScaled = (pointLatLng.lng - centerLatLng.lng) * Math.cos(toRad(centerLatLng.lat));
    const dLat = pointLatLng.lat - centerLatLng.lat;
    const rotatedDLngScaled = dLngScaled * cosAngle - dLat * sinAngle;
    const rotatedDLat = dLngScaled * sinAngle + dLat * cosAngle;
    const finalLng = centerLatLng.lng + (rotatedDLngScaled / Math.cos(toRad(centerLatLng.lat)));
    const finalLat = centerLatLng.lat + rotatedDLat;
    return L.latLng(finalLat, finalLng);
}

function isPointInPolygon(point, polygonVertices) {
    if (!point || !polygonVertices || polygonVertices.length < 3) return false;
    let isInside = false;
    const x = point.lng, y = point.lat;
    for (let i = 0, j = polygonVertices.length - 1; i < polygonVertices.length; j = i++) {
        const xi = polygonVertices[i].lng, yi = polygonVertices[i].lat;
        const xj = polygonVertices[j].lng, yj = polygonVertices[j].lat;
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
    }
    return isInside;
}

function calculateFootprint(altitudeAGL, cameraParams) {
    if (!cameraParams || !cameraParams.focalLength_mm || cameraParams.focalLength_mm === 0) return { width: 0, height: 0 };
    const footprintWidth = (cameraParams.sensorWidth_mm / cameraParams.focalLength_mm) * altitudeAGL;
    const footprintHeight = (cameraParams.sensorHeight_mm / cameraParams.focalLength_mm) * altitudeAGL;
    return { width: footprintWidth, height: footprintHeight };
}

function validateSurveyGridInputs(altitude, sidelap, frontlap, angle, speed) {
    const errors = [];
    if (isNaN(altitude) || altitude < CONSTANTS.VALIDATION.altitude.min || altitude > CONSTANTS.VALIDATION.altitude.max) errors.push(`Altitude: ${CONSTANTS.VALIDATION.altitude.min}-${CONSTANTS.VALIDATION.altitude.max}m`);
    if (isNaN(sidelap) || sidelap < CONSTANTS.VALIDATION.sidelap.min || sidelap > CONSTANTS.VALIDATION.sidelap.max) errors.push(`Sidelap: ${CONSTANTS.VALIDATION.sidelap.min}-${CONSTANTS.VALIDATION.sidelap.max}%`);
    if (isNaN(frontlap) || frontlap < CONSTANTS.VALIDATION.frontlap.min || frontlap > CONSTANTS.VALIDATION.frontlap.max) errors.push(`Frontlap: ${CONSTANTS.VALIDATION.frontlap.min}-${CONSTANTS.VALIDATION.frontlap.max}%`);
    if (isNaN(angle) || angle < CONSTANTS.VALIDATION.angle.min || angle > CONSTANTS.VALIDATION.angle.max) errors.push(`Angle: ${CONSTANTS.VALIDATION.angle.min}°-${CONSTANTS.VALIDATION.angle.max}°`);
    if (isNaN(speed) || speed < CONSTANTS.VALIDATION.speed.min || speed > CONSTANTS.VALIDATION.speed.max) errors.push(`Speed: ${CONSTANTS.VALIDATION.speed.min}-${CONSTANTS.VALIDATION.speed.max}m/s`);
    return errors;
}

function calculatePolygonArea(polygonLatLngs) {
    if (!polygonLatLngs || polygonLatLngs.length < 3) return 0;
    const earthRadius = (typeof R_EARTH !== 'undefined') ? R_EARTH : 6371000;
    let area = 0;
    for (let i = 0; i < polygonLatLngs.length; i++) {
        const j = (i + 1) % polygonLatLngs.length;
        const lat1 = toRad(polygonLatLngs[i].lat), lat2 = toRad(polygonLatLngs[j].lat);
        const deltaLng = toRad(polygonLatLngs[j].lng - polygonLatLngs[i].lng);
        area += deltaLng * (2 + Math.sin(lat1) + Math.sin(lat2));
    }
    return Math.abs(area * earthRadius * earthRadius / 2);
}

function toRad(degrees) { return degrees * (Math.PI / 180); }
function toDeg(radians) { return radians * (180 / Math.PI); }
function calculateBearing(from, to) {
    const lat1 = toRad(from.lat), lat2 = toRad(to.lat), deltaLng = toRad(to.lng - from.lng);
    const y = Math.sin(deltaLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
}


// ===================================================================================
//                                CORE LOGIC & GENERATION
// ===================================================================================

function generateSurveyGridWaypoints(polygonLatLngs, params) {
    const { altitude, sidelap, frontlap, angle, speed } = params;
    const finalWaypointsData = [];
    if (!polygonLatLngs || polygonLatLngs.length < CONSTANTS.MIN_POLYGON_POINTS) return finalWaypointsData;
    const footprint = calculateFootprint(altitude, CONSTANTS.CAMERA);
    if (footprint.width === 0 || footprint.height === 0) return finalWaypointsData;

    const fixedGridHeading = angle;
    const rotationAngleDeg = -(fixedGridHeading + 90) % 360;
    const actualLineSpacing = footprint.width * (1 - sidelap / 100);
    const actualDistanceBetweenPhotos = footprint.height * (1 - frontlap / 100);
    const rotationCenter = polygonLatLngs[0];
    const angleRad = toRad(rotationAngleDeg);
    const rotatedPolygonLatLngs = polygonLatLngs.map(p => rotateLatLng(p, rotationCenter, -angleRad));
    const rotatedBounds = L.latLngBounds(rotatedPolygonLatLngs);
    const rNE = rotatedBounds.getNorthEast(), rSW = rotatedBounds.getSouthWest();
    const lineSpacingRotLat = (actualLineSpacing / R_EARTH) * (180 / Math.PI);
    let currentRotLat = rSW.lat, scanDir = 1;

    while (currentRotLat <= rNE.lat + lineSpacingRotLat * 0.5) {
        const photoSpacingRotLng = (actualDistanceBetweenPhotos / (R_EARTH * Math.cos(toRad(currentRotLat)))) * (180 / Math.PI);
        const lineCandRot = [];
        
        if (scanDir === 1) {
            for (let lng = rSW.lng; lng <= rNE.lng; lng += photoSpacingRotLng) lineCandRot.push(L.latLng(currentRotLat, lng));
            if (lineCandRot.length === 0 || lineCandRot[lineCandRot.length - 1].lng < rNE.lng - 1e-7) lineCandRot.push(L.latLng(currentRotLat, rNE.lng));
        } else {
            for (let lng = rNE.lng; lng >= rSW.lng; lng -= photoSpacingRotLng) lineCandRot.push(L.latLng(currentRotLat, lng));
            if (lineCandRot.length === 0 || lineCandRot[lineCandRot.length - 1].lng > rSW.lng + 1e-7) lineCandRot.push(L.latLng(currentRotLat, rSW.lng));
        }
        
        const wpOptions = { 
            altitude: altitude, 
            cameraAction: 'takePhoto', 
            headingControl: 'fixed', 
            fixedHeading: Math.round(fixedGridHeading),
            gimbalPitch: -90, 
            waypointType: 'grid', 
            speed: speed 
        };

        lineCandRot.forEach(rotPt => {
            const actualGeoPt = rotateLatLng(rotPt, rotationCenter, angleRad);
            if (isPointInPolygon(actualGeoPt, polygonLatLngs)) {
                finalWaypointsData.push({ latlng: actualGeoPt, options: wpOptions });
            }
        });
        currentRotLat += lineSpacingRotLat;
        scanDir *= -1;
    }
    
    const uniqueWaypoints = [], seenKeys = new Set();
    for (const wp of finalWaypointsData) {
        const key = `${wp.latlng.lat.toFixed(7)},${wp.latlng.lng.toFixed(7)}`;
        if (!seenKeys.has(key)) {
            uniqueWaypoints.push(wp);
            seenKeys.add(key);
        }
    }
    return uniqueWaypoints;
}

/**
 * --- INIZIO MODIFICA: LOGICA DI SOSTITUZIONE WAYPOINT MIGLIORATA ---
 * Deletes old waypoints of a mission and inserts new ones at the correct position,
 * then renumbers all subsequent waypoints.
 * @private
 */
function _updateMissionWaypoints(mission, newWaypointsData) {
    // 1. Find the insertion index. It's the index of the first waypoint of the mission.
    // If it's a new mission, it will be at the end.
    let insertionIndex = waypoints.findIndex(wp => wp.id === mission.waypointIds[0]);
    if (insertionIndex === -1) {
        insertionIndex = waypoints.length;
    }

    // 2. Remove old waypoints of this mission from the global array and map.
    if (mission.waypointIds.length > 0) {
        const oldWpIds = new Set(mission.waypointIds);
        waypoints = waypoints.filter(wp => {
            if (oldWpIds.has(wp.id)) {
                if (wp.marker) map.removeLayer(wp.marker);
                return false;
            }
            return true;
        });
    }

    // 3. Prepare the new waypoints for insertion.
    const newWps = newWaypointsData.map(wpData => ({
        // We create a temporary object without an ID for now
        latlng: wpData.latlng,
        ...wpData.options
    }));

    // 4. Insert the new waypoints into the main array at the correct position.
    waypoints.splice(insertionIndex, 0, ...newWps);

    // 5. Renumber ALL waypoints from the beginning to ensure sequence is correct.
    // Also, update the mission's waypoint ID list.
    mission.waypointIds = [];
    waypoints.forEach((wp, index) => {
        const newId = index + 1;
        wp.id = newId;

        // If the waypoint belongs to the mission we are updating, add its new ID to the list
        if (index >= insertionIndex && index < insertionIndex + newWps.length) {
            mission.waypointIds.push(newId);
        }

        // Recreate or update marker (important for ID change)
        if (wp.marker) {
            map.removeLayer(wp.marker);
        }
        // This part needs the addWaypoint's marker creation logic, simplified here
        const isHomeForIcon = index === 0;
        const marker = L.marker(wp.latlng, {
            draggable: true,
            icon: createWaypointIcon(wp, false, false, isHomeForIcon)
        }).addTo(map);
        // Re-bind events (simplified for brevity)
        marker.on('click', () => selectWaypoint(wp));
        wp.marker = marker;
    });

    // 6. Recalculate the global counter to be ready for the next manually added waypoint.
    if (typeof _recalculateGlobalWaypointCounter === 'function') {
        _recalculateGlobalWaypointCounter();
    }
}

function _createNewMission(params) {
    const mission = {
        id: surveyMissionCounter++,
        polygon: surveyState.polygonPoints.map(p => ({ lat: p.lat, lng: p.lng })),
        parameters: params,
        waypointIds: [], // Sarà popolato da _updateMissionWaypoints
        polygonLayer: L.polygon(surveyState.polygonPoints, { color: CONSTANTS.COLORS.MISSION, weight: 2, fillOpacity: 0.1 }).addTo(map)
    };
    surveyMissions.push(mission);
    return mission;
}
// --- FINE MODIFICA ---


// ===================================================================================
//                                UI & EVENT HANDLERS
// ===================================================================================

function openSurveyGridModal(missionId = null) {
    if (!surveyGridModalOverlayEl) return;
    
    _resetAndExitDrawingMode();
    surveyState.isEditingMissionId = missionId;

    if (surveyState.isEditingMissionId !== null) {
        const mission = surveyMissions.find(m => m.id === surveyState.isEditingMissionId);
        if (!mission) {
            surveyState.isEditingMissionId = null;
            return;
        }
        surveyGridModalTitleEl.textContent = `${translate('editMissionBtn')} ${translate('missionLabel')} ${mission.id}`;
        surveyGridAltitudeInputEl.value = mission.parameters.altitude;
        surveySidelapInputEl.value = mission.parameters.sidelap;
        surveyFrontlapInputEl.value = mission.parameters.frontlap;
        surveyGridAngleInputEl.value = mission.parameters.angle;
        surveyState.polygonPoints = mission.polygon.map(p => L.latLng(p.lat, p.lng));
        startDrawingSurveyAreaBtnEl.style.display = 'none';
        confirmSurveyGridBtnEl.textContent = translate('updateGridBtn');
        confirmSurveyGridBtnEl.disabled = false;
        _drawTempPolygon(true);
    } else {
        surveyGridModalTitleEl.textContent = translate('surveyGridModalTitle');
        surveyGridAltitudeInputEl.value = defaultAltitudeSlider.value;
        surveySidelapInputEl.value = 70;
        surveyFrontlapInputEl.value = 80;
        surveyGridAngleInputEl.value = 0;
        startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
        confirmSurveyGridBtnEl.textContent = translate('generateGridBtn');
        confirmSurveyGridBtnEl.disabled = true;
    }
    
    finalizeSurveyAreaBtnEl.style.display = 'none';
    surveyGridModalOverlayEl.style.display = 'flex';
}

function handleConfirmSurveyGridGeneration() {
    const params = {
        altitude: parseInt(surveyGridAltitudeInputEl.value),
        sidelap: parseFloat(surveySidelapInputEl.value),
        frontlap: parseFloat(surveyFrontlapInputEl.value),
        angle: parseFloat(surveyGridAngleInputEl.value) || 0,
        speed: parseFloat(flightSpeedSlider.value)
    };

    const validationErrors = validateSurveyGridInputs(params.altitude, params.sidelap, params.frontlap, params.angle, params.speed);
    if (validationErrors.length > 0) return showCustomAlert(validationErrors.join('\n'), translate('inputErrorTitle'));
    if (!surveyState.polygonPoints || surveyState.polygonPoints.length < CONSTANTS.MIN_POLYGON_POINTS) return showCustomAlert('Please define a survey area first.', translate('inputErrorTitle'));

    const waypointsData = generateSurveyGridWaypoints(surveyState.polygonPoints, params);

    if (waypointsData.length > 0) {
        let mission;
        if (surveyState.isEditingMissionId !== null) {
            mission = surveyMissions.find(m => m.id === surveyState.isEditingMissionId);
            if (!mission) return;
            mission.parameters = params;
        } else {
            mission = _createNewMission(params);
        }
        _updateMissionWaypoints(mission, waypointsData);
        showCustomAlert(translate('alert_surveyGridSuccess', { count: mission.waypointIds.length }), translate('successTitle'));
    } else {
        showCustomAlert('No waypoints could be generated for this configuration.', 'Warning');
    }
    
    updateAllUI();
    _resetAndExitDrawingMode();
    surveyGridModalOverlayEl.style.display = 'none';
}

function deleteSurveyMission(missionId) {
    const missionIndex = surveyMissions.findIndex(m => m.id === missionId);
    if (missionIndex === -1) return;

    const mission = surveyMissions[missionIndex];
    const confirmMsg = translate('alert_deleteSurveyMissionConfirm', {
        missionName: `${translate('missionLabel')} ${mission.id}`,
        wpCount: mission.waypointIds.length
    });

    if (confirm(confirmMsg)) {
        _updateMissionWaypoints(mission, []); 
        surveyMissions.splice(missionIndex, 1);
        if (mission.polygonLayer) map.removeLayer(mission.polygonLayer);
        updateAllUI();
    }
}


// ===================================================================================
//                                  DRAWING HANDLERS
// ===================================================================================

function handleStartDrawingSurveyArea() {
    _resetAndExitDrawingMode();
    surveyState.isDrawingArea = true;
    _enterDrawingMode();
    surveyGridModalOverlayEl.style.display = 'none';
    showCustomAlert(translate('alert_surveyDrawingActive', { minPoints: CONSTANTS.MIN_POLYGON_POINTS }), translate('infoTitle'));
}

function handleDrawGridAngle() {
    if (!surveyState.polygonPoints || surveyState.polygonPoints.length < CONSTANTS.MIN_POLYGON_POINTS) {
        return showCustomAlert('Please define a survey area first.', 'Error');
    }
    surveyState.isDrawingAngle = true;
    _enterDrawingMode('angle');
    surveyGridModalOverlayEl.style.display = 'none';
    showCustomAlert(translate('infoTitle'), translate('alert_drawAngleInstruction'));
}

function onMapClick(e) {
    if (!surveyState.isDrawingArea) return;
    if (surveyState.polygonPoints.length >= CONSTANTS.MIN_POLYGON_POINTS && surveyState.tempVertexMarkers.length > 0) {
        if (surveyState.tempVertexMarkers[0].getLatLng().distanceTo(e.latlng) < 10 * map.getZoomScale(map.getZoom(), 18)) {
            return handleFinalizeSurveyArea();
        }
    }
    if (surveyState.polygonPoints.length >= CONSTANTS.MAX_POLYGON_POINTS) {
        return showCustomAlert(`Maximum ${CONSTANTS.MAX_POLYGON_POINTS} points allowed.`, 'Warning');
    }
    surveyState.polygonPoints.push(e.latlng);
    const vertexMarker = L.circleMarker(e.latlng, { radius: 6, color: 'red', pane: 'markerPane' }).addTo(map);
    if (surveyState.polygonPoints.length === 1) {
        vertexMarker.on("click", (ev) => {
            ev.originalEvent.stopPropagation();
            if (surveyState.isDrawingArea && surveyState.polygonPoints.length >= CONSTANTS.MIN_POLYGON_POINTS) handleFinalizeSurveyArea();
        });
    }
    surveyState.tempVertexMarkers.push(vertexMarker);
    _drawTempPolygon();
}

function onAngleDrawStart(e) {
    if (!surveyState.isDrawingAngle) return;
    e.originalEvent.preventDefault();
    e.originalEvent.stopPropagation();
    surveyState.angleDrawStartPoint = e.latlng;
    map.on("mousemove", onAngleDrawMove).on("mouseup", onAngleDrawEnd);
}

function onAngleDrawMove(e) {
    if (!surveyState.isDrawingAngle || !surveyState.angleDrawStartPoint) return;
    if (surveyState.tempAngleLineLayer) map.removeLayer(surveyState.tempAngleLineLayer);
    surveyState.tempAngleLineLayer = L.polyline([surveyState.angleDrawStartPoint, e.latlng], { color: CONSTANTS.COLORS.EDITING, weight: 3, dashArray: '5, 10' }).addTo(map);
}

function onAngleDrawEnd(e) {
    if (!surveyState.isDrawingAngle) return;
    const bearing = calculateBearing(surveyState.angleDrawStartPoint, e.latlng);
    surveyGridAngleInputEl.value = Math.round(bearing > 180 ? bearing - 360 : bearing);
    _exitMapDrawingState();
    if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'flex';
    showCustomAlert(`Grid angle set to ${surveyGridAngleInputEl.value}°`, 'Success');
}

function handleFinalizeSurveyArea() {
    if (!surveyState.isDrawingArea || surveyState.polygonPoints.length < CONSTANTS.MIN_POLYGON_POINTS) return;
    _exitMapDrawingState();
    surveyGridModalOverlayEl.style.display = 'flex';
    finalizeSurveyAreaBtnEl.style.display = 'none';
    confirmSurveyGridBtnEl.disabled = false;
    _drawTempPolygon(false, true);
    surveyGridInstructionsEl.innerHTML = translate('surveyGridInstructionsFinalized');
    showCustomAlert(`Survey area defined.`, 'Success');
}

function handleCancelSurveyGrid() {
    _resetAndExitDrawingMode();
    if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'none';
}


// ===================================================================================
//                                UTILITY & PRIVATE HELPERS
// ===================================================================================

function updateAllUI() {
    updateWaypointList();
    updateFlightPath();
    updateFlightStatistics();
    if (typeof updateSurveyMissionsList === 'function') updateSurveyMissionsList();
    fitMapToWaypoints();
}

function _enterDrawingMode(mode = 'area') {
    map.dragging.disable();
    if (typeof handleMapClick === 'function') map.off('click', handleMapClick);
    map.getContainer().style.cursor = 'crosshair';
    if (mode === 'area') {
        map.on('click', onMapClick);
    } else if (mode === 'angle') {
        map.on('mousedown', onAngleDrawStart);
    }
}

function _exitMapDrawingState() {
    map.dragging.enable();
    map.getContainer().style.cursor = '';
    map.off('click', onMapClick);
    map.off('mousedown', onAngleDrawStart);
    map.off('mousemove', onAngleDrawMove);
    map.off('mouseup', onAngleDrawEnd);
    if (typeof handleMapClick === 'function' && !map.hasEventListeners('click')) {
        map.on('click', handleMapClick);
    }
    surveyState.isDrawingArea = false;
    surveyState.isDrawingAngle = false;
    surveyState.angleDrawStartPoint = null;
    if (surveyState.tempAngleLineLayer) map.removeLayer(surveyState.tempAngleLineLayer);
}

function _resetAndExitDrawingMode() {
    _exitMapDrawingState();
    clearTemporaryDrawing();
    surveyState.polygonPoints = [];
    surveyState.isEditingMissionId = null;
}

function _drawTempPolygon(isEdit = false, isFinalized = false) {
    if (surveyState.tempPolygonLayer) map.removeLayer(surveyState.tempPolygonLayer);
    if (surveyState.polygonPoints.length < 2) return;
    const color = isFinalized ? CONSTANTS.COLORS.FINALIZED : (isEdit ? CONSTANTS.COLORS.EDITING : CONSTANTS.COLORS.DRAWING);
    const opts = { color, weight: 2, fillColor: color, fillOpacity: 0.2 };
    surveyState.tempPolygonLayer = (surveyState.polygonPoints.length < 3)
        ? L.polyline(surveyState.polygonPoints, opts).addTo(map)
        : L.polygon(surveyState.polygonPoints, opts).addTo(map);
}
