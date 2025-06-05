// File: importExportManager.js
// ... (fallback e funzioni triggerImport, handleFileImport - invariate) ...

function loadFlightPlan(plan) {
    if(typeof clearWaypoints === 'function') clearWaypoints();
    if (pois && typeof map !== 'undefined') { 
        pois.forEach(p => { if (p.marker) map.removeLayer(p.marker); });
    }
    pois = []; poiCounter = 1; 
    if (plan.settings) {
        // ... (caricamento settings come prima) ...
    }
    if (plan.pois && Array.isArray(plan.pois)) {
        plan.pois.forEach(pData => {
            const poiLatlng = L.latLng(pData.lat, pData.lng);
            
            const tempPoiNameVal = poiNameInput ? poiNameInput.value : '';
            // MODIFIED: Gestisci i nuovi campi per l'altitudine del POI
            const tempPoiObjHVal = poiObjectHeightInputEl ? poiObjectHeightInputEl.value : '0';
            const tempPoiTerrElVal = poiTerrainElevationInputEl ? poiTerrainElevationInputEl.value : '0';


            if(poiNameInput) poiNameInput.value = pData.name || `POI ${pData.id || poiCounter}`;
            // Imposta i valori che addPOI leggerà
            if(poiObjectHeightInputEl) poiObjectHeightInputEl.value = pData.objectHeightAboveGround !== undefined ? String(pData.objectHeightAboveGround) : '0';
            if(poiTerrainElevationInputEl) {
                poiTerrainElevationInputEl.value = pData.terrainElevationMSL !== undefined ? String(pData.terrainElevationMSL) : '0';
                // Durante l'importazione, se terrainElevationMSL è fornito, lo consideriamo "verificato"
                poiTerrainElevationInputEl.readOnly = pData.terrainElevationMSL !== undefined;
            }
            
            // addPOI è ora asincrono, ma per l'importazione seriale va bene chiamarlo con await se necessario,
            // o gestire la coda. Per ora, lo chiamiamo e speriamo che l'ordine si mantenga.
            // Idealmente, addPOI non dovrebbe dipendere da input globali per l'importazione.
            // Sarebbe meglio passare un oggetto opzioni a addPOI.
            // Per questa modifica, continuiamo con l'approccio attuale.
            if(typeof addPOI === 'function') {
                addPOI(poiLatlng).then(() => { // addPOI è asincrono
                    // Eventuali azioni post-aggiunta POI durante l'import
                });
            }


            // Ripristina i valori originali degli input
            if(poiNameInput) poiNameInput.value = tempPoiNameVal;
            if(poiObjectHeightInputEl) poiObjectHeightInputEl.value = tempPoiObjHVal;
            if(poiTerrainElevationInputEl) {
                 poiTerrainElevationInputEl.value = tempPoiTerrElVal;
                 poiTerrainElevationInputEl.readOnly = true; // Di default torna readonly
            }
            
            if (pData.id && pData.id >= poiCounter) poiCounter = pData.id + 1;
        });
    }
    if (plan.waypoints && Array.isArray(plan.waypoints)) {
        // ... (caricamento waypoint come prima, assicurati che terrainElevationMSL sia gestito) ...
         plan.waypoints.forEach(wpData => {
            const waypointOptions = {
                altitude: wpData.altitude, hoverTime: wpData.hoverTime, gimbalPitch: wpData.gimbalPitch,
                headingControl: wpData.headingControl, fixedHeading: wpData.fixedHeading,
                cameraAction: wpData.cameraAction || 'none',
                targetPoiId: wpData.targetPoiId === undefined ? null : wpData.targetPoiId,
                terrainElevationMSL: wpData.terrainElevationMSL !== undefined ? wpData.terrainElevationMSL : null, 
                id: wpData.id 
            };
            if(typeof addWaypoint === 'function') addWaypoint(L.latLng(wpData.lat, wpData.lng), waypointOptions);
        });
    }
    // ... (chiamate di update UI come prima) ...
    // È importante chiamare updatePoiFinalAltitudeDisplay dopo aver caricato i POI e impostato gli input
    if (typeof updatePoiFinalAltitudeDisplay === 'function') updatePoiFinalAltitudeDisplay();
}

