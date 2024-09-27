////////////////////////////////////////////////////////////
///                                                      ///
///  LIVEMAP SCRIPT FOR FM-DX-WEBSERVER (V2.1 BETA)      ///
///                                                      ///
///  by Highpoint                last update: 27.09.24   ///
///                                                      ///
///  https://github.com/Highpoint2000/LiveMap            ///
///                                                      ///
////////////////////////////////////////////////////////////

// Define ConsoleDebug variable
let ConsoleDebug = false;

// Custom console log function
function debugLog(...messages) {
    if (ConsoleDebug) {
        console.log(...messages);
    }
}

// Define iframe size and position variables
let iframeWidth = parseInt(localStorage.getItem('iframeWidth')) || 450; 
let iframeHeight = parseInt(localStorage.getItem('iframeHeight')) || 450; 
let iframeLeft = parseInt(localStorage.getItem('iframeLeft')) || 70; 
let iframeTop = parseInt(localStorage.getItem('iframeTop')) || 120;

(() => {
    const plugin_version = 'V2.1 BETA';
    let lastPicode = null;
    let lastFreq = null;
    let lastStationId = null;
    let websocket;
    let iframeContainer = null;
    let LiveMapActive = false;
    let picode, freq, itu, city, station, distance, ps, stationid, radius, coordinates, LAT, LON;
    let stationListContainer;
	let foundPI;
    let foundID;

    // Add custom CSS styles
    const style = document.createElement('style');
    style.innerHTML = `
    .fade-out {
        animation: fadeOut 0.5s forwards;
    }

    @keyframes fadeOut {
        from {
            opacity: 1;
        }
        to {
            opacity: 0;
        }
    }
    
    .fade-in {
        animation: fadeInAnimation 0.5s forwards;
    }

    @keyframes fadeInAnimation {
        0% {
            opacity: 0;
        }
        100% {
            opacity: 1;
        }
    }

    #movableDiv {
        display: flex;
        flex-direction: column;
        border-radius: 15px 15px 0 0;
        position: fixed;
        cursor: move;
        overflow: hidden;
        justify-content: space-between;
        width: ${iframeWidth}px;
        height: ${iframeHeight}px;
        left: ${iframeLeft}px;
        top: ${iframeTop}px;
        background-color: #f0f0f0;
    }

    #movableDiv iframe {
        border-radius: 5px;
        flex-grow: 1;
        width: 100%;
        border: none;
        position: relative;
    }

    .switch {
        position: relative;
        display: inline-block;
        width: 34px;
        height: 14px;
    }

    .switch input {
        opacity: 0;
        width: 0;
        height: 0;
    }

    .slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #ccc;
        transition: .4s;
        border-radius: 34px;
    }

    .slider:before {
        position: absolute;
        content: "";
        height: 14px;
        width: 14px;
        left: 0px;
        bottom: 0px;
        background-color: white;
        transition: .4s;
        border-radius: 50%;
    }

    input:checked + .slider {
        background-color: #2196F3;
    }

    input:checked + .slider:before {
        transform: translateX(20px);
    }

    .switch.disabled .slider {
        background-color: red;
    }

    .switch.enabled .slider {
        background-color: green;
    }
    `;
    document.head.appendChild(style);

    // Update toggle switch based on stationid
    function updateToggleSwitch(stationid) {
        const txposSwitch = document.getElementById('txposSwitch');
        const toggleSwitch = document.querySelector('.switch');
        txposSwitch.disabled = false;

        if (txposSwitch) {
            if (stationid) {
                toggleSwitch.classList.add('enabled');
                toggleSwitch.classList.remove('disabled');
            } else {
                toggleSwitch.classList.add('disabled');
                toggleSwitch.classList.remove('enabled');
            }
        }
    }

    // WebSocket setup function
    async function setupWebSocket() {
        if (!websocket || websocket.readyState === WebSocket.CLOSED) {
            try {
                websocket = await window.socketPromise;

                websocket.addEventListener("open", () => {
                    debugLog("WebSocket connected.");
                });

                websocket.addEventListener("message", handleWebSocketMessage);

                websocket.addEventListener("error", (error) => {
                    debugLog("WebSocket error:", error);
                });

                websocket.addEventListener("close", (event) => {
                    debugLog("WebSocket connection closed, retrying in 5 seconds.");
                    setTimeout(setupWebSocket, 5000);
                });

            } catch (error) {
                debugLog("Error during WebSocket setup:", error);
            }
        }
    }

    // Function to create the close button ("X")
    function createCloseButton() {
        const closeButton = document.createElement('div');
        closeButton.innerHTML = 'x';
        closeButton.style.position = 'absolute';
        closeButton.style.top = '0px';
        closeButton.style.right = '8px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.color = 'white';
        closeButton.classList.add('bg-color-2');
        closeButton.style.padding = '4px';
        closeButton.style.paddingLeft = '15px';
        closeButton.style.zIndex = '10'; 
        closeButton.style.fontSize = '20px';

        closeButton.onclick = () => {
            iframeLeft = parseInt(iframeContainer.style.left);
            iframeTop = parseInt(iframeContainer.style.top);
            iframeWidth = parseInt(iframeContainer.style.width);
            iframeHeight = parseInt(iframeContainer.style.height);

            localStorage.setItem('iframeLeft', iframeLeft);
            localStorage.setItem('iframeTop', iframeTop);
            localStorage.setItem('iframeWidth', iframeWidth);
            localStorage.setItem('iframeHeight', iframeHeight);

            iframeContainer.classList.add('fade-out');

            if (stationListContainer) {
                stationListContainer.classList.remove('fade-in');
                stationListContainer.classList.add('fade-out');
                stationListContainer.addEventListener('animationend', function handler() {
                    stationListContainer.style.opacity = '0';
                    stationListContainer.style.visibility = 'hidden';
                    stationListContainer.removeEventListener('animationend', handler);
                });
            }

            iframeContainer.addEventListener('animationend', () => {
                if (iframeContainer) {
                    iframeContainer.remove();
                    iframeContainer = null;
                }

                const LiveMapButton = document.getElementById('LIVEMAP-on-off');
                if (LiveMapButton) {
                    LiveMapButton.classList.remove('bg-color-4');
                    LiveMapButton.classList.add('bg-color-2');
                    LiveMapActive = false;
                }
            });
        };

        return closeButton;
    }

    // Create iframe element
    function createIframe() {
        const iframe = document.createElement('iframe');
        iframe.style.flexGrow = '1';
        return iframe;
    }

    // Create the iframe header
    function createIframeHeader() {
        const header = document.createElement('div');
        header.classList.add('bg-color-2');
        header.style.color = 'white';
        header.style.padding = '10px';
        header.style.position = 'relative';
        header.style.zIndex = '1';
        header.innerHTML = 'Header Title';
        return header;
    }

    // Create the iframe footer with radius options and a toggle switch for TXPOS
    function createIframeFooter() {
        const footer = document.createElement('div');
        footer.classList.add('bg-color-2');
        footer.style.color = 'white';
        footer.style.padding = '10px';
        footer.style.position = 'relative';
        footer.style.zIndex = '1'; 
        footer.style.display = 'flex'; 
        footer.style.flexWrap = 'wrap'; 
        footer.style.justifyContent = 'space-between';

        radius = localStorage.getItem('selectedRadius') || '';

        function updateradius(value) {
            radius = value;
            localStorage.setItem('selectedRadius', radius); 
            lastFreq = null;

            openOrUpdateIframe(picode, freq, stationid, station, city, distance, ps, itu, radius);
        }

        const radioButtonsHTML = `
            <label style="margin-right: 10px;">
                <input type="radio" name="radius" value="100"> 100 km
            </label>
            <label style="margin-right: 10px;">
                <input type="radio" name="radius" value="250"> 250 km
            </label>
            <label style="margin-right: 10px;">
                <input type="radio" name="radius" value="500"> 500 km
            </label>
            <label style="margin-right: 10px;">
                <input type="radio" name="radius" value="750"> 750 km
            </label>
            <label style="margin-right: 10px;">
                <input type="radio" name="radius" value="1000"> 1000 km
            </label>
            <label style="margin-right: 10px;">
                <input type="radio" name="radius" value="none"> none
            </label>
        `;

        footer.innerHTML = radioButtonsHTML;

        const radioButtons = footer.querySelectorAll('input[type="radio"]');
        radioButtons.forEach(radio => {
            radio.addEventListener('change', function() {
                updateradius(this.value); 
            });

            if (radio.value === radius) {
                radio.checked = true; 
            }
        });

        const toggleSwitchContainer = document.createElement('div');
        toggleSwitchContainer.style.display = 'flex';
        toggleSwitchContainer.style.alignItems = 'center';
        toggleSwitchContainer.style.marginRight = '10px';

        const toggleSwitchLabel = document.createElement('label');
        toggleSwitchLabel.innerHTML = 'TXPOS';
        toggleSwitchLabel.style.marginLeft = '10px'; 
        toggleSwitchLabel.style.whiteSpace = 'nowrap'; 

        const toggleSwitch = document.createElement('label');
        toggleSwitch.classList.add('switch'); 

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = 'txposSwitch';
        input.disabled = false;

        const slider = document.createElement('span');
        slider.classList.add('slider');

        toggleSwitch.appendChild(input);
        toggleSwitch.appendChild(slider);
        toggleSwitchContainer.appendChild(toggleSwitch);
        toggleSwitchContainer.appendChild(toggleSwitchLabel);
        footer.appendChild(toggleSwitchContainer);

        toggleSwitch.classList.add('disabled'); 

        input.addEventListener('change', async function() {
            if (this.checked) {
                if (!stationid) {
                    sendToast('warning', 'Live Map', 'TXPOS can only be activated when a station is recognized', false, false);    
                    this.checked = false;
                    return;
                }

                const { lat, lon } = coordinates || { lat: '0', lon: '0' };
                localStorage.setItem('txposLat', lat);
                localStorage.setItem('txposLon', lon);
                debugLog(`LIVEMAP TXPOS activated: LAT = ${lat}, LON = ${lon}`);
                sendToast('info', 'Live Map', `TXPOS activated: ${city}[${itu}]`, true, false);    
            } else {
                localStorage.removeItem('txposLat');
                localStorage.removeItem('txposLon');
                debugLog(`LIVEMAP TXPOS deactivated, using default values.`);
                openOrUpdateIframe('?', '0.0', '', '', '', '', '', '', radius);
            }
        });

        return footer;
    }

    const corsAnywhereUrl = 'https://cors-proxy.highpoint2000.synology.me:5001/';

    // IndexedDB setup function
    function openIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('picodeDatabase', 1);

            request.onupgradeneeded = function(event) {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('picodeStore')) {
                    db.createObjectStore('picodeStore', { keyPath: 'freq' });
                }
            };

            request.onsuccess = function(event) {
                resolve(event.target.result);
            };

            request.onerror = function(event) {
                reject('Error opening IndexedDB: ' + event.target.errorCode);
            };
        });
    }

    // Save data in IndexedDB
    async function savePicodeData(freq, data) {
        const db = await openIndexedDB();
        const transaction = db.transaction(['picodeStore'], 'readwrite');
        const store = transaction.objectStore('picodeStore');
        store.put({ freq, data });
    }

    // Retrieve data from IndexedDB
    async function getPicodeData(freq) {
        const db = await openIndexedDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['picodeStore'], 'readonly');
            const store = transaction.objectStore('picodeStore');
            const request = store.get(freq);

            request.onsuccess = function(event) {
                resolve(event.target.result ? event.target.result.data : null);
            };

            request.onerror = function(event) {
                reject('Error retrieving data: ' + event.target.errorCode);
            };
        });
    }

    // Check for matching picode and station ID
    async function checkPicodeAndID(freq, picode, id) {
        foundPI = false;
        foundID = false;
        coordinates = null;

        const cachedData = await getPicodeData(freq);

        if (cachedData && !picode.includes('?')) {
            debugLog('LIVEMAP using cached data from IndexedDB');

            if (typeof cachedData.locations === 'object') {
                for (const key in cachedData.locations) {
                    const location = cachedData.locations[key];
                    const stations = location.stations;

                    if (Array.isArray(stations)) {
                        foundPI = stations.some(station => station.pi === picode);
                        foundID = stations.some(station => station.id === id);

                        if (foundPI || foundID) {
                            debugLog(`LIVEMAP found match for picode: ${picode} or id: ${id} in cached data`);
                            coordinates = { lat: location.lat, lon: location.lon };
                            if (foundPI && foundID) break;
                        }
                    }
                }
            }
            return { foundPI, foundID, coordinates };
        }

        try {
            const response = await fetch(`${corsAnywhereUrl}https://maps.fmdx.org/api/?freq=${freq}`);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            await savePicodeData(freq, data);

            if (typeof data.locations === 'object') {
                for (const key in data.locations) {
                    const location = data.locations[key];
                    const stations = location.stations;

                    if (Array.isArray(stations)) {
                        foundPI = stations.some(station => station.pi === picode);
                        foundID = stations.some(station => station.id === id);

                        if (foundPI || foundID) {
                            debugLog(`LIVEMAP found match for picode: ${picode} or id: ${id} in fetched data`);
                            coordinates = { lat: location.lat, lon: location.lon };
                            if (foundPI && foundID) break;
                        }
                    }
                }
            }
            return { foundPI, foundID, coordinates };
        } catch (error) {
            console.error('Error checking picode and id:', error);
            return { foundPI: false, foundID: false, coordinates: null };
        }
    }

