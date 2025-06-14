// File: app.js
// This is the main application script that ties everything together.

document.addEventListener('DOMContentLoaded', initApp);

/**
 * Initializes the application.
 * This function is called once the DOM is fully loaded.
 */
function initApp() {
    // 1. Cache all necessary DOM elements
    cacheDOMElements(); // from domCache.js

    // 2. Set initial language (before other initializations that might need translated text)
    const savedLang = localStorage.getItem('flightPlannerLang') || navigator.language.split('-')[0];
    if (typeof setLanguage === 'function') {
        setLanguage(translations[savedLang] ? savedLang : 'en');
    }

    // 3. Initialize the Leaflet map.
    initializeMap(); // from mapManager.js

    // 4. Set up all event listeners for UI interactions.
    setupEventListeners(); // from eventListeners.js
    
    // 5. Initial UI state updates.
    if(typeof updateDefaultDesiredAMSLTarget === 'function') {
        updateDefaultDesiredAMSLTarget(); // <-- CHIAMATA AGGIUNTA QUI
    }
    updateWaypointList();
    updatePOIList();
    updateFlightStatistics();
    updateMultiEditPanelVisibility();

    // Initial state for some UI components if not handled by cacheDOMElements or specific managers
    if (waypointControlsDiv) waypointControlsDiv.style.display = 'none';
    if (multiFixedHeadingGroupDiv) multiFixedHeadingGroupDiv.style.display = 'none';
    if (multiTargetPoiForHeadingGroupDiv) multiTargetPoiForHeadingGroupDiv.style.display = 'none';
    if (fixedHeadingGroupDiv) fixedHeadingGroupDiv.style.display = 'none';
    if (targetPoiForHeadingGroupDiv) targetPoiForHeadingGroupDiv.style.display = 'none';

    // Disable multi-edit sliders initially
    if (multiGimbalPitchSlider) multiGimbalPitchSlider.disabled = true;
    if (multiHoverTimeSlider) multiHoverTimeSlider.disabled = true;


    console.log("Flight Planner Application Initialized.");
    showCustomAlert(translate("alert_welcome"), translate("welcomeTitle"));
}
