// File: importExportManager.js
// ... (altre funzioni di import/export e helper come prima) ...

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

        if (wp.headingControl === 'fixed' && typeof wp.fixedHeading === 'number') {
            headingMode = 'smoothTransition'; // DJI usa questo anche per "fixed heading" nell'esempio
            headingAngle = wp.fixedHeading;
            if (headingAngle > 180) headingAngle -= 360; // Normalizza a -180 a +180
            headingAngleEnable = (index === 0 || index === waypoints.length - 1) ? 1 : 0; // Abilita solo agli estremi
            headingPathMode = 'followBadArc'; // Come da file DJI
        } else if (wp.headingControl === 'poi_track' && wp.targetPoiId != null) {
            const targetPoi = pois.find(p => p.id === wp.targetPoiId);
            if (targetPoi) {
                headingMode = 'towardPOI'; headingAngleEnable = 1; headingPathMode = 'followBadArc';
                let poiAlt = targetPoi.altitude !== undefined ? parseFloat(targetPoi.altitude) : 0.0;
                poiPointXml = `          <wpml:waypointPoiPoint>${targetPoi.latlng.lat.toFixed(6)},${targetPoi.latlng.lng.toFixed(6)},${poiAlt.toFixed(1)}</wpml:waypointPoiPoint>\n`;
            } else { headingMode = 'followWayline'; headingPathMode = 'followBadArc';} // Fallback
        } else { // 'auto', 'followWayline', o pathType 'curved' senza fixedHeading esplicito
            headingMode = 'smoothTransition'; 
            headingPathMode = 'followBadArc';
            if (index < waypoints.length - 1 && typeof calculateBearing === 'function') {
                headingAngle = calculateBearing(wp.latlng, waypoints[index+1].latlng);
            } else { headingAngle = 0; }
            if (headingAngle > 180) headingAngle -= 360;
            headingAngleEnable = (index === 0) ? 1 : 0; 
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
        // Se l'utente ha specificato heading fisso, è probabile che voglia segmenti dritti.
        // Altrimenti, se pathType è 'curved', usiamo curve.
        if (wp.headingControl === 'fixed' || missionPathType === 'straight') {
            useStraight = '1';
            turnMode = 'toPointAndStopWithDiscontinuityCurvature'; // Più adatto per griglie/segmenti dritti con heading fisso
        } else { // missionPathType === 'curved' e heading non fisso
            useStraight = '0';
            turnMode = (index === 0 || index === waypoints.length - 1) ? 
                       'toPointAndStopWithContinuityCurvature' : 
                       'toPointAndPassWithContinuityCurvature';
        }
        waylinesWpmlContent += `        <wpml:waypointTurnParam>\n`;
        waylinesWpmlContent += `          <wpml:waypointTurnMode>${turnMode}</wpml:waypointTurnMode>\n`;
        waylinesWpmlContent += `          <wpml:waypointTurnDampingDist>0.0</wpml:waypointTurnDampingDist>\n`;
        waylinesWpmlContent += `        </wpml:waypointTurnParam>\n`;
        waylinesWpmlContent += `        <wpml:useStraightLine>${useStraight}</wpml:useStraightLine>\n`;

        // === Azioni (Gimbal e Camera) ===
        let actionsXmlBlock = "";
        // Azione Gimbal: solo al primo waypoint
        if (index === 0 && typeof wp.gimbalPitch === 'number') {
            actionsXmlBlock += `          <wpml:action><wpml:actionId>${actionCounter++}</wpml:actionId><wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc><wpml:actionActuatorFuncParam>`;
            actionsXmlBlock += `<wpml:gimbalPitchRotateEnable>1</wpml:gimbalPitchRotateEnable><wpml:gimbalPitchRotateAngle>${parseFloat(wp.gimbalPitch).toFixed(1)}</wpml:gimbalPitchRotateAngle>`;
            actionsXmlBlock += `<wpml:payloadPositionIndex>0</wpml:payloadPositionIndex><wpml:gimbalHeadingYawBase>aircraft</wpml:gimbalHeadingYawBase><wpml:gimbalRotateMode>absoluteAngle</wpml:gimbalRotateMode>`;
            actionsXmlBlock += `<wpml:gimbalRollRotateEnable>0</wpml:gimbalRollRotateEnable><wpml:gimbalYawRotateEnable>0</wpml:gimbalYawRotateEnable><wpml:gimbalYawRotateAngle>0</wpml:gimbalYawRotateAngle>`;
            actionsXmlBlock += `<wpml:gimbalRotateTimeEnable>0</wpml:gimbalRotateTimeEnable><wpml:gimbalRotateTime>0</wpml:gimbalRotateTime>`;
            actionsXmlBlock += `</wpml:actionActuatorFuncParam></wpml:action>\n`;
        }
        if (wp.hoverTime > 0) { /* ... come prima ... */ }
        if (wp.cameraAction && wp.cameraAction !== 'none') { /* ... come prima, assicurati che la logica per actuatorFunc e params sia corretta ... */ }
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
