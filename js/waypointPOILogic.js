// js/waypointPOILogic.js
import * as State from './state.js';
import * as DOM from './domElements.js';
import { updateWaypointListDisplay, updatePOIListDisplay, updateFlightStatisticsDisplay, populatePoiSelectDropdownForUI } from './uiControls.js';
import { updateFlightPathDisplay } from './mapLogic.js';
import { showCustomAlert, _tr } from './utils.js';

export function createWaypointIcon(id, isSelectedSingle, isMultiSelected = false) {
    let bgColor = '#3498db'; 
    let zIndexOffset = 0;
    let scaleFactor = 1.0; 
    let borderStyle = '2px solid white';
    let classNameSuffix = '';

    if (isSelectedSingle) { 
        bgColor = '#e74c3c'; 
        zIndexOffset = 1000;  
        scaleFactor = 1.2;   
        classNameSuffix = 'selected-single';
        if (isMultiSelected) { 
            borderStyle = '3px solid #f39c12'; 
        }
    } else if (isMultiSelected) { 
        bgColor = '#f39c12'; 
        zIndexOffset = 500;   
        scaleFactor = 1.1;   
        borderStyle = '2px solid #ffeb3b'; 
        classNameSuffix = 'selected-multi';
    }

    const size = 24 * scaleFactor;
    const fontSize = 12 * scaleFactor;

    return L.divIcon({
        className: `waypoint-marker ${classNameSuffix}`,
        html: `<div style="background: ${bgColor}; color: white; border-radius: 50%; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; font-size: ${fontSize.toFixed(0)}px; font-weight: bold; border: ${borderStyle}; box-shadow: 0 2px 4px rgba(0,0,0,0.3); transform: scale(1); transition: all 0.1s ease-out;">${id}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2]
    });
}

export function updateMarkerIcon(waypoint) {
    if (waypoint && waypoint.marker) {
        const isSelectedSingle = State.getSelectedWaypoint() && State.getSelectedWaypoint().id === waypoint.id;
        const isMultiSelected = State.selectedForMultiEdit.has(waypoint.id);
        waypoint.marker.setIcon(createWaypointIcon(waypoint.id, isSelectedSingle, isMultiSelected));
        
        let zOffset = 0;
        if (isSelectedSingle) {
            zOffset = 1000;
        } else if (isMultiSelected) {
            zOffset = 500;
        }
        waypoint.marker.setZIndexOffset(zOffset);
    }
}


export function addWaypoint(latlng) {
    const newWaypointData = {
        id: State.waypointCounter++,
        latlng: L.latLng(latlng.lat, latlng.lng),
        altitude: parseInt(DOM.defaultAltitudeSlider.value),
        hoverTime: 0, 
        gimbalPitch: parseInt(DOM.gimbalPitchSlider.value),
        headingControl: 'auto', 
        fixedHeading: 0,
        cameraAction: 'none',
        targetPoiId: null
    };
    const marker = L.marker(newWaypointData.latlng, { draggable: true, icon: createWaypointIcon(newWaypointData.id, false, false) }).addTo(State.getMap());
    
    newWaypointData.marker = marker; // Associa il marker all'oggetto waypoint

    marker.on('click', e => { L.DomEvent.stopPropagation(e); selectWaypoint(newWaypointData); });
    marker.on('dragend', () => {
        newWaypointData.latlng = marker.getLatLng();
        updateFlightPathDisplay(); updateFlightStatisticsDisplay(); updateWaypointListDisplay();
    });
    marker.on('drag', () => { newWaypointData.latlng = marker.getLatLng(); updateFlightPathDisplay(); });
    
    State.addWaypointToArray(newWaypointData);
    updateWaypointListDisplay(); 
    updateFlightPathDisplay(); 
    updateFlightStatisticsDisplay(); 
    selectWaypoint(newWaypointData);
}

export function addPOI(latlng) { 
    if (State.getPois().length === 0) {
        State.poiCounter = 1; 
    }
    const name = DOM.poiNameInput.value.trim() || `POI ${State.poiCounter}`;
    const newPoiData = { 
        id: State.poiCounter++, 
        name, 
        latlng: L.latLng(latlng.lat, latlng.lng), 
        altitude: 0 
    }; 
    const marker = L.marker(newPoiData.latlng, { draggable: true, icon: L.divIcon({ className: 'poi-marker', html: `<div style="background: #f39c12; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; border: 2px solid white;">🎯</div>`, iconSize: [20, 20], iconAnchor: [10, 10] }) }).addTo(State.getMap());
    marker.bindPopup(`<strong>${newPoiData.name}</strong>`);
    marker.on('dragend', () => newPoiData.latlng = marker.getLatLng());
    newPoiData.marker = marker;
    State.addPoiToArray(newPoiData);

    updatePOIListDisplay(); 
    populatePoiSelectDropdownForUI(DOM.targetPoiSelect, State.getSelectedWaypoint() ? State.getSelectedWaypoint().targetPoiId : null, true, _tr("selectPoiDropdownDefault", "Select POI for Heading"));
    populatePoiSelectDropdownForUI(DOM.multiTargetPoiSelect, null, true, _tr("selectPoiDropdownDefault", "Select POI for all"));
    populatePoiSelectDropdownForUI(DOM.orbitPoiSelectEl, null, false);


    updateFlightStatisticsDisplay(); 
    DOM.poiNameInput.value = '';
}

export function selectWaypoint(waypoint) { 
    // clearMultiSelection(); // Chiamata da uiControls se necessario

    if (State.getSelectedWaypoint() && State.getSelectedWaypoint().marker) {
        updateMarkerIcon(State.getSelectedWaypoint()); // Aggiorna icona del precedente
    }
    State.setSelectedWaypoint(waypoint);
    if (State.getSelectedWaypoint() && State.getSelectedWaypoint().marker) {
       updateMarkerIcon(State.getSelectedWaypoint()); // Aggiorna icona del nuovo
    }
    
    DOM.waypointAltitudeSlider.value = State.getSelectedWaypoint().altitude;
    DOM.waypointAltitudeValueEl.textContent = State.getSelectedWaypoint().altitude + 'm';
    DOM.hoverTimeSlider.value = State.getSelectedWaypoint().hoverTime;
    DOM.hoverTimeValueEl.textContent = State.getSelectedWaypoint().hoverTime + 's';
    DOM.gimbalPitchSlider.value = State.getSelectedWaypoint().gimbalPitch;
    DOM.gimbalPitchValueEl.textContent = State.getSelectedWaypoint().gimbalPitch + '°';
    DOM.headingControlSelect.value = State.getSelectedWaypoint().headingControl;
    DOM.fixedHeadingSlider.value = State.getSelectedWaypoint().fixedHeading;
    DOM.fixedHeadingValueEl.textContent = State.getSelectedWaypoint().fixedHeading + '°';
    DOM.cameraActionSelect.value = State.getSelectedWaypoint().cameraAction || 'none'; 
    
    DOM.fixedHeadingGroupDiv.style.display = State.getSelectedWaypoint().headingControl === 'fixed' ? 'block' : 'none';
    const showPoiSelect = State.getSelectedWaypoint().headingControl === 'poi_track';
    DOM.targetPoiForHeadingGroupDiv.style.display = showPoiSelect ? 'block' : 'none';
    if (showPoiSelect) {
        populatePoiSelectDropdownForUI(DOM.targetPoiSelect, State.getSelectedWaypoint().targetPoiId, true, _tr("selectPoiDropdownDefault", "Select POI for Heading"));
    }

    DOM.waypointControlsDiv.style.display = 'block';
    updateWaypointListDisplay(); 
    if(State.getSelectedWaypoint().marker) State.getMap().panTo(State.getSelectedWaypoint().latlng);
}

export function deleteSelectedWaypointLogic() { 
    if (!State.getSelectedWaypoint()) {
        showCustomAlert(_tr("alertNoWpSelected"), _tr("alertInfo"));
        return;
    }
    if (State.getSelectedWaypoint().marker) {
        State.getMap().removeLayer(State.getSelectedWaypoint().marker);
    }
    const deletedWaypointId = State.getSelectedWaypoint().id;
    State.setWaypoints(State.getWaypoints().filter(wp => wp.id !== deletedWaypointId));
    State.setSelectedWaypoint(null);
    DOM.waypointControlsDiv.style.display = 'none';

    if (State.selectedForMultiEdit.has(deletedWaypointId)) {
        State.selectedForMultiEdit.delete(deletedWaypointId);
        // updateMultiEditPanelVisibility(); // Sarà chiamata da updateWaypointList se necessario
    }
    updateWaypointListDisplay(); 
    updateFlightPathDisplay(); 
    updateFlightStatisticsDisplay();
    showCustomAlert(_tr("alertWpDeleted"), _tr("alertSuccess"));
}

export function clearAllWaypointsLogic() { 
    State.getWaypoints().forEach(wp => {
        if (wp.marker) State.getMap().removeLayer(wp.marker);
    });
    State.setWaypoints([]); 
    State.setSelectedWaypoint(null); 
    State.waypointCounter = 1;
    State.actionGroupCounter = 1; 
    State.actionCounter = 1;
    
    if (DOM.waypointControlsDiv) DOM.waypointControlsDiv.style.display = 'none';
    // clearMultiSelection(); // Chiamato da uiControls
    updateWaypointListDisplay(); 
    updateFlightPathDisplay(); 
    updateFlightStatisticsDisplay();
}

export function deletePoiLogic(poiId) { 
    const poisArray = State.getPois();
    const poiIndex = poisArray.findIndex(p => p.id === poiId);
    if (poiIndex > -1) {
        if(poisArray[poiIndex].marker) State.getMap().removeLayer(poisArray[poiIndex].marker);
        const deletedPoiId = poisArray[poiIndex].id; 
        poisArray.splice(poiIndex, 1); // Modifica l'array direttamente
        
        updatePOIListDisplay(); 
        updateFlightStatisticsDisplay();
        
        State.getWaypoints().forEach(wp => {
            if (wp.targetPoiId === deletedPoiId) { 
                wp.targetPoiId = null;
                if (State.getSelectedWaypoint() && State.getSelectedWaypoint().id === wp.id) {
                   DOM.targetPoiForHeadingGroupDiv.style.display = 'none'; 
                   populatePoiSelectDropdownForUI(DOM.targetPoiSelect, null, true, _tr("selectPoiDropdownDefault", "Select POI for Heading"));
                }
            }
        });
        // Aggiorna i select dei POI
        populatePoiSelectDropdownForUI(DOM.targetPoiSelect, State.getSelectedWaypoint() ? State.getSelectedWaypoint().targetPoiId : null, true, _tr("selectPoiDropdownDefault", "Select POI for Heading"));
        populatePoiSelectDropdownForUI(DOM.multiTargetPoiSelect, null, true, _tr("selectPoiDropdownDefault", "Select POI for all"));
        populatePoiSelectDropdownForUI(DOM.orbitPoiSelectEl, null, false);

        updateWaypointListDisplay();
    }
}


export function handlePathClick(e) { // Logica per inserire waypoint cliccando sul percorso
    const clickedLatLng = e.latlng; 
    const currentWaypoints = State.getWaypoints();
    if (currentWaypoints.length < 2) return;

    let closestSegmentIndex = -1;
    let minDistanceToSegmentLine = Infinity;

    for (let i = 0; i < currentWaypoints.length - 1; i++) {
        const p1 = currentWaypoints[i].latlng;
        const p2 = currentWaypoints[i+1].latlng;
        const midPoint = L.latLng((p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2);
        const distToMid = clickedLatLng.distanceTo(midPoint);

        if (distToMid < minDistanceToSegmentLine) {
            minDistanceToSegmentLine = distToMid;
            closestSegmentIndex = i;
        }
    }

    if (closestSegmentIndex !== -1) {
        const alt1 = currentWaypoints[closestSegmentIndex].altitude;
        const alt2 = currentWaypoints[closestSegmentIndex + 1].altitude;
        let newWpAltitude = alt1; 
        const distToP1 = clickedLatLng.distanceTo(currentWaypoints[closestSegmentIndex].latlng);
        const segmentLength = currentWaypoints[closestSegmentIndex].latlng.distanceTo(currentWaypoints[closestSegmentIndex+1].latlng);
        if (segmentLength > 0) {
            const ratio = distToP1 / segmentLength;
            newWpAltitude = alt1 + (alt2 - alt1) * ratio;
        }
         newWpAltitude = Math.round(Math.max(5, newWpAltitude));

        const newWaypointData = {
            id: State.waypointCounter++,
            latlng: clickedLatLng, // Usiamo il punto cliccato sulla linea
            altitude: newWpAltitude,
            hoverTime: 0,
            gimbalPitch: parseInt(DOM.gimbalPitchSlider.value),
            headingControl: 'auto',
            fixedHeading: 0,
            cameraAction: 'none',
            targetPoiId: null
        };

        currentWaypoints.splice(closestSegmentIndex + 1, 0, newWaypointData);

        const marker = L.marker(newWaypointData.latlng, { 
            draggable: true, 
            icon: createWaypointIcon(newWaypointData.id, false, false) 
        }).addTo(State.getMap());
        marker.on('click', ev => { L.DomEvent.stopPropagation(ev); selectWaypoint(newWaypointData); });
        marker.on('dragend', () => { 
            newWaypointData.latlng = marker.getLatLng(); 
            updateFlightPathDisplay(); updateFlightStatisticsDisplay(); updateWaypointListDisplay(); 
        });
        marker.on('drag', () => { newWaypointData.latlng = marker.getLatLng(); updateFlightPathDisplay(); });
        newWaypointData.marker = marker;
        
        updateWaypointListDisplay();
        updateFlightPathDisplay(); 
        updateFlightStatisticsDisplay();
        selectWaypoint(newWaypointData); 
        showCustomAlert(_tr("alertWpInserted", newWaypointData.id), _tr("alertInfo"));
    }
}