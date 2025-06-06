// File: poiManager.js

// Depends on: config.js, uiUpdater.js, utils.js, mapManager.js, terrainManager.js (for getElevationsBatch)

/**
 * Updates the displayed final POI altitude in the sidebar.
 * Typically called after terrain elevation or object height changes FOR THE CURRENTLY ACTIVE POI IN SIDEBAR.
 */
function updatePoiFinalAltitudeDisplay() {
    if (!poiTerrainElevationInputEl || !poiObjectHeightInputEl || !poiFinalAltitudeDisplayEl) return;

    const terrainElev = parseFloat(poiTerrainElevationInputEl.value) || 0;
    const objectHeight = parseFloat(poiObjectHeightInputEl.value) || 0;
    const finalAMSL = terrainElev + objectHeight;
    poiFinalAltitudeDisplayEl.textContent = `${finalAMSL.toFixed(1)} m`;
}


/**
 * Fetches and updates terrain elevation for a given POI.
 * This also updates the POI's final altitude and related UI elements.
 * @param {object} poiToUpdate - The POI object to update.
 */
async function fetchAndUpdatePoiTerrainElevation(poiToUpdate) {
    if (!poiToUpdate || !poiToUpdate.latlng) {
        // showCustomAlert("Nessun POI valido o coordinate mancanti per recuperare l'elevazione del terreno.", "Attenzione");
        // Silenzioso se chiamato programmaticamente, l'utente vedrà N/A
        console.warn("fetchAndUpdatePoiTerrainElevation: POI non valido o coordinate mancanti.");
        return false; 
    }
    if (!loadingOverlayEl || !poiTerrainElevationInputEl) return false;

    const originalPoiIdForAlert = poiToUpdate.id;
    loadingOverlayEl.textContent = `POI ${originalPoiIdForAlert}: Recupero elev. terreno...`;
    loadingOverlayEl.style.display = 'flex';
    if (refetchPoiTerrainBtnEl) refetchPoiTerrainBtnEl.disabled = true;

    try {
        const elevations = await getElevationsBatch([{ lat: poiToUpdate.latlng.lat, lng: poiToUpdate.latlng.lng }]);
        if (elevations && elevations.length > 0 && elevations[0] !== null) {
            poiToUpdate.terrainElevationMSL = parseFloat(elevations[0].toFixed(1));
            if (poiToUpdate === lastActivePoiForTerrainFetch) { 
                poiTerrainElevationInputEl.value = poiToUpdate.terrainElevationMSL;
                poiTerrainElevationInputEl.readOnly = true; 
            }
            const poiListTerrainInput = document.getElementById(`poi_terrain_elev_${poiToUpdate.id}`);
            if (poiListTerrainInput) {
                poiListTerrainInput.value = poiToUpdate.terrainElevationMSL;
            }
            
            poiToUpdate.recalculateFinalAltitude(); 
            // showCustomAlert(`POI ${originalPoiIdForAlert}: Elevazione terreno aggiornata a ${poiToUpdate.terrainElevationMSL}m MSL.`, "Successo");
            updatePOIList(); 
            return true; 
        } else {
            // showCustomAlert(`POI ${originalPoiIdForAlert}: Impossibile recuperare l'elevazione del terreno. Puoi inserirla manualmente.`, "Attenzione");
            console.warn(`POI ${originalPoiIdForAlert}: Impossibile recuperare elev. terreno.`);
            poiToUpdate.terrainElevationMSL = null; // Imposta a null se fallisce
             if (poiToUpdate === lastActivePoiForTerrainFetch) {
                poiTerrainElevationInputEl.value = ""; // Pulisci o metti placeholder
                poiTerrainElevationInputEl.readOnly = false; // Permetti input manuale
            }
            const poiListTerrainInput = document.getElementById(`poi_terrain_elev_${poiToUpdate.id}`);
            if (poiListTerrainInput) {
                poiListTerrainInput.value = "";
                poiListTerrainInput.placeholder = "N/A";
            }
            poiToUpdate.recalculateFinalAltitude(); // Ricalcola con terrainElevationMSL = null (o 0)
            updatePOIList();
            return false; 
        }
    } catch (error) {
        console.error("Errore durante il recupero dell'elevazione del terreno per il POI:", error);
        showCustomAlert(`POI ${originalPoiIdForAlert}: Errore durante il recupero dell'elevazione del terreno.`, "Errore");
        poiToUpdate.terrainElevationMSL = null;
        if (poiToUpdate === lastActivePoiForTerrainFetch) {
            poiTerrainElevationInputEl.value = "";
            poiTerrainElevationInputEl.readOnly = false;
        }
        const poiListTerrainInput = document.getElementById(`poi_terrain_elev_${poiToUpdate.id}`);
        if (poiListTerrainInput) {
            poiListTerrainInput.value = "";
            poiListTerrainInput.placeholder = "Errore";
        }
        poiToUpdate.recalculateFinalAltitude();
        updatePOIList();
        return false;
    } finally {
        loadingOverlayEl.style.display = 'none';
        if (refetchPoiTerrainBtnEl) refetchPoiTerrainBtnEl.disabled = false;
    }
}


