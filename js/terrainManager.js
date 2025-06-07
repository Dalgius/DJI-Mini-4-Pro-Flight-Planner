// File: terrainManager.js

// Depends on: config.js, utils.js, waypointManager.js (selectWaypoint, updateGimbalForPoiTrack),
// uiUpdater.js (updateWaypointList, updateSingleWaypointEditControls, updateFlightStatistics)

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
                showCustomAlert(`Elevation API Error (Batch ${Math.floor(i/batchSize) + 1}): ${response.status}. Check console.`, "API Error");
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
                showCustomAlert(`Elevation API returned no valid data for batch ${Math.floor(i/batchSize) + 1}. Status: ${data.status}`, "API Warning");
                currentBatchIndices.forEach(originalIdx => allElevationsData.push({ originalIndex: originalIdx, elevation: null }));
            }
        } catch (error) {
            console.error("Exception during batch elevation fetch/parsing (via proxy):", error);
            showCustomAlert(`Connection or parsing error during batch elevation request for batch ${Math.floor(i/batchSize) + 1}. Check console.`, "Error");
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
        showCustomAlert("Aggiungi almeno un waypoint per stimare l'elevazione del punto di decollo.", "Info"); 
        return;
    }
    if (!loadingOverlayEl || !homeElevationMslInput || !adaptToAGLBtnEl || !getHomeElevationBtn) return;
    loadingOverlayEl.style.display = 'flex';
    loadingOverlayEl.textContent = "Recupero elevazione WP1..."; 
    if(adaptToAGLBtnEl) adaptToAGLBtnEl.disabled = true;
    if(adaptToAMSLBtnEl) adaptToAMSLBtnEl.disabled = true; // Disabilita anche il nuovo pulsante
    getHomeElevationBtn.disabled = true;

    const firstWp = waypoints[0];
    const elevations = await getElevationsBatch([{ lat: firstWp.latlng.lat, lng: firstWp.latlng.lng }]);

    loadingOverlayEl.style.display = 'none';
    if(adaptToAGLBtnEl) adaptToAGLBtnEl.disabled = false;
    if(adaptToAMSLBtnEl) adaptToAMSLBtnEl.disabled = false;
    getHomeElevationBtn.disabled = false;

    if (elevations && elevations.length > 0 && elevations[0] !== null) {
        homeElevationMslInput.value = Math.round(elevations[0]);
        showCustomAlert(`Elevazione del terreno di Waypoint 1 (${Math.round(elevations[0])}m MSL) impostata come elevazione di decollo.`, "Successo"); 
        updateWaypointList(); 
        waypoints.forEach(wp => {
            if (wp.headingControl === 'poi_track' && typeof updateGimbalForPoiTrack === "function") {
                updateGimbalForPoiTrack(wp, selectedWaypoint && selectedWaypoint.id === wp.id);
            }
        });
         if (selectedWaypoint) updateSingleWaypointEditControls(); 
    } else {
        showCustomAlert("Impossibile recuperare l'elevazione del terreno per Waypoint 1.", "Errore"); 
    }
}

