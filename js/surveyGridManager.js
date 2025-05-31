// File: surveyGridManager.js
// Cleaned version ensuring no class duplications.

// Global dependencies (expected from other files):
// map, (DOM elements like surveyGridModalOverlayEl etc. from domCache.js)
// R_EARTH (constant from config.js, though SURVEY_CONFIG.R_EARTH_METERS is preferred internally)
// showCustomAlert (global function from utils.js)
// handleMapClick (global function from mapManager.js, for default map interaction)
// addWaypoint, updateWaypointList, updateFlightPath, updateFlightStatistics, fitMapToWaypoints (global functions)

// ===========================
// CONSTANTS AND CONFIG
// ===========================
const SURVEY_CONFIG = {
    MIN_POLYGON_POINTS: 3,
    MAX_LINES_GENERATED: 2000, 
    MIN_PHOTO_INTERVAL_SECONDS: 1.8, 
    MIN_SPACING_METERS: 0.1,      
    DEBOUNCE_DELAY_MS: 150,     
    R_EARTH_METERS: (typeof R_EARTH !== 'undefined') ? R_EARTH : 6371000,

    CAMERA_PARAMS: { 
        sensorWidth_mm: 8.976,
        sensorHeight_mm: 6.716,
        focalLength_mm: 6.88
    },
    STYLES: {
        TEMP_POLYGON: { color: 'rgba(0, 100, 255, 0.7)', weight: 2, fillColor: 'rgba(0, 100, 255, 0.2)', fillOpacity: 0.3 },
        FINALIZED_POLYGON: { color: 'rgba(0, 50, 200, 0.9)', fillColor: 'rgba(0, 50, 200, 0.4)' },
        VERTEX_MARKER: { radius: 6, color: 'rgba(255,0,0,0.8)', fillColor: 'rgba(255,0,0,0.5)', fillOpacity: 0.7, pane: 'markerPane' },
        ANGLE_LINE: { color: 'cyan', weight: 2, dashArray: '5, 5' },
        ANGLE_MARKER: { radius: 5, color: 'cyan' }
    }
};

// ===========================
// STATE MANAGEMENT (SurveyState class)
// ===========================
class SurveyState {
    constructor() { this.reset(); }
    reset() {
        this.isDrawingSurveyArea = false;  
        this.isSurveyAreaFinalized = false; 
        this.isDrawingGridAngleLine = false;
        this.polygonPoints = [];
        this.gridAngleLinePoints = [];
        this.tempPolygonLayer = null;
        this.tempVertexMarkers = [];
        this.tempGridAngleLineLayer = null;
        this.tempGridAnglePointMarkers = [];
        this.nativeMapClickListener = null; 
        this.debounceTimeouts = new Map();
    }
    clearDebounceTimeout(key) {
        if (this.debounceTimeouts.has(key)) {
            clearTimeout(this.debounceTimeouts.get(key));
            this.debounceTimeouts.delete(key);
        }
    }
    setDebounceTimeout(key, callback, delay = SURVEY_CONFIG.DEBOUNCE_DELAY_MS) {
        this.clearDebounceTimeout(key);
        const timeout = setTimeout(() => {
            callback();
            this.debounceTimeouts.delete(key); 
        }, delay);
        this.debounceTimeouts.set(key, timeout);
    }
}

// ===========================
// UTILITY FUNCTIONS (SurveyUtils class) - DEFINED ONCE
// ===========================
class SurveyUtils {
    static toRad(degrees) { return degrees * Math.PI / 180; }
    static toDeg(radians) { return radians * 180 / Math.PI; }

    static calculateBearing(point1LatLng, point2LatLng) {
        const lat1 = this.toRad(point1LatLng.lat); const lon1 = this.toRad(point1LatLng.lng);
        const lat2 = this.toRad(point2LatLng.lat); const lon2 = this.toRad(point2LatLng.lng);
        const dLon = lon2 - lon1;
        const y = Math.sin(dLon) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
        let brng = this.toDeg(Math.atan2(y, x));
        return (brng + 360) % 360;
    }

