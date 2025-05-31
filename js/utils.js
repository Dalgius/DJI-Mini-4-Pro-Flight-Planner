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
 * @param {{lat: number, lng: number} | [number, number]} coords1 - First coordinate (lat, lng).
 * @param {{lat: number, lng: number} | [number, number]} coords2 - Second coordinate (lat, lng).
 * @returns {number} Distance in meters.
 */
function haversineDistance(coords1, coords2) {
    const lat1 = coords1.lat || coords1[0];
    const lon1 = coords1.lng || coords1[1];
    const lat2 = coords2.lat || coords2[0];
    const lon2 = coords2.lng || coords2[1];

    const R = R_EARTH; // Radius of Earth in meters from config.js
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

    // Catmull-Rom tension parameter (typically 0.5 for centripetal Catmull-Rom)
    // For standard Catmull-Rom, alpha = 0.5.
    // Coefficients for P0, P1, P2, P3
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
    if (points.length === 2) return [points[0], points[1]]; // Straight line for 2 points

    const smoothed = [];
    const numSegmentsBetweenPoints = 15; // Number of interpolated points between original waypoints

    // Add the first point
    smoothed.push(points[0]);

    for (let i = 0; i < points.length - 1; i++) {
        // Determine control points p0, p1, p2, p3
        const p0 = (i === 0) ? points[0] : points[i - 1];         // Previous point or first point itself
        const p1 = points[i];                                     // Current point (start of segment)
        const p2 = points[i + 1];                                 // Next point (end of segment)
        const p3 = (i === points.length - 2) ? points[points.length - 1] : points[i + 2]; // Point after next or last point itself

        for (let j = 1; j <= numSegmentsBetweenPoints; j++) {
            const t = j / numSegmentsBetweenPoints;
            smoothed.push(getCatmullRomPoint(t, p0, p1, p2, p3));
        }
    }
    // The loop structure ensures the last point (points[points.length-1]) is effectively p2 when i = points.length-2,
    // and getCatmullRomPoint(1, ..., p2, p3) should yield p2.
    // To be absolutely sure the last original point is included if it's not perfectly hit by t=1:
    // if (smoothed.length === 0 || smoothed[smoothed.length - 1][0] !== points[points.length - 1][0] || smoothed[smoothed.length - 1][1] !== points[points.length - 1][1]) {
    //     smoothed.push(points[points.length-1]);
    // }
    // However, the standard way this interpolation is done, the last point of the segment (p2) is reached when t=1 for that segment.

    return smoothed;
}

/**
 * Gets the display text for a camera action code.
 * @param {string} action - The camera action code (e.g., 'takePhoto').
 * @returns {string} The display text (e.g., 'Photo').
 */
function getCameraActionText(action) {
    switch (action) {
        case 'takePhoto': return 'Photo';
        case 'startRecord': return 'Rec Start';
        case 'stopRecord': return 'Rec Stop';
        default: return ''; // Or 'None' if preferred
    }
}