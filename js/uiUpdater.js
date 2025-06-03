// File: uiUpdater.js

// Depends on: config.js, utils.js, waypointManager.js (for selectWaypoint, toggleMultiSelectWaypoint), mapManager.js (for updateMarkerIconStyle)

/**
 * Updates the flight statistics displayed in the sidebar.
 */
function updateFlightStatistics() {
    if (!totalDistanceEl || !flightTimeEl || !waypointCountEl || !poiCountEl || !flightSpeedSlider || !pathTypeSelect) return;

    let totalDist = 0;
    const speed = parseFloat(flightSpeedSlider.value) || 1;

    if (waypoints.length >= 2) {
        const pathLatLngs = (pathTypeSelect.value === 'curved' && flightPath && flightPath.getLatLngs) ?
                            flightPath.getLatLngs() :
                            waypoints.map(wp => wp.latlng);

        for (let i = 0; i < pathLatLngs.length - 1; i++) {
            totalDist += haversineDistance(pathLatLngs[i], pathLatLngs[i + 1]);
        }
    }

    let totalHover = waypoints.reduce((sum, wp) => sum + (wp.hoverTime || 0), 0);
    const flightDurationSec = (totalDist / (speed > 0 ? speed : 1)) + totalHover;
    const mins = Math.floor(flightDurationSec / 60);
    const secs = Math.round(flightDurationSec % 60);

    totalDistanceEl.textContent = `${Math.round(totalDist)} m`;
    flightTimeEl.textContent = `${mins} min ${secs} sec`;
    waypointCountEl.textContent = waypoints.length;
    poiCountEl.textContent = pois.length;
}

/**
 * Populates a select dropdown with available POIs.
 * @param {HTMLSelectElement} selectElement - The <select> DOM element.
 * @param {number|null} [selectedPoiId=null] - The ID of the POI to be pre-selected.
 * @param {boolean} [addDefaultOption=true] - Whether to add a default "-- Select POI --" option.
 * @param {string} [defaultOptionText="-- Select POI --"] - Text for the default option.
 */
function populatePoiSelectDropdown(selectElement, selectedPoiId = null, addDefaultOption = true, defaultOptionText = "-- Select POI --") {
    if (!selectElement) return;
    selectElement.innerHTML = ''; 

    if (addDefaultOption) {
        const defaultOpt = document.createElement('option');
        defaultOpt.value = "";
        defaultOpt.textContent = defaultOptionText;
        selectElement.appendChild(defaultOpt);
    }

    if (pois.length === 0) {
        selectElement.disabled = true;
        if (addDefaultOption && selectElement.options[0]) {
            selectElement.options[0].textContent = "Nessun POI disponibile"; 
        }
        return;
    }

    selectElement.disabled = false;
    if (addDefaultOption && selectElement.options[0] && selectElement.options[0].textContent === "Nessun POI disponibile") { 
        selectElement.options[0].textContent = defaultOptionText;
    }

    pois.forEach(poi => {
        const option = document.createElement('option');
        option.value = poi.id;
        option.textContent = `${poi.name} (ID: ${poi.id}, Alt: ${poi.altitude}m MSL)`; // Show POI altitude in dropdown
        if (selectedPoiId !== null && poi.id === parseInt(selectedPoiId)) {
            option.selected = true;
        }
        selectElement.appendChild(option);
    });
}


/**
 * Updates the list of waypoints displayed in the sidebar.
 */
