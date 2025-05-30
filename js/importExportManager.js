// File: importExportManager.js

// Depends on: config.js (global vars like waypoints, pois, sliders, counters)
// Depends on: utils.js (showCustomAlert, getCameraActionText, haversineDistance - se non ridefinita localmente)
// Depends on: waypointManager.js (addWaypoint - per l'import)
// Depends on: poiManager.js (addPOIfromData - idealmente per l'import)
// External dependency: JSZip library

// Assicurati che queste funzioni siano disponibili globalmente o importate se usi moduli ES6
// Esempio: se haversineDistance è in utils.js, dovrebbe essere accessibile.
// Per getCameraActionText, se non è globale, copiala qui o in utils.js.
function getCameraActionText(action) { /* ... come definita prima ... */ }
if (typeof getCameraActionText === 'undefined') { // Fallback se non globale
    // eslint-disable-next-line no-inner-declarations
    function getCameraActionText(action) {
        switch (action) {
            case 'takePhoto': return 'Photo';
            case 'startRecord': return 'Rec Start';
            case 'stopRecord': return 'Rec Stop';
            default: return 'None';
        }
    }
}


/**
 * Triggers the hidden file input element for JSON import.
 */
function triggerImport() {
    if (fileInputEl) { // fileInputEl da domCache.js
        fileInputEl.click();
    } else {
        if(typeof showCustomAlert === 'function') showCustomAlert("File input element not found.", "Import Error");
    }
}

/**
 * Handles the file import process once a file is selected.
 */
function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedPlan = JSON.parse(e.target.result);
            if(typeof loadFlightPlan === 'function') loadFlightPlan(importedPlan);
        } catch (err) {
            if(typeof showCustomAlert === 'function') showCustomAlert("Error parsing flight plan file: " + err.message, "Import Error");
            console.error("Flight plan import error:", err);
        }
    };
    reader.readAsText(file);
    if (event.target) event.target.value = null;
}

/**
 * Loads a flight plan from a parsed JSON object.
 * (Questa funzione dovrebbe idealmente chiamare funzioni specifiche per aggiungere waypoint/POI
 *  che gestiscano correttamente anche i contatori globali e la creazione dei marker.)
 */
function loadFlightPlan(plan) {
    if(typeof clearWaypoints === 'function') clearWaypoints(); // clearWaypoints è globale
    if (pois && typeof map !== 'undefined') { 
        pois.forEach(p => { if (p.marker) map.removeLayer(p.marker); });
    }
    pois = []; 
    poiCounter = 1; 

    if (plan.settings) {
        if (defaultAltitudeSlider) defaultAltitudeSlider.value = plan.settings.defaultAltitude || 30;
        if (defaultAltitudeValueEl) defaultAltitudeValueEl.textContent = defaultAltitudeSlider.value + 'm';
        if (flightSpeedSlider) flightSpeedSlider.value = plan.settings.flightSpeed || 8;
        if (flightSpeedValueEl) flightSpeedValueEl.textContent = flightSpeedSlider.value + ' m/s';
        if (pathTypeSelect) pathTypeSelect.value = plan.settings.pathType || 'straight';
        waypointCounter = plan.settings.nextWaypointId || 1; 
        poiCounter = plan.settings.nextPoiId || 1;
        if (homeElevationMslInput && typeof plan.settings.homeElevationMsl === 'number') {
            homeElevationMslInput.value = plan.settings.homeElevationMsl;
        }
    }

    if (plan.pois && Array.isArray(plan.pois)) {
        plan.pois.forEach(pData => {
            // Sarebbe meglio una funzione addPoiFromData(pData) in poiManager.js
            const poiLatlng = L.latLng(pData.lat, pData.lng);
            const tempPoiName = poiNameInput ? poiNameInput.value : ''; 
            if(poiNameInput) poiNameInput.value = pData.name || `POI ${pData.id || poiCounter}`;
            if(typeof addPOI === 'function') addPOI(poiLatlng); // addPOI globale da poiManager.js
            if(poiNameInput) poiNameInput.value = tempPoiName; 
            if (pData.id && pData.id >= poiCounter) poiCounter = pData.id + 1;
        });
    }

    if (plan.waypoints && Array.isArray(plan.waypoints)) {
        plan.waypoints.forEach(wpData => {
            const waypointOptions = {
                altitude: wpData.altitude, hoverTime: wpData.hoverTime, gimbalPitch: wpData.gimbalPitch,
                headingControl: wpData.headingControl, fixedHeading: wpData.fixedHeading,
                cameraAction: wpData.cameraAction || 'none',
                targetPoiId: wpData.targetPoiId === undefined ? null : wpData.targetPoiId,
                id: wpData.id 
            };
             // addWaypoint globale da waypointManager.js
            if(typeof addWaypoint === 'function') addWaypoint(L.latLng(wpData.lat, wpData.lng), waypointOptions);
            else console.error("Global addWaypoint function not found for import.");

            if (wpData.id && wpData.id >= waypointCounter) {
                waypointCounter = wpData.id + 1;
            }
        });
    }

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
    if(typeof showCustomAlert === 'function') showCustomAlert("Flight plan imported successfully!", "Import Success");
}


