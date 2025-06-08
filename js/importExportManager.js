// File: importExportManager.js

// Dipendenze globali e funzioni di utilità...

// =============================================================================
// FUNZIONI DI VALIDAZIONE E CALCOLO
// =============================================================================

function validateCoordinates(lat, lng) {
    return typeof lat === 'number' && isFinite(lat) &&
           typeof lng === 'number' && isFinite(lng) &&
           lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function validateAltitude(altitude) {
    return typeof altitude === 'number' && isFinite(altitude) && altitude >= 2 && altitude <= 500;
}

function validateGimbalPitch(pitch) {
    return typeof pitch === 'number' && isFinite(pitch) && pitch >= -90 && pitch <= 60;
}

function validateWpmlExport() {
    const errors = [];
    const t = (key) => translate(key) || key.replace(/_/g, ' ');

    if (!waypoints || waypoints.length < 2) {
        errors.push(t('error_min_waypoints'));
    }
    
    waypoints.forEach((wp, i) => {
        if (!wp.latlng || !validateCoordinates(wp.latlng.lat, wp.latlng.lng)) {
            errors.push(`Waypoint ${i + 1}: ${t('error_invalid_coordinates')}`);
        }
        if (!validateAltitude(wp.altitude)) {
            errors.push(`Waypoint ${i + 1}: ${t('error_altitude_range')}`);
        }
        if (wp.gimbalPitch !== undefined && !validateGimbalPitch(wp.gimbalPitch)) {
            errors.push(`Waypoint ${i + 1}: ${t('error_gimbal_range')}`);
        }
    });
    
    return errors;
}

function calculateMissionDistance(missionWaypoints) {
    if (!missionWaypoints || missionWaypoints.length < 2) return 0;
    let totalDistance = 0;
    for (let i = 1; i < missionWaypoints.length; i++) {
        totalDistance += haversineDistance(missionWaypoints[i-1].latlng, missionWaypoints[i].latlng);
    }
    return totalDistance;
}

function calculateMissionDuration(missionWaypoints, speed) {
    if (!speed || speed <= 0) return 0;
    const distance = calculateMissionDistance(missionWaypoints);
    const baseTime = distance / speed;
    const hoverTime = missionWaypoints.reduce((total, wp) => total + (wp.hoverTime || 0), 0);
    return baseTime + hoverTime;
}


// =============================================================================
// FUNZIONI DI IMPORT
// =============================================================================

function triggerImport() {
    if (fileInputEl) { 
        fileInputEl.click();
    } else {
        if(typeof showCustomAlert === 'function') {
            showCustomAlert(translate('errorTitle'), "File input element not found.");
        }
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
            if(typeof showCustomAlert === 'function') {
                showCustomAlert(`${translate('errorTitle')}: ${err.message}`, translate('errorTitle')); 
            }
            console.error("Flight plan import error:", err);
        }
    };
    reader.readAsText(file);
    if (event.target) event.target.value = null;
}

