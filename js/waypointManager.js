// ===================================================================================
// File: waypointManager.js
// VersionmapManager.js`

```javascript
// ===================================================================================
// File: mapManager.js
// Version: 7.0 (Centralized marker creation logic)
// ===================================================================================

/**: 6.2 (Fixed ReferenceError for _createAndBindMarker)
// ===================================================================================

/**
 * Recalculates the global waypoint counter to be one greater than the highest existing waypoint ID.
 *
 * Initializes the Leaflet map and its basic functionalities.
 */
function initializeMap() {
    map = @private
 */
function _recalculateGlobalWaypointCounter() {
    waypointCounter = waypoints.length L.map('map', { maxZoom: 22 }).setView([37.7749, -12 > 0 ? Math.max(...waypoints.map(wp => wp.id)) + 1 : 12.4194], 13);
    defaultTileLayer = L.tileLayer('https://;
}

/**
 * Creates a new Leaflet marker for a waypoint, binds all necessary events, and assigns it.
{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 22, maxNativeZoom: 19 }).addTo(map);
    satelliteTileLayer = * This is a new helper function that was previously missing.
 * @private
 */
function _createAndBindMarker(waypoint) {
    const isHomeForIcon = waypoints.length > 0 && waypoint.id === way L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Worldpoints[0].id;
    const marker = L.marker(waypoint.latlng, {
        _Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles © Esri', maxdraggable: true,
        icon: createWaypointIcon(waypoint, false, false, isHomeForIcon)Zoom: 22, maxNativeZoom: 21 });
    map.on('click', handleMapClick);
    map.on('contextmenu', e => e.originalEvent.preventDefault());
    console.
    }).addTo(map);

    marker.on('click', (e) => { 
        L.DomEvent.stopPropagation(e); 
        selectWaypoint(waypoint); 
    });
    
    log("[MapManager] Map initialized.");
}

/**
 * Handles click events on the map for general actions.
 */marker.on('dragend', () => { 
        waypoint.latlng = marker.getLatLng();
function handleMapClick(e) {
    if (surveyState.isDrawingArea || surveyState.isDrawingAngle) return;
    if (e.originalEvent.target === map.getContainer() || e.originalEvent
        updateAllUI(); // A global update is safest after a drag
    });

    marker.on('drag', () => { 
        waypoint.latlng = marker.getLatLng();
        updateFlightPath();.target.classList.contains('leaflet-container')) {
        if (e.originalEvent.ctrlKey) addPOI(e.latlng);
        else addWaypoint(e.latlng);
    }
}

 
        if(waypoint.headingControl === 'poi_track' && typeof updateGimbalForPoiTrack === "function"){ 
             updateGimbalForPoiTrack(waypoint);
             if(selected/**
 * Creates a new Leaflet marker for a waypoint, binds all necessary events, and assigns it.
 * This is nowWaypoint && selectedWaypoint.id === waypoint.id && gimbalPitchSlider && gimbalPitchValueEl){ 
                g the single point of truth for creating waypoint markers.
 * @param {object} waypoint - The waypoint data object.
 * @private
 */
function _createAndBindMarker(waypoint) {
    const isHomeForIcon =imbalPitchSlider.value = waypoint.gimbalPitch;
                gimbalPitchValueEl.textContent = waypoint.gimbalPitch + '°';
             }
        }
    });
    
    // waypoints.length > 0 && waypoint.id === waypoints[0].id;
    const marker = Add other events like mouseover if desired
    marker.on('mouseover', function (e) {
        // L.marker(waypoint.latlng, {
        draggable: true,
        icon: createWaypointIcon(waypoint, false, false, isHomeForIcon)
    }).addTo(map);

    marker.on('click This logic can be simplified or expanded as needed
        const popupContent = `<strong>${translate('waypointLabel')} ${waypoint', (e) => { L.DomEvent.stopPropagation(e); selectWaypoint(waypoint); });
    .id}</strong><br>Lat: ${waypoint.latlng.lat.toFixed(5)}, Lng
    marker.on('dragend', () => { 
        waypoint.latlng = marker.getLatLng();
: ${waypoint.latlng.lng.toFixed(5)}`;
        if (!this.getPopup()) { this.bindPopup(popupContent).openPopup(); } 
        else { this.setPopupContent(popup        if(typeof updateAllUI === 'function') updateAllUI();
    });

    waypoint.marker = marker;Content).openPopup(); }
    });

    waypoint.marker = marker;
}


/**
 * Re
}


/**
 * Toggles between default and satellite map views.
 */
function toggleSatelliteView() {
    if (!map || !defaultTileLayer || !satelliteTileLayer || !satelliteToggleBtn) return;
-draws all waypoint markers on the map based on the current `waypoints` array.
 * This function is critical after any operation that re-numbers or replaces waypoints.
 * @private
 */
function _redrawAllWaypointMarkers()    if (satelliteView) {
        map.removeLayer(satelliteTileLayer); map.addLayer(defaultTileLayer);
        satelliteToggleBtn.textContent = '📡 Satellite'; 
    } else {
        map. {
    // First, remove all existing markers from the map to avoid duplicates
    waypoints.forEach(wp => {
        if (wp.marker) {
            map.removeLayer(wp.marker);
        }removeLayer(defaultTileLayer); map.addLayer(satelliteTileLayer);
        satelliteToggleBtn.textContent = '🗺️ Map'; 
    }
    satelliteView = !satelliteView;
}

/**
 * Fits the
    });

    // Then, re-create each marker with updated data and events
    waypoints.forEach(wp => map view to show all waypoints/POIs.
 */
function fitMapToWaypoints() {
     _createAndBindMarker(wp));
}

/**
 * Replaces a set of waypoints with a newif (!map) return;
    let boundsToFit = null;
    const allLatLngs = [];

 set, renumbering and redrawing everything.
 * This is the master function for mission updates to ensure data integrity.    waypoints.forEach(wp => allLatLngs.push(wp.latlng));
    pois.forEach(p =>
 * @param {number[]} idsToDelete - An array of waypoint IDs to remove.
 * @param {object allLatLngs.push(p.latlng));

    if (allLatLngs.length > 0)[]} newWpsData - An array of new waypoint data objects to insert.
 * @returns {number[]} An array of the {
        boundsToFit = L.latLngBounds(allLatLngs);
        map.fitBounds( new IDs assigned to the inserted waypoints.
 */
function replaceWaypointSet(idsToDelete, newWpsDataboundsToFit.pad(0.1));
    } else {
        map.setView([37.) {
    let insertionIndex = -1;
    if (idsToDelete && idsToDelete.length > 7749, -122.4194], 13); 
    }
0) {
        insertionIndex = waypoints.findIndex(wp => wp.id === idsToDelete[0]);}

/**
 * Tries to show the user's current location on the map.
 */
function show
        const oldWpIds = new Set(idsToDelete);
        waypoints = waypoints.filter(wp => !oldCurrentLocation() {
    if (!map || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(WpIds.has(wp.id));
    }
    if (insertionIndex === -1) {
        (position) => {
            const latlng = L.latLng(position.coords.latitude, position.coords.longitude);
            if (userLocationMarker) {
                userLocationMarker.setLatLng(
        insertionIndex = waypoints.length;
    }

    const newWps = newWpsData.map(data => ({
        latlng: L.latLng(data.latlng.lat, datalatlng);
            } else {
                userLocationMarker = L.marker(latlng, { icon: L.div.latlng.lng),
        ...data.options,
        marker: null
    }));

    waypoints.spliceIcon({ className: 'user-location-marker', html: '<div style="background:red;border-radius:50(insertionIndex, 0, ...newWps);

    const newWaypointIds = [];
    waypoints.%;width:16px;height:16px;border:2px solid white;box-shadow:forEach((wp, index) => {
        const newId = index + 1;
        wp.id 0 0 5px #333;"></div>', iconSize: [16, 16 = newId;
        if (index >= insertionIndex && index < insertionIndex + newWps.length)], iconAnchor: [8, 8] }) }).addTo(map);
            }
            map.setView {
            newWaypointIds.push(newId);
        }
    });

    _redrawAllWaypointMarkers();(latlng, 15);
        },
        (error) => { /* ... error handling ... */
    _recalculateGlobalWaypointCounter();
    
    return newWaypointIds;
}


async function add }
    );
}

/**
 * Creates a Leaflet DivIcon for a waypoint marker.
 */
function createWaypointWaypoint(latlng, options = {}) { 
    if (!map || !defaultAltitudeSlider || !gimbalPitchIcon(waypointObject, isSelectedSingle, isMultiSelected = false, isHomePoint = false) {
    letSlider) return;
    
    const newWaypoint = {
        id: options.id !== undefined ? options bgColor = '#3498db'; 
    let iconHtmlContent = String(waypointObject.id); .id : waypointCounter,
        latlng: L.latLng(latlng.lat, latlng.
    let borderStyle = '2px solid white';
    let currentSize = 24; 
lng),
        altitude: options.altitude !== undefined ? options.altitude : parseInt(defaultAltitudeSlider.value),    let currentFontSize = 12; 

    if (isHomePoint) {
        bgColor = '#
        hoverTime: options.hoverTime !== undefined ? options.hoverTime : 0,
        gim27ae60'; iconHtmlContent = '🏠'; currentSize = 28; currentFontSize = 16;balPitch: options.gimbalPitch !== undefined ? options.gimbalPitch : parseInt(gimbalPitchSlider.value),
        headingControl: options.headingControl || 'auto',
        fixedHeading: options
    } else if (isSelectedSingle) {
        bgColor = '#e74c3c'; currentSize = 28; currentFontSize = 14;
        if (isMultiSelected) borderStyle = '.fixedHeading || 0,
        cameraAction: options.cameraAction || 'none',
        targetPoiId: options.targetPoiId || null,
        terrainElevationMSL: options.terrainElevationMSL !==3px solid #f39c12';
    } else if (isMultiSelected) {
        bgColor = '#f39c12'; currentSize = 26; borderStyle = '2px solid #ff undefined ? options.terrainElevationMSL : null, 
        marker: null,
        waypointType: optionseb3b';
    }
    
    let headingAngleDeg = 0;
    let arrowColor.waypointType || 'generic' 
    };
    
    if (options.id === undefined) {
        waypointCounter++;
    }
    
    waypoints.push(newWaypoint);
    _ = 'transparent'; 
    const wpIndex = waypoints.findIndex(w => w.id === waypointObjectcreateAndBindMarker(newWaypoint); // Use the helper to create the marker
    
    if (options..id);

    if (waypointObject.headingControl === 'auto') {
        arrowColor = '#3498db';
        if (wpIndex < waypoints.length - 1) headingAngleDeg = calculatecalledFromLoad !== true) { 
        updateAllUI();
        if (options.select !== false) {
             selectWaypoint(newWaypoint); 
        }
    }
}

function selectWaypoint(waypoint) {
Bearing(waypointObject.latlng, waypoints[wpIndex + 1].latlng);
        else if (wpIndex > 0) headingAngleDeg = calculateBearing(waypoints[wpIndex - 1].latlng, waypoint    if (!waypoint) return;
    const previouslySelectedSingleId = selectedWaypoint ? selectedWaypoint.id :Object.latlng);
        else arrowColor = 'transparent';
    } else if (waypointObject.heading null;
    if (selectedForMultiEdit.size > 0) clearMultiSelection(); 
    
    Control === 'fixed') {
        headingAngleDeg = waypointObject.fixedHeading;
        arrowColor = '#selectedWaypoint = waypoint;
    
    if (previouslySelectedSingleId && previouslySelectedSingleId !== waypoint.id607d8b';
    } else if (waypointObject.headingControl === 'poi_track) {
        const prevWp = waypoints.find(wp => wp.id === previouslySelectedSingleId);
        if (prevWp) updateMarkerIconStyle(prevWp);
    }
    
' && waypointObject.targetPoiId != null) {
        const targetPoi = pois.find(p => p.id === waypointObject.targetPoiId);
        if (targetPoi) {
            headingAngleDeg =    updateMarkerIconStyle(selectedWaypoint);
    updateSingleWaypointEditControls(); 
    updateWaypointList();
 calculateBearing(waypointObject.latlng, targetPoi.latlng);
            arrowColor = '#4CAF50';    if (selectedWaypoint.marker) map.panTo(selectedWaypoint.latlng);
    updateMultiEdit
        } else {
            arrowColor = 'transparent';
        }
    } else {
        arrowPanelVisibility(); 
}

function deleteSelectedWaypoint() {
    if (!selectedWaypoint) return;
    replaceWaypointSet([selectedWaypoint.id], []);
    selectedWaypoint = null;
    if (waypointControlsColor = 'transparent';
    }
    
    let headingIndicatorSvg = '';
    if (arrowColor !==Div) waypointControlsDiv.style.display = 'none';
    updateAllUI();
}

function clear 'transparent') {
        const arrowheadLength = 8, arrowheadWidth = 7, gapFromCircle = Waypoints() {
    waypoints.forEach(wp => { if (wp.marker) map.removeLayer(2;
        const arrowBaseY = -(currentSize / 2 + gapFromCircle);
        const arrowTipY =wp.marker); });
    waypoints = [];
    selectedWaypoint = null;
    waypointCounter = 1; 
    actionGroupCounter = 1; 
    actionCounter = 1;    

     -(currentSize / 2 + gapFromCircle + arrowheadLength);
        const svgContainerSize = (currentSize / 2 + gapFromCircle + arrowheadLength) * 2;
        const svgCenterX = svgContainerSize / 2surveyMissions.forEach(mission => { if (mission.polygonLayer) map.removeLayer(mission.polygonLayer);, svgCenterY = svgContainerSize / 2;
        headingIndicatorSvg = `<svg width="${svgContainer });
    surveyMissions = [];
    surveyMissionCounter = 1;
    if(typeof updateSurveySize}" height="${svgContainerSize}" style="position: absolute; top: 50%; left: 5MissionsList === 'function') updateSurveyMissionsList();

    clearMultiSelection(); 
    if (0%; transform: translate(-50%, -50%);"><g transform="translate(${svgCenterX}, ${svgCenterYwaypointControlsDiv) waypointControlsDiv.style.display = 'none';
    
    if(pois) { pois.forEach(p => { if(p.marker) map.removeLayer(p.marker); }); pois =}) rotate(${headingAngleDeg})"><polygon points="${arrowheadWidth/2},${arrowBaseY} ${-arrowheadWidth []; poiCounter = 1; if(typeof updatePOIList === 'function') updatePOIList(); }
    
/2},${arrowBaseY} 0,${arrowTipY}" fill="${arrowColor}"/></g></svg>`;
    }

    return L.divIcon({
        className: 'waypoint-marker',
            lastAltitudeAdaptationMode = 'relative'; 
    if(typeof updatePathModeDisplay === 'function')html: `<div style="position: relative; width: 100%; height: 100%;">< updatePathModeDisplay();
    updateAllUI();
}

function toggleMultiSelectWaypoint(waypointId, isChecked) {
    const waypoint = waypoints.find(wp => wp.id === waypointId);
div style="background:${bgColor};color:white;border-radius:50%;width:${currentSize}px    if (!waypoint) return;
    if (isChecked) {
        selectedForMultiEdit.add(;height:${currentSize}px;display:flex;align-items:center;justify-content:center;waypointId);
        if (selectedWaypoint) {
            const oldSelectedWpObject = selectedWaypoint;font-size:${currentFontSize}px;font-weight:bold;border:${borderStyle};box-shadow:0  
            selectedWaypoint = null; 
            if (waypointControlsDiv) waypointControlsDiv.style.display = 'none'; 
            updateMarkerIconStyle(oldSelectedWpObject); 
        }
2px 4px rgba(0,0,0,0.3);position:relative;z-index:10;">${iconHtmlContent}</div>${headingIndicatorSvg}</div>`,
        iconSize: [currentSize    } else {
        selectedForMultiEdit.delete(waypointId);
    }
    updateMarker, currentSize], iconAnchor: [currentSize / 2, currentSize / 2],
    });