/**
 * Adds a new Point of Interest (POI) to the map and list.
 * Fetches terrain elevation for the POI if not provided.
 * @param {L.LatLng} latlng - The latitude and longitude of the POI.
 * @param {object} [options={}] - Optional parameters {id, name, objectHeightAboveGround, terrainElevationMSL, calledFromLoad}.
 */
async function addPOI(latlng, options = {}) {
    if (!map || !poiNameInput || !poiObjectHeightInputEl || !poiTerrainElevationInputEl || !poiFinalAltitudeDisplayEl ||
        !targetPoiSelect || !multiTargetPoiSelect ) return;

    const isImport = options.id !== undefined;
    const poiIdToUse = isImport ? options.id : poiCounter;

    const name = options.name !== undefined ? options.name : (poiNameInput.value.trim() || `POI ${poiIdToUse}`);
    const objectHeight = options.objectHeightAboveGround !== undefined ? options.objectHeightAboveGround : (parseFloat(poiObjectHeightInputEl.value) || 0);
    let initialTerrainMSL = options.terrainElevationMSL !== undefined ? options.terrainElevationMSL : null;

    // Se è un nuovo POI manuale, i campi della sidebar sono la fonte
    if (!isImport) {
        if (lastActivePoiForTerrainFetch && lastActivePoiForTerrainFetch.id === poiIdToUse && poiTerrainElevationInputEl.value !== "") {
            // Se l'utente ha modificato manualmente il campo terrain elev per il POI "attivo"
            // e non è readonly (significa che il fetch era fallito o non fatto)
            if (!poiTerrainElevationInputEl.readOnly) {
                 initialTerrainMSL = parseFloat(poiTerrainElevationInputEl.value) || null;
            } else { // Altrimenti il valore è quello del fetch precedente per questo POI "attivo"
                 initialTerrainMSL = parseFloat(poiTerrainElevationInputEl.value) || null;
            }
        }
        // Altrimenti, per un POI completamente nuovo, initialTerrainMSL rimarrà null e verrà fetchato
    }
    

    const newPoi = {
        id: poiIdToUse,
        name: name,
        latlng: L.latLng(latlng.lat, latlng.lng),
        altitude: 0, // Sarà calcolata da recalculateFinalAltitude
        terrainElevationMSL: initialTerrainMSL,
        objectHeightAboveGround: objectHeight,
        marker: null,
        updatePopup: null,
        recalculateFinalAltitude: function() {
            this.altitude = (parseFloat(this.terrainElevationMSL) || 0) + (parseFloat(this.objectHeightAboveGround) || 0);
            if (this === lastActivePoiForTerrainFetch) {
                 if (poiFinalAltitudeDisplayEl) poiFinalAltitudeDisplayEl.textContent = `${this.altitude.toFixed(1)} m`;
                 if (poiTerrainElevationInputEl) poiTerrainElevationInputEl.value = this.terrainElevationMSL !== null ? this.terrainElevationMSL.toFixed(1) : "";
                 if (poiObjectHeightInputEl) poiObjectHeightInputEl.value = this.objectHeightAboveGround;
                 // Se terrainElevationMSL è stato settato (da fetch o import), rendi il campo readonly
                 if (poiTerrainElevationInputEl) poiTerrainElevationInputEl.readOnly = this.terrainElevationMSL !== null;
            }
            if (this.updatePopup) this.updatePopup();
            if (typeof updateAllPoiDependentElements === "function") updateAllPoiDependentElements(this.id); 
        }
    };
    
    if (!isImport) { // Se è un nuovo POI aggiunto manualmente
        lastActivePoiForTerrainFetch = newPoi;
        poiCounter++; // Incrementa solo per i nuovi POI manuali
        // Aggiorna i campi della sidebar *prima* del fetch, poi fetchAndUpdate li correggerà
        if(poiObjectHeightInputEl) poiObjectHeightInputEl.value = newPoi.objectHeightAboveGround;
        if(poiTerrainElevationInputEl) {
            poiTerrainElevationInputEl.value = ""; // In attesa del fetch
            poiTerrainElevationInputEl.readOnly = true;
        }
        newPoi.recalculateFinalAltitude(); // Calcola e mostra AMSL iniziale (potrebbe essere solo objectHeight)
    }


    const markerIconHtml = () => `<div style="background: #f39c12; color: white; border-radius: 50%; width: 22px; height: 22px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 9px; font-weight: bold; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3); line-height:1.1;">🎯<span style="font-size:7px; margin-top: -1px;">${newPoi.altitude.toFixed(0)}m</span></div>`;
    
    const marker = L.marker(newPoi.latlng, { 
        draggable: true, 
        icon: L.divIcon({ className: 'poi-marker', html: markerIconHtml(), iconSize: [22,22], iconAnchor: [11,11]})
    }).addTo(map);
    
    const updatePoiPopupContent = () => { /* ... come prima, usando newPoi.altitude, newPoi.terrainElevationMSL, newPoi.objectHeightAboveGround ... */ 
        return `<strong>${newPoi.name}</strong> (ID: ${newPoi.id})<br>
                <div style="font-size:0.9em; line-height:1.3;">
                Alt. MSL: ${newPoi.altitude.toFixed(1)} m<br>
                Elev. Terreno: ${newPoi.terrainElevationMSL !== null ? newPoi.terrainElevationMSL.toFixed(1) + " m" : "N/A"}<br>
                H. Oggetto: ${newPoi.objectHeightAboveGround.toFixed(1)} m
                </div>`;
    };
    
    marker.bindPopup(updatePoiPopupContent());

    marker.on('dragend', async () => { 
        newPoi.latlng = marker.getLatLng();
        lastActivePoiForTerrainFetch = newPoi; 
        await fetchAndUpdatePoiTerrainElevation(newPoi); 
    });
    
    newPoi.updatePopup = () => {
        marker.setPopupContent(updatePoiPopupContent());
        marker.setIcon(L.divIcon({ className: 'poi-marker', html: markerIconHtml(), iconSize: [22,22], iconAnchor: [11,11]}));
    };
    newPoi.marker = marker;

    pois.push(newPoi);
    
    if (newPoi.terrainElevationMSL === null && !options.calledFromLoad) { // Se non è da import o se da import non aveva elevazione
        await fetchAndUpdatePoiTerrainElevation(newPoi); // Questo chiamerà recalculate e updateAllPoiDependentElements
    } else {
        newPoi.recalculateFinalAltitude(); // Altrimenti, ricalcola e aggiorna subito con i dati esistenti
    }

    if (options.calledFromLoad !== true) {
        updatePOIList(); 
        updateFlightStatistics();
        poiNameInput.value = ''; 
    }
    // Se è un nuovo POI manuale, l'aggiornamento della UI sidebar per questo POI
    // è gestito da recalculateFinalAltitude() quando lastActivePoiForTerrainFetch === this
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
            if (lastActivePoiForTerrainFetch) { 
                if(lastActivePoiForTerrainFetch.recalculateFinalAltitude) lastActivePoiForTerrainFetch.recalculateFinalAltitude(); 
            } else { 
                 if(poiObjectHeightInputEl) poiObjectHeightInputEl.value = 0;
                 if(poiTerrainElevationInputEl) {
                     poiTerrainElevationInputEl.value = 0;
                     poiTerrainElevationInputEl.readOnly = true; 
                 }
                 if(typeof updatePoiFinalAltitudeDisplay === 'function') updatePoiFinalAltitudeDisplay();
            }
        }

        if (pois.length === 0) { // Se non ci sono più POI, resetta il contatore
            poiCounter = 1; 
        }

        updatePOIList();
        updateFlightStatistics();

        waypoints.forEach(wp => {
            if (wp.targetPoiId === poiId) {
                wp.targetPoiId = null; 
                if (selectedWaypoint && selectedWaypoint.id === wp.id) { 
                    if(headingControlSelect) headingControlSelect.value = 'auto'; 
                    if(targetPoiForHeadingGroupDiv) targetPoiForHeadingGroupDiv.style.display = 'none';
                    if(typeof updateGimbalForPoiTrack === "function") updateGimbalForPoiTrack(wp, true); 
                } else if (typeof updateGimbalForPoiTrack === "function") {
                    updateGimbalForPoiTrack(wp); 
                }
                updateMarkerIconStyle(wp); 
            }
        });
        updateWaypointList(); 
        if(typeof updateAllPoiDependentElements === "function") updateAllPoiDependentElements(null); 

    } else {
        showCustomAlert(`POI with ID ${poiId} not found.`, "Error");
    }
}

