// File: waypointManager.js

// Depends on: config.js, utils.js, uiUpdater.js, mapManager.js, flightPathManager.js

/**
 * Adds a new waypoint to the map and list.
 * @param {L.LatLng} latlng - The latitude and longitude for the new waypoint.
 * @param {object} [options={}] - Optional parameters to override defaults for the new waypoint.
 */
function addWaypoint(latlng, options = {}) {
    if (!map || !defaultAltitudeSlider || !gimbalPitchSlider) return;

    const newWaypoint = {
        id: waypointCounter++,
        latlng: L.latLng(latlng.lat, latlng.lng),
        altitude: options.altitude !== undefined ? options.altitude : parseInt(defaultAltitudeSlider.value),
        hoverTime: options.hoverTime !== undefined ? options.hoverTime : 0,
        gimbalPitch: options.gimbalPitch !== undefined ? options.gimbalPitch : parseInt(gimbalPitchSlider.value),
        headingControl: options.headingControl || 'auto',
        fixedHeading: options.fixedHeading || 0,
        cameraAction: options.cameraAction || 'none',
        targetPoiId: options.targetPoiId || null,
        marker: null 
    };

    // Marker creation will be handled by updateMarkerIconStyle after pushing to waypoints array
    // This ensures that 'auto' heading calculations have access to the full waypoints array.
    
    waypoints.push(newWaypoint);

    const isHome = waypoints.length === 1 && newWaypoint.id === waypoints[0].id;
    const marker = L.marker(newWaypoint.latlng, {
        draggable: true,
        icon: createWaypointIcon(newWaypoint, false, false, isHome) // Initial icon
    }).addTo(map);

    marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e); 
        selectWaypoint(newWaypoint);
    });
    marker.on('dragend', () => {
        newWaypoint.latlng = marker.getLatLng();
        updateFlightPath(); // This will update distances and potentially auto headings visually later
        updateFlightStatistics();
        updateWaypointList(); 
        // Update current marker and potentially adjacent for auto-heading changes
        updateMarkerIconStyle(newWaypoint);
        const wpIndex = waypoints.findIndex(wp => wp.id === newWaypoint.id);
        if (wpIndex > 0 && waypoints[wpIndex-1].headingControl === 'auto') {
            updateMarkerIconStyle(waypoints[wpIndex-1]);
        }
        if (wpIndex < waypoints.length - 1 && waypoints[wpIndex+1].headingControl === 'auto') {
             // This waypoint itself might be the one "before" the next one, its heading needs recalc
             // updateMarkerIconStyle(newWaypoint) already covers this.
        }
    });
    marker.on('drag', () => { 
        newWaypoint.latlng = marker.getLatLng();
        updateFlightPath(); // Live update path
        // For live heading update while dragging (more intensive):
        // updateMarkerIconStyle(newWaypoint);
        // const wpIndex = waypoints.findIndex(wp => wp.id === newWaypoint.id);
        // if (wpIndex > 0 && waypoints[wpIndex-1].headingControl === 'auto') updateMarkerIconStyle(waypoints[wpIndex-1]);
        // if (wpIndex < waypoints.length - 1 && waypoints[wpIndex+1].headingControl === 'auto') updateMarkerIconStyle(waypoints[wpIndex+1]);
    });
    newWaypoint.marker = marker;


    // Update icon of the previous waypoint if its heading was 'auto'
    if (waypoints.length > 1) {
        const prevWp = waypoints[waypoints.length - 2];
        if (prevWp.headingControl === 'auto') {
            updateMarkerIconStyle(prevWp);
        }
    }
    
    updateWaypointList();
    updateFlightPath();
    updateFlightStatistics();
    selectWaypoint(newWaypoint); 
}

/**
 * Selects a waypoint, updating UI and map markers.
 * @param {object} waypoint - The waypoint object to select.
 */
function selectWaypoint(waypoint) {
    if (!waypoint) return;

    const previouslySelectedSingleId = selectedWaypoint ? selectedWaypoint.id : null;

    if (selectedForMultiEdit.size > 0) {
        clearMultiSelection(); 
    }

    selectedWaypoint = waypoint;

    if (previouslySelectedSingleId && previouslySelectedSingleId !== waypoint.id) {
        const prevWp = waypoints.find(wp => wp.id === previouslySelectedSingleId);
        if (prevWp) updateMarkerIconStyle(prevWp);
    }

    updateMarkerIconStyle(selectedWaypoint);

    waypoints.forEach(wp => {
        if (wp.id !== selectedWaypoint.id) {
            // Ensure non-selected waypoints don't carry stale single-selection styles
            // but respect their multi-select or home status.
            updateMarkerIconStyle(wp); 
        }
    });

    updateSingleWaypointEditControls(); 
    updateWaypointList(); 

    if (selectedWaypoint.marker) {
        map.panTo(selectedWaypoint.latlng); 
    }
    updateMultiEditPanelVisibility(); 
}