/**
 * Exports the current flight plan to a JSON file.
 */
function exportFlightPlanToJson() { /* ... identica a prima ... */ }
// (Incollo per completezza)
function exportFlightPlanToJson() {
    if (waypoints.length === 0 && pois.length === 0) {
        if(typeof showCustomAlert === 'function') showCustomAlert("Nothing to export.", "Export Error"); return;
    }
    const plan = {
        waypoints: waypoints.map(wp => ({
            id: wp.id, lat: wp.latlng.lat, lng: wp.latlng.lng,
            altitude: wp.altitude, hoverTime: wp.hoverTime, gimbalPitch: wp.gimbalPitch,
            headingControl: wp.headingControl, fixedHeading: wp.fixedHeading,
            cameraAction: wp.cameraAction || 'none',
            targetPoiId: wp.targetPoiId === undefined ? null : wp.targetPoiId
        })),
        pois: pois.map(p => ({ id:p.id, name:p.name, lat:p.latlng.lat, lng:p.latlng.lng, altitude: p.altitude || 0 })),
        settings: {
            defaultAltitude: parseInt(defaultAltitudeSlider.value),
            flightSpeed: parseFloat(flightSpeedSlider.value),
            pathType: pathTypeSelect.value,
            nextWaypointId: waypointCounter, nextPoiId: poiCounter,
            homeElevationMsl: homeElevationMslInput ? parseFloat(homeElevationMslInput.value) : 0
        }
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(plan, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr); dl.setAttribute("download", "flight_plan.json");
    document.body.appendChild(dl); dl.click(); document.body.removeChild(dl);
    if(typeof showCustomAlert === 'function') showCustomAlert("Flight plan exported as JSON.", "Success");
}

/**
 * Exports the flight plan to a KML file for Google Earth.
 */
function exportToGoogleEarthKml() { /* ... identica a prima ... */ }
// (Incollo per completezza)
function exportToGoogleEarthKml() { 
    if (waypoints.length === 0) {
        if(typeof showCustomAlert === 'function') showCustomAlert("No waypoints to export.", "Export Error"); return;
    }
    let homeElevationMSL = parseFloat(homeElevationMslInput.value);
    if (isNaN(homeElevationMSL)) {
        if(typeof showCustomAlert === 'function') showCustomAlert("Takeoff Elevation (MSL) is invalid. Using 0m as fallback.", "Export Warning");
        homeElevationMSL = 0;
    }
    let kml = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Flight Plan (GE)</name>`;
    kml += `<Style id="wpStyle"><IconStyle><Icon><href>http://maps.google.com/mapfiles/kml/paddle/blu-circle.png</href></Icon></IconStyle></Style>`;
    kml += `<Style id="pathStyle"><LineStyle><color>ffdb9834</color><width>3</width></LineStyle></Style>`;
    kml += `<Style id="poiStyle"><IconStyle><Icon><href>http://maps.google.com/mapfiles/kml/paddle/ylw-stars.png</href></Icon></IconStyle></Style>`;
    kml += `<Folder><name>Waypoints</name>`;
    waypoints.forEach(wp => {
        const altMSL = homeElevationMSL + wp.altitude;
        const description = `<![CDATA[MSL: ${altMSL.toFixed(1)}m<br/>Gimbal: ${wp.gimbalPitch}°<br/>Action: ${getCameraActionText(wp.cameraAction)}<br/>Heading: ${wp.headingControl}${wp.headingControl==='fixed' ? ` (${wp.fixedHeading}°)`:''}${wp.targetPoiId ? ` (POI ID ${wp.targetPoiId})`:''}]]>`;
        kml += `<Placemark><name>WP ${wp.id} (Rel: ${wp.altitude}m)</name><description>${description}</description><styleUrl>#wpStyle</styleUrl><Point><altitudeMode>absolute</altitudeMode><coordinates>${wp.latlng.lng},${wp.latlng.lat},${altMSL.toFixed(1)}</coordinates></Point></Placemark>`;
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
            kml += `<Placemark><name>${p.name}</name><styleUrl>#poiStyle</styleUrl><Point><altitudeMode>clampToGround</altitudeMode><coordinates>${p.latlng.lng},${p.latlng.lat},0</coordinates></Point></Placemark>`;
        });
        kml += `</Folder>`;
    }
    kml += `</Document></kml>`;
    const dataStr = "data:application/vnd.google-earth.kml+xml;charset=utf-8," + encodeURIComponent(kml);
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr); dl.setAttribute("download", "flight_plan_GE.kml");
    document.body.appendChild(dl); dl.click(); document.body.removeChild(dl);
    if(typeof showCustomAlert === 'function') showCustomAlert("Exported for Google Earth.", "Success");
}


