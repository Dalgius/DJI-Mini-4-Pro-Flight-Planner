// File: config.js

// --- Global Application State & Configuration ---
let map; // Leaflet map instance
let isDrawingSurveyArea = false;
let waypoints = [];
let pois = [];
let selectedWaypoint = null; // Holds the currently selected waypoint object for single editing
let flightPath = null; // Leaflet polyline object for the flight path
let userLocationMarker = null; // Marker for user's current location

// --- Map Layers ---
let defaultTileLayer;
let satelliteTileLayer;
let satelliteView = false; // Tracks current map view type

// --- Counters for Unique IDs ---
let waypointCounter = 1;
let poiCounter = 1;
let actionGroupCounter = 1; // For DJI WPML export
let actionCounter = 1;      // For DJI WPML export

// --- Multi-Edit State ---
let selectedForMultiEdit = new Set(); // Set of waypoint IDs selected for batch editing

// --- Constants (if any, e.g., API URLs, default values not tied to DOM elements at init) ---
const R_EARTH = 6371000; // Earth radius in meters for orbit calculation
const ELEVATION_API_PROXY_URL = '/.netlify/functions/elevation-proxy'; // Updated proxy URL for Netlify
const OPENTOPODATA_API_BASE = 'https://api.opentopodata.org/v1/srtm90m';

// --- DOM Element Cache (Variables to be populated by domCache.js) ---
// These are declared here to indicate they are globally accessed,
// but will be assigned in a dedicated DOM caching module or init.
// Sidebar Controls
let defaultAltitudeSlider, defaultAltitudeValueEl, flightSpeedSlider, flightSpeedValueEl;
let pathTypeSelect;

// Waypoint Specific Controls
let waypointControlsDiv; // Container for single waypoint editing
let waypointAltitudeSlider, waypointAltitudeValueEl, hoverTimeSlider, hoverTimeValueEl;
let gimbalPitchSlider, gimbalPitchValueEl;
let headingControlSelect, fixedHeadingGroupDiv, fixedHeadingSlider, fixedHeadingValueEl;
let targetPoiForHeadingGroupDiv, targetPoiSelect;
let cameraActionSelect;
let deleteSelectedWaypointBtn;

// POI Controls
let poiNameInput;

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

// ... (altre dichiarazioni) ...
let createSurveyGridBtn, surveyGridModalOverlayEl, surveyGridModalTitleEl, surveyGridInstructionsEl;
let surveyGridAltitudeInputEl, surveySidelapInputEl, surveyFrontlapInputEl, surveyGridAngleInputEl;
let surveyAreaStatusEl, startDrawingSurveyAreaBtnEl, finalizeSurveyAreaBtnEl, confirmSurveyGridBtnEl, cancelSurveyGridBtnEl;

// Terrain & Orbit Tools
let homeElevationMslInput, desiredAGLInput, adaptToAGLBtnEl;
let getHomeElevationBtn, createOrbitBtn;

// Import/Export Buttons
let importJsonBtn, exportJsonBtn, exportKmzBtn, exportGoogleEarthBtn;
let fileInputEl; // For triggering file import

// Map Control Buttons
let satelliteToggleBtn, fitMapBtn, myLocationBtn;

// General Action Buttons
let clearWaypointsBtn;

// Modal & Overlay Elements
let loadingOverlayEl;
let customAlertOverlayEl, customAlertTitleEl, customAlertMessageEl, customAlertOkButtonEl;
let orbitModalOverlayEl, orbitPoiSelectEl, orbitRadiusInputEl, orbitPointsInputEl;
let confirmOrbitBtnEl, cancelOrbitBtnEl;

// Note: Actual assignment of these DOM elements will be handled in a separate domCache.js or within app.js/main.js
