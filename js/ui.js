// ui.js
import { selectWaypoint, toggleMultiSelectWaypoint, clearWaypoints, getWaypoints, getSelectedWaypoint, getSelectedForMultiEdit, deleteSelectedWaypoint, applyMultiEdit, clearMultiSelection } from './waypoints.js';
import { deletePOI, populatePoiSelectDropdown, getPois } from './pois.js';
import { updateFlightPath } from './flightPath.js';
import { showOrbitDialog, handleConfirmOrbit } from './orbit.js';
import { exportFlightPlan, triggerImport, handleFileImport, exportToDjiWpmlKmz, exportToGoogleEarth } from './exportImport.js';
import { getHomeElevationFromFirstWaypoint, adaptAltitudesToAGL } from './terrain.js';
import { getMap, toggleSatelliteView, showCurrentLocation } from './map.js';

let defaultAltitudeSlider, defaultAltitudeValueEl, flightSpeedSlider, flightSpeedValueEl;
let waypointAltitudeSlider, waypointAltitudeValueEl, hoverTimeSlider, hoverTimeValueEl;
let gimbalPitchSlider, gimbalPitchValueEl, fixedHeadingSlider, fixedHeadingValueEl;
let headingControlSelect, fixedHeadingGroupDiv, waypointControlsDiv, pathTypeSelect;
let waypointListEl, poiListEl, poiNameInput, cameraActionSelect;
let totalDistanceEl, flightTimeEl, waypointCountEl, poiCountEl;
let targetPoiSelect, multiTargetPoiSelect, multiTargetPoiForHeadingGroupDiv, targetPoiForHeadingGroupDiv;
let homeElevationMslInput, desiredAGLInput, adaptToAGLBtnEl, loadingOverlayEl;
let multiWaypointEditControlsDiv, selectedWaypointsCountEl;
let multiHeadingControlSelect, multiFixedHeadingGroupDiv, multiFixedHeadingSlider, multiFixedHeadingValueEl;
let multiCameraActionSelect;
let multiChangeGimbalPitchCheckbox, multiGimbalPitchSlider, multiGimbalPitchValueEl;
let multiChangeHoverTimeCheckbox, multiHoverTimeSlider, multiHoverTimeValueEl;
let selectAllWaypointsCheckboxEl;
let clearWaypointsBtn, applyMultiEditBtn, clearMultiSelectionBtn, deleteSelectedWaypointBtn;
let getHomeElevationBtn, createOrbitBtn, importJsonBtn, exportJsonBtn, exportKmzBtn, exportGoogleEarthBtn;
let satelliteToggleBtn, fitMapBtn, myLocationBtn;
let customAlertOverlayEl, customAlertMessageEl, customAlertOkButtonEl, customAlertTitleEl;
let orbitModalOverlayEl, orbitPoiSelectEl, orbitRadiusInputEl, orbitPointsInputEl, confirmOrbitBtnEl, cancelOrbitBtnEl;

