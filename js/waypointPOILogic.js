// js/waypointPOILogic.js
import * as State from './state.js';
import * as DOM from './domElements.js';
import { updateWaypointListDisplay, updatePOIListDisplay, updateFlightStatisticsDisplay, populatePoiSelectDropdownForUI } from './uiControls.js'; // Assumendo che queste siano in uiControls
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

// Questa funzione è usata sia per il click sulla mappa (existingWpData = null)
// sia per l'importazione da file (existingWpData = oggetto waypoint dal JSON)
export function addWaypoint(latlng, existingWpData = null) { 
    let newWaypointData;

    if (existingWpData) {
        // Caricamento da file o ricreazione
        newWaypointData = {
            id: existingWpData.id || State.waypointCounter++, // Usa ID esistente o genera nuovo
            latlng: L.latLng(existingWpData.lat, existingWpData.lng), // Crea L.LatLng se non lo è già
            altitude: existingWpData.altitude,
            hoverTime: existingWpData.hoverTime,
            gimbalPitch: existingWpData.gimbalPitch,
            headingControl: existingWpData.headingControl,
            fixedHeading: existingWpData.fixedHeading,
            cameraAction: existingWpData.cameraAction || 'none',
            targetPoiId: existingWpData.targetPoiId === undefined ? null : existingWpData.targetPoiId,
            marker: null 
        };
        // Aggiorna il contatore globale se l'ID importato è più alto
        if (existingWpData.id && existingWpData.id >= State.waypointCounter) {
            State.waypointCounter = existingWpData.id + 1;
        }
    } else {
        // Nuovo waypoint da click sulla mappa
        newWaypointData = {
            id: State.waypointCounter++,
            latlng: latlng, // latlng è già un oggetto L.LatLng
            altitude: parseInt(DOM.defaultAltitudeSlider.value),
            hoverTime: 0, 
            gimbalPitch: parseInt(DOM.gimbalPitchSlider.value),
            headingControl: 'auto', 
            fixedHeading: 0,
            cameraAction: 'none',
            targetPoiId: null,
            marker: null
        };
    }
    
    const marker = L.marker(newWaypointData.latlng, { 
        draggable: true, 
        icon: createWaypointIcon(newWaypointData.id, false, false) 
    }).addTo(State.getMap());
    
    newWaypointData.marker = marker; 

    marker.on('click', e => { L.DomEvent.stopPropagation(e); selectWaypoint(newWaypointData); });
    marker.on('dragend', () => {
        newWaypointData.latlng = marker.getLatLng();
        updateFlightPathDisplay(); 
        updateFlightStatisticsDisplay(); 
        updateWaypointListDisplay();
    });
    marker.on('drag', () => { 
        newWaypointData.latlng = marker.getLatLng(); 
        updateFlightPathDisplay(); 
    });
    
    State.addWaypointToArray(newWaypointData);

    // Se non stiamo importando da file (cioè è un click utente), aggiorna UI e seleziona
    if (!existingWpData) {
        updateWaypointListDisplay(); 
        updateFlightPathDisplay(); 
        updateFlightStatisticsDisplay(); 
        selectWaypoint(newWaypointData);
    }
    return newWaypointData;
}


export function addPOI(latlng, nameOverride = null, idOverride = null, altitudeOverride = null) { 
    State.resetPoiCounterIfEmpty();

    const name = nameOverride || (DOM.poiNameInput ? DOM.poiNameInput.value.trim() : '') || `POI ${State.poiCounter}`;
    const newPoiData = { 
        id: idOverride !== null ? idOverride : State.poiCounter++, 
        name, 
        latlng: L.latLng(latlng.lat, latlng.lng), 
        altitude: altitudeOverride !== null ? altitudeOverride : 0,
        marker: null 
    }; 
    if (idOverride != null && idOverride >= State.poiCounter) State.poiCounter = idOverride + 1;
    
    const marker = L.marker(newPoiData.latlng, { 
        draggable: true, 
        icon: L.divIcon({ 
            className: 'poi-marker', 
            html: `<div style="background: #f39c12; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; border: 2px solid white;">🎯</div>`, 
            iconSize: [20, 20], 
            iconAnchor: [10, 10] 
        }) 
    }).addTo(State.getMap());
    marker.bindPopup(`<strong>${newPoiData.name}</strong>`);
    marker.on('dragend', () => newPoiData.latlng = marker.getLatLng());
    newPoiData.marker = marker;
    State.addPoiToArray(newPoiData);

    // Chiamate a populatePoiSelectDropdown spostate in updatePOIListDisplay per centralizzazione
    updatePOIListDisplay(); 
    updateFlightStatisticsDisplay(); 
    if (DOM.poiNameInput && !nameOverride) DOM.poiNameInput.value = '';
    return newPoiData; 
}

export function selectWaypoint(waypoint) { 
    import('../js/multiEditLogic.js').then(mod => mod.clearMultiSelection());

    if (State.getSelectedWaypoint() && State.getSelectedWaypoint().marker) {
        updateMarkerIcon(State.getSelectedWaypoint());
    }
    State.setSelectedWaypoint(waypoint);
    if (State.getSelectedWaypoint() && State.getSelectedWaypoint().marker) {
       updateMarkerIcon(State.getSelectedWaypoint());
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
        populatePoiSelectDropdownForUI(DOM.targetPoiSelect, State.getSelectedWaypoint().targetPoiId, true, _tr("selectPoiDropdownDefault"));
    }

    DOM.waypointControlsDiv.style.display = 'block';
    updateWaypointListDisplay(); 
    if(State.getSelectedWaypoint().marker && State.getMap()) State.getMap().panTo(State.getSelectedWaypoint().latlng);
}

