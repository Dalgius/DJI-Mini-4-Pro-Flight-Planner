// js/main.js
import { cacheDOMElements } from './domElements.js';
import { initializeMapLogic } from './mapLogic.js'; // Rinominato per chiarezza
import { setupAllEventListeners } from './uiControls.js'; // Rinominato per chiarezza
import { updateWaypointListDisplay, updatePOIListDisplay } from './uiControls.js'; // Funzioni specifiche
import { updateFlightStatisticsDisplay } from './uiControls.js'; // Funzione specifica
import { updateMultiEditPanelVisibility } from './multiEditLogic.js';
import { loadLanguage, applyTranslations } from './i18n.js'; // Per internazionalizzazione

function initApp() {
    cacheDOMElements();
    initializeMapLogic(); // Chiama la funzione dal modulo mapLogic
    setupAllEventListeners(); // Chiama la funzione dal modulo uiControls
    
    loadLanguage(); // Carica la lingua (da localStorage o default)
    applyTranslations(); // Applica le traduzioni iniziali

    // Chiamate iniziali per aggiornare l'UI con valori/placeholder di default
    updateWaypointListDisplay(); 
    updatePOIListDisplay(); 
    updateFlightStatisticsDisplay(); 
    updateMultiEditPanelVisibility();
}

document.addEventListener('DOMContentLoaded', initApp);