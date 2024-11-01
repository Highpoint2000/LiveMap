(() => {

////////////////////////////////////////////////////////////
///                                                      ///
///  LIVEMAP SCRIPT FOR FM-DX-WEBSERVER (V2.3)          ///
///                                                      ///
///  by Highpoint                last update: 01.11.24   ///
///                                                      ///
///  https://github.com/Highpoint2000/LiveMap            ///
///                                                      ///
////////////////////////////////////////////////////////////

let ConsoleDebug = false; 		// Define ConsoleDebug variable
const FMLIST_OM_ID = ''; 	// If you want to use the logbook function, enter your OM ID here, e.g., FMLIST_OM_ID = '1234'

////////////////////////////////////////////////////////////

	// Custom console log function
	function debugLog(...messages) {
		if (ConsoleDebug) {
			console.log(...messages);
		}
	}

	// Define iframe size and position variables
	let iframeWidth = parseInt(localStorage.getItem('iframeWidth')) || 600; 
	let iframeHeight = parseInt(localStorage.getItem('iframeHeight')) || 650; 
	let iframeLeft = parseInt(localStorage.getItem('iframeLeft')) || 10; 
	let iframeTop = parseInt(localStorage.getItem('iframeTop')) || 10;

    const plugin_version = 'V2.3';
	const corsAnywhereUrl = 'https://cors-proxy.de:13128/';
    let lastPicode = null;
    let lastFreq = null;
    let lastStationId = null;
    let websocket;
    let iframeContainer = null;
    let LiveMapActive = false;
    let picode, freq, itu, city, station, pol, distance, ps, stationid, radius, coordinates, azimuth, LAT, LON;
    let stationListContainer;
    let foundPI;
    let foundID;
	let latTX;
	let lonTX;

    // Add custom CSS styles
    const style = document.createElement('style');
    style.innerHTML = `
.tooltip1 {
    display: inline-block;
    cursor: pointer;
}

.tooltip1::after {
  content: attr(data-tooltip); /* Das Attribut verwenden */
  position: absolute;
  bottom: 100%; /* Tooltip oberhalb des Elements anzeigen */
  transform: translateX(-100%);
  background-color: var(--color-3);
  color: var(--color-text);
  padding: 5px 25px;
  border-radius: 15px;
  white-space: nowrap;
  font-size: 14px;
  opacity: 0;
  z-index: 9999;
  pointer-events: none;
  transition: opacity 0.3s;
}

.tooltip1:hover::after {
  opacity: 1;
}

.tooltip2 {
    display: inline-block;
    cursor: pointer;
}

.tooltip2::after {
  content: attr(data-tooltip); /* Das Attribut verwenden */
  position: absolute;
  bottom: 100%; /* Tooltip oberhalb des Elements anzeigen */
  transform: translateX(10%);
  background-color: var(--color-3);
  color: var(--color-text);
  padding: 5px 25px;
  border-radius: 15px;
  white-space: nowrap;
  font-size: 14px;
  opacity: 0;
  z-index: 9999;
  pointer-events: none;
  transition: opacity 0.3s;
}

.tooltip2:hover::after {
  opacity: 1;
}


	
body {
    margin: 0; /* Remove default margin */
}

#wrapper {
    position: relative; /* Position for the wrapper */
}

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
        animation: fadeInAnimation 1.0s forwards;
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
	
	.icon-hover-effect {
		color: #D3D3D3; /* Default light gray color */
		cursor: pointer;
	}

	.icon-hover-effect:hover {
		color: var(--color-4); /* Change color to green on hover */
		text-decoration: none; /* No underline on hover */
	}
	
    `;
    document.head.appendChild(style);
		
	// Function to add drag-and-drop functionality
	function addDragFunctionalityToWrapper() {
		const wrapper = document.getElementById('wrapper');
		const LiveMapButton = document.getElementById('LIVEMAP-on-off');

		if (!wrapper || !LiveMapButton) {
			console.error('Wrapper or LiveMapButton not found.');
			return;
		}

		let startX = 0; // Start position of the mouse
		let wrapperStartLeft = 0; // Starting position of the wrapper

		LiveMapButton.onmousedown = function (e) {
			e.preventDefault(); // Prevent default action

			// Store the initial position of the mouse
			startX = e.clientX;

			// Save the current position of the wrapper relative to the viewport
			wrapperStartLeft = parseInt(window.getComputedStyle(wrapper).left, 10) || 0;

			// Set mouse move and mouse up events
			document.onmousemove = onMouseMove;
			document.onmouseup = onMouseUp;
		};

		function onMouseMove(e) {
			// Calculate the displacement of the mouse relative to the start position
			const deltaX = e.clientX - startX;

			// Calculate the new position of the wrapper
			let newLeft = wrapperStartLeft + deltaX;

			// Screen boundaries
			const minLeft = 0; // Left boundary
			const maxLeft = window.innerWidth - wrapper.offsetWidth; // Right boundary

			// Set the new position of the wrapper within the boundaries
			wrapper.style.left = Math.max(minLeft, Math.min(newLeft, maxLeft)) + 'px';
		}

		function onMouseUp() {
			// Save the horizontal position in localStorage
			localStorage.setItem('wrapperLeft', wrapper.style.left);

			// Remove event listeners
			document.onmousemove = null;
			document.onmouseup = null;
		}
	}

	// Initialize the position of the wrapper when the page loads
	function initializeWrapperPosition() {
		const wrapper = document.getElementById('wrapper');
		const storedLeft = localStorage.getItem('wrapperLeft');

		if (storedLeft) {
			wrapper.style.left = storedLeft; // Set the saved horizontal position
		} else {
			wrapper.style.left = '0px'; // Set a default position if nothing is saved
		}
	}

	initializeWrapperPosition();

	// Call the initialization and drag functionality setup
	document.addEventListener('DOMContentLoaded', () => {
		setTimeout(() => {
			addDragFunctionalityToWrapper();
		}, 1500); // Wait 1500 ms before calling the functions
	});
	
    // Function to create the toggle button
    function createToggleButton() {
        const toggleButton = document.createElement('div');
		toggleButton.classList.add('tooltip2'); // Klasse hinzufügen
		toggleButton.setAttribute('data-tooltip', 'Toggle Station List'); // Daten-Attribut setzen
        toggleButton.style.width = '10px';
        toggleButton.style.height = '10px';
        toggleButton.style.backgroundColor = 'red'; // Set the background color to red
        toggleButton.style.position = 'absolute';
        toggleButton.style.bottom = '0px'; // Position from the bottom
        toggleButton.style.left = '0px'; // Position from the left
        toggleButton.style.cursor = 'pointer';
        toggleButton.style.zIndex = '1000'; // Ensures the button is on top

        // Add the toggle functionality
        toggleButton.onclick = () => {
            if (!stationListContainer) {
                console.error('stationListContainer is not defined.');
                return;
            }

            const stationListVisible = stationListContainer.style.visibility === 'visible';

            if (stationListVisible) {
                // Hide station list
                stationListContainer.classList.remove('fade-in');
                stationListContainer.classList.add('fade-out');
                stationListContainer.addEventListener('animationend', function handler() {
                    stationListContainer.style.opacity = '0';
                    stationListContainer.style.visibility = 'hidden';
                    stationListContainer.removeEventListener('animationend', handler);
                });

                // Save state to localStorage
                localStorage.setItem('stationListVisible', 'hidden');
            } else {
                // Show station list
                stationListContainer.style.opacity = '1';
                stationListContainer.style.visibility = 'visible';
                stationListContainer.classList.remove('fade-out');
                stationListContainer.classList.add('fade-in');

                // Save state to localStorage
                localStorage.setItem('stationListVisible', 'visible');
							
            }
        };

        return toggleButton;
    }

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
    function createIframeFooter(coordinates) {

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

            openOrUpdateIframe(picode, freq, stationid, station, city, distance, ps, itu, pol, radius);
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
		
		const { lat, lon } = coordinates || {};
		latTX = lat;
		lonTX = lon;

        input.addEventListener('change', async function() {
            if (this.checked) {
                if (!stationid) {
                    sendToast('warning', 'Live Map', 'TXPOS can only be activated when a station is recognized', false, false);    
                    this.checked = false;
                    return;
                }
				console.log(latTX, lonTX);
                localStorage.setItem('txposLat', latTX);
                localStorage.setItem('txposLon', lonTX);
                debugLog(`LIVEMAP TXPOS activated: LAT = ${lat}, LON = ${lon}`);
                sendToast('info', 'Live Map', `TXPOS activated: ${city}[${itu}]`, true, false);    
            } else {
                localStorage.removeItem('txposLat');
                localStorage.removeItem('txposLon');
                debugLog(`LIVEMAP TXPOS deactivated, using default values.`);
                openOrUpdateIframe('?', '0.0', '', '', '', '', '', '', '',radius);
            }
        });

        return footer;
    }

 // Function to open (or create) the IndexedDB database
function openCacheDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('apiCacheDB', 1);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('apiCache')) {
                db.createObjectStore('apiCache', { keyPath: 'key' });
            }
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            reject('IndexedDB error: ' + event.target.errorCode);
        };
    });
}

