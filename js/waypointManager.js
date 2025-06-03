// File: waypointManager.js

// Depends on: config.js, utils.js, uiUpdater.js, mapManager.js, flightPathManager.js

/**
 * Adds a new waypoint to the map and list.
 * @param {L.LatLng} latlng - The latitude and longitude for the new waypoint.
 * @param {object} [options={}] - Optional parameters to override defaults for the new waypoint.
 */
function addWaypoint(latlng, options = {}) {
    if (!map || !defaultAltitudeSlider || !gimbalPitchSlider) return;

    const newWaypoint = {
        id: waypointCounter++,
        latlng: L.latLng(latlng.lat, latlng.lng),
        altitude: options.altitude !== undefined ? options.altitude : parseInt(defaultAltitudeSlider.value),
        hoverTime: options.hoverTime !== undefined ? options.hoverTime : 0,
        gimbalPitch: options.gimbalPitch !== undefined ? options.gimbalPitch : parseInt(gimbalPitchSlider.value),
        headingControl: options.headingControl || 'auto',
        fixedHeading: options.fixedHeading || 0,
        cameraAction: options.cameraAction || 'none',
        targetPoiId: options.targetPoiId || null,
        marker: null 
    };
    
    waypoints.push(newWaypoint);

    const isHome = waypoints.length === 1 && newWaypoint.id === waypoints[0].id;
    const marker = L.marker(newWaypoint.latlng, {
        draggable: true,
        icon: createWaypointIcon(newWaypoint, false, false, isHome) // Initial icon
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
    });
    marker.on('drag', () => { 
        newWaypoint.latlng = marker.getLatLng();
        updateFlightPath(); 
    });
    newWaypoint.marker = marker;

    if (waypoints.length > 1) {
        const prevWpIndex = waypoints.length - 2;
        const prevWp = waypoints[prevWpIndex];
        if (prevWp && prevWp.id !== newWaypoint.id && prevWp.headingControl === 'auto') {
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

/**
 * Deletes the currently selected waypoint.
 */
function deleteSelectedWaypoint() {
    if (!selectedWaypoint) {
        showCustomAlert("Nessun waypoint selezionato da eliminare.", "Info"); 
        return;
    }

    const deletedWaypointId = selectedWaypoint.id;
    // const deletedWaypointIndex = waypoints.findIndex(wp => wp.id === deletedWaypointId); // Non usato direttamente qui, ma utile per logica complessa

    if (selectedWaypoint.marker) {
        map.removeLayer(selectedWaypoint.marker);
    }

    waypoints = waypoints.filter(wp => wp.id !== deletedWaypointId);

    if (selectedForMultiEdit.has(deletedWaypointId)) {
        selectedForMultiEdit.delete(deletedWaypointId);
    }

    selectedWaypoint = null;
    if (waypointControlsDiv) waypointControlsDiv.style.display = 'none';
    
    updateWaypointList(); 
    updateFlightPath();
    updateFlightStatistics();
    updateMultiEditPanelVisibility(); 
    
    waypoints.forEach(wp => updateMarkerIconStyle(wp)); 
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

    const changeGimbalCheckboxState = multiChangeGimbalPitchCheckbox.checked; // Stato checkbox prima di ogni altra cosa
    const changeHoverCheckboxState = multiChangeHoverTimeCheckbox.checked;   // Stato checkbox prima di ogni altra cosa

    // Tentativo di riabilitazione FORZATA basato sullo stato della checkbox
    if (changeGimbalCheckboxState) {
        multiGimbalPitchSlider.disabled = false;
        console.log("Tentativo di abilitare Gimbal slider. Stato attuale .disabled:", multiGimbalPitchSlider.disabled);
    } else { // Se la checkbox non è spuntata, assicurati che lo slider sia disabilitato
        multiGimbalPitchSlider.disabled = true;
    }
    if (changeHoverCheckboxState) {
        multiHoverTimeSlider.disabled = false;
        console.log("Tentativo di abilitare Hover slider. Stato attuale .disabled:", multiHoverTimeSlider.disabled);
    } else { // Se la checkbox non è spuntata, assicurati che lo slider sia disabilitato
        multiHoverTimeSlider.disabled = true;
    }

    // alert("DEBUG PAUSA: Controlla gli slider nel DOM ora!"); 
    debugger; // Usa questo per mettere in pausa se hai gli strumenti per sviluppatori aperti

    console.log("Stato DOPO tentativo riabilitazione E PAUSA - Checkbox Gimbal:", changeGimbalCheckboxState, "Slider value:", multiGimbalPitchSlider.value, "disabled:", multiGimbalPitchSlider.disabled);
    console.log("Stato DOPO tentativo riabilitazione E PAUSA - Checkbox Hover:", changeHoverCheckboxState, "Slider value:", multiHoverTimeSlider.value, "disabled:", multiHoverTimeSlider.disabled);

    const newHeadingControl = multiHeadingControlSelect.value;
    const newFixedHeading = parseInt(multiFixedHeadingSlider.value);
    const newCameraAction = multiCameraActionSelect.value;

    // Leggi i valori solo se le checkbox sono spuntate (gli slider dovrebbero essere abilitati)
    const newGimbalPitch = changeGimbalCheckboxState ? parseInt(multiGimbalPitchSlider.value) : null;
    const newHoverTime = changeHoverCheckboxState ? parseInt(multiHoverTimeSlider.value) : null;

    console.log("--- applyMultiEdit INIZIO (dopo lettura valori) ---");
    console.log("Checkbox Gimbal Selezionata (letta per modifica):", changeGimbalCheckboxState);
    console.log("Nuovo Gimbal Pitch (letto per modifica):", newGimbalPitch, "(Valore grezzo slider:", changeGimbalCheckboxState ? multiGimbalPitchSlider.value : 'N/A', ")");
    console.log("Checkbox Hover Selezionata (letta per modifica):", changeHoverCheckboxState);
    console.log("Nuovo Hover Time (letto per modifica):", newHoverTime, "(Valore grezzo slider:", changeHoverCheckboxState ? multiHoverTimeSlider.value : 'N/A', ")");
    console.log("Numero Waypoint Selezionati:", selectedForMultiEdit.size);
    
    let changesMadeToAtLeastOneWp = false;

    waypoints.forEach(wp => {
        if (selectedForMultiEdit.has(wp.id)) {
            let wpChangedThisIteration = false;
            if (newHeadingControl) { 
                wp.headingControl = newHeadingControl;
                if (newHeadingControl === 'fixed') {
                    wp.fixedHeading = newFixedHeading;
                    wp.targetPoiId = null; 
                } else if (newHeadingControl === 'poi_track') {
                    wp.targetPoiId = (multiTargetPoiSelect.value) ? parseInt(multiTargetPoiSelect.value) : null; // Assicurati di leggere il target POI qui
                } else { 
                    wp.targetPoiId = null;
                }
                wpChangedThisIteration = true;
            }
            if (newCameraAction) { 
                wp.cameraAction = newCameraAction;
                wpChangedThisIteration = true;
            }

            if (changeGimbalCheckboxState && newGimbalPitch !== null) {
                wp.gimbalPitch = newGimbalPitch;
                wpChangedThisIteration = true;
            }
            if (changeHoverCheckboxState && newHoverTime !== null) {
                wp.hoverTime = newHoverTime;
                wpChangedThisIteration = true;
            }

            if (wpChangedThisIteration) {
                changesMadeToAtLeastOneWp = true;
                updateMarkerIconStyle(wp); 
            }
        }
    });
    console.log("--- applyMultiEdit FINE CICLO WAYPOINTS ---");

    if (changesMadeToAtLeastOneWp) {
        updateWaypointList();
        updateFlightStatistics(); 
        showCustomAlert(`${selectedForMultiEdit.size} waypoint sono stati aggiornati.`, "Successo"); 
    } else {
        showCustomAlert("Nessuna modifica specificata o nessun valore valido per le modifiche. Waypoint non modificati.", "Info"); 
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
}
