// js/mapLogic.js
import * as Config from './config.js';
import * as State from './state.js';
import * as DOM from './domElements.js';
// Importa le funzioni che verranno chiamate al click sulla mappa
import { addWaypoint as addWpFromMapClick, addPOI as addPoiFromMapClick, handlePathClick } from './waypointPOILogic.js'; 
import { showCustomAlert, _tr, createSmoothPath } from './utils.js';

export function initializeMapLogic() {
    const map = L.map('map', { maxZoom: Config.MAX_MAP_ZOOM })
                 .setView(Config.DEFAULT_MAP_CENTER, Config.DEFAULT_MAP_ZOOM);
    State.setMap(map);
    
    State.setDefaultTileLayer(L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', 
        maxZoom: Config.MAX_MAP_ZOOM, 
        maxNativeZoom: 19 
    }).addTo(map));

    State.setSatelliteTileLayer(L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri', 
        maxZoom: Config.MAX_MAP_ZOOM, 
        maxNativeZoom: 21 
    }));

    map.on('click', e => {
        // Assicurati che il click non sia su un marker o su un controllo della mappa
        if (e.originalEvent.target === map.getContainer() || e.originalEvent.target.classList.contains('leaflet-tile')) {
             if (e.originalEvent.ctrlKey) {
                addPoiFromMapClick(e.latlng);
            } else {
                addWpFromMapClick(e.latlng);
            }
        }
    });
    map.on('contextmenu', e => e.originalEvent.preventDefault());
}

export function toggleSatelliteView() {
    const map = State.getMap();
    if (!map || !State.getDefaultTileLayer() || !State.getSatelliteTileLayer()) return;

    if (State.getSatelliteView()) { 
        map.removeLayer(State.getSatelliteTileLayer()); 
        map.addLayer(State.getDefaultTileLayer()); 
        if(DOM.satelliteToggleBtn) DOM.satelliteToggleBtn.innerHTML = _tr("mapBtnSatellite");
    } else { 
        map.removeLayer(State.getDefaultTileLayer()); 
        map.addLayer(State.getSatelliteTileLayer()); 
        if(DOM.satelliteToggleBtn) DOM.satelliteToggleBtn.innerHTML = _tr("mapBtnMap"); 
    }
    State.setSatelliteView(!State.getSatelliteView());
}

export function fitMapToWaypoints() {
    const map = State.getMap();
    if (!map) return;
    const waypointsArray = State.getWaypoints();
    const poisArray = State.getPois();

    if (waypointsArray.length > 0) {
        map.fitBounds(L.latLngBounds(waypointsArray.map(wp => wp.latlng)).pad(0.1));
    } else if (poisArray.length > 0) {
        map.fitBounds(L.latLngBounds(poisArray.map(p => p.latlng)).pad(0.1));
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
        if (State.getUserLocationMarker()) {
            State.getUserLocationMarker().setLatLng(latlng);
        } else {
            State.setUserLocationMarker(L.marker(latlng, {
                icon: L.divIcon({
                    className:'user-loc',
                    html:'<div style="background:red;border-radius:50%;width:16px;height:16px;border:2px solid white;"></div>',
                    iconSize:[16,16],
                    iconAnchor:[8,8]
                })
            }).addTo(map));
        }
        map.setView(latlng, 15);
    }, () => showCustomAlert(_tr('alertUnableToRetrieveLocation'), _tr("alertError")));
}

export function updateFlightPathDisplay() { 
    const map = State.getMap();
    if (!map) return;

    if (State.getFlightPath()) {
        if(map.hasLayer(State.getFlightPath())) State.getFlightPath().off('click', handlePathClick);
        map.removeLayer(State.getFlightPath());
        State.setFlightPath(null); 
    }

    const waypointsArray = State.getWaypoints();
    if (waypointsArray.length < 2) { 
        import('../js/uiControls.js').then(ui => ui.updateFlightStatisticsDisplay());
        return; 
    }
    
    const pathTypeValue = DOM.pathTypeSelect.value;
    const latlngsArrays = waypointsArray.map(wp => [wp.latlng.lat, wp.latlng.lng]);
    
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
    }).addTo(map);
    newPath.on('click', handlePathClick); 
    State.setFlightPath(newPath);
    import('../js/uiControls.js').then(ui => ui.updateFlightStatisticsDisplay());
}
