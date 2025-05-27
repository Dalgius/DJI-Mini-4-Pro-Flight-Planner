// flightPath.js
import { getWaypoints, addWaypoint } from './waypoints.js';
import { updateFlightStatistics, showCustomAlert } from './ui.js';
import { getMap } from './map.js';

let flightPath = null;

export function updateFlightPath() {
    const waypoints = getWaypoints();
    if (flightPath) {
        flightPath.off('click', handlePathClick);
        getMap().removeLayer(flightPath);
        flightPath = null;
    }
    if (waypoints.length < 2) {
        updateFlightStatistics();
        return;
    }
    const pathType = document.getElementById('pathType').value;
    const latlngsArrays = waypoints.map(wp => [wp.latlng.lat, wp.latlng.lng]);
    let displayPathCoords = (pathType === 'curved' && latlngsArrays.length >= 2) ? createSmoothPath(latlngsArrays) : latlngsArrays;
    flightPath = L.polyline(displayPathCoords, {
        color: '#3498db',
        weight: 5,
        opacity: 0.8,
        dashArray: pathType === 'curved' ? null : '5, 5'
    }).addTo(getMap());
    flightPath.on('click', handlePathClick);
    updateFlightStatistics();
}

function handlePathClick(e) {
    const waypoints = getWaypoints();
    const clickedLatLng = e.latlng;
    if (waypoints.length < 2) return;
    let closestSegmentIndex = -1;
    let minDistanceToSegmentLine = Infinity;
    let insertionPoint = clickedLatLng;
    for (let i = 0; i < waypoints.length - 1; i++) {
        const p1 = waypoints[i].latlng;
        const p2 = waypoints[i + 1].latlng;
        const midPoint = L.latLng((p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2);
        const distToMid = clickedLatLng.distanceTo(midPoint);
        if (distToMid < minDistanceToSegmentLine) {
            minDistanceToSegmentLine = distToMid;
            closestSegmentIndex = i;
        }
    }
    if (closestSegmentIndex !== -1) {
        console.log(`Path clicked. Insertion after waypoint index: ${closestSegmentIndex}. Point:`, insertionPoint);
        const alt1 = waypoints[closestSegmentIndex].altitude;
        const alt2 = waypoints[closestSegmentIndex + 1].altitude;
        let newWpAltitude = alt1;
        const distToP1 = insertionPoint.distanceTo(waypoints[closestSegmentIndex].latlng);
        const segmentLength = waypoints[closestSegmentIndex].latlng.distanceTo(waypoints[closestSegmentIndex + 1].latlng);
        if (segmentLength > 0) {
            const ratio = distToP1 / segmentLength;
            newWpAltitude = alt1 + (alt2 - alt1) * ratio;
        }
        newWpAltitude = Math.round(Math.max(5, newWpAltitude));
        addWaypoint(insertionPoint);
        const newWaypoint = waypoints[waypoints.length - 1];
        newWaypoint.altitude = newWpAltitude;
        updateFlightPath();
        updateFlightStatistics();
        showCustomAlert(`Waypoint ${newWaypoint.id} inserted.`, 'Info');
    }
}

function getCatmullRomPoint(t, p0, p1, p2, p3) {
    const t2 = t * t, t3 = t2 * t;
    const f1 = -0.5 * t3 + t2 - 0.5 * t, f2 = 1.5 * t3 - 2.5 * t2 + 1, f3 = -1.5 * t3 + 2 * t2 + 0.5 * t, f4 = 0.5 * t3 - 0.5 * t2;
    return [p0[0] * f1 + p1[0] * f2 + p2[0] * f3 + p3[0] * f4, p0[1] * f1 + p1[1] * f2 + p2[1] * f3 + p3[1] * f4];
}

function createSmoothPath(points) {
    if (points.length < 2) return points;
    const smoothed = [];
    const numSegments = 15;
    if (points.length === 2) return [points[0], points[1]];
    smoothed.push(points[0]);
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = i === 0 ? points[0] : points[i - 1], p1 = points[i], p2 = points[i + 1], p3 = i === points.length - 2 ? points[points.length - 1] : points[i + 2];
        for (let j = 1; j <= numSegments; j++) smoothed.push(getCatmullRomPoint(j / numSegments, p0, p1, p2, p3));
    }
    return smoothed;
}

function haversineDistance(coords1, coords2) {
    function toRad(x) { return x * Math.PI / 180; }
    const lat1 = coords1.lat || coords1[0], lon1 = coords1.lng || coords1[1], lat2 = coords2.lat || coords2[0], lon2 = coords2.lng || coords2[1];
    const R = 6371e3, φ1 = toRad(lat1), φ2 = toRad(lat2), Δφ = toRad(lat2 - lat1), Δλ = toRad(lon2 - lon1);
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}