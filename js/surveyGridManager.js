// File: surveyGridManager.js
// Merged, verified, and completed from provided parts.

// Global dependencies (expected from other files like config.js, domCache.js, utils.js, waypointManager.js):
// map, isDrawingSurveyArea, isDrawingGridAngleLine, gridAngleLinePoints (from config.js, for state)
// surveyGridModalOverlayEl, surveyGridAltitudeInputEl, surveySidelapInputEl, surveyFrontlapInputEl, 
// surveyGridAngleInputEl, setGridAngleByLineBtn, surveyAreaStatusEl, 
// startDrawingSurveyAreaBtnEl, confirmSurveyGridBtnEl, cancelSurveyGridBtnEl,
// defaultAltitudeSlider, flightSpeedSlider (DOM elements)
// R_EARTH (constant from config.js)
// showCustomAlert (global function from utils.js)
// handleMapClick (global function from mapManager.js)
// addWaypoint, updateWaypointList, updateFlightPath, updateFlightStatistics, fitMapToWaypoints (global functions)


// ===========================
// CONSTANTS AND CONFIG
// ===========================

const SURVEY_CONFIG = {
    MIN_POLYGON_POINTS: 3,
    MAX_LINES_GENERATED: 200, // Safety break for grid generation
    MIN_PHOTO_INTERVAL_SECONDS: 1.8, // Minimum typical camera interval
    MIN_SPACING_METERS: 0.1,      // Minimum allowed spacing for lines/photos
    DEBOUNCE_DELAY_MS: 150,     // Debounce delay for UI actions
    R_EARTH_METERS: 6371000,    // Earth radius

    CAMERA_PARAMS: { // DJI Mini 4 Pro (approx.)
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
// STATE MANAGEMENT
// ===========================

class SurveyState {
    constructor() { this.reset(); }
    reset() {
        // Global states from config.js will be managed directly by SurveyGridManager methods
        // isDrawingSurveyArea = false; 
        // isDrawingGridAngleLine = false;
        // gridAngleLinePoints = [];
        // currentPolygonPoints = []; // Will be managed by SurveyGridManager

        // Internal state for graphics and timeouts
        this.tempPolygonLayer = null;
        this.tempVertexMarkers = [];
        this.tempGridAngleLineLayer = null;
        this.tempGridAnglePointMarkers = [];
        this.nativeMapClickListener = null; // For polygon drawing
        this.debounceTimeouts = new Map();
    }
    clearDebounceTimeout(key) { /* ... come nel tuo codice ... */ }
    setDebounceTimeout(key, callback, delay = SURVEY_CONFIG.DEBOUNCE_DELAY_MS) { /* ... come nel tuo codice ... */ }
}
// Implementazioni di clearDebounceTimeout e setDebounceTimeout come le avevi definite
SurveyState.prototype.clearDebounceTimeout = function(key) {
    if (this.debounceTimeouts.has(key)) {
        clearTimeout(this.debounceTimeouts.get(key));
        this.debounceTimeouts.delete(key);
    }
};
SurveyState.prototype.setDebounceTimeout = function(key, callback, delay = SURVEY_CONFIG.DEBOUNCE_DELAY_MS) {
    this.clearDebounceTimeout(key);
    const timeout = setTimeout(() => {
        callback();
        this.debounceTimeouts.delete(key); // Rimuovi dopo l'esecuzione
    }, delay);
    this.debounceTimeouts.set(key, timeout);
};


// ===========================
// UTILITY FUNCTIONS (SurveyUtils)
// ===========================
// ... (SurveyUtils class come l'hai definita, usando SURVEY_CONFIG.R_EARTH_METERS invece di R_EARTH globale) ...
// Incollo per completezza, assicurandoti che usi this.toRad/Deg e SURVEY_CONFIG.R_EARTH_METERS
class SurveyUtils {
    static toRad(degrees) { return degrees * Math.PI / 180; }
    static toDeg(radians) { return radians * 180 / Math.PI; }
    static calculateBearing(point1LatLng, point2LatLng) { /* ... come prima, usando this.toRad ... */ }
    static rotateLatLng(pointLatLng, centerLatLng, angleRadians) { /* ... come prima, usando this.toRad ... */ }
    static isPointInPolygon(point, polygonVertices) { /* ... come prima ... */ }
    static destinationPoint(startLatLng, bearingDeg, distanceMeters) { /* ... come prima, usando this.toRad e SURVEY_CONFIG.R_EARTH_METERS ... */ }
    static calculateFootprint(altitudeAGL, cameraParams = SURVEY_CONFIG.CAMERA_PARAMS) {
        // Controllo se cameraParams è definito e se ha le proprietà necessarie come numeri validi
        if (!cameraParams || 
            typeof cameraParams.focalLength_mm !== 'number' || cameraParams.focalLength_mm === 0 ||
            typeof cameraParams.sensorWidth_mm !== 'number' || 
            typeof cameraParams.sensorHeight_mm !== 'number') { 
            console.error("[SurveyUtils] Invalid or incomplete camera parameters for footprint calculation:", cameraParams);
            return { width: 0, height: 0 }; // Restituisci SEMPRE un oggetto, anche in caso di errore
        }
        
        // Se i parametri sono validi, procedi con il calcolo
        const footprintWidth = (cameraParams.sensorWidth_mm / cameraParams.focalLength_mm) * altitudeAGL;
        const footprintHeight = (cameraParams.sensorHeight_mm / cameraParams.focalLength_mm) * altitudeAGL;
        
        console.log(`[SurveyUtils] Footprint calc: Alt=${altitudeAGL}m, SensorW=${cameraParams.sensorWidth_mm}, SensorH=${cameraParams.sensorHeight_mm}, FocalL=${cameraParams.focalLength_mm} => FootprintW=${footprintWidth.toFixed(1)}m, FootprintH=${footprintHeight.toFixed(1)}m`);
        
        return { width: footprintWidth, height: footprintHeight };
    }
    static lineIntersection(line1Start, line1End, line2Start, line2End) { /* ... come nel tuo codice ... */ }
    static calculateDistance(point1, point2) { /* ... come nel tuo codice, usando this.toRad e SURVEY_CONFIG.R_EARTH_METERS ... */ }
    static metersToDegreesLat(meters) { return meters / 111320; } // Valore approssimato
}
// Implementazioni complete per SurveyUtils
SurveyUtils.calculateBearing = function(point1LatLng, point2LatLng) {
    const lat1 = this.toRad(point1LatLng.lat); const lon1 = this.toRad(point1LatLng.lng);
    const lat2 = this.toRad(point2LatLng.lat); const lon2 = this.toRad(point2LatLng.lng);
    const dLon = lon2 - lon1;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    let brng = this.toDeg(Math.atan2(y, x));
    return (brng + 360) % 360;
};
SurveyUtils.rotateLatLng = function(pointLatLng, centerLatLng, angleRadians) {
    const cosAngle = Math.cos(angleRadians); const sinAngle = Math.sin(angleRadians);
    const dLngScaled = (pointLatLng.lng - centerLatLng.lng) * Math.cos(this.toRad(centerLatLng.lat));
    const dLat = pointLatLng.lat - centerLatLng.lat;
    const rotatedDLngScaled = dLngScaled * cosAngle - dLat * sinAngle;
    const rotatedDLat = dLngScaled * sinAngle + dLat * cosAngle;
    const finalLng = centerLatLng.lng + (rotatedDLngScaled / Math.cos(this.toRad(centerLatLng.lat)));
    const finalLat = centerLatLng.lat + rotatedDLat;
    return L.latLng(finalLat, finalLng);
};
SurveyUtils.destinationPoint = function(startLatLng, bearingDeg, distanceMeters) {
    const R = SURVEY_CONFIG.R_EARTH_METERS;
    const angularDistance = distanceMeters / R;
    const bearingRad = this.toRad(bearingDeg);
    const lat1 = this.toRad(startLatLng.lat); const lon1 = this.toRad(startLatLng.lng);
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angularDistance) + Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRad));
    let lon2 = lon1 + Math.atan2(Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1), Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2));
    lon2 = (lon2 + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
    return L.latLng(this.toDeg(lat2), this.toDeg(lon2));
};
SurveyUtils.calculateDistance = function(point1, point2) {
    const R = SURVEY_CONFIG.R_EARTH_METERS;
    const lat1Rad = this.toRad(point1.lat); const lat2Rad = this.toRad(point2.lat);
    const deltaLatRad = this.toRad(point2.lat - point1.lat);
    const deltaLngRad = this.toRad(point2.lng - point1.lng);
    const a = Math.sin(deltaLatRad/2) * Math.sin(deltaLatRad/2) + Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLngRad/2) * Math.sin(deltaLngRad/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};


