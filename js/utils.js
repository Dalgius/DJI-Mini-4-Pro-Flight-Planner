// js/utils.js
import * as DOM from './domElements.js';
import { _tr } from './i18n.js'; // Importa _tr da i18n.js

export function showCustomAlert(message, titleKey = "alertInfo") { 
    const title = _tr(titleKey); 
    if (DOM.customAlertMessageEl && DOM.customAlertOverlayEl && DOM.customAlertTitleEl) {
        DOM.customAlertTitleEl.textContent = title;
        // Se il messaggio è una chiave di traduzione, traducila, altrimenti usala così com'è.
        // Per semplicità, assumiamo che 'message' sia già tradotto o sia una stringa diretta.
        // Se vuoi passare chiavi per 'message', dovresti tradurle prima di chiamare showCustomAlert.
        DOM.customAlertMessageEl.textContent = message; 
        DOM.customAlertOverlayEl.style.display = 'flex';
    } else { 
        console.error("Custom alert elements not found for utils.showCustomAlert!");
        alert(title + ": " + message); 
    }
}

export function haversineDistance(coords1, coords2) { 
    function toRad(x) { return x * Math.PI / 180; }
    const lat1 = coords1.lat || coords1[0], lon1 = coords1.lng || coords1[1], 
          lat2 = coords2.lat || coords2[0], lon2 = coords2.lng || coords2[1];
    const R = 6371e3; 
    const φ1 = toRad(lat1), φ2 = toRad(lat2), Δφ = toRad(lat2-lat1), Δλ = toRad(lon2-lon1);
    const a = Math.sin(Δφ/2)*Math.sin(Δφ/2) + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)*Math.sin(Δλ/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export function getCatmullRomPoint(t, p0, p1, p2, p3) { 
    const t2 = t*t, t3 = t2*t;
    const f1 = -0.5*t3 + t2 - 0.5*t, f2 = 1.5*t3 - 2.5*t2 + 1, 
          f3 = -1.5*t3 + 2*t2 + 0.5*t, f4 = 0.5*t3 - 0.5*t2;
    return [
        p0[0]*f1 + p1[0]*f2 + p2[0]*f3 + p3[0]*f4, 
        p0[1]*f1 + p1[1]*f2 + p2[1]*f3 + p3[1]*f4
    ];
}

export function createSmoothPath(pointsArray) { 
    if (pointsArray.length < 2) return pointsArray;
    const smoothed = []; 
    const numSegments = 15; 
    
    if (pointsArray.length === 2) return [pointsArray[0], pointsArray[1]]; 

    smoothed.push(pointsArray[0]); 

    for (let i = 0; i < pointsArray.length - 1; i++) {
        const p0 = (i === 0) ? pointsArray[0] : pointsArray[i - 1]; 
        const p1 = pointsArray[i];
        const p2 = pointsArray[i + 1];
        const p3 = (i === pointsArray.length - 2) ? pointsArray[pointsArray.length - 1] : pointsArray[i + 2]; 

        for (let j = 1; j <= numSegments; j++) { 
            const t = j / numSegments;
            smoothed.push(getCatmullRomPoint(t, p0, p1, p2, p3));
        }
    }
    return smoothed;
}

export function getCameraActionKey(action) { 
    switch(action) {
        case 'takePhoto': return 'cameraActionTakePhoto';
        case 'startRecord': return 'cameraActionStartRecord';
        case 'stopRecord': return 'cameraActionStopRecord';
        default: return 'cameraActionNone'; 
    }
}
