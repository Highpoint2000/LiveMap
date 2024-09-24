////////////////////////////////////////////////////////////
///                                                      /// 
///  LIVEMAP SCRIPT FOR FM-DX-WEBSERVER (V2.0 BETA)      /// 
///                                                      /// 
///  by Highpoint                last update: 24.09.24   /// 
///                                                      /// 
///  https://github.com/Highpoint2000/LiveMap            /// 
///                                                      /// 
////////////////////////////////////////////////////////////

// Define ConsoleDebug variable
let ConsoleDebug = false;

////////////////////////////////////////////////////////////

// Custom console log function
function debugLog(...messages) {
    if (ConsoleDebug) {
        console.log(...messages);
    }
}

// Define iframe size and position variables
let iframeWidth = parseInt(localStorage.getItem('iframeWidth')) || 450; // Restore from localStorage or use default
let iframeHeight = parseInt(localStorage.getItem('iframeHeight')) || 450; // Restore from localStorage or use default
let iframeLeft = parseInt(localStorage.getItem('iframeLeft')) || 70; // Restore from localStorage or use default
let iframeTop = parseInt(localStorage.getItem('iframeTop')) || 120; // Restore from localStorage or use default

(() => {
    const plugin_version = 'V2.0 BETA';
    let lastPicode = null;
    let lastFreq = null;
    let lastStationId = null;
    let websocket;
    let iframeContainer = null;
    let LiveMapActive = false;
    let picode;
    let freq;
    let itu;
    let city;
    let station;
    let distance;
    let ps;
    let stationid;
    let radius;
    let coordinates;
    let LAT;
    let LON;

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

    #movableDiv {
        display: flex;
        flex-direction: column;
        border-radius: 15px; /* Rounded corners */
        position: fixed;
        cursor: move;
        overflow: hidden; /* Prevent content from exceeding rounded corners */
        justify-content: space-between; /* Distribute space between header, iframe, and footer */
        width: ${iframeWidth}px; /* Set initial width */
        height: ${iframeHeight}px; /* Set initial height */
        left: ${iframeLeft}px;
        top: ${iframeTop}px;
        background-color: #f0f0f0; /* Example background color */
    }

    #movableDiv iframe {
        border-radius: 5px; /* Rounded corners for the iframe */
        flex-grow: 1; /* Allow iframe to fill available space */
        width: 100%; /* Ensure the iframe takes full width */
        border: none; /* Remove border for a clean look */
        position: relative; /* Keep iframe inside the container */
    }

    /* Toggle switch CSS */
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

    /* Locked switch state (red) */
    .switch.disabled .slider {
        background-color: red; /* Red for locked */
    }

    /* Enabled switch state (green) */
    .switch.enabled .slider {
        background-color: green; /* Green for active */
    }
    `;
    document.head.appendChild(style);

    // Update toggle switch based on stationid
    function updateToggleSwitch(stationid) {
        const txposSwitch = document.getElementById('txposSwitch');
        const toggleSwitch = document.querySelector('.switch'); // Reference to the switch
        txposSwitch.disabled = false; // Disable if stationid is empty

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
        // Save the position and size of the iframe
        iframeLeft = parseInt(iframeContainer.style.left);
        iframeTop = parseInt(iframeContainer.style.top);
        iframeWidth = parseInt(iframeContainer.style.width);  // Save the width
        iframeHeight = parseInt(iframeContainer.style.height); // Save the height

        localStorage.setItem('iframeLeft', iframeLeft);
        localStorage.setItem('iframeTop', iframeTop);
        localStorage.setItem('iframeWidth', iframeWidth);  // Save the width
        localStorage.setItem('iframeHeight', iframeHeight); // Save the height

        // Fade-out effect before removing the iframe
        iframeContainer.classList.add('fade-out'); // Add fade-out class
        iframeContainer.addEventListener('animationend', () => {
            // After the fade-out animation is complete, remove iframe and container
            if (iframeContainer) {
                iframeContainer.remove();
                iframeContainer = null;
            }

            // Deactivate the LiveMap button
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
        iframe.style.flexGrow = '1';  // Allow iframe to fill remaining space
        return iframe;
    }

    // Create the iframe header
    function createIframeHeader() {
        const header = document.createElement('div');
        header.classList.add('bg-color-2'); // Add background color
        header.style.color = 'white';
        header.style.padding = '10px';
        header.style.position = 'relative';
        header.style.zIndex = '1'; // Ensure it appears above other elements
        header.innerHTML = 'Header Title'; // Example text, customize as needed
        return header;
    }

    // Create the iframe footer with radius options and a toggle switch for TXPOS
    function createIframeFooter() {
        const footer = document.createElement('div');
        footer.classList.add('bg-color-2'); // Add background color
        footer.style.color = 'white';
        footer.style.padding = '10px';
        footer.style.position = 'relative';
        footer.style.zIndex = '1'; 
        footer.style.display = 'flex'; 
        footer.style.flexWrap = 'wrap'; // Allows wrapping
        footer.style.justifyContent = 'space-between';

        radius = localStorage.getItem('selectedRadius') || '';

        function updateradius(value) {
            radius = value;
            localStorage.setItem('selectedRadius', radius); 
            lastFreq = null;

            openOrUpdateIframe(picode, freq, stationid, station, city, distance, ps, itu, radius);
        }

        // Radio buttons for selecting radius
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

        // Toggle switch (TXPOS) on the right side of the footer
        const toggleSwitchContainer = document.createElement('div');
        toggleSwitchContainer.style.display = 'flex';
        toggleSwitchContainer.style.alignItems = 'center'; // Center the slider
        toggleSwitchContainer.style.marginRight = '10px';

        const toggleSwitchLabel = document.createElement('label');
        toggleSwitchLabel.innerHTML = 'TXPOS';
        toggleSwitchLabel.style.marginLeft = '10px'; // Space to the slider
        toggleSwitchLabel.style.whiteSpace = 'nowrap'; // Prevent line break in the label

        const toggleSwitch = document.createElement('label');
        toggleSwitch.classList.add('switch'); // Class for the slider

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = 'txposSwitch';
        input.disabled = false; // Always enabled

        const slider = document.createElement('span');
        slider.classList.add('slider');

        toggleSwitch.appendChild(input);
        toggleSwitch.appendChild(slider);
        toggleSwitchContainer.appendChild(toggleSwitch); // Slider first
        toggleSwitchContainer.appendChild(toggleSwitchLabel); // Label to the right of the slider
        footer.appendChild(toggleSwitchContainer);

        toggleSwitch.classList.add('disabled'); // Initially disabled

        // Event listener for the switch
        input.addEventListener('change', async function() {
            if (this.checked) {
                if (!stationid) {
                    // Notify the user that the switch can't be activated
                    sendToast('warning', 'Live Map', 'TXPOS can only be activated when a station is recognized', false, false);    
                    this.checked = false; // Reset the switch
                    return;
                }

                // TXPOS is active - save the coordinates
                const { lat, lon } = coordinates || { lat: '0', lon: '0' };
                localStorage.setItem('txposLat', lat);
                localStorage.setItem('txposLon', lon);
                debugLog(`LIVEMAP TXPOS activated: LAT = ${lat}, LON = ${lon}`);
                sendToast('info', 'Live Map', `TXPOS activated: ${city}[${itu}]`, true, false);    
            } else {
                // TXPOS deactivated - reset to default values
                localStorage.removeItem('txposLat');
                localStorage.removeItem('txposLon');
                debugLog(`LIVEMAP TXPOS deactivated, using default values.`);

                // Update the iframe
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
        let foundPI = false;
        let foundID = false;
        coordinates = null; // Initialize or reset

        // Retrieve cached data from IndexedDB
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
                            coordinates = { lat: location.lat, lon: location.lon }; // Set coordinates
                            if (foundPI && foundID) break; // Stop if both found
                        }
                    }
                }
            }
            return { foundPI, foundID, coordinates };
        }

        // Fetch data from API if not in cache
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
                            coordinates = { lat: location.lat, lon: location.lon }; // Set coordinates
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

    // Open or update the iframe based on picode, freq, and station ID
    async function openOrUpdateIframe(picode, freq, stationid, station, city, distance, ps, itu, radius) {
        if (!LiveMapActive) return;

        let foundPI = false; // Initialize foundPI
        let foundID = false; // Initialize foundID
        let coordinates = null; // Initialize coordinates

        if ((picode !== '?' && picode !== lastPicode) || (stationid && stationid !== lastStationId)) {
            let result = await checkPicodeAndID(freq, picode, stationid);
            foundPI = result.foundPI; // Assign the result of the check
            foundID = result.foundID; // Assign the result of the check
            coordinates = result.coordinates; // Assign the result of the check
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
                        existingHeader.innerHTML = `${freq} MHz | ${picode} | ${station} from ${city} [${itu}] [${radius} km]`;
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

            // Update the toggle switch
            updateToggleSwitch(stationid);
        }
    }

    let previousFreq = null; 
    let timeoutId = null;    
    let isFirstUpdateAfterChange = false; 

    // Handle incoming WebSocket messages
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

    // Fetch station ID based on frequency, picode, and city
    async function fetchstationid(freq, picode, city) {
        try {
            const response = await fetch("https://tef.noobish.eu/logos/scripts/StationID_PL.txt");

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const cleanedFreq = freq.replace('.', '');
            const cleanedCity = city.replace(/[^a-z]/gi, '').toLowerCase();
            const cityPrefix = cleanedCity.substring(0, 3);
            const cityPattern = cityPrefix.split('').map(char => `.*${char}`).join('');
            const targetString = `${cleanedFreq};${picode};${cityPattern}.*`;
            const regex = new RegExp(targetString, 'i');
            const targetLine = cachedData.split('\n').find(line => regex.test(line));

            if (targetLine) {
                const parts = targetLine.split(';');
                let stationid = parts[parts.length - 1].trim();
                stationid = stationid.replace(/[^0-9]/g, '');
                return stationid;
            } else {
                return null;
            }
        } catch (error) {
            console.error('Error fetching the station ID:', error);
            return null;
        }
    }

    // Add drag functionality to the iframe container
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
        }

        function onMouseUp() {
            localStorage.setItem('iframeLeft', element.style.left);
            localStorage.setItem('iframeTop', element.style.top);
            document.onmousemove = null;
            document.onmouseup = null;
        }
    }

    // Add resize functionality to the iframe container
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

// Initialize the LiveMap button
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

            if (!iframeContainer) {
                openOrUpdateIframe(lastPicode, lastFreq, lastStationId); 
            } else {
                iframeContainer.style.display = 'block'; 
                iframeContainer.style.left = `${iframeLeft}px`; 
                iframeContainer.style.top = `${iframeTop}px`; 
                iframeContainer.style.width = `${iframeWidth}px`;  // Wiederherstellen der Breite
                iframeContainer.style.height = `${iframeHeight}px`;  // Wiederherstellen der Höhe
            }
        } else {
            LiveMapButton.classList.remove('bg-color-4');
            LiveMapButton.classList.add('bg-color-2');
            debugLog("LIVEMAP deactivated.");

            if (iframeContainer) {
                iframeLeft = parseInt(iframeContainer.style.left);
                iframeTop = parseInt(iframeContainer.style.top);
                iframeWidth = parseInt(iframeContainer.style.width); // Breite speichern
                iframeHeight = parseInt(iframeContainer.style.height); // Höhe speichern

                localStorage.setItem('iframeLeft', iframeLeft);
                localStorage.setItem('iframeTop', iframeTop);
                localStorage.setItem('iframeWidth', iframeWidth); // Speichern der Breite
                localStorage.setItem('iframeHeight', iframeHeight); // Speichern der Höhe

                const iframes = document.querySelectorAll('iframe');
                iframes.forEach(iframe => {
                    iframe.style.opacity = '0'; 
                    iframe.style.transition = 'opacity 0.5s'; 
                });

                iframeContainer.classList.add('fade-out');

                iframeContainer.addEventListener('animationend', () => {
                    document.body.removeChild(iframeContainer);
                    iframeContainer = null; 
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


    // Setup the WebSocket connection
    setupWebSocket();

    // Initialize LiveMap button once DOM is loaded
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(initializeLiveMapButton, 1000);
    });
})();
