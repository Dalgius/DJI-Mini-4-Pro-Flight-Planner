// File: poiManager.js

// Depends on: config.js, uiUpdater.js (updatePOIList, updateFlightStatistics, populatePoiSelectDropdown, updateWaypointList), utils.js (showCustomAlert)

/**
 * Adds a new Point of Interest (POI) to the map and list.
 * @param {L.LatLng} latlng - The latitude and longitude of the POI.
 */
function addPOI(latlng) {
    if (!map || !poiNameInput || !targetPoiSelect || !multiTargetPoiSelect) return;

    // Se l'array pois è vuoto e poiCounter è > 1 (ad es. dopo aver cancellato tutti i POI),
    // resettalo a 1 per ricominciare la numerazione.
    // Questo è un controllo aggiuntivo, il reset principale dopo cancellazione avviene in deletePOI.
    if (pois.length === 0 && poiCounter > 1) {
        // Questa condizione ora è meno probabile che si verifichi qui se deletePOI resetta correttamente,
        // ma la lasciamo come ulteriore sicurezza o per casi di inizializzazione particolari.
        // La logica principale di reset dopo cancellazione è in deletePOI.
    }
    // Se pois è vuoto, assicurati che il PRIMO POI aggiunto usi l'ID corretto partendo da poiCounter (che dovrebbe essere 1).
    // Il poiCounter globale viene incrementato. Se viene resettato (es. clearWaypoints), va bene.
    // Questa logica è più per quando si aggiunge il primo POI in assoluto o dopo un reset.

    const name = poiNameInput.value.trim() || `POI ${poiCounter}`;
    const newPoi = {
        id: poiCounter++, // Usa poiCounter globale e poi incrementa
        name: name,
        latlng: L.latLng(latlng.lat, latlng.lng),
        altitude: 0,
        marker: null
    };

    const markerIcon = L.divIcon({
        className: 'poi-marker',
        html: `<div style="background: #f39c12; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">🎯</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    const marker = L.marker(newPoi.latlng, { draggable: true, icon: markerIcon }).addTo(map);
    marker.bindPopup(`<strong>${newPoi.name}</strong> (ID: ${newPoi.id})`);
    marker.on('dragend', () => {
        newPoi.latlng = marker.getLatLng();
    });
    newPoi.marker = marker;

    pois.push(newPoi);

    updatePOIList();
    updateFlightStatistics();

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

        // !!! NUOVA LOGICA PER RESETTARE poiCounter !!!
        if (pois.length === 0) {
            poiCounter = 1; // Resetta il contatore se non ci sono più POI
            console.log("All POIs deleted. poiCounter reset to 1.");
        }
        // !!! FINE NUOVA LOGICA !!!

        updatePOIList();
        updateFlightStatistics();

        let waypointsUpdated = false;
        waypoints.forEach(wp => {
            if (wp.targetPoiId === poiId) {
                wp.targetPoiId = null;
                if (selectedWaypoint && selectedWaypoint.id === wp.id) {
                    if (targetPoiForHeadingGroupDiv) targetPoiForHeadingGroupDiv.style.display = 'none';
                    populatePoiSelectDropdown(targetPoiSelect, null, true, "-- Select POI for Heading --");
                }
                waypointsUpdated = true;
            }
        });

        if (waypointsUpdated) {
            updateWaypointList();
        }

        if (selectedWaypoint && headingControlSelect && headingControlSelect.value === 'poi_track') {
            populatePoiSelectDropdown(targetPoiSelect, selectedWaypoint.targetPoiId, true, "-- Select POI for Heading --");
        }
        if (multiWaypointEditControlsDiv && multiWaypointEditControlsDiv.style.display === 'block' &&
            multiHeadingControlSelect && multiHeadingControlSelect.value === 'poi_track') {
            populatePoiSelectDropdown(multiTargetPoiSelect, null, true, "-- Select POI for all --");
        }
        if (orbitModalOverlayEl && orbitModalOverlayEl.style.display === 'flex') {
            populatePoiSelectDropdown(orbitPoiSelectEl, orbitPoiSelectEl.value || null, false);
            if (orbitPoiSelectEl.options.length === 0 || (orbitPoiSelectEl.options.length === 1 && orbitPoiSelectEl.options[0].value === "")) {
                // Potrebbe essere utile un feedback all'utente qui
            }
        }

        showCustomAlert(`POI "${deletedPoi.name}" deleted.`, "Info");
    } else {
        showCustomAlert(`POI with ID ${poiId} not found.`, "Error");
    }
}
