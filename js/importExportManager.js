// File: importExportManager.js

// Global dependencies (expected from other files):
// waypoints, pois, flightSpeedSlider, pathTypeSelect, homeElevationMslInput,
// waypointCounter, poiCounter, actionGroupCounter, actionCounter, lastAltitudeAdaptationMode (from config.js)
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
        clearWaypoints(); 
    }

    let maxImportedPoiId = 0;
    let maxImportedWaypointId = 0;

    if (plan.settings) {
        if (defaultAltitudeSlider) defaultAltitudeSlider.value = plan.settings.defaultAltitude || 30;
        if (defaultAltitudeValueEl) defaultAltitudeValueEl.textContent = defaultAltitudeSlider.value + 'm';
        if (flightSpeedSlider) flightSpeedSlider.value = plan.settings.flightSpeed || 8;
        if (flightSpeedValueEl) flightSpeedValueEl.textContent = flightSpeedSlider.value + ' m/s';
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

    if (plan.pois && Array.isArray(plan.pois)) {
        for (const pData of plan.pois) { 
            const poiOptions = {
                id: pData.id,
                name: pData.name,
                objectHeightAboveGround: pData.objectHeightAboveGround !== undefined ? pData.objectHeightAboveGround : 0,
                terrainElevationMSL: pData.terrainElevationMSL !== undefined ? pData.terrainElevationMSL : null,
                calledFromLoad: true 
            };
            if (typeof addPOI === 'function') {
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
                gimbalPitch: wpData.gimbalPitch !== undefined ? wpData.gimbalPitch : 0, 
                headingControl: wpData.headingControl, 
                fixedHeading: wpData.fixedHeading,
                cameraAction: wpData.cameraAction || 'none',
                targetPoiId: wpData.targetPoiId === undefined ? null : wpData.targetPoiId,
                terrainElevationMSL: wpData.terrainElevationMSL !== undefined ? wpData.terrainElevationMSL : null,
                calledFromLoad: true 
            };
            if(typeof addWaypoint === 'function') addWaypoint(L.latLng(wpData.lat, wpData.lng), waypointOptions);
            if (wpData.id > maxImportedWaypointId) maxImportedWaypointId = wpData.id;
        });
    }

    waypointCounter = maxImportedWaypointId + 1;
    poiCounter = maxImportedPoiId + 1;
    
    if(poiNameInput) poiNameInput.value = '';
    if(poiObjectHeightInputEl) poiObjectHeightInputEl.value = '0';
    if(poiTerrainElevationInputEl) {
        poiTerrainElevationInputEl.value = '0';
        poiTerrainElevationInputEl.readOnly = true; 
    }
    if(typeof updatePoiFinalAltitudeDisplay === "function") updatePoiFinalAltitudeDisplay(); 
    lastActivePoiForTerrainFetch = null; 


    if(typeof updatePOIList === 'function') updatePOIList();
    if(typeof updateWaypointList === 'function') updateWaypointList();
    if(typeof updateFlightPath === 'function') updateFlightPath(); 
    if(typeof updateFlightStatistics === 'function') updateFlightStatistics();
    if(typeof fitMapToWaypoints === 'function') fitMapToWaypoints();
    if(typeof updatePathModeDisplay === "function") updatePathModeDisplay(); 


    if (waypoints.length > 0 && typeof selectWaypoint === 'function') {
        selectWaypoint(waypoints[0]); 
    } else if (waypointControlsDiv) {
        waypointControlsDiv.style.display = 'none';
    }
    
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

    console.log("LOADFLIGHTPLAN: Ricalcolo finale gimbal per tutti i waypoint POI_TRACK...");
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

    if(typeof showCustomAlert === 'function') showCustomAlert("Piano di volo importato con successo!", "Import Successo"); 
}


