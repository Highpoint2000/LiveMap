////////////////////////////////////////////////////////////
///                                                      /// 
///  LIVEMAP SCRIPT FOR FM-DX-WEBSERVER (V1.0)           /// 
///                                                      /// 
///  by Highpoint                last update: 17.09.24   /// 
///                                                      /// 
///  https://github.com/Highpoint2000/LiveMap            /// 
///                                                      /// 
////////////////////////////////////////////////////////////

// Define iframe size and position as variables
const iframeWidth = 450; // Fixed width size of the iframe
const iframeHeight = 450; // Fixed height size of the iframe
const iframeLeft = 70; // Fixed left position of the iframe
const iframeTop = 120; // Fixed top position of the iframe

(() => {
	
    const plugin_version = 'V1.0';
    let lastPicode = null;
    let lastFreq = null;
    let lastStationId = null;
    let websocket;
    let iframeContainer = null;
    let LiveMapActive = false;
	
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
	}`;
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

    function createIframe() {
        const iframe = document.createElement('iframe');
        iframe.width = iframeWidth + 'px';
        iframe.height = iframeHeight + 'px';
        iframe.style.position = 'fixed';
        iframe.style.left = iframeLeft + 'px';
        iframe.style.top = iframeTop + 'px';
        iframe.style.zIndex = 1000; // Ensure iframe is on top
        iframe.style.border = 'none'; // Remove border for clean look
        return iframe;
    }

    function openOrUpdateIframe(picode, freq, stationid) {
        if (!LiveMapActive) {
            // console.log("Iframe is disabled.");
            return;
        }

        const LAT = localStorage.getItem('qthLatitude') || '0'; // Default value if not set
        const LON = localStorage.getItem('qthLongitude') || '0'; // Default value if not set

        let url;
        if (stationid) {
            url = `https://maps.fmdx.org/#qth=${LAT},${LON}&id=${stationid}&findId=*`;
        } else {
            url = `https://maps.fmdx.org/#qth=${LAT},${LON}&freq=${freq}&findPi=${picode}`;
        }

        // Add a random query parameter to avoid caching issues
        const uniqueUrl = `${url}&t=${new Date().getTime()}`;

        function createAndInsertIframe() {
           

            const newIframe = createIframe();
            newIframe.src = uniqueUrl;

            // Create a temporary container to hold the new iframe
            iframeContainer = document.createElement('div');
            iframeContainer.style.position = 'fixed';
            iframeContainer.style.left = iframeLeft + 'px';
            iframeContainer.style.top = iframeTop + 'px';
            iframeContainer.style.zIndex = 1000; // Ensure iframe is on top
            iframeContainer.style.opacity = '0'; // Start with invisible
            iframeContainer.style.transition = 'opacity 0.5s'; // Smooth transition
            iframeContainer.appendChild(newIframe);
            document.body.appendChild(iframeContainer);

            // Make iframe visible after a short delay
            setTimeout(() => {
                iframeContainer.style.opacity = '1';
            }, 500); // Delay to ensure the iframe starts loading
        }
		
        if  (freq === '0.0' || (picode !== '?' && picode !== lastPicode) || (stationid && stationid !== lastStationId)) {
            createAndInsertIframe(); // Always create and insert the new iframe

            lastPicode = picode;
            lastStationId = stationid;
			lastFreq = freq; // Update last frequency
        }
       
    }

    async function handleWebSocketMessage(event) {
        try {
            const data = JSON.parse(event.data);
            const picode = data.pi;
            const freq = data.freq;
            const itu = data.txInfo.itu;
            const city = data.txInfo.city;
            let stationid;

            if (itu === "POL") {
                stationid = await fetchstationid(freq, picode, city);
            } else {
                stationid = data.txInfo.id;
            }

            openOrUpdateIframe(picode, freq, stationid);

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

                lastPicode = '?'; // Set picode to '?' initially
                lastFreq = '0.0';
                lastStationId = null;
				
                if (iframeContainer) {
                    iframeContainer.style.display = 'block'; // Make iframe visible again
                } else {				
                    openOrUpdateIframe(lastPicode, lastFreq, lastStationId); // Create and insert the iframe
                }

                // console.log("All values (picode, freq, stationid) have been reset.");
            } else {
                LiveMapButton.classList.remove('bg-color-4');
                LiveMapButton.classList.add('bg-color-2');
                console.log("LIVEMAP deactivated.");

				if (iframeContainer) {
					
					const iframes = document.querySelectorAll('iframe');
					iframes.forEach(iframe => {
					iframe.style.opacity = '0'; // Oder benutze iframe.parentNode.removeChild(iframe);
						iframe.style.transition = 'opacity 0.5s'; // Füge eine sanfte Übergangsanimation hinzu
					});
					
					// Füge eine Klasse hinzu, um das Abblenden zu starten
					iframeContainer.classList.add('fade-out');

					// Warte, bis die Abblendanimation abgeschlossen ist
					iframeContainer.addEventListener('animationend', () => {
						document.body.removeChild(iframeContainer);
						iframeContainer = null; // Setze iframeContainer zurück
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