export function cacheDOMElements() {
    defaultAltitudeSlider = document.getElementById('defaultAltitude');
    defaultAltitudeValueEl = document.getElementById('defaultAltitudeValue');
    flightSpeedSlider = document.getElementById('flightSpeed');
    flightSpeedValueEl = document.getElementById('flightSpeedValue');
    pathTypeSelect = document.getElementById('pathType');
    waypointAltitudeSlider = document.getElementById('waypointAltitude');
    waypointAltitudeValueEl = document.getElementById('waypointAltitudeValue');
    hoverTimeSlider = document.getElementById('hoverTime');
    hoverTimeValueEl = document.getElementById('hoverTimeValue');
    gimbalPitchSlider = document.getElementById('gimbalPitch');
    gimbalPitchValueEl = document.getElementById('gimbalPitchValue');
    fixedHeadingSlider = document.getElementById('fixedHeading');
    fixedHeadingValueEl = document.getElementById('fixedHeadingValue');
    headingControlSelect = document.getElementById('headingControl');
    fixedHeadingGroupDiv = document.getElementById('fixedHeadingGroup');
    waypointControlsDiv = document.getElementById('waypointControls');
    cameraActionSelect = document.getElementById('cameraActionSelect');
    targetPoiSelect = document.getElementById('targetPoiSelect');
    targetPoiForHeadingGroupDiv = document.getElementById('targetPoiForHeadingGroup');
    waypointListEl = document.getElementById('waypointList');
    poiListEl = document.getElementById('poiList');
    poiNameInput = document.getElementById('poiName');
    totalDistanceEl = document.getElementById('totalDistance');
    flightTimeEl = document.getElementById('flightTime');
    waypointCountEl = document.getElementById('waypointCount');
    poiCountEl = document.getElementById('poiCount');
    selectAllWaypointsCheckboxEl = document.getElementById('selectAllWaypointsCheckbox');
    multiWaypointEditControlsDiv = document.getElementById('multiWaypointEditControls');
    selectedWaypointsCountEl = document.getElementById('selectedWaypointsCount');
    multiHeadingControlSelect = document.getElementById('multiHeadingControl');
    multiFixedHeadingGroupDiv = document.getElementById('multiFixedHeadingGroup');
    multiFixedHeadingSlider = document.getElementById('multiFixedHeading');
    multiFixedHeadingValueEl = document.getElementById('multiFixedHeadingValue');
    multiCameraActionSelect = document.getElementById('multiCameraActionSelect');
    multiChangeGimbalPitchCheckbox = document.getElementById('multiChangeGimbalPitchCheckbox');
    multiGimbalPitchSlider = document.getElementById('multiGimbalPitch');
    multiGimbalPitchValueEl = document.getElementById('multiGimbalPitchValue');
    multiChangeHoverTimeCheckbox = document.getElementById('multiChangeHoverTimeCheckbox');
    multiHoverTimeSlider = document.getElementById('multiHoverTime');
    multiHoverTimeValueEl = document.getElementById('multiHoverTimeValue');
    multiTargetPoiSelect = document.getElementById('multiTargetPoiSelect');
    multiTargetPoiForHeadingGroupDiv = document.getElementById('multiTargetPoiForHeadingGroup');
    homeElevationMslInput = document.getElementById('homeElevationMsl');
    desiredAGLInput = document.getElementById('desiredAGL');
    adaptToAGLBtnEl = document.getElementById('adaptToAGLBtn');
    loadingOverlayEl = document.getElementById('loadingOverlay');
    clearWaypointsBtn = document.getElementById('clearWaypointsBtn');
    applyMultiEditBtn = document.getElementById('applyMultiEditBtn');
    clearMultiSelectionBtn = document.getElementById('clearMultiSelectionBtn');
    deleteSelectedWaypointBtn = document.getElementById('deleteSelectedWaypointBtn');
    getHomeElevationBtn = document.getElementById('getHomeElevationBtn');
    createOrbitBtn = document.getElementById('createOrbitBtn');
    importJsonBtn = document.getElementById('importJsonBtn');
    exportJsonBtn = document.getElementById('exportJsonBtn');
    exportKmzBtn = document.getElementById('exportKmzBtn');
    exportGoogleEarthBtn = document.getElementById('exportGoogleEarthBtn');
    satelliteToggleBtn = document.getElementById('satelliteToggleBtn');
    fitMapBtn = document.getElementById('fitMapBtn');
    myLocationBtn = document.getElementById('myLocationBtn');
    customAlertOverlayEl = document.getElementById('customAlertOverlay');
    customAlertMessageEl = document.getElementById('customAlertMessage');
    customAlertOkButtonEl = document.getElementById('customAlertOkButton');
    customAlertTitleEl = document.getElementById('customAlertTitle');
    orbitModalOverlayEl = document.getElementById('orbitModalOverlay');
    orbitPoiSelectEl = document.getElementById('orbitPoiSelect');
    orbitRadiusInputEl = document.getElementById('orbitRadiusInput');
    orbitPointsInputEl = document.getElementById('orbitPointsInput');
    confirmOrbitBtnEl = document.getElementById('confirmOrbitBtn');
    cancelOrbitBtnEl = document.getElementById('cancelOrbitBtn');

    defaultAltitudeValueEl.textContent = defaultAltitudeSlider.value + 'm';
    flightSpeedValueEl.textContent = flightSpeedSlider.value + ' m/s';
    multiFixedHeadingValueEl.textContent = multiFixedHeadingSlider.value + '°';
    multiGimbalPitchValueEl.textContent = multiGimbalPitchSlider.value + '°';
    multiHoverTimeValueEl.textContent = multiHoverTimeSlider.value + 's';
    if (gimbalPitchSlider && gimbalPitchValueEl) gimbalPitchValueEl.textContent = gimbalPitchSlider.value + '°';
}