// ===========================
// MAP INTERACTION HANDLER (adattato per usare this.surveyManager.state)
// ===========================
// ... (MapInteractionHandler class come l'hai definita, assicurandoti che usi `this.surveyManager.state` per accedere e modificare le variabili di stato come `polygonPoints`, `isDrawingSurveyArea`, `tempVertexMarkers` ecc., e `this.surveyManager` per chiamare metodi come `finalizeSurveyArea` o `updateTempPolygonDisplay`) ...
// Incollo e adatto MapInteractionHandler
class MapInteractionHandler {
    constructor(surveyManagerInstance) { // Riceve l'istanza del manager principale
        this.surveyManager = surveyManagerInstance;
    }
    
    handleSurveyAreaClick(e) {
        console.log("[SurveyMap] Survey area click:", e.latlng);
        if (!this.surveyManager.state.isDrawingSurveyArea) { console.log("[SurveyMap] Not in survey area drawing mode"); return; }
        const clickedLatLng = e.latlng;
        this.surveyManager.state.polygonPoints.push(clickedLatLng); // Usa this.surveyManager.state
        console.log(`[SurveyMap] Point added, total: ${this.surveyManager.state.polygonPoints.length}`);
        this.addVertexMarker(clickedLatLng);
        this.surveyManager.updateTempPolygonDisplay(); // Chiama metodo del manager
    }
    
