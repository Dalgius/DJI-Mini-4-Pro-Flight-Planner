// js/multiEditLogic.js
import * as DOM from './domElements.js';
import * as State from './state.js';
// Removed direct uiControls imports:
// import { updateWaypointListDisplay, populatePoiSelectDropdownForUI, updateFlightStatisticsDisplay } from './uiControls.js';
import { populatePoiSelectDropdownForUI } from './uiControls.js'; // Still needed for internal logic of showing panel
// updateMarkerIcon is a map concern, ideally mapLogic listens to multiEditSelectionChanged.
// For now, uiControls will react to multiEditSelectionChanged and call updateMarkerIcon.
// import { updateMarkerIcon, selectWaypoint as logicSelectWaypoint } from './waypointPOILogic.js';
import { showCustomAlert } from './utils.js';
import { _tr } from './i18n.js';

export function toggleMultiSelectWaypoint(waypointId, isChecked) {
    // const waypoint = State.getWaypoints().find(wp => wp.id === waypointId); // Not needed if only dispatching
    // if (!waypoint) return; // State functions will handle non-existent IDs if necessary

    if (isChecked) {
        // State.selectedForMultiEdit.add(waypointId); // Direct mutation
        State.addWaypointToMultiEdit(waypointId); // Via state.js - dispatches event
    } else {
        // State.selectedForMultiEdit.delete(waypointId); // Direct mutation
        State.removeWaypointFromMultiEdit(waypointId); // Via state.js - dispatches event
    }
    
    // updateMarkerIcon(waypoint); // mapLogic or uiControls should handle this
    
    // if (State.getSelectedWaypoint() && State.getSelectedWaypoint().id === waypointId) {
    //     updateMarkerIcon(State.getSelectedWaypoint()); // mapLogic or uiControls should handle this
    // }

    // const allWaypointsSelected = State.getWaypoints().length > 0 && State.getWaypoints().every(wp => State.selectedForMultiEdit.has(wp.id));
    // DOM.selectAllWaypointsCheckboxEl.checked = allWaypointsSelected; // uiControls should handle this
    
    // updateWaypointListDisplay(); // uiControls handles this via stateChange
    // updateMultiEditPanelVisibility(); // uiControls handles this via stateChange
}

export function toggleSelectAllWaypoints(isChecked) {
    // State.selectedForMultiEdit.clear(); // Direct mutation
    const currentSelection = State.getSelectedForMultiEdit();
    const allWaypointIds = State.getWaypoints().map(wp => wp.id);
    
    if (isChecked) {
        let changed = false;
        allWaypointIds.forEach(id => {
            if (!currentSelection.has(id)) {
                State.addWaypointToMultiEdit(id); // Dispatches event for each addition
                changed = true;
            }
        });
        // If individual add events are too noisy, State could have a batch add function for multi-select.
        // For now, relying on individual events.
    } else {
        if (currentSelection.size > 0) {
            State.clearMultiEditSelection(); // Dispatches one event for clear
        }
    }
    
    // State.getWaypoints().forEach(wp => updateMarkerIcon(wp)); // mapLogic or uiControls should handle this
    // updateWaypointListDisplay(); // uiControls handles this
    // updateMultiEditPanelVisibility(); // uiControls handles this
}

export function clearMultiSelection() {
    // const previouslyMultiSelectedIds = new Set(State.selectedForMultiEdit); // Not needed if only dispatching
    State.clearMultiEditSelection(); // Via state.js - dispatches event
    // if(DOM.selectAllWaypointsCheckboxEl) DOM.selectAllWaypointsCheckboxEl.checked = false; // uiControls handles this
    
    // previouslyMultiSelectedIds.forEach(id => { // mapLogic or uiControls should handle marker updates
    //     const waypoint = State.getWaypoints().find(wp => wp.id === id);
    //     if(waypoint) updateMarkerIcon(waypoint); 
    // });

    // updateWaypointListDisplay(); // uiControls handles this
    // updateMultiEditPanelVisibility(); // uiControls handles this
}