    static rotateLatLng(pointLatLng, centerLatLng, angleRadians) {
        const cosAngle = Math.cos(angleRadians); const sinAngle = Math.sin(angleRadians);
        const dLngScaled = (pointLatLng.lng - centerLatLng.lng) * Math.cos(this.toRad(centerLatLng.lat));
        const dLat = pointLatLng.lat - centerLatLng.lat;
        const rotatedDLngScaled = dLngScaled * cosAngle - dLat * sinAngle;
        const rotatedDLat = dLngScaled * sinAngle + dLat * cosAngle;
        const finalLng = centerLatLng.lng + (rotatedDLngScaled / Math.cos(this.toRad(centerLatLng.lat)));
        const finalLat = centerLatLng.lat + rotatedDLat;
        return L.latLng(finalLat, finalLng);
    }

    static isPointInPolygon(point, polygonVertices) {
        let isInside = false; const x = point.lng; const y = point.lat;
        for (let i = 0, j = polygonVertices.length - 1; i < polygonVertices.length; j = i++) {
            const xi = polygonVertices[i].lng, yi = polygonVertices[i].lat;
            const xj = polygonVertices[j].lng, yj = polygonVertices[j].lat;
            const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) isInside = !isInside;
        }
        return isInside;
    }

    static destinationPoint(startLatLng, bearingDeg, distanceMeters) {
        const R = SURVEY_CONFIG.R_EARTH_METERS;
        const angularDistance = distanceMeters / R;
        const bearingRad = this.toRad(bearingDeg);
        const lat1 = this.toRad(startLatLng.lat); const lon1 = this.toRad(startLatLng.lng);
        const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angularDistance) + Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRad));
        let lon2 = lon1 + Math.atan2(Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1), Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2));
        lon2 = (lon2 + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
        return L.latLng(this.toDeg(lat2), this.toDeg(lon2));
    }

    static calculateFootprint(altitudeAGL, cameraParams = SURVEY_CONFIG.CAMERA_PARAMS) {
        if (!cameraParams || typeof cameraParams.focalLength_mm !== 'number' || cameraParams.focalLength_mm <= 0 ||
            typeof cameraParams.sensorWidth_mm !== 'number' || cameraParams.sensorWidth_mm <=0 ||
            typeof cameraParams.sensorHeight_mm !== 'number' || cameraParams.sensorHeight_mm <=0 ) {
            console.error("[SurveyUtils] Invalid camera parameters:", cameraParams);
            return { width: 0, height: 0 };
        }
        const footprintWidth = (cameraParams.sensorWidth_mm / cameraParams.focalLength_mm) * altitudeAGL;
        const footprintHeight = (cameraParams.sensorHeight_mm / cameraParams.focalLength_mm) * altitudeAGL;
        console.log(`[FootprintCalc] Alt:${altitudeAGL}m => FW:${footprintWidth.toFixed(1)}m, FH:${footprintHeight.toFixed(1)}m`);
        return { width: footprintWidth, height: footprintHeight };
    }
    
    static calculateDistance(point1, point2) {
        const R = SURVEY_CONFIG.R_EARTH_METERS;
        const lat1Rad = this.toRad(point1.lat); const lat2Rad = this.toRad(point2.lat);
        const deltaLatRad = this.toRad(point2.lat - point1.lat);
        const deltaLngRad = this.toRad(point2.lng - point1.lng);
        const a = Math.sin(deltaLatRad/2) * Math.sin(deltaLatRad/2) + Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLngRad/2) * Math.sin(deltaLngRad/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    static metersToDegreesLat(meters) { return meters / (SURVEY_CONFIG.R_EARTH_METERS * (Math.PI / 180)); }
}


// ===========================
// MAP INTERACTION HANDLER - DEFINED ONCE
// ===========================
class MapInteractionHandler {
    constructor(surveyManagerInstance) {
        this.surveyManager = surveyManagerInstance;
    }

    handleSurveyAreaClick(e) {
        console.log("[SurveyMap] Survey area click:", e.latlng);
        if (!this.surveyManager.state.isDrawingSurveyArea) { console.log("[SurveyMap] Not in survey area drawing mode"); return; }
        this.surveyManager.state.polygonPoints.push(e.latlng);
        console.log(`[SurveyMap] Point added, total: ${this.surveyManager.state.polygonPoints.length}`);
        this.addVertexMarker(e.latlng);
        this.surveyManager.updateTempPolygonDisplay();
    }

