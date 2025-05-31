// File: importExportManager.js

// Depends on: config.js, utils.js, waypointManager.js, poiManager.js, uiUpdater.js, flightPathManager.js, mapManager.js
// External dependency: JSZip library

/**
 * Triggers the hidden file input element for JSON import.
 */
function triggerImport() {
    if (fileInputEl) {
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
 */
function loadFlightPlan(plan) {
    if(typeof clearWaypoints === 'function') clearWaypoints();
    if (pois && typeof map !== 'undefined') { // pois è globale
        pois.forEach(p => { if (p.marker) map.removeLayer(p.marker); });
    }
    pois = []; // pois è globale
    poiCounter = 1; // poiCounter è globale

    if (plan.settings) {
        if (defaultAltitudeSlider) defaultAltitudeSlider.value = plan.settings.defaultAltitude || 30;
        if (defaultAltitudeValueEl) defaultAltitudeValueEl.textContent = defaultAltitudeSlider.value + 'm';
        if (flightSpeedSlider) flightSpeedSlider.value = plan.settings.flightSpeed || 8;
        if (flightSpeedValueEl) flightSpeedValueEl.textContent = flightSpeedSlider.value + ' m/s';
        if (pathTypeSelect) pathTypeSelect.value = plan.settings.pathType || 'straight';
        waypointCounter = plan.settings.nextWaypointId || 1; // waypointCounter è globale
        poiCounter = plan.settings.nextPoiId || 1; // poiCounter è globale
        if (homeElevationMslInput && plan.settings.homeElevationMsl !== undefined) {
            homeElevationMslInput.value = plan.settings.homeElevationMsl;
        }
    }

    if (plan.pois && Array.isArray(plan.pois)) {
        plan.pois.forEach(pData => {
            if (typeof addPOIfromData === 'function') { // Assumiamo una funzione helper per aggiungere POI da dati
                addPOIfromData(pData);
            } else { // Fallback se addPOIfromData non esiste (logica semplificata)
                const poiLatlng = L.latLng(pData.lat, pData.lng);
                // Per usare addPOI globale, dovremmo impostare poiNameInput.value temporaneamente
                // È meglio avere una funzione addPOIfromData(data) in poiManager.js
                console.warn("addPOIfromData function not found, POI loading might be incomplete.");
                 // Logica base per ricreare il POI, ma addPOI gestisce meglio i marker e l'aggiunta all'array
                const tempPoiName = poiNameInput ? poiNameInput.value : ''; // Salva e ripristina
                if(poiNameInput) poiNameInput.value = pData.name || `POI ${pData.id || poiCounter}`;
                if(typeof addPOI === 'function') addPOI(poiLatlng);
                if(poiNameInput) poiNameInput.value = tempPoiName; // Ripristina
                if (pData.id && pData.id >= poiCounter) poiCounter = pData.id + 1;
            }
        });
    }

    if (plan.waypoints && Array.isArray(plan.waypoints)) {
        plan.waypoints.forEach(wpData => {
            const waypointOptions = {
                altitude: wpData.altitude,
                hoverTime: wpData.hoverTime,
                gimbalPitch: wpData.gimbalPitch,
                headingControl: wpData.headingControl,
                fixedHeading: wpData.fixedHeading,
                cameraAction: wpData.cameraAction || 'none',
                targetPoiId: wpData.targetPoiId === undefined ? null : wpData.targetPoiId,
                id: wpData.id // Passa l'ID per mantenere la coerenza
            };
            if(typeof addWaypointFromData === 'function') { // Assumiamo una funzione helper
                addWaypointFromData(L.latLng(wpData.lat, wpData.lng), waypointOptions);
            } else {
                 if(typeof addWaypoint === 'function') addWaypoint(L.latLng(wpData.lat, wpData.lng), waypointOptions);
                 console.warn("addWaypointFromData function not found, waypoint loading might be incomplete for ID management.");
            }
             // Assicura che waypointCounter sia aggiornato
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
function exportFlightPlanToJson() {
    if (waypoints.length === 0 && pois.length === 0) {
        if(typeof showCustomAlert === 'function') showCustomAlert("Nothing to export.", "Export Error");
        return;
    }
    const plan = {
        waypoints: waypoints.map(wp => ({
            id: wp.id, lat: wp.latlng.lat, lng: wp.latlng.lng,
            altitude: wp.altitude, hoverTime: wp.hoverTime, gimbalPitch: wp.gimbalPitch,
            headingControl: wp.headingControl, fixedHeading: wp.fixedHeading,
            cameraAction: wp.cameraAction || 'none',
            targetPoiId: wp.targetPoiId === undefined ? null : wp.targetPoiId
        })),
        pois: pois.map(p => ({ id:p.id, name:p.name, lat:p.latlng.lat, lng:p.latlng.lng, altitude: p.altitude })),
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
    if(typeof showCustomAlert === 'function') showCustomAlert("Flight plan exported as JSON.", "Export Success");
}

/**
 * Exports the flight plan to a KML file for Google Earth.
 */
function exportToGoogleEarthKml() { /* ... come prima ... */ }
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
        kml += `<Placemark><name>WP ${wp.id} (Rel: ${wp.altitude}m)</name><description><![CDATA[MSL: ${altMSL.toFixed(1)}m<br/>Gimbal: ${wp.gimbalPitch}°<br/>Action: ${getCameraActionText(wp.cameraAction)||"None"}]]></description><styleUrl>#wpStyle</styleUrl><Point><altitudeMode>absolute</altitudeMode><coordinates>${wp.latlng.lng},${wp.latlng.lat},${altMSL.toFixed(1)}</coordinates></Point></Placemark>`;
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
 */
function exportToDjiWpmlKmz() {
    if (typeof JSZip === 'undefined') {
        if(typeof showCustomAlert === 'function') showCustomAlert("JSZip library not loaded. KMZ export unavailable.", "Error");
        return;
    }
    if (waypoints.length === 0) {
        if(typeof showCustomAlert === 'function') showCustomAlert("No waypoints to export to DJI WPML.", "Error");
        return;
    }

    actionGroupCounter = 1; // Reset counters for this export
    actionCounter = 1;

    const missionFlightSpeed = parseFloat(flightSpeedSlider.value);
    const missionPathType = pathTypeSelect.value; // 'straight' o 'curved'

    const now = new Date();
    const createTimeMillis = now.getTime().toString();
    const waylineIdInt = Math.floor(now.getTime() / 1000);

    let kmlTotalDistance = 0;
    if (waypoints.length >= 2) {
        for (let i = 0; i < waypoints.length - 1; i++) {
            kmlTotalDistance += (typeof haversineDistance === 'function' ? haversineDistance(waypoints[i].latlng, waypoints[i+1].latlng) : waypoints[i].latlng.distanceTo(waypoints[i+1].latlng));
        }
    }
    let kmlTotalHoverTime = waypoints.reduce((sum, wp) => sum + (wp.hoverTime || 0), 0);
    const kmlTotalDuration = (kmlTotalDistance / (missionFlightSpeed > 0 ? missionFlightSpeed : 1)) + kmlTotalHoverTime;

    let templateKmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.uav.com/wpmz/1.0.2">
<Document>
<wpml:author>FlightPlannerWebApp</wpml:author>
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
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.uav.com/wpmz/1.0.2">
<Document>
<wpml:missionConfig>
  <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
  <wpml:finishAction>goHome</wpml:finishAction>
  <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
  <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction>
  <wpml:globalTransitionalSpeed>${missionFlightSpeed.toFixed(1)}</wpml:globalTransitionalSpeed>
  <wpml:droneInfo><wpml:droneEnumValue>68</wpml:droneEnumValue><wpml:droneSubEnumValue>0</wpml:droneSubEnumValue></wpml:droneInfo>
  <wpml:payloadInfo><wpml:payloadEnumValue>0</wpml:payloadEnumValue><wpml:payloadSubEnumValue>0</wpml:payloadSubEnumValue><wpml:payloadPositionIndex>0</wpml:payloadPositionIndex></wpml:payloadInfo>
</wpml:missionConfig>
<Folder>
  <name>Wayline Mission ${waylineIdInt}</name>
  <wpml:templateId>0</wpml:templateId>
  <wpml:executeHeightMode>relativeToStartPoint</wpml:executeHeightMode>
  <wpml:waylineId>${waylineIdInt}</wpml:waylineId>
  <wpml:distance>${kmlTotalDistance.toFixed(2)}</wpml:distance>
  <wpml:duration>${kmlTotalDuration.toFixed(2)}</wpml:duration>
  <wpml:autoFlightSpeed>${missionFlightSpeed.toFixed(1)}</wpml:autoFlightSpeed>
`;

    waypoints.forEach((wp, index) => {
        waylinesWpmlContent += `      <Placemark>\n`;
        waylinesWpmlContent += `        <Point><coordinates>${wp.latlng.lng.toFixed(10)},${wp.latlng.lat.toFixed(10)}</coordinates></Point>\n`;
        waylinesWpmlContent += `        <wpml:index>${index}</wpml:index>\n`;
        waylinesWpmlContent += `        <wpml:executeHeight>${parseFloat(wp.altitude).toFixed(1)}</wpml:executeHeight>\n`;
        waylinesWpmlContent += `        <wpml:waypointSpeed>${missionFlightSpeed.toFixed(1)}</wpml:waypointSpeed>\n`;

        waylinesWpmlContent += `        <wpml:waypointHeadingParam>\n`;
        let headingMode = 'followWayline'; 
        let headingAngle = 0;
        let headingAngleEnable = 0;
        let headingPathMode = 'followBadArc';
        let poiPointStr = `<wpml:waypointPoiPoint>0.000000,0.000000,0.000000</wpml:waypointPoiPoint>\n`;
        
        if (wp.headingControl === 'fixed') {
            headingMode = 'lockCourse'; 
            headingAngle = wp.fixedHeading;
            headingAngleEnable = 1;
            headingPathMode = 'smoothTransition'; 
        } else if (wp.headingControl === 'poi_track' && wp.targetPoiId != null) {
            const targetPoi = pois.find(p => p.id === wp.targetPoiId);
            if (targetPoi) {
                headingMode = 'towardPOI';
                let poiAlt = targetPoi.altitude !== undefined ? parseFloat(targetPoi.altitude) : 0.0;
                poiPointStr = `<wpml:waypointPoiPoint>${targetPoi.latlng.lat.toFixed(6)},${targetPoi.latlng.lng.toFixed(6)},${poiAlt.toFixed(1)}</wpml:waypointPoiPoint>\n`;
                headingAngleEnable = 1;
            } else { headingMode = 'followWayline'; headingAngleEnable = 0; }
        } else { // auto
            // Per 'auto' (followWayline), DJI si aspetta spesso headingAngleEnable=0 se l'angolo non è specificamente usato.
            // Se è il primo o l'ultimo waypoint, alcuni file DJI abilitano l'angolo a 0.
            if (index === 0 || index === waypoints.length - 1) {
                 // headingAngleEnable = 1; // Come da file DJI di esempio, ma potrebbe non essere necessario per 'followWayline' puro
            }
        }
        waylinesWpmlContent += `          <wpml:waypointHeadingMode>${headingMode}</wpml:waypointHeadingMode>\n`;
        waylinesWpmlContent += `          <wpml:waypointHeadingAngle>${headingAngle}</wpml:waypointHeadingAngle>\n`;
        waylinesWpmlContent += poiPointStr;
        waylinesWpmlContent += `          <wpml:waypointHeadingAngleEnable>${headingAngleEnable}</wpml:waypointHeadingAngleEnable>\n`;
        waylinesWpmlContent += `          <wpml:waypointHeadingPathMode>${headingPathMode}</wpml:waypointHeadingPathMode>\n`;
        waylinesWpmlContent += `          <wpml:waypointHeadingPoiIndex>0</wpml:waypointHeadingPoiIndex>\n`;
        waylinesWpmlContent += `        </wpml:waypointHeadingParam>\n`;

        waylinesWpmlContent += `        <wpml:waypointTurnParam>\n`;
        let turnMode;
        let useStraight;
        if (missionPathType === 'curved') {
            useStraight = '0';
            turnMode = (index === 0 || index === waypoints.length - 1) ? 'toPointAndStopWithContinuityCurvature' : 'toPointAndPassWithContinuityCurvature';
        } else { // 'straight'
            useStraight = '1';
            turnMode = 'toPointAndStopWithContinuityCurvature';
        }
        waylinesWpmlContent += `          <wpml:waypointTurnMode>${turnMode}</wpml:waypointTurnMode>\n`;
        waylinesWpmlContent += `          <wpml:waypointTurnDampingDist>0.0</wpml:waypointTurnDampingDist>\n`;
        waylinesWpmlContent += `        </wpml:waypointTurnParam>\n`;
        waylinesWpmlContent += `        <wpml:useStraightLine>${useStraight}</wpml:useStraightLine>\n`;

        // Gestione Gimbal: Opzione A - Simile a DJI con azioni per il primo punto
        // Opzione B (attuale) - Usare waypointGimbalParam
        // Per ora manteniamo Opzione B, ma commentiamo per riferimento futuro
        
        // Logica Gimbal (Opzione B - parametro diretto)
        waylinesWpmlContent += `        <wpml:waypointGimbalParam>\n`;
        waylinesWpmlContent += `          <wpml:gimbalPitch>${parseFloat(wp.gimbalPitch).toFixed(1)}</wpml:gimbalPitch>\n`;
        // Aggiungi <wpml:gimbalYaw> se necessario, ma di solito è 0 (allineato con heading drone)
        waylinesWpmlContent += `        </wpml:waypointGimbalParam>\n`;

        let actionsXmlBlock = "";
        // Azione Gimbal (Opzione A - come file DJI esempio, solo al primo WP o se cambia)
        // Potremmo implementare una logica più complessa: se è il primo WP o se il gimbalPitch è diverso dal precedente,
        // aggiungi un'azione gimbalRotate. Altrimenti, per i segmenti successivi, si potrebbe usare gimbalEvenlyRotate
        // se volessimo un cambio graduale (ma DJI lo usa per *mantenere* il pitch durante il segmento).
        // Per ora, la gestione tramite <wpml:waypointGimbalParam> è più semplice.
        // Se wp.gimbalPitch è -90 e vogliamo replicare DJI:
        if (index === 0 && parseFloat(wp.gimbalPitch) === -90) { // Esempio: imposta gimbal a -90 al primo WP
            // actionsXmlBlock += `<wpml:action><wpml:actionId>${actionCounter++}</wpml:actionId><wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc><wpml:actionActuatorFuncParam><wpml:gimbalPitchRotateEnable>1</wpml:gimbalPitchRotateEnable><wpml:gimbalPitchRotateAngle>-90</wpml:gimbalPitchRotateAngle><wpml:payloadPositionIndex>0</wpml:payloadPositionIndex></wpml:actionActuatorFuncParam></wpml:action>`;
        }


        if (wp.hoverTime > 0) { /* ... come prima ... */ }
        if (wp.cameraAction && wp.cameraAction !== 'none') { /* ... come prima ... */ }
        // (Incollo per completezza)
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
            waylinesWpmlContent += `        <wpml:actionGroup>\n`;
            waylinesWpmlContent += `          <wpml:actionGroupId>${actionGroupCounter++}</wpml:actionGroupId>\n`;
            waylinesWpmlContent += `          <wpml:actionGroupStartIndex>${index}</wpml:actionGroupStartIndex>\n`;
            waylinesWpmlContent += `          <wpml:actionGroupEndIndex>${index}</wpml:actionGroupEndIndex>\n`;
            waylinesWpmlContent += `          <wpml:actionGroupMode>sequence</wpml:actionGroupMode>\n`;
            waylinesWpmlContent += `          <wpml:actionTrigger><wpml:actionTriggerType>reachPoint</wpml:actionTriggerType></wpml:actionTrigger>\n`;
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
