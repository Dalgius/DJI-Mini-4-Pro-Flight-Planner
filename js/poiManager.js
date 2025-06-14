// File: poiManager.js

// Depends on: config.js, uiUpdater.js, utils.js, mapManager.js, terrainManager.js (for getElevationsBatch), i18n.js (for translate)

function updatePoiFinalAltitudeDisplay() {
    if (!poiTerrainElevationInputEl || !poiObjectHeightInputEl || !poiFinalAltitudeDisplayEl) return;
    const terrainElev = parseFloat(poiTerrainElevationInputEl.value) || 0;
    const objectHeight = parseFloat(poiObjectHeightInputEl.value) || 0;
    const finalAMSL = terrainElev + objectHeight;
    poiFinalAltitudeDisplayEl.textContent = `${finalAMSL.toFixed(1)} m`;
}

async function fetchAndUpdatePoiTerrainElevation(poiToUpdate) {
    if (!poiToUpdate || !poiToUpdate.latlng) {
        console.warn("fetchAndUpdatePoiTerrainElevation: Invalid POI or missing coordinates.");
        return false; 
    }
    if (!loadingOverlayEl || !poiTerrainElevationInputEl) return false;

    loadingOverlayEl.textContent = `POI ${poiToUpdate.id}: Fetching terrain elev...`;
    loadingOverlayEl.style.display = 'flex';
    if (refetchPoiTerrainBtnEl) refetchPoiTerrainBtnEl.disabled = true;

    try {
        const elevations = await getElevationsBatch([{ lat: poiToUpdate.latlng.lat, lng: poiToUpdate.latlng.lng }]);
        if (elevations && elevations.length > 0 && elevations[0] !== null) {
            poiToUpdate.terrainElevationMSL = parseFloat(elevations[0].toFixed(1));
            poiToUpdate.recalculateFinalAltitude(); 
        } else {
            poiToUpdate.terrainElevationMSL = null;
            poiToUpdate.recalculateFinalAltitude();
            if (poiToUpdate === lastActivePoiForTerrainFetch) {
                poiTerrainElevationInputEl.readOnly = false;
            }
        }
        updatePOIList();
        return true; 
    } catch (error) {
        console.error("Error fetching POI terrain elevation:", error);
        showCustomAlert(translate('errorTitle'), `POI ${poiToUpdate.id}: Error fetching terrain elevation.`);
        poiToUpdate.terrainElevationMSL = null;
        poiToUpdate.recalculateFinalAltitude();
        if (poiToUpdate === lastActivePoiForTerrainFetch) {
            poiTerrainElevationInputEl.readOnly = false;
        }
        updatePOIList();
        return false;
    } finally {
        loadingOverlayEl.style.display = 'none';
        if (refetchPoiTerrainBtnEl) refetchPoiTerrainBtnEl.disabled = false;
    }
}

async function addPOI(latlng, options = {}) {
    if (!map || !poiNameInput || !poiObjectHeightInputEl || !poiTerrainElevationInputEl || !poiFinalAltitudeDisplayEl || !targetPoiSelect || !multiTargetPoiSelect ) return;

    const isImport = options.id !== undefined;
    const poiIdToUse = isImport ? options.id : poiCounter;

    const name = options.name !== undefined ? options.name : (poiNameInput.value.trim() || `POI ${poiIdToUse}`);
    const objectHeight = options.objectHeightAboveGround !== undefined ? options.objectHeightAboveGround : (parseFloat(poiObjectHeightInputEl.value) || 0);
    
    const newPoi = {
        id: poiIdToUse,
        name: name,
        latlng: L.latLng(latlng.lat, latlng.lng),
        altitude: 0, // Inizializzato a 0, sarà calcolato
        terrainElevationMSL: options.terrainElevationMSL !== undefined ? options.terrainElevationMSL : null,
        objectHeightAboveGround: objectHeight,
        marker: null,
        updatePopup: null,
        recalculateFinalAltitude: function() {
            this.altitude = (parseFloat(this.terrainElevationMSL) || 0) + (parseFloat(this.objectHeightAboveGround) || 0);
            if (this === lastActivePoiForTerrainFetch) {
                 if (poiFinalAltitudeDisplayEl) poiFinalAltitudeDisplayEl.textContent = `${this.altitude.toFixed(1)} m`;
                 if (poiTerrainElevationInputEl) poiTerrainElevationInputEl.value = this.terrainElevationMSL !== null ? this.terrainElevationMSL.toFixed(1) : "";
                 if (poiObjectHeightInputEl) poiObjectHeightInputEl.value = this.objectHeightAboveGround;
                 if (poiTerrainElevationInputEl) poiTerrainElevationInputEl.readOnly = this.terrainElevationMSL !== null;
            }
            if (this.updatePopup) this.updatePopup();
            if (typeof updateAllPoiDependentElements === "function") updateAllPoiDependentElements(this.id); 
        }
    };
    
    if (!isImport) { 
        lastActivePoiForTerrainFetch = newPoi;
        poiCounter++;
        if(poiObjectHeightInputEl) poiObjectHeightInputEl.value = newPoi.objectHeightAboveGround;
        if(poiTerrainElevationInputEl) {
            poiTerrainElevationInputEl.value = ""; 
            poiTerrainElevationInputEl.readOnly = true;
        }
    }

    const markerIconHtml = () => `<div style="background: #f39c12; color: white; border-radius: 50%; width: 22px; height: 22px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 9px; font-weight: bold; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3); line-height:1.1;">🎯<span style="font-size:7px; margin-top: -1px;">${newPoi.altitude.toFixed(0)}m</span></div>`;
    
    const marker = L.marker(newPoi.latlng, { 
        draggable: true, 
        icon: L.divIcon({ className: 'poi-marker', html: markerIconHtml(), iconSize: [22,22], iconAnchor: [11,11]})
    }).addTo(map);
    
    const updatePoiPopupContent = () => { 
        return `<strong>${newPoi.name}</strong> (ID: ${newPoi.id})<br>
                <div style="font-size:0.9em; line-height:1.3;">
                ${translate('poiFinalAltitudeListLabel')}: ${newPoi.altitude.toFixed(1)} m<br>
                ${translate('poiTerrainElevListLabel')}: ${newPoi.terrainElevationMSL !== null ? newPoi.terrainElevationMSL.toFixed(1) + " m" : "N/A"}<br>
                ${translate('poiObjectHeightListLabel')}: ${newPoi.objectHeightAboveGround.toFixed(1)} m
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
    
    if (newPoi.terrainElevationMSL === null && !options.calledFromLoad) {
        await fetchAndUpdatePoiTerrainElevation(newPoi);
    } else {
        newPoi.recalculateFinalAltitude();
    }

    if (options.calledFromLoad !== true) {
        updatePOIList(); 
        updateFlightStatistics();
        poiNameInput.value = ''; 
    }
}

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

        if (pois.length === 0) {
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
        populatePoiSelectDropdown(targetPoiSelect, selectedWaypoint.targetPoiId, true, translate('selectPoiForHeadingDropdown'));
    }
    if (multiWaypointEditControlsDiv && multiWaypointEditControlsDiv.style.display === 'block' &&
        multiHeadingControlSelect && multiHeadingControlSelect.value === 'poi_track') {
        populatePoiSelectDropdown(multiTargetPoiSelect, multiTargetPoiSelect.value || null, true, translate('multiEditSelectPoiDropdown'));
    }
    if (orbitModalOverlayEl && orbitModalOverlayEl.style.display === 'flex') {
        populatePoiSelectDropdown(orbitPoiSelectEl, orbitPoiSelectEl.value || null, false);
    }
}
