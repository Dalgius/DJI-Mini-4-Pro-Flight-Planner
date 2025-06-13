// File: surveyGridManager.js - Enhanced Version with Mission Management

let currentPolygonPoints = [];
let tempPolygonLayer = null;
let tempVertexMarkers = [];
let nativeMapClickListener = null;

let angleDrawStartPoint = null;
let tempAngleLineLayer = null;

let isEditingMissionId = null; // <-- NUOVO: ID della missione in modifica

const MIN_POLYGON_POINTS = 3;
const MAX_POLYGON_POINTS = 50;

const FIXED_CAMERA_PARAMS = {
    sensorWidth_mm: 8.976,
    sensorHeight_mm: 6.716,
    focalLength_mm: 6.88
};

const VALIDATION_LIMITS = {
    altitude: { min: 1, max: 500 },
    sidelap: { min: 10, max: 95 },
    frontlap: { min: 10, max: 95 },
    speed: { min: 0.1, max: 30 },
    angle: { min: -360, max: 360 }
};

// === HELPER FUNCTIONS ===
function clearTemporaryDrawing() {
    if (tempPolygonLayer) {
        map.removeLayer(tempPolygonLayer);
        tempPolygonLayer = null;
    }
    tempVertexMarkers.forEach(marker => {
        marker.off(); // Remove all event listeners
        map.removeLayer(marker);
    });
    tempVertexMarkers = [];
    if (tempAngleLineLayer) { 
        map.removeLayer(tempAngleLineLayer);
        tempAngleLineLayer = null;
    }
}

function updateTempPolygonDisplay() {
    if (tempPolygonLayer) map.removeLayer(tempPolygonLayer);
    if (currentPolygonPoints.length < 2) return;
    const opts = { color: 'rgba(0, 100, 255, 0.7)', weight: 2, fillColor: 'rgba(0, 100, 255, 0.2)', fillOpacity: 0.3 };
    if(isEditingMissionId !== null) opts.color = '#f39c12'; // Colore giallo per la modifica
    tempPolygonLayer = (currentPolygonPoints.length < 3) ? L.polyline(currentPolygonPoints, opts).addTo(map) : L.polygon(currentPolygonPoints, opts).addTo(map);
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
    if (isNaN(altitude) || altitude < VALIDATION_LIMITS.altitude.min || altitude > VALIDATION_LIMITS.altitude.max) errors.push(`Altitude: ${VALIDATION_LIMITS.altitude.min}-${VALIDATION_LIMITS.altitude.max}m`);
    if (isNaN(sidelap) || sidelap < VALIDATION_LIMITS.sidelap.min || sidelap > VALIDATION_LIMITS.sidelap.max) errors.push(`Sidelap: ${VALIDATION_LIMITS.sidelap.min}-${VALIDATION_LIMITS.sidelap.max}%`);
    if (isNaN(frontlap) || frontlap < VALIDATION_LIMITS.frontlap.min || frontlap > VALIDATION_LIMITS.frontlap.max) errors.push(`Frontlap: ${VALIDATION_LIMITS.frontlap.min}-${VALIDATION_LIMITS.frontlap.max}%`);
    if (isNaN(angle) || angle < VALIDATION_LIMITS.angle.min || angle > VALIDATION_LIMITS.angle.max) errors.push(`Angle: ${VALIDATION_LIMITS.angle.min}°-${VALIDATION_LIMITS.angle.max}°`);
    if (isNaN(speed) || speed < VALIDATION_LIMITS.speed.min || speed > VALIDATION_LIMITS.speed.max) errors.push(`Speed: ${VALIDATION_LIMITS.speed.min}-${VALIDATION_LIMITS.speed.max}m/s`);
    return errors;
}

function calculatePolygonArea(polygonLatLngs) {
    if (!polygonLatLngs || polygonLatLngs.length < 3) return 0;
    const earthRadius = 6371000;
    let area = 0;
    for (let i = 0; i < polygonLatLngs.length; i++) {
        const j = (i + 1) % polygonLatLngs.length;
        const lat1 = toRad(polygonLatLngs[i].lat), lat2 = toRad(polygonLatLngs[j].lat);
        const deltaLng = toRad(polygonLatLngs[j].lng - polygonLatLngs[i].lng);
        area += deltaLng * (2 + Math.sin(lat1) + Math.sin(lat2));
    }
    return Math.abs(area * earthRadius * earthRadius / 2);
}