    handleGridAngleLineClick(e) {
        console.log("[SurveyMap] Grid angle line click:", e.latlng, "Points before:", this.surveyManager.state.gridAngleLinePoints.length);
        if (!this.surveyManager.state.isDrawingGridAngleLine) { console.log("[SurveyMap] Not in grid angle drawing mode"); return; }
        L.DomEvent.stopPropagation(e.originalEvent);
        this.surveyManager.state.gridAngleLinePoints.push(e.latlng);
        console.log(`[SurveyMap] Angle point added, total: ${this.surveyManager.state.gridAngleLinePoints.length}`);
        const marker = L.circleMarker(e.latlng, SURVEY_CONFIG.STYLES.ANGLE_MARKER).addTo(map);
        this.surveyManager.state.tempGridAnglePointMarkers.push(marker);
        if (this.surveyManager.state.gridAngleLinePoints.length === 1) {
            map.on('mousemove', this.handleGridAngleLineMouseMove.bind(this));
        } else if (this.surveyManager.state.gridAngleLinePoints.length >= 2) {
            this.finalizeGridAngleLine();
        }
    }

    handleGridAngleLineMouseMove(e) {
        if (!this.surveyManager.state.isDrawingGridAngleLine || this.surveyManager.state.gridAngleLinePoints.length !== 1) return;
        if (this.surveyManager.state.tempGridAngleLineLayer) map.removeLayer(this.surveyManager.state.tempGridAngleLineLayer);
        this.surveyManager.state.tempGridAngleLineLayer = L.polyline([this.surveyManager.state.gridAngleLinePoints[0], e.latlng], SURVEY_CONFIG.STYLES.ANGLE_LINE).addTo(map);
    }

    addVertexMarker(latlng) {
        const vertexMarker = L.circleMarker(latlng, SURVEY_CONFIG.STYLES.VERTEX_MARKER).addTo(map);
        if (this.surveyManager.state.tempVertexMarkers.length === 0) { // Solo per il primo marker
            vertexMarker.on('click', (ev) => {
                L.DomEvent.stopPropagation(ev);
                if (this.surveyManager.state.isDrawingSurveyArea && this.surveyManager.state.polygonPoints.length >= SURVEY_CONFIG.MIN_POLYGON_POINTS) {
                    this.surveyManager.finalizeSurveyArea();
                }
            });
        }
        this.surveyManager.state.tempVertexMarkers.push(vertexMarker);
    }

    finalizeGridAngleLine() {
        console.log("[SurveyMap] Finalizing grid angle line from MapInteractionHandler");
        const points = this.surveyManager.state.gridAngleLinePoints;
        if (points.length >= 2) {
            const userDrawnBearing = SurveyUtils.calculateBearing(points[0], points[1]);
            let correctedAngle = (userDrawnBearing - 90 + 360) % 360;
            if (surveyGridAngleInputEl) surveyGridAngleInputEl.value = Math.round(correctedAngle);
            console.log(`[SurveyMap] User Bearing: ${userDrawnBearing.toFixed(1)}°. Corrected Angle for Input: ${correctedAngle.toFixed(1)}°`);
        }
        this.surveyManager.finalizeGridAngleLineDrawing();
    }
}

