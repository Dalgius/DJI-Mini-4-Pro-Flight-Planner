// js/i18n.js
import * as DOM from './domElements.js'; // Per aggiornare i select dopo il cambio lingua
import { updateWaypointListDisplay, updatePOIListDisplay, getCameraActionText as utilGetCameraActionText } from './uiControls.js'; // Per aggiornare placeholder

const translations = {
    en: {
        appSubtitle: "Flight Planner",
        flightSettingsTitle: "🛩️ Flight Settings",
        defaultAltitudeLabel: "Default Altitude (m) <span style=\"font-style: italic; color: #95a5a6;\">(Rel. to Takeoff)</span>",
        flightSpeedLabel: "Flight Speed (m/s)",
        pathTypeLabel: "Path Type (Turn Mode)",
        pathTypeStraight: "Straight (ToPointAndStopWithContinuity)",
        pathTypeCurved: "Curved (ToPointAndPassWithContinuity)",
        waypointsTitle: "📍 Waypoints",
        selectAllWaypointsLabel: "Select/Deselect All",
        clearAllWaypointsBtn: "Clear All Waypoints",
        waypointListPlaceholder: "Click on map to add waypoints",
        multiEditTitle: "⚙️ Edit <span id=\"selectedWaypointsCount\">0</span> Selected Waypoints",
        multiEditNoChange: "-- Do Not Change --",
        multiEditHeadingLabel: "New Heading Control",
        multiEditFixedHeadingLabel: "New Fixed Heading (°)",
        multiEditCameraActionLabel: "New Camera Action",
        multiEditGimbalPitchLabel: "New Gimbal Pitch (°)",
        multiEditHoverTimeLabel: "New Hover Time (s)",
        multiEditChangeBtn: "Change",
        applyToSelectedBtn: "Apply to Selected",
        cancelMultiSelectionBtn: "Cancel Multi-Selection",
        waypointSettingsTitle: "⚙️ Waypoint Settings",
        altitudeLabel: "Altitude (m) <span style=\"font-style: italic; color: #95a5a6;\">(Rel. to Takeoff)</span>",
        hoverTimeLabel: "Hover Time (s)",
        gimbalPitchLabel: "Gimbal Pitch (°)",
        headingControlLabel: "Heading Control",
        headingControlAuto: "Auto (Follow Wayline)",
        headingControlFixed: "Fixed Heading (Lock Course)",
        headingControlPoi: "POI Tracking (Toward POI)",
        targetPoiForHeadingLabel: "Target POI for Heading",
        fixedHeadingLabel: "Fixed Heading (°)",
        cameraActionsTitle: "📸 Camera Actions",
        cameraActionAtWaypointLabel: "Camera Action at Waypoint",
        cameraActionNone: "No Action",
        cameraActionTakePhoto: "Take Photo",
        cameraActionStartRecord: "Start Recording",
        cameraActionStopRecord: "Stop Recording",
        deleteWaypointBtn: "Delete Waypoint",
        poiTitle: "🎯 Points of Interest",
        poiNamePlaceholder: "POI Name",
        poiAddInstruction: "Ctrl + Click on map to add POI",
        poiListPlaceholder: "No POIs added",
        terrainOrbitTitle: "🏞️ Terrain & Orbit Tools",
        takeoffElevationLabel: "Takeoff Point Elevation (MSL, m)",
        useWp1ElevationBtn: "Use WP1 Elev.",
        desiredAGLLabel: "Desired Altitude Above Ground (AGL, m)",
        adaptAGLBtn: "Adapt Waypoint Altitudes to AGL",
        createOrbitBtn: "Create POI Orbit",
        createOrbitModalTitle: "Create POI Orbit",
        orbitModalCenterPoiLabel: "Center POI:",
        orbitModalRadiusLabel: "Radius (m):",
        orbitModalNumWaypointsLabel: "Number of Waypoints:",
        createOrbitBtnModal: "Create Orbit",
        cancelBtn: "Cancel",
        fileOpsTitle: "📁 File Operations",
        importJsonBtn: "Import Flight Plan (.json)",
        exportJsonBtn: "Export Flight Plan (.json)",
        exportKmzBtn: "Export DJI WPML (.kmz)",
        exportGoogleEarthBtn: "Export for Google Earth (.kml)",
        statsTitle: "📊 Flight Statistics",
        statsTotalDistance: "Total Distance:",
        statsEstFlightTime: "Est. Flight Time:",
        statsWaypoints: "Waypoints:",
        statsPOIs: "POIs:",
        mapBtnSatellite: "📡 Satellite",
        mapBtnMap: "🗺️ Map",
        mapBtnFitView: "🎯 Fit View",
        mapBtnMyLocation: "📍 My Location",
        languageLabel: "Language:",
        alertNoWaypointsToExport: "No waypoints to export.",
        alertNoPoiForOrbit: "Add at least one POI before creating an orbit.",
        alertInvalidPoiId: "Invalid POI ID.",
        selectPoiDropdownDefault: "-- Select POI --",
        noPoisAvailableDropdown: "No POIs available",
        loadingAGLText: "Calculating AGL Altitudes...",
        loadingWP1ElevText: "Fetching WP1 Elevation...",
        alertAglAdaptSuccess: "AGL altitude adaptation completed for all waypoints!",
        alertAglAdaptPartial: (s, t) => `AGL altitude adaptation completed for ${s} out of ${t} waypoints. Check console for errors.`,
        alertAglAdaptFail: "AGL altitude adaptation failed for all waypoints. Check console for details.",
        alertHomeElevSuccess: (e) => `Waypoint 1 elevation (${e}m MSL) set as takeoff elevation.`,
        alertHomeElevFail: "Could not retrieve elevation for Waypoint 1.",
        alertInputError: "Input Error",
        alertInfo: "Info",
        alertSuccess: "Success",
        alertError: "Error",
        alertWarning: "Warning",
        alertNoWpForAGL: "No waypoints to adapt altitudes for.",
        alertInvalidAGL: "Invalid desired AGL (min 5m).",
        alertInvalidHomeElev: "Invalid Takeoff Point Elevation (MSL). Try 'Use WP1 Elev.' or enter manually.",
        alertOrbitInvalidRadius: "Invalid radius. Must be a positive number.",
        alertOrbitInvalidPoints: "Invalid number of points. Minimum 3 for orbit.",
        alertImportError: (m) => `Error parsing flight plan: ${m}`,
        alertImportSuccess: "Flight plan imported successfully!",
        alertWpDeleted: "Waypoint deleted.",
        alertWpInserted: (id) => `Waypoint ${id} inserted.`,
        alertNoWpSelected: "No waypoint selected to delete.",
        alertMultiNoChange: "No changes specified to apply or no valid values for changes.",
        alertMultiApplied: (count) => `${count} waypoints were considered for update.`,
        alertNoWpMultiEdit: "No waypoints selected for multi-edit.",
        alertGeolocationNotSupported: "Geolocation is not supported by this browser.",
        alertUnableToRetrieveLocation: "Unable to retrieve your location.",
        alertApiErrorBatch: (s) => `Elevation API Error (Batch): ${s}`,
        alertApiWarningBatchNoData: (s) => `Elevation API returned no valid data for a batch. Status: ${s}`,
        alertApiErrorGeneric: (s) => `Elevation API Error: ${s}`,
        alertApiWarningNoData: (lat,lng) => `No elevation data available for coordinates ${lat.toFixed(4)}, ${lng.toFixed(4)} from API.`,
        alertFetchError: "Connection or parsing error during elevation request. Check console.",
    },
    it: {
        appSubtitle: "Pianificatore di Volo",
        flightSettingsTitle: "🛩️ Impostazioni di Volo",
        defaultAltitudeLabel: "Altitudine Predefinita (m) <span style=\"font-style: italic; color: #95a5a6;\">(Rel. a Decollo)</span>",
        flightSpeedLabel: "Velocità di Volo (m/s)",
        pathTypeLabel: "Tipo di Percorso (Mod. Virata)",
        pathTypeStraight: "Rettilineo (ToPointAndStopWithContinuity)",
        pathTypeCurved: "Curvilineo (ToPointAndPassWithContinuity)",
        waypointsTitle: "📍 Waypoint",
        selectAllWaypointsLabel: "Seleziona/Deseleziona Tutti",
        clearAllWaypointsBtn: "Cancella Tutti i Waypoint",
        waypointListPlaceholder: "Clicca sulla mappa per aggiungere waypoint",
        multiEditTitle: "⚙️ Modifica <span id=\"selectedWaypointsCount\">0</span> Waypoint Selezionati", // L'ID span è gestito da JS
        multiEditNoChange: "-- Non Modificare --",
        multiEditHeadingLabel: "Nuovo Controllo Direzione",
        multiEditFixedHeadingLabel: "Nuova Direzione Fissa (°)",
        multiEditCameraActionLabel: "Nuova Azione Fotocamera",
        multiEditGimbalPitchLabel: "Nuovo Pitch Gimbal (°)",
        multiEditHoverTimeLabel: "Nuovo Tempo di Stazionamento (s)",
        multiEditChangeBtn: "Modifica",
        applyToSelectedBtn: "Applica ai Selezionati",
        cancelMultiSelectionBtn: "Annulla Selezione Multipla",
        waypointSettingsTitle: "⚙️ Impostazioni Waypoint",
        altitudeLabel: "Altitudine (m) <span style=\"font-style: italic; color: #95a5a6;\">(Rel. a Decollo)</span>",
        hoverTimeLabel: "Tempo di Stazionamento (s)",
        gimbalPitchLabel: "Pitch Gimbal (°)",
        headingControlLabel: "Controllo Direzione",
        headingControlAuto: "Auto (Segue Linea di Volo)",
        headingControlFixed: "Direzione Fissa (Blocca Rotta)",
        headingControlPoi: "Tracciamento POI (Verso POI)",
        targetPoiForHeadingLabel: "POI Target per Direzione",
        fixedHeadingLabel: "Direzione Fissa (°)",
        cameraActionsTitle: "📸 Azioni Fotocamera",
        cameraActionAtWaypointLabel: "Azione Fotocamera al Waypoint",
        cameraActionNone: "Nessuna Azione",
        cameraActionTakePhoto: "Scatta Foto",
        cameraActionStartRecord: "Avvia Registrazione Video",
        cameraActionStopRecord: "Ferma Registrazione Video",
        deleteWaypointBtn: "Cancella Waypoint",
        poiTitle: "🎯 Punti di Interesse",
        poiNamePlaceholder: "Nome POI",
        poiAddInstruction: "Ctrl + Click sulla mappa per aggiungere POI",
        poiListPlaceholder: "Nessun POI aggiunto",
        terrainOrbitTitle: "🏞️ Strumenti Terreno & Orbita",
        takeoffElevationLabel: "Elevazione Punto Decollo (MSL, m)",
        useWp1ElevationBtn: "Usa Elev. WP1",
        desiredAGLLabel: "Altezza Desiderata dal Suolo (AGL, m)",
        adaptAGLBtn: "Adatta Altitudini Waypoint a AGL",
        createOrbitBtn: "Crea Orbita POI",
        createOrbitModalTitle: "Crea Orbita POI",
        orbitModalCenterPoiLabel: "POI Centrale:",
        orbitModalRadiusLabel: "Raggio (m):",
        orbitModalNumWaypointsLabel: "Numero di Waypoint:",
        createOrbitBtnModal: "Crea Orbita",
        cancelBtn: "Annulla",
        fileOpsTitle: "📁 Operazioni File",
        importJsonBtn: "Importa Piano di Volo (.json)",
        exportJsonBtn: "Esporta Piano di Volo (.json)",
        exportKmzBtn: "Esporta DJI WPML (.kmz)",
        exportGoogleEarthBtn: "Esporta per Google Earth (.kml)",
        statsTitle: "📊 Statistiche di Volo",
        statsTotalDistance: "Distanza Totale:",
        statsEstFlightTime: "Tempo di Volo Stimato:",
        statsWaypoints: "Waypoint:",
        statsPOIs: "POI:",
        mapBtnSatellite: "📡 Satellite",
        mapBtnMap: "🗺️ Mappa",
        mapBtnFitView: "🎯 Centra Vista",
        mapBtnMyLocation: "📍 Mia Posizione",
        languageLabel: "Lingua:",
        alertNoWaypointsToExport: "Nessun waypoint da esportare.",
        alertNoPoiForOrbit: "Aggiungi almeno un POI prima di creare un'orbita.",
        alertInvalidPoiId: "ID POI non valido.",
        selectPoiDropdownDefault: "-- Seleziona POI --",
        noPoisAvailableDropdown: "Nessun POI disponibile",
        loadingAGLText: "Calcolo Altitudini AGL...",
        loadingWP1ElevText: "Ottengo elevazione WP1...",
        alertAglAdaptSuccess: "Adattamento altitudini AGL completato per tutti i waypoint!",
        alertAglAdaptPartial: (s, t) => `Adattamento altitudini AGL completato per ${s} su ${t} waypoint. Controlla la console per errori.`,
        alertAglAdaptFail: "Adattamento altitudini AGL fallito per tutti i waypoint. Controlla la console per dettagli.",
        alertHomeElevSuccess: (e) => `Elevazione Waypoint 1 (${e}m MSL) impostata come elevazione di decollo.`,
        alertHomeElevFail: "Impossibile ottenere l'elevazione per il Waypoint 1.",
        alertInputError: "Errore Input",
        alertInfo: "Info",
        alertSuccess: "Successo",
        alertError: "Errore",
        alertWarning: "Attenzione",
        alertNoWpForAGL: "Nessun waypoint per adattare le altitudini.",
        alertInvalidAGL: "AGL desiderato non valido (min 5m).",
        alertInvalidHomeElev: "Elevazione punto decollo (MSL) non valida. Prova 'Usa Elev. WP1' o inseriscila.",
        alertOrbitInvalidRadius: "Raggio non valido. Deve essere un numero positivo.",
        alertOrbitInvalidPoints: "Numero di punti non valido. Minimo 3 per l'orbita.",
        alertImportError: (m) => `Errore nel parsing del piano di volo: ${m}`,
        alertImportSuccess: "Piano di volo importato con successo!",
        alertWpDeleted: "Waypoint cancellato.",
        alertWpInserted: (id) => `Waypoint ${id} inserito.`,
        alertNoWpSelected: "Nessun waypoint selezionato da cancellare.",
        alertMultiNoChange: "Nessuna modifica specificata da applicare o nessun valore valido per le modifiche.",
        alertMultiApplied: (count) => `${count} waypoint sono stati considerati per l'aggiornamento.`,
        alertNoWpMultiEdit: "Nessun waypoint selezionato per la modifica multipla.",
        alertGeolocationNotSupported: "Geolocalizzazione non supportata da questo browser.",
        alertUnableToRetrieveLocation: "Impossibile recuperare la tua posizione.",
        alertApiErrorBatch: (s) => `Errore API Elevazione (Batch): ${s}`,
        alertApiWarningBatchNoData: (s) => `L'API Elevazione non ha restituito dati validi per un batch. Status: ${s}`,
        alertApiErrorGeneric: (s) => `Errore API Elevazione: ${s}`,
        alertApiWarningNoData: (lat,lng) => `Nessun dato di elevazione disponibile per le coordinate ${lat.toFixed(4)}, ${lng.toFixed(4)} dall'API.`,
        alertFetchError: "Errore di connessione o parsing durante la richiesta di elevazione. Controlla la console.",
    }
};

