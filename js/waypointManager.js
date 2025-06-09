// File: waypointManager.js

// Depends on: config.js, utils.js (calculateRequiredGimbalPitch, haversineDistance), 
// uiUpdater.js, mapManager.js, flightPathManager.js, terrainManager.js (getElevationsBatch)

async function addWaypoint(latlng, options = {}) { 
    if (!map || !defaultAltitudeSlider || !gimbalPitchSlider) return;

    const isFirstWaypointBeingAdded = waypoints.length === 0 && (options.id === undefined || options.id === 1); 

    const newWaypoint = {
        id: options.id !== undefined ? options.id : waypointCounter++, 
        latlng: L.latLng(latlng.lat, latlng.lng),
        altitude: options.altitude !== undefined ? options.altitude : parseInt(defaultAltitudeSlider.value),
        hoverTime: options.hoverTime !== undefined ? options.hoverTime : 0,
        gimbalPitch: options.gimbalPitch !== undefined ? options.gimbalPitch : parseInt(gimbalPitchSlider.value),
        headingControl: options.headingControl || 'auto',
        fixedHeading: options.fixedHeading || 0,
        cameraAction: options.cameraAction || 'none',
        targetPoiId: options.targetPoiId || null,
        terrainElevationMSL: options.terrainElevationMSL !== undefined ? options.terrainElevationMSL : null, 
        marker: null,
        waypointType: options.waypointType || 'generic' 
    };
    
    waypoints.push(newWaypoint);

    const isHomeForIcon = waypoints.length > 0 && newWaypoint.id === waypoints[0].id; 
    const marker = L.marker(newWaypoint.latlng, {
        draggable: true,
        icon: createWaypointIcon(newWaypoint, false, false, isHomeForIcon) 
    }).addTo(map);

    marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e); 
        selectWaypoint(newWaypoint);
    });
    marker.on('dragend', async () => { 
        newWaypoint.latlng = marker.getLatLng();
        updateFlightPath(); 
        updateFlightStatistics();
        
        const wpIndex = waypoints.findIndex(wp => wp.id === newWaypoint.id);
        const isDraggedWpFirst = wpIndex === 0;

        if (isDraggedWpFirst && typeof getElevationsBatch === "function" && homeElevationMslInput) {
            console.log(`WP1 (ID: ${newWaypoint.id}) trascinato. Tento di aggiornare l'elevazione di decollo e del WP1.`);
            if(loadingOverlayEl) loadingOverlayEl.style.display = 'flex';
            if(loadingOverlayEl) loadingOverlayEl.textContent = "Aggiornamento elevazione decollo da WP1...";
            const elevations = await getElevationsBatch([{ lat: newWaypoint.latlng.lat, lng: newWaypoint.latlng.lng }]);
            if(loadingOverlayEl) loadingOverlayEl.style.display = 'none';
            if (elevations && elevations.length > 0 && elevations[0] !== null) {
                const terrainElev = Math.round(elevations[0]);
                homeElevationMslInput.value = terrainElev;
                newWaypoint.terrainElevationMSL = terrainElev;
                
                if (typeof updateDefaultDesiredAMSLTarget === "function") {
                    updateDefaultDesiredAMSLTarget();
                }

                lastAltitudeAdaptationMode = 'relative'; 
                if(typeof updatePathModeDisplay === "function") updatePathModeDisplay();
                updateFlightPath(); 

                waypoints.forEach(wp_iter => {
                    if (wp_iter.headingControl === 'poi_track' && typeof updateGimbalForPoiTrack === "function") {
                        updateGimbalForPoiTrack(wp_iter, selectedWaypoint && selectedWaypoint.id === wp_iter.id);
                    }
                });
            } else {
                console.warn("Fallito aggiornamento elevazione decollo dopo trascinamento WP1.");
            }
        } else if (newWaypoint.headingControl === 'poi_track' && typeof updateGimbalForPoiTrack === "function") {
            updateGimbalForPoiTrack(newWaypoint, true); 
        }
        
        updateWaypointList();
        if(selectedWaypoint && selectedWaypoint.id === newWaypoint.id && typeof updateSingleWaypointEditControls === "function"){
             updateSingleWaypointEditControls();
        }
        updateMarkerIconStyle(newWaypoint);
        if (wpIndex > 0 && waypoints[wpIndex-1].headingControl === 'auto') { 
            updateMarkerIconStyle(waypoints[wpIndex-1]);
        }
    });
    marker.on('drag', () => { 
        newWaypoint.latlng = marker.getLatLng();
        updateFlightPath(); 
        if(newWaypoint.headingControl === 'poi_track' && typeof updateGimbalForPoiTrack === "function"){ 
            updateGimbalForPoiTrack(newWaypoint); 
            if(selectedWaypoint && selectedWaypoint.id === newWaypoint.id && gimbalPitchSlider && gimbalPitchValueEl){ 
                 gimbalPitchSlider.value = newWaypoint.gimbalPitch;
                 gimbalPitchValueEl.textContent = newWaypoint.gimbalPitch + '°';
            }
        }
    });

    marker.on('mouseover', function (e) {
        let homeElevation = 0;
        if (homeElevationMslInput && homeElevationMslInput.value !== "") {
            homeElevation = parseFloat(homeElevationMslInput.value);
            if (isNaN(homeElevation)) homeElevation = 0;
        }
        const altitudeRelToHome = newWaypoint.altitude;
        const terrainElevText = newWaypoint.terrainElevationMSL !== null ? `${newWaypoint.terrainElevationMSL.toFixed(1)} m` : translate('NA');
        let amslText = translate('NA');
        let aglText = translate('NA');
        if (typeof homeElevation === 'number') {
            amslText = `${(homeElevation + altitudeRelToHome).toFixed(1)} m`;
        }
        if (newWaypoint.terrainElevationMSL !== null && typeof homeElevation === 'number') {
            const amslWaypoint = homeElevation + altitudeRelToHome;
            aglText = `${(amslWaypoint - newWaypoint.terrainElevationMSL).toFixed(1)} m`;
        }
        
        const popupContent = `
            <strong>${translate('waypointLabel')} ${newWaypoint.id}</strong><br>
            <div style="font-size:0.9em; line-height:1.3;">
            Lat: ${newWaypoint.latlng.lat.toFixed(5)}, Lng: ${newWaypoint.latlng.lng.toFixed(5)}<br>
            ${translate('flightAltRelLabel')}: ${altitudeRelToHome} m<br>
            ${translate('amslAltLabel')}: ${amslText}<br>
            ${translate('aglAltLabel')}: ${aglText}<br>
            ${translate('terrainElevLabel')}: ${terrainElevText}<br>
            ${translate('gimbalLabel')}: ${newWaypoint.gimbalPitch}° | ${translate('hoverLabel')}: ${newWaypoint.hoverTime}s
            </div>
        `;

        if (!this.getPopup()) { this.bindPopup(popupContent).openPopup(); } 
        else { this.setPopupContent(popupContent).openPopup(); }
    });
    newWaypoint.marker = marker;

    if (isFirstWaypointBeingAdded && typeof getElevationsBatch === "function" && homeElevationMslInput) {
        console.log(`Primo waypoint (ID: ${newWaypoint.id}) aggiunto. Tento di impostare l'elevazione di decollo e del WP1.`);
        if(loadingOverlayEl) loadingOverlayEl.style.display = 'flex';
        if(loadingOverlayEl) loadingOverlayEl.textContent = "Recupero elevazione decollo da WP1...";
        
        // ======================= INIZIO CORREZIONE =======================
        const elevations = await getElevationsBatch([{ lat: newWaypoint.latlng.lat, lng: newWaypoint.latlng.lng }]);
        // ======================= FINE CORREZIONE =========================
        
        if(loadingOverlayEl) loadingOverlayEl.style.display = 'none';

        if (elevations && elevations.length > 0 && elevations[0] !== null) {
            const terrainElev = Math.round(elevations[0]);
            homeElevationMslInput.value = terrainElev; 
            newWaypoint.terrainElevationMSL = terrainElev; 
            
            console.log(`Elevazione decollo impostata a ${homeElevationMslInput.value}m MSL. WP1.terrainElevationMSL: ${newWaypoint.terrainElevationMSL}m.`);
            
            if (typeof updateDefaultDesiredAMSLTarget === "function") {
                updateDefaultDesiredAMSLTarget();
            }

            lastAltitudeAdaptationMode = 'relative'; 
            if(typeof updatePathModeDisplay === "function") updatePathModeDisplay();

            if (newWaypoint.headingControl === 'poi_track' && typeof updateGimbalForPoiTrack === "function") {
                updateGimbalForPoiTrack(newWaypoint, true); 
            }
        } else {
            console.warn("Impossibile recuperare l'elevazione per WP1. homeElevationMslInput e WP1.terrainElevationMSL non impostati automaticamente.");
            newWaypoint.terrainElevationMSL = null;
        }
    } else if (waypoints.length > 1) { 
        const prevWpIndex = waypoints.length - 2; 
        const prevWp = waypoints[prevWpIndex];
        if (prevWp && prevWp.headingControl === 'auto') { 
            updateMarkerIconStyle(prevWp);
        }
    }
    
    if (newWaypoint.headingControl === 'poi_track' && newWaypoint.targetPoiId !== null && typeof updateGimbalForPoiTrack === "function") {
        if (!isFirstWaypointBeingAdded) {
             updateGimbalForPoiTrack(newWaypoint, (options.calledFromLoad !== true && selectedWaypoint && selectedWaypoint.id === newWaypoint.id));
        }
    }
    
    if (options.calledFromLoad !== true) { 
        updateWaypointList();
        updateFlightPath();
        updateFlightStatistics();
        selectWaypoint(newWaypoint); 
    }
}

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
        if (wp.id !== selectedWaypoint.id && !selectedForMultiEdit.has(wp.id)) { 
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

function deleteSelectedWaypoint() {
    if (!selectedWaypoint) {
        showCustomAlert("Nessun waypoint selezionato da eliminare.", "Info"); 
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
    
    if (deletedWaypointIndex > 0 && deletedWaypointIndex -1 < waypoints.length) { 
        const prevWp = waypoints[deletedWaypointIndex - 1]; 
        if (prevWp && prevWp.headingControl === 'auto') {
            updateMarkerIconStyle(prevWp);
        }
    }
    updateWaypointList(); 
    updateFlightPath();
    updateFlightStatistics();
    updateMultiEditPanelVisibility(); 
    waypoints.forEach(wp => updateMarkerIconStyle(wp)); 
}

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
    
    if(typeof clearPOIs === "function") { 
        clearPOIs(); 
    } else { 
        if(pois) pois.forEach(p => { if(p.marker) map.removeLayer(p.marker); });
        pois = [];
        poiCounter = 1;
        if(typeof updatePOIList === 'function') updatePOIList();
        if(poiNameInput) poiNameInput.value = "";
        if(poiObjectHeightInputEl) poiObjectHeightInputEl.value = "0";
        if(poiTerrainElevationInputEl) {
            poiTerrainElevationInputEl.value = "0";
            poiTerrainElevationInputEl.readOnly = true;
        }
        if(typeof updatePoiFinalAltitudeDisplay === "function") updatePoiFinalAltitudeDisplay();
        lastActivePoiForTerrainFetch = null;
    }
    
    lastAltitudeAdaptationMode = 'relative'; 
    if(typeof updatePathModeDisplay === "function") updatePathModeDisplay();
    updateFlightPath(); 

    updateWaypointList();
    updateFlightStatistics();
}

function toggleMultiSelectWaypoint(waypointId, isChecked) {
    const waypoint = waypoints.find(wp => wp.id === waypointId);
    if (!waypoint) { return; }

    if (isChecked) {
        selectedForMultiEdit.add(waypointId);
        if (selectedWaypoint) {
            const oldSelectedWpObject = selectedWaypoint; 
            selectedWaypoint = null; 
            if (waypointControlsDiv) waypointControlsDiv.style.display = 'none'; 
            updateMarkerIconStyle(oldSelectedWpObject); 
        }
    } else {
        selectedForMultiEdit.delete(waypointId);
    }
    updateMarkerIconStyle(waypoint); 
    if (selectAllWaypointsCheckboxEl) {
        selectAllWaypointsCheckboxEl.checked = waypoints.length > 0 && waypoints.every(wp => selectedForMultiEdit.has(wp.id));
    }
    updateWaypointList(); 
    updateMultiEditPanelVisibility(); 
}

function toggleSelectAllWaypoints(isChecked) {
    if (selectedWaypoint) { 
        const oldSelectedWpObject = selectedWaypoint;
        selectedWaypoint = null;
        if (waypointControlsDiv) waypointControlsDiv.style.display = 'none';
        updateMarkerIconStyle(oldSelectedWpObject); 
    }
    selectedForMultiEdit.clear(); 
    if (isChecked && waypoints.length > 0) {
        waypoints.forEach(wp => selectedForMultiEdit.add(wp.id));
    }
    waypoints.forEach(wp => updateMarkerIconStyle(wp)); 
    updateWaypointList(); 
    updateMultiEditPanelVisibility(); 
}

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

function updateGimbalForPoiTrack(waypoint, forceUpdateUI = false) {
    if (!waypoint || waypoint.headingControl !== 'poi_track' || waypoint.targetPoiId === null) {
        return; 
    }
    const targetPoi = pois.find(p => p.id === waypoint.targetPoiId);
    if (!targetPoi) {
        return; 
    }
    const homeElevation = parseFloat(homeElevationMslInput.value) || 0;
    const waypointAMSL = homeElevation + waypoint.altitude;
    const poiAMSL = targetPoi.altitude; 
    const horizontalDistance = haversineDistance(waypoint.latlng, targetPoi.latlng);

    const requiredPitch = calculateRequiredGimbalPitch(waypointAMSL, poiAMSL, horizontalDistance);
    if (waypoint.gimbalPitch !== requiredPitch) {
        waypoint.gimbalPitch = requiredPitch; 
        if (selectedWaypoint && selectedWaypoint.id === waypoint.id && (waypointControlsDiv.style.display === 'block' || forceUpdateUI)) {
            if (gimbalPitchSlider) gimbalPitchSlider.value = waypoint.gimbalPitch;
            if (gimbalPitchValueEl) gimbalPitchValueEl.textContent = waypoint.gimbalPitch + '°';
        }
    }
}

function applyMultiEdit() {
    if (selectedForMultiEdit.size === 0) {
        showCustomAlert("Nessun waypoint selezionato per la modifica multipla.", "Attenzione");
        return;
    }
    if (!multiHeadingControlSelect || !multiFixedHeadingSlider || !multiCameraActionSelect ||
        !multiChangeGimbalPitchCheckbox || !multiGimbalPitchSlider ||
        !multiChangeHoverTimeCheckbox || !multiHoverTimeSlider || !multiTargetPoiSelect) {
        showCustomAlert("Controlli per la modifica multipla non trovati.", "Errore Interno");
        return;
    }
    
    const newHeadingControl = multiHeadingControlSelect.value;
    const newFixedHeading = parseInt(multiFixedHeadingSlider.value);
    const newCameraAction = multiCameraActionSelect.value;
    const changeGimbal = multiChangeGimbalPitchCheckbox.checked;
    const newGimbalPitch = parseInt(multiGimbalPitchSlider.value);
    const changeHover = multiChangeHoverTimeCheckbox.checked;
    const newHoverTime = parseInt(multiHoverTimeSlider.value);
    let changesMade = false;

    waypoints.forEach(wp => {
        if (selectedForMultiEdit.has(wp.id)) {
            let wpChanged = false;
            if (newHeadingControl) { 
                wp.headingControl = newHeadingControl;
                wp.targetPoiId = (newHeadingControl === 'poi_track' && multiTargetPoiSelect.value) ? parseInt(multiTargetPoiSelect.value) : null;
                wp.fixedHeading = (newHeadingControl === 'fixed') ? newFixedHeading : 0;
                wpChanged = true;
            }
            if (newCameraAction) { wp.cameraAction = newCameraAction; wpChanged = true; }
            if (changeGimbal) { wp.gimbalPitch = newGimbalPitch; wpChanged = true; }
            if (changeHover) { wp.hoverTime = newHoverTime; wpChanged = true; }

            if (wpChanged) {
                changesMade = true;
                if (wp.headingControl === 'poi_track') updateGimbalForPoiTrack(wp);
                updateMarkerIconStyle(wp); 
            }
        }
    });

    if (changesMade) {
        updateWaypointList();
        updateFlightStatistics(); 
        showCustomAlert(`${selectedForMultiEdit.size} waypoint sono stati aggiornati.`, "Successo"); 
    }
    
    // Reset controls
    multiHeadingControlSelect.value = ""; 
    multiCameraActionSelect.value = ""; 
    multiChangeGimbalPitchCheckbox.checked = false;
    multiGimbalPitchSlider.disabled = true; 
    multiChangeHoverTimeCheckbox.checked = false;
    multiHoverTimeSlider.disabled = true;
    clearMultiSelection();
}
