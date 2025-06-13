// ===================================================================================
// File: waypointManager.js
// Version: 6.1 (Final robust implementation with centralized waypoint replacement)
// ===================================================================================

/**
 * Recalculates the global waypoint counter to be one greater than the highest existing waypoint ID.
 * @private
 */
function _recalculateGlobalWaypointCounter() {
    waypointCounter = waypoints.length > 0 ? Math.max(...waypoints.map(wp => wp.id)) + 1 : 1;
}

/**
 * Re-draws all waypoint markers on the map based on the current `waypoints` array.
 * This function is critical after any operation that re-numbers or replaces waypoints.
 * @private
 */
function _redrawAllWaypointMarkers() {
    // First, remove all existing markers from the map to avoid duplicates
    waypoints.forEach(wp => {
        if (wp.marker) {
            map.removeLayer(wp.marker);
        }
    });

    // Then, re-create each marker with updated data (like ID and correct events)
    waypoints.forEach((wp, index) => {
        const isHomeForIcon = index === 0;
        const marker = L.marker(wp.latlng, {
            draggable: true,
            icon: createWaypointIcon(wp, false, false, isHomeForIcon)
        }).addTo(map);
        
        // Re-bind essential events
        marker.on('click', (e) => { L.DomEvent.stopPropagation(e); selectWaypoint(wp); });
        marker.on('dragend', () => { 
            wp.latlng = marker.getLatLng();
            updateAllUI(); // A global update is safest after a drag
        });
        
        wp.marker = marker;
    });
}

/**
 * Replaces a set of waypoints with a new set at a specific position.
 * This is the master function for mission updates to ensure data integrity.
 * @param {number[]} idsToDelete - An array of waypoint IDs to remove.
 * @param {object[]} newWpsData - An array of new waypoint data objects to insert.
 * @returns {number[]} An array of the new IDs assigned to the inserted waypoints.
 */
function replaceWaypointSet(idsToDelete, newWpsData) {
    let insertionIndex = -1;
    if (idsToDelete && idsToDelete.length > 0) {
        insertionIndex = waypoints.findIndex(wp => wp.id === idsToDelete[0]);
        const oldWpIds = new Set(idsToDelete);
        waypoints = waypoints.filter(wp => !oldWpIds.has(wp.id));
    }
    if (insertionIndex === -1) {
        insertionIndex = waypoints.length;
    }

    const newWps = newWpsData.map(data => ({
        // This creates a "raw" object, but crucially converts latlng
        latlng: L.latLng(data.latlng.lat, data.latlng.lng),
        ...data.options
    }));

    waypoints.splice(insertionIndex, 0, ...newWps);

    const newWaypointIds = [];
    waypoints.forEach((wp, index) => {
        const newId = index + 1;
        wp.id = newId;
        // Populate the list of new IDs that the survey mission needs to track
        if (index >= insertionIndex && index < insertionIndex + newWps.length) {
            newWaypointIds.push(newId);
        }
    });

    // Centralized redrawing and counter update
    _redrawAllWaypointMarkers();
    _recalculateGlobalWaypointCounter();
    
    return newWaypointIds;
}


