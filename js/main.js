// main.js
import { initializeMap } from './map.js';
import { cacheDOMElements, setupEventListeners, updateWaypointList, updatePOIList, updateFlightStatistics, updateMultiEditPanelVisibility } from './ui.js';

function initApp() {
    cacheDOMElements();
    initializeMap();
    setupEventListeners();
    updateWaypointList();
    updatePOIList();
    updateFlightStatistics();
    updateMultiEditPanelVisibility();
}

document.addEventListener('DOMContentLoaded', initApp);