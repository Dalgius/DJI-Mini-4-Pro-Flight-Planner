// File: uiUpdater.js

// Depends on: config.js, utils.js, waypointManager.js (for selectWaypoint, toggleMultiSelectWaypoint), mapManager.js (for updateMarkerIconStyle)

/**
 * Updates the flight statistics displayed in the sidebar.
 */
function updateFlightStatistics() {
    if (!totalDistanceEl || !flightTimeEl || !waypointCountEl || !poiCountEl || !flightSpeedSlider || !pathTypeSelect) return;

    let totalDist = 0;
    const speed = parseFloat(flightSpeedSlider.value) || 1;

    if (waypoints.length >= 2) {
        // Use actual flightPath for distance if curved and available, otherwise straight lines between waypoints
        const pathLatLngs = (pathTypeSelect.value === 'curved' && flightPath && flightPath.getLatLngs) ?
                            flightPath.getLatLngs() :
                            waypoints.map(wp => wp.latlng);

        for (let i = 0; i < pathLatLngs.length - 1; i++) {
            totalDist += haversineDistance(pathLatLngs[i], pathLatLngs[i + 1]);
        }
    }

    let totalHover = waypoints.reduce((sum, wp) => sum + (wp.hoverTime || 0), 0);
    const flightDurationSec = (totalDist / (speed > 0 ? speed : 1)) + totalHover;
    const mins = Math.floor(flightDurationSec / 60);
    const secs = Math.round(flightDurationSec % 60);

    totalDistanceEl.textContent = `${Math.round(totalDist)} m`;
    flightTimeEl.textContent = `${mins} min ${secs} sec`;
    waypointCountEl.textContent = waypoints.length;
    poiCountEl.textContent = pois.length;
}

/**
 * Populates a select dropdown with available POIs.
 * @param {HTMLSelectElement} selectElement - The <select> DOM element.
 * @param {number|null} [selectedPoiId=null] - The ID of the POI to be pre-selected.
 * @param {boolean} [addDefaultOption=true] - Whether to add a default "-- Select POI --" option.
 * @param {string} [defaultOptionText="-- Select POI --"] - Text for the default option.
 */
function populatePoiSelectDropdown(selectElement, selectedPoiId = null, addDefaultOption = true, defaultOptionText = "-- Select POI --") {
    if (!selectElement) return;
    selectElement.innerHTML = ''; // Clear existing options

    if (addDefaultOption) {
        const defaultOpt = document.createElement('option');
        defaultOpt.value = "";
        defaultOpt.textContent = defaultOptionText;
        selectElement.appendChild(defaultOpt);
    }

    if (pois.length === 0) {
        selectElement.disabled = true;
        if (addDefaultOption && selectElement.options[0]) {
            selectElement.options[0].textContent = "No POIs available";
        }
        return;
    }

    selectElement.disabled = false;
    if (addDefaultOption && selectElement.options[0] && selectElement.options[0].textContent === "No POIs available") {
        selectElement.options[0].textContent = defaultOptionText;
    }

    pois.forEach(poi => {
        const option = document.createElement('option');
        option.value = poi.id;
        option.textContent = `${poi.name} (ID: ${poi.id})`;
        if (selectedPoiId !== null && poi.id === parseInt(selectedPoiId)) {
            option.selected = true;
        }
        selectElement.appendChild(option);
    });
}


/**
 * Updates the list of waypoints displayed in the sidebar.
 */
