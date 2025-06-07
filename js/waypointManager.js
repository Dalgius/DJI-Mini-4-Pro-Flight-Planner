// File: waypointManager.js

// Depends on: config.js, utils.js (calculateRequiredGimbalPitch, haversineDistance), 
// uiUpdater.js, mapManager.js, flightPathManager.js

/**
 * Adds a new waypoint to the map and list.
 * @param {L.LatLng} latlng - The latitude and longitude for the new waypoint.
 * @param {object} [options={}] - Optional parameters {id, altitude, gimbalPitch, headingControl, targetPoiId, etc.}.
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
    // waypointCounter è già gestito sopra o in loadFlightPlan per l'import
    
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
        if (newWaypoint.headingControl === 'poi_track') {
            updateGimbalForPoiTrack(newWaypoint, true); 
        }
    });
    marker.on('drag', () => { 
        newWaypoint.latlng = marker.getLatLng();
        updateFlightPath(); 
        if(newWaypoint.headingControl === 'poi_track'){ 
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
    if (newWaypoint.headingControl === 'poi_track' && newWaypoint.targetPoiId !== null) {
        updateGimbalForPoiTrack(newWaypoint);
    }
    
    updateWaypointList();
    updateFlightPath();
    updateFlightStatistics();
    if (options.id === undefined || options.calledFromLoad !== true) { // Non selezionare se chiamato da loadFlightPlan finché tutto non è caricato
        selectWaypoint(newWaypoint); 
    }
}

function selectWaypoint(waypoint) {
    if (!waypoint) return;
    const previouslySelectedSingleId = selectedWaypoint ? selectedWaypoint.id : null;
    
    // Se si sta selezionando un singolo waypoint, e la modalità multi-selezione è attiva,
    // si esce dalla modalità multi-selezione.
    if (selectedForMultiEdit.size > 0) {
        console.log("selectWaypoint: Uscita dalla modalità multi-selezione per selezionare un singolo waypoint.");
        clearMultiSelection(); 
    }

    selectedWaypoint = waypoint;
    if (previouslySelectedSingleId && previouslySelectedSingleId !== waypoint.id) {
        const prevWp = waypoints.find(wp => wp.id === previouslySelectedSingleId);
        if (prevWp) updateMarkerIconStyle(prevWp);
    }
    updateMarkerIconStyle(selectedWaypoint); 
    waypoints.forEach(wp => { // Assicura che solo il selezionato abbia lo stile "selected"
        if (wp.id !== selectedWaypoint.id && !selectedForMultiEdit.has(wp.id)) { // Non toccare quelli in multi-selezione (anche se non dovrebbe accadere qui)
            updateMarkerIconStyle(wp); 
        }
    });
    updateSingleWaypointEditControls(); 
    updateWaypointList(); // Aggiorna la lista per evidenziare il selezionato
    if (selectedWaypoint.marker) {
        map.panTo(selectedWaypoint.latlng); 
    }
    updateMultiEditPanelVisibility(); // Nasconde il pannello multi-edit, mostra quello singolo
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

    if (selectedForMultiEdit.has(deletedWaypointId)) { // Rimuovi anche dalla multi-selezione se presente
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
    clearMultiSelection(); // Questo svuota selectedForMultiEdit e aggiorna la UI del pannello multi-edit
    if (waypointControlsDiv) waypointControlsDiv.style.display = 'none';
    
    if (typeof clearPOIs === "function") { // Se hai una funzione dedicata per i POI
        clearPOIs(); 
    } else { 
        if(pois) pois.forEach(p => { if(p.marker) map.removeLayer(p.marker); });
        pois = [];
        poiCounter = 1;
        if(typeof updatePOIList === "function") updatePOIList();
        if(poiNameInput) poiNameInput.value = "";
        if(poiObjectHeightInputEl) poiObjectHeightInputEl.value = "0";
        if(poiTerrainElevationInputEl) {
            poiTerrainElevationInputEl.value = "0";
            poiTerrainElevationInputEl.readOnly = true;
        }
        if(typeof updatePoiFinalAltitudeDisplay === "function") updatePoiFinalAltitudeDisplay();
        lastActivePoiForTerrainFetch = null;
    }
    updateWaypointList(); // Aggiorna lista (mostrerà "nessun waypoint")
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
    if (!waypoint) {
        console.error(`toggleMultiSelectWaypoint: Waypoint con ID ${waypointId} non trovato.`);
        return;
    }

    console.log(`toggleMultiSelectWaypoint: WP ID=${waypointId}, checked=${isChecked}`);

    if (isChecked) {
        selectedForMultiEdit.add(waypointId);
        // Se un singolo waypoint era selezionato, deselezionalo perché stiamo entrando in modalità multi-selezione
        if (selectedWaypoint) {
            console.log(`toggleMultiSelectWaypoint: Deseleziono WP singolo ${selectedWaypoint.id} perché inizia multi-selezione.`);
            const oldSelectedWpObject = selectedWaypoint; // Salva l'oggetto
            selectedWaypoint = null; // Rimuovi la selezione singola
            if (waypointControlsDiv) waypointControlsDiv.style.display = 'none'; // Nascondi pannello modifica singola
            updateMarkerIconStyle(oldSelectedWpObject); // Aggiorna lo stile del marker precedentemente selezionato
        }
    } else {
        selectedForMultiEdit.delete(waypointId);
    }

    updateMarkerIconStyle(waypoint); // Aggiorna lo stile del marker del waypoint (de)selezionato

    // Aggiorna lo stato della checkbox "Select/Deselect All"
    if (selectAllWaypointsCheckboxEl) {
        const allCurrentlySelected = waypoints.length > 0 && waypoints.every(wp => selectedForMultiEdit.has(wp.id));
        selectAllWaypointsCheckboxEl.checked = allCurrentlySelected;
    }

    updateWaypointList(); // Ridisegna la lista per riflettere gli stili di selezione
    updateMultiEditPanelVisibility(); // Mostra/nascondi o aggiorna il pannello di modifica multipla
    console.log("toggleMultiSelectWaypoint: selectedForMultiEdit Set:", Array.from(selectedForMultiEdit));
}

/**
 * Toggles the selection state of all waypoints for multi-editing.
 * @param {boolean} isChecked - True to select all, false to deselect all.
 */
