// js/i18n.js

const translations = {
    en: {
        // General & Titles
        "appSubtitle": "Flight Planner",
        "welcomeTitle": "Welcome",
        "infoTitle": "Information",
        "errorTitle": "Error",
        "apiErrorTitle": "API Error",
        "apiWarningTitle": "API Warning",
        "inputErrorTitle": "Input Error",
        "successTitle": "Success",
        "partialSuccessTitle": "Partial Success",
        
        // --- Sidebar ---
        // Language
        "languageLabel": "Language:",
        // Flight Settings
        "flightSettingsTitle": "🛩️ Flight Settings",
        "defaultAltitudeLabel": "Default Altitude (m) <span style='font-style: italic; color: #95a5a6;'>(Rel. to Takeoff)</span>",
        "flightSpeedLabel": "Flight Speed (m/s)",
        "pathTypeLabel": "Path Type (Turn Mode)",
        "pathTypeStraight": "Straight (ToPointAndStopWithContinuity)",
        "pathTypeCurved": "Curved (ToPointAndPassWithContinuity)",
        // Waypoints
        "waypointsTitle": "📍 Waypoints",
        "selectAllWaypointsLabel": "Select/Deselect All",
        "clearAllWaypointsBtn": "Clear All Waypoints",
        "clickMapToAddWaypoints": "Click on the map to add waypoints.",
        // Multi-Edit
        "multiEditTitle": "Edit Selected Waypoints",
        "multiEditTitleText": "⚙️ Edit {count} Selected Waypoints",
        "multiEditHeadingLabel": "New Heading Control",
        "multiEditNoChange": "-- Do Not Change --",
        "multiEditFixedHeadingLabel": "New Fixed Heading (°)",
        "multiEditCameraActionLabel": "New Camera Action",
        "multiEditGimbalPitchLabel": "New Gimbal Pitch (°)",
        "multiEditHoverTimeLabel": "New Hover Time (s)",
        "multiEditChangeBtn": "Change",
        "applyToSelectedBtn": "Apply to Selected",
        "cancelMultiSelectionBtn": "Cancel Multi-Selection",
        "multiEditSelectPoiDropdown": "-- Select POI for all --",
        // Waypoint Settings
        "waypointSettingsTitle": "⚙️ Waypoint Settings",
        "altitudeLabel": "Altitude (m) <span style='font-style: italic; color: #95a5a6;'>(Rel. to Takeoff)</span>",
        "hoverTimeLabel": "Hover Time (s)",
        "gimbalPitchLabel": "Gimbal Pitch (°)",
        "headingControlLabel": "Heading Control",
        "headingControlAuto": "Auto (Follow Wayline)",
        "headingControlFixed": "Fixed Heading (Lock Course)",
        "headingControlPoi": "POI Tracking (Toward POI)",
        "targetPoiForHeadingLabel": "Target POI for Heading",
        "selectPoiForHeadingDropdown": "-- Select POI for Heading --",
        "fixedHeadingLabel": "Fixed Heading (°)",
        "cameraActionsTitle": "📸 Camera Actions",
        "cameraActionAtWaypointLabel": "Camera Action at Waypoint",
        "cameraActionNone": "No Action",
        "cameraActionTakePhoto": "Take Photo",
        "cameraActionStartRecord": "Start Recording",
        "cameraActionStopRecord": "Stop Recording",
        "deleteWaypointBtn": "Delete Waypoint",
        // POI
        "poiTitle": "🎯 Points of Interest",
        "poiNamePlaceholder": "POI Name",
        "poiObjectHeightLabel": "POI Object Height (above its ground, m):",
        "poiObjectHeightTitle": "Height of the POI object from its base terrain.",
        "poiTerrainElevationLabel": "POI Terrain Elev. (MSL, m):",
        "poiTerrainElevationTitle": "MSL terrain elevation at the POI base. Editable if auto-fetch fails.",
        "refetchBtn": "⟳ Refetch",
        "refetchBtnTitle": "Attempt to refetch terrain elevation for the last added/selected POI from its Lat/Lng coordinates.",
        "poiTerrainElevationDesc": "(Filled by Ctrl+Click on map. Edit if needed.)",
        "poiFinalAltitudeLabel": "POI Final Altitude (MSL, m):",
        "poiAddInstructionCtrlClick": "Ctrl+Click on map to add POI and fetch terrain elev.",
        "noPoisAvailable": "No POIs Available",
        "noPoisAdded": "No POIs added yet.",
        "deletePoiTitle": "Delete POI '{poiName}'",
        "poiObjectHeightListLabel": "Obj. H(m)",
        "poiTerrainElevListLabel": "Terr. Elev(m)",
        "poiFinalAltitudeListLabel": "Final AMSL",
        "NA": "N/A",
        "NAedit": "N/A, edit",
        "invalidPoiObjectHeightTitle": "Invalid value. Must be a non-negative number.",
        "invalidPoiTerrainElevTitle": "Invalid value. Must be a number.",
        // Survey Missions
        "surveyMissionsTitle": "🗺️ Survey Missions",
        "noSurveyMissions": "No survey missions created yet.",
        "editMissionBtn": "Edit",
        "deleteMissionBtn": "Delete",
        "missionLabel": "Mission",
        // Terrain & Orbit
        "terrainOrbitTitle": "🏞️ Terrain & Orbit Tools",
        "takeoffElevationLabel": "Takeoff Point Elevation (MSL, m)",
        "useWp1ElevationBtn": "Use WP1 Elev.",
        "adaptPathAltTitle": "Adapt Path Altitudes:",
        "desiredAGLLabel": "Constant Target AGL (m):",
        "adaptAGLBtn": "Set Constant AGL",
        "desiredAMSLLabel": "Constant Target AMSL (m):",
        "adaptAMSLBtn": "Set Constant AMSL",
        "currentPathModeLabel": "Path Altitude Mode:",
        "pathModeRelative": "Relative to Takeoff",
        "pathModeAGL": "Constant AGL",
        "pathModeAMSL": "Constant AMSL",
        "createOrbitBtn": "Create POI Orbit",
        "createSurveyGridBtn": "Create Survey Grid",
        // File Ops
        "fileOpsTitle": "📁 File Operations",
        "importJsonBtn": "Import Flight Plan (.json)",
        "exportJsonBtn": "Export Flight Plan (.json)",
        "exportKmzBtn": "Export DJI WPML (.kmz)",
        "exportGoogleEarthBtn": "Export for Google Earth (.kml)",
        // Stats
        "statsTitle": "📊 Flight Statistics",
        "statsTotalDistance": "Total Distance:",
        "statsEstFlightTime": "Est. Flight Time:",
        "statsWaypoints": "Waypoints:",
        "statsPOIs": "POIs:",
        
        // --- Map Buttons ---
        "mapBtnSatellite": "📡 Satellite",
        "mapBtnMap": "🗺️ Map",
        "mapBtnFitView": "🎯 Fit View",
        "mapBtnMyLocation": "📍 My Location",

        // --- Modals ---
        // Orbit Modal
        "createOrbitModalTitle": "Create POI Orbit",
        "orbitModalCenterPoiLabel": "Center POI:",
        "orbitModalRadiusLabel": "Radius (m):",
        "orbitModalNumWaypointsLabel": "Number of Waypoints:",
        "cancelBtn": "Cancel",
        "createOrbitBtnModal": "Create Orbit",
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
        "surveyGridAngleDesc": "Flight line direction (0°=North, 90°=East).",
        "drawGridAngleBtn": "Set Angle by Drawing",
        "surveyAreaStatusDefault": "Area not defined.",
        "surveyAreaStatusDefined": "Area defined: {points} points.",
        "startDrawingSurveyAreaBtn": "Start Drawing Area",
        "finalizeSurveyAreaBtn": "Finalize Area",
        "generateGridBtn": "Generate Grid",
        "updateGridBtn": "Update Grid",

        // --- Dynamic UI text (JS) ---
        "waypointLabel": "Waypoint",
        "flightAltRelLabel": "Flight Alt (Rel)",
        "amslAltLabel": "AMSL Alt",
        "aglAltLabel": "AGL Alt",
        "terrainElevLabel": "Terrain Elev",
        "hoverLabel": "Hover",
        "gimbalLabel": "Gimbal",
        "actionLabel": "Action",
        "cameraActionText_takePhoto": "Photo",
        "cameraActionText_startRecord": "Start Rec.",
        "cameraActionText_stopRecord": "Stop Rec.",
        "cameraActionText_none": "None",

        // --- Alerts & Notifications ---
        "alert_welcome": "Welcome to the Flight Planner! Click on the map to add waypoints (Ctrl+Click for POIs).",
        "alert_waypointInserted": "Waypoint {wpId} inserted into the flight path.",
        "alert_couldNotInsertWaypoint": "Could not determine where to insert the waypoint on the path.",
        "alert_noPoiForTerrainFetch": "No POI selected or available to fetch terrain elevation for.",
        "alert_addWpForTakeoffElev": "Add at least one waypoint to fetch takeoff elevation.",
        "alert_fetchingWp1Elev": "Fetching elevation for WP1...",
        "alert_takeoffElevFromWp1Set": "Takeoff elevation set to {elev}m MSL based on Waypoint 1.",
        "alert_takeoffElevFromWp1Fail": "Failed to fetch elevation for Waypoint 1.",
        "alert_invalidDesiredAGL": "Invalid Desired AGL value. Must be a positive number.",
        "alert_invalidTakeoffElev": "Invalid Takeoff Elevation (MSL). Please enter a valid number.",
        "alert_noWaypointsToAdapt": "No waypoints to adapt.",
        "alert_fetchingTerrainForAllWp": "Fetching terrain for all waypoints...",
        "alert_adaptingAglAlts_wp": "Adapting altitudes (AGL)... WP {wpId} ({current}/{total})",
        "alert_adaptAglSuccess": "All waypoint altitudes have been adapted to a constant AGL.",
        "alert_adaptAglPartial": "Adapted {count} of {total} waypoint altitudes. Some failed due to missing terrain data.",
        "alert_adaptAglFail": "Failed to adapt any waypoint altitudes. Could not fetch terrain data.",
        "alert_invalidDesiredAMSL": "Invalid Desired AMSL value. Please enter a valid number.",
        "alert_adaptingAmslAlts": "Adapting altitudes to constant AMSL...",
        "alert_adaptAmslSuccess": "All waypoint altitudes set for a flight at {amslTarget}m AMSL.",
        "alert_invalidPoiObjectHeight": "Invalid object height. Please enter a non-negative number.",
        "alert_invalidPoiTerrainElev": "Invalid terrain elevation. Please enter a number.",
        "alert_elevationApiError_batch": "Elevation API Error (Batch {batchNum}): Status {status}. Check console for details.",
        "alert_elevationApiNoData_batch": "Elevation API Warning (Batch {batchNum}): Status '{status}'. No data returned.",
        "alert_elevationFetchError_batch": "Network or parsing error on elevation fetch (Batch {batchNum}).",
        "alert_surveyAreaMinPoints": "Area requires at least {minPoints} points.",
        "alert_surveyDrawingActive": "Drawing survey area: Click on map to add corners. Click the first point (min 3 total) to finalize.",
        "alert_surveyGridNoWps": "No waypoints generated within the polygon. Check parameters.",
        "alert_surveyGridSuccess": "{count} survey waypoints generated!",
        "alert_surveyGridError": "Error during grid generation.",
        "alert_surveyGridInvalidInput_angle": "Invalid grid angle.",
        "alert_drawAngleInstruction": "Click and drag on the map to draw a line that defines the flight line direction.",
        "alert_surveyGridInvalidInput_speed": "Invalid flight speed.",
        "alert_surveyGridInvalidPoly": "Invalid polygon for generation.",
        "alert_surveyGridInvalidParams": "Invalid survey grid parameters. Check spacing values.",
        "alert_surveyGridTooManyLines": "Too many flight lines generated (>2000). Please check your parameters (sidelap, area size).",
        "alert_surveyGridInvalidInput_altitude": "Invalid altitude.",
        "alert_surveyGridInvalidInput_sidelap": "Invalid Sidelap % (10-95).",
        "alert_surveyGridInvalidInput_frontlap": "Invalid Frontlap % (10-95).",
        "alert_deleteSurveyMissionConfirm": "Are you sure you want to delete '{missionName}' and its {wpCount} waypoints? This action cannot be undone.",
        "alert_missionUpdated": "Survey Mission '{missionName}' has been updated.",
        "error_min_waypoints": "At least 2 waypoints are required for a mission.",
        "error_invalid_coordinates": "Invalid coordinates.",
        "error_altitude_range": "Altitude out of range (2-500m).",
        "error_gimbal_range": "Gimbal pitch out of range (-90° to +60°).",
        "import_success": "Flight plan imported successfully!",
        "nothing_to_export": "Nothing to export.",
        "export_json_success": "Flight plan exported as JSON.",
        "export_ge_success": "Exported for Google Earth.",
        "export_dji_success": "DJI WPML KMZ exported.",
        "jszip_not_loaded": "JSZip library not loaded."
    },
    it: {
        // General & Titles
        "appSubtitle": "Pianificatore di Volo",
        "welcomeTitle": "Benvenuto",
        "infoTitle": "Informazione",
        "errorTitle": "Errore",
        "apiErrorTitle": "Errore API",
        "apiWarningTitle": "Avviso API",
        "inputErrorTitle": "Errore Input",
        "successTitle": "Successo",
        "partialSuccessTitle": "Successo Parziale",

        // --- Sidebar ---
        // Language
        "languageLabel": "Lingua:",
        // Flight Settings
        "flightSettingsTitle": "🛩️ Impostazioni di Volo",
        "defaultAltitudeLabel": "Altitudine Predefinita (m) <span style='font-style: italic; color: #95a5a6;'>(Rif. al Decollo)</span>",
        "flightSpeedLabel": "Velocità di Volo (m/s)",
        "pathTypeLabel": "Tipo di Percorso (Curvata)",
        "pathTypeStraight": "Rettilineo (ToPointAndStopWithContinuity)",
        "pathTypeCurved": "Curvato (ToPointAndPassWithContinuity)",
        // Waypoints
        "waypointsTitle": "📍 Waypoint",
        "selectAllWaypointsLabel": "Seleziona/Deseleziona Tutti",
        "clearAllWaypointsBtn": "Cancella Tutti i Waypoint",
        "clickMapToAddWaypoints": "Clicca sulla mappa per aggiungere waypoint.",
        // Multi-Edit
        "multiEditTitle": "Modifica Waypoint Selezionati",
        "multiEditTitleText": "⚙️ Modifica {count} Waypoint Selezionati",
        "multiEditHeadingLabel": "Nuovo Controllo Rotta",
        "multiEditNoChange": "-- Non Modificare --",
        "multiEditFixedHeadingLabel": "Nuova Rotta Fissa (°)",
        "multiEditCameraActionLabel": "Nuova Azione Fotocamera",
        "multiEditGimbalPitchLabel": "Nuovo Pitch Gimbal (°)",
        "multiEditHoverTimeLabel": "Nuovo Tempo di Stazionamento (s)",
        "multiEditChangeBtn": "Modifica",
        "applyToSelectedBtn": "Applica ai Selezionati",
        "cancelMultiSelectionBtn": "Annulla Selezione Multipla",
        "multiEditSelectPoiDropdown": "-- Seleziona POI per tutti --",
        // Waypoint Settings
        "waypointSettingsTitle": "⚙️ Impostazioni Waypoint",
        "altitudeLabel": "Altitudine (m) <span style='font-style: italic; color: #95a5a6;'>(Rif. al Decollo)</span>",
        "hoverTimeLabel": "Tempo di Stazionamento (s)",
        "gimbalPitchLabel": "Pitch Gimbal (°)",
        "headingControlLabel": "Controllo Rotta",
        "headingControlAuto": "Auto (Segue la linea)",
        "headingControlFixed": "Rotta Fissa (Blocca direzione)",
        "headingControlPoi": "Tracciamento POI (Verso il POI)",
        "targetPoiForHeadingLabel": "POI Target per la Rotta",
        "selectPoiForHeadingDropdown": "-- Seleziona POI per la rotta --",
        "fixedHeadingLabel": "Rotta Fissa (°)",
        "cameraActionsTitle": "📸 Azioni Fotocamera",
        "cameraActionAtWaypointLabel": "Azione Fotocamera al Waypoint",
        "cameraActionNone": "Nessuna Azione",
        "cameraActionTakePhoto": "Scatta Foto",
        "cameraActionStartRecord": "Avvia Registrazione",
        "cameraActionStopRecord": "Ferma Registrazione",
        "deleteWaypointBtn": "Elimina Waypoint",
        // POI
        "poiTitle": "🎯 Punti di Interesse",
        "poiNamePlaceholder": "Nome POI",
        "poiObjectHeightLabel": "Altezza Oggetto POI (sopra il suo terreno, m):",
        "poiObjectHeightTitle": "Altezza dell'oggetto POI rispetto al suo terreno di base.",
        "poiTerrainElevationLabel": "Elev. Terreno POI (MSL, m):",
        "poiTerrainElevationTitle": "Elevazione del terreno MSL alla base del POI. Modificabile se il recupero automatico fallisce.",
        "refetchBtn": "⟳ Riprova",
        "refetchBtnTitle": "Tenta di recuperare di nuovo l'elevazione del terreno per l'ultimo POI aggiunto/selezionato dalle coordinate Lat/Lng del POI.",
        "poiTerrainElevationDesc": "(Riempito da Ctrl+Click sulla mappa. Modifica se necessario.)",
        "poiFinalAltitudeLabel": "Altitudine Finale POI (MSL, m):",
        "poiAddInstructionCtrlClick": "Ctrl + Click sulla mappa per aggiungere POI e recuperare elev. terreno",
        "noPoisAvailable": "Nessun POI Disponibile",
        "noPoisAdded": "Nessun POI ancora aggiunto.",
        "deletePoiTitle": "Elimina POI '{poiName}'",
        "poiObjectHeightListLabel": "H. Ogg.(m)",
        "poiTerrainElevListLabel": "Elev. Terr.(m)",
        "poiFinalAltitudeListLabel": "AMSL Finale",
        "NA": "N/D",
        "NAedit": "N/D, modifica",
        "invalidPoiObjectHeight": "Valore non valido. Inserire un numero non negativo.",
        "invalidPoiTerrainElev": "Valore non valido. Inserire un numero.",
        // Survey Missions
        "surveyMissionsTitle": "🗺️ Missioni di Rilievo",
        "noSurveyMissions": "Nessuna missione di rilievo creata.",
        "editMissionBtn": "Modifica",
        "deleteMissionBtn": "Elimina",
        "missionLabel": "Missione",
        // Terrain & Orbit
        "terrainOrbitTitle": "🏞️ Strumenti Terreno & Orbita",
        "takeoffElevationLabel": "Elevazione Decollo (MSL, m)",
        "useWp1ElevationBtn": "Usa Elev. WP1",
        "adaptPathAltTitle": "Adatta Altitudini Percorso:",
        "desiredAGLLabel": "Target Costante AGL (m):",
        "adaptAGLBtn": "Imposta AGL Costante",
        "desiredAMSLLabel": "Target Costante AMSL (m):",
        "adaptAMSLBtn": "Imposta AMSL Costante",
        "currentPathModeLabel": "Modalità Altitudine Percorso:",
        "pathModeRelative": "Relativa al Decollo",
        "pathModeAGL": "AGL Costante",
        "pathModeAMSL": "AMSL Costante",
        "createOrbitBtn": "Crea Orbita POI",
        "createSurveyGridBtn": "Crea Griglia Rilievo",
        // File Ops
        "fileOpsTitle": "📁 Operazioni File",
        "importJsonBtn": "Importa Piano Volo (.json)",
        "exportJsonBtn": "Esporta Piano Volo (.json)",
        "exportKmzBtn": "Esporta DJI WPML (.kmz)",
        "exportGoogleEarthBtn": "Esporta per Google Earth (.kml)",
        // Stats
        "statsTitle": "📊 Statistiche di Volo",
        "statsTotalDistance": "Distanza Totale:",
        "statsEstFlightTime": "Tempo Volo Stimato:",
        "statsWaypoints": "Waypoint:",
        "statsPOIs": "POI:",

        // --- Map Buttons ---
        "mapBtnSatellite": "📡 Satellite",
        "mapBtnMap": "🗺️ Mappa",
        "mapBtnFitView": "🎯 Centra Vista",
        "mapBtnMyLocation": "📍 Mia Posizione",

        // --- Modals ---
        // Orbit Modal
        "createOrbitModalTitle": "Crea Orbita POI",
        "orbitModalCenterPoiLabel": "POI Centrale:",
        "orbitModalRadiusLabel": "Raggio (m):",
        "orbitModalNumWaypointsLabel": "Numero di Waypoint:",
        "cancelBtn": "Annulla",
        "createOrbitBtnModal": "Crea Orbita",
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
        "surveyGridAngleDesc": "Direzione delle linee di volo (0°=Nord, 90°=Est).",
        "drawGridAngleBtn": "Imposta Angolo Disegnando",
        "surveyAreaStatusDefault": "Area non definita.",
        "surveyAreaStatusDefined": "Area definita: {points} punti.",
        "startDrawingSurveyAreaBtn": "Inizia a Disegnare",
        "finalizeSurveyAreaBtn": "Finalizza Area",
        "generateGridBtn": "Genera Griglia",
        "updateGridBtn": "Aggiorna Griglia",
        
        // --- Dynamic UI text (JS) ---
        "waypointLabel": "Waypoint",
        "flightAltRelLabel": "Alt Volo (Rel)",
        "amslAltLabel": "Alt AMSL",
        "aglAltLabel": "Alt AGL",
        "terrainElevLabel": "Elev Terreno",
        "hoverLabel": "Staz.",
        "gimbalLabel": "Gimbal",
        "actionLabel": "Azione",
        "cameraActionText_takePhoto": "Foto",
        "cameraActionText_startRecord": "Avvia Reg.",
        "cameraActionText_stopRecord": "Ferma Reg.",
        "cameraActionText_none": "Nessuna",

        // --- Alerts & Notifications ---
        "alert_welcome": "Benvenuto nel Pianificatore di Volo! Clicca sulla mappa per aggiungere waypoint (Ctrl+Click per i POI).",
        "alert_waypointInserted": "Waypoint {wpId} inserito nel percorso di volo.",
        "alert_couldNotInsertWaypoint": "Impossibile determinare dove inserire il waypoint nel percorso.",
        "alert_noPoiForTerrainFetch": "Nessun POI selezionato o disponibile per cui recuperare l'elevazione del terreno.",
        "alert_addWpForTakeoffElev": "Aggiungi almeno un waypoint per recuperare l'elevazione di decollo.",
        "alert_fetchingWp1Elev": "Recupero elevazione per WP1...",
        "alert_takeoffElevFromWp1Set": "Elevazione di decollo impostata a {elev}m MSL in base al Waypoint 1.",
        "alert_takeoffElevFromWp1Fail": "Impossibile recuperare l'elevazione per il Waypoint 1.",
        "alert_invalidDesiredAGL": "Valore AGL Desiderato non valido. Deve essere un numero positivo.",
        "alert_invalidTakeoffElev": "Elevazione di Decollo (MSL) non valida. Inserire un numero valido.",
        "alert_noWaypointsToAdapt": "Nessun waypoint da adattare.",
        "alert_fetchingTerrainForAllWp": "Recupero dati terreno per tutti i waypoint...",
        "alert_adaptingAglAlts_wp": "Adattamento altitudini (AGL)... WP {wpId} ({current}/{total})",
        "alert_adaptAglSuccess": "Tutte le altitudini dei waypoint sono state adattate a un AGL costante.",
        "alert_adaptAglPartial": "Adattate {count} di {total} altitudini. Alcune fallite per dati terreno mancanti.",
        "alert_adaptAglFail": "Impossibile adattare le altitudini. Dati terreno non recuperati.",
        "alert_invalidDesiredAMSL": "Valore AMSL Desiderato non valido. Inserire un numero valido.",
        "alert_adaptingAmslAlts": "Adattamento altitudini a AMSL costante...",
        "alert_adaptAmslSuccess": "Tutte le altitudini dei waypoint impostate per un volo a {amslTarget}m AMSL.",
        "alert_invalidPoiObjectHeight": "Altezza oggetto non valida. Inserire un numero non negativo.",
        "invalidPoiTerrainElev": "Elevazione terreno non valida. Inserire un numero.",
        "alert_elevationApiError_batch": "Errore API Elevazione (Batch {batchNum}): Stato {status}. Controlla la console per dettagli.",
        "alert_elevationApiNoData_batch": "Avviso API Elevazione (Batch {batchNum}): Stato '{status}'. Nessun dato ricevuto.",
        "alert_elevationFetchError_batch": "Errore di rete o parsing nel recupero elevazione (Batch {batchNum}).",
        "alert_surveyAreaMinPoints": "L'area richiede almeno {minPoints} punti.",
        "alert_surveyDrawingActive": "Disegno area di rilievo: Clicca sulla mappa per aggiungere gli angoli. Clicca sul primo punto (min 3 totali) per finalizzare.",
        "alert_surveyGridNoWps": "Nessun waypoint generato all'interno del poligono. Controlla i parametri.",
        "alert_surveyGridSuccess": "{count} waypoint di rilievo generati!",
        "alert_surveyGridError": "Errore durante la generazione della griglia.",
        "alert_surveyGridInvalidInput_angle": "Angolo griglia non valido.",
        "alert_drawAngleInstruction": "Clicca e trascina sulla mappa per disegnare una linea che definisca la direzione delle linee di volo.",
        "alert_surveyGridInvalidInput_speed": "Velocità di volo non valida.",
        "alert_surveyGridInvalidPoly": "Poligono non valido per la generazione.",
        "alert_surveyGridInvalidParams": "Parametri griglia non validi. Controlla i valori di spaziatura.",
        "alert_surveyGridTooManyLines": "Troppe linee di volo generate (>2000). Controlla i parametri (sidelap, dimensione area).",
        "alert_surveyGridInvalidInput_altitude": "Altitudine non valida.",
        "alert_surveyGridInvalidInput_sidelap": "Sidelap % non valido (10-95).",
        "alert_surveyGridInvalidInput_frontlap": "Frontlap % non valido (10-95).",
        "alert_deleteSurveyMissionConfirm": "Sei sicuro di voler eliminare '{missionName}' e i suoi {wpCount} waypoint? L'azione non può essere annullata.",
        "alert_missionUpdated": "La Missione di Rilievo '{missionName}' è stata aggiornata.",
        "error_min_waypoints": "Sono necessari almeno 2 waypoint per una missione.",
        "error_invalid_coordinates": "Coordinate non valide.",
        "error_altitude_range": "Altitudine fuori range (2-500m).",
        "error_gimbal_range": "Pitch del gimbal fuori range (-90° a +60°).",
        "import_success": "Piano di volo importato con successo!",
        "nothing_to_export": "Niente da esportare.",
        "export_json_success": "Piano di volo esportato come JSON.",
        "export_ge_success": "Esportato per Google Earth.",
        "export_dji_success": "DJI WPML KMZ esportato.",
        "jszip_not_loaded": "Libreria JSZip non caricata."
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
    if (typeof updateSurveyMissionsList === 'function') updateSurveyMissionsList();
    if (typeof updatePathModeDisplay === 'function') updatePathModeDisplay();
    if (typeof updateSingleWaypointEditControls === 'function') updateSingleWaypointEditControls();
    if (typeof updateMultiEditPanelVisibility === 'function') updateMultiEditPanelVisibility();

    if (typeof satelliteToggleBtn !== 'undefined' && satelliteToggleBtn && typeof satelliteView !== 'undefined') {
        const key = satelliteView ? 'mapBtnMap' : 'mapBtnSatellite';
        satelliteToggleBtn.textContent = translate(key);
    }
}
