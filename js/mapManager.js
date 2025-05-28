// File: mapManager.js

// Depends on: config.js (for map, defaultTileLayer, satelliteTileLayer, satelliteView, userLocationMarker, isDrawingSurveyArea)
// Depends on: utils.js (for showCustomAlert)
// Depends on: waypointManager.js (for addWaypoint - gestito da handleMapClick)
// Depends on: poiManager.js (for addPOI - gestito da handleMapClick)
// La dipendenza da waypointManager e poiManager per le funzioni addWaypoint/addPOI è implicita tramite handleMapClick.

/**
 * Initializes the Leaflet map and its basic functionalities.
 */
function initializeMap() {
    // Assicurati che 'map' sia definito in config.js e accessibile globalmente.
    // config.js dovrebbe avere: let map;
    map = L.map('map', { maxZoom: 22 }).setView([37.7749, -122.4194], 13);

    // Assicurati che defaultTileLayer e satelliteTileLayer siano definiti in config.js
    // config.js dovrebbe avere: let defaultTileLayer, satelliteTileLayer;
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

    // Map click listener - USA LA FUNZIONE NOMINATA handleMapClick
    map.on('click', handleMapClick);

    // Prevent default context menu on map
    map.on('contextmenu', e => {
        e.originalEvent.preventDefault(); // Previene il menu contestuale del browser sulla mappa
    });

    console.log("[MapManager] Map initialized and base layers added.");
}

/**
 * Handles click events on the map.
 * Adds a waypoint on a normal click, or a POI if Ctrl key is pressed.
 * This function now checks 'isDrawingSurveyArea' to avoid conflicts.
 * @param {L.LeafletMouseEvent} e - The Leaflet mouse event.
 */
function handleMapClick(e) {
    // DEBUG: Controlla il valore di isDrawingSurveyArea come lo vede mapManager
    console.log(`[MapManager] handleMapClick: Received click. isDrawingSurveyArea = ${isDrawingSurveyArea} (type: ${typeof isDrawingSurveyArea})`);

    if (typeof isDrawingSurveyArea !== 'undefined' && isDrawingSurveyArea === true) {
        console.log("[MapManager] handleMapClick: In survey area drawing mode, IGNORING default map click. Survey listener should handle it.");
        // Non fare L.DomEvent.stopPropagation(e.originalEvent) qui.
        // Lascia che il listener di disegno del poligono in surveyGridManager.js si occupi della propagazione.
        return; 
    }

    console.log("[MapManager] handleMapClick: Processing default map click (add waypoint/POI).");

    if (e.originalEvent.target === map.getContainer()) {
        console.log("[MapManager] Click was directly on map container.");
        if (e.originalEvent.ctrlKey) {
            console.log("[MapManager] Ctrl key pressed, attempting to add POI.");
            addPOI(e.latlng); // Funzione da poiManager.js
        } else {
            console.log("[MapManager] No Ctrl key, attempting to add Waypoint.");
            addWaypoint(e.latlng); // Funzione da waypointManager.js
        }
    } else {
        console.log("[MapManager] handleMapClick: Click was NOT directly on map container. Ignored by default handler.");
    }
}

/**
 * Toggles between default and satellite map views.
 */
function toggleSatelliteView() {
    if (!map || !defaultTileLayer || !satelliteTileLayer || !satelliteToggleBtn) {
        console.error("[MapManager] Cannot toggle satellite view: map or layer not initialized, or button missing.");
        return;
    }

    // satelliteView è una variabile globale da config.js
    if (satelliteView) {
        map.removeLayer(satelliteTileLayer);
        map.addLayer(defaultTileLayer);
        satelliteToggleBtn.textContent = '📡 Satellite';
    } else {
        map.removeLayer(defaultTileLayer);
        map.addLayer(satelliteTileLayer);
        satelliteToggleBtn.textContent = '🗺️ Map';
    }
    satelliteView = !satelliteView; // Aggiorna lo stato globale
    console.log(`[MapManager] Satellite view toggled. Now: ${satelliteView ? 'Satellite' : 'Default'}`);
}

/**
 * Fits the map view to show all waypoints, or all POIs if no waypoints exist.
 * If neither exist, sets a default view.
 */
function fitMapToWaypoints() {
    if (!map) {
        console.error("[MapManager] Cannot fit map to waypoints: map not initialized.");
        return;
    }

    if (waypoints.length > 0) {
        const bounds = L.latLngBounds(waypoints.map(wp => wp.latlng));
        map.fitBounds(bounds.pad(0.1)); // Add some padding
        console.log("[MapManager] Map fitted to waypoints bounds.");
    } else if (pois.length > 0) {
        const bounds = L.latLngBounds(pois.map(p => p.latlng));
        map.fitBounds(bounds.pad(0.1));
        console.log("[MapManager] Map fitted to POIs bounds (no waypoints).");
    } else {
        map.setView([37.7749, -122.4194], 13); // Default view
        console.log("[MapManager] Map set to default view (no waypoints or POIs).");
    }
}

/**
 * Tries to show the user's current location on the map.
 */