/**
 * Exports the flight plan to a DJI WPML KMZ file.
 * Targets GRIDS (`pathType: "straight"`) with specific DJI parameters.
 */
function exportToDjiWpmlKmz() {
    if (typeof JSZip === 'undefined') {
        if(typeof showCustomAlert === 'function') showCustomAlert("JSZip library not loaded.", "Error"); return;
    }
    if (!waypoints || waypoints.length === 0) {
        if(typeof showCustomAlert === 'function') showCustomAlert("No waypoints to export.", "Error"); return;
    }

    actionGroupCounter = 1; 
    actionCounter = 1;      

    const missionFlightSpeed = parseFloat(flightSpeedSlider.value);
    const missionPathType = pathTypeSelect.value; 

    const now = new Date();
    const createTimeMillis = now.getTime().toString();
    const waylineIdInt = Math.floor(now.getTime() / 1000);

    let kmlTotalDistance = 0;
    if (waypoints.length >= 2) {
        for (let i = 0; i < waypoints.length - 1; i++) {
            kmlTotalDistance += (typeof haversineDistance === 'function' ? haversineDistance(waypoints[i].latlng, waypoints[i+1].latlng) : 0);
        }
    }
    let kmlTotalHoverTime = waypoints.reduce((sum, wp) => sum + (wp.hoverTime || 0), 0);
    const kmlTotalDuration = (kmlTotalDistance / (missionFlightSpeed > 0 ? missionFlightSpeed : 1)) + kmlTotalHoverTime;

    let templateKmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.2">
<Document>
  <wpml:author>fly</wpml:author> {/* Come da file DJI funzionante */}
  <wpml:createTime>${createTimeMillis}</wpml:createTime>
  <wpml:updateTime>${createTimeMillis}</wpml:updateTime>
  <wpml:missionConfig>
    <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
    <wpml:finishAction>goHome</wpml:finishAction> {/* o noAction come da file DJI funzionante */}
    <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
    <wpml:executeRCLostAction>hover</wpml:executeRCLostAction> {/* o goBack */}
    <wpml:globalTransitionalSpeed>${missionFlightSpeed.toFixed(1)}</wpml:globalTransitionalSpeed>
    <wpml:droneInfo><wpml:droneEnumValue>68</wpml:droneEnumValue><wpml:droneSubEnumValue>0</wpml:droneSubEnumValue></wpml:droneInfo>
    {/* <wpml:payloadInfo> ... </wpml:payloadInfo> // Opzionale, DJI template non lo aveva ma il nostro sì */}
  </wpml:missionConfig>
</Document></kml>`;

    let waylinesWpmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.2">
<Document>
  <wpml:missionConfig>
    <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
    <wpml:finishAction>goHome</wpml:finishAction>
    <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
    <wpml:executeRCLostAction>hover</wpml:executeRCLostAction>
    <wpml:globalTransitionalSpeed>${missionFlightSpeed.toFixed(1)}</wpml:globalTransitionalSpeed>
    <wpml:droneInfo><wpml:droneEnumValue>68</wpml:droneEnumValue><wpml:droneSubEnumValue>0</wpml:droneSubEnumValue></wpml:droneInfo>
  </wpml:missionConfig>
  <Folder>
    <name>Wayline Mission ${waylineIdInt}</name>
    <wpml:templateId>0</wpml:templateId>
    <wpml:executeHeightMode>relativeToStartPoint</wpml:executeHeightMode>
    <wpml:waylineId>0</wpml:waylineId> {/* Come da file DJI */}
    <wpml:distance>0</wpml:distance> {/* Come da file DJI, ricalcolato dal drone */}
    <wpml:duration>0</wpml:duration> {/* Come da file DJI, ricalcolato dal drone */}
    <wpml:autoFlightSpeed>${missionFlightSpeed.toFixed(1)}</wpml:autoFlightSpeed>
`;

    waypoints.forEach((wp, index) => {
        waylinesWpmlContent += `      <Placemark>\n`;
        waylinesWpmlContent += `        <Point><coordinates>${wp.latlng.lng.toFixed(10)},${wp.latlng.lat.toFixed(10)}</coordinates></Point>\n`;
        waylinesWpmlContent += `        <wpml:index>${index}</wpml:index>\n`;
        waylinesWpmlContent += `        <wpml:executeHeight>${parseFloat(wp.altitude).toFixed(1)}</wpml:executeHeight>\n`;
        waylinesWpmlContent += `        <wpml:waypointSpeed>${missionFlightSpeed.toFixed(1)}</wpml:waypointSpeed>\n`;

        // === Waypoint Heading Param ===
        waylinesWpmlContent += `        <wpml:waypointHeadingParam>\n`;
        let headingMode, headingAngle = 0, headingAngleEnable = 0, headingPathMode = 'followBadArc';
        let poiPointXml = `          <wpml:waypointPoiPoint>0.000000,0.000000,0.000000</wpml:waypointPoiPoint>\n`;

        // Per GRIGLIE (pathType "straight"), vogliamo lockCourse
        // Per percorsi CURVI, vogliamo smoothTransition o followWayline
        if (missionPathType === 'straight' && wp.headingControl === 'fixed') {
            headingMode = 'lockCourse';
            headingAngle = wp.fixedHeading;
            headingAngleEnable = 1;
            headingPathMode = 'smoothTransition'; // Come suggerito da file DJI per heading fissi
        } else if (wp.headingControl === 'poi_track' && wp.targetPoiId != null) {
            const targetPoi = pois.find(p => p.id === wp.targetPoiId);
            if (targetPoi) {
                headingMode = 'towardPOI'; headingAngleEnable = 1;
                let poiAlt = targetPoi.altitude !== undefined ? parseFloat(targetPoi.altitude) : 0.0;
                poiPointXml = `          <wpml:waypointPoiPoint>${targetPoi.latlng.lat.toFixed(6)},${targetPoi.latlng.lng.toFixed(6)},${poiAlt.toFixed(1)}</wpml:waypointPoiPoint>\n`;
            } else { headingMode = 'followWayline'; }
        } else { // 'auto' o 'curved' path type senza heading fisso
            headingMode = 'smoothTransition'; // Default più simile a DJI per curve
            // Per smoothTransition, l'angolo è l'heading desiderato *al waypoint* o per iniziare la transizione
            // Se è un percorso curvo, l'heading dovrebbe essere quello del segmento uscente
            if (index < waypoints.length - 1 && typeof calculateBearing === 'function') {
                headingAngle = calculateBearing(wp.latlng, waypoints[index+1].latlng);
            } else if (wp.fixedHeading !== undefined) { // Ultimo waypoint, usa il suo heading se impostato
                headingAngle = wp.fixedHeading;
            } else {
                headingAngle = 0; // Fallback
            }
            headingAngleEnable = (index === 0) ? 1 : 0; // Abilita solo per il primo punto come nel file DJI
            if (index === 0 && wp.fixedHeading !== undefined ) headingAngle = wp.fixedHeading; // Priorità a fixedHeading per il primo
        }

        waylinesWpmlContent += `          <wpml:waypointHeadingMode>${headingMode}</wpml:waypointHeadingMode>\n`;
        waylinesWpmlContent += `          <wpml:waypointHeadingAngle>${Math.round(headingAngle)}</wpml:waypointHeadingAngle>\n`;
        waylinesWpmlContent += poiPointXml;
        waylinesWpmlContent += `          <wpml:waypointHeadingAngleEnable>${headingAngleEnable}</wpml:waypointHeadingAngleEnable>\n`;
        waylinesWpmlContent += `          <wpml:waypointHeadingPathMode>${headingPathMode}</wpml:waypointHeadingPathMode>\n`;
        waylinesWpmlContent += `          <wpml:waypointHeadingPoiIndex>0</wpml:waypointHeadingPoiIndex>\n`;
        waylinesWpmlContent += `        </wpml:waypointHeadingParam>\n`;

        // === Waypoint Turn Param & Use Straight Line ===
        let turnMode, useStraight;
        if (missionPathType === 'curved') {
            useStraight = '0'; // Percorsi curvi
            turnMode = (index === 0 || index === waypoints.length - 1) ? 'toPointAndStopWithContinuityCurvature' : 'toPointAndPassWithContinuityCurvature'; // DJI usa Pass per intermedi
        } else { // "straight" (per griglie)
            useStraight = '1';
            turnMode = 'toPointAndStopWithDiscontinuityCurvature'; // O toPointAndStopWithContinuityCurvature
        }
        waylinesWpmlContent += `        <wpml:waypointTurnParam>\n`;
        waylinesWpmlContent += `          <wpml:waypointTurnMode>${turnMode}</wpml:waypointTurnMode>\n`;
        waylinesWpmlContent += `          <wpml:waypointTurnDampingDist>0.0</wpml:waypointTurnDampingDist>\n`;
        waylinesWpmlContent += `        </wpml:waypointTurnParam>\n`;
        waylinesWpmlContent += `        <wpml:useStraightLine>${useStraight}</wpml:useStraightLine>\n`;

        // === Azioni (Gimbal e Camera) ===
        let actionsXmlBlock = "";
        // Azione Gimbal: solo al primo waypoint (index 0) per impostare il pitch.
        if (index === 0) {
            actionsXmlBlock += `          <wpml:action><wpml:actionId>${actionCounter++}</wpml:actionId><wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc><wpml:actionActuatorFuncParam>`;
            actionsXmlBlock += `<wpml:gimbalPitchRotateEnable>1</wpml:gimbalPitchRotateEnable><wpml:gimbalPitchRotateAngle>${parseFloat(wp.gimbalPitch).toFixed(1)}</wpml:gimbalPitchRotateAngle>`;
            actionsXmlBlock += `<wpml:payloadPositionIndex>0</wpml:payloadPositionIndex><wpml:gimbalHeadingYawBase>aircraft</wpml:gimbalHeadingYawBase><wpml:gimbalRotateMode>absoluteAngle</wpml:gimbalRotateMode>`;
            actionsXmlBlock += `<wpml:gimbalRollRotateEnable>0</wpml:gimbalRollRotateEnable><wpml:gimbalYawRotateEnable>0</wpml:gimbalYawRotateEnable><wpml:gimbalYawRotateAngle>0</wpml:gimbalYawRotateAngle>`;
            actionsXmlBlock += `<wpml:gimbalRotateTimeEnable>0</wpml:gimbalRotateTimeEnable><wpml:gimbalRotateTime>0</wpml:gimbalRotateTime>`;
            actionsXmlBlock += `</wpml:actionActuatorFuncParam></wpml:action>\n`;
        }
        // Per missionPathType 'curved', potremmo aggiungere gimbalEvenlyRotate se il file DJI lo fa consistentemente
        // if (missionPathType === 'curved' && index < waypoints.length -1 && parseFloat(wp.gimbalPitch) === parseFloat(waypoints[index+1].gimbalPitch)) {
        //      // Aggiungi gimbalEvenlyRotate per mantenere il pitch al valore di wp.gimbalPitch
        // }


        if (wp.hoverTime > 0) { /* ... come prima ... */ }
        if (wp.cameraAction === 'takePhoto') { /* ... come prima ... */ }
        // (Incollo azioni per completezza)
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
            if(typeof showCustomAlert === 'function') showCustomAlert("DJI WPML KMZ exported.", "Success");
        })
        .catch(function(err) {
            if(typeof showCustomAlert === 'function') showCustomAlert("Error generating KMZ: " + err.message, "Error");
            console.error("KMZ generation error:", err);
        });
}