async function addWaypoint(latlng, options = {}) { 
    if (!map || !defaultAltitudeSlider || !gimbalPitchSlider) return;
    
    const newWaypoint = {
        id: options.id !== undefined ? options.id : waypointCounter,
        latlng: L.latLng(latlng.lat, latlng.lng),
        altitude: options.altitude !== undefined ? options.altitude : parseInt(defaultAltitudeSlider.value),
        hoverTime: options.hoverTime !== undefined ? options.hoverTime : 0,
        gimbalPitch: options.gimbalPitch !== undefined ? options.gimbalPitch : parseInt(gimbalPitchSlider.value),
        headingControl: options.headingControl || 'auto',
        fixedHeading: options.fixedHeading || 0,
        cameraAction: options.cameraAction || 'none',
        targetPoiId: options.targetPoiId || null,
        terrainElevationMSL: options.terrainElevationMSL !== undefined ? options.terrainElevationMSL : null, 
        marker: null, // Will be created by _redrawAllWaypointMarkers or _createAndBindMarker
        waypointType: options.waypointType || 'generic' 
    };
    
    // Only increment the global counter for brand new, manually added waypoints
    if (options.id === undefined) {
        waypointCounter++;
    }
    
    waypoints.push(newWaypoint);
    _createAndBindMarker(newWaypoint); // Create and bind marker for this single new waypoint
    
    // Update UI only if not called from a batch operation like import
    if (options.calledFromLoad !== true) { 
        updateAllUI();
        selectWaypoint(newWaypoint); 
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
    replaceWaypointSet([selectedWaypoint.id], []); // Use master function to delete and re-number
    selectedWaypoint = null;
    if (waypointControlsDiv) waypointControlsDiv.style.display = 'none';
    updateAllUI();
}

function clearWaypoints() {
    waypoints.forEach(wp => { if (wp.marker) map.removeLayer(wp.marker); });
    waypoints = [];
    selectedWaypoint = null;
    waypointCounter = 1; 
    actionGroupCounter = 1; 
    actionCounter = 1;    

    surveyMissions.forEach(mission => { if (mission.polygonLayer) map.removeLayer(mission.polygonLayer); });
    surveyMissions = [];
    surveyMissionCounter = 1;
    if(typeof updateSurveyMissionsList === 'function') updateSurveyMissionsList();

    clearMultiSelection(); 
    if (waypointControlsDiv) waypointControlsDiv.style.display = 'none';
    
    // Clear POIs
    if(pois) pois.forEach(p => { if(p.marker) map.removeLayer(p.marker); }); pois = []; poiCounter = 1; if(typeof updatePOIList === 'function') updatePOIList();
    
    lastAltitudeAdaptationMode = 'relative'; 
    if(typeof updatePathModeDisplay === 'function') updatePathModeDisplay();
    updateAllUI();
}

function toggleMultiSelectWaypoint(waypointId, isChecked) {
    const waypoint = waypoints.find(wp => wp.id === waypointId);
    if (!waypoint) return;
    if (isChecked) {
        selectedForMultiEdit.add(waypointId);
        if (selectedWaypoint) {
            const oldSelectedWpObject = selectedWaypoint; 
            selectedWaypoint = null; 
            if (waypointControlsDiv) waypointControlsDiv.style.display = 'none'; 
            updateMarkerIconStyle(oldSelectedWpObject); 
        }
    } else {
        selectedForMultiEdit.delete(waypointId);
    }
    updateMarkerIconStyle(waypoint); 
    if (selectAllWaypointsCheckboxEl) selectAllWaypointsCheckboxEl.checked = waypoints.length > 0 && waypoints.every(wp => selectedForMultiEdit.has(wp.id));
    updateWaypointList(); 
    updateMultiEditPanelVisibility(); 
}

function toggleSelectAllWaypoints(isChecked) {
    if (selectedWaypoint) { 
        const oldSelectedWpObject = selectedWaypoint;
        selectedWaypoint = null;
        if (waypointControlsDiv) waypointControlsDiv.style.display = 'none';
        updateMarkerIconStyle(oldSelectedWpObject); 
    }
    selectedForMultiEdit.clear(); 
    if (isChecked && waypoints.length > 0) {
        waypoints.forEach(wp => selectedForMultiEdit.add(wp.id));
    }
    waypoints.forEach(wp => updateMarkerIconStyle(wp)); 
    updateWaypointList(); 
    updateMultiEditPanelVisibility(); 
}

function clearMultiSelection() {
    const previouslyMultiSelectedIds = new Set(selectedForMultiEdit); 
    selectedForMultiEdit.clear();
    if (selectAllWaypointsCheckboxEl) selectAllWaypointsCheckboxEl.checked = false;
    previouslyMultiSelectedIds.forEach(id => {
        const waypoint = waypoints.find(wp => wp.id === id);
        if (waypoint) updateMarkerIconStyle(waypoint); 
    });
    updateWaypointList(); 
    updateMultiEditPanelVisibility(); 
}


function updateGimbalForPoiTrack(waypoint, forceUpdateUI = false) {
    if (!waypoint || waypoint.headingControl !== 'poi_track' || waypoint.targetPoiId === null) {
        return; 
    }
    const targetPoi = pois.find(p => p.id === waypoint.targetPoiId);
    if (!targetPoi) {
        return; 
    }
    const homeElevation = parseFloat(homeElevationMslInput.value) || 0;
    const waypointAMSL = homeElevation + waypoint.altitude;
    const poiAMSL = targetPoi.altitude; 
    const horizontalDistance = haversineDistance(waypoint.latlng, targetPoi.latlng);

    const requiredPitch = calculateRequiredGimbalPitch(waypointAMSL, poiAMSL, horizontalDistance);
    if (waypoint.gimbalPitch !== requiredPitch) {
        waypoint.gimbalPitch = requiredPitch; 
        if (selectedWaypoint && selectedWaypoint.id === waypoint.id && (waypointControlsDiv.style.display === 'block' || forceUpdateUI)) {
            if (gimbalPitchSlider) gimbalPitchSlider.value = waypoint.gimbalPitch;
            if (gimbalPitchValueEl) gimbalPitchValueEl.textContent = waypoint.gimbalPitch + '°';
        }
    }
}

function applyMultiEdit() {
    if (selectedForMultiEdit.size === 0) {
        showCustomAlert("Nessun waypoint selezionato per la modifica multipla.", "Attenzione");
        return;
    }
    if (!multiHeadingControlSelect || !multiFixedHeadingSlider || !multiCameraActionSelect ||
        !multiChangeGimbalPitchCheckbox || !multiGimbalPitchSlider ||
        !multiChangeHoverTimeCheckbox || !multiHoverTimeSlider || !multiTargetPoiSelect) {
        showCustomAlert("Controlli per la modifica multipla non trovati.", "Errore Interno");
        return;
    }
    
    const newHeadingControl = multiHeadingControlSelect.value;
    const newFixedHeading = parseInt(multiFixedHeadingSlider.value);
    const newCameraAction = multiCameraActionSelect.value;
    const changeGimbal = multiChangeGimbalPitchCheckbox.checked;
    const newGimbalPitch = parseInt(multiGimbalPitchSlider.value);
    const changeHover = multiChangeHoverTimeCheckbox.checked;
    const newHoverTime = parseInt(multiHoverTimeSlider.value);
    let changesMade = false;

    waypoints.forEach(wp => {
        if (selectedForMultiEdit.has(wp.id)) {
            let wpChanged = false;
            if (newHeadingControl) { 
                wp.headingControl = newHeadingControl;
                wp.targetPoiId = (newHeadingControl === 'poi_track' && multiTargetPoiSelect.value) ? parseInt(multiTargetPoiSelect.value) : null;
                wp.fixedHeading = (newHeadingControl === 'fixed') ? newFixedHeading : 0;
                wpChanged = true;
            }
            if (newCameraAction) { wp.cameraAction = newCameraAction; wpChanged = true; }
            if (changeGimbal) { wp.gimbalPitch = newGimbalPitch; wpChanged = true; }
            if (changeHover) { wp.hoverTime = newHoverTime; wpChanged = true; }

            if (wpChanged) {
                changesMade = true;
                if (wp.headingControl === 'poi_track') updateGimbalForPoiTrack(wp);
                updateMarkerIconStyle(wp); 
            }
        }
    });

    if (changesMade) {
        updateWaypointList();
        updateFlightStatistics(); 
        showCustomAlert(`${selectedForMultiEdit.size} waypoint sono stati aggiornati.`, "Successo"); 
    }
    
    // Reset controls
    multiHeadingControlSelect.value = ""; 
    multiCameraActionSelect.value = ""; 
    multiChangeGimbalPitchCheckbox.checked = false;
    multiGimbalPitchSlider.disabled = true; 
    multiChangeHoverTimeCheckbox.checked = false;
    multiHoverTimeSlider.disabled = true;
    clearMultiSelection();
}
