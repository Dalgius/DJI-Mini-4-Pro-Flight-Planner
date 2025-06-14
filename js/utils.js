// File: utils.js

// Depends on: config.js (for R_EARTH, modal elements), domCache.js (for modal elements if not passed as args)

/**
 * Displays a custom alert message.
 * @param {string} message - The message to display.
 * @param {string} [title="Notification"] - The title of the alert.
 */
function showCustomAlert(message, title = "Notification") {
    if (customAlertMessageEl && customAlertOverlayEl && customAlertTitleEl) {
        customAlertTitleEl.textContent = title;
        customAlertMessageEl.textContent = message;
        customAlertOverlayEl.style.display = 'flex';
    } else {
        console.error("Custom alert elements not found in DOM cache!");
        alert(message); // Fallback to native alert
    }
}

/**
 * Converts degrees to radians.
 * @param {number} degrees - Angle in degrees.
 * @returns {number} Angle in radians.
 */
function toRad(degrees) {
    return degrees * Math.PI / 180;
}

/**
 * Calculates the Haversine distance between two geographic coordinates.
 * @param {{lat: number, lng: number} | [number, number] | L.LatLng} coords1 - First coordinate.
 * @param {{lat: number, lng: number} | [number, number] | L.LatLng} coords2 - Second coordinate.
 * @returns {number} Distance in meters.
 */
function haversineDistance(coords1, coords2) {
    const lat1 = (typeof coords1.lat === 'function') ? coords1.lat() : (coords1.lat || coords1[0]);
    const lon1 = (typeof coords1.lng === 'function') ? coords1.lng() : (coords1.lng || coords1[1]);
    const lat2 = (typeof coords2.lat === 'function') ? coords2.lat() : (coords2.lat || coords2[0]);
    const lon2 = (typeof coords2.lng === 'function') ? coords2.lng() : (coords2.lng || coords2[1]);

    const R = R_EARTH; 
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

/**
 * Calculates a point on a Catmull-Rom spline.
 * @param {number} t - Parameter, 0 to 1.
 * @param {[number, number]} p0 - Control point 0.
 * @param {[number, number]} p1 - Control point 1 (start of segment).
 * @param {[number, number]} p2 - Control point 2 (end of segment).
 * @param {[number, number]} p3 - Control point 3.
 * @returns {[number, number]} The [lat, lng] of the interpolated point.
 */
function getCatmullRomPoint(t, p0, p1, p2, p3) {
    const t2 = t * t;
    const t3 = t2 * t;

    const f1 = -0.5 * t3 + t2 - 0.5 * t;
    const f2 = 1.5 * t3 - 2.5 * t2 + 1;
    const f3 = -1.5 * t3 + 2.0 * t2 + 0.5 * t;
    const f4 = 0.5 * t3 - 0.5 * t2;

    const x = p0[0] * f1 + p1[0] * f2 + p2[0] * f3 + p3[0] * f4;
    const y = p0[1] * f1 + p1[1] * f2 + p2[1] * f3 + p3[1] * f4;

    return [x, y];
}

/**
 * Creates a smoothed path using Catmull-Rom splines.
 * @param {Array<[number, number]>} points - Array of [lat, lng] points.
 * @returns {Array<[number, number]>} Array of [lat, lng] points for the smoothed path.
 */
function createSmoothPath(points) {
    if (points.length < 2) return points;
    if (points.length === 2) return [points[0], points[1]];

    const smoothed = [];
    const numSegmentsBetweenPoints = 15; 

    smoothed.push(points[0]);

    for (let i = 0; i < points.length - 1; i++) {
        const p0 = (i === 0) ? points[0] : points[i - 1];         
        const p1 = points[i];                                     
        const p2 = points[i + 1];                                 
        const p3 = (i === points.length - 2) ? points[points.length - 1] : points[i + 2]; 

        for (let j = 1; j <= numSegmentsBetweenPoints; j++) {
            const t = j / numSegmentsBetweenPoints;
            smoothed.push(getCatmullRomPoint(t, p0, p1, p2, p3));
        }
    }
    return smoothed;
}

/**
 * Calculates the bearing from point 1 to point 2.
 * @param {L.LatLng} point1LatLng - The starting L.LatLng point.
 * @param {L.LatLng} point2LatLng - The ending L.LatLng point.
 * @returns {number} Bearing in degrees from North (0-360).
 */
function calculateBearing(point1LatLng, point2LatLng) {
    const lat1 = toRad(point1LatLng.lat);
    const lon1 = toRad(point1LatLng.lng);
    const lat2 = toRad(point2LatLng.lat);
    const lon2 = toRad(point2LatLng.lng);
    const dLon = lon2 - lon1;

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    let brng = Math.atan2(y, x) * 180 / Math.PI;

    return (brng + 360) % 360; 
}

/**
 * Calculates a destination point given a starting point, bearing, and distance.
 * @param {L.LatLng} startLatLng - The starting L.LatLng point.
 * @param {number} bearingDeg - Bearing in degrees from North.
 * @param {number} distanceMeters - Distance in meters.
 * @returns {L.LatLng} The destination L.LatLng point.
 */
function destinationPoint(startLatLng, bearingDeg, distanceMeters) {
    const R = R_EARTH; 
    const angularDistance = distanceMeters / R; 
    const bearingRad = toRad(bearingDeg);

    const lat1 = toRad(startLatLng.lat);
    const lon1 = toRad(startLatLng.lng);

    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angularDistance) +
                           Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRad));

    let lon2 = lon1 + Math.atan2(Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1),
                                 Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2));

    lon2 = (lon2 * 180 / Math.PI + 540) % 360 - 180;

    return L.latLng(lat2 * 180 / Math.PI, lon2);
}

/**
 * Calculates the required gimbal pitch angle to aim at a target from an observer's position.
 * @param {number} observerAMSL - AMSL altitude of the observer (e.g., waypoint).
 * @param {number} targetAMSL - AMSL altitude of the target (e.g., POI).
 * @param {number} horizontalDistance - Horizontal distance between observer and target in meters.
 * @returns {number} Gimbal pitch angle in degrees. Negative for looking down, positive for up. Clamped to [-90, 60].
 */
function calculateRequiredGimbalPitch(observerAMSL, targetAMSL, horizontalDistance) {
    if (horizontalDistance <= 0.1) { // Avoid division by zero or very small distances
        if (targetAMSL < observerAMSL) return -90; 
        if (targetAMSL > observerAMSL) return 60;  
        return 0;
    }

    const deltaAltitude = targetAMSL - observerAMSL;

    let pitchAngleRad = Math.atan2(deltaAltitude, horizontalDistance);
    let pitchAngleDeg = pitchAngleRad * (180 / Math.PI);

    pitchAngleDeg = Math.max(-90, Math.min(60, pitchAngleDeg));
    
    return Math.round(pitchAngleDeg);
}
