// File: poiManager.js

// Depends on: config.js, uiUpdater.js, utils.js, mapManager.js, terrainManager.js (for getElevationsBatch)

/**
 * Updates the displayed final POI altitude in the sidebar.
 * Typically called after terrain elevation or object height changes.
 */
function updatePoiFinalAltitudeDisplay() {
    if (!poiTerrainElevationInputEl || !poiObjectHeightInputEl || !poiFinalAltitudeDisplayEl) return;

    const terrainElev = parseFloat(poiTerrainElevationInputEl.value) || 0;
    const objectHeight = parseFloat(poiObjectHeightInputEl.value) || 0;
    const finalAMSL = terrainElev + objectHeight;
    poiFinalAltitudeDisplayEl.textContent = `${finalAMSL.toFixed(1)} m`;
}


/**
 * Fetches and updates terrain elevation for a given POI or the last active POI.
 * @param {object|null} poiToUpdate - The POI object to update. If null, uses lastActivePoiForTerrainFetch.
 */
async function fetchAndUpdatePoiTerrainElevation(poiToUpdate = null) {
    const targetPoi = poiToUpdate || lastActivePoiForTerrainFetch;
    if (!targetPoi || !targetPoi.latlng) {
        showCustomAlert("Nessun POI valido selezionato o coordinate mancanti per recuperare l'elevazione del terreno.", "Attenzione");
        return false; // Indicate failure or no action
    }
    if (!loadingOverlayEl || !poiTerrainElevationInputEl) return false;

    const originalPoiIdForAlert = targetPoi.id; // Store for alert message
    loadingOverlayEl.textContent = `POI ${originalPoiIdForAlert}: Recupero elev. terreno...`;
    loadingOverlayEl.style.display = 'flex';
    if (refetchPoiTerrainBtnEl) refetchPoiTerrainBtnEl.disabled = true;

    try {
        const elevations = await getElevationsBatch([{ lat: targetPoi.latlng.lat, lng: targetPoi.latlng.lng }]);
        if (elevations && elevations.length > 0 && elevations[0] !== null) {
            targetPoi.terrainElevationMSL = parseFloat(elevations[0].toFixed(1));
            if (targetPoi === lastActivePoiForTerrainFetch || !poiToUpdate) { // Update sidebar input only if it's the "active" one
                poiTerrainElevationInputEl.value = targetPoi.terrainElevationMSL;
                poiTerrainElevationInputEl.readOnly = true; // Make it readonly after successful fetch
                 if(document.getElementById(`poi_terrain_elev_${targetPoi.id}`)) { // Update in list if present
                    document.getElementById(`poi_terrain_elev_${targetPoi.id}`).value = targetPoi.terrainElevationMSL;
                }
            }
            targetPoi.recalculateFinalAltitude(); // This will also update dependent elements
            showCustomAlert(`POI ${originalPoiIdForAlert}: Elevazione terreno aggiornata a ${targetPoi.terrainElevationMSL}m MSL.`, "Successo");
            updatePOIList(); // Refresh list to show updated AMSL
            return true; // Indicate success
        } else {
            showCustomAlert(`POI ${originalPoiIdForAlert}: Impossibile recuperare l'elevazione del terreno. Puoi inserirla manualmente.`, "Attenzione");
            if (targetPoi === lastActivePoiForTerrainFetch || !poiToUpdate) {
                poiTerrainElevationInputEl.readOnly = false; // Allow manual input
            }
            return false; // Indicate failure
        }
    } catch (error) {
        console.error("Errore durante il recupero dell'elevazione del terreno per il POI:", error);
        showCustomAlert(`POI ${originalPoiIdForAlert}: Errore durante il recupero dell'elevazione del terreno.`, "Errore");
        if (targetPoi === lastActivePoiForTerrainFetch || !poiToUpdate) {
            poiTerrainElevationInputEl.readOnly = false;
        }
        return false;
    } finally {
        loadingOverlayEl.style.display = 'none';
        if (refetchPoiTerrainBtnEl) refetchPoiTerrainBtnEl.disabled = false;
    }
}


/**
 * Adds a new Point of Interest (POI) to the map and list.
 * Fetches terrain elevation for the POI.
 * @param {L.LatLng} latlng - The latitude and longitude of the POI.
 */
