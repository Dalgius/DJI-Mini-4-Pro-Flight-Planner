// map.js
import { addWaypoint } from './waypoints.js';
import { addPOI } from './pois.js';
import { fitMapToWaypoints } from './ui.js';

let map;
let defaultTileLayer, satelliteTileLayer, userLocationMarker;
let satelliteView = false;

export function initializeMap() {
    map = L.map('map', { maxZoom: 22 }).setView([37.7749, -122.4194], 13);
    defaultTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', maxZoom: 22, maxNativeZoom: 19
    }).addTo(map);
    satelliteTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri', maxZoom: 22, maxNativeZoom: 21
    });
    map.on('click', e => {
        if (e.originalEvent.target === map.getContainer()) {
            if (e.originalEvent.ctrlKey) {
                addPOI(e.latlng);
            } else {
                addWaypoint(e.latlng);
            }
        }
    });
    map.on('contextmenu', e => e.originalEvent.preventDefault());
}

export function toggleSatelliteView() {
    const btn = document.getElementById('satelliteToggleBtn');
    if (satelliteView) {
        map.removeLayer(satelliteTileLayer);
        map.addLayer(defaultTileLayer);
        btn.textContent = '📡 Satellite';
    } else {
        map.removeLayer(defaultTileLayer);
        map.addLayer(satelliteTileLayer);
        btn.textContent = '🗺️ Map';
    }
    satelliteView = !satelliteView;
}

export function showCurrentLocation() {
    if (!navigator.geolocation) {
        showCustomAlert('Geolocation is not supported by this browser.', 'Error');
        return;
    }
    navigator.geolocation.getCurrentPosition(
        pos => {
            const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
            if (userLocationMarker) userLocationMarker.setLatLng(latlng);
            else userLocationMarker = L.marker(latlng, {
                icon: L.divIcon({
                    className: 'user-loc',
                    html: '<div style="background:red;border-radius:50%;width:16px;height:16px;border:2px solid white;"></div>',
                    iconSize: [16, 16],
                    iconAnchor: [8, 8]
                })
            }).addTo(map);
            map.setView(latlng, 15);
        },
        () => showCustomAlert('Unable to retrieve your location.', 'Error')
    );
}

export function getMap() {
    return map;
}