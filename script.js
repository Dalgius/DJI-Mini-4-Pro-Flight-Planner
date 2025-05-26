// File: script.js

// Variabili Globali
let map;
let waypoints = [];
let pois = [];
let selectedWaypoint = null;
let flightPath = null;
let satelliteView = false;
let waypointCounter = 1;
let poiCounter = 1;
let actionGroupCounter = 1; 
let actionCounter = 1;      
let defaultTileLayer, satelliteTileLayer, userLocationMarker;

// Cache Elementi DOM
let defaultAltitudeSlider, defaultAltitudeValueEl, flightSpeedSlider, flightSpeedValueEl;
let waypointAltitudeSlider, waypointAltitudeValueEl, hoverTimeSlider, hoverTimeValueEl;
let gimbalPitchSlider, gimbalPitchValueEl, fixedHeadingSlider, fixedHeadingValueEl;
let headingControlSelect, fixedHeadingGroupDiv, waypointControlsDiv, pathTypeSelect;
let waypointListEl, poiListEl, poiNameInput, cameraActionSelect;
let totalDistanceEl, flightTimeEl, waypointCountEl, poiCountEl;
let targetPoiSelect, multiTargetPoiSelect, multiTargetPoiForHeadingGroupDiv, targetPoiForHeadingGroupDiv;
let homeElevationMslInput, desiredAGLInput, adaptToAGLBtnEl, loadingOverlayEl;

let selectedForMultiEdit = new Set();
let multiWaypointEditControlsDiv, selectedWaypointsCountEl;
let multiHeadingControlSelect, multiFixedHeadingGroupDiv, multiFixedHeadingSlider, multiFixedHeadingValueEl;
let multiCameraActionSelect;
let multiChangeGimbalPitchCheckbox, multiGimbalPitchSlider, multiGimbalPitchValueEl;
let multiChangeHoverTimeCheckbox, multiHoverTimeSlider, multiHoverTimeValueEl;
let selectAllWaypointsCheckboxEl;

// Pulsanti Sidebar
let clearWaypointsBtn, applyMultiEditBtn, clearMultiSelectionBtn, deleteSelectedWaypointBtn;
let getHomeElevationBtn, createOrbitBtn, importJsonBtn, exportJsonBtn, exportKmzBtn, exportGoogleEarthBtn;

// Pulsanti Mappa
let satelliteToggleBtn, fitMapBtn, myLocationBtn;

// Elementi Modale Personalizzata
let customAlertOverlayEl, customAlertMessageEl, customAlertOkButtonEl, customAlertTitleEl;
let orbitModalOverlayEl, orbitPoiSelectEl, orbitRadiusInputEl, orbitPointsInputEl, confirmOrbitBtnEl, cancelOrbitBtnEl;

document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
    cacheDOMElements();
    initializeMap();
    setupEventListeners(); 
    updateWaypointList(); 
    updatePOIList(); 
    updateFlightStatistics(); 
    updateMultiEditPanelVisibility();
}

function cacheDOMElements() {
    defaultAltitudeSlider = document.getElementById('defaultAltitude');
    defaultAltitudeValueEl = document.getElementById('defaultAltitudeValue');
    flightSpeedSlider = document.getElementById('flightSpeed');
    flightSpeedValueEl = document.getElementById('flightSpeedValue');
    pathTypeSelect = document.getElementById('pathType');

    waypointAltitudeSlider = document.getElementById('waypointAltitude');
    waypointAltitudeValueEl = document.getElementById('waypointAltitudeValue');
    hoverTimeSlider = document.getElementById('hoverTime');
    hoverTimeValueEl = document.getElementById('hoverTimeValue');
    gimbalPitchSlider = document.getElementById('gimbalPitch');
    gimbalPitchValueEl = document.getElementById('gimbalPitchValue');
    fixedHeadingSlider = document.getElementById('fixedHeading');
    fixedHeadingValueEl = document.getElementById('fixedHeadingValue');

    headingControlSelect = document.getElementById('headingControl');
    fixedHeadingGroupDiv = document.getElementById('fixedHeadingGroup');
    waypointControlsDiv = document.getElementById('waypointControls');
    cameraActionSelect = document.getElementById('cameraActionSelect');
    targetPoiSelect = document.getElementById('targetPoiSelect');
    targetPoiForHeadingGroupDiv = document.getElementById('targetPoiForHeadingGroup');

    waypointListEl = document.getElementById('waypointList');
    poiListEl = document.getElementById('poiList');
    poiNameInput = document.getElementById('poiName');

    totalDistanceEl = document.getElementById('totalDistance');
    flightTimeEl = document.getElementById('flightTime');
    waypointCountEl = document.getElementById('waypointCount');
    poiCountEl = document.getElementById('poiCount');

    selectAllWaypointsCheckboxEl = document.getElementById('selectAllWaypointsCheckbox');
    multiWaypointEditControlsDiv = document.getElementById('multiWaypointEditControls');
    selectedWaypointsCountEl = document.getElementById('selectedWaypointsCount');
    multiHeadingControlSelect = document.getElementById('multiHeadingControl');
    multiFixedHeadingGroupDiv = document.getElementById('multiFixedHeadingGroup');
    multiFixedHeadingSlider = document.getElementById('multiFixedHeading');
    multiFixedHeadingValueEl = document.getElementById('multiFixedHeadingValue');
    multiCameraActionSelect = document.getElementById('multiCameraActionSelect');
    multiChangeGimbalPitchCheckbox = document.getElementById('multiChangeGimbalPitchCheckbox');
    multiGimbalPitchSlider = document.getElementById('multiGimbalPitch');
    multiGimbalPitchValueEl = document.getElementById('multiGimbalPitchValue');
    multiChangeHoverTimeCheckbox = document.getElementById('multiChangeHoverTimeCheckbox');
    multiHoverTimeSlider = document.getElementById('multiHoverTime');
    multiHoverTimeValueEl = document.getElementById('multiHoverTimeValue');
    multiTargetPoiSelect = document.getElementById('multiTargetPoiSelect');
    multiTargetPoiForHeadingGroupDiv = document.getElementById('multiTargetPoiForHeadingGroup');

    homeElevationMslInput = document.getElementById('homeElevationMsl');
    desiredAGLInput = document.getElementById('desiredAGL');
    adaptToAGLBtnEl = document.getElementById('adaptToAGLBtn');
    loadingOverlayEl = document.getElementById('loadingOverlay');

    clearWaypointsBtn = document.getElementById('clearWaypointsBtn');
    applyMultiEditBtn = document.getElementById('applyMultiEditBtn');
    clearMultiSelectionBtn = document.getElementById('clearMultiSelectionBtn');
    deleteSelectedWaypointBtn = document.getElementById('deleteSelectedWaypointBtn');
    getHomeElevationBtn = document.getElementById('getHomeElevationBtn');
    createOrbitBtn = document.getElementById('createOrbitBtn');
    importJsonBtn = document.getElementById('importJsonBtn');
    exportJsonBtn = document.getElementById('exportJsonBtn');
    exportKmzBtn = document.getElementById('exportKmzBtn');
    exportGoogleEarthBtn = document.getElementById('exportGoogleEarthBtn');
    satelliteToggleBtn = document.getElementById('satelliteToggleBtn');
    fitMapBtn = document.getElementById('fitMapBtn');
    myLocationBtn = document.getElementById('myLocationBtn');

    customAlertOverlayEl = document.getElementById('customAlertOverlay');
    customAlertMessageEl = document.getElementById('customAlertMessage');
    customAlertOkButtonEl = document.getElementById('customAlertOkButton');
    customAlertTitleEl = document.getElementById('customAlertTitle');

    orbitModalOverlayEl = document.getElementById('orbitModalOverlay');
    orbitPoiSelectEl = document.getElementById('orbitPoiSelect');
    orbitRadiusInputEl = document.getElementById('orbitRadiusInput');
    orbitPointsInputEl = document.getElementById('orbitPointsInput');
    confirmOrbitBtnEl = document.getElementById('confirmOrbitBtn');
    cancelOrbitBtnEl = document.getElementById('cancelOrbitBtn');

    defaultAltitudeValueEl.textContent = defaultAltitudeSlider.value + 'm';
    flightSpeedValueEl.textContent = flightSpeedSlider.value + ' m/s';
    multiFixedHeadingValueEl.textContent = multiFixedHeadingSlider.value + '°';
    multiGimbalPitchValueEl.textContent = multiGimbalPitchSlider.value + '°';
    multiHoverTimeValueEl.textContent = multiHoverTimeSlider.value + 's';
    if(gimbalPitchSlider && gimbalPitchValueEl) gimbalPitchValueEl.textContent = gimbalPitchSlider.value + '°'; 
}

function initializeMap() {
    map = L.map('map', { maxZoom: 22 }).setView([37.7749, -122.4194], 13);
    defaultTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', maxZoom: 22, maxNativeZoom: 19 
    }).addTo(map);
    satelliteTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri', maxZoom: 22, maxNativeZoom: 21 
    });
    map.on('click', e => {
        if (e.originalEvent.target === map.getContainer()) { // Solo se il click è direttamente sulla mappa
             if (e.originalEvent.ctrlKey) {
                addPOI(e.latlng);
            } else {
                addWaypoint(e.latlng);
            }
        }
    });
    map.on('contextmenu', e => e.originalEvent.preventDefault());
}

// ... (tutte le altre funzioni da populatePoiSelectDropdown fino a showCurrentLocation sono invariate)
// LE INCOLLO PER COMPLETEZZA

