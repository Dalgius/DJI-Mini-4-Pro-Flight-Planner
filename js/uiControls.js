// js/uiControls.js
import * as DOM from './domElements.js';
import * as State from './state.js';
import { _tr, getCameraActionText } from './utils.js'; // Importa _tr e getCameraActionText
import { selectWaypoint as logicSelectWaypoint, deletePOI as logicDeletePOI } from './waypointPOILogic.js'; // Per handleWaypointListClick e il pulsante delete POI nella lista
import { toggleMultiSelectWaypoint as logicToggleMultiSelectWaypoint, toggleSelectAllWaypoints as logicToggleSelectAllWaypoints, clearMultiSelection as logicClearMultiSelection, applyMultiEdit as logicApplyMultiEdit, updateMultiEditPanelVisibility as logicUpdateMultiEditPanel } from './multiEditLogic.js';
import { populatePoiSelectDropdown } from './waypointPOILogic.js'; // Corretto: populatePoiSelectDropdown è in waypointPOILogic ora se la usi lì, o la centralizziamo

// Funzione per popolare i dropdown dei POI, potrebbe stare in utils.js o qui se specifica per UI
export function populatePoiSelectDropdownForUI(selectElement, selectedPoiId = null, addDefaultOption = true, defaultOptionTextKey = "selectPoiDropdownDefault") {
    if (!selectElement) return;
    const defaultText = _tr(defaultOptionTextKey);
    selectElement.innerHTML = ''; 
    if (addDefaultOption) {
        const defaultOpt = document.createElement('option');
        defaultOpt.value = "";
        defaultOpt.textContent = defaultText;
        selectElement.appendChild(defaultOpt);
    }
    if (State.getPois().length === 0) {
         selectElement.disabled = true;
         if(addDefaultOption && selectElement.options[0]) selectElement.options[0].textContent = _tr("noPoisAvailableDropdown");
         return;
    }
    selectElement.disabled = false;
    if(addDefaultOption && selectElement.options[0] && selectElement.options[0].textContent === _tr("noPoisAvailableDropdown") ) {
        selectElement.options[0].textContent = defaultText;
    }

    State.getPois().forEach(poi => {
        const option = document.createElement('option');
        option.value = poi.id;
        option.textContent = `${poi.name} (ID: ${poi.id})`;
        if (selectedPoiId != null && poi.id === parseInt(selectedPoiId)) { 
            option.selected = true;
        }
        selectElement.appendChild(option);
    });
}


