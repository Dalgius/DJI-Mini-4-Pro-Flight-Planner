// js/uiControls.js
import * as DOM from './domElements.js';
import * as State from './state.js';
import { _tr } from './i18n.js'; // Importa _tr da i18n.js
// NOTE: dispatchStateChangeEvent is not imported here as uiControls RESPONDS to state changes, not initiates them in this context.
import { getCameraActionKey, showCustomAlert } from './utils.js'; // Importa da utils
// Importa le funzioni di logica che devono essere chiamate dagli event listener
// For updateMarkerIcon, as mapLogic is not yet fully reactive to multi-selection changes.
import { selectWaypoint as logicSelectWaypoint, deletePOI as logicDeletePOI, updateMarkerIcon } from './waypointPOILogic.js';
import { toggleMultiSelectWaypoint as logicToggleMultiSelectWaypoint, toggleSelectAllWaypoints as logicToggleSelectAllWaypoints, clearMultiSelection as logicClearMultiSelection, applyMultiEdit as logicApplyMultiEdit, updateMultiEditPanelVisibility as logicUpdateMultiEditPanel } from './multiEditLogic.js';
// Removed adaptAltitudesToAGL as logicAdaptAGL from this import
import { getHomeElevationFromFirstWaypoint as logicGetHomeElevation, showOrbitDialog as logicShowOrbit, handleConfirmOrbit as logicHandleConfirmOrbit } from './terrainOrbitLogic.js';
import { triggerImport as logicTriggerImport, handleFileImport, exportFlightPlan as logicExportJson, exportToDjiWpmlKmz as logicExportKmz, exportToGoogleEarth as logicExportKml } from './fileOperations.js';
import { toggleSatelliteView as logicToggleSatellite, fitMapToWaypoints as logicFitMap, showCurrentLocation as logicShowLocation, updateFlightPathDisplay } from './mapLogic.js';


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
        if (addDefaultOption && selectElement.options[0]) selectElement.options[0].textContent = _tr("noPoisAvailableDropdown");
        return;
    }
    selectElement.disabled = false;
    if (addDefaultOption && selectElement.options[0] && selectElement.options[0].textContent === _tr("noPoisAvailableDropdown")) {
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
    DOM.pathTypeSelect.addEventListener('change', updateFlightPathDisplay);

    // Selected Waypoint Controls
    DOM.waypointAltitudeSlider.addEventListener('input', () => {
        const selectedWp = State.getSelectedWaypoint();
        if (!selectedWp) return;
        const newAltitude = parseInt(DOM.waypointAltitudeSlider.value);
        DOM.waypointAltitudeValueEl.textContent = newAltitude + 'm';
        // State.getSelectedWaypoint().altitude = newAltitude; // Direct mutation
        State.updateWaypointProperty(selectedWp.id, 'altitude', newAltitude); // Via state.js
        // updateWaypointListDisplay(); // Rely on stateChange event
    });
    DOM.hoverTimeSlider.addEventListener('input', () => {
        const selectedWp = State.getSelectedWaypoint();
        if (!selectedWp) return;
        const newHoverTime = parseInt(DOM.hoverTimeSlider.value);
        DOM.hoverTimeValueEl.textContent = newHoverTime + 's';
        // State.getSelectedWaypoint().hoverTime = newHoverTime; // Direct mutation
        State.updateWaypointProperty(selectedWp.id, 'hoverTime', newHoverTime); // Via state.js
        // updateFlightStatisticsDisplay(); // Rely on stateChange event (waypointsModified)
        // updateWaypointListDisplay(); // Rely on stateChange event
    });
    DOM.gimbalPitchSlider.addEventListener('input', () => {
        const selectedWp = State.getSelectedWaypoint();
        if (!selectedWp) return;
        const newGimbalPitch = parseInt(DOM.gimbalPitchSlider.value);
        DOM.gimbalPitchValueEl.textContent = newGimbalPitch + '°';
        // State.getSelectedWaypoint().gimbalPitch = newGimbalPitch; // Direct mutation
        State.updateWaypointProperty(selectedWp.id, 'gimbalPitch', newGimbalPitch); // Via state.js
    });
    DOM.fixedHeadingSlider.addEventListener('input', () => {
        const selectedWp = State.getSelectedWaypoint();
        if (!selectedWp) return;
        const newFixedHeading = parseInt(DOM.fixedHeadingSlider.value);
        DOM.fixedHeadingValueEl.textContent = newFixedHeading + '°';
        // State.getSelectedWaypoint().fixedHeading = newFixedHeading; // Direct mutation
        State.updateWaypointProperty(selectedWp.id, 'fixedHeading', newFixedHeading); // Via state.js
    });
    DOM.headingControlSelect.addEventListener('change', function() {
        const selectedWp = State.getSelectedWaypoint();
        if (!selectedWp) return;
        const newHeadingControl = this.value;
        DOM.fixedHeadingGroupDiv.style.display = newHeadingControl === 'fixed' ? 'block' : 'none';
        DOM.targetPoiForHeadingGroupDiv.style.display = newHeadingControl === 'poi_track' ? 'block' : 'none';
        // State.getSelectedWaypoint().headingControl = newHeadingControl; // Direct mutation
        State.updateWaypointProperty(selectedWp.id, 'headingControl', newHeadingControl); // Via state.js

        if (newHeadingControl === 'poi_track') {
            populatePoiSelectDropdownForUI(DOM.targetPoiSelect, selectedWp.targetPoiId, true, _tr("selectPoiDropdownDefault"));
        } else {
            // State.getSelectedWaypoint().targetPoiId = null; // Direct mutation
            if (selectedWp.targetPoiId !== null) { // Only update if it's actually changing
                 State.updateWaypointProperty(selectedWp.id, 'targetPoiId', null); // Via state.js
            }
        }
        // updateWaypointListDisplay(); // Rely on stateChange event
    });
    DOM.targetPoiSelect.addEventListener('change', function() {
        const selectedWp = State.getSelectedWaypoint();
        if (selectedWp) {
            const newTargetPoiId = this.value ? parseInt(this.value) : null;
            // State.getSelectedWaypoint().targetPoiId = newTargetPoiId; // Direct mutation
            State.updateWaypointProperty(selectedWp.id, 'targetPoiId', newTargetPoiId); // Via state.js
            // updateWaypointListDisplay(); // Rely on stateChange event
        }
    });
    DOM.cameraActionSelect.addEventListener('change', function() {
        const selectedWp = State.getSelectedWaypoint();
        if (selectedWp) {
            const newCameraAction = this.value;
            // State.getSelectedWaypoint().cameraAction = newCameraAction; // Direct mutation
            State.updateWaypointProperty(selectedWp.id, 'cameraAction', newCameraAction); // Via state.js
            // updateWaypointListDisplay(); // Rely on stateChange event
        }
    });
    // DOM.deleteSelectedWaypointBtn.addEventListener('click', () => import('../js/waypointPOILogic.js').then(mod => mod.deleteSelectedWaypointLogic()));
    DOM.deleteSelectedWaypointBtn.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('userAction', { detail: { action: 'deleteSelectedWaypoint' } }));
    });

    // Multi-Waypoint Edit Controls
    DOM.selectAllWaypointsCheckboxEl.addEventListener('change', (e) => logicToggleSelectAllWaypoints(e.target.checked));
    DOM.multiHeadingControlSelect.addEventListener('change', function() {
        DOM.multiFixedHeadingGroupDiv.style.display = this.value === 'fixed' ? 'block' : 'none';
        DOM.multiTargetPoiForHeadingGroupDiv.style.display = this.value === 'poi_track' ? 'block' : 'none';
        if (this.value === 'poi_track') {
            populatePoiSelectDropdownForUI(DOM.multiTargetPoiSelect, null, true, _tr("selectPoiDropdownDefault"));
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
    // DOM.clearWaypointsBtn.addEventListener('click', () => import('../js/waypointPOILogic.js').then(mod => mod.clearAllWaypointsLogic()));
    DOM.clearWaypointsBtn.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('userAction', { detail: { action: 'clearAllWaypoints' } }));
    });
    DOM.getHomeElevationBtn.addEventListener('click', logicGetHomeElevation);
    // DOM.adaptToAGLBtnEl.addEventListener('click', logicAdaptAGL); // Changed to dispatch userAction
    DOM.adaptToAGLBtnEl.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('userAction', { detail: { action: 'adaptAltitudesToAGL' } }));
    });
    DOM.createOrbitBtn.addEventListener('click', logicShowOrbit);
    
    DOM.importJsonBtn.addEventListener('click', logicTriggerImport);
    DOM.exportJsonBtn.addEventListener('click', logicExportJson);
    DOM.exportKmzBtn.addEventListener('click', logicExportKmz);
    DOM.exportGoogleEarthBtn.addEventListener('click', logicExportKml);
    
    document.getElementById('fileInput').addEventListener('change', handleFileImport);

    // Map Buttons
    DOM.satelliteToggleBtn.addEventListener('click', logicToggleSatellite);
    DOM.fitMapBtn.addEventListener('click', logicFitMap);
    DOM.myLocationBtn.addEventListener('click', logicShowLocation);

    // Custom Modals
    if(DOM.customAlertOkButtonEl) DOM.customAlertOkButtonEl.addEventListener('click', () => {
        if(DOM.customAlertOverlayEl) DOM.customAlertOverlayEl.style.display = 'none';
    });
    if(DOM.confirmOrbitBtnEl) DOM.confirmOrbitBtnEl.addEventListener('click', logicHandleConfirmOrbit);
    if(DOM.cancelOrbitBtnEl) DOM.cancelOrbitBtnEl.addEventListener('click', () => {
       if(DOM.orbitModalOverlayEl) DOM.orbitModalOverlayEl.style.display = 'none';
    });
    if(DOM.langSelectEl) DOM.langSelectEl.addEventListener('change', (event) => {
        // Dynamically import setLanguage from i18n.js
        import('./i18n.js').then(i18nModule => {
            i18nModule.setLanguage(event.target.value);
            // The setLanguage function in i18n.js will dispatch a stateChange event
        });
    });
    // Add the global state change listener
    document.addEventListener('stateChange', handleStateChange);
}

