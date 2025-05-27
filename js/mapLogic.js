// js/mapLogic.js
import * as Config from './config.js';
import * as State from './state.js';
import { addWaypoint as addWpViaManager, addPOI as addPoiViaManager } from './waypointPOILogic.js'; // Per il click sulla mappa
import { showCustomAlert, _tr } from './utils.js';

export function initializeMapLogic() {
    State.setMap(L.map('map', { maxZoom: Config.MAX_MAP_ZOOM }).setView(Config.DEFAULT_MAP_CENTER, Config.DEFAULT_MAP_ZOOM));
    
    State.defaultTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', 
        maxZoom: Config.MAX_MAP_ZOOM, 
        maxNativeZoom: 19 
    }).addTo(State.getMap());

    State.satelliteTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri', 
        maxZoom: Config.MAX_MAP_ZOOM, 
        maxNativeZoom: 21 
    });

    State.getMap().on('click', e => {
        if (e.originalEvent.target === State.getMap().getContainer()) {
             if (e.originalEvent.ctrlKey) {
                addPoiViaManager(e.latlng);
            } else {
                addWpViaManager(e.latlng);
            }
        }
    });
    State.getMap().on('contextmenu', e => e.originalEvent.preventDefault());
}

export function toggleSatelliteView() {
    const map = State.getMap();
    const btn = document.getElementById('satelliteToggleBtn'); // Assumendo che l'ID sia definito in domElements
    if (State.satelliteView) { 
        map.removeLayer(State.satelliteTileLayer); 
        map.addLayer(State.defaultTileLayer); 
        if(btn) btn.innerHTML = _tr("mapBtnSatellite"); // Usa innerHTML per le icone
    } else { 
        map.removeLayer(State.defaultTileLayer); 
        map.addLayer(State.satelliteTileLayer); 
        if(btn) btn.innerHTML = _tr("mapBtnMap"); 
    }
    State.satelliteView = !State.satelliteView;
}

export function fitMapToWaypoints() {
    const map = State.getMap();
    if (State.getWaypoints().length > 0) {
        map.fitBounds(L.latLngBounds(State.getWaypoints().map(wp => wp.latlng)).pad(0.1));
    } else if (State.getPois().length > 0) {
        map.fitBounds(L.latLngBounds(State.getPois().map(p => p.latlng)).pad(0.1));
    } else {
        map.setView(Config.DEFAULT_MAP_CENTER, Config.DEFAULT_MAP_ZOOM);
    }
}

export function showCurrentLocation() {
    const map = State.getMap();
    if (!navigator.geolocation) { 
        showCustomAlert(_tr('alertGeolocationNotSupported'), _tr("alertError")); 
        return; 
    }
    navigator.geolocation.getCurrentPosition(pos => {
        const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
        if (State.userLocationMarker) {
            State.userLocationMarker.setLatLng(latlng);
        } else {
            State.userLocationMarker = L.marker(latlng, {
                icon: L.divIcon({
                    className:'user-loc',
                    html:'<div style="background:red;border-radius:50%;width:16px;height:16px;border:2px solid white;"></div>',
                    iconSize:[16,16],
                    iconAnchor:[8,8]
                })
            }).addTo(map);
        }
        map.setView(latlng, 15);
    }, () => showCustomAlert(_tr('alertUnableToRetrieveLocation'), _tr("alertError")));
}

export function updateFlightPathDisplay() { // Rinominata per chiarezza
    const map = State.getMap();
    if (State.flightPath) {
        if(map.hasLayer(State.flightPath)) State.flightPath.off('click', handlePathClick); // Rimuovi vecchio listener se esiste
        map.removeLayer(State.flightPath);
        State.flightPath = null; 
    }
    if (State.getWaypoints().length < 2) { 
        // updateFlightStatisticsDisplay(); // Chiamata da chi modifica i waypoint
        return; 
    }
    const pathTypeValue = document.getElementById('pathType').value; // Prendi direttamente il valore
    const latlngsArrays = State.getWaypoints().map(wp => [wp.latlng.lat, wp.latlng.lng]);
    
    let displayPathCoords;
    if (pathTypeValue === 'curved' && latlngsArrays.length >= 2) { 
        displayPathCoords = createSmoothPath(latlngsArrays); // createSmoothPath dovrebbe essere in utils.js
    } else {
        displayPathCoords = latlngsArrays;
    }
    
    State.flightPath = L.polyline(displayPathCoords, { 
        color: '#3498db', 
        weight: 5, 
        opacity: 0.8, 
        dashArray: pathTypeValue === 'curved' ? null : '5, 5' 
    }).addTo(map);
    State.flightPath.on('click', handlePathClick); 
    // updateFlightStatisticsDisplay(); // Chiamata da chi modifica i waypoint
}

// handlePathClick e createSmoothPath ora sono in waypointPOILogic.js o utils.js
// Importale se necessario, o sposta la logica di creazione qui
import { handlePathClick } from './waypointPOILogic.js';
import { createSmoothPath } from './utils.js';