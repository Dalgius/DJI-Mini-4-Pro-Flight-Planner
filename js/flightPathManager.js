// File: flightPathManager.js

// Depends on: config.js (map, pathTypeSelect, waypoints, flightPath, lastAltitudeAdaptationMode), 
// utils.js (createSmoothPath, haversineDistance), 
// uiUpdater.js (for updateFlightStatistics, updatePathModeDisplay), 
// waypointManager.js (addWaypoint - indiretto via handlePathClick, selectWaypoint - indiretto)
// mapManager.js (createWaypointIcon - indiretto via handlePathClick)

/**
 * Updates or redraws the flight path on the map based on current waypoints and path type.
 * Also updates path color based on lastAltitudeAdaptationMode.
 */
function updateFlightPath() {
    if (!map || !pathTypeSelect) return;

    if (flightPath) {
        flightPath.off('click', handlePathClick); 
        map.removeLayer(flightPath);
        flightPath = null;
    }

    if (waypoints.length < 2) {
        updateFlightStatistics(); 
        if(typeof updatePathModeDisplay === "function") updatePathModeDisplay(); // Assicura che il testo sia aggiornato anche se non c'è percorso
        return;
    }

    const currentPathType = pathTypeSelect.value;
    const latlngsArrays = waypoints.map(wp => [wp.latlng.lat, wp.latlng.lng]);

    let displayPathCoords;
    if (currentPathType === 'curved' && latlngsArrays.length >= 2) { 
        displayPathCoords = createSmoothPath(latlngsArrays); 
    } else {
        displayPathCoords = latlngsArrays; 
    }

    let pathColor = '#3498db'; // Blu di default (per 'relative')
    let pathDashArray = currentPathType === 'curved' ? null : '5, 5';

    if (lastAltitudeAdaptationMode === 'agl') {
        pathColor = '#27ae60'; 
    } else if (lastAltitudeAdaptationMode === 'amsl') {
        pathColor = '#e67e22'; 
    }

    flightPath = L.polyline(displayPathCoords, {
        color: pathColor, 
        weight: 5, 
        opacity: 0.8,
        dashArray: pathDashArray 
    }).addTo(map);

    flightPath.on('click', handlePathClick);

    updateFlightStatistics();
    if(typeof updatePathModeDisplay === "function") updatePathModeDisplay(); 
}

/**
 * Handles clicks on the flight path to insert a new waypoint.
 * @param {L.LeafletMouseEvent} e - The Leaflet mouse event from clicking the path.
 */
