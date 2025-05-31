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

    const batchSize = 100; // OpenTopoData typically handles up to 100 locations per request
    let allElevationsData = []; // To store {originalIndex, elevation}

    for (let i = 0; i < locationsArray.length; i += batchSize) {
        const batch = locationsArray.slice(i, i + batchSize);
        const currentBatchIndices = []; // To map batch results back to original indices
        const locationsString = batch.map((loc, indexInBatch) => {
            currentBatchIndices.push(i + indexInBatch); // Store original index
            return `${loc.lat.toFixed(6)},${loc.lng.toFixed(6)}`;
        }).join('|');

        // Construct the API URL for OpenTopoData
        const openTopoTargetUrl = `${OPENTOPODATA_API_BASE}?locations=${locationsString}&interpolation=cubic`;
        // Use the proxy URL from config.js
        const proxyApiUrl = `${ELEVATION_API_PROXY_URL}?url=${encodeURIComponent(openTopoTargetUrl)}`;

        if (loadingOverlayEl) loadingOverlayEl.textContent = `Fetching terrain (batch ${Math.floor(i/batchSize) + 1})...`;
        console.log(`Requesting elevation batch via proxy: ${openTopoTargetUrl}`);

        try {
            const response = await fetch(proxyApiUrl, { method: 'GET' });
            const responseText = await response.text(); // Get raw text first for better error diagnosis

            if (!response.ok) {
                console.error(`Elevation API Error (via proxy): Status ${response.status}. Response: ${responseText.substring(0, 300)}...`);
                showCustomAlert(`Elevation API Error (Batch ${Math.floor(i/batchSize) + 1}): ${response.status}. Check console.`, "API Error");
                // For failed batch, push nulls for all items in this batch
                currentBatchIndices.forEach(originalIdx => allElevationsData.push({ originalIndex: originalIdx, elevation: null }));
                continue; // Move to the next batch if any
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

        // Add a small delay between batch requests to be polite to the API
        if (i + batchSize < locationsArray.length) {
            await new Promise(resolve => setTimeout(resolve, 1100)); // ~1 second delay
        }
    }

    // Sort results by original index to ensure correct order
    allElevationsData.sort((a, b) => a.originalIndex - b.originalIndex);
    return allElevationsData.map(item => item.elevation);
}

/**
 * Gets the ground elevation for the first waypoint and sets it as the Home (takeoff) MSL elevation.
 */
async function getHomeElevationFromFirstWaypoint() {
    if (waypoints.length === 0) {
        showCustomAlert("Add at least one waypoint to estimate takeoff point elevation.", "Info");
        return;
    }
    if (!loadingOverlayEl || !homeElevationMslInput || !adaptToAGLBtnEl || !getHomeElevationBtn) return;

    loadingOverlayEl.style.display = 'flex';
    loadingOverlayEl.textContent = "Fetching WP1 Elevation...";
    adaptToAGLBtnEl.disabled = true;
    getHomeElevationBtn.disabled = true;

    const firstWp = waypoints[0];
    const elevations = await getElevationsBatch([{ lat: firstWp.latlng.lat, lng: firstWp.latlng.lng }]);

    loadingOverlayEl.style.display = 'none';
    adaptToAGLBtnEl.disabled = false;
    getHomeElevationBtn.disabled = false;

    if (elevations && elevations.length > 0 && elevations[0] !== null) {
        homeElevationMslInput.value = Math.round(elevations[0]);
        showCustomAlert(`Waypoint 1 ground elevation (${Math.round(elevations[0])}m MSL) set as takeoff elevation.`, "Success");
    } else {
        showCustomAlert("Could not retrieve ground elevation for Waypoint 1.", "Error");
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

    if (isNaN(aglDesired) || aglDesired < 1) { // Min AGL typically > 0, e.g. 1m or 5m
        showCustomAlert("Invalid desired AGL. Must be a positive number (e.g., min 5m).", "Input Error");
        return;
    }
    if (isNaN(homeElevationMSL)) {
        showCustomAlert("Invalid Takeoff Point Elevation (MSL). Use 'Use WP1 Elev.' or enter manually.", "Input Error");
        return;
    }
    if (waypoints.length === 0) {
        showCustomAlert("No waypoints to adapt altitudes for.", "Info");
        return;
    }

    loadingOverlayEl.style.display = 'flex';
    loadingOverlayEl.textContent = "Requesting terrain elevations for all waypoints...";
    adaptToAGLBtnEl.disabled = true;
    getHomeElevationBtn.disabled = true;

    const waypointCoords = waypoints.map(wp => ({ lat: wp.latlng.lat, lng: wp.latlng.lng }));
    const groundElevations = await getElevationsBatch(waypointCoords);

    let successCount = 0;
    if (groundElevations && groundElevations.length === waypoints.length) {
        waypoints.forEach((wp, index) => {
            const groundElevationAtWaypoint = groundElevations[index];
            if (loadingOverlayEl) loadingOverlayEl.textContent = `Adapting AGL Altitudes... (WP ${wp.id} - ${index + 1}/${waypoints.length})`;

            if (groundElevationAtWaypoint !== null) {
                // Target MSL altitude for this waypoint = its ground MSL + desired AGL
                const targetMSLForWaypoint = groundElevationAtWaypoint + aglDesired;
                // Drone's altitude setting (relative to takeoff) = Target MSL - Takeoff MSL
                const newRelativeAltitude = targetMSLForWaypoint - homeElevationMSL;

                wp.altitude = Math.max(1, Math.round(newRelativeAltitude)); // Ensure min altitude (e.g. 1m or 5m)
                successCount++;
            } else {
                console.warn(`Could not get ground elevation for waypoint ${wp.id}. Its altitude was not changed.`);
            }
        });
    } else {
        console.error("Error fetching ground elevations in batch or length mismatch. No altitudes adapted.");
    }

    // Update UI elements
    updateWaypointList();
    if (selectedWaypoint) {
        // Re-select to refresh its controls if it was among the updated waypoints
        const currentSelectedWp = waypoints.find(wp => wp.id === selectedWaypoint.id);
        if (currentSelectedWp) selectWaypoint(currentSelectedWp); // This calls updateSingleWaypointEditControls
        else if (waypoints.length > 0) selectWaypoint(waypoints[0]); // Select first if current was deleted (not applicable here)
        else if (waypointControlsDiv) waypointControlsDiv.style.display = 'none';
    } else if (waypoints.length > 0 && waypointControlsDiv) {
        // If nothing was selected, but now we have waypoints, maybe select the first one.
        // Or simply ensure the single edit panel is hidden if no selection.
        waypointControlsDiv.style.display = 'none';
    }


    updateFlightStatistics(); // If altitudes changed in a way that affects stats (not directly here)

    loadingOverlayEl.style.display = 'none';
    adaptToAGLBtnEl.disabled = false;
    getHomeElevationBtn.disabled = false;

    if (successCount === waypoints.length && waypoints.length > 0) {
        showCustomAlert("AGL altitude adaptation completed for all waypoints!", "Success");
    } else if (successCount > 0) {
        showCustomAlert(`AGL altitude adaptation completed for ${successCount} out of ${waypoints.length} waypoints. Some waypoints may not have been updated due to missing terrain data. Check console.`, "Partial Success");
    } else if (waypoints.length > 0) {
        showCustomAlert("AGL altitude adaptation failed for all waypoints. Could not retrieve terrain data. Check console for details.", "Error");
    }
    // If waypoints.length is 0, no message was shown by the logic above, which is fine.
}