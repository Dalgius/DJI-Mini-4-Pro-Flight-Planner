// js/i18n.js

const translations = {
    en: {
        // ... (tutte le traduzioni esistenti) ...
        // Survey Grid Modal
        "surveyGridModalTitle": "Create Survey Grid",
        "surveyGridInstructions": "Click \"Start Drawing\", then click on the map to define the survey area corners. Click the first point again to close the polygon.",
        "surveyGridInstructionsDrawing": "Drawing survey area: Click on map to add corners. Click the first point (min 3 total) to finalize.",
        "surveyGridInstructionsFinalized": "<strong style='color: #2ecc71;'>Area finalized!</strong> Adjust parameters or click \"Generate Grid\".",
        "surveyFlightAltitudeLabel": "Flight Altitude (m):",
        "surveySidelapLabel": "Sidelap (%):",
        "surveySidelapTitle": "Overlap between parallel flight lines (e.g., 60-80%)",
        "surveyFrontlapLabel": "Frontlap (%):",
        "surveyFrontlapTitle": "Overlap between consecutive photos along a flight line (e.g., 70-90%)",
        "surveyGridAngleLabel": "Grid Angle (°):",
        "surveyGridAngleDesc": "Flight line direction: 0° for E-W lines, 90° for N-S lines.",
        "surveyAreaStatusDefault": "Area not defined.",
        "surveyAreaStatusDefined": "Area defined: {points} points.",
        "startDrawingSurveyAreaBtn": "Start Drawing Area",
        "finalizeSurveyAreaBtn": "Finalize Area",
        "generateGridBtn": "Generate Grid",

        // ... (tutte le altre traduzioni esistenti) ...
        "alert_surveyAreaMinPoints": "Area requires at least {minPoints} points.",
        "alert_surveyDrawingActive": "Drawing survey area: Click on map to add corners. Click the first point (min 3 total) to finalize.",
        "alert_surveyGridNoWps": "No waypoints generated within the polygon. Check parameters.",
        "alert_surveyGridSuccess": "{count} survey waypoints generated!",
        "alert_surveyGridError": "Error during grid generation.",
        "alert_surveyGridInvalidPoly": "Invalid polygon for generation.",
        "alert_surveyGridInvalidParams": "Invalid survey grid parameters. Check spacing values.",
        "alert_surveyGridTooManyLines": "Too many flight lines generated (>2000). Please check your parameters (sidelap, area size).",
        "alert_surveyGridInvalidInput_altitude": "Invalid altitude.",
        "alert_surveyGridInvalidInput_sidelap": "Invalid Sidelap % (10-95).",
        "alert_surveyGridInvalidInput_frontlap": "Invalid Frontlap % (10-95).",
        "alert_surveyGridInvalidInput_angle": "Invalid grid angle.",
        "alert_surveyGridInvalidInput_speed": "Invalid flight speed."
    },
    it: {
        // ... (tutte le traduzioni esistenti) ...
        // Survey Grid Modal
        "surveyGridModalTitle": "Crea Griglia di Rilievo",
        "surveyGridInstructions": "Clicca \"Inizia a Disegnare\" poi clicca sulla mappa per definire gli angoli dell'area di rilievo. Clicca di nuovo sul primo punto per chiudere il poligono.",
        "surveyGridInstructionsDrawing": "Disegno area: Clicca sulla mappa per aggiungere angoli. Clicca sul primo punto (min 3 totali) per finalizzare.",
        "surveyGridInstructionsFinalized": "<strong style='color: #2ecc71;'>Area finalizzata!</strong> Modifica i parametri o clicca \"Genera Griglia\".",
        "surveyFlightAltitudeLabel": "Altitudine di Volo (m):",
        "surveySidelapLabel": "Sidelap (%):",
        "surveySidelapTitle": "Sovrapposizione tra linee di volo parallele (es. 60-80%)",
        "surveyFrontlapLabel": "Frontlap (%):",
        "surveyFrontlapTitle": "Sovrapposizione tra foto consecutive lungo una linea di volo (es. 70-90%)",
        "surveyGridAngleLabel": "Angolo Griglia (°):",
        "surveyGridAngleDesc": "Direzione linee di volo: 0° per linee E-O, 90° per linee N-S.",
        "surveyAreaStatusDefault": "Area non definita.",
        "surveyAreaStatusDefined": "Area definita: {points} punti.",
        "startDrawingSurveyAreaBtn": "Inizia a Disegnare",
        "finalizeSurveyAreaBtn": "Finalizza Area",
        "generateGridBtn": "Genera Griglia",
        
        // ... (tutte le altre traduzioni esistenti) ...
        "alert_surveyAreaMinPoints": "L'area richiede almeno {minPoints} punti.",
        "alert_surveyDrawingActive": "Disegno area di rilievo: Clicca sulla mappa per aggiungere gli angoli. Clicca sul primo punto (min 3 totali) per finalizzare.",
        "alert_surveyGridNoWps": "Nessun waypoint generato all'interno del poligono. Controlla i parametri.",
        "alert_surveyGridSuccess": "{count} waypoint di rilievo generati!",
        "alert_surveyGridError": "Errore durante la generazione della griglia.",
        "alert_surveyGridInvalidPoly": "Poligono non valido per la generazione.",
        "alert_surveyGridInvalidParams": "Parametri griglia non validi. Controlla i valori di spaziatura.",
        "alert_surveyGridTooManyLines": "Troppe linee di volo generate (>2000). Controlla i parametri (sidelap, dimensione area).",
        "alert_surveyGridInvalidInput_altitude": "Altitudine non valida.",
        "alert_surveyGridInvalidInput_sidelap": "Sidelap % non valido (10-95).",
        "alert_surveyGridInvalidInput_frontlap": "Frontlap % non valido (10-95).",
        "alert_surveyGridInvalidInput_angle": "Angolo griglia non valido.",
        "alert_surveyGridInvalidInput_speed": "Velocità di volo non valida."
    }
};

