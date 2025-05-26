// js/state.js

// Helper function to dispatch state change events
function dispatchStateChangeEvent(detail) {
    document.dispatchEvent(new CustomEvent('stateChange', { detail }));
}

export let mapInstance; // Riferimento all'istanza della mappa Leaflet
export let waypoints = [];
export let pois = [];
export let selectedWaypoint = null;
export let flightPath = null;
export let satelliteView = false;
export let waypointCounter = 1;
export let poiCounter = 1;
export let actionGroupCounter = 1;
export let actionCounter = 1;
export let defaultTileLayer;
export let satelliteTileLayer;
export let userLocationMarker;
export let selectedForMultiEdit = new Set();

// --- Map Instance ---
export function getMap() { return mapInstance; }
export function setMap(mapObj) {
    mapInstance = mapObj;
    dispatchStateChangeEvent({ mapInstanceChanged: true, isSet: mapObj !== null });
}

// --- Waypoints ---
export function getWaypoints() { return waypoints; }
export function setWaypoints(newWaypoints) {
    waypoints = newWaypoints;
    dispatchStateChangeEvent({ waypointsModified: true, action: 'set', count: waypoints.length });
}
export function addWaypointToArray(wp) {
    waypoints.push(wp);
    dispatchStateChangeEvent({ waypointsModified: true, action: 'add', waypointAdded: wp.id, count: waypoints.length });
}

export function updateWaypointProperty(waypointId, propertyName, value) {
    const waypoint = waypoints.find(w => w.id === waypointId);
    if (waypoint && waypoint[propertyName] !== value) { // Check if value actually changed
        waypoint[propertyName] = value;
        dispatchStateChangeEvent({
            waypointsModified: true,
            action: 'update',
            waypointUpdated: waypointId,
            updatedProperty: propertyName,
            newValue: value
        });
    }
}

export function updateMultipleWaypointProperties(waypointsToUpdate) {
    const updatedWaypointIds = [];
    let actualChangesMade = false;

    waypointsToUpdate.forEach(updateInfo => {
        const waypoint = waypoints.find(w => w.id === updateInfo.id);
        if (waypoint) {
            let waypointChangedInThisIteration = false;
            updateInfo.changes.forEach(change => {
                if (waypoint[change.property] !== change.value) {
                    waypoint[change.property] = change.value;
                    actualChangesMade = true;
                    waypointChangedInThisIteration = true;
                }
            });
            if (waypointChangedInThisIteration) {
                updatedWaypointIds.push(updateInfo.id);
            }
        }
    });

    if (actualChangesMade) {
        dispatchStateChangeEvent({
            waypointsModified: true,
            action: 'batch_update',
            updatedWaypointIds: updatedWaypointIds
        });
    }
}

// --- POIs ---
export function getPois() { return pois; }
export function setPois(newPois) {
    pois = newPois;
    dispatchStateChangeEvent({ poisModified: true, action: 'set', count: pois.length });
}
export function addPoiToArray(poi) {
    pois.push(poi);
    dispatchStateChangeEvent({ poisModified: true, action: 'add', poiAdded: poi.id, count: pois.length });
}

// --- Selected Waypoint ---
export function getSelectedWaypoint() { return selectedWaypoint; }
export function setSelectedWaypoint(wp) {
    const oldSelectedId = selectedWaypoint ? selectedWaypoint.id : null;
    const newSelectedId = wp ? wp.id : null;
    // Only dispatch if selection actually changes to prevent redundant events if the same object is set.
    // However, if wp is a new object instance for the same ID, this logic might need adjustment
    // or the caller ensures not to call setSelectedWaypoint unnecessarily.
    if (oldSelectedId !== newSelectedId) {
        selectedWaypoint = wp;
        dispatchStateChangeEvent({ selectedWaypointChanged: true, selectedWaypointId: newSelectedId, previousSelectedWaypointId: oldSelectedId });
    } else if (wp === null && selectedWaypoint !== null) { // Handle deselecting when already null
         selectedWaypoint = null; // Ensure it's null
         dispatchStateChangeEvent({ selectedWaypointChanged: true, selectedWaypointId: null, previousSelectedWaypointId: oldSelectedId });
    } else if (wp !== null && selectedWaypoint !== null && wp.id === selectedWaypoint.id) {
        // If the same waypoint is "re-selected", still dispatch an event as some UI might need to refresh based on it
        // or the waypoint object instance itself might have changed properties.
        selectedWaypoint = wp;
        dispatchStateChangeEvent({ selectedWaypointChanged: true, selectedWaypointId: newSelectedId, previousSelectedWaypointId: oldSelectedId, reselected: true });
    }
}

// --- Flight Path ---
export function getFlightPath() { return flightPath; }
export function setFlightPath(newPath) {
    flightPath = newPath;
    dispatchStateChangeEvent({ flightPathChanged: true, hasPath: newPath !== null });
}
export function clearFlightPath() {
    flightPath = null;
    dispatchStateChangeEvent({ flightPathChanged: true, hasPath: false });
}

// --- Satellite View ---
export function getSatelliteView() { return satelliteView; }
export function setSatelliteView(isSatellite) {
    if (satelliteView !== isSatellite) {
        satelliteView = isSatellite;
        dispatchStateChangeEvent({ satelliteViewChanged: true, newValue: satelliteView });
    }
}
export function toggleSatelliteView() {
    satelliteView = !satelliteView;
    dispatchStateChangeEvent({ satelliteViewChanged: true, newValue: satelliteView });
}

