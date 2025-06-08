// File: uiUpdater.js

// Depends on: config.js, utils.js, waypointManager.js (chiamate indirette), mapManager.js

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
            selectElement.options[0].textContent = translate("noPoisAvailable"); 
        }
        return;
    }
    selectElement.disabled = false;
    if (addDefaultOption && selectElement.options[0] && selectElement.options[0].textContent === translate("noPoisAvailable")) { 
        selectElement.options[0].textContent = defaultOptionText;
    }
    pois.forEach(poi => {
        const option = document.createElement('option');
        option.value = poi.id;
        option.textContent = `${poi.name} (ID: ${poi.id}, Alt.MSL: ${poi.altitude.toFixed(0)}m)`; 
        if (selectedPoiId !== null && poi.id === parseInt(selectedPoiId)) {
            option.selected = true;
        }
        selectElement.appendChild(option);
    });
}

function updateWaypointList() {
    if (!waypointListEl || !selectAllWaypointsCheckboxEl || typeof translate !== 'function') return;
    if (waypoints.length === 0) {
        waypointListEl.innerHTML = `<div style="text-align: center; color: #95a5a6; font-size: 12px; padding: 20px;">${translate('clickMapToAddWaypoints')}</div>`;
        selectAllWaypointsCheckboxEl.checked = false;
        selectAllWaypointsCheckboxEl.disabled = true;
        if (selectedForMultiEdit.size === 0) updateMultiEditPanelVisibility();
        return;
    }
    selectAllWaypointsCheckboxEl.disabled = false;
    selectAllWaypointsCheckboxEl.checked = waypoints.length > 0 && waypoints.every(wp => selectedForMultiEdit.has(wp.id));

    let homeElevation = 0;
    if (homeElevationMslInput && homeElevationMslInput.value !== "") {
        homeElevation = parseFloat(homeElevationMslInput.value);
        if (isNaN(homeElevation)) homeElevation = 0; 
    }

    waypointListEl.innerHTML = waypoints.map(wp => {
        const action = wp.cameraAction || 'none';
        let actionText = translate(`cameraActionText_${action}`);
        let hoverText = wp.hoverTime > 0 ? ` | ${translate('hoverLabel')}: ${wp.hoverTime}s` : '';
        let poiTargetText = '';
        if (wp.headingControl === 'poi_track' && wp.targetPoiId != null) {
            const target = pois.find(p => p.id === wp.targetPoiId);
            poiTargetText = target ? ` | Target: ${target.name}` : ` | Target: POI ID ${wp.targetPoiId} (${translate('NA')})`;
        }
        let actionInfo = (action !== 'none') ? `<div class="waypoint-action-info" style="margin-top:3px;">${translate('actionLabel')}: ${actionText}${poiTargetText}</div>` : (poiTargetText ? `<div class="waypoint-action-info" style="margin-top:3px;">${poiTargetText.substring(3)}</div>` : '');
        const isSelectedForMulti = selectedForMultiEdit.has(wp.id);
        let itemClasses = "waypoint-item";
        if (selectedWaypoint && wp.id === selectedWaypoint.id && waypointControlsDiv && waypointControlsDiv.style.display === 'block' && !multiWaypointEditControlsDivIsVisible()) {
             itemClasses += " selected";
        }
        if (isSelectedForMulti) {
            itemClasses += " multi-selected-item";
        }
        const altitudeRelToHome = wp.altitude; 
        const terrainElevText = wp.terrainElevationMSL !== null ? `${wp.terrainElevationMSL.toFixed(1)} m` : translate("NA");
        let amslText = translate("NA");
        let aglText = translate("NA");
        if (typeof homeElevation === 'number') {
            amslText = `${(homeElevation + altitudeRelToHome).toFixed(1)} m`;
        }
        if (wp.terrainElevationMSL !== null && typeof homeElevation === 'number') {
            const amslWaypoint = homeElevation + altitudeRelToHome;
            aglText = `${(amslWaypoint - wp.terrainElevationMSL).toFixed(1)} m`;
        }
        const gimbalPitchInfo = ` | ${translate('gimbalLabel')}: ${wp.gimbalPitch}°`;
        return `
        <div class="${itemClasses}" onclick="handleWaypointListItemClick(${wp.id})">
            <div style="display: flex; align-items: flex-start;"> 
                <input type="checkbox" class="waypoint-multi-select-cb" data-id="${wp.id}"
                       onchange="handleWaypointListCheckboxChange(${wp.id}, this.checked)"
                       ${isSelectedForMulti ? 'checked' : ''}
                       style="margin-right: 10px; transform: scale(1.2); margin-top: 3px;" 
                       onclick="event.stopPropagation();">
                <div style="font-size: 11px; line-height: 1.35;"> 
                    <div class="waypoint-header" style="margin-bottom: 2px;"><span class="waypoint-name">${translate('waypointLabel')} ${wp.id}</span></div>
                    <div class="waypoint-coords" style="margin-bottom: 4px; font-size: 0.95em; color: #b0bec5;">Lat: ${wp.latlng.lat.toFixed(4)}, Lng: ${wp.latlng.lng.toFixed(4)}</div>
                    <div class="waypoint-altitudes" style="margin-bottom: 3px; color: #dfe6e9;">
                        ${translate('flightAltRelLabel')}: <strong>${altitudeRelToHome}m</strong>${hoverText}${gimbalPitchInfo}<br>
                        ${translate('amslAltLabel')}: ${amslText}<br>
                        ${translate('aglAltLabel')}: ${aglText}<br>
                        ${translate('terrainElevLabel')}: ${terrainElevText}
                    </div>
                    ${actionInfo}
                </div>
            </div>
        </div>`;
    }).join('');
}