const dbName = 'stationCacheDB';
const storeName = 'stations';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: 'cacheKey' });
            }
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            reject(`Error opening IndexedDB: ${event.target.errorCode}`);
        };
    });
}

function saveToCache(cacheKey, data) {
    openDB().then((db) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.put({ cacheKey, data, timestamp: Date.now() });

        tx.oncomplete = () => debugLog('Data saved to cache:', cacheKey);
        tx.onerror = (event) => console.error('Error saving data to cache:', event);
    });
}

function getFromCache(cacheKey) {
    return new Promise((resolve, reject) => {
        openDB().then((db) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.get(cacheKey);

            request.onsuccess = () => {
                if (request.result) {
                    resolve(request.result.data);
                } else {
                    resolve(null);
                }
            };

            request.onerror = (event) => {
                reject(`Error retrieving data from cache: ${event.target.errorCode}`);
            };
        });
    });
}

async function fetchAndCacheStationData(freq, radius, picode, txposLat, txposLon, stationid) {
    const cacheKey = `${freq}_${radius}_${txposLat}_${txposLon}`;

    try {
        let data;

        // Zuerst versuchen, die Daten aus dem Cache zu holen
        const cachedData = await getFromCache(cacheKey);
        if (cachedData) {
            debugLog('Loaded data from cache:', cacheKey);
            data = cachedData;  // Daten aus dem Cache verwenden
        } else {
            // API-Daten abrufen, wenn keine Daten im Cache vorhanden sind
            let response;
            const txposSwitch = document.getElementById('txposSwitch');

            if (txposSwitch && txposSwitch.checked) {
                if (!stationid) {
                    response = await fetch(`${corsAnywhereUrl}https://maps.fmdx.org/api/?lat=${txposLat}&lon=${txposLon}&freq=${freq}&r=${radius}`);
                } else {
                    response = await fetch(`${corsAnywhereUrl}https://maps.fmdx.org/api/?lat=${LAT}&lon=${LON}&freq=${freq}`);
                    txposLat = LAT;
                    txposLon = LON;
                }
            } else {
                if (!stationid) {
                    response = await fetch(`${corsAnywhereUrl}https://maps.fmdx.org/api/?lat=${LAT}&lon=${LON}&freq=${freq}&r=${radius}`);
                } else {
                    response = await fetch(`${corsAnywhereUrl}https://maps.fmdx.org/api/?lat=${LAT}&lon=${LON}&freq=${freq}`);
                }
            }

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            data = await response.json();
            debugLog('Fetched data from API:', data);

            // Daten nach erfolgreichem Abruf im Cache speichern
            saveToCache(cacheKey, data);
        }

        // Hier wird keine zusätzliche Verarbeitung durchgeführt
        displayStationData(data, txposLat, txposLon);

    } catch (error) {
        console.error('Error fetching station data:', error);
    }
}

