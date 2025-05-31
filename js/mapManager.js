// File: mapManager.js

// Depends on: config.js (for map, defaultTileLayer, satelliteTileLayer, satelliteView, userLocationMarker, isDrawingSurveyArea, waypoints, selectedWaypoint, selectedForMultiEdit)
// Depends on: utils.js (for showCustomAlert)
// Depends on: waypointManager.js (for addWaypoint - gestito da handleMapClick) - indiretta
// Depends on: poiManager.js (for addPOI - gestito da handleMapClick) - indiretta

/**
 * Initializes the Leaflet map and its basic functionalities.
 */
function initializeMap() {
    map = L.map('map', { maxZoom: 22 }).setView([37.7749, -122.4194], 13);

    defaultTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 22,
        maxNativeZoom: 19
    }).addTo(map);

    satelliteTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri',
        maxZoom: 22,
        maxNativeZoom: 21
    });

    map.on('click', handleMapClick);
    map.on('contextmenu', e => e.originalEvent.preventDefault());
    console.log("[MapManager] Map initialized and base layers added.");
}

/**
 * Handles click events on the map for general actions.
 */
function handleMapClick(e) {
    // isSettingHomePointMode è ancora una variabile globale da config.js, la manteniamo
    const currentHomePointMode = (typeof isSettingHomePointMode !== 'undefined') ? isSettingHomePointMode : false;

    console.log(`[MapManager] handleMapClick: homePointMode=${currentHomePointMode}`);

    if (currentHomePointMode) {
        console.log("[MapManager] handleMapClick: In Set Home Point mode, ignoring.");
        return; 
    }
    // NESSUN ALTRO CONTROLLO SU isDrawingSurveyArea o isDrawingGridAngleLine QUI

    console.log("[MapManager] handleMapClick: Processing default map click (add waypoint/POI).");
    if (e.originalEvent.target === map.getContainer()) {
        console.log("[MapManager] Click was directly on map container.");
        if (e.originalEvent.ctrlKey) {
            if (typeof addPOI === 'function') addPOI(e.latlng);
        } else {
            if (typeof addWaypoint === 'function') addWaypoint(e.latlng);
        }
    } else {
        console.log("[MapManager] Click was NOT directly on map container.");
    }
}

/**
 * Toggles between default and satellite map views.
 */
function toggleSatelliteView() {
    if (!map || !defaultTileLayer || !satelliteTileLayer || !satelliteToggleBtn) return;
    if (satelliteView) {
        map.removeLayer(satelliteTileLayer); map.addLayer(defaultTileLayer);
        satelliteToggleBtn.textContent = '📡 Satellite';
    } else {
        map.removeLayer(defaultTileLayer); map.addLayer(satelliteTileLayer);
        satelliteToggleBtn.textContent = '🗺️ Map';
    }
    satelliteView = !satelliteView;
    console.log(`[MapManager] Satellite view toggled. Now: ${satelliteView ? 'Satellite' : 'Default'}`);
}

/**
 * Fits the map view to show all waypoints/POIs.
 */
function fitMapToWaypoints() {
    if (!map) return;
    if (waypoints.length > 0) {
        map.fitBounds(L.latLngBounds(waypoints.map(wp => wp.latlng)).pad(0.1));
    } else if (pois.length > 0) {
        map.fitBounds(L.latLngBounds(pois.map(p => p.latlng)).pad(0.1));
    } else {
        map.setView([37.7749, -122.4194], 13);
    }
    console.log("[MapManager] Map fitted to bounds.");
}

/**
 * Tries to show the user's current location on the map.
 */
function showCurrentLocation() {
    if (!map) return;
    if (!navigator.geolocation) {
        showCustomAlert('Geolocation is not supported.', "Error"); return;
    }
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const latlng = L.latLng(position.coords.latitude, position.coords.longitude);
            if (userLocationMarker) {
                userLocationMarker.setLatLng(latlng);
            } else {
                userLocationMarker = L.marker(latlng, {
                    icon: L.divIcon({
                        className: 'user-location-marker',
                        html: '<div style="background:red;border-radius:50%;width:16px;height:16px;border:2px solid white;box-shadow: 0 0 5px #333;"></div>',
                        iconSize: [16, 16], iconAnchor: [8, 8]
                    })
                }).addTo(map);
            }
            map.setView(latlng, 15);
        },
        () => { showCustomAlert('Unable to retrieve your location.', "Error"); }
    );
}