// ===========================
// GRID GENERATION LOGIC (GridGenerator class) - DEFINED ONCE
// ===========================
class GridGenerator { /* ... come l'ultima versione corretta ... */ }
// Incollo GridGenerator
class GridGenerator {
    constructor() {
        this.maxLines = SURVEY_CONFIG.MAX_LINES_GENERATED;
        console.log("[GridGenerator] Instance created.");
    }
    generateGrid(params) {
        console.log("[GridGenerator] Starting grid generation with params:", params);
        try {
            const { polygonPoints, altitude, sidelap, frontlap, gridAngle, flightSpeed } = params;
            console.log("[GridGenerator] Camera Params being used:", SURVEY_CONFIG.CAMERA_PARAMS);
            const footprint = SurveyUtils.calculateFootprint(altitude, SURVEY_CONFIG.CAMERA_PARAMS); 
            if (!footprint || typeof footprint.width === 'undefined' || typeof footprint.height === 'undefined') {
                throw new Error("Footprint calculation failed critically (returned undefined).");
            }
            if (footprint.width <= 0 || footprint.height <= 0) {
                throw new Error("Invalid footprint (width/height is zero/negative). Check camera/altitude parameters.");
            }
            const calculatedLineSpacing = this.calculateLineSpacing(footprint.width, sidelap);
            const calculatedPhotoInterval = this.calculatePhotoInterval(footprint.height, frontlap);
            console.log(`[GridGenerator] Calculated Line Spacing: ${calculatedLineSpacing.toFixed(1)}m, Photo Interval (distance): ${calculatedPhotoInterval.toFixed(1)}m`);
            if (flightSpeed && flightSpeed > 0) {
                const requiredIntervalSeconds = calculatedPhotoInterval / flightSpeed;
                console.log(`[GridGenerator] Req. photo interval: ${requiredIntervalSeconds.toFixed(1)}s for speed ${flightSpeed}m/s`);
                if (requiredIntervalSeconds < SURVEY_CONFIG.MIN_PHOTO_INTERVAL_SECONDS) {
                     if (typeof showCustomAlert === 'function') showCustomAlert(`Warning: Speed might be too high for camera (photo interval ${requiredIntervalSeconds.toFixed(1)}s).`, "Speed Warning");
                }
            } else if ((!flightSpeed || flightSpeed <= 0) && calculatedPhotoInterval > 0) {
                console.warn("[GridGenerator] Invalid flightSpeed for photo interval calculation:", flightSpeed);
            }

            const rotationCenter = polygonPoints[0];
            const angleRad = SurveyUtils.toRad(gridAngle);
            const rotatedPoints = polygonPoints.map(point => SurveyUtils.rotateLatLng(point, rotationCenter, -angleRad));
            const rotatedBounds = this.calculatePolygonBounds(rotatedPoints);
            const rNE = L.latLng(rotatedBounds.north, rotatedBounds.east); 
            const rSW = L.latLng(rotatedBounds.south, rotatedBounds.west);

            if (rSW.lat >= rNE.lat - 1e-7 || rSW.lng >= rNE.lng - 1e-7) throw new Error("Rotated bounds invalid");

            const earthR = SURVEY_CONFIG.R_EARTH_METERS;
            const lineSpacingRotLat = (calculatedLineSpacing / earthR) * (180 / Math.PI);
            const photoSpacingRotLng = (calculatedPhotoInterval / (earthR * Math.cos(SurveyUtils.toRad(rotationCenter.lat)))) * (180 / Math.PI);
            if (lineSpacingRotLat <= 1e-9 || photoSpacingRotLng <= 1e-9) throw new Error("Degree spacing calc error (too small or zero)");

            const waypoints = []; 
            let currentRotLat = rSW.lat; let scanDir = 1; let lines = 0;
            while (currentRotLat <= rNE.lat + lineSpacingRotLat * 0.5) {
                lines++;
                const lineCandRot = [];
                if (scanDir === 1) {
                    for (let clng = rSW.lng; clng <= rNE.lng; clng += photoSpacingRotLng) lineCandRot.push(L.latLng(currentRotLat, clng));
                    if (!lineCandRot.length || lineCandRot[lineCandRot.length - 1].lng < rNE.lng - 1e-7) lineCandRot.push(L.latLng(currentRotLat, rNE.lng));
                } else {
                    for (let clng = rNE.lng; clng >= rSW.lng; clng -= photoSpacingRotLng) lineCandRot.push(L.latLng(currentRotLat, clng));
                    if (!lineCandRot.length || lineCandRot[lineCandRot.length - 1].lng > rSW.lng + 1e-7) lineCandRot.push(L.latLng(currentRotLat, rSW.lng));
                }
                let intendedLineBearing = gridAngle; if (scanDir === -1) intendedLineBearing = (gridAngle + 180);
                intendedLineBearing = (intendedLineBearing % 360 + 360) % 360;
                const wpOptions = { altitude: params.altitude, cameraAction: 'takePhoto', headingControl: 'fixed', fixedHeading: Math.round(intendedLineBearing) };
                lineCandRot.forEach(rotPt => {
                    const actualGeoPt = SurveyUtils.rotateLatLng(rotPt, rotationCenter, angleRad);
                    if (SurveyUtils.isPointInPolygon(actualGeoPt, polygonPoints)) {
                        waypoints.push({ latlng: actualGeoPt, options: wpOptions });
                    }
                });
                currentRotLat += lineSpacingRotLat; if (lines > this.maxLines) { console.error("Too many lines"); break; }
                scanDir *= -1;
            }
            const uniqueWaypoints = []; const seenKeys = new Set();
            for (const wp of waypoints) {
                const key = `${wp.latlng.lat.toFixed(7)},${wp.latlng.lng.toFixed(7)}`;
                if (!seenKeys.has(key)) { uniqueWaypoints.push(wp); seenKeys.add(key); }
            }
            const estimatedTime = this.calculateEstimatedFlightTime(uniqueWaypoints, flightSpeed);
            console.log(`[GridGenerator] Generated ${uniqueWaypoints.length} unique waypoints.`);
            return { success: true, waypoints: uniqueWaypoints, waypointCount: uniqueWaypoints.length, lineCount: lines, estimatedTime, lineSpacing: calculatedLineSpacing, photoInterval: calculatedPhotoInterval };
        } catch (error) {
            console.error("[GridGenerator] Generation failed:", error);
            return { success: false, error: error.message };
        }
    }
    calculateLineSpacing(fw, sl) { return Math.max(fw * (1 - sl / 100), SURVEY_CONFIG.MIN_SPACING_METERS); }
    calculatePhotoInterval(fh, fl) { return Math.max(fh * (1 - fl / 100), SURVEY_CONFIG.MIN_SPACING_METERS); }
    calculatePolygonBounds(points) {
        let north = -90, south = 90, east = -180, west = 180;
        points.forEach(point => {
            north = Math.max(north, point.lat); south = Math.min(south, point.lat);
            east = Math.max(east, point.lng); west = Math.min(west, point.lng);
        });
        return { north, south, east, west };
    }
    calculateEstimatedFlightTime(waypoints, speed) {
        if (!waypoints || waypoints.length < 2 || !speed || speed <= 0) return "0 min 0 sec";
        let totalDistance = 0;
        for (let i = 1; i < waypoints.length; i++) {
            if (waypoints[i-1].latlng && waypoints[i].latlng) {
                totalDistance += SurveyUtils.calculateDistance(waypoints[i-1].latlng, waypoints[i].latlng);
            }
        }
        const flightTimeSeconds = totalDistance / speed;
        const minutes = Math.floor(flightTimeSeconds / 60);
        const seconds = Math.round(flightTimeSeconds % 60);
        return `${minutes} min ${seconds} sec`;
    }
}


