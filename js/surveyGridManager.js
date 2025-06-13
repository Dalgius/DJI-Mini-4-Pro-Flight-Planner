// File: surveyGridManager.js - Enhanced Version with Improvements

let currentPolygonPoints = [];
let tempPolygonLayer = null;
let tempVertexMarkers = [];
let nativeMapClickListener = null;

// Variabili per il disegno dell'angolo
let angleDrawStartPoint = null;
let tempAngleLineLayer = null;

const MIN_POLYGON_POINTS = 3;
const MAX_POLYGON_POINTS = 50; // Prevent excessive polygon complexity

const FIXED_CAMERA_PARAMS = {
    sensorWidth_mm: 8.976,
    sensorHeight_mm: 6.716,
    focalLength_mm: 6.88
};

// Enhanced validation constants
const VALIDATION_LIMITS = {
    altitude: { min: 1, max: 500 },
    sidelap: { min: 10, max: 95 },
    frontlap: { min: 10, max: 95 },
    speed: { min: 0.1, max: 30 },
    angle: { min: -360, max: 360 }
};

// === HELPER FUNCTIONS ===
function clearTemporaryDrawing() {
    if (tempPolygonLayer) {
        map.removeLayer(tempPolygonLayer);
        tempPolygonLayer = null;
    }
    tempVertexMarkers.forEach(marker => {
        marker.off(); // Remove all event listeners
        map.removeLayer(marker);
    });
    tempVertexMarkers = [];
    if (tempAngleLineLayer) { 
        map.removeLayer(tempAngleLineLayer);
        tempAngleLineLayer = null;
    }
}

function updateTempPolygonDisplay() {
    if (tempPolygonLayer) {
        map.removeLayer(tempPolygonLayer);
        tempPolygonLayer = null;
    }
    if (currentPolygonPoints.length < 2) return;
    
    const opts = { 
        color: 'rgba(0, 100, 255, 0.7)', 
        weight: 2, 
        fillColor: 'rgba(0, 100, 255, 0.2)', 
        fillOpacity: 0.3 
    };
    
    if (currentPolygonPoints.length === 2) {
        tempPolygonLayer = L.polyline(currentPolygonPoints, opts).addTo(map);
    } else if (currentPolygonPoints.length >= 3) {
        tempPolygonLayer = L.polygon(currentPolygonPoints, opts).addTo(map);
    }
}

function rotateLatLng(pointLatLng, centerLatLng, angleRadians) {
    const cosAngle = Math.cos(angleRadians);
    const sinAngle = Math.sin(angleRadians);
    const dLngScaled = (pointLatLng.lng - centerLatLng.lng) * Math.cos(toRad(centerLatLng.lat));
    const dLat = pointLatLng.lat - centerLatLng.lat;
    const rotatedDLngScaled = dLngScaled * cosAngle - dLat * sinAngle;
    const rotatedDLat = dLngScaled * sinAngle + dLat * cosAngle;
    const finalLng = centerLatLng.lng + (rotatedDLngScaled / Math.cos(toRad(centerLatLng.lat)));
    const finalLat = centerLatLng.lat + rotatedDLat;
    return L.latLng(finalLat, finalLng);
}

function isPointInPolygon(point, polygonVertices) {
    if (!point || !polygonVertices || polygonVertices.length < 3) return false;
    
    let isInside = false;
    const x = point.lng;
    const y = point.lat;
    
    for (let i = 0, j = polygonVertices.length - 1; i < polygonVertices.length; j = i++) {
        const xi = polygonVertices[i].lng, yi = polygonVertices[i].lat;
        const xj = polygonVertices[j].lng, yj = polygonVertices[j].lat;
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
    }
    return isInside;
}

function calculateFootprint(altitudeAGL, cameraParams) {
    if (!cameraParams || !cameraParams.focalLength_mm || cameraParams.focalLength_mm === 0) {
        console.error("Invalid camera parameters for footprint calculation.");
        return { width: 0, height: 0 };
    }
    const footprintWidth = (cameraParams.sensorWidth_mm / cameraParams.focalLength_mm) * altitudeAGL;
    const footprintHeight = (cameraParams.sensorHeight_mm / cameraParams.focalLength_mm) * altitudeAGL;
    return { width: footprintWidth, height: footprintHeight };
}