function updateMultiEditPanelTitle(count) {
    const titleEl = multiWaypointEditControlsDiv.querySelector('.section-title');
    if (titleEl) {
        titleEl.innerHTML = translate('multiEditTitleText', {count: `<span id="selectedWaypointsCount">${count}</span>`});
    }
}

function multiWaypointEditControlsDivIsVisible() {
    return multiWaypointEditControlsDiv && multiWaypointEditControlsDiv.style.display === 'block';
}

function handleWaypointListItemClick(wpId) {
    const wp = waypoints.find(w => w.id === wpId);
    if (wp) {
        selectWaypoint(wp); 
    }
}

function handleWaypointListCheckboxChange(waypointId, isChecked) {
    toggleMultiSelectWaypoint(waypointId, isChecked); 
}

function updatePOIList() {
    if (!poiListEl || typeof translate !== 'function') return;
    const noPoiAvailableText = translate("noPoisAvailable"); 
    if (pois.length === 0) {
        poiListEl.innerHTML = `<div style="text-align: center; color: #95a5a6; font-size: 12px; padding: 10px;">${translate("noPoisAdded")}</div>`; 
        if (targetPoiSelect) { targetPoiSelect.disabled = true; targetPoiSelect.innerHTML = `<option value="">${noPoiAvailableText}</option>`;}
        if (multiTargetPoiSelect) { multiTargetPoiSelect.disabled = true; multiTargetPoiSelect.innerHTML = `<option value="">${noPoiAvailableText}</option>`;}
        if (orbitPoiSelectEl) { orbitPoiSelectEl.disabled = true; orbitPoiSelectEl.innerHTML = `<option value="">${noPoiAvailableText}</option>`;}
        return;
    }
    if (targetPoiSelect) targetPoiSelect.disabled = false;
    if (multiTargetPoiSelect) multiTargetPoiSelect.disabled = false;
    if (orbitPoiSelectEl) orbitPoiSelectEl.disabled = false;
    poiListEl.innerHTML = pois.map(poi => {
        const terrainElevDisplay = poi.terrainElevationMSL !== null ? poi.terrainElevationMSL.toFixed(1) : translate("NA");
        const objectHeightDisplay = poi.objectHeightAboveGround !== null ? poi.objectHeightAboveGround.toFixed(1) : "0"; 
        const finalAMSLDisplay = poi.altitude.toFixed(1);
        return `
        <div class="poi-item" style="flex-direction: column; align-items: stretch; padding: 8px; margin-bottom: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <span class="poi-name" style="font-size:12px; font-weight:bold;">${poi.name} (ID: ${poi.id})</span>
                <button class="poi-delete" onclick="deletePOI(${poi.id})" title="${translate('deletePoiTitle', { poiName: poi.name })}">✕</button>
            </div>
            <div style="display: grid; grid-template-columns: auto 1fr; gap: 3px 8px; font-size: 10px; color: #bdc3c7;">
                <label for="poi_obj_h_${poi.id}" class="control-label" style="margin-bottom:0; white-space:nowrap;">${translate('poiObjectHeightListLabel')}:</label>
                <input type="number" id="poi_obj_h_${poi.id}" class="control-input-small" 
                       value="${objectHeightDisplay}" step="1" style="width: 100%; padding: 2px 4px; font-size:10px; margin-left:0;"
                       onchange="handlePoiObjectHeightChange(${poi.id}, this.value)"
                       oninput="this.style.borderColor=''; this.title='';" 
                       title="${translate('poiObjectHeightTitle')}">
                <label for="poi_terrain_elev_${poi.id}" class="control-label" style="margin-bottom:0; white-space:nowrap;">${translate('poiTerrainElevListLabel')}:</label>
                <input type="number" id="poi_terrain_elev_${poi.id}" class="control-input-small" 
                       value="${terrainElevDisplay === translate("NA") ? "" : terrainElevDisplay}" step="1" style="width: 100%; padding: 2px 4px; font-size:10px; margin-left:0;"
                       onchange="handlePoiTerrainElevationChange(${poi.id}, this.value)"
                       oninput="this.style.borderColor=''; this.title='';"
                       placeholder="${terrainElevDisplay === translate("NA") ? translate("NAedit") : ""}"
                       title="${translate('poiTerrainElevTitle')}">
                <span class="control-label" style="margin-bottom:0; white-space:nowrap;">${translate('poiFinalAltitudeListLabel')}:</span>
                <strong style="color: #3498db; padding: 2px 4px;">${finalAMSLDisplay} m</strong>
            </div>
        </div>`;
    }).join('');
}