/**
 * Helper to update all UI elements that depend on the POI list or a specific POI's data.
 * @param {number|null} changedPoiId - The ID of the POI that changed, or null to refresh all.
 */
function updateAllPoiDependentElements(changedPoiId) {
    if (changedPoiId !== null) {
        waypoints.forEach(wp => {
            if (wp.headingControl === 'poi_track' && wp.targetPoiId === changedPoiId) {
                if (typeof updateGimbalForPoiTrack === "function") {
                    updateGimbalForPoiTrack(wp, (selectedWaypoint && selectedWaypoint.id === wp.id));
                }
                updateMarkerIconStyle(wp);
            }
        });
    }

    if (selectedWaypoint && headingControlSelect && headingControlSelect.value === 'poi_track') {
        populatePoiSelectDropdown(targetPoiSelect, selectedWaypoint.targetPoiId, true, "-- Select POI for Heading --");
    } else if (selectedWaypoint && targetPoiSelect) { 
         populatePoiSelectDropdown(targetPoiSelect, null, true, "-- Select POI for Heading --");
    }

    if (multiWaypointEditControlsDiv && multiWaypointEditControlsDiv.style.display === 'block' &&
        multiHeadingControlSelect && multiHeadingControlSelect.value === 'poi_track') {
        populatePoiSelectDropdown(multiTargetPoiSelect, multiTargetPoiSelect.value || null, true, "-- Select POI for all --");
    } else if (multiTargetPoiSelect) { 
        populatePoiSelectDropdown(multiTargetPoiSelect, null, true, "-- Select POI for all --");
    }

    if (orbitModalOverlayEl && orbitModalOverlayEl.style.display === 'flex') {
        populatePoiSelectDropdown(orbitPoiSelectEl, orbitPoiSelectEl.value || null, false);
    } else if (orbitPoiSelectEl && orbitPoiSelectEl.options.length === 0 && pois.length > 0) { 
        populatePoiSelectDropdown(orbitPoiSelectEl, null, false);
    }
}
