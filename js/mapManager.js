// File: mapManager.js

// Depends on: config.js (for map, defaultTileLayer, satelliteTileLayer, satelliteView, userLocationMarker, isDrawingSurveyArea, waypoints, selectedWaypoint, selectedForMultiEdit, pois)
// Depends on: utils.js (for showCustomAlert, calculateBearing - now in utils.js)
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
    if (typeof isDrawingSurveyArea !== 'undefined' && isDrawingSurveyArea === true) {
        console.log("[MapManager] handleMapClick: In survey area drawing mode, ignoring default map click.");
        return; 
    }

    console.log("[MapManager] handleMapClick: Processing default map click (add waypoint/POI).");
    if (e.originalEvent.target === map.getContainer() || e.originalEvent.target.classList.contains('leaflet-container')) {
        if (e.originalEvent.ctrlKey) {
            addPOI(e.latlng); 
        } else {
            addWaypoint(e.latlng); 
        }
    } else {
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
        map.setView([37.7749, -122.4194], 13); 
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
 * Creates a Leaflet DivIcon for a waypoint marker, including a heading indicator.
 * @param {object} waypointObject - The full waypoint object.
 * @param {boolean} isSelectedSingle - True if this waypoint is the currently active `selectedWaypoint`.
 * @param {boolean} [isMultiSelected=false] - True if this waypoint is part of `selectedForMultiEdit`.
 * @param {boolean} [isHomePoint=false] - True if this waypoint is the Home/Takeoff point.
 * @returns {L.DivIcon} The Leaflet DivIcon.
 */
function createWaypointIcon(waypointObject, isSelectedSingle, isMultiSelected = false, isHomePoint = false) {
    let bgColor = '#3498db'; 
    let iconHtmlContent = String(waypointObject.id); 
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
        if (isMultiSelected) { 
            borderStyle = '3px solid #f39c12'; 
        }
    } else if (isMultiSelected) {
        bgColor = '#f39c12'; 
        classNameSuffix = 'selected-multi';
        currentSize = Math.round(24 * 1.1);
        currentFontSize = Math.round(12 * 1.1);
        borderStyle = '2px solid #ffeb3b'; 
    }
    
    currentSize = Math.round(currentSize);
    currentFontSize = Math.round(currentFontSize);

    // --- Heading Indicator Logic ---
    let headingAngleDeg = 0;
    let arrowColor = 'transparent'; // Default to no arrow
    const arrowLength = 15; // Length of the heading indicator line
    const wpIndex = waypoints.findIndex(w => w.id === waypointObject.id);

    if (waypointObject.headingControl === 'auto') {
        arrowColor = '#3498db'; // Blue for auto
        if (wpIndex < waypoints.length - 1) { // Point to next waypoint
            headingAngleDeg = calculateBearing(waypointObject.latlng, waypoints[wpIndex + 1].latlng);
        } else if (wpIndex > 0) { // Last waypoint, point from previous
            headingAngleDeg = calculateBearing(waypoints[wpIndex - 1].latlng, waypointObject.latlng);
        } else {
            arrowColor = 'transparent'; // Single waypoint, no auto heading
        }
    } else if (waypointObject.headingControl === 'fixed') {
        headingAngleDeg = waypointObject.fixedHeading;
        arrowColor = '#6c757d'; // Gray for fixed heading
    } else if (waypointObject.headingControl === 'poi_track' && waypointObject.targetPoiId !== null) {
        const targetPoi = pois.find(p => p.id === waypointObject.targetPoiId);
        if (targetPoi) {
            headingAngleDeg = calculateBearing(waypointObject.latlng, targetPoi.latlng);
            arrowColor = '#28a745'; // Green for POI tracking
        } else {
            arrowColor = 'transparent'; // POI not found
        }
    } else {
        arrowColor = 'transparent'; // No specific heading control
    }
    
    // DJI Pilot app shows heading from center, so 0,0 in SVG is center of WP. Line goes "up" (negative Y) then rotates.
    let headingIndicatorSvg = '';
    if (arrowColor !== 'transparent') {
        headingIndicatorSvg = `
            <svg width="${currentSize + arrowLength * 2}" height="${currentSize + arrowLength * 2}" 
                 style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(${headingAngleDeg}deg); overflow: visible;">
                <line x1="0" y1="0" x2="0" y2="-${arrowLength + currentSize/3}" stroke="${arrowColor}" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
        `;
        // y2 adjusted to start line slightly outside the main circle for better visibility like DJI app
    }

    return L.divIcon({
        className: `waypoint-marker ${classNameSuffix}`,
        html: `
            <div style="
                position: relative; /* For positioning the SVG arrow */
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
                z-index: 1; /* Ensure main circle is above arrow if they overlap perfectly at center */
            ">
                ${iconHtmlContent}
            </div>
            ${headingIndicatorSvg} 
            `,
        iconSize: [currentSize, currentSize], // Icon size remains for the circle
        iconAnchor: [currentSize / 2, currentSize / 2],
        popupAnchor: [0, -currentSize / 2]
    });
}

/**
 * Updates the visual style (icon and z-index) of a waypoint marker.
 * @param {object} waypointObject - The waypoint object.
 */
function updateMarkerIconStyle(waypointObject) {
    if (waypointObject && waypointObject.marker) {
        const isSelectedSingle = selectedWaypoint && selectedWaypoint.id === waypointObject.id;
        const isMultiSelected = selectedForMultiEdit.has(waypointObject.id);
        const isHome = waypoints.length > 0 && waypoints[0].id === waypointObject.id;

        waypointObject.marker.setIcon(createWaypointIcon(waypointObject, isSelectedSingle, isMultiSelected, isHome));

        let zOffset = 0;
        if (isHome) {
            zOffset = 1500; 
        } else if (isSelectedSingle && !isMultiSelected) { 
            zOffset = 1000;
        } else if (isMultiSelected) {
            zOffset = 500;
        }
        waypointObject.marker.setZIndexOffset(zOffset);
    }
}
