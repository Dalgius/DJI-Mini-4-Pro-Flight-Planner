// js/fileOperations.js
import * as DOM from './domElements.js';
import * as State from './state.js';
import { updateWaypointListDisplay, updatePOIListDisplay, updateFlightStatisticsDisplay } from './uiControls.js';
import { updateFlightPathDisplay, fitMapToWaypoints as fitMap } from './mapLogic.js';
import { selectWaypoint as selectWp, clearAllWaypointsLogic, addWaypoint as addWpFromFile, addPOI as addPoiFromFile, createWaypointIcon as createWpIconInternal } from './waypointPOILogic.js'; // Importa le funzioni logiche
import { showCustomAlert, _tr, getCameraActionText as utilGetCameraActionText, haversineDistance } from './utils.js'; // Importa haversineDistance


export function triggerImport() { 
    document.getElementById('fileInput').click(); 
}

export function handleFileImport(event) {
    const file = event.target.files[0]; 
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try { 
            const importedPlan = JSON.parse(e.target.result);
            loadFlightPlanData(importedPlan); 
        }
        catch (err) { showCustomAlert(_tr("alertImportError", err.message), _tr("alertError", "Import Error")); }
    };
    reader.readAsText(file);
    if(event.target) event.target.value = null; 
}

export function loadFlightPlanData(plan) { 
    clearAllWaypointsLogic(); 
    State.getPois().forEach(p => { if(p.marker && State.getMap()) State.getMap().removeLayer(p.marker); });
    State.setPois([]); 
    State.poiCounter = 1;

    if (plan.settings) {
        DOM.defaultAltitudeSlider.value = plan.settings.defaultAltitude || 30;
        DOM.defaultAltitudeValueEl.textContent = DOM.defaultAltitudeSlider.value + 'm';
        DOM.flightSpeedSlider.value = plan.settings.flightSpeed || 8;
        DOM.flightSpeedValueEl.textContent = DOM.flightSpeedSlider.value + ' m/s';
        DOM.pathTypeSelect.value = plan.settings.pathType || 'straight';
        State.waypointCounter = plan.settings.nextWaypointId || 1;
        State.poiCounter = plan.settings.nextPoiId || 1;
    }

    if (plan.pois) {
        plan.pois.forEach(pData => {
            addPoiFromFile(L.latLng(pData.lat, pData.lng), pData.name, pData.id, pData.altitude);
        });
    }
    if (plan.waypoints) {
        plan.waypoints.forEach(wpData => {
            addWpFromFile(L.latLng(wpData.lat, wpData.lng), wpData);
        });
    }
    
    // Ritarda leggermente gli aggiornamenti UI per dare tempo agli import dinamici (non ideale)
    // È meglio se le funzioni di aggiunta chiamano direttamente gli update UI necessari.
    // Per ora, questo timeout potrebbe essere rimosso se gli update sono già chiamati internamente.
    setTimeout(() => {
        updatePOIListDisplay(); 
        updateWaypointListDisplay(); 
        updateFlightPathDisplay(); 
        updateFlightStatisticsDisplay(); 
        fitMap();
        if (State.getWaypoints().length > 0) selectWp(State.getWaypoints()[0]);
        showCustomAlert(_tr("alertImportSuccess"), _tr("alertSuccess"));
    }, 100); // Ridotto il timeout, potrebbe non essere necessario
}