// Function to get cached data
function getCachedData(db, key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['apiCache'], 'readonly');
        const store = transaction.objectStore('apiCache');
        const request = store.get(key);

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            reject('Failed to get cached data');
        };
    });
}

// Function to cache data with a timestamp
function cacheData(db, key, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['apiCache'], 'readwrite');
        const store = transaction.objectStore('apiCache');

        const cacheEntry = {
            key,
            data,
            cachedAt: Date.now() // Store the current timestamp
        };

        const request = store.put(cacheEntry);

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = (event) => {
            reject('Failed to cache data: ' + event.target.errorCode);
        };
    });
}

// Helper function to check if cached data is older than 7 days
function isCacheExpired(cachedAt) {
    const sevenDaysInMillis = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    const currentTime = Date.now();
    return (currentTime - cachedAt) > sevenDaysInMillis;
}

// Main function with cache mechanism
async function fetchAndCacheStationData(freq, radius, picode, txposLat, txposLon, stationid, pol, foundPI) {

    try {
        let response;
        const txposSwitch = document.getElementById('txposSwitch');
        const db = await openCacheDB();
        
        // Create a cache key based on the parameters
        const cacheKey = `freq:${freq}-lat:${txposLat}-lon:${txposLon}-radius:${radius}-picode:${picode}-stationid:${stationid}`;
        
        // Check if data is already in cache
        const cachedData = await getCachedData(db, cacheKey);

        if (cachedData) {
            // Check if the cached data is older than 7 days
            if (!isCacheExpired(cachedData.cachedAt)) {
                debugLog('Returning cached data:', cachedData);
                displayStationData(cachedData.data, txposLat, txposLon, picode, pol, foundPI);
                return;
            } else {
                debugLog('Cache expired, fetching new data...');
            }
        }

        // If no cached data or data is expired, make the API request
        if (txposSwitch && txposSwitch.checked) {
            if (stationid) {
                response = await fetch(`${corsAnywhereUrl}https://maps.fmdx.org/api/?lat=${LAT}&lon=${LON}&freq=${freq}`);
                txposLat = LAT;
                txposLon = LON;
            } else {
                response = await fetch(`${corsAnywhereUrl}https://maps.fmdx.org/api/?lat=${txposLat}&lon=${txposLon}&freq=${freq}&r=${radius}`);
            }
        } else {

            if (stationid || picode !== '?' && foundPI) {
                response = await fetch(`${corsAnywhereUrl}https://maps.fmdx.org/api/?lat=${LAT}&lon=${LON}&freq=${freq}`);
            } else {
                response = await fetch(`${corsAnywhereUrl}https://maps.fmdx.org/api/?lat=${LAT}&lon=${LON}&freq=${freq}&r=${radius}`);       
            }
        }

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        debugLog('Fetched data from API:', data);

        // Cache the API response with a timestamp
        await cacheData(db, cacheKey, data);

        // Display the station data
        displayStationData(data, txposLat, txposLon, picode, pol, foundPI);

    } catch (error) {
        console.error('Error fetching station data:', error);
    }
}

    // Function to calculate the distance between two geographical points
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radius of the Earth in kilometers
        const dLat = toRadians(lat2 - lat1);
        const dLon = toRadians(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Convert degrees to radians
    function toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

	// Function to calculate the azimuth (initial bearing) between two geographic points
	function calculateAzimuth(lat1, lon1, lat2, lon2) {
		// Convert latitude and longitude from degrees to radians
		const lat1Rad = lat1 * (Math.PI / 180);
		const lon1Rad = lon1 * (Math.PI / 180);
		const lat2Rad = lat2 * (Math.PI / 180);
		const lon2Rad = lon2 * (Math.PI / 180);

		// Calculate azimuth
		const deltaLon = lon2Rad - lon1Rad;
		const y = Math.sin(deltaLon) * Math.cos(lat2Rad);
		const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
				Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLon);
		let azimuth = Math.atan2(y, x) * (180 / Math.PI); // Convert to degrees

		// Normalize the azimuth to 0-360 degrees
		azimuth = (azimuth + 360) % 360;

		return azimuth; // Azimuth in degrees
	}

	// Variable to track the window state
	let FMLISTWindow = null;
	let isOpenFMLIST = false;

    // Function to open the FMLIST link in a popup window
    function openFMLISTPage(id, distance, azimuth, itu) {
        // URL for the website
        const url = `https://www.fmlist.org/fi_inslog.php?lfd=${id}&qrb=${distance}&qtf=${azimuth}&country=${itu}&omid=${FMLIST_OM_ID}`;

        // Open the link in a popup window
        FMLISTWindow = window.open(url, "_blank", "width=800,height=820"); // Adjust the window size as needed
    }	

	async function displayStationData(data, txposLat, txposLon, picode, pol, foundPI) {
        if (!data || !data.locations || typeof data.locations !== 'object') {
            // console.warn('No valid data received for station display.');
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
            stationListContainer.style.zIndex = '10';
            stationListContainer.style.maxHeight = '182px';
            stationListContainer.style.overflowY = 'scroll';
            stationListContainer.style.visibility = 'visible'; 
            document.body.appendChild(stationListContainer);
        } else {
            stationListContainer.style.left = `${iframeContainer.offsetLeft}px`;
            stationListContainer.style.top = `${iframeContainer.offsetTop + iframeContainer.offsetHeight}px`;
        }

        stationListContainer.style.msOverflowStyle = 'none';  
        stationListContainer.style.scrollbarWidth = 'none';  
        stationListContainer.style.WebkitOverflowScrolling = 'touch';  
        stationListContainer.style.overflowX = 'hidden';  
        stationListContainer.innerHTML = ''; 

        const stationsWithCoordinates = [];
        const allStations = [];

        for (const key in data.locations) {
            const location = data.locations[key];
            location.stations.forEach(station => {
                const lat = parseFloat(location.lat);
                const lon = parseFloat(location.lon);
                const itu = location.itu || 'N/A';
                if (!isNaN(lat) && !isNaN(lon)) {

                    const stationData = {
                        station,
                        city: location.name,
						pol: station.pol,
                        lat, 
                        lon,
                        pi: station.pi,
                        erp: station.erp,
                        id: station.id,
                        itu,
                        freq: parseFloat(station.freq)
                    };

                    stationsWithCoordinates.push(stationData);
                    allStations.push(stationData);
										
                }
            });
        }

        stationsWithCoordinates.sort((a, b) => {
            const distA = Math.abs(a.lat - txposLat) + Math.abs(a.lon - txposLon);
            const distB = Math.abs(b.lat - txposLat) + Math.abs(b.lon - txposLon);
            return distA - distB;
        });
		

        const filteredStations = stationsWithCoordinates.filter(station => {		
        
            if (stationid) {
                return station.id === stationid;
            } else if (picode !== '?' && station.pi && foundPI) {
                return picode === station.pi && parseFloat(station.freq) === parseFloat(freq);
            } else {
                return parseFloat(station.freq) === parseFloat(freq);
            }
        });
		
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.fontSize = '13px';
        table.classList.add('bg-color-2');
        table.style.borderRadius = '15px';
        // table.style.margin = '0 auto';
		table.style.marginBottom = '0px';
		table.style.marginTop = '0px';
        table.style.textAlign = 'left';

        filteredStations.forEach(({ station, city, lat, lon, pi, erp, id, itu }) => {
					
			if (station.station) {
            
				const row = document.createElement('tr');
				row.style.margin = '0';
				row.style.padding = '0';

				if (station.id === stationid) {
					row.classList.add('bg-color-1');
				} else if (picode === pi && parseFloat(freq) === parseFloat(station.freq)) {
					row.classList.add('bg-color-1');
				}

				const streamCell = document.createElement('td');
				const streamLink = document.createElement('a');
				const playIcon = document.createElement('i');
				playIcon.className = 'fas fa-play icon-hover-effect';
				playIcon.style.cursor = 'pointer';
				
				streamLink.appendChild(playIcon);
				streamLink.href = `javascript:window.open('https://fmscan.org/stream.php?i=${id}', 'newWindow', 'width=800,height=160');`;
				streamLink.style.color = 'green';
				streamLink.style.textDecoration = 'none';
				streamLink.title = 'play livestream';
				streamCell.appendChild(streamLink);
				streamCell.style.paddingLeft = '10px';
				streamCell.style.paddingRight = '10px';
				streamCell.style.width = '5px';
				streamCell.style.maxWidth = '5px';
				streamCell.style.textAlign = 'left';
				row.appendChild(streamCell);

				const freqCell = document.createElement('td');
				freqCell.innerText = `${station.freq.toFixed(2)} MHz`;
				freqCell.style.maxWidth = '100px';
				freqCell.style.width = '100px';
				freqCell.style.paddingLeft = '5px';
				freqCell.style.paddingRight = '25px';
				freqCell.style.color = 'white';
				freqCell.style.textAlign = 'right';
				freqCell.style.overflow = 'hidden';
				freqCell.style.whiteSpace = 'nowrap';
				freqCell.style.textOverflow = 'ellipsis';
				row.appendChild(freqCell);

				const piCell = document.createElement('td');
				if (station.pi) {
					piCell.innerText = pi;
				}
				piCell.style.maxWidth = '70px';
				piCell.style.width = '70px';
				piCell.style.paddingLeft = '5px';
				piCell.style.paddingRight = '25px';
				piCell.style.color = 'white';
				piCell.style.textAlign = 'right';
				piCell.style.overflow = 'hidden';
				piCell.style.whiteSpace = 'nowrap';
				piCell.style.textOverflow = 'ellipsis';
				row.appendChild(piCell);

				const stationCell = document.createElement('td');
				stationCell.innerText = station.station;
				stationCell.style.maxWidth = '160px';
				stationCell.style.width = '160px';
				stationCell.style.paddingLeft = '5px';
				stationCell.style.paddingRight = '5px';
				stationCell.style.color = 'white';
				stationCell.style.textAlign = 'left';
				stationCell.style.overflow = 'hidden';
				stationCell.style.whiteSpace = 'nowrap';
				stationCell.style.textOverflow = 'ellipsis';
				row.appendChild(stationCell);

				const cityCell = document.createElement('td');
				cityCell.innerText = `${city} [${itu}]`;
				cityCell.style.maxWidth = '160px';
				cityCell.style.width = '160px';
				cityCell.style.paddingLeft = '5px';
				cityCell.style.paddingRight = '5px';
				cityCell.title = 'open location list';
				cityCell.style.color = 'white';
				cityCell.style.textAlign = 'left';
				cityCell.style.overflow = 'hidden';
				cityCell.style.whiteSpace = 'nowrap';
				cityCell.style.textOverflow = 'ellipsis';
				cityCell.style.cursor = 'pointer';
				row.appendChild(cityCell);

				cityCell.addEventListener('mouseover', () => {
					cityCell.style.textDecoration = 'underline';
					cityCell.style.color = 'var(--color-5)';
				});

				cityCell.addEventListener('mouseout', () => {
					cityCell.style.textDecoration = 'none';
					cityCell.style.color = 'white';
				});
					
				const polCell = document.createElement('td');
				polCell.innerText = `${station.pol.substring(0, 1)}`;
				polCell.style.maxWidth = '1px';
				polCell.style.width = '1px';
				polCell.style.paddingLeft = '5px';
				polCell.style.paddingRight = '15px';
				polCell.style.color = 'white';
				polCell.style.textAlign = 'right';       
				row.appendChild(polCell);

				const erpCell = document.createElement('td');
				erpCell.innerText = `${erp.toFixed(2)} kW`;
				erpCell.style.maxWidth = '100px';
				erpCell.style.width = '100px';
				erpCell.style.paddingLeft = '5px';
				erpCell.style.paddingRight = '5px';
				erpCell.style.color = 'white';
				erpCell.style.textAlign = 'right';
				erpCell.style.overflow = 'hidden';
				erpCell.style.whiteSpace = 'nowrap';
				erpCell.style.textOverflow = 'ellipsis';

				if (erp < 0.5) {
					// ERP less than 0.5 kW, set background color to purple
					erpCell.style.backgroundColor = '#7800FF';
				} else if (erp >= 0.5 && erp < 5.0) {
					// ERP between 0.5 kW and 5.0 kW, set background color to blue
					erpCell.style.backgroundColor = '#238BFF';
				} else if (erp >= 5.0) {
					// ERP greater than or equal to 5.0 kW, set background color to dark blue
					erpCell.style.backgroundColor = '#0000FF';
				}

				// Append the ERP cell to the row
				row.appendChild(erpCell);
							
				if (FMLIST_OM_ID !== '') {
				
					const fmlistCell = document.createElement('td');
					const FMLISTButton = document.createElement('a');
					const fmlistIcon = document.createElement('i');

					// Set the icon class and add the hover effect class
					fmlistIcon.className = 'fas fa-pen-to-square icon-hover-effect';
					fmlistIcon.style.cursor = 'pointer';

					// Append the icon to the button
					FMLISTButton.appendChild(fmlistIcon);
					FMLISTButton.style.textDecoration = 'none';
					FMLISTButton.title = 'Entry in the FMLIST logbook';

					// Append the button to the table cell
					fmlistCell.appendChild(FMLISTButton);
					fmlistCell.style.paddingLeft = '10px';
					fmlistCell.style.paddingRight = '20px';
					fmlistCell.style.width = '5px';
					fmlistCell.style.maxWidth = '5px';
					fmlistCell.style.textAlign = 'left';

					// Append the cell to the row
					row.appendChild(fmlistCell);
				            		
					const emptyRow = document.createElement('tr');
					const emptyCell = document.createElement('td');
					emptyCell.colSpan = 7; // Anzahl der Spalten anpassen
					emptyCell.style.height = '2px'; // Höhe der Leerzeile
					emptyRow.appendChild(emptyCell);

					
					// Event listener for button click
					FMLISTButton.addEventListener("click", function () {
						if (id > 0) {
							
							const distanceBetweenPoints = calculateDistance(txposLat, txposLon, lat, lon);	
							const distance = `${distanceBetweenPoints.toFixed(0)}`;	
							
							const azimuthBetweenPoints = calculateAzimuth(txposLat, txposLon, lat, lon);	
							const azimuth = `${azimuthBetweenPoints.toFixed(0)}`;	
							
							// Check if the popup window is already open
							if (isOpenFMLIST && FMLISTWindow && !FMLISTWindow.closed) {
								// Close if already open
								FMLISTWindow.close();
								isOpenFMLIST = false;
							} else {
								// Open if not already open
								openFMLISTPage(id, distance, azimuth, itu);
								isOpenFMLIST = true;
							}
						} else {
							sendToast('error', 'Live Map', '${id} is not compatible with FMLIST Database!', false, false);    
						}
					});
					
				}
				
				// Append the row to the table
				table.appendChild(row);
				
			}
			
        });

        // Add the table with stations to the station list container
        stationListContainer.appendChild(table);
        stationListContainer.style.width = `${iframeContainer.offsetWidth}px`;

		// Allow clicking on the city cells to display more stations from the same city
		const cityCells = table.querySelectorAll('td:nth-child(5)');
		cityCells.forEach(cell => {
			cell.style.cursor = 'pointer';
			
			if (picode !== '?' && foundPI) {
				
				const cityToDisplay = cell.innerText.split(' [')[0]; // Define cityToDisplay here
				const cityStation = allStations.find(station => station.city === cityToDisplay);
				
				if (!cityStation  && !station.pi) {
					console.warn('City not found:', cityToDisplay);
					return;
				}

				const distanceToCity = calculateDistance(txposLat, txposLon, cityStation.lat, cityStation.lon);

				// Filter and sort the stations of the selected city by ERP in descending order
				const stationsOfCity = allStations
					.filter(station => station.city === cityToDisplay)
					.sort((a, b) => b.erp - a.erp); // Sorting in descending order based on ERP

				// Clear the table before displaying stations from the selected city
				table.innerHTML = '';

				// Iterate through the stations from the same city and create table rows
				stationsOfCity.forEach(({ station, city, distance, pi, erp, id, itu }) => {
					
					if (station.station) {
					
						const row = document.createElement('tr');

						// Highlight the row if it's the current station
						if (station.id === stationid) {
							row.classList.add('bg-color-1');
						} else if (picode === pi && parseFloat(freq) === parseFloat(station.freq)) {
							row.classList.add('bg-color-1');
						}

						// Create a cell with a link to the station stream
						const streamCell = document.createElement('td');
						const streamLink = document.createElement('a');
						const playIcon = document.createElement('i');
						playIcon.className = 'fas fa-play icon-hover-effect';
						playIcon.style.cursor = 'pointer';

						streamLink.appendChild(playIcon);
						streamLink.href = `javascript:window.open('https://fmscan.org/stream.php?i=${id}', 'newWindow', 'width=800,height=160');`;
						streamLink.style.color = 'green';
						streamLink.style.textDecoration = 'none';
						streamLink.title = 'play livestream';
						streamCell.appendChild(streamLink);
						streamCell.style.paddingLeft = '10px';
						streamCell.style.paddingRight = '10px';
						streamCell.style.width = '5px';
						streamCell.style.maxWidth = '5px';
						streamCell.style.textAlign = 'left';
						row.appendChild(streamCell);

						const freqCellStation = document.createElement('td');
						freqCellStation.innerText = `${station.freq.toFixed(2)} MHz`;
						freqCellStation.style.maxWidth = '100px';
						freqCellStation.style.width = '100px';
						freqCellStation.style.paddingLeft = '5px';
						freqCellStation.style.paddingRight = '25px';
						freqCellStation.style.color = 'white';
						freqCellStation.style.textAlign = 'right';
						freqCellStation.style.overflow = 'hidden';
						freqCellStation.style.whiteSpace = 'nowrap';
						freqCellStation.style.textOverflow = 'ellipsis';
						freqCellStation.style.cursor = 'pointer';
						row.appendChild(freqCellStation);

						// Add hover effect and click event for sending frequency data over WebSocket
						freqCellStation.addEventListener('mouseover', () => {
							freqCellStation.style.textDecoration = 'underline';
							freqCellStation.style.color = 'var(--color-4)';
						});

						freqCellStation.addEventListener('mouseout', () => {
							freqCellStation.style.textDecoration = 'none';
							freqCellStation.style.color = 'white';
						});

						freqCellStation.onclick = () => {
							const dataToSend = `T${(parseFloat(station.freq) * 1000).toFixed(0)}`;
							socket.send(dataToSend);
							debugLog("WebSocket sending:", dataToSend);
						};

						const piCell = document.createElement('td');
						if (station.pi) {
							piCell.innerText = pi;
						}
						piCell.style.maxWidth = '70px';
							piCell.style.width = '70px';
						piCell.style.paddingLeft = '5px';
						piCell.style.paddingRight = '25px';
						piCell.style.color = 'white';
						piCell.style.textAlign = 'right';
						piCell.style.overflow = 'hidden';
						piCell.style.whiteSpace = 'nowrap';
						piCell.style.textOverflow = 'ellipsis';
						row.appendChild(piCell);

						const stationCell = document.createElement('td');
						stationCell.style.maxWidth = '160px';
						stationCell.innerText = station.station;
						stationCell.style.width = '160px';
						stationCell.style.paddingLeft = '5px';
						stationCell.style.paddingRight = '5px';
						stationCell.style.color = 'white';
						stationCell.style.textAlign = 'left';
						stationCell.style.overflow = 'hidden';
						stationCell.style.whiteSpace = 'nowrap';
						stationCell.style.textOverflow = 'ellipsis';
						row.appendChild(stationCell);

						// Create and append the city and ITU code cell
						const cityAllCell = document.createElement('td');
						cityAllCell.innerText = `${city} [${itu}]`;
						cityAllCell.style.maxWidth = '160px';
						cityAllCell.style.width = '160px';
						cityAllCell.style.paddingRight = '5px';
						cityAllCell.style.paddingLeft = '5px';
						cityAllCell.title = 'open transmitter location on fmscan.org ';
						cityAllCell.style.color = 'white';
						cityAllCell.style.textAlign = 'left';
						cityAllCell.style.overflow = 'hidden';
						cityAllCell.style.whiteSpace = 'nowrap';
						cityAllCell.style.textOverflow = 'ellipsis';
						cityAllCell.style.cursor = 'pointer';
						row.appendChild(cityAllCell);

						// Add hover effect for city cell
						cityAllCell.addEventListener('mouseover', () => {
							cityAllCell.style.textDecoration = 'underline';
							cityAllCell.style.color = 'var(--color-5)';
						});

						cityAllCell.addEventListener('mouseout', () => {
							cityAllCell.style.textDecoration = 'none';
							cityAllCell.style.color = 'white';
						});

						// Add click event to open the station's webpage
						cityAllCell.addEventListener('click', () => {
							window.open(`https://fmscan.org/transmitter.php?i=${id}`, '_blank');
						});

						// Create and append the distance cell
						const distanceCell = document.createElement('td');
						distanceCell.innerText = `${Math.round(distanceToCity)} km`;
						distanceCell.style.padding = '0';
						distanceCell.style.maxWidth = '75px';
						distanceCell.style.paddingLeft = '10px';
						distanceCell.style.paddingRight = '10px';
						distanceCell.style.color = 'white';
						distanceCell.style.textAlign = 'right';
						distanceCell.style.overflow = 'hidden';
						distanceCell.style.whiteSpace = 'nowrap';
						distanceCell.style.textOverflow = 'ellipsis';
						row.appendChild(distanceCell);

						const polCell = document.createElement('td');
						polCell.innerText = `${station.pol.substring(0, 1)}`;
						polCell.style.maxWidth = '1px';
						polCell.style.width = '1px';
						polCell.style.paddingLeft = '5px';
						polCell.style.paddingRight = '15px';
						polCell.style.color = 'white';
						polCell.style.textAlign = 'right';       
						row.appendChild(polCell);

						// Create and append the ERP cell
						const erpCell = document.createElement('td');
						erpCell.innerText = `${erp.toFixed(2)} kW`;
						erpCell.style.maxWidth = '100px';
						erpCell.style.width = '100px';
						erpCell.style.paddingLeft = '5px';
						erpCell.style.paddingRight = '5px';
						erpCell.style.color = 'white';
						erpCell.style.textAlign = 'right';
						erpCell.style.overflow = 'hidden';
						erpCell.style.whiteSpace = 'nowrap';
						erpCell.style.textOverflow = 'ellipsis';

						if (erp < 0.5) {
							// ERP less than 0.5 kW, set background color to purple
							erpCell.style.backgroundColor = '#7800FF';
						} else if (erp >= 0.5 && erp < 5.0) {
							// ERP between 0.5 kW and 5.0 kW, set background color to blue
							erpCell.style.backgroundColor = '#238BFF';
						} else if (erp >= 5.0) {
							// ERP greater than or equal to 5.0 kW, set background color to dark blue
							erpCell.style.backgroundColor = '#0000FF';
						}

						row.appendChild(erpCell);

						if (FMLIST_OM_ID !== '' && stationid === station.id) {
				
							const fmlistCell = document.createElement('td');
							const FMLISTButton = document.createElement('a');
							const fmlistIcon = document.createElement('i');
							
							// Set the icon class and add the hover effect class
							fmlistIcon.className = 'fas fa-pen-to-square icon-hover-effect';
							fmlistIcon.style.cursor = 'pointer';

							// Append the icon to the button
							FMLISTButton.appendChild(fmlistIcon);
							FMLISTButton.style.textDecoration = 'none';
							FMLISTButton.title = 'Entry in the FMLIST logbook';

							// Append the button to the table cell
							fmlistCell.appendChild(FMLISTButton);
							fmlistCell.style.paddingLeft = '10px';
							fmlistCell.style.paddingRight = '20px';
							fmlistCell.style.width = '5px';
							fmlistCell.style.maxWidth = '5px';
							fmlistCell.style.textAlign = 'left';
							row.appendChild(fmlistCell);
											            
							// Append the row to the table
							table.appendChild(row);
			
							const emptyRow = document.createElement('tr');
							const emptyCell = document.createElement('td');
							emptyCell.colSpan = 7; // Anzahl der Spalten anpassen
							emptyCell.style.height = '2px'; // Höhe der Leerzeile
							emptyRow.appendChild(emptyCell);
							table.appendChild(emptyRow);
					
							// Event listener for button click
							FMLISTButton.addEventListener("click", function () {
								if (id > 0) {
							
									const distanceBetweenPoints = calculateDistance(txposLat, txposLon, cityStation.lat, cityStation.lon);	
									const distance = `${distanceBetweenPoints.toFixed(0)}`;	
							
									const azimuthBetweenPoints = calculateAzimuth(txposLat, txposLon, cityStation.lat, cityStation.lon);	
									const azimuth = `${azimuthBetweenPoints.toFixed(0)}`;	
							
									// Check if the popup window is already open
									if (isOpenFMLIST && FMLISTWindow && !FMLISTWindow.closed) {
										// Close if already open
										FMLISTWindow.close();
										isOpenFMLIST = false;
									} else {
										// Open if not already open
										openFMLISTPage(id, distance, azimuth, itu);
										isOpenFMLIST = true;
									}
								} else {
								sendToast('error', 'Live Map', '${id} is not compatible with FMLIST Database!', false, false);    
								}
							});
					
						}
						
						// Append the row to the table
						table.appendChild(row);
            
						// Create and append an empty row for spacing
						const emptyRow = document.createElement('tr');
						const emptyCell = document.createElement('td');
            
						emptyCell.colSpan = 7; // Adjust the number of columns accordingly
						emptyCell.style.height = '2px'; // Height of the empty row
						emptyRow.appendChild(emptyCell);
						table.appendChild(emptyRow);
					}
				});
			}

			// onclick-Ereignis setzen, sodass derselbe Code auch bei einem Klick ausgeführt wird
			cell.onclick = () => {
				
				const cityToDisplay = cell.innerText.split(' [')[0]; // Define cityToDisplay here
				const cityStation = allStations.find(station => station.city === cityToDisplay);

				if (!cityStation) {
					console.warn('City not found:', cityToDisplay);
					return;
				}

				const distanceToCity = calculateDistance(txposLat, txposLon, cityStation.lat, cityStation.lon);

				// Filter and sort the stations of the selected city by ERP in descending order
				const stationsOfCity = allStations
					.filter(station => station.city === cityToDisplay)
					.sort((a, b) => b.erp - a.erp); // Sorting in descending order based on ERP

				// Clear the table before displaying stations from the selected city
				table.innerHTML = '';
	
				// Iterate through the stations from the same city and create table rows
				stationsOfCity.forEach(({ station, city, distance, pi, erp, id, itu }) => {
				
					if (station.station) {
					
						const row = document.createElement('tr');

						// Highlight the row if it's the current station
						if (station.id === stationid) {
							row.classList.add('bg-color-1');
						} else if (picode === pi && parseFloat(freq) === parseFloat(station.freq)) {
							row.classList.add('bg-color-1');
						}

						// Create a cell with a link to the station stream
						const streamCell = document.createElement('td');
						const streamLink = document.createElement('a');
						const playIcon = document.createElement('i');
						playIcon.className = 'fas fa-play icon-hover-effect';
						playIcon.style.cursor = 'pointer';

						streamLink.appendChild(playIcon);
						streamLink.href = `javascript:window.open('https://fmscan.org/stream.php?i=${id}', 'newWindow', 'width=800,height=160');`;
						streamLink.style.color = 'green';
						streamLink.style.textDecoration = 'none';
						streamLink.title = 'play livestream';
						streamCell.appendChild(streamLink);
						streamCell.style.paddingLeft = '10px';
						streamCell.style.paddingRight = '10px';
						streamCell.style.width = '5px';
						streamCell.style.maxWidth = '5px';
						streamCell.style.textAlign = 'left';
						row.appendChild(streamCell);

						const freqCellStation = document.createElement('td');
						freqCellStation.innerText = `${station.freq.toFixed(2)} MHz`;
						freqCellStation.style.maxWidth = '100px';
						freqCellStation.style.width = '100px';
						freqCellStation.style.paddingLeft = '5px';
						freqCellStation.style.paddingRight = '25px';
						freqCellStation.style.color = 'white';
						freqCellStation.style.textAlign = 'right';
						freqCellStation.style.overflow = 'hidden';
						freqCellStation.style.whiteSpace = 'nowrap';
						freqCellStation.style.textOverflow = 'ellipsis';
						freqCellStation.style.cursor = 'pointer';
						row.appendChild(freqCellStation);

						// Add hover effect and click event for sending frequency data over WebSocket
						freqCellStation.addEventListener('mouseover', () => {
							freqCellStation.style.textDecoration = 'underline';
							freqCellStation.style.color = 'var(--color-4)';
						});

						freqCellStation.addEventListener('mouseout', () => {
							freqCellStation.style.textDecoration = 'none';
							freqCellStation.style.color = 'white';
						});

						freqCellStation.onclick = () => {
							const dataToSend = `T${(parseFloat(station.freq) * 1000).toFixed(0)}`;
							socket.send(dataToSend);
							debugLog("WebSocket sending:", dataToSend);
						};

						const piCell = document.createElement('td');
						if (station.pi) {
							piCell.innerText = pi;
						}
						piCell.style.maxWidth = '70px';
							piCell.style.width = '70px';
						piCell.style.paddingLeft = '5px';
						piCell.style.paddingRight = '25px';
						piCell.style.color = 'white';
						piCell.style.textAlign = 'right';
						piCell.style.overflow = 'hidden';
						piCell.style.whiteSpace = 'nowrap';
						piCell.style.textOverflow = 'ellipsis';
						row.appendChild(piCell);

						const stationCell = document.createElement('td');
						stationCell.style.maxWidth = '160px';
						stationCell.innerText = station.station;
						stationCell.style.width = '160px';
						stationCell.style.paddingLeft = '5px';
						stationCell.style.paddingRight = '5px';
						stationCell.style.color = 'white';
						stationCell.style.textAlign = 'left';
						stationCell.style.overflow = 'hidden';
						stationCell.style.whiteSpace = 'nowrap';
						stationCell.style.textOverflow = 'ellipsis';
						row.appendChild(stationCell);

						// Create and append the city and ITU code cell
						const cityAllCell = document.createElement('td');
						cityAllCell.innerText = `${city} [${itu}]`;
						cityAllCell.style.maxWidth = '160px';
						cityAllCell.style.width = '160px';
						cityAllCell.style.paddingRight = '5px';
						cityAllCell.style.paddingLeft = '5px';
						cityAllCell.title = 'open frequency list';
						cityAllCell.style.color = 'white';
						cityAllCell.style.textAlign = 'left';
						cityAllCell.style.overflow = 'hidden';
						cityAllCell.style.whiteSpace = 'nowrap';
						cityAllCell.style.textOverflow = 'ellipsis';
						cityAllCell.style.cursor = 'pointer';
						row.appendChild(cityAllCell);

						// Add hover effect for city cell
						cityAllCell.addEventListener('mouseover', () => {
							cityAllCell.style.textDecoration = 'underline';
							cityAllCell.style.color = 'var(--color-5)';
						});

						cityAllCell.addEventListener('mouseout', () => {
							cityAllCell.style.textDecoration = 'none';
							cityAllCell.style.color = 'white';
						});

						// Add click event to display more stations from the same city
						cityAllCell.addEventListener('click', () => {
							displayStationData(data, txposLat, txposLon, foundPI); // Ensure this function is defined correctly
						});

						// Create and append the distance cell
						const distanceCell = document.createElement('td');
						distanceCell.innerText = `${Math.round(distanceToCity)} km`;
						distanceCell.style.padding = '0';
						distanceCell.style.maxWidth = '75px';
						distanceCell.style.paddingLeft = '10px';
						distanceCell.style.paddingRight = '10px';
						distanceCell.style.color = 'white';
						distanceCell.style.textAlign = 'right';
						distanceCell.style.overflow = 'hidden';
						distanceCell.style.whiteSpace = 'nowrap';
						distanceCell.style.textOverflow = 'ellipsis';
						row.appendChild(distanceCell);

						const polCell = document.createElement('td');
						polCell.innerText = `${station.pol.substring(0, 1)}`;
						polCell.style.maxWidth = '1px';
						polCell.style.width = '1px';
						polCell.style.paddingLeft = '5px';
						polCell.style.paddingRight = '15px';
						polCell.style.color = 'white';
						polCell.style.textAlign = 'right';       
						row.appendChild(polCell);

						// Create and append the ERP cell
						const erpCell = document.createElement('td');
						erpCell.innerText = `${erp.toFixed(2)} kW`;
						erpCell.style.maxWidth = '100px';
						erpCell.style.width = '100px';
						erpCell.style.paddingLeft = '5px';
						erpCell.style.paddingRight = '5px';
						erpCell.style.color = 'white';
						erpCell.style.textAlign = 'right';
						erpCell.style.overflow = 'hidden';
						erpCell.style.whiteSpace = 'nowrap';
						erpCell.style.textOverflow = 'ellipsis';

						if (erp < 0.5) {
							// ERP less than 0.5 kW, set background color to purple
							erpCell.style.backgroundColor = '#7800FF';
						} else if (erp >= 0.5 && erp < 5.0) {
							// ERP between 0.5 kW and 5.0 kW, set background color to blue
							erpCell.style.backgroundColor = '#238BFF';
						} else if (erp >= 5.0) {
							// ERP greater than or equal to 5.0 kW, set background color to dark blue
							erpCell.style.backgroundColor = '#0000FF';
						}

						row.appendChild(erpCell);
						
						if (FMLIST_OM_ID !== '') {
				
							const fmlistCell = document.createElement('td');
							const FMLISTButton = document.createElement('a');
							const fmlistIcon = document.createElement('i');
							
							// Set the icon class and add the hover effect class
							fmlistIcon.className = 'fas fa-pen-to-square icon-hover-effect';
							fmlistIcon.style.cursor = 'pointer';

							// Append the icon to the button
							FMLISTButton.appendChild(fmlistIcon);
							FMLISTButton.style.textDecoration = 'none';
							FMLISTButton.title = 'Entry in the FMLIST logbook';

							// Append the button to the table cell
							fmlistCell.appendChild(FMLISTButton);
							fmlistCell.style.paddingLeft = '10px';
							fmlistCell.style.paddingRight = '20px';
							fmlistCell.style.width = '5px';
							fmlistCell.style.maxWidth = '5px';
							fmlistCell.style.textAlign = 'left';
							row.appendChild(fmlistCell);
											            
							// Append the row to the table
							table.appendChild(row);
			
							const emptyRow = document.createElement('tr');
							const emptyCell = document.createElement('td');
							emptyCell.colSpan = 7; // Anzahl der Spalten anpassen
							emptyCell.style.height = '2px'; // Höhe der Leerzeile
							emptyRow.appendChild(emptyCell);
							table.appendChild(emptyRow);
					
							// Event listener for button click
							FMLISTButton.addEventListener("click", function () {
								if (id > 0) {
							
									const distanceBetweenPoints = calculateDistance(txposLat, txposLon, cityStation.lat, cityStation.lon);	
									const distance = `${distanceBetweenPoints.toFixed(0)}`;	
							
									const azimuthBetweenPoints = calculateAzimuth(txposLat, txposLon, cityStation.lat, cityStation.lon);	
									const azimuth = `${azimuthBetweenPoints.toFixed(0)}`;	
							
									// Check if the popup window is already open
									if (isOpenFMLIST && FMLISTWindow && !FMLISTWindow.closed) {
										// Close if already open
										FMLISTWindow.close();
										isOpenFMLIST = false;
									} else {
										// Open if not already open
										openFMLISTPage(id, distance, azimuth, itu);
										isOpenFMLIST = true;
									}
								} else {
								sendToast('error', 'Live Map', '${id} is not compatible with FMLIST Database!', false, false);    
								}
							});
					
						}
						

						table.appendChild(row);
            
						// Create and append an empty row for spacing
						const emptyRow = document.createElement('tr');
						const emptyCell = document.createElement('td');
            
						emptyCell.colSpan = 7; // Adjust the number of columns accordingly
						emptyCell.style.height = '2px'; // Height of the empty row
						emptyRow.appendChild(emptyCell);
						table.appendChild(emptyRow);
					};
				});	
			};	
		});
	};

	// Function to open (or create) the IndexedDB database
    function openCacheDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('apiCacheDB', 1);

            // Create object store if not already present
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('apiCache')) {
                    db.createObjectStore('apiCache', { keyPath: 'key' });
                }
            };

            // Resolve when successfully opened
            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            // Reject if an error occurs
            request.onerror = (event) => {
                reject('IndexedDB error: ' + event.target.errorCode);
            };
        });
    }

    // Function to get cached data from the database
    function getCachedData(db, key) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['apiCache'], 'readonly');
            const store = transaction.objectStore('apiCache');
            const request = store.get(key);

            // Resolve if data is found
            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            // Reject if there is an error retrieving data
            request.onerror = (event) => {
                reject('Failed to get cached data');
            };
        });
    }

    // Function to cache data into the IndexedDB database
    function cacheData(db, key, data) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['apiCache'], 'readwrite');
            const store = transaction.objectStore('apiCache');
            const request = store.put({ key, data });

            // Resolve when data is successfully cached
            request.onsuccess = () => {
                resolve();
            };

            // Reject if there's an error during caching
            request.onerror = (event) => {
                reject('Failed to cache data: ' + event.target.errorCode);
            };
        });
    }

    // Main async function to check PI code and station ID with caching
    async function checkPicodeAndID(freq, picode, stationid) {
        const db = await openCacheDB();
        const cacheKey = `freq:${freq}`;

        // Check if data is already cached
        const cachedData = await getCachedData(db, cacheKey);
        if (cachedData) {
            debugLog('Returning cached data:', cachedData);
            return searchInLocations(cachedData.data, picode, stationid, freq);  // Search within cached data
        }

        // If no cache found, fetch data from the API
        const response = await fetch(`${corsAnywhereUrl}https://maps.fmdx.org/api/?freq=${freq}`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();

        // Cache the fetched data
        await cacheData(db, cacheKey, data);

        // Process and return the data
        return searchInLocations(data, picode, stationid, freq);
    }

    // Function to search for PI code and station ID within the data
    function searchInLocations(data, picode, stationid, freq) {
        foundPI = false;
        foundID = false;


        if (typeof data.locations === 'object') {
            for (const key in data.locations) {
                const location = data.locations[key];
                const stations = location.stations;

                if (Array.isArray(stations)) {
                    for (const station of stations) {
                        let frequency = station.freq;
                        let formattedFrequency = frequency.toFixed(3);

                        if (formattedFrequency === freq) {
                            // Check for matching PI code
                            if (station.pi === picode) {
                                foundPI = true;
                            }
                            // Check for matching station ID
                            if (station.id === parseInt(stationid, 10)) {
                                foundID = true;
                                coordinates = { lat: location.lat, lon: location.lon };
                            }

                            // Break the loop if both PI and ID are found
                            if (foundPI && foundID) break;
                        }
                    }
                }

                // Exit outer loop if a match is found
                if (foundPI || foundID) break;
            }
        }

        debugLog(`Found PI: ${foundPI}, Found ID: ${foundID}, Coordinates: ${JSON.stringify(coordinates)}`);
        return { foundPI, foundID, coordinates };
    }

    // Async function to create or update the iframe based on the provided data
    async function openOrUpdateIframe(picode, freq, stationid, station, city, distance, ps, itu, pol, radius) {
		
        if (!LiveMapActive) return;

        foundPI = false; // Initialize foundPI
        foundID = false; // Initialize foundID
        
        if ((picode !== '?' && picode !== lastPicode) || (stationid && stationid !== lastStationId)) {
            let result = await checkPicodeAndID(freq, picode, stationid);
            foundPI = result.foundPI;
            foundID = result.foundID;
            coordinates = result.coordinates;
            debugLog(`openOrUpdateIframe - Found PI: ${foundPI}, Found ID: ${foundID}, Coordinates:`, coordinates);
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

        // Function to create and insert the iframe
        function createAndInsertIframe() {
            const newIframe = createIframe();
            const header = createIframeHeader();
            const footer = createIframeFooter(coordinates);
            const closeButton = createCloseButton();
            const toggleButton = createToggleButton(); // Create the blue toggle button
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
                iframeContainer.appendChild(toggleButton); // Append the toggle button to the container
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

                // Remove old iframes
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
            await fetchAndCacheStationData(freq, radius, picode, txposLat, txposLon, stationid, pol, foundPI);
            updateToggleSwitch(stationid);
        }
    }

    let previousFreq = null;
    let timeoutId = null;
    let isFirstUpdateAfterChange = false;
    let freq_save;
    let isToggleEnabled = true; // Flag to track if the toggle is enabled
    let longPressTimer = null; // Timer for detecting long press
    let longPressDuration = 1000; // Duration in milliseconds for long press (1 second)
    let isLongPressTriggered = false; // Flag to track whether long press was triggered

    // Find the element with the class "panel-33 hover-brighten" and the ID "freq-container"
    let element = document.querySelector('div.panel-33.hover-brighten#freq-container');

    // Check if the element was found
    if (element) {
        // Add the class "tooltip"
        element.classList.add('tooltip');

        // Add the "data-tooltip" attribute
        element.setAttribute('data-tooltip', 'Toggle actual frequency - previous frequency  |  Hold longer for deactivating/activating');
    }

    // Find the element with the ID "freq-container"
    const freqContainer = document.getElementById('freq-container');

    const frequencyElement = document.getElementById('data-frequency'); // Get the frequency element

    // Check localStorage for saved toggle state and restore it
    const savedToggleState = localStorage.getItem('toggleEnabled');
    debugLog("Loaded toggle state from localStorage:", savedToggleState);

    // Restore the toggle state if found
    if (savedToggleState === 'false') {
        isToggleEnabled = false; // Restore the toggle state from localStorage
        debugLog("Restoring toggle state: disabled.");
    } else {
        debugLog("Restoring toggle state: enabled.");
    }

    // Function to ensure the existingDiv is created or updated
    function ensureExistingDiv(freq_save) {
        let existingDiv = freqContainer.querySelector('.text-small.text-gray'); // Check if the div already exists

        if (existingDiv) {
            existingDiv.textContent = freq_save; // Update the existing div with the previous frequency
        } else {
            // Create a new div element for the previous frequency
            existingDiv = document.createElement('div');
            existingDiv.className = 'text-small text-gray hide-phone'; // Set the classes of the new div element
            existingDiv.textContent = freq_save; // Set the text content of the new element to freq_save
            freqContainer.insertBefore(existingDiv, frequencyElement); // Insert the new div before the frequency element
        }

        // Set visibility based on the toggle state
        existingDiv.style.display = isToggleEnabled ? '' : 'none'; // Show or hide based on the toggle state
        debugLog(isToggleEnabled ? "Showing existingDiv." : "Hiding existingDiv.");
        return existingDiv; // Return the div for further use if needed
    }

    // Add long press event listener to freqContainer for toggling visibility and functionality
    freqContainer.addEventListener('mousedown', () => {
        isLongPressTriggered = false; // Reset the flag on each mousedown
        longPressTimer = setTimeout(() => {
            isLongPressTriggered = true; // Set the flag to true after a long press
            toggleFrequencyFunctions(); // Call the function to toggle visibility and functionality
        }, longPressDuration); // Detect long press after 1 second
    });

    freqContainer.addEventListener('mouseup', () => {
        clearTimeout(longPressTimer); // Clear the timer if mouse is released before long press
    });

    freqContainer.addEventListener('mouseleave', () => {
        clearTimeout(longPressTimer); // Clear the timer if the mouse leaves the container before the press is complete
    });

    async function handleWebSocketMessage(event) {
        try {
            const data = JSON.parse(event.data); // Parse the incoming WebSocket message
            picode = data.pi; // Extract pi code from data
            freq = data.freq; // Extract frequency from data
            itu = data.txInfo.itu; // Extract ITU information from transmission info
            city = data.txInfo.city; // Extract city from transmission info
            station = data.txInfo.tx; // Extract station from transmission info
            distance = data.txInfo.dist; // Extract distance from transmission info
            pol = data.txInfo.pol; // Extract polarization from transmission info
            ps = data.ps; // Extract PS from data
            stationid = data.txInfo.id; // Extract station ID from transmission info

            // Check if the frequency has changed
            if (freq !== previousFreq) {
                if (frequencyElement) {
                    freq_save = previousFreq; // Save the previous frequency

                    // Ensure the existingDiv is created or updated
                    const existingDiv = ensureExistingDiv(freq_save);
                    if (freq_save !== null) {
                        existingDiv.style.marginTop = '-7px'; // Adjust the top margin
                        existingDiv.style.position = 'fixed'; // Set the position to fixed
                        existingDiv.style.left = '50%'; // Center horizontally
                        existingDiv.style.top = '50%'; // Center vertically
                        existingDiv.style.transform = 'translate(-50%, -50%)'; // Adjust position back to center
                    }
                    
                    let canSendData = true; // Flag to track if data can be sent

                    // Add a click event listener to the frequency element
                    frequencyElement.addEventListener('click', () => {
                        if (isToggleEnabled && canSendData) { // Check if the toggle functionality is enabled and data can be sent
                            const dataToSend = `T${(parseFloat(freq_save) * 1000).toFixed(0)}`; // Prepare data to send via WebSocket
                            socket.send(dataToSend); // Send the data using the WebSocket
                            debugLog("WebSocket sending:", dataToSend); // Log the sent data
                            canSendData = false; // Set the flag to false to prevent further sends
                        }
                    });

                    // Function to toggle visibility and functionality
                    function toggleFrequencyFunctions() {
                        isToggleEnabled = !isToggleEnabled; // Toggle the state
                        canSendData = true; // Reset the sending flag when toggled
                    }
                } else {
                    console.error('Element with ID "data-frequency" not found.'); // Log error if element is not found
                }

                previousFreq = freq; // Update the previous frequency

                isFirstUpdateAfterChange = true; // Set flag for the first update after frequency change

                // Clear any existing timeout
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }

                // Set a timeout to open or update the iframe
                timeoutId = setTimeout(() => {
                    openOrUpdateIframe(picode, freq, stationid, station, city, distance, ps, itu, pol, radius);
                    isFirstUpdateAfterChange = false; // Reset the update flag
                }, 1000);
            } else if (!isFirstUpdateAfterChange) {
                // If the frequency has not changed, just update the iframe
                openOrUpdateIframe(picode, freq, stationid, station, city, distance, ps, itu, pol, radius);
            }
        } catch (error) {
            console.error("Error processing the message:", error); // Log any errors that occur
        }
    }


    // Function to toggle the visibility of newDivElement and the frequency toggle functionality
    function toggleFrequencyFunctions() {
        const existingDiv = freqContainer.querySelector('.text-small.text-gray'); // Check if the div exists

        if (existingDiv) {
            if (isToggleEnabled) {
                existingDiv.style.display = 'none'; // Hide the previous frequency div
                debugLog("Toggling: hiding existingDiv.");
            } else {
                existingDiv.style.display = ''; // Show the previous frequency div
                debugLog("Toggling: showing existingDiv.");
            }
        } else {
            console.warn("existingDiv is null when toggling.");
        }

        isToggleEnabled = !isToggleEnabled; // Toggle the flag to enable/disable the frequency toggle

        // Save the current toggle state in localStorage
        localStorage.setItem('toggleEnabled', isToggleEnabled); 
        debugLog("Saved toggle state to localStorage:", isToggleEnabled);
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

        // Berechne neue Position
        let newLeft = element.offsetLeft - offsetX;
        let newTop = element.offsetTop - offsetY;

        // Begrenzung innerhalb des Fensters
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        // Überprüfen der Grenzen
        if (newLeft < 0) newLeft = 0;
        if (newTop < 0) newTop = 0;
        if (newLeft + element.offsetWidth > windowWidth) {
            newLeft = windowWidth - element.offsetWidth;
        }
        if (newTop + element.offsetHeight > windowHeight) {
            newTop = windowHeight - element.offsetHeight;
        }

        // Setzen der neuen Position
        element.style.left = newLeft + "px";
        element.style.top = newTop + "px";

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
        resizer.classList.add('tooltip1'); // Klasse hinzufügen
        resizer.setAttribute('data-tooltip', 'Resize Window'); // Daten-Attribut setzen
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

        let isLongPress = false;
        let clickTimeout;

        LiveMapButton.addEventListener('mousedown', (event) => {
            isLongPress = false; // Reset long press state
            clickTimeout = setTimeout(() => {
                isLongPress = true; // Mark as long press
            }, 300); // 300 ms threshold for long press
        });

        LiveMapButton.addEventListener('mouseup', (event) => {
            clearTimeout(clickTimeout); // Clear timeout on mouseup

            // Only toggle if it was a short click
            if (!isLongPress) {
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
                        const storedVisibility = localStorage.getItem('stationListVisible');

                        if (stationListContainer) {
                            if (storedVisibility === 'hidden') {
                                stationListContainer.style.opacity = '0';
                                stationListContainer.style.visibility = 'hidden';
                            } else {
                                stationListContainer.style.opacity = '1';
                                stationListContainer.style.visibility = 'visible';
                                stationListContainer.classList.remove('fade-out');
                                stationListContainer.classList.add('fade-in');
                            }
                        }
                    }, 200);
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

                        if (stationListContainer) {
                            stationListContainer.classList.remove('fade-in');
                            stationListContainer.classList.add('fade-out');
                            stationListContainer.addEventListener('animationend', function handler() {
                                stationListContainer.style.opacity = '0';
                                stationListContainer.style.visibility = 'hidden';
                                stationListContainer.removeEventListener('animationend', handler);
                            });
                        }

                        iframeContainer.classList.add('fade-out');
                        iframeContainer.addEventListener('animationend', function handler() {
                            document.body.removeChild(iframeContainer);
                            iframeContainer = null;
                            iframeContainer.removeEventListener('animationend', handler);
                        });
                    }
                }
            }
        });

        LiveMapButton.addEventListener('mouseleave', () => {
            clearTimeout(clickTimeout); // Clear timeout if the mouse leaves the button
        });

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


