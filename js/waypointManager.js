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
        updateMarkerIconStyle(newWaypoint); // Update its own marker style (including heading arrow)
        const wpIndex = waypoints.findIndex(wp => wp.id === newWaypoint.id);
        if (wpIndex > 0 && waypoints[wpIndex-1].headingControl === 'auto') { // Update previous if its auto heading changed
            updateMarkerIconStyle(waypoints[wpIndex-1]);
        }
        updateGimbalForPoiTrack(newWaypoint, true); // Recalculate gimbal if POI_TRACK and position changed
    });
    marker.on('drag', () => { 
        newWaypoint.latlng = marker.getLatLng();
        updateFlightPath(); 
        // Optional: Live gimbal update during drag (can be intensive)
        // if(newWaypoint.headingControl === 'poi_track') updateGimbalForPoiTrack(newWaypoint);
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

    // Update heading of previous waypoint if it was 'auto'
    if (waypoints.length > 1) {
        const prevWpIndex = waypoints.length - 2; // Index of the waypoint just before the new one
        const prevWp = waypoints[prevWpIndex];
        if (prevWp && prevWp.headingControl === 'auto') { // prevWp.id !== newWaypoint.id is implicitly true
            updateMarkerIconStyle(prevWp);
        }
    }
    
    updateWaypointList();
    updateFlightPath();
    updateFlightStatistics();
    selectWaypoint(newWaypoint); 
}

/**
 * Selects a waypoint, updating UI and map markers.
 * @param {object} waypoint - The waypoint object to select.
 */
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
    updateMarkerIconStyle(selectedWaypoint); // Update current selected
    // Ensure other waypoints are not styled as single selected
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

/**
 * Deletes the currently selected waypoint.
 */
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
    
    // Update heading of the waypoint that was BEFORE the deleted one, if its heading was 'auto'
    if (deletedWaypointIndex > 0 && deletedWaypointIndex -1 < waypoints.length) { 
        const prevWp = waypoints[deletedWaypointIndex - 1]; // This is now the waypoint at the new index
        if (prevWp && prevWp.headingControl === 'auto') {
            updateMarkerIconStyle(prevWp);
        }
    }
    // Also, if the deleted waypoint was not the last, the one that FOLLOWED it might have its 'auto' heading changed
    // if its 'next' waypoint is now different. But this is covered by refreshing all.

    updateWaypointList(); 
    updateFlightPath();
    updateFlightStatistics();
    updateMultiEditPanelVisibility(); 
    waypoints.forEach(wp => updateMarkerIconStyle(wp)); // Refresh all to update home point and auto headings
}

/**
 * Clears all waypoints from the map and list.
 */
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
    updateWaypointList();
    updateFlightPath();
    updateFlightStatistics();
}

/**
 * Toggles the multi-selection state of a single waypoint.
 * @param {number} waypointId - The ID of the waypoint to toggle.
 * @param {boolean} isChecked - The new checked state from the checkbox.
 */
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

/**
 * Toggles the selection state of all waypoints for multi-editing.
 * @param {boolean} isChecked - True to select all, false to deselect all.
 */
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

/**
 * Clears the current multi-selection of waypoints.
 */
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
 * Updates the gimbal pitch of a waypoint if it is in POI_TRACK mode.
 * @param {object} waypoint - The waypoint object to update.
 * @param {boolean} [forceUpdateUI=false] - If true, forces update of single waypoint edit controls if this is the selected waypoint.
 */
