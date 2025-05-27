import * as DOM from './domElements.js';
import * as State from './state.js';
import { updateWaypointListDisplay, updatePOIListDisplay, updateFlightStatisticsDisplay } from './uiControls.js';
import { updateFlightPathDisplay, fitMapToWaypoints as fitMap } from './mapLogic.js';
import { selectWaypoint as selectWp, clearAllWaypointsLogic, addWaypoint as addWpFromFile, addPOI as addPoiFromFile, createWaypointIcon as createWpIconInternal } from './waypointPOILogic.js'; // Importa le funzioni logiche
import { showCustomAlert, getCameraActionText as utilGetCameraActionText, haversineDistance } from './utils.js'; // Importa haversineDistance
import { _tr } from './i18n.js';

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
            loadFlightPlanData(importedPlan); 
        }
        catch (err) { showCustomAlert(_tr("alertImportError", err.message), _tr("alertError", "Import Error")); }
    };
    reader.readAsText(file);
    if(event.target) event.target.value = null; 
}

export function loadFlightPlanData(plan) { 
    clearAllWaypointsLogic(); 
    State.getPois().forEach(p => { if(p.marker && State.getMap()) State.getMap().removeLayer(p.marker); });
    State.setPois([]); 
    State.poiCounter = 1;

    if (plan.settings) {
        DOM.defaultAltitudeSlider.value = plan.settings.defaultAltitude || 30;
        DOM.defaultAltitudeValueEl.textContent = DOM.defaultAltitudeSlider.value + 'm';
        DOM.flightSpeedSlider.value = plan.settings.flightSpeed || 8;
        DOM.flightSpeedValueEl.textContent = DOM.flightSpeedSlider.value + ' m/s';
        DOM.pathTypeSelect.value = plan.settings.pathType || 'straight';
        State.waypointCounter = plan.settings.nextWaypointId || 1;
        State.poiCounter = plan.settings.nextPoiId || 1;
    }

    if (plan.pois) {
        plan.pois.forEach(pData => {
            addPoiFromFile(L.latLng(pData.lat, pData.lng), pData.name, pData.id, pData.altitude);
        });
    }
    if (plan.waypoints) {
        plan.waypoints.forEach(wpData => {
            addWpFromFile(L.latLng(wpData.lat, wpData.lng), wpData);
        });
    }
    
    // Ritarda leggermente gli aggiornamenti UI per dare tempo agli import dinamici (non ideale)
    // È meglio se le funzioni di aggiunta chiamano direttamente gli update UI necessari.
    // Per ora, questo timeout potrebbe essere rimosso se gli update sono già chiamati internamente.
    setTimeout(() => {
        updatePOIListDisplay(); 
        updateWaypointListDisplay(); 
        updateFlightPathDisplay(); 
        updateFlightStatisticsDisplay(); 
        fitMap();
        if (State.getWaypoints().length > 0) selectWp(State.getWaypoints()[0]);
        showCustomAlert(_tr("alertImportSuccess"), _tr("alertSuccess"));
    }, 100); // Ridotto il timeout, potrebbe non essere necessario
}

export function exportFlightPlan() { 