export function setupAllEventListeners() {
    // Flight Settings
    DOM.defaultAltitudeSlider.addEventListener('input', () => DOM.defaultAltitudeValueEl.textContent = DOM.defaultAltitudeSlider.value + 'm');
    DOM.flightSpeedSlider.addEventListener('input', () => {
        DOM.flightSpeedValueEl.textContent = DOM.flightSpeedSlider.value + ' m/s';
        updateFlightStatisticsDisplay();
    });
    DOM.pathTypeSelect.addEventListener('change', () => import('./mapLogic.js').then(mapLogic => mapLogic.updateFlightPathDisplay()));


    // Selected Waypoint Controls
    DOM.waypointAltitudeSlider.addEventListener('input', () => {
        if (!State.getSelectedWaypoint()) return;
        DOM.waypointAltitudeValueEl.textContent = DOM.waypointAltitudeSlider.value + 'm';
        State.getSelectedWaypoint().altitude = parseInt(DOM.waypointAltitudeSlider.value);
        updateWaypointListDisplay();
    });
    DOM.hoverTimeSlider.addEventListener('input', () => {
        if (!State.getSelectedWaypoint()) return;
        DOM.hoverTimeValueEl.textContent = DOM.hoverTimeSlider.value + 's';
        State.getSelectedWaypoint().hoverTime = parseInt(DOM.hoverTimeSlider.value);
        updateFlightStatisticsDisplay();
        updateWaypointListDisplay();
    });
    DOM.gimbalPitchSlider.addEventListener('input', () => {
        if (!State.getSelectedWaypoint()) return;
        DOM.gimbalPitchValueEl.textContent = DOM.gimbalPitchSlider.value + '°';
        State.getSelectedWaypoint().gimbalPitch = parseInt(DOM.gimbalPitchSlider.value);
    });
    DOM.fixedHeadingSlider.addEventListener('input', () => {
        if (!State.getSelectedWaypoint()) return;
        DOM.fixedHeadingValueEl.textContent = DOM.fixedHeadingSlider.value + '°';
        State.getSelectedWaypoint().fixedHeading = parseInt(DOM.fixedHeadingSlider.value);
    });
    DOM.headingControlSelect.addEventListener('change', function() {
        if (!State.getSelectedWaypoint()) return;
        DOM.fixedHeadingGroupDiv.style.display = this.value === 'fixed' ? 'block' : 'none';
        DOM.targetPoiForHeadingGroupDiv.style.display = this.value === 'poi_track' ? 'block' : 'none';
        State.getSelectedWaypoint().headingControl = this.value;
        if (this.value === 'poi_track') {
            populatePoiSelectDropdownForUI(DOM.targetPoiSelect, State.getSelectedWaypoint().targetPoiId, true, _tr("selectPoiDropdownDefault", "Select POI for Heading"));
        } else {
            State.getSelectedWaypoint().targetPoiId = null; 
        }
        updateWaypointListDisplay();
    });
    DOM.targetPoiSelect.addEventListener('change', function() {
        if (State.getSelectedWaypoint()) {
            State.getSelectedWaypoint().targetPoiId = this.value ? parseInt(this.value) : null;
            updateWaypointListDisplay();
        }
    });
    DOM.cameraActionSelect.addEventListener('change', function() {
        if (State.getSelectedWaypoint()) {
            State.getSelectedWaypoint().cameraAction = this.value;
            updateWaypointListDisplay(); 
        }
    });
    DOM.deleteSelectedWaypointBtn.addEventListener('click', () => import('./waypointPOILogic.js').then(mod => mod.deleteSelectedWaypointLogic()));

    // Multi-Waypoint Edit Controls
    DOM.selectAllWaypointsCheckboxEl.addEventListener('change', (e) => logicToggleSelectAllWaypoints(e.target.checked));
    DOM.multiHeadingControlSelect.addEventListener('change', function() {
        DOM.multiFixedHeadingGroupDiv.style.display = this.value === 'fixed' ? 'block' : 'none';
        DOM.multiTargetPoiForHeadingGroupDiv.style.display = this.value === 'poi_track' ? 'block' : 'none';
        if (this.value === 'poi_track') {
            populatePoiSelectDropdownForUI(DOM.multiTargetPoiSelect, null, true, _tr("selectPoiDropdownDefault", "Select POI for all"));
        }
    });
    DOM.multiFixedHeadingSlider.addEventListener('input', function() { DOM.multiFixedHeadingValueEl.textContent = this.value + '°'; });
    DOM.multiGimbalPitchSlider.addEventListener('input', function() { DOM.multiGimbalPitchValueEl.textContent = this.value + '°'; });
    DOM.multiHoverTimeSlider.addEventListener('input', function() { DOM.multiHoverTimeValueEl.textContent = this.value + 's'; });
    DOM.multiChangeGimbalPitchCheckbox.addEventListener('change', function() {
        DOM.multiGimbalPitchSlider.disabled = !this.checked;
        if(!this.checked) DOM.multiGimbalPitchSlider.value = 0; 
        DOM.multiGimbalPitchValueEl.textContent = DOM.multiGimbalPitchSlider.value + '°';
    });
    DOM.multiChangeHoverTimeCheckbox.addEventListener('change', function() {
        DOM.multiHoverTimeSlider.disabled = !this.checked;
         if(!this.checked) DOM.multiHoverTimeSlider.value = 0;
        DOM.multiHoverTimeValueEl.textContent = DOM.multiHoverTimeSlider.value + 's';
    });
    DOM.applyMultiEditBtn.addEventListener('click', logicApplyMultiEdit);
    DOM.clearMultiSelectionBtn.addEventListener('click', logicClearMultiSelection);

    // Sidebar Buttons
    DOM.clearWaypointsBtn.addEventListener('click', () => import('./waypointPOILogic.js').then(mod => mod.clearAllWaypointsLogic()));
    DOM.getHomeElevationBtn.addEventListener('click', () => import('./terrainOrbitLogic.js').then(mod => mod.getHomeElevationFromFirstWaypoint()));
    DOM.adaptToAGLBtnEl.addEventListener('click', () => import('./terrainOrbitLogic.js').then(mod => mod.adaptAltitudesToAGL()));
    DOM.createOrbitBtn.addEventListener('click', () => import('./terrainOrbitLogic.js').then(mod => mod.showOrbitDialog()));
    
    DOM.importJsonBtn.addEventListener('click', () => import('./fileOperations.js').then(mod => mod.triggerImport()));
    DOM.exportJsonBtn.addEventListener('click', () => import('./fileOperations.js').then(mod => mod.exportFlightPlan()));
    DOM.exportKmzBtn.addEventListener('click', () => import('./fileOperations.js').then(mod => mod.exportToDjiWpmlKmz()));
    DOM.exportGoogleEarthBtn.addEventListener('click', () => import('./fileOperations.js').then(mod => mod.exportToGoogleEarth()));
    
    document.getElementById('fileInput').addEventListener('change', (event) => import('./fileOperations.js').then(mod => mod.handleFileImport(event)));

    // Map Buttons
    DOM.satelliteToggleBtn.addEventListener('click', () => import('./mapLogic.js').then(mod => mod.toggleSatelliteView()));
    DOM.fitMapBtn.addEventListener('click', () => import('./mapLogic.js').then(mod => mod.fitMapToWaypoints()));
    DOM.myLocationBtn.addEventListener('click', () => import('./mapLogic.js').then(mod => mod.showCurrentLocation()));

    // Custom Modals
    if(DOM.customAlertOkButtonEl) DOM.customAlertOkButtonEl.addEventListener('click', () => {
        if(DOM.customAlertOverlayEl) DOM.customAlertOverlayEl.style.display = 'none';
    });
    if(DOM.confirmOrbitBtnEl) DOM.confirmOrbitBtnEl.addEventListener('click', () => import('./terrainOrbitLogic.js').then(mod => mod.handleConfirmOrbit()));
    if(DOM.cancelOrbitBtnEl) DOM.cancelOrbitBtnEl.addEventListener('click', () => {
       if(DOM.orbitModalOverlayEl) DOM.orbitModalOverlayEl.style.display = 'none';
    });
    if(DOM.langSelectEl) DOM.langSelectEl.addEventListener('change', (event) => import('./i18n.js').then(mod => mod.setLanguage(event.target.value)));
}

