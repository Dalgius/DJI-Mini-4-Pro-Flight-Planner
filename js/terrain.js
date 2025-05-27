// terrain.js
import { getWaypoints, selectWaypoint } from './waypoints.js';
import { updateWaypointList, updateFlightStatistics, showCustomAlert } from './ui.js';

export async function getElevationsBatch(locationsArray) {
    const batchSize = 100;
    let allElevationsData = [];
    for (let i = 0; i < locationsArray.length; i += batchSize) {
        const batch = locationsArray.slice(i, i + batchSize);
        const currentBatchIndices = [];
        const locationsString = batch.map((loc, indexInBatch) => {
            currentBatchIndices.push(i + indexInBatch);
            return `${loc.lat.toFixed(6)},${loc.lng.toFixed(6)}`;
        }).join('|');
        const targetUrl = `https://api.opentopodata.org/v1/srtm90m?locations=${locationsString}&interpolation=cubic`;
        const proxyBaseUrl = '/.netlify/functions/elevation-proxy';
        const apiUrl = `${proxyBaseUrl}?url=${encodeURIComponent(targetUrl)}`;
        console.log(`Richiesta batch via Netlify Function a: ${targetUrl}`);
        try {
            const response = await fetch(apiUrl, { method: 'GET' });
            const responseText = await response.text();
            if (!response.ok) {
                console.error(`Batch API error (proxy): ${response.status}. Response: ${responseText.substring(0, 200)}...`);
                showCustomAlert(`Elevation API Error (Batch): ${response.status}`, 'API Error');
                currentBatchIndices.forEach(originalIdx => allElevationsData.push({ originalIndex: originalIdx, elevation: null }));
                continue;
            }
            const data = JSON.parse(responseText);
            if (data.status === 'OK' && data.results) {
                data.results.forEach((result, indexInBatchResponse) => {
                    const originalIndex = currentBatchIndices[indexInBatchResponse];
                    allElevationsData.push({ originalIndex: originalIndex, elevation: result.elevation !== null ? result.elevation : null });
                });
            } else {
                console.warn('Batch API response not OK or no results (proxy):', data);
                showCustomAlert(`Elevation API returned no valid data for a batch. Status: ${data.status}`, 'API Warning');
                currentBatchIndices.forEach(originalIdx => allElevationsData.push({ originalIndex: originalIdx, elevation: null }));
            }
        } catch (error) {
            console.error('Exception in batch fetch/parsing (proxy):', error);
            showCustomAlert('Connection or parsing error during batch elevation request. Check console.', 'Error');
            currentBatchIndices.forEach(originalIdx => allElevationsData.push({ originalIndex: originalIdx, elevation: null }));
        }
        if (i + batchSize < locationsArray.length) {
            await new Promise(resolve => setTimeout(resolve, 1100));
        }
    }
    allElevationsData.sort((a, b) => a.originalIndex - b.originalIndex);
    return allElevationsData.map(item => item.elevation);
}

export async function getHomeElevationFromFirstWaypoint() {
    const waypoints = getWaypoints();
    if (waypoints.length === 0) {
        showCustomAlert('Add at least one waypoint to estimate takeoff point elevation.', 'Info');
        return;
    }
    document.getElementById('loadingOverlay').style.display = 'flex';
    document.getElementById('loadingOverlay').textContent = 'Fetching WP1 Elevation...';
    if (document.getElementById('adaptToAGLBtn')) document.getElementById('adaptToAGLBtn').disabled = true;
    const homeButton = document.getElementById('getHomeElevationBtn');
    if (homeButton) homeButton.disabled = true;
    const firstWp = waypoints[0];
    const elevations = await getElevationsBatch([{ lat: firstWp.latlng.lat, lng: firstWp.latlng.lng }]);
    document.getElementById('loadingOverlay').style.display = 'none';
    if (document.getElementById('adaptToAGLBtn')) document.getElementById('adaptToAGLBtn').disabled = false;
    if (homeButton) homeButton.disabled = false;
    if (elevations && elevations.length > 0 && elevations[0] !== null) {
        document.getElementById('homeElevationMsl').value = Math.round(elevations[0]);
        showCustomAlert(`Waypoint 1 elevation (${Math.round(elevations[0])}m MSL) set as takeoff elevation.`, 'Success');
    } else {
        showCustomAlert('Could not retrieve elevation for Waypoint 1.', 'Error');
    }
}

export async function adaptAltitudesToAGL() {
    const aglDesired = parseInt(document.getElementById('desiredAGL').value);
    let homeElevationMSL = parseFloat(document.getElementById('homeElevationMsl').value);
    if (isNaN(aglDesired) || aglDesired < 5) {
        showCustomAlert('Invalid desired AGL (min 5m).', 'Input Error');
        return;
    }
    if (isNaN(homeElevationMSL)) {
        showCustomAlert('Invalid Takeoff Point Elevation (MSL). Try "Use WP1 Elev." or enter manually.', 'Input Error');
        return;
    }
    const waypoints = getWaypoints();
    if (waypoints.length === 0) {
        showCustomAlert('No waypoints to adapt altitudes for.', 'Info');
        return;
    }
    document.getElementById('loadingOverlay').style.display = 'flex';
    document.getElementById('loadingOverlay').textContent = 'Requesting terrain elevations...';
    if (document.getElementById('adaptToAGLBtn')) document.getElementById('adaptToAGLBtn').disabled = true;
    const homeButton = document.getElementById('getHomeElevationBtn');
    if (homeButton) homeButton.disabled = true;
    const waypointCoords = waypoints.map(wp => ({ lat: wp.latlng.lat, lng: wp.latlng.lng }));
    const groundElevations = await getElevationsBatch(waypointCoords);
    let successCount = 0;
    if (groundElevations && groundElevations.length === waypoints.length) {
        waypoints.forEach((wp, index) => {
            const groundElevation = groundElevations[index];
            document.getElementById('loadingOverlay').textContent = `Adapting AGL Altitudes... (WP ${index + 1}/${waypoints.length})`;
            if (groundElevation !== null) {
                const newExecuteHeight = (groundElevation + aglDesired) - homeElevationMSL;
                wp.altitude = Math.max(5, Math.round(newExecuteHeight));
                successCount++;
            } else {
                console.warn(`Could not get elevation for waypoint ${wp.id}. Altitude not changed.`);
            }
        });
    } else {
        console.error('Error fetching elevations in batch or length mismatch.');
    }
    updateWaypointList();
    if (getSelectedWaypoint()) {
        const currentSelected = waypoints.find(wp => wp.id === getSelectedWaypoint().id);
        if (currentSelected) selectWaypoint(currentSelected);
        else if (waypoints.length > 0) selectWaypoint(waypoints[0]);
        else if (document.getElementById('waypointControls')) document.getElementById('waypointControls').style.display = 'none';
    }
    updateFlightStatistics();
    document.getElementById('loadingOverlay').style.display = 'none';
    if (document.getElementById('adaptToAGLBtn')) document.getElementById('adaptToAGLBtn').disabled = false;
    if (homeButton) homeButton.disabled = false;
    if (successCount === waypoints.length && waypoints.length > 0) {
        showCustomAlert('AGL altitude adaptation completed for all waypoints!', 'Success');
    } else if (successCount > 0) {
        showCustomAlert(`AGL altitude adaptation completed for ${successCount} out of ${waypoints.length} waypoints. Check console for errors.`, 'Partial Success');
    } else if (waypoints.length > 0) {
        showCustomAlert('AGL altitude adaptation failed for all waypoints. Check console for details.', 'Error');
    }
}