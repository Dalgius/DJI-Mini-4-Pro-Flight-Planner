// importExportManager.js - DJI WPML Compliant Version

// Dipendenze globali
// Utilizza funzioni da waypointManager.js, poiManager.js, utils.js, domCache.js

if (typeof toRad === 'undefined') {
    function toRad(degrees) { return degrees * Math.PI / 180; }
}

function triggerImport() {
    fileInputEl ? fileInputEl.click() : showCustomAlert(translate('errorTitle'), "File input not found.");
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const importedPlan = JSON.parse(e.target.result);
            typeof loadFlightPlan === 'function' && await loadFlightPlan(importedPlan);
        } catch (err) {
            showCustomAlert(`${translate('errorTitle')}: ${err.message}`, "Import Error");
            console.error("Flight plan import error:", err);
        }
    };
    reader.readAsText(file);
    event.target.value = null;
}

async function loadFlightPlan(plan) {
    clearWaypoints?.();

    let maxPoiId = 0, maxWaypointId = 0;
    const settings = plan.settings || {};
    
    defaultAltitudeSlider && (defaultAltitudeSlider.value = settings.defaultAltitude ?? 30);
    flightSpeedSlider && (flightSpeedSlider.value = settings.flightSpeed ?? 8);
    pathTypeSelect && (pathTypeSelect.value = settings.pathType ?? 'straight');
    homeElevationMslInput && typeof settings.homeElevationMsl === 'number' && (homeElevationMslInput.value = settings.homeElevationMsl);
    lastAltitudeAdaptationMode = settings.lastAltitudeAdaptationMode ?? 'relative';

    if (Array.isArray(plan.pois)) {
        for (const poi of plan.pois) {
            const poiOptions = {
                id: poi.id, name: poi.name,
                objectHeightAboveGround: poi.objectHeightAboveGround ?? 0,
                terrainElevationMSL: poi.terrainElevationMSL ?? null,
                altitude: poi.altitude, calledFromLoad: true
            };
            typeof addPOI === 'function' && await addPOI(L.latLng(poi.lat, poi.lng), poiOptions);
            maxPoiId = Math.max(maxPoiId, poi.id);
        }
    }

    if (Array.isArray(plan.waypoints)) {
        plan.waypoints.forEach(wp => {
            const waypointOptions = {
                id: wp.id, altitude: wp.altitude, hoverTime: wp.hoverTime,
                gimbalPitch: wp.gimbalPitch ?? 0, headingControl: wp.headingControl,
                fixedHeading: wp.fixedHeading, cameraAction: wp.cameraAction ?? 'none',
                targetPoiId: wp.targetPoiId ?? null, terrainElevationMSL: wp.terrainElevationMSL ?? null,
                calledFromLoad: true
            };
            typeof addWaypoint === 'function' && addWaypoint(L.latLng(wp.lat, wp.lng), waypointOptions);
            maxWaypointId = Math.max(maxWaypointId, wp.id);
        });
    }

    waypointCounter = maxWaypointId + 1;
    poiCounter = maxPoiId + 1;
    updateFlightPlanUI();
}

function updateFlightPlanUI() {
    updatePOIList?.();
    updateWaypointList?.();
    updateFlightPath?.();
    updateFlightStatistics?.();
    fitMapToWaypoints?.();
    updatePathModeDisplay?.();

    if (waypoints.length > 0) {
        selectWaypoint?.(waypoints[0]);
    } else {
        waypointControlsDiv?.style.setProperty("display", "none");
    }

    if (pois.length > 0) {
        lastActivePoiForTerrainFetch = pois[pois.length - 1];
        lastActivePoiForTerrainFetch?.recalculateFinalAltitude?.();
    } else {
        poiObjectHeightInputEl && (poiObjectHeightInputEl.value = 0);
        poiTerrainElevationInputEl && (poiTerrainElevationInputEl.value = 0, poiTerrainElevationInputEl.readOnly = true);
        updatePoiFinalAltitudeDisplay?.();
    }
}

function exportFlightPlanToJson() {
    if (!waypoints.length && !pois.length) {
        showCustomAlert?.(translate('errorTitle'), "Nothing to export."); return;
    }
    const plan = {
        waypoints: waypoints.map(wp => ({
            id: wp.id, lat: wp.latlng.lat, lng: wp.latlng.lng,
            altitude: wp.altitude, hoverTime: wp.hoverTime, gimbalPitch: wp.gimbalPitch,
            headingControl: wp.headingControl, fixedHeading: wp.fixedHeading,
            cameraAction: wp.cameraAction || 'none', targetPoiId: wp.targetPoiId ?? null,
            terrainElevationMSL: wp.terrainElevationMSL
        })),
        pois: pois.map(p => ({
            id: p.id, name: p.name, lat: p.latlng.lat, lng: p.latlng.lng,
            altitude: p.altitude, terrainElevationMSL: p.terrainElevationMSL,
            objectHeightAboveGround: p.objectHeightAboveGround
        })),
        settings: {
            defaultAltitude: defaultAltitudeSlider ? parseInt(defaultAltitudeSlider.value) : 30,
            flightSpeed: flightSpeedSlider ? parseFloat(flightSpeedSlider.value) : 5,
            pathType: pathTypeSelect?.value ?? 'straight',
            nextWaypointId: waypointCounter, nextPoiId: poiCounter,
            homeElevationMsl: homeElevationMslInput ? parseFloat(homeElevationMslInput.value) : 0,
            lastAltitudeAdaptationMode, desiredAGL: desiredAGLInput ? parseInt(desiredAGLInput.value) : 50,
            desiredAMSL: desiredAMSLInputEl ? parseInt(desiredAMSLInputEl.value) : 100
        }
    };
    downloadJson(plan, "flight_plan.json");
}

function downloadJson(data, filename) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", filename);
    document.body.appendChild(dl);
    dl.click();
    document.body.removeChild(dl);
    showCustomAlert?.(translate('successTitle'), "Flight plan exported as JSON.");
}