export function updateMultiEditPanelVisibility() { // This function is called by uiControls.js's handleStateChange
    const count = State.getSelectedForMultiEdit().size;
    // This function is CALLED by uiControls.js in response to state changes.
    // It should primarily update the DOM based on the current state.
    if (count > 0) {
        DOM.multiWaypointEditControlsDiv.style.display = 'block';
        DOM.selectedWaypointsCountEl.textContent = count;
        if (DOM.waypointControlsDiv) DOM.waypointControlsDiv.style.display = 'none'; // Hide single edit
        
        // Populate POI dropdown if needed
        if (DOM.multiHeadingControlSelect.value === 'poi_track') {
            populatePoiSelectDropdownForUI(DOM.multiTargetPoiSelect, null, true, _tr("selectPoiDropdownDefault"));
            DOM.multiTargetPoiForHeadingGroupDiv.style.display = 'block';
        } else {
            DOM.multiTargetPoiForHeadingGroupDiv.style.display = 'none';
        }
    } else {
        DOM.multiWaypointEditControlsDiv.style.display = 'none';
        // Show single edit panel if a waypoint is selected
        if (State.getSelectedWaypoint() && DOM.waypointControlsDiv) {
            DOM.waypointControlsDiv.style.display = 'block';
        } else if (DOM.waypointControlsDiv) { // No selection, hide single edit too
             DOM.waypointControlsDiv.style.display = 'none';
        }
    }
    // Update the "Select/Deselect All" checkbox state
    const allWaypoints = State.getWaypoints();
    DOM.selectAllWaypointsCheckboxEl.checked = allWaypoints.length > 0 && count === allWaypoints.length;
    DOM.selectAllWaypointsCheckboxEl.disabled = allWaypoints.length === 0;
}

export function applyMultiEdit() {
    const selectedIds = State.getSelectedForMultiEdit();
    if (selectedIds.size === 0) {
        showCustomAlert(_tr("alertNoWpMultiEdit"), _tr("alertWarning"));
        return;
    }

    const changes = [];
    let requiresTargetPoi = false;

    if (DOM.multiHeadingControlSelect.value) {
        changes.push({ property: 'headingControl', value: DOM.multiHeadingControlSelect.value });
        if (DOM.multiHeadingControlSelect.value === 'fixed') {
            changes.push({ property: 'fixedHeading', value: parseInt(DOM.multiFixedHeadingSlider.value) });
            changes.push({ property: 'targetPoiId', value: null }); // Clear POI target if fixed
        } else if (DOM.multiHeadingControlSelect.value === 'poi_track') {
            requiresTargetPoi = true;
            const poiId = DOM.multiTargetPoiSelect.value ? parseInt(DOM.multiTargetPoiSelect.value) : null;
            if (poiId === null) { // Check if a POI is actually selected
                 showCustomAlert(_tr("selectPoiDropdownDefault"), _tr("alertInputError")); // Or a more specific message
                 return;
            }
            changes.push({ property: 'targetPoiId', value: poiId });
        } else { // 'auto' or other modes
            changes.push({ property: 'targetPoiId', value: null }); // Clear POI target
        }
    }
    if (DOM.multiCameraActionSelect.value) {
        changes.push({ property: 'cameraAction', value: DOM.multiCameraActionSelect.value });
    }
    if (DOM.multiChangeGimbalPitchCheckbox.checked) {
        changes.push({ property: 'gimbalPitch', value: parseInt(DOM.multiGimbalPitchSlider.value) });
    }
    if (DOM.multiChangeHoverTimeCheckbox.checked) {
        changes.push({ property: 'hoverTime', value: parseInt(DOM.multiHoverTimeSlider.value) });
    }

    if (changes.length === 0) {
        showCustomAlert(_tr("alertMultiNoChange"), _tr("alertInfo"));
        return;
    }

    const waypointsToUpdate = Array.from(selectedIds).map(id => {
        return { id, changes };
    });

    State.updateMultipleWaypointProperties(waypointsToUpdate); // New function in state.js

    showCustomAlert(_tr("alertMultiApplied", selectedIds.size), _tr("alertInfo"));
    
    // Reset multi-edit form elements
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

    // Clear selection after applying changes, this will also hide the panel via event
    clearMultiSelection();
}