// File: importExportManager.js

// Depends on: config.js, utils.js, waypointManager.js (clearWaypoints, addWaypoint, selectWaypoint), poiManager.js (addPOI)
// Depends on: uiUpdater.js (updatePOIList, updateWaypointList, updateFlightStatistics, updateSingleWaypointEditControls)
// Depends on: flightPathManager.js (updateFlightPath), mapManager.js (fitMapToWaypoints, createWaypointIcon)
// External dependency: JSZip library (must be included in HTML for KMZ export)

/**
 * Triggers the hidden file input element for JSON import.
 */
function triggerImport() {
    if (fileInputEl) {
        fileInputEl.click();
    } else {
        showCustomAlert("File input element not found.", "Import Error");
    }
}

/**
 * Handles the file import process once a file is selected.
 * @param {Event} event - The file input change event.
 */
function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedPlan = JSON.parse(e.target.result);
            loadFlightPlan(importedPlan);
        } catch (err) {
            showCustomAlert("Error parsing flight plan file: " + err.message, "Import Error");
            console.error("Flight plan import error:", err);
        }
    };
    reader.readAsText(file);
    event.target.value = null; // Reset file input to allow importing the same file again
}

/**
 * Loads a flight plan from a parsed JSON object.
 * @param {object} plan - The flight plan object.
 */
function loadFlightPlan(plan) {
    // Clear existing data
    clearWaypoints(); // This also clears selectedWaypoint, multi-select, and resets counters
    pois.forEach(p => { if (p.marker) map.removeLayer(p.marker); });
    pois = [];
    poiCounter = 1; // Reset POI counter

    // Load settings
    if (plan.settings) {
        if (defaultAltitudeSlider) defaultAltitudeSlider.value = plan.settings.defaultAltitude || 30;
        if (defaultAltitudeValueEl) defaultAltitudeValueEl.textContent = defaultAltitudeSlider.value + 'm';
        if (flightSpeedSlider) flightSpeedSlider.value = plan.settings.flightSpeed || 8;
        if (flightSpeedValueEl) flightSpeedValueEl.textContent = flightSpeedSlider.value + ' m/s';
        if (pathTypeSelect) pathTypeSelect.value = plan.settings.pathType || 'straight';
        waypointCounter = plan.settings.nextWaypointId || 1; // Restore counters
        poiCounter = plan.settings.nextPoiId || 1;
        // Note: actionGroupCounter and actionCounter are for DJI export, reset by clearWaypoints.
        // If they were part of settings, restore them here.
    }

    // Load POIs
    if (plan.pois && Array.isArray(plan.pois)) {
        plan.pois.forEach(pData => {
            // Use addPOI's internal logic for creating POI objects and markers
            // Temporarily set poiNameInput if addPOI relies on it, or pass data directly
            if (poiNameInput) poiNameInput.value = pData.name || `POI ${pData.id || poiCounter}`; // Set name for addPOI

            const poiLatlng = L.latLng(pData.lat, pData.lng);
            // Call a simplified addPOI or directly create POI object and marker here
            // to avoid issues with global poiNameInput state during loop.

            const poi = {
                id: pData.id || poiCounter++, // Ensure poiCounter updates
                name: pData.name || `POI ${pData.id || (poiCounter-1)}`,
                latlng: L.latLng(pData.lat, pData.lng),
                altitude: pData.altitude || 0,
                marker: null
            };
            // If pData.id is higher than current poiCounter, update poiCounter
            if (pData.id && pData.id >= poiCounter) poiCounter = pData.id + 1;


            const markerIcon = L.divIcon({ className: 'poi-marker', html: `<div style="background: #f39c12; color:white; border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;border:2px solid white;">🎯</div>`, iconSize: [20, 20], iconAnchor: [10, 10] });
            const marker = L.marker(poi.latlng, { draggable: true, icon: markerIcon }).addTo(map);
            marker.bindPopup(`<strong>${poi.name}</strong> (ID: ${poi.id})`);
            marker.on('dragend', () => poi.latlng = marker.getLatLng());
            poi.marker = marker;
            pois.push(poi);
        });
        if (poiNameInput) poiNameInput.value = ''; // Clear after use
    }

    // Load Waypoints
    if (plan.waypoints && Array.isArray(plan.waypoints)) {
        plan.waypoints.forEach(wpData => {
            // addWaypoint function already handles marker creation and adding to 'waypoints' array
            // It also updates waypointCounter internally if its ID is greater.
            // We need to ensure addWaypoint uses wpData.id if provided, or its internal counter.
            // Let's pass all properties to addWaypoint via options.
            const waypointOptions = {
                altitude: wpData.altitude,
                hoverTime: wpData.hoverTime,
                gimbalPitch: wpData.gimbalPitch,
                headingControl: wpData.headingControl,
                fixedHeading: wpData.fixedHeading,
                cameraAction: wpData.cameraAction || 'none',
                targetPoiId: wpData.targetPoiId === undefined ? null : wpData.targetPoiId
                // id will be handled by addWaypoint or we can force it.
            };
            // To ensure ID from file is used and waypointCounter is correctly updated:
            const currentWpId = wpData.id || waypointCounter;
            waypointCounter = Math.max(waypointCounter, currentWpId + 1); // Ensure global counter is ahead

            // Manually create waypoint object to ensure ID persistence
            const wp = {
                id: currentWpId,
                latlng: L.latLng(wpData.lat, wpData.lng),
                ...waypointOptions // Spread the rest of the options
            };

            const marker = L.marker(wp.latlng, {
                draggable: true,
                icon: createWaypointIcon(wp.id, false) // from mapManager
            }).addTo(map);

            marker.on('click', e => { L.DomEvent.stopPropagation(e); selectWaypoint(wp); });
            marker.on('dragend', () => {
                wp.latlng = marker.getLatLng();
                updateFlightPath(); updateFlightStatistics(); updateWaypointList();
            });
            marker.on('drag', () => { wp.latlng = marker.getLatLng(); updateFlightPath(); });
            wp.marker = marker;
            waypoints.push(wp);
        });
    }

    // Update UI
    updatePOIList();
    updateWaypointList();
    updateFlightPath();
    updateFlightStatistics();
    fitMapToWaypoints();

    if (waypoints.length > 0) {
        selectWaypoint(waypoints[0]); // Select the first waypoint
    } else {
        if (waypointControlsDiv) waypointControlsDiv.style.display = 'none';
    }
    showCustomAlert("Flight plan imported successfully!", "Import Success");
}


