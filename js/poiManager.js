// File: poiManager.js

// Depends on: config.js, uiUpdater.js (updatePOIList, updateFlightStatistics, populatePoiSelectDropdown, updateWaypointList), utils.js (showCustomAlert)
// Depends on: mapManager.js (for updateMarkerIconStyle)

/**
 * Adds a new Point of Interest (POI) to the map and list.
 * @param {L.LatLng} latlng - The latitude and longitude of the POI.
 */
function addPOI(latlng) {
    // MODIFIED: Added poiAltitudeInputEl to the check
    if (!map || !poiNameInput || !targetPoiSelect || !multiTargetPoiSelect || !poiAltitudeInputEl) return;

    const name = poiNameInput.value.trim() || `POI ${poiCounter}`;
    // MODIFIED: Read altitude from the new input field, default to 0 if invalid
    const altitude = parseFloat(poiAltitudeInputEl.value);
    const poiAltitudeMSL = !isNaN(altitude) ? altitude : 0;


    const newPoi = {
        id: poiCounter++, 
        name: name,
        latlng: L.latLng(latlng.lat, latlng.lng),
        altitude: poiAltitudeMSL, // Store the altitude (interpreted as MSL)
        marker: null,
        updatePopup: null // Placeholder for a function to update its own popup
    };

    const markerIcon = L.divIcon({
        className: 'poi-marker',
        html: `<div style="background: #f39c12; color: white; border-radius: 50%; width: 22px; height: 22px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 9px; font-weight: bold; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3); line-height:1.1;">🎯<span style="font-size:7px; margin-top: -1px;">${newPoi.altitude}m</span></div>`,
        iconSize: [22, 22], 
        iconAnchor: [11, 11]
    });

    const marker = L.marker(newPoi.latlng, { draggable: true, icon: markerIcon }).addTo(map);
    
    const updatePoiPopupContent = () => {
        return `<strong>${newPoi.name}</strong> (ID: ${newPoi.id})<br>Alt: ${newPoi.altitude} m MSL`;
    };
    
    marker.bindPopup(updatePoiPopupContent()); // Initial bind

    marker.on('dragend', () => {
        newPoi.latlng = marker.getLatLng();
        waypoints.forEach(wp => {
            if (wp.headingControl === 'poi_track' && wp.targetPoiId === newPoi.id) {
                updateMarkerIconStyle(wp); 
            }
        });
    });
    // Store a reference to update the popup if altitude changes via the list input
    newPoi.updatePopup = () => {
        marker.setPopupContent(updatePoiPopupContent());
         marker.setIcon(L.divIcon({ // Also update the icon text
            className: 'poi-marker',
            html: `<div style="background: #f39c12; color: white; border-radius: 50%; width: 22px; height: 22px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 9px; font-weight: bold; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3); line-height:1.1;">🎯<span style="font-size:7px; margin-top: -1px;">${newPoi.altitude}m</span></div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
        }));
    };
    newPoi.marker = marker;

    pois.push(newPoi);

    updatePOIList(); // This will now handle the input field in the list
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
    // poiAltitudeInputEl.value = '0'; // Optionally reset default POI altitude
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
