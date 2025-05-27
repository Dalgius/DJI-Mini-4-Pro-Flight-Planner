// js/multiEditLogic.js
import * as DOM from './domElements.js';
import * as State from './state.js';
import { updateWaypointListDisplay, populatePoiSelectDropdownForUI, updateFlightStatisticsDisplay } from './uiControls.js';
import { updateMarkerIcon, selectWaypoint as logicSelectWaypoint } from './waypointPOILogic.js'; // Importa selectWaypoint da waypointPOILogic
import { showCustomAlert, _tr } from './utils.js';

export function toggleMultiSelectWaypoint(waypointId, isChecked) { 
    const waypoint = State.getWaypoints().find(wp => wp.id === waypointId);
    if (!waypoint) return;

    if (isChecked) {
        State.selectedForMultiEdit.add(waypointId);
    } else {
        State.selectedForMultiEdit.delete(waypointId);
    }
    
    updateMarkerIcon(waypoint); 
    
    if (State.getSelectedWaypoint() && State.getSelectedWaypoint().id === waypointId) {
        updateMarkerIcon(State.getSelectedWaypoint());
    }

    const allWaypointsSelected = State.getWaypoints().length > 0 && State.getWaypoints().every(wp => State.selectedForMultiEdit.has(wp.id));
    DOM.selectAllWaypointsCheckboxEl.checked = allWaypointsSelected;
    
    updateWaypointListDisplay(); 
    updateMultiEditPanelVisibility();
}

export function toggleSelectAllWaypoints(isChecked) { 
    State.selectedForMultiEdit.clear();
    if (isChecked) {
        State.getWaypoints().forEach(wp => State.selectedForMultiEdit.add(wp.id));
    }
    State.getWaypoints().forEach(wp => updateMarkerIcon(wp)); 
    updateWaypointListDisplay();
    updateMultiEditPanelVisibility();
}

export function clearMultiSelection() { 
    const previouslyMultiSelectedIds = new Set(State.selectedForMultiEdit);
    State.selectedForMultiEdit.clear();
    if(DOM.selectAllWaypointsCheckboxEl) DOM.selectAllWaypointsCheckboxEl.checked = false;
    
    previouslyMultiSelectedIds.forEach(id => {
        const waypoint = State.getWaypoints().find(wp => wp.id === id);
        if(waypoint) updateMarkerIcon(waypoint); 
    });

    updateWaypointListDisplay(); 
    updateMultiEditPanelVisibility();
}

export function updateMultiEditPanelVisibility() { 
    const count = State.selectedForMultiEdit.size;
    if (count > 0) {
        DOM.multiWaypointEditControlsDiv.style.display = 'block';
        DOM.selectedWaypointsCountEl.textContent = count;
        if (DOM.waypointControlsDiv) DOM.waypointControlsDiv.style.display = 'none';
        // State.setSelectedWaypoint(null); // Potrebbe essere meglio non deselezionare qui
        
        if (DOM.multiHeadingControlSelect.value === 'poi_track') {
            populatePoiSelectDropdownForUI(DOM.multiTargetPoiSelect, null, true, _tr("selectPoiDropdownDefault", "Select POI for all"));
            DOM.multiTargetPoiForHeadingGroupDiv.style.display = 'block';
        } else {
            DOM.multiTargetPoiForHeadingGroupDiv.style.display = 'none';
        }
    } else {
        DOM.multiWaypointEditControlsDiv.style.display = 'none';
        if (State.getSelectedWaypoint() && DOM.waypointControlsDiv) {
            DOM.waypointControlsDiv.style.display = 'block';
        } else if (DOM.waypointControlsDiv) {
             DOM.waypointControlsDiv.style.display = 'none';
        }
    }
}

export function applyMultiEdit() { 
    if (State.selectedForMultiEdit.size === 0) {
        showCustomAlert(_tr("alertNoWpMultiEdit"), _tr("alertWarning"));
        return;
    }

    const newHeadingControl = DOM.multiHeadingControlSelect.value;
    const newFixedHeading = parseInt(DOM.multiFixedHeadingSlider.value);
    const newCameraAction = DOM.multiCameraActionSelect.value;
    const changeGimbal = DOM.multiChangeGimbalPitchCheckbox.checked;
    const newGimbalPitch = parseInt(DOM.multiGimbalPitchSlider.value);
    const changeHover = DOM.multiChangeHoverTimeCheckbox.checked;
    const newHoverTime = parseInt(DOM.multiHoverTimeSlider.value);
    const newTargetPoiId = (newHeadingControl === 'poi_track' && DOM.multiTargetPoiSelect.value) 
                            ? parseInt(DOM.multiTargetPoiSelect.value) 
                            : null;

    let changesMadeToAtLeastOneWp = false;

    State.getWaypoints().forEach(wp => {
        if (State.selectedForMultiEdit.has(wp.id)) {
            let wpChangedThisIteration = false;
            if (newHeadingControl) {
                wp.headingControl = newHeadingControl;
                if (newHeadingControl === 'fixed') {
                    wp.fixedHeading = newFixedHeading;
                    wp.targetPoiId = null; 
                } else if (newHeadingControl === 'poi_track') {
                    wp.targetPoiId = newTargetPoiId;
                } else { 
                    wp.targetPoiId = null; 
                }
                wpChangedThisIteration = true;
            }
            if (newCameraAction) {
                wp.cameraAction = newCameraAction;
                wpChangedThisIteration = true;
            }
            if (changeGimbal) {
                wp.gimbalPitch = newGimbalPitch;
                wpChangedThisIteration = true;
            }
            if (changeHover) {
                wp.hoverTime = newHoverTime;
                wpChangedThisIteration = true;
            }
            if(wpChangedThisIteration) changesMadeToAtLeastOneWp = true;
        }
    });

    if (changesMadeToAtLeastOneWp) {
        updateWaypointListDisplay();
        updateFlightStatisticsDisplay(); 
        // Se il waypoint precedentemente selezionato per modifica singola è stato modificato in batch,
        // aggiorna i suoi controlli individuali se il pannello torna visibile.
        if (State.getSelectedWaypoint() && State.selectedForMultiEdit.has(State.getSelectedWaypoint().id)) {
            // La logica di selectWaypoint(State.getSelectedWaypoint()) lo farà quando il pannello torna visibile.
        }
        showCustomAlert(_tr("alertMultiApplied", State.selectedForMultiEdit.size), _tr("alertInfo"));
    } else {
        showCustomAlert(_tr("alertMultiNoChange"), _tr("alertInfo"));
    }
    
    DOM.multiHeadingControlSelect.value = "";
    DOM.multiFixedHeadingGroupDiv.style.display = 'none';
    DOM.multiTargetPoiForHeadingGroupDiv.style.display = 'none';
    DOM.multiFixedHeadingSlider.value = 0;
    DOM.multiFixedHeadingValueEl.textContent = "0°";
    DOM.multiCameraActionSelect.value = "";
    DOM.multiChangeGimbalPitchCheckbox.checked = false;
    DOM.multiGimbalPitchSlider.disabled = true;
    DOM.multiGimbalPitchSlider.value = 0;
    DOM.multiGimbalPitchValueEl.textContent = "0°";
    DOM.multiChangeHoverTimeCheckbox.checked = false;
    DOM.multiHoverTimeSlider.disabled = true;
    DOM.multiHoverTimeSlider.value = 0;
    DOM.multiHoverTimeValueEl.textContent = "0s";

    clearMultiSelection(); 
}