async function adaptAltitudesToAGL() {
    if (!desiredAGLInput || !homeElevationMslInput || !loadingOverlayEl || !adaptToAGLBtnEl || !getHomeElevationBtn) return;
    const aglDesired = parseInt(desiredAGLInput.value);
    let homeElevationMSL = parseFloat(homeElevationMslInput.value);
    if (isNaN(aglDesired) || aglDesired < 1) { /* ... alert ... */ return; }
    if (isNaN(homeElevationMSL)) { /* ... alert ... */ return; }
    if (waypoints.length === 0) { /* ... alert ... */ return; }

    loadingOverlayEl.style.display = 'flex';
    loadingOverlayEl.textContent = "Richiesta elevazioni terreno per tutti i waypoint..."; 
    adaptToAGLBtnEl.disabled = true;
    if(adaptToAMSLBtnEl) adaptToAMSLBtnEl.disabled = true;
    getHomeElevationBtn.disabled = true;

    const waypointCoords = waypoints.map(wp => ({ lat: wp.latlng.lat, lng: wp.latlng.lng }));
    const groundElevations = await getElevationsBatch(waypointCoords);
    let successCount = 0;
    if (groundElevations && groundElevations.length === waypoints.length) {
        waypoints.forEach((wp, index) => {
            const groundElevationAtWaypoint = groundElevations[index];
            if (loadingOverlayEl) loadingOverlayEl.textContent = `Adattamento altitudini AGL... (WP ${wp.id} - ${index + 1}/${waypoints.length})`;
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
    } else { /* ... errore ... */ }

    console.log("ADAPT_AGL: Tentativo di ricalcolo gimbal per tutti i waypoint POI_TRACK dopo adattamento AGL...");
    waypoints.forEach(wp => {
        if (wp.headingControl === 'poi_track' && wp.targetPoiId !== null) {
            if (typeof updateGimbalForPoiTrack === "function") {
                updateGimbalForPoiTrack(wp, (selectedWaypoint && selectedWaypoint.id === wp.id));
            }
        }
    });
    updateWaypointList();
    if (selectedWaypoint) { /* ... aggiorna UI waypoint selezionato ... */ }
    updateFlightStatistics(); 
    loadingOverlayEl.style.display = 'none';
    adaptToAGLBtnEl.disabled = false;
    if(adaptToAMSLBtnEl) adaptToAMSLBtnEl.disabled = false;
    getHomeElevationBtn.disabled = false;
    if (successCount === waypoints.length && waypoints.length > 0) { /* ... alert successo ... */ }
    // ... (altri alert) ...
}

/**
 * Adapts all waypoint altitudes to achieve a constant AMSL (Above Mean Sea Level).
 * Requires homeElevationMslInput to be set correctly.
 */
async function adaptAltitudesToAMSL() {
    if (!desiredAMSLInputEl || !homeElevationMslInput || !loadingOverlayEl || !adaptToAMSLBtnEl) return;

    const amslTarget = parseFloat(desiredAMSLInputEl.value);
    let homeElevationMSL = parseFloat(homeElevationMslInput.value);

    if (isNaN(amslTarget)) {
        showCustomAlert("AMSL target non valido. Inserisci un numero.", "Errore Input");
        return;
    }
    if (isNaN(homeElevationMSL)) {
        showCustomAlert("Elevazione del punto decollo (MSL) non valida.", "Errore Input");
        return;
    }
    if (waypoints.length === 0) {
        showCustomAlert("Nessun waypoint per cui adattare le altitudini.", "Info");
        return;
    }

    loadingOverlayEl.style.display = 'flex';
    loadingOverlayEl.textContent = "Adattamento altitudini a AMSL costante...";
    if(adaptToAGLBtnEl) adaptToAGLBtnEl.disabled = true; 
    adaptToAMSLBtnEl.disabled = true;
    if(getHomeElevationBtn) getHomeElevationBtn.disabled = true;


    const waypointCoordsForTerrain = waypoints.map(wp => ({ lat: wp.latlng.lat, lng: wp.latlng.lng }));
    const groundElevations = await getElevationsBatch(waypointCoordsForTerrain);

    waypoints.forEach((wp, index) => {
        const newRelativeAltitude = amslTarget - homeElevationMSL;
        wp.altitude = Math.round(newRelativeAltitude); 

        if (groundElevations && groundElevations[index] !== null) {
            wp.terrainElevationMSL = parseFloat(groundElevations[index].toFixed(1));
        }
        
        if (wp.terrainElevationMSL !== null) {
            const currentWpAMSL = homeElevationMSL + wp.altitude; // Dovrebbe essere == amslTarget
            const currentAGL = currentWpAMSL - wp.terrainElevationMSL;
            if (currentAGL < 5) { 
                console.warn(`Waypoint ${wp.id}: AGL risultante (${currentAGL.toFixed(1)}m) è inferiore al minimo di sicurezza (5m) dopo adattamento AMSL.`);
                // Potresti voler aggiungere un alert più visibile all'utente qui.
            }
        }
    });

    console.log("ADAPT_AMSL: Tentativo di ricalcolo gimbal per tutti i waypoint POI_TRACK dopo adattamento AMSL...");
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
    if(adaptToAGLBtnEl) adaptToAGLBtnEl.disabled = false;
    adaptToAMSLBtnEl.disabled = false;
    if(getHomeElevationBtn) getHomeElevationBtn.disabled = false;

    showCustomAlert(`Altitudini dei waypoint adattate a ${amslTarget.toFixed(1)}m AMSL costante. Controlla l'AGL risultante per ogni waypoint.`, "Successo");
}