async function loadFlightPlan(plan) {
    if(typeof clearWaypoints === 'function') {
        clearWaypoints(); 
    }

    let maxImportedPoiId = 0;
    let maxImportedWaypointId = 0;

    if (plan.settings) {
        if (defaultAltitudeSlider) {
            defaultAltitudeSlider.value = plan.settings.defaultAltitude || 30;
            if (defaultAltitudeValueEl) defaultAltitudeValueEl.textContent = defaultAltitudeSlider.value + 'm';
        }
        if (flightSpeedSlider) {
            flightSpeedSlider.value = plan.settings.flightSpeed || 8;
            if (flightSpeedValueEl) flightSpeedValueEl.textContent = flightSpeedSlider.value + ' m/s';
        }
        if (pathTypeSelect) pathTypeSelect.value = plan.settings.pathType || 'straight';
        if (homeElevationMslInput && typeof plan.settings.homeElevationMsl === 'number') {
            homeElevationMslInput.value = plan.settings.homeElevationMsl;
        }
        lastAltitudeAdaptationMode = plan.settings.lastAltitudeAdaptationMode || 'relative';
        if(desiredAGLInput && plan.settings.desiredAGL) desiredAGLInput.value = plan.settings.desiredAGL;
        if(desiredAMSLInputEl && plan.settings.desiredAMSL) desiredAMSLInputEl.value = plan.settings.desiredAMSL;
    }

    if (plan.pois && Array.isArray(plan.pois)) {
        for (const pData of plan.pois) { 
            if (!validateCoordinates(pData.lat, pData.lng)) {
                console.warn(`Skipping POI ${pData.id || pData.name}: invalid coordinates.`);
                continue;
            }
            const poiOptions = { id: pData.id, name: pData.name, objectHeightAboveGround: pData.objectHeightAboveGround, terrainElevationMSL: pData.terrainElevationMSL, altitude: pData.altitude, calledFromLoad: true };
            if (typeof addPOI === 'function') {
                await addPOI(L.latLng(pData.lat, pData.lng), poiOptions); 
            }
            if (pData.id > maxImportedPoiId) maxImportedPoiId = pData.id;
        }
    }

    if (plan.waypoints && Array.isArray(plan.waypoints)) {
        plan.waypoints.forEach(wpData => { 
            if (!validateCoordinates(wpData.lat, wpData.lng)) {
                console.warn(`Skipping waypoint ${wpData.id}: invalid coordinates.`);
                return;
            }
            const waypointOptions = { id: wpData.id, altitude: wpData.altitude, hoverTime: wpData.hoverTime, gimbalPitch: wpData.gimbalPitch, headingControl: wpData.headingControl, fixedHeading: wpData.fixedHeading, cameraAction: wpData.cameraAction, targetPoiId: wpData.targetPoiId, terrainElevationMSL: wpData.terrainElevationMSL, calledFromLoad: true };
            if(typeof addWaypoint === 'function') {
                addWaypoint(L.latLng(wpData.lat, wpData.lng), waypointOptions);
            }
            if (wpData.id > maxImportedWaypointId) maxImportedWaypointId = wpData.id;
        });
    }

    waypointCounter = Math.max(waypointCounter, maxImportedWaypointId + 1);
    poiCounter = Math.max(poiCounter, maxImportedPoiId + 1);
    
    // Update UI
    updatePOIList();
    updateWaypointList();
    updateFlightPath(); 
    updateFlightStatistics();
    fitMapToWaypoints();
    updatePathModeDisplay(); 

    if (waypoints.length > 0) {
        selectWaypoint(waypoints[0]); 
    }

    showCustomAlert(translate('successTitle'), translate('import_success'));
}

// =============================================================================
// FUNZIONI DI EXPORT
// =============================================================================

function exportFlightPlanToJson() {
    if (waypoints.length === 0 && pois.length === 0) {
        showCustomAlert(translate('errorTitle'), translate('nothing_to_export'));
        return; 
    }
    
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
            id: p.id, name: p.name, lat: p.latlng.lat, lng: p.latlng.lng, 
            altitude: p.altitude, terrainElevationMSL: p.terrainElevationMSL,
            objectHeightAboveGround: p.objectHeightAboveGround
        })),
        settings: {
            defaultAltitude: defaultAltitudeSlider ? parseInt(defaultAltitudeSlider.value) : 30,
            flightSpeed: flightSpeedSlider ? parseFloat(flightSpeedSlider.value) : 5,
            pathType: pathTypeSelect ? pathTypeSelect.value : 'straight',
            homeElevationMsl: homeElevationMslInput ? parseFloat(homeElevationMslInput.value) : 0,
            lastAltitudeAdaptationMode: lastAltitudeAdaptationMode, 
            desiredAGL: desiredAGLInput ? parseInt(desiredAGLInput.value) : 50, 
            desiredAMSL: desiredAMSLInputEl ? parseInt(desiredAMSLInputEl.value) : 100 
        }
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(plan, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr); 
    dl.setAttribute("download", "flight_plan.json");
    document.body.appendChild(dl); 
    dl.click(); 
    document.body.removeChild(dl);
    
    showCustomAlert(translate('successTitle'), translate('export_json_success'));
}

function exportToGoogleEarthKml() { /* ... unchanged ... */ }