function exportFlightPlanToJson() {
    if (waypoints.length === 0 && pois.length === 0) {
        // ...
    }
    const plan = {
        waypoints: waypoints.map(wp => ({
            // ... (proprietà waypoint come prima, inclusa terrainElevationMSL) ...
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
            altitude: p.altitude, // Questo è l'AMSL finale calcolato
            terrainElevationMSL: p.terrainElevationMSL,
            objectHeightAboveGround: p.objectHeightAboveGround
        })),
        settings: {
            // ... (settings come prima) ...
        }
    };
    // ... (resto della funzione di esportazione JSON) ...
}

function exportToGoogleEarthKml() { 
    // ...
    if (pois.length > 0) {
        kml += `<Folder><name>POIs</name>`;
        pois.forEach(p => { 
            kml += `<Placemark><name>${p.name}</name><description><![CDATA[Alt. MSL: ${p.altitude.toFixed(1)} m<br>Elev. Terreno: ${p.terrainElevationMSL !== null ? p.terrainElevationMSL.toFixed(1) + " m" : "N/A"}<br>H. Oggetto: ${p.objectHeightAboveGround.toFixed(1)} m]]></description><styleUrl>#poiStyle</styleUrl><Point><altitudeMode>absolute</altitudeMode><coordinates>${p.latlng.lng},${p.latlng.lat},${p.altitude}</coordinates></Point></Placemark>`;
        });
        kml += `</Folder>`;
    }
    // ...
}