function handlePoiObjectHeightChange(poiId, newHeightStr) {
    const poi = pois.find(p => p.id === poiId);
    const inputElement = document.getElementById(`poi_obj_h_${poiId}`);
    if (poi && inputElement) {
        const heightValue = parseFloat(newHeightStr);
        if (!isNaN(heightValue) && heightValue >= 0) {
            poi.objectHeightAboveGround = heightValue;
            poi.recalculateFinalAltitude(); 
            updatePOIList(); 
            inputElement.style.borderColor = '';
            inputElement.title = translate('poiObjectHeightTitle');
             if (lastActivePoiForTerrainFetch && lastActivePoiForTerrainFetch.id === poi.id) {
                if (poiObjectHeightInputEl) poiObjectHeightInputEl.value = poi.objectHeightAboveGround;
                updatePoiFinalAltitudeDisplay();
            }
        } else {
            inputElement.value = poi.objectHeightAboveGround; 
            inputElement.style.borderColor = 'red';
            inputElement.title = translate('invalidPoiObjectHeightTitle');
            showCustomAlert(translate('alert_invalidPoiObjectHeight'), translate('inputErrorTitle'));
        }
    }
}

function handlePoiTerrainElevationChange(poiId, newTerrainElevStr) {
    const poi = pois.find(p => p.id === poiId);
    const inputElement = document.getElementById(`poi_terrain_elev_${poiId}`);
    if (poi && inputElement) {
        const elevValue = parseFloat(newTerrainElevStr);
        if (!isNaN(elevValue)) {
            poi.terrainElevationMSL = elevValue;
            poi.recalculateFinalAltitude();
            updatePOIList();
            inputElement.style.borderColor = '';
            inputElement.title = translate('poiTerrainElevTitle');
            if (lastActivePoiForTerrainFetch && lastActivePoiForTerrainFetch.id === poi.id) {
                if (poiTerrainElevationInputEl) poiTerrainElevationInputEl.value = poi.terrainElevationMSL;
                 updatePoiFinalAltitudeDisplay();
            }
        } else {
            inputElement.value = poi.terrainElevationMSL !== null ? poi.terrainElevationMSL : ""; 
            inputElement.style.borderColor = 'red';
            inputElement.title = translate('invalidPoiTerrainElevTitle');
            showCustomAlert(translate('alert_invalidPoiTerrainElev'), translate('inputErrorTitle'));
        }
    }
}

