// orbit.js
import { addWaypoint } from './waypoints.js';
import { getPois, populatePoiSelectDropdown } from './pois.js';
import { showCustomAlert, fitMapToWaypoints } from './ui.js';
import { getMap } from './map.js';

export function generateOrbitWaypoints(centerPoi, radius, numPoints, altitude) {
    const R_EARTH = 6371000;
    for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI;
        const latRad = centerPoi.latlng.lat * Math.PI / 180;
        const lngRad = centerPoi.latlng.lng * Math.PI / 180;
        const pointLatRad = Math.asin(Math.sin(latRad) * Math.cos(radius / R_EARTH) +
            Math.cos(latRad) * Math.sin(radius / R_EARTH) * Math.cos(angle));
        const pointLngRad = lngRad + Math.atan2(Math.sin(angle) * Math.sin(radius / R_EARTH) * Math.cos(latRad),
            Math.cos(radius / R_EARTH) - Math.sin(latRad) * Math.sin(pointLatRad));
        const pointLat = pointLatRad * 180 / Math.PI;
        const pointLng = pointLngRad * 180 / Math.PI;
        const wpLatlng = L.latLng(pointLat, pointLng);
        addWaypoint(wpLatlng);
        const newWp = getWaypoints()[getWaypoints().length - 1];
        newWp.altitude = altitude;
        newWp.headingControl = 'poi_track';
        newWp.targetPoiId = centerPoi.id;
        newWp.gimbalPitch = parseInt(document.getElementById('gimbalPitch').value) || 0;
        if (getSelectedWaypoint() && getSelectedWaypoint().id === newWp.id) {
            selectWaypoint(newWp);
        }
    }
    fitMapToWaypoints();
}

export function handleConfirmOrbit() {
    const orbitPoiSelectEl = document.getElementById('orbitPoiSelect');
    const orbitRadiusInputEl = document.getElementById('orbitRadiusInput');
    const orbitPointsInputEl = document.getElementById('orbitPointsInput');
    const orbitModalOverlayEl = document.getElementById('orbitModalOverlay');
    if (!orbitPoiSelectEl || !orbitRadiusInputEl || !orbitPointsInputEl) {
        console.error('Elementi della modale orbita non trovati!');
        showCustomAlert('Orbit modal elements are missing. Cannot create orbit.', 'Internal Error');
        return;
    }
    const targetPoiId = parseInt(orbitPoiSelectEl.value);
    const radius = parseFloat(orbitRadiusInputEl.value);
    const numPoints = parseInt(orbitPointsInputEl.value);
    const targetPoi = getPois().find(p => p.id === targetPoiId);
    if (!targetPoi) {
        showCustomAlert('Invalid POI selected for orbit. Please select a valid POI.', 'Orbit Error');
        return;
    }
    if (isNaN(radius) || radius <= 0) {
        showCustomAlert('Invalid radius. Must be a positive number.', 'Orbit Error');
        return;
    }
    if (isNaN(numPoints) || numPoints < 3) {
        showCustomAlert('Invalid number of points. Minimum 3 for orbit.', 'Orbit Error');
        return;
    }
    generateOrbitWaypoints(targetPoi, radius, numPoints, parseInt(document.getElementById('defaultAltitude').value));
    if (orbitModalOverlayEl) orbitModalOverlayEl.style.display = 'none';
}

export function showOrbitDialog() {
    const orbitModalOverlayEl = document.getElementById('orbitModalOverlay');
    const orbitPoiSelectEl = document.getElementById('orbitPoiSelect');
    if (!orbitModalOverlayEl || !orbitPoiSelectEl) {
        console.error('Orbit modal overlay or POI select element not found!');
        showCustomAlert('Orbit dialog cannot be displayed. Elements missing.', 'Internal Error');
        return;
    }
    if (getPois().length === 0) {
        showCustomAlert('Add at least one POI before creating an orbit.', 'Orbit Error');
        return;
    }
    populatePoiSelectDropdown(orbitPoiSelectEl, null, false);
    if (getPois().length > 0 && orbitPoiSelectEl.options.length > 0) {
        orbitPoiSelectEl.value = getPois()[0].id;
    } else {
        showCustomAlert('No POIs available to select for orbit.', 'Orbit Error');
        return;
    }
    document.getElementById('orbitRadiusInput').value = '30';
    document.getElementById('orbitPointsInput').value = '8';
    orbitModalOverlayEl.style.display = 'flex';
}