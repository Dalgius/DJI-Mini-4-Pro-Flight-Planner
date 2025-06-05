// File: waypointManager.js

// Depends on: config.js, utils.js (calculateRequiredGimbalPitch, haversineDistance), 
// uiUpdater.js, mapManager.js, flightPathManager.js

/**
 * Adds a new waypoint to the map and list.
 * @param {L.LatLng} latlng - The latitude and longitude for the new waypoint.
 * @param {object} [options={}] - Optional parameters to override defaults for the new waypoint.
 */
function addWaypoint(latlng, options = {}) {
    if (!map || !defaultAltitudeSlider || !gimbalPitchSlider) return;

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
        marker: null 
    };
    if (options.id !== undefined && options.id >= waypointCounter) {
        waypointCounter = options.id + 1;
    }
    
    waypoints.push(newWaypoint);

    const isHome = waypoints.length > 0 && newWaypoint.id === waypoints[0].id;
    const marker = L.marker(newWaypoint.latlng, {
        draggable: true,
        icon: createWaypointIcon(newWaypoint, false, false, isHome) 
    }).addTo(map);

    marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e); 
        selectWaypoint(newWaypoint);
    });
    marker.on('dragend', () => {
        newWaypoint.latlng = marker.getLatLng();
        updateFlightPath(); 
        updateFlightStatistics();
        updateWaypointList(); 
        updateMarkerIconStyle(newWaypoint); 
        const wpIndex = waypoints.findIndex(wp => wp.id === newWaypoint.id);
        if (wpIndex > 0 && waypoints[wpIndex-1].headingControl === 'auto') { 
            updateMarkerIconStyle(waypoints[wpIndex-1]);
        }
        // Se il waypoint successivo (se esiste) era 'auto', anche il suo heading potrebbe cambiare.
        // Tuttavia, updateMarkerIconStyle(newWaypoint) già aggiorna l'heading del waypoint corrente.
        // La modifica più rilevante è per il precedente se il nuovo WP è il suo "next".
        if (wpIndex < waypoints.length - 1 && waypoints[wpIndex + 1].headingControl === 'auto') {
             // L'heading del *successivo* dipende dal *suo* successivo, non da questo che si muove.
             // Ma se questo (newWaypoint) è 'auto', il suo marker si aggiorna.
        }
        updateGimbalForPoiTrack(newWaypoint, true); 
    });
    marker.on('drag', () => { 
        newWaypoint.latlng = marker.getLatLng();
        updateFlightPath(); 
        if(newWaypoint.headingControl === 'poi_track'){ // Live update gimbal during drag if POI_TRACK
            updateGimbalForPoiTrack(newWaypoint);
            if(selectedWaypoint && selectedWaypoint.id === newWaypoint.id){ // Update UI if selected
                 if (gimbalPitchSlider) gimbalPitchSlider.value = newWaypoint.gimbalPitch;
                 if (gimbalPitchValueEl) gimbalPitchValueEl.textContent = newWaypoint.gimbalPitch + '°';
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
        const terrainElevText = newWaypoint.terrainElevationMSL !== null ? `${newWaypoint.terrainElevationMSL.toFixed(1)} m` : "N/A";
        let amslText = "N/A";
        let aglText = "N/A";
        if (typeof homeElevation === 'number') {
            amslText = `${(homeElevation + altitudeRelToHome).toFixed(1)} m`;
        }
        if (newWaypoint.terrainElevationMSL !== null && typeof homeElevation === 'number') {
            const amslWaypoint = homeElevation + altitudeRelToHome;
            aglText = `${(amslWaypoint - newWaypoint.terrainElevationMSL).toFixed(1)} m`;
        }
        const popupContent = `
            <strong>Waypoint ${newWaypoint.id}</strong><br>
            <div style="font-size:0.9em; line-height:1.3;">
            Lat: ${newWaypoint.latlng.lat.toFixed(5)}, Lng: ${newWaypoint.latlng.lng.toFixed(5)}<br>
            Alt. Volo (Rel): ${altitudeRelToHome} m<br>
            Alt. AMSL: ${amslText}<br>
            Alt. AGL: ${aglText}<br>
            Elev. Terreno: ${terrainElevText}<br>
            Gimbal: ${newWaypoint.gimbalPitch}° | Hover: ${newWaypoint.hoverTime}s
            </div>
        `;
        if (!this.getPopup()) {
            this.bindPopup(popupContent).openPopup();
        } else {
            this.setPopupContent(popupContent).openPopup();
        }
    });
    newWaypoint.marker = marker;

    if (waypoints.length > 1) {
        const prevWpIndex = waypoints.length - 2; 
        const prevWp = waypoints[prevWpIndex];
        if (prevWp && prevWp.headingControl === 'auto') { 
            updateMarkerIconStyle(prevWp);
        }
    }
    // Se il nuovo waypoint è impostato su POI_TRACK, calcola il suo gimbal pitch iniziale
    if (newWaypoint.headingControl === 'poi_track') {
        updateGimbalForPoiTrack(newWaypoint);
    }
    
    updateWaypointList();
    updateFlightPath();
    updateFlightStatistics();
    selectWaypoint(newWaypoint); 
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
        if (wp.id !== selectedWaypoint.id) {
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
    // Se il waypoint eliminato non era l'ultimo, e quello che lo seguiva era in 'auto', 
    // il suo 'next' è cambiato, quindi il suo heading marker va aggiornato.
    // Questo è coperto dal forEach successivo.

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
    if (typeof clearPOIs === "function") clearPOIs(); // Se esiste una funzione per pulire i POI e resettare il loro contatore
    else { // Altrimenti, pulisci i POI manualmente qui
        if(pois) pois.forEach(p => { if(p.marker) map.removeLayer(p.marker); });
        pois = [];
        poiCounter = 1;
        if(typeof updatePOIList === "function") updatePOIList();
    }
    updateWaypointList();
    updateFlightPath();
    updateFlightStatistics();
}

function toggleMultiSelectWaypoint(waypointId, isChecked) {
    const waypoint = waypoints.find(wp => wp.id === waypointId);
    if (!waypoint) return;
    if (isChecked) {
        selectedForMultiEdit.add(waypointId);
        if (selectedWaypoint) {
            const oldSelected = selectedWaypoint;
            selectedWaypoint = null;
            updateMarkerIconStyle(oldSelected); 
            if (waypointControlsDiv) waypointControlsDiv.style.display = 'none';
        }
    } else {
        selectedForMultiEdit.delete(waypointId);
    }
    updateMarkerIconStyle(waypoint); 
    if (selectAllWaypointsCheckboxEl) {
        const allWaypointsSelected = waypoints.length > 0 && waypoints.every(wp => selectedForMultiEdit.has(wp.id));
        selectAllWaypointsCheckboxEl.checked = allWaypointsSelected;
    }
    updateWaypointList(); 
    updateMultiEditPanelVisibility(); 
}

function toggleSelectAllWaypoints(isChecked) {
    selectedForMultiEdit.clear(); 
    if (isChecked) {
        waypoints.forEach(wp => selectedForMultiEdit.add(wp.id));
    }
    if (selectedWaypoint) {
        const oldSelected = selectedWaypoint;
        selectedWaypoint = null;
        if (waypointControlsDiv) waypointControlsDiv.style.display = 'none';
        updateMarkerIconStyle(oldSelected); 
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

/**
 * Aggiorna il gimbal pitch di un waypoint se è in modalità POI_TRACK.
 * @param {object} waypoint - L'oggetto waypoint da aggiornare.
 * @param {boolean} [forceUpdateUI=false] - Se true, forza l'aggiornamento dei controlli UI per il waypoint selezionato.
 */
function updateGimbalForPoiTrack(waypoint, forceUpdateUI = false) {
    if (!waypoint || waypoint.headingControl !== 'poi_track' || waypoint.targetPoiId === null) {
        return; 
    }
    const targetPoi = pois.find(p => p.id === waypoint.targetPoiId);
    if (!targetPoi) {
        // console.warn(`POI target ID ${waypoint.targetPoiId} non trovato per WP ${waypoint.id} durante calcolo gimbal.`);
        return; 
    }

    const homeElevation = parseFloat(homeElevationMslInput.value) || 0;
    const waypointAMSL = homeElevation + waypoint.altitude;
    const poiAMSL = targetPoi.altitude; 
    const horizontalDistance = haversineDistance(waypoint.latlng, targetPoi.latlng);

    console.log(`updateGimbalForPoiTrack per WP ${waypoint.id}:`);
    console.log(`  - Home Elevation: ${homeElevation}, WP Rel Alt: ${waypoint.altitude} => WP AMSL: ${waypointAMSL}`);
    console.log(`  - Target POI ID: ${targetPoi.id} ('${targetPoi.name}'), POI AMSL: ${poiAMSL}`);
    console.log(`  - Horiz Dist: ${horizontalDistance.toFixed(1)}m, Delta Alt (POI - WP): ${(poiAMSL - waypointAMSL).toFixed(1)}m`);

    const requiredPitch = calculateRequiredGimbalPitch(waypointAMSL, poiAMSL, horizontalDistance);
    
    console.log(`  - Required Pitch CALCOLATO: ${requiredPitch}°`);

    if (waypoint.gimbalPitch !== requiredPitch) {
        console.log(`  - WP ${waypoint.id}: Aggiornamento Gimbal Pitch da ${waypoint.gimbalPitch}° a ${requiredPitch}°`);
        waypoint.gimbalPitch = requiredPitch;
        
        if (selectedWaypoint && selectedWaypoint.id === waypoint.id && (waypointControlsDiv.style.display === 'block' || forceUpdateUI)) {
            if (gimbalPitchSlider) gimbalPitchSlider.value = waypoint.gimbalPitch;
            if (gimbalPitchValueEl) gimbalPitchValueEl.textContent = waypoint.gimbalPitch + '°';
        }
    } else {
        // console.log(`  - WP ${waypoint.id}: Gimbal Pitch (${waypoint.gimbalPitch}°) già corretto.`);
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

    const changeGimbalCheckboxState = multiChangeGimbalPitchCheckbox.checked;
    const changeHoverCheckboxState = multiChangeHoverTimeCheckbox.checked;

    if (changeGimbalCheckboxState) {
        multiGimbalPitchSlider.disabled = false;
    } else {
        multiGimbalPitchSlider.disabled = true;
    }
    if (changeHoverCheckboxState) {
        multiHoverTimeSlider.disabled = false;
    } else {
        multiHoverTimeSlider.disabled = true;
    }
        
    setTimeout(() => {
        const newHeadingControl = multiHeadingControlSelect.value;
        const newFixedHeading = parseInt(multiFixedHeadingSlider.value);
        const newCameraAction = multiCameraActionSelect.value;

        const newGimbalPitchFromSlider = changeGimbalCheckboxState ? parseInt(multiGimbalPitchSlider.value) : null;
        const newHoverTimeFromSlider = changeHoverCheckboxState ? parseInt(multiHoverTimeSlider.value) : null;
        
        let changesMadeToAtLeastOneWp = false;

        waypoints.forEach(wp => {
            if (selectedForMultiEdit.has(wp.id)) {
                let wpChangedThisIteration = false;
                let gimbalNeedsRecalculationAfterControlChange = false;

                if (newHeadingControl) { 
                    if (wp.headingControl !== newHeadingControl || 
                        (newHeadingControl === 'poi_track' && wp.targetPoiId !== (multiTargetPoiSelect.value ? parseInt(multiTargetPoiSelect.value) : null))) {
                        gimbalNeedsRecalculationAfterControlChange = true; 
                    }
                    wp.headingControl = newHeadingControl;
                    if (newHeadingControl === 'fixed') {
                        wp.fixedHeading = newFixedHeading;
                        wp.targetPoiId = null; 
                    } else if (newHeadingControl === 'poi_track') {
                        wp.targetPoiId = (multiTargetPoiSelect.value) ? parseInt(multiTargetPoiSelect.value) : null;
                    } else { // auto
                        wp.targetPoiId = null;
                    }
                    wpChangedThisIteration = true;
                }
                if (newCameraAction) { 
                    wp.cameraAction = newCameraAction;
                    wpChangedThisIteration = true;
                }

                if (changeGimbalCheckboxState && newGimbalPitchFromSlider !== null) {
                    if (wp.gimbalPitch !== newGimbalPitchFromSlider) {
                        wp.gimbalPitch = newGimbalPitchFromSlider;
                        wpChangedThisIteration = true;
                    }
                } else if (gimbalNeedsRecalculationAfterControlChange && wp.headingControl === 'poi_track' && wp.targetPoiId !== null) {
                    updateGimbalForPoiTrack(wp); 
                }
                
                if (changeHoverCheckboxState && newHoverTimeFromSlider !== null) {
                    if (wp.hoverTime !== newHoverTimeFromSlider) {
                        wp.hoverTime = newHoverTimeFromSlider;
                        wpChangedThisIteration = true;
                    }
                }

                if (wpChangedThisIteration || gimbalNeedsRecalculationAfterControlChange) { 
                    updateMarkerIconStyle(wp); 
                }
            }
        });

        if (changesMadeToAtLeastOneWp || (selectedForMultiEdit.size > 0 && newHeadingControl)) { 
            updateWaypointList();
            updateFlightStatistics(); 
            showCustomAlert(`${selectedForMultiEdit.size} waypoint sono stati aggiornati.`, "Successo"); 
        } else {
            showCustomAlert("Nessuna modifica applicabile specificata.", "Info"); 
        }

        multiHeadingControlSelect.value = ""; 
        if (multiFixedHeadingGroupDiv) multiFixedHeadingGroupDiv.style.display = 'none';
        if (multiTargetPoiForHeadingGroupDiv) multiTargetPoiForHeadingGroupDiv.style.display = 'none';
        multiFixedHeadingSlider.value = 0;
        if (multiFixedHeadingValueEl) multiFixedHeadingValueEl.textContent = "0°";
        multiCameraActionSelect.value = ""; 
        multiChangeGimbalPitchCheckbox.checked = false;
        multiGimbalPitchSlider.disabled = true; 
        multiGimbalPitchSlider.value = 0;
        if (multiGimbalPitchValueEl) multiGimbalPitchValueEl.textContent = "0°";
        multiChangeHoverTimeCheckbox.checked = false;
        multiHoverTimeSlider.disabled = true; 
        multiHoverTimeSlider.value = 0;
        if (multiHoverTimeValueEl) multiHoverTimeValueEl.textContent = "0s";
        if(multiTargetPoiSelect) multiTargetPoiSelect.value = "";
        clearMultiSelection(); 
    }, 0);
}
