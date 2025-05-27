// flightPath.js
import { getWaypoints } from './waypoints.js';
import { getMap } from './map.js';
import { updateFlightStatistics } from './ui.js';

let flightPath = null;

export function updateFlightPath() {
    if (flightPath) {
        getMap().removeLayer(flightPath);
    }

    const waypoints = getWaypoints();
    let latlngs = [];

    if (waypoints.length < 2) {
        flightPath = L.polyline([], { color: '#3498db', weight: 4, smoothFactor: 1 }).addTo(getMap());
        updateFlightStatistics();
        return;
    }

    const pathType = document.getElementById('pathType').value;

    if (pathType === 'curved' && typeof L.CatmullRomSpline === 'function') {
        try {
            const points = waypoints.map(wp => [wp.latlng.lat, wp.latlng.lng]);
            const spline = new L.CatmullRomSpline(points, { tension: 0.5 });
            latlngs = spline.getPoints(100).map(p => [p[0], p[1]]);
        } catch (err) {
            console.error('Error creating spline:', err);
            latlngs = waypoints.map(wp => wp.latlng); // Fallback to straight path
        }
    } else {
        latlngs = waypoints.map(wp => wp.latlng);
    }

    flightPath = L.polyline(latlngs, { color: '#3498db', weight: 4, smoothFactor: 1 }).addTo(getMap());
    updateFlightStatistics();
}

export function getFlightPath() {
    return flightPath;
}