function populatePoiSelectDropdown(selectElement, selectedPoiId = null, addDefaultOption = true, defaultOptionText = "-- Select POI --") {
    selectElement.innerHTML = ''; 
    if (addDefaultOption) {
        const defaultOpt = document.createElement('option');
        defaultOpt.value = "";
        defaultOpt.textContent = defaultOptionText;
        selectElement.appendChild(defaultOpt);
    }
    if (pois.length === 0) {
         selectElement.disabled = true;
         if(addDefaultOption && selectElement.options[0]) selectElement.options[0].textContent = "No POIs available";
         return;
    }
    selectElement.disabled = false;
    if(addDefaultOption && selectElement.options[0] && selectElement.options[0].textContent === "No POIs available" ) {
        selectElement.options[0].textContent = defaultOptionText;
    }

    pois.forEach(poi => {
        const option = document.createElement('option');
        option.value = poi.id;
        option.textContent = `${poi.name} (ID: ${poi.id})`;
        if (selectedPoiId != null && poi.id === parseInt(selectedPoiId)) { 
            option.selected = true;
        }
        selectElement.appendChild(option);
    });
}

// ... (all'inizio del file script.js, dopo la definizione delle variabili globali e cacheDOMElements) ...
// Inserisci questo blocco di codice nel tuo script.js,
// preferibilmente prima della funzione setupEventListeners()

function showCustomAlert(message, title = "Notification") {
    // Assicurati che customAlertMessageEl, customAlertOverlayEl, customAlertTitleEl siano definiti
    // e cachati in cacheDOMElements()
    if (customAlertMessageEl && customAlertOverlayEl && customAlertTitleEl) {
        customAlertTitleEl.textContent = title;
        customAlertMessageEl.textContent = message;
        customAlertOverlayEl.style.display = 'flex';
    } else { 
        console.error("Elementi per customAlert non trovati!");
        alert(message); // Fallback
    }
}

function generateOrbitWaypoints(centerPoi, radius, numPoints, altitude) {
    const R_EARTH = 6371000; // Raggio della Terra in metri
    for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI; // Angolo in radianti

        const latRad = centerPoi.latlng.lat * Math.PI / 180;
        const lngRad = centerPoi.latlng.lng * Math.PI / 180;

        // Calcolo coordinate punto orbita
        const pointLatRad = Math.asin(Math.sin(latRad)*Math.cos(radius/R_EARTH) + 
                                    Math.cos(latRad)*Math.sin(radius/R_EARTH)*Math.cos(angle));
        const pointLngRad = lngRad + Math.atan2(Math.sin(angle)*Math.sin(radius/R_EARTH)*Math.cos(latRad), 
                                             Math.cos(radius/R_EARTH)-Math.sin(latRad)*Math.sin(pointLatRad));

        const pointLat = pointLatRad * 180 / Math.PI;
        const pointLng = pointLngRad * 180 / Math.PI;

        const wpLatlng = L.latLng(pointLat, pointLng);

        // Chiama addWaypoint per creare e aggiungere il waypoint
        addWaypoint(wpLatlng); 
        const newWp = waypoints[waypoints.length-1]; // Prendi l'ultimo waypoint aggiunto
        newWp.altitude = altitude;
        newWp.headingControl = 'poi_track'; 
        newWp.targetPoiId = centerPoi.id; // Associa il POI centrale
        // Usa il valore corrente del gimbal pitch dal pannello generale o un default sensato
        newWp.gimbalPitch = parseInt(document.getElementById('gimbalPitch').value) || 0; 

        // Se il waypoint appena aggiunto è quello attualmente selezionato (improbabile qui, ma per coerenza)
        if (selectedWaypoint && selectedWaypoint.id === newWp.id) {
             selectWaypoint(newWp); // Aggiorna i controlli dell'UI per questo waypoint
        }
    }
    fitMapToWaypoints(); // Adatta la vista della mappa per includere i nuovi waypoint
}

function handleConfirmOrbit() {
    // Assicurati che orbitPoiSelectEl, orbitRadiusInputEl, orbitPointsInputEl siano definiti
    // e cachati in cacheDOMElements()
    if (!orbitPoiSelectEl || !orbitRadiusInputEl || !orbitPointsInputEl) {
        console.error("Elementi della modale orbita non trovati!");
        showCustomAlert("Orbit modal elements are missing. Cannot create orbit.", "Internal Error");
        return;
    }

    const targetPoiId = parseInt(orbitPoiSelectEl.value);
    const radius = parseFloat(orbitRadiusInputEl.value);
    const numPoints = parseInt(orbitPointsInputEl.value);
    const targetPoi = pois.find(p => p.id === targetPoiId);

    if (!targetPoi) { 
        showCustomAlert("Invalid POI selected for orbit. Please select a valid POI.", "Orbit Error"); 
        return; 
    }
    if (isNaN(radius) || radius <= 0) { 
        showCustomAlert("Invalid radius. Must be a positive number.", "Orbit Error"); 
        return; 
    }
    if (isNaN(numPoints) || numPoints < 3) { 
        showCustomAlert("Invalid number of points. Minimum 3 for orbit.", "Orbit Error"); 
        return; 
    }

    generateOrbitWaypoints(targetPoi, radius, numPoints, parseInt(defaultAltitudeSlider.value));

    if (orbitModalOverlayEl) orbitModalOverlayEl.style.display = 'none'; // Nascondi la modale
}

function showOrbitDialog() { 
    // Assicurati che orbitModalOverlayEl, orbitPoiSelectEl siano definiti
    // e cachati in cacheDOMElements()
    if (!orbitModalOverlayEl || !orbitPoiSelectEl) {
        console.error("Orbit modal overlay or POI select element not found!");
        showCustomAlert("Orbit dialog cannot be displayed. Elements missing.", "Internal Error");
        return;
    }
    if (pois.length === 0) { 
        showCustomAlert("Add at least one POI before creating an orbit.", "Orbit Error"); 
        return; 
    }

    populatePoiSelectDropdown(orbitPoiSelectEl, null, false); // Popola senza opzione di default
    if (pois.length > 0 && orbitPoiSelectEl.options.length > 0) { 
        orbitPoiSelectEl.value = pois[0].id; // Preseleziona il primo POI
    } else if (pois.length === 0) { 
         showCustomAlert("No POIs available to select for orbit.", "Orbit Error");
         return;
    }

    if (orbitRadiusInputEl) orbitRadiusInputEl.value = "30"; 
    if (orbitPointsInputEl) orbitPointsInputEl.value = "8";  
    orbitModalOverlayEl.style.display = 'flex';
}

// QUI DOVREBBE SEGUIRE LA TUA FUNZIONE setupEventListeners()
// E POI TUTTE LE ALTRE FUNZIONI DEL TUO script.js

