////////////////////////////////////////////////////////////
///                                                      /// 
///  LIVEMAP SCRIPT FOR FM-DX-WEBSERVER (V2.0 BETA)      /// 
///                                                      /// 
///  by Highpoint                last update: 19.09.24   /// 
///                                                      /// 
///  https://github.com/Highpoint2000/LiveMap            /// 
///                                                      /// 
////////////////////////////////////////////////////////////

// Define iframe size and position as variables
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
    let foundPI;	

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
        border-radius: 15px; /* Rounded corners */
        position: fixed;
        cursor: move;
        overflow: hidden; /* Prevents content from exceeding rounded corners */
        display: flex; /* Activate flexbox */
        justify-content: center; /* Horizontal centering */
        align-items: center; /* Vertical centering */
    }

    #movableDiv iframe {
        border-radius: 5px; /* Rounded corners for the iframe */
    }
    `;
    document.head.appendChild(style);

    async function setupWebSocket() {
        if (!websocket || websocket.readyState === WebSocket.CLOSED) {
            try {
                websocket = await window.socketPromise;

                websocket.addEventListener("open", () => {
                    console.log("WebSocket connected.");
                });

                websocket.addEventListener("message", handleWebSocketMessage);

                websocket.addEventListener("error", (error) => {
                    console.error("WebSocket error:", error);
                });

                websocket.addEventListener("close", (event) => {
                    console.log("WebSocket connection closed, retrying in 5 seconds.");
                    setTimeout(setupWebSocket, 5000);
                });

            } catch (error) {
                console.error("Error during WebSocket setup:", error);
            }
        }
    }

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
            // Save the position before removing
            iframeLeft = parseInt(iframeContainer.style.left);
            iframeTop = parseInt(iframeContainer.style.top);
            localStorage.setItem('iframeLeft', iframeLeft);
            localStorage.setItem('iframeTop', iframeTop);
            
            // Fade-out effect before removing the iframe
            iframeContainer.classList.add('fade-out'); // Add fade-out class
            iframeContainer.addEventListener('animationend', () => {
                // After the fade-out animation is done, remove iframe and container
                if (iframeContainer) {
                    iframeContainer.remove();
                    iframeContainer = null;
                }

                // Deactivate LiveMap button
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

    function createIframe() {
        const iframe = document.createElement('iframe');
        iframe.width = (iframeWidth - 20) + 'px';  // Adjust for border size
        iframe.height = (iframeHeight - 85) + 'px';  // Adjust for header and footer size
        iframe.style.border = 'none'; // Remove border for a clean look
        iframe.style.position = 'relative'; // Keep iframe inside the container
        iframe.style.top = '0px'; 
        return iframe;
    }

    function createIframeHeader() {
        const header = document.createElement('div');
        header.style.backgroundColor = 'bg-color-2';
        header.style.color = 'white';
        header.style.padding = '10px';
        header.style.position = 'absolute';
        header.style.top = '0';
        header.style.left = '0';
        header.style.width = '100%';
        header.style.zIndex = '1'; // Make sure it appears above other elements
        return header;
    }
	
    function createIframeFooter() {
        const footer = document.createElement('div');
        footer.style.backgroundColor = 'bg-color-2'; 
        footer.style.color = 'white';
        footer.style.padding = '10px';
        footer.style.position = 'absolute';
        footer.style.bottom = '0';
        footer.style.left = '0';
        footer.style.width = '100%';
        footer.style.zIndex = '1'; 
        footer.style.display = 'flex'; 
        footer.style.justifyContent = 'center'; 

        radius = localStorage.getItem('selectedRadius') || '';

        function updateradius(value) {
            radius = value;
            localStorage.setItem('selectedRadius', radius); 
            lastFreq = null;

            openOrUpdateIframe(picode, freq, stationid, station, city, distance, ps, itu, radius);
        }

        const radioButtonsHTML = `
            <label style="margin-right: 10px;">
                <input type="radio" name="radius" value="150">
                150 km
            </label>
            <label style="margin-right: 10px;">
                <input type="radio" name="radius" value="300">
                300 km
            </label>
            <label style="margin-right: 10px;">
                <input type="radio" name="radius" value="700">
                700 km
            </label>
            <label style="margin-right: 10px;">
                <input type="radio" name="radius" value="1000">
                1000 km
            </label>
            <label style="margin-right: 10px;">
                <input type="radio" name="radius" value="none">
                none
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
	
        return footer;
    }

const corsAnywhereUrl = 'https://cors-proxy.highpoint2000.synology.me:5001/';

// IndexedDB Setup
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

// Speichern in IndexedDB
async function savePicodeData(freq, data) {
    const db = await openIndexedDB();
    const transaction = db.transaction(['picodeStore'], 'readwrite');
    const store = transaction.objectStore('picodeStore');
    store.put({ freq, data });
}

// Daten aus IndexedDB abrufen
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