async function addPOI(latlng) {
    if (!map || !poiNameInput || !poiObjectHeightInputEl || !poiTerrainElevationInputEl || !poiFinalAltitudeDisplayEl ||
        !targetPoiSelect || !multiTargetPoiSelect ) return;

    const name = poiNameInput.value.trim() || `POI ${poiCounter}`;
    const objectHeight = parseFloat(poiObjectHeightInputEl.value) || 0;

    // Temporarily set sidebar inputs for the new POI being added
    poiTerrainElevationInputEl.value = "0"; // Placeholder
    poiTerrainElevationInputEl.readOnly = true; // Readonly while fetching
    updatePoiFinalAltitudeDisplay(); // Update display based on current objectHeight and temp terrain

    const newPoi = {
        id: poiCounter, // Assign ID now for display during fetch
        name: name,
        latlng: L.latLng(latlng.lat, latlng.lng),
        altitude: objectHeight, // Initial final altitude (terrain is 0 for now)
        terrainElevationMSL: 0, // Will be updated by fetch
        objectHeightAboveGround: objectHeight,
        marker: null,
        updatePopup: null,
        recalculateFinalAltitude: function() {
            this.altitude = (parseFloat(this.terrainElevationMSL) || 0) + (parseFloat(this.objectHeightAboveGround) || 0);
            
            // Update sidebar display only if this POI is the "last active one"
            if (this === lastActivePoiForTerrainFetch) {
                 if (poiFinalAltitudeDisplayEl) poiFinalAltitudeDisplayEl.textContent = `${this.altitude.toFixed(1)} m`;
                 if (poiTerrainElevationInputEl) poiTerrainElevationInputEl.value = this.terrainElevationMSL !== null ? this.terrainElevationMSL.toFixed(1) : "0";
                 if (poiObjectHeightInputEl) poiObjectHeightInputEl.value = this.objectHeightAboveGround;
            }

            if (this.updatePopup) this.updatePopup();
            updateAllPoiDependentElements(this.id); // Update waypoints tracking this POI
        }
    };
    
    lastActivePoiForTerrainFetch = newPoi; // Set this as the POI whose terrain is being fetched for UI updates
    poiCounter++; // Increment global counter *after* assigning to newPoi

    const markerIconHtml = () => `<div style="background: #f39c12; color: white; border-radius: 50%; width: 22px; height: 22px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 9px; font-weight: bold; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3); line-height:1.1;">🎯<span style="font-size:7px; margin-top: -1px;">${newPoi.altitude.toFixed(0)}m</span></div>`;
    
    const marker = L.marker(newPoi.latlng, { 
        draggable: true, 
        icon: L.divIcon({ className: 'poi-marker', html: markerIconHtml(), iconSize: [22,22], iconAnchor: [11,11]})
    }).addTo(map);
    
    const updatePoiPopupContent = () => {
        return `<strong>${newPoi.name}</strong> (ID: ${newPoi.id})<br>
                <div style="font-size:0.9em; line-height:1.3;">
                Alt. MSL: ${newPoi.altitude.toFixed(1)} m<br>
                Elev. Terreno: ${newPoi.terrainElevationMSL !== null ? newPoi.terrainElevationMSL.toFixed(1) + " m" : "N/A"}<br>
                H. Oggetto: ${newPoi.objectHeightAboveGround.toFixed(1)} m
                </div>`;
    };
    
    marker.bindPopup(updatePoiPopupContent());

    marker.on('dragend', () => {
        newPoi.latlng = marker.getLatLng();
        // Refetch terrain for new location if dragged
        fetchAndUpdatePoiTerrainElevation(newPoi); 
        // Waypoints targeting this POI are updated by recalculateFinalAltitude via fetchAndUpdatePoiTerrainElevation
    });
    
    newPoi.updatePopup = () => {
        marker.setPopupContent(updatePoiPopupContent());
        marker.setIcon(L.divIcon({ className: 'poi-marker', html: markerIconHtml(), iconSize: [22,22], iconAnchor: [11,11]}));
    };
    newPoi.marker = marker;

    pois.push(newPoi);
    updatePOIList(); // Add to list first
    updateFlightStatistics();

    // Now fetch terrain and update
    await fetchAndUpdatePoiTerrainElevation(newPoi);
    // Note: fetchAndUpdatePoiTerrainElevation will call newPoi.recalculateFinalAltitude() which updates dependent elements.

    // Populate dropdowns after POI is fully processed
    if (selectedWaypoint && headingControlSelect && headingControlSelect.value === 'poi_track') {
        populatePoiSelectDropdown(targetPoiSelect, selectedWaypoint.targetPoiId, true, "-- Select POI for Heading --");
    }
    if (multiWaypointEditControlsDiv && multiWaypointEditControlsDiv.style.display === 'block' &&
        multiHeadingControlSelect && multiHeadingControlSelect.value === 'poi_track') {
        populatePoiSelectDropdown(multiTargetPoiSelect, null, true, "-- Select POI for all --");
    }
    if (orbitModalOverlayEl && orbitModalOverlayEl.style.display === 'flex') {
        populatePoiSelectDropdown(orbitPoiSelectEl, orbitPoiSelectEl.value || null, false);
    }

    poiNameInput.value = '';
    // Do not reset objectHeight or terrainElevation, user might want to add multiple POIs with similar base settings
}


