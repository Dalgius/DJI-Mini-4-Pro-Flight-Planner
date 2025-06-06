// File: importExportManager.js

// Global dependencies (expected from other files):
// waypoints, pois, flightSpeedSlider, pathTypeSelect, homeElevationMslInput,
// waypointCounter, poiCounter, actionGroupCounter, actionCounter (from config.js)
// fileInputEl, poiNameInput, poiObjectHeightInputEl, poiTerrainElevationInputEl (from domCache.js)
// showCustomAlert, getCameraActionText, haversineDistance, calculateBearing, toRad (from utils.js or global)
// addWaypoint, addPOI, updateGimbalForPoiTrack (from waypointManager.js, poiManager.js)
// JSZip (libreria esterna)
// map (per POI import, se necessario)

if (typeof getCameraActionText === 'undefined') {
    function getCameraActionText(action) {
        switch (action) {
            case 'takePhoto': return 'Foto'; 
            case 'startRecord': return 'Avvia Reg.'; 
            case 'stopRecord': return 'Ferma Reg.'; 
            default: return 'Nessuna'; 
        }
    }
}
if (typeof calculateBearing === 'undefined') {
    function calculateBearing(point1LatLng, point2LatLng) {
        const toRadFn = typeof toRad === 'function' ? toRad : (deg => deg * Math.PI / 180);
        const lat1 = toRadFn(point1LatLng.lat); const lon1 = toRadFn(point1LatLng.lng);
        const lat2 = toRadFn(point2LatLng.lat); const lon2 = toRadFn(point2LatLng.lng);
        const dLon = lon2 - lon1;
        const y = Math.sin(dLon) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
        let brng = Math.atan2(y, x) * 180 / Math.PI;
        return (brng + 360) % 360;
    }
}
if (typeof toRad === 'undefined') {
    function toRad(degrees) { return degrees * Math.PI / 180; }
}

function triggerImport() {
    if (fileInputEl) { 
        fileInputEl.click();
    } else {
        if(typeof showCustomAlert === 'function') showCustomAlert("Elemento input file non trovato.", "Errore Import"); 
    }
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => { 
        try {
            const importedPlan = JSON.parse(e.target.result);
            if(typeof loadFlightPlan === 'function') {
                await loadFlightPlan(importedPlan); 
            }
        } catch (err) {
            if(typeof showCustomAlert === 'function') showCustomAlert("Errore nel parsing del file del piano di volo: " + err.message, "Errore Import"); 
            console.error("Flight plan import error:", err);
        }
    };
    reader.readAsText(file);
    if (event.target) event.target.value = null;
}

