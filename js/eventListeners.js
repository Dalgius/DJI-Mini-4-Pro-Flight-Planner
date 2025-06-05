// File: eventListeners.js

// Depends on: config.js (for DOM element vars), domCache.js (to ensure elements are cached)
// Depends on: All manager modules for their respective functions called by event handlers

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
            updateFlightStatistics(); 
            waypoints.forEach(wp => { 
                if (wp.headingControl === 'auto') updateMarkerIconStyle(wp);
            });
        });
    }
    if (pathTypeSelect) {
        pathTypeSelect.addEventListener('change', () => {
            updateFlightPath();
            waypoints.forEach(wp => updateMarkerIconStyle(wp));
        });
    }

    // --- Selected Waypoint Controls Panel ---
    if (waypointAltitudeSlider) {
        waypointAltitudeSlider.addEventListener('input', () => {
            if (!selectedWaypoint || !waypointAltitudeValueEl) return;
            waypointAltitudeValueEl.textContent = waypointAltitudeSlider.value + 'm';
            selectedWaypoint.altitude = parseInt(waypointAltitudeSlider.value);
            updateWaypointList(); 
        });
    }
    if (hoverTimeSlider) {
        hoverTimeSlider.addEventListener('input', () => {
            if (!selectedWaypoint || !hoverTimeValueEl) return;
            hoverTimeValueEl.textContent = hoverTimeSlider.value + 's';
            selectedWaypoint.hoverTime = parseInt(hoverTimeSlider.value);
            updateFlightStatistics(); 
            updateWaypointList(); 
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
            if (selectedWaypoint.headingControl === 'fixed') {
                updateMarkerIconStyle(selectedWaypoint); 
            }
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
                selectedWaypoint.targetPoiId = null; 
            }
            updateWaypointList(); 
            updateMarkerIconStyle(selectedWaypoint); 
        });
    }
    if (targetPoiSelect) {
        targetPoiSelect.addEventListener('change', function() {
            if (selectedWaypoint) {
                selectedWaypoint.targetPoiId = this.value ? parseInt(this.value) : null;
                updateWaypointList(); 
                if (selectedWaypoint.headingControl === 'poi_track') {
                    updateMarkerIconStyle(selectedWaypoint); 
                }
            }
        });
    }
    if (cameraActionSelect) {
        cameraActionSelect.addEventListener('change', function() {
            if (selectedWaypoint) {
                selectedWaypoint.cameraAction = this.value;
                updateWaypointList(); 
            }
        });
    }
    if (deleteSelectedWaypointBtn) {
        deleteSelectedWaypointBtn.addEventListener('click', deleteSelectedWaypoint);
    }

    // --- POI Input Fields in Sidebar (for default values and display) ---
    if (poiObjectHeightInputEl) {
        poiObjectHeightInputEl.addEventListener('input', updatePoiFinalAltitudeDisplay); // Aggiorna il display AMSL finale
        poiObjectHeightInputEl.addEventListener('change', () => { // Quando l'utente modifica direttamente questo campo
            if (lastActivePoiForTerrainFetch) { // Se c'è un POI "attivo" (es. l'ultimo aggiunto)
                const newHeight = parseFloat(poiObjectHeightInputEl.value) || 0;
                if (lastActivePoiForTerrainFetch.objectHeightAboveGround !== newHeight) {
                    lastActivePoiForTerrainFetch.objectHeightAboveGround = newHeight;
                    lastActivePoiForTerrainFetch.recalculateFinalAltitude(); // Ricalcola e aggiorna tutto
                    updatePOIList(); // Ridisegna la lista per riflettere il cambiamento
                }
            }
        });
    }
    if (poiTerrainElevationInputEl) {
        poiTerrainElevationInputEl.addEventListener('input', updatePoiFinalAltitudeDisplay); // Aggiorna il display AMSL finale
        poiTerrainElevationInputEl.addEventListener('change', () => { // Quando l'utente modifica direttamente questo campo (se non è readonly)
            if (lastActivePoiForTerrainFetch && !poiTerrainElevationInputEl.readOnly) {
                const newElev = parseFloat(poiTerrainElevationInputEl.value) || 0;
                if (lastActivePoiForTerrainFetch.terrainElevationMSL !== newElev) {
                    lastActivePoiForTerrainFetch.terrainElevationMSL = newElev;
                    lastActivePoiForTerrainFetch.recalculateFinalAltitude();
                    updatePOIList();
                }
            }
        });
    }
    if (refetchPoiTerrainBtnEl) {
        refetchPoiTerrainBtnEl.addEventListener('click', () => {
            if (lastActivePoiForTerrainFetch) {
                fetchAndUpdatePoiTerrainElevation(lastActivePoiForTerrainFetch);
            } else if (pois.length > 0) {
                fetchAndUpdatePoiTerrainElevation(pois[pois.length - 1]); // Fallback sull'ultimo POI
            } else {
                showCustomAlert("Nessun POI per cui recuperare l'elevazione.", "Info");
            }
        });
    }


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
    
    if (multiChangeGimbalPitchCheckbox) {
        multiChangeGimbalPitchCheckbox.addEventListener('change', function() {
            if (!multiGimbalPitchSlider || !multiGimbalPitchValueEl) {
                return;
            }
            multiGimbalPitchSlider.disabled = !this.checked;
        });
    }
    if (multiGimbalPitchSlider) {
        multiGimbalPitchSlider.addEventListener('input', function() {
            if (multiGimbalPitchValueEl) {
                multiGimbalPitchValueEl.textContent = this.value + '°';
            }
        });
    }

    if (multiChangeHoverTimeCheckbox) {
        multiChangeHoverTimeCheckbox.addEventListener('change', function() {
            if (!multiHoverTimeSlider || !multiHoverTimeValueEl) {
                return;
            }
            multiHoverTimeSlider.disabled = !this.checked;
        });
    }
    if (multiHoverTimeSlider) {
        multiHoverTimeSlider.addEventListener('input', function() {
            if (multiHoverTimeValueEl) {
                multiHoverTimeValueEl.textContent = this.value + 's';
            }
        });
    }

    if (applyMultiEditBtn) {
        applyMultiEditBtn.addEventListener('click', function() {
            console.log("Pulsante 'Apply to Selected' CLICCATO! Chiamata a applyMultiEdit in corso..."); // Log di conferma
            applyMultiEdit();
        });
    }
    if (clearMultiSelectionBtn) {
        clearMultiSelectionBtn.addEventListener('click', clearMultiSelection);
    }

    // --- Terrain & Orbit Tools ---
    if (getHomeElevationBtn) { getHomeElevationBtn.addEventListener('click', getHomeElevationFromFirstWaypoint); }
    if (adaptToAGLBtnEl) { adaptToAGLBtnEl.addEventListener('click', adaptAltitudesToAGL); }
    if (createOrbitBtn) { createOrbitBtn.addEventListener('click', showOrbitDialog); }

    // --- Survey Grid Modal ---
    if (createSurveyGridBtn) { createSurveyGridBtn.addEventListener('click', openSurveyGridModal); }
    if (startDrawingSurveyAreaBtnEl) { startDrawingSurveyAreaBtnEl.addEventListener('click', handleStartDrawingSurveyArea); }
    if (finalizeSurveyAreaBtnEl) { finalizeSurveyAreaBtnEl.addEventListener('click', handleFinalizeSurveyArea); }
    if (confirmSurveyGridBtnEl) { confirmSurveyGridBtnEl.addEventListener('click', handleConfirmSurveyGridGeneration); }
    if (cancelSurveyGridBtnEl) { cancelSurveyGridBtnEl.addEventListener('click', handleCancelSurveyGrid); }
    
    // --- Import/Export Buttons ---
    if (importJsonBtn) { importJsonBtn.addEventListener('click', triggerImport); }
    if (fileInputEl) { fileInputEl.addEventListener('change', handleFileImport); } // Assicurati che handleFileImport sia definita globalmente (in importExportManager.js)
    if (exportJsonBtn) { exportJsonBtn.addEventListener('click', exportFlightPlanToJson); }
    if (exportKmzBtn) { exportKmzBtn.addEventListener('click', exportToDjiWpmlKmz); }
    if (exportGoogleEarthBtn) { exportGoogleEarthBtn.addEventListener('click', exportToGoogleEarthKml); }

    // --- General Action Buttons ---
    if (clearWaypointsBtn) {
        clearWaypointsBtn.addEventListener('click', clearWaypoints);
    }

    // --- Map Control Buttons ---
    if (satelliteToggleBtn) { satelliteToggleBtn.addEventListener('click', toggleSatelliteView); }
    if (fitMapBtn) { fitMapBtn.addEventListener('click', fitMapToWaypoints); }
    if (myLocationBtn) { myLocationBtn.addEventListener('click', showCurrentLocation); }

    // --- Modal Buttons ---
    if (customAlertOkButtonEl) { customAlertOkButtonEl.addEventListener('click', () => { if (customAlertOverlayEl) customAlertOverlayEl.style.display = 'none'; }); }
    if (confirmOrbitBtnEl) { confirmOrbitBtnEl.addEventListener('click', handleConfirmOrbit); } 
    if (cancelOrbitBtnEl) { cancelOrbitBtnEl.addEventListener('click', () => { if (orbitModalOverlayEl) orbitModalOverlayEl.style.display = 'none'; }); }
}