// Central event handler for state changes
function handleStateChange(event) {
    if (!event.detail) return;

    if (event.detail.languageChanged) {
        console.log("Language changed event received in uiControls.js, updating UI elements.");
        // Refresh UI elements that depend on translations not covered by data-i18n-key
        // or whose content is dynamically generated and needs re-translation.

        // Re-populate POI select dropdowns as their default/placeholder text is translatable
        if (DOM.targetPoiSelect) { // For single waypoint editing
            populatePoiSelectDropdownForUI(DOM.targetPoiSelect, State.getSelectedWaypoint() ? State.getSelectedWaypoint().targetPoiId : null, true, _tr("selectPoiDropdownDefault"));
        }
        if (DOM.multiTargetPoiSelect) { // For multi-waypoint editing
            populatePoiSelectDropdownForUI(DOM.multiTargetPoiSelect, null, true, _tr("selectPoiDropdownDefault"));
        }
        if (DOM.orbitPoiSelectEl) { // For orbit creation dialog
             // Check if POIs exist before populating, otherwise it shows "No POIs" which is also fine.
            populatePoiSelectDropdownForUI(DOM.orbitPoiSelectEl, null, false); // false for addDefaultOption because it has its own logic
        }
        
        // Refresh lists that might contain translatable text (e.g., "No action" for camera action)
        updateWaypointListDisplay(); // This will re-render waypoint items, picking up new translations for actions etc.
        updatePOIListDisplay(); // This will re-render POI items (though they mostly have names, placeholder might change)
        
        // Any other specific UI refresh calls needed after language change can be added here.
        // For example, if statistics labels were manually set and not using data-i18n-key:
        updateFlightStatisticsDisplay(); // If any labels here are set programmatically with _tr()
    }

    // Potentially handle other state changes here if needed by uiControls in the future
    // For example: if (event.detail.waypointsModified) { ... }
    // However, many UI updates are already triggered directly by the functions that modify state.
    // This event listener is primarily for changes that require cross-module notification, like language.

    if (event.detail.waypointsModified) {
        console.log("Waypoints changed event received in uiControls.js, updating waypoint list and stats.");
        updateWaypointListDisplay();
        updateFlightStatisticsDisplay();
        // If a specific waypoint was added or updated, and it's the selected one,
        // its individual controls might need refreshing.
        // The selectWaypoint logic already handles this by re-populating controls.
        // If a waypoint was deleted, selectedWaypoint might become null, and UI should reflect that.
        if (event.detail.action === 'set' || event.detail.action === 'add' || event.detail.action === 'remove') {
            const selectedWp = State.getSelectedWaypoint();
            if (selectedWp && !State.getWaypoints().find(wp => wp.id === selectedWp.id)) {
                // Selected waypoint was deleted
                State.setSelectedWaypoint(null); // Dispatch event for selection change
                if (DOM.waypointControlsDiv) DOM.waypointControlsDiv.style.display = 'none';
            } else if (!selectedWp && State.getWaypoints().length > 0 && DOM.multiWaypointEditControlsDiv.style.display === 'none') {
                // No waypoint selected, but waypoints exist, and multi-edit is not active
                // Potentially select the first waypoint, or leave as is, depending on desired UX.
                // For now, let's not auto-select here to avoid unexpected behavior.
                // selectWaypoint(State.getWaypoints()[0]);
            }
             // Ensure multi-edit panel visibility is correct
            updateMultiEditPanelVisibility();
        }
    }
    
    if (event.detail.selectedWaypointChanged) {
        console.log("Selected waypoint changed event received in uiControls.js.");
        // This will refresh the main waypoint list (for styling the selected item)
        // and also update the single waypoint control panel if a waypoint is selected.
        updateWaypointListDisplay();
        if (DOM.waypointControlsDiv) {
            DOM.waypointControlsDiv.style.display = State.getSelectedWaypoint() ? 'block' : 'none';
        }
         // Ensure multi-edit panel visibility is correct, selection change might affect it
        updateMultiEditPanelVisibility();
    }

    if (event.detail.poisModified) {
        console.log("POIs changed event received in uiControls.js, updating POI list and dependent dropdowns.");
        updatePOIListDisplay(); // This also handles disabling/enabling and populating POI dropdowns.
        // If the currently selected waypoint was targeting a POI that got deleted,
        // this needs to be handled. updatePOIListDisplay calls populatePoiSelectDropdownForUI,
        // which should refresh the target POI select for the current waypoint if it's visible.
        if (State.getSelectedWaypoint() && DOM.headingControlSelect.value === 'poi_track') {
            populatePoiSelectDropdownForUI(DOM.targetPoiSelect, State.getSelectedWaypoint().targetPoiId, true, _tr("selectPoiDropdownDefault"));
        }
        if (DOM.multiHeadingControlSelect.value === 'poi_track') {
             populatePoiSelectDropdownForUI(DOM.multiTargetPoiSelect, null, true, _tr("selectPoiDropdownDefault"));
        }
        if (DOM.orbitModalOverlayEl.style.display === 'flex' && DOM.orbitPoiSelectEl) {
            populatePoiSelectDropdownForUI(DOM.orbitPoiSelectEl, null, false);
        }
    }
    
    if (event.detail.multiEditSelectionChanged) {
        console.log("Multi-edit selection changed event received in uiControls.js.");
        updateMultiEditPanelVisibility(); // This updates the count and panel display
        updateWaypointListDisplay(); // To update styling of multi-selected items
        
        // Update marker icons for all waypoints as their multi-select status might have changed
        // This is a temporary workaround; ideally, mapLogic would handle marker styling based on state.
        console.log("Updating all waypoint marker icons due to multi-edit selection change.");
        State.getWaypoints().forEach(wp => {
            updateMarkerIcon(wp); 
        });
        const selectedWp = State.getSelectedWaypoint(); // Ensure single selected also has correct styling
        if(selectedWp) {
            updateMarkerIcon(selectedWp);
        }
    }
    
    // No specific UI reaction for aglAdaptationCompleted needed here for now,
    // as waypointsModified and selectedWaypointChanged should cover necessary display updates.
    // Alerts are shown by terrainOrbitLogic.js directly.

    if (event.detail.flightPathChanged) {
        console.log("Flight path changed event received in uiControls.js, updating flight stats.");
        updateFlightStatisticsDisplay(); // Statistics depend on the flight path for distance.
    }

    if (event.detail.satelliteViewChanged) {
        console.log("Satellite view changed event received in uiControls.js, updating toggle button text.");
        if (DOM.satelliteToggleBtn) {
            DOM.satelliteToggleBtn.innerHTML = State.getSatelliteView() ? _tr("mapBtnMap") : _tr("mapBtnSatellite");
        }
    }
}


