// js/state.js

// Istanza della mappa Leaflet
export let mapInstance = null; 

// Dati principali dell'applicazione
export let waypoints = [];
export let pois = [];
export let selectedWaypoint = null;
export let flightPath = null; // Riferimento alla polyline del percorso sulla mappa

// Contatori
export let waypointCounter = 1;
export let poiCounter = 1;
export let actionGroupCounter = 1; // Per gli ID dei gruppi di azione in WPML
export let actionCounter = 1;      // Per gli ID delle singole azioni in WPML

// Impostazioni UI Mappa
export let satelliteView = false;
export let defaultTileLayer = null;
export let satelliteTileLayer = null;
export let userLocationMarker = null;

// Stato della selezione multipla
export let selectedForMultiEdit = new Set();


// --- Funzioni per modificare lo stato (se si vuole un controllo più granulare) ---
// Per ora, molti moduli modificano direttamente gli array esportati.
// In futuro, si potrebbe passare attraverso funzioni setter per una gestione più controllata.

export function setMap(mapObj) { mapInstance = mapObj; }
export function getMap() { return mapInstance; }

export function getWaypoints() { return waypoints; }
export function setWaypoints(newWaypoints) { waypoints = newWaypoints; } // Usato da loadFlightPlan
export function addWaypointToArray(wp) { waypoints.push(wp); }
export function removeWaypointFromArray(wpId) {
    waypoints = waypoints.filter(wp => wp.id !== wpId);
}

export function getPois() { return pois; }
export function setPois(newPois) { pois = newPois; } // Usato da loadFlightPlan
export function addPoiToArray(poi) { pois.push(poi); }
export function removePoiFromArray(poiId) {
    pois = pois.filter(p => p.id !== poiId);
}

export function getSelectedWaypoint() { return selectedWaypoint; }
export function setSelectedWaypoint(wp) { selectedWaypoint = wp; }

// Funzione per resettare i contatori (es. quando si fa "Clear All")
export function resetCounters() {
    waypointCounter = 1;
    // poiCounter viene resettato in addPOI se pois è vuoto
    actionGroupCounter = 1;
    actionCounter = 1;
}

export function resetPoiCounterIfEmpty() {
    if (pois.length === 0) {
        poiCounter = 1;
    }
}

export function getFlightPath() { return flightPath; }
export function setFlightPath(path) { flightPath = path; }

export function getSatelliteView() { return satelliteView; }
export function setSatelliteView(isSatellite) { satelliteView = isSatellite; }

export function getDefaultTileLayer() { return defaultTileLayer; }
export function setDefaultTileLayer(layer) { defaultTileLayer = layer; }

export function getSatelliteTileLayer() { return satelliteTileLayer; }
export function setSatelliteTileLayer(layer) { satelliteTileLayer = layer; }

export function getUserLocationMarker() { return userLocationMarker; }
export function setUserLocationMarker(marker) { userLocationMarker = marker; }