// ===========================
// MAIN SURVEY GRID MANAGER CLASS - DEFINED ONCE
// ===========================
class SurveyGridManager {
    constructor() {
        this.state = new SurveyState();
        this.mapHandler = new MapInteractionHandler(this);
        this.gridGenerator = new GridGenerator();
        console.log("[SurveyGridManager] Initialized.");
        // Event listeners for UI buttons are now set up globally in eventListeners.js,
        // calling methods on the surveyGridManagerInstance.
    }

    clearTemporaryDrawing() {
        if (this.state.tempPolygonLayer) { map.removeLayer(this.state.tempPolygonLayer); this.state.tempPolygonLayer = null; }
        this.state.tempVertexMarkers.forEach(marker => map.removeLayer(marker)); this.state.tempVertexMarkers = [];
        if (this.state.tempGridAngleLineLayer) { map.removeLayer(this.state.tempGridAngleLineLayer); this.state.tempGridAngleLineLayer = null; }
        this.state.tempGridAnglePointMarkers.forEach(marker => map.removeLayer(marker)); this.state.tempGridAnglePointMarkers = [];
        console.log("[SurveyGridManager] Temporary drawings cleared by instance method.");
    }

    updateTempPolygonDisplay() {
        if (this.state.tempPolygonLayer) { map.removeLayer(this.state.tempPolygonLayer); this.state.tempPolygonLayer = null; }
        if (this.state.polygonPoints.length < 2) return;
        const opts = SURVEY_CONFIG.STYLES.TEMP_POLYGON;
        if (this.state.polygonPoints.length === 2) this.state.tempPolygonLayer = L.polyline(this.state.polygonPoints, opts).addTo(map);
        else if (this.state.polygonPoints.length >= SURVEY_CONFIG.MIN_POLYGON_POINTS) this.state.tempPolygonLayer = L.polygon(this.state.polygonPoints, opts).addTo(map);
    }
    