export function updateWaypointListDisplay() {
    if (State.getWaypoints().length === 0) {
        DOM.waypointListEl.innerHTML = `<div style="text-align: center; color: #95a5a6; font-size: 12px; padding: 20px;">${_tr("waypointListPlaceholder")}</div>`;
        DOM.selectAllWaypointsCheckboxEl.checked = false;
        DOM.selectAllWaypointsCheckboxEl.disabled = true;
        // logicUpdateMultiEditPanel(); // Chiamato da chi chiama questa funzione o da toggle
        return;
    }
    DOM.selectAllWaypointsCheckboxEl.disabled = false;

    DOM.waypointListEl.innerHTML = State.getWaypoints().map(wp => {
        let actionText = utilGetCameraActionText(wp.cameraAction); // Usa la funzione importata rinominata
        let hoverText = wp.hoverTime > 0 ? ` | Hover: ${wp.hoverTime}s` : '';
        let poiTargetText = '';
        if (wp.headingControl === 'poi_track' && wp.targetPoiId != null) {
            const target = State.getPois().find(p => p.id === wp.targetPoiId);
            poiTargetText = target ? ` | Target: ${target.name}` : ` | Target: POI ID ${wp.targetPoiId} (not found)`;
        }
        let actionInfo = actionText ? `<div class="waypoint-action-info">${_tr("actionLabel")}: ${actionText}${poiTargetText}</div>` : (poiTargetText ? `<div class="waypoint-action-info">${poiTargetText.substring(3)}</div>` : '');


        const isSelectedForMulti = State.selectedForMultiEdit.has(wp.id);
        let itemClasses = "waypoint-item";
        if (State.getSelectedWaypoint() && wp.id === State.getSelectedWaypoint().id && DOM.waypointControlsDiv.style.display === 'block' && !isSelectedForMulti) {
            itemClasses += " selected";
        }
        if (isSelectedForMulti) itemClasses += " multi-selected-item";

        // Nota: l'onclick qui chiama una funzione definita globalmente o una importata e riesportata.
        // Per una modularizzazione più spinta, l'event listener andrebbe aggiunto dinamicamente qui.
        // Ma per ora, lasciamo l'onclick inline e assicuriamoci che handleWaypointListClick sia globale.
        return `
        <div class="${itemClasses}" data-wp-id="${wp.id}">
            <div style="display: flex; align-items: center;">
                <input type="checkbox" class="waypoint-multi-select-cb" data-id="${wp.id}" 
                       ${isSelectedForMulti ? 'checked' : ''} 
                       style="margin-right: 10px; transform: scale(1.2);">
                <div>
                    <div class="waypoint-header"><span class="waypoint-name">Waypoint ${wp.id}</span></div>
                    <div class="waypoint-coords">Lat: ${wp.latlng.lat.toFixed(4)}, Lng: ${wp.latlng.lng.toFixed(4)}<br>Alt: ${wp.altitude}m${hoverText}</div>
                    ${actionInfo}
                </div>
            </div>
        </div>`;
    }).join('');

    // Aggiungi event listener dinamicamente agli item della lista e ai checkbox
    DOM.waypointListEl.querySelectorAll('.waypoint-item').forEach(item => {
        item.addEventListener('click', () => logicSelectWaypoint(State.getWaypoints().find(w => w.id === parseInt(item.dataset.wpId))) );
    });
    DOM.waypointListEl.querySelectorAll('.waypoint-multi-select-cb').forEach(cb => {
        cb.addEventListener('change', (e) => logicToggleMultiSelectWaypoint(parseInt(e.target.dataset.id), e.target.checked));
        cb.addEventListener('click', (e) => e.stopPropagation()); // Evita che il click sul checkbox selezioni l'item
    });


    if(State.getWaypoints().length === 0 && State.selectedForMultiEdit.size === 0) logicUpdateMultiEditPanel();
}


