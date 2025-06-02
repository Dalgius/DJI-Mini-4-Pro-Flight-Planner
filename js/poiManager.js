// File: poiManager.js

// Depends on: config.js, uiUpdater.js (updatePOIList, updateFlightStatistics, populatePoiSelectDropdown, updateWaypointList), utils.js (showCustomAlert)
// Depends on: mapManager.js (for updateMarkerIconStyle)

/**
 * Adds a new Point of Interest (POI) to the map and list.
 * @param {L.LatLng} latlng - The latitude and longitude of the POI.
 */
function addPOI(latlng) {
    if (!map || !poiNameInput || !targetPoiSelect || !multiTargetPoiSelect) return;

    if (pois.length === 0 && poiCounter > 1) {
        // This reset is more robustly handled in deletePOI if all are cleared.
    }

    const name = poiNameInput.value.trim() || `POI ${poiCounter}`;
    const newPoi = {
        id: poiCounter++, 
        name: name,
        latlng: L.latLng(latlng.lat, latlng.lng),
        altitude: 0, // Default POI altitude, can be made configurable if needed
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
        // When POI moves, update heading indicators of waypoints targeting it
        waypoints.forEach(wp => {
            if (wp.headingControl === 'poi_track' && wp.targetPoiId === newPoi.id) {
                updateMarkerIconStyle(wp); // from mapManager.js
            }
        });
    });
    newPoi.marker = marker;

    pois.push(newPoi);

    updatePOIList();
    updateFlightStatistics();

    // Refresh POI selection dropdowns
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

        if (pois.length === 0) {
            poiCounter = 1; 
            console.log("All POIs deleted. poiCounter reset to 1.");
        }

        updatePOIList();
        updateFlightStatistics();

        let waypointsUpdatedForDisplay = false;
        waypoints.forEach(wp => {
            if (wp.targetPoiId === poiId) {
                wp.targetPoiId = null; // Clear target
                // If this waypoint is currently selected, update its UI controls
                if (selectedWaypoint && selectedWaypoint.id === wp.id) {
                    if(headingControlSelect) headingControlSelect.value = 'auto'; // Default back or to 'fixed'
                    if(targetPoiForHeadingGroupDiv) targetPoiForHeadingGroupDiv.style.display = 'none';
                    populatePoiSelectDropdown(targetPoiSelect, null, true, "-- Select POI for Heading --");
                }
                updateMarkerIconStyle(wp); // Update its heading indicator
                waypointsUpdatedForDisplay = true;
            }
        });

        if (waypointsUpdatedForDisplay) {
            updateWaypointList(); // Refresh list if any waypoint text changed (e.g. target POI name)
        }

        // Refresh POI selection dropdowns as the deleted POI is no longer an option
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
    } else {
        showCustomAlert(`POI with ID ${poiId} not found.`, "Error");
    }
}
