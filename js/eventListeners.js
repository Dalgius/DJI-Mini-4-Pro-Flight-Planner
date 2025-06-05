// File: eventListeners.js
// ... (altri listener invariati) ...

function setupEventListeners() {
    // ... (tutti gli altri listener come prima, assicurati di copiarli dal tuo file) ...

    // MODIFIED: Add event listener for the new refetch POI terrain button
    if (refetchPoiTerrainBtnEl) {
        refetchPoiTerrainBtnEl.addEventListener('click', () => {
            // Tenta di aggiornare l'elevazione del terreno per il "lastActivePoiForTerrainFetch"
            // che viene impostato in addPOI o potrebbe essere impostato quando un POI viene selezionato/modificato nella UI.
            // Questa parte della logica di "selezione POI" per la sidebar non è completamente implementata.
            // Per ora, fetchAndUpdatePoiTerrainElevation() userà lastActivePoiForTerrainFetch.
            if (lastActivePoiForTerrainFetch) {
                fetchAndUpdatePoiTerrainElevation(lastActivePoiForTerrainFetch);
            } else if (pois.length > 0) {
                // Fallback: tenta per l'ultimo POI nella lista se nessun "attivo" è specificato
                fetchAndUpdatePoiTerrainElevation(pois[pois.length - 1]);
            } else {
                showCustomAlert("Nessun POI disponibile per recuperare l'elevazione del terreno.", "Info");
            }
        });
    }

    // MODIFIED: Add event listeners for changes in sidebar POI terrain/object height inputs
    // Questi listener aggiornano il display dell'altitudine finale del POI nella sidebar
    if (poiObjectHeightInputEl) {
        poiObjectHeightInputEl.addEventListener('input', updatePoiFinalAltitudeDisplay);
        poiObjectHeightInputEl.addEventListener('change', () => { // Salva se l'utente modifica e poi perde il focus
            if (lastActivePoiForTerrainFetch) {
                const newHeight = parseFloat(poiObjectHeightInputEl.value) || 0;
                if (lastActivePoiForTerrainFetch.objectHeightAboveGround !== newHeight) {
                    lastActivePoiForTerrainFetch.objectHeightAboveGround = newHeight;
                    lastActivePoiForTerrainFetch.recalculateFinalAltitude();
                    updatePOIList(); // Ridisegna la lista per coerenza
                }
            }
        });
    }
    if (poiTerrainElevationInputEl) {
        poiTerrainElevationInputEl.addEventListener('input', updatePoiFinalAltitudeDisplay);
         poiTerrainElevationInputEl.addEventListener('change', () => { // Salva se l'utente modifica e poi perde il focus
            if (lastActivePoiForTerrainFetch && !poiTerrainElevationInputEl.readOnly) { // Solo se modificabile
                const newElev = parseFloat(poiTerrainElevationInputEl.value) || 0;
                if (lastActivePoiForTerrainFetch.terrainElevationMSL !== newElev) {
                    lastActivePoiForTerrainFetch.terrainElevationMSL = newElev;
                    lastActivePoiForTerrainFetch.recalculateFinalAltitude();
                    updatePOIList(); // Ridisegna la lista per coerenza
                }
            }
        });
    }


// Copia qui il resto del tuo file eventListeners.js
    // --- Flight Settings Panel ---
    if (defaultAltitudeSlider) { /* ... */ }
    if (flightSpeedSlider) { /* ... */ }
    if (pathTypeSelect) { /* ... */ }
    // --- Selected Waypoint Controls Panel ---
    if (waypointAltitudeSlider) { /* ... */ }
    // ... (tutti gli altri fino alla fine)
    // (Assicurati che il codice esistente non venga perso)
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

    // Waypoint Specific Controls
    if (waypointAltitudeSlider) { /* ... */ }
    if (hoverTimeSlider) { /* ... */ }
    if (gimbalPitchSlider) { /* ... */ }
    if (fixedHeadingSlider) { /* ... */ }
    if (headingControlSelect) { /* ... */ }
    if (targetPoiSelect) { /* ... */ }
    if (cameraActionSelect) { /* ... */ }
    if (deleteSelectedWaypointBtn) { /* ... */ }

    // Multi-Waypoint Edit Panel
    if (selectAllWaypointsCheckboxEl) { /* ... */ }
    if (multiHeadingControlSelect) { /* ... */ }
    if (multiFixedHeadingSlider) { /* ... */ }
    if (multiChangeGimbalPitchCheckbox) { /* ... */ }
    if (multiGimbalPitchSlider) { /* ... */ }
    if (multiChangeHoverTimeCheckbox) { /* ... */ }
    if (multiHoverTimeSlider) { /* ... */ }
    if (applyMultiEditBtn) { /* ... */ }
    if (clearMultiSelectionBtn) { /* ... */ }
    
    // Terrain & Orbit Tools
    if (getHomeElevationBtn) { getHomeElevationBtn.addEventListener('click', getHomeElevationFromFirstWaypoint); }
    if (adaptToAGLBtnEl) { adaptToAGLBtnEl.addEventListener('click', adaptAltitudesToAGL); }
    if (createOrbitBtn) { createOrbitBtn.addEventListener('click', showOrbitDialog); }

    // Survey Grid Modal
    if (createSurveyGridBtn) { createSurveyGridBtn.addEventListener('click', openSurveyGridModal); }
    if (startDrawingSurveyAreaBtnEl) { startDrawingSurveyAreaBtnEl.addEventListener('click', handleStartDrawingSurveyArea); }
    if (finalizeSurveyAreaBtnEl) { finalizeSurveyAreaBtnEl.addEventListener('click', handleFinalizeSurveyArea); }
    if (confirmSurveyGridBtnEl) { confirmSurveyGridBtnEl.addEventListener('click', handleConfirmSurveyGridGeneration); }
    if (cancelSurveyGridBtnEl) { cancelSurveyGridBtnEl.addEventListener('click', handleCancelSurveyGrid); }
    
    // Import/Export Buttons
    if (importJsonBtn) { importJsonBtn.addEventListener('click', triggerImport); }
    if (fileInputEl) { fileInputEl.addEventListener('change', handleFileImport); }
    if (exportJsonBtn) { exportJsonBtn.addEventListener('click', exportFlightPlanToJson); }
    if (exportKmzBtn) { exportKmzBtn.addEventListener('click', exportToDjiWpmlKmz); }
    if (exportGoogleEarthBtn) { exportGoogleEarthBtn.addEventListener('click', exportToGoogleEarthKml); }

    // General Action Buttons
    if (clearWaypointsBtn) { clearWaypointsBtn.addEventListener('click', clearWaypoints); }

    // Map Control Buttons
    if (satelliteToggleBtn) { satelliteToggleBtn.addEventListener('click', toggleSatelliteView); }
    if (fitMapBtn) { fitMapBtn.addEventListener('click', fitMapToWaypoints); }
    if (myLocationBtn) { myLocationBtn.addEventListener('click', showCurrentLocation); }

    // Modal Buttons
    if (customAlertOkButtonEl) { customAlertOkButtonEl.addEventListener('click', () => { if (customAlertOverlayEl) customAlertOverlayEl.style.display = 'none'; }); }
    if (confirmOrbitBtnEl) { confirmOrbitBtnEl.addEventListener('click', handleConfirmOrbit); } 
    if (cancelOrbitBtnEl) { cancelOrbitBtnEl.addEventListener('click', () => { if (orbitModalOverlayEl) orbitModalOverlayEl.style.display = 'none'; }); }
}
