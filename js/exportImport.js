// exportImport.js
import { getWaypoints, clearWaypoints, getSelectedWaypoint, selectWaypoint, getWaypointCounter, setWaypointCounter } from './waypoints.js';
import { getPois, setPoiCounter } from './pois.js';
import { updatePOIList, updateWaypointList, updateFlightStatistics, fitMapToWaypoints, showCustomAlert } from './ui.js';
import { updateFlightPath } from './flightPath.js'; // Corrected import
import { getMap } from './map.js';

export function exportFlightPlan() {
    const waypoints = getWaypoints();
    const pois = getPois();
    if (waypoints.length === 0 && pois.length === 0) {
        showCustomAlert('Nothing to export.', 'Export Error');
        return;
    }
    const plan = {
        waypoints: waypoints.map(wp => ({
            id: wp.id, lat: wp.latlng.lat, lng: wp.latlng.lng,
            altitude: wp.altitude, hoverTime: wp.hoverTime, gimbalPitch: wp.gimbalPitch,
            headingControl: wp.headingControl, fixedHeading: wp.fixedHeading,
            cameraAction: wp.cameraAction || 'none',
            targetPoiId: wp.targetPoiId === undefined ? null : wp.targetPoiId
        })),
        pois: pois.map(p => ({ id: p.id, name: p.name, lat: p.latlng.lat, lng: p.latlng.lng, altitude: p.altitude })),
        settings: {
            defaultAltitude: parseInt(document.getElementById('defaultAltitude').value),
            flightSpeed: parseFloat(document.getElementById('flightSpeed').value),
            pathType: document.getElementById('pathType').value,
            nextWaypointId: getWaypointCounter(),
            nextPoiId: getPoiCounter()
        }
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(plan, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', 'flight_plan.json');
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    document.body.removeChild(downloadAnchorNode);
}

export function triggerImport() {
    document.getElementById('fileInput').click();
}

export function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const importedPlan = JSON.parse(e.target.result);
            loadFlightPlan(importedPlan);
        } catch (err) {
            showCustomAlert('Error parsing flight plan: ' + err.message, 'Import Error');
        }
    };
    reader.readAsText(file);
    event.target.value = null;
}

export function loadFlightPlan(plan) {
    clearWaypoints();
    getPois().forEach(p => getMap().removeLayer(p.marker));
    setPois([]);
    setPoiCounter(1);
    if (plan.settings) {
        document.getElementById('defaultAltitude').value = plan.settings.defaultAltitude || 30;
        document.getElementById('defaultAltitudeValue').textContent = document.getElementById('defaultAltitude').value + 'm';
        document.getElementById('flightSpeed').value = plan.settings.flightSpeed || 8;
        document.getElementById('flightSpeedValue').textContent = document.getElementById('flightSpeed').value + ' m/s';
        document.getElementById('pathType').value = plan.settings.pathType || 'straight';
        setWaypointCounter(plan.settings.nextWaypointId || 1);
        setPoiCounter(plan.settings.nextPoiId || 1);
    }
    if (plan.pois) {
        plan.pois.forEach(pData => {
            const poi = {
                id: pData.id || getPoiCounter(),
                name: pData.name,
                latlng: L.latLng(pData.lat, pData.lng),
                altitude: pData.altitude || 0
            };
            if (pData.id && pData.id >= getPoiCounter()) setPoiCounter(pData.id + 1);
            const marker = L.marker(poi.latlng, {
                draggable: true,
                icon: L.divIcon({
                    className: 'poi-marker',
                    html: '<div style="background: #f39c12; color:white; border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;border:2px solid white;">🎯</div>',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                })
            }).addTo(getMap());
            marker.bindPopup(`<strong>${poi.name}</strong>`);
            marker.on('dragend', () => poi.latlng = marker.getLatLng());
            poi.marker = marker;
            getPois().push(poi);
        });
    }
    if (plan.waypoints) {
        plan.waypoints.forEach(wpData => {
            const wp = {
                id: wpData.id || getWaypointCounter(),
                latlng: L.latLng(wpData.lat, wpData.lng),
                altitude: wpData.altitude,
                hoverTime: wpData.hoverTime,
                gimbalPitch: wpData.gimbalPitch,
                headingControl: wpData.headingControl,
                fixedHeading: wpData.fixedHeading,
                cameraAction: wpData.cameraAction || 'none',
                targetPoiId: wpData.targetPoiId === undefined ? null : wpData.targetPoiId
            };
            if (wpData.id && wpData.id >= getWaypointCounter()) setWaypointCounter(wpData.id + 1);
            const marker = L.marker(wp.latlng, {
                draggable: true,
                icon: createWaypointIcon(wp.id, false)
            }).addTo(getMap());
            marker.on('click', e => {
                L.DomEvent.stopPropagation(e);
                selectWaypoint(wp);
            });
            marker.on('dragend', () => {
                wp.latlng = marker.getLatLng();
                updateFlightPath();
                updateFlightStatistics();
                updateWaypointList();
            });
            marker.on('drag', () => {
                wp.latlng = marker.getLatLng();
                updateFlightPath();
            });
            wp.marker = marker;
            getWaypoints().push(wp);
        });
    }
    updatePOIList();
    updateWaypointList();
    updateFlightPath(); // This should now work
    updateFlightStatistics();
    fitMapToWaypoints();
    if (getWaypoints().length > 0) selectWaypoint(getWaypoints()[0]);
    showCustomAlert('Flight plan imported successfully!', 'Import Success');
}