function updateMultiEditPanelVisibility() {
    if (!multiWaypointEditControlsDiv || !waypointControlsDiv) return;
    const count = selectedForMultiEdit.size;
    if (count > 0) {
        updateMultiEditPanelTitle(count);
        multiWaypointEditControlsDiv.style.display = 'block';
        waypointControlsDiv.style.display = 'none'; 
        if (multiHeadingControlSelect.value === 'poi_track') { 
            if (multiTargetPoiForHeadingGroupDiv) multiTargetPoiForHeadingGroupDiv.style.display = 'block';
            populatePoiSelectDropdown(multiTargetPoiSelect, multiTargetPoiSelect.value || null, true, translate('multiEditSelectPoiDropdown')); 
        } else {
            if (multiTargetPoiForHeadingGroupDiv) multiTargetPoiForHeadingGroupDiv.style.display = 'none';
        }
    } else { 
        multiWaypointEditControlsDiv.style.display = 'none';
    }
}

function updateSingleWaypointEditControls() {
    if (!selectedWaypoint || !waypointControlsDiv || !waypointAltitudeSlider || !hoverTimeSlider || !gimbalPitchSlider || !headingControlSelect || !fixedHeadingSlider || !cameraActionSelect) {
        if (waypointControlsDiv) {
            waypointControlsDiv.style.display = 'none';
        }
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
        populatePoiSelectDropdown(targetPoiSelect, selectedWaypoint.targetPoiId, true, translate('selectPoiForHeadingDropdown')); 
    }
    waypointControlsDiv.style.display = 'block';
}

/**
 * Aggiorna il testo nella UI che indica la modalità di altitudine corrente del percorso.
 */
function updatePathModeDisplay() {
    if (!currentPathModeValueEl || typeof translate !== 'function') { 
        return;
    }
    let modeKey = 'pathModeRelative'; 
    if (lastAltitudeAdaptationMode === 'agl') {
        modeKey = 'pathModeAGL';
    } else if (lastAltitudeAdaptationMode === 'amsl') {
        modeKey = 'pathModeAMSL';
    }
    currentPathModeValueEl.textContent = translate(modeKey); 
    currentPathModeValueEl.setAttribute('data-i18n-key', modeKey); 
}

/**
 * Aggiorna il valore di default suggerito per il campo "Target Costante AMSL".
 * Basato sull'elevazione di decollo corrente e l'altitudine di volo di default.
 */
function updateDefaultDesiredAMSLTarget() {
    if (!homeElevationMslInput || !defaultAltitudeSlider || !desiredAMSLInputEl) {
        return;
    }
    const homeElev = parseFloat(homeElevationMslInput.value) || 0;
    const defaultFlightAlt = parseInt(defaultAltitudeSlider.value) || 0;
    const suggestedAMSL = homeElev + defaultFlightAlt;
    desiredAMSLInputEl.value = Math.round(suggestedAMSL);
}