export function updatePOIListDisplay() { 
    const noPoiAvailableTextKey = "noPoisAvailableDropdown";
    const noPoisAddedTextKey = "poiListPlaceholder";

    if (State.getPois().length === 0) {
        DOM.poiListEl.innerHTML = `<div style="text-align: center; color: #95a5a6; font-size: 12px; padding: 10px;">${_tr(noPoisAddedTextKey)}</div>`; 
        if (DOM.targetPoiSelect) {
            DOM.targetPoiSelect.disabled = true;
            DOM.targetPoiSelect.innerHTML = `<option value="">${_tr(noPoiAvailableTextKey)}</option>`;
        }
         if (DOM.multiTargetPoiSelect) {
            DOM.multiTargetPoiSelect.disabled = true;
            DOM.multiTargetPoiSelect.innerHTML = `<option value="">${_tr(noPoiAvailableTextKey)}</option>`;
        }
        if(DOM.orbitPoiSelectEl) { 
            DOM.orbitPoiSelectEl.disabled = true;
            DOM.orbitPoiSelectEl.innerHTML = `<option value="">${_tr(noPoiAvailableTextKey)}</option>`;
        }
        return;
    }
    if (DOM.targetPoiSelect) DOM.targetPoiSelect.disabled = false;
    if (DOM.multiTargetPoiSelect) DOM.multiTargetPoiSelect.disabled = false;
    if (DOM.orbitPoiSelectEl) DOM.orbitPoiSelectEl.disabled = false;

    DOM.poiListEl.innerHTML = State.getPois().map(poi => `
        <div class="poi-item">
            <span class="poi-name">${poi.name} (ID: ${poi.id})</span>
            <button class="poi-delete" data-poi-id="${poi.id}">✕</button>
        </div>`).join('');
    
    // Aggiungi listener ai nuovi pulsanti delete dei POI
    DOM.poiListEl.querySelectorAll('.poi-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            logicDeletePOI(parseInt(e.target.dataset.poiId));
        });
    });
}

export function updateFlightStatisticsDisplay() { 
    let totalDist = 0;
    const speed = parseFloat(DOM.flightSpeedSlider.value) || 1; 
    if (State.getWaypoints().length >= 2) {
        const pathLatLngs = (DOM.pathTypeSelect.value === 'curved' && State.flightPath) ? State.flightPath.getLatLngs() : State.getWaypoints().map(wp => wp.latlng);
        for (let i = 0; i < pathLatLngs.length - 1; i++) totalDist += haversineDistance(pathLatLngs[i], pathLatLngs[i+1]);
    }
    let totalHover = State.getWaypoints().reduce((sum, wp) => sum + (wp.hoverTime || 0), 0);
    const flightDurationSec = (totalDist / (speed > 0 ? speed : 1) ) + totalHover;
    const mins = Math.floor(flightDurationSec / 60), secs = Math.round(flightDurationSec % 60);
    
    DOM.totalDistanceEl.textContent = `${Math.round(totalDist)} m`;
    DOM.flightTimeEl.textContent = `${mins} min ${secs} sec`;
    DOM.waypointCountEl.textContent = State.getWaypoints().length;
    DOM.poiCountEl.textContent = State.getPois().length;
}

// Importa haversineDistance da utils
import { haversineDistance } from './utils.js';