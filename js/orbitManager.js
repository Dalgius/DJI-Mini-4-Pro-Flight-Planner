// File: orbitManager.js

// Depends on: config.js, utils.js, uiUpdater.js (populatePoiSelectDropdown), waypointManager.js (addWaypoint, selectWaypoint for updating UI if new orbit WPs are selected)
// Depends on: mapManager.js (fitMapToWaypoints)

/**
 * Displays the orbit creation dialog.
 */
function showOrbitDialog() {
    if (!orbitModalOverlayEl || !orbitPoiSelectEl || !orbitRadiusInputEl || !orbitPointsInputEl) {
        console.error("Orbit modal elements not found in DOM cache!");
        showCustomAlert("La finestra di dialogo Orbita non può essere visualizzata a causa di elementi mancanti.", "Errore Interno"); // Italian
        return;
    }

    if (pois.length === 0) {
        showCustomAlert("Aggiungi almeno un POI prima di creare un'orbita.", "Errore Orbita"); // Italian
        return;
    }

    populatePoiSelectDropdown(orbitPoiSelectEl, null, false); 

    if (pois.length > 0 && orbitPoiSelectEl.options.length > 0) {
        orbitPoiSelectEl.value = pois[0].id;
    } else {
        showCustomAlert("Nessun POI disponibile da selezionare per l'orbita.", "Errore Orbita"); // Italian
        return; 
    }

    orbitRadiusInputEl.value = "30"; 
    orbitPointsInputEl.value = "8";  

    orbitModalOverlayEl.style.display = 'flex';
}

/**
 * Handles the confirmation of orbit creation from the dialog.
 */
function handleConfirmOrbit() {
    if (!orbitPoiSelectEl || !orbitRadiusInputEl || !orbitPointsInputEl || !defaultAltitudeSlider || !homeElevationMslInput) { // Added homeElevationMslInput
        showCustomAlert("Creazione orbita fallita: elementi di controllo essenziali mancanti.", "Errore Interno"); // Italian
        return;
    }

    const targetPoiId = parseInt(orbitPoiSelectEl.value);
    const radius = parseFloat(orbitRadiusInputEl.value);
    const numPoints = parseInt(orbitPointsInputEl.value);
    const altitudeForOrbitWpsRel = parseInt(defaultAltitudeSlider.value); 

    const targetPoi = pois.find(p => p.id === targetPoiId);

    if (!targetPoi) {
        showCustomAlert("POI non valido selezionato per l'orbita. Seleziona un POI valido.", "Errore Orbita"); // Italian
        return;
    }
    if (isNaN(radius) || radius <= 0) {
        showCustomAlert("Raggio non valido. Deve essere un numero positivo.", "Errore Orbita"); // Italian
        return;
    }
    if (isNaN(numPoints) || numPoints < 3) { 
        showCustomAlert("Numero di punti non valido. Minimo 3 richiesti per l'orbita.", "Errore Orbita"); // Italian
        return;
    }

    generateOrbitWaypoints(targetPoi, radius, numPoints, altitudeForOrbitWpsRel);

    if (orbitModalOverlayEl) orbitModalOverlayEl.style.display = 'none'; 
}

/**
 * Generates and adds waypoints for an orbit around a central POI.
 * @param {object} centerPoi - The POI object to orbit around (contains .altitude as MSL).
 * @param {number} radius - The radius of the orbit in meters.
 * @param {number} numPoints - The number of waypoints to generate for the orbit.
 * @param {number} altitudeRelToHome - The altitude (relative to takeoff) for the orbit waypoints.
 */
function generateOrbitWaypoints(centerPoi, radius, numPoints, altitudeRelToHome) {
    const homeElevation = parseFloat(homeElevationMslInput.value) || 0; // MSL of takeoff
    const orbitWpAMSL = homeElevation + altitudeRelToHome; // MSL altitude of the orbit waypoints
    const poiAMSL = centerPoi.altitude; // MSL altitude of the POI

    let calculatedGimbalPitch = 0; // Default gimbal pitch

    if (radius > 0) {
        const deltaAltitude = orbitWpAMSL - poiAMSL; // Drone height relative to POI target height
        calculatedGimbalPitch = Math.atan(deltaAltitude / radius) * (180 / Math.PI);
        calculatedGimbalPitch = Math.max(-90, Math.min(60, calculatedGimbalPitch)); // Clamp
        calculatedGimbalPitch = -calculatedGimbalPitch; // Negative for looking down
    }


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
            altitude: altitudeRelToHome, // Altitude relative to home
            headingControl: 'poi_track', 
            targetPoiId: centerPoi.id,
            gimbalPitch: Math.round(calculatedGimbalPitch) 
        };

        addWaypoint(wpLatlng, waypointOptions);
    }

    fitMapToWaypoints(); 
    showCustomAlert(`${numPoints} waypoint dell'orbita creati attorno a ${centerPoi.name}.`, "Orbita Creata"); // Italian
}