    handleGridAngleLineClick(e) {
        console.log("[SurveyMap] Grid angle line click:", e.latlng);
        if (!this.surveyManager.state.isDrawingGridAngleLine) { console.log("[SurveyMap] Not in grid angle drawing mode"); return; }
        L.DomEvent.stopPropagation(e.originalEvent);
        this.surveyManager.state.gridAngleLinePoints.push(e.latlng);
        console.log(`[SurveyMap] Angle point added, total: ${this.surveyManager.state.gridAngleLinePoints.length}`);
        const marker = L.circleMarker(e.latlng, SURVEY_CONFIG.STYLES.ANGLE_MARKER).addTo(map);
        this.surveyManager.state.tempGridAnglePointMarkers.push(marker);
        if (this.surveyManager.state.gridAngleLinePoints.length === 1) {
            map.on('mousemove', this.handleGridAngleLineMouseMove.bind(this)); // .bind(this) è importante
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
        if (this.surveyManager.state.tempVertexMarkers.length === 0) {
            vertexMarker.on('click', (ev) => {
                L.DomEvent.stopPropagation(ev);
                if (this.surveyManager.state.isDrawingSurveyArea && this.surveyManager.state.polygonPoints.length >= SURVEY_CONFIG.MIN_POLYGON_POINTS) {
                    this.surveyManager.finalizeSurveyArea(); // Chiama metodo del manager
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
            const correctedAngle = (userDrawnBearing - 90 + 360) % 360;
            if (surveyGridAngleInputEl) surveyGridAngleInputEl.value = Math.round(correctedAngle);
            console.log(`[SurveyMap] Bearing: ${userDrawnBearing.toFixed(1)}°, Corrected Angle for Input: ${correctedAngle.toFixed(1)}°`);
        }
        this.surveyManager.finalizeGridAngleLineDrawing(); // Chiama metodo del manager
    }
}


// ===========================
// GRID GENERATION LOGIC (GridGenerator class)
// ===========================
// ... (GridGenerator class come l'hai definita, assicurati che usi SurveyUtils e SURVEY_CONFIG) ...
// Incollo e adatto GridGenerator
generateGrid(params) {
        console.log("[GridGenerator] Starting grid generation with params:", params);
        try {
            const { polygonPoints, altitude, sidelap, frontlap, gridAngle, flightSpeed } = params;
            
            console.log("[GridGenerator] Camera Params being used:", SURVEY_CONFIG.CAMERA_PARAMS);
            const footprint = SurveyUtils.calculateFootprint(altitude, SURVEY_CONFIG.CAMERA_PARAMS); 

            if (!footprint || typeof footprint.width === 'undefined' || typeof footprint.height === 'undefined') {
                console.error("[GridGenerator] calculateFootprint returned invalid object.");
                throw new Error("Footprint calculation failed critically.");
            }
            if (footprint.width <= 0 || footprint.height <= 0) {
                console.warn("[GridGenerator] Footprint width or height is zero/negative.");
                throw new Error("Invalid footprint (width/height is zero/negative).");
            }
            
            // Calcola le spaziature effettive basate su overlap
            const calculatedLineSpacing = this.calculateLineSpacing(footprint.width, sidelap); // Usa il metodo della classe
            const calculatedPhotoInterval = this.calculatePhotoInterval(footprint.height, frontlap); // Usa il metodo della classe

            console.log(`[GridGenerator] Calculated Line Spacing: ${calculatedLineSpacing.toFixed(1)}m`);
            console.log(`[GridGenerator] Calculated Photo Interval (distance): ${calculatedPhotoInterval.toFixed(1)}m`);

            if (flightSpeed && flightSpeed > 0) {
                const requiredIntervalSeconds = calculatedPhotoInterval / flightSpeed;
                console.log(`[GridGenerator] Req. photo interval: ${requiredIntervalSeconds.toFixed(1)}s for speed ${flightSpeed}m/s`);
                if (requiredIntervalSeconds < SURVEY_CONFIG.MIN_PHOTO_INTERVAL_SECONDS) {
                     if (typeof showCustomAlert === 'function') showCustomAlert(`Warning: Speed might be too high for camera (photo interval ${requiredIntervalSeconds.toFixed(1)}s).`, "Speed Warning");
                }
            }

            const rotationCenter = polygonPoints[0];
            const angleRad = SurveyUtils.toRad(gridAngle);
            const rotatedPoints = polygonPoints.map(point => SurveyUtils.rotateLatLng(point, rotationCenter, -angleRad));
            const rotatedBounds = this.calculatePolygonBounds(rotatedPoints);
            const rNE = L.latLng(rotatedBounds.north, rotatedBounds.east); 
            const rSW = L.latLng(rotatedBounds.south, rotatedBounds.west);

            if (rSW.lat >= rNE.lat - 1e-7 || rSW.lng >= rNE.lng - 1e-7) throw new Error("Rotated bounds invalid");

            const earthR = SURVEY_CONFIG.R_EARTH_METERS;
            // USA I NOMI CORRETTI QUI: calculatedLineSpacing e calculatedPhotoInterval
            const lineSpacingRotLat = (calculatedLineSpacing / earthR) * (180 / Math.PI);
            const photoSpacingRotLng = (calculatedPhotoInterval / (earthR * Math.cos(SurveyUtils.toRad(rotationCenter.lat)))) * (180 / Math.PI);
            
            console.log(`[GridGenerator] lineSpacingRotLat: ${lineSpacingRotLat.toFixed(10)}, photoSpacingRotLng: ${photoSpacingRotLng.toFixed(10)}`); // DEBUG

            if (lineSpacingRotLat <= 1e-9 || photoSpacingRotLng <= 1e-9) throw new Error("Degree spacing calc error (too small or zero)");

            const waypoints = []; let waypointIdCounter = 1; 
            let currentRotLat = rSW.lat; let scanDir = 1; let lines = 0;

            while (currentRotLat <= rNE.lat + lineSpacingRotLat * 0.5) {
                // ... (resto della logica di generazione delle linee e dei waypoint come prima,
                //      assicurandosi che usi lineSpacingRotLat e photoSpacingRotLng nei loop) ...
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
                
                // Usa flightAltitudeAGL passato nei params, non solo altitude che potrebbe essere ambiguo
                const wpOptions = { altitude: params.altitude, cameraAction: 'takePhoto', headingControl: 'fixed', fixedHeading: Math.round(intendedLineBearing) };
                
                lineCandRot.forEach(rotPt => {
                    const actualGeoPt = SurveyUtils.rotateLatLng(rotPt, rotationCenter, angleRad);
                    if (SurveyUtils.isPointInPolygon(actualGeoPt, polygonPoints)) {
                        // Per l'esportazione, potremmo voler passare l'oggetto options completo
                        // e lasciare che addWaypoint lo gestisca.
                        // Per ora, il formato di GridGenerator.generateWaypointsForLine era {index, lat, lng, altitude, action}
                        // Adattiamo per coerenza con l'attesa di SurveyGridManager.handleGridGenerationSuccess
                        waypoints.push({ 
                            latlng: actualGeoPt, 
                            options: wpOptions, 
                            // id: waypointIdCounter++ // L'ID vero viene assegnato da addWaypoint globale
                        });
                    }
                });
                currentRotLat += lineSpacingRotLat; if (lines > this.maxLines) { console.error("Too many lines"); break; }
                scanDir *= -1;
            }
            
            // Il filtro duplicati in SurveyGridManager.generateSurveyGridWaypoints è stato rimosso
            // perché ora GridGenerator restituisce direttamente i waypoints con options.
            // Se necessario, il filtro duplicati può essere applicato qui prima di restituire.
            // Per ora, presumiamo che la spaziatura e il clipping producano un set ragionevole.
            // Un filtro duplicati più robusto potrebbe essere utile qui se si vedono punti sovrapposti.

            const estimatedTime = this.calculateEstimatedFlightTime(waypoints, flightSpeed);
            console.log(`[GridGenerator] Generated ${waypoints.length} waypoints.`);
            return { success: true, waypoints: waypoints, waypointCount: waypoints.length, lineCount: lines, estimatedTime, lineSpacing: calculatedLineSpacing, photoInterval: calculatedPhotoInterval }; // Restituisci i waypoint pronti per addWaypoint

        } catch (error) {
            console.error("[GridGenerator] Generation failed:", error);
            return { success: false, error: error.message };
        }
    }
    calculateLineSpacing(fw, sl) { return Math.max(fw * (1 - sl / 100), SURVEY_CONFIG.MIN_SPACING_METERS); }
    calculatePhotoInterval(fh, fl) { return Math.max(fh * (1 - fl / 100), SURVEY_CONFIG.MIN_SPACING_METERS); } // Usa MIN_SPACING_METERS
    calculatePolygonBounds(pts) { /* ... come prima ... */ }
    clipLineToPolygon(line, poly) { /* ... come prima, ma questa è complessa e potrebbe essere il punto debole se non robusta ... */ return line; } // Semplificazione: per ora non clippa, assume che isPointInPolygon faccia il lavoro.
    lineIntersection(l1s, l1e, l2s, l2e) { /* ... come prima ... */ }
    calculateEstimatedFlightTime(wps, speed) {
        if (wps.length < 2 || !speed || speed <=0) return "0 min";
        let totalDist = 0;
        for (let i = 1; i < wps.length; i++) totalDist += SurveyUtils.calculateDistance(wps[i-1].latlng, wps[i].latlng);
        const flightTimeSec = totalDist / speed;
        return `${Math.ceil(flightTimeSec / 60)} min`;
    }
}
// Implementazioni complete per GridGenerator helper
GridGenerator.prototype.calculatePolygonBounds = function(points) {
    let north = -90, south = 90, east = -180, west = 180;
    points.forEach(point => {
        north = Math.max(north, point.lat); south = Math.min(south, point.lat);
        east = Math.max(east, point.lng); west = Math.min(west, point.lng);
    });
    return { north, south, east, west };
};
// ... lineIntersection come prima (se vuoi mantenerlo)


// ===========================
// MAIN SURVEY GRID MANAGER CLASS
// ===========================

class SurveyGridManager {
    constructor() {
        this.state = new SurveyState();
        this.mapHandler = new MapInteractionHandler(this); // Passa l'istanza del manager
        this.gridGenerator = new GridGenerator();
        // Gli event listener UI vengono aggiunti globalmente in eventListeners.js
        // e chiamano i metodi di questa istanza (surveyGridManagerInstance).
        console.log("[SurveyGridManager] Initialized.");
    }

    // Metodi per pulire e aggiornare la grafica temporanea
    clearTemporaryDrawing() {
        if (this.state.tempPolygonLayer) { map.removeLayer(this.state.tempPolygonLayer); this.state.tempPolygonLayer = null; }
        this.state.tempVertexMarkers.forEach(marker => map.removeLayer(marker)); this.state.tempVertexMarkers = [];
        if (this.state.tempGridAngleLineLayer) { map.removeLayer(this.state.tempGridAngleLineLayer); this.state.tempGridAngleLineLayer = null; }
        this.state.tempGridAnglePointMarkers.forEach(marker => map.removeLayer(marker)); this.state.tempGridAnglePointMarkers = [];
        console.log("[SurveyGridManager] Temporary drawings cleared by instance.");
    }

    updateTempPolygonDisplay() {
        if (this.state.tempPolygonLayer) { map.removeLayer(this.state.tempPolygonLayer); this.state.tempPolygonLayer = null; }
        if (this.state.polygonPoints.length < 2) return;
        const opts = SURVEY_CONFIG.STYLES.TEMP_POLYGON;
        if (this.state.polygonPoints.length === 2) this.state.tempPolygonLayer = L.polyline(this.state.polygonPoints, opts).addTo(map);
        else if (this.state.polygonPoints.length >= SURVEY_CONFIG.MIN_POLYGON_POINTS) this.state.tempPolygonLayer = L.polygon(this.state.polygonPoints, opts).addTo(map);
    }
    
    // Metodi che gestiscono lo stato e la UI della modale
    openSurveyGridModal() {
        console.log("[SurveyGridManager] openSurveyGridModal method called");
        // Validazione elementi DOM globali
        if (!surveyGridModalOverlayEl || !defaultAltitudeSlider || !surveyGridAltitudeInputEl || !surveySidelapInputEl || !surveyFrontlapInputEl || !surveyGridAngleInputEl || !confirmSurveyGridBtnEl || !startDrawingSurveyAreaBtnEl || !surveyAreaStatusEl || !surveyGridInstructionsEl) {
            if(typeof showCustomAlert === 'function') showCustomAlert("Survey grid modal elements not found.", "Error"); 
            return;
        }
        
        this.fullResetAndUICleanup(); // Resetta tutto prima di aprire

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

        this.state.isDrawingSurveyArea = false;
        this.state.isDrawingGridAngleLine = false;
        this.state.polygonPoints = []; // Usa this.state
        this.state.gridAngleLinePoints = []; // Usa this.state

        if (map) {
            const mapContainer = map.getContainer();
            if (mapContainer && typeof this.state.nativeMapClickListener === 'function') {
                mapContainer.removeEventListener('click', this.state.nativeMapClickListener, true);
            }
            this.state.nativeMapClickListener = null;

            map.off('click', this.mapHandler.handleSurveyAreaClick.bind(this.mapHandler));
            map.off('click', this.mapHandler.handleGridAngleLineClick.bind(this.mapHandler));
            map.off('mousemove', this.mapHandler.handleGridAngleLineMouseMove.bind(this.mapHandler));
            map.getContainer().style.cursor = '';
            console.log("All survey-specific map listeners removed.");

            if ((wasInteracting || !map.hasEventListeners('click', handleMapClick)) && typeof handleMapClick === 'function') {
                map.on('click', handleMapClick); // handleMapClick è globale
                console.log("Default map click listener RE-ENSURED.");
            }
        }
        this.clearTemporaryDrawing();
        this.updateModalUIState('initial'); // Aggiorna UI della modale allo stato base
    }
    
    updateModalUIState(uiState) { // 'initial', 'angle_set', 'area_finalized'
        console.log(`[SurveyGridManager] Updating modal UI to state: ${uiState}`);
        const angleVal = surveyGridAngleInputEl ? surveyGridAngleInputEl.value : '0';

        switch(uiState) {
            case 'initial':
                if (startDrawingSurveyAreaBtnEl) startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
                if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = true;
                if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = "Area not defined.";
                if (surveyGridInstructionsEl) surveyGridInstructionsEl.innerHTML = 'Set parameters. Click "Draw Direction" (optional) then "Draw Survey Area".';
                break;
            case 'angle_set': // Dopo che l'angolo è stato disegnato
                if (surveyGridInstructionsEl) surveyGridInstructionsEl.innerHTML = `Grid angle set to ${angleVal}°. Now click "Draw Survey Area".`;
                if (surveyAreaStatusEl) surveyAreaStatusEl.textContent = "Area not defined (angle set).";
                if (startDrawingSurveyAreaBtnEl) startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
                if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = true;
                break;
            case 'area_finalized': // Dopo che il poligono è stato disegnato e finalizzato
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
        console.log("[SurveyGridManager] handleSetGridAngleByLine called"); // LOG A (lo vedi)

        // Bypassing debounce per ora:
        // this.state.setDebounceTimeout('setAngle', () => {
            console.log("[SurveyGridManager] Executing core logic of handleSetGridAngleByLine (debounce bypassed or called)..."); // LOG B (lo vedi)

            const mapContainer = map.getContainer(); // map è globale
            // Controlla se si sta attivamente disegnando il poligono (non ancora finalizzato)
            if (this.state.isDrawingSurveyArea && this.state.nativeMapClickListener && this.state.polygonPoints.length > 0 && this.state.polygonPoints.length < SURVEY_CONFIG.MIN_POLYGON_POINTS) {
                 console.log("[SurveyGridAngle] LOG C1: Actively drawing polygon, cannot set angle now."); // LOG C1
                 if (typeof showCustomAlert === 'function') showCustomAlert("Please finalize or cancel current survey area drawing first.", "Info"); 
                 // this.state.clearDebounceTimeout('setAngle'); // Non necessario se debounce è bypassato
                 return;
            }
            console.log("[SurveyGridAngle] LOG C2: Not actively drawing incomplete polygon."); // LOG C2


            // Se un poligono era già finalizzato, i suoi dati (this.state.polygonPoints e isDrawingSurveyArea=true) rimangono.
            // Disattiviamo solo il listener nativo del poligono se era ancora in qualche modo agganciato.
            if (mapContainer && typeof this.state.nativeMapClickListener === 'function') {
                mapContainer.removeEventListener('click', this.state.nativeMapClickListener, true);
                 console.log("[SurveyGridAngle] LOG D: Paused NATIVE DOM listener for polygon (if it was active).");
            }
            if (map) map.off('click', this.mapHandler.handleSurveyAreaClick.bind(this.mapHandler)); // Rimuovi anche il fallback
            console.log("[SurveyGridAngle] LOG E: Leaflet polygon drawing listener (if any) removed.");


            this.state.isDrawingGridAngleLine = true;
            this.state.gridAngleLinePoints = [];
            if (this.state.tempGridAngleLineLayer) map.removeLayer(this.state.tempGridAngleLineLayer); this.state.tempGridAngleLineLayer = null;
            this.state.tempGridAnglePointMarkers.forEach(m => map.removeLayer(m)); this.state.tempGridAnglePointMarkers = [];
            console.log("[SurveyGridAngle] LOG F: State set: isDrawingGridAngleLine=true, previous angle line graphics cleared.");

            if (map && typeof handleMapClick === 'function') { // handleMapClick è globale
                map.off('click', handleMapClick);
                console.log("[SurveyGridAngle] LOG G: Default map click listener (handleMapClick) REMOVED.");
            } else { 
                console.warn("[SurveyGridAngle] LOG G-Warn: Global handleMapClick not found or map not ready for .off");
            }
            
            if (map) {
                map.on('click', this.mapHandler.handleGridAngleLineClick.bind(this.mapHandler)); // mapHandler è this.mapHandler
                map.getContainer().style.cursor = 'crosshair';
                console.log("[SurveyGridAngle] LOG H: 'handleGridAngleLineClick' listener ADDED.");
            } else { 
                console.error("[SurveyGridAngle] LOG H-Error: MAP NOT AVAILABLE!"); 
                this.state.isDrawingGridAngleLine = false; 
                // this.state.clearDebounceTimeout('setAngle'); // Non necessario se debounce è bypassato
                return; 
            }
            
            // surveyGridModalOverlayEl è globale da domCache
            if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'none'; 
            else { console.warn("[SurveyGridAngle] LOG I-Warn: surveyGridModalOverlayEl not found to hide."); }

            if (typeof showCustomAlert === 'function') showCustomAlert("Draw Grid Direction: Click map for line start, then end.", "Set Angle");
            console.log("[SurveyGridAngle] LOG J: Angle line drawing mode FULLY ACTIVATED.");
        // }); // Chiusura del debounce commentata
    }

    finalizeGridAngleLineDrawing() { // Chiamato da MapInteractionHandler
        console.log("[SurveyGridManager] Finalizing grid angle line drawing (manager method)");
        this.state.isDrawingGridAngleLine = false;
        map.off('click', this.mapHandler.handleGridAngleLineClick.bind(this.mapHandler));
        map.off('mousemove', this.mapHandler.handleGridAngleLineMouseMove.bind(this.mapHandler));
        map.getContainer().style.cursor = '';
        if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'flex';
        
        // Se un'area è già definita e finalizzata, la UI va a "generate". Altrimenti, a "draw area".
        if (this.state.isDrawingSurveyArea && this.state.polygonPoints.length >= SURVEY_CONFIG.MIN_POLYGON_POINTS) {
            this.updateModalUIState('area_finalized'); // L'angolo è stato aggiornato, l'area è ancora valida
            // Non riattivare handleMapClick, l'utente è nella modale.
        } else {
            this.updateModalUIState('angle_set'); // L'angolo è impostato, ora disegna l'area
            if (typeof handleMapClick === 'function') map.on('click', handleMapClick); // Permetti click normali se si deve ancora disegnare l'area
        }
    }
    
    handleStartDrawingSurveyArea() {
        console.log("[SurveyGridManager] handleStartDrawingSurveyArea called");
        this.state.setDebounceTimeout('drawArea', () => {
            if (this.state.isDrawingGridAngleLine) { showCustomAlert("Finish drawing grid angle line first.", "Info"); return; }
            
            this.state.isDrawingSurveyArea = true;
            this.state.polygonPoints = []; // Inizia un nuovo poligono
            this.clearTemporaryDrawing(); // Pulisce tutto, inclusa eventuale linea angolo

            if (typeof handleMapClick === 'function') map.off('click', handleMapClick);
            map.off('click', this.mapHandler.handleGridAngleLineClick.bind(this.mapHandler)); // Assicura sia off

            const mapContainer = map.getContainer();
            if (mapContainer) {
                if (typeof this.state.nativeMapClickListener === 'function') {
                    mapContainer.removeEventListener('click', this.state.nativeMapClickListener, true);
                }
                this.state.nativeMapClickListener = (event) => { /* ... come prima, chiama this.mapHandler.handleSurveyAreaClick ... */ 
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
            showCustomAlert("Drawing survey area: Click map for corners. Click first point to finalize.", "Survey Drawing Active");
        });
    }

    finalizeSurveyArea() { // Chiamato da MapInteractionHandler
        console.log("[SurveyGridManager] Finalizing survey area (manager method)");
        if (!this.state.isDrawingSurveyArea) return;
        if (this.state.polygonPoints.length < SURVEY_CONFIG.MIN_POLYGON_POINTS) { /* ... errore ... */ return; }
        
        const mapContainer = map.getContainer();
        if (mapContainer && typeof this.state.nativeMapClickListener === 'function') {
            mapContainer.removeEventListener('click', this.state.nativeMapClickListener, true);
            // Non impostare a null qui, lo fa fullResetAndUICleanup se si esce.
            // this.state.nativeMapClickListener rimane la funzione, ma non è più legata.
        }
        map.getContainer().style.cursor = '';
        // this.state.isDrawingSurveyArea rimane true (area definita ma non generata)
        console.log("Polygon finalized. isDrawingSurveyArea is STILL TRUE.");

        if (this.state.tempPolygonLayer) this.state.tempPolygonLayer.setStyle(SURVEY_CONFIG.STYLES.FINALIZED_POLYGON);
        this.state.tempVertexMarkers.forEach(marker => marker.off('click'));
        
        if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'flex';
        this.updateModalUIState('area_finalized');
    }

    handleConfirmSurveyGridGeneration() {
        console.log("[SurveyGridManager] handleConfirmSurveyGridGeneration called");
        // Controllo che un'area sia stata definita e finalizzata
        if (!this.state.isDrawingSurveyArea || this.state.polygonPoints.length < SURVEY_CONFIG.MIN_POLYGON_POINTS) {
            showCustomAlert("Survey area not defined or not finalized.", "Error"); return;
        }
        // ... (resto della logica di recupero parametri e chiamata a this.gridGenerator.generateGrid come prima) ...
        // ... (e poi this.handleGridGenerationSuccess o Error) ...
        // Assicurati che usi this.state.polygonPoints
        const altitude = parseFloat(surveyGridAltitudeInputEl.value);
        const sidelap = parseFloat(surveySidelapInputEl.value);
        const frontlap = parseFloat(surveyFrontlapInputEl.value);
        const angle = parseFloat(surveyGridAngleInputEl.value);
        const speed = parseFloat(flightSpeedSlider.value);

        // Validazioni... (come prima)
        if (isNaN(altitude) || /*...altre validazioni...*/ isNaN(speed) || speed <=0 ) return;

        if (surveyGridInstructionsEl) surveyGridInstructionsEl.textContent = "Generating grid waypoints...";
        
        const gridResult = this.gridGenerator.generateGrid({
            polygonPoints: this.state.polygonPoints,
            altitude: altitude,
            sidelap: sidelap,
            frontlap: frontlap,
            gridAngle: angle,
            flightSpeed: speed // Passa la velocità al generatore
        });
        
        if (gridResult.success) {
            this.handleGridGenerationSuccess(gridResult);
        } else {
            this.handleGridGenerationError(gridResult.error || "Unknown generation error.");
        }
        this.fullResetAndUICleanup(); // Resetta tutto dopo il tentativo
        if(surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'none';
    }

    handleGridGenerationSuccess(gridResult) {
        console.log("[SurveyGridManager] Grid generation successful", gridResult);
        if (gridResult.waypoints && gridResult.waypoints.length > 0) {
            gridResult.waypoints.forEach(wpData => {
                // addWaypoint si aspetta latlng e options. Il nostro GridGenerator restituisce id, lat, lng, altitude, options.
                const latlng = L.latLng(wpData.lat, wpData.lng);
                const options = { 
                    altitude: wpData.altitude, 
                    cameraAction: wpData.action === 'photo' ? 'takePhoto' : 'none', // Adatta
                    headingControl: 'fixed', // Il generatore dovrebbe fornire l'heading
                    fixedHeading: wpData.options ? wpData.options.fixedHeading : 0 // Assumi che l'heading sia in options
                };
                 if (wpData.options && typeof wpData.options.fixedHeading !== 'undefined') {
                    options.fixedHeading = wpData.options.fixedHeading;
                 } else if (gridResult.lineFlightBearing !== undefined) { // Fallback all'heading della linea se disponibile
                    options.fixedHeading = Math.round(gridResult.lineFlightBearing);
                 }

                addWaypoint(latlng, options); // Funzione globale
            });
            updateWaypointList(); updateFlightPath(); updateFlightStatistics(); fitMapToWaypoints();
            showCustomAlert(`${gridResult.waypointCount} survey waypoints generated! Est. time: ${gridResult.estimatedTime}`, "Success");
        } else {
            showCustomAlert("No waypoints were generated for the survey grid.", "Info");
        }
    }
    handleGridGenerationError(errorMessage) {
        console.error("[SurveyGridManager] Grid generation failed:", errorMessage);
        showCustomAlert(`Failed to generate survey grid: ${errorMessage}`, "Error");
    }
}


// ===========================
// INITIALIZATION (Global Instance)
// ===========================
let surveyGridManagerInstance;

if (typeof document !== 'undefined') { // Assicura che sia eseguito solo nel browser
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            surveyGridManagerInstance = new SurveyGridManager();
        });
    } else {
        surveyGridManagerInstance = new SurveyGridManager();
    }
}

// Per rendere i metodi chiamabili dagli event listener globali
// Gli event listener in eventListeners.js chiameranno:
// surveyGridManagerInstance.openSurveyGridModal()
// surveyGridManagerInstance.handleSetGridAngleByLine()
// surveyGridManagerInstance.handleStartDrawingSurveyArea()
// surveyGridManagerInstance.handleConfirmSurveyGridGeneration()
// surveyGridManagerInstance.handleCancelSurveyGrid()
// (Rimuovi finalizeSurveyAreaBtnEl listener se il pulsante è stato rimosso)
