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
    // The variable isSettingHomePointMode was checked here previously but is not defined/initialized
    // in the provided codebase, indicating an incomplete or removed feature.
    // The check has been removed. If a "set home point by map click" feature is desired,
    // it would need proper implementation including variable definition and management.

    if (typeof isDrawingSurveyArea !== 'undefined' && isDrawingSurveyArea === true) {
        console.log("[MapManager] handleMapClick: In survey area drawing mode, ignoring default map click.");
        return; 
    }

    console.log("[MapManager] handleMapClick: Processing default map click (add waypoint/POI).");
    // Leaflet's map click event usually only fires for clicks on the map itself,
    // not on layers that have their own click handlers (which stop propagation).
    // The e.originalEvent.target check can be an additional safeguard.
    if (e.originalEvent.target === map.getContainer() || e.originalEvent.target.classList.contains('leaflet-container')) {
        if (e.originalEvent.ctrlKey) {
            addPOI(e.latlng); // from poiManager.js
        } else {
            addWaypoint(e.latlng); // from waypointManager.js
        }
    } else {
        // This branch would be hit if a click occurred on a map element without a dedicated click handler
        // that stops propagation, and which isn't the main map container.
        console.log("[MapManager] Click was not directly on the map container or an unhandled layer element.");
    }
}

/**
 * Toggles between default and satellite map views.
 */
function toggleSatelliteView() {
    if (!map || !defaultTileLayer || !satelliteTileLayer || !satelliteToggleBtn) return;
    if (satelliteView) {
        map.removeLayer(satelliteTileLayer); map.addLayer(defaultTileLayer);
        satelliteToggleBtn.textContent = '📡 Satellite'; // Consider using data-i18n-target-text="true" and JS for this too
    } else {
        map.removeLayer(defaultTileLayer); map.addLayer(satelliteTileLayer);
        satelliteToggleBtn.textContent = '🗺️ Map'; // Consider using data-i18n-target-text="true" and JS for this too
    }
    satelliteView = !satelliteView;
    console.log(`[MapManager] Satellite view toggled. Now: ${satelliteView ? 'Satellite' : 'Default'}`);
}

/**
 * Fits the map view to show all waypoints/POIs.
 */
function fitMapToWaypoints() {
    if (!map) return;
    let boundsToFit = null;

    if (waypoints.length > 0) {
        boundsToFit = L.latLngBounds(waypoints.map(wp => wp.latlng));
    }
    
    if (pois.length > 0) {
        const poiBounds = L.latLngBounds(pois.map(p => p.latlng));
        if (boundsToFit) {
            boundsToFit.extend(poiBounds);
        } else {
            boundsToFit = poiBounds;
        }
    }

    if (boundsToFit && boundsToFit.isValid()) {
        map.fitBounds(boundsToFit.pad(0.1));
         console.log("[MapManager] Map fitted to bounds of waypoints and/or POIs.");
    } else {
        map.setView([37.7749, -122.4194], 13); // Default view if nothing to fit
        console.log("[MapManager] No items to fit, set to default view.");
    }
}

/**
 * Tries to show the user's current location on the map.
 */
function showCurrentLocation() {
    if (!map) return;
    if (!navigator.geolocation) {
        showCustomAlert('Geolocation is not supported by your browser.', "Error"); return;
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
        (error) => { 
            let message = 'Unable to retrieve your location.';
            if (error.code === error.PERMISSION_DENIED) {
                message = 'Location access denied. Please enable location services for this site.';
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                message = 'Location information is unavailable.';
            } else if (error.code === error.TIMEOUT) {
                message = 'The request to get user location timed out.';
            }
            showCustomAlert(message, "Location Error"); 
        }
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
    let iconHtmlContent = String(id); 
    let borderStyle = '2px solid white';
    let classNameSuffix = '';
    let currentSize = 24; 
    let currentFontSize = 12; 

    if (isHomePoint) {
        bgColor = '#27ae60'; 
        iconHtmlContent = '🏠'; 
        borderStyle = '2px solid #ffffff';
        classNameSuffix = 'home-point-wp'; 
        currentSize = 28; 
        currentFontSize = 16; 
    } else if (isSelectedSingle) {
        bgColor = '#e74c3c'; 
        classNameSuffix = 'selected-single';
        currentSize = Math.round(24 * 1.2);
        currentFontSize = Math.round(12 * 1.2);
        if (isMultiSelected) { // Can be single selected AND part of a multi-selection (though UI flow might prevent this state)
            borderStyle = '3px solid #f39c12'; 
        }
    } else if (isMultiSelected) {
        bgColor = '#f39c12'; 
        classNameSuffix = 'selected-multi';
        currentSize = Math.round(24 * 1.1);
        currentFontSize = Math.round(12 * 1.1);
        borderStyle = '2px solid #ffeb3b'; // Brighter border for multi-select
    }
    
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
                    line-height: ${currentSize}px; 
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
        const isHome = waypoints.length > 0 && waypoints[0].id === waypoint.id;

        waypoint.marker.setIcon(createWaypointIcon(waypoint.id, isSelectedSingle, isMultiSelected, isHome));

        let zOffset = 0;
        if (isHome) {
            zOffset = 1500; 
        } else if (isSelectedSingle && !isMultiSelected) { // Prioritize multi-selection highlight slightly less than home, but more than normal multi
            zOffset = 1000;
        } else if (isMultiSelected) {
            zOffset = 500;
        }
        // Default zOffset is 0 for non-selected, non-multi-selected, non-home points.
        waypoint.marker.setZIndexOffset(zOffset);
    }
}