function showCurrentLocation() {
    if (!map) {
        console.error("[MapManager] Cannot show current location: map not initialized.");
        return;
    }

    if (!navigator.geolocation) {
        showCustomAlert('Geolocation is not supported by this browser.', "Error");
        console.warn("[MapManager] Geolocation not supported by browser.");
        return;
    }

    console.log("[MapManager] Attempting to get current location...");
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const latlng = L.latLng(position.coords.latitude, position.coords.longitude);
            // userLocationMarker è una variabile globale da config.js
            if (userLocationMarker) {
                userLocationMarker.setLatLng(latlng);
            } else {
                userLocationMarker = L.marker(latlng, {
                    icon: L.divIcon({
                        className: 'user-location-marker', // Per eventuale stile CSS specifico
                        html: '<div style="background:red;border-radius:50%;width:16px;height:16px;border:2px solid white;box-shadow: 0 0 5px #333;"></div>',
                        iconSize: [16, 16],
                        iconAnchor: [8, 8] // Centro dell'icona
                    })
                }).addTo(map);
            }
            map.setView(latlng, 15); // Zoom in to the user's location
            console.log("[MapManager] User location displayed:", latlng);
        },
        () => {
            showCustomAlert('Unable to retrieve your location.', "Error");
            console.error("[MapManager] Error retrieving user location.");
        }
    );
}

/**
 * Creates a Leaflet DivIcon for a waypoint marker.
 * (Questa funzione è usata da waypointManager.js e flightPathManager.js, ma è tematicamente legata alla mappa)
 * @param {number} id - The waypoint ID.
 * @param {boolean} isSelectedSingle - True if this waypoint is the currently active `selectedWaypoint`.
 * @param {boolean} [isMultiSelected=false] - True if this waypoint is part of `selectedForMultiEdit`.
 * @returns {L.DivIcon} The Leaflet DivIcon.
 */
function createWaypointIcon(id, isSelectedSingle, isMultiSelected = false) {
    let bgColor = '#3498db'; // Default (blu)
    // zIndexOffset e scaleFactor sono gestiti da updateMarkerIconStyle se necessario
    let borderStyle = '2px solid white';
    let classNameSuffix = ''; // Per stili CSS aggiuntivi

    if (isSelectedSingle) {
        bgColor = '#e74c3c'; // Rosso per selezionato singolarmente
        classNameSuffix = 'selected-single';
        if (isMultiSelected) {
            borderStyle = '3px solid #f39c12'; // Bordo arancione per indicare entrambi
        }
    } else if (isMultiSelected) {
        bgColor = '#f39c12'; // Arancione per multi-selezionato (non attivo singolarmente)
        classNameSuffix = 'selected-multi';
        borderStyle = '2px solid #ffeb3b'; // Bordo giallo
    }

    // La scala dell'icona può essere gestita qui o tramite CSS.
    // Per semplicità, manteniamo la dimensione base qui, e gli zIndexOffset in updateMarkerIconStyle.
    const size = 24; // Dimensione base
    const fontSize = 12; // Dimensione font base

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
                    font-size: ${fontSize}px;
                    font-weight: bold;
                    border: ${borderStyle};
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    transition: all 0.1s ease-out; 
                ">${id}</div>`,
        iconSize: [size, size], // Dimensione dell'icona
        iconAnchor: [size / 2, size / 2], // Punto di ancoraggio (centro)
        popupAnchor: [0, -size / 2] // Ancoraggio del popup rispetto all'iconAnchor
    });
}

/**
 * Updates the visual style (icon and z-index) of a waypoint marker based on its selection state.
 * (Questa funzione è usata principalmente da waypointManager.js)
 * @param {object} waypoint - The waypoint object, which should have a `marker` property.
 */
function updateMarkerIconStyle(waypoint) {
    if (waypoint && waypoint.marker) {
        const isSelectedSingle = selectedWaypoint && selectedWaypoint.id === waypoint.id;
        const isMultiSelected = selectedForMultiEdit.has(waypoint.id);
        
        waypoint.marker.setIcon(createWaypointIcon(waypoint.id, isSelectedSingle, isMultiSelected));

        // Gestisci zIndex e scale qui per dare priorità visiva
        let zOffset = 0;
        let scale = 1.0;

        if (isSelectedSingle) {
            zOffset = 1000; // Più in alto
            scale = 1.2;    // Più grande
        } else if (isMultiSelected) {
            zOffset = 500;  // Tra normale e selezionato singolo
            scale = 1.1;    // Leggermente più grande
        }
        
        waypoint.marker.setZIndexOffset(zOffset);
        // Per scalare il marker DOM element, avremmo bisogno di accedere al _icon property del marker.
        // Esempio: if (waypoint.marker._icon) waypoint.marker._icon.style.transform = `scale(${scale})`;
        // Tuttavia, createWaypointIcon ora può variare la dimensione direttamente, il che è più pulito se le dimensioni sono calcolate lì.
        // Se createWaypointIcon già gestisce le dimensioni basate sulla selezione, la manipolazione della scala qui potrebbe non essere necessaria
        // o potrebbe causare un doppio effetto. Assicuriamoci che createWaypointIcon sia la fonte della verità per la dimensione.
    }
}