export function setupEventListeners() {
    if (defaultAltitudeSlider) defaultAltitudeSlider.addEventListener('input', () => defaultAltitudeValueEl.textContent = defaultAltitudeSlider.value + 'm');
    if (flightSpeedSlider) flightSpeedSlider.addEventListener('input', () => {
        flightSpeedValueEl.textContent = flightSpeedSlider.value + ' m/s';
        updateFlightStatistics();
    });
    if (pathTypeSelect) pathTypeSelect.addEventListener('change', updateFlightPath);
    if (waypointAltitudeSlider) waypointAltitudeSlider.addEventListener('input', () => {
        const selectedWaypoint = getSelectedWaypoint();
        if (!selectedWaypoint) return;
        waypointAltitudeValueEl.textContent = waypointAltitudeSlider.value + 'm';
        selectedWaypoint.altitude = parseInt(waypointAltitudeSlider.value);
        updateWaypointList();
    });
    if (hoverTimeSlider) hoverTimeSlider.addEventListener('input', () => {
        const selectedWaypoint = getSelectedWaypoint();
        if (!selectedWaypoint) return;
        hoverTimeValueEl.textContent = hoverTimeSlider.value + 's';
        selectedWaypoint.hoverTime = parseInt(hoverTimeSlider.value);
        updateFlightStatistics();
        updateWaypointList();
    });
    if (gimbalPitchSlider) gimbalPitchSlider.addEventListener('input', () => {
        const selectedWaypoint = getSelectedWaypoint();
        if (!selectedWaypoint) return;
        gimbalPitchValueEl.textContent = gimbalPitchSlider.value + '°';
        selectedWaypoint.gimbalPitch = parseInt(gimbalPitchSlider.value);
    });
    if (fixedHeadingSlider) fixedHeadingSlider.addEventListener('input', () => {
        const selectedWaypoint = getSelectedWaypoint();
        if (!selectedWaypoint) return;
        fixedHeadingValueEl.textContent = fixedHeadingSlider.value + '°';
        selectedWaypoint.fixedHeading = parseInt(fixedHeadingSlider.value);
    });
    if (headingControlSelect) headingControlSelect.addEventListener('change', function () {
        const selectedWaypoint = getSelectedWaypoint();
        if (!selectedWaypoint) return;
        fixedHeadingGroupDiv.style.display = this.value === 'fixed' ? 'block' : 'none';
        targetPoiForHeadingGroupDiv.style.display = this.value === 'poi_track' ? 'block' : 'none';
        selectedWaypoint.headingControl = this.value;
        if (this.value === 'poi_track') {
            populatePoiSelectDropdown(targetPoiSelect, selectedWaypoint.targetPoiId, true, '-- Select POI for Heading --');
        } else {
            selectedWaypoint.targetPoiId = null;
        }
        updateWaypointList();
    });
    if (targetPoiSelect) targetPoiSelect.addEventListener('change', function () {
        const selectedWaypoint = getSelectedWaypoint();
        if (selectedWaypoint) {
            selectedWaypoint.targetPoiId = this.value ? parseInt(this.value) : null;
            updateWaypointList();
        }
    });
    if (cameraActionSelect) cameraActionSelect.addEventListener('change', function () {
        const selectedWaypoint = getSelectedWaypoint();
        if (selectedWaypoint) {
            selectedWaypoint.cameraAction = this.value;
            updateWaypointList();
        }
    });
    if (deleteSelectedWaypointBtn) deleteSelectedWaypointBtn.addEventListener('click', deleteSelectedWaypoint);
    if (selectAllWaypointsCheckboxEl) selectAllWaypointsCheckboxEl.addEventListener('change', (e) => toggleSelectAllWaypoints(e.target.checked));
    if (multiHeadingControlSelect) multiHeadingControlSelect.addEventListener('change', function () {
        multiFixedHeadingGroupDiv.style.display = this.value === 'fixed' ? 'block' : 'none';
        multiTargetPoiForHeadingGroupDiv.style.display = this.value === 'poi_track' ? 'block' : 'none';
        if (this.value === 'poi_track') {
            populatePoiSelectDropdown(multiTargetPoiSelect, null, true, '-- Select POI for all --');
        }
    });
    if (multiFixedHeadingSlider) multiFixedHeadingSlider.addEventListener('input', function () {
        multiFixedHeadingValueEl.textContent = this.value + '°';
    });
    if (multiGimbalPitchSlider) multiGimbalPitchSlider.addEventListener('input', function () {
        multiGimbalPitchValueEl.textContent = this.value + '°';
    });
    if (multiHoverTimeSlider) multiHoverTimeSlider.addEventListener('input', function () {
        multiHoverTimeValueEl.textContent = this.value + 's';
    });
    if (multiChangeGimbalPitchCheckbox) multiChangeGimbalPitchCheckbox.addEventListener('change', function () {
        multiGimbalPitchSlider.disabled = !this.checked;
        if (!this.checked) multiGimbalPitchSlider.value = 0;
        multiGimbalPitchValueEl.textContent = multiGimbalPitchSlider.value + '°';
    });
    if (multiChangeHoverTimeCheckbox) multiChangeHoverTimeCheckbox.addEventListener('change', function () {
        multiHoverTimeSlider.disabled = !this.checked;
        if (!this.checked) multiHoverTimeSlider.value = 0;
        multiHoverTimeValueEl.textContent = multiHoverTimeSlider.value + 's';
    });
    if (applyMultiEditBtn) applyMultiEditBtn.addEventListener('click', applyMultiEdit);
    if (clearMultiSelectionBtn) clearMultiSelectionBtn.addEventListener('click', clearMultiSelection);
    if (clearWaypointsBtn) clearWaypointsBtn.addEventListener('click', clearWaypoints);
    if (getHomeElevationBtn) getHomeElevationBtn.addEventListener('click', getHomeElevationFromFirstWaypoint);
    if (adaptToAGLBtnEl) adaptToAGLBtnEl.addEventListener('click', adaptAltitudesToAGL);
    if (createOrbitBtn) createOrbitBtn.addEventListener('click', showOrbitDialog);
    if (importJsonBtn) importJsonBtn.addEventListener('click', triggerImport);
    if (exportJsonBtn) exportJsonBtn.addEventListener('click', exportFlightPlan);
    if (exportKmzBtn) exportKmzBtn.addEventListener('click', exportToDjiWpmlKmz);
    if (exportGoogleEarthBtn) exportGoogleEarthBtn.addEventListener('click', exportToGoogleEarth);
    const fileInputElement = document.getElementById('fileInput');
    if (fileInputElement) fileInputElement.addEventListener('change', handleFileImport);
    if (satelliteToggleBtn) satelliteToggleBtn.addEventListener('click', toggleSatelliteView);
    if (fitMapBtn) fitMapBtn.addEventListener('click', fitMapToWaypoints);
    if (myLocationBtn) myLocationBtn.addEventListener('click', showCurrentLocation);
    if (customAlertOkButtonEl) customAlertOkButtonEl.addEventListener('click', () => {
        if (customAlertOverlayEl) customAlertOverlayEl.style.display = 'none';
    });
    if (confirmOrbitBtnEl) confirmOrbitBtnEl.addEventListener('click', handleConfirmOrbit);
    if (cancelOrbitBtnEl) cancelOrbitBtnEl.addEventListener('click', () => {
        if (orbitModalOverlayEl) orbitModalOverlayEl.style.display = 'none';
    });
}

