// File: terrainManager.js

// Depends on: config.js, utils.js, waypointManager.js (selectWaypoint, updateGimbalForPoiTrack),
// uiUpdater.js (updateWaypointList, updateSingleWaypointEditControls, updateFlightStatistics, updatePathModeDisplay)
// mapManager.js (per updateFlightPath)

async function getElevationsBatch(locationsArray) {
    if (!loadingOverlayEl) {
        console.warn("Loading overlay not available for elevation fetching status.");
    }
    const batchSize = 100; 
    let allElevationsData = []; 
    for (let i = 0; i < locationsArray.length; i += batchSize) {
        const batch = locationsArray.slice(i, i + batchSize);
        const currentBatchIndices = []; 
        const locationsString = batch.map((loc, indexInBatch) => {
            currentBatchIndices.push(i + indexInBatch); 
            return `${loc.lat.toFixed(6)},${loc.lng.toFixed(6)}`;
        }).join('|');
        const openTopoTargetUrl = `${OPENTOPODATA_API_BASE}?locations=${locationsString}&interpolation=cubic`;
        const proxyApiUrl = `${ELEVATION_API_PROXY_URL}?url=${encodeURIComponent(openTopoTargetUrl)}`;
        if (loadingOverlayEl) loadingOverlayEl.textContent = `Fetching terrain (batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(locationsArray.length/batchSize)})...`;
        try {
            const response = await fetch(proxyApiUrl, { method: 'GET' });
            const responseText = await response.text(); 
            if (!response.ok) {
                console.error(`Elevation API Error (via proxy): Status ${response.status}. Response: ${responseText.substring(0, 300)}...`);
                showCustomAlert(translate('alert_elevationApiError_batch', { batchNum: Math.floor(i/batchSize) + 1, status: response.status }), translate('apiErrorTitle'));
                currentBatchIndices.forEach(originalIdx => allElevationsData.push({ originalIndex: originalIdx, elevation: null }));
                continue; 
            }
            const data = JSON.parse(responseText);
            if (data.status === "OK" && data.results) {
                data.results.forEach((result, indexInBatchResponse) => {
                    const originalIndex = currentBatchIndices[indexInBatchResponse];
                    allElevationsData.push({
                        originalIndex: originalIndex,
                        elevation: result.elevation !== null ? parseFloat(result.elevation) : null
                    });
                });
            } else {
                console.warn("Elevation API response not OK or no results (via proxy):", data);
                showCustomAlert(translate('alert_elevationApiNoData_batch', { batchNum: Math.floor(i/batchSize) + 1, status: data.status }), translate('apiWarningTitle'));
                currentBatchIndices.forEach(originalIdx => allElevationsData.push({ originalIndex: originalIdx, elevation: null }));
            }
        } catch (error) {
            console.error("Exception during batch elevation fetch/parsing (via proxy):", error);
            showCustomAlert(translate('alert_elevationFetchError_batch', { batchNum: Math.floor(i/batchSize) + 1 }), translate('errorTitle'));
            currentBatchIndices.forEach(originalIdx => allElevationsData.push({ originalIndex: originalIdx, elevation: null }));
        }
        if (i + batchSize < locationsArray.length) {
            await new Promise(resolve => setTimeout(resolve, 1100)); 
        }
    }
    allElevationsData.sort((a, b) => a.originalIndex - b.originalIndex);
    return allElevationsData.map(item => item.elevation);
}