function updateWaypointList() {
    if (!waypointListEl || !selectAllWaypointsCheckboxEl) return;

    if (waypoints.length === 0) {
        waypointListEl.innerHTML = '<div style="text-align: center; color: #95a5a6; font-size: 12px; padding: 20px;">Click on map to add waypoints</div>';
        selectAllWaypointsCheckboxEl.checked = false;
        selectAllWaypointsCheckboxEl.disabled = true;
        // Ensure multi-edit panel is hidden if no waypoints
        if (selectedForMultiEdit.size === 0) updateMultiEditPanelVisibility();
        return;
    }
    selectAllWaypointsCheckboxEl.disabled = false;

    waypointListEl.innerHTML = waypoints.map(wp => {
        let actionText = getCameraActionText(wp.cameraAction);
        let hoverText = wp.hoverTime > 0 ? ` | Hover: ${wp.hoverTime}s` : '';
        let poiTargetText = '';
        if (wp.headingControl === 'poi_track' && wp.targetPoiId != null) {
            const target = pois.find(p => p.id === wp.targetPoiId);
            poiTargetText = target ? ` | Target: ${target.name}` : ` | Target: POI ID ${wp.targetPoiId} (not found)`;
        }
        let actionInfo = actionText ? `<div class="waypoint-action-info">Action: ${actionText}${poiTargetText}</div>` : (poiTargetText ? `<div class="waypoint-action-info">${poiTargetText.substring(3)}</div>` : '');

        const isSelectedForMulti = selectedForMultiEdit.has(wp.id);
        let itemClasses = "waypoint-item";

        // A waypoint list item is 'selected' if it's the `selectedWaypoint` AND single edit panel is active AND it's NOT also in multi-edit mode (multi-edit takes precedence for styling if active)
        if (selectedWaypoint && wp.id === selectedWaypoint.id && waypointControlsDiv && waypointControlsDiv.style.display === 'block' && !multiWaypointEditControlsDivIsVisible()) {
             itemClasses += " selected";
        }
        if (isSelectedForMulti) {
            itemClasses += " multi-selected-item";
        }


        return `
        <div class="${itemClasses}" onclick="handleWaypointListItemClick(${wp.id})">
            <div style="display: flex; align-items: center;">
                <input type="checkbox" class="waypoint-multi-select-cb" data-id="${wp.id}"
                       onchange="handleWaypointListCheckboxChange(${wp.id}, this.checked)"
                       ${isSelectedForMulti ? 'checked' : ''}
                       style="margin-right: 10px; transform: scale(1.2);"
                       onclick="event.stopPropagation();"> {/* Prevent click from bubbling to item's selectWaypoint */}
                <div>
                    <div class="waypoint-header"><span class="waypoint-name">Waypoint ${wp.id}</span></div>
                    <div class="waypoint-coords">Lat: ${wp.latlng.lat.toFixed(4)}, Lng: ${wp.latlng.lng.toFixed(4)}<br>Alt: ${wp.altitude}m${hoverText}</div>
                    ${actionInfo}
                </div>
            </div>
        </div>`;
    }).join('');

    // Ensure multi-edit panel visibility is correct after list update
    if (waypoints.length === 0 && selectedForMultiEdit.size === 0) {
        updateMultiEditPanelVisibility();
    }
}

/**
 * Helper to check if multi-waypoint edit panel is currently visible.
 * @returns {boolean}
 */
function multiWaypointEditControlsDivIsVisible() {
    return multiWaypointEditControlsDiv && multiWaypointEditControlsDiv.style.display === 'block';
}


/**
 * Handles click on a waypoint item in the list.
 * This should call the main selectWaypoint function.
 * @param {number} wpId - The ID of the waypoint clicked.
 */
function handleWaypointListItemClick(wpId) {
    const wp = waypoints.find(w => w.id === wpId);
    if (wp) {
        selectWaypoint(wp); // Assumes selectWaypoint is globally available or imported
    }
}

/**
 * Handles checkbox change for multi-selecting a waypoint from the list.
 * This should call the main toggleMultiSelectWaypoint function.
 * @param {number} waypointId - The ID of the waypoint.
 * @param {boolean} isChecked - The new checked state of the checkbox.
 */
function handleWaypointListCheckboxChange(waypointId, isChecked) {
    toggleMultiSelectWaypoint(waypointId, isChecked); // Assumes toggleMultiSelectWaypoint is globally available or imported
}


/**
 * Updates the display of the POI list in the sidebar.
 */
