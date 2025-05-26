// js/terrainOrbitLogic.js
import * as DOM from './domElements.js';
import * as State from './state.js';
import { dispatchStateChangeEvent } from './state.js'; // Import the dispatcher
import { PROXY_URL } from './config.js';
// Importa le funzioni necessarie da waypointPOILogic (assumendo che addWaypoint, selectWaypoint, fitMapToWaypoints siano esportate da lì)
import { addWaypoint as addWp, selectWaypoint as selectWp, fitMapToWaypoints as fitMap } from './waypointPOILogic.js';
// populatePoiSelectDropdownForUI from uiControls is okay here if it's for populating a dialog *within* this module's logic,
// not for general UI updates that should be event-driven.
import { populatePoiSelectDropdownForUI } from './uiControls.js';
import { showCustomAlert, _tr } from './utils.js';


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
    DOM.loadingOverlayEl.textContent = _tr("loadingWP1ElevText");
    if (DOM.adaptToAGLBtnEl) DOM.adaptToAGLBtnEl.disabled = true; 
    const homeButton = DOM.getHomeElevationBtn;
    if(homeButton) homeButton.disabled = true;

    const firstWp = State.getWaypoints()[0];
    const elevations = await getElevationsBatch([{ lat: firstWp.latlng.lat, lng: firstWp.latlng.lng }]);
    
    DOM.loadingOverlayEl.style.display = 'none';
    if (DOM.adaptToAGLBtnEl) DOM.adaptToAGLBtnEl.disabled = false;
    if(homeButton) homeButton.disabled = false;

    if (elevations && elevations.length > 0 && elevations[0] !== null) {
        DOM.homeElevationMslInput.value = Math.round(elevations[0]);
        showCustomAlert(_tr("alertHomeElevSuccess", Math.round(elevations[0])), _tr("alertSuccess"));
    } else {
         showCustomAlert(_tr("alertHomeElevFail"), _tr("alertError"));
    }
}

export async function adaptAltitudesToAGL() {
    const aglDesired = parseInt(DOM.desiredAGLInput.value);
    let homeElevationMSL = parseFloat(DOM.homeElevationMslInput.value);

    if (isNaN(aglDesired) || aglDesired < 5) {
        showCustomAlert(_tr("alertInvalidAGL"), _tr("alertInputError"));
        return;
    }
    if (isNaN(homeElevationMSL)) {
         showCustomAlert(_tr("alertInvalidHomeElev"), _tr("alertInputError"));
        return;
    }
    if (State.getWaypoints().length === 0) {
        showCustomAlert(_tr("alertNoWpForAGL"), _tr("alertInfo"));
        return;
    }

    DOM.loadingOverlayEl.style.display = 'flex';
    DOM.loadingOverlayEl.textContent = _tr("loadingAGLText");
    if (DOM.adaptToAGLBtnEl) DOM.adaptToAGLBtnEl.disabled = true;
    const homeButton = DOM.getHomeElevationBtn;
    if(homeButton) homeButton.disabled = true;

    const waypointCoords = State.getWaypoints().map(wp => ({ lat: wp.latlng.lat, lng: wp.latlng.lng }));
    const groundElevations = await getElevationsBatch(waypointCoords);
    const waypoints = State.getWaypoints(); // Get a reference to the array

    let successCount = 0;
    if (groundElevations && groundElevations.length === waypoints.length) {
        waypoints.forEach((wp, index) => { // Modify the array obtained from State
            const groundElevation = groundElevations[index];
            DOM.loadingOverlayEl.textContent = `${_tr("loadingAGLText")} (WP ${index+1}/${waypoints.length})`;
            if (groundElevation !== null) {
                const newExecuteHeight = (groundElevation + aglDesired) - homeElevationMSL;
                wp.altitude = Math.max(5, Math.round(newExecuteHeight));
                successCount++;
            } else {
                console.warn(`Could not get elevation for waypoint ${wp.id}. Altitude not changed.`);
            }
        });
        // After all modifications, call setWaypoints to trigger a single state change event
        State.setWaypoints(waypoints); 
        // Note: If individual properties being updated need to trigger events for finer-grained UI updates,
        // then state.js would need functions like `updateWaypointAltitude(id, newAltitude)` which dispatch events.
        // For now, this batch update is simpler.
    } else {
        console.error("Error fetching elevations in batch or length mismatch.");
    }

    // REMOVED DYNAMIC IMPORTS AND DIRECT CALLS:
    // import('./uiControls.js').then(ui => ui.updateWaypointListDisplay()); 
    // import('./uiControls.js').then(ui => ui.updateFlightStatisticsDisplay()); 

    // The selection logic should ideally be handled by UI reacting to waypointsModified or a specific AGL completion event.
    // For now, if a waypoint was selected, re-selecting it (if it still exists) will trigger its own state events.
    const currentSelectedId = State.getSelectedWaypoint() ? State.getSelectedWaypoint().id : null;
    if (currentSelectedId) {
        const currentSelected = waypoints.find(wp => wp.id === currentSelectedId);
        if (currentSelected) {
            selectWp(currentSelected); // selectWp uses State.setSelectedWaypoint, which dispatches an event
        } else if (waypoints.length > 0) {
            selectWp(waypoints[0]);
        } else if (DOM.waypointControlsDiv) {
            DOM.waypointControlsDiv.style.display = 'none'; // This is a direct DOM manipulation, ideally also event-driven
        }
    } else if (waypoints.length > 0) {
        // If nothing was selected but now we have waypoints, maybe select the first one.
        // This could also be a reaction in uiControls to waypointsModified when no waypoint is selected.
        selectWp(waypoints[0]);
    } else if (DOM.waypointControlsDiv) {
        DOM.waypointControlsDiv.style.display = 'none'; // Direct DOM manipulation
    }
    
    // Dispatch a custom event for AGL adaptation completion, if specific UI reactions are needed beyond list/stats refresh
    dispatchStateChangeEvent({ aglAdaptationCompleted: true, successCount: successCount, totalWaypoints: waypoints.length });

    DOM.loadingOverlayEl.style.display = 'none';
    if (DOM.adaptToAGLBtnEl) DOM.adaptToAGLBtnEl.disabled = false;
    if(homeButton) homeButton.disabled = false;

    if (successCount === State.getWaypoints().length && State.getWaypoints().length > 0) {
        showCustomAlert(_tr("alertAglAdaptSuccess"), _tr("alertSuccess"));
    } else if (successCount > 0) {
         showCustomAlert(_tr("alertAglAdaptPartial", [successCount, State.getWaypoints().length]), _tr("alertWarning"));
    } else if (State.getWaypoints().length > 0) { 
         showCustomAlert(_tr("alertAglAdaptFail"), _tr("alertError"));
    }
}

