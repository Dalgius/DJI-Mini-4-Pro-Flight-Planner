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
        showCustomAlert("JSZip library is not loaded. KMZ export unavailable.", "Export Error");
        console.error("JSZip is required for KMZ export.");
        return;
    }
    if (waypoints.length === 0) {
        showCustomAlert("No waypoints to export to DJI WPML KMZ.", "Export Error");
        return;
    }

    // Reset DJI-specific counters for this export
    actionGroupCounter = 1;
    actionCounter = 1;

    const missionFlightSpeed = parseFloat(flightSpeedSlider.value);
    const missionPathTypeUi = pathTypeSelect.value; // 'straight' or 'curved'

    const now = new Date();
    const createTimeMillis = now.getTime().toString();
    // waylineId is often an integer, can be timestamp or a unique ID for the mission
    const waylineIdInt = Math.floor(now.getTime() / 1000);

    let kmlTotalDistance = 0;
    if (waypoints.length >= 2) {
        // DJI WPML distance is typically straight-line segments for calculation,
        // even if path is curved. The drone handles the curve.
        for (let i = 0; i < waypoints.length - 1; i++) {
            kmlTotalDistance += haversineDistance(waypoints[i].latlng, waypoints[i + 1].latlng);
        }
    }
    let kmlTotalHoverTime = waypoints.reduce((sum, wp) => sum + (wp.hoverTime || 0), 0);
    const kmlTotalDuration = (kmlTotalDistance / (missionFlightSpeed > 0 ? missionFlightSpeed : 1)) + kmlTotalHoverTime;

    // --- template.kml content ---
    // Basic mission configuration. Drone type (droneEnumValue) might need adjustment for specific models.
    // 68 is often used for Mavic 3 Enterprise series.
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
      <wpml:droneInfo>
        <wpml:droneEnumValue>68</wpml:droneEnumValue> {/* Example: Mavic 3E Series */}
        <wpml:droneSubEnumValue>0</wpml:droneSubEnumValue>
      </wpml:droneInfo>
      <wpml:payloadInfo>
        <wpml:payloadEnumValue>0</wpml:payloadEnumValue> {/* Example: Visual Camera */}
        <wpml:payloadSubEnumValue>0</wpml:payloadSubEnumValue>
        <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
      </wpml:payloadInfo>
    </wpml:missionConfig>
  </Document>