export function updateWaypointListDisplay() {
    if (State.getWaypoints().length === 0) {
        DOM.waypointListEl.innerHTML = `<div style="text-align: center; color: #95a5a6; font-size: 12px; padding: 20px;">${_tr("waypointListPlaceholder")}</div>`;
        DOM.selectAllWaypointsCheckboxEl.checked = false;
        DOM.selectAllWaypointsCheckboxEl.disabled = true;
        return;
    }
    DOM.selectAllWaypointsCheckboxEl.disabled = false;

    DOM.waypointListEl.innerHTML = State.getWaypoints().map(wp => {
        let actionKey = getCameraActionKey(wp.cameraAction); // Chiave dalla funzione in utils
        let actionText = _tr(actionKey); // Traduzione dalla funzione in i18n
        let hoverText = wp.hoverTime > 0 ? ` | Hover: ${wp.hoverTime}s` : '';
        let poiTargetText = '';
        if (wp.headingControl === 'poi_track' && wp.targetPoiId != null) {
            const target = State.getPois().find(p => p.id === wp.targetPoiId);
            poiTargetText = target ? ` | Target: ${target.name}` : ` | Target: POI ID ${wp.targetPoiId} (not found)`;
        }
        let actionInfo = actionText !== _tr('cameraActionNone') ? `<div class="waypoint-action-info">${_tr("actionLabel")}: ${actionText}${poiTargetText}</div>` : (poiTargetText ? `<div class="waypoint-action-info">${poiTargetText.substring(3)}</div>` : '');


        const isSelectedForMulti = State.selectedForMultiEdit.has(wp.id);
        let itemClasses = "waypoint-item";
        if (State.getSelectedWaypoint() && wp.id === State.getSelectedWaypoint().id && DOM.waypointControlsDiv.style.display === 'block' && !isSelectedForMulti) {
            itemClasses += " selected";
        }
        if (isSelectedForMulti) itemClasses += " multi-selected-item";

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

    DOM.waypointListEl.querySelectorAll('.waypoint-item').forEach(item => {
        item.addEventListener('click', () => {
            const wpId = parseInt(item.dataset.wpId);
            logicSelectWaypoint(State.getWaypoints().find(w => w.id === wpId));
        });
    });
    DOM.waypointListEl.querySelectorAll('.waypoint-multi-select-cb').forEach(cb => {
        cb.addEventListener('change', (e) => logicToggleMultiSelectWaypoint(parseInt(e.target.dataset.id), e.target.checked));
        cb.addEventListener('click', (e) => e.stopPropagation());
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
        <div class="poi-item"><span class="poi-name">${poi.name} (ID: ${poi.id})</span>
        <button class="poi-delete" data-poi-id="${poi.id}">✕</button>
        </div>`).join('');
    
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
