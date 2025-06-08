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
        marker: null 
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
                
                // --- PUNTO CHIAVE DELLA CORREZIONE ---
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
        if (!this.getPopup()) { this.bindPopup(popupContent).openPopup(); } 
        else { this.setPopupContent(popupContent).openPopup(); }
    });
    newWaypoint.marker = marker;

    if (isFirstWaypointBeingAdded && typeof getElevationsBatch === "function" && homeElevationMslInput) {
        console.log(`Primo waypoint (ID: ${newWaypoint.id}) aggiunto. Tento di impostare l'elevazione di decollo e del WP1.`);
        if(loadingOverlayEl) loadingOverlayEl.style.display = 'flex';
        if(loadingOverlayEl) loadingOverlayEl.textContent = "Recupero elevazione decollo da WP1...";
        
        const elevations = await getElevationsBatch([{ lat: newWaypoint.latlng.lat, lng: newWaypoint.latlng.lng }]);
        
        if(loadingOverlayEl) loadingOverlayEl.style.display = 'none';

        if (elevations && elevations.length > 0 && elevations[0] !== null) {
            const terrainElev = Math.round(elevations[0]);
            homeElevationMslInput.value = terrainElev; 
            newWaypoint.terrainElevationMSL = terrainElev; 
            
            console.log(`Elevazione decollo impostata a ${homeElevationMslInput.value}m MSL. WP1.terrainElevationMSL: ${newWaypoint.terrainElevationMSL}m.`);

            // --- PUNTO CHIAVE DELLA CORREZIONE ---
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
    console.log(`selectWaypoint: Inizio per WP ID ${waypoint.id}`); 
    const previouslySelectedSingleId = selectedWaypoint ? selectedWaypoint.id : null;
    if (selectedForMultiEdit.size > 0) {
        console.log("selectWaypoint: C'è una multi-selezione attiva. Chiamo clearMultiSelection."); 
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
    console.log("selectWaypoint: Chiamo updateSingleWaypointEditControls."); 
    updateSingleWaypointEditControls(); 
    updateWaypointList(); 
    if (selectedWaypoint.marker) {
        map.panTo(selectedWaypoint.latlng); 
    }
    updateMultiEditPanelVisibility(); 
    console.log(`selectWaypoint: Fine per WP ID ${waypoint.id}. Pannello singolo display: ${waypointControlsDiv ? waypointControlsDiv.style.display : 'N/A'}, Pannello multi display: ${multiWaypointEditControlsDiv ? multiWaypointEditControlsDiv.style.display : 'N/A'}`);
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
    
    if (deletedWaypointIndex === 0 && waypoints.length > 0) {
        console.log("Il primo waypoint è stato eliminato. Ridisegno le icone.");
    } else if (deletedWaypointIndex > 0 && deletedWaypointIndex -1 < waypoints.length) { 
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
    
    if (typeof clearPOIs === "function") { 
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
    
    lastAltitudeAdaptationMode = 'relative'; 
    if(typeof updatePathModeDisplay === "function") updatePathModeDisplay();
    updateFlightPath(); 

    updateWaypointList();
    updateFlightStatistics();
}

function toggleMultiSelectWaypoint(waypointId, isChecked) {
    const waypoint = waypoints.find(wp => wp.id === waypointId);
    if (!waypoint) { console.error(`toggleMultiSelectWaypoint: Waypoint con ID ${waypointId} non trovato.`); return; }
    console.log(`toggleMultiSelectWaypoint: WP ID=${waypointId}, checked=${isChecked}`);
    if (isChecked) {
        selectedForMultiEdit.add(waypointId);
        if (selectedWaypoint) {
            console.log(`toggleMultiSelectWaypoint: Deseleziono WP singolo ${selectedWaypoint.id} perché inizia multi-selezione.`);
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
        const allCurrentlySelected = waypoints.length > 0 && waypoints.every(wp => selectedForMultiEdit.has(wp.id));
        selectAllWaypointsCheckboxEl.checked = allCurrentlySelected;
    }
    updateWaypointList(); 
    console.log("toggleMultiSelectWaypoint: Chiamo updateMultiEditPanelVisibility.");
    updateMultiEditPanelVisibility(); 
    console.log(`toggleMultiSelectWaypoint: Fine. Pannello singolo display: ${waypointControlsDiv ? waypointControlsDiv.style.display : 'N/A'}, Pannello multi display: ${multiWaypointEditControlsDiv ? multiWaypointEditControlsDiv.style.display : 'N/A'}`);
    console.log("toggleMultiSelectWaypoint: selectedForMultiEdit Set:", Array.from(selectedForMultiEdit));
}

function toggleSelectAllWaypoints(isChecked) {
    console.log("toggleSelectAllWaypoints chiamata con isChecked:", isChecked);
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
    console.log("toggleSelectAllWaypoints: selectedForMultiEdit Set dopo operazione:", Array.from(selectedForMultiEdit));
}

function clearMultiSelection() {
    console.log("clearMultiSelection chiamata.");
    const previouslyMultiSelectedIds = new Set(selectedForMultiEdit); 
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

    const requiredPitch = calculateRequiredGimbalPitch(waypointAMSL, poiAMSL, horizontalDistance);
    if (waypoint.gimbalPitch !== requiredPitch) {
        console.log(`  >>> WP ${waypoint.id}: Aggiornamento Gimbal Pitch da ${waypoint.gimbalPitch}° a ${requiredPitch}°`);
        waypoint.gimbalPitch = requiredPitch; 
        if (selectedWaypoint && selectedWaypoint.id === waypoint.id && (waypointControlsDiv.style.display === 'block' || forceUpdateUI)) {
            if (gimbalPitchSlider) gimbalPitchSlider.value = waypoint.gimbalPitch;
            if (gimbalPitchValueEl) gimbalPitchValueEl.textContent = waypoint.gimbalPitch + '°';
        }
    }
}

function applyMultiEdit() {
    console.log("applyMultiEdit: Funzione INIZIATA."); 
    if (selectedForMultiEdit.size === 0) {
        console.log("applyMultiEdit: Uscita perché selectedForMultiEdit.size === 0."); 
        showCustomAlert("Nessun waypoint selezionato per la modifica multipla.", "Attenzione");
        return;
    }
    if (!multiHeadingControlSelect || !multiFixedHeadingSlider || !multiCameraActionSelect ||
        !multiChangeGimbalPitchCheckbox || !multiGimbalPitchSlider ||
        !multiChangeHoverTimeCheckbox || !multiHoverTimeSlider || !multiTargetPoiSelect) {
        console.log("applyMultiEdit: Uscita perché uno o più elementi DOM dei controlli multi-edit sono mancanti."); 
        showCustomAlert("Controlli per la modifica multipla non trovati.", "Errore Interno");
        return;
    }
    console.log("applyMultiEdit: Condizioni di guardia superate. Procedo con la logica...");
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
            showCustomAlert("Nessuna modifica applicabile specificata o valori non modificati.", "Info"); 
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
