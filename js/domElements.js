// js/domElements.js

// Esportiamo le variabili degli elementi DOM affinché siano accessibili da altri moduli
export let defaultAltitudeSlider, defaultAltitudeValueEl, flightSpeedSlider, flightSpeedValueEl;
export let waypointAltitudeSlider, waypointAltitudeValueEl, hoverTimeSlider, hoverTimeValueEl;
export let gimbalPitchSlider, gimbalPitchValueEl, fixedHeadingSlider, fixedHeadingValueEl;
export let headingControlSelect, fixedHeadingGroupDiv, waypointControlsDiv, pathTypeSelect;
export let waypointListEl, poiListEl, poiNameInput, cameraActionSelect;
export let totalDistanceEl, flightTimeEl, waypointCountEl, poiCountEl;
export let targetPoiSelect, multiTargetPoiSelect, multiTargetPoiForHeadingGroupDiv, targetPoiForHeadingGroupDiv;
export let homeElevationMslInput, desiredAGLInput, adaptToAGLBtnEl, loadingOverlayEl;
export let multiWaypointEditControlsDiv, selectedWaypointsCountEl;
export let multiHeadingControlSelect, multiFixedHeadingGroupDiv, multiFixedHeadingSlider, multiFixedHeadingValueEl;
export let multiCameraActionSelect;
export let multiChangeGimbalPitchCheckbox, multiGimbalPitchSlider, multiGimbalPitchValueEl;
export let multiChangeHoverTimeCheckbox, multiHoverTimeSlider, multiHoverTimeValueEl;
export let selectAllWaypointsCheckboxEl;
export let clearWaypointsBtn, applyMultiEditBtn, clearMultiSelectionBtn, deleteSelectedWaypointBtn;
export let getHomeElevationBtn, createOrbitBtn, importJsonBtn, exportJsonBtn, exportKmzBtn, exportGoogleEarthBtn;
export let satelliteToggleBtn, fitMapBtn, myLocationBtn;
export let customAlertOverlayEl, customAlertMessageEl, customAlertOkButtonEl, customAlertTitleEl;
export let orbitModalOverlayEl, orbitPoiSelectEl, orbitRadiusInputEl, orbitPointsInputEl, confirmOrbitBtnEl, cancelOrbitBtnEl;
export let langSelectEl; // Per il selettore della lingua

export function cacheDOMElements() {
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
    langSelectEl = document.getElementById('langSelect');

    // Set initial text for sliders
    if (defaultAltitudeSlider && defaultAltitudeValueEl) defaultAltitudeValueEl.textContent = defaultAltitudeSlider.value + 'm';
    if (flightSpeedSlider && flightSpeedValueEl) flightSpeedValueEl.textContent = flightSpeedSlider.value + ' m/s';
    if (multiFixedHeadingSlider && multiFixedHeadingValueEl) multiFixedHeadingValueEl.textContent = multiFixedHeadingSlider.value + '°';
    if (multiGimbalPitchSlider && multiGimbalPitchValueEl) multiGimbalPitchValueEl.textContent = multiGimbalPitchSlider.value + '°';
    if (multiHoverTimeSlider && multiHoverTimeValueEl) multiHoverTimeValueEl.textContent = multiHoverTimeSlider.value + 's';
    if (gimbalPitchSlider && gimbalPitchValueEl) gimbalPitchValueEl.textContent = gimbalPitchSlider.value + '°';
}