    openSurveyGridModal() {
        console.log("[SurveyGridManager] openSurveyGridModal method called");
        if (!surveyGridModalOverlayEl || !defaultAltitudeSlider || !surveyGridAltitudeInputEl || !surveySidelapInputEl || !surveyFrontlapInputEl || !surveyGridAngleInputEl || !confirmSurveyGridBtnEl || !startDrawingSurveyAreaBtnEl || !surveyAreaStatusEl || !surveyGridInstructionsEl) {
            if(typeof showCustomAlert === 'function') showCustomAlert("Survey grid modal elements not found.", "Error"); 
            return;
        }
        this.fullResetAndUICleanup(); 
        surveyGridAltitudeInputEl.value = defaultAltitudeSlider.value;
        if (!surveySidelapInputEl.value) surveySidelapInputEl.value = 70;
        if (!surveyFrontlapInputEl.value) surveyFrontlapInputEl.value = 80;
        if (surveyGridAngleInputEl && (surveyGridAngleInputEl.value === "" || surveyGridAngleInputEl.value === null || typeof surveyGridAngleInputEl.value === 'undefined')) surveyGridAngleInputEl.value = 0;
        this.updateModalUIState('initial');
        surveyGridModalOverlayEl.style.display = 'flex';
    }

    fullResetAndUICleanup() {
        console.log("[SurveyGridManager] fullResetAndUICleanup called");
        const wasInteracting = this.state.isDrawingSurveyArea || this.state.isDrawingGridAngleLine || (this.state.nativeMapClickListener !== null);
        this.state.reset(); // Resetta lo stato interno del manager
        // Le variabili globali isDrawingSurveyArea, ecc. non sono più usate direttamente da questo manager.

        if (map) {
            map.off('click', this.mapHandler.handleSurveyAreaClick.bind(this.mapHandler));
            map.off('click', this.mapHandler.handleGridAngleLineClick.bind(this.mapHandler));
            map.off('mousemove', this.mapHandler.handleGridAngleLineMouseMove.bind(this.mapHandler));
            const mapContainer = map.getContainer();
            if (mapContainer && typeof this.state.nativeMapClickListener === 'function') { // Controlla this.state
                mapContainer.removeEventListener('click', this.state.nativeMapClickListener, true);
            }
            this.state.nativeMapClickListener = null; // Resetta anche qui
            map.getContainer().style.cursor = '';
            console.log("All survey-specific map listeners removed by fullReset.");

            if ((wasInteracting || (typeof handleMapClick === 'function' && !map.hasEventListeners('click', handleMapClick))) && typeof handleMapClick === 'function') {
                map.on('click', handleMapClick); 
                console.log("Default map click listener RE-ENSURED by fullReset.");
            }
        }
        this.clearTemporaryDrawing(); // Usa il metodo della classe
        this.updateModalUIState('initial'); 
    }
    
    updateModalUIState(uiState) { 
        console.log(`[SurveyGridManager] Updating modal UI to state: ${uiState}`);
        const angleVal = surveyGridAngleInputEl ? surveyGridAngleInputEl.value : '0';
        switch(uiState) {
            case 'initial':
                if (startDrawingSurveyAreaBtnEl) startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
                if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = true;
                if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = "Area not defined.";
                if (surveyGridInstructionsEl) surveyGridInstructionsEl.innerHTML = 'Set parameters. Click "Draw Direction" (optional) then "Draw Survey Area".';
                break;
            case 'angle_set': 
                if (surveyGridInstructionsEl) surveyGridInstructionsEl.innerHTML = `Grid angle set to ${angleVal}°. Now click "Draw Survey Area".`;
                if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = "Area not defined (angle set).";
                if (startDrawingSurveyAreaBtnEl) startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
                if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = true;
                break;
            case 'area_finalized': 
                if (startDrawingSurveyAreaBtnEl) startDrawingSurveyAreaBtnEl.style.display = 'none';
                if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = false;
                if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = `Area defined with ${this.state.polygonPoints.length} points. Angle: ${angleVal}°`;
                if (surveyGridInstructionsEl) surveyGridInstructionsEl.innerHTML = '<strong style="color: #2ecc71;">Area finalized!</strong> Click "Generate Grid".';
                break;
        }
    }

    handleCancelSurveyGrid() {
        console.log("[SurveyGridManager] handleCancelSurveyGrid (modal button)");
        this.fullResetAndUICleanup();
        if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'none';
    }