function updateWaypointList() {
    if (!waypointListEl || !selectAllWaypointsCheckboxEl) return;

    if (waypoints.length === 0) {
        waypointListEl.innerHTML = '<div style="text-align: center; color: #95a5a6; font-size: 12px; padding: 20px;">Clicca sulla mappa per aggiungere waypoint</div>';
        selectAllWaypointsCheckboxEl.checked = false;
        selectAllWaypointsCheckboxEl.disabled = true;
        if (selectedForMultiEdit.size === 0) updateMultiEditPanelVisibility();
        return;
    }
    selectAllWaypointsCheckboxEl.disabled = false;

    let homeElevation = 0;
    if (homeElevationMslInput && homeElevationMslInput.value !== "") {
        homeElevation = parseFloat(homeElevationMslInput.value);
        if (isNaN(homeElevation)) homeElevation = 0; 
    }

    waypointListEl.innerHTML = waypoints.map(wp => {
        let actionText = getCameraActionText(wp.cameraAction);
        let hoverText = wp.hoverTime > 0 ? ` | Hover: ${wp.hoverTime}s` : '';
        let poiTargetText = '';
        if (wp.headingControl === 'poi_track' && wp.targetPoiId != null) {
            const target = pois.find(p => p.id === wp.targetPoiId);
            poiTargetText = target ? ` | Target: ${target.name}` : ` | Target: POI ID ${wp.targetPoiId} (not found)`;
        }
        let actionInfo = actionText ? `<div class="waypoint-action-info" style="margin-top:3px;">Azione: ${actionText}${poiTargetText}</div>` : (poiTargetText ? `<div class="waypoint-action-info" style="margin-top:3px;">${poiTargetText.substring(3)}</div>` : '');

        const isSelectedForMulti = selectedForMultiEdit.has(wp.id);
        let itemClasses = "waypoint-item";

        if (selectedWaypoint && wp.id === selectedWaypoint.id && waypointControlsDiv && waypointControlsDiv.style.display === 'block' && !multiWaypointEditControlsDivIsVisible()) {
             itemClasses += " selected";
        }
        if (isSelectedForMulti) {
            itemClasses += " multi-selected-item";
        }

        const altitudeRelToHome = wp.altitude; 
        const terrainElevText = wp.terrainElevationMSL !== null ? `${wp.terrainElevationMSL.toFixed(1)} m` : "N/A";
        let amslText = "N/A";
        let aglText = "N/A";

        if (typeof homeElevation === 'number') {
            amslText = `${(homeElevation + altitudeRelToHome).toFixed(1)} m`;
        }

        if (wp.terrainElevationMSL !== null && typeof homeElevation === 'number') {
            const amslWaypoint = homeElevation + altitudeRelToHome;
            aglText = `${(amslWaypoint - wp.terrainElevationMSL).toFixed(1)} m`;
        }

        return `
        <div class="${itemClasses}" onclick="handleWaypointListItemClick(${wp.id})">
            <div style="display: flex; align-items: flex-start;"> 
                <input type="checkbox" class="waypoint-multi-select-cb" data-id="${wp.id}"
                       onchange="handleWaypointListCheckboxChange(${wp.id}, this.checked)"
                       ${isSelectedForMulti ? 'checked' : ''}
                       style="margin-right: 10px; transform: scale(1.2); margin-top: 3px;" 
                       onclick="event.stopPropagation();">
                <div style="font-size: 11px; line-height: 1.35;"> 
                    <div class="waypoint-header" style="margin-bottom: 2px;"><span class="waypoint-name">Waypoint ${wp.id}</span></div>
                    <div class="waypoint-coords" style="margin-bottom: 4px; font-size: 0.95em; color: #b0bec5;">Lat: ${wp.latlng.lat.toFixed(4)}, Lng: ${wp.latlng.lng.toFixed(4)}</div>
                    <div class="waypoint-altitudes" style="margin-bottom: 3px; color: #dfe6e9;">
                        Alt. Volo (Rel): <strong>${altitudeRelToHome}m</strong>${hoverText}<br>
                        Alt. AMSL: ${amslText}<br>
                        Alt. AGL: ${aglText}<br>
                        Elev. Terreno: ${terrainElevText}
                    </div>
                    ${actionInfo}
                </div>
            </div>
        </div>`;
    }).join('');

    if (waypoints.length === 0 && selectedForMultiEdit.size === 0) {
        updateMultiEditPanelVisibility();
    }
}

/**
 * Helper to check if multi-waypoint edit panel is currently visible.
 * @returns {boolean}
 */
function multiWaypointEditControlsDivIsVisible() {
    return multiWaypointEditControlsDiv && multiWaypointEditControlsDiv.style.display === 'block';
}

/**
 * Handles click on a waypoint item in the list.
 */
function handleWaypointListItemClick(wpId) {
    const wp = waypoints.find(w => w.id === wpId);
    if (wp) {
        selectWaypoint(wp); 
    }
}

/**
 * Handles checkbox change for multi-selecting a waypoint from the list.
 */
