// ===================================================================================
// File: waypointManager.js
// Version: 8.0 (Final, robust, and simplified logic for all waypoint operations)
// ===================================================================================

/**
 * Recalculates all waypoint IDs to be sequential (1, 2, 3...).
 * Also updates the global counter.
 * @private
 */
function _renumberAllWaypoints() {
    waypoints.forEach((wp, index) => {
        wp.id = index + 1;
    });
    _recalculateGlobalWaypointCounter();
}

/**
 * Deletes a set of waypoints by their IDs and renumbers the rest.
 * @param {Set<number>} idsToDelete - A Set of waypoint IDs to delete.
 * @private
 */
function _deleteWaypointsByIds(idsToDelete) {
    if (!idsToDelete || idsToDelete.size === 0) return;

    // Remove markers from the map first
    waypoints.forEach(wp => {
        if (idsToDelete.has(wp.id) && wp.marker) {
            map.removeLayer(wp.marker);
        }
    });

    // Filter out the waypoints from the main array
    waypoints = waypoints.filter(wp => !idsToDelete.has(wp.id));

    // Renumber all remaining waypoints to maintain a clean sequence
    _renumberAllWaypoints();
}

/**
 * Recalculates the global waypoint counter to be one greater than the highest existing waypoint ID.
 * @private
 */
function _recalculateGlobalWaypointCounter() {
    waypointCounter = waypoints.length > 0 ? Math.max(0, ...waypoints.map(wp => wp.id)) + 1 : 1;
}

/**
 * Creates a new Leaflet marker for a waypoint, binds all necessary events, and assigns it.
 * @param {object} waypoint - The waypoint data object.
 * @private
 */
function _createAndBindMarker(waypoint) {
    const isHomeForIcon = waypoints.length > 0 && waypoint.id === waypoints[0].id;
    const marker = L.marker(waypoint.latlng, {
        draggable: true,
        icon: createWaypointIcon(waypoint, false, false, isHomeForIcon)
    }).addTo(map);

    marker.on('click', (e) => { L.DomEvent.stopPropagation(e); selectWaypoint(waypoint); });
    
    marker.on('dragend', () => { 
        waypoint.latlng = marker.getLatLng();
        if(typeof updateAllUI === 'function') updateAllUI();
    });
    
    marker.on('drag', () => {
        waypoint.latlng = marker.getLatLng();
        updateFlightPath();
        if (waypoint.headingControl === 'poi_track' && typeof updateGimbalForPoiTrack === 'function') {
            updateGimbalForPoiTrack(waypoint, true);
        }
    });

    waypoint.marker = marker;
}


async function addWaypoint(latlng, options = {}) { 
    if (!map || !defaultAltitudeSlider || !gimbalPitchSlider) return;
    
    const newWaypoint = {
        id: waypointCounter, // Always use the global counter for new waypoints
        latlng: L.latLng(latlng.lat, latlng.lng),
        altitude: options.altitude !== undefined ? options.altitude : parseInt(defaultAltitudeSlider.value),
        hoverTime: options.hoverTime !== undefined ? options.hoverTime : 0,
        gimbalPitch: options.gimbalPitch !== undefined ? options.gimbalPitch : parseInt(gimbalPitchSlider.value),
        headingControl: options.headingControl || 'auto',
        fixedHeading: options.fixedHeading || 0,
        cameraAction: options.cameraAction || 'none',
        targetPoiId: options.targetPoiId || null,
        terrainElevationMSL: options.terrainElevationMSL !== undefined ? options.terrainElevationMSL : null, 
        marker: null,
        waypointType: options.waypointType || 'generic' 
    };
    
    waypointCounter++;

    // Insert the waypoint at a specific index if provided (for survey grid updates)
    if (options.insertionIndex !== undefined && options.insertionIndex < waypoints.length) {
        waypoints.splice(options.insertionIndex, 0, newWaypoint);
        _renumberAllWaypoints(); // Renumber everything after insertion
        // Redraw all markers because IDs have changed
        waypoints.forEach(wp => {
            if (wp.marker) map.removeLayer(wp.marker);
            _createAndBindMarker(wp);
        });
    } else {
        waypoints.push(newWaypoint);
        _createAndBindMarker(newWaypoint);
    }
    
    if (options.calledFromLoad !== true) { 
        if (typeof updateAllUI === 'function') updateAllUI();
        if (options.select !== false) selectWaypoint(newWaypoint); 
    }
}

function selectWaypoint(waypoint) {
    if (!waypoint) return;
    const previouslySelectedSingleId = selectedWaypoint ? selectedWaypoint.id : null;
    if (selectedForMultiEdit.size > 0) clearMultiSelection(); 
    selectedWaypoint = waypoint;
    if (previouslySelectedSingleId && previouslySelectedSingleId !== waypoint.id) {
        const prevWp = waypoints.find(wp => wp.id === previouslySelectedSingleId);
        if (prevWp) updateMarkerIconStyle(prevWp);
    }
    updateMarkerIconStyle(selectedWaypoint);
    updateSingleWaypointEditControls(); 
    updateWaypointList();
    if (selectedWaypoint.marker) map.panTo(selectedWaypoint.latlng);
    updateMultiEditPanelVisibility(); 
}

