// terrain.js
import { getWaypoints, getSelectedWaypoint } from './waypoints.js';
import { showCustomAlert } from './ui.js';

async function getBatchElevations(locations) {
    const locationString = locations.map(loc => `${loc.lat},${loc.lng}`).join('|');
    const url = `https://api.opentopodata.org/v1/srtm90m?locations=${locationString}&interpolation=cubic`;
    console.log(`Richiesta batch via Netlify Function a: ${url}`);
    try {
        const response = await fetch('/.netlify/functions/fetch-elevation', {
            method: 'POST',
            body: JSON.stringify({ url })
        });
        const data = await response.json();
        if (data.status === 'OK') {
            return data.results.map(result => result.elevation);
        } else {
            throw new Error(data.error || 'Failed to fetch elevations');
        }
    } catch (error) {
        console.error('Error fetching elevations:', error);
        showCustomAlert('Failed to fetch terrain elevations.', 'Error');
        return null;
    }
}

export async function getHomeElevationFromFirstWaypoint() {
    const firstWaypoint = getSelectedWaypoint();
    if (!firstWaypoint) {
        showCustomAlert('No waypoint selected to determine home elevation.', 'Info');
        return null;
    }
    const elevations = await getBatchElevations([{ lat: firstWaypoint.latlng.lat, lng: firstWaypoint.latlng.lng }]);
    if (elevations && elevations.length > 0) {
        const elevation = Math.round(elevations[0]);
        document.getElementById('homeElevationMsl').value = elevation;
        showCustomAlert(`Home elevation set to ${elevation}m MSL.`, 'Success');
        return elevation;
    }
    return null;
}

export async function adaptAltitudesToAGL() {
    const waypoints = getWaypoints();
    if (waypoints.length === 0) {
        showCustomAlert('No waypoints to adapt.', 'Info');
        return;
    }

    const firstWaypoint = getSelectedWaypoint();
    if (!firstWaypoint) {
        showCustomAlert('No waypoint selected to determine home elevation.', 'Info');
        return;
    }

    const homeElevation = parseFloat(document.getElementById('homeElevationMsl').value);
    const desiredAGL = parseFloat(document.getElementById('desiredAGL').value);

    if (isNaN(homeElevation) || isNaN(desiredAGL)) {
        showCustomAlert('Please set valid home elevation and desired AGL.', 'Error');
        return;
    }

    const locations = waypoints.map(wp => ({ lat: wp.latlng.lat, lng: wp.latlng.lng }));
    const elevations = await getBatchElevations(locations);

    if (elevations && elevations.length === waypoints.length) {
        waypoints.forEach((wp, index) => {
            const terrainElevation = elevations[index];
            wp.altitude = Math.round(terrainElevation + desiredAGL);
        });
        showCustomAlert('Waypoint altitudes adapted to AGL successfully.', 'Success');
    } else {
        showCustomAlert('Failed to adapt altitudes due to elevation data error.', 'Error');
    }
}