/**
 * Deletes a POI from the map and list.
 * @param {number} poiId - The ID of the POI to delete.
 */
function deletePOI(poiId) {
    const poiIndex = pois.findIndex(p => p.id === poiId);
    if (poiIndex > -1) {
        const deletedPoi = pois[poiIndex];
        if (deletedPoi.marker) {
            map.removeLayer(deletedPoi.marker);
        }
        pois.splice(poiIndex, 1);

        if (lastActivePoiForTerrainFetch && lastActivePoiForTerrainFetch.id === poiId) {
            lastActivePoiForTerrainFetch = pois.length > 0 ? pois[pois.length -1] : null;
            if (lastActivePoiForTerrainFetch) { // Update sidebar display to last POI or clear
                poiObjectHeightInputEl.value = lastActivePoiForTerrainFetch.objectHeightAboveGround;
                poiTerrainElevationInputEl.value = lastActivePoiForTerrainFetch.terrainElevationMSL !== null ? lastActivePoiForTerrainFetch.terrainElevationMSL : 0;
                poiTerrainElevationInputEl.readOnly = lastActivePoiForTerrainFetch.terrainElevationMSL !== null;
                updatePoiFinalAltitudeDisplay();
            } else {
                 poiObjectHeightInputEl.value = 0;
                 poiTerrainElevationInputEl.value = 0;
                 poiTerrainElevationInputEl.readOnly = true;
                 updatePoiFinalAltitudeDisplay();
            }
        }


        if (pois.length === 0) {
            poiCounter = 1; 
        }

        updatePOIList();
        updateFlightStatistics();

        let waypointsUpdatedForDisplay = false;
        waypoints.forEach(wp => {
            if (wp.targetPoiId === poiId) {
                wp.targetPoiId = null; 
                if (selectedWaypoint && selectedWaypoint.id === wp.id) {
                    if(headingControlSelect) headingControlSelect.value = 'auto'; 
                    if(targetPoiForHeadingGroupDiv) targetPoiForHeadingGroupDiv.style.display = 'none';
                    populatePoiSelectDropdown(targetPoiSelect, null, true, "-- Select POI for Heading --");
                }
                updateMarkerIconStyle(wp); 
                waypointsUpdatedForDisplay = true;
            }
        });

        if (waypointsUpdatedForDisplay) {
            updateWaypointList(); 
        }
        updateAllPoiDependentElements(null); // Force update of all dropdowns

    } else {
        showCustomAlert(`POI with ID ${poiId} not found.`, "Error");
    }
}

/**
 * Helper to update all UI elements that depend on the POI list or a specific POI's data.
 * @param {number|null} changedPoiId - The ID of the POI that changed, or null to refresh all.
 */
function updateAllPoiDependentElements(changedPoiId) {
    // Refresh POI select dropdowns in single and multi-edit panels, and orbit modal
    if (selectedWaypoint && headingControlSelect && headingControlSelect.value === 'poi_track') {
        populatePoiSelectDropdown(targetPoiSelect, selectedWaypoint.targetPoiId, true, "-- Select POI for Heading --");
    }
    if (multiWaypointEditControlsDiv && multiWaypointEditControlsDiv.style.display === 'block' &&
        multiHeadingControlSelect && multiHeadingControlSelect.value === 'poi_track') {
        populatePoiSelectDropdown(multiTargetPoiSelect, null, true, "-- Select POI for all --");
    }
    if (orbitModalOverlayEl && orbitModalOverlayEl.style.display === 'flex') {
        populatePoiSelectDropdown(orbitPoiSelectEl, orbitPoiSelectEl.value || null, false);
    }
}