/**
 * Exports the current flight plan (waypoints, POIs, settings) to a JSON file.
 */
function exportFlightPlanToJson() {
    if (waypoints.length === 0 && pois.length === 0) {
        showCustomAlert("Nothing to export. Add waypoints or POIs.", "Export Error");
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
            targetPoiId: wp.targetPoiId === undefined ? null : wp.targetPoiId
        })),
        pois: pois.map(p => ({
            id: p.id,
            name: p.name,
            lat: p.latlng.lat,
            lng: p.latlng.lng,
            altitude: p.altitude // Assuming POIs might have an altitude property
        })),
        settings: {
            defaultAltitude: parseInt(defaultAltitudeSlider.value),
            flightSpeed: parseFloat(flightSpeedSlider.value),
            pathType: pathTypeSelect.value,
            nextWaypointId: waypointCounter, // Save current state of counters
            nextPoiId: poiCounter
            // Could also save homeElevationMslInput.value here
        }
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(plan, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "flight_plan.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    document.body.removeChild(downloadAnchorNode);
    showCustomAlert("Flight plan exported as JSON.", "Export Success");
}

/**
 * Exports the flight plan to a KML file for Google Earth.
 */
function exportToGoogleEarthKml() {
    if (waypoints.length === 0) {
        showCustomAlert("No waypoints to export for Google Earth.", "Export Error");
        return;
    }

    let homeElevationMSL = parseFloat(homeElevationMslInput.value);
    if (isNaN(homeElevationMSL)) {
        showCustomAlert("Takeoff Point Elevation (MSL) is not set or invalid. It's needed for accurate Google Earth altitudes. Using 0m MSL as fallback for this export.", "Export Warning");
        homeElevationMSL = 0;
    }

    let kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Flight Plan (Google Earth)</name>
    <Style id="waypointStyle"><IconStyle><Icon><href>http://maps.google.com/mapfiles/kml/paddle/blu-circle.png</href></Icon></IconStyle></Style>
    <Style id="pathStyle"><LineStyle><color>ffdb9834</color><width>3</width></LineStyle></Style>
    <Style id="poiStyle"><IconStyle><Icon><href>http://maps.google.com/mapfiles/kml/paddle/ylw-stars.png</href></Icon></IconStyle></Style>

    <Folder><name>Waypoints</name>`;
    waypoints.forEach(wp => {
        const altitudeMSL = homeElevationMSL + wp.altitude;
        kmlContent += `
      <Placemark>
        <name>Waypoint ${wp.id} (Rel. Alt: ${wp.altitude}m)</name>
        <description>
          <![CDATA[
            MSL Altitude: ${altitudeMSL.toFixed(1)}m<br/>
            Gimbal Pitch: ${wp.gimbalPitch}°<br/>
            Camera Action: ${getCameraActionText(wp.cameraAction) || 'None'}<br/>
            Heading Control: ${wp.headingControl} ${wp.headingControl === 'fixed' ? `(${wp.fixedHeading}°)` : ''}
            ${wp.headingControl === 'poi_track' && wp.targetPoiId != null ? `<br/>Targeting POI ID: ${wp.targetPoiId}` : ''}
            ${wp.hoverTime > 0 ? `<br/>Hover Time: ${wp.hoverTime}s` : ''}
          ]]>
        </description>
        <styleUrl>#waypointStyle</styleUrl>
        <Point>
          <altitudeMode>absolute</altitudeMode>
          <coordinates>${wp.latlng.lng},${wp.latlng.lat},${altitudeMSL.toFixed(1)}</coordinates>
        </Point>
      </Placemark>`;
    });
    kmlContent += `</Folder>`;

    if (waypoints.length >= 2) {
        kmlContent += `
    <Placemark>
      <name>Flight Path</name>
      <styleUrl>#pathStyle</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <altitudeMode>absolute</altitudeMode>
        <coordinates>\n`;
        // For KML, it's often better to use the original waypoint coordinates for the LineString
        // rather than the smoothed path, as KML viewers might do their own smoothing or interpretation.
        // Or, if the smoothed path is crucial, export its points.
        // Here, using original waypoints for simplicity and direct representation.
        const pathPoints = waypoints.map(wp => {
            const altitudeMSL = homeElevationMSL + wp.altitude;
            return `${wp.latlng.lng},${wp.latlng.lat},${altitudeMSL.toFixed(1)}`;
        });
        kmlContent += pathPoints.join('\n');
        kmlContent += `
        </coordinates>
      </LineString>
    </Placemark>`;
    }

    if (pois.length > 0) {
        kmlContent += `    <Folder><name>Points of Interest</name>\n`;
        pois.forEach(poi => {
            // For POIs, clampToGround is often best, or use their own fetched ground elevation if available.
            // Assuming poi.altitude stores its ground elevation if fetched, otherwise 0.
            const poiAltitudeMSL = poi.altitude || 0; // Placeholder if POI ground elevation isn't systematically stored/fetched
            kmlContent += `
      <Placemark>
        <name>${poi.name} (ID: ${poi.id})</name>
        <description>Point of Interest</description>
        <styleUrl>#poiStyle</styleUrl>
        <Point>
          <altitudeMode>clampToGround</altitudeMode> 
          <coordinates>${poi.latlng.lng},${poi.latlng.lat},0</coordinates> {/* Use 0 for clampToGround, actual elevation is on terrain */}
        </Point>
      </Placemark>`;
        });
        kmlContent += `    </Folder>\n`;
    }
    kmlContent += `  </Document>\n</kml>`;

    const dataStr = "data:application/vnd.google-earth.kml+xml;charset=utf-8," + encodeURIComponent(kmlContent);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "flight_plan_google_earth.kml");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    document.body.removeChild(downloadAnchorNode);
    showCustomAlert("Flight plan exported as KML for Google Earth.", "Export Success");
}


/**
 * Exports the flight plan to a DJI WPML KMZ file.
 * Requires JSZip library.
 */
function exportToDjiWpmlKmz() {
    if (typeof JSZip === 'undefined') {
        if(typeof showCustomAlert === 'function') showCustomAlert("JSZip library not loaded. KMZ export unavailable.", "Error");
        console.error("JSZip is required for KMZ export.");
        return;
    }
    if (waypoints.length === 0) { // waypoints è globale
        if(typeof showCustomAlert === 'function') showCustomAlert("No waypoints to export to DJI WPML KMZ.", "Export Error");
        return;
    }

    actionGroupCounter = 1; // globale
    actionCounter = 1;      // globale

    const missionFlightSpeed = parseFloat(flightSpeedSlider.value); // flightSpeedSlider è globale
    const missionPathType = pathTypeSelect.value; // pathTypeSelect è globale

    const now = new Date();
    const createTimeMillis = now.getTime().toString();
    const waylineIdInt = Math.floor(now.getTime() / 1000);

    let kmlTotalDistance = 0;
    if (waypoints.length >= 2) {
        for (let i = 0; i < waypoints.length - 1; i++) {
            // Assicurati che haversineDistance sia disponibile globalmente
            kmlTotalDistance += (typeof haversineDistance === 'function' ? haversineDistance(waypoints[i].latlng, waypoints[i+1].latlng) : 0);
        }
    }
    let kmlTotalHoverTime = waypoints.reduce((sum, wp) => sum + (wp.hoverTime || 0), 0);
    const kmlTotalDuration = (kmlTotalDistance / (missionFlightSpeed > 0 ? missionFlightSpeed : 1)) + kmlTotalHoverTime;

    let templateKmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.2">
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
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.2">
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
        let headingMode, headingAngle = 0, headingAngleEnable = 0, headingPathMode = 'followBadArc';
        let poiPointXml = `          <wpml:waypointPoiPoint>0.000000,0.000000,0.000000</wpml:waypointPoiPoint>\n`;

        if (wp.headingControl === 'fixed') {
            headingMode = 'lockCourse';
            headingAngle = wp.fixedHeading;
            headingAngleEnable = 1;
            headingPathMode = 'smoothTransition';
        } else if (wp.headingControl === 'poi_track' && wp.targetPoiId != null) {
            const targetPoi = pois.find(p => p.id === wp.targetPoiId); // pois è globale
            if (targetPoi) {
                headingMode = 'towardPOI';
                headingAngleEnable = 1; 
                let poiAlt = targetPoi.altitude !== undefined ? parseFloat(targetPoi.altitude) : 0.0;
                poiPointXml = `          <wpml:waypointPoiPoint>${targetPoi.latlng.lat.toFixed(6)},${targetPoi.latlng.lng.toFixed(6)},${poiAlt.toFixed(1)}</wpml:waypointPoiPoint>\n`;
            } else { 
                headingMode = 'followWayline'; // Fallback
            }
        } else { // 'auto' or default
             // Per le griglie, wp.fixedHeading dovrebbe essere impostato da generateSurveyGridWaypoints
            if (typeof wp.fixedHeading !== 'undefined' && wp.headingControl !== 'followWayline') { // Se c'è un fixedHeading (es. da griglia) usa lockCourse
                headingMode = 'lockCourse';
                headingAngle = wp.fixedHeading;
                headingAngleEnable = 1;
                headingPathMode = 'smoothTransition';
            } else { // Altrimenti, vero followWayline
                headingMode = 'followWayline';
            }
        }

        waylinesWpmlContent += `          <wpml:waypointHeadingMode>${headingMode}</wpml:waypointHeadingMode>\n`;
        waylinesWpmlContent += `          <wpml:waypointHeadingAngle>${headingAngle}</wpml:waypointHeadingAngle>\n`;
        waylinesWpmlContent += poiPointXml;
        waylinesWpmlContent += `          <wpml:waypointHeadingAngleEnable>${headingAngleEnable}</wpml:waypointHeadingAngleEnable>\n`;
        waylinesWpmlContent += `          <wpml:waypointHeadingPathMode>${headingPathMode}</wpml:waypointHeadingPathMode>\n`;
        waylinesWpmlContent += `          <wpml:waypointHeadingPoiIndex>0</wpml:waypointHeadingPoiIndex>\n`;
        waylinesWpmlContent += `        </wpml:waypointHeadingParam>\n`;

        let turnMode, useStraight;
        if (missionPathType === 'curved') {
            useStraight = '0';
            turnMode = (index === 0 || index === waypoints.length - 1) ? 'toPointAndStopWithContinuityCurvature' : 'toPointAndPassWithContinuityCurvature';
        } else {
            useStraight = '1';
            turnMode = 'toPointAndStopWithContinuityCurvature';
        }
        waylinesWpmlContent += `        <wpml:waypointTurnParam>\n`;
        waylinesWpmlContent += `          <wpml:waypointTurnMode>${turnMode}</wpml:waypointTurnMode>\n`;
        waylinesWpmlContent += `          <wpml:waypointTurnDampingDist>0.0</wpml:waypointTurnDampingDist>\n`;
        waylinesWpmlContent += `        </wpml:waypointTurnParam>\n`;
        waylinesWpmlContent += `        <wpml:useStraightLine>${useStraight}</wpml:useStraightLine>\n`;

        let actionsXmlBlock = "";
        if (index === 0) { // Azione Gimbal solo al primo waypoint (o se cambia)
            actionsXmlBlock += `          <wpml:action><wpml:actionId>${actionCounter++}</wpml:actionId><wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc><wpml:actionActuatorFuncParam>`;
            actionsXmlBlock += `<wpml:gimbalPitchRotateEnable>1</wpml:gimbalPitchRotateEnable><wpml:gimbalPitchRotateAngle>${parseFloat(wp.gimbalPitch).toFixed(1)}</wpml:gimbalPitchRotateAngle>`;
            actionsXmlBlock += `<wpml:payloadPositionIndex>0</wpml:payloadPositionIndex><wpml:gimbalHeadingYawBase>aircraft</wpml:gimbalHeadingYawBase><wpml:gimbalRotateMode>absoluteAngle</wpml:gimbalRotateMode>`;
            actionsXmlBlock += `<wpml:gimbalRollRotateEnable>0</wpml:gimbalRollRotateEnable><wpml:gimbalYawRotateEnable>0</wpml:gimbalYawRotateEnable><wpml:gimbalRotateTimeEnable>0</wpml:gimbalRotateTimeEnable>`;
            actionsXmlBlock += `</wpml:actionActuatorFuncParam></wpml:action>\n`;
        }
        if (wp.hoverTime > 0) {
            actionsXmlBlock += `          <wpml:action><wpml:actionId>${actionCounter++}</wpml:actionId><wpml:actionActuatorFunc>HOVER</wpml:actionActuatorFunc><wpml:actionActuatorFuncParam><wpml:hoverTime>${wp.hoverTime}</wpml:hoverTime></wpml:actionActuatorFuncParam></wpml:action>\n`;
        }
        if (wp.cameraAction === 'takePhoto') {
            actionsXmlBlock += `          <wpml:action><wpml:actionId>${actionCounter++}</wpml:actionId><wpml:actionActuatorFunc>takePhoto</wpml:actionActuatorFunc><wpml:actionActuatorFuncParam><wpml:payloadPositionIndex>0</wpml:payloadPositionIndex><wpml:useGlobalPayloadLensIndex>0</wpml:useGlobalPayloadLensIndex></wpml:actionActuatorFuncParam></wpml:action>\n`;
        } // Aggiungi start/stop record se necessario

        if (actionsXmlBlock) {
            waylinesWpmlContent += `        <wpml:actionGroup><wpml:actionGroupId>${actionGroupCounter++}</wpml:actionGroupId><wpml:actionGroupStartIndex>${index}</wpml:actionGroupStartIndex><wpml:actionGroupEndIndex>${index}</wpml:actionGroupEndIndex><wpml:actionGroupMode>sequence</wpml:actionGroupMode><wpml:actionTrigger><wpml:actionTriggerType>reachPoint</wpml:actionTriggerType></wpml:actionTrigger>\n`;
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