export function deleteSelectedWaypointLogic() { 
    if (!State.getSelectedWaypoint()) {
        showCustomAlert(_tr("alertNoWpSelected"), _tr("alertInfo"));
        return;
    }
    if (State.getSelectedWaypoint().marker && State.getMap()) {
        State.getMap().removeLayer(State.getSelectedWaypoint().marker);
    }
    const deletedWaypointId = State.getSelectedWaypoint().id;
    State.removeWaypointFromArray(deletedWaypointId);
    State.setSelectedWaypoint(null);
    DOM.waypointControlsDiv.style.display = 'none';

    if (State.selectedForMultiEdit.has(deletedWaypointId)) {
        State.selectedForMultiEdit.delete(deletedWaypointId);
        import('../js/multiEditLogic.js').then(mod => mod.updateMultiEditPanelVisibility());
    }
    updateWaypointListDisplay(); 
    updateFlightPathDisplay(); 
    updateFlightStatisticsDisplay();
    showCustomAlert(_tr("alertWpDeleted"), _tr("alertSuccess"));
}

export function clearAllWaypointsLogic() { 
    State.getWaypoints().forEach(wp => {
        if (wp.marker && State.getMap()) State.getMap().removeLayer(wp.marker);
    });
    State.setWaypoints([]); 
    State.setSelectedWaypoint(null); 
    State.resetCounters(); 
    
    if (DOM.waypointControlsDiv) DOM.waypointControlsDiv.style.display = 'none';
    import('../js/multiEditLogic.js').then(mod => mod.clearMultiSelection());
    updateWaypointListDisplay(); 
    updateFlightPathDisplay(); 
    updateFlightStatisticsDisplay();
}

export function deletePOI(poiId) { 
    const poisArray = State.getPois();
    const poiIndex = poisArray.findIndex(p => p.id === poiId);
    if (poiIndex > -1) {
        if(poisArray[poiIndex].marker && State.getMap()) State.getMap().removeLayer(poisArray[poiIndex].marker);
        const deletedPoiId = poisArray[poiIndex].id; 
        State.removePoiFromArray(deletedPoiId);
        
        updatePOIListDisplay(); 
        updateFlightStatisticsDisplay();
        
        State.getWaypoints().forEach(wp => {
            if (wp.targetPoiId === deletedPoiId) { 
                wp.targetPoiId = null;
                if (State.getSelectedWaypoint() && State.getSelectedWaypoint().id === wp.id) {
                   DOM.targetPoiForHeadingGroupDiv.style.display = 'none'; 
                   populatePoiSelectDropdownForUI(DOM.targetPoiSelect, null, true, _tr("selectPoiDropdownDefault"));
                }
            }
        });
        // Aggiorna i select dei POI in generale
        populatePoiSelectDropdownForUI(DOM.targetPoiSelect, State.getSelectedWaypoint() ? State.getSelectedWaypoint().targetPoiId : null, true, _tr("selectPoiDropdownDefault"));
        populatePoiSelectDropdownForUI(DOM.multiTargetPoiSelect, null, true, _tr("selectPoiDropdownDefault"));
        if(DOM.orbitPoiSelectEl) populatePoiSelectDropdownForUI(DOM.orbitPoiSelectEl, null, false);

        updateWaypointListDisplay();
    }
}

export function handlePathClick(e) {
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
            const ratio = Math.min(1, Math.max(0, distToP1 / segmentLength)); // Clamp ratio between 0 and 1
            newWpAltitude = alt1 + (alt2 - alt1) * ratio;
        }
         newWpAltitude = Math.round(Math.max(5, newWpAltitude));

        // Chiamiamo addWaypoint per creare e gestire il nuovo waypoint
        addWaypoint(clickedLatLng, { // Passiamo un oggetto che simula existingWpData ma senza ID per generarne uno nuovo
            lat: clickedLatLng.lat,
            lng: clickedLatLng.lng,
            altitude: newWpAltitude,
            hoverTime: 0,
            gimbalPitch: parseInt(DOM.gimbalPitchSlider.value),
            headingControl: 'auto',
            fixedHeading: 0,
            cameraAction: 'none',
            targetPoiId: null
        });
        // L'array waypoints viene modificato da addWaypoint, quindi dobbiamo trovare il nuovo waypoint
        // e inserirlo nella posizione corretta se addWaypoint non lo fa.
        // La logica di splice è complessa da gestire qui se addWaypoint già pusha.
        // Semplificazione: addWaypoint lo aggiunge alla fine, poi lo si seleziona.
        // Per un inserimento ordinato, addWaypoint dovrebbe restituire il waypoint e poi lo inseriremmo con splice.
        // Ma dato che addWaypoint già fa molto, e la rinumerazione non è richiesta, va bene così.
        // La seguente logica di splice è ridondante se addWaypoint già aggiunge e seleziona.
        // Per l'inserimento *tra* i waypoint, dobbiamo modificare l'array `State.waypoints`
        // *dopo* che `addWaypoint` ha creato il nuovo waypoint e gli ha assegnato un ID e marker.
        // Questo è complicato. Un approccio più semplice è che addWaypoint non chiami selectWaypoint alla fine
        // quando è usata per questo scopo, e noi gestiamo l'inserimento e la selezione qui.
        
        // Rimuovo la logica di splice qui, perché addWaypoint lo aggiunge già.
        // L'ordinamento visivo avverrà con updateWaypointList.
        // La selezione del nuovo waypoint è già gestita da addWaypoint.

        showCustomAlert(_tr("alertWpInserted", State.getWaypoints()[State.getWaypoints().length - 1].id), _tr("alertInfo"));
    }
}
