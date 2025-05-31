// File: waypointManager.js

// Depends on: config.js, utils.js, uiUpdater.js, mapManager.js, flightPathManager.js

/**
 * Adds a new waypoint to the map and list.
 * @param {L.LatLng} latlng - The latitude and longitude for the new waypoint.
 * @param {object} [options={}] - Optional parameters to override defaults for the new waypoint.
 *                                e.g., { altitude, hoverTime, gimbalPitch, etc. }
 */
function addWaypoint(latlng, options = {}) {
    if (!map || !defaultAltitudeSlider || !gimbalPitchSlider) return;

    const newWaypoint = {
        id: waypointCounter++,
        latlng: L.latLng(latlng.lat, latlng.lng),
        altitude: options.altitude !== undefined ? options.altitude : parseInt(defaultAltitudeSlider.value),
        hoverTime: options.hoverTime !== undefined ? options.hoverTime : 0,
        gimbalPitch: options.gimbalPitch !== undefined ? options.gimbalPitch : parseInt(gimbalPitchSlider.value), // Default from current general gimbal pitch
        headingControl: options.headingControl || 'auto',
        fixedHeading: options.fixedHeading || 0,
        cameraAction: options.cameraAction || 'none',
        targetPoiId: options.targetPoiId || null,
        marker: null // Marker will be created below
    };

    const marker = L.marker(newWaypoint.latlng, {
        draggable: true,
        icon: createWaypointIcon(newWaypoint.id, false, false) // from mapManager.js
    }).addTo(map);

    marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e); // Prevent map click
        selectWaypoint(newWaypoint);
    });
    marker.on('dragend', () => {
        newWaypoint.latlng = marker.getLatLng();
        updateFlightPath();
        updateFlightStatistics();
        updateWaypointList(); // Update coordinates in the list
    });
    marker.on('drag', () => { // Live update during drag
        newWaypoint.latlng = marker.getLatLng();
        updateFlightPath();
    });
    newWaypoint.marker = marker;

    waypoints.push(newWaypoint);

    updateWaypointList();
    updateFlightPath();
    updateFlightStatistics();
    selectWaypoint(newWaypoint); // Select the newly added waypoint
}

/**
 * Selects a waypoint, updating UI and map markers.
 * @param {object} waypoint - The waypoint object to select.
 */
function selectWaypoint(waypoint) {
    if (!waypoint) return;

    const previouslySelectedSingleId = selectedWaypoint ? selectedWaypoint.id : null;

    // If multi-selection is active, clicking a waypoint should ideally clear multi-select
    // and then select the single waypoint.
    if (selectedForMultiEdit.size > 0) {
        clearMultiSelection(); // This will update markers and list
    }

    selectedWaypoint = waypoint;

    // Update icon for the previously selected waypoint (if different from current)
    if (previouslySelectedSingleId && previouslySelectedSingleId !== waypoint.id) {
        const prevWp = waypoints.find(wp => wp.id === previouslySelectedSingleId);
        if (prevWp) updateMarkerIconStyle(prevWp);
    }

    // Update icon for the newly selected waypoint
    updateMarkerIconStyle(selectedWaypoint);

    // Update all other waypoint markers to ensure they are not styled as 'single selected'
    waypoints.forEach(wp => {
        if (wp.id !== selectedWaypoint.id) {
            updateMarkerIconStyle(wp);
        }
    });

    updateSingleWaypointEditControls(); // from uiUpdater.js
    updateWaypointList(); // Refreshes list, highlighting the selected item

    if (selectedWaypoint.marker) {
        map.panTo(selectedWaypoint.latlng); // Pan map to the selected waypoint
    }
    updateMultiEditPanelVisibility(); // Ensure multi-edit panel is hidden
}

/**
 * Deletes the currently selected waypoint.
 */