export function toggleSelectAllWaypoints(checked) {
    getWaypoints().forEach(wp => toggleMultiSelectWaypoint(wp.id, checked));
}

export function updateWaypointList() {
    const waypoints = getWaypoints();
    if (waypoints.length === 0) {
        waypointListEl.innerHTML = '<div style="text-align: center; color: #95a5a6; font-size: 12px; padding: 20px;">Click on map to add waypoints</div>';
        selectAllWaypointsCheckboxEl.checked = false;
        selectAllWaypointsCheckboxEl.disabled = true;
        return;
    }
    selectAllWaypointsCheckboxEl.disabled = false;
    waypointListEl.innerHTML = waypoints.map(wp => {
        let actionText = getCameraActionText(wp.cameraAction);
        let hoverText = wp.hoverTime > 0 ? ` | Hover: ${wp.hoverTime}s` : '';
        let poiTargetText = '';
        if (wp.headingControl === 'poi_track' && wp.targetPoiId != null) {
            const target = getPois().find(p => p.id === wp.targetPoiId);
            poiTargetText = target ? ` | Target: ${target.name}` : ` | Target: POI ID ${wp.targetPoiId} (not found)`;
        }
        let actionInfo = actionText ? `<div class="waypoint-action-info">Action: ${actionText}${poiTargetText}</div>` : (poiTargetText ? `<div class="waypoint-action-info">${poiTargetText.substring(3)}</div>` : '');
        const isSelectedForMulti = getSelectedForMultiEdit().has(wp.id);
        let itemClasses = 'waypoint-item';
        if (getSelectedWaypoint() && wp.id === getSelectedWaypoint().id && waypointControlsDiv.style.display === 'block' && !isSelectedForMulti) {
            itemClasses += ' selected';
        }
        if (isSelectedForMulti) itemClasses += ' multi-selected-item';
        return `
        <div class="${itemClasses}" onclick="handleWaypointListClick(${wp.id})">
            <div style="display: flex; align-items: center;">
                <input type="checkbox" class="waypoint-multi-select-cb" data-id="${wp.id}" 
                       onchange="toggleMultiSelectWaypoint(${wp.id}, this.checked)" 
                       ${isSelectedForMulti ? 'checked' : ''} 
                       style="margin-right: 10px; transform: scale(1.2);" 
                       onclick="event.stopPropagation();">
                <div>
                    <div class="waypoint-header"><span class="waypoint-name">Waypoint ${wp.id}</span></div>
                    <div class="waypoint-coords">Lat: ${wp.latlng.lat.toFixed(4)}, Lng: ${wp.latlng.lng.toFixed(4)}<br>Alt: ${wp.altitude}m${hoverText}</div>
                    ${actionInfo}
                </div>
            </div>
        </div>`;
    }).join('');
    if (waypoints.length === 0 && getSelectedForMultiEdit().size === 0) updateMultiEditPanelVisibility();
}