function toggleSelectAllWaypoints(isChecked) {
    console.log("toggleSelectAllWaypoints chiamata con isChecked:", isChecked);
    
    if (selectedWaypoint) { // Se c'era una selezione singola, annullala
        const oldSelectedWpObject = selectedWaypoint;
        selectedWaypoint = null;
        if (waypointControlsDiv) waypointControlsDiv.style.display = 'none';
        updateMarkerIconStyle(oldSelectedWpObject); // Rimuovi lo stile di selezione singola dal marker
    }
    
    selectedForMultiEdit.clear(); // Svuota sempre prima, poi ripopola se isChecked è true
    if (isChecked && waypoints.length > 0) {
        waypoints.forEach(wp => selectedForMultiEdit.add(wp.id));
    }

    waypoints.forEach(wp => updateMarkerIconStyle(wp)); // Aggiorna lo stile di tutti i marker
    updateWaypointList(); 
    updateMultiEditPanelVisibility(); 
    console.log("toggleSelectAllWaypoints: selectedForMultiEdit Set dopo operazione:", Array.from(selectedForMultiEdit));
}

/**
 * Clears the current multi-selection of waypoints.
 */
function clearMultiSelection() {
    console.log("clearMultiSelection chiamata.");
    const previouslyMultiSelectedIds = new Set(selectedForMultiEdit); // Copia per iterare
    selectedForMultiEdit.clear();

    if (selectAllWaypointsCheckboxEl) selectAllWaypointsCheckboxEl.checked = false;

    previouslyMultiSelectedIds.forEach(id => {
        const waypoint = waypoints.find(wp => wp.id === id);
        if (waypoint) updateMarkerIconStyle(waypoint); 
    });

    updateWaypointList(); 
    updateMultiEditPanelVisibility(); 
    console.log("clearMultiSelection: selectedForMultiEdit Set svuotato.");
}

/**
 * Updates the gimbal pitch of a waypoint if it is in POI_TRACK mode.
 * @param {object} waypoint - The waypoint object to update.
 * @param {boolean} [forceUpdateUI=false] - If true, forces update of single waypoint edit controls if this is the selected waypoint.
 */
function updateGimbalForPoiTrack(waypoint, forceUpdateUI = false) {
    // ... (funzione updateGimbalForPoiTrack come nella tua ultima versione corretta, con i log) ...
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
    console.log(`--- updateGimbalForPoiTrack INIZIO per WP ${waypoint.id} ---`);
    console.log(`  WP ID: ${waypoint.id}, Target POI ID: ${targetPoi.id} ('${targetPoi.name}')`);
    console.log(`  Home Elevation MSL: ${homeElevation.toFixed(1)}m`);
    console.log(`  Waypoint Rel. Alt: ${waypoint.altitude}m => Waypoint AMSL: ${waypointAMSL.toFixed(1)}m`);
    console.log(`  POI AMSL (targetPoi.altitude): ${poiAMSL.toFixed(1)}m`);
    console.log(`  Distanza Orizzontale WP-POI: ${horizontalDistance.toFixed(1)}m`);
    console.log(`  Delta Altitudine (POI_AMSL - WP_AMSL): ${(poiAMSL - waypointAMSL).toFixed(1)}m`);
    const requiredPitch = calculateRequiredGimbalPitch(waypointAMSL, poiAMSL, horizontalDistance);
    console.log(`  Required Pitch CALCOLATO: ${requiredPitch}° (Precedente: ${waypoint.gimbalPitch}°)`);
    if (waypoint.gimbalPitch !== requiredPitch) {
        console.log(`  >>> WP ${waypoint.id}: Aggiornamento Gimbal Pitch da ${waypoint.gimbalPitch}° a ${requiredPitch}°`);
        waypoint.gimbalPitch = requiredPitch; 
        if (selectedWaypoint && selectedWaypoint.id === waypoint.id && (waypointControlsDiv.style.display === 'block' || forceUpdateUI)) {
            if (gimbalPitchSlider) gimbalPitchSlider.value = waypoint.gimbalPitch;
            if (gimbalPitchValueEl) gimbalPitchValueEl.textContent = waypoint.gimbalPitch + '°';
        }
    }
    console.log(`--- updateGimbalForPoiTrack FINE per WP ${waypoint.id} (Gimbal ora è ${waypoint.gimbalPitch}°) ---`);
}


function applyMultiEdit() {
    // ... (funzione applyMultiEdit come nella tua ultima versione corretta, con il setTimeout) ...
    if (selectedForMultiEdit.size === 0) { /* ... */ }
    if (!multiHeadingControlSelect /* ... */) { /* ... */ }
    const changeGimbalCheckboxState = multiChangeGimbalPitchCheckbox.checked;
    const changeHoverCheckboxState = multiChangeHoverTimeCheckbox.checked;
    if (changeGimbalCheckboxState) multiGimbalPitchSlider.disabled = false; else multiGimbalPitchSlider.disabled = true;
    if (changeHoverCheckboxState) multiHoverTimeSlider.disabled = false; else multiHoverTimeSlider.disabled = true;
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
                    } else { 
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