// === MISSION MANAGEMENT ===

/**
 * Opens the survey grid modal, either for a new mission or to edit an existing one.
 * @param {number|null} missionId - The ID of the mission to edit, or null for a new mission.
 */
function openSurveyGridModal(missionId = null) {
    if (!surveyGridModalOverlayEl) return;
    
    isEditingMissionId = missionId;
    cancelSurveyAreaDrawing(true); // Soft cancel

    if (isEditingMissionId !== null) {
        const mission = surveyMissions.find(m => m.id === isEditingMissionId);
        if (!mission) {
            isEditingMissionId = null;
            return;
        }

        // Pre-fill modal with existing mission data
        surveyGridModalTitleEl.textContent = `${translate('editMissionBtn')} ${translate('missionLabel')} ${mission.id}`;
        surveyGridAltitudeInputEl.value = mission.parameters.altitude;
        surveySidelapInputEl.value = mission.parameters.sidelap;
        surveyFrontlapInputEl.value = mission.parameters.frontlap;
        surveyGridAngleInputEl.value = mission.parameters.angle;
        
        currentPolygonPoints = mission.polygon.map(p => L.latLng(p.lat, p.lng));
        
        // Disable drawing, show update button
        startDrawingSurveyAreaBtnEl.style.display = 'none';
        finalizeSurveyAreaBtnEl.style.display = 'none';
        confirmSurveyGridBtnEl.textContent = translate('updateGridBtn');
        confirmSurveyGridBtnEl.disabled = false;
        
        updateTempPolygonDisplay(); // Show existing polygon
    } else {
        // Setup for a new mission
        surveyGridModalTitleEl.textContent = translate('surveyGridModalTitle');
        surveyGridAltitudeInputEl.value = defaultAltitudeSlider.value;
        surveySidelapInputEl.value = 70;
        surveyFrontlapInputEl.value = 80;
        surveyGridAngleInputEl.value = 0;
        
        startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
        finalizeSurveyAreaBtnEl.style.display = 'none';
        confirmSurveyGridBtnEl.textContent = translate('generateGridBtn');
        confirmSurveyGridBtnEl.disabled = true;
    }
    
    surveyGridModalOverlayEl.style.display = 'flex';
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
        // Remove waypoints associated with the mission
        const wpIdsToDelete = new Set(mission.waypointIds);
        waypoints = waypoints.filter(wp => {
            if (wpIdsToDelete.has(wp.id)) {
                if (wp.marker) map.removeLayer(wp.marker);
                return false;
            }
            return true;
        });

        // Remove the mission itself
        surveyMissions.splice(missionIndex, 1);
        if (mission.polygonLayer) map.removeLayer(mission.polygonLayer);
        
        // Update UI
        updateAllUI();
    }
}

// === UI HANDLERS & DRAWING LOGIC ===
function cancelSurveyAreaDrawing(isSoft = false) {
    const wasActive = isDrawingSurveyArea || isDrawingGridAngle;
    isDrawingSurveyArea = false;
    isDrawingGridAngle = false;
    
    if (map) {
        map.dragging.enable();
        map.getContainer().style.cursor = '';
        map.off('click', handleSurveyAreaMapClick);
        map.off('mousedown', onAngleDrawStart);
        map.off('mousemove', onAngleDrawMove);
        map.off('mouseup', onAngleDrawEnd);
        if (wasActive && !map.hasEventListeners('click')) {
             if (typeof handleMapClick === 'function') map.on('click', handleMapClick);
        }
    }
    
    if (!isSoft) { // Don't clear points if we are just opening the edit modal
        clearTemporaryDrawing();
        currentPolygonPoints = [];
        angleDrawStartPoint = null;
        isEditingMissionId = null; 
    }
}

