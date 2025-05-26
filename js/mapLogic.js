// js/mapLogic.js
import * as Config from './config.js';
import * as State from './state.js'; // State now has getters and setters
import { addWaypoint as addWpViaManager, addPOI as addPoiViaManager } from './waypointPOILogic.js'; // Per il click sulla mappa
import { showCustomAlert, _tr } from './utils.js';

function handleStateChange(event) {
    if (!event.detail) return;
    const map = State.getMap();
    if (!map) return; // Map might not be initialized yet

    if (event.detail.selectedWaypointChanged) {
        const selectedWpId = event.detail.selectedWaypointId;
        if (selectedWpId !== null) {
            const selectedWaypoint = State.getWaypoints().find(wp => wp.id === selectedWpId);
            if (selectedWaypoint && selectedWaypoint.marker) { // Ensure marker exists
                map.panTo(selectedWaypoint.latlng);
            }
        }
    }

    if (event.detail.satelliteViewChanged) {
        const isSatellite = State.getSatelliteView(); // Use getter
        const defaultLayer = State.getDefaultTileLayer(); // Use getter
        const satelliteLayer = State.getSatelliteTileLayer(); // Use getter

        if (isSatellite) {
            if (map.hasLayer(defaultLayer)) {
                map.removeLayer(defaultLayer);
            }
            if (!map.hasLayer(satelliteLayer)) {
                map.addLayer(satelliteLayer);
            }
        } else {
            if (map.hasLayer(satelliteLayer)) {
                map.removeLayer(satelliteLayer);
            }
            if (!map.hasLayer(defaultLayer)) {
                map.addLayer(defaultLayer);
            }
        }
    }
    
    if (event.detail.waypointsModified) {
        // This could be refined with event.detail.action if needed
        console.log("Waypoints modified, mapLogic updating flight path.");
        updateFlightPathDisplay();
        if (event.detail.action === 'set') { // e.g. after import or clear all
            fitMapToWaypoints();
        }
    }
    
    if (event.detail.poisModified && event.detail.action === 'set') { // e.g. after import or clear all
         fitMapToWaypoints(); // Fit map if POIs were set and no waypoints exist
    }
}

export function initializeMapLogic() {
    const map = L.map('map', { maxZoom: Config.MAX_MAP_ZOOM }).setView(Config.DEFAULT_MAP_CENTER, Config.DEFAULT_MAP_ZOOM);
    State.setMap(map); // Use setter
    
    const defaultL = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: Config.MAX_MAP_ZOOM,
        maxNativeZoom: 19
    });
    State.setDefaultTileLayer(defaultL); // Use setter
    defaultL.addTo(map);


    const satelliteL = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri',
        maxZoom: Config.MAX_MAP_ZOOM,
        maxNativeZoom: 21
    });
    State.setSatelliteTileLayer(satelliteL); // Use setter

    map.on('click', e => { // Use map directly
        if (e.originalEvent.target === map.getContainer()) {
             if (e.originalEvent.ctrlKey) {
                addPoiViaManager(e.latlng);
            } else {
                addWpViaManager(e.latlng);
            }
        }
    });
    map.on('contextmenu', e => e.originalEvent.preventDefault()); // Use map directly
    document.addEventListener('stateChange', handleStateChange);
    console.log("MapLogic initialized and stateChange listener added.");
}

export function toggleSatelliteView() {
    // const map = State.getMap(); // Not needed here anymore
    // const btn = document.getElementById('satelliteToggleBtn'); // UI concern, handled by uiControls
    // Direct map layer manipulation and button text update removed.
    // State.satelliteView = !State.satelliteView; // Direct mutation removed
    State.toggleSatelliteView(); // Use state setter, which will dispatch satelliteViewChanged
}

export function fitMapToWaypoints() {
    const map = State.getMap();
    if (!map) return;
    const waypoints = State.getWaypoints(); // Use getter
    const pois = State.getPois(); // Use getter

    if (waypoints.length > 0) {
        map.fitBounds(L.latLngBounds(waypoints.map(wp => wp.latlng)).pad(0.1));
    } else if (pois.length > 0) {
        map.fitBounds(L.latLngBounds(pois.map(p => p.latlng)).pad(0.1));
    } else {
        map.setView(Config.DEFAULT_MAP_CENTER, Config.DEFAULT_MAP_ZOOM);
    }
}

export function showCurrentLocation() {
    const map = State.getMap();
    if (!map) return;
    if (!navigator.geolocation) {
        showCustomAlert(_tr('alertGeolocationNotSupported'), _tr("alertError"));
        return;
    }
    navigator.geolocation.getCurrentPosition(pos => {
        const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
        let currentMarker = State.getUserLocationMarker(); // Use getter
        if (currentMarker) {
            currentMarker.setLatLng(latlng);
        } else {
            const newMarker = L.marker(latlng, {
                icon: L.divIcon({
                    className:'user-loc',
                    html:'<div style="background:red;border-radius:50%;width:16px;height:16px;border:2px solid white;"></div>',
                    iconSize:[16,16],
                    iconAnchor:[8,8]
                })
            });
            State.setUserLocationMarker(newMarker); // Use setter
            newMarker.addTo(map); // Add to map after setting in state
        }
        map.setView(latlng, 15);
    }, () => showCustomAlert(_tr('alertUnableToRetrieveLocation'), _tr("alertError")));
}

export function updateFlightPathDisplay() {
    const map = State.getMap();
    if (!map) return;

    const currentFlightPath = State.getFlightPath(); // Use getter
    if (currentFlightPath) {
        if(map.hasLayer(currentFlightPath)) currentFlightPath.off('click', handlePathClick);
        map.removeLayer(currentFlightPath);
        State.clearFlightPath(); // Use state function
    }

    const waypoints = State.getWaypoints(); // Use getter
    if (waypoints.length < 2) {
        return;
    }

    const pathTypeValue = document.getElementById('pathType').value;
    const latlngsArrays = waypoints.map(wp => [wp.latlng.lat, wp.latlng.lng]);
    
    let displayPathCoords;
    if (pathTypeValue === 'curved' && latlngsArrays.length >= 2) {
        displayPathCoords = createSmoothPath(latlngsArrays);
    } else {
        displayPathCoords = latlngsArrays;
    }
    
    const newPath = L.polyline(displayPathCoords, {
        color: '#3498db',
        weight: 5,
        opacity: 0.8,
        dashArray: pathTypeValue === 'curved' ? null : '5, 5'
    });
    State.setFlightPath(newPath); // Use state function
    newPath.addTo(map);
    newPath.on('click', handlePathClick);
}

// handlePathClick e createSmoothPath ora sono in waypointPOILogic.js o utils.js
// Importale se necessario, o sposta la logica di creazione qui
import { handlePathClick } from './waypointPOILogic.js';
import { createSmoothPath } from './utils.js';