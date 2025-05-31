// File: config.js

// --- Global Application State & Configuration ---
let map; // Leaflet map instance
// Le variabili di stato per il disegno della survey grid (isDrawingSurveyArea, ecc.)
// sono ora gestite internamente da surveyGridManagerInstance.state

let waypoints = [];
let pois = [];
let selectedWaypoint = null;
let flightPath = null;
let userLocationMarker = null;

// --- Map Layers ---
let defaultTileLayer;
let satelliteTileLayer;
let satelliteView = false;

// --- Counters for Unique IDs ---
let waypointCounter = 1;
let poiCounter = 1;
let actionGroupCounter = 1;
let actionCounter = 1;

// --- Multi-Edit State ---
let selectedForMultiEdit = new Set();

// --- Constants ---
const R_EARTH = 6371000;
const ELEVATION_API_PROXY_URL = '/.netlify/functions/elevation-proxy';
const OPENTOPODATA_API_BASE = 'https://api.opentopodata.org/v1/srtm90m';

// --- DOM Element Cache (dichiarazioni) ---
let defaultAltitudeSlider, defaultAltitudeValueEl, flightSpeedSlider, flightSpeedValueEl;
let pathTypeSelect;
let waypointControlsDiv;
let waypointAltitudeSlider, waypointAltitudeValueEl, hoverTimeSlider, hoverTimeValueEl;
let gimbalPitchSlider, gimbalPitchValueEl;
let headingControlSelect, fixedHeadingGroupDiv, fixedHeadingSlider, fixedHeadingValueEl;
let targetPoiForHeadingGroupDiv, targetPoiSelect;
let cameraActionSelect;
let deleteSelectedWaypointBtn;
let poiNameInput;
let waypointListEl, poiListEl;
let totalDistanceEl, flightTimeEl, waypointCountEl, poiCountEl;
let multiWaypointEditControlsDiv, selectedWaypointsCountEl;
let selectAllWaypointsCheckboxEl;
let multiHeadingControlSelect, multiFixedHeadingGroupDiv, multiFixedHeadingSlider, multiFixedHeadingValueEl;
let multiTargetPoiForHeadingGroupDiv, multiTargetPoiSelect;
let multiCameraActionSelect;
let multiChangeGimbalPitchCheckbox, multiGimbalPitchSlider, multiGimbalPitchValueEl;
let multiChangeHoverTimeCheckbox, multiHoverTimeSlider, multiHoverTimeValueEl;
let applyMultiEditBtn, clearMultiSelectionBtn;

// Survey Grid Modal Elements
let createSurveyGridBtn, surveyGridModalOverlayEl, surveyGridModalTitleEl, surveyGridInstructionsEl;
let surveyGridAltitudeInputEl, surveySidelapInputEl, surveyFrontlapInputEl, surveyGridAngleInputEl;
let setGridAngleByLineBtn; // Pulsante per disegnare l'angolo
let surveyAreaStatusEl, startDrawingSurveyAreaBtnEl, /*finalizeSurveyAreaBtnEl, (Rimosso)*/ confirmSurveyGridBtnEl, cancelSurveyGridBtnEl;

// Terrain & Orbit Tools
let homeElevationMslInput, desiredAGLInput, adaptToAGLBtnEl;
let getHomeElevationBtn, createOrbitBtn;

// Import/Export Buttons
let importJsonBtn, exportJsonBtn, exportKmzBtn, exportGoogleEarthBtn;
let fileInputEl;

// Map Control Buttons
let satelliteToggleBtn, fitMapBtn, myLocationBtn;

// General Action Buttons
let clearWaypointsBtn;

// Modal & Overlay Elements
let loadingOverlayEl;
let customAlertOverlayEl, customAlertTitleEl, customAlertMessageEl, customAlertOkButtonEl;
let orbitModalOverlayEl, orbitPoiSelectEl, orbitRadiusInputEl, orbitPointsInputEl;
let confirmOrbitBtnEl, cancelOrbitBtnEl;
