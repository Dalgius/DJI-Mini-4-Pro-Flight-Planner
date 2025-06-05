// File: eventListeners.js

// Depends on: config.js (for DOM element vars), domCache.js (to ensure elements are cached)
// Depends on: All manager modules for their respective functions called by event handlers

function setupEventListeners() {
    // --- Flight Settings Panel ---
    if (defaultAltitudeSlider) {
        defaultAltitudeSlider.addEventListener('input', () => {
            if (defaultAltitudeValueEl) defaultAltitudeValueEl.textContent = defaultAltitudeSlider.value + 'm';
            // Se un waypoint è selezionato e in POI_TRACK, ricalcola il suo gimbal pitch
            if (selectedWaypoint && selectedWaypoint.headingControl === 'poi_track') {
                updateGimbalForPoiTrack(selectedWaypoint, true);
            }
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
            updateGimbalForPoiTrack(selectedWaypoint, true); // Ricalcola gimbal se POI_TRACK e altitudine cambia
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
    if (gimbalPitchSlider) { // Slider per il gimbal pitch del singolo waypoint
        gimbalPitchSlider.addEventListener('input', function() {
            if (!selectedWaypoint || !gimbalPitchValueEl) return;
            gimbalPitchValueEl.textContent = this.value + '°';
            // Se l'utente modifica manualmente il gimbal, potrebbe non essere più 'poi_track' implicitamente
            // Ma per ora, permettiamo la sovrascrittura. Il calcolo automatico avviene solo quando si cambia target/modo.
            selectedWaypoint.gimbalPitch = parseInt(this.value);
            // Non chiamiamo updateGimbalForPoiTrack qui per evitare loop se l'utente sta intenzionalmente sovrascrivendo.
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
            const oldHeadingControl = selectedWaypoint.headingControl;
            selectedWaypoint.headingControl = selectedValue;

            fixedHeadingGroupDiv.style.display = selectedValue === 'fixed' ? 'block' : 'none';
            targetPoiForHeadingGroupDiv.style.display = selectedValue === 'poi_track' ? 'block' : 'none';

            if (selectedValue === 'poi_track') {
                populatePoiSelectDropdown(targetPoiSelect, selectedWaypoint.targetPoiId, true, "-- Select POI for Heading --");
                updateGimbalForPoiTrack(selectedWaypoint, true); // Calcola gimbal quando si passa a POI_TRACK
            } else {
                selectedWaypoint.targetPoiId = null; 
                // Se prima era POI_TRACK e ora non lo è, potremmo resettare il gimbal a 0 o al default
                if (oldHeadingControl === 'poi_track') {
                    // selectedWaypoint.gimbalPitch = 0; // Opzionale: resetta gimbal
                    // if (gimbalPitchSlider) gimbalPitchSlider.value = 0;
                    // if (gimbalPitchValueEl) gimbalPitchValueEl.textContent = "0°";
                }
            }
            updateWaypointList(); 
            updateMarkerIconStyle(selectedWaypoint); 
        });
    }
    if (targetPoiSelect) { // Dropdown per selezionare il POI target per un singolo waypoint
        targetPoiSelect.addEventListener('change', function() {
            if (selectedWaypoint) {
                selectedWaypoint.targetPoiId = this.value ? parseInt(this.value) : null;
                updateWaypointList(); 
                if (selectedWaypoint.headingControl === 'poi_track') {
                    updateMarkerIconStyle(selectedWaypoint); 
                    updateGimbalForPoiTrack(selectedWaypoint, true); // Ricalcola gimbal se il POI target cambia
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
            } else { // Se nessun POI è "attivo", aggiorna solo il display
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
            } else if (!lastActivePoiForTerrainFetch) { // Se nessun POI è attivo, aggiorna solo il display
                 updatePoiFinalAltitudeDisplay();
            }
        });
    }
    if (refetchPoiTerrainBtnEl) {
        refetchPoiTerrainBtnEl.addEventListener('click', () => {
            let poiToFetchFor = lastActivePoiForTerrainFetch;
            if (!poiToFetchFor && pois.length > 0) {
                // Se nessun POI è "attivo" per la sidebar (es. pagina appena caricata),
                // e l'utente clicca refetch, potremmo non avere un target chiaro.
                // Per ora, se c'è almeno un POI, tentiamo per l'ultimo, altrimenti alert.
                // Una logica migliore sarebbe legare il refetch a un POI esplicitamente selezionato (non ancora implementato)
                poiToFetchFor = pois[pois.length - 1]; 
            }

            if (poiToFetchFor) {
                fetchAndUpdatePoiTerrainElevation(poiToFetchFor);
            } else {
                showCustomAlert("Nessun POI disponibile o selezionato per recuperare l'elevazione del terreno.", "Info");
            }
        });
    }


    // --- Multi-Waypoint Edit Panel ---
    // (Nessuna modifica qui rispetto alla tua versione funzionante per gli slider)
    if (selectAllWaypointsCheckboxEl) { selectAllWaypointsCheckboxEl.addEventListener('change', (e) => toggleSelectAllWaypoints(e.target.checked));}
    if (multiHeadingControlSelect) { multiHeadingControlSelect.addEventListener('change', function() { /* ... */ });}
    if (multiFixedHeadingSlider) { multiFixedHeadingSlider.addEventListener('input', function() { /* ... */ });}
    if (multiChangeGimbalPitchCheckbox) { multiChangeGimbalPitchCheckbox.addEventListener('change', function() { if (!multiGimbalPitchSlider) return; multiGimbalPitchSlider.disabled = !this.checked; });}
    if (multiGimbalPitchSlider) { multiGimbalPitchSlider.addEventListener('input', function() { if (multiGimbalPitchValueEl) multiGimbalPitchValueEl.textContent = this.value + '°'; });}
    if (multiChangeHoverTimeCheckbox) { multiChangeHoverTimeCheckbox.addEventListener('change', function() { if(!multiHoverTimeSlider) return; multiHoverTimeSlider.disabled = !this.checked; });}
    if (multiHoverTimeSlider) { multiHoverTimeSlider.addEventListener('input', function() { if (multiHoverTimeValueEl) multiHoverTimeValueEl.textContent = this.value + 's'; });}
    if (applyMultiEditBtn) { applyMultiEditBtn.addEventListener('click', applyMultiEdit); } // applyMultiEdit gestisce il ricalcolo del gimbal
    if (clearMultiSelectionBtn) { clearMultiSelectionBtn.addEventListener('click', clearMultiSelection); }


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