function exportFlightPlanToJson() {
    if (waypoints.length === 0 && pois.length === 0) {
        if(typeof showCustomAlert === 'function') showCustomAlert("Niente da esportare.", "Errore Export"); return; 
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
            homeElevationMsl: homeElevationMslInput ? parseFloat(homeElevationMslInput.value) : 0,
            lastAltitudeAdaptationMode: lastAltitudeAdaptationMode, // Salva la modalità
            desiredAGL: desiredAGLInput ? parseInt(desiredAGLInput.value) : 50, // Salva AGL target
            desiredAMSL: desiredAMSLInputEl ? parseInt(desiredAMSLInputEl.value) : 100 // Salva AMSL target
        }
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(plan, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr); dl.setAttribute("download", "flight_plan.json");
    document.body.appendChild(dl); dl.click(); document.body.removeChild(dl);
    if(typeof showCustomAlert === 'function') showCustomAlert("Piano di volo esportato come JSON.", "Successo"); 
}

function exportToGoogleEarthKml() { 
    if (waypoints.length === 0) {
        if(typeof showCustomAlert === 'function') showCustomAlert("Nessun waypoint da esportare.", "Errore Export"); return; 
    }
    let homeElevationMSL = homeElevationMslInput ? parseFloat(homeElevationMslInput.value) : 0;
    if (isNaN(homeElevationMSL)) {
        if(typeof showCustomAlert === 'function') showCustomAlert("Elevazione di decollo (MSL) non valida. Uso 0m come fallback.", "Attenzione Export"); 
        homeElevationMSL = 0;
    }
    let kml = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Flight Plan (GE)</name>`;
    kml += `<Style id="wpStyle"><IconStyle><Icon><href>http://maps.google.com/mapfiles/kml/paddle/blu-circle.png</href></Icon></IconStyle></Style>`;
    kml += `<Style id="pathStyle"><LineStyle><color>ffdb9834</color><width>3</width></LineStyle></Style>`;
    kml += `<Style id="poiStyle"><IconStyle><Icon><href>http://maps.google.com/mapfiles/kml/paddle/ylw-stars.png</href></Icon></IconStyle></Style>`;
    kml += `<Folder><name>Waypoints</name>`;
    waypoints.forEach(wp => {
        const altMSL = homeElevationMSL + wp.altitude;
        let description = `<![CDATA[Alt. Volo (Rel): ${wp.altitude} m<br/>Alt. AMSL: ${altMSL.toFixed(1)} m<br/>`;
        if (wp.terrainElevationMSL !== null) {
            description += `Alt. AGL: ${(altMSL - wp.terrainElevationMSL).toFixed(1)} m<br/>Elev. Terreno: ${wp.terrainElevationMSL.toFixed(1)} m<br/>`;
        }
        description += `Gimbal: ${wp.gimbalPitch}°<br/>Azione: ${getCameraActionText(wp.cameraAction)}<br/>Heading: ${wp.headingControl}${wp.headingControl==='fixed' ? ` (${wp.fixedHeading}°)`:''}${wp.targetPoiId ? ` (POI ID ${wp.targetPoiId})`:''}]]>`;
        kml += `<Placemark><name>WP ${wp.id}</name><description>${description}</description><styleUrl>#wpStyle</styleUrl><Point><altitudeMode>absolute</altitudeMode><coordinates>${wp.latlng.lng},${wp.latlng.lat},${altMSL.toFixed(1)}</coordinates></Point></Placemark>`;
    });
    kml += `</Folder>`;
    if (waypoints.length >= 2) {
        kml += `<Placemark><name>Flight Path</name><styleUrl>#pathStyle</styleUrl><LineString><tessellate>1</tessellate><altitudeMode>absolute</altitudeMode><coordinates>\n`;
        const pathCoords = waypoints.map(wp => `${wp.latlng.lng},${wp.latlng.lat},${(homeElevationMSL + wp.altitude).toFixed(1)}`).join('\n');
        kml += pathCoords + `\n</coordinates></LineString></Placemark>`;
    }
    if (pois.length > 0) {
        kml += `<Folder><name>POIs</name>`;
        pois.forEach(p => { 
            kml += `<Placemark><name>${p.name}</name><description><![CDATA[Alt. MSL: ${p.altitude.toFixed(1)} m<br>Elev. Terreno: ${p.terrainElevationMSL !== null ? p.terrainElevationMSL.toFixed(1) + " m" : "N/A"}<br>H. Oggetto: ${p.objectHeightAboveGround.toFixed(1)} m]]></description><styleUrl>#poiStyle</styleUrl><Point><altitudeMode>absolute</altitudeMode><coordinates>${p.latlng.lng},${p.latlng.lat},${p.altitude}</coordinates></Point></Placemark>`;
        });
        kml += `</Folder>`;
    }
    kml += `</Document></kml>`;
    const dataStr = "data:application/vnd.google-earth.kml+xml;charset=utf-8," + encodeURIComponent(kml);
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr); dl.setAttribute("download", "flight_plan_GE.kml");
    document.body.appendChild(dl); dl.click(); document.body.removeChild(dl);
    if(typeof showCustomAlert === 'function') showCustomAlert("Esportato per Google Earth.", "Successo"); 
}