async function getHomeElevationFromFirstWaypoint() {
    if (waypoints.length === 0) {
        showCustomAlert(translate('alert_addWpForTakeoffElev'), translate('infoTitle')); 
        return;
    }
    if (!loadingOverlayEl || !homeElevationMslInput || !adaptToAGLBtnEl || !getHomeElevationBtn || !adaptToAMSLBtnEl) return;
    
    loadingOverlayEl.style.display = 'flex';
    loadingOverlayEl.textContent = translate('alert_fetchingWp1Elev'); 
    adaptToAGLBtnEl.disabled = true;
    adaptToAMSLBtnEl.disabled = true; 
    getHomeElevationBtn.disabled = true;

    const firstWp = waypoints[0];
    const elevations = await getElevationsBatch([{ lat: firstWp.latlng.lat, lng: firstWp.latlng.lng }]);

    loadingOverlayEl.style.display = 'none';
    adaptToAGLBtnEl.disabled = false;
    adaptToAMSLBtnEl.disabled = false;
    getHomeElevationBtn.disabled = false;

    if (elevations && elevations.length > 0 && elevations[0] !== null) {
        const roundedElev = Math.round(elevations[0]);
        homeElevationMslInput.value = roundedElev;
        showCustomAlert(translate('alert_takeoffElevFromWp1Set', { elev: roundedElev }), translate('successTitle')); 
        
        if (typeof updateDefaultDesiredAMSLTarget === "function") {
            updateDefaultDesiredAMSLTarget();
        }
        lastAltitudeAdaptationMode = 'relative'; 
        if(typeof updatePathModeDisplay === "function") updatePathModeDisplay();
        updateFlightPath();      
        
        waypoints.forEach(wp => {
            if (wp.headingControl === 'poi_track' && typeof updateGimbalForPoiTrack === "function") {
                updateGimbalForPoiTrack(wp, selectedWaypoint && selectedWaypoint.id === wp.id);
            }
        });
        updateWaypointList(); 
        if (selectedWaypoint) updateSingleWaypointEditControls(); 
    } else {
        showCustomAlert(translate('alert_takeoffElevFromWp1Fail'), translate('errorTitle')); 
    }
}

async function adaptAltitudesToAGL() {
    if (!desiredAGLInput || !homeElevationMslInput || !loadingOverlayEl || !adaptToAGLBtnEl || !getHomeElevationBtn || !adaptToAMSLBtnEl) return;
    const aglDesired = parseInt(desiredAGLInput.value);
    let homeElevationMSL = parseFloat(homeElevationMslInput.value);
    if (isNaN(aglDesired) || aglDesired < 1) { 
        showCustomAlert(translate('alert_invalidDesiredAGL'), translate('inputErrorTitle')); 
        return; 
    }
    if (isNaN(homeElevationMSL)) { 
        showCustomAlert(translate('alert_invalidTakeoffElev'), translate('inputErrorTitle'));
        return; 
    }
    if (waypoints.length === 0) { 
        showCustomAlert(translate('alert_noWaypointsToAdapt'), translate('infoTitle'));
        return; 
    }

    loadingOverlayEl.style.display = 'flex';
    loadingOverlayEl.textContent = translate('alert_fetchingTerrainForAllWp'); 
    adaptToAGLBtnEl.disabled = true;
    adaptToAMSLBtnEl.disabled = true;
    getHomeElevationBtn.disabled = true;

    const waypointCoords = waypoints.map(wp => ({ lat: wp.latlng.lat, lng: wp.latlng.lng }));
    const groundElevations = await getElevationsBatch(waypointCoords);
    let successCount = 0;
    if (groundElevations && groundElevations.length === waypoints.length) {
        waypoints.forEach((wp, index) => {
            const groundElevationAtWaypoint = groundElevations[index];
            if (loadingOverlayEl) loadingOverlayEl.textContent = translate('alert_adaptingAglAlts_wp', {wpId: wp.id, current: index + 1, total: waypoints.length});
            if (groundElevationAtWaypoint !== null) {
                wp.terrainElevationMSL = parseFloat(groundElevationAtWaypoint.toFixed(1)); 
                const targetMSLForWaypoint = groundElevationAtWaypoint + aglDesired;
                const newRelativeAltitude = targetMSLForWaypoint - homeElevationMSL;
                wp.altitude = Math.max(1, Math.round(newRelativeAltitude)); 
                successCount++;
            } else {
                wp.terrainElevationMSL = null; 
                console.warn(`Could not get ground elevation for waypoint ${wp.id}. Its altitude was not changed.`);
            }
        });
    } else { 
        console.error("Errore nel recupero delle elevazioni del terreno o discrepanza di lunghezza.");
    }

    lastAltitudeAdaptationMode = 'agl'; 
    if(typeof updatePathModeDisplay === "function") updatePathModeDisplay();
    updateFlightPath(); 

    waypoints.forEach(wp => {
        if (wp.headingControl === 'poi_track' && wp.targetPoiId !== null) {
            if (typeof updateGimbalForPoiTrack === "function") {
                updateGimbalForPoiTrack(wp, (selectedWaypoint && selectedWaypoint.id === wp.id));
            }
        }
    });
    updateWaypointList();
    if (selectedWaypoint) { 
        const currentSelectedWp = waypoints.find(wp => wp.id === selectedWaypoint.id);
        if (currentSelectedWp) selectWaypoint(currentSelectedWp);
    }
    updateFlightStatistics(); 
    loadingOverlayEl.style.display = 'none';
    adaptToAGLBtnEl.disabled = false;
    adaptToAMSLBtnEl.disabled = false;
    getHomeElevationBtn.disabled = false;
    if (successCount === waypoints.length && waypoints.length > 0) { 
        showCustomAlert(translate('alert_adaptAglSuccess'), translate('successTitle'));
    } else if (successCount > 0) {
         showCustomAlert(translate('alert_adaptAglPartial', {count: successCount, total: waypoints.length }), translate('partialSuccessTitle'));
    } else if (waypoints.length > 0) {
         showCustomAlert(translate('alert_adaptAglFail'), translate('errorTitle'));
    }
}