// --- Waypoint Counter ---
export function getWaypointCounter() { return waypointCounter; }
export function incrementWaypointCounter() {
    waypointCounter++;
    dispatchStateChangeEvent({ waypointCounterChanged: true, action: 'increment', newValue: waypointCounter });
    return waypointCounter;
}
export function resetWaypointCounter(newStartValue = 1) {
    waypointCounter = newStartValue;
    dispatchStateChangeEvent({ waypointCounterChanged: true, action: 'reset', newValue: waypointCounter });
}
export function setWaypointCounter(value) {
    if (waypointCounter !== value) {
        waypointCounter = value;
        dispatchStateChangeEvent({ waypointCounterChanged: true, action: 'set', newValue: waypointCounter });
    }
}

// --- POI Counter ---
export function getPoiCounter() { return poiCounter; }
export function incrementPoiCounter() {
    poiCounter++;
    dispatchStateChangeEvent({ poiCounterChanged: true, action: 'increment', newValue: poiCounter });
    return poiCounter;
}
export function resetPoiCounter(newStartValue = 1) {
    poiCounter = newStartValue;
    dispatchStateChangeEvent({ poiCounterChanged: true, action: 'reset', newValue: poiCounter });
}
export function setPoiCounter(value) {
    if (poiCounter !== value) {
        poiCounter = value;
        dispatchStateChangeEvent({ poiCounterChanged: true, action: 'set', newValue: poiCounter });
    }
}

// --- Action Group Counter ---
export function getActionGroupCounter() { return actionGroupCounter; }
export function incrementActionGroupCounter() {
    actionGroupCounter++;
    dispatchStateChangeEvent({ actionGroupCounterChanged: true, action: 'increment', newValue: actionGroupCounter });
    return actionGroupCounter;
}
export function resetActionGroupCounter(newStartValue = 1) {
    actionGroupCounter = newStartValue;
    dispatchStateChangeEvent({ actionGroupCounterChanged: true, action: 'reset', newValue: actionGroupCounter });
}

// --- Action Counter ---
export function getActionCounter() { return actionCounter; }
export function incrementActionCounter() {
    actionCounter++;
    dispatchStateChangeEvent({ actionCounterChanged: true, action: 'increment', newValue: actionCounter });
    return actionCounter;
}
export function resetActionCounter(newStartValue = 1) {
    actionCounter = newStartValue;
    dispatchStateChangeEvent({ actionCounterChanged: true, action: 'reset', newValue: actionCounter });
}

// --- Default Tile Layer ---
export function getDefaultTileLayer() { return defaultTileLayer; }
export function setDefaultTileLayer(layer) {
    defaultTileLayer = layer;
    dispatchStateChangeEvent({ defaultTileLayerChanged: true, isSet: layer !== null });
}

// --- Satellite Tile Layer ---
export function getSatelliteTileLayer() { return satelliteTileLayer; }
export function setSatelliteTileLayer(layer) {
    satelliteTileLayer = layer;
    dispatchStateChangeEvent({ satelliteTileLayerChanged: true, isSet: layer !== null });
}

// --- User Location Marker ---
export function getUserLocationMarker() { return userLocationMarker; }
export function setUserLocationMarker(marker) {
    userLocationMarker = marker;
    dispatchStateChangeEvent({ userLocationMarkerChanged: true, isSet: marker !== null });
}

// --- Selected For Multi-Edit (Set object) ---
export function getSelectedForMultiEdit() { return selectedForMultiEdit; }
export function addWaypointToMultiEdit(id) {
    const oldSize = selectedForMultiEdit.size;
    selectedForMultiEdit.add(id);
    if (selectedForMultiEdit.size !== oldSize) {
        dispatchStateChangeEvent({ multiEditSelectionChanged: true, action: 'add', itemAdded: id, newSize: selectedForMultiEdit.size });
    }
}
export function removeWaypointFromMultiEdit(id) {
    const oldSize = selectedForMultiEdit.size;
    selectedForMultiEdit.delete(id);
    if (selectedForMultiEdit.size !== oldSize) {
        dispatchStateChangeEvent({ multiEditSelectionChanged: true, action: 'remove', itemRemoved: id, newSize: selectedForMultiEdit.size });
    }
}
export function clearMultiEditSelection() {
    const oldSize = selectedForMultiEdit.size;
    if (oldSize > 0) {
        selectedForMultiEdit.clear();
        dispatchStateChangeEvent({ multiEditSelectionChanged: true, action: 'clear', newSize: 0 });
    }
}

/*
NOTE ON DIRECT MODIFICATION:
The functions above help manage state changes and dispatch events.
However, JavaScript allows direct modification of array elements or object properties
(e.g., `State.getWaypoints()[0].altitude = 100;`).
Such direct modifications WILL NOT automatically trigger the 'stateChange' event.

If you modify state directly in such a way and need to notify other parts of the application,
you should manually call `dispatchStateChangeEvent` afterwards:
`import { dispatchStateChangeEvent } from './state.js';`
`dispatchStateChangeEvent({ waypointsModified: true, action: 'update', waypointUpdated: id_of_waypoint });`

Alternatively, create more specific mutator functions within this state.js file for common
modifications (e.g., `updateWaypointAltitude(waypointId, newAltitude)`).
*/

// Exposing the dispatcher if manual dispatch is needed from other modules (use with caution)
export { dispatchStateChangeEvent };