/**
 * Deletes the currently selected waypoint.
 */
function deleteSelectedWaypoint() {
    if (!selectedWaypoint) {
        showCustomAlert("No waypoint selected to delete.", "Info");
        return;
    }

    const deletedWaypointId = selectedWaypoint.id;
    const deletedWaypointIndex = waypoints.findIndex(wp => wp.id === deletedWaypointId);

    if (selectedWaypoint.marker) {
        map.removeLayer(selectedWaypoint.marker);
    }

    waypoints = waypoints.filter(wp => wp.id !== deletedWaypointId);

    if (selectedForMultiEdit.has(deletedWaypointId)) {
        selectedForMultiEdit.delete(deletedWaypointId);
    }

    selectedWaypoint = null;
    if (waypointControlsDiv) waypointControlsDiv.style.display = 'none';

    // After removing the waypoint, update the headings of potentially affected adjacent waypoints
    // (the one before the deleted, and the new "first" if the old first was deleted)
    if (deletedWaypointIndex > 0 && deletedWaypointIndex -1 < waypoints.length) { // Check if there was a waypoint before the deleted one
        const prevWp = waypoints[deletedWaypointIndex - 1];
        if (prevWp && prevWp.headingControl === 'auto') {
            updateMarkerIconStyle(prevWp);
        }
    }
    // If the first waypoint was deleted, the new first waypoint (if any) might need its home icon.
    // And its 'auto' heading (if it's the only one left) should be cleared.
    // This is more broadly handled by refreshing all icons.

    updateWaypointList(); 
    updateFlightPath();
    updateFlightStatistics();
    updateMultiEditPanelVisibility(); 
    
    // Refresh all remaining waypoint icons to correctly update home point and auto headings
    waypoints.forEach(wp => updateMarkerIconStyle(wp)); 

    showCustomAlert("Waypoint deleted.", "Success"); 
}

/**
 * Clears all waypoints from the map and list.
 */
function clearWaypoints() {
    waypoints.forEach(wp => {
        if (wp.marker) map.removeLayer(wp.marker);
    });
    waypoints = [];
    selectedWaypoint = null;
    waypointCounter = 1; 
    actionGroupCounter = 1; 
    actionCounter = 1;    

    clearMultiSelection(); 

    if (waypointControlsDiv) waypointControlsDiv.style.display = 'none';
    updateWaypointList();
    updateFlightPath();
    updateFlightStatistics();
}

/**
 * Toggles the multi-selection state of a single waypoint.
 * @param {number} waypointId - The ID of the waypoint to toggle.
 * @param {boolean} isChecked - The new checked state from the checkbox.
 */
function toggleMultiSelectWaypoint(waypointId, isChecked) {
    const waypoint = waypoints.find(wp => wp.id === waypointId);
    if (!waypoint) return;

    if (isChecked) {
        selectedForMultiEdit.add(waypointId);
        if (selectedWaypoint) {
            const oldSelected = selectedWaypoint;
            selectedWaypoint = null;
            updateMarkerIconStyle(oldSelected); 
            if (waypointControlsDiv) waypointControlsDiv.style.display = 'none';
        }
    } else {
        selectedForMultiEdit.delete(waypointId);
    }

    updateMarkerIconStyle(waypoint); 

    if (selectAllWaypointsCheckboxEl) {
        const allWaypointsSelected = waypoints.length > 0 && waypoints.every(wp => selectedForMultiEdit.has(wp.id));
        selectAllWaypointsCheckboxEl.checked = allWaypointsSelected;
    }

    updateWaypointList(); 
    updateMultiEditPanelVisibility(); 
}

/**
 * Toggles the selection state of all waypoints for multi-editing.
 * @param {boolean} isChecked - True to select all, false to deselect all.
 */
