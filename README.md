# DJI Mini 4 Pro - Flight Planner

## Descrizione del Progetto

Questo è un'applicazione web Flight Planner progettata specificamente per droni DJI, con un focus iniziale sul DJI Mini 4 Pro. Permette agli utenti di pianificare missioni di volo con waypoint, definire Punti di Interesse (POI), configurare azioni della fotocamera, e adattare le altitudini dei waypoint per seguire il terreno (AGL - Above Ground Level).

Il planner esporta i piani di volo in diversi formati, incluso un formato KMZ compatibile con WPML per l'importazione su droni DJI (tramite procedure di sostituzione file sull'app DJI Fly) e un formato KML standard per la visualizzazione 3D su Google Earth.

**Demo Live (ospitata su Netlify):** [https://dji-mini-4-pro-flight-planner.netlify.app/](https://dji-mini-4-pro-flight-planner.netlify.app/)
*(Assicurati di sostituire questo URL con quello effettivo del tuo deploy Netlify se è diverso)*

## Funzionalità Principali

*   **Creazione Interattiva di Waypoint:** Aggiungi, sposta (drag & drop), e seleziona waypoint direttamente sulla mappa.
*   **Impostazioni Waypoint Dettagliate:**
    *   Altitudine (relativa al punto di decollo)
    *   Tempo di stazionamento (Hover Time)
    *   Pitch del Gimbal
    *   Controllo dell'Heading (Auto, Fisso, Puntamento verso POI specifico)
    *   Azioni della Fotocamera (Scatta Foto, Avvia/Ferma Registrazione Video)
*   **Gestione Punti di Interesse (POI):**
    *   Aggiungi e nomina POI sulla mappa.
    *   Seleziona un POI specifico come target per l'heading di un waypoint o per la creazione di orbite.
*   **Modifica Multipla dei Waypoint:** Seleziona più waypoint e applica modifiche in batch (heading, azione camera, gimbal pitch, hover time).
*   **Strumenti Terreno & Orbita:**
    *   **Adattamento AGL:** Calcola e adatta automaticamente le altitudini dei waypoint per mantenere un'altezza costante sopra il livello del suolo (AGL), utilizzando dati di elevazione da API esterna (OpenTopoData) tramite un proxy serverless.
    *   **Creazione Orbita POI:** Genera automaticamente waypoint per creare un'orbita attorno a un POI selezionato.
*   **Statistiche di Volo:** Visualizzazione in tempo reale di distanza totale, tempo di volo stimato, numero di waypoint e POI.
*   **Esportazione Piani di Volo:**
    *   **JSON:** Per salvare e ricaricare lo stato completo del planner.
    *   **DJI WPML (.kmz):** Formato compatibile per l'importazione su droni DJI che supportano Waypoint Flight Markup Language.
    *   **Google Earth (.kml):** Per visualizzare il percorso di volo e i waypoint in 3D.
*   **Importazione Piani di Volo:** Carica piani di volo precedentemente salvati in formato JSON.
*   **Interfaccia Mappa Avanzata:**
    *   Layer mappa stradale e satellitare.
    *   Zoom dettagliato.
    *   Funzione "Fit View" per adattare la vista ai waypoint/POI.
    *   Funzione "My Location" per centrare la mappa sulla posizione corrente dell'utente.

## Tecnologie Utilizzate

*   **Frontend:** HTML5, CSS3, JavaScript (Vanilla JS)
*   **Mappa Interattiva:** [Leaflet.js](https://leafletjs.com/)
*   **Creazione Archivi KMZ:** [JSZip](https://stuk.github.io/jszip/)
*   **Dati di Elevazione (per AGL):** API [OpenTopoData](https://www.opentopodata.org/)
*   **Proxy CORS (per API Elevazione):** Netlify Function (Node.js, Axios)
*   **Hosting Frontend:** [Netlify](https://www.netlify.com/)
*   **Version Control:** [Git](https://git-scm.com/) & [GitHub](https://github.com)

## Come Usare

1.  **Accesso:** Apri l'applicazione web all'URL fornito: [https://dji-mini-4-pro-flight-planner.netlify.app/](https://dji-mini-4-pro-flight-planner.netlify.app/)
2.  **Impostazioni di Volo:** Configura l'altitudine di default e la velocità di volo.
3.  **Aggiungere Waypoint:** Clicca sulla mappa per aggiungere waypoint.
4.  **Aggiungere POI:** Tieni premuto `Ctrl` e clicca sulla mappa per aggiungere un Punto di Interesse. Dai un nome al POI nell'input apposito prima di cliccare.
5.  **Modificare Waypoint:**
    *   **Singolo:** Clicca su un waypoint sulla mappa o nella lista per selezionarlo. Il pannello "Waypoint Settings" apparirà, permettendoti di modificare altitudine, hover, gimbal, heading (incluso il puntamento a un POI specifico), e azioni della fotocamera.
    *   **Multiplo:** Usa le checkbox nella lista dei waypoint per selezionarne più di uno. Apparirà il pannello "Edit X Selected Waypoints" per applicare modifiche in batch.
6.  **Adattamento AGL:**
    *   Inserisci l'elevazione MSL del tuo punto di decollo (o usa "Use WP1 Elev." se il primo waypoint è il tuo punto di decollo).
    *   Inserisci l'altezza AGL desiderata.
    *   Clicca "Adapt Waypoint Altitudes to AGL". Le altitudini dei waypoint verranno ricalcolate.
7.  **Creare Orbita POI:**
    *   Assicurati di aver creato almeno un POI.
    *   Clicca "Create POI Orbit".
    *   Seleziona il POI centrale e imposta raggio e numero di punti nella finestra di dialogo.
8.  **Operazioni File:**
    *   Usa i pulsanti nella sezione "File Operations" per importare piani JSON o esportare in JSON, DJI WPML (.kmz), o Google Earth (.kml).
9.  **Esportazione KMZ per DJI Fly:**
    *   L'importazione di file KMZ/WPML direttamente nell'app DJI Fly per droni consumer come il Mini 4 Pro non è ufficialmente supportata. La procedura comune è:
        1.  Creare una missione waypoint *qualsiasi* direttamente nell'app DJI Fly sul tuo dispositivo mobile e salvarla.
        2.  Individuare il file KMZ di quella missione nella memoria del telefono (il percorso esatto può variare).
        3.  Sostituire quel file KMZ con quello generato dal nostro Flight Planner (assicurandosi che abbiano lo stesso nome).
        4.  Riaprire la missione nell'app DJI Fly. Questa procedura potrebbe non essere sempre affidabile o variare a seconda delle versioni dell'app. **Usare con cautela e a proprio rischio.**

## Esecuzione Locale (per Sviluppo)

Se vuoi eseguire il progetto localmente:

1.  **Clona il Repository:**
    ```bash
    git clone https://github.com/TUO_USERNAME/TUO_REPOSITORY.git
    cd TUO_REPOSITORY
    ```
2.  **Proxy CORS:**
    *   Questo planner fa affidamento su un proxy CORS per accedere all'API di elevazione OpenTopoData. Dovrai avere un'istanza del proxy in esecuzione. Puoi usare:
        *   Il proxy Node.js/Express fornito in un repository separato (se l'hai creato, es. su Replit o localmente).
        *   Una Netlify Function (se hai deployato il progetto con la funzione proxy inclusa).
        *   Un altro servizio proxy CORS.
    *   Assicurati che la variabile `proxyBaseUrl` nella funzione `getElevationsBatch()` dentro `script.js` punti all'URL corretto del tuo proxy in esecuzione.
3.  **Servi i File HTML/CSS/JS:**
    *   Usa un semplice server HTTP per servire la cartella del progetto. Se hai Python:
        ```bash
        # Python 3
        python -m http.server
        # Python 2
        # python -m SimpleHTTPServer
        ```
    *   Oppure usa `http-server` (richiede Node.js):
        ```bash
        npm install -g http-server
        http-server
        ```
    *   Apri `http://localhost:8000` (o la porta indicata) nel tuo browser.

## Contributi

I contributi sono benvenuti! Si prega di aprire una issue o una pull request.
