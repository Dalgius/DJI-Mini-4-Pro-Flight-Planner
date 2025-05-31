// File: flightPathManager.js

// Depends on: config.js, utils.js, uiUpdater.js (for updateFlightStatistics), waypointManager.js (for addWaypoint, selectWaypoint, waypoint specifics for altitude interpolation)
// Depends on: mapManager.js (for createWaypointIcon)

/**
 * Updates or redraws the flight path on the map based on current waypoints and path type.
 */
function updateFlightPath() {
    if (!map || !pathTypeSelect) return;

    // Remove existing flight path if any
    if (flightPath) {
        flightPath.off('click', handlePathClick); // Remove old listener
        map.removeLayer(flightPath);
        flightPath = null;
    }

    if (waypoints.length < 2) {
        updateFlightStatistics(); // Still update stats (e.g., distance becomes 0)
        return;
    }

    const currentPathType = pathTypeSelect.value;
    const latlngsArrays = waypoints.map(wp => [wp.latlng.lat, wp.latlng.lng]);

    let displayPathCoords;
    if (currentPathType === 'curved' && latlngsArrays.length >= 2) { // Need at least 2 for Catmull-Rom, though 3+ is ideal for curves
        displayPathCoords = createSmoothPath(latlngsArrays); // createSmoothPath is from utils.js
    } else {
        displayPathCoords = latlngsArrays; // For straight path or less than 2 points for curve (effectively straight)
    }

    flightPath = L.polyline(displayPathCoords, {
        color: '#3498db',
        weight: 5, // Increased weight for easier clicking
        opacity: 0.8,
        dashArray: currentPathType === 'curved' ? null : '5, 5' // Dashed for straight, solid for curved
    }).addTo(map);

    // Add click listener to the new path for inserting waypoints
    flightPath.on('click', handlePathClick);

    updateFlightStatistics();
}

/**
 * Handles clicks on the flight path to insert a new waypoint.
 * @param {L.LeafletMouseEvent} e - The Leaflet mouse event from clicking the path.
 */
function handlePathClick(e) {
    L.DomEvent.stopPropagation(e); // Prevent map click event
    const clickedLatLng = e.latlng;

    if (waypoints.length < 2) return; // Need at least two waypoints to define a path segment

    let closestSegmentIndex = -1;
    let insertionPointLatLng = clickedLatLng; // Default to actual click if using simple logic
    let minDistanceToProjectedPoint = Infinity;


    // Find the segment and the closest point on that segment to the click
    // This uses Leaflet.GeometryUtil if available, otherwise a simpler approach.
    // For simplicity in this example, we'll find the segment whose line is closest to the click,
    // and use the clicked point itself as the insertion point.
    // A more robust solution would project the click onto the segment.

    let insertAfterWaypointIndex = -1;

    // Iterate through segments defined by original waypoints
    for (let i = 0; i < waypoints.length - 1; i++) {
        const p1 = waypoints[i].latlng;
        const p2 = waypoints[i + 1].latlng;

        // Using Leaflet.GeometryUtil.closestOnSegment if available
        // For now, let's use a simpler distance to segment midpoint logic as a placeholder
        // or assume the path itself is made of straight segments for click detection.
        // For simplicity, find the segment where the click is "between" waypoints or closest to the segment line.
        // A proper solution requires projecting the point onto each segment line.

        // Let's find the closest *original* segment to the clicked point on the *rendered* path.
        // The `e.latlng` is already the point on the rendered path.
        // We need to find which original segment this point on the rendered path corresponds to.

        // Simplified: find the original waypoint that is closest BEFORE the click along the path.
        // This is tricky with curved paths. For now, let's use a simple distance to the original segment lines.
        let dist;
        if (L.GeometryUtil && typeof L.GeometryUtil.distanceToSegment === 'function') {
            dist = L.GeometryUtil.distanceToSegment(map, L.polyline([p1,p2]), clickedLatLng);
        } else {
            // Fallback: distance to midpoint of segment (very rough)
            const midPoint = L.latLng((p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2);
            dist = clickedLatLng.distanceTo(midPoint);
        }


        if (dist < minDistanceToProjectedPoint) {
            minDistanceToProjectedPoint = dist;
            insertAfterWaypointIndex = i;
            // If using L.GeometryUtil.closestOnSegment, insertionPointLatLng would be the result of that.
            // For now, we use e.latlng given by the click on the polyline.
            insertionPointLatLng = e.latlng;
        }
    }


    if (insertAfterWaypointIndex !== -1) {
        // Interpolate altitude (simple linear interpolation based on distance)
        const wp1 = waypoints[insertAfterWaypointIndex];
        const wp2 = waypoints[insertAfterWaypointIndex + 1];
        let newWpAltitude = wp1.altitude; // Default to first waypoint's altitude

        if (wp1 && wp2) { // Ensure both waypoints exist
            const distToWp1 = insertionPointLatLng.distanceTo(wp1.latlng);
            const segmentLength = wp1.latlng.distanceTo(wp2.latlng);

            if (segmentLength > 0) {
                const ratio = Math.min(1, Math.max(0, distToWp1 / segmentLength)); // Clamp ratio between 0 and 1
                newWpAltitude = wp1.altitude + (wp2.altitude - wp1.altitude) * ratio;
            }
        }
        newWpAltitude = Math.round(Math.max(5, newWpAltitude)); // Ensure min altitude and round

        // Create the new waypoint object
        const newWaypointData = {
            latlng: insertionPointLatLng,
            altitude: newWpAltitude,
            // Other properties will be set by addWaypoint function (hoverTime, gimbalPitch, etc.)
        };

        // Insert the new waypoint into the waypoints array
        // addWaypoint will create the marker and push to array, so we need to manage insertion.
        // Let's modify addWaypoint slightly or create a new function insertWaypointAt.
        // For now, let's adapt by creating the waypoint object and then splicing it in.

        const newWpId = waypointCounter++; // Get next ID from global counter
        const newWaypoint = {
            id: newWpId,
            latlng: insertionPointLatLng,
            altitude: newWpAltitude,
            hoverTime: 0, // Default, or from defaultHoverTimeSlider if exists
            gimbalPitch: parseInt(gimbalPitchSlider ? gimbalPitchSlider.value : 0), // Default, or from defaultGimbalPitchSlider
            headingControl: 'auto',
            fixedHeading: 0,
            cameraAction: 'none',
            targetPoiId: null,
            marker: null // Will be created
        };

        // Add marker for the new waypoint
        const marker = L.marker(newWaypoint.latlng, {
            draggable: true,
            icon: createWaypointIcon(newWaypoint.id, false) // createWaypointIcon from mapManager.js
        }).addTo(map);

        marker.on('click', (ev) => { L.DomEvent.stopPropagation(ev); selectWaypoint(newWaypoint); });
        marker.on('dragend', () => {
            newWaypoint.latlng = marker.getLatLng();
            updateFlightPath();
            updateFlightStatistics();
            updateWaypointList();
        });
        marker.on('drag', () => {
            newWaypoint.latlng = marker.getLatLng();
            updateFlightPath(); // Live update path while dragging
        });
        newWaypoint.marker = marker;

        waypoints.splice(insertAfterWaypointIndex + 1, 0, newWaypoint);

        // Update UI
        updateWaypointList();
        updateFlightPath(); // Redraw path with new waypoint
        updateFlightStatistics();
        selectWaypoint(newWaypoint); // Select the newly added waypoint

        showCustomAlert(`Waypoint ${newWaypoint.id} inserted into flight path.`, "Info");
    } else {
        showCustomAlert("Could not determine insertion point on the path.", "Error");
    }
}