IconStyle(waypoint); 
    if (selectAllWaypointsCheckboxEl) selectAllWaypointsCheckboxEl.checked = waypoints.length > 0 && waypoints.every(wp => selectedForMultiEdit.has(}

/**
 * Updates the visual style of a single waypoint marker.
 */
function updateMarkerIconStyle(wp.id));
    updateWaypointList(); 
    updateMultiEditPanelVisibility(); 
}

functionwaypointObject) {
    if (waypointObject && waypointObject.marker) {
        const isSelectedSingle = selected toggleSelectAllWaypoints(isChecked) {
    if (selectedWaypoint) { 
        const oldSelectedWWaypoint && selectedWaypoint.id === waypointObject.id;
        const isMultiSelected = selectedForMultiEdit.pObject = selectedWaypoint;
        selectedWaypoint = null;
        if (waypointControlsDiv) waypointControlshas(waypointObject.id);
        const isHome = waypoints.length > 0 && waypoints[0].Div.style.display = 'none';
        updateMarkerIconStyle(oldSelectedWpObject); 
id === waypointObject.id;
        waypointObject.marker.setIcon(createWaypointIcon(waypointObject    }
    selectedForMultiEdit.clear(); 
    if (isChecked && waypoints.length > , isSelectedSingle, isMultiSelected, isHome));
        let zOffset = 0;
        if (is0) {
        waypoints.forEach(wp => selectedForMultiEdit.add(wp.id));
    Home) zOffset = 1500; 
        else if (isSelectedSingle) zOffset = }
    waypoints.forEach(wp => updateMarkerIconStyle(wp)); 
    updateWaypointList(); 1000;
        else if (isMultiSelected) zOffset = 500;
        
    updateMultiEditPanelVisibility(); 
}

function clearMultiSelection() {
    const previouslyMultiSelectedwaypointObject.marker.setZIndexOffset(zOffset);
    }
}
