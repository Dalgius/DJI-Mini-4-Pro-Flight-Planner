// File: importExportManager.js

// Global dependencies (expected from other files):
// waypoints, pois, flightSpeedSlider, pathTypeSelect, homeElevationMslInput,
// waypointCounter, poiCounter, actionGroupCounter, actionCounter (from config.js)
// fileInputEl (from domCache.js)
// showCustomAlert, getCameraActionText, haversineDistance, calculateBearing, toRad (from utils.js or global)
// loadFlightPlan (se la definisci qui o è globale)
// addWaypoint (from waypointManager.js - per l'import)
// JSZip (libreria esterna)
// L (Leaflet global object)
// map (per POI import, se necessario)

// Fallback per helper se non globali
if (typeof getCameraActionText === 'undefined') {
    function getCameraActionText(action) { /* ... definizione ... */ }
}
if (typeof toRad === 'undefined') {
    function toRad(degrees) { return degrees * Math.PI / 180; }
}
if (typeof calculateBearing === 'undefined') {
    function calculateBearing(point1LatLng, point2LatLng) { /* ... definizione ... */ }
}
if (typeof haversineDistance === 'undefined') {
    function haversineDistance(coords1, coords2) { /* ... definizione ... */ }
}
// (Incollo le definizioni complete degli helper per sicurezza)
if (typeof getCameraActionText === 'undefined') {
    function getCameraActionText(action) {
        switch (action) {
            case 'takePhoto': return 'Photo';
            case 'startRecord': return 'Rec Start';
            case 'stopRecord': return 'Rec Stop';
            default: return 'None';
        }
    }
}
if (typeof toRad === 'undefined') {
    function toRad(degrees) { return degrees * Math.PI / 180; }
}
if (typeof calculateBearing === 'undefined') {
    function calculateBearing(point1LatLng, point2LatLng) {
        const lat1 = toRad(point1LatLng.lat); const lon1 = toRad(point1LatLng.lng);
        const lat2 = toRad(point2LatLng.lat); const lon2 = toRad(point2LatLng.lng);
        const dLon = lon2 - lon1;
        const y = Math.sin(dLon) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
        let brng = Math.atan2(y, x) * 180 / Math.PI;
        return (brng + 360) % 360;
    }
}
if (typeof haversineDistance === 'undefined') {
    function haversineDistance(coords1, coords2) { 
        const R = 6371e3; 
        const lat1 = coords1.lat || coords1[0]; const lon1 = coords1.lng || coords1[1];
        const lat2 = coords2.lat || coords2[0]; const lon2 = coords2.lng || coords2[1];
        const phi1 = toRad(lat1); const phi2 = toRad(lat2);
        const deltaPhi = toRad(lat2 - lat1);
        const deltaLambda = toRad(lon2 - lon1);
        const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
                  Math.cos(phi1) * Math.cos(phi2) *
                  Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}


function triggerImport() { /* ... come prima ... */ }
function handleFileImport(event) { /* ... come prima ... */ }
function loadFlightPlan(plan) { /* ... come prima, MA USA waypoints, pois, ecc. SENZA window. ... */ }
function exportFlightPlanToJson() { /* ... come prima, MA USA waypoints, pois, ecc. SENZA window. ... */ }
function exportToGoogleEarthKml() { /* ... come prima, MA USA waypoints, pois, ecc. SENZA window. ... */ }

// (Incollo le versioni corrette per loadFlightPlan e gli altri export)
function triggerImport() {
    if (fileInputEl) { 
        fileInputEl.click();
    } else {
        if(typeof showCustomAlert === 'function') showCustomAlert("File input element not found.", "Import Error");
    }
}
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
function loadFlightPlan(plan) {
    if(typeof clearWaypoints === 'function') clearWaypoints();
    if (pois && typeof map !== 'undefined') { 
        pois.forEach(p => { if (p.marker) map.removeLayer(p.marker); });
    }
    // Accedi e modifica le variabili globali direttamente
    // (devono essere dichiarate in config.js con 'let' a livello globale del modulo)
    // Per evitare problemi di shadowing se queste fossero anche parametri di funzione,
    // ma qui sono usate come globali.
    // Se queste sono definite in config.js: let pois = []; let poiCounter = 1;
    // allora le righe seguenti le modificano.
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
            const poiLatlng = L.latLng(pData.lat, pData.lng);
            const tempPoiName = poiNameInput ? poiNameInput.value : ''; 
            if(poiNameInput) poiNameInput.value = pData.name || `POI ${pData.id || poiCounter}`;
            if(typeof addPOI === 'function') addPOI(poiLatlng);
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
            if(typeof addWaypoint === 'function') addWaypoint(L.latLng(wpData.lat, wpData.lng), waypointOptions);
            else console.error("Global addWaypoint function not found for import.");
            if (wpData.id && wpData.id >= waypointCounter) waypointCounter = wpData.id + 1;
        });
    }
    if(typeof updatePOIList === 'function') updatePOIList();
    if(typeof updateWaypointList === 'function') updateWaypointList();
    if(typeof updateFlightPath === 'function') updateFlightPath();
    if(typeof updateFlightStatistics === 'function') updateFlightStatistics();
    if(typeof fitMapToWaypoints === 'function') fitMapToWaypoints();
    if (waypoints.length > 0 && typeof selectWaypoint === 'function') selectWaypoint(waypoints[0]); // Usa waypoints globale
    else if (waypointControlsDiv) waypointControlsDiv.style.display = 'none';
    if(typeof showCustomAlert === 'function') showCustomAlert("Flight plan imported successfully!", "Import Success");
}
function exportFlightPlanToJson() {
    if (waypoints.length === 0 && pois.length === 0) { // Usa globali diretti
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
            defaultAltitude: defaultAltitudeSlider ? parseInt(defaultAltitudeSlider.value) : 30,
            flightSpeed: flightSpeedSlider ? parseFloat(flightSpeedSlider.value) : 5,
            pathType: pathTypeSelect ? pathTypeSelect.value : 'straight',
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
function exportToGoogleEarthKml() { 
    if (waypoints.length === 0) { /* ... */ return; } // Usa globali diretti
    // ... (resto della logica come prima, usando waypoints e pois globali)
}


/**
 * Exports the flight plan to a DJI WPML KMZ file.
 */
function exportToDjiWpmlKmz() {
    console.log("[ExportKMZ] exportToDjiWpmlKmz function CALLED.");
    if (typeof JSZip === 'undefined') {
        console.error("[ExportKMZ] JSZip library not loaded.");
        if(typeof showCustomAlert === 'function') showCustomAlert("JSZip library not loaded.", "Error"); 
        return;
    }
    // Usa le variabili globali definite in config.js (waypoints, pois, ecc.)
    // SENZA il prefisso 'window.'
    if (!waypoints || waypoints.length === 0) {
        console.log("[ExportKMZ] No waypoints to export.");
        if(typeof showCustomAlert === 'function') showCustomAlert("No waypoints to export.", "Error"); 
        return;
    }
    console.log(`[ExportKMZ] Exporting ${waypoints.length} waypoints.`);

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
    console.log("[ExportKMZ] Initial parameters calculated.");

    let templateKmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.2">
<Document>
  <wpml:author>fly</wpml:author>
  <wpml:createTime>${createTimeMillis}</wpml:createTime>
  <wpml:updateTime>${createTimeMillis}</wpml:updateTime>
  <wpml:missionConfig>
    <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
    <wpml:finishAction>goHome</wpml:finishAction> 
    <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
    <wpml:executeRCLostAction>hover</wpml:executeRCLostAction> 
    <wpml:globalTransitionalSpeed>${missionFlightSpeed.toFixed(1)}</wpml:globalTransitionalSpeed>
    <wpml:droneInfo><wpml:droneEnumValue>68</wpml:droneEnumValue><wpml:droneSubEnumValue>0</wpml:droneSubEnumValue></wpml:droneInfo>
    <wpml:payloadInfo><wpml:payloadEnumValue>0</wpml:payloadEnumValue><wpml:payloadSubEnumValue>0</wpml:payloadSubEnumValue><wpml:payloadPositionIndex>0</wpml:payloadPositionIndex></wpml:payloadInfo>
  </wpml:missionConfig>
</Document></kml>`;
    console.log("[ExportKMZ] templateKmlContent generated.");

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
    <wpml:waylineId>0</wpml:waylineId> 
    <wpml:distance>0</wpml:distance> 
    <wpml:duration>0</wpml:duration> 
    <wpml:autoFlightSpeed>${missionFlightSpeed.toFixed(1)}</wpml:autoFlightSpeed>
`;
    console.log("[ExportKMZ] Starting waypoints.forEach loop.");

    waypoints.forEach((wp, index) => {
        console.log(`[ExportKMZ] Processing waypoint index ${index}, ID ${wp.id}`);
        waylinesWpmlContent += `      <Placemark>\n`;
        // ... (resto del loop come l'ultima versione, usando waypoints, pois, ecc. senza window.)
        // Assicurati che la logica interna al loop usi i nomi corretti delle variabili.
        // Per esempio, dentro il loop, quando accedi a wp.fixedHeading, è corretto.
        // Quando accedi a pois (per trovare il targetPoi), è la variabile globale pois.
        // ... (CODICE DEL LOOP waypoints.forEach COME L'ULTIMA VOLTA) ...
        // (Incollo il blocco forEach per sicurezza, senza window.)
        waylinesWpmlContent += `        <Point><coordinates>${wp.latlng.lng.toFixed(10)},${wp.latlng.lat.toFixed(10)}</coordinates></Point>\n`;
        waylinesWpmlContent += `        <wpml:index>${index}</wpml:index>\n`;
        waylinesWpmlContent += `        <wpml:executeHeight>${parseFloat(wp.altitude).toFixed(1)}</wpml:executeHeight>\n`;
        waylinesWpmlContent += `        <wpml:waypointSpeed>${missionFlightSpeed.toFixed(1)}</wpml:waypointSpeed>\n`;
        waylinesWpmlContent += `        <wpml:waypointHeadingParam>\n`;
        let headingMode, headingAngle = 0, headingAngleEnable = 0, headingPathMode = 'followBadArc';
        let poiPointXml = `          <wpml:waypointPoiPoint>0.000000,0.000000,0.000000</wpml:waypointPoiPoint>\n`;
        if (wp.headingControl === 'fixed' && typeof wp.fixedHeading === 'number') {
            headingMode = 'lockCourse'; headingAngle = wp.fixedHeading;
            if (headingAngle > 180) headingAngle -= 360; 
            headingAngleEnable = 1; headingPathMode = 'followBadArc';
        } else if (wp.headingControl === 'poi_track' && wp.targetPoiId != null) {
            const targetPoi = pois.find(p => p.id === wp.targetPoiId);
            if (targetPoi) {
                headingMode = 'towardPOI'; headingAngleEnable = 1; headingPathMode = 'followBadArc';
                let poiAlt = targetPoi.altitude !== undefined ? parseFloat(targetPoi.altitude) : 0.0;
                poiPointXml = `          <wpml:waypointPoiPoint>${targetPoi.latlng.lat.toFixed(6)},${targetPoi.latlng.lng.toFixed(6)},${poiAlt.toFixed(1)}</wpml:waypointPoiPoint>\n`;
            } else { headingMode = 'followWayline'; headingPathMode = 'followBadArc'; }
        } else { 
            headingMode = 'smoothTransition'; headingPathMode = 'followBadArc';
            if (index < waypoints.length - 1 && typeof calculateBearing === 'function') {
                headingAngle = calculateBearing(wp.latlng, waypoints[index+1].latlng);
            } else if (typeof wp.fixedHeading === 'number') { headingAngle = wp.fixedHeading; }
            else { headingAngle = 0; }
            if (headingAngle > 180) headingAngle -= 360;
            headingAngleEnable = (index === 0 || index === waypoints.length - 1) ? 1 : 0;
        }
        waylinesWpmlContent += `          <wpml:waypointHeadingMode>${headingMode}</wpml:waypointHeadingMode>\n`;
        waylinesWpmlContent += `          <wpml:waypointHeadingAngle>${Math.round(headingAngle)}</wpml:waypointHeadingAngle>\n`;
        waylinesWpmlContent += poiPointXml;
        waylinesWpmlContent += `          <wpml:waypointHeadingAngleEnable>${headingAngleEnable}</wpml:waypointHeadingAngleEnable>\n`;
        waylinesWpmlContent += `          <wpml:waypointHeadingPathMode>${headingPathMode}</wpml:waypointHeadingPathMode>\n`;
        waylinesWpmlContent += `          <wpml:waypointHeadingPoiIndex>0</wpml:waypointHeadingPoiIndex>\n`;
        waylinesWpmlContent += `        </wpml:waypointHeadingParam>\n`;
        let turnMode, useStraight;
        if (missionPathType === 'curved' && !(wp.headingControl === 'fixed')) {
            useStraight = '0';
            turnMode = (index === 0 || index === waypoints.length - 1) ? 'toPointAndStopWithContinuityCurvature' : 'toPointAndPassWithContinuityCurvature';
        } else { 
            useStraight = '1';
            turnMode = 'toPointAndStopWithDiscontinuityCurvature'; 
        }
        waylinesWpmlContent += `        <wpml:waypointTurnParam>\n`;
        waylinesWpmlContent += `          <wpml:waypointTurnMode>${turnMode}</wpml:waypointTurnMode>\n`;
        waylinesWpmlContent += `          <wpml:waypointTurnDampingDist>0.0</wpml:waypointTurnDampingDist>\n`;
        waylinesWpmlContent += `        </wpml:waypointTurnParam>\n`;
        waylinesWpmlContent += `        <wpml:useStraightLine>${useStraight}</wpml:useStraightLine>\n`;
        let actionsXmlBlock = "";
        if (index === 0 && typeof wp.gimbalPitch === 'number') {
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
        console.log(`[ExportKMZ] Finished processing waypoint index ${index}`);
    });
    console.log("[ExportKMZ] Finished waypoints.forEach loop.");

    waylinesWpmlContent += `    </Folder>\n  </Document>\n</kml>`;
    console.log("[ExportKMZ] Waylines XML content complete. Length:", waylinesWpmlContent.length);


    const zip = new JSZip();
    console.log("[ExportKMZ] JSZip object created.");
    const wpmzFolder = zip.folder("wpmz");
    if (wpmzFolder) { // Controlla che wpmzFolder sia stato creato
        wpmzFolder.folder("res"); 
        wpmzFolder.file("template.kml", templateKmlContent);
        console.log("[ExportKMZ] template.kml added to zip.");
        wpmzFolder.file("waylines.wpml", waylinesWpmlContent);
        console.log("[ExportKMZ] waylines.wpml added to zip.");
    } else {
        console.error("[ExportKMZ] Failed to create wpmz folder in zip.");
        if(typeof showCustomAlert === 'function') showCustomAlert("Error creating KMZ structure.", "Error");
        return;
    }
    

    console.log("[ExportKMZ] Calling zip.generateAsync...");
    zip.generateAsync({ type: "blob", mimeType: "application/vnd.google-earth.kmz" })
        .then(function(blob) {
            console.log("[ExportKMZ] ZIP generated successfully, blob size:", blob.size);
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `flight_plan_dji_${waylineIdInt}.kmz`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            if(typeof showCustomAlert === 'function') showCustomAlert("DJI WPML KMZ exported.", "Success");
            console.log("[ExportKMZ] Download triggered.");
        })
        .catch(function(err) {
            console.error("[ExportKMZ] ZIP generation FAILED:", err);
            if(typeof showCustomAlert === 'function') showCustomAlert("Error generating KMZ: " + err.message, "Error");
        });
}