async function loadFlightPlan(plan) {
    if(typeof clearWaypoints === 'function') {
        clearWaypoints(); // clearWaypoints ora dovrebbe resettare anche poiCounter e i campi POI
    }

    let maxImportedPoiId = 0;
    let maxImportedWaypointId = 0;

    if (plan.settings) {
        if (defaultAltitudeSlider) defaultAltitudeSlider.value = plan.settings.defaultAltitude || 30;
        if (defaultAltitudeValueEl) defaultAltitudeValueEl.textContent = defaultAltitudeSlider.value + 'm';
        if (flightSpeedSlider) flightSpeedSlider.value = plan.settings.flightSpeed || 8;
        if (flightSpeedValueEl) flightSpeedValueEl.textContent = flightSpeedSlider.value + ' m/s';
        if (pathTypeSelect) pathTypeSelect.value = plan.settings.pathType || 'straight';
        // Non impostare waypointCounter e poiCounter dai settings del file, li calcoleremo
        if (homeElevationMslInput && typeof plan.settings.homeElevationMsl === 'number') {
            homeElevationMslInput.value = plan.settings.homeElevationMsl;
        }
    }

    if (plan.pois && Array.isArray(plan.pois)) {
        for (const pData of plan.pois) { 
            const poiOptions = {
                id: pData.id,
                name: pData.name, // addPOI userà questo se fornito
                objectHeightAboveGround: pData.objectHeightAboveGround !== undefined ? pData.objectHeightAboveGround : 0,
                terrainElevationMSL: pData.terrainElevationMSL !== undefined ? pData.terrainElevationMSL : null,
                calledFromLoad: true 
            };
            if (typeof addPOI === 'function') {
                // La funzione addPOI è async per via del recupero dell'elevazione.
                // Attendiamo il completamento per ogni POI per mantenere l'ordine e gli ID corretti.
                await addPOI(L.latLng(pData.lat, pData.lng), poiOptions); 
            }
            if (pData.id > maxImportedPoiId) maxImportedPoiId = pData.id;
        }
    }

    if (plan.waypoints && Array.isArray(plan.waypoints)) {
         plan.waypoints.forEach(wpData => { 
            const waypointOptions = {
                id: wpData.id, 
                altitude: wpData.altitude, 
                hoverTime: wpData.hoverTime, 
                // Importante: usa il gimbalPitch dal file JSON, il ricalcolo avverrà dopo
                gimbalPitch: wpData.gimbalPitch !== undefined ? wpData.gimbalPitch : 0, 
                headingControl: wpData.headingControl, 
                fixedHeading: wpData.fixedHeading,
                cameraAction: wpData.cameraAction || 'none',
                targetPoiId: wpData.targetPoiId === undefined ? null : wpData.targetPoiId,
                terrainElevationMSL: wpData.terrainElevationMSL !== undefined ? wpData.terrainElevationMSL : null
            };
            if(typeof addWaypoint === 'function') addWaypoint(L.latLng(wpData.lat, wpData.lng), waypointOptions);
            if (wpData.id > maxImportedWaypointId) maxImportedWaypointId = wpData.id;
        });
    }

    waypointCounter = maxImportedWaypointId + 1;
    poiCounter = maxImportedPoiId + 1;
    
    // Ripristina i valori di default per gli input POI della sidebar principale
    if(poiNameInput) poiNameInput.value = '';
    if(poiObjectHeightInputEl) poiObjectHeightInputEl.value = '0';
    if(poiTerrainElevationInputEl) {
        poiTerrainElevationInputEl.value = '0'; // o "" se preferisci per N/A
        poiTerrainElevationInputEl.readOnly = true; // In attesa di un Ctrl+Click per un nuovo POI
    }
    if(typeof updatePoiFinalAltitudeDisplay === "function") updatePoiFinalAltitudeDisplay(); // Aggiorna il display calcolato
    lastActivePoiForTerrainFetch = null; // Resetta il POI "attivo" per la sidebar


    if(typeof updatePOIList === 'function') updatePOIList();
    if(typeof updateWaypointList === 'function') updateWaypointList();
    if(typeof updateFlightPath === 'function') updateFlightPath();
    if(typeof updateFlightStatistics === 'function') updateFlightStatistics();
    if(typeof fitMapToWaypoints === 'function') fitMapToWaypoints();

    if (waypoints.length > 0 && typeof selectWaypoint === 'function') {
        selectWaypoint(waypoints[0]); 
    } else if (waypointControlsDiv) {
        waypointControlsDiv.style.display = 'none';
    }
    
    // Ricalcola il gimbal pitch per TUTTI i waypoint in modalità POI_TRACK dopo che TUTTO è stato caricato
    console.log("LOADFLIGHTPLAN: Ricalcolo finale gimbal per tutti i waypoint POI_TRACK...");
    waypoints.forEach(wp => {
        if (wp.headingControl === 'poi_track' && wp.targetPoiId !== null) {
            if (typeof updateGimbalForPoiTrack === "function") {
                updateGimbalForPoiTrack(wp, (selectedWaypoint && selectedWaypoint.id === wp.id));
            }
        }
    });
    // Aggiorna la UI per il waypoint selezionato (se esiste) e la lista dei waypoint
    if (selectedWaypoint && typeof updateSingleWaypointEditControls === "function") {
        updateSingleWaypointEditControls();
    }
    if (typeof updateWaypointList === "function") updateWaypointList(); 


    if(typeof showCustomAlert === 'function') showCustomAlert("Piano di volo importato con successo!", "Import Successo"); 
}

function exportFlightPlanToJson() {
    // ... (Funzione exportFlightPlanToJson come definita precedentemente, assicurati sia completa)
    if (waypoints.length === 0 && pois.length === 0) { /* ... */ }
    const plan = {
        waypoints: waypoints.map(wp => ({
            id: wp.id, lat: wp.latlng.lat, lng: wp.latlng.lng,
            altitude: wp.altitude, hoverTime: wp.hoverTime, gimbalPitch: wp.gimbalPitch,
            headingControl: wp.headingControl, fixedHeading: wp.fixedHeading,
            cameraAction: wp.cameraAction || 'none',
            targetPoiId: wp.targetPoiId === undefined ? null : wp.targetPoiId,
            terrainElevationMSL: wp.terrainElevationMSL 
        })),
        pois: pois.map(p => ({ 
            id:p.id, 
            name:p.name, 
            lat:p.latlng.lat, 
            lng:p.latlng.lng, 
            altitude: p.altitude, 
            terrainElevationMSL: p.terrainElevationMSL,
            objectHeightAboveGround: p.objectHeightAboveGround
        })),
        settings: {
            defaultAltitude: defaultAltitudeSlider ? parseInt(defaultAltitudeSlider.value) : 30,
            flightSpeed: flightSpeedSlider ? parseFloat(flightSpeedSlider.value) : 5,
            pathType: pathTypeSelect ? pathTypeSelect.value : 'straight',
            nextWaypointId: waypointCounter, 
            nextPoiId: poiCounter,      
            homeElevationMsl: homeElevationMslInput ? parseFloat(homeElevationMslInput.value) : 0
        }
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(plan, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr); dl.setAttribute("download", "flight_plan.json");
    document.body.appendChild(dl); dl.click(); document.body.removeChild(dl);
    if(typeof showCustomAlert === 'function') showCustomAlert("Piano di volo esportato come JSON.", "Successo"); 
}

function exportToGoogleEarthKml() { 
    // ... (Funzione exportToGoogleEarthKml come definita precedentemente, assicurati sia completa) ...
}

function exportToDjiWpmlKmz() {
    // ... (Funzione exportToDjiWpmlKmz come definita precedentemente, assicurati sia completa e usi poi.altitude per l'altezza del POI) ...
}