export let currentLang = 'en'; // Lingua di default

export function setLanguage(lang) {
    if (translations[lang]) {
        currentLang = lang;
        localStorage.setItem('flightPlannerLang', lang);
        applyTranslations();
    } else {
        console.warn(`Language "${lang}" not found. Falling back to English.`);
        currentLang = 'en';
        applyTranslations();
    }
}

export function loadLanguage() {
    const savedLang = localStorage.getItem('flightPlannerLang');
    const browserLang = navigator.language.split('-')[0]; // es. "en" da "en-US"

    if (savedLang && translations[savedLang]) {
        currentLang = savedLang;
    } else if (translations[browserLang]) {
        currentLang = browserLang;
    } else {
        currentLang = 'en'; // Default finale
    }
    if (DOM.langSelectEl) DOM.langSelectEl.value = currentLang;
}


export function _tr(key, params = null) {
    let stringSet = translations[currentLang] || translations.en; // Fallback a inglese se la lingua corrente non ha traduzioni
    let string = stringSet[key] || key; // Fallback alla chiave stessa se la traduzione non esiste

    if (typeof string === 'function' && params !== null) {
        return string(...(Array.isArray(params) ? params : [params]));
    }
    return string;
}

export function applyTranslations() {
    document.querySelectorAll('[data-i18n-key]').forEach(element => {
        const key = element.getAttribute('data-i18n-key');
        const translatedText = _tr(key);

        if (element.hasAttribute('data-i18n-html')) {
            element.innerHTML = translatedText; // Per chiavi che contengono HTML (es. span dentro label)
        } else if (element.placeholder && translations[currentLang] && translations[currentLang][`${key}Placeholder`]) {
            element.placeholder = _tr(`${key}Placeholder`);
        } else if (element.tagName === 'INPUT' && element.type === 'button' || element.tagName === 'BUTTON') {
            if (element.id === 'satelliteToggleBtn' && element.hasAttribute('data-i18n-target-text')) {
                 // Non tradurre il testo di questo bottone qui, gestito da toggleSatelliteView
            } else {
                element.value = translatedText; 
                element.textContent = translatedText;
            }
        } else {
            element.textContent = translatedText;
        }
    });

    // Aggiorna testi dinamici specifici
    if (DOM.pathTypeSelect) {
        DOM.pathTypeSelect.options[0].textContent = _tr("pathTypeStraight");
        DOM.pathTypeSelect.options[1].textContent = _tr("pathTypeCurved");
    }
    if(DOM.headingControlSelect){
        DOM.headingControlSelect.options[0].textContent = _tr("headingControlAuto");
        DOM.headingControlSelect.options[1].textContent = _tr("headingControlFixed");
        DOM.headingControlSelect.options[2].textContent = _tr("headingControlPoi");
    }
    if(DOM.multiHeadingControlSelect){
        DOM.multiHeadingControlSelect.options[1].textContent = _tr("headingControlAuto");
        DOM.multiHeadingControlSelect.options[2].textContent = _tr("headingControlFixed");
        DOM.multiHeadingControlSelect.options[3].textContent = _tr("headingControlPoi");
    }
    if(DOM.cameraActionSelect){
        DOM.cameraActionSelect.options[0].textContent = _tr("cameraActionNone");
        DOM.cameraActionSelect.options[1].textContent = _tr("cameraActionTakePhoto");
        DOM.cameraActionSelect.options[2].textContent = _tr("cameraActionStartRecord");
        DOM.cameraActionSelect.options[3].textContent = _tr("cameraActionStopRecord");
    }
     if(DOM.multiCameraActionSelect){
        DOM.multiCameraActionSelect.options[1].textContent = _tr("cameraActionNone");
        DOM.multiCameraActionSelect.options[2].textContent = _tr("cameraActionTakePhoto");
        DOM.multiCameraActionSelect.options[3].textContent = _tr("cameraActionStartRecord");
        DOM.multiCameraActionSelect.options[4].textContent = _tr("cameraActionStopRecord");
    }
    // E i placeholder delle liste se necessario (ma sono già gestiti in updateWaypointList e updatePOIList)
    updateWaypointListDisplay(); // Per aggiornare i placeholder e il testo degli item
    updatePOIListDisplay();      // Per i placeholder
}