function handleWaypointListCheckboxChange(waypointId, isChecked) {
    toggleMultiSelectWaypoint(waypointId, isChecked); 
}


/**
 * Updates the display of the POI list in the sidebar.
 */
function updatePOIList() {
    if (!poiListEl) return;
    const noPoiAvailableText = "Nessun POI disponibile"; 

    if (pois.length === 0) {
        poiListEl.innerHTML = '<div style="text-align: center; color: #95a5a6; font-size: 12px; padding: 10px;">Nessun POI aggiunto</div>'; 
        if (targetPoiSelect) {
            targetPoiSelect.disabled = true;
            targetPoiSelect.innerHTML = `<option value="">${noPoiAvailableText}</option>`;
        }
        if (multiTargetPoiSelect) {
            multiTargetPoiSelect.disabled = true;
            multiTargetPoiSelect.innerHTML = `<option value="">${noPoiAvailableText}</option>`;
        }
        if (orbitPoiSelectEl) { 
            orbitPoiSelectEl.disabled = true;
            orbitPoiSelectEl.innerHTML = `<option value="">${noPoiAvailableText}</option>`;
        }
        return;
    }

    if (targetPoiSelect) targetPoiSelect.disabled = false;
    if (multiTargetPoiSelect) multiTargetPoiSelect.disabled = false;
    if (orbitPoiSelectEl) orbitPoiSelectEl.disabled = false;

    poiListEl.innerHTML = pois.map(poi => `
        <div class="poi-item" style="align-items: center;">
            <div style="flex-grow: 1;">
                <span class="poi-name" style="font-size:12px;">${poi.name} (ID: ${poi.id})</span>
            </div>
            <div style="display: flex; align-items: center; gap: 5px;">
                <label for="poi_alt_${poi.id}" class="control-label" style="margin-bottom:0; font-size:10px; color: #bdc3c7;">Alt(MSL):</label>
                <input type="number" id="poi_alt_${poi.id}" class="control-input-small" 
                       value="${poi.altitude}" step="1" style="width: 50px; padding: 3px 5px; font-size:11px; margin-left:0;"
                       onchange="handlePoiAltitudeChange(${poi.id}, this.value)"
                       oninput="this.style.borderColor=''; this.title='';" 
                       title="POI Altitude (MSL)">
                <button class="poi-delete" onclick="deletePOI(${poi.id})" title="Elimina POI ${poi.name}">✕</button>
            </div>
        </div>`).join('');
}

/**
 * Handles changes to a POI's altitude from the input field in the list.
 * @param {number} poiId - The ID of the POI.
 * @param {string} newAltitudeStr - The new altitude as a string from the input.
 */
function handlePoiAltitudeChange(poiId, newAltitudeStr) {
    const poi = pois.find(p => p.id === poiId);
    const inputElement = document.getElementById(`poi_alt_${poiId}`);

    if (poi && inputElement) {
        const altValue = parseFloat(newAltitudeStr); // Usa parseFloat per consentire decimali se necessario, ma step è 1
        if (!isNaN(altValue)) {
            poi.altitude = altValue;
            console.log(`POI ${poi.id} ('${poi.name}') altitude changed to: ${poi.altitude} m MSL`);
            
            // Aggiorna l'icona del marker del POI per riflettere la nuova altitudine
            if (poi.marker && poi.updatePopup) {
                poi.updatePopup(); // Questa funzione ora aggiorna anche l'icona
            }

            // Aggiorna i waypoint che tracciano questo POI
            waypoints.forEach(wp => {
                if (wp.headingControl === 'poi_track' && wp.targetPoiId === poi.id) {
                    updateMarkerIconStyle(wp); // L'orientamento potrebbe cambiare
                }
            });
            // Aggiorna i dropdown dei POI se sono visibili e l'altitudine è mostrata lì
            if (selectedWaypoint && headingControlSelect && headingControlSelect.value === 'poi_track') {
                populatePoiSelectDropdown(targetPoiSelect, selectedWaypoint.targetPoiId, true, "-- Select POI for Heading --");
            }
            if (multiWaypointEditControlsDiv && multiWaypointEditControlsDiv.style.display === 'block' &&
                multiHeadingControlSelect && multiHeadingControlSelect.value === 'poi_track') {
                populatePoiSelectDropdown(multiTargetPoiSelect, null, true, "-- Select POI for all --");
            }
            if (orbitModalOverlayEl && orbitModalOverlayEl.style.display === 'flex') {
                 populatePoiSelectDropdown(orbitPoiSelectEl, orbitPoiSelectEl.value || null, false);
            }


            inputElement.style.borderColor = ''; // Resetta bordo
            inputElement.title = 'POI Altitude (MSL)';
        } else {
            // Valore non valido, ripristina o segnala errore
            inputElement.value = poi.altitude; // Ripristina il valore precedente
            inputElement.style.borderColor = 'red';
            inputElement.title = 'Valore altitudine non valido';
            showCustomAlert("L'altitudine del POI inserita non è un numero valido.", "Errore Input");
        }
    }
}