function handlePathClick(e) {
    L.DomEvent.stopPropagation(e); 
    const clickedLatLng = e.latlng;

    if (waypoints.length < 2) return; 

    let insertAfterWaypointIndex = -1;
    let minDistanceToProjectedPoint = Infinity;
    let insertionPointLatLng = clickedLatLng; 

    for (let i = 0; i < waypoints.length - 1; i++) {
        const p1 = waypoints[i].latlng;
        const p2 = waypoints[i + 1].latlng;
        let dist;
        if (L.GeometryUtil && typeof L.GeometryUtil.closestOnSegment === 'function') {
            const closestPointOnSegment = L.GeometryUtil.closestOnSegment(map, L.polyline([p1,p2]), clickedLatLng);
            dist = clickedLatLng.distanceTo(closestPointOnSegment); 
            if (dist < minDistanceToProjectedPoint) {
                 minDistanceToProjectedPoint = dist;
                 insertAfterWaypointIndex = i;
                 insertionPointLatLng = closestPointOnSegment; 
            }
        } else { 
            const midPoint = L.latLng((p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2);
            dist = clickedLatLng.distanceTo(midPoint);
             if (dist < minDistanceToProjectedPoint) {
                minDistanceToProjectedPoint = dist;
                insertAfterWaypointIndex = i;
                insertionPointLatLng = clickedLatLng; 
            }
        }
    }

    if (insertAfterWaypointIndex !== -1) {
        const wp1 = waypoints[insertAfterWaypointIndex];
        const wp2 = waypoints[insertAfterWaypointIndex + 1];
        let newWpAltitude = wp1.altitude; 

        if (wp1 && wp2) { 
            const distToWp1 = insertionPointLatLng.distanceTo(wp1.latlng);
            const segmentLength = wp1.latlng.distanceTo(wp2.latlng);
            if (segmentLength > 0) {
                const ratio = Math.min(1, Math.max(0, distToWp1 / segmentLength)); 
                newWpAltitude = wp1.altitude + (wp2.altitude - wp1.altitude) * ratio;
            }
        }
        newWpAltitude = Math.round(Math.max(5, newWpAltitude)); 
        
        const newWpId = waypointCounter; // Non incrementare qui, addWaypoint lo farà se options.id non è fornito

        const tempNewWpObject = { 
            id: newWpId, 
            latlng: insertionPointLatLng,
            altitude: newWpAltitude,
            hoverTime: 0,
            gimbalPitch: parseInt(gimbalPitchSlider ? gimbalPitchSlider.value : 0),
            headingControl: 'auto',
            fixedHeading: 0,
            cameraAction: 'none',
            targetPoiId: null,
            terrainElevationMSL: null,
            marker: null 
        };
        
        waypointCounter++; 
        waypoints.splice(insertAfterWaypointIndex + 1, 0, tempNewWpObject);
        
        const isHome = waypoints.length > 0 && tempNewWpObject.id === waypoints[0].id;
        const marker = L.marker(tempNewWpObject.latlng, {
            draggable: true,
            icon: createWaypointIcon(tempNewWpObject, false, false, isHome)
        }).addTo(map);

        marker.on('click', (ev) => { L.DomEvent.stopPropagation(ev); selectWaypoint(tempNewWpObject); });
        marker.on('dragend', () => {
            tempNewWpObject.latlng = marker.getLatLng();
            updateFlightPath();
            updateFlightStatistics();
            updateWaypointList();
            updateMarkerIconStyle(tempNewWpObject); 
            const wpIndex = waypoints.findIndex(wp => wp.id === tempNewWpObject.id);
            if (wpIndex > 0 && waypoints[wpIndex-1].headingControl === 'auto') {
                updateMarkerIconStyle(waypoints[wpIndex-1]);
            }
            if (tempNewWpObject.headingControl === 'poi_track' && typeof updateGimbalForPoiTrack === "function") updateGimbalForPoiTrack(tempNewWpObject, true);
        });
         marker.on('drag', () => { 
            tempNewWpObject.latlng = marker.getLatLng();
            updateFlightPath(); 
            if(tempNewWpObject.headingControl === 'poi_track' && typeof updateGimbalForPoiTrack === "function"){ 
                 updateGimbalForPoiTrack(tempNewWpObject);
                 if(selectedWaypoint && selectedWaypoint.id === tempNewWpObject.id && gimbalPitchSlider && gimbalPitchValueEl){ 
                    gimbalPitchSlider.value = tempNewWpObject.gimbalPitch;
                    gimbalPitchValueEl.textContent = tempNewWpObject.gimbalPitch + '°';
                 }
            }
        });
        tempNewWpObject.marker = marker;

        if (insertAfterWaypointIndex >= 0 && waypoints[insertAfterWaypointIndex].headingControl === 'auto') {
            updateMarkerIconStyle(waypoints[insertAfterWaypointIndex]);
        }
        if (insertAfterWaypointIndex + 2 < waypoints.length && waypoints[insertAfterWaypointIndex + 2].headingControl === 'auto') { 
             updateMarkerIconStyle(waypoints[insertAfterWaypointIndex + 2]);
        }
         updateMarkerIconStyle(tempNewWpObject); 


        updateWaypointList();
        updateFlightPath(); 
        updateFlightStatistics();
        selectWaypoint(tempNewWpObject); 

        showCustomAlert(translate('alert_waypointInserted', {wpId: tempNewWpObject.id}), translate('infoTitle'));
    } else {
        showCustomAlert(translate('alert_couldNotInsertWaypoint'), translate('errorTitle'));
    }
}
