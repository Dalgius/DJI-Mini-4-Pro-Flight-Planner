// File: terrainManager.js

// Depends on: config.js, utils.js, waypointManager.js (selectWaypoint if needed after AGL changes)
// Depends on: uiUpdater.js (updateWaypointList, updateSingleWaypointEditControls, updateFlightStatistics)

/**
 * Fetches elevation data for a batch of locations using the OpenTopoData API via a proxy.
 * @param {Array<{lat: number, lng: number}>} locationsArray - Array of location objects.
 * @returns {Promise<Array<number|null>>} A promise that resolves to an array of elevations (or null for failures).
 */
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

        if (loadingOverlayEl) loadingOverlayEl.textContent = `Fetching terrain (batch ${Math.floor(i/batchSize) + 1})...`;
        console.log(`Requesting elevation batch via proxy: ${openTopoTargetUrl}`);

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

/**
 * Gets the ground elevation for the first waypoint and sets it as the Home (takeoff) MSL elevation.
 */
async function getHomeElevationFromFirstWaypoint() {
    if (waypoints.length === 0) {
        showCustomAlert("Aggiungi almeno un waypoint per stimare l'elevazione del punto di decollo.", "Info"); // Italian
        return;
    }
    if (!loadingOverlayEl || !homeElevationMslInput || !adaptToAGLBtnEl || !getHomeElevationBtn) return;

    loadingOverlayEl.style.display = 'flex';
    loadingOverlayEl.textContent = "Recupero elevazione WP1..."; // Italian
    adaptToAGLBtnEl.disabled = true;
    getHomeElevationBtn.disabled = true;

    const firstWp = waypoints[0];
    const elevations = await getElevationsBatch([{ lat: firstWp.latlng.lat, lng: firstWp.latlng.lng }]);

    loadingOverlayEl.style.display = 'none';
    adaptToAGLBtnEl.disabled = false;
    getHomeElevationBtn.disabled = false;

    if (elevations && elevations.length > 0 && elevations[0] !== null) {
        homeElevationMslInput.value = Math.round(elevations[0]);
        showCustomAlert(`Elevazione del terreno di Waypoint 1 (${Math.round(elevations[0])}m MSL) impostata come elevazione di decollo.`, "Successo"); // Italian
        updateWaypointList(); // Aggiorna la lista per mostrare le nuove altezze AMSL/AGL
    } else {
        showCustomAlert("Impossibile recuperare l'elevazione del terreno per Waypoint 1.", "Errore"); // Italian
    }
}

/**
 * Adapts all waypoint altitudes to maintain a desired AGL (Above Ground Level)
 * based on fetched terrain data and a specified takeoff MSL elevation.
 */
async function adaptAltitudesToAGL() {
    if (!desiredAGLInput || !homeElevationMslInput || !loadingOverlayEl || !adaptToAGLBtnEl || !getHomeElevationBtn) return;

    const aglDesired = parseInt(desiredAGLInput.value);
    let homeElevationMSL = parseFloat(homeElevationMslInput.value);

    if (isNaN(aglDesired) || aglDesired < 1) { 
        showCustomAlert("AGL desiderato non valido. Deve essere un numero positivo (es. min 5m).", "Errore Input"); // Italian
        return;
    }
    if (isNaN(homeElevationMSL)) {
        showCustomAlert("Elevazione del punto di decollo (MSL) non valida. Usa 'Usa Elev. WP1' o inserisci manualmente.", "Errore Input"); // Italian
        return;
    }
    if (waypoints.length === 0) {
        showCustomAlert("Nessun waypoint per cui adattare le altitudini.", "Info"); // Italian
        return;
    }

    loadingOverlayEl.style.display = 'flex';
    loadingOverlayEl.textContent = "Richiesta elevazioni terreno per tutti i waypoint..."; // Italian
    adaptToAGLBtnEl.disabled = true;
    getHomeElevationBtn.disabled = true;

    const waypointCoords = waypoints.map(wp => ({ lat: wp.latlng.lat, lng: wp.latlng.lng }));
    const groundElevations = await getElevationsBatch(waypointCoords);

    let successCount = 0;
    if (groundElevations && groundElevations.length === waypoints.length) {
        waypoints.forEach((wp, index) => {
            const groundElevationAtWaypoint = groundElevations[index];
            if (loadingOverlayEl) loadingOverlayEl.textContent = `Adattamento altitudini AGL... (WP ${wp.id} - ${index + 1}/${waypoints.length})`;

            if (groundElevationAtWaypoint !== null) {
                wp.terrainElevationMSL = parseFloat(groundElevationAtWaypoint.toFixed(1)); // SALVA L'ELEVAZIONE DEL TERRENO

                const targetMSLForWaypoint = groundElevationAtWaypoint + aglDesired;
                const newRelativeAltitude = targetMSLForWaypoint - homeElevationMSL;

                wp.altitude = Math.max(1, Math.round(newRelativeAltitude)); 
                successCount++;
            } else {
                wp.terrainElevationMSL = null; // IMPOSTA A NULL SE NON TROVATA
                console.warn(`Could not get ground elevation for waypoint ${wp.id}. Its altitude was not changed.`);
            }
        });
    } else {
        console.error("Error fetching ground elevations in batch or length mismatch. No altitudes adapted.");
    }

    updateWaypointList();
    if (selectedWaypoint) {
        const currentSelectedWp = waypoints.find(wp => wp.id === selectedWaypoint.id);
        if (currentSelectedWp) selectWaypoint(currentSelectedWp); 
        else if (waypoints.length > 0) selectWaypoint(waypoints[0]); 
        else if (waypointControlsDiv) waypointControlsDiv.style.display = 'none';
    } else if (waypoints.length > 0 && waypointControlsDiv) {
        waypointControlsDiv.style.display = 'none';
    }

    updateFlightStatistics(); 

    loadingOverlayEl.style.display = 'none';
    adaptToAGLBtnEl.disabled = false;
    getHomeElevationBtn.disabled = false;

    if (successCount === waypoints.length && waypoints.length > 0) {
        showCustomAlert("Adattamento altitudine AGL completato per tutti i waypoint!", "Successo"); // Italian
    } else if (successCount > 0) {
        showCustomAlert(`Adattamento altitudine AGL completato per ${successCount} su ${waypoints.length} waypoint. Alcuni waypoint potrebbero non essere stati aggiornati a causa di dati del terreno mancanti. Controlla la console.`, "Successo Parziale"); // Italian
    } else if (waypoints.length > 0) {
        showCustomAlert("Adattamento altitudine AGL fallito per tutti i waypoint. Impossibile recuperare i dati del terreno. Controlla la console per i dettagli.", "Errore"); // Italian
    }
}
