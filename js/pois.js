// pois.js
import { updatePOIList, updateFlightStatistics, updateWaypointList, showCustomAlert } from './ui.js';
import { getMap } from './map.js';
import { getSelectedWaypoint, getWaypoints } from './waypoints.js';

let pois = [];
let poiCounter = 1;

export function addPOI(latlng) {
    if (pois.length === 0) {
        poiCounter = 1;
    }
    const poiNameInput = document.getElementById('poiName');
    const name = poiNameInput.value.trim() || `POI ${poiCounter}`;
    const poi = {
        id: poiCounter++,
        name,
        latlng: L.latLng(latlng.lat, latlng.lng),
        altitude: 0
    };
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
    pois.push(poi);
    updatePOIList();
    const selectedWaypoint = getSelectedWaypoint();
    if (selectedWaypoint && document.getElementById('headingControl').value === 'poi_track') {
        populatePoiSelectDropdown(document.getElementById('targetPoiSelect'), selectedWaypoint.targetPoiId, true, '-- Select POI for Heading --');
    }
    if (document.getElementById('multiWaypointEditControls').style.display === 'block' && document.getElementById('multiHeadingControl').value === 'poi_track') {
        populatePoiSelectDropdown(document.getElementById('multiTargetPoiSelect'), null, true, '-- Select POI for all --');
    }
    updateFlightStatistics();
    poiNameInput.value = '';
}

export function deletePOI(poiId) {
    const poiIndex = pois.findIndex(p => p.id === poiId);
    if (poiIndex > -1) {
        getMap().removeLayer(pois[poiIndex].marker);
        const deletedPoiId = pois[poiIndex].id;
        pois.splice(poiIndex, 1);
        updatePOIList();
        updateFlightStatistics();
        getWaypoints().forEach(wp => {
            if (wp.targetPoiId === deletedPoiId) {
                wp.targetPoiId = null;
                if (getSelectedWaypoint() && getSelectedWaypoint().id === wp.id) {
                    document.getElementById('targetPoiForHeadingGroup').style.display = 'none';
                    populatePoiSelectDropdown(document.getElementById('targetPoiSelect'), null, true, '-- Select POI for Heading --');
                }
            }
        });
        const selectedWaypoint = getSelectedWaypoint();
        if (selectedWaypoint && document.getElementById('headingControl').value === 'poi_track') {
            populatePoiSelectDropdown(document.getElementById('targetPoiSelect'), selectedWaypoint.targetPoiId, true, '-- Select POI for Heading --');
        }
        if (document.getElementById('multiWaypointEditControls').style.display === 'block' && document.getElementById('multiHeadingControl').value === 'poi_track') {
            populatePoiSelectDropdown(document.getElementById('multiTargetPoiSelect'), null, true, '-- Select POI for all --');
        }
        updateWaypointList();
    }
}

export function populatePoiSelectDropdown(selectElement, selectedPoiId = null, addDefaultOption = true, defaultOptionText = '-- Select POI --') {
    selectElement.innerHTML = '';
    if (addDefaultOption) {
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = defaultOptionText;
        selectElement.appendChild(defaultOpt);
    }
    if (pois.length === 0) {
        selectElement.disabled = true;
        if (addDefaultOption && selectElement.options[0]) selectElement.options[0].textContent = 'No POIs available';
        return;
    }
    selectElement.disabled = false;
    if (addDefaultOption && selectElement.options[0] && selectElement.options[0].textContent === 'No POIs available') {
        selectElement.options[0].textContent = defaultOptionText;
    }
    pois.forEach(poi => {
        const option = document.createElement('option');
        option.value = poi.id;
        option.textContent = `${poi.name} (ID: ${poi.id})`;
        if (selectedPoiId != null && poi.id === parseInt(selectedPoiId)) {
            option.selected = true;
        }
        selectElement.appendChild(option);
    });
}

export function getPois() {
    return pois;
}

export function getPoiCounter() {
    return poiCounter;
}

export function setPoiCounter(value) {
    poiCounter = value;
}