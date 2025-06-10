// File: importExportManager.js

// Global dependencies (expected from other files):
// waypoints, pois, flightSpeedSlider, pathTypeSelect, homeElevationMslInput,
// waypointCounter, poiCounter, actionGroupCounter, actionCounter, lastAltitudeAdaptationMode (from config.js)
// fileInputEl, poiNameInput, poiObjectHeightInputEl, poiTerrainElevationInputEl (from domCache.js)
// showCustomAlert, haversineDistance, calculateBearing, toRad (from utils.js or global)
// addWaypoint, addPOI, updateGimbalForPoiTrack (from waypointManager.js, poiManager.js)
// JSZip (external library)
// map (for POI import, if needed)
// translate (from i18n.js)

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

// =============================================================================
// VALIDATION & CALCULATION FUNCTIONS
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
// IMPORT FUNCTIONS
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
            const poiOptions = { id: pData.id, name: pData.name, objectHeightAboveGround: pData.objectHeightAboveGround, terrainElevationMSL: pData.terrainElevationMSL, calledFromLoad: true };
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
            const waypointOptions = { id: wpData.id, altitude: wpData.altitude, hoverTime: wpData.hoverTime, gimbalPitch: wpData.gimbalPitch, headingControl: wpData.headingControl, fixedHeading: wpData.fixedHeading, cameraAction: wpData.cameraAction, targetPoiId: wpData.targetPoiId, terrainElevationMSL: wpData.terrainElevationMSL, calledFromLoad: true, waypointType: wpData.waypointType || 'generic' };
            if(typeof addWaypoint === 'function') addWaypoint(L.latLng(wpData.lat, wpData.lng), waypointOptions);
            if (wpData.id > maxImportedWaypointId) maxImportedWaypointId = wpData.id;
        });
    }

    waypointCounter = Math.max(waypointCounter, maxImportedWaypointId + 1);
    poiCounter = Math.max(poiCounter, maxImportedPoiId + 1);
    
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
// EXPORT FUNCTIONS
// =============================================================================

