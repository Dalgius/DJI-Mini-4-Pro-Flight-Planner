// File: orbitManager.js

// Depends on: config.js, utils.js, uiUpdater.js (populatePoiSelectDropdown), waypointManager.js (addWaypoint, selectWaypoint for updating UI if new orbit WPs are selected)
// Depends on: mapManager.js (fitMapToWaypoints)

/**
 * Displays the orbit creation dialog.
 */
function showOrbitDialog() {
    if (!orbitModalOverlayEl || !orbitPoiSelectEl || !orbitRadiusInputEl || !orbitPointsInputEl) {
        console.error("Orbit modal elements not found in DOM cache!");
        showCustomAlert("Orbit dialog cannot be displayed due to missing elements.", "Internal Error");
        return;
    }

    if (pois.length === 0) {
        showCustomAlert("Add at least one POI before creating an orbit.", "Orbit Error");
        return;
    }

    populatePoiSelectDropdown(orbitPoiSelectEl, null, false); // Populate without a default "-- Select --"

    // Pre-select the first POI if available
    if (pois.length > 0 && orbitPoiSelectEl.options.length > 0) {
        orbitPoiSelectEl.value = pois[0].id;
    } else {
        // This case should ideally be caught by the pois.length === 0 check above,
        // but as a fallback:
        showCustomAlert("No POIs available to select for orbit.", "Orbit Error");
        return; // Don't show dialog if no POIs to select
    }

    // Set default values for radius and points
    orbitRadiusInputEl.value = "30"; // Default radius in meters
    orbitPointsInputEl.value = "8";  // Default number of orbit waypoints

    orbitModalOverlayEl.style.display = 'flex';
}

/**
 * Handles the confirmation of orbit creation from the dialog.
 */
function handleConfirmOrbit() {
    if (!orbitPoiSelectEl || !orbitRadiusInputEl || !orbitPointsInputEl || !defaultAltitudeSlider) {
        showCustomAlert("Orbit creation failed: essential control elements are missing.", "Internal Error");
        return;
    }

    const targetPoiId = parseInt(orbitPoiSelectEl.value);
    const radius = parseFloat(orbitRadiusInputEl.value);
    const numPoints = parseInt(orbitPointsInputEl.value);
    const altitudeForOrbitWps = parseInt(defaultAltitudeSlider.value); // Use default mission altitude for orbit WPs

    const targetPoi = pois.find(p => p.id === targetPoiId);

    if (!targetPoi) {
        showCustomAlert("Invalid POI selected for orbit. Please select a valid POI.", "Orbit Error");
        return;
    }
    if (isNaN(radius) || radius <= 0) {
        showCustomAlert("Invalid radius. Must be a positive number.", "Orbit Error");
        return;
    }
    if (isNaN(numPoints) || numPoints < 3) { // Minimum 3 points for a somewhat meaningful orbit
        showCustomAlert("Invalid number of points. Minimum 3 required for orbit.", "Orbit Error");
        return;
    }

    generateOrbitWaypoints(targetPoi, radius, numPoints, altitudeForOrbitWps);

    if (orbitModalOverlayEl) orbitModalOverlayEl.style.display = 'none'; // Hide the modal
}

/**
 * Generates and adds waypoints for an orbit around a central POI.
 * @param {object} centerPoi - The POI object to orbit around.
 * @param {number} radius - The radius of the orbit in meters.
 * @param {number} numPoints - The number of waypoints to generate for the orbit.
 * @param {number} altitude - The altitude (relative to takeoff) for the orbit waypoints.
 */
function generateOrbitWaypoints(centerPoi, radius, numPoints, altitude) {
    // R_EARTH is defined in config.js

    for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI; // Angle in radians for the current point

        const latRad = toRad(centerPoi.latlng.lat); // Convert center POI lat to radians
        const lngRad = toRad(centerPoi.latlng.lng); // Convert center POI lng to radians

        // Calculate destination point given distance and bearing from start point
        // Formula for destination point given distance and bearing from start point:
        // lat2 = asin(sin(lat1)*cos(d/R) + cos(lat1)*sin(d/R)*cos(brng))
        // lon2 = lon1 + atan2(sin(brng)*sin(d/R)*cos(lat1), cos(d/R)-sin(lat1)*sin(lat2))
        // where d is distance, R is Earth's radius, brng is the bearing (angle)

        const pointLatRad = Math.asin(Math.sin(latRad) * Math.cos(radius / R_EARTH) +
                                    Math.cos(latRad) * Math.sin(radius / R_EARTH) * Math.cos(angle));
        const pointLngRad = lngRad + Math.atan2(Math.sin(angle) * Math.sin(radius / R_EARTH) * Math.cos(latRad),
                                             Math.cos(radius / R_EARTH) - Math.sin(latRad) * Math.sin(pointLatRad));

        const pointLat = pointLatRad * 180 / Math.PI; // Convert back to degrees
        const pointLng = pointLngRad * 180 / Math.PI; // Convert back to degrees

        const wpLatlng = L.latLng(pointLat, pointLng);

        // Define options for the new waypoint
        const waypointOptions = {
            altitude: altitude,
            headingControl: 'poi_track', // Orbit waypoints should track the center POI
            targetPoiId: centerPoi.id,
            gimbalPitch: parseInt(gimbalPitchSlider ? gimbalPitchSlider.value : 0) // Use current default gimbal pitch
            // hoverTime, cameraAction can be defaults or set if needed
        };

        // Add the waypoint using the waypointManager's addWaypoint function
        addWaypoint(wpLatlng, waypointOptions);
    }

    fitMapToWaypoints(); // Adjust map view to include the new orbit waypoints
    showCustomAlert(`${numPoints} orbit waypoints created around ${centerPoi.name}.`, "Orbit Created");
}