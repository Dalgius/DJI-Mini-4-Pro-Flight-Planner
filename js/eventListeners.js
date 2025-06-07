// File: eventListeners.js

// Depends on: config.js (for DOM element vars, initialApplyMultiEditBtnReference), 
// domCache.js (to ensure elements are cached)
// Depends on: All manager modules for their respective functions called by event handlers

function setupEventListeners() {
    // --- Flight Settings Panel ---
    if (defaultAltitudeSlider) { /* ... (come prima) ... */ }
    if (flightSpeedSlider) { /* ... (come prima) ... */ }
    if (pathTypeSelect) { /* ... (come prima) ... */ }

    // --- Selected Waypoint Controls Panel ---
    if (waypointAltitudeSlider) { /* ... (come prima, con chiamate a updateGimbalForPoiTrack) ... */ }
    if (hoverTimeSlider) { /* ... (come prima) ... */ }
    if (gimbalPitchSlider) { /* ... (come prima) ... */ }
    if (fixedHeadingSlider) { /* ... (come prima) ... */ }
    if (headingControlSelect) { /* ... (come prima, con chiamate a updateGimbalForPoiTrack) ... */ }
    if (targetPoiSelect) { /* ... (come prima, con chiamate a updateGimbalForPoiTrack) ... */ }
    if (cameraActionSelect) { /* ... (come prima) ... */ }
    if (deleteSelectedWaypointBtn) { /* ... (come prima) ... */ }

    // --- POI Input Fields in Sidebar ---
    if (poiObjectHeightInputEl) { /* ... (come prima) ... */ }
    if (poiTerrainElevationInputEl) { /* ... (come prima) ... */ }
    if (refetchPoiTerrainBtnEl) { /* ... (come prima) ... */ }

    // --- Multi-Waypoint Edit Panel ---
    if (selectAllWaypointsCheckboxEl) { /* ... (come prima) ... */ }
    if (multiHeadingControlSelect) { /* ... (come prima, con gestione visibilità sottocampi) ... */ }
    if (multiFixedHeadingSlider) { /* ... (come prima) ... */ }
    if (multiChangeGimbalPitchCheckbox) { /* ... (come prima) ... */ }
    if (multiGimbalPitchSlider) { /* ... (come prima) ... */ }
    if (multiChangeHoverTimeCheckbox) { /* ... (come prima) ... */ }
    if (multiHoverTimeSlider) { /* ... (come prima) ... */ }

    // Listener per applyMultiEditBtn con controllo sulla referenza
    if (applyMultiEditBtn) {
        if (typeof initialApplyMultiEditBtnReference !== 'undefined' && applyMultiEditBtn !== initialApplyMultiEditBtnReference) {
            console.error("DEBUG eventListeners: ERRORE GRAVE - applyMultiEditBtn è stato ricreato dopo domCache! Il listener potrebbe non funzionare o essere attaccato all'elemento sbagliato.");
            // In uno scenario reale, qui si potrebbe tentare di ri-agganciare il listener
            // o sollevare un errore più visibile.
            // Per ora, proviamo comunque ad aggiungerlo, ma il problema principale è la ricreazione.
        } else {
            console.log("DEBUG eventListeners: Trovato applyMultiEditBtn (riferimento iniziale OK), aggiungo listener.");
        }
        
        applyMultiEditBtn.addEventListener('click', function() {
            console.log("Pulsante 'Apply to Selected' CLICCATO! Chiamata a applyMultiEdit in corso...");
            applyMultiEdit();
        });
    } else {
        console.error("DEBUG eventListeners: ERRORE - applyMultiEditBtn non trovato durante setupEventListeners!");
    }
    
    /*
    // OPZIONE ALTERNATIVA: DELEGA DEGLI EVENTI (più robusta alla ricreazione degli elementi figli)
    // Se il metodo sopra non funziona a causa della ricreazione del pulsante, prova questo:
    // Commenta il blocco if (applyMultiEditBtn) { ... } qui sopra e decommenta questo.
    const multiEditControlsPanel = document.getElementById('multiWaypointEditControls');
    if (multiEditControlsPanel) {
        console.log("DEBUG eventListeners: Aggiungo listener DELEGATO a multiEditControlsPanel per applyMultiEditBtn");
        multiEditControlsPanel.addEventListener('click', function(event) {
            // Controlla se l'elemento cliccato (event.target) o un suo antenato è il pulsante desiderato.
            // Usiamo closest per gestire il caso in cui si clicca su uno span o icona dentro al pulsante.
            if (event.target.closest('#applyMultiEditBtn')) { 
                console.log("Pulsante 'Apply to Selected' CLICCATO (via delega)! Chiamata a applyMultiEdit in corso...");
                applyMultiEdit();
            }
        });
    } else {
        console.error("DEBUG eventListeners: ERRORE - multiEditControlsPanel non trovato per la delega degli eventi!");
    }
    */


    if (clearMultiSelectionBtn) { /* ... (come prima) ... */ }

    // --- Terrain & Orbit Tools ---
    if (homeElevationMslInput) { /* ... (come prima, con listener 'change') ... */ }
    if (getHomeElevationBtn) { /* ... (come prima) ... */ }
    if (adaptToAGLBtnEl) { /* ... (come prima) ... */ }
    if (adaptToAMSLBtnEl) { /* ... (come prima, con listener per il nuovo pulsante) ... */ }
    if (createOrbitBtn) { /* ... (come prima) ... */ }

    // --- Survey Grid Modal ---
    if (createSurveyGridBtn) { /* ... (come prima) ... */ }
    // ... (altri listener survey)

    // --- Import/Export Buttons ---
    if (importJsonBtn) { /* ... (come prima) ... */ }
    if (fileInputEl) { /* ... (come prima) ... */ }
    // ... (altri listener import/export)

    // --- General Action Buttons ---
    if (clearWaypointsBtn) { /* ... (come prima) ... */ }

    // --- Map Control Buttons ---
    if (satelliteToggleBtn) { /* ... (come prima) ... */ }
    // ... (altri controlli mappa)

    // --- Modal Buttons ---
    if (customAlertOkButtonEl) { /* ... (come prima) ... */ }
    // ... (altri bottoni modali)
}

// Copia le TUE funzioni complete di eventListeners.js qui, io ho solo aggiunto i log e il controllo.
// Assicurati che le funzioni abbreviate con /* ... (come prima) ... */ siano complete.
// Ad esempio:
// if (defaultAltitudeSlider) { defaultAltitudeSlider.addEventListener('input', () => { if (defaultAltitudeValueEl) defaultAltitudeValueEl.textContent = defaultAltitudeSlider.value + 'm'; if (selectedWaypoint && selectedWaypoint.headingControl === 'poi_track') { updateGimbalForPoiTrack(selectedWaypoint, true); } });}
// ...e così via per tutte le altre.