async function checkPicode(freq, picode) {
    let foundPI = false;

    // Hole die gecachten Daten aus IndexedDB (oder was immer du verwendest)
    const cachedData = await getPicodeData(freq);

    if (cachedData && !picode.includes('?')) {
        console.log('LIVEMAP using cached data from IndexedDB');

        // Überprüfe, ob locations ein Objekt ist, und durchlaufe es
        if (typeof cachedData.locations === 'object') {
            for (const key in cachedData.locations) {
                const stations = cachedData.locations[key].stations;
                if (Array.isArray(stations)) {
                    foundPI = stations.some(station => station.pi === picode);
                    if (foundPI) {
                        console.log(`LIVEMAP found match for picode: ${picode} in cached data`);
                        break;
                    }
                }
            }
        } else {
            console.error('cachedData.locations is not an object');
        }

        return foundPI;
    }

    // Wenn keine Daten im Cache, hole sie von der API
    try {
        const response = await fetch(`${corsAnywhereUrl}https://maps.fmdx.org/api/?freq=${freq}`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();

        // Speichern in IndexedDB
        await savePicodeData(freq, data);

        // Überprüfe, ob locations ein Objekt ist, und durchlaufe es
        if (typeof data.locations === 'object') {
            for (const key in data.locations) {
                const stations = data.locations[key].stations;
                if (Array.isArray(stations)) {
                    foundPI = stations.some(station => station.pi === picode);
                    if (foundPI) {
                        console.log(`LIVEMAP found match for picode: ${picode} in API data`);
                        break;
                    }
                }
            }
        } else {
            console.error('data.locations is not an object');
        }

        return foundPI;
    } catch (error) {
        console.error('Error checking picode:', error);
        return false;
    }
}






   async function openOrUpdateIframe(picode, freq, stationid, station, city, distance, ps, itu, radius) {
    if (!LiveMapActive) {
        return;
    }

    if (picode.includes('??') || picode.includes('???')) {
        picode = '?'; 
    } else if (picode === '?' && picode.length > 1) {
        picode = picode.replace('?', ''); 
    }
    
    let foundPI = false; // Initialisiere foundPI mit false
    
    if (picode !== '?' && picode !== lastPicode) {
        foundPI = await checkPicode(freq, picode);  // Warte auf das Ergebnis von checkPicode
    }
       
    const LAT = localStorage.getItem('qthLatitude') || '0'; 
    const LON = localStorage.getItem('qthLongitude') || '0'; 

    let url;
    
    if (stationid) {
        url = `https://maps.fmdx.org/#qth=${LAT},${LON}&id=${stationid}&findId=*`;
    } else if (picode !== '?' && foundPI) {
        url = `https://maps.fmdx.org/#qth=${LAT},${LON}&freq=${freq}&findPi=${picode}`;
    } else {
        if (radius === 'none') {
            url = `https://maps.fmdx.org/#lat=${LAT}&lon=${LON}&freq=${freq}`;
        } else {
            url = `https://maps.fmdx.org/#lat=${LAT}&lon=${LON}&freq=${freq}&r=${radius}`;
        }
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
            iframeContainer.classList.add('bg-color-2');
            iframeContainer.style.width = (iframeWidth) + 'px'; 
            iframeContainer.style.height = (iframeHeight) + 'px'; 
            iframeContainer.style.left = iframeLeft + 'px';
            iframeContainer.style.top = iframeTop + 'px';
            iframeContainer.style.position = 'fixed';
            iframeContainer.style.opacity = '0'; 
            iframeContainer.style.transition = 'opacity 0.5s'; 
            iframeContainer.appendChild(header); 
            iframeContainer.appendChild(closeButton); 
            iframeContainer.appendChild(newIframe);
            iframeContainer.appendChild(footer); 
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

            if (itu === "POL") {
                stationid = await fetchstationid(freq, picode, city);
            } else {
                stationid = data.txInfo.id;
            }

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

    let cachedData = null;

    async function fetchstationid(freq, picode, city) {
        try {
            if (!cachedData) {
                const response = await fetch("https://tef.noobish.eu/logos/scripts/StationID_PL.txt");

                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }

                cachedData = await response.text();
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
                console.log("LIVEMAP activated.");

                lastPicode = '?'; 
                lastFreq = '0.0';
                lastStationId = null;

                if (!iframeContainer) {
                    openOrUpdateIframe(lastPicode, lastFreq, lastStationId); 
                } else {
                    iframeContainer.style.display = 'block'; 
                    iframeContainer.style.left = iframeLeft + 'px'; 
                    iframeContainer.style.top = iframeTop + 'px'; 
                    iframeContainer.style.width = (iframeWidth + 20) + 'px'; 
                    iframeContainer.style.height = (iframeHeight + 20) + 'px'; 
                }
            } else {
                LiveMapButton.classList.remove('bg-color-4');
                LiveMapButton.classList.add('bg-color-2');
                console.log("LIVEMAP deactivated.");

                if (iframeContainer) {
                    iframeLeft = parseInt(iframeContainer.style.left);
                    iframeTop = parseInt(iframeContainer.style.top);
                    localStorage.setItem('iframeLeft', iframeLeft);
                    localStorage.setItem('iframeTop', iframeTop);

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
            console.log('LIVEMAP button successfully added to button-wrapper.');
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
        console.log("LIVEMAP deactivated (default status).");
    }

    setupWebSocket();

    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(initializeLiveMapButton, 1000);
    });
})();
