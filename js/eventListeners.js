// File: eventListeners.js

// Depends on: config.js (for DOM element vars), domCache.js (to ensure elements are cached)
// Depends on: All manager modules for their respective functions called by event handlers

function setupEventListeners() {
    // --- Flight Settings Panel ---
    // ... (come prima) ...
    if (defaultAltitudeSlider) { defaultAltitudeSlider.addEventListener('input', () => { if (defaultAltitudeValueEl) defaultAltitudeValueEl.textContent = defaultAltitudeSlider.value + 'm'; });}
    if (flightSpeedSlider) { flightSpeedSlider.addEventListener('input', () => { if (flightSpeedValueEl) flightSpeedValueEl.textContent = flightSpeedSlider.value + ' m/s'; updateFlightStatistics(); waypoints.forEach(wp => { if (wp.headingControl === 'auto') updateMarkerIconStyle(wp); }); });}
    if (pathTypeSelect) { pathTypeSelect.addEventListener('change', () => { updateFlightPath(); waypoints.forEach(wp => updateMarkerIconStyle(wp)); });}


    // --- Selected Waypoint Controls Panel ---
    // ... (come prima, con chiamate a updateGimbalForPoiTrack) ...
    if (waypointAltitudeSlider) { waypointAltitudeSlider.addEventListener('input', () => { if (!selectedWaypoint || !waypointAltitudeValueEl) return; waypointAltitudeValueEl.textContent = waypointAltitudeSlider.value + 'm'; selectedWaypoint.altitude = parseInt(waypointAltitudeSlider.value); updateWaypointList(); if (selectedWaypoint.headingControl === 'poi_track') { updateGimbalForPoiTrack(selectedWaypoint, true); } });}
    if (hoverTimeSlider) { hoverTimeSlider.addEventListener('input', () => { if (!selectedWaypoint || !hoverTimeValueEl) return; hoverTimeValueEl.textContent = hoverTimeSlider.value + 's'; selectedWaypoint.hoverTime = parseInt(hoverTimeSlider.value); updateFlightStatistics(); updateWaypointList(); });}
    if (gimbalPitchSlider) { gimbalPitchSlider.addEventListener('input', function() { if (!selectedWaypoint || !gimbalPitchValueEl) return; gimbalPitchValueEl.textContent = this.value + '°'; selectedWaypoint.gimbalPitch = parseInt(this.value); });}
    if (fixedHeadingSlider) { fixedHeadingSlider.addEventListener('input', () => { if (!selectedWaypoint || !fixedHeadingValueEl) return; fixedHeadingValueEl.textContent = fixedHeadingSlider.value + '°'; selectedWaypoint.fixedHeading = parseInt(fixedHeadingSlider.value); if (selectedWaypoint.headingControl === 'fixed') { updateMarkerIconStyle(selectedWaypoint); } });}
    if (headingControlSelect) { headingControlSelect.addEventListener('change', function() { /* ... come prima, con updateGimbalForPoiTrack ... */ });}
    if (targetPoiSelect) { targetPoiSelect.addEventListener('change', function() { /* ... come prima, con updateGimbalForPoiTrack ... */ });}
    if (cameraActionSelect) { cameraActionSelect.addEventListener('change', function() { if (selectedWaypoint) { selectedWaypoint.cameraAction = this.value; updateWaypointList(); } });}
    if (deleteSelectedWaypointBtn) { deleteSelectedWaypointBtn.addEventListener('click', deleteSelectedWaypoint); }


    // --- POI Input Fields in Sidebar ---
    // ... (come prima) ...
    if (poiObjectHeightInputEl) { poiObjectHeightInputEl.addEventListener('input', updatePoiFinalAltitudeDisplay); poiObjectHeightInputEl.addEventListener('change', () => { if (lastActivePoiForTerrainFetch) { const newHeight = parseFloat(poiObjectHeightInputEl.value) || 0; if (lastActivePoiForTerrainFetch.objectHeightAboveGround !== newHeight) { lastActivePoiForTerrainFetch.objectHeightAboveGround = newHeight; lastActivePoiForTerrainFetch.recalculateFinalAltitude(); updatePOIList(); } } else { updatePoiFinalAltitudeDisplay(); } });}
    if (poiTerrainElevationInputEl) { poiTerrainElevationInputEl.addEventListener('input', updatePoiFinalAltitudeDisplay); poiTerrainElevationInputEl.addEventListener('change', () => { if (lastActivePoiForTerrainFetch && !poiTerrainElevationInputEl.readOnly) { const newElev = parseFloat(poiTerrainElevationInputEl.value) || 0; if (lastActivePoiForTerrainFetch.terrainElevationMSL !== newElev) { lastActivePoiForTerrainFetch.terrainElevationMSL = newElev; lastActivePoiForTerrainFetch.recalculateFinalAltitude(); updatePOIList(); } } else if (!lastActivePoiForTerrainFetch) { updatePoiFinalAltitudeDisplay(); } });}
    if (refetchPoiTerrainBtnEl) { refetchPoiTerrainBtnEl.addEventListener('click', () => { /* ... come prima ... */ });}


    // --- Multi-Waypoint Edit Panel ---
    // ... (come prima) ...
    if (selectAllWaypointsCheckboxEl) { selectAllWaypointsCheckboxEl.addEventListener('change', (e) => toggleSelectAllWaypoints(e.target.checked));}
    if (multiHeadingControlSelect) { multiHeadingControlSelect.addEventListener('change', function() { if (!multiFixedHeadingGroupDiv || !multiTargetPoiForHeadingGroupDiv || !multiTargetPoiSelect) return; const showFixed = this.value === 'fixed'; const showPoiTarget = this.value === 'poi_track'; multiFixedHeadingGroupDiv.style.display = showFixed ? 'block' : 'none'; multiTargetPoiForHeadingGroupDiv.style.display = showPoiTarget ? 'block' : 'none'; if (showPoiTarget) { populatePoiSelectDropdown(multiTargetPoiSelect, null, true, "-- Seleziona POI per tutti --"); } });}
    if (multiFixedHeadingSlider) { multiFixedHeadingSlider.addEventListener('input', function() { if (multiFixedHeadingValueEl) multiFixedHeadingValueEl.textContent = this.value + '°'; });}
    if (multiChangeGimbalPitchCheckbox) { multiChangeGimbalPitchCheckbox.addEventListener('change', function() { if (!multiGimbalPitchSlider) return; multiGimbalPitchSlider.disabled = !this.checked; });}
    if (multiGimbalPitchSlider) { multiGimbalPitchSlider.addEventListener('input', function() { if (multiGimbalPitchValueEl) multiGimbalPitchValueEl.textContent = this.value + '°'; });}
    if (multiChangeHoverTimeCheckbox) { multiChangeHoverTimeCheckbox.addEventListener('change', function() { if(!multiHoverTimeSlider) return; multiHoverTimeSlider.disabled = !this.checked; });}
    if (multiHoverTimeSlider) { multiHoverTimeSlider.addEventListener('input', function() { if (multiHoverTimeValueEl) multiHoverTimeValueEl.textContent = this.value + 's'; });}
    if (applyMultiEditBtn) { applyMultiEditBtn.addEventListener('click', applyMultiEdit); } 
    if (clearMultiSelectionBtn) { clearMultiSelectionBtn.addEventListener('click', clearMultiSelection); }


    // --- Terrain & Orbit Tools ---
    if (homeElevationMslInput) { 
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
        getHomeElevationBtn.addEventListener('click', () => { 
            getHomeElevationFromFirstWaypoint(); 
        }); 
    }
    if (adaptToAGLBtnEl) { 
        adaptToAGLBtnEl.addEventListener('click', () => { 
            adaptAltitudesToAGL(); 
        }); 
    }
    // NUOVO LISTENER per il pulsante Adapt to AMSL
    if (adaptToAMSLBtnEl) {
        adaptToAMSLBtnEl.addEventListener('click', () => {
            adaptAltitudesToAMSL(); // Chiama la nuova funzione
        });
    }
    if (createOrbitBtn) { createOrbitBtn.addEventListener('click', showOrbitDialog); }

    // --- Survey Grid Modal ---
    // ... (come prima) ...
    if (createSurveyGridBtn) { createSurveyGridBtn.addEventListener('click', openSurveyGridModal); }
    if (startDrawingSurveyAreaBtnEl) { startDrawingSurveyAreaBtnEl.addEventListener('click', handleStartDrawingSurveyArea); }
    if (finalizeSurveyAreaBtnEl) { finalizeSurveyAreaBtnEl.addEventListener('click', handleFinalizeSurveyArea); }
    if (confirmSurveyGridBtnEl) { confirmSurveyGridBtnEl.addEventListener('click', handleConfirmSurveyGridGeneration); }
    if (cancelSurveyGridBtnEl) { cancelSurveyGridBtnEl.addEventListener('click', handleCancelSurveyGrid); }
    
    // --- Import/Export Buttons ---
    // ... (come prima) ...
    if (importJsonBtn) { importJsonBtn.addEventListener('click', triggerImport); }
    if (fileInputEl) { fileInputEl.addEventListener('change', handleFileImport); } 
    if (exportJsonBtn) { exportJsonBtn.addEventListener('click', exportFlightPlanToJson); }
    if (exportKmzBtn) { exportKmzBtn.addEventListener('click', exportToDjiWpmlKmz); }
    if (exportGoogleEarthBtn) { exportGoogleEarthBtn.addEventListener('click', exportToGoogleEarthKml); }

    // --- General Action Buttons ---
    // ... (come prima) ...
    if (clearWaypointsBtn) { clearWaypointsBtn.addEventListener('click', clearWaypoints); }

    // --- Map Control Buttons ---
    // ... (come prima) ...
    if (satelliteToggleBtn) { satelliteToggleBtn.addEventListener('click', toggleSatelliteView); }
    if (fitMapBtn) { fitMapBtn.addEventListener('click', fitMapToWaypoints); }
    if (myLocationBtn) { myLocationBtn.addEventListener('click', showCurrentLocation); }

    // --- Modal Buttons ---
    // ... (come prima) ...
    if (customAlertOkButtonEl) { customAlertOkButtonEl.addEventListener('click', () => { if (customAlertOverlayEl) customAlertOverlayEl.style.display = 'none'; }); }
    if (confirmOrbitBtnEl) { confirmOrbitBtnEl.addEventListener('click', handleConfirmOrbit); } 
    if (cancelOrbitBtnEl) { cancelOrbitBtnEl.addEventListener('click', () => { if (orbitModalOverlayEl) orbitModalOverlayEl.style.display = 'none'; }); }
}
