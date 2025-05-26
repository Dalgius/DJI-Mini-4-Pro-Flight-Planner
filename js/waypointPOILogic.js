// js/waypointPOILogic.js
import * as State from './state.js';
import * as DOM from './domElements.js';
// Removed direct imports from uiControls:
// import { updateWaypointListDisplay, updatePOIListDisplay, updateFlightStatisticsDisplay, populatePoiSelectDropdownForUI } from './uiControls.js';
// updateFlightPathDisplay is primarily a map concern, if waypointPOILogic affects the path, it should be via state changes that mapLogic listens to.
// For now, assuming updateFlightPathDisplay is handled by mapLogic reacting to state.selectedWaypointChanged or state.waypointsModified
// import { updateFlightPathDisplay } from './mapLogic.js'; 
import { showCustomAlert, _tr } from './utils.js';
// DOM elements are still needed for things like defaultAltitudeSlider if addWaypoint defaults depend on it.
// However, direct DOM manipulation for UI state (like hiding/showing panels) should be avoided here.

export function createWaypointIcon(id, isSelectedSingle, isMultiSelected = false) {
    let bgColor = '#3498db'; 
    let zIndexOffset = 0;
    let scaleFactor = 1.0; 
    let borderStyle = '2px solid white';
    let classNameSuffix = '';

    if (isSelectedSingle) { 
        bgColor = '#e74c3c'; 
        zIndexOffset = 1000;  
        scaleFactor = 1.2;   
        classNameSuffix = 'selected-single';
        if (isMultiSelected) { 
            borderStyle = '3px solid #f39c12'; 
        }
    } else if (isMultiSelected) { 
        bgColor = '#f39c12'; 
        zIndexOffset = 500;   
        scaleFactor = 1.1;   
        borderStyle = '2px solid #ffeb3b'; 
        classNameSuffix = 'selected-multi';
    }

    const size = 24 * scaleFactor;
    const fontSize = 12 * scaleFactor;

    return L.divIcon({
        className: `waypoint-marker ${classNameSuffix}`,
        html: `<div style="background: ${bgColor}; color: white; border-radius: 50%; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; font-size: ${fontSize.toFixed(0)}px; font-weight: bold; border: ${borderStyle}; box-shadow: 0 2px 4px rgba(0,0,0,0.3); transform: scale(1); transition: all 0.1s ease-out;">${id}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2]
    });
}

export function updateMarkerIcon(waypoint) {
    if (waypoint && waypoint.marker) {
        const isSelectedSingle = State.getSelectedWaypoint() && State.getSelectedWaypoint().id === waypoint.id;
        const isMultiSelected = State.selectedForMultiEdit.has(waypoint.id);
        waypoint.marker.setIcon(createWaypointIcon(waypoint.id, isSelectedSingle, isMultiSelected));
        
        let zOffset = 0;
        if (isSelectedSingle) {
            zOffset = 1000;
        } else if (isMultiSelected) {
            zOffset = 500;
        }
        waypoint.marker.setZIndexOffset(zOffset);
    }
}


export function addWaypoint(latlng) {
    const newWaypointData = {
        id: State.waypointCounter++,
        latlng: L.latLng(latlng.lat, latlng.lng),
        altitude: parseInt(DOM.defaultAltitudeSlider.value),
        hoverTime: 0, 
        gimbalPitch: parseInt(DOM.gimbalPitchSlider.value),
        headingControl: 'auto', 
        fixedHeading: 0,
        cameraAction: 'none',
        targetPoiId: null
    };
    const marker = L.marker(newWaypointData.latlng, { draggable: true, icon: createWaypointIcon(newWaypointData.id, false, false) }).addTo(State.getMap());
    
    newWaypointData.marker = marker; // Associa il marker all'oggetto waypoint

    marker.on('click', e => { L.DomEvent.stopPropagation(e); selectWaypoint(newWaypointData); });
    marker.on('dragend', () => {
        newWaypointData.latlng = marker.getLatLng();
        updateFlightPathDisplay(); updateFlightStatisticsDisplay(); updateWaypointListDisplay();
    });
    marker.on('drag', () => { newWaypointData.latlng = marker.getLatLng(); updateFlightPathDisplay(); });
    
    State.addWaypointToArray(newWaypointData);
    // UI update calls like updateWaypointListDisplay, updateFlightPathDisplay, updateFlightStatisticsDisplay
    // are removed because these should be triggered by stateChange events handled in uiControls.js or mapLogic.js
    // State.addWaypointToArray already dispatches a stateChange event.
    // State.setSelectedWaypoint (called by selectWaypoint) also dispatches an event.
    selectWaypoint(newWaypointData); // This will set the new waypoint as selected
}

export function addPOI(latlng) {
    if (State.getPois().length === 0) {
        State.resetPoiCounter(); // Use new state function
    }
    const name = DOM.poiNameInput.value.trim() || `POI ${State.getPoiCounter()}`;
    const newPoiData = {
        id: State.incrementPoiCounter(), // Use new state function
        name,
        latlng: L.latLng(latlng.lat, latlng.lng),
        altitude: 0 // Assuming default POI altitude is 0 or fetched later
    };
    const marker = L.marker(newPoiData.latlng, { draggable: true, icon: L.divIcon({ className: 'poi-marker', html: `<div style="background: #f39c12; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; border: 2px solid white;">🎯</div>`, iconSize: [20, 20], iconAnchor: [10, 10] }) }).addTo(State.getMap());
    marker.bindPopup(`<strong>${newPoiData.name}</strong>`);
    marker.on('dragend', () => {
        newPoiData.latlng = marker.getLatLng();
        // Manually dispatch if POI position change needs immediate reaction beyond map marker drag.
        // For now, assuming this is sufficient.
        State.dispatchStateChangeEvent({ poisModified: true, action: 'update_internal', poiUpdated: newPoiData.id });
    });
    newPoiData.marker = marker;
    State.addPoiToArray(newPoiData); // This dispatches { poisModified: true, action: 'add', ... }

    // Removed direct calls to uiControls for populating dropdowns or updating lists.
    // These will be handled by uiControls listening to 'stateChange' with 'poisModified'.
    DOM.poiNameInput.value = '';
}

export function selectWaypoint(waypoint) {
    const currentSelected = State.getSelectedWaypoint();
    if (currentSelected && currentSelected.marker) {
        updateMarkerIcon(currentSelected); // Update icon of the previously selected
    }
    State.setSelectedWaypoint(waypoint); // This dispatches 'selectedWaypointChanged'
    
    if (waypoint && waypoint.marker) {
       updateMarkerIcon(waypoint); // Update icon of the newly selected
       // DOM updates for waypoint controls are now handled by uiControls listening to 'selectedWaypointChanged'
       // State.getMap().panTo(waypoint.latlng); // Panning can remain, or also be a reaction
    }
    // All DOM updates for waypoint controls (sliders, inputs) are removed from here.
    // They should be in uiControls.js, reacting to the 'selectedWaypointChanged' event.
    // updateWaypointListDisplay(); // Removed, handled by uiControls reacting to selectedWaypointChanged or waypointsModified
}


// Renamed to avoid conflict if old name was used as a direct event handler by mistake.
function executeDeleteSelectedWaypoint() {
    const waypointToDelete = State.getSelectedWaypoint();
    if (!waypointToDelete) {
        showCustomAlert(_tr("alertNoWpSelected"), _tr("alertInfo"));
        return;
    }
    if (waypointToDelete.marker) {
        State.getMap().removeLayer(waypointToDelete.marker);
    }
    const deletedWaypointId = waypointToDelete.id;
    // Filter out the deleted waypoint and update the state
    const newWaypoints = State.getWaypoints().filter(wp => wp.id !== deletedWaypointId);
    State.setWaypoints(newWaypoints); // Dispatches { waypointsModified: true, action: 'set', ... }
    
    State.setSelectedWaypoint(null); // Dispatches { selectedWaypointChanged: true, selectedWaypointId: null, ... }

    // State.selectedForMultiEdit is a Set. Direct mutation is fine if it's not exported or if its modification is wrapped by state.js functions.
    // Assuming selectedForMultiEdit is managed by State.removeWaypointFromMultiEdit if needed elsewhere.
    if (State.getSelectedForMultiEdit().has(deletedWaypointId)) {
        State.removeWaypointFromMultiEdit(deletedWaypointId); // This will dispatch its own event
    }
    
    // DOM.waypointControlsDiv.style.display = 'none'; // This should be handled by uiControls reacting to selectedWaypointChanged (being null)
    // Removed updateWaypointListDisplay, updateFlightPathDisplay, updateFlightStatisticsDisplay
    showCustomAlert(_tr("alertWpDeleted"), _tr("alertSuccess"));
}

// Renamed for clarity
function executeClearAllWaypoints() {
    State.getWaypoints().forEach(wp => {
        if (wp.marker) State.getMap().removeLayer(wp.marker);
    });
    State.setWaypoints([]); // Dispatches { waypointsModified: true, action: 'set', count: 0 }
    State.setSelectedWaypoint(null); // Dispatches { selectedWaypointChanged: true, selectedWaypointId: null, ... }
    State.resetWaypointCounter(); // Dispatches its own event
    State.resetActionGroupCounter(); // Dispatches its own event
    State.resetActionCounter(); // Dispatches its own event
    
    // DOM.waypointControlsDiv.style.display = 'none'; // uiControls handles this
    // State.clearMultiEditSelection(); // If this is part of state.js, it dispatches its own event. If not, it should be.
    // For now, assume clearMultiEditSelection in state.js handles events if it's a stateful operation.
    // Or multiEditLogic listens to waypointsModified with count 0.
    // Removed updateWaypointListDisplay, updateFlightPathDisplay, updateFlightStatisticsDisplay
}

export function deletePOI(poiId) { // Renamed from deletePoiLogic to deletePOI for consistency
    const poisArray = State.getPois();
    const poiIndex = poisArray.findIndex(p => p.id === poiId);
    if (poiIndex > -1) {
        if(poisArray[poiIndex].marker) State.getMap().removeLayer(poisArray[poiIndex].marker);
        const deletedPoiId = poisArray[poiIndex].id;
        
        // Create a new array without the deleted POI
        const newPois = poisArray.filter(p => p.id !== poiId);
        State.setPois(newPois); // Dispatches { poisModified: true, action: 'set', ... }
        
        // Check if any waypoint was targeting this POI
        let waypointsWereModified = false;
        const currentWaypoints = State.getWaypoints();
        currentWaypoints.forEach(wp => {
            if (wp.targetPoiId === deletedPoiId) {
                wp.targetPoiId = null; // Modify waypoint property directly
                waypointsWereModified = true;
                // Dispatch an event for this specific waypoint update if granular updates are needed
                // State.dispatchStateChangeEvent({ waypointsModified: true, action: 'update_internal', waypointUpdated: wp.id });
            }
        });
        if (waypointsWereModified) {
            // If direct modification of waypoints array elements happened,
            // and these changes need to be broadly communicated for UI refresh (e.g. waypoint list showing target POI),
            // then we should signal that waypoints were modified.
            // A "soft" setWaypoints can do this, or a more specific event.
            State.setWaypoints([...currentWaypoints]); // Re-set with a new array reference to ensure change is detected if === is used by listeners
        }
        // UI updates for POI lists and dependent dropdowns are handled by uiControls listening to 'poisModified'.
        // UI updates for waypoint list (if it shows target POI) are handled by uiControls listening to 'waypointsModified'.
    }
}


export function handlePathClick(e) {
    const clickedLatLng = e.latlng;
    const currentWaypoints = State.getWaypoints(); // Get a mutable reference if splice is used.
                                                // If State.getWaypoints() returns a copy, this won't work as expected for splice.
                                                // Assuming it returns a direct reference for now.
    if (currentWaypoints.length < 2) return;

    let closestSegmentIndex = -1;
    let minDistanceToSegmentLine = Infinity;

    for (let i = 0; i < currentWaypoints.length - 1; i++) {
        const p1 = currentWaypoints[i].latlng;
        const p2 = currentWaypoints[i+1].latlng;
        const midPoint = L.latLng((p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2);
        const distToMid = clickedLatLng.distanceTo(midPoint);

        if (distToMid < minDistanceToSegmentLine) {
            minDistanceToSegmentLine = distToMid;
            closestSegmentIndex = i;
        }
    }

    if (closestSegmentIndex !== -1) {
        const alt1 = currentWaypoints[closestSegmentIndex].altitude;
        const alt2 = currentWaypoints[closestSegmentIndex + 1].altitude;
        let newWpAltitude = alt1;
        const distToP1 = clickedLatLng.distanceTo(currentWaypoints[closestSegmentIndex].latlng);
        const segmentLength = currentWaypoints[closestSegmentIndex].latlng.distanceTo(currentWaypoints[closestSegmentIndex+1].latlng);
        if (segmentLength > 0) {
            const ratio = distToP1 / segmentLength;
            newWpAltitude = alt1 + (alt2 - alt1) * ratio;
        }
        newWpAltitude = Math.round(Math.max(5, newWpAltitude));

        const newWaypointData = {
            id: State.incrementWaypointCounter(), // Use new state function
            latlng: clickedLatLng,
            altitude: newWpAltitude,
            hoverTime: 0,
            gimbalPitch: parseInt(DOM.gimbalPitchSlider.value), // Assuming DOM is accessible and relevant here
            headingControl: 'auto',
            fixedHeading: 0,
            cameraAction: 'none',
            targetPoiId: null
        };

        // Instead of directly splicing, create a new array if State.setWaypoints expects a new reference
        const newWaypointsArray = [
            ...currentWaypoints.slice(0, closestSegmentIndex + 1),
            newWaypointData,
            ...currentWaypoints.slice(closestSegmentIndex + 1)
        ];
        
        const marker = L.marker(newWaypointData.latlng, {
            draggable: true,
            icon: createWaypointIcon(newWaypointData.id, false, false)
        }).addTo(State.getMap());
        marker.on('click', ev => { L.DomEvent.stopPropagation(ev); selectWaypoint(newWaypointData); });
        marker.on('dragend', () => {
            newWaypointData.latlng = marker.getLatLng();
            // Manually dispatch event after drag, or mapLogic handles path update based on this.
            State.dispatchStateChangeEvent({ waypointsModified: true, action: 'update_internal', waypointUpdated: newWaypointData.id });
            // updateFlightPathDisplay(); // Let mapLogic handle this via stateChange
            // updateFlightStatisticsDisplay(); // Let uiControls handle this via stateChange
            // updateWaypointListDisplay(); // Let uiControls handle this via stateChange
        });
        marker.on('drag', () => { 
            newWaypointData.latlng = marker.getLatLng(); 
            State.dispatchStateChangeEvent({ waypointDragging: true, waypointId: newWaypointData.id, newLatLng: newWaypointData.latlng });
            // updateFlightPathDisplay(); // mapLogic should react to waypointDragging or waypointsModified
        });
        newWaypointData.marker = marker;
        
        State.setWaypoints(newWaypointsArray); // This dispatches { waypointsModified: true, action: 'set', ... }
        selectWaypoint(newWaypointData); // This dispatches { selectedWaypointChanged: true, ... }
        showCustomAlert(_tr("alertWpInserted", newWaypointData.id), _tr("alertInfo"));
    }
}

// Event handler for user actions related to waypoints
function handleUserWaypointAction(event) {
    if (!event.detail || !event.detail.action) return;

    switch (event.detail.action) {
        case 'deleteSelectedWaypoint':
            executeDeleteSelectedWaypoint();
            break;
        case 'clearAllWaypoints':
            executeClearAllWaypoints();
            break;
        // Add other waypoint-related actions here if needed
    }
}

// Initialize event listeners when the module is loaded
function initializeWaypointActionListeners() {
    document.addEventListener('userAction', handleUserWaypointAction);
    console.log("Waypoint action listeners initialized.");
}

initializeWaypointActionListeners(); // Call the setup function