// File: eventListeners.js

// Depends on: config.js (for DOM element vars), domCache.js (to ensure elements are cached)
// Depends on: All manager modules for their respective functions called by event handlers

function setupEventListeners() {
    // --- Flight Settings Panel ---
    if (defaultAltitudeSlider) {
        defaultAltitudeSlider.addEventListener('input', () => {
            if (defaultAltitudeValueEl) defaultAltitudeValueEl.textContent = defaultAltitudeSlider.value + 'm';
            // Cambiare l'altitudine di default non dovrebbe impattare il gimbal dei WP esistenti
            // a meno che non si applichi questa altitudine a un WP selezionato che è in poi_track.
            // Questo è gestito quando si cambia l'altitudine del singolo waypoint.
        });
    }
    if (flightSpeedSlider) {
        flightSpeedSlider.addEventListener('input', () => {
            if (flightSpeedValueEl) flightSpeedValueEl.textContent = flightSpeedSlider.value + ' m/s';
            updateFlightStatistics(); 
            // La velocità non impatta direttamente il gimbal pitch
        });
    }
    if (pathTypeSelect) {
        pathTypeSelect.addEventListener('change', () => {
            updateFlightPath();
            // Il tipo di percorso non impatta direttamente il gimbal pitch per poi_track
            // ma aggiorna l'aspetto delle frecce di heading 'auto'
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
            if (selectedWaypoint.headingControl === 'poi_track') {
                updateGimbalForPoiTrack(selectedWaypoint, true); 
            }
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
        gimbalPitchSlider.addEventListener('input', function() {
            if (!selectedWaypoint || !gimbalPitchValueEl) return;
            gimbalPitchValueEl.textContent = this.value + '°';
            selectedWaypoint.gimbalPitch = parseInt(this.value);
            // L'input manuale del gimbal sovrascrive il calcolo automatico.
            // Non chiamare updateGimbalForPoiTrack qui per evitare loop.
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
                populatePoiSelectDropdown(targetPoiSelect, selectedWaypoint.targetPoiId, true, "-- Seleziona POI per Heading --");
                updateGimbalForPoiTrack(selectedWaypoint, true); 
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
                    updateGimbalForPoiTrack(selectedWaypoint, true); 
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

    // --- POI Input Fields in Sidebar (for default values and display when adding new POI) ---
    if (poiObjectHeightInputEl) {
        poiObjectHeightInputEl.addEventListener('input', updatePoiFinalAltitudeDisplay);
        poiObjectHeightInputEl.addEventListener('change', () => { 
            if (lastActivePoiForTerrainFetch) { 
                const newHeight = parseFloat(poiObjectHeightInputEl.value) || 0;
                if (lastActivePoiForTerrainFetch.objectHeightAboveGround !== newHeight) {
                    lastActivePoiForTerrainFetch.objectHeightAboveGround = newHeight;
                    lastActivePoiForTerrainFetch.recalculateFinalAltitude();
                    updatePOIList(); 
                }
            } else { 
                updatePoiFinalAltitudeDisplay();
            }
        });
    }
    if (poiTerrainElevationInputEl) {
        poiTerrainElevationInputEl.addEventListener('input', updatePoiFinalAltitudeDisplay);
         poiTerrainElevationInputEl.addEventListener('change', () => { 
            if (lastActivePoiForTerrainFetch && !poiTerrainElevationInputEl.readOnly) { 
                const newElev = parseFloat(poiTerrainElevationInputEl.value) || 0;
                if (lastActivePoiForTerrainFetch.terrainElevationMSL !== newElev) {
                    lastActivePoiForTerrainFetch.terrainElevationMSL = newElev;
                    lastActivePoiForTerrainFetch.recalculateFinalAltitude();
                    updatePOIList();
                }
            } else if (!lastActivePoiForTerrainFetch) { 
                 updatePoiFinalAltitudeDisplay();
            }
        });
    }
    if (refetchPoiTerrainBtnEl) {
        refetchPoiTerrainBtnEl.addEventListener('click', () => {
            let poiToFetchFor = lastActivePoiForTerrainFetch;
            if (!poiToFetchFor && pois.length > 0) {
                poiToFetchFor = pois[pois.length - 1]; 
            }

            if (poiToFetchFor) {
                fetchAndUpdatePoiTerrainElevation(poiToFetchFor); // è async
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
            const showFixed = this.value === 'fixed';
            const showPoiTarget = this.value === 'poi_track';
            multiFixedHeadingGroupDiv.style.display = showFixed ? 'block' : 'none';
            multiTargetPoiForHeadingGroupDiv.style.display = showPoiTarget ? 'block' : 'none';
            if (showPoiTarget) {
                populatePoiSelectDropdown(multiTargetPoiSelect, null, true, "-- Seleziona POI per tutti --"); 
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
            if (!multiGimbalPitchSlider) return; 
            multiGimbalPitchSlider.disabled = !this.checked; 
        });
    }
    if (multiGimbalPitchSlider) {
        multiGimbalPitchSlider.addEventListener('input', function() { 
            if (multiGimbalPitchValueEl) multiGimbalPitchValueEl.textContent = this.value + '°'; 
        });
    }
    if (multiChangeHoverTimeCheckbox) {
        multiChangeHoverTimeCheckbox.addEventListener('change', function() { 
            if(!multiHoverTimeSlider) return; 
            multiHoverTimeSlider.disabled = !this.checked; 
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
    if (homeElevationMslInput) { // NUOVO LISTENER per il cambio manuale dell'elevazione di decollo
        homeElevationMslInput.addEventListener('change', () => { 
            console.log("Home Elevation MSL Input CAMBIATO manualmente. Ricalcolo gimbal per waypoint POI_TRACK.");
            waypoints.forEach(wp => {
                if (wp.headingControl === 'poi_track' && wp.targetPoiId !== null) {
                    updateGimbalForPoiTrack(wp, (selectedWaypoint && selectedWaypoint.id === wp.id));
                }
            });
            updateWaypointList(); 
            if (selectedWaypoint) { 
                updateSingleWaypointEditControls();
            }
        });
    }
    if (getHomeElevationBtn) { 
        getHomeElevationBtn.addEventListener('click', () => { // Non c'è bisogno di 'async' qui
            getHomeElevationFromFirstWaypoint(); // La funzione chiamata è async e gestirà il suo flusso.
                                                 // getHomeElevationFromFirstWaypoint ora chiama i ricalcoli necessari.
        }); 
    }
    if (adaptToAGLBtnEl) { 
        adaptToAGLBtnEl.addEventListener('click', () => { // Non c'è bisogno di 'async' qui
            adaptAltitudesToAGL(); // La funzione chiamata è async e gestirà il suo flusso.
                                   // adaptAltitudesToAGL ora ricalcola i gimbal necessari.
        }); 
    }
    if (createOrbitBtn) { createOrbitBtn.addEventListener('click', showOrbitDialog); }

    // --- Survey Grid Modal ---
    if (createSurveyGridBtn) { createSurveyGridBtn.addEventListener('click', openSurveyGridModal); }
    if (startDrawingSurveyAreaBtnEl) { startDrawingSurveyAreaBtnEl.addEventListener('click', handleStartDrawingSurveyArea); }
    if (finalizeSurveyAreaBtnEl) { finalizeSurveyAreaBtnEl.addEventListener('click', handleFinalizeSurveyArea); }
    if (confirmSurveyGridBtnEl) { confirmSurveyGridBtnEl.addEventListener('click', handleConfirmSurveyGridGeneration); }
    if (cancelSurveyGridBtnEl) { cancelSurveyGridBtnEl.addEventListener('click', handleCancelSurveyGrid); }
    
    // --- Import/Export Buttons ---
    if (importJsonBtn) { importJsonBtn.addEventListener('click', triggerImport); }
    if (fileInputEl) { fileInputEl.addEventListener('change', handleFileImport); } 
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