export function exportFlightPlan() { 
    if (State.getWaypoints().length === 0 && State.getPois().length === 0) { 
        showCustomAlert(_tr("alertNoWaypointsToExport"), _tr("alertExportError", "Export Error")); 
        return; 
    }
    const plan = {
        waypoints: State.getWaypoints().map(wp => ({ 
            id:wp.id, lat:wp.latlng.lat, lng:wp.latlng.lng, 
            altitude:wp.altitude, hoverTime:wp.hoverTime, gimbalPitch:wp.gimbalPitch, 
            headingControl:wp.headingControl, fixedHeading:wp.fixedHeading,
            cameraAction: wp.cameraAction || 'none',
            targetPoiId: wp.targetPoiId === undefined ? null : wp.targetPoiId 
        })),
        pois: State.getPois().map(p => ({ id:p.id, name:p.name, lat:p.latlng.lat, lng:p.latlng.lng, altitude: p.altitude })),
        settings: { 
            defaultAltitude: parseInt(DOM.defaultAltitudeSlider.value), 
            flightSpeed: parseFloat(DOM.flightSpeedSlider.value), 
            pathType: DOM.pathTypeSelect.value, 
            nextWaypointId: State.waypointCounter, nextPoiId: State.poiCounter 
        }
    };
    const a = document.createElement('a');
    a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(plan, null, 2));
    a.download = "flight_plan.json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

