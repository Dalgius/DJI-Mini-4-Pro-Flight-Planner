// js/state.js
export let mapInstance; // Riferimento all'istanza della mappa Leaflet
export let waypoints = [];
export let pois = [];
export let selectedWaypoint = null;
export let flightPath = null;
export let satelliteView = false;
export let waypointCounter = 1;
export let poiCounter = 1;
export let actionGroupCounter = 1;
export let actionCounter = 1;
export let defaultTileLayer, satelliteTileLayer, userLocationMarker;
export let selectedForMultiEdit = new Set();

// Funzioni per modificare lo stato (se necessario centralizzare le modifiche)
export function setMap(mapObj) { mapInstance = mapObj; }
export function getMap() { return mapInstance; }

export function getWaypoints() { return waypoints; }
export function setWaypoints(newWaypoints) { waypoints = newWaypoints; }
export function addWaypointToArray(wp) { waypoints.push(wp); }
// ... e così via per altri getter/setter se vuoi un controllo più stretto

export function getPois() { return pois; }
export function setPois(newPois) { pois = newPois; }
export function addPoiToArray(poi) { pois.push(poi); }

export function getSelectedWaypoint() { return selectedWaypoint; }
export function setSelectedWaypoint(wp) { selectedWaypoint = wp; }

// ... ecc. per tutti gli stati globali ...
// Per ora, molte funzioni modificheranno direttamente gli array esportati.
// Si potrebbe rendere più robusto con funzioni setter.