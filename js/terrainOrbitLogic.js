// Existing imports
import { showCustomAlert } from './utils.js';
import { _tr } from './i18n.js';
import * as State from './state.js';
import * as DOM from './domElements.js';

// New function implementation
export default function adaptAltitudesToAGL(altitudesInMSL, terrainData) {
    if (State.getWaypoints().length === 0) {
        showCustomAlert(_tr("alertNoWaypointForAGL", "Add waypoints to adapt altitudes to AGL."), _tr("alertInfo"));
        return;
    }

    // Show loading overlay
    DOM.loadingOverlayEl.style.display = 'flex';

    // Gather waypoints
    const waypoints = State.getWaypoints();
    const locationsArray = waypoints.map(wp => ({ lat: wp.latlng.lat, lng: wp.latlng.lng }));

    try {
        // Get elevations for waypoints
        const elevations = await getElevationsBatch(locationsArray);

        // Adjust waypoint altitudes to AGL
        elevations.forEach((elevation, index) => {
            if (elevation !== null) {
                waypoints[index].altitude = Math.max(0, waypoints[index].altitude - elevation);
            }
        });

        showCustomAlert(_tr("alertAltitudesAdaptedToAGL", "Waypoint altitudes adjusted to AGL."), _tr("alertSuccess"));
    } catch (error) {
        console.error("Error adapting altitudes to AGL:", error);
        showCustomAlert(_tr("alertFetchError"), _tr("alertError"));
    } finally {
        // Hide loading overlay
        DOM.loadingOverlayEl.style.display = 'none';
    }
}