export function exportToGoogleEarth() { 
    if (State.getWaypoints().length === 0) {
        showCustomAlert(_tr("alertNoWaypointsToExport"), _tr("alertExportError", "Export Error"));
        return;
    }
    let homeElevationMSL = parseFloat(DOM.homeElevationMslInput.value);
    if (isNaN(homeElevationMSL)) {
        showCustomAlert(_tr("alertInvalidHomeElev") + " for Google Earth export. Using 0 as fallback.", _tr("alertExportWarning", "Export Warning"));
        homeElevationMSL = 0;
    }

    let kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Flight Plan</name>
    <Style id="waypointStyle"><IconStyle><Icon><href>http://maps.google.com/mapfiles/kml/paddle/blu-circle.png</href></Icon></IconStyle></Style>
    <Style id="pathStyle"><LineStyle><color>ffdb9834</color><width>3</width></LineStyle></Style>
    <Style id="poiStyle"><IconStyle><Icon><href>http://maps.google.com/mapfiles/kml/paddle/ylw-stars.png</href></Icon></IconStyle></Style>
    <Folder><name>Waypoints</name>`;
    State.getWaypoints().forEach(wp => {
        const altitudeMSL = homeElevationMSL + wp.altitude; 
        kmlContent += `
      <Placemark>
        <name>Waypoint ${wp.id} (Rel. Alt: ${wp.altitude}m)</name>
        <description>MSL Altitude: ${altitudeMSL.toFixed(1)}m\nGimbal Pitch: ${wp.gimbalPitch}°\nCamera Action: ${utilGetCameraActionText(wp.cameraAction) || 'None'}${wp.headingControl === 'poi_track' && wp.targetPoiId != null ? `\nTargeting POI ID: ${wp.targetPoiId}` : ''}</description>
        <styleUrl>#waypointStyle</styleUrl>
        <Point>
          <altitudeMode>absolute</altitudeMode> 
          <coordinates>${wp.latlng.lng},${wp.latlng.lat},${altitudeMSL.toFixed(1)}</coordinates>
        </Point>
      </Placemark>`;
    });
    kmlContent += `</Folder>`;

    if (State.getWaypoints().length >= 2) {
        kmlContent += `
    <Placemark>
      <name>Flight Path</name>
      <styleUrl>#pathStyle</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <altitudeMode>absolute</altitudeMode>
        <coordinates>\n`;
        let coordsString = "";
        // Per KML LineString, usiamo i waypoint originali per le altitudini.
        State.getWaypoints().forEach(wp => {
            const altitudeMSL = homeElevationMSL + wp.altitude;
            coordsString += `${wp.latlng.lng},${wp.latlng.lat},${altitudeMSL.toFixed(1)}\n`;
        });
        kmlContent += coordsString.trim();
        kmlContent += `
        </coordinates>
      </LineString>
    </Placemark>`;
    }

    if (State.getPois().length > 0) {
        kmlContent += `    <Folder><name>Points of Interest</name>\n`;
        State.getPois().forEach(poi => { 
            let poiGroundElevation = poi.altitude; 
            kmlContent += `
      <Placemark>
        <name>${poi.name}</name>
        <description>POI (Ground Elevation MSL: ${poiGroundElevation}m - if fetched)</description>
        <styleUrl>#poiStyle</styleUrl>
        <Point>
          <altitudeMode>clampToGround</altitudeMode> 
          <coordinates>${poi.latlng.lng},${poi.latlng.lat},0</coordinates>
        </Point>
      </Placemark>`;
        });
        kmlContent += `    </Folder>\n`;
    }
    kmlContent += `  </Document>\n</kml>`;

    const dataStr = "data:application/vnd.google-earth.kml+xml;charset=utf-8," + encodeURIComponent(kmlContent);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "google_earth_flight_plan.kml");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    document.body.removeChild(downloadAnchorNode);
}

export function exportToDjiWpmlKmz() { 
    if (State.getWaypoints().length === 0) {
        showCustomAlert(_tr("alertNoWaypointsToExport") + " to DJI WPML KMZ.", _tr("alertExportError", "Export Error"));
        return;
    }
    State.actionGroupCounter = 1; 
    State.actionCounter = 1;    

    const missionFlightSpeed = parseFloat(DOM.flightSpeedSlider.value);
    const missionPathTypeUi = DOM.pathTypeSelect.value; 

    const now = new Date();
    const createTimeMillis = now.getTime().toString();
    const waylineIdInt = Math.floor(now.getTime() / 1000); 

    let kmlTotalDistance = 0;
    if (State.getWaypoints().length >= 2) {
        const pathLatLngs = (missionPathTypeUi === 'curved' && State.flightPath) ? State.flightPath.getLatLngs() : State.getWaypoints().map(wp => wp.latlng);
        for (let i = 0; i < pathLatLngs.length - 1; i++) {
            kmlTotalDistance += haversineDistance(pathLatLngs[i], pathLatLngs[i + 1]);
        }
    }
    let kmlTotalHoverTime = State.getWaypoints().reduce((sum, wp) => sum + (wp.hoverTime || 0), 0);
    const kmlTotalDuration = (kmlTotalDistance / (missionFlightSpeed > 0 ? missionFlightSpeed : 1)) + kmlTotalHoverTime;

    let templateKmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.uav.com/wpmz/1.0.2">
  <Document>
    <wpml:author>fly</wpml:author> 
    <wpml:createTime>${createTimeMillis}</wpml:createTime>
    <wpml:updateTime>${createTimeMillis}</wpml:updateTime>
    <wpml:missionConfig>
      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
      <wpml:finishAction>goHome</wpml:finishAction>
      <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction>
      <wpml:globalTransitionalSpeed>${missionFlightSpeed.toFixed(1)}</wpml:globalTransitionalSpeed>
      <wpml:droneInfo>
        <wpml:droneEnumValue>68</wpml:droneEnumValue> 
        <wpml:droneSubEnumValue>0</wpml:droneSubEnumValue>
      </wpml:droneInfo>
    </wpml:missionConfig>
  </Document>
</kml>`;

    let waylinesWpmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.uav.com/wpmz/1.0.2">
  <Document>
    <wpml:missionConfig>
      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
      <wpml:finishAction>goHome</wpml:finishAction>
      <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction>
      <wpml:globalTransitionalSpeed>${missionFlightSpeed.toFixed(1)}</wpml:globalTransitionalSpeed>
      <wpml:droneInfo>
        <wpml:droneEnumValue>68</wpml:droneEnumValue>
        <wpml:droneSubEnumValue>0</wpml:droneSubEnumValue>
      </wpml:droneInfo>
    </wpml:missionConfig>
    <Folder>
      <name>Wayline Mission</name>
      <wpml:templateId>0</wpml:templateId>
      <wpml:executeHeightMode>relativeToStartPoint</wpml:executeHeightMode>
      <wpml:waylineId>${waylineIdInt}</wpml:waylineId>
      <wpml:distance>${kmlTotalDistance.toFixed(2)}</wpml:distance>
      <wpml:duration>${kmlTotalDuration.toFixed(2)}</wpml:duration>
      <wpml:autoFlightSpeed>${missionFlightSpeed.toFixed(1)}</wpml:autoFlightSpeed>
`;

            State.getWaypoints().forEach((wp, index) => {
                waylinesWpmlContent += `      <Placemark>\n`;
                waylinesWpmlContent += `        <Point><coordinates>${wp.latlng.lng.toFixed(10)},${wp.latlng.lat.toFixed(10)}</coordinates></Point>\n`;
                waylinesWpmlContent += `        <wpml:index>${index}</wpml:index>\n`;
                waylinesWpmlContent += `        <wpml:executeHeight>${parseFloat(wp.altitude).toFixed(1)}</wpml:executeHeight>\n`;
                waylinesWpmlContent += `        <wpml:waypointSpeed>${missionFlightSpeed.toFixed(1)}</wpml:waypointSpeed>\n`; 
                
                waylinesWpmlContent += `        <wpml:waypointHeadingParam>\n`;
                let headingMode = 'followWayline'; 
                let headingAngle = 0;
                let poiPointStr = '<wpml:waypointPoiPoint>0.000000,0.000000,0.000000</wpml:waypointPoiPoint>';
                let headingAngleEnable = 0; 
                let headingPathMode = 'followBadArc'; 
                let waypointHeadingPoiIndex = 0;    

                if (wp.headingControl === 'fixed') {
                    headingMode = 'lockCourse'; 
                    headingAngle = wp.fixedHeading;
                    headingAngleEnable = 1;
                    headingPathMode = 'smoothTransition'; 
                } else if (wp.headingControl === 'poi_track' && wp.targetPoiId != null) {
                    const targetPoi = State.getPois().find(p => p.id === wp.targetPoiId);
                    if (targetPoi) {
                        headingMode = 'towardPOI'; 
                        poiPointStr = `<wpml:waypointPoiPoint>${targetPoi.latlng.lat.toFixed(6)},${targetPoi.latlng.lng.toFixed(6)},${parseFloat(targetPoi.altitude || 0).toFixed(1)}</wpml:waypointPoiPoint>`;
                        headingAngleEnable = 1; 
                        waypointHeadingPoiIndex = 0; 
                        headingPathMode = 'followBadArc'; 
                    } else { 
                        headingMode = 'followWayline';
                    }
                }
                
                waylinesWpmlContent += `          <wpml:waypointHeadingMode>${headingMode}</wpml:waypointHeadingMode>\n`;
                waylinesWpmlContent += `          <wpml:waypointHeadingAngle>${headingAngle}</wpml:waypointHeadingAngle>\n`;
                waylinesWpmlContent += `          ${poiPointStr}\n`;
                waylinesWpmlContent += `          <wpml:waypointHeadingAngleEnable>${headingAngleEnable}</wpml:waypointHeadingAngleEnable>\n`;
                waylinesWpmlContent += `          <wpml:waypointHeadingPathMode>${headingPathMode}</wpml:waypointHeadingPathMode>\n`;
                waylinesWpmlContent += `          <wpml:waypointHeadingPoiIndex>${waypointHeadingPoiIndex}</wpml:waypointHeadingPoiIndex>\n`;
                waylinesWpmlContent += `        </wpml:waypointHeadingParam>\n`;

                waylinesWpmlContent += `        <wpml:waypointTurnParam>\n`;
                let turnMode = (missionPathTypeUi === 'curved') ? 'toPointAndPassWithContinuityCurvature' : 'toPointAndStopWithContinuityCurvature';
                waylinesWpmlContent += `          <wpml:waypointTurnMode>${turnMode}</wpml:waypointTurnMode>\n`;
                waylinesWpmlContent += `          <wpml:waypointTurnDampingDist>0.0</wpml:waypointTurnDampingDist>\n`;
                waylinesWpmlContent += `        </wpml:waypointTurnParam>\n`;
                
                waylinesWpmlContent += `        <wpml:useStraightLine>${missionPathTypeUi === 'straight' ? '1' : '0'}</wpml:useStraightLine>\n`;

                waylinesWpmlContent += `        <wpml:waypointGimbalHeadingParam>\n`;
                waylinesWpmlContent += `          <wpml:waypointGimbalPitchAngle>${wp.gimbalPitch}</wpml:waypointGimbalPitchAngle>\n`;
                waylinesWpmlContent += `          <wpml:waypointGimbalYawAngle>0</wpml:waypointGimbalYawAngle>\n`; 
                waylinesWpmlContent += `        </wpml:waypointGimbalHeadingParam>\n`;

                let actionsXmlBlock = "";
                if (wp.hoverTime > 0) {
                    actionsXmlBlock += `          <wpml:action>\n`;
                    actionsXmlBlock += `            <wpml:actionId>${State.actionCounter++}</wpml:actionId>\n`;
                    actionsXmlBlock += `            <wpml:actionActuatorFunc>HOVER</wpml:actionActuatorFunc>\n`;
                    actionsXmlBlock += `            <wpml:actionActuatorFuncParam>\n`;
                    actionsXmlBlock += `              <wpml:hoverTime>${wp.hoverTime}</wpml:hoverTime>\n`;
                    actionsXmlBlock += `            </wpml:actionActuatorFuncParam>\n`;
                    actionsXmlBlock += `          </wpml:action>\n`;
                }

                if (wp.cameraAction && wp.cameraAction !== 'none') {
                    let actuatorFunc = '';
                    let params = `              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>\n`;
                    
                    if (wp.cameraAction === 'takePhoto') {
                        actuatorFunc = 'takePhoto';
                        params += `              <wpml:useGlobalPayloadLensIndex>0</wpml:useGlobalPayloadLensIndex>\n`; 
                    } else if (wp.cameraAction === 'startRecord') {
                        actuatorFunc = 'startRecord';
                         params += `              <wpml:useGlobalPayloadLensIndex>0</wpml:useGlobalPayloadLensIndex>\n`;
                    } else if (wp.cameraAction === 'stopRecord') {
                        actuatorFunc = 'stopRecord';
                    }

                    if (actuatorFunc) {
                        actionsXmlBlock += `          <wpml:action>\n`;
                        actionsXmlBlock += `            <wpml:actionId>${State.actionCounter++}</wpml:actionId>\n`;
                        actionsXmlBlock += `            <wpml:actionActuatorFunc>${actuatorFunc}</wpml:actionActuatorFunc>\n`;
                        actionsXmlBlock += `            <wpml:actionActuatorFuncParam>\n`;
                        actionsXmlBlock += params;
                        actionsXmlBlock += `            </wpml:actionActuatorFuncParam>\n`;
                        actionsXmlBlock += `          </wpml:action>\n`;
                    }
                }
                
                if (actionsXmlBlock) {
                    waylinesWpmlContent += `        <wpml:actionGroup>\n`;
                    waylinesWpmlContent += `          <wpml:actionGroupId>${State.actionGroupCounter++}</wpml:actionGroupId>\n`; 
                    waylinesWpmlContent += `          <wpml:actionGroupStartIndex>${index}</wpml:actionGroupStartIndex>\n`;
                    waylinesWpmlContent += `          <wpml:actionGroupEndIndex>${index}</wpml:actionGroupEndIndex>\n`; 
                    waylinesWpmlContent += `          <wpml:actionGroupMode>parallel</wpml:actionGroupMode>\n`;
                    waylinesWpmlContent += `          <wpml:actionTrigger>\n`;
                    waylinesWpmlContent += `            <wpml:actionTriggerType>reachPoint</wpml:actionTriggerType>\n`;
                    waylinesWpmlContent += `          </wpml:actionTrigger>\n`;
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
                    link.download = "waypoints_name.kmz"; 
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(link.href);
                });
        }