function handleConfirmSurveyGridGeneration() {
    // Collect parameters
    const altitude = parseInt(surveyGridAltitudeInputEl.value);
    const sidelap = parseFloat(surveySidelapInputEl.value);
    const frontlap = parseFloat(surveyFrontlapInputEl.value);
    const angle = parseFloat(surveyGridAngleInputEl.value) || 0;
    const speed = parseFloat(flightSpeedSlider.value);

    // Validate
    const validationErrors = validateSurveyGridInputs(altitude, sidelap, frontlap, angle, speed);
    if (validationErrors.length > 0) {
        showCustomAlert(validationErrors.join('\n'), translate('inputErrorTitle'));
        return;
    }
    if (!currentPolygonPoints || currentPolygonPoints.length < MIN_POLYGON_POINTS) {
        showCustomAlert('Please define a survey area first.', translate('inputErrorTitle'));
        return;
    }

    // Generate waypoints (this function is now just a calculator)
    const surveyWaypointsData = generateSurveyGridWaypoints(currentPolygonPoints, altitude, sidelap, frontlap, angle, speed);

    if (surveyWaypointsData && surveyWaypointsData.length > 0) {
        let mission;
        
        if (isEditingMissionId !== null) {
            // --- UPDATE EXISTING MISSION ---
            mission = surveyMissions.find(m => m.id === isEditingMissionId);
            if (!mission) return; // Should not happen
            
            // Delete old waypoints
            const oldWpIds = new Set(mission.waypointIds);
            waypoints = waypoints.filter(wp => {
                if (oldWpIds.has(wp.id)) {
                    if (wp.marker) map.removeLayer(wp.marker);
                    return false;
                }
                return true;
            });
            
            mission.waypointIds = [];
            mission.parameters = { altitude, sidelap, frontlap, angle };

        } else {
            // --- CREATE NEW MISSION ---
            mission = {
                id: surveyMissionCounter++,
                polygon: currentPolygonPoints.map(p => ({ lat: p.lat, lng: p.lng })),
                parameters: { altitude, sidelap, frontlap, angle },
                waypointIds: [],
                polygonLayer: L.polygon(currentPolygonPoints, { color: '#1abc9c', weight: 2, fillOpacity: 0.1 }).addTo(map)
            };
            surveyMissions.push(mission);
        }
        
        // Add new waypoints
        surveyWaypointsData.forEach(wpData => {
            addWaypoint(wpData.latlng, wpData.options);
            const newWpId = waypointCounter - 1; // Get the ID of the last added waypoint
            mission.waypointIds.push(newWpId);
        });

        const alertTitle = isEditingMissionId !== null ? translate('successTitle') : translate('alert_missionUpdated', { missionName: `${translate('missionLabel')} ${mission.id}` });
        showCustomAlert(translate('alert_surveyGridSuccess', { count: mission.waypointIds.length }), alertTitle);
        
    } else {
        showCustomAlert('No waypoints could be generated for this configuration.', 'Warning');
    }
    
    updateAllUI();
    handleCancelSurveyGrid(); // Clean up drawing state
    surveyGridModalOverlayEl.style.display = 'none'; // Close modal
}

function updateAllUI() {
    updateWaypointList();
    updateFlightPath();
    updateFlightStatistics();
    if(typeof updateSurveyMissionsList === 'function') updateSurveyMissionsList();
    fitMapToWaypoints();
}

