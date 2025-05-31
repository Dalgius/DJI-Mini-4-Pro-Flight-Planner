// File: app.js
// This is the main application script that ties everything together.

// Order of imports/dependencies might matter if not using ES6 modules and relying on global scope.
// Assuming all other JS files (config.js, domCache.js, utils.js, managers, eventListeners.js)
// are loaded before this script in the HTML.

document.addEventListener('DOMContentLoaded', initApp);

/**
 * Initializes the application.
 * This function is called once the DOM is fully loaded.
 */
function initApp() {
    // 1. Cache all necessary DOM elements.
    // This populates the global variables declared in config.js.
    cacheDOMElements(); // from domCache.js

    // 2. Initialize the Leaflet map.
    initializeMap(); // from mapManager.js

    // 3. Set up all event listeners for UI interactions.
    setupEventListeners(); // from eventListeners.js

    // 4. Perform initial UI updates.
    updateWaypointList();       // from uiUpdater.js
    updatePOIList();            // from uiUpdater.js
    updateFlightStatistics();   // from uiUpdater.js
    updateMultiEditPanelVisibility(); // from uiUpdater.js - ensures multi-edit panel is correctly hidden/shown

    // Initial state for some UI components if not handled by cacheDOMElements or specific managers
    if (waypointControlsDiv) waypointControlsDiv.style.display = 'none'; // Hide single WP edit panel initially
    if (multiFixedHeadingGroupDiv) multiFixedHeadingGroupDiv.style.display = 'none';
    if (multiTargetPoiForHeadingGroupDiv) multiTargetPoiForHeadingGroupDiv.style.display = 'none';
    if (fixedHeadingGroupDiv) fixedHeadingGroupDiv.style.display = 'none';
    if (targetPoiForHeadingGroupDiv) targetPoiForHeadingGroupDiv.style.display = 'none';

    // Disable multi-edit sliders initially
    if (multiGimbalPitchSlider) multiGimbalPitchSlider.disabled = true;
    if (multiHoverTimeSlider) multiHoverTimeSlider.disabled = true;


    console.log("Flight Planner Application Initialized.");
    showCustomAlert("Welcome to the Flight Planner! Click on the map to add waypoints (Ctrl+Click for POIs).", "Welcome");
}

// If you were using ES6 modules, you would import functions like this:
// import { cacheDOMElements } from './domCache.js';
// import { initializeMap } from './mapManager.js';
// ... and so on for all necessary functions from other modules.
// Then, the functions wouldn't need to be globally scoped.
// For this exercise, we've assumed a global scope approach based on script load order.