function getCameraActionText(action) {
    switch (action) {
        case 'photo': return 'Take Photo';
        case 'video_start': return 'Start Video';
        case 'video_stop': return 'Stop Video';
        case 'none': return '';
        default: return action;
    }
}

export function updatePOIList() {
    const noPoiAvailableText = 'No POIs available';
    if (getPois().length === 0) {
        poiListEl.innerHTML = '<div style="text-align: center; color: #95a5a6; font-size: 12px; padding: 10px;">No POIs added</div>';
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
    poiListEl.innerHTML = getPois().map(poi => `
        <div class="poi-item"><span class="poi-name">${poi.name} (ID: ${poi.id})</span><button class="poi-delete" onclick="deletePOI(${poi.id})">✕</button></div>`).join('');
}

export function updateFlightStatistics() {
    let totalDist = 0;
    const speed = parseFloat(flightSpeedSlider.value) || 1;
    const waypoints = getWaypoints();
    if (waypoints.length >= 2) {
        const pathLatLngs = (pathTypeSelect.value === 'curved' && flightPath) ? flightPath.getLatLngs() : waypoints.map(wp => wp.latlng);
        for (let i = 0; i < pathLatLngs.length - 1; i++) totalDist += haversineDistance(pathLatLngs[i], pathLatLngs[i + 1]);
    }
    let totalHover = waypoints.reduce((sum, wp) => sum + (wp.hoverTime || 0), 0);
    const flightDurationSec = (totalDist / (speed > 0 ? speed : 1)) + totalHover;
    const mins = Math.floor(flightDurationSec / 60), secs = Math.round(flightDurationSec % 60);
    totalDistanceEl.textContent = `${Math.round(totalDist)} m`;
    flightTimeEl.textContent = `${mins} min ${secs} sec`;
    waypointCountEl.textContent = waypoints.length;
    poiCountEl.textContent = getPois().length;
}

function haversineDistance(coords1, coords2) {
    function toRad(x) { return x * Math.PI / 180; }
    const lat1 = coords1.lat || coords1[0], lon1 = coords1.lng || coords1[1], lat2 = coords2.lat || coords2[0], lon2 = coords2.lng || coords2[1];
    const R = 6371e3, φ1 = toRad(lat1), φ2 = toRad(lat2), Δφ = toRad(lat2 - lat1), Δλ = toRad(lon2 - lon1);
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function showCustomAlert(message, title = 'Notification') {
    if (customAlertMessageEl && customAlertOverlayEl && customAlertTitleEl) {
        customAlertTitleEl.textContent = title;
        customAlertMessageEl.textContent = message;
        customAlertOverlayEl.style.display = 'flex';
    } else {
        console.error('Custom alert elements not found!');
        alert(message);
    }
}

export function updateMultiEditPanelVisibility() {
    const count = getSelectedForMultiEdit().size;
    if (count > 0) {
        multiWaypointEditControlsDiv.style.display = 'block';
        selectedWaypointsCountEl.textContent = count;
        if (waypointControlsDiv) waypointControlsDiv.style.display = 'none';
        if (multiHeadingControlSelect.value === 'poi_track') {
            populatePoiSelectDropdown(multiTargetPoiSelect, null, true, '-- Select POI for all --');
            multiTargetPoiForHeadingGroupDiv.style.display = 'block';
        } else {
            multiTargetPoiForHeadingGroupDiv.style.display = 'none';
        }
    } else {
        multiWaypointEditControlsDiv.style.display = 'none';
        if (getSelectedWaypoint() && waypointControlsDiv) {
            waypointControlsDiv.style.display = 'block';
        } else if (waypointControlsDiv) {
            waypointControlsDiv.style.display = 'none';
        }
    }
}

export function fitMapToWaypoints() {
    const waypoints = getWaypoints();
    const pois = getPois();
    if (waypoints.length > 0) getMap().fitBounds(L.latLngBounds(waypoints.map(wp => wp.latlng)).pad(0.1));
    else if (pois.length > 0) getMap().fitBounds(L.latLngBounds(pois.map(p => p.latlng)).pad(0.1));
    else getMap().setView([37.7749, -122.4194], 13);
}

export function handleWaypointListClick(waypointId) {
    const waypoint = getWaypoints().find(wp => wp.id === waypointId);
    if (waypoint) selectWaypoint(waypoint);
}