export function showOrbitDialog() { 
    if (!DOM.orbitModalOverlayEl || !DOM.orbitPoiSelectEl) {
        console.error("Orbit modal overlay or POI select element not found!");
        showCustomAlert("Orbit dialog cannot be displayed. Elements missing.", "Internal Error");
        return;
    }
    if (State.getPois().length === 0) { 
        showCustomAlert(_tr("alertNoPoiForOrbit"), _tr("alertError", "Orbit Error")); 
        return; 
    }
    
    populatePoiSelectDropdownForUI(DOM.orbitPoiSelectEl, null, false); 
    if (State.getPois().length > 0 && DOM.orbitPoiSelectEl.options.length > 0) { 
        DOM.orbitPoiSelectEl.value = State.getPois()[0].id; 
    } else if (State.getPois().length === 0) { 
         showCustomAlert(_tr("noPoisAvailableDropdown"), _tr("alertError", "Orbit Error"));
         return;
    }

    if (DOM.orbitRadiusInputEl) DOM.orbitRadiusInputEl.value = "30"; 
    if (DOM.orbitPointsInputEl) DOM.orbitPointsInputEl.value = "8";  
    DOM.orbitModalOverlayEl.style.display = 'flex';
}

export function handleConfirmOrbit() {
    if (!DOM.orbitPoiSelectEl || !DOM.orbitRadiusInputEl || !DOM.orbitPointsInputEl) {
        console.error("Elementi della modale orbita non trovati!");
        showCustomAlert("Orbit modal elements are missing. Cannot create orbit.", "Internal Error");
        return;
    }

    const targetPoiId = parseInt(DOM.orbitPoiSelectEl.value);
    const radius = parseFloat(DOM.orbitRadiusInputEl.value);
    const numPoints = parseInt(DOM.orbitPointsInputEl.value);
    const targetPoi = State.getPois().find(p => p.id === targetPoiId);

    if (!targetPoi) { 
        showCustomAlert(_tr("alertInvalidPoiId"), _tr("alertError", "Orbit Error")); 
        return; 
    }
    if (isNaN(radius) || radius <= 0) { 
        showCustomAlert(_tr("alertOrbitInvalidRadius"), _tr("alertError", "Orbit Error")); 
        return; 
    }
    if (isNaN(numPoints) || numPoints < 3) { 
        showCustomAlert(_tr("alertOrbitInvalidPoints"), _tr("alertError", "Orbit Error")); 
        return; 
    }

    generateOrbitWaypointsLogic(targetPoi, radius, numPoints, parseInt(DOM.defaultAltitudeSlider.value));
    if (DOM.orbitModalOverlayEl) DOM.orbitModalOverlayEl.style.display = 'none';
}

function generateOrbitWaypointsLogic(centerPoi, radius, numPoints, altitude) {
    const R_EARTH = 6371000; 
    for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI; 
        const latRad = centerPoi.latlng.lat * Math.PI / 180;
        const lngRad = centerPoi.latlng.lng * Math.PI / 180;
        const pointLatRad = Math.asin(Math.sin(latRad)*Math.cos(radius/R_EARTH) + 
                                    Math.cos(latRad)*Math.sin(radius/R_EARTH)*Math.cos(angle));
        const pointLngRad = lngRad + Math.atan2(Math.sin(angle)*Math.sin(radius/R_EARTH)*Math.cos(latRad), 
                                             Math.cos(radius/R_EARTH)-Math.sin(latRad)*Math.sin(pointLatRad));
        const pointLat = pointLatRad * 180 / Math.PI;
        const pointLng = pointLngRad * 180 / Math.PI;
        const wpLatlng = L.latLng(pointLat, pointLng);
        
        addWp(wpLatlng); // Usa la funzione importata (addWaypoint da waypointPOILogic)
        const newWp = State.getWaypoints()[State.getWaypoints().length-1];
        newWp.altitude = altitude;
        newWp.headingControl = 'poi_track'; 
        newWp.targetPoiId = centerPoi.id; 
        newWp.gimbalPitch = parseInt(DOM.gimbalPitchSlider.value) || 0; 
        
        if (State.getSelectedWaypoint() && State.getSelectedWaypoint().id === newWp.id) {
             selectWp(newWp); // Usa la funzione importata
        }
    }
    fitMap(); // Usa la funzione importata
}