// File: eventListeners.js

// Dipende da:
// - config.js (per le variabili DOM)
// - domCache.js (per assicurare che gli elementi siano cachati)
// - Tutti i moduli manager per le loro funzioni (chiamate ora tramite istanze o globalmente)
// - surveyGridManagerInstance (istanza globale da surveyGridManager.js)

function setupEventListeners() {
    // --- Flight Settings Panel ---
    if (defaultAltitudeSlider) {
        defaultAltitudeSlider.addEventListener('input', () => {
            if (defaultAltitudeValueEl) defaultAltitudeValueEl.textContent = defaultAltitudeSlider.value + 'm';
        });
    }
    if (flightSpeedSlider) {
        flightSpeedSlider.addEventListener('input', () => {
            if (flightSpeedValueEl) flightSpeedValueEl.textContent = flightSpeedSlider.value + ' m/s';
            if (typeof updateFlightStatistics === 'function') updateFlightStatistics();
        });
    }
    if (pathTypeSelect) {
        pathTypeSelect.addEventListener('change', () => { if (typeof updateFlightPath === 'function') updateFlightPath(); });
    }

    // --- Selected Waypoint Controls Panel ---
    if (waypointAltitudeSlider) {
        waypointAltitudeSlider.addEventListener('input', () => {
            if (!selectedWaypoint || !waypointAltitudeValueEl) return;
            waypointAltitudeValueEl.textContent = waypointAltitudeSlider.value + 'm';
            selectedWaypoint.altitude = parseInt(waypointAltitudeSlider.value);
            if (typeof updateWaypointList === 'function') updateWaypointList();
        });
    }
    // ... (altri listener per hoverTime, gimbalPitch, fixedHeading, headingControl, targetPoiSelect, cameraActionSelect come prima) ...
     if (hoverTimeSlider) {
        hoverTimeSlider.addEventListener('input', () => {
            if (!selectedWaypoint || !hoverTimeValueEl) return;
            hoverTimeValueEl.textContent = hoverTimeSlider.value + 's';
            selectedWaypoint.hoverTime = parseInt(hoverTimeSlider.value);
            if(typeof updateFlightStatistics === 'function') updateFlightStatistics();
            if(typeof updateWaypointList === 'function') updateWaypointList();
        });
    }
    if (gimbalPitchSlider) {
        gimbalPitchSlider.addEventListener('input', () => {
            if (!selectedWaypoint || !gimbalPitchValueEl) return;
            gimbalPitchValueEl.textContent = gimbalPitchSlider.value + '°';
            selectedWaypoint.gimbalPitch = parseInt(gimbalPitchSlider.value);
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
            selectedWaypoint.headingControl = this.value;
            fixedHeadingGroupDiv.style.display = this.value === 'fixed' ? 'block' : 'none';
            targetPoiForHeadingGroupDiv.style.display = this.value === 'poi_track' ? 'block' : 'none';
            if (this.value === 'poi_track' && typeof populatePoiSelectDropdown === 'function') {
                populatePoiSelectDropdown(targetPoiSelect, selectedWaypoint.targetPoiId, true, "-- Select POI for Heading --");
            } else { selectedWaypoint.targetPoiId = null; }
            if(typeof updateWaypointList === 'function') updateWaypointList();
        });
    }
    if (targetPoiSelect) {
        targetPoiSelect.addEventListener('change', function() {
            if (selectedWaypoint) {
                selectedWaypoint.targetPoiId = this.value ? parseInt(this.value) : null;
                if(typeof updateWaypointList === 'function') updateWaypointList();
            }
        });
    }
    if (cameraActionSelect) {
        cameraActionSelect.addEventListener('change', function() {
            if (selectedWaypoint) {
                selectedWaypoint.cameraAction = this.value;
                if(typeof updateWaypointList === 'function') updateWaypointList();
            }
        });
    }
    if (deleteSelectedWaypointBtn) {
        deleteSelectedWaypointBtn.addEventListener('click', () => { if (typeof deleteSelectedWaypoint === 'function') deleteSelectedWaypoint(); });
    }

    // --- Multi-Waypoint Edit Panel ---
    // ... (tutti i listener per multi-waypoint edit come prima, assicurandosi che le funzioni chiamate siano disponibili globalmente o tramite istanze) ...
    if (selectAllWaypointsCheckboxEl) {
        selectAllWaypointsCheckboxEl.addEventListener('change', (e) => { if(typeof toggleSelectAllWaypoints === 'function') toggleSelectAllWaypoints(e.target.checked); });
    }
    // (ecc. per gli altri multi-edit)

    // --- Terrain & Orbit Tools ---
    if (getHomeElevationBtn) {
        getHomeElevationBtn.addEventListener('click', () => { if (typeof getHomeElevationFromFirstWaypoint === 'function') getHomeElevationFromFirstWaypoint(); });
    }
    if (adaptToAGLBtnEl) {
        adaptToAGLBtnEl.addEventListener('click', () => { if (typeof adaptAltitudesToAGL === 'function') adaptAltitudesToAGL(); });
    }
    if (createOrbitBtn) {
        createOrbitBtn.addEventListener('click', () => { if (typeof showOrbitDialog === 'function') showOrbitDialog(); });
    }

    // --- Survey Grid Modal ---
    // Assicurati che surveyGridManagerInstance sia definita globalmente da surveyGridManager.js
    if (createSurveyGridBtn) {
        console.log("[EventListeners] Adding click listener to createSurveyGridBtn");
        createSurveyGridBtn.addEventListener('click', () => {
            if (surveyGridManagerInstance && typeof surveyGridManagerInstance.openSurveyGridModal === 'function') {
                surveyGridManagerInstance.openSurveyGridModal();
            } else { console.error("surveyGridManagerInstance.openSurveyGridModal not found"); }
        });
    }
    if (setGridAngleByLineBtn) {
        console.log("[EventListeners] Adding click listener to setGridAngleByLineBtn");
        setGridAngleByLineBtn.addEventListener('click', () => {
            if (surveyGridManagerInstance && typeof surveyGridManagerInstance.handleSetGridAngleByLine === 'function') {
                surveyGridManagerInstance.handleSetGridAngleByLine();
            } else { console.error("surveyGridManagerInstance.handleSetGridAngleByLine not found"); }
        });
    }
    if (startDrawingSurveyAreaBtnEl) {
        console.log("[EventListeners] Adding click listener to startDrawingSurveyAreaBtnEl");
        startDrawingSurveyAreaBtnEl.addEventListener('click', () => {
            if (surveyGridManagerInstance && typeof surveyGridManagerInstance.handleStartDrawingSurveyArea === 'function') {
                surveyGridManagerInstance.handleStartDrawingSurveyArea();
            } else { console.error("surveyGridManagerInstance.handleStartDrawingSurveyArea not found"); }
        });
    }
    if (confirmSurveyGridBtnEl) {
        console.log("[EventListeners] Adding click listener to confirmSurveyGridBtnEl");
        confirmSurveyGridBtnEl.addEventListener('click', () => {
            if (surveyGridManagerInstance && typeof surveyGridManagerInstance.handleConfirmSurveyGridGeneration === 'function') {
                surveyGridManagerInstance.handleConfirmSurveyGridGeneration();
            } else { console.error("surveyGridManagerInstance.handleConfirmSurveyGridGeneration not found"); }
        });
    }
    if (cancelSurveyGridBtnEl) {
        console.log("[EventListeners] Adding click listener to cancelSurveyGridBtnEl");
        cancelSurveyGridBtnEl.addEventListener('click', () => {
            if (surveyGridManagerInstance && typeof surveyGridManagerInstance.handleCancelSurveyGrid === 'function') {
                surveyGridManagerInstance.handleCancelSurveyGrid();
            } else { console.error("surveyGridManagerInstance.handleCancelSurveyGrid not found"); }
        });
    }
    
    // --- Import/Export Buttons ---
    // ... (come prima, assicurandosi che le funzioni triggerImport, ecc. siano globali) ...
    if (importJsonBtn) { importJsonBtn.addEventListener('click', () => { if(typeof triggerImport === 'function') triggerImport(); }); }
    if (fileInputEl) { fileInputEl.addEventListener('change', (e) => { if(typeof handleFileImport === 'function') handleFileImport(e); }); }
    // (ecc. per gli altri export)


    // --- General Action Buttons ---
    if (clearWaypointsBtn) {
        clearWaypointsBtn.addEventListener('click', () => { if (typeof clearWaypoints === 'function') clearWaypoints(); });
    }

    // --- Map Control Buttons ---
    // ... (come prima) ...
    if (satelliteToggleBtn) { satelliteToggleBtn.addEventListener('click', () => { if(typeof toggleSatelliteView === 'function') toggleSatelliteView(); }); }
    // (ecc.)


    // --- Modal Buttons (Orbit, Custom Alert) ---
    // ... (come prima) ...
     if (customAlertOkButtonEl) {
        customAlertOkButtonEl.addEventListener('click', () => {
            if (customAlertOverlayEl) customAlertOverlayEl.style.display = 'none';
        });
    }
    if (confirmOrbitBtnEl) {
        confirmOrbitBtnEl.addEventListener('click', () => { if(typeof handleConfirmOrbit === 'function') handleConfirmOrbit(); });
    }
    if (cancelOrbitBtnEl) {
        cancelOrbitBtnEl.addEventListener('click', () => {
           if(orbitModalOverlayEl) orbitModalOverlayEl.style.display = 'none';
        });
    }

    console.log("[EventListeners] All event listeners set up.");
}