// Enhanced validation function
function validateSurveyGridInputs(altitude, sidelap, frontlap, angle, speed) {
    const errors = [];
    
    if (isNaN(altitude) || altitude < VALIDATION_LIMITS.altitude.min || altitude > VALIDATION_LIMITS.altitude.max) {
        errors.push(`Altitude must be between ${VALIDATION_LIMITS.altitude.min} and ${VALIDATION_LIMITS.altitude.max} meters`);
    }
    
    if (isNaN(sidelap) || sidelap < VALIDATION_LIMITS.sidelap.min || sidelap > VALIDATION_LIMITS.sidelap.max) {
        errors.push(`Sidelap must be between ${VALIDATION_LIMITS.sidelap.min}% and ${VALIDATION_LIMITS.sidelap.max}%`);
    }
    
    if (isNaN(frontlap) || frontlap < VALIDATION_LIMITS.frontlap.min || frontlap > VALIDATION_LIMITS.frontlap.max) {
        errors.push(`Frontlap must be between ${VALIDATION_LIMITS.frontlap.min}% and ${VALIDATION_LIMITS.frontlap.max}%`);
    }
    
    if (isNaN(angle) || angle < VALIDATION_LIMITS.angle.min || angle > VALIDATION_LIMITS.angle.max) {
        errors.push(`Angle must be between ${VALIDATION_LIMITS.angle.min}° and ${VALIDATION_LIMITS.angle.max}°`);
    }
    
    if (isNaN(speed) || speed < VALIDATION_LIMITS.speed.min || speed > VALIDATION_LIMITS.speed.max) {
        errors.push(`Speed must be between ${VALIDATION_LIMITS.speed.min} and ${VALIDATION_LIMITS.speed.max} m/s`);
    }
    
    return errors;
}

// Calculate polygon area for better feedback
function calculatePolygonArea(polygonLatLngs) {
    if (!polygonLatLngs || polygonLatLngs.length < 3) return 0;
    
    const earthRadius = 6371000; // meters
    let area = 0;
    
    for (let i = 0; i < polygonLatLngs.length; i++) {
        const j = (i + 1) % polygonLatLngs.length;
        const lat1 = toRad(polygonLatLngs[i].lat);
        const lat2 = toRad(polygonLatLngs[j].lat);
        const deltaLng = toRad(polygonLatLngs[j].lng - polygonLatLngs[i].lng);
        
        area += deltaLng * (2 + Math.sin(lat1) + Math.sin(lat2));
    }
    
    area = Math.abs(area * earthRadius * earthRadius / 2);
    return area; // square meters
}

// === UI HANDLERS ===
function openSurveyGridModal() {
    if (!surveyGridModalOverlayEl) {
        showCustomAlert(translate('errorTitle'), "Survey grid modal elements not found.");
        return;
    }
    
    // Initialize form values with defaults
    surveyGridAltitudeInputEl.value = defaultAltitudeSlider.value;
    if (!surveySidelapInputEl.value) surveySidelapInputEl.value = 70;
    if (!surveyFrontlapInputEl.value) surveyFrontlapInputEl.value = 80;
    if (surveyGridAngleInputEl && !surveyGridAngleInputEl.value) surveyGridAngleInputEl.value = 0;

    cancelSurveyAreaDrawing();
    confirmSurveyGridBtnEl.disabled = true;
    finalizeSurveyAreaBtnEl.style.display = 'none';
    startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
    
    surveyAreaStatusEl.innerHTML = translate('surveyAreaStatusDefault');
    surveyGridInstructionsEl.innerHTML = translate('surveyGridInstructions');
    surveyGridModalOverlayEl.style.display = 'flex';
}