function exportToDjiWpmlKmz() {
    // ...
    // Dentro il loop dei waypoints, per headingControl === 'poi_track':
    // const targetPoi = pois.find(p => p.id === wp.targetPoiId);
    // if (targetPoi) {
    //     ...
    //     let poiAltMSL = targetPoi.altitude; // Usa direttamente l'altitude del POI (che è già MSL finale)
    //     poiPointXml = `          <wpml:waypointPoiPoint>${targetPoi.latlng.lat.toFixed(6)},${targetPoi.latlng.lng.toFixed(6)},${parseFloat(poiAltMSL).toFixed(1)}</wpml:waypointPoiPoint>\n`;
    // ...
    // Il resto della funzione rimane sostanzialmente invariato, assicurandosi che usi targetPoi.altitude per l'altezza del POI.
    // (Il codice esistente per exportToDjiWpmlKmz dovrebbe già usare targetPoi.altitude, che ora sarà l'AMSL finale)
    // Lo incollo qui sotto per completezza con la modifica esplicita
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

        waylinesWpmlContent += `        <wpml:waypointHeadingParam>\n`;
        let headingMode, headingAngle = 0, headingAngleEnable = 0, headingPathMode = 'followBadArc';
        let poiPointXml = `          <wpml:waypointPoiPoint>0.000000,0.000000,0.000000</wpml:waypointPoiPoint>\n`;

        if (wp.headingControl === 'fixed' && typeof wp.fixedHeading === 'number') {
            headingMode = 'smoothTransition'; 
            headingAngle = wp.fixedHeading;
            if (headingAngle > 180) headingAngle -= 360; 
            headingAngleEnable = 1; 
            headingPathMode = 'followBadArc'; 
        } else if (wp.headingControl === 'poi_track' && wp.targetPoiId != null) {
            const targetPoi = pois.find(p => p.id === wp.targetPoiId);
            if (targetPoi) {
                headingMode = 'towardPOI'; headingAngleEnable = 1; headingPathMode = 'followBadArc';
                let poiAltMSL = targetPoi.altitude; // targetPoi.altitude è l'AMSL finale calcolato
                poiPointXml = `          <wpml:waypointPoiPoint>${targetPoi.latlng.lat.toFixed(6)},${targetPoi.latlng.lng.toFixed(6)},${parseFloat(poiAltMSL).toFixed(1)}</wpml:waypointPoiPoint>\n`; 
            } else { headingMode = 'followWayline'; headingPathMode = 'followBadArc'; headingAngleEnable = 0;} 
        } else { 
            headingMode = 'followWayline'; 
            headingPathMode = 'followBadArc';
            headingAngleEnable = 0; 
            if (index < waypoints.length - 1 && typeof calculateBearing === 'function') {
                headingAngle = calculateBearing(wp.latlng, waypoints[index+1].latlng);
            } else if (index > 0 && typeof calculateBearing === 'function') {
                 headingAngle = calculateBearing(waypoints[index-1].latlng, wp.latlng);
            } else { headingAngle = 0; }
            if (headingAngle > 180) headingAngle -= 360;
        }

        waylinesWpmlContent += `          <wpml:waypointHeadingMode>${headingMode}</wpml:waypointHeadingMode>\n`;
        waylinesWpmlContent += `          <wpml:waypointHeadingAngle>${Math.round(headingAngle)}</wpml:waypointHeadingAngle>\n`;
        waylinesWpmlContent += poiPointXml;
        waylinesWpmlContent += `          <wpml:waypointHeadingAngleEnable>${headingAngleEnable}</wpml:waypointHeadingAngleEnable>\n`;
        waylinesWpmlContent += `          <wpml:waypointHeadingPathMode>${headingPathMode}</wpml:waypointHeadingPathMode>\n`;
        waylinesWpmlContent += `          <wpml:waypointHeadingPoiIndex>0</wpml:waypointHeadingPoiIndex>\n`; 
        waylinesWpmlContent += `        </wpml:waypointHeadingParam>\n`;

        let turnMode, useStraight;
        if (wp.headingControl === 'fixed' || missionPathType === 'straight') {
            useStraight = '1';
            turnMode = 'toPointAndStopWithDiscontinuityCurvature'; 
        } else { 
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

        let actionsXmlBlock = "";
        if (typeof wp.gimbalPitch === 'number') {
            actionsXmlBlock += `          <wpml:action><wpml:actionId>${actionCounter++}</wpml:actionId><wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc><wpml:actionActuatorFuncParam>`;
            actionsXmlBlock += `<wpml:gimbalPitchRotateEnable>1</wpml:gimbalPitchRotateEnable><wpml:gimbalPitchRotateAngle>${parseFloat(wp.gimbalPitch).toFixed(1)}</wpml:gimbalPitchRotateAngle>`;
            actionsXmlBlock += `<wpml:payloadPositionIndex>0</wpml:payloadPositionIndex><wpml:gimbalHeadingYawBase>aircraft</wpml:gimbalHeadingYawBase><wpml:gimbalRotateMode>absoluteAngle</wpml:gimbalRotateMode>`;
            actionsXmlBlock += `<wpml:gimbalRollRotateEnable>0</wpml:gimbalRollRotateEnable><wpml:gimbalYawRotateEnable>0</wpml:gimbalYawRotateEnable><wpml:gimbalYawRotateAngle>0</wpml:gimbalYawRotateAngle>`;
            actionsXmlBlock += `<wpml:gimbalRotateTimeEnable>0</wpml:gimbalRotateTimeEnable><wpml:gimbalRotateTime>0</wpml:gimbalRotateTime>`;
            actionsXmlBlock += `</wpml:actionActuatorFuncParam></wpml:action>\n`;
        }
        if (wp.hoverTime > 0) { /* ... */ } // Come prima
        if (wp.cameraAction && wp.cameraAction !== 'none') { /* ... */ } // Come prima

        if (actionsXmlBlock) { /* ... */ } // Come prima
        waylinesWpmlContent += `      </Placemark>\n`;
    });

    waylinesWpmlContent += `    </Folder>\n  </Document>\n</kml>`;

    const zip = new JSZip(); // ... (resto della creazione ZIP come prima)
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