function updateGimbalForPoiTrack(waypoint, forceUpdateUI = false) {
    if (!waypoint || waypoint.headingControl !== 'poi_track' || waypoint.targetPoiId === null) {
        return; 
    }

    const targetPoi = pois.find(p => p.id === waypoint.targetPoiId);
    if (!targetPoi) {
        console.warn(`POI target ID ${waypoint.targetPoiId} non trovato per WP ${waypoint.id} durante calcolo gimbal.`);
        return; 
    }

    const homeElevation = parseFloat(homeElevationMslInput.value) || 0;
    const waypointAMSL = homeElevation + waypoint.altitude;
    const poiAMSL = targetPoi.altitude; 
    const horizontalDistance = haversineDistance(waypoint.latlng, targetPoi.latlng);

    // <<< LOG DI DEBUG DETTAGLIATI >>>
    console.log(`updateGimbalForPoiTrack per WP ${waypoint.id}:`);
    console.log(`  - WP LatLng: ${waypoint.latlng.lat}, ${waypoint.latlng.lng}`);
    console.log(`  - POI LatLng: ${targetPoi.latlng.lat}, ${targetPoi.latlng.lng}`);
    console.log(`  - Home Elevation: ${homeElevation}`);
    console.log(`  - WP Relative Alt: ${waypoint.altitude}`);
    console.log(`  - WP AMSL (observerAMSL): ${waypointAMSL}`);
    console.log(`  - POI AMSL (targetAMSL): ${poiAMSL}`);
    console.log(`  - Horizontal Distance: ${horizontalDistance}`);
    console.log(`  - Delta Altitude (target - observer): ${poiAMSL - waypointAMSL}`);
    // <<< FINE LOG DI DEBUG DETTAGLIATI >>>

    const requiredPitch = calculateRequiredGimbalPitch(waypointAMSL, poiAMSL, horizontalDistance);
    
    console.log(`  - Required Pitch CALCOLATO: ${requiredPitch}`); // Log del risultato

    if (waypoint.gimbalPitch !== requiredPitch) {
        console.log(`  - WP ${waypoint.id}: Aggiornamento Gimbal Pitch da ${waypoint.gimbalPitch}° a ${requiredPitch}°`);
        waypoint.gimbalPitch = requiredPitch;
        
        if (selectedWaypoint && selectedWaypoint.id === waypoint.id && (waypointControlsDiv.style.display === 'block' || forceUpdateUI)) {
            if (gimbalPitchSlider) gimbalPitchSlider.value = waypoint.gimbalPitch;
            if (gimbalPitchValueEl) gimbalPitchValueEl.textContent = waypoint.gimbalPitch + '°';
        }
    } else {
        console.log(`  - WP ${waypoint.id}: Gimbal Pitch (${waypoint.gimbalPitch}°) già corretto, nessun aggiornamento.`);
    }
}

/**
 * Applies bulk edits to all waypoints currently in the multi-selection set.
 */
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
                let gimbalNeedsRecalculation = false;

                if (newHeadingControl) { 
                    if (wp.headingControl !== newHeadingControl || 
                        (newHeadingControl === 'poi_track' && wp.targetPoiId !== (multiTargetPoiSelect.value ? parseInt(multiTargetPoiSelect.value) : null))) {
                        gimbalNeedsRecalculation = true; // Heading control or target POI changed
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

                // Gimbal Pitch Logic
                if (changeGimbalCheckboxState && newGimbalPitchFromSlider !== null) {
                    // User is explicitly setting gimbal pitch
                    if (wp.gimbalPitch !== newGimbalPitchFromSlider) {
                        wp.gimbalPitch = newGimbalPitchFromSlider;
                        wpChangedThisIteration = true;
                    }
                } else if (gimbalNeedsRecalculation && wp.headingControl === 'poi_track' && wp.targetPoiId !== null) {
                    // Heading control changed to POI_TRACK, and user is NOT setting gimbal pitch explicitly
                    updateGimbalForPoiTrack(wp); // This might change wp.gimbalPitch
                    // We don't set wpChangedThisIteration = true here directly from gimbal,
                    // because if gimbal didn't change, we don't want to count it as "user change"
                    // However, the marker update below will catch it.
                }
                
                if (changeHoverCheckboxState && newHoverTimeFromSlider !== null) {
                    if (wp.hoverTime !== newHoverTimeFromSlider) {
                        wp.hoverTime = newHoverTimeFromSlider;
                        wpChangedThisIteration = true;
                    }
                }

                if (wpChangedThisIteration || gimbalNeedsRecalculation) { // Also update marker if gimbal might have auto-updated
                    updateMarkerIconStyle(wp); 
                }
            }
        });

        if (changesMadeToAtLeastOneWp || selectedForMultiEdit.size > 0) { 
            updateWaypointList();
            updateFlightStatistics(); 
            showCustomAlert(`${selectedForMultiEdit.size} waypoint sono stati aggiornati.`, "Successo"); 
        } else {
            showCustomAlert("Nessuna modifica applicabile specificata.", "Info"); 
        }

        // Reset multi-edit form fields
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