    handleSetGridAngleByLine() {
        console.log("[SurveyGridManager] handleSetGridAngleByLine called");
        this.state.setDebounceTimeout('setAngle', () => { // Usa debounce
            console.log("[SurveyGridManager] Debounced setAngle executing...");
            if (this.state.isDrawingSurveyArea && this.state.nativeMapClickListener && this.state.polygonPoints.length > 0 && !this.state.isSurveyAreaFinalized) {
                 if (typeof showCustomAlert === 'function') showCustomAlert("Finalize or cancel current survey area drawing first.", "Info"); 
                 return;
            }
            const mapContainer = map.getContainer();
            if (mapContainer && typeof this.state.nativeMapClickListener === 'function') {
                mapContainer.removeEventListener('click', this.state.nativeMapClickListener, true);
            }
            map.off('click', this.mapHandler.handleSurveyAreaClick.bind(this.mapHandler));

            this.state.isDrawingGridAngleLine = true;
            this.state.gridAngleLinePoints = [];
            if (this.state.tempGridAngleLineLayer) map.removeLayer(this.state.tempGridAngleLineLayer); this.state.tempGridAngleLineLayer = null;
            this.state.tempGridAnglePointMarkers.forEach(m => map.removeLayer(m)); this.state.tempGridAnglePointMarkers = [];
            
            if (map && typeof handleMapClick === 'function') map.off('click', handleMapClick);
            if (map) {
                map.on('click', this.mapHandler.handleGridAngleLineClick.bind(this.mapHandler));
                map.getContainer().style.cursor = 'crosshair';
            } else { this.state.isDrawingGridAngleLine = false; return; }
            if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'none';
            if (typeof showCustomAlert === 'function') showCustomAlert("Draw Grid Direction: Click map for line start, then end.", "Set Angle");
        });
    }

    finalizeGridAngleLineDrawing() {
        console.log("[SurveyGridManager] Finalizing grid angle line drawing (manager method)");
        this.state.isDrawingGridAngleLine = false;
        map.off('click', this.mapHandler.handleGridAngleLineClick.bind(this.mapHandler));
        map.off('mousemove', this.mapHandler.handleGridAngleLineMouseMove.bind(this.mapHandler));
        map.getContainer().style.cursor = '';
        if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'flex';
        
        if (this.state.isSurveyAreaFinalized && this.state.polygonPoints.length >= SURVEY_CONFIG.MIN_POLYGON_POINTS) {
            this.updateModalUIState('area_finalized'); 
        } else {
            this.updateModalUIState('angle_set'); 
            if (typeof handleMapClick === 'function') map.on('click', handleMapClick);
        }
    }
    
    handleStartDrawingSurveyArea() {
        console.log("[SurveyGridManager] handleStartDrawingSurveyArea called");
        this.state.setDebounceTimeout('drawArea', () => {
            if (this.state.isDrawingGridAngleLine) { if (typeof showCustomAlert === 'function') showCustomAlert("Finish drawing grid angle line first.", "Info"); return; }
            this.state.isDrawingSurveyArea = true;
            this.state.isSurveyAreaFinalized = false; // Inizia un nuovo disegno
            this.state.polygonPoints = []; 
            this.clearTemporaryDrawing(); 
            if (typeof handleMapClick === 'function') map.off('click', handleMapClick);
            map.off('click', this.mapHandler.handleGridAngleLineClick.bind(this.mapHandler)); 
            const mapContainer = map.getContainer();
            if (mapContainer) {
                if (typeof this.state.nativeMapClickListener === 'function') { mapContainer.removeEventListener('click', this.state.nativeMapClickListener, true); }
                this.state.nativeMapClickListener = (event) => { 
                    if (!this.state.isDrawingSurveyArea) return;
                    if (event.target === mapContainer || event.target.closest('.leaflet-pane') || event.target.closest('.leaflet-container')) {
                        try { this.mapHandler.handleSurveyAreaClick({ latlng: map.mouseEventToLatLng(event), originalEvent: event }); }
                        catch (mapError) { console.error("NATIVE CLICK (Polygon) Error:", mapError); }
                    }
                };
                mapContainer.addEventListener('click', this.state.nativeMapClickListener, true);
            }
            map.getContainer().style.cursor = 'crosshair';
            if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'none';
            if (typeof showCustomAlert === 'function') showCustomAlert("Drawing survey area: Click map for corners. Click first point to finalize.", "Survey Drawing Active");
        });
    }

