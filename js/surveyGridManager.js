// ===================================================================================
// File: surveyGridManager.js
// Description: Manages the creation, editing, and deletion of survey grid missions.
// Version: 4.0 (Refactored for clarity, state management, and maintainability)
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
// Centralized state object for the survey tool to avoid global scope pollution.
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
//                                CORE LOGIC & GENERATION
// ===================================================================================

/**
 * Generates the waypoint data for a survey grid based on the provided parameters.
 * This is the core calculation engine.
 * @param {L.LatLng[]} polygonLatLngs - The vertices of the survey area.
 * @param {object} params - The survey parameters { altitude, sidelap, frontlap, angle, speed }.
 * @returns {object[]} An array of waypoint data objects { latlng, options }.
 */
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
            fixedHeading: Math.round(fixedGridHeading), // "Crabbing" effect
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
    
    // Deduplicate waypoints before returning
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
 * Deletes old waypoints of a mission and adds new ones.
 * @param {object} mission - The survey mission object to update.
 * @param {object[]} waypointsData - The new waypoint data generated.
 * @private
 */
function _updateMissionWaypoints(mission, waypointsData) {
    // 1. Delete old waypoints from global array and map
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

    // 2. Add new waypoints and link them to the mission
    mission.waypointIds = [];
    waypointsData.forEach(wpData => {
        addWaypoint(wpData.latlng, wpData.options);
        const newWpId = waypointCounter - 1; // ID of the last added waypoint
        mission.waypointIds.push(newWpId);
    });
}

/**
 * Creates a new survey mission object and adds it to the global list.
 * @param {object} params - The survey parameters.
 * @returns {object} The newly created mission object.
 * @private
 */
function _createNewMission(params) {
    const mission = {
        id: surveyMissionCounter++,
        polygon: surveyState.polygonPoints.map(p => ({ lat: p.lat, lng: p.lng })),
        parameters: params,
        waypointIds: [],
        polygonLayer: L.polygon(surveyState.polygonPoints, { 
            color: CONSTANTS.COLORS.MISSION, 
            weight: 2, 
            fillOpacity: 0.1 
        }).addTo(map)
    };
    surveyMissions.push(mission);
    return mission;
}


// ===================================================================================
//                                UI & EVENT HANDLERS
// ===================================================================================

/**
 * Opens the survey grid modal, for a new mission or to edit an existing one.
 * @param {number|null} [missionId=null] - The ID of the mission to edit.
 */
