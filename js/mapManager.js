// File: mapManager.js

// Depends on: config.js, utils.js, waypointManager.js (for addWaypoint), poiManager.js (for addPOI)

/**
 * Initializes the Leaflet map.
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

    // Map click listener
    map.on('click', handleMapClick);

    // Prevent default context menu on map
    map.on('contextmenu', e => {
        e.originalEvent.preventDefault();
    });
}

/**
 * Handles click events on the map.
 * Adds a waypoint on a normal click, or a POI if Ctrl key is pressed.
 * @param {L.LeafletMouseEvent} e - The Leaflet mouse event.
 */
function handleMapClick(e) {
    // Ensure click is directly on the map container, not on a marker or other overlay
    if (e.originalEvent.target === map.getContainer()) {
        if (e.originalEvent.ctrlKey) {
            addPOI(e.latlng); // Assumes addPOI is globally available or imported
        } else {
            addWaypoint(e.latlng); // Assumes addWaypoint is globally available or imported
        }
    }
}

/**
 * Toggles between default and satellite map views.
 */
function toggleSatelliteView() {
    if (!map || !defaultTileLayer || !satelliteTileLayer || !satelliteToggleBtn) return;

    if (satelliteView) {
        map.removeLayer(satelliteTileLayer);
        map.addLayer(defaultTileLayer);
        satelliteToggleBtn.textContent = '📡 Satellite';
    } else {
        map.removeLayer(defaultTileLayer);
        map.addLayer(satelliteTileLayer);
        satelliteToggleBtn.textContent = '🗺️ Map';
    }
    satelliteView = !satelliteView;
}

/**
 * Fits the map view to show all waypoints, or all POIs if no waypoints exist.
 * If neither exist, sets a default view.
 */
function fitMapToWaypoints() {
    if (!map) return;

    if (waypoints.length > 0) {
        const bounds = L.latLngBounds(waypoints.map(wp => wp.latlng));
        map.fitBounds(bounds.pad(0.1)); // Add some padding
    } else if (pois.length > 0) {
        const bounds = L.latLngBounds(pois.map(p => p.latlng));
        map.fitBounds(bounds.pad(0.1));
    } else {
        map.setView([37.7749, -122.4194], 13); // Default view
    }
}

/**
 * Tries to show the user's current location on the map.
 */
function showCurrentLocation() {
    if (!map) return;

    if (!navigator.geolocation) {
        showCustomAlert('Geolocation is not supported by this browser.', "Error");
        return;
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
                        iconSize: [16, 16],
                        iconAnchor: [8, 8]
                    })
                }).addTo(map);
            }
            map.setView(latlng, 15); // Zoom in to the user's location
        },
        () => {
            showCustomAlert('Unable to retrieve your location.', "Error");
        }
    );
}

/**
 * Creates a Leaflet DivIcon for a waypoint marker.
 * @param {number} id - The waypoint ID.
 * @param {boolean} isSelectedSingle - True if this waypoint is the currently active `selectedWaypoint`.
 * @param {boolean} [isMultiSelected=false] - True if this waypoint is part of `selectedForMultiEdit`.
 * @returns {L.DivIcon} The Leaflet DivIcon.
 */
function createWaypointIcon(id, isSelectedSingle, isMultiSelected = false) {
    let bgColor = '#3498db'; // Default (blue)
    let zIndexOffset = 0;
    let scaleFactor = 1.0;
    let borderStyle = '2px solid white';
    let classNameSuffix = '';

    if (isSelectedSingle) {
        bgColor = '#e74c3c'; // Red for singly selected
        zIndexOffset = 1000;
        scaleFactor = 1.2;
        classNameSuffix = 'selected-single';
        if (isMultiSelected) { // If also part of multi-selection
            borderStyle = '3px solid #f39c12'; // Orange border to indicate both
        }
    } else if (isMultiSelected) {
        bgColor = '#f39c12'; // Orange for multi-selected (but not the active single selected)
        zIndexOffset = 500;
        scaleFactor = 1.1;
        borderStyle = '2px solid #ffeb3b'; // Yellow border
        classNameSuffix = 'selected-multi';
    }

    const size = 24 * scaleFactor;
    const fontSize = 12 * scaleFactor;

    return L.divIcon({
        className: `waypoint-marker ${classNameSuffix}`,
        html: `<div style="
                    background: ${bgColor};
                    color: white;
                    border-radius: 50%;
                    width: ${size}px;
                    height: ${size}px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: ${fontSize.toFixed(0)}px;
                    font-weight: bold;
                    border: ${borderStyle};
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    transform: scale(1);
                    transition: all 0.1s ease-out;
                }">${id}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2]
    });
}

/**
 * Updates the visual style (icon) of a waypoint marker based on its selection state.
 * @param {object} waypoint - The waypoint object, which should have a `marker` property.
 */
function updateMarkerIconStyle(waypoint) {
    if (waypoint && waypoint.marker) {
        const isSelectedSingle = selectedWaypoint && selectedWaypoint.id === waypoint.id;
        const isMultiSelected = selectedForMultiEdit.has(waypoint.id);
        waypoint.marker.setIcon(createWaypointIcon(waypoint.id, isSelectedSingle, isMultiSelected));

        let zOffset = 0;
        if (isSelectedSingle) {
            zOffset = 1000;
        } else if (isMultiSelected) {
            zOffset = 500;
        }
        waypoint.marker.setZIndexOffset(zOffset);
    }
}