/**
 * Creates a Leaflet DivIcon for a waypoint marker.
 * @param {number} id - The waypoint ID.
 * @param {boolean} isSelectedSingle - True if this waypoint is the currently active `selectedWaypoint`.
 * @param {boolean} [isMultiSelected=false] - True if this waypoint is part of `selectedForMultiEdit`.
 * @param {boolean} [isHomePoint=false] - True if this waypoint is the Home/Takeoff point.
 * @returns {L.DivIcon} The Leaflet DivIcon.
 */
function createWaypointIcon(id, isSelectedSingle, isMultiSelected = false, isHomePoint = false) {
    let bgColor = '#3498db'; 
    let iconHtmlContent = String(id); // Convert id to string in case it's used directly
    let borderStyle = '2px solid white';
    let classNameSuffix = '';
    let currentSize = 24; // Default size
    let currentFontSize = 12; // Default font size

    if (isHomePoint) {
        bgColor = '#27ae60'; // Green for Home Point (più scuro di #2ecc71)
        iconHtmlContent = '🏠'; 
        borderStyle = '2px solid #ffffff';
        classNameSuffix = 'home-point-wp'; // Classe specifica se serve
        currentSize = 28; // Leggermente più grande
        currentFontSize = 16; // Font più grande per l'emoji
    } else if (isSelectedSingle) {
        bgColor = '#e74c3c'; 
        classNameSuffix = 'selected-single';
        currentSize = 24 * 1.2;
        currentFontSize = 12 * 1.2;
        if (isMultiSelected) { 
            borderStyle = '3px solid #f39c12'; 
        }
    } else if (isMultiSelected) {
        bgColor = '#f39c12'; 
        classNameSuffix = 'selected-multi';
        currentSize = 24 * 1.1;
        currentFontSize = 12 * 1.1;
        borderStyle = '2px solid #ffeb3b';
    }
    // Arrotonda le dimensioni per evitare problemi di rendering sub-pixel
    currentSize = Math.round(currentSize);
    currentFontSize = Math.round(currentFontSize);

    return L.divIcon({
        className: `waypoint-marker ${classNameSuffix}`,
        html: `<div style="
                    background: ${bgColor};
                    color: white;
                    border-radius: 50%;
                    width: ${currentSize}px;
                    height: ${currentSize}px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: ${currentFontSize}px;
                    font-weight: bold;
                    border: ${borderStyle};
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    transition: all 0.1s ease-out;
                    line-height: ${currentSize}px; /* Per centrare meglio l'emoji/testo verticalmente */
                }">${iconHtmlContent}</div>`,
        iconSize: [currentSize, currentSize],
        iconAnchor: [currentSize / 2, currentSize / 2],
        popupAnchor: [0, -currentSize / 2]
    });
}

/**
 * Updates the visual style (icon and z-index) of a waypoint marker.
 * @param {object} waypoint - The waypoint object.
 */
function updateMarkerIconStyle(waypoint) {
    if (waypoint && waypoint.marker) {
        const isSelectedSingle = selectedWaypoint && selectedWaypoint.id === waypoint.id;
        const isMultiSelected = selectedForMultiEdit.has(waypoint.id);
        // Determina se è l'Home Point (il primo waypoint nell'array waypoints)
        const isHome = waypoints.length > 0 && waypoints[0].id === waypoint.id;

        waypoint.marker.setIcon(createWaypointIcon(waypoint.id, isSelectedSingle, isMultiSelected, isHome));

        let zOffset = 0;
        if (isHome) {
            zOffset = 1500; // Home point sempre molto in alto per visibilità
        } else if (isSelectedSingle) {
            zOffset = 1000;
        } else if (isMultiSelected) {
            zOffset = 500;
        }
        waypoint.marker.setZIndexOffset(zOffset);
    }
}
