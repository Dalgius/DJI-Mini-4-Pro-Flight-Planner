// File: poiManager.js

// Depends on: config.js, uiUpdater.js (updatePOIList, updateFlightStatistics, populatePoiSelectDropdown, updateWaypointList), utils.js (showCustomAlert)

/**
 * Adds a new Point of Interest (POI) to the map and list.
 * @param {L.LatLng} latlng - The latitude and longitude of the POI.
 */
function addPOI(latlng) {
    if (!map || !poiNameInput || !targetPoiSelect || !multiTargetPoiSelect) return;

    // Reset POI counter if this is the first POI being added after a clear or init
    if (pois.length === 0 && poiCounter > 1) { // If list is empty but counter is high (e.g. after load)
        // Let's make sure poiCounter is at least 1, or the max existing ID + 1 if loading a plan
        // For simple add, if pois is empty, it should be 1.
        // This logic is more relevant during loading a plan.
        // For now, if pois is empty, assume we start fresh for this session's POIs.
        // The main poiCounter is global and increments. If cleared, it should reset.
    }
     // If pois are empty, ensure counter starts at 1 for new POIs
    if (pois.length === 0) {
        // If poiCounter was reset (e.g. by clearWaypoints), it's fine.
        // If it's high from a previous session (without full clear), this might cause ID collision
        // if we don't reset it or check existing max ID.
        // For now, assume poiCounter is managed correctly elsewhere (e.g. reset on clearAll).
        // Let's ensure the first POI uses the current poiCounter.
    }


    const name = poiNameInput.value.trim() || `POI ${poiCounter}`;
    const newPoi = {
        id: poiCounter++, // Use global poiCounter and then increment
        name: name,
        latlng: L.latLng(latlng.lat, latlng.lng),
        altitude: 0, // Default altitude for POI, can be fetched/set later
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
        // If POIs affect anything dynamically (e.g. lines to waypoints), update here
    });
    newPoi.marker = marker;

    pois.push(newPoi);

    updatePOIList(); // Update the list in the sidebar
    updateFlightStatistics(); // Update POI count

    // If a waypoint is selected and its heading is set to POI track,
    // or if multi-edit is active and set to POI_track, refresh the POI dropdowns.
    if (selectedWaypoint && headingControlSelect && headingControlSelect.value === 'poi_track') {
        populatePoiSelectDropdown(targetPoiSelect, selectedWaypoint.targetPoiId, true, "-- Select POI for Heading --");
    }
    if (multiWaypointEditControlsDiv && multiWaypointEditControlsDiv.style.display === 'block' &&
        multiHeadingControlSelect && multiHeadingControlSelect.value === 'poi_track') {
        populatePoiSelectDropdown(multiTargetPoiSelect, null, true, "-- Select POI for all --");
    }
    // Also refresh for orbit dialog if it uses a POI select
    if (orbitModalOverlayEl && orbitModalOverlayEl.style.display === 'flex') {
        populatePoiSelectDropdown(orbitPoiSelectEl, orbitPoiSelectEl.value || null, false);
    }


    poiNameInput.value = ''; // Clear the input field for the next POI
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

        updatePOIList();
        updateFlightStatistics();

        // Check if any waypoints were targeting this POI and clear their target
        let waypointsUpdated = false;
        waypoints.forEach(wp => {
            if (wp.targetPoiId === poiId) {
                wp.targetPoiId = null;
                // If this was the selected waypoint, update its UI controls
                if (selectedWaypoint && selectedWaypoint.id === wp.id) {
                    if (targetPoiForHeadingGroupDiv) targetPoiForHeadingGroupDiv.style.display = 'none';
                    populatePoiSelectDropdown(targetPoiSelect, null, true, "-- Select POI for Heading --");
                    // Potentially reset headingControl if it was poi_track and no POIs left or user preference
                    // selectedWaypoint.headingControl = 'auto'; // Example reset
                }
                waypointsUpdated = true;
            }
        });

        if (waypointsUpdated) {
            updateWaypointList(); // Refresh waypoint list if any targets were cleared
        }

        // Refresh POI dropdowns in active panels
        if (selectedWaypoint && headingControlSelect && headingControlSelect.value === 'poi_track') {
            populatePoiSelectDropdown(targetPoiSelect, selectedWaypoint.targetPoiId, true, "-- Select POI for Heading --");
        }
        if (multiWaypointEditControlsDiv && multiWaypointEditControlsDiv.style.display === 'block' &&
            multiHeadingControlSelect && multiHeadingControlSelect.value === 'poi_track') {
            populatePoiSelectDropdown(multiTargetPoiSelect, null, true, "-- Select POI for all --");
        }
        if (orbitModalOverlayEl && orbitModalOverlayEl.style.display === 'flex') {
            populatePoiSelectDropdown(orbitPoiSelectEl, orbitPoiSelectEl.value || null, false);
             // if orbitPoiSelectEl becomes empty and it was the selected one, handle it
            if (orbitPoiSelectEl.options.length === 0 || (orbitPoiSelectEl.options.length === 1 && orbitPoiSelectEl.options[0].value === "")) {
                 // showCustomAlert("Last POI for orbit selection deleted. Please add POIs.", "Orbit Info");
                 // Potentially disable confirm button or close dialog if no POIs left for orbit.
            }
        }


        showCustomAlert(`POI "${deletedPoi.name}" deleted.`, "Info");
    } else {
        showCustomAlert(`POI with ID ${poiId} not found.`, "Error");
    }
}