    finalizeSurveyArea() {
        console.log("[SurveyGridManager] Finalizing survey area (manager method)");
        if (!this.state.isDrawingSurveyArea) return;
        if (this.state.polygonPoints.length < SURVEY_CONFIG.MIN_POLYGON_POINTS) { /* ... errore ... */ return; }
        const mapContainer = map.getContainer();
        if (mapContainer && typeof this.state.nativeMapClickListener === 'function') {
            mapContainer.removeEventListener('click', this.state.nativeMapClickListener, true);
        }
        map.getContainer().style.cursor = '';
        this.state.isSurveyAreaFinalized = true; // Area è definita e finalizzata
        // isDrawingSurveyArea rimane true finché non si esce o si genera.
        if (this.state.tempPolygonLayer) this.state.tempPolygonLayer.setStyle(SURVEY_CONFIG.STYLES.FINALIZED_POLYGON);
        this.state.tempVertexMarkers.forEach(marker => marker.off('click'));
        if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'flex';
        this.updateModalUIState('area_finalized');
    }

    handleConfirmSurveyGridGeneration() {
        console.log("[SurveyGridManager] handleConfirmSurveyGridGeneration called");
        if (!this.state.isSurveyAreaFinalized || this.state.polygonPoints.length < SURVEY_CONFIG.MIN_POLYGON_POINTS) {
            if(typeof showCustomAlert === 'function') showCustomAlert("Survey area not defined or not finalized.", "Error"); return; 
        }
        // ... (resto come prima, usando this.state.polygonPoints, this.gridGenerator, ecc.)
        // Assicurati che i parametri per this.gridGenerator.generateGrid siano corretti
        const altitude = parseFloat(surveyGridAltitudeInputEl.value);
        const sidelap = parseFloat(surveySidelapInputEl.value);
        const frontlap = parseFloat(surveyFrontlapInputEl.value);
        const angle = parseFloat(surveyGridAngleInputEl.value);
        const speed = parseFloat(flightSpeedSlider.value); // Assicurati che flightSpeedSlider sia accessibile

        if (isNaN(altitude) || /*...altre validazioni...*/ isNaN(speed) || speed <=0 ) {
            if(typeof showCustomAlert === 'function') showCustomAlert("Invalid parameters for grid generation.", "Input Error");
            return;
        }

        if (surveyGridInstructionsEl) surveyGridInstructionsEl.textContent = "Generating grid waypoints...";
        
        const gridResult = this.gridGenerator.generateGrid({
            polygonPoints: this.state.polygonPoints,
            altitude: altitude,
            sidelap: sidelap,
            frontlap: frontlap,
            gridAngle: angle,
            flightSpeed: speed
        });
        
        if (gridResult.success) {
            this.handleGridGenerationSuccess(gridResult);
        } else {
            this.handleGridGenerationError(gridResult.error || "Unknown generation error.");
        }
        this.fullResetAndUICleanup();
        if(surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'none';
    }

    handleGridGenerationSuccess(gridResult) {
        console.log("[SurveyGridManager] Grid generation successful", gridResult);
        if (gridResult.waypoints && gridResult.waypoints.length > 0) {
            gridResult.waypoints.forEach(wpData => {
                const latlng = L.latLng(wpData.latlng.lat, wpData.latlng.lng); // Assicura che sia L.LatLng
                addWaypoint(latlng, wpData.options);
            });
            if(typeof updateWaypointList === 'function') updateWaypointList(); 
            if(typeof updateFlightPath === 'function') updateFlightPath(); 
            if(typeof updateFlightStatistics === 'function') updateFlightStatistics(); 
            if(typeof fitMapToWaypoints === 'function') fitMapToWaypoints();
            if(typeof showCustomAlert === 'function') showCustomAlert(`${gridResult.waypointCount} survey waypoints generated! Est. time: ${gridResult.estimatedTime}`, "Success");
        } else {
            if(typeof showCustomAlert === 'function') showCustomAlert("No waypoints were generated for the survey grid.", "Info");
        }
    }
    handleGridGenerationError(errorMessage) {
        console.error("[SurveyGridManager] Grid generation failed:", errorMessage);
        if(typeof showCustomAlert === 'function') showCustomAlert(`Failed to generate survey grid: ${errorMessage}`, "Error");
    }
}


// ===========================
// INITIALIZATION
// ===========================
let surveyGridManagerInstance;

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            surveyGridManagerInstance = new SurveyGridManager();
            console.log("[SurveyGridManager] Instance created on DOMContentLoaded (v2).");
        });
    } else {
        surveyGridManagerInstance = new SurveyGridManager();
        console.log("[SurveyGridManager] Instance created immediately (v2).");
    }
}