async function adaptAltitudesToAMSL() {
    if (!desiredAMSLInputEl || !homeElevationMslInput || !loadingOverlayEl || !adaptToAMSLBtnEl || !adaptToAGLBtnEl || !getHomeElevationBtn) return;

    const amslTarget = parseFloat(desiredAMSLInputEl.value);
    let homeElevationMSL = parseFloat(homeElevationMslInput.value);

    if (isNaN(amslTarget)) {
        showCustomAlert(translate('alert_invalidDesiredAMSL'), translate('inputErrorTitle'));
        return;
    }
    if (isNaN(homeElevationMSL)) {
        showCustomAlert(translate('alert_invalidTakeoffElev'), translate('inputErrorTitle'));
        return;
    }
    if (waypoints.length === 0) {
        showCustomAlert(translate('alert_noWaypointsToAdapt'), translate('infoTitle'));
        return;
    }

    loadingOverlayEl.style.display = 'flex';
    loadingOverlayEl.textContent = translate('alert_adaptingAmslAlts');
    adaptToAGLBtnEl.disabled = true; 
    adaptToAMSLBtnEl.disabled = true;
    getHomeElevationBtn.disabled = true;

    const waypointCoordsForTerrain = waypoints.map(wp => ({ lat: wp.latlng.lat, lng: wp.latlng.lng }));
    const groundElevations = await getElevationsBatch(waypointCoordsForTerrain);

    waypoints.forEach((wp, index) => {
        const newRelativeAltitude = amslTarget - homeElevationMSL;
        wp.altitude = Math.round(newRelativeAltitude); 

        if (groundElevations && index < groundElevations.length && groundElevations[index] !== null) {
            wp.terrainElevationMSL = parseFloat(groundElevations[index].toFixed(1));
        }
        
        if (wp.terrainElevationMSL !== null) {
            const currentWpAMSL = homeElevationMSL + wp.altitude; 
            const currentAGL = currentWpAMSL - wp.terrainElevationMSL;
            if (currentAGL < 5) { 
                console.warn(`Waypoint ${wp.id}: AGL risultante (${currentAGL.toFixed(1)}m) è inferiore al minimo di sicurezza (5m) dopo adattamento AMSL.`);
            }
        }
    });

    lastAltitudeAdaptationMode = 'amsl'; 
    if(typeof updatePathModeDisplay === "function") updatePathModeDisplay();
    updateFlightPath(); 

    waypoints.forEach(wp => {
        if (wp.headingControl === 'poi_track' && wp.targetPoiId !== null) {
            if (typeof updateGimbalForPoiTrack === "function") {
                updateGimbalForPoiTrack(wp, (selectedWaypoint && selectedWaypoint.id === wp.id));
            }
        }
    });

    updateWaypointList();
    if (selectedWaypoint) {
        const currentSelectedWp = waypoints.find(wp => wp.id === selectedWaypoint.id);
        if (currentSelectedWp) selectWaypoint(currentSelectedWp);
    }
    updateFlightStatistics();

    loadingOverlayEl.style.display = 'none';
    adaptToAGLBtnEl.disabled = false;
    adaptToAMSLBtnEl.disabled = false;
    getHomeElevationBtn.disabled = false;

    showCustomAlert(translate('alert_adaptAmslSuccess', {amslTarget: amslTarget.toFixed(1)}), translate('successTitle'));
}