function cancelSurveyAreaDrawing() {
    const wasActive = isDrawingSurveyArea || nativeMapClickListener || isDrawingGridAngle;
    isDrawingSurveyArea = false;
    isDrawingGridAngle = false;
    
    if (map) {
        map.dragging.enable();
        map.getContainer().style.cursor = '';
        
        // Clean up event listeners
        if (nativeMapClickListener) {
            map.getContainer().removeEventListener('click', nativeMapClickListener, true);
            nativeMapClickListener = null;
        }
        
        map.off('click', handleSurveyAreaMapClick);
        map.off('mousedown', onAngleDrawStart);
        map.off('mousemove', onAngleDrawMove);
        map.off('mouseup', onAngleDrawEnd);

        // Restore original map click handler if it was active
        if (wasActive && !map.hasEventListeners('click')) {
             if (typeof handleMapClick === 'function') {
                 map.on('click', handleMapClick);
             }
        }
    }
    
    clearTemporaryDrawing();
    currentPolygonPoints = [];
    angleDrawStartPoint = null;

    // Reset UI elements
    if (startDrawingSurveyAreaBtnEl) startDrawingSurveyAreaBtnEl.style.display = 'inline-block';
    if (finalizeSurveyAreaBtnEl) finalizeSurveyAreaBtnEl.style.display = 'none';
    if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = true;
    if (surveyAreaStatusEl) surveyAreaStatusEl.innerHTML = translate('surveyAreaStatusDefault');
    if (surveyGridInstructionsEl) surveyGridInstructionsEl.innerHTML = translate('surveyGridInstructions');
}

function handleStartDrawingSurveyArea() {
    if (!map || !surveyGridModalOverlayEl) return;
    
    isDrawingSurveyArea = true;
    currentPolygonPoints = [];
    clearTemporaryDrawing();

    // Remove existing click handlers
    if (typeof handleMapClick === 'function') {
        map.off('click', handleMapClick);
    }
    map.off('click', handleSurveyAreaMapClick);
    map.on('click', handleSurveyAreaMapClick);

    map.getContainer().style.cursor = 'crosshair';
    surveyGridModalOverlayEl.style.display = 'none';
    showCustomAlert(translate('alert_surveyDrawingActive', {minPoints: MIN_POLYGON_POINTS}), translate('infoTitle'));
}

function handleDrawGridAngle() {
    if (!currentPolygonPoints || currentPolygonPoints.length < MIN_POLYGON_POINTS) {
        showCustomAlert('Please define a survey area first before setting the grid angle.', 'Error');
        return;
    }
    
    isDrawingGridAngle = true;
    angleDrawStartPoint = null;

    if (typeof handleMapClick === 'function') map.off('click', handleMapClick);
    
    map.dragging.disable();
    map.on('mousedown', onAngleDrawStart);
    
    map.getContainer().style.cursor = 'crosshair';
    surveyGridModalOverlayEl.style.display = 'none';
    showCustomAlert(translate('infoTitle'), translate('alert_drawAngleInstruction'));
}

function onAngleDrawStart(e) {
    if (!isDrawingGridAngle) return;
    
    e.originalEvent.preventDefault();
    e.originalEvent.stopPropagation();
    
    angleDrawStartPoint = e.latlng;
    
    map.on('mousemove', onAngleDrawMove);
    map.on('mouseup', onAngleDrawEnd);
}

function onAngleDrawMove(e) {
    if (!isDrawingGridAngle || !angleDrawStartPoint) return;
    
    if (tempAngleLineLayer) {
        map.removeLayer(tempAngleLineLayer);
    }
    
    const currentPoint = e.latlng;
    tempAngleLineLayer = L.polyline([angleDrawStartPoint, currentPoint], {
        color: '#f39c12',
        weight: 3,
        dashArray: '5, 10'
    }).addTo(map);
}

function onAngleDrawEnd(e) {
    if (!isDrawingGridAngle || !angleDrawStartPoint) return;
    
    e.originalEvent.preventDefault();
    e.originalEvent.stopPropagation();
    
    const endPoint = e.latlng;
    const bearing = calculateBearing(angleDrawStartPoint, endPoint);
    
    // Normalize angle to 0-360 range
    const gridAngle = ((bearing % 360) + 360) % 360;
    const displayAngle = Math.round(gridAngle > 180 ? gridAngle - 360 : gridAngle);

    if (surveyGridAngleInputEl) {
        surveyGridAngleInputEl.value = displayAngle;
    }
    
    // Cleanup
    isDrawingGridAngle = false;
    angleDrawStartPoint = null;
    map.dragging.enable();
    map.getContainer().style.cursor = '';
    
    if (tempAngleLineLayer) {
        map.removeLayer(tempAngleLineLayer);
        tempAngleLineLayer = null;
    }
    
    map.off('mousedown', onAngleDrawStart);
    map.off('mousemove', onAngleDrawMove);
    map.off('mouseup', onAngleDrawEnd);
    
    if (typeof handleMapClick === 'function' && !map.hasEventListeners('click')) {
        map.on('click', handleMapClick);
    }
    
    if (surveyGridModalOverlayEl) {
        surveyGridModalOverlayEl.style.display = 'flex';
    }
    
    showCustomAlert(`Grid angle set to ${displayAngle}°`, 'Success');
}

