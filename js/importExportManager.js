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

// Utility functions with fallbacks
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

if (typeof haversineDistance === 'undefined') {
    // This is a simplified version for distance calculation in helpers,
    // the main one from utils.js is more robust. This serves as a fallback.
    function haversineDistance(latlng1, latlng2) {
        const R = 6371000; // Earth's radius in meters
        const dLat = toRad(latlng2.lat - latlng1.lat);
        const dLng = toRad(latlng2.lng - latlng1.lng);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(toRad(latlng1.lat)) * Math.cos(toRad(latlng2.lat)) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

function validateCoordinates(lat, lng) {
    return typeof lat === 'number' && typeof lng === 'number' &&
           lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function validateAltitude(altitude, maxAltitude = 500) {
    // DJI drones are typically limited to 500m
    return typeof altitude === 'number' && altitude >= 2 && altitude <= maxAltitude;
}

function validateGimbalPitch(pitch) {
    // DJI gimbal typical range
    return typeof pitch === 'number' && pitch >= -90 && pitch <= 60;
}

function validateWpmlExport() {
    const errors = [];
    const t = (key) => translate(key) || key.replace(/_/g, ' '); // Simple translate fallback
    
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

function calculateMissionDistance(waypoints) {
    if (!waypoints || waypoints.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 1; i < waypoints.length; i++) {
        // Use the more robust haversineDistance from utils.js if available
        totalDistance += (typeof window.haversineDistance === 'function' ? window.haversineDistance : haversineDistance)(waypoints[i-1].latlng, waypoints[i].latlng);
    }
    return totalDistance; // Already in meters
}

function calculateMissionDuration(waypoints, speed) {
    if (!speed || speed <= 0) return 0;
    const distance = calculateMissionDistance(waypoints);
    const baseTime = distance / speed; // seconds
    
    const hoverTime = waypoints.reduce((total, wp) => total + (wp.hoverTime || 0), 0);
    
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
            showCustomAlert(translate('errorTitle') || 'Error', "File input element not found.");
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
                showCustomAlert(
                    `${translate('errorTitle') || 'Error'}: ${err.message}`, 
                    translate('import_error') || "Import Error"
                );
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

    // Load settings
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
    } else {
        lastAltitudeAdaptationMode = 'relative'; 
    }

    // Load POIs
    if (plan.pois && Array.isArray(plan.pois)) {
        for (const pData of plan.pois) { 
            if (!validateCoordinates(pData.lat, pData.lng)) {
                console.warn(`Skipping POI ${pData.id}: invalid coordinates`);
                continue;
            }
            
            const poiOptions = {
                id: pData.id,
                name: pData.name,
                objectHeightAboveGround: pData.objectHeightAboveGround !== undefined ? pData.objectHeightAboveGround : 0,
                terrainElevationMSL: pData.terrainElevationMSL !== undefined ? pData.terrainElevationMSL : null,
                altitude: pData.altitude, 
                calledFromLoad: true 
            };
            if (typeof addPOI === 'function') {
                await addPOI(L.latLng(pData.lat, pData.lng), poiOptions); 
            }
            if (pData.id > maxImportedPoiId) maxImportedPoiId = pData.id;
        }
    }

    // Load waypoints
    if (plan.waypoints && Array.isArray(plan.waypoints)) {
        plan.waypoints.forEach(wpData => { 
            if (!validateCoordinates(wpData.lat, wpData.lng)) {
                console.warn(`Skipping waypoint ${wpData.id}: invalid coordinates`);
                return;
            }
            
            const waypointOptions = {
                id: wpData.id, 
                altitude: wpData.altitude, 
                hoverTime: wpData.hoverTime, 
                gimbalPitch: wpData.gimbalPitch !== undefined ? wpData.gimbalPitch : 0, 
                headingControl: wpData.headingControl, 
                fixedHeading: wpData.fixedHeading,
                cameraAction: wpData.cameraAction || 'none',
                targetPoiId: wpData.targetPoiId === undefined ? null : wpData.targetPoiId,
                terrainElevationMSL: wpData.terrainElevationMSL !== undefined ? wpData.terrainElevationMSL : null,
                calledFromLoad: true 
            };
            if(typeof addWaypoint === 'function') {
                addWaypoint(L.latLng(wpData.lat, wpData.lng), waypointOptions);
            }
            if (wpData.id > maxImportedWaypointId) maxImportedWaypointId = wpData.id;
        });
    }

    // Update counters
    waypointCounter = maxImportedWaypointId + 1;
    poiCounter = maxImportedPoiId + 1;
    
    // Reset POI inputs
    if(poiNameInput) poiNameInput.value = '';
    if(poiObjectHeightInputEl) poiObjectHeightInputEl.value = '0';
    if(poiTerrainElevationInputEl) {
        poiTerrainElevationInputEl.value = '0';
        poiTerrainElevationInputEl.readOnly = true; 
    }
    if(typeof updatePoiFinalAltitudeDisplay === 'function') updatePoiFinalAltitudeDisplay(); 
    lastActivePoiForTerrainFetch = null; 

    // Update UI
    if(typeof updatePOIList === 'function') updatePOIList();
    if(typeof updateWaypointList === 'function') updateWaypointList();
    if(typeof updateFlightPath === 'function') updateFlightPath(); 
    if(typeof updateFlightStatistics === 'function') updateFlightStatistics();
    if(typeof fitMapToWaypoints === 'function') fitMapToWaypoints();
    if(typeof updatePathModeDisplay === 'function') updatePathModeDisplay(); 

    // Select first waypoint
    if (waypoints.length > 0 && typeof selectWaypoint === 'function') {
        selectWaypoint(waypoints[0]); 
    } else if (waypointControlsDiv) {
        waypointControlsDiv.style.display = 'none';
    }
    
    // Handle POI terrain elevation
    if (pois.length > 0 && typeof lastActivePoiForTerrainFetch !== 'undefined') {
        lastActivePoiForTerrainFetch = pois[pois.length - 1]; 
        if (lastActivePoiForTerrainFetch && lastActivePoiForTerrainFetch.recalculateFinalAltitude) {
            lastActivePoiForTerrainFetch.recalculateFinalAltitude(); 
        }
    } else if (typeof updatePoiFinalAltitudeDisplay === 'function') {
        if (poiObjectHeightInputEl) poiObjectHeightInputEl.value = 0;
        if (poiTerrainElevationInputEl) {
            poiTerrainElevationInputEl.value = 0;
            poiTerrainElevationInputEl.readOnly = true;
        }
        updatePoiFinalAltitudeDisplay(); 
    }

    // Update POI tracking
    waypoints.forEach(wp => {
        if (wp.headingControl === 'poi_track' && wp.targetPoiId !== null) {
            if (typeof updateGimbalForPoiTrack === "function") {
                updateGimbalForPoiTrack(wp, (selectedWaypoint && selectedWaypoint.id === wp.id));
            }
        }
    });
    
    if (selectedWaypoint && typeof updateSingleWaypointEditControls === "function") {
        updateSingleWaypointEditControls();
    }
    if (typeof updateWaypointList === "function") updateWaypointList(); 

    if(typeof showCustomAlert === 'function') {
        showCustomAlert(
            translate('successTitle') || 'Success', 
            translate('import_success') || "Flight plan imported successfully!"
        );
    }
}

// =============================================================================
// EXPORT FUNCTIONS
// =============================================================================

function exportFlightPlanToJson() {
    if (waypoints.length === 0 && pois.length === 0) {
        if(typeof showCustomAlert === 'function') {
            showCustomAlert(
                translate('errorTitle') || 'Error', 
                translate('nothing_to_export') || "Nothing to export."
            );
        }
        return; 
    }
    
    const plan = {
        waypoints: waypoints.map(wp => ({
            id: wp.id, 
            lat: wp.latlng.lat, 
            lng: wp.latlng.lng,
            altitude: wp.altitude, 
            hoverTime: wp.hoverTime, 
            gimbalPitch: wp.gimbalPitch,
            headingControl: wp.headingControl, 
            fixedHeading: wp.fixedHeading,
            cameraAction: wp.cameraAction || 'none',
            targetPoiId: wp.targetPoiId === undefined ? null : wp.targetPoiId,
            terrainElevationMSL: wp.terrainElevationMSL 
        })),
        pois: pois.map(p => ({ 
            id: p.id, 
            name: p.name, 
            lat: p.latlng.lat, 
            lng: p.latlng.lng, 
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
            homeElevationMsl: homeElevationMslInput ? parseFloat(homeElevationMslInput.value) : 0,
            lastAltitudeAdaptationMode: lastAltitudeAdaptationMode, 
            desiredAGL: desiredAGLInput ? parseInt(desiredAGLInput.value) : 50, 
            desiredAMSL: desiredAMSLInputEl ? parseInt(desiredAMSLInputEl.value) : 100 
        },
        metadata: {
            version: "1.0",
            exportDate: new Date().toISOString(),
            totalDistance: calculateMissionDistance(waypoints),
            estimatedDuration: calculateMissionDuration(waypoints, flightSpeedSlider ? parseFloat(flightSpeedSlider.value) : 5)
        }
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(plan, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr); 
    dl.setAttribute("download", "flight_plan.json");
    document.body.appendChild(dl); 
    dl.click(); 
    document.body.removeChild(dl);
    
    if(typeof showCustomAlert === 'function') {
        showCustomAlert(
            translate('successTitle') || 'Success', 
            translate('export_json_success') || "Flight plan exported as JSON."
        );
    }
}

function exportToGoogleEarthKml() { 
    if (waypoints.length === 0) {
        if(typeof showCustomAlert === 'function') {
            showCustomAlert(
                translate('errorTitle') || 'Error', 
                translate('no_waypoints_export') || "No waypoints to export."
            );
        }
        return; 
    }
    
    let homeElevationMSL = homeElevationMslInput ? parseFloat(homeElevationMslInput.value) : 0;
    if (isNaN(homeElevationMSL)) {
        if(typeof showCustomAlert === 'function') {
            showCustomAlert(
                translate('infoTitle') || 'Info', 
                translate('invalid_elevation_fallback') || "Invalid takeoff elevation (MSL). Using 0m as fallback."
            );
        }
        homeElevationMSL = 0;
    }
    
    const actionTextMap = {
        'takePhoto': translate('cameraActionText_takePhoto') || 'Take Photo',
        'startRecord': translate('cameraActionText_startRecord') || 'Start Recording',
        'stopRecord': translate('cameraActionText_stopRecord') || 'Stop Recording',
    };

    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>Flight Plan (Google Earth)</name>
  <description><![CDATA[
    Flight plan exported from FlightPlanner<br/>
    Total waypoints: ${waypoints.length}<br/>
    Total distance: ${(calculateMissionDistance(waypoints) / 1000).toFixed(2)} km<br/>
    Estimated duration: ${Math.round(calculateMissionDuration(waypoints, flightSpeedSlider ? parseFloat(flightSpeedSlider.value) : 5) / 60)} minutes
  ]]></description>
  
  <Style id="wpStyle">
    <IconStyle>
      <Icon><href>http://maps.google.com/mapfiles/kml/paddle/blu-circle.png</href></Icon>
    </IconStyle>
  </Style>
  
  <Style id="pathStyle">
    <LineStyle>
      <color>ffdb9834</color>
      <width>3</width>
    </LineStyle>
  </Style>
  
  <Style id="poiStyle">
    <IconStyle>
      <Icon><href>http://maps.google.com/mapfiles/kml/paddle/ylw-stars.png</href></Icon>
    </IconStyle>
  </Style>
  
  <Folder>
    <name>Waypoints</name>`;

    waypoints.forEach((wp, index) => {
        const altMSL = homeElevationMSL + wp.altitude;
        let description = `<![CDATA[
          <b>Waypoint ${wp.id}</b><br/>
          Flight Altitude (Rel): ${wp.altitude} m<br/>
          Altitude AMSL: ${altMSL.toFixed(1)} m<br/>`;
        
        if (wp.terrainElevationMSL !== null) {
            description += `Altitude AGL: ${(altMSL - wp.terrainElevationMSL).toFixed(1)} m<br/>
            Terrain Elevation: ${wp.terrainElevationMSL.toFixed(1)} m<br/>`;
        }
        
        description += `
          Gimbal Pitch: ${wp.gimbalPitch}°<br/>
          Camera Action: ${actionTextMap[wp.cameraAction] || (translate('cameraActionText_none') || 'None')}<br/>
          Heading Control: ${wp.headingControl}`;
        
        if (wp.headingControl === 'fixed') {
            description += ` (${wp.fixedHeading}°)`;
        } else if (wp.headingControl === 'poi_track' && wp.targetPoiId) {
            description += ` (POI ID ${wp.targetPoiId})`;
        }
        
        if (wp.hoverTime > 0) {
            description += `<br/>Hover Time: ${wp.hoverTime}s`;
        }
        
        description += `]]>`;
        
        kml += `
    <Placemark>
      <name>WP ${wp.id}</name>
      <description>${description}</description>
      <styleUrl>#wpStyle</styleUrl>
      <Point>
        <altitudeMode>absolute</altitudeMode>
        <coordinates>${wp.latlng.lng},${wp.latlng.lat},${altMSL.toFixed(1)}</coordinates>
      </Point>
    </Placemark>`;
    });
    
    kml += `
  </Folder>`;

    if (waypoints.length >= 2) {
        kml += `
  <Placemark>
    <name>Flight Path</name>
    <styleUrl>#pathStyle</styleUrl>
    <LineString>
      <tessellate>1</tessellate>
      <altitudeMode>absolute</altitudeMode>
      <coordinates>`;
        
        const pathCoords = waypoints.map(wp => 
            `${wp.latlng.lng},${wp.latlng.lat},${(homeElevationMSL + wp.altitude).toFixed(1)}`
        ).join('\n        ');
        
        kml += `
        ${pathCoords}
      </coordinates>
    </LineString>
  </Placemark>`;
    }

    if (pois.length > 0) {
        kml += `
  <Folder>
    <name>Points of Interest</name>`;
        
        pois.forEach(p => { 
            kml += `
    <Placemark>
      <name>${p.name}</name>
      <description><![CDATA[
        <b>POI: ${p.name}</b><br/>
        Altitude MSL: ${p.altitude.toFixed(1)} m<br/>
        Terrain Elevation: ${p.terrainElevationMSL !== null ? p.terrainElevationMSL.toFixed(1) + " m" : "N/A"}<br/>
        Object Height: ${p.objectHeightAboveGround.toFixed(1)} m
      ]]></description>
      <styleUrl>#poiStyle</styleUrl>
      <Point>
        <altitudeMode>absolute</altitudeMode>
        <coordinates>${p.latlng.lng},${p.latlng.lat},${p.altitude}</coordinates>
      </Point>
    </Placemark>`;
        });
        
        kml += `
  </Folder>`;
    }
    
    kml += `
</Document>
</kml>`;
    
    const dataStr = "data:application/vnd.google-earth.kml+xml;charset=utf-8," + encodeURIComponent(kml);
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr); 
    dl.setAttribute("download", "flight_plan_GE.kml");
    document.body.appendChild(dl); 
    dl.click(); 
    document.body.removeChild(dl);
    
    if(typeof showCustomAlert === 'function') {
        showCustomAlert(
            translate('successTitle') || 'Success', 
            translate('export_ge_success') || "Exported for Google Earth."
        );
    }
}

function exportToDjiWpmlKmz() {
    if (typeof JSZip === 'undefined') {
        if(typeof showCustomAlert === 'function') {
            showCustomAlert(translate('errorTitle'), translate('jszip_not_loaded'));
        }
        return; 
    }
    
    const validationErrors = validateWpmlExport();
    if (validationErrors.length > 0) {
        if(typeof showCustomAlert === 'function') {
            showCustomAlert(translate('errorTitle'), validationErrors.join('\n'));
        }
        return;
    }

    actionGroupCounter = 1; 
    actionCounter = 1;      

    const missionFlightSpeed = flightSpeedSlider ? parseFloat(flightSpeedSlider.value) : 5;
    const missionPathType = pathTypeSelect ? pathTypeSelect.value : 'straight';

    const now = new Date();
    const createTimeMillis = now.getTime().toString();
    const waylineIdInt = Math.floor(now.getTime() / 1000); 

    const wpmlNs = "http://www.dji.com/wpmz/1.0.2";

    const totalDistance = calculateMissionDistance(waypoints);
    const totalDuration = calculateMissionDuration(waypoints, missionFlightSpeed);

    let templateKmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="${wpmlNs}">
<Document>
  <wpml:author>FlightPlanner</wpml:author> 
  <wpml:createTime>${createTimeMillis}</wpml:createTime>
  <wpml:updateTime>${createTimeMillis}</wpml:updateTime>
  <wpml:missionConfig>
    <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
    <wpml:finishAction>goHome</wpml:finishAction> 
    <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
    <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction> 
    <wpml:globalTransitionalSpeed>${missionFlightSpeed.toFixed(1)}</wpml:globalTransitionalSpeed>
    <wpml:droneInfo><wpml:droneEnumValue>68</wpml:droneEnumValue><wpml:droneSubEnumValue>0</wpml:droneSubEnumValue></wpml:droneInfo>
    <wpml:payloadInfo><wpml:payloadEnumValue>0</wpml:payloadEnumValue><wpml:payloadSubEnumValue>0</wpml:payloadSubEnumValue><wpml:payloadPositionIndex>0</wpml:payloadPositionIndex></wpml:payloadInfo>
  </wpml:missionConfig>
</Document></kml>`;

    let waylinesWpmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="${wpmlNs}">
<Document>
  <wpml:missionConfig>
    <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
    <wpml:finishAction>goHome</wpml:finishAction>
    <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
    <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction> 
    <wpml:globalTransitionalSpeed>${missionFlightSpeed.toFixed(1)}</wpml:globalTransitionalSpeed>
    <wpml:droneInfo><wpml:droneEnumValue>68</wpml:droneEnumValue><wpml:droneSubEnumValue>0</wpml:droneSubEnumValue></wpml:droneInfo>
  </wpml:missionConfig>
  <Folder>
    <name>Wayline Mission ${waylineIdInt}</name>
    <wpml:templateId>0</wpml:templateId>
    <wpml:executeHeightMode>relativeToStartPoint</wpml:executeHeightMode> 
    <wpml:waylineId>0</wpml:waylineId> 
    <wpml:distance>${Math.round(totalDistance)}</wpml:distance> 
    <wpml:duration>${Math.round(totalDuration)}</wpml:duration> 
    <wpml:autoFlightSpeed>${missionFlightSpeed.toFixed(1)}</wpml:autoFlightSpeed>
`;

    waypoints.forEach((wp, index) => {
        waylinesWpmlContent += `    <Placemark>\n`;
        waylinesWpmlContent += `      <Point><coordinates>${wp.latlng.lng.toFixed(10)},${wp.latlng.lat.toFixed(10)}</coordinates></Point>\n`;
        waylinesWpmlContent += `      <wpml:index>${index}</wpml:index>\n`;
        waylinesWpmlContent += `      <wpml:executeHeight>${parseFloat(wp.altitude).toFixed(1)}</wpml:executeHeight>\n`;
        waylinesWpmlContent += `      <wpml:waypointSpeed>${missionFlightSpeed.toFixed(1)}</wpml:waypointSpeed>\n`;

        waylinesWpmlContent += `      <wpml:waypointHeadingParam>\n`;
        let headingMode = 'followWayline', headingAngle = 0, headingAngleEnable = 0, headingPathMode = 'followBadArc';
        let poiPointXml = `        <wpml:waypointPoiPoint>0.000000,0.000000,0.000000</wpml:waypointPoiPoint>\n`;

        if (wp.headingControl === 'fixed') {
            headingMode = 'lockCourse'; 
            headingAngle = wp.fixedHeading;
            headingAngleEnable = 1;
        } else if (wp.headingControl === 'poi_track' && wp.targetPoiId != null) {
            const targetPoi = pois.find(p => p.id === wp.targetPoiId);
            if (targetPoi) {
                headingMode = 'towardPOI';
                poiPointXml = `        <wpml:waypointPoiPoint>${targetPoi.latlng.lat.toFixed(6)},${targetPoi.latlng.lng.toFixed(6)},0.0</wpml:waypointPoiPoint>\n`; 
            }
        } else { // Auto
            if (index < waypoints.length - 1) {
                headingAngle = calculateBearing(wp.latlng, waypoints[index+1].latlng);
            } else if (index > 0) {
                 headingAngle = calculateBearing(waypoints[index-1].latlng, wp.latlng);
            }
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
            turnMode = 'toPointAndStopWithContinuity';
        } else {
            turnMode = (missionPathType === 'curved') ? 'toPointAndPassWithContinuity' : 'toPointAndStopWithContinuity';
        }
        
        waylinesWpmlContent += `      <wpml:waypointTurnParam>\n`;
        waylinesWpmlContent += `        <wpml:waypointTurnMode>${turnMode}</wpml:waypointTurnMode>\n`;
        waylinesWpmlContent += `        <wpml:waypointTurnDampingDist>0.2</wpml:waypointTurnDampingDist>\n`; // Common default
        waylinesWpmlContent += `      </wpml:waypointTurnParam>\n`;
        
        // This tag is less common and often inferred. Let's stick to the official spec where turnMode is key.
        // waylinesWpmlContent += `      <wpml:useStraightLine>${useStraight}</wpml:useStraightLine>\n`;

        let gimbalPitch = (wp.headingControl !== 'poi_track') ? wp.gimbalPitch : 0;
        
        waylinesWpmlContent += `      <wpml:gimbalPitch>${gimbalPitch}</wpml:gimbalPitch>\n`;

        let actionsXmlBlock = "";
        
        if (wp.hoverTime > 0) {
            actionsXmlBlock += `        <wpml:action><wpml:actionId>${actionCounter++}</wpml:actionId><wpml:actionActuatorFunc>HOVER</wpml:actionActuatorFunc><wpml:actionActuatorFuncParam><wpml:hoverTime>${wp.hoverTime}</wpml:hoverTime></wpml:actionActuatorFuncParam></wpml:action>\n`;
        }
        if (wp.cameraAction && wp.cameraAction !== 'none') {
            let actuatorFunc = '';
            if (wp.cameraAction === 'takePhoto') actuatorFunc = 'takePhoto';
            else if (wp.cameraAction === 'startRecord') actuatorFunc = 'startRecord';
            else if (wp.cameraAction === 'stopRecord') actuatorFunc = 'stopRecord';
            
            if (actuatorFunc) {
                actionsXmlBlock += `        <wpml:action><wpml:actionId>${actionCounter++}</wpml:actionId><wpml:actionActuatorFunc>${actuatorFunc}</wpml:actionActuatorFunc><wpml:actionActuatorFuncParam><wpml:payloadPositionIndex>0</wpml:payloadPositionIndex></wpml:actionActuatorFuncParam></wpml:action>\n`;
            }
        }
        if (wp.headingControl !== 'poi_track' && wp.gimbalPitch !== gimbalPitch) {
             actionsXmlBlock += `        <wpml:action><wpml:actionId>${actionCounter++}</wpml:actionId><wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc><wpml:actionActuatorFuncParam><wpml:gimbalPitchRotateAngle>${wp.gimbalPitch}</wpml:gimbalPitchRotateAngle></wpml:actionActuatorFuncParam></wpml:action>\n`;
        }

        if (actionsXmlBlock) {
            waylinesWpmlContent += `      <wpml:actionGroup><wpml:actionGroupId>${actionGroupCounter++}</wpml:actionGroupId><wpml:actionGroupStartIndex>${index}</wpml:actionGroupStartIndex><wpml:actionGroupEndIndex>${index}</wpml:actionGroupEndIndex><wpml:actionGroupMode>sequence</wpml:actionGroupMode><wpml:actionTrigger><wpml:actionTriggerType>reachPoint</wpml:actionTriggerType></wpml:actionTrigger>\n`;
            waylinesWpmlContent += actionsXmlBlock;
            waylinesWpmlContent += `      </wpml:actionGroup>\n`;
        }
        waylinesWpmlContent += `    </Placemark>\n`;
    });

    waylinesWpmlContent += `  </Folder>\n</Document>\n</kml>`;

    const zip = new JSZip();
    const wpmzFolder = zip.folder("wpmz");
    wpmzFolder.folder("res"); 
    wpmzFolder.file("template.kml", templateKmlContent);
    wpmzFolder.file("waylines.wpml", waylinesWpmlContent);

    zip.generateAsync({ type: "blob", mimeType: "application/vnd.google-earth.kmz" })
        .then(function(blob) {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `flight_plan_dji_${waylineIdInt}.kmz`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            if(typeof showCustomAlert === 'function') {
                showCustomAlert(translate('successTitle'), translate('export_dji_success'));
            }
        })
        .catch(function(err) {
            if(typeof showCustomAlert === 'function') {
                showCustomAlert(`${translate('errorTitle')}: ${err.message}`, "KMZ Generation Error");
            }
            console.error("KMZ generation error:", err);
        });
}
