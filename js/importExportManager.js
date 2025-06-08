// File: importExportManager.js

// Dipendenze globali, funzioni di utilità e di import/export...
// (Tutto il codice precedente rimane invariato fino alla funzione exportToDjiWpmlKmz)

// ... (tutto il codice fino a exportToDjiWpmlKmz rimane uguale) ...

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
        
        // Parametri Rotta (Heading)
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

        // Parametri Curvata (Turn Mode)
        let turnMode;
        if (index === 0 || index === waypoints.length - 1 || wp.hoverTime > 0) {
            turnMode = 'toPointAndStopWithContinuity';
        } else {
            turnMode = (missionPathType === 'curved') ? 'toPointAndPassWithContinuity' : 'toPointAndStopWithContinuity';
        }
        waylinesWpmlContent += `      <wpml:waypointTurnParam>\n`;
        waylinesWpmlContent += `        <wpml:waypointTurnMode>${turnMode}</wpml:waypointTurnMode>\n`;
        waylinesWpmlContent += `        <wpml:waypointTurnDampingDist>0.2</wpml:waypointTurnDampingDist>\n`;
        waylinesWpmlContent += `      </wpml:waypointTurnParam>\n`;

        // ======================= INIZIO BLOCCO MODIFICATO =======================
        // Logica Azioni
        let actionsXmlBlock = "";
        
        // Azione Hover (Stazionamento)
        if (wp.hoverTime > 0) {
            actionsXmlBlock += `        <wpml:action><wpml:actionId>${actionCounter++}</wpml:actionId><wpml:actionActuatorFunc>HOVER</wpml:actionActuatorFunc><wpml:actionActuatorFuncParam><wpml:hoverTime>${wp.hoverTime}</wpml:hoverTime></wpml:actionActuatorFuncParam></wpml:action>\n`;
        }
        
        // Azione Rotazione Gimbal
        // Viene aggiunta SEMPRE, tranne quando il drone deve gestire il gimbal autonomamente per tracciare un POI.
        // Questa è la soluzione più robusta.
        if (wp.headingControl !== 'poi_track') {
             actionsXmlBlock += `        <wpml:action>
            <wpml:actionId>${actionCounter++}</wpml:actionId>
            <wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
                <wpml:gimbalPitchRotateEnable>1</wpml:gimbalPitchRotateEnable>
                <wpml:gimbalPitchRotateAngle>${wp.gimbalPitch}</wpml:gimbalPitchRotateAngle>
                <wpml:gimbalRollRotateEnable>0</wpml:gimbalRollRotateEnable>
                <wpml:gimbalYawRotateEnable>0</wpml:gimbalYawRotateEnable>
                <wpml:gimbalRotateTimeEnable>1</wpml:gimbalRotateTimeEnable>
                <wpml:gimbalRotateTime>1</wpml:gimbalRotateTime>
                <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
            </wpml:actionActuatorFuncParam>
        </wpml:action>\n`;
        }

        // Azione Fotocamera
        if (wp.cameraAction && wp.cameraAction !== 'none') {
            let actuatorFunc = '';
            if (wp.cameraAction === 'takePhoto') actuatorFunc = 'takePhoto';
            else if (wp.cameraAction === 'startRecord') actuatorFunc = 'startRecord';
            else if (wp.cameraAction === 'stopRecord') actuatorFunc = 'stopRecord';
            
            if (actuatorFunc) {
                actionsXmlBlock += `        <wpml:action><wpml:actionId>${actionCounter++}</wpml:actionId><wpml:actionActuatorFunc>${actuatorFunc}</wpml:actionActuatorFunc><wpml:actionActuatorFuncParam><wpml:payloadPositionIndex>0</wpml:payloadPositionIndex></wpml:actionActuatorFuncParam></wpml:action>\n`;
            }
        }

        // Assembla il gruppo di azioni se ne è stata generata almeno una
        if (actionsXmlBlock) {
            waylinesWpmlContent += `      <wpml:actionGroup>
        <wpml:actionGroupId>${actionGroupCounter++}</wpml:actionGroupId>
        <wpml:actionGroupStartIndex>${index}</wpml:actionGroupStartIndex>
        <wpml:actionGroupEndIndex>${index}</wpml:actionGroupEndIndex>
        <wpml:actionGroupMode>sequence</wpml:actionGroupMode>
        <wpml:actionTrigger><wpml:actionTriggerType>reachPoint</wpml:actionTriggerType></wpml:actionTrigger>
${actionsXmlBlock}      </wpml:actionGroup>\n`;
        }
        // ======================= FINE BLOCCO MODIFICATO =======================

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