function openSurveyGridModal(missionId = null) {
    if (!surveyGridModalOverlayEl) return;
    
    _resetAndExitDrawingMode(); // Ensure clean state
    surveyState.isEditingMissionId = missionId;

    if (surveyState.isEditingMissionId !== null) {
        const mission = surveyMissions.find(m => m.id === surveyState.isEditingMissionId);
        if (!mission) {
            surveyState.isEditingMissionId = null;
            return;
        }

        // --- EDIT MODE ---
        surveyGridModalTitleEl.textContent = `${translate('editMissionBtn')} ${translate('missionLabel')} ${mission.id}`;
        surveyGridAltitudeInputEl.value = mission.parameters.altitude;
        surveySidelapInputEl.value = mission.parameters.sidelap;
        surveyFrontlapInputEl.value = mission.parameters.frontlap;
        surveyGridAngleInputEl.value = mission.parameters.angle;
        
        surveyState.polygonPoints = mission.polygon.map(p => L.latLng(p.lat, p.lng));
        
        startDrawingSurveyAreaBtnEl.style.display = 'none';
        confirmSurveyGridBtnEl.textContent = translate('updateGridBtn');
        confirmSurveyGridBtnEl.disabled = false;
        
        _drawTempPolygon(true); // Draw polygon in edit color

    } else {
        // --- CREATE MODE ---
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

/**
 * Handles the main "Generate/Update Grid" button click.
 */
function handleConfirmSurveyGridGeneration() {
    // 1. Collect and validate parameters
    const params = {
        altitude: parseInt(surveyGridAltitudeInputEl.value),
        sidelap: parseFloat(surveySidelapInputEl.value),
        frontlap: parseFloat(surveyFrontlapInputEl.value),
        angle: parseFloat(surveyGridAngleInputEl.value) || 0,
        speed: parseFloat(flightSpeedSlider.value)
    };
    const validationErrors = validateSurveyGridInputs(params.altitude, params.sidelap, params.frontlap, params.angle, params.speed);
    if (validationErrors.length > 0) {
        return showCustomAlert(validationErrors.join('\n'), translate('inputErrorTitle'));
    }
    if (!surveyState.polygonPoints || surveyState.polygonPoints.length < CONSTANTS.MIN_POLYGON_POINTS) {
        return showCustomAlert('Please define a survey area first.', translate('inputErrorTitle'));
    }

    // 2. Generate waypoint data
    const waypointsData = generateSurveyGridWaypoints(surveyState.polygonPoints, params);

    if (waypointsData.length > 0) {
        let mission;
        if (surveyState.isEditingMissionId !== null) {
            mission = surveyMissions.find(m => m.id === surveyState.isEditingMissionId);
            if (!mission) return; // Should not happen
            mission.parameters = params; // Update parameters
        } else {
            mission = _createNewMission(params);
        }
        
        _updateMissionWaypoints(mission, waypointsData);

        showCustomAlert(translate('alert_surveyGridSuccess', { count: mission.waypointIds.length }), translate('successTitle'));
    } else {
        showCustomAlert('No waypoints could be generated for this configuration.', 'Warning');
    }
    
    // 3. Cleanup and UI update
    updateAllUI();
    _resetAndExitDrawingMode();
    surveyGridModalOverlayEl.style.display = 'none';
}

/**
 * Deletes a survey mission and its associated waypoints.
 * @param {number} missionId - The ID of the mission to delete.
 */
function deleteSurveyMission(missionId) {
    const missionIndex = surveyMissions.findIndex(m => m.id === missionId);
    if (missionIndex === -1) return;

    const mission = surveyMissions[missionIndex];
    const confirmMsg = translate('alert_deleteSurveyMissionConfirm', {
        missionName: `${translate('missionLabel')} ${mission.id}`,
        wpCount: mission.waypointIds.length
    });

    if (confirm(confirmMsg)) {
        // Delete waypoints
        _updateMissionWaypoints(mission, []); 
        // Delete mission object and its polygon layer
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
    if (surveyState.isDrawingArea) {
        // Close polygon if clicking near the start
        if (surveyState.polygonPoints.length >= CONSTANTS.MIN_POLYGON_POINTS && surveyState.tempVertexMarkers.length > 0) {
            const firstMarker = surveyState.tempVertexMarkers[0];
            if (firstMarker.getLatLng().distanceTo(e.latlng) < 10 * map.getZoomScale(map.getZoom(), 18)) {
                return handleFinalizeSurveyArea();
            }
        }
        // Prevent overly complex polygons
        if (surveyState.polygonPoints.length >= CONSTANTS.MAX_POLYGON_POINTS) {
            return showCustomAlert(`Maximum ${CONSTANTS.MAX_POLYGON_POINTS} points allowed.`, 'Warning');
        }
        // Add a new point
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
    
    _exitMapDrawingState(); // Restore normal map behavior
    
    if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'flex';
    showCustomAlert(`Grid angle set to ${surveyGridAngleInputEl.value}°`, 'Success');
}

function handleFinalizeSurveyArea() {
    if (!surveyState.isDrawingArea || surveyState.polygonPoints.length < CONSTANTS.MIN_POLYGON_POINTS) return;
    
    _exitMapDrawingState();
    
    surveyGridModalOverlayEl.style.display = 'flex';
    finalizeSurveyAreaBtnEl.style.display = 'none';
    confirmSurveyGridBtnEl.disabled = false;
    
    _drawTempPolygon(false, true); // Redraw polygon in finalized color
    
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
    if(typeof updateSurveyMissionsList === 'function') updateSurveyMissionsList();
    fitMapToWaypoints();
}

function _enterDrawingMode(mode = 'area') {
    map.dragging.disable();
    if(typeof handleMapClick === 'function') map.off('click', handleMapClick);
    
    if (mode === 'area') {
        map.on('click', onMapClick);
        map.getContainer().style.cursor = 'crosshair';
    } else if (mode === 'angle') {
        map.on('mousedown', onAngleDrawStart);
        map.getContainer().style.cursor = 'crosshair';
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
    if (surveyState.tempPolygonLayer) map.removeLayer(surveyState.tempPolygonLayer);
    surveyState.tempVertexMarkers.forEach(m => map.removeLayer(m));
    
    surveyState.polygonPoints = [];
    surveyState.tempVertexMarkers = [];
    surveyState.isEditingMissionId = null;
}

function _drawTempPolygon(isEdit = false, isFinalized = false) {
    if (surveyState.tempPolygonLayer) map.removeLayer(surveyState.tempPolygonLayer);
    if (surveyState.polygonPoints.length < 2) return;

    let color = isFinalized ? CONSTANTS.COLORS.FINALIZED : (isEdit ? CONSTANTS.COLORS.EDITING : CONSTANTS.COLORS.DRAWING);
    const opts = { color: color, weight: 2, fillColor: color, fillOpacity: 0.2 };
    
    if (surveyState.polygonPoints.length < 3) {
        surveyState.tempPolygonLayer = L.polyline(surveyState.polygonPoints, opts).addTo(map);
    } else {
        surveyState.tempPolygonLayer = L.polygon(surveyState.polygonPoints, opts).addTo(map);
    }
}

function toRad(degrees) { return degrees * (Math.PI / 180); }
function toDeg(radians) { return radians * (180 / Math.PI); }
function calculateBearing(from, to) {
    const lat1 = toRad(from.lat), lat2 = toRad(to.lat), deltaLng = toRad(to.lng - from.lng);
    const y = Math.sin(deltaLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