function updatePOIList() {
    if (!poiListEl) return;
    const noPoiAvailableText = "No POIs available";

    if (pois.length === 0) {
        poiListEl.innerHTML = '<div style="text-align: center; color: #95a5a6; font-size: 12px; padding: 10px;">No POIs added</div>';
        // Disable POI select dropdowns if they exist
        if (targetPoiSelect) {
            targetPoiSelect.disabled = true;
            targetPoiSelect.innerHTML = `<option value="">${noPoiAvailableText}</option>`;
        }
        if (multiTargetPoiSelect) {
            multiTargetPoiSelect.disabled = true;
            multiTargetPoiSelect.innerHTML = `<option value="">${noPoiAvailableText}</option>`;
        }
        if (orbitPoiSelectEl) { // Also for the orbit modal
            orbitPoiSelectEl.disabled = true;
            orbitPoiSelectEl.innerHTML = `<option value="">${noPoiAvailableText}</option>`;
        }
        return;
    }

    // Enable POI select dropdowns if they were disabled
    if (targetPoiSelect) targetPoiSelect.disabled = false;
    if (multiTargetPoiSelect) multiTargetPoiSelect.disabled = false;
    if (orbitPoiSelectEl) orbitPoiSelectEl.disabled = false;
    // Note: populatePoiSelectDropdown will handle repopulating them if needed elsewhere.
    // This function just ensures they are enabled/disabled.

    poiListEl.innerHTML = pois.map(poi => `
        <div class="poi-item">
            <span class="poi-name">${poi.name} (ID: ${poi.id})</span>
            <button class="poi-delete" onclick="deletePOI(${poi.id})" title="Delete POI ${poi.name}">✕</button> {/* Assumes deletePOI is global or imported */}
        </div>`).join('');
}

/**
 * Updates the visibility and content of the multi-waypoint edit panel.
 */
function updateMultiEditPanelVisibility() {
    if (!multiWaypointEditControlsDiv || !selectedWaypointsCountEl || !waypointControlsDiv) return;

    const count = selectedForMultiEdit.size;
    if (count > 0) {
        multiWaypointEditControlsDiv.style.display = 'block';
        selectedWaypointsCountEl.textContent = count;
        waypointControlsDiv.style.display = 'none'; // Hide single edit panel

        // Populate POI dropdown for multi-edit if heading control is POI track
        if (multiHeadingControlSelect && multiHeadingControlSelect.value === 'poi_track') {
            populatePoiSelectDropdown(multiTargetPoiSelect, null, true, "-- Select POI for all --");
            if (multiTargetPoiForHeadingGroupDiv) multiTargetPoiForHeadingGroupDiv.style.display = 'block';
        } else {
            if (multiTargetPoiForHeadingGroupDiv) multiTargetPoiForHeadingGroupDiv.style.display = 'none';
        }
    } else {
        multiWaypointEditControlsDiv.style.display = 'none';
        // Show single edit panel if a waypoint is selected, otherwise hide it too
        if (selectedWaypoint) {
            waypointControlsDiv.style.display = 'block';
        } else {
            waypointControlsDiv.style.display = 'none';
        }
    }
}

/**
 * Updates the single waypoint editing controls in the sidebar with the selected waypoint's data.
 */
function updateSingleWaypointEditControls() {
    if (!selectedWaypoint || !waypointControlsDiv || !waypointAltitudeSlider || !hoverTimeSlider || !gimbalPitchSlider || !headingControlSelect || !fixedHeadingSlider || !cameraActionSelect) {
        if (waypointControlsDiv) waypointControlsDiv.style.display = 'none';
        return;
    }

    waypointAltitudeSlider.value = selectedWaypoint.altitude;
    if (waypointAltitudeValueEl) waypointAltitudeValueEl.textContent = selectedWaypoint.altitude + 'm';

    hoverTimeSlider.value = selectedWaypoint.hoverTime;
    if (hoverTimeValueEl) hoverTimeValueEl.textContent = selectedWaypoint.hoverTime + 's';

    gimbalPitchSlider.value = selectedWaypoint.gimbalPitch;
    if (gimbalPitchValueEl) gimbalPitchValueEl.textContent = selectedWaypoint.gimbalPitch + '°';

    headingControlSelect.value = selectedWaypoint.headingControl;
    fixedHeadingSlider.value = selectedWaypoint.fixedHeading;
    if (fixedHeadingValueEl) fixedHeadingValueEl.textContent = selectedWaypoint.fixedHeading + '°';

    cameraActionSelect.value = selectedWaypoint.cameraAction || 'none';

    // Show/hide specific controls based on heading control type
    if (fixedHeadingGroupDiv) fixedHeadingGroupDiv.style.display = selectedWaypoint.headingControl === 'fixed' ? 'block' : 'none';
    const showPoiSelect = selectedWaypoint.headingControl === 'poi_track';
    if (targetPoiForHeadingGroupDiv) targetPoiForHeadingGroupDiv.style.display = showPoiSelect ? 'block' : 'none';

    if (showPoiSelect) {
        populatePoiSelectDropdown(targetPoiSelect, selectedWaypoint.targetPoiId, true, "-- Select POI for Heading --");
    }

    waypointControlsDiv.style.display = 'block';
}