function generateSurveyGridWaypoints(polygonLatLngs, flightAltitudeAGL, sidelapPercent, frontlapPercent, gridAngleDeg, flightSpeed) {
    const finalWaypointsData = [];
    if (!polygonLatLngs || polygonLatLngs.length < MIN_POLYGON_POINTS) return finalWaypointsData;
    const footprint = calculateFootprint(flightAltitudeAGL, FIXED_CAMERA_PARAMS);
    if (footprint.width === 0 || footprint.height === 0) return finalWaypointsData;

    const fixedGridHeading = gridAngleDeg;
    const rotationAngleDeg = -(fixedGridHeading + 90) % 360;
    const actualLineSpacing = footprint.width * (1 - sidelapPercent / 100);
    const actualDistanceBetweenPhotos = footprint.height * (1 - frontlapPercent / 100);
    const rotationCenter = polygonLatLngs[0];
    const angleRad = toRad(rotationAngleDeg);
    const rotatedPolygonLatLngs = polygonLatLngs.map(p => rotateLatLng(p, rotationCenter, -angleRad));
    const rotatedBounds = L.latLngBounds(rotatedPolygonLatLngs);
    const rNE = rotatedBounds.getNorthEast(), rSW = rotatedBounds.getSouthWest();
    const earthR = 6371000;
    const lineSpacingRotLat = (actualLineSpacing / earthR) * (180 / Math.PI);
    let currentRotLat = rSW.lat, scanDir = 1;

    while (currentRotLat <= rNE.lat + lineSpacingRotLat * 0.5) {
        const photoSpacingRotLng = (actualDistanceBetweenPhotos / (earthR * Math.cos(toRad(currentRotLat)))) * (180 / Math.PI);
        const lineCandRot = [];
        
        if (scanDir === 1) {
            for (let lng = rSW.lng; lng <= rNE.lng; lng += photoSpacingRotLng) lineCandRot.push(L.latLng(currentRotLat, lng));
            if (lineCandRot.length === 0 || lineCandRot[lineCandRot.length - 1].lng < rNE.lng - 1e-7) lineCandRot.push(L.latLng(currentRotLat, rNE.lng));
        } else {
            for (let lng = rNE.lng; lng >= rSW.lng; lng -= photoSpacingRotLng) lineCandRot.push(L.latLng(currentRotLat, lng));
            if (lineCandRot.length === 0 || lineCandRot[lineCandRot.length - 1].lng > rSW.lng + 1e-7) lineCandRot.push(L.latLng(currentRotLat, rSW.lng));
        }
        
        // Correct heading for serpentine path
        const currentLineHeading = (scanDir === 1) ? fixedGridHeading : (fixedGridHeading + 180);
        const wpOptions = { 
            altitude: flightAltitudeAGL, 
            cameraAction: 'takePhoto', 
            headingControl: 'fixed', 
            fixedHeading: Math.round(currentLineHeading),
            gimbalPitch: -90, 
            waypointType: 'grid', 
            speed: flightSpeed 
        };

        lineCandRot.forEach(rotPt => {
            const actualGeoPt = rotateLatLng(rotPt, rotationCenter, angleRad);
            if (isPointInPolygon(actualGeoPt, polygonLatLngs)) finalWaypointsData.push({ latlng: actualGeoPt, options: wpOptions });
        });
        currentRotLat += lineSpacingRotLat;
        scanDir *= -1; // Reverse direction for the next line
    }
    
    const uniqueWaypoints = [], seenKeys = new Set();
    for (const wp of finalWaypointsData) {
        const key = `${wp.latlng.lat.toFixed(7)},${wp.latlng.lng.toFixed(7)}`;
        if (!seenKeys.has(key)) { uniqueWaypoints.push(wp); seenKeys.add(key); }
    }
    return uniqueWaypoints;
}

function handleStartDrawingSurveyArea() {
    if (!map || !surveyGridModalOverlayEl) return;
    isDrawingSurveyArea = true;
    currentPolygonPoints = [];
    clearTemporaryDrawing();
    if (typeof handleMapClick === 'function') map.off("click", handleMapClick);
    map.off("click", handleSurveyAreaMapClick);
    map.on("click", handleSurveyAreaMapClick);
    map.getContainer().style.cursor = "crosshair";
    surveyGridModalOverlayEl.style.display = 'none';
    showCustomAlert(translate("alert_surveyDrawingActive", {minPoints: MIN_POLYGON_POINTS}), translate("infoTitle"));
}

function handleDrawGridAngle() {
    if (!currentPolygonPoints || currentPolygonPoints.length < MIN_POLYGON_POINTS) {
        return void showCustomAlert("Please define a survey area first before setting the grid angle.", "Error");
    }
    isDrawingGridAngle = true;
    angleDrawStartPoint = null;
    if (typeof handleMapClick === 'function') map.off("click", handleMapClick);
    map.dragging.disable();
    map.on("mousedown", onAngleDrawStart);
    map.getContainer().style.cursor = "crosshair";
    surveyGridModalOverlayEl.style.display = 'none';
    showCustomAlert(translate("infoTitle"), translate("alert_drawAngleInstruction"));
}

function onAngleDrawStart(e) {
    if (!isDrawingGridAngle) return;
    e.originalEvent.preventDefault();
    e.originalEvent.stopPropagation();
    angleDrawStartPoint = e.latlng;
    map.on("mousemove", onAngleDrawMove);
    map.on("mouseup", onAngleDrawEnd);
}

function onAngleDrawMove(e) {
    if (!isDrawingGridAngle || !angleDrawStartPoint) return;
    if (tempAngleLineLayer) map.removeLayer(tempAngleLineLayer);
    tempAngleLineLayer = L.polyline([angleDrawStartPoint, e.latlng], {color: '#f39c12', weight: 3, dashArray: '5, 10'}).addTo(map);
}

