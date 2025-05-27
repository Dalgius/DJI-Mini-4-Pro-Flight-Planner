// waypoints.js
import { updateWaypointList, updateFlightStatistics, updateMultiEditPanelVisibility, showCustomAlert } from './ui.js';
import { updateFlightPath } from './flightPath.js';
import { populatePoiSelectDropdown } from './pois.js';
import { getMap } from './map.js';

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

function updateMarkerIcon(waypoint) {
    const isSelectedSingle = selectedWaypoint && waypoint.id === selectedWaypoint.id;
    const isMultiSelected = selectedForMultiEdit.has(waypoint.id);
    waypoint.marker.setIcon(createWaypointIcon(waypoint.id, isSelectedSingle, isMultiSelected));
    waypoint.marker.setZIndexOffset(isSelectedSingle ? 1000 : isMultiSelected ? 500 : 0);
}

function updateWaypointControls(waypoint) {
    const waypointControls = document.getElementById('waypointControls');
    if (!waypointControls) return;
    waypointControls.style.display = 'block';
    document.getElementById('waypointAltitude').value = waypoint.altitude;
    document.getElementById('waypointAltitudeValue').textContent = `${waypoint.altitude}m`;
    document.getElementById('hoverTime').value = waypoint.hoverTime;
    document.getElementById('hoverTimeValue').textContent = `${waypoint.hoverTime}s`;
    document.getElementById('gimbalPitch').value = waypoint.gimbalPitch;
    document.getElementById('gimbalPitchValue').textContent = `${waypoint.gimbalPitch}°`;
    document.getElementById('headingControl').value = waypoint.headingControl;
    document.getElementById('fixedHeadingGroup').style.display = waypoint.headingControl === 'fixed' ? 'block' : 'none';
    document.getElementById('fixedHeading').value = waypoint.fixedHeading;
    document.getElementById('fixedHeadingValue').textContent = `${waypoint.fixedHeading}°`;
    document.getElementById('cameraActionSelect').value = waypoint.cameraAction;
    document.getElementById('targetPoiForHeadingGroup').style.display = waypoint.headingControl === 'poi_track' ? 'block' : 'none';
    populatePoiSelectDropdown(document.getElementById('targetPoiSelect'), waypoint.targetPoiId, true, '-- Select POI for Heading --');
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
        if (waypoint) updateMarkerIcon(waypoint);
    });
    updateWaypointList();
    updateMultiEditPanelVisibility();
}

export function applyMultiEdit() {
    const selectedIds = selectedForMultiEdit;
    if (selectedIds.size === 0) {
        showCustomAlert('No waypoints selected for multi-edit.', 'Info');
        return;
    }

    const multiHeadingControl = document.getElementById('multiHeadingControl').value;
    const multiFixedHeading = parseInt(document.getElementById('multiFixedHeading').value);
    const multiCameraAction = document.getElementById('multiCameraActionSelect').value;
    const multiGimbalPitchCheckbox = document.getElementById('multiChangeGimbalPitchCheckbox').checked;
    const multiGimbalPitch = parseInt(document.getElementById('multiGimbalPitch').value);
    const multiHoverTimeCheckbox = document.getElementById('multiChangeHoverTimeCheckbox').checked;
    const multiHoverTime = parseInt(document.getElementById('multiHoverTime').value);
    const multiTargetPoiId = document.getElementById('multiTargetPoiSelect').value ? parseInt(document.getElementById('multiTargetPoiSelect').value) : null;

    waypoints.forEach(wp => {
        if (selectedIds.has(wp.id)) {
            wp.headingControl = multiHeadingControl;
            if (multiHeadingControl === 'fixed') {
                wp.fixedHeading = multiFixedHeading;
            } else if (multiHeadingControl === 'poi_track') {
                wp.targetPoiId = multiTargetPoiId;
            } else {
                wp.targetPoiId = null;
            }
            wp.cameraAction = multiCameraAction;
            if (multiGimbalPitchCheckbox) {
                wp.gimbalPitch = multiGimbalPitch;
            }
            if (multiHoverTimeCheckbox) {
                wp.hoverTime = multiHoverTime;
            }
            updateMarkerIcon(wp);
        }
    });

    updateWaypointList();
    updateFlightPath();
    updateFlightStatistics();
    updateMultiEditPanelVisibility();
    showCustomAlert(`${selectedIds.size} waypoints updated successfully.`, 'Success');
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