function handleSurveyAreaMapClick(e) {
    if (!isDrawingSurveyArea) return;

    const clickedLatLng = e.latlng;
    
    // Check if clicking near the first point to close polygon
    if (currentPolygonPoints.length >= MIN_POLYGON_POINTS && tempVertexMarkers.length > 0) {
        const firstPointMarker = tempVertexMarkers[0];
        const clickThreshold = 10 * map.getZoomScale(map.getZoom(), 18);
        
        if (firstPointMarker.getLatLng().distanceTo(clickedLatLng) < clickThreshold) {
            handleFinalizeSurveyArea();
            return;
        }
    }
    
    // Prevent too many points
    if (currentPolygonPoints.length >= MAX_POLYGON_POINTS) {
        showCustomAlert(`Maximum ${MAX_POLYGON_POINTS} points allowed for survey area.`, 'Warning');
        return;
    }
    
    currentPolygonPoints.push(clickedLatLng);

    const vertexMarker = L.circleMarker(clickedLatLng, { 
        radius: 6, 
        color: 'rgba(255,0,0,0.8)', 
        fillColor: 'rgba(255,0,0,0.5)', 
        fillOpacity: 0.7, 
        pane: 'markerPane' 
    }).addTo(map);

    // Add click handler to first point for closing polygon
    if (currentPolygonPoints.length === 1) {
        vertexMarker.on('click', (clickEvent) => {
             clickEvent.originalEvent.stopPropagation();
             if (isDrawingSurveyArea && currentPolygonPoints.length >= MIN_POLYGON_POINTS) {
                handleFinalizeSurveyArea();
            }
        });
    }

    tempVertexMarkers.push(vertexMarker);
    updateTempPolygonDisplay();
    
    // Update status
    if (surveyAreaStatusEl) {
        const areaInfo = currentPolygonPoints.length >= MIN_POLYGON_POINTS ? 
            ` (${(calculatePolygonArea(currentPolygonPoints) / 10000).toFixed(2)} ha)` : '';
        surveyAreaStatusEl.innerHTML = `${currentPolygonPoints.length} points selected${areaInfo}`;
    }
}

function handleFinalizeSurveyArea() {
    if (!isDrawingSurveyArea || currentPolygonPoints.length < MIN_POLYGON_POINTS) return;
    
    map.getContainer().style.cursor = '';
    isDrawingSurveyArea = false;
    
    // Clean up event listeners
    map.off('click', handleSurveyAreaMapClick);
    if (typeof handleMapClick === 'function' && !map.hasEventListeners('click')) {
        map.on('click', handleMapClick);
    }
    
    // Update UI
    if (surveyGridModalOverlayEl) {
        surveyGridModalOverlayEl.style.display = 'flex';
    }
    if (finalizeSurveyAreaBtnEl) finalizeSurveyAreaBtnEl.style.display = 'none';
    if (confirmSurveyGridBtnEl) confirmSurveyGridBtnEl.disabled = false;
    
    // Calculate and display area info
    const area = calculatePolygonArea(currentPolygonPoints);
    const areaHa = (area / 10000).toFixed(2);
    
    if (surveyAreaStatusEl) {
        surveyAreaStatusEl.innerHTML = translate('surveyAreaStatusDefined', { 
            points: currentPolygonPoints.length,
            area: areaHa
        });
    }
    if (surveyGridInstructionsEl) {
        surveyGridInstructionsEl.innerHTML = translate('surveyGridInstructionsFinalized');
    }
    
    // Style the finalized polygon
    if (tempPolygonLayer) {
        tempPolygonLayer.setStyle({ 
            color: 'rgba(0, 150, 0, 0.9)', 
            fillColor: 'rgba(0, 150, 0, 0.3)',
            weight: 3
        });
    }
    
    // Remove click handlers from vertex markers
    tempVertexMarkers.forEach(marker => marker.off('click'));
    
    showCustomAlert(`Survey area defined: ${areaHa} hectares`, 'Success');
}

