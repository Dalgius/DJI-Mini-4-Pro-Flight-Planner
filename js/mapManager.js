// ===================================================================================
// File: mapManager.js
// Version: 7.1 (Simplified - marker creation logic now lives in waypointManager)
// ===================================================================================

/**
 * Initializes the Leaflet map and its basic functionalities.
 */
function initializeMap() {
    map = L.map('map', { maxZoom: 22 }).setView([37.7749, -122.4194], 13);
    defaultTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 22, maxNativeZoom: 19 }).addTo(map);
    satelliteTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles © Esri', maxZoom: 22, maxNativeZoom: 21 });
    map.on('click', handleMapClick);
    map.on('contextmenu', e => e.originalEvent.preventDefault());
    console.log("[MapManager] Map initialized.");
}

/**
 * Handles click events on the map for general actions.
 */
function handleMapClick(e) {
    if (typeof surveyState !== 'undefined' && (surveyState.isDrawingArea || surveyState.isDrawingAngle)) return;
    if (e.originalEvent.target === map.getContainer() || e.originalEvent.target.classList.contains('leaflet-container')) {
        if (e.originalEvent.ctrlKey) {
            addPOI(e.latlng);
        } else {
            addWaypoint(e.latlng);
        }
    }
}

/**
 * Toggles between default and satellite map views.
 */
function toggleSatelliteView() {
    if (!map || !defaultTileLayer || !satelliteTileLayer || !satelliteToggleBtn) return;
    if (satelliteView) {
        map.removeLayer(satelliteTileLayer); map.addLayer(defaultTileLayer);
        satelliteToggleBtn.textContent = translate('mapBtnSatellite'); 
    } else {
        map.removeLayer(defaultTileLayer); map.addLayer(satelliteTileLayer);
        satelliteToggleBtn.textContent = translate('mapBtnMap');
    }
    satelliteView = !satelliteView;
}

/**
 * Fits the map view to show all waypoints and POIs.
 */
function fitMapToWaypoints() {
    if (!map) return;
    const allLatLngs = [];
    if (waypoints) waypoints.forEach(wp => allLatLngs.push(wp.latlng));
    if (pois) pois.forEach(p => allLatLngs.push(p.latlng));

    if (allLatLngs.length > 0) {
        map.fitBounds(L.latLngBounds(allLatLngs).pad(0.1));
    } else {
        map.setView([37.7749, -122.4194], 13); 
    }
}

/**
 * Tries to show the user's current location on the map.
 */
function showCurrentLocation() {
    if (!map || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const latlng = L.latLng(position.coords.latitude, position.coords.longitude);
            if (userLocationMarker) {
                userLocationMarker.setLatLng(latlng);
            } else {
                userLocationMarker = L.marker(latlng, { icon: L.divIcon({ className: 'user-location-marker', html: '<div style="background:red;border-radius:50%;width:16px;height:16px;border:2px solid white;box-shadow: 0 0 5px #333;"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }) }).addTo(map);
            }
            map.setView(latlng, 15);
        },
        (error) => { console.error("Geolocation error:", error.message); }
    );
}

/**
 * Creates the HTML and CSS for a Leaflet DivIcon for a waypoint marker.
 */
function createWaypointIcon(waypointObject, isSelectedSingle, isMultiSelected = false, isHomePoint = false) {
    let bgColor = '#3498db'; 
    let iconHtmlContent = String(waypointObject.id); 
    let borderStyle = '2px solid white';
    let currentSize = 24; 
    let currentFontSize = 12; 

    if (isHomePoint) { bgColor = '#27ae60'; iconHtmlContent = '🏠'; currentSize = 28; currentFontSize = 16;
    } else if (isSelectedSingle) { bgColor = '#e74c3c'; currentSize = 28; currentFontSize = 14; if (isMultiSelected) borderStyle = '3px solid #f39c12';
    } else if (isMultiSelected) { bgColor = '#f39c12'; currentSize = 26; borderStyle = '2px solid #ffeb3b'; }
    
    let headingAngleDeg = 0;
    let arrowColor = 'transparent'; 
    const wpIndex = waypoints.findIndex(w => w.id === waypointObject.id);

    if (waypointObject.headingControl === 'auto') {
        arrowColor = '#3498db';
        if (wpIndex < waypoints.length - 1) headingAngleDeg = calculateBearing(waypointObject.latlng, waypoints[wpIndex + 1].latlng);
        else if (wpIndex > 0) headingAngleDeg = calculateBearing(waypoints[wpIndex - 1].latlng, waypointObject.latlng);
        else arrowColor = 'transparent';
    } else if (waypointObject.headingControl === 'fixed') {
        headingAngleDeg = waypointObject.fixedHeading;
        arrowColor = '#607d8b';
    } else if (waypointObject.headingControl === 'poi_track' && waypointObject.targetPoiId != null) {
        const targetPoi = pois.find(p => p.id === waypointObject.targetPoiId);
        if (targetPoi) { headingAngleDeg = calculateBearing(waypointObject.latlng, targetPoi.latlng); arrowColor = '#4CAF50'; } 
        else { arrowColor = 'transparent'; }
    } else { arrowColor = 'transparent'; }
    
    let headingIndicatorSvg = '';
    if (arrowColor !== 'transparent') {
        const arrowheadLength = 8, arrowheadWidth = 7, gapFromCircle = 2;
        const arrowBaseY = -(currentSize / 2 + gapFromCircle);
        const arrowTipY = -(currentSize / 2 + gapFromCircle + arrowheadLength);
        const svgContainerSize = (currentSize / 2 + gapFromCircle + arrowheadLength) * 2;
        const svgCenterX = svgContainerSize / 2, svgCenterY = svgContainerSize / 2;
        headingIndicatorSvg = `<svg width="${svgContainerSize}" height="${svgContainerSize}" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"><g transform="translate(${svgCenterX}, ${svgCenterY}) rotate(${headingAngleDeg})"><polygon points="${arrowheadWidth/2},${arrowBaseY} ${-arrowheadWidth/2},${arrowBaseY} 0,${arrowTipY}" fill="${arrowColor}"/></g></svg>`;
    }

    return L.divIcon({
        className: 'waypoint-marker',
        html: `<div style="position: relative; width: 100%; height: 100%;"><div style="background:${bgColor};color:white;border-radius:50%;width:${currentSize}px;height:${currentSize}px;display:flex;align-items:center;justify-content:center;font-size:${currentFontSize}px;font-weight:bold;border:${borderStyle};box-shadow:0 2px 4px rgba(0,0,0,0.3);position:relative;z-index:10;">${iconHtmlContent}</div>${headingIndicatorSvg}</div>`,
        iconSize: [currentSize, currentSize], iconAnchor: [currentSize / 2, currentSize / 2],
    });
}

/**
 * Updates the visual style of a single waypoint marker.
 */
function updateMarkerIconStyle(waypointObject) {
    if (waypointObject && waypointObject.marker) {
        const isSelectedSingle = selectedWaypoint && selectedWaypoint.id === waypointObject.id;
        const isMultiSelected = selectedForMultiEdit.has(waypointObject.id);
        const isHome = waypoints.length > 0 && waypoints[0].id === waypointObject.id;
        waypointObject.marker.setIcon(createWaypointIcon(waypointObject, isSelectedSingle, isMultiSelected, isHome));
        let zOffset = 0;
        if (isHome) zOffset = 1500; 
        else if (isSelectedSingle) zOffset = 1000;
        else if (isMultiSelected) zOffset = 500;
        waypointObject.marker.setZIndexOffset(zOffset);
    }
}
