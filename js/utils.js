// js/utils.js
import { translations, currentLang as getCurrentLangFromI18n } from './i18n.js'; // Per _tr
import * as DOM from './domElements.js';

// Funzione helper per traduzioni (se vuoi usarla anche qui o centralizzarla)
// Potremmo importare _tr da i18n.js invece di ridefinirla
export function _tr(key, params = null) {
    let currentLang = getCurrentLangFromI18n();
    let stringSet = translations[currentLang] || translations.en;
    let string = stringSet[key] || key; 

    if (typeof string === 'function' && params !== null) {
        return string(...(Array.isArray(params) ? params : [params]));
    }
    return string;
}


export function showCustomAlert(message, title = _tr("alertInfo")) { // Usa _tr per il titolo di default
    if (DOM.customAlertMessageEl && DOM.customAlertOverlayEl && DOM.customAlertTitleEl) {
        DOM.customAlertTitleEl.textContent = title;
        DOM.customAlertMessageEl.textContent = message;
        DOM.customAlertOverlayEl.style.display = 'flex';
    } else { 
        console.error("Custom alert elements not found! Falling back to native alert.");
        alert(message); 
    }
}


export function haversineDistance(coords1, coords2) { 
    function toRad(x) { return x * Math.PI / 180; }
    const lat1 = coords1.lat || coords1[0], lon1 = coords1.lng || coords1[1], 
          lat2 = coords2.lat || coords2[0], lon2 = coords2.lng || coords2[1];
    const R = 6371e3; // Raggio della Terra in metri
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

export function createSmoothPath(pointsArray) { // pointsArray è un array di [lat, lng]
    if (pointsArray.length < 2) return pointsArray;
    const smoothed = []; 
    const numSegments = 15; // Numero di segmenti interpolati per ogni coppia di waypoint
    
    if (pointsArray.length === 2) return [pointsArray[0], pointsArray[1]]; // Linea retta se solo 2 punti

    smoothed.push(pointsArray[0]); // Il primo punto è sempre lo stesso

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
    // Assicurati che l'ultimo punto sia esattamente l'ultimo waypoint per evitare piccoli gap
    // Questo non dovrebbe essere necessario se l'interpolazione Catmull-Rom è corretta,
    // ma come sicurezza. Se l'ultimo punto di `smoothed` non è `pointsArray[pointsArray.length-1]`, aggiungilo.
    // if (smoothed.length > 0 && 
    //     (smoothed[smoothed.length-1][0] !== pointsArray[pointsArray.length-1][0] || 
    //      smoothed[smoothed.length-1][1] !== pointsArray[pointsArray.length-1][1])) {
    //      smoothed.push(pointsArray[pointsArray.length-1]);
    // }
    return smoothed;
}

export function getCameraActionText(actionKey) {
    // Usa la funzione _tr per ottenere il testo tradotto
    return _tr(actionKey) || ''; // Fallback a stringa vuota se la chiave non esiste
}