function onAngleDrawEnd(e) {
    if (!isDrawingGridAngle || !angleDrawStartPoint) return;
    e.originalEvent.preventDefault();
    e.originalEvent.stopPropagation();
    const bearing = calculateBearing(angleDrawStartPoint, e.latlng);
    const gridAngle = ((bearing % 360) + 360) % 360;
    const displayAngle = Math.round(gridAngle > 180 ? gridAngle - 360 : gridAngle);
    if (surveyGridAngleInputEl) surveyGridAngleInputEl.value = displayAngle;
    isDrawingGridAngle = false;
    angleDrawStartPoint = null;
    map.dragging.enable();
    map.getContainer().style.cursor = '';
    if (tempAngleLineLayer) map.removeLayer(tempAngleLineLayer);
    tempAngleLineLayer = null;
    map.off("mousedown", onAngleDrawStart);
    map.off("mousemove", onAngleDrawMove);
    map.off("mouseup", onAngleDrawEnd);
    if (typeof handleMapClick === 'function' && !map.hasEventListeners('click')) map.on("click", handleMapClick);
    if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'flex';
    showCustomAlert(`Grid angle set to ${displayAngle}°`, "Success");
}

function handleSurveyAreaMapClick(e) {
    if (!isDrawingSurveyArea) return;
    if (currentPolygonPoints.length >= MIN_POLYGON_POINTS && tempVertexMarkers.length > 0) {
        if (tempVertexMarkers[0].getLatLng().distanceTo(e.latlng) < 10 * map.getZoomScale(map.getZoom(), 18)) {
            return void handleFinalizeSurveyArea();
        }
    }
    if (currentPolygonPoints.length >= MAX_POLYGON_POINTS) {
        return void showCustomAlert(`Maximum ${MAX_POLYGON_POINTS} points allowed for survey area.`, "Warning");
    }
    currentPolygonPoints.push(e.latlng);
    const vertexMarker = L.circleMarker(e.latlng, {radius: 6, color: 'rgba(255,0,0,0.8)', fillColor: 'rgba(255,0,0,0.5)', fillOpacity: 0.7, pane: 'markerPane'}).addTo(map);
    if (currentPolygonPoints.length === 1) {
        vertexMarker.on("click", (ev) => {
            ev.originalEvent.stopPropagation();
            if (isDrawingSurveyArea && currentPolygonPoints.length >= MIN_POLYGON_POINTS) handleFinalizeSurveyArea();
        });
    }
    tempVertexMarkers.push(vertexMarker);
    updateTempPolygonDisplay();
    if (surveyAreaStatusEl) {
        const areaInfo = currentPolygonPoints.length >= MIN_POLYGON_POINTS ? ` (${(calculatePolygonArea(currentPolygonPoints) / 10000).toFixed(2)} ha)` : '';
        surveyAreaStatusEl.innerHTML = `${currentPolygonPoints.length} points selected${areaInfo}`;
    }
}

function handleFinalizeSurveyArea() {
    if (!isDrawingSurveyArea || currentPolygonPoints.length < MIN_POLYGON_POINTS) return;
    map.getContainer().style.cursor = '';
    isDrawingSurveyArea = false;
    map.off("click", handleSurveyAreaMapClick);
    if (typeof handleMapClick === 'function' && !map.hasEventListeners('click')) map.on("click", handleMapClick);
    if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'flex';
    if (finalizeSurveyAreaBtnEl) finalizeSurveyAreaBtnEl.style.display = 'none';
    if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = false;
    const areaHa = (calculatePolygonArea(currentPolygonPoints) / 10000).toFixed(2);
    if (surveyAreaStatusEl) surveyAreaStatusEl.innerHTML = translate("surveyAreaStatusDefined", {points: currentPolygonPoints.length, area: areaHa});
    if (surveyGridInstructionsEl) surveyGridInstructionsEl.innerHTML = translate("surveyGridInstructionsFinalized");
    if (tempPolygonLayer) tempPolygonLayer.setStyle({color: 'rgba(0, 150, 0, 0.9)', fillColor: 'rgba(0, 150, 0, 0.3)', weight: 3});
    tempVertexMarkers.forEach(marker => marker.off("click"));
    showCustomAlert(`Survey area defined: ${areaHa} hectares`, "Success");
}

function handleCancelSurveyGrid() {
    cancelSurveyAreaDrawing();
    if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'none';
}

function toRad(degrees) { return degrees * (Math.PI / 180); }
function toDeg(radians) { return radians * (180 / Math.PI); }
function calculateBearing(from, to) {
    const lat1 = toRad(from.lat), lat2 = toRad(to.lat), deltaLng = toRad(to.lng - from.lng);
    const y = Math.sin(deltaLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