// Function to display station data in a table
function displayStationData(data, txposLat, txposLon) {

    if (!data || !data.locations || typeof data.locations !== 'object') {
        console.warn('No valid data received for station display.');
        return;
    }

    const iframeContainer = document.getElementById('movableDiv');

    if (!stationListContainer) {
        stationListContainer = document.createElement('div');
        stationListContainer.style.position = 'absolute';
        stationListContainer.style.left = `${iframeContainer.offsetLeft}px`;
        stationListContainer.style.top = `${iframeContainer.offsetTop + iframeContainer.offsetHeight}px`;
        stationListContainer.classList.add('bg-color-2');
        stationListContainer.style.padding = '15px';
        stationListContainer.style.borderRadius = '0px 0px 15px 15px';
        stationListContainer.style.zIndex = '1000';
        stationListContainer.style.maxHeight = '190px';
        stationListContainer.style.overflowY = 'scroll';
        stationListContainer.style.visibility = 'block';
        document.body.appendChild(stationListContainer);
        
        // Scrollbar styles for different browsers
        stationListContainer.style.msOverflowStyle = 'none';  
        stationListContainer.style.scrollbarWidth = 'none';  
        stationListContainer.style.WebkitOverflowScrolling = 'touch';  
        stationListContainer.style.overflowX = 'hidden';  
    } else {
        stationListContainer.style.left = `${iframeContainer.offsetLeft}px`;
        stationListContainer.style.top = `${iframeContainer.offsetTop + iframeContainer.offsetHeight}px`;
    }
    
    stationListContainer.innerHTML = '';

    const stationsWithDistance = [];

    for (const key in data.locations) {
        const location = data.locations[key];

        if (stationid) {
            if (location.name.toLowerCase() !== city.toLowerCase()) {
                continue;
            }
        }

        location.stations.forEach(station => {
            const lat = parseFloat(location.lat);
            const lon = parseFloat(location.lon);
            const itu = location.itu || 'N/A';

            if (!isNaN(lat) && !isNaN(lon)) {
                const distance = calculateDistance(txposLat, txposLon, lat, lon);
                stationsWithDistance.push({
                    station,
                    city: location.name,
                    distance: distance,
                    pi: station.pi,
                    erp: station.erp,
                    id: station.id,
                    itu: itu
                });
            }
        });
    }

    stationsWithDistance.sort((a, b) => a.distance - b.distance);

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '13px';
    table.classList.add('bg-color-2');
    table.style.borderRadius = '15px';

    let lastCity = '';

    stationsWithDistance.forEach(({ station, city, distance, pi, erp, id, itu }) => {
        const row = document.createElement('tr');
        row.style.margin = '0';
        row.style.padding = '0';

        if (city !== lastCity && lastCity !== '') {
            const spacerRow = document.createElement('tr');
            spacerRow.style.height = '15px';
            table.appendChild(spacerRow);
        }

        // Add class if either station ID or frequency matches
        if (station.id === stationid) {
            row.classList.add('bg-color-1');
        } else if (picode === pi && parseFloat(freq) === parseFloat(station.freq)) {
			row.classList.add('bg-color-1');
		} else if ((picode === '?' || !foundPI) && (parseFloat(freq) === parseFloat(station.freq))) {
				row.classList.add('bg-color-1');
		}

        const freqCell = document.createElement('td');
        freqCell.innerText = `${parseFloat(station.freq).toFixed(1)} MHz`;
        freqCell.style.padding = '0';
        freqCell.style.paddingLeft = '0px';
        freqCell.style.color = 'white';
        freqCell.style.textAlign = 'right';
        freqCell.style.width = '55px';
        freqCell.style.maxWidth = '55px';
        freqCell.style.overflow = 'hidden';
        freqCell.style.whiteSpace = 'nowrap';
        freqCell.style.textOverflow = 'ellipsis';
        freqCell.style.textDecoration = 'underline';
        freqCell.style.cursor = 'pointer';
        row.appendChild(freqCell);

        freqCell.onclick = () => {
            const dataToSend = `T${(parseFloat(station.freq) * 1000).toFixed(0)}`;
            socket.send(dataToSend);
            debugLog("WebSocket sending:", dataToSend);
        };

        const piCell = document.createElement('td');
        piCell.innerText = pi;
        piCell.style.padding = '0';
        piCell.style.paddingLeft = '15px';
        piCell.style.color = 'white';
        piCell.style.width = '50px';
        piCell.style.maxWidth = '50px';
        piCell.style.overflow = 'hidden';
        piCell.style.whiteSpace = 'nowrap';
        piCell.style.textOverflow = 'ellipsis';
        row.appendChild(piCell);

        const stationCell = document.createElement('td');
        stationCell.innerText = station.station;
        stationCell.style.padding = '0';
        stationCell.style.paddingLeft = '10px';
        stationCell.style.color = 'white';
        stationCell.style.width = '120px';
        stationCell.style.maxWidth = '120px';
        stationCell.style.overflow = 'hidden';
        stationCell.style.whiteSpace = 'nowrap';
        stationCell.style.textOverflow = 'ellipsis';
        row.appendChild(stationCell);

        const cityCell = document.createElement('td');
        cityCell.innerText = `${city} [${itu}]`;
        cityCell.style.padding = '0';
        cityCell.style.paddingLeft = '15px';
        cityCell.style.color = 'white';
        cityCell.style.width = '120px';
        cityCell.style.maxWidth = '120px';
        cityCell.style.overflow = 'hidden';
        cityCell.style.whiteSpace = 'nowrap';
        cityCell.style.textOverflow = 'ellipsis';
        row.appendChild(cityCell);

        const distanceCell = document.createElement('td');
        distanceCell.innerText = `${Math.round(distance)} km`;
        distanceCell.style.padding = '0';
        distanceCell.style.paddingLeft = '10px';
        distanceCell.style.color = 'white';
        distanceCell.style.textAlign = 'right';
        distanceCell.style.width = '55px';
        distanceCell.style.maxWidth = '55px';
        distanceCell.style.overflow = 'hidden';
        distanceCell.style.whiteSpace = 'nowrap';
        distanceCell.style.textOverflow = 'ellipsis';
        row.appendChild(distanceCell);

        const erpCell = document.createElement('td');
        erpCell.innerText = `${erp.toFixed(1)} kW`;
        erpCell.style.padding = '0';
        erpCell.style.paddingLeft = '10px';
		erpCell.style.paddingRight = '5px';
        erpCell.style.color = 'white';
        erpCell.style.textAlign = 'right';
        erpCell.style.width = '60px';
        erpCell.style.maxWidth = '60px';
        erpCell.style.overflow = 'hidden';
        erpCell.style.whiteSpace = 'nowrap';
        erpCell.style.textOverflow = 'ellipsis';
        row.appendChild(erpCell);

        const streamCell = document.createElement('td');
        const streamLink = document.createElement('a');
        streamLink.innerText = 'Stream';
        streamLink.href = `javascript:window.open('https://fmscan.org/stream.php?i=${id}', 'newWindow', 'width=800,height=160');`;
        streamLink.style.color = 'white';
        streamLink.style.cursor = 'pointer';
        streamCell.appendChild(streamLink);
        streamCell.style.textAlign = 'right';
        streamCell.style.padding = '0';
        streamCell.style.paddingLeft = '10px';
        streamCell.style.paddingRight = '10px';
        streamCell.style.width = '50px';
        streamCell.style.maxWidth = '50px';
        streamCell.style.overflow = 'hidden';
        streamCell.style.whiteSpace = 'nowrap';
        streamCell.style.textOverflow = 'ellipsis';
        streamCell.style.textDecoration = 'underline';
        row.appendChild(streamCell);

        table.appendChild(row);
        lastCity = city;
    });

    stationListContainer.appendChild(table);
    stationListContainer.style.width = `${iframeContainer.offsetWidth}px`;
}


    // Function to calculate the distance between two points using the Haversine formula
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; 
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    async function openOrUpdateIframe(picode, freq, stationid, station, city, distance, ps, itu, radius) {
        if (!LiveMapActive) return;

        let foundPI = false;
        let foundID = false;
        let coordinates = null;

        if ((picode !== '?' && picode !== lastPicode) || (stationid && stationid !== lastStationId)) {
            let result = await checkPicodeAndID(freq, picode, stationid);
            foundPI = result.foundPI;
            foundID = result.foundID;
            coordinates = result.coordinates;
        }

        LAT = localStorage.getItem('qthLatitude') || '0';
        LON = localStorage.getItem('qthLongitude') || '0';

        const txposSwitch = document.getElementById('txposSwitch');

        let txposLat, txposLon;
			
        if (txposSwitch && txposSwitch.checked) {
            txposLat = localStorage.getItem('txposLat') || '0';
            txposLon = localStorage.getItem('txposLon') || '0';
        } else {
            txposLat = LAT;
            txposLon = LON;
        }

        let url;
        if (stationid) {
            url = `https://maps.fmdx.org/#qth=${LAT},${LON}&id=${stationid}&findId=*`;
        } else if (picode !== '?' && foundPI) {
            url = `https://maps.fmdx.org/#qth=${LAT},${LON}&freq=${freq}&findPi=${picode}`; 
        } else if (radius === 'none') {
            url = `https://maps.fmdx.org/#lat=${txposLat}&lon=${txposLon}&freq=${freq}`;
        } else {
            url = `https://maps.fmdx.org/#lat=${txposLat}&lon=${txposLon}&freq=${freq}&r=${radius}`;
        }

        const uniqueUrl = `${url}&t=${new Date().getTime()}`;

        function createAndInsertIframe() {
            const newIframe = createIframe();
            const header = createIframeHeader();
            const footer = createIframeFooter();
            const closeButton = createCloseButton();
            newIframe.src = uniqueUrl;

            newIframe.style.opacity = '0';
            newIframe.style.transition = 'opacity 0.5s';

            if (!iframeContainer) {
                iframeContainer = document.createElement('div');
                iframeContainer.id = 'movableDiv';
                iframeContainer.style.width = `${iframeWidth}px`;
                iframeContainer.style.height = `${iframeHeight}px`;
                iframeContainer.style.left = `${iframeLeft}px`;
                iframeContainer.style.top = `${iframeTop}px`;
                iframeContainer.style.position = 'fixed';
                iframeContainer.style.opacity = '0';
                iframeContainer.style.transition = 'opacity 0.5s';
                iframeContainer.style.zIndex = '1000';
                iframeContainer.appendChild(header);
                iframeContainer.appendChild(footer);
                iframeContainer.appendChild(closeButton);
                iframeContainer.appendChild(newIframe);
                document.body.appendChild(iframeContainer);
                addDragFunctionality(iframeContainer);
                addResizeFunctionality(iframeContainer);

                setTimeout(() => {
                    iframeContainer.style.opacity = '1';
                    newIframe.style.opacity = '1';
                }, 200);
            } else {
                iframeContainer.appendChild(newIframe);

                const existingHeader = iframeContainer.querySelector('div');
                if (existingHeader) {
                    if (!stationid) {
                        existingHeader.innerHTML = `${freq} MHz | ${picode}`;
                    } else {
                        existingHeader.innerHTML = `${freq} MHz | ${picode} | ${station} from ${city} [${itu}] [${distance} km]`;
                    }
                }

                const existingIframes = iframeContainer.querySelectorAll('iframe:not(:last-child)');
                existingIframes.forEach(iframe => {
                    iframe.parentNode.removeChild(iframe);
                });

                setTimeout(() => {
                    newIframe.style.opacity = '1';
                }, 200);
            }
        }

        if (freq === '0.0' || (picode !== '?' && picode !== lastPicode) || (freq !== lastFreq) || (stationid && stationid !== lastStationId)) {
            createAndInsertIframe();

            lastPicode = picode;
            lastStationId = stationid;
            lastFreq = freq;

            await fetchAndCacheStationData(freq, radius, picode, txposLat, txposLon, stationid);

            updateToggleSwitch(stationid);
        }
    }

    let previousFreq = null;
    let timeoutId = null;
    let isFirstUpdateAfterChange = false;

    async function handleWebSocketMessage(event) {
        try {
            const data = JSON.parse(event.data);
            picode = data.pi;
            freq = data.freq;
            itu = data.txInfo.itu;
            city = data.txInfo.city;
            station = data.txInfo.tx;
            distance = data.txInfo.dist;
            ps = data.ps;
            stationid = data.txInfo.id;

            if (freq !== previousFreq) {
                previousFreq = freq;
                isFirstUpdateAfterChange = true;

                if (timeoutId) {
                    clearTimeout(timeoutId);
                }

                timeoutId = setTimeout(() => {
                    openOrUpdateIframe(picode, freq, stationid, station, city, distance, ps, itu, radius);
                    isFirstUpdateAfterChange = false;
                }, 1000);
            } else if (!isFirstUpdateAfterChange) {
                openOrUpdateIframe(picode, freq, stationid, station, city, distance, ps, itu, radius);
            }
        } catch (error) {
            console.error("Error processing the message:", error);
        }
    }

    // Function to add drag functionality to the iframe
    function addDragFunctionality(element) {
        let offsetX = 0, offsetY = 0, startX = 0, startY = 0;

        element.onmousedown = function(e) {
            if (e.target.id !== 'resizer') {
                e.preventDefault();
                startX = e.clientX;
                startY = e.clientY;
                document.onmousemove = onMouseMove;
                document.onmouseup = onMouseUp;
            }
        };

        function onMouseMove(e) {
            offsetX = startX - e.clientX;
            offsetY = startY - e.clientY;
            startX = e.clientX;
            startY = e.clientY;

            element.style.left = (element.offsetLeft - offsetX) + "px";
            element.style.top = (element.offsetTop - offsetY) + "px";

            if (stationListContainer) {
                stationListContainer.style.left = `${element.offsetLeft}px`;
                stationListContainer.style.top = `${element.offsetTop + element.offsetHeight}px`;
            }
        }

        function onMouseUp() {
            localStorage.setItem('iframeLeft', element.style.left);
            localStorage.setItem('iframeTop', element.style.top);
            document.onmousemove = null;
            document.onmouseup = null;
        }
    }

    // Function to add resize functionality to the iframe
    function addResizeFunctionality(element) {
        const resizer = document.createElement('div');
        resizer.id = 'resizer';
        resizer.style.width = '10px';
        resizer.style.height = '10px';
        resizer.style.background = 'blue';
        resizer.style.cursor = 'nwse-resize';
        resizer.style.position = 'absolute';
        resizer.style.right = '0';
        resizer.style.bottom = '0';
        resizer.style.zIndex = '1000';
        element.appendChild(resizer);

        resizer.addEventListener('mousedown', initResize);

        function initResize(e) {
            e.preventDefault();
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResize);
        }

        function resize(e) {
            const newWidth = e.clientX - element.getBoundingClientRect().left;
            const newHeight = e.clientY - element.getBoundingClientRect().top;
            if (newWidth > 100 && newHeight > 100) {
                element.style.width = newWidth + 'px';
                element.style.height = newHeight + 'px';
                const iframe = element.querySelector('iframe');
                if (iframe) {
                    iframe.width = (newWidth - 20) + 'px';
                    iframe.height = (newHeight - 85) + 'px';
                }

                if (stationListContainer) {
                    stationListContainer.style.width = `${newWidth}px`;
                    stationListContainer.style.top = `${element.offsetTop + element.offsetHeight}px`;
                }
            }
        }

        function stopResize() {
            const newWidth = parseInt(element.style.width);
            const newHeight = parseInt(element.style.height);
            localStorage.setItem('iframeWidth', newWidth);
            localStorage.setItem('iframeHeight', newHeight);
            iframeWidth = newWidth - 20;
            iframeHeight = newHeight - 85;
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResize);
        }
    }

    function initializeLiveMapButton() {
        const buttonWrapper = document.getElementById('button-wrapper');
        const LiveMapButton = document.createElement('button');

        LiveMapButton.id = 'LIVEMAP-on-off';
        LiveMapButton.classList.add('hide-phone');
        LiveMapButton.setAttribute('aria-label', 'LIVEMAP');
        LiveMapButton.setAttribute('data-tooltip', 'LIVEMAP on/off');
        LiveMapButton.innerHTML = '<strong>LIVEMAP</strong>';
        LiveMapButton.style.marginTop = '16px';
        LiveMapButton.style.width = '100px';
        LiveMapButton.classList.add('bg-color-2');
        LiveMapButton.style.borderRadius = '0px';
        LiveMapButton.title = `Plugin Version: ${plugin_version}`;

        LiveMapButton.onclick = () => {
            LiveMapActive = !LiveMapActive;
            if (LiveMapActive) {
                LiveMapButton.classList.remove('bg-color-2');
                LiveMapButton.classList.add('bg-color-4');
                debugLog("LIVEMAP activated.");

                lastPicode = '?';
                lastFreq = '0.0';
                lastStationId = null;

                openOrUpdateIframe(lastPicode, lastFreq, lastStationId);

                setTimeout(() => {
                    if (stationListContainer) {
                        stationListContainer.style.opacity = '1';
                        stationListContainer.style.visibility = 'visible';
                        stationListContainer.classList.remove('fade-out');
                        stationListContainer.classList.add('fade-in');
                    }
                }, 300);
            } else {
                LiveMapButton.classList.remove('bg-color-4');
                LiveMapButton.classList.add('bg-color-2');
                debugLog("LIVEMAP deactivated.");

                if (iframeContainer) {
                    iframeLeft = parseInt(iframeContainer.style.left);
                    iframeTop = parseInt(iframeContainer.style.top);
                    iframeWidth = parseInt(iframeContainer.style.width);
                    iframeHeight = parseInt(iframeContainer.style.height);

                    localStorage.setItem('iframeLeft', iframeLeft);
                    localStorage.setItem('iframeTop', iframeTop);
                    localStorage.setItem('iframeWidth', iframeWidth);
                    localStorage.setItem('iframeHeight', iframeHeight);

                    const iframes = document.querySelectorAll('iframe');
                    iframes.forEach(iframe => {
                        iframe.style.opacity = '0';
                        iframe.style.transition = 'opacity 0.5s';
                    });

                    stationListContainer.classList.remove('fade-in');
                    stationListContainer.classList.add('fade-out');
                    stationListContainer.addEventListener('animationend', function handler() {
                        stationListContainer.style.opacity = '0';
                        stationListContainer.style.visibility = 'hidden';
                        stationListContainer.removeEventListener('animationend', handler);
                    });

                    iframeContainer.classList.add('fade-out');
                    iframeContainer.addEventListener('animationend', function handler() {
                        document.body.removeChild(iframeContainer);
                        iframeContainer = null;
                        iframeContainer.removeEventListener('animationend', handler);
                    });
                }
            }
        };

        if (buttonWrapper) {
            LiveMapButton.style.marginLeft = '5px';
            buttonWrapper.appendChild(LiveMapButton);
            debugLog('LIVEMAP button successfully added to button-wrapper.');
        } else {
            console.error('buttonWrapper element not found. Adding LIVEMAP button to default location.');
            const wrapperElement = document.querySelector('.tuner-info');

            if (wrapperElement) {
                const buttonWrapper = document.createElement('div');
                buttonWrapper.classList.add('button-wrapper');
                buttonWrapper.id = 'button-wrapper';
                buttonWrapper.appendChild(LiveMapButton);
                wrapperElement.appendChild(buttonWrapper);
                const emptyLine = document.createElement('br');
                wrapperElement.appendChild(emptyLine);
            } else {
                console.error('Default location not found. Unable to add LIVEMAP button.');
            }
        }

        LiveMapActive = false;
        LiveMapButton.classList.remove('bg-color-4');
        LiveMapButton.classList.add('bg-color-2');
        debugLog("LIVEMAP deactivated (default status).");
    }

    setupWebSocket();

    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(initializeLiveMapButton, 1000);
    });
})();
