// waypoints.js
import { updateWaypointList, updateFlightStatistics, updateMultiEditPanelVisibility } from './ui.js';
import { updateFlightPath } from './flightPath.js';
import { populatePoiSelectDropdown } from './pois.js';
import { getMap } from './map.js'; // Added import

let waypoints = [];
let waypointCounter = 1;
let selectedWaypoint = null;
let selectedForMultiEdit = new Set();

export function addWaypoint(latlng) {
    const defaultAltitudeSlider = document.getElementById('defaultAltitude');
    const gimbalPitchSlider = document.getElementById('gimbalPitch');
    const waypoint = {
        id: waypointCounter++,
        latlng: L.latLng(latlng.lat, latlng.lng),
        altitude: parseInt(defaultAltitudeSlider.value),
        hoverTime: 0,
        gimbalPitch: parseInt(gimbalPitchSlider.value),
        headingControl: 'auto',
        fixedHeading: 0,
        cameraAction: 'none',
        targetPoiId: null
    };
    const marker = L.marker(waypoint.latlng, { draggable: true, icon: createWaypointIcon(waypoint.id, false) }).addTo(getMap());
    marker.on('click', e => {
        L.DomEvent.stopPropagation(e);
        selectWaypoint(waypoint);
    });
    marker.on('dragend', () => {
        waypoint.latlng = marker.getLatLng();
        updateFlightPath();
        updateFlightStatistics();
        updateWaypointList();
    });
    marker.on('drag', () => {
        waypoint.latlng = marker.getLatLng();
        updateFlightPath();
    });
    waypoint.marker = marker;
    waypoints.push(waypoint);
    updateWaypointList();
    updateFlightPath();
    updateFlightStatistics();
    selectWaypoint(waypoint);
}

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
        html: `<div style="
                    background: ${bgColor}; 
                    color: white; 
                    border-radius: 50%; 
                    width: ${size}px; 
                    height: ${size}px; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    font-size: ${fontSize.toFixed(0)}px; 
                    font-weight: bold; 
                    border: ${borderStyle}; 
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3); 
                    transform: scale(1);
                    transition: all 0.1s ease-out;
                ">${id}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2]
    });
}

export function selectWaypoint(waypoint) {
    const previouslySelectedSingle = selectedWaypoint;
    clearMultiSelection();
    if (previouslySelectedSingle && previouslySelectedSingle.id !== waypoint.id) {
        updateMarkerIcon(previouslySelectedSingle);
    }
    selectedWaypoint = waypoint;
    waypoints.forEach(wp => updateMarkerIcon(wp));
    updateWaypointControls(waypoint);
    updateWaypointList();
    if (selectedWaypoint.marker) getMap().panTo(selectedWaypoint.latlng);
}

export function deleteSelectedWaypoint() {
    if (!selectedWaypoint) {
        showCustomAlert('No waypoint selected to delete.', 'Info');
        return;
    }
    if (selectedWaypoint.marker) {
        getMap().removeLayer(selectedWaypoint.marker);
    }
    const deletedWaypointId = selectedWaypoint.id;
    waypoints = waypoints.filter(wp => wp.id !== deletedWaypointId);
    selectedWaypoint = null;
    document.getElementById('waypointControls').style.display = 'none';
    if (selectedForMultiEdit.has(deletedWaypointId)) {
        selectedForMultiEdit.delete(deletedWaypointId);
    }
    updateWaypointList();
    updateFlightPath();
    updateFlightStatistics();
    updateMultiEditPanelVisibility();
    showCustomAlert('Waypoint deleted.', 'Success');
}

export function clearWaypoints() {
    waypoints.forEach(wp => {
        if (wp.marker) getMap().removeLayer(wp.marker);
    });
    waypoints = [];
    selectedWaypoint = null;
    waypointCounter = 1;
    clearMultiSelection();
    document.getElementById('waypointControls').style.display = 'none';
    updateWaypointList();
    updateFlightPath();
    updateFlightStatistics();
}

export function toggleMultiSelectWaypoint(waypointId, isChecked) {
    const waypoint = waypoints.find(wp => wp.id === waypointId);
    if (!waypoint) return;
    if (isChecked) {
        selectedForMultiEdit.add(waypointId);
    } else {
        selectedForMultiEdit.delete(waypointId);
    }
    updateMarkerIcon(waypoint);
    if (selectedWaypoint && selectedWaypoint.id === waypointId) {
        updateMarkerIcon(selectedWaypoint);
    }
    const allWaypointsSelected = waypoints.length > 0 && waypoints.every(wp => selectedForMultiEdit.has(wp.id));
    document.getElementById('selectAllWaypointsCheckbox').checked = allWaypointsSelected;
    updateWaypointList();
    updateMultiEditPanelVisibility();
}

export function clearMultiSelection() {
    const previouslyMultiSelectedIds = new Set(selectedForMultiEdit);
    selectedForMultiEdit.clear();
    document.getElementById('selectAllWaypointsCheckbox').checked = false;
    previouslyMultiSelectedIds.forEach(id => {
        const waypoint = waypoints.find(wp => wp.id === id);
        updateMarkerIcon(waypoint);
    });
    updateWaypointList();
    updateMultiEditPanelVisibility();
}

export function getWaypoints() {
    return waypoints;
}

export function getSelectedWaypoint() {
    return selectedWaypoint;
}

export function getSelectedForMultiEdit() {
    return selectedForMultiEdit;
}

export function getWaypointCounter() {
    return waypointCounter;
}

export function setWaypointCounter(value) {
    waypointCounter = value;
}