function toggleSelectAllWaypoints(isChecked) {
    selectedForMultiEdit.clear(); 
    if (isChecked) {
        waypoints.forEach(wp => selectedForMultiEdit.add(wp.id));
    }

    if (selectedWaypoint) {
        const oldSelected = selectedWaypoint;
        selectedWaypoint = null;
        if (waypointControlsDiv) waypointControlsDiv.style.display = 'none';
        updateMarkerIconStyle(oldSelected); 
    }

    waypoints.forEach(wp => updateMarkerIconStyle(wp)); 
    updateWaypointList(); 
    updateMultiEditPanelVisibility(); 
}

/**
 * Clears the current multi-selection of waypoints.
 */
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

/**
 * Applies bulk edits to all waypoints currently in the multi-selection set.
 */
function applyMultiEdit() {
    if (selectedForMultiEdit.size === 0) {
        showCustomAlert("No waypoints selected for multi-edit.", "Warning");
        return;
    }
    if (!multiHeadingControlSelect || !multiFixedHeadingSlider || !multiCameraActionSelect ||
        !multiChangeGimbalPitchCheckbox || !multiGimbalPitchSlider ||
        !multiChangeHoverTimeCheckbox || !multiHoverTimeSlider || !multiTargetPoiSelect) {
        showCustomAlert("Multi-edit controls not found.", "Internal Error");
        return;
    }

    const newHeadingControl = multiHeadingControlSelect.value;
    const newFixedHeading = parseInt(multiFixedHeadingSlider.value);
    const newCameraAction = multiCameraActionSelect.value;
    const changeGimbal = multiChangeGimbalPitchCheckbox.checked;
    const newGimbalPitch = parseInt(multiGimbalPitchSlider.value);
    const changeHover = multiChangeHoverTimeCheckbox.checked;
    const newHoverTime = parseInt(multiHoverTimeSlider.value);
    const newTargetPoiId = (newHeadingControl === 'poi_track' && multiTargetPoiSelect.value) ? parseInt(multiTargetPoiSelect.value) : null;

    let changesMadeToAtLeastOneWp = false;

    waypoints.forEach(wp => {
        if (selectedForMultiEdit.has(wp.id)) {
            let wpChangedThisIteration = false;
            if (newHeadingControl) { 
                wp.headingControl = newHeadingControl;
                if (newHeadingControl === 'fixed') {
                    wp.fixedHeading = newFixedHeading;
                    wp.targetPoiId = null; 
                } else if (newHeadingControl === 'poi_track') {
                    wp.targetPoiId = newTargetPoiId;
                } else { 
                    wp.targetPoiId = null;
                }
                wpChangedThisIteration = true;
            }
            if (newCameraAction) { 
                wp.cameraAction = newCameraAction;
                wpChangedThisIteration = true;
            }
            if (changeGimbal) {
                wp.gimbalPitch = newGimbalPitch;
                wpChangedThisIteration = true;
            }
            if (changeHover) {
                wp.hoverTime = newHoverTime;
                wpChangedThisIteration = true;
            }
            if (wpChangedThisIteration) {
                changesMadeToAtLeastOneWp = true;
                updateMarkerIconStyle(wp); // Update marker for this waypoint
            }
        }
    });

    if (changesMadeToAtLeastOneWp) {
        updateWaypointList();
        updateFlightStatistics(); 
        showCustomAlert(`${selectedForMultiEdit.size} waypoints were updated.`, "Success");
    } else {
        showCustomAlert("No changes specified or no valid values for changes. Waypoints not modified.", "Info");
    }

    multiHeadingControlSelect.value = ""; 
    if (multiFixedHeadingGroupDiv) multiFixedHeadingGroupDiv.style.display = 'none';
    if (multiTargetPoiForHeadingGroupDiv) multiTargetPoiForHeadingGroupDiv.style.display = 'none';
    multiFixedHeadingSlider.value = 0;
    if (multiFixedHeadingValueEl) multiFixedHeadingValueEl.textContent = "0°";

    multiCameraActionSelect.value = ""; 

    multiChangeGimbalPitchCheckbox.checked = false;
    multiGimbalPitchSlider.disabled = true;
    multiGimbalPitchSlider.value = 0;
    if (multiGimbalPitchValueEl) multiGimbalPitchValueEl.textContent = "0°";

    multiChangeHoverTimeCheckbox.checked = false;
    multiHoverTimeSlider.disabled = true;
    multiHoverTimeSlider.value = 0;
    if (multiHoverTimeValueEl) multiHoverTimeValueEl.textContent = "0s";

    if(multiTargetPoiSelect) multiTargetPoiSelect.value = "";

    clearMultiSelection(); 
}
