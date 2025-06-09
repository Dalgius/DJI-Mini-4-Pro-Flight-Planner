// File: orbitManager.js

// Depends on: config.js, utils.js (calculateRequiredGimbalPitch), uiUpdater.js (populatePoiSelectDropdown),
// waypointManager.js (addWaypoint), mapManager.js (fitMapToWaypoints), i18n.js (translate)

function showOrbitDialog() {
    if (!orbitModalOverlayEl || !orbitPoiSelectEl || !orbitRadiusInputEl || !orbitPointsInputEl) {
        console.error("Orbit modal elements not found in DOM cache!");
        showCustomAlert(translate('errorTitle'), "Orbit dialog cannot be displayed due to missing elements."); 
        return;
    }
    if (pois.length === 0) {
        showCustomAlert(translate('errorTitle'), "Add at least one POI before creating an orbit."); 
        return;
    }
    populatePoiSelectDropdown(orbitPoiSelectEl, null, false); 
    if (pois.length > 0 && orbitPoiSelectEl.options.length > 0) {
        orbitPoiSelectEl.value = pois[0].id;
    } else {
        showCustomAlert(translate('errorTitle'), "No POIs available to select for orbit."); 
        return; 
    }
    orbitRadiusInputEl.value = "30"; 
    orbitPointsInputEl.value = "8";  
    orbitModalOverlayEl.style.display = 'flex';
}

function handleConfirmOrbit() {
    if (!orbitPoiSelectEl || !orbitRadiusInputEl || !orbitPointsInputEl || !defaultAltitudeSlider || !homeElevationMslInput) { 
        showCustomAlert(translate('errorTitle'), "Orbit creation failed: essential control elements missing."); 
        return;
    }
    const targetPoiId = parseInt(orbitPoiSelectEl.value);
    const radius = parseFloat(orbitRadiusInputEl.value);
    const numPoints = parseInt(orbitPointsInputEl.value);
    const altitudeForOrbitWpsRel = parseInt(defaultAltitudeSlider.value); 
    const targetPoi = pois.find(p => p.id === targetPoiId);
    if (!targetPoi) {
        showCustomAlert(translate('errorTitle'), "Invalid POI selected for orbit. Please select a valid POI."); 
        return;
    }
    if (isNaN(radius) || radius <= 0.1) {
        showCustomAlert(translate('inputErrorTitle'), "Invalid radius. Must be a positive number greater than 0.1m."); 
        return;
    }
    if (isNaN(numPoints) || numPoints < 3) { 
        showCustomAlert(translate('inputErrorTitle'), "Invalid number of points. Minimum of 3 required for orbit."); 
        return;
    }
    generateOrbitWaypoints(targetPoi, radius, numPoints, altitudeForOrbitWpsRel);
    if (orbitModalOverlayEl) orbitModalOverlayEl.style.display = 'none'; 
}

function generateOrbitWaypoints(centerPoi, radius, numPoints, altitudeRelToHome) {
    const homeElevation = parseFloat(homeElevationMslInput.value) || 0; 
    const orbitWpAMSL = homeElevation + altitudeRelToHome;
    const poiAMSL = centerPoi.altitude;

    const calculatedGimbalPitch = calculateRequiredGimbalPitch(orbitWpAMSL, poiAMSL, radius);

    for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI; 
        const latRad = toRad(centerPoi.latlng.lat); 
        const lngRad = toRad(centerPoi.latlng.lng); 

        const pointLatRad = Math.asin(Math.sin(latRad) * Math.cos(radius / R_EARTH) +
                                    Math.cos(latRad) * Math.sin(radius / R_EARTH) * Math.cos(angle));
        const pointLngRad = lngRad + Math.atan2(Math.sin(angle) * Math.sin(radius / R_EARTH) * Math.cos(latRad),
                                             Math.cos(radius / R_EARTH) - Math.sin(latRad) * Math.sin(pointLatRad));

        const pointLat = pointLatRad * 180 / Math.PI; 
        const pointLng = pointLngRad * 180 / Math.PI; 

        const wpLatlng = L.latLng(pointLat, pointLng);

        const waypointOptions = {
            altitude: altitudeRelToHome, 
            headingControl: 'poi_track', 
            targetPoiId: centerPoi.id,
            gimbalPitch: calculatedGimbalPitch,
            waypointType: 'orbit' 
        };

        addWaypoint(wpLatlng, waypointOptions);
    }

    fitMapToWaypoints(); 
    showCustomAlert(`${numPoints} orbit waypoints created around ${centerPoi.name}. Gimbal Pitch: ${calculatedGimbalPitch}°`, "Orbit Created"); 
}
