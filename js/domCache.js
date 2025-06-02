// File: domCache.js

// Depends on: config.js (for variable declarations)

function cacheDOMElements() {
    // Sidebar Controls - Flight Settings
    defaultAltitudeSlider = document.getElementById('defaultAltitude');
    defaultAltitudeValueEl = document.getElementById('defaultAltitudeValue');
    flightSpeedSlider = document.getElementById('flightSpeed');
    flightSpeedValueEl = document.getElementById('flightSpeedValue');
    pathTypeSelect = document.getElementById('pathType');

    // Sidebar Controls - Waypoint Specific
    waypointControlsDiv = document.getElementById('waypointControls');
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
    targetPoiForHeadingGroupDiv = document.getElementById('targetPoiForHeadingGroup');
    targetPoiSelect = document.getElementById('targetPoiSelect');
    cameraActionSelect = document.getElementById('cameraActionSelect');
    deleteSelectedWaypointBtn = document.getElementById('deleteSelectedWaypointBtn');

    // Sidebar Controls - POI
    poiNameInput = document.getElementById('poiName');

    // Sidebar Display - Lists
    waypointListEl = document.getElementById('waypointList');
    poiListEl = document.getElementById('poiList');

    // Sidebar Display - Flight Statistics
    totalDistanceEl = document.getElementById('totalDistance');
    flightTimeEl = document.getElementById('flightTime');
    waypointCountEl = document.getElementById('waypointCount');
    poiCountEl = document.getElementById('poiCount');

    // Sidebar Controls - Multi-Waypoint Edit
    multiWaypointEditControlsDiv = document.getElementById('multiWaypointEditControls');
    selectedWaypointsCountEl = document.getElementById('selectedWaypointsCount');
    selectAllWaypointsCheckboxEl = document.getElementById('selectAllWaypointsCheckbox');
    multiHeadingControlSelect = document.getElementById('multiHeadingControl');
    multiFixedHeadingGroupDiv = document.getElementById('multiFixedHeadingGroup');
    multiTargetPoiForHeadingGroupDiv = document.getElementById('multiTargetPoiForHeadingGroup');
    multiTargetPoiSelect = document.getElementById('multiTargetPoiSelect');
    multiFixedHeadingSlider = document.getElementById('multiFixedHeading');
    multiFixedHeadingValueEl = document.getElementById('multiFixedHeadingValue');
    multiCameraActionSelect = document.getElementById('multiCameraActionSelect');
    multiChangeGimbalPitchCheckbox = document.getElementById('multiChangeGimbalPitchCheckbox');
    multiGimbalPitchSlider = document.getElementById('multiGimbalPitch');
    multiGimbalPitchValueEl = document.getElementById('multiGimbalPitchValue');
    multiChangeHoverTimeCheckbox = document.getElementById('multiChangeHoverTimeCheckbox');
    multiHoverTimeSlider = document.getElementById('multiHoverTime');
    multiHoverTimeValueEl = document.getElementById('multiHoverTimeValue');
    applyMultiEditBtn = document.getElementById('applyMultiEditBtn');
    clearMultiSelectionBtn = document.getElementById('clearMultiSelectionBtn');

    // Sidebar Controls - Terrain & Orbit Tools
    homeElevationMslInput = document.getElementById('homeElevationMsl');
    desiredAGLInput = document.getElementById('desiredAGL');
    adaptToAGLBtnEl = document.getElementById('adaptToAGLBtn');
    getHomeElevationBtn = document.getElementById('getHomeElevationBtn');
    createOrbitBtn = document.getElementById('createOrbitBtn');

    // Sidebar Controls - Import/Export
    importJsonBtn = document.getElementById('importJsonBtn');
    exportJsonBtn = document.getElementById('exportJsonBtn');
    exportKmzBtn = document.getElementById('exportKmzBtn');
    exportGoogleEarthBtn = document.getElementById('exportGoogleEarthBtn');
    fileInputEl = document.getElementById('fileInput');

    // Survey Grid Button and Modal Elements
    createSurveyGridBtn = document.getElementById('createSurveyGridBtn');
    surveyGridModalOverlayEl = document.getElementById('surveyGridModalOverlay');
    surveyGridModalTitleEl = document.getElementById('surveyGridModalTitle'); // Se vuoi modificarlo dinamicamente
    surveyGridInstructionsEl = document.getElementById('surveyGridInstructions');
    surveyGridAltitudeInputEl = document.getElementById('surveyGridAltitudeInput');
    surveySidelapInputEl = document.getElementById('surveySidelapInput'); 
    surveyFrontlapInputEl = document.getElementById('surveyFrontlapInput'); 
    surveyGridAngleInputEl = document.getElementById('surveyGridAngleInput');
    // surveyGridOvershootInputEl = document.getElementById('surveyGridOvershootInput'); // Removed: Element no longer exists in HTML
    surveyAreaStatusEl = document.getElementById('surveyAreaStatus');
    startDrawingSurveyAreaBtnEl = document.getElementById('startDrawingSurveyAreaBtn');
    finalizeSurveyAreaBtnEl = document.getElementById('finalizeSurveyAreaBtn');
    confirmSurveyGridBtnEl = document.getElementById('confirmSurveyGridBtn');
    cancelSurveyGridBtnEl = document.getElementById('cancelSurveyGridBtn');

    // Map Control Buttons
    satelliteToggleBtn = document.getElementById('satelliteToggleBtn');
    fitMapBtn = document.getElementById('fitMapBtn');
    myLocationBtn = document.getElementById('myLocationBtn');

    // General Action Buttons
    clearWaypointsBtn = document.getElementById('clearWaypointsBtn');

    // Modal & Overlay Elements
    loadingOverlayEl = document.getElementById('loadingOverlay');
    customAlertOverlayEl = document.getElementById('customAlertOverlay');
    customAlertTitleEl = document.getElementById('customAlertTitle');
    customAlertMessageEl = document.getElementById('customAlertMessage');
    customAlertOkButtonEl = document.getElementById('customAlertOkButton');
    orbitModalOverlayEl = document.getElementById('orbitModalOverlay');
    orbitPoiSelectEl = document.getElementById('orbitPoiSelect');
    orbitRadiusInputEl = document.getElementById('orbitRadiusInput');
    orbitPointsInputEl = document.getElementById('orbitPointsInput');
    confirmOrbitBtnEl = document.getElementById('confirmOrbitBtn');
    cancelOrbitBtnEl = document.getElementById('cancelOrbitBtn');

    // Initial UI state for some elements based on default slider values
    if (defaultAltitudeSlider && defaultAltitudeValueEl) defaultAltitudeValueEl.textContent = defaultAltitudeSlider.value + 'm';
    if (flightSpeedSlider && flightSpeedValueEl) flightSpeedValueEl.textContent = flightSpeedSlider.value + ' m/s';
    if (multiFixedHeadingSlider && multiFixedHeadingValueEl) multiFixedHeadingValueEl.textContent = multiFixedHeadingSlider.value + '°';
    if (multiGimbalPitchSlider && multiGimbalPitchValueEl) multiGimbalPitchValueEl.textContent = multiGimbalPitchSlider.value + '°';
    if (multiHoverTimeSlider && multiHoverTimeValueEl) multiHoverTimeValueEl.textContent = multiHoverTimeSlider.value + 's';
    if (gimbalPitchSlider && gimbalPitchValueEl) gimbalPitchValueEl.textContent = gimbalPitchSlider.value + '°';
}
