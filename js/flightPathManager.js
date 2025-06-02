// File: flightPathManager.js

// Depends on: config.js, utils.js, uiUpdater.js (for updateFlightStatistics), waypointManager.js 
// Depends on: mapManager.js (for createWaypointIcon, updateMarkerIconStyle)

/**
 * Updates or redraws the flight path on the map based on current waypoints and path type.
 */
function updateFlightPath() {
    if (!map || !pathTypeSelect) return;

    if (flightPath) {
        flightPath.off('click', handlePathClick); 
        map.removeLayer(flightPath);
        flightPath = null;
    }

    if (waypoints.length < 2) {
        updateFlightStatistics(); 
        return;
    }

    const currentPathType = pathTypeSelect.value;
    const latlngsArrays = waypoints.map(wp => [wp.latlng.lat, wp.latlng.lng]);

    let displayPathCoords;
    if (currentPathType === 'curved' && latlngsArrays.length >= 2) { 
        displayPathCoords = createSmoothPath(latlngsArrays); 
    } else {
        displayPathCoords = latlngsArrays; 
    }

    flightPath = L.polyline(displayPathCoords, {
        color: '#3498db',
        weight: 5, 
        opacity: 0.8,
        dashArray: currentPathType === 'curved' ? null : '5, 5' 
    }).addTo(map);

    flightPath.on('click', handlePathClick);

    updateFlightStatistics();
    // Path changes can affect 'auto' headings, so update all waypoint markers
    // This is a broad update; more targeted updates are in waypointManager for specific actions.
    // Consider if this is too frequent or if specific actions cover it well enough.
    // For now, specific actions in waypointManager and eventListeners should cover most cases.
    // If issues persist, uncommenting this is an option:
    // waypoints.forEach(wp => updateMarkerIconStyle(wp)); 
}

/**
 * Handles clicks on the flight path to insert a new waypoint.
 * @param {L.LeafletMouseEvent} e - The Leaflet mouse event from clicking the path.
 */
function handlePathClick(e) {
    L.DomEvent.stopPropagation(e); 
    const clickedLatLng = e.latlng;

    if (waypoints.length < 2) return; 

    let insertAfterWaypointIndex = -1;
    let minDistanceToProjectedPoint = Infinity;
    let insertionPointLatLng = clickedLatLng; // Default to actual click

    for (let i = 0; i < waypoints.length - 1; i++) {
        const p1 = waypoints[i].latlng;
        const p2 = waypoints[i + 1].latlng;
        let dist;
        if (L.GeometryUtil && typeof L.GeometryUtil.closestOnSegment === 'function') {
            const closestPointOnSegment = L.GeometryUtil.closestOnSegment(map, L.polyline([p1,p2]), clickedLatLng);
            dist = clickedLatLng.distanceTo(closestPointOnSegment);
            if (dist < minDistanceToProjectedPoint) {
                 minDistanceToProjectedPoint = dist;
                 insertAfterWaypointIndex = i;
                 insertionPointLatLng = closestPointOnSegment; // Use the projected point
            }
        } else { // Fallback if GeometryUtil is not available or for simpler logic
            const midPoint = L.latLng((p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2);
            dist = clickedLatLng.distanceTo(midPoint);
             if (dist < minDistanceToProjectedPoint) {
                minDistanceToProjectedPoint = dist;
                insertAfterWaypointIndex = i;
                insertionPointLatLng = clickedLatLng; // Use original click if no projection
            }
        }
    }

    if (insertAfterWaypointIndex !== -1) {
        const wp1 = waypoints[insertAfterWaypointIndex];
        const wp2 = waypoints[insertAfterWaypointIndex + 1];
        let newWpAltitude = wp1.altitude; 

        if (wp1 && wp2) { 
            const distToWp1 = insertionPointLatLng.distanceTo(wp1.latlng);
            const segmentLength = wp1.latlng.distanceTo(wp2.latlng);
            if (segmentLength > 0) {
                const ratio = Math.min(1, Math.max(0, distToWp1 / segmentLength)); 
                newWpAltitude = wp1.altitude + (wp2.altitude - wp1.altitude) * ratio;
            }
        }
        newWpAltitude = Math.round(Math.max(5, newWpAltitude)); 

        // Create the new waypoint object (will be fully setup by addWaypoint logic)
        const newWaypointOptions = {
            altitude: newWpAltitude,
            // gimbalPitch, hoverTime etc. will use defaults from addWaypoint
        };
        
        // We need to manually create the waypoint object and marker here
        // because addWaypoint pushes to the end.
        const newWpId = waypointCounter++;
        const newWaypoint = {
            id: newWpId,
            latlng: insertionPointLatLng,
            altitude: newWpAltitude,
            hoverTime: 0, 
            gimbalPitch: parseInt(gimbalPitchSlider ? gimbalPitchSlider.value : 0), 
            headingControl: 'auto',
            fixedHeading: 0,
            cameraAction: 'none',
            targetPoiId: null,
            marker: null
        };

        waypoints.splice(insertAfterWaypointIndex + 1, 0, newWaypoint);

        // Create marker after inserting into array so 'auto' heading can find neighbors
        const isHome = waypoints.length > 0 && newWaypoint.id === waypoints[0].id; // Check if it became the home point
        const marker = L.marker(newWaypoint.latlng, {
            draggable: true,
            icon: createWaypointIcon(newWaypoint, false, false, isHome)
        }).addTo(map);
        
        marker.on('click', (ev) => { L.DomEvent.stopPropagation(ev); selectWaypoint(newWaypoint); });
        marker.on('dragend', () => {
            newWaypoint.latlng = marker.getLatLng();
            updateFlightPath();
            updateFlightStatistics();
            updateWaypointList();
            updateMarkerIconStyle(newWaypoint); // Update self
            const currentIndex = waypoints.findIndex(wp => wp.id === newWaypoint.id);
            if (currentIndex > 0 && waypoints[currentIndex-1].headingControl === 'auto') {
                updateMarkerIconStyle(waypoints[currentIndex-1]); // Update previous
            }
            if (currentIndex < waypoints.length - 1 && waypoints[currentIndex+1].headingControl === 'auto') {
                // Next waypoint's auto heading doesn't change based on *this* one moving, but its *own* next.
                // However, if this current one is the one *before* the next, this marker update is sufficient.
            }
        });
        marker.on('drag', () => {
            newWaypoint.latlng = marker.getLatLng();
            updateFlightPath(); 
        });
        newWaypoint.marker = marker;

        // Update heading of the waypoint BEFORE the newly inserted one if it's 'auto'
        if (insertAfterWaypointIndex >= 0 && waypoints[insertAfterWaypointIndex].headingControl === 'auto') {
            updateMarkerIconStyle(waypoints[insertAfterWaypointIndex]);
        }
        // The new waypoint itself will be updated by selectWaypoint call.
        // The waypoint AFTER the newly inserted one (if 'auto') does not need its heading updated
        // as its "next" waypoint hasn't changed relative to itself.

        updateWaypointList();
        updateFlightPath(); 
        updateFlightStatistics();
        selectWaypoint(newWaypoint); 

        showCustomAlert(`Waypoint ${newWaypoint.id} inserted.`, "Info");
    } else {
        showCustomAlert("Could not determine insertion point on the path.", "Error");
    }
}