let currentLang = 'en';

function setLanguage(lang) {
    if (translations[lang]) {
        currentLang = lang;
        localStorage.setItem('flightPlannerLang', lang); // Save preference
        document.documentElement.lang = lang;
        if (typeof langSelect !== 'undefined' && langSelect) {
             langSelect.value = lang;
        }
        applyTranslations();
    }
}

function translate(key, options = {}) {
    let text = (translations[currentLang] && translations[currentLang][key])
               || (translations['en'] && translations['en'][key]) // Fallback to English
               || `[${key}]`; // Fallback to key name if not found anywhere

    // Replace placeholders like {count}
    for (const placeholder in options) {
        text = text.replace(new RegExp(`{${placeholder}}`, 'g'), options[placeholder]);
    }
    return text;
}

function applyTranslations() {
    if (!document.body) return;
    
    document.querySelectorAll('[data-i18n-key]').forEach(element => {
        const key = element.getAttribute('data-i18n-key');
        if (!key) return;
        
        const translation = translate(key);
        
        if (element.tagName === 'INPUT' && element.hasAttribute('placeholder')) {
             element.placeholder = translation;
        } else if (element.hasAttribute('data-i18n-html')) {
            element.innerHTML = translation;
        } else {
             element.textContent = translation;
        }
    });

     document.querySelectorAll('[data-i18n-title-key]').forEach(element => {
        const key = element.getAttribute('data-i18n-title-key');
        if (key) {
            element.title = translate(key);
        }
    });

    if (typeof updateWaypointList === 'function') updateWaypointList();
    if (typeof updatePOIList === 'function') updatePOIList();
    if (typeof updatePathModeDisplay === 'function') updatePathModeDisplay();
    if (typeof updateSingleWaypointEditControls === 'function') updateSingleWaypointEditControls();
    if (typeof updateMultiEditPanelVisibility === 'function') updateMultiEditPanelVisibility();

    if (typeof satelliteToggleBtn !== 'undefined' && satelliteToggleBtn && typeof satelliteView !== 'undefined') {
        const key = satelliteView ? 'mapBtnMap' : 'mapBtnSatellite';
        satelliteToggleBtn.textContent = translate(key);
    }
}