</kml>`;

    // --- waylines.wpml content ---
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
      <wpml:templateId>0</wpml:templateId> {/* Corresponds to template.kml */}
      <wpml:executeHeightMode>relativeToStartPoint</wpml:executeHeightMode> {/* Altitudes are relative to takeoff */}
      <wpml:waylineId>${waylineIdInt}</wpml:waylineId>
      <wpml:distance>${kmlTotalDistance.toFixed(2)}</wpml:distance>
      <wpml:duration>${kmlTotalDuration.toFixed(2)}</wpml:duration>
      <wpml:autoFlightSpeed>${missionFlightSpeed.toFixed(1)}</wpml:autoFlightSpeed>
`;

    waypoints.forEach((wp, index) => {
        waylinesWpmlContent += `      <Placemark>\n`;
        waylinesWpmlContent += `        <Point><coordinates>${wp.latlng.lng.toFixed(10)},${wp.latlng.lat.toFixed(10)}</coordinates></Point>\n`; // Lon, Lat order
        waylinesWpmlContent += `        <wpml:index>${index}</wpml:index>\n`;
        waylinesWpmlContent += `        <wpml:executeHeight>${parseFloat(wp.altitude).toFixed(1)}</wpml:executeHeight>\n`; // Relative altitude
        waylinesWpmlContent += `        <wpml:waypointSpeed>${missionFlightSpeed.toFixed(1)}</wpml:waypointSpeed>\n`; // Can be per-waypoint if UI supports

        // Heading Parameters
        waylinesWpmlContent += `        <wpml:waypointHeadingParam>\n`;
        let headingMode = 'followWayline'; // Default
        let headingAngle = 0; // For fixed heading
        let poiPointStr = '<wpml:waypointPoiPoint>0.000000,0.000000,0.000000</wpml:waypointPoiPoint>'; // Placeholder for POI tracking
        let headingAngleEnable = 0; // 1 if fixed heading or POI tracking uses an angle/POI
        let headingPathMode = 'followBadArc'; // Or 'smoothTransition' for fixed heading. 'followBadArc' is common for POI track / followWayline.
        let waypointHeadingPoiIndex = 0; // Default for single POI target, not array index.

        if (wp.headingControl === 'fixed') {
            headingMode = 'lockCourse'; // Use 'lockCourse' for fixed heading
            headingAngle = wp.fixedHeading;
            headingAngleEnable = 1;
            headingPathMode = 'smoothTransition'; // Smoother transition for fixed heading
        } else if (wp.headingControl === 'poi_track' && wp.targetPoiId != null) {
            const targetPoi = pois.find(p => p.id === wp.targetPoiId);
            if (targetPoi) {
                headingMode = 'towardPOI';
                // DJI POI point is Lat,Lng,Alt (relative to POI's ground, often 0 if POI is on ground)
                poiPointStr = `<wpml:waypointPoiPoint>${targetPoi.latlng.lat.toFixed(6)},${targetPoi.latlng.lng.toFixed(6)},${parseFloat(targetPoi.altitude || 0).toFixed(1)}</wpml:waypointPoiPoint>`;
                headingAngleEnable = 1; // Indicates POI is used
                // waypointHeadingPoiIndex is 0 for the first (and usually only) POI in waypointPoiPoint.
            } else {
                headingMode = 'followWayline'; // Fallback if POI not found
            }
        }
        // 'auto' typically translates to 'followWayline'

        waylinesWpmlContent += `          <wpml:waypointHeadingMode>${headingMode}</wpml:waypointHeadingMode>\n`;
        waylinesWpmlContent += `          <wpml:waypointHeadingAngle>${headingAngle}</wpml:waypointHeadingAngle>\n`;
        waylinesWpmlContent += `          ${poiPointStr}\n`;
        waylinesWpmlContent += `          <wpml:waypointHeadingAngleEnable>${headingAngleEnable}</wpml:waypointHeadingAngleEnable>\n`;
        waylinesWpmlContent += `          <wpml:waypointHeadingPathMode>${headingPathMode}</wpml:waypointHeadingPathMode>\n`;
        waylinesWpmlContent += `          <wpml:waypointHeadingPoiIndex>${waypointHeadingPoiIndex}</wpml:waypointHeadingPoiIndex>\n`;
        waylinesWpmlContent += `        </wpml:waypointHeadingParam>\n`;

        // Turn Parameters
        waylinesWpmlContent += `        <wpml:waypointTurnParam>\n`;
        // 'toPointAndStopWithContinuityCurvature' for straight paths (stop at WP)
        // 'toPointAndPassWithContinuityCurvature' for curved paths (pass through WP smoothly)
        let turnMode = (missionPathTypeUi === 'curved') ? 'toPointAndPassWithContinuityCurvature' : 'toPointAndStopWithContinuityCurvature';
        waylinesWpmlContent += `          <wpml:waypointTurnMode>${turnMode}</wpml:waypointTurnMode>\n`;
        waylinesWpmlContent += `          <wpml:waypointTurnDampingDist>0.0</wpml:waypointTurnDampingDist>\n`; // Usually 0 unless specific tuning needed
        waylinesWpmlContent += `        </wpml:waypointTurnParam>\n`;

        // useStraightLine: 1 for straight segments, 0 for curved.
        // This refers to the path segment *to* this waypoint.
        waylinesWpmlContent += `        <wpml:useStraightLine>${(missionPathTypeUi === 'straight' || index === 0) ? '1' : '0'}</wpml:useStraightLine>\n`;

        // Gimbal Parameters (Pitch only for simplicity, Yaw usually follows heading or is manual)
        waylinesWpmlContent += `        <wpml:waypointGimbalParam>\n`; // Changed from waypointGimbalHeadingParam
        waylinesWpmlContent += `          <wpml:gimbalPitch>${wp.gimbalPitch.toFixed(1)}</wpml:gimbalPitch>\n`;
        // gimbalRoll, gimbalYaw can be added if needed.
        // For most DJI drones, gimbal yaw relative to aircraft is implicitly 0 (aligned with heading) unless controlled separately by actions.
        waylinesWpmlContent += `        </wpml:waypointGimbalParam>\n`;


        // Actions (Hover, Camera)
        let actionsXmlBlock = "";
        if (wp.hoverTime > 0) {
            actionsXmlBlock += `          <wpml:action>\n`;
            actionsXmlBlock += `            <wpml:actionId>${actionCounter++}</wpml:actionId>\n`;
            actionsXmlBlock += `            <wpml:actionActuatorFunc>HOVER</wpml:actionActuatorFunc>\n`;
            actionsXmlBlock += `            <wpml:actionActuatorFuncParam>\n`;
            actionsXmlBlock += `              <wpml:hoverTime>${wp.hoverTime}</wpml:hoverTime>\n`;
            actionsXmlBlock += `              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>\n`; // Specify payload for hover if applicable
            actionsXmlBlock += `            </wpml:actionActuatorFuncParam>\n`;
            actionsXmlBlock += `          </wpml:action>\n`;
        }

        if (wp.cameraAction && wp.cameraAction !== 'none') {
            let actuatorFunc = '';
            let params = `              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>\n`; // Assume main camera

            if (wp.cameraAction === 'takePhoto') {
                actuatorFunc = 'takePhoto';
                // params += `              <wpml:fileSuffix>Waypoint${wp.id}</wpml:fileSuffix>\n`; // Optional
                params += `              <wpml:useGlobalPayloadLensIndex>0</wpml:useGlobalPayloadLensIndex>\n`; // Use main lens usually
            } else if (wp.cameraAction === 'startRecord') {
                actuatorFunc = 'startRecord';
                params += `              <wpml:useGlobalPayloadLensIndex>0</wpml:useGlobalPayloadLensIndex>\n`;
            } else if (wp.cameraAction === 'stopRecord') {
                actuatorFunc = 'stopRecord';
                // No extra params typically needed for stopRecord beyond payloadPositionIndex
            }

            if (actuatorFunc) {
                actionsXmlBlock += `          <wpml:action>\n`;
                actionsXmlBlock += `            <wpml:actionId>${actionCounter++}</wpml:actionId>\n`;
                actionsXmlBlock += `            <wpml:actionActuatorFunc>${actuatorFunc}</wpml:actionActuatorFunc>\n`;
                actionsXmlBlock += `            <wpml:actionActuatorFuncParam>\n`;
                actionsXmlBlock += params;
                actionsXmlBlock += `            </wpml:actionActuatorFuncParam>\n`;
                actionsXmlBlock += `          </wpml:action>\n`;
            }
        }

        if (actionsXmlBlock) {
            waylinesWpmlContent += `        <wpml:actionGroup>\n`;
            waylinesWpmlContent += `          <wpml:actionGroupId>${actionGroupCounter++}</wpml:actionGroupId>\n`;
            waylinesWpmlContent += `          <wpml:actionGroupStartIndex>${index}</wpml:actionGroupStartIndex>\n`; // Action triggers when reaching this waypoint
            waylinesWpmlContent += `          <wpml:actionGroupEndIndex>${index}</wpml:actionGroupEndIndex>\n`;   // Action is for this waypoint only
            waylinesWpmlContent += `          <wpml:actionGroupMode>sequence</wpml:actionGroupMode>\n`; // Or 'parallel' if actions can run simultaneously
            waylinesWpmlContent += `          <wpml:actionTrigger>\n`;
            waylinesWpmlContent += `            <wpml:actionTriggerType>reachPoint</wpml:actionTriggerType>\n`; // Trigger on arrival
            waylinesWpmlContent += `          </wpml:actionTrigger>\n`;
            waylinesWpmlContent += actionsXmlBlock;
            waylinesWpmlContent += `        </wpml:actionGroup>\n`;
        }
        waylinesWpmlContent += `      </Placemark>\n`;
    });

    waylinesWpmlContent += `    </Folder>\n  </Document>\n</kml>`;

    // Create KMZ file
    const zip = new JSZip();
    const wpmzFolder = zip.folder("wpmz"); // DJI standard folder structure
    wpmzFolder.folder("res"); // Resource folder, usually empty for simple waylines
    wpmzFolder.file("template.kml", templateKmlContent);
    wpmzFolder.file("waylines.wpml", waylinesWpmlContent); // Note: some DJI apps expect .kml extension even for this file. Test with target app. Using .wpml as per some specs.

    zip.generateAsync({ type: "blob", mimeType: "application/vnd.google-earth.kmz" })
        .then(function(blob) {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `flight_plan_dji_${waylineIdInt}.kmz`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            showCustomAlert("Flight plan exported as DJI WPML KMZ.", "Export Success");
        })
        .catch(function(err) {
            showCustomAlert("Error generating KMZ file: " + err.message, "Export Error");
            console.error("KMZ generation error:", err);
        });
}