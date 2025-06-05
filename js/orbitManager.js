// File: orbitManager.js

// Depends on: config.js, utils.js (calculateRequiredGimbalPitch), uiUpdater.js (populatePoiSelectDropdown),
// waypointManager.js (addWaypoint), mapManager.js (fitMapToWaypoints)

/**
 * Displays the orbit creation dialog.
 */
function showOrbitDialog() {
    if (!orbitModalOverlayEl || !orbitPoiSelectEl || !orbitRadiusInputEl || !orbitPointsInputEl) {
        console.error("Orbit modal elements not found in DOM cache!");
        showCustomAlert("La finestra di dialogo Orbita non può essere visualizzata a causa di elementi mancanti.", "Errore Interno"); 
        return;
    }

    if (pois.length === 0) {
        showCustomAlert("Aggiungi almeno un POI prima di creare un'orbita.", "Errore Orbita"); 
        return;
    }

    populatePoiSelectDropdown(orbitPoiSelectEl, null, false); 

    if (pois.length > 0 && orbitPoiSelectEl.options.length > 0) {
        orbitPoiSelectEl.value = pois[0].id;
    } else {
        showCustomAlert("Nessun POI disponibile da selezionare per l'orbita.", "Errore Orbita"); 
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
    if (!orbitPoiSelectEl || !orbitRadiusInputEl || !orbitPointsInputEl || !defaultAltitudeSlider || !homeElevationMslInput) { 
        showCustomAlert("Creazione orbita fallita: elementi di controllo essenziali mancanti.", "Errore Interno"); 
        return;
    }

    const targetPoiId = parseInt(orbitPoiSelectEl.value);
    const radius = parseFloat(orbitRadiusInputEl.value);
    const numPoints = parseInt(orbitPointsInputEl.value);
    const altitudeForOrbitWpsRel = parseInt(defaultAltitudeSlider.value); 

    const targetPoi = pois.find(p => p.id === targetPoiId);

    if (!targetPoi) {
        showCustomAlert("POI non valido selezionato per l'orbita. Seleziona un POI valido.", "Errore Orbita"); 
        return;
    }
    if (isNaN(radius) || radius <= 0.1) { // Raggio deve essere significativamente positivo
        showCustomAlert("Raggio non valido. Deve essere un numero positivo maggiore di 0.1m.", "Errore Orbita"); 
        return;
    }
    if (isNaN(numPoints) || numPoints < 3) { 
        showCustomAlert("Numero di punti non valido. Minimo 3 richiesti per l'orbita.", "Errore Orbita"); 
        return;
    }

    generateOrbitWaypoints(targetPoi, radius, numPoints, altitudeForOrbitWpsRel);

    if (orbitModalOverlayEl) orbitModalOverlayEl.style.display = 'none'; 
}

/**
 * Generates and adds waypoints for an orbit around a central POI.
 * @param {object} centerPoi - The POI object (contains .altitude as final calculated MSL).
 * @param {number} radius - The radius of the orbit in meters.
 * @param {number} numPoints - The number of waypoints to generate for the orbit.
 * @param {number} altitudeRelToHome - The altitude (relative to takeoff) for the orbit waypoints.
 */
function generateOrbitWaypoints(centerPoi, radius, numPoints, altitudeRelToHome) {
    const homeElevation = parseFloat(homeElevationMslInput.value) || 0; 
    const orbitWpAMSL = homeElevation + altitudeRelToHome; // AMSL altitude of the orbit waypoints
    const poiAMSL = centerPoi.altitude; // centerPoi.altitude is the final calculated MSL of the POI

    // Utilizza la funzione helper per calcolare il gimbal pitch
    // La distanza orizzontale in un'orbita è il raggio.
    const calculatedGimbalPitch = calculateRequiredGimbalPitch(orbitWpAMSL, poiAMSL, radius);
    console.log(`Orbit Gen: WP AMSL=${orbitWpAMSL}, POI AMSL=${poiAMSL}, Radius=${radius}, Calculated Gimbal Pitch=${calculatedGimbalPitch}°`);

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
            gimbalPitch: calculatedGimbalPitch // Usa il gimbal pitch calcolato e clampato
        };

        addWaypoint(wpLatlng, waypointOptions);
    }

    fitMapToWaypoints(); 
    showCustomAlert(`${numPoints} waypoint dell'orbita creati attorno a ${centerPoi.name}. Gimbal Pitch: ${calculatedGimbalPitch}°`, "Orbita Creata"); 
}