function handleCancelSurveyGrid() {
    cancelSurveyAreaDrawing();
    if (surveyGridModalOverlayEl) surveyGridModalOverlayEl.style.display = 'none';
}

function generateSurveyGridWaypoints(polygonLatLngs, flightAltitudeAGL, sidelapPercent, frontlapPercent, gridAngleDeg, flightSpeed) {
    const finalWaypointsData = [];
    
    if (!polygonLatLngs || polygonLatLngs.length < MIN_POLYGON_POINTS) {
        showCustomAlert(translate('alert_surveyGridInvalidPoly'), "Error");
        return finalWaypointsData;
    }

    const footprint = calculateFootprint(flightAltitudeAGL, FIXED_CAMERA_PARAMS);
    
    if (footprint.width === 0 || footprint.height === 0) {
        showCustomAlert('Invalid camera footprint calculation', 'Error');
        return finalWaypointsData;
    }
    
    console.log("=== SURVEY GRID GENERATION DEBUG ===");
    console.log("Input angle:", gridAngleDeg, "°");
    console.log("Footprint:", footprint, "meters");
    console.log("Polygon points:", polygonLatLngs.length);

    // Flight lines parallel to the drawn angle
    const flightLineDirection = gridAngleDeg;
    const fixedGridHeading = flightLineDirection;
    
    // Rotation angle for coordinate system (perpendicular to flight lines)
    const rotationAngleDeg = -(flightLineDirection + 90) % 360;
    
    console.log("Flight line direction:", flightLineDirection, "°");
    console.log("Drone heading:", fixedGridHeading, "°");
    console.log("Coordinate rotation:", rotationAngleDeg, "°");

    const actualLineSpacing = footprint.width * (1 - sidelapPercent / 100);
    const actualDistanceBetweenPhotos = footprint.height * (1 - frontlapPercent / 100);
    
    console.log("Line spacing:", actualLineSpacing.toFixed(2), "m");
    console.log("Photo spacing:", actualDistanceBetweenPhotos.toFixed(2), "m");
    
    const rotationCenter = polygonLatLngs[0];
    const angleRad = toRad(rotationAngleDeg);
    const rotatedPolygonLatLngs = polygonLatLngs.map(p => rotateLatLng(p, rotationCenter, -angleRad));
    const rotatedBounds = L.latLngBounds(rotatedPolygonLatLngs);
    const rNE = rotatedBounds.getNorthEast();
    const rSW = rotatedBounds.getSouthWest();
    
    const earthR = (typeof R_EARTH !== 'undefined') ? R_EARTH : 6371000;
    const lineSpacingRotLat = (actualLineSpacing / earthR) * (180 / Math.PI);
    
    let currentRotLat = rSW.lat;
    let scanDir = 1;
    let lineCount = 0;

    while (currentRotLat <= rNE.lat + lineSpacingRotLat * 0.5) {
        const photoSpacingRotLng = (actualDistanceBetweenPhotos / (earthR * Math.cos(toRad(currentRotLat)))) * (180 / Math.PI);
        const lineCandRot = [];
        
        if (scanDir === 1) {
            for (let curRotLng = rSW.lng; curRotLng <= rNE.lng; curRotLng += photoSpacingRotLng) {
                lineCandRot.push(L.latLng(currentRotLat, curRotLng));
            }
            if (lineCandRot.length === 0 || lineCandRot[lineCandRot.length - 1].lng < rNE.lng - 1e-7) {
                lineCandRot.push(L.latLng(currentRotLat, rNE.lng));
            }
        } else {
            for (let curRotLng = rNE.lng; curRotLng >= rSW.lng; curRotLng -= photoSpacingRotLng) {
                lineCandRot.push(L.latLng(currentRotLat, curRotLng));
            }
            if (lineCandRot.length === 0 || lineCandRot[lineCandRot.length - 1].lng > rSW.lng + 1e-7) {
                lineCandRot.push(L.latLng(currentRotLat, rSW.lng));
            }
        }
        
        const wpOptions = { 
            altitude: flightAltitudeAGL, 
            cameraAction: 'takePhoto', 
            headingControl: 'fixed', 
            fixedHeading: fixedGridHeading,
            gimbalPitch: -90, // <-- MODIFICA APPLICATA QUI
            waypointType: 'grid',
            speed: flightSpeed
        };

        let lineWaypointCount = 0;
        lineCandRot.forEach(rotPt => {
            const actualGeoPt = rotateLatLng(rotPt, rotationCenter, angleRad);
            if (isPointInPolygon(actualGeoPt, polygonLatLngs)) {
                finalWaypointsData.push({ latlng: actualGeoPt, options: wpOptions });
                lineWaypointCount++;
            }
        });
        
        if (lineWaypointCount > 0) {
            console.log(`Line ${lineCount}: ${lineWaypointCount} waypoints`);
            lineCount++;
        }
        
        currentRotLat += lineSpacingRotLat;
        scanDir *= -1;
    }
    
    // Remove duplicate waypoints
    const uniqueWaypoints = [];
    const seenKeys = new Set();
    for (const wp of finalWaypointsData) {
        const key = `${wp.latlng.lat.toFixed(7)},${wp.latlng.lng.toFixed(7)}`;
        if (!seenKeys.has(key)) {
            uniqueWaypoints.push(wp);
            seenKeys.add(key);
        }
    }
    
    console.log("Total waypoints generated:", uniqueWaypoints.length);
    console.log("=====================================");
    
    if (uniqueWaypoints.length === 0 && polygonLatLngs.length >= MIN_POLYGON_POINTS) {
        showCustomAlert(translate('alert_surveyGridNoWps'), translate('infoTitle'));
    }
    
    return uniqueWaypoints;
}