// Esempio:
// function setupEventListeners() {
//     // ...
//     if (createOrbitBtn) createOrbitBtn.addEventListener('click', showOrbitDialog); // Ora showOrbitDialog è definita
//     // ...
//     if(confirmOrbitBtnEl) confirmOrbitBtnEl.addEventListener('click', handleConfirmOrbit);
//     // ...
// }
function exportFlightPlan() { 
    if (waypoints.length === 0 && pois.length === 0) { 
        showCustomAlert("Nothing to export.", "Export Error"); // Usa showCustomAlert
        return; 
    }
    const plan = {
        waypoints: waypoints.map(wp => ({ 
            id:wp.id, lat:wp.latlng.lat, lng:wp.latlng.lng, 
            altitude:wp.altitude, hoverTime:wp.hoverTime, gimbalPitch:wp.gimbalPitch, 
            headingControl:wp.headingControl, fixedHeading:wp.fixedHeading,
            cameraAction: wp.cameraAction || 'none',
            targetPoiId: wp.targetPoiId === undefined ? null : wp.targetPoiId 
        })),
        pois: pois.map(p => ({ id:p.id, name:p.name, lat:p.latlng.lat, lng:p.latlng.lng, altitude: p.altitude })),
        settings: { 
            defaultAltitude: parseInt(defaultAltitudeSlider.value), 
            flightSpeed: parseFloat(flightSpeedSlider.value), 
            pathType: pathTypeSelect.value, 
            nextWaypointId: waypointCounter, nextPoiId: poiCounter 
        }
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(plan, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "flight_plan.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    document.body.removeChild(downloadAnchorNode);
}
function setupEventListeners() {
    // Listener per i controlli dei Flight Settings
    if (defaultAltitudeSlider) defaultAltitudeSlider.addEventListener('input', () => defaultAltitudeValueEl.textContent = defaultAltitudeSlider.value + 'm');
    if (flightSpeedSlider) flightSpeedSlider.addEventListener('input', () => {
        flightSpeedValueEl.textContent = flightSpeedSlider.value + ' m/s';
        updateFlightStatistics();
    });
    if (pathTypeSelect) pathTypeSelect.addEventListener('change', updateFlightPath);

    // Listener per i controlli del Waypoint Selezionato
    if (waypointAltitudeSlider) waypointAltitudeSlider.addEventListener('input', () => {
        if (!selectedWaypoint) return;
        waypointAltitudeValueEl.textContent = waypointAltitudeSlider.value + 'm';
        selectedWaypoint.altitude = parseInt(waypointAltitudeSlider.value);
        updateWaypointList();
    });
    if (hoverTimeSlider) hoverTimeSlider.addEventListener('input', () => {
        if (!selectedWaypoint) return;
        hoverTimeValueEl.textContent = hoverTimeSlider.value + 's';
        selectedWaypoint.hoverTime = parseInt(hoverTimeSlider.value);
        updateFlightStatistics();
        updateWaypointList();
    });
    if (gimbalPitchSlider) gimbalPitchSlider.addEventListener('input', () => {
        if (!selectedWaypoint) return;
        gimbalPitchValueEl.textContent = gimbalPitchSlider.value + '°';
        selectedWaypoint.gimbalPitch = parseInt(gimbalPitchSlider.value);
    });
    if (fixedHeadingSlider) fixedHeadingSlider.addEventListener('input', () => {
        if (!selectedWaypoint) return;
        fixedHeadingValueEl.textContent = fixedHeadingSlider.value + '°';
        selectedWaypoint.fixedHeading = parseInt(fixedHeadingSlider.value);
    });
    if (headingControlSelect) headingControlSelect.addEventListener('change', function() {
        if (!selectedWaypoint) return;
        fixedHeadingGroupDiv.style.display = this.value === 'fixed' ? 'block' : 'none';
        targetPoiForHeadingGroupDiv.style.display = this.value === 'poi_track' ? 'block' : 'none';
        selectedWaypoint.headingControl = this.value;
        if (this.value === 'poi_track') {
            populatePoiSelectDropdown(targetPoiSelect, selectedWaypoint.targetPoiId, true, "-- Select POI for Heading --");
        } else {
            selectedWaypoint.targetPoiId = null; 
        }
        updateWaypointList();
    });
    if (targetPoiSelect) targetPoiSelect.addEventListener('change', function() {
        if (selectedWaypoint) {
            selectedWaypoint.targetPoiId = this.value ? parseInt(this.value) : null;
            updateWaypointList();
        }
    });
    if (cameraActionSelect) cameraActionSelect.addEventListener('change', function() {
        if (selectedWaypoint) {
            selectedWaypoint.cameraAction = this.value;
            updateWaypointList(); 
        }
    });
    if (deleteSelectedWaypointBtn) deleteSelectedWaypointBtn.addEventListener('click', deleteSelectedWaypoint);


    // Listener per i controlli di Selezione Multipla Waypoint
    if (selectAllWaypointsCheckboxEl) selectAllWaypointsCheckboxEl.addEventListener('change', (e) => toggleSelectAllWaypoints(e.target.checked));
    if (multiHeadingControlSelect) multiHeadingControlSelect.addEventListener('change', function() {
        multiFixedHeadingGroupDiv.style.display = this.value === 'fixed' ? 'block' : 'none';
        multiTargetPoiForHeadingGroupDiv.style.display = this.value === 'poi_track' ? 'block' : 'none';
        if (this.value === 'poi_track') {
            populatePoiSelectDropdown(multiTargetPoiSelect, null, true, "-- Select POI for all --");
        }
    });
    if (multiFixedHeadingSlider) multiFixedHeadingSlider.addEventListener('input', function() {
        multiFixedHeadingValueEl.textContent = this.value + '°';
    });
    if (multiGimbalPitchSlider) multiGimbalPitchSlider.addEventListener('input', function() {
        multiGimbalPitchValueEl.textContent = this.value + '°';
    });
    if (multiHoverTimeSlider) multiHoverTimeSlider.addEventListener('input', function() {
        multiHoverTimeValueEl.textContent = this.value + 's';
    });
    if (multiChangeGimbalPitchCheckbox) multiChangeGimbalPitchCheckbox.addEventListener('change', function() {
        multiGimbalPitchSlider.disabled = !this.checked;
        if(!this.checked) multiGimbalPitchSlider.value = 0; 
        multiGimbalPitchValueEl.textContent = multiGimbalPitchSlider.value + '°';
    });
    if (multiChangeHoverTimeCheckbox) multiChangeHoverTimeCheckbox.addEventListener('change', function() {
        multiHoverTimeSlider.disabled = !this.checked;
         if(!this.checked) multiHoverTimeSlider.value = 0;
        multiHoverTimeValueEl.textContent = multiHoverTimeSlider.value + 's';
    });
    if (applyMultiEditBtn) applyMultiEditBtn.addEventListener('click', applyMultiEdit);
    if (clearMultiSelectionBtn) clearMultiSelectionBtn.addEventListener('click', clearMultiSelection);


    // Listener per Pulsanti Generali della Sidebar
    if (clearWaypointsBtn) clearWaypointsBtn.addEventListener('click', clearWaypoints);
    if (getHomeElevationBtn) getHomeElevationBtn.addEventListener('click', getHomeElevationFromFirstWaypoint);
    if (adaptToAGLBtnEl) adaptToAGLBtnEl.addEventListener('click', adaptAltitudesToAGL);
    if (createOrbitBtn) createOrbitBtn.addEventListener('click', showOrbitDialog);
    if (importJsonBtn) importJsonBtn.addEventListener('click', triggerImport);
    if (exportJsonBtn) exportJsonBtn.addEventListener('click', exportFlightPlan);
    if (exportKmzBtn) exportKmzBtn.addEventListener('click', exportToDjiWpmlKmz);
    if (exportGoogleEarthBtn) exportGoogleEarthBtn.addEventListener('click', exportToGoogleEarth);

    const fileInputElement = document.getElementById('fileInput');
    if (fileInputElement) fileInputElement.addEventListener('change', handleFileImport);

    // Listener per i Pulsanti della Mappa
    if (satelliteToggleBtn) satelliteToggleBtn.addEventListener('click', toggleSatelliteView);
    if (fitMapBtn) fitMapBtn.addEventListener('click', fitMapToWaypoints);
    if (myLocationBtn) myLocationBtn.addEventListener('click', showCurrentLocation);

    // Listener per i Pulsanti delle Modali Personalizzate
    if(customAlertOkButtonEl) customAlertOkButtonEl.addEventListener('click', () => {
        if(customAlertOverlayEl) customAlertOverlayEl.style.display = 'none';
    });
    if(confirmOrbitBtnEl) confirmOrbitBtnEl.addEventListener('click', handleConfirmOrbit);
    if(cancelOrbitBtnEl) cancelOrbitBtnEl.addEventListener('click', () => {
       if(orbitModalOverlayEl) orbitModalOverlayEl.style.display = 'none';
    });
}

// ... (resto del tuo codice JavaScript: addWaypoint, createWaypointIcon, addPOI, selectWaypoint, ecc...)

function addWaypoint(latlng) {
    const waypoint = {
        id: waypointCounter++,
        latlng: L.latLng(latlng.lat, latlng.lng),
        altitude: parseInt(defaultAltitudeSlider.value),
        hoverTime: 0, 
        gimbalPitch: parseInt(document.getElementById('gimbalPitch').value),
        headingControl: 'auto', 
        fixedHeading: 0,
        cameraAction: 'none',
        targetPoiId: null
    };
    const marker = L.marker(waypoint.latlng, { draggable: true, icon: createWaypointIcon(waypoint.id, false) }).addTo(map);
    marker.on('click', e => { L.DomEvent.stopPropagation(e); selectWaypoint(waypoint); });
    marker.on('dragend', () => {
        waypoint.latlng = marker.getLatLng();
        updateFlightPath(); updateFlightStatistics(); updateWaypointList();
    });
    marker.on('drag', () => { waypoint.latlng = marker.getLatLng(); updateFlightPath(); });
    waypoint.marker = marker;
    waypoints.push(waypoint);
    updateWaypointList(); updateFlightPath(); updateFlightStatistics(); selectWaypoint(waypoint);
}

function createWaypointIcon(id, isSelected) { 
    const bgColor = isSelected ? '#e74c3c' : '#3498db';
    return L.divIcon({
        className: `waypoint-marker ${isSelected ? 'selected' : ''}`,
        html: `<div style="background: ${bgColor}; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${id}</div>`,
        iconSize: [24, 24], iconAnchor: [12, 12]
    });
}

function addPOI(latlng) { 
    if (pois.length === 0) {
        poiCounter = 1; 
    }
    const name = poiNameInput.value.trim() || `POI ${poiCounter}`;
    const poi = { 
        id: poiCounter++, 
        name, 
        latlng: L.latLng(latlng.lat, latlng.lng), 
        altitude: 0 
    }; 
    const marker = L.marker(poi.latlng, { draggable: true, icon: L.divIcon({ className: 'poi-marker', html: `<div style="background: #f39c12; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; border: 2px solid white;">🎯</div>`, iconSize: [20, 20], iconAnchor: [10, 10] }) }).addTo(map);
    marker.bindPopup(`<strong>${poi.name}</strong>`);
    marker.on('dragend', () => poi.latlng = marker.getLatLng());
    poi.marker = marker;
    pois.push(poi);
    updatePOIList(); 
    if(selectedWaypoint && headingControlSelect.value === 'poi_track') {
        populatePoiSelectDropdown(targetPoiSelect, selectedWaypoint.targetPoiId, true, "-- Select POI for Heading --");
    }
    if(multiWaypointEditControlsDiv.style.display === 'block' && multiHeadingControlSelect.value === 'poi_track') {
         populatePoiSelectDropdown(multiTargetPoiSelect, null, true, "-- Select POI for all --");
    }
    updateFlightStatistics(); 
    poiNameInput.value = '';
}

function selectWaypoint(waypoint) { 
    clearMultiSelection(); 

    if (selectedWaypoint && selectedWaypoint.marker) {
        selectedWaypoint.marker.setIcon(createWaypointIcon(selectedWaypoint.id, false));
        selectedWaypoint.marker.setZIndexOffset(0);
    }
    selectedWaypoint = waypoint;
    if (selectedWaypoint && selectedWaypoint.marker) {
        selectedWaypoint.marker.setIcon(createWaypointIcon(selectedWaypoint.id, true));
        selectedWaypoint.marker.setZIndexOffset(1000);
    }

    waypointAltitudeSlider.value = selectedWaypoint.altitude;
    waypointAltitudeValueEl.textContent = selectedWaypoint.altitude + 'm';
    hoverTimeSlider.value = selectedWaypoint.hoverTime;
    hoverTimeValueEl.textContent = selectedWaypoint.hoverTime + 's';
    gimbalPitchSlider.value = selectedWaypoint.gimbalPitch;
    gimbalPitchValueEl.textContent = selectedWaypoint.gimbalPitch + '°';
    headingControlSelect.value = selectedWaypoint.headingControl;
    fixedHeadingSlider.value = selectedWaypoint.fixedHeading;
    fixedHeadingValueEl.textContent = selectedWaypoint.fixedHeading + '°';
    cameraActionSelect.value = selectedWaypoint.cameraAction || 'none'; 

    fixedHeadingGroupDiv.style.display = selectedWaypoint.headingControl === 'fixed' ? 'block' : 'none';
    const showPoiSelect = selectedWaypoint.headingControl === 'poi_track';
    targetPoiForHeadingGroupDiv.style.display = showPoiSelect ? 'block' : 'none';
    if (showPoiSelect) {
        populatePoiSelectDropdown(targetPoiSelect, selectedWaypoint.targetPoiId, true, "-- Select POI for Heading --");
    }

    waypointControlsDiv.style.display = 'block';
    updateWaypointList(); 
    map.panTo(selectedWaypoint.latlng);
}

function deleteSelectedWaypoint() { 
    if (!selectedWaypoint) {
        showCustomAlert("No waypoint selected to delete.", "Info");
        return;
    }
    if (selectedWaypoint.marker) {
        map.removeLayer(selectedWaypoint.marker);
    }
    const deletedWaypointId = selectedWaypoint.id;
    waypoints = waypoints.filter(wp => wp.id !== selectedWaypoint.id);
    selectedWaypoint = null;
    waypointControlsDiv.style.display = 'none';

    if (selectedForMultiEdit.has(deletedWaypointId)) {
        selectedForMultiEdit.delete(deletedWaypointId);
        updateMultiEditPanelVisibility(); 
    }
    updateWaypointList(); 
    updateFlightPath(); 
    updateFlightStatistics();
    showCustomAlert("Waypoint deleted.", "Success");
}

function clearWaypoints() { 
    waypoints.forEach(wp => {
        if (wp.marker) map.removeLayer(wp.marker);
    });
    waypoints = []; 
    selectedWaypoint = null; 
    waypointCounter = 1;
    actionGroupCounter = 1; 
    actionCounter = 1;

    if (waypointControlsDiv) waypointControlsDiv.style.display = 'none';
    clearMultiSelection(); 
    updateWaypointList(); 
    updateFlightPath(); 
    updateFlightStatistics();
}

function deletePOI(poiId) { 
    const poiIndex = pois.findIndex(p => p.id === poiId);
    if (poiIndex > -1) {
        map.removeLayer(pois[poiIndex].marker);
        const deletedPoiId = pois[poiIndex].id; 
        pois.splice(poiIndex, 1);
        updatePOIList(); 
        updateFlightStatistics();
        waypoints.forEach(wp => {
            if (wp.targetPoiId === deletedPoiId) { 
                wp.targetPoiId = null;
                if (selectedWaypoint && selectedWaypoint.id === wp.id) {
                   targetPoiForHeadingGroupDiv.style.display = 'none'; 
                   populatePoiSelectDropdown(targetPoiSelect, null, true, "-- Select POI for Heading --");
                }
            }
        });
        if(selectedWaypoint && headingControlSelect.value === 'poi_track') {
            populatePoiSelectDropdown(targetPoiSelect, selectedWaypoint.targetPoiId, true, "-- Select POI for Heading --");
        }
        if(multiWaypointEditControlsDiv.style.display === 'block' && multiHeadingControlSelect.value === 'poi_track') {
            populatePoiSelectDropdown(multiTargetPoiSelect, null, true, "-- Select POI for all --");
        }
        updateWaypointList();
    }
}

function getCameraActionText(action) { 
    switch(action) {
        case 'takePhoto': return 'Photo';
        case 'startRecord': return 'Rec Start';
        case 'stopRecord': return 'Rec Stop';
        default: return '';
    }
}

function updateWaypointList() { 
    if (waypoints.length === 0) {
        waypointListEl.innerHTML = '<div style="text-align: center; color: #95a5a6; font-size: 12px; padding: 20px;">Click on map to add waypoints</div>';
        selectAllWaypointsCheckboxEl.checked = false;
        selectAllWaypointsCheckboxEl.disabled = true;
        return;
    }
    selectAllWaypointsCheckboxEl.disabled = false;

    waypointListEl.innerHTML = waypoints.map(wp => {
        let actionText = getCameraActionText(wp.cameraAction);
        let hoverText = wp.hoverTime > 0 ? ` | Hover: ${wp.hoverTime}s` : '';
        let poiTargetText = '';
        if (wp.headingControl === 'poi_track' && wp.targetPoiId != null) { 
            const target = pois.find(p => p.id === wp.targetPoiId);
            poiTargetText = target ? ` | Target: ${target.name}` : ` | Target: POI ID ${wp.targetPoiId} (not found)`;
        }
        let actionInfo = actionText ? `<div class="waypoint-action-info">Action: ${actionText}${poiTargetText}</div>` : (poiTargetText ? `<div class="waypoint-action-info">${poiTargetText.substring(3)}</div>` : '');

        const isSelectedForMulti = selectedForMultiEdit.has(wp.id);
        let itemClasses = "waypoint-item";
        if (selectedWaypoint && wp.id === selectedWaypoint.id && waypointControlsDiv.style.display === 'block' && !isSelectedForMulti) {
            itemClasses += " selected";
        }
        if (isSelectedForMulti) itemClasses += " multi-selected-item";

        return `
        <div class="${itemClasses}" onclick="handleWaypointListClick(${wp.id})">
            <div style="display: flex; align-items: center;">
                <input type="checkbox" class="waypoint-multi-select-cb" data-id="${wp.id}" 
                       onchange="toggleMultiSelectWaypoint(${wp.id}, this.checked)" 
                       ${isSelectedForMulti ? 'checked' : ''} 
                       style="margin-right: 10px; transform: scale(1.2);" 
                       onclick="event.stopPropagation();">
                <div>
                    <div class="waypoint-header"><span class="waypoint-name">Waypoint ${wp.id}</span></div>
                    <div class="waypoint-coords">Lat: ${wp.latlng.lat.toFixed(4)}, Lng: ${wp.latlng.lng.toFixed(4)}<br>Alt: ${wp.altitude}m${hoverText}</div>
                    ${actionInfo}
                </div>
            </div>
        </div>`;
    }).join('');
    if(waypoints.length === 0 && selectedForMultiEdit.size === 0) updateMultiEditPanelVisibility();
}
function handleWaypointListClick(wpId){ 
    const wp = waypoints.find(w=>w.id === wpId); 
    if(wp) selectWaypoint(wp); 
}

function toggleMultiSelectWaypoint(waypointId, isChecked) { 
    if (isChecked) {
        selectedForMultiEdit.add(waypointId);
    } else {
        selectedForMultiEdit.delete(waypointId);
    }
    const allWaypointsSelected = waypoints.length > 0 && waypoints.every(wp => selectedForMultiEdit.has(wp.id));
    selectAllWaypointsCheckboxEl.checked = allWaypointsSelected;

    updateWaypointList(); 
    updateMultiEditPanelVisibility();
}

function toggleSelectAllWaypoints(isChecked) { 
    selectedForMultiEdit.clear();
    if (isChecked) {
        waypoints.forEach(wp => selectedForMultiEdit.add(wp.id));
    }
    updateWaypointList();
    updateMultiEditPanelVisibility();
}

function clearMultiSelection() { 
    selectedForMultiEdit.clear();
    selectAllWaypointsCheckboxEl.checked = false;
    updateWaypointList(); 
    updateMultiEditPanelVisibility();
}

function updateMultiEditPanelVisibility() { 
    const count = selectedForMultiEdit.size;
    if (count > 0) {
        multiWaypointEditControlsDiv.style.display = 'block';
        selectedWaypointsCountEl.textContent = count;
        if (waypointControlsDiv) waypointControlsDiv.style.display = 'none';

        if (multiHeadingControlSelect.value === 'poi_track') {
            populatePoiSelectDropdown(multiTargetPoiSelect, null, true, "-- Select POI for all --");
             multiTargetPoiForHeadingGroupDiv.style.display = 'block';
        } else {
             multiTargetPoiForHeadingGroupDiv.style.display = 'none';
        }
    } else {
        multiWaypointEditControlsDiv.style.display = 'none';
        if (selectedWaypoint && waypointControlsDiv) {
            waypointControlsDiv.style.display = 'block';
        } else if (waypointControlsDiv) {
             waypointControlsDiv.style.display = 'none';
        }
    }
}

function applyMultiEdit() { 
    if (selectedForMultiEdit.size === 0) {
        showCustomAlert("No waypoints selected for multi-edit.", "Warning");
        return;
    }

    const newHeadingControl = multiHeadingControlSelect.value;
    const newFixedHeading = parseInt(multiFixedHeadingSlider.value);
    const newCameraAction = multiCameraActionSelect.value;
    const changeGimbal = multiChangeGimbalPitchCheckbox.checked;
    const newGimbalPitch = parseInt(multiGimbalPitchSlider.value);
    const changeHover = multiChangeHoverTimeCheckbox.checked;
    const newHoverTime = parseInt(multiHoverTimeSlider.value);
    const newTargetPoiId = (newHeadingControl === 'poi_track' && multiTargetPoiSelect.value) ? parseInt(multiTargetPoiSelect.value) : null;

    let changesMadeToAtLeastOneWp = false;

    waypoints.forEach(wp => {
        if (selectedForMultiEdit.has(wp.id)) {
            let wpChangedThisIteration = false;
            if (newHeadingControl) {
                wp.headingControl = newHeadingControl;
                if (newHeadingControl === 'fixed') {
                    wp.fixedHeading = newFixedHeading;
                    wp.targetPoiId = null; 
                } else if (newHeadingControl === 'poi_track') {
                    wp.targetPoiId = newTargetPoiId;
                } else { 
                    wp.targetPoiId = null; 
                }
                wpChangedThisIteration = true;
            }
            if (newCameraAction) {
                wp.cameraAction = newCameraAction;
                wpChangedThisIteration = true;
            }
            if (changeGimbal) {
                wp.gimbalPitch = newGimbalPitch;
                wpChangedThisIteration = true;
            }
            if (changeHover) {
                wp.hoverTime = newHoverTime;
                wpChangedThisIteration = true;
            }
            if(wpChangedThisIteration) changesMadeToAtLeastOneWp = true;
        }
    });

    if (changesMadeToAtLeastOneWp) {
        updateWaypointList();
        updateFlightStatistics(); 
        showCustomAlert(`${selectedForMultiEdit.size} waypoints were considered for update.`, "Info");
    } else {
        showCustomAlert("No changes specified to apply or no valid values for changes.", "Info");
    }

    multiHeadingControlSelect.value = "";
    multiFixedHeadingGroupDiv.style.display = 'none';
    multiTargetPoiForHeadingGroupDiv.style.display = 'none';
    multiFixedHeadingSlider.value = 0;
    multiFixedHeadingValueEl.textContent = "0°";
    multiCameraActionSelect.value = "";
    multiChangeGimbalPitchCheckbox.checked = false;
    multiGimbalPitchSlider.disabled = true;
    multiGimbalPitchSlider.value = 0;
    multiGimbalPitchValueEl.textContent = "0°";
    multiChangeHoverTimeCheckbox.checked = false;
    multiHoverTimeSlider.disabled = true;
    multiHoverTimeSlider.value = 0;
    multiHoverTimeValueEl.textContent = "0s";

    clearMultiSelection(); 
}

function updatePOIList() { 
    const noPoiAvailableText = "No POIs available";
    if (pois.length === 0) {
        poiListEl.innerHTML = '<div style="text-align: center; color: #95a5a6; font-size: 12px; padding: 10px;">No POIs added</div>'; 
        if (targetPoiSelect) {
            targetPoiSelect.disabled = true;
            targetPoiSelect.innerHTML = `<option value="">${noPoiAvailableText}</option>`;
        }
         if (multiTargetPoiSelect) {
            multiTargetPoiSelect.disabled = true;
            multiTargetPoiSelect.innerHTML = `<option value="">${noPoiAvailableText}</option>`;
        }
        if(orbitPoiSelectEl) { // Anche per la modale dell'orbita
            orbitPoiSelectEl.disabled = true;
            orbitPoiSelectEl.innerHTML = `<option value="">${noPoiAvailableText}</option>`;
        }
        return;
    }
    if (targetPoiSelect) targetPoiSelect.disabled = false;
    if (multiTargetPoiSelect) multiTargetPoiSelect.disabled = false;
    if (orbitPoiSelectEl) orbitPoiSelectEl.disabled = false;


    poiListEl.innerHTML = pois.map(poi => `
        <div class="poi-item"><span class="poi-name">${poi.name} (ID: ${poi.id})</span><button class="poi-delete" onclick="deletePOI(${poi.id})">✕</button></div>`).join('');
}

function updateFlightPath() { 
     if (flightPath) {
        flightPath.off('click', handlePathClick); // Rimuovi vecchio listener se esiste
        map.removeLayer(flightPath);
        flightPath = null; 
    }
    if (waypoints.length < 2) { updateFlightStatistics(); return; }
    const pathType = pathTypeSelect.value;
    const latlngsArrays = waypoints.map(wp => [wp.latlng.lat, wp.latlng.lng]);
    let displayPathCoords = (pathType === 'curved' && latlngsArrays.length >= 2) ? createSmoothPath(latlngsArrays) : latlngsArrays;

    flightPath = L.polyline(displayPathCoords, { 
        color: '#3498db', 
        weight: 5, // Aumentato per facilitare il click
        opacity: 0.8, 
        dashArray: pathType === 'curved' ? null : '5, 5' 
    }).addTo(map);
    flightPath.on('click', handlePathClick); // Aggiungi nuovo listener
    updateFlightStatistics();
}

function handlePathClick(e) {
    const clickedLatLng = e.latlng; 
    if (waypoints.length < 2) return;

    let closestSegmentIndex = -1;
    let minDistanceToSegmentLine = Infinity;
    let insertionPoint = clickedLatLng; // Usiamo il punto cliccato sulla linea

    // Trova il segmento (definito da waypoint originali) più vicino al punto cliccato
    for (let i = 0; i < waypoints.length - 1; i++) {
        const p1 = waypoints[i].latlng;
        const p2 = waypoints[i+1].latlng;

        // Semplice controllo: se il punto cliccato è "ragionevolmente" tra le lat/lng dei due waypoint del segmento
        // Questo è un'approssimazione e non gestisce linee perfettamente verticali/orizzontali o click distanti.
        // Per una soluzione precisa, serve la proiezione del punto sul segmento.
        // Leaflet.GeometryUtil.closestOnSegment sarebbe ideale.
        // Qui, per semplicità, inseriremo dopo il primo waypoint del segmento più vicino al click.
        // Distanza dal punto cliccato al punto medio del segmento (approssimazione)
        const midPoint = L.latLng((p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2);
        const distToMid = clickedLatLng.distanceTo(midPoint);

        // Un'altra metrica: distanza dalla linea infinita definita dal segmento
        // (non implementato qui per brevità, ma sarebbe più accurato)

        if (distToMid < minDistanceToSegmentLine) { // Usa questa metrica per ora
            minDistanceToSegmentLine = distToMid;
            closestSegmentIndex = i;
        }
    }

    if (closestSegmentIndex !== -1) {
        console.log(`Path clicked. Insertion after waypoint index: ${closestSegmentIndex}. Point:`, insertionPoint);

        const alt1 = waypoints[closestSegmentIndex].altitude;
        const alt2 = waypoints[closestSegmentIndex + 1].altitude;
        let newWpAltitude = alt1; // Default all'altitudine del primo WP del segmento
        // Semplice interpolazione lineare dell'altitudine (opzionale, da migliorare)
        const distToP1 = insertionPoint.distanceTo(waypoints[closestSegmentIndex].latlng);
        const segmentLength = waypoints[closestSegmentIndex].latlng.distanceTo(waypoints[closestSegmentIndex+1].latlng);
        if (segmentLength > 0) {
            const ratio = distToP1 / segmentLength;
            newWpAltitude = alt1 + (alt2 - alt1) * ratio;
        }
         newWpAltitude = Math.round(Math.max(5, newWpAltitude));


        const newWaypoint = {
            id: waypointCounter++,
            latlng: insertionPoint,
            altitude: newWpAltitude,
            hoverTime: 0,
            gimbalPitch: parseInt(gimbalPitchSlider.value),
            headingControl: 'auto',
            fixedHeading: 0,
            cameraAction: 'none',
            targetPoiId: null
        };

        waypoints.splice(closestSegmentIndex + 1, 0, newWaypoint);

        const marker = L.marker(newWaypoint.latlng, { 
            draggable: true, 
            icon: createWaypointIcon(newWaypoint.id, false) 
        }).addTo(map);
        marker.on('click', ev => { L.DomEvent.stopPropagation(ev); selectWaypoint(newWaypoint); });
        marker.on('dragend', () => {
            newWaypoint.latlng = marker.getLatLng();
            updateFlightPath(); updateFlightStatistics(); updateWaypointList();
        });
        marker.on('drag', () => { newWaypoint.latlng = marker.getLatLng(); updateFlightPath(); });
        newWaypoint.marker = marker;

        updateWaypointList();
        updateFlightPath(); 
        updateFlightStatistics();
        selectWaypoint(newWaypoint); 
        showCustomAlert(`Waypoint ${newWaypoint.id} inserted.`, "Info");
    }
}


function getCatmullRomPoint(t, p0, p1, p2, p3) { /* ... */ 
    const t2 = t*t, t3 = t2*t;
    const f1 = -0.5*t3 + t2 - 0.5*t, f2 = 1.5*t3 - 2.5*t2 + 1, f3 = -1.5*t3 + 2*t2 + 0.5*t, f4 = 0.5*t3 - 0.5*t2;
    return [p0[0]*f1 + p1[0]*f2 + p2[0]*f3 + p3[0]*f4, p0[1]*f1 + p1[1]*f2 + p2[1]*f3 + p3[1]*f4];
}
function createSmoothPath(points) { /* ... */ 
    if (points.length < 2) return points;
    const smoothed = []; const numSegments = 15;
    if (points.length === 2) return [points[0], points[1]];
    smoothed.push(points[0]);
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = i === 0 ? points[0] : points[i-1], p1 = points[i], p2 = points[i+1], p3 = i === points.length - 2 ? points[points.length-1] : points[i+2];
        for (let j = 1; j <= numSegments; j++) smoothed.push(getCatmullRomPoint(j/numSegments, p0, p1, p2, p3));
    }
    return smoothed;
}

function haversineDistance(coords1, coords2) { /* ... */ 
    function toRad(x) { return x * Math.PI / 180; }
    const lat1 = coords1.lat || coords1[0], lon1 = coords1.lng || coords1[1], lat2 = coords2.lat || coords2[0], lon2 = coords2.lng || coords2[1];
    const R = 6371e3, φ1 = toRad(lat1), φ2 = toRad(lat2), Δφ = toRad(lat2-lat1), Δλ = toRad(lon2-lon1);
    const a = Math.sin(Δφ/2)*Math.sin(Δφ/2) + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)*Math.sin(Δλ/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function updateFlightStatistics() { /* ... */ 
    let totalDist = 0;
    const speed = parseFloat(flightSpeedSlider.value) || 1; 
    if (waypoints.length >= 2) {
        const pathLatLngs = (pathTypeSelect.value === 'curved' && flightPath) ? flightPath.getLatLngs() : waypoints.map(wp => wp.latlng);
        for (let i = 0; i < pathLatLngs.length - 1; i++) totalDist += haversineDistance(pathLatLngs[i], pathLatLngs[i+1]);
    }
    let totalHover = waypoints.reduce((sum, wp) => sum + (wp.hoverTime || 0), 0);
    const flightDurationSec = (totalDist / (speed > 0 ? speed : 1) ) + totalHover;
    const mins = Math.floor(flightDurationSec / 60), secs = Math.round(flightDurationSec % 60);

    totalDistanceEl.textContent = `${Math.round(totalDist)} m`;
    flightTimeEl.textContent = `${mins} min ${secs} sec`;
    waypointCountEl.textContent = waypoints.length;
    poiCountEl.textContent = pois.length;
}

function toggleSatelliteView() { /* ... */ 
    const btn = document.getElementById('satelliteToggleBtn');
    if (satelliteView) { map.removeLayer(satelliteTileLayer); map.addLayer(defaultTileLayer); btn.textContent = '📡 Satellite'; }
    else { map.removeLayer(defaultTileLayer); map.addLayer(satelliteTileLayer); btn.textContent = '🗺️ Map'; }
    satelliteView = !satelliteView;
}
function fitMapToWaypoints() { /* ... */ 
    if (waypoints.length > 0) map.fitBounds(L.latLngBounds(waypoints.map(wp => wp.latlng)).pad(0.1));
    else if (pois.length > 0) map.fitBounds(L.latLngBounds(pois.map(p => p.latlng)).pad(0.1));
    else map.setView([37.7749, -122.4194], 13);
}
function showCurrentLocation() { /* ... */ 
    if (!navigator.geolocation) { showCustomAlert('Geolocation is not supported by this browser.', "Error"); return; }
    navigator.geolocation.getCurrentPosition(pos => {
        const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
        if (userLocationMarker) userLocationMarker.setLatLng(latlng);
        else userLocationMarker = L.marker(latlng, {icon: L.divIcon({className:'user-loc',html:'<div style="background:red;border-radius:50%;width:16px;height:16px;border:2px solid white;"></div>',iconSize:[16,16],iconAnchor:[8,8]})}).addTo(map);
        map.setView(latlng, 15);
    }, () => showCustomAlert('Unable to retrieve your location.', "Error"));
}

// ... (Funzioni getElevationsBatch, getHomeElevationFromFirstWaypoint, adaptAltitudesToAGL,
//      exportToGoogleEarth, exportToDjiWpmlKmz, triggerImport, loadFlightPlan
//      SONO INVARIATE rispetto all'ultima versione completa, le ometto per brevità,
//      ma devono essere presenti qui. Assicurati che l'URL del proxy in getElevationsBatch
//      sia corretto: 'https://88ff4290-4368-4064-a7f1-e896f1d6bad8-00-py4zt0lbfv5j.worf.replit.dev/proxy')
// ... (COPIA QUI QUELLE FUNZIONI DALL'ULTIMA RISPOSTA COMPLETA CHE TI HO FORNITO)
// Per assicurarti, ecco di nuovo le funzioni di elevazione:
async function getElevationsBatch(locationsArray) { 
    const batchSize = 100; 
    let allElevationsData = []; 

    for (let i = 0; i < locationsArray.length; i += batchSize) {
        const batch = locationsArray.slice(i, i + batchSize);
        const currentBatchIndices = [];
        const locationsString = batch.map((loc, indexInBatch) => {
            currentBatchIndices.push(i + indexInBatch); 
            return `${loc.lat.toFixed(6)},${loc.lng.toFixed(6)}`;
        }).join('|');

        const targetUrl = `https://api.opentopodata.org/v1/srtm90m?locations=${locationsString}&interpolation=cubic`;
        const proxyBaseUrl = 'https://88ff4290-4368-4064-a7f1-e896f1d6bad8-00-py4zt0lbfv5j.worf.replit.dev/proxy'; 
        const apiUrl = `${proxyBaseUrl}?url=${encodeURIComponent(targetUrl)}`;

        console.log(`Batch request (block ${Math.floor(i/batchSize) + 1}, size ${batch.length}) via proxy.`);

        try {
            const response = await fetch(apiUrl, { method: 'GET' });
            const responseText = await response.text();

            if (!response.ok) {
                console.error(`Batch API error (proxy): ${response.status}. Response: ${responseText.substring(0, 200)}...`);
                showCustomAlert(`Elevation API Error (Batch): ${response.status}`, "API Error");
                currentBatchIndices.forEach(originalIdx => allElevationsData.push({originalIndex: originalIdx, elevation: null}));
                continue; 
            }

            const data = JSON.parse(responseText);
            if (data.status === "OK" && data.results) {
                data.results.forEach((result, indexInBatchResponse) => {
                    const originalIndex = currentBatchIndices[indexInBatchResponse]; 
                    allElevationsData.push({originalIndex: originalIndex, elevation: result.elevation !== null ? result.elevation : null});
                });
            } else {
                console.warn("Batch API response not OK or no results (proxy):", data);
                showCustomAlert(`Elevation API returned no valid data for a batch. Status: ${data.status}`, "API Warning");
                currentBatchIndices.forEach(originalIdx => allElevationsData.push({originalIndex: originalIdx, elevation: null}));
            }
        } catch (error) {
            console.error("Exception in batch fetch/parsing (proxy):", error);
            showCustomAlert("Connection or parsing error during batch elevation request. Check console.", "Error");
            currentBatchIndices.forEach(originalIdx => allElevationsData.push({originalIndex: originalIdx, elevation: null}));
        }
        if (i + batchSize < locationsArray.length) {
            await new Promise(resolve => setTimeout(resolve, 1100)); 
        }
    }
    allElevationsData.sort((a,b) => a.originalIndex - b.originalIndex);
    return allElevationsData.map(item => item.elevation);
}

async function getHomeElevationFromFirstWaypoint() {
    if (waypoints.length === 0) {
        showCustomAlert("Add at least one waypoint to estimate takeoff point elevation.", "Info");
        return;
    }
    loadingOverlayEl.style.display = 'flex';
    loadingOverlayEl.textContent = "Fetching WP1 Elevation...";
    if (adaptToAGLBtnEl) adaptToAGLBtnEl.disabled = true; 
    const homeButton = getHomeElevationBtn;
    if(homeButton) homeButton.disabled = true;

    const firstWp = waypoints[0];
    const elevations = await getElevationsBatch([{ lat: firstWp.latlng.lat, lng: firstWp.latlng.lng }]);

    loadingOverlayEl.style.display = 'none';
    if (adaptToAGLBtnEl) adaptToAGLBtnEl.disabled = false;
    if(homeButton) homeButton.disabled = false;

    if (elevations && elevations.length > 0 && elevations[0] !== null) {
        homeElevationMslInput.value = Math.round(elevations[0]);
        showCustomAlert(`Waypoint 1 elevation (${Math.round(elevations[0])}m MSL) set as takeoff elevation.`, "Success");
    } else {
         showCustomAlert("Could not retrieve elevation for Waypoint 1.", "Error");
    }
}

async function adaptAltitudesToAGL() {
    const aglDesired = parseInt(desiredAGLInput.value);
    let homeElevationMSL = parseFloat(homeElevationMslInput.value);

    if (isNaN(aglDesired) || aglDesired < 5) {
        showCustomAlert("Invalid desired AGL (min 5m).", "Input Error");
        return;
    }
    if (isNaN(homeElevationMSL)) {
         showCustomAlert("Invalid Takeoff Point Elevation (MSL). Try 'Use WP1 Elev.' or enter manually.", "Input Error");
        return;
    }
    if (waypoints.length === 0) {
        showCustomAlert("No waypoints to adapt altitudes for.", "Info");
        return;
    }

    loadingOverlayEl.style.display = 'flex';
    loadingOverlayEl.textContent = "Requesting terrain elevations...";
    if (adaptToAGLBtnEl) adaptToAGLBtnEl.disabled = true;
    const homeButton = getHomeElevationBtn;
    if(homeButton) homeButton.disabled = true;

    const waypointCoords = waypoints.map(wp => ({ lat: wp.latlng.lat, lng: wp.latlng.lng }));
    const groundElevations = await getElevationsBatch(waypointCoords);

    let successCount = 0;
    if (groundElevations && groundElevations.length === waypoints.length) {
        waypoints.forEach((wp, index) => {
            const groundElevation = groundElevations[index];
            loadingOverlayEl.textContent = `Adapting AGL Altitudes... (WP ${index+1}/${waypoints.length})`;
            if (groundElevation !== null) {
                const newExecuteHeight = (groundElevation + aglDesired) - homeElevationMSL;
                wp.altitude = Math.max(5, Math.round(newExecuteHeight)); 
                successCount++;
            } else {
                console.warn(`Could not get elevation for waypoint ${wp.id}. Altitude not changed.`);
            }
        });
    } else {
        console.error("Error fetching elevations in batch or length mismatch.");
    }

    updateWaypointList();
    if (selectedWaypoint) { 
        const currentSelected = waypoints.find(wp => wp.id === selectedWaypoint.id);
        if (currentSelected) selectWaypoint(currentSelected); 
        else if (waypoints.length > 0) selectWaypoint(waypoints[0]);
        else if (waypointControlsDiv) waypointControlsDiv.style.display = 'none';
    }
    updateFlightStatistics(); 
    loadingOverlayEl.style.display = 'none';
    if (adaptToAGLBtnEl) adaptToAGLBtnEl.disabled = false;
    if(homeButton) homeButton.disabled = false;

    if (successCount === waypoints.length && waypoints.length > 0) {
        showCustomAlert("AGL altitude adaptation completed for all waypoints!", "Success");
    } else if (successCount > 0) {
         showCustomAlert(`AGL altitude adaptation completed for ${successCount} out of ${waypoints.length} waypoints. Check console for errors.`, "Partial Success");
    } else if (waypoints.length > 0) { 
         showCustomAlert("AGL altitude adaptation failed for all waypoints. Check console for details.", "Error");
    }
}

function exportToGoogleEarth() { 
    if (waypoints.length === 0) {
        showCustomAlert("No waypoints to export.", "Export Error");
        return;
    }
    let homeElevationMSL = parseFloat(homeElevationMslInput.value);
    if (isNaN(homeElevationMSL)) {
        showCustomAlert("Invalid Takeoff Point Elevation (MSL) for Google Earth export. Set it in 'Terrain & Orbit Tools'. Using 0 as fallback.", "Export Warning");
        homeElevationMSL = 0;
    }

    let kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Flight Plan</name>
    <Style id="waypointStyle"><IconStyle><Icon><href>http://maps.google.com/mapfiles/kml/paddle/blu-circle.png</href></Icon></IconStyle></Style>
    <Style id="pathStyle"><LineStyle><color>ffdb9834</color><width>3</width></LineStyle></Style>
    <Style id="poiStyle"><IconStyle><Icon><href>http://maps.google.com/mapfiles/kml/paddle/ylw-stars.png</href></Icon></IconStyle></Style>
    <Folder><name>Waypoints</name>`;
    waypoints.forEach(wp => {
        const altitudeMSL = homeElevationMSL + wp.altitude; 
        kmlContent += `
      <Placemark>
        <name>Waypoint ${wp.id} (Rel. Alt: ${wp.altitude}m)</name>
        <description>MSL Altitude: ${altitudeMSL.toFixed(1)}m\nGimbal Pitch: ${wp.gimbalPitch}°\nCamera Action: ${getCameraActionText(wp.cameraAction) || 'None'}${wp.headingControl === 'poi_track' && wp.targetPoiId != null ? `\nTargeting POI ID: ${wp.targetPoiId}` : ''}</description>
        <styleUrl>#waypointStyle</styleUrl>
        <Point>
          <altitudeMode>absolute</altitudeMode> 
          <coordinates>${wp.latlng.lng},${wp.latlng.lat},${altitudeMSL.toFixed(1)}</coordinates>
        </Point>
      </Placemark>`;
    });
    kmlContent += `</Folder>`;

    if (waypoints.length >= 2) {
        kmlContent += `
    <Placemark>
      <name>Flight Path</name>
      <styleUrl>#pathStyle</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <altitudeMode>absolute</altitudeMode>
        <coordinates>\n`;
        let coordsString = "";
        if (pathTypeSelect.value === 'curved' && flightPath && flightPath.getLatLngs().length > 1){
             waypoints.forEach(wp => {
                const altitudeMSL = homeElevationMSL + wp.altitude;
                coordsString += `${wp.latlng.lng},${wp.latlng.lat},${altitudeMSL.toFixed(1)}\n`;
            });
        } else {
             waypoints.forEach(wp => {
                const altitudeMSL = homeElevationMSL + wp.altitude;
                coordsString += `${wp.latlng.lng},${wp.latlng.lat},${altitudeMSL.toFixed(1)}\n`;
            });
        }
        kmlContent += coordsString.trim();
        kmlContent += `
        </coordinates>
      </LineString>
    </Placemark>`;
    }

    if (pois.length > 0) {
        kmlContent += `    <Folder><name>Points of Interest</name>\n`;
        pois.forEach(async (poi) => { 
            let poiGroundElevation = poi.altitude; 
            kmlContent += `
      <Placemark>
        <name>${poi.name}</name>
        <description>POI (Ground Elevation MSL: ${poiGroundElevation}m - if fetched)</description>
        <styleUrl>#poiStyle</styleUrl>
        <Point>
          <altitudeMode>clampToGround</altitudeMode> 
          <coordinates>${poi.latlng.lng},${poi.latlng.lat},0</coordinates>
        </Point>
      </Placemark>`;
        });
        kmlContent += `    </Folder>\n`;
    }
    kmlContent += `  </Document>\n</kml>`;

    const dataStr = "data:application/vnd.google-earth.kml+xml;charset=utf-8," + encodeURIComponent(kmlContent);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "google_earth_flight_plan.kml");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    document.body.removeChild(downloadAnchorNode);
}

function exportToDjiWpmlKmz() { 
    if (waypoints.length === 0) {
        showCustomAlert("No waypoints to export to DJI WPML KMZ.", "Export Error");
        return;
    }
    actionGroupCounter = 1; 
    actionCounter = 1;    

    const missionFlightSpeed = parseFloat(flightSpeedSlider.value);
    const missionPathTypeUi = pathTypeSelect.value; 

    const now = new Date();
    const createTimeMillis = now.getTime().toString();
    const waylineIdInt = Math.floor(now.getTime() / 1000); 

    let kmlTotalDistance = 0;
    if (waypoints.length >= 2) {
        const pathLatLngs = (missionPathTypeUi === 'curved' && flightPath) ? flightPath.getLatLngs() : waypoints.map(wp => wp.latlng);
        for (let i = 0; i < pathLatLngs.length - 1; i++) {
            kmlTotalDistance += haversineDistance(pathLatLngs[i], pathLatLngs[i + 1]);
        }
    }
    let kmlTotalHoverTime = waypoints.reduce((sum, wp) => sum + (wp.hoverTime || 0), 0);
    const kmlTotalDuration = (kmlTotalDistance / (missionFlightSpeed > 0 ? missionFlightSpeed : 1)) + kmlTotalHoverTime;

    let templateKmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.uav.com/wpmz/1.0.2">
  <Document>
    <wpml:author>fly</wpml:author> 
    <wpml:createTime>${createTimeMillis}</wpml:createTime>
    <wpml:updateTime>${createTimeMillis}</wpml:updateTime>
    <wpml:missionConfig>
      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
      <wpml:finishAction>goHome</wpml:finishAction>
      <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction>
      <wpml:globalTransitionalSpeed>${missionFlightSpeed.toFixed(1)}</wpml:globalTransitionalSpeed>
      <wpml:droneInfo>
        <wpml:droneEnumValue>68</wpml:droneEnumValue> 
        <wpml:droneSubEnumValue>0</wpml:droneSubEnumValue>
      </wpml:droneInfo>
    </wpml:missionConfig>
  </Document>
</kml>`;

    let waylinesWpmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.uav.com/wpmz/1.0.2">
  <Document>
    <wpml:missionConfig>
      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
      <wpml:finishAction>goHome</wpml:finishAction>
      <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction>
      <wpml:globalTransitionalSpeed>${missionFlightSpeed.toFixed(1)}</wpml:globalTransitionalSpeed>
      <wpml:droneInfo>
        <wpml:droneEnumValue>68</wpml:droneEnumValue>
        <wpml:droneSubEnumValue>0</wpml:droneSubEnumValue>
      </wpml:droneInfo>
    </wpml:missionConfig>
    <Folder>
      <name>Wayline Mission</name>
      <wpml:templateId>0</wpml:templateId>
      <wpml:executeHeightMode>relativeToStartPoint</wpml:executeHeightMode>
      <wpml:waylineId>${waylineIdInt}</wpml:waylineId>
      <wpml:distance>${kmlTotalDistance.toFixed(2)}</wpml:distance>
      <wpml:duration>${kmlTotalDuration.toFixed(2)}</wpml:duration>
      <wpml:autoFlightSpeed>${missionFlightSpeed.toFixed(1)}</wpml:autoFlightSpeed>
`;

            waypoints.forEach((wp, index) => {
                waylinesWpmlContent += `      <Placemark>\n`;
                waylinesWpmlContent += `        <Point><coordinates>${wp.latlng.lng.toFixed(10)},${wp.latlng.lat.toFixed(10)}</coordinates></Point>\n`;
                waylinesWpmlContent += `        <wpml:index>${index}</wpml:index>\n`;
                waylinesWpmlContent += `        <wpml:executeHeight>${parseFloat(wp.altitude).toFixed(1)}</wpml:executeHeight>\n`;
                waylinesWpmlContent += `        <wpml:waypointSpeed>${missionFlightSpeed.toFixed(1)}</wpml:waypointSpeed>\n`; 

                waylinesWpmlContent += `        <wpml:waypointHeadingParam>\n`;
                let headingMode = 'followWayline'; 
                let headingAngle = 0;
                let poiPointStr = '<wpml:waypointPoiPoint>0.000000,0.000000,0.000000</wpml:waypointPoiPoint>';
                let headingAngleEnable = 0; 
                let headingPathMode = 'followBadArc'; 
                let waypointHeadingPoiIndex = 0;    

                if (wp.headingControl === 'fixed') {
                    headingMode = 'lockCourse'; 
                    headingAngle = wp.fixedHeading;
                    headingAngleEnable = 1;
                    headingPathMode = 'smoothTransition'; 
                } else if (wp.headingControl === 'poi_track' && wp.targetPoiId != null) {
                    const targetPoi = pois.find(p => p.id === wp.targetPoiId);
                    if (targetPoi) {
                        headingMode = 'towardPOI'; 
                        poiPointStr = `<wpml:waypointPoiPoint>${targetPoi.latlng.lat.toFixed(6)},${targetPoi.latlng.lng.toFixed(6)},${parseFloat(targetPoi.altitude || 0).toFixed(1)}</wpml:waypointPoiPoint>`;
                        headingAngleEnable = 1; 
                        waypointHeadingPoiIndex = 0; 
                        headingPathMode = 'followBadArc'; 
                    } else { 
                        headingMode = 'followWayline';
                    }
                }

                waylinesWpmlContent += `          <wpml:waypointHeadingMode>${headingMode}</wpml:waypointHeadingMode>\n`;
                waylinesWpmlContent += `          <wpml:waypointHeadingAngle>${headingAngle}</wpml:waypointHeadingAngle>\n`;
                waylinesWpmlContent += `          ${poiPointStr}\n`;
                waylinesWpmlContent += `          <wpml:waypointHeadingAngleEnable>${headingAngleEnable}</wpml:waypointHeadingAngleEnable>\n`;
                waylinesWpmlContent += `          <wpml:waypointHeadingPathMode>${headingPathMode}</wpml:waypointHeadingPathMode>\n`;
                waylinesWpmlContent += `          <wpml:waypointHeadingPoiIndex>${waypointHeadingPoiIndex}</wpml:waypointHeadingPoiIndex>\n`;
                waylinesWpmlContent += `        </wpml:waypointHeadingParam>\n`;

                waylinesWpmlContent += `        <wpml:waypointTurnParam>\n`;
                let turnMode = (missionPathTypeUi === 'curved') ? 'toPointAndPassWithContinuityCurvature' : 'toPointAndStopWithContinuityCurvature';
                waylinesWpmlContent += `          <wpml:waypointTurnMode>${turnMode}</wpml:waypointTurnMode>\n`;
                waylinesWpmlContent += `          <wpml:waypointTurnDampingDist>0.0</wpml:waypointTurnDampingDist>\n`;
                waylinesWpmlContent += `        </wpml:waypointTurnParam>\n`;

                waylinesWpmlContent += `        <wpml:useStraightLine>${missionPathTypeUi === 'straight' ? '1' : '0'}</wpml:useStraightLine>\n`;

                waylinesWpmlContent += `        <wpml:waypointGimbalHeadingParam>\n`;
                waylinesWpmlContent += `          <wpml:waypointGimbalPitchAngle>${wp.gimbalPitch}</wpml:waypointGimbalPitchAngle>\n`;
                waylinesWpmlContent += `          <wpml:waypointGimbalYawAngle>0</wpml:waypointGimbalYawAngle>\n`; 
                waylinesWpmlContent += `        </wpml:waypointGimbalHeadingParam>\n`;

                let actionsXmlBlock = "";
                if (wp.hoverTime > 0) {
                    actionsXmlBlock += `          <wpml:action>\n`;
                    actionsXmlBlock += `            <wpml:actionId>${actionCounter++}</wpml:actionId>\n`;
                    actionsXmlBlock += `            <wpml:actionActuatorFunc>HOVER</wpml:actionActuatorFunc>\n`;
                    actionsXmlBlock += `            <wpml:actionActuatorFuncParam>\n`;
                    actionsXmlBlock += `              <wpml:hoverTime>${wp.hoverTime}</wpml:hoverTime>\n`;
                    actionsXmlBlock += `            </wpml:actionActuatorFuncParam>\n`;
                    actionsXmlBlock += `          </wpml:action>\n`;
                }

                if (wp.cameraAction && wp.cameraAction !== 'none') {
                    let actuatorFunc = '';
                    let params = `              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>\n`;

                    if (wp.cameraAction === 'takePhoto') {
                        actuatorFunc = 'takePhoto';
                        params += `              <wpml:useGlobalPayloadLensIndex>0</wpml:useGlobalPayloadLensIndex>\n`; 
                    } else if (wp.cameraAction === 'startRecord') {
                        actuatorFunc = 'startRecord';
                         params += `              <wpml:useGlobalPayloadLensIndex>0</wpml:useGlobalPayloadLensIndex>\n`;
                    } else if (wp.cameraAction === 'stopRecord') {
                        actuatorFunc = 'stopRecord';
                    }

                    if (actuatorFunc) {
                        actionsXmlBlock += `          <wpml:action>\n`;
                        actionsXmlBlock += `            <wpml:actionId>${actionCounter++}</wpml:actionId>\n`;
                        actionsXmlBlock += `            <wpml:actionActuatorFunc>${actuatorFunc}</wpml:actionActuatorFunc>\n`;
                        actionsXmlBlock += `            <wpml:actionActuatorFuncParam>\n`;
                        actionsXmlBlock += params;
                        actionsXmlBlock += `            </wpml:actionActuatorFuncParam>\n`;
                        actionsXmlBlock += `          </wpml:action>\n`;
                    }
                }

                if (actionsXmlBlock) {
                    waylinesWpmlContent += `        <wpml:actionGroup>\n`;
                    waylinesWpmlContent += `          <wpml:actionGroupId>${actionGroupCounter++}</wpml:actionGroupId>\n`; 
                    waylinesWpmlContent += `          <wpml:actionGroupStartIndex>${index}</wpml:actionGroupStartIndex>\n`;
                    waylinesWpmlContent += `          <wpml:actionGroupEndIndex>${index}</wpml:actionGroupEndIndex>\n`; 
                    waylinesWpmlContent += `          <wpml:actionGroupMode>parallel</wpml:actionGroupMode>\n`;
                    waylinesWpmlContent += `          <wpml:actionTrigger>\n`;
                    waylinesWpmlContent += `            <wpml:actionTriggerType>reachPoint</wpml:actionTriggerType>\n`;
                    waylinesWpmlContent += `          </wpml:actionTrigger>\n`;
                    waylinesWpmlContent += actionsXmlBlock;
                    waylinesWpmlContent += `        </wpml:actionGroup>\n`;
                }
                waylinesWpmlContent += `      </Placemark>\n`;
            });

            waylinesWpmlContent += `    </Folder>\n  </Document>\n</kml>`;

            const zip = new JSZip();
            const wpmzFolder = zip.folder("wpmz");
            wpmzFolder.folder("res"); 
            wpmzFolder.file("template.kml", templateKmlContent);
            wpmzFolder.file("waylines.wpml", waylinesWpmlContent);

            zip.generateAsync({ type: "blob", mimeType: "application/vnd.google-earth.kmz" })
                .then(function(blob) {
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = "waypoints_name.kmz"; 
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(link.href);
                });
        }

        function triggerImport() { document.getElementById('fileInput').click(); }
        function handleFileImport(event) {
            const file = event.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = e => {
                try { 
                    const importedPlan = JSON.parse(e.target.result);
                    loadFlightPlan(importedPlan);
                }
                catch (err) { showCustomAlert("Error parsing flight plan: " + err.message, "Import Error"); }
            };
            reader.readAsText(file);
            event.target.value = null; 
        }

        function loadFlightPlan(plan) {
            clearWaypoints();
            pois.forEach(p => map.removeLayer(p.marker)); pois = []; poiCounter = 1;

            if (plan.settings) {
                defaultAltitudeSlider.value = plan.settings.defaultAltitude || 30;
                defaultAltitudeValueEl.textContent = defaultAltitudeSlider.value + 'm';
                flightSpeedSlider.value = plan.settings.flightSpeed || 8;
                flightSpeedValueEl.textContent = flightSpeedSlider.value + ' m/s';
                pathTypeSelect.value = plan.settings.pathType || 'straight';
                waypointCounter = plan.settings.nextWaypointId || 1;
                poiCounter = plan.settings.nextPoiId || 1;
            }

            if (plan.pois) {
                plan.pois.forEach(pData => {
                    const poi = { id:pData.id||poiCounter++, name:pData.name, latlng:L.latLng(pData.lat, pData.lng), altitude:pData.altitude||0 };
                    if (pData.id && pData.id >= poiCounter) poiCounter = pData.id + 1;
                    const marker = L.marker(poi.latlng, { draggable:true, icon:L.divIcon({className:'poi-marker',html:'<div style="background: #f39c12; color:white; border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;border:2px solid white;">🎯</div>',iconSize:[20,20],iconAnchor:[10,10]})}).addTo(map);
                    marker.bindPopup(`<strong>${poi.name}</strong>`);
                    marker.on('dragend', () => poi.latlng = marker.getLatLng());
                    poi.marker = marker; pois.push(poi);
                });
            }
            if (plan.waypoints) {
                plan.waypoints.forEach(wpData => {
                    const wp = { 
                        id:wpData.id||waypointCounter++, 
                        latlng:L.latLng(wpData.lat, wpData.lng), 
                        altitude:wpData.altitude, hoverTime:wpData.hoverTime, 
                        gimbalPitch:wpData.gimbalPitch, headingControl:wpData.headingControl, 
                        fixedHeading:wpData.fixedHeading,
                        cameraAction: wpData.cameraAction || 'none',
                        targetPoiId: wpData.targetPoiId === undefined ? null : wpData.targetPoiId 
                    };
                    if (wpData.id && wpData.id >= waypointCounter) waypointCounter = wpData.id + 1;
                    const marker = L.marker(wp.latlng, { draggable:true, icon:createWaypointIcon(wp.id,false) }).addTo(map);
                    marker.on('click', e => { L.DomEvent.stopPropagation(e); selectWaypoint(wp); });
                    marker.on('dragend', () => { wp.latlng = marker.getLatLng(); updateFlightPath(); updateFlightStatistics(); updateWaypointList(); });
                    marker.on('drag', () => { wp.latlng = marker.getLatLng(); updateFlightPath(); });
                    wp.marker = marker; waypoints.push(wp);
                });
            }
            updatePOIList(); updateWaypointList(); updateFlightPath(); updateFlightStatistics(); fitMapToWaypoints();
            if (waypoints.length > 0) selectWaypoint(waypoints[0]);
            showCustomAlert("Flight plan imported successfully!", "Import Success");
        }