function deleteSelectedWaypoint() {
    if (!selectedWaypoint) return;
    _deleteWaypointsByIds(new Set([selectedWaypoint.id]));
    selectedWaypoint = null;
    if (waypointControlsDiv) waypointControlsDiv.style.display = 'none';
    if(typeof updateAllUI === 'function') updateAllUI();
}

function clearWaypoints() {
    waypoints.forEach(wp => { if (wp.marker) map.removeLayer(wp.marker); });
    waypoints = [];
    selectedWaypoint = null;
    waypointCounter = 1;
    surveyMissions.forEach(mission => { if (mission.polygonLayer) map.removeLayer(mission.polygonLayer); });
    surveyMissions = [];
    surveyMissionCounter = 1;
    if (typeof updateSurveyMissionsList === 'function') updateSurveyMissionsList();
    clearMultiSelection();
    if (waypointControlsDiv) waypointControlsDiv.style.display = 'none';
    if (pois) { pois.forEach(p => { if (p.marker) map.removeLayer(p.marker); }); pois = []; poiCounter = 1; if (typeof updatePOIList === 'function') updatePOIList(); }
    lastAltitudeAdaptationMode = 'relative';
    if (typeof updatePathModeDisplay === 'function') updatePathModeDisplay();
    if(typeof updateAllUI === 'function') updateAllUI();
}

function toggleMultiSelectWaypoint(waypointId, isChecked) { const waypoint = waypoints.find(wp => wp.id === waypointId); if (!waypoint) return; if (isChecked) { selectedForMultiEdit.add(waypointId); if (selectedWaypoint) { const oldSelectedWpObject = selectedWaypoint; selectedWaypoint = null; if (waypointControlsDiv) waypointControlsDiv.style.display = 'none'; updateMarkerIconStyle(oldSelectedWpObject); } } else { selectedForMultiEdit.delete(waypointId); } updateMarkerIconStyle(waypoint); if (selectAllWaypointsCheckboxEl) selectAllWaypointsCheckboxEl.checked = waypoints.length > 0 && waypoints.every(wp => selectedForMultiEdit.has(wp.id)); updateWaypointList(); updateMultiEditPanelVisibility(); }
function toggleSelectAllWaypoints(isChecked) { if (selectedWaypoint) { const oldSelectedWpObject = selectedWaypoint; selectedWaypoint = null; if (waypointControlsDiv) waypointControlsDiv.style.display = 'none'; updateMarkerIconStyle(oldSelectedWpObject); } selectedForMultiEdit.clear(); if (isChecked && waypoints.length > 0) { waypoints.forEach(wp => selectedForMultiEdit.add(wp.id)); } waypoints.forEach(wp => updateMarkerIconStyle(wp)); updateWaypointList(); updateMultiEditPanelVisibility(); }
function clearMultiSelection() { const previouslyMultiSelectedIds = new Set(selectedForMultiEdit); selectedForMultiEdit.clear(); if (selectAllWaypointsCheckboxEl) selectAllWaypointsCheckboxEl.checked = false; previouslyMultiSelectedIds.forEach(id => { const waypoint = waypoints.find(wp => wp.id === id); if (waypoint) updateMarkerIconStyle(waypoint); }); updateWaypointList(); updateMultiEditPanelVisibility(); }
function updateGimbalForPoiTrack(waypoint, forceUpdateUI = false) { if (!waypoint || waypoint.headingControl !== 'poi_track' || waypoint.targetPoiId === null) return; const targetPoi = pois.find(p => p.id === waypoint.targetPoiId); if (!targetPoi) return; const homeElevation = parseFloat(homeElevationMslInput.value) || 0; const waypointAMSL = homeElevation + waypoint.altitude; const poiAMSL = targetPoi.altitude; const horizontalDistance = haversineDistance(waypoint.latlng, targetPoi.latlng); const requiredPitch = calculateRequiredGimbalPitch(waypointAMSL, poiAMSL, horizontalDistance); if (waypoint.gimbalPitch !== requiredPitch) { waypoint.gimbalPitch = requiredPitch; if (selectedWaypoint && selectedWaypoint.id === waypoint.id && (waypointControlsDiv.style.display === 'block' || forceUpdateUI)) { if (gimbalPitchSlider) gimbalPitchSlider.value = waypoint.gimbalPitch; if (gimbalPitchValueEl) gimbalPitchValueEl.textContent = waypoint.gimbalPitch + '°'; } } }
function applyMultiEdit() { /* ... unchanged ... */ }