function exportFlightPlanToJson() { /* unchanged */ }
function exportToGoogleEarthKml() { /* unchanged */ }

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
    const homeElevationMSL = homeElevationMslInput ? parseFloat(homeElevationMslInput.value) : 0;
    const now = new Date();
    const createTimeMillis = now.getTime().toString();
    const waylineIdInt = Math.floor(now.getTime() / 1000); 
    const wpmlNs = "http://www.dji.com/wpmz/1.0.2";
    const totalDistance = calculateMissionDistance(waypoints);
    const totalDuration = calculateMissionDuration(waypoints, missionFlightSpeed);

    let templateKmlContent = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="${wpmlNs}"><Document><wpml:author>FlightPlanner</wpml:author><wpml:createTime>${createTimeMillis}</wpml:createTime><wpml:updateTime>${createTimeMillis}</wpml:updateTime><wpml:missionConfig><wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode><wpml:finishAction>goHome</wpml:finishAction><wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost><wpml:executeRCLostAction>goBack</wpml:executeRCLostAction><wpml:globalTransitionalSpeed>${missionFlightSpeed}</wpml:globalTransitionalSpeed><wpml:droneInfo><wpml:droneEnumValue>68</wpml:droneEnumValue><wpml:droneSubEnumValue>0</wpml:droneSubEnumValue></wpml:droneInfo><wpml:payloadInfo><wpml:payloadEnumValue>0</wpml:payloadEnumValue><wpml:payloadSubEnumValue>0</wpml:payloadSubEnumValue><wpml:payloadPositionIndex>0</wpml:payloadPositionIndex></wpml:payloadInfo></wpml:missionConfig></Document></kml>`;

    let waylinesWpmlContent = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="${wpmlNs}"><Document><wpml:missionConfig><wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode><wpml:finishAction>goHome</wpml:finishAction><wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost><wpml:executeRCLostAction>goBack</wpml:executeRCLostAction><wpml:globalTransitionalSpeed>${missionFlightSpeed}</wpml:globalTransitionalSpeed><wpml:droneInfo><wpml:droneEnumValue>68</wpml:droneEnumValue><wpml:droneSubEnumValue>0</wpml:droneSubEnumValue></wpml:droneInfo></wpml:missionConfig><Folder><name>Wayline Mission ${waylineIdInt}</name><wpml:templateId>0</wpml:templateId><wpml:executeHeightMode>relativeToStartPoint</wpml:executeHeightMode><wpml:waylineId>0</wpml:waylineId><wpml:distance>${Math.round(totalDistance)}</wpml:distance><wpml:duration>${Math.round(totalDuration)}</wpml:duration><wpml:autoFlightSpeed>${missionFlightSpeed}</wpml:autoFlightSpeed>\n`;

    waypoints.forEach((wp, index) => {
        waylinesWpmlContent += `    <Placemark>\n`;
        waylinesWpmlContent += `      <Point><coordinates>${wp.latlng.lng.toFixed(10)},${wp.latlng.lat.toFixed(10)}</coordinates></Point>\n`;
        waylinesWpmlContent += `      <wpml:index>${index}</wpml:index>\n`;
        waylinesWpmlContent += `      <wpml:executeHeight>${wp.altitude.toFixed(1)}</wpml:executeHeight>\n`;
        waylinesWpmlContent += `      <wpml:waypointSpeed>${missionFlightSpeed}</wpml:waypointSpeed>\n`;
        
        waylinesWpmlContent += `      <wpml:waypointHeadingParam>\n`;
        let effectiveHeadingControl = wp.waypointType === 'grid' ? 'fixed' : wp.headingControl;
        
        if (effectiveHeadingControl === 'fixed') {
            waylinesWpmlContent += `        <wpml:waypointHeadingMode>lockCourse</wpml:waypointHeadingMode>\n`;
            waylinesWpmlContent += `        <wpml:waypointHeadingAngle>${wp.fixedHeading}</wpml:waypointHeadingAngle>\n`;
            waylinesWpmlContent += `        <wpml:waypointHeadingAngleEnable>1</wpml:waypointHeadingAngleEnable>\n`;
        } else if (effectiveHeadingControl === 'poi_track' && wp.targetPoiId != null) {
            const targetPoi = pois.find(p => p.id === wp.targetPoiId);
            if (targetPoi) {
                const relativePoiAltitude = targetPoi.altitude - homeElevationMSL;
                waylinesWpmlContent += `        <wpml:waypointHeadingMode>towardPOI</wpml:waypointHeadingMode>\n`;
                waylinesWpmlContent += `        <wpml:waypointPoiPoint>${targetPoi.latlng.lat.toFixed(6)},${targetPoi.latlng.lng.toFixed(6)},${relativePoiAltitude.toFixed(1)}</wpml:waypointPoiPoint>\n`;
            } else {
                waylinesWpmlContent += `        <wpml:waypointHeadingMode>followWayline</wpml:waypointHeadingMode>\n`;
            }
        } else {
            waylinesWpmlContent += `        <wpml:waypointHeadingMode>followWayline</wpml:waypointHeadingMode>\n`;
        }
        waylinesWpmlContent += `        <wpml:waypointHeadingPathMode>followBadArc</wpml:waypointHeadingPathMode>\n`;
        waylinesWpmlContent += `      </wpml:waypointHeadingParam>\n`;

        let turnMode;
        if (wp.waypointType === 'grid' || wp.hoverTime > 0) {
            turnMode = 'toPointAndStopWithDiscontinuityCurvature';
        } else if (wp.waypointType === 'orbit') {
            turnMode = (index === 0 || index === waypoints.length - 1) ? 'toPointAndStopWithContinuityCurvature' : 'toPointAndPassWithContinuityCurvature';
        } else {
            if (missionPathType === 'straight') {
                turnMode = 'toPointAndStopWithDiscontinuityCurvature';
            } else {
                turnMode = (index === 0 || index === waypoints.length - 1) ? 'toPointAndStopWithContinuityCurvature' : 'toPointAndPassWithContinuityCurvature';
            }
        }
        
        waylinesWpmlContent += `      <wpml:waypointTurnParam>\n`;
        waylinesWpmlContent += `        <wpml:waypointTurnMode>${turnMode}</wpml:waypointTurnMode>\n`;
        waylinesWpmlContent += `        <wpml:waypointTurnDampingDist>0.2</wpml:waypointTurnDampingDist>\n`;
        waylinesWpmlContent += `      </wpml:waypointTurnParam>\n`;

        // CORREZIONE DEFINITIVA
        const useStraightLine = (turnMode === 'toPointAndStopWithDiscontinuityCurvature');
        waylinesWpmlContent += `      <wpml:useStraightLine>${useStraightLine ? 1 : 0}</wpml:useStraightLine>\n`;

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