function handleConfirmSurveyGridGeneration() {
    const altitude = parseInt(surveyGridAltitudeInputEl.value);
    const sidelap = parseFloat(surveySidelapInputEl.value);
    const frontlap = parseFloat(surveyFrontlapInputEl.value);
    const angle = parseFloat(surveyGridAngleInputEl.value) || 0;
    const speed = parseFloat(flightSpeedSlider.value);

    // Enhanced validation
    const validationErrors = validateSurveyGridInputs(altitude, sidelap, frontlap, angle, speed);
    if (validationErrors.length > 0) {
        showCustomAlert(validationErrors.join('\n'), translate('inputErrorTitle'));
        return;
    }

    // Check if survey area is defined
    if (!currentPolygonPoints || currentPolygonPoints.length < MIN_POLYGON_POINTS) {
        showCustomAlert('Please define a survey area first.', translate('inputErrorTitle'));
        return;
    }

    // Generate waypoints
    const surveyWaypoints = generateSurveyGridWaypoints(
        currentPolygonPoints, 
        altitude, 
        sidelap, 
        frontlap, 
        angle, 
        speed
    );

    if (surveyWaypoints && surveyWaypoints.length > 0) {
        // Add waypoints to map
        surveyWaypoints.forEach(wpData => {
            addWaypoint(wpData.latlng, wpData.options);
        });
        
        // Update UI
        updateWaypointList();
        updateFlightPath();
        updateFlightStatistics();
        fitMapToWaypoints();
        
        // Calculate estimated flight time and coverage
        const area = calculatePolygonArea(currentPolygonPoints);
        const estimatedTime = Math.ceil(surveyWaypoints.length * 2); // rough estimate
        
        showCustomAlert(
            translate('alert_surveyGridSuccess', { 
                count: surveyWaypoints.length,
                area: (area / 10000).toFixed(2),
                time: estimatedTime
            }), 
            translate('successTitle')
        );
    } else {
        showCustomAlert('No waypoints could be generated for this configuration.', 'Warning');
    }
    
    handleCancelSurveyGrid();
}

// === UTILITY FUNCTIONS ===
function toRad(degrees) {
    return degrees * (Math.PI / 180);
}

function toDeg(radians) {
    return radians * (180 / Math.PI);
}

function calculateBearing(from, to) {
    const lat1 = toRad(from.lat);
    const lat2 = toRad(to.lat);
    const deltaLng = toRad(to.lng - from.lng);
    
    const y = Math.sin(deltaLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
    
    const bearing = Math.atan2(y, x);
    return (toDeg(bearing) + 360) % 360;
}