function exportToDjiWpmlKmz() {
    if (typeof JSZip === 'undefined') {
        if(typeof showCustomAlert === 'function') showCustomAlert("Libreria JSZip non caricata.", "Errore"); return; 
    }
    if (!waypoints || waypoints.length === 0) {
        if(typeof showCustomAlert === 'function') showCustomAlert("Nessun waypoint da esportare.", "Errore"); return; 
    }

    actionGroupCounter = 1; 
    actionCounter = 1;      

    const missionFlightSpeed = parseFloat(flightSpeedSlider.value);
    const missionPathType = pathTypeSelect.value; 

    const now = new Date();
    const createTimeMillis = now.getTime().toString();
    const waylineIdInt = Math.floor(now.getTime() / 1000); 

    let templateKmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.2">
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
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.2">
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
    <wpml:distance>0</wpml:distance> 
    <wpml:duration>0</wpml:duration> 
    <wpml:autoFlightSpeed>${missionFlightSpeed.toFixed(1)}</wpml:autoFlightSpeed>
`;

    waypoints.forEach((wp, index) => {
        waylinesWpmlContent += `      <Placemark>\n`;
        waylinesWpmlContent += `        <Point><coordinates>${wp.latlng.lng.toFixed(10)},${wp.latlng.lat.toFixed(10)}</coordinates></Point>\n`;
        waylinesWpmlContent += `        <wpml:index>${index}</wpml:index>\n`;
        waylinesWpmlContent += `        <wpml:executeHeight>${parseFloat(wp.altitude).toFixed(1)}</wpml:executeHeight>\n`;
        waylinesWpmlContent += `        <wpml:waypointSpeed>${missionFlightSpeed.toFixed(1)}</wpml:waypointSpeed>\n`;

        waylinesWpmlContent += `        <wpml:waypointHeadingParam>\n`;
        let headingMode, headingAngle = 0, headingAngleEnable = 0, headingPathMode = 'followBadArc';
        let poiPointXml = `          <wpml:waypointPoiPoint>0.000000,0.000000,0.000000</wpml:waypointPoiPoint>\n`;

        if (wp.headingControl === 'fixed' && typeof wp.fixedHeading === 'number') {
            headingMode = 'lockCourse'; 
            headingAngle = wp.fixedHeading;
            headingAngleEnable = 1; 
            headingPathMode = 'followBadArc'; 
        } else if (wp.headingControl === 'poi_track' && wp.targetPoiId != null) {
            const targetPoi = pois.find(p => p.id === wp.targetPoiId);
            if (targetPoi) {
                headingMode = 'towardPOI'; 
                headingAngleEnable = (index === 0 || index === waypoints.length - 1 || waypoints[index-1]?.targetPoiId !== wp.targetPoiId || (index + 1 < waypoints.length && waypoints[index+1]?.targetPoiId !== wp.targetPoiId) ) ? 1 : 0;
                headingPathMode = 'followBadArc';
                let poiAltMSL = targetPoi.altitude; 
                poiPointXml = `          <wpml:waypointPoiPoint>${targetPoi.latlng.lat.toFixed(6)},${targetPoi.latlng.lng.toFixed(6)},${parseFloat(poiAltMSL).toFixed(1)}</wpml:waypointPoiPoint>\n`; 
            } else { 
                headingMode = 'followWayline'; 
                headingPathMode = 'followBadArc'; 
                headingAngleEnable = 0;
            } 
        } else { 
            headingMode = 'followWayline'; 
            headingPathMode = 'followBadArc';
            headingAngleEnable = 0; 
            if (index < waypoints.length - 1 && typeof calculateBearing === 'function') {
                headingAngle = calculateBearing(wp.latlng, waypoints[index+1].latlng);
            } else if (index > 0 && typeof calculateBearing === 'function') {
                 headingAngle = calculateBearing(waypoints[index-1].latlng, wp.latlng);
            } else { headingAngle = 0; }
        }

        waylinesWpmlContent += `          <wpml:waypointHeadingMode>${headingMode}</wpml:waypointHeadingMode>\n`;
        waylinesWpmlContent += `          <wpml:waypointHeadingAngle>${Math.round(headingAngle)}</wpml:waypointHeadingAngle>\n`;
        waylinesWpmlContent += poiPointXml;
        waylinesWpmlContent += `          <wpml:waypointHeadingAngleEnable>${headingAngleEnable}</wpml:waypointHeadingAngleEnable>\n`;
        waylinesWpmlContent += `          <wpml:waypointHeadingPathMode>${headingPathMode}</wpml:waypointHeadingPathMode>\n`;
        waylinesWpmlContent += `          <wpml:waypointHeadingPoiIndex>0</wpml:waypointHeadingPoiIndex>\n`; 
        waylinesWpmlContent += `        </wpml:waypointHeadingParam>\n`;

        let turnMode;
        if (index === 0 || index === waypoints.length - 1 || wp.headingControl === 'fixed' || missionPathType === 'straight') {
            turnMode = (missionPathType === 'curved' && wp.headingControl !== 'fixed') ? 'toPointAndStopWithContinuityCurvature' : 'toPointAndStopWithDiscontinuityCurvature';
        } else { 
            turnMode = 'toPointAndPassWithContinuityCurvature';
        }
        const useStraight = (missionPathType === 'straight' || wp.headingControl === 'fixed') ? '1' : '0';

        waylinesWpmlContent += `        <wpml:waypointTurnParam>\n`;
        waylinesWpmlContent += `          <wpml:waypointTurnMode>${turnMode}</wpml:waypointTurnMode>\n`;
        waylinesWpmlContent += `          <wpml:waypointTurnDampingDist>0.0</wpml:waypointTurnDampingDist>\n`;
        waylinesWpmlContent += `        </wpml:waypointTurnParam>\n`;
        waylinesWpmlContent += `        <wpml:useStraightLine>${useStraight}</wpml:useStraightLine>\n`;

        let gimbalPitchForParam = 0; 
        if(wp.headingControl !== 'poi_track' && typeof wp.gimbalPitch === 'number') {
            gimbalPitchForParam = wp.gimbalPitch;
        }
        waylinesWpmlContent += `        <wpml:waypointGimbalHeadingParam>\n`;
        waylinesWpmlContent += `          <wpml:waypointGimbalPitchAngle>${gimbalPitchForParam}</wpml:waypointGimbalPitchAngle>\n`;
        waylinesWpmlContent += `          <wpml:waypointGimbalYawAngle>0</wpml:waypointGimbalYawAngle>\n`; 
        waylinesWpmlContent += `        </wpml:waypointGimbalHeadingParam>\n`;

        let actionsXmlBlock = "";
        if (typeof wp.gimbalPitch === 'number' && wp.headingControl !== 'poi_track') {
            actionsXmlBlock += `          <wpml:action><wpml:actionId>${actionCounter++}</wpml:actionId><wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc><wpml:actionActuatorFuncParam>`;
            actionsXmlBlock += `<wpml:gimbalPitchRotateEnable>1</wpml:gimbalPitchRotateEnable><wpml:gimbalPitchRotateAngle>${parseFloat(wp.gimbalPitch).toFixed(1)}</wpml:gimbalPitchRotateAngle>`;
            actionsXmlBlock += `<wpml:payloadPositionIndex>0</wpml:payloadPositionIndex><wpml:gimbalHeadingYawBase>aircraft</wpml:gimbalHeadingYawBase><wpml:gimbalRotateMode>absoluteAngle</wpml:gimbalRotateMode>`;
            actionsXmlBlock += `<wpml:gimbalRollRotateEnable>0</wpml:gimbalRollRotateEnable><wpml:gimbalYawRotateEnable>0</wpml:gimbalYawRotateEnable><wpml:gimbalYawRotateAngle>0</wpml:gimbalYawRotateAngle>`;
            actionsXmlBlock += `<wpml:gimbalRotateTimeEnable>0</wpml:gimbalRotateTimeEnable><wpml:gimbalRotateTime>0</wpml:gimbalRotateTime>`;
            actionsXmlBlock += `</wpml:actionActuatorFuncParam></wpml:action>\n`;
        }
        if (wp.hoverTime > 0) {
            actionsXmlBlock += `          <wpml:action><wpml:actionId>${actionCounter++}</wpml:actionId>`;
            actionsXmlBlock += `<wpml:actionActuatorFunc>HOVER</wpml:actionActuatorFunc>`;
            actionsXmlBlock += `<wpml:actionActuatorFuncParam><wpml:hoverTime>${wp.hoverTime}</wpml:hoverTime></wpml:actionActuatorFuncParam></wpml:action>\n`;
        }
        if (wp.cameraAction && wp.cameraAction !== 'none') {
            let actuatorFunc = '', params = `<wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>\n`;
            if (wp.cameraAction === 'takePhoto') { actuatorFunc = 'takePhoto'; params += `<wpml:useGlobalPayloadLensIndex>0</wpml:useGlobalPayloadLensIndex>\n`; }
            else if (wp.cameraAction === 'startRecord') { actuatorFunc = 'startRecord'; params += `<wpml:useGlobalPayloadLensIndex>0</wpml:useGlobalPayloadLensIndex>\n`; }
            else if (wp.cameraAction === 'stopRecord') { actuatorFunc = 'stopRecord';} 
            if (actuatorFunc) {
                actionsXmlBlock += `          <wpml:action><wpml:actionId>${actionCounter++}</wpml:actionId>`;
                actionsXmlBlock += `<wpml:actionActuatorFunc>${actuatorFunc}</wpml:actionActuatorFunc>`;
                actionsXmlBlock += `<wpml:actionActuatorFuncParam>\n${params}</wpml:actionActuatorFuncParam></wpml:action>\n`;
            }
        }

        if (actionsXmlBlock) {
            waylinesWpmlContent += `        <wpml:actionGroup><wpml:actionGroupId>${actionGroupCounter++}</wpml:actionGroupId>`;
            waylinesWpmlContent += `<wpml:actionGroupStartIndex>${index}</wpml:actionGroupStartIndex><wpml:actionGroupEndIndex>${index}</wpml:actionGroupEndIndex>`;
            waylinesWpmlContent += `<wpml:actionGroupMode>sequence</wpml:actionGroupMode>`; 
            waylinesWpmlContent += `<wpml:actionTrigger><wpml:actionTriggerType>reachPoint</wpml:actionTriggerType></wpml:actionTrigger>\n`;
            waylinesWpmlContent += actionsXmlBlock;
            waylinesWpmlContent += `        </wpml:actionGroup>\n`;
        }
        waylinesWpmlContent += `      </Placemark>\n`;
    });

    waylinesWpmlContent += `    </Folder>\n  </Document>\n</kml>`;

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
            if(typeof showCustomAlert === 'function') showCustomAlert("DJI WPML KMZ esportato.", "Successo"); 
        })
        .catch(function(err) {
            if(typeof showCustomAlert === 'function') showCustomAlert("Errore nella generazione del KMZ: " + err.message, "Errore"); 
            console.error("KMZ generation error:", err);
        });
}