function exportToDjiWpmlKmz() {
    const validationErrors = validateWpmlExport();
    if (validationErrors.length > 0) {
        showCustomAlert(translate('errorTitle'), validationErrors.join('\n'));
        return;
    }
    
    if (typeof JSZip === 'undefined') {
        showCustomAlert(translate('errorTitle'), translate('jszip_not_loaded'));
        return; 
    }
    
    actionGroupCounter = 1; 
    actionCounter = 1;      

    const missionFlightSpeed = flightSpeedSlider.value;
    const missionPathType = pathTypeSelect.value;
    const now = new Date();
    const createTimeMillis = now.getTime().toString();
    const waylineIdInt = Math.floor(now.getTime() / 1000); 
    const wpmlNs = "http://www.dji.com/wpmz/1.0.2";
    const totalDistance = calculateMissionDistance(waypoints);
    const totalDuration = calculateMissionDuration(waypoints, missionFlightSpeed);

    let templateKmlContent = `...`; // Same as before

    let waylinesWpmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="${wpmlNs}">
<Document>
  <wpml:missionConfig>
    <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
    <wpml:finishAction>goHome</wpml:finishAction>
    <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
    <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction> 
    <wpml:globalTransitionalSpeed>${missionFlightSpeed}</wpml:globalTransitionalSpeed>
    <wpml:droneInfo><wpml:droneEnumValue>68</wpml:droneEnumValue><wpml:droneSubEnumValue>0</wpml:droneSubEnumValue></wpml:droneInfo>
  </wpml:missionConfig>
  <Folder>
    <name>Wayline Mission ${waylineIdInt}</name>
    <wpml:templateId>0</wpml:templateId>
    <wpml:executeHeightMode>relativeToStartPoint</wpml:executeHeightMode> 
    <wpml:waylineId>0</wpml:waylineId> 
    <wpml:distance>${Math.round(totalDistance)}</wpml:distance> 
    <wpml:duration>${Math.round(totalDuration)}</wpml:duration> 
    <wpml:autoFlightSpeed>${missionFlightSpeed}</wpml:autoFlightSpeed>
`;

    waypoints.forEach((wp, index) => {
        waylinesWpmlContent += `    <Placemark>\n`;
        waylinesWpmlContent += `      <Point><coordinates>${wp.latlng.lng.toFixed(10)},${wp.latlng.lat.toFixed(10)}</coordinates></Point>\n`;
        waylinesWpmlContent += `      <wpml:index>${index}</wpml:index>\n`;
        waylinesWpmlContent += `      <wpml:executeHeight>${wp.altitude.toFixed(1)}</wpml:executeHeight>\n`;
        waylinesWpmlContent += `      <wpml:waypointSpeed>${missionFlightSpeed}</wpml:waypointSpeed>\n`;
        
        waylinesWpmlContent += `      <wpml:waypointHeadingParam>\n`;
        let headingMode = 'followWayline', headingAngle = 0, headingAngleEnable = 0, headingPathMode = 'followBadArc';
        let poiPointXml = `        <wpml:waypointPoiPoint>0.0,0.0,0.0</wpml:waypointPoiPoint>\n`;
        if (wp.headingControl === 'fixed') {
            headingMode = 'lockCourse'; 
            headingAngle = wp.fixedHeading;
            headingAngleEnable = 1;
        } else if (wp.headingControl === 'poi_track' && wp.targetPoiId != null) {
            const targetPoi = pois.find(p => p.id === wp.targetPoiId);
            if (targetPoi) {
                headingMode = 'towardPOI';
                poiPointXml = `        <wpml:waypointPoiPoint>${targetPoi.latlng.lng.toFixed(6)},${targetPoi.latlng.lat.toFixed(6)},${targetPoi.altitude.toFixed(1)}</wpml:waypointPoiPoint>\n`; 
            }
        } else {
             if (index < waypoints.length - 1) { headingAngle = calculateBearing(wp.latlng, waypoints[index+1].latlng); } 
             else if (index > 0) { headingAngle = calculateBearing(waypoints[index-1].latlng, wp.latlng); }
        }
        waylinesWpmlContent += `        <wpml:waypointHeadingMode>${headingMode}</wpml:waypointHeadingMode>\n`;
        waylinesWpmlContent += `        <wpml:waypointHeadingAngle>${Math.round(headingAngle)}</wpml:waypointHeadingAngle>\n`;
        waylinesWpmlContent += poiPointXml;
        waylinesWpmlContent += `        <wpml:waypointHeadingAngleEnable>${headingAngleEnable}</wpml:waypointHeadingAngleEnable>\n`;
        waylinesWpmlContent += `        <wpml:waypointHeadingPathMode>${headingPathMode}</wpml:waypointHeadingPathMode>\n`;
        waylinesWpmlContent += `        <wpml:waypointHeadingPoiIndex>0</wpml:waypointHeadingPoiIndex>\n`; 
        waylinesWpmlContent += `      </wpml:waypointHeadingParam>\n`;

        let turnMode;
        if (index === 0 || index === waypoints.length - 1 || wp.hoverTime > 0) {
            turnMode = 'toPointAndStopWithContinuityCurvature';
        } else {
            turnMode = (missionPathType === 'curved') ? 'toPointAndPassWithContinuityCurvature' : 'toPointAndStopWithContinuityCurvature';
        }
        waylinesWpmlContent += `      <wpml:waypointTurnParam>\n`;
        waylinesWpmlContent += `        <wpml:waypointTurnMode>${turnMode}</wpml:waypointTurnMode>\n`;
        waylinesWpmlContent += `        <wpml:waypointTurnDampingDist>0.2</wpml:waypointTurnDampingDist>\n`;
        waylinesWpmlContent += `      </wpml:waypointTurnParam>\n`;

        let actionsXmlBlock = "";
        if (wp.hoverTime > 0) {
            actionsXmlBlock += `        <wpml:action><wpml:actionId>${actionCounter++}</wpml:actionId><wpml:actionActuatorFunc>HOVER</wpml:actionActuatorFunc><wpml:actionActuatorFuncParam><wpml:hoverTime>${wp.hoverTime}</wpml:hoverTime></wpml:actionActuatorFuncParam></wpml:action>\n`;
        }
        if (wp.headingControl !== 'poi_track') {
             const clampedGimbalPitch = Math.max(-90, Math.min(60, wp.gimbalPitch));
             actionsXmlBlock += `        <wpml:action><wpml:actionId>${actionCounter++}</wpml:actionId><wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc><wpml:actionActuatorFuncParam><wpml:gimbalPitchRotateEnable>1</wpml:gimbalPitchRotateEnable><wpml:gimbalPitchRotateAngle>${clampedGimbalPitch}</wpml:gimbalPitchRotateAngle><wpml:gimbalRollRotateEnable>0</wpml:gimbalRollRotateEnable><wpml:gimbalYawRotateEnable>0</wpml:gimbalYawRotateEnable><wpml:gimbalRotateTimeEnable>1</wpml:gimbalRotateTimeEnable><wpml:gimbalRotateTime>1</wpml:gimbalRotateTime><wpml:payloadPositionIndex>0</wpml:payloadPositionIndex></wpml:actionActuatorFuncParam></wpml:action>\n`;
        }
        if (wp.cameraAction && wp.cameraAction !== 'none') {
            let actuatorFunc = wp.cameraAction === 'takePhoto' ? 'takePhoto' : (wp.cameraAction === 'startRecord' ? 'startRecord' : (wp.cameraAction === 'stopRecord' ? 'stopRecord' : ''));
            if (actuatorFunc) {
                actionsXmlBlock += `        <wpml:action><wpml:actionId>${actionCounter++}</wpml:actionId><wpml:actionActuatorFunc>${actuatorFunc}</wpml:actionActuatorFunc><wpml:actionActuatorFuncParam><wpml:payloadPositionIndex>0</wpml:payloadPositionIndex></wpml:actionActuatorFuncParam></wpml:action>\n`;
            }
        }
        if (actionsXmlBlock) {
            waylinesWpmlContent += `      <wpml:actionGroup><wpml:actionGroupId>${actionGroupCounter++}</wpml:actionGroupId><wpml:actionGroupStartIndex>${index}</wpml:actionGroupStartIndex><wpml:actionGroupEndIndex>${index}</wpml:actionGroupEndIndex><wpml:actionGroupMode>sequence</wpml:actionGroupMode><wpml:actionTrigger><wpml:actionTriggerType>reachPoint</wpml:actionTriggerType></wpml:actionTrigger>\n${actionsXmlBlock}      </wpml:actionGroup>\n`;
        }
        waylinesWpmlContent += `    </Placemark>\n`;
    });

    waylinesWpmlContent += `  </Folder>\n</Document>\n</kml>`;

    const zip = new JSZip();
    zip.folder("wpmz").file("template.kml", templateKmlContent).file("waylines.wpml", waylinesWpmlContent);
    zip.generateAsync({ type: "blob", mimeType: "application/vnd.google-earth.kmz" })
        .then(function(blob) {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `flight_plan_dji_${waylineIdInt}.kmz`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            showCustomAlert(translate('successTitle'), translate('export_dji_success'));
        })
        .catch(function(err) {
            showCustomAlert(`${translate('errorTitle')}: ${err.message}`, "KMZ Generation Error");
            console.error("KMZ generation error:", err);
        });
}