/**
 * Updates the visibility and content of the multi-waypoint edit panel.
 */
function updateMultiEditPanelVisibility() {
    if (!multiWaypointEditControlsDiv || !selectedWaypointsCountEl || !waypointControlsDiv) return;

    const count = selectedForMultiEdit.size;
    if (count > 0) {
        multiWaypointEditControlsDiv.style.display = 'block';
        selectedWaypointsCountEl.textContent = count;
        waypointControlsDiv.style.display = 'none'; 

        if (multiHeadingControlSelect && multiHeadingControlSelect.value === 'poi_track') {
            populatePoiSelectDropdown(multiTargetPoiSelect, null, true, "-- Seleziona POI per tutti --"); 
            if (multiTargetPoiForHeadingGroupDiv) multiTargetPoiForHeadingGroupDiv.style.display = 'block';
        } else {
            if (multiTargetPoiForHeadingGroupDiv) multiTargetPoiForHeadingGroupDiv.style.display = 'none';
        }
    } else {
        multiWaypointEditControlsDiv.style.display = 'none';
        if (selectedWaypoint) {
            waypointControlsDiv.style.display = 'block';
        } else {
            waypointControlsDiv.style.display = 'none';
        }
    }
}

/**
 * Updates the single waypoint editing controls in the sidebar with the selected waypoint's data.
 */
function updateSingleWaypointEditControls() {
    if (!selectedWaypoint || !waypointControlsDiv || !waypointAltitudeSlider || !hoverTimeSlider || !gimbalPitchSlider || !headingControlSelect || !fixedHeadingSlider || !cameraActionSelect) {
        if (waypointControlsDiv) waypointControlsDiv.style.display = 'none';
        return;
    }

    waypointAltitudeSlider.value = selectedWaypoint.altitude;
    if (waypointAltitudeValueEl) waypointAltitudeValueEl.textContent = selectedWaypoint.altitude + 'm';

    hoverTimeSlider.value = selectedWaypoint.hoverTime;
    if (hoverTimeValueEl) hoverTimeValueEl.textContent = selectedWaypoint.hoverTime + 's';

    gimbalPitchSlider.value = selectedWaypoint.gimbalPitch;
    if (gimbalPitchValueEl) gimbalPitchValueEl.textContent = selectedWaypoint.gimbalPitch + '°';

    headingControlSelect.value = selectedWaypoint.headingControl;
    fixedHeadingSlider.value = selectedWaypoint.fixedHeading;
    if (fixedHeadingValueEl) fixedHeadingValueEl.textContent = selectedWaypoint.fixedHeading + '°';

    cameraActionSelect.value = selectedWaypoint.cameraAction || 'none';

    if (fixedHeadingGroupDiv) fixedHeadingGroupDiv.style.display = selectedWaypoint.headingControl === 'fixed' ? 'block' : 'none';
    const showPoiSelect = selectedWaypoint.headingControl === 'poi_track';
    if (targetPoiForHeadingGroupDiv) targetPoiForHeadingGroupDiv.style.display = showPoiSelect ? 'block' : 'none';

    if (showPoiSelect) {
        populatePoiSelectDropdown(targetPoiSelect, selectedWaypoint.targetPoiId, true, "-- Seleziona POI per Heading --"); 
    }

    waypointControlsDiv.style.display = 'block';
}
