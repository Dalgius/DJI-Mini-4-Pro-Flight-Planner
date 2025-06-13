// File: config.js

// --- Global Application State & Configuration ---
let map; 
let isDrawingSurveyArea = false;
let isDrawingGridAngle = false;
let waypoints = [];
let pois = [];
let selectedWaypoint = null; 
let flightPath = null; 
let userLocationMarker = null; 
let lastAltitudeAdaptationMode = 'relative'; // 'relative', 'agl', 'amsl'

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

// --- DOM Element Cache ---
// Sidebar Controls
let defaultAltitudeSlider, defaultAltitudeValueEl, flightSpeedSlider, flightSpeedValueEl;
let pathTypeSelect;

// Waypoint Specific Controls
let waypointControlsDiv; 
let waypointAltitudeSlider, waypointAltitudeValueEl, hoverTimeSlider, hoverTimeValueEl;
let gimbalPitchSlider, gimbalPitchValueEl;
let headingControlSelect, fixedHeadingGroupDiv, fixedHeadingSlider, fixedHeadingValueEl;
let targetPoiForHeadingGroupDiv, targetPoiSelect;
let cameraActionSelect;
let deleteSelectedWaypointBtn;

// POI Controls
let poiNameInput, poiObjectHeightInputEl, poiTerrainElevationInputEl, poiFinalAltitudeDisplayEl, refetchPoiTerrainBtnEl;

// List Display Elements
let waypointListEl, poiListEl;

// Flight Statistics Display
let totalDistanceEl, flightTimeEl, waypointCountEl, poiCountEl;

// Multi-Waypoint Edit Controls
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
let surveyAreaStatusEl, startDrawingSurveyAreaBtnEl, finalizeSurveyAreaBtnEl, confirmSurveyGridBtnEl, cancelSurveyGridBtnEl;
let drawGridAngleBtnEl;

// Terrain & Orbit Tools
let homeElevationMslInput, desiredAGLInput, adaptToAGLBtnEl;
let desiredAMSLInputEl, adaptToAMSLBtnEl; 
let getHomeElevationBtn, createOrbitBtn;
let currentPathModeInfoEl, currentPathModeValueEl; 

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

// State for last added/selected POI for refetching terrain
let lastActivePoiForTerrainFetch = null;
