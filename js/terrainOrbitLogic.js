import { addWaypoint as addWp, selectWaypoint as selectWp, fitMapToWaypoints as fitMap } from './waypointPOILogic.js';
import { populatePoiSelectDropdownForUI } from './uiControls.js'; // Se showOrbitDialog la usa direttamente
import { showCustomAlert } from './utils.js';
import { _tr } from './i18n.js';

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
        const apiUrl = `${PROXY_URL}?url=${encodeURIComponent(targetUrl)}`;

        console.log(`Batch request (block ${Math.floor(i/batchSize) + 1}, size ${batch.length}) via proxy.`);
        
        try {
            const response = await fetch(apiUrl, { method: 'GET' });
            const responseText = await response.text();

            if (!response.ok) {
                console.error(`Batch API error (proxy): ${response.status}. Response: ${responseText.substring(0, 200)}...`);
                showCustomAlert(_tr("alertApiErrorBatch", response.status), _tr("alertError", "API Error"));
                currentBatchIndices.forEach(originalIdx => allElevationsData.push({originalIndex: originalIdx, elevation: null}));
                continue; 
            }

            const data = JSON.parse(responseText);
            if (data.status === "OK" && data.results) {
                data.results.forEach((result, indexInBatchResponse) => {
                    const originalIndex = currentBatchIndices[indexInBatchResponse]; 
                    allElevationsData.push({originalIndex: originalIndex, elevation: result.elevation !== null ? result.elevation : null});
                });
            } else {
                console.warn("Batch API response not OK or no results (proxy):", data);
                showCustomAlert(_tr("alertApiWarningBatchNoData", data.status), _tr("alertWarning"));
                currentBatchIndices.forEach(originalIdx => allElevationsData.push({originalIndex: originalIdx, elevation: null}));
            }
        } catch (error) {
            console.error("Exception in batch fetch/parsing (proxy):", error);
            showCustomAlert(_tr("alertFetchError"), _tr("alertError"));
            currentBatchIndices.forEach(originalIdx => allElevationsData.push({originalIndex: originalIdx, elevation: null}));
        }
        if (i + batchSize < locationsArray.length) {
            await new Promise(resolve => setTimeout(resolve, 1100)); 
        }
    }
    allElevationsData.sort((a,b) => a.originalIndex - b.originalIndex);
    return allElevationsData.map(item => item.elevation);
}

export async function getHomeElevationFromFirstWaypoint() {
    if (State.getWaypoints().length === 0) {
        showCustomAlert(_tr("alertNoWpForAGL", "Add at least one waypoint to estimate takeoff point elevation."), _tr("alertInfo"));
        return;
    }
    DOM.loadingOverlayEl.style.display = 'flex';

    // Fetch elevation for the first waypoint
    const wp = State.getWaypoints()[0];
    try {
        const targetUrl = `https://api.opentopodata.org/v1/srtm90m?locations=${wp.lat.toFixed(6)},${wp.lng.toFixed(6)}`;
        const apiUrl = `${PROXY_URL}?url=${encodeURIComponent(targetUrl)}`;

        const response = await fetch(apiUrl, { method: 'GET' });
        const data = await response.json();
        let elevation = null;
        if (data.status === "OK" && data.results && data.results.length > 0) {
            elevation = data.results[0].elevation;
            showCustomAlert(_tr("alertHomeElevationResult", elevation), _tr("alertSuccess"));
        } else {
            showCustomAlert(_tr("alertApiWarningBatchNoData", data.status), _tr("alertWarning"));
        }
        return elevation;
    } catch (error) {
        console.error("Error fetching home elevation:", error);
        showCustomAlert(_tr("alertFetchError"), _tr("alertError"));
        return null;
    } finally {
        DOM.loadingOverlayEl.style.display = 'none';
    }
}