function deleteSelectedWaypoint() {
    if (!selectedWaypoint) {
        showCustomAlert("No waypoint selected to delete.", "Info");
        return;
    }

    if (selectedWaypoint.marker) {
        map.removeLayer(selectedWaypoint.marker);
    }

    const deletedWaypointId = selectedWaypoint.id;
    waypoints = waypoints.filter(wp => wp.id !== deletedWaypointId);

    // If the deleted waypoint was also in multi-select, remove it
    if (selectedForMultiEdit.has(deletedWaypointId)) {
        selectedForMultiEdit.delete(deletedWaypointId);
        // No need to call updateMarkerIconStyle here as the marker is gone
    }

    selectedWaypoint = null;
    if (waypointControlsDiv) waypointControlsDiv.style.display = 'none';

    updateWaypointList();
    updateFlightPath();
    updateFlightStatistics();
    updateMultiEditPanelVisibility(); // Check if multi-edit panel needs to update/hide
    showCustomAlert("Waypoint deleted.", "Success");

    // Optionally, select the previous or next waypoint if list is not empty
    if (waypoints.length > 0) {
        // Logic to select another waypoint could be added here
        // For now, just deselects.
    }
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
    waypointCounter = 1; // Reset counter
    actionGroupCounter = 1; // Reset for DJI export
    actionCounter = 1;    // Reset for DJI export

    clearMultiSelection(); // Clears multi-select set and updates UI

    if (waypointControlsDiv) waypointControlsDiv.style.display = 'none';
    updateWaypointList();
    updateFlightPath();
    updateFlightStatistics();
    // updateMultiEditPanelVisibility() is called by clearMultiSelection
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
        // If a single waypoint was selected, and now user starts multi-selecting,
        // deselect the single waypoint to avoid confusion and show multi-edit panel.
        if (selectedWaypoint) {
            const oldSelected = selectedWaypoint;
            selectedWaypoint = null;
            updateMarkerIconStyle(oldSelected); // Revert style of previously single-selected
            if (waypointControlsDiv) waypointControlsDiv.style.display = 'none';
        }
    } else {
        selectedForMultiEdit.delete(waypointId);
    }

    updateMarkerIconStyle(waypoint); // Update the toggled waypoint's marker

    // Update "Select All" checkbox state
    if (selectAllWaypointsCheckboxEl) {
        const allWaypointsSelected = waypoints.length > 0 && waypoints.every(wp => selectedForMultiEdit.has(wp.id));
        selectAllWaypointsCheckboxEl.checked = allWaypointsSelected;
    }

    updateWaypointList(); // Refresh list item styles
    updateMultiEditPanelVisibility(); // Show/hide multi-edit panel
}

/**
 * Toggles the selection state of all waypoints for multi-editing.
 * @param {boolean} isChecked - True to select all, false to deselect all.
 */
function toggleSelectAllWaypoints(isChecked) {
    selectedForMultiEdit.clear(); // Clear previous selections first
    if (isChecked) {
        waypoints.forEach(wp => selectedForMultiEdit.add(wp.id));
    }

    // If a single waypoint was selected, deselect it as we are moving to multi-edit mode
    if (selectedWaypoint) {
        const oldSelected = selectedWaypoint;
        selectedWaypoint = null;
        if (waypointControlsDiv) waypointControlsDiv.style.display = 'none';
        updateMarkerIconStyle(oldSelected); // Ensure its icon is updated if it wasn't part of the new multi-select
    }


    waypoints.forEach(wp => updateMarkerIconStyle(wp)); // Update all marker icons
    updateWaypointList(); // Refresh list item styles
    updateMultiEditPanelVisibility(); // Show/hide multi-edit panel
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
        if (waypoint) updateMarkerIconStyle(waypoint); // Update markers that were deselected
    });

    updateWaypointList(); // Refresh list item styles
    updateMultiEditPanelVisibility(); // Hide multi-edit panel, potentially show single if one was selected
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
            if (newHeadingControl) { // Apply if a heading control option was chosen (not the default blank)
                wp.headingControl = newHeadingControl;
                if (newHeadingControl === 'fixed') {
                    wp.fixedHeading = newFixedHeading;
                    wp.targetPoiId = null; // Clear POI target if setting to fixed
                } else if (newHeadingControl === 'poi_track') {
                    wp.targetPoiId = newTargetPoiId;
                } else { // For 'auto' or other non-POI/fixed modes
                    wp.targetPoiId = null;
                }
                wpChangedThisIteration = true;
            }
            if (newCameraAction) { // Apply if a camera action was chosen
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
            if (wpChangedThisIteration) changesMadeToAtLeastOneWp = true;
        }
    });

    if (changesMadeToAtLeastOneWp) {
        updateWaypointList();
        updateFlightStatistics(); // Hover time might have changed
        showCustomAlert(`${selectedForMultiEdit.size} waypoints were updated.`, "Success");
    } else {
        showCustomAlert("No changes specified or no valid values for changes. Waypoints not modified.", "Info");
    }

    // Reset multi-edit form fields to default/empty states
    multiHeadingControlSelect.value = ""; // Assuming "" is the placeholder/default
    if (multiFixedHeadingGroupDiv) multiFixedHeadingGroupDiv.style.display = 'none';
    if (multiTargetPoiForHeadingGroupDiv) multiTargetPoiForHeadingGroupDiv.style.display = 'none';
    multiFixedHeadingSlider.value = 0;
    if (multiFixedHeadingValueEl) multiFixedHeadingValueEl.textContent = "0°";

    multiCameraActionSelect.value = ""; // Assuming "" is placeholder

    multiChangeGimbalPitchCheckbox.checked = false;
    multiGimbalPitchSlider.disabled = true;
    multiGimbalPitchSlider.value = 0;
    if (multiGimbalPitchValueEl) multiGimbalPitchValueEl.textContent = "0°";

    multiChangeHoverTimeCheckbox.checked = false;
    multiHoverTimeSlider.disabled = true;
    multiHoverTimeSlider.value = 0;
    if (multiHoverTimeValueEl) multiHoverTimeValueEl.textContent = "0s";

    if(multiTargetPoiSelect) multiTargetPoiSelect.value = "";


    clearMultiSelection(); // Clear the selection set and update UI
}