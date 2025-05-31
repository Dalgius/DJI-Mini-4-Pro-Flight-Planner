// File: eventListeners.js

// Depends on: config.js (for DOM element vars), domCache.js (to ensure elements are cached)
// Depends on: All manager modules for their respective functions called by event handlers
// (mapManager, uiUpdater, waypointManager, poiManager, orbitManager, terrainManager, importExportManager, flightPathManager)

function setupEventListeners() {
    // --- Flight Settings Panel ---
    if (defaultAltitudeSlider) {
        defaultAltitudeSlider.addEventListener('input', () => {
            if (defaultAltitudeValueEl) defaultAltitudeValueEl.textContent = defaultAltitudeSlider.value + 'm';
            // If a waypoint is selected, changing default altitude doesn't affect it directly
            // unless new waypoints are added.
        });
    }
    if (flightSpeedSlider) {
        flightSpeedSlider.addEventListener('input', () => {
            if (flightSpeedValueEl) flightSpeedValueEl.textContent = flightSpeedSlider.value + ' m/s';
            updateFlightStatistics(); // Flight time depends on speed
        });
    }
    if (pathTypeSelect) {
        pathTypeSelect.addEventListener('change', updateFlightPath); // Redraw path on type change
    }

    // --- Selected Waypoint Controls Panel ---
    if (waypointAltitudeSlider) {
        waypointAltitudeSlider.addEventListener('input', () => {
            if (!selectedWaypoint || !waypointAltitudeValueEl) return;
            waypointAltitudeValueEl.textContent = waypointAltitudeSlider.value + 'm';
            selectedWaypoint.altitude = parseInt(waypointAltitudeSlider.value);
            updateWaypointList(); // Reflect change in the list
            // updateFlightPath(); // Altitude change might affect 3D path view if implemented
            // updateFlightStatistics(); // Altitude doesn't usually affect basic 2D stats
        });
    }
    if (hoverTimeSlider) {
        hoverTimeSlider.addEventListener('input', () => {
            if (!selectedWaypoint || !hoverTimeValueEl) return;
            hoverTimeValueEl.textContent = hoverTimeSlider.value + 's';
            selectedWaypoint.hoverTime = parseInt(hoverTimeSlider.value);
            updateFlightStatistics(); // Hover time affects total flight duration
            updateWaypointList(); // Reflect change in the list
        });
    }
    if (gimbalPitchSlider) {
        gimbalPitchSlider.addEventListener('input', () => {
            if (!selectedWaypoint || !gimbalPitchValueEl) return;
            gimbalPitchValueEl.textContent = gimbalPitchSlider.value + '°';
            selectedWaypoint.gimbalPitch = parseInt(gimbalPitchSlider.value);
            // No direct list/stat update needed for gimbal pitch typically
        });
    }
    if (fixedHeadingSlider) {
        fixedHeadingSlider.addEventListener('input', () => {
            if (!selectedWaypoint || !fixedHeadingValueEl) return;
            fixedHeadingValueEl.textContent = fixedHeadingSlider.value + '°';
            selectedWaypoint.fixedHeading = parseInt(fixedHeadingSlider.value);
        });
    }
    if (headingControlSelect) {
        headingControlSelect.addEventListener('change', function() {
            if (!selectedWaypoint || !fixedHeadingGroupDiv || !targetPoiForHeadingGroupDiv) return;
            const selectedValue = this.value;
            selectedWaypoint.headingControl = selectedValue;

            fixedHeadingGroupDiv.style.display = selectedValue === 'fixed' ? 'block' : 'none';
            targetPoiForHeadingGroupDiv.style.display = selectedValue === 'poi_track' ? 'block' : 'none';

            if (selectedValue === 'poi_track') {
                populatePoiSelectDropdown(targetPoiSelect, selectedWaypoint.targetPoiId, true, "-- Select POI for Heading --");
            } else {
                selectedWaypoint.targetPoiId = null; // Clear POI target if not in POI track mode
            }
            updateWaypointList(); // Reflect heading/target changes in the list
        });
    }
    if (targetPoiSelect) {
        targetPoiSelect.addEventListener('change', function() {
            if (selectedWaypoint) {
                selectedWaypoint.targetPoiId = this.value ? parseInt(this.value) : null;
                updateWaypointList(); // Reflect target POI change
            }
        });
    }
    if (cameraActionSelect) {
        cameraActionSelect.addEventListener('change', function() {
            if (selectedWaypoint) {
                selectedWaypoint.cameraAction = this.value;
                updateWaypointList(); // Reflect camera action change in the list
            }
        });
    }
    if (deleteSelectedWaypointBtn) {
        deleteSelectedWaypointBtn.addEventListener('click', deleteSelectedWaypoint);
    }

    // --- POI Input ---
    // addPOI is called from map click; direct button for POI add could be here if exists.
    // Deletion is handled by buttons in the dynamic POI list (uiUpdater.js)

    // --- Multi-Waypoint Edit Panel ---
    if (selectAllWaypointsCheckboxEl) {
        selectAllWaypointsCheckboxEl.addEventListener('change', (e) => toggleSelectAllWaypoints(e.target.checked));
    }
    if (multiHeadingControlSelect) {
        multiHeadingControlSelect.addEventListener('change', function() {
            if (!multiFixedHeadingGroupDiv || !multiTargetPoiForHeadingGroupDiv || !multiTargetPoiSelect) return;
            multiFixedHeadingGroupDiv.style.display = this.value === 'fixed' ? 'block' : 'none';
            multiTargetPoiForHeadingGroupDiv.style.display = this.value === 'poi_track' ? 'block' : 'none';
            if (this.value === 'poi_track') {
                populatePoiSelectDropdown(multiTargetPoiSelect, null, true, "-- Select POI for all --");
            }
        });
    }
    if (multiFixedHeadingSlider) {
        multiFixedHeadingSlider.addEventListener('input', function() {
            if (multiFixedHeadingValueEl) multiFixedHeadingValueEl.textContent = this.value + '°';
        });
    }
    if (multiCameraActionSelect) {
        // No specific 'input' listener needed, value is read on apply.
    }
    if (multiChangeGimbalPitchCheckbox) {
        multiChangeGimbalPitchCheckbox.addEventListener('change', function() {
            if (!multiGimbalPitchSlider || !multiGimbalPitchValueEl) return;
            multiGimbalPitchSlider.disabled = !this.checked;
            if (!this.checked) { // Reset if unchecked
                multiGimbalPitchSlider.value = 0; // Or some default
                multiGimbalPitchValueEl.textContent = multiGimbalPitchSlider.value + '°';
            }
        });
    }
    if (multiGimbalPitchSlider) {
        multiGimbalPitchSlider.addEventListener('input', function() {
            if (multiGimbalPitchValueEl) multiGimbalPitchValueEl.textContent = this.value + '°';
        });
    }
    if (multiChangeHoverTimeCheckbox) {
        multiChangeHoverTimeCheckbox.addEventListener('change', function() {
            if (!multiHoverTimeSlider || !multiHoverTimeValueEl) return;
            multiHoverTimeSlider.disabled = !this.checked;
            if (!this.checked) { // Reset if unchecked
                multiHoverTimeSlider.value = 0; // Or some default
                multiHoverTimeValueEl.textContent = multiHoverTimeSlider.value + 's';
            }
        });
    }
    if (multiHoverTimeSlider) {
        multiHoverTimeSlider.addEventListener('input', function() {
            if (multiHoverTimeValueEl) multiHoverTimeValueEl.textContent = this.value + 's';
        });
    }
    if (applyMultiEditBtn) {
        applyMultiEditBtn.addEventListener('click', applyMultiEdit);
    }
    if (clearMultiSelectionBtn) {
        clearMultiSelectionBtn.addEventListener('click', clearMultiSelection);
    }

    // --- Terrain & Orbit Tools ---
    if (getHomeElevationBtn) {
        getHomeElevationBtn.addEventListener('click', getHomeElevationFromFirstWaypoint);
    }
    if (adaptToAGLBtnEl) {
        adaptToAGLBtnEl.addEventListener('click', adaptAltitudesToAGL);
    }
    if (createOrbitBtn) {
        createOrbitBtn.addEventListener('click', showOrbitDialog);
    }

    // --- Import/Export Buttons ---
    if (importJsonBtn) {
        importJsonBtn.addEventListener('click', triggerImport);
    }
    if (fileInputEl) { // The actual file input element
        fileInputEl.addEventListener('change', handleFileImport);
    }
    if (exportJsonBtn) {
        exportJsonBtn.addEventListener('click', exportFlightPlanToJson);
    }
    if (exportKmzBtn) {
        exportKmzBtn.addEventListener('click', exportToDjiWpmlKmz);
    }
    if (exportGoogleEarthBtn) {
        exportGoogleEarthBtn.addEventListener('click', exportToGoogleEarthKml);
    }

    // --- General Action Buttons ---
    if (clearWaypointsBtn) {
        clearWaypointsBtn.addEventListener('click', clearWaypoints);
    }

    // --- Map Control Buttons ---
    if (satelliteToggleBtn) {
        satelliteToggleBtn.addEventListener('click', toggleSatelliteView);
    }
    if (fitMapBtn) {
        fitMapBtn.addEventListener('click', fitMapToWaypoints);
    }
    if (myLocationBtn) {
        myLocationBtn.addEventListener('click', showCurrentLocation);
    }

    // --- Modal Buttons ---
    if (customAlertOkButtonEl) {
        customAlertOkButtonEl.addEventListener('click', () => {
            if (customAlertOverlayEl) customAlertOverlayEl.style.display = 'none';
        });
    }
    if (confirmOrbitBtnEl) {
        confirmOrbitBtnEl.addEventListener('click', handleConfirmOrbit);
    }
    if (cancelOrbitBtnEl) {
        cancelOrbitBtnEl.addEventListener('click', () => {
            if (orbitModalOverlayEl) orbitModalOverlayEl.style.display = 'none';
        });
    }
}