////////////////////////////////////////////////////////////
///                                                      ///
///  LIVEMAP SCRIPT FOR FM-DX-WEBSERVER (V1.0)           ///
///                                                      ///
///  by Highpoint                last update: 16.09.24   ///
///                                                      ///
///  https://github.com/Highpoint2000/LiveMap            ///
///                                                      ///
///                                                      ///
////////////////////////////////////////////////////////////

// Define popup size and position as variables
const popupWidth = 500; // Fixed width size of the popup
const popupHeight = 500; // Fixed height size of the popup
const popupLeft = 150; // Fixed left position of the popup
const popupTop = 400; // Fixed top position of the popup

(() => {
    const plugin_version = 'V1.0';

    let lastPicode = null;
    let lastFreq = null;
    let lastStationId = null;
    let websocket;
    let popupWindow;
    let LiveMapActive = false;

    async function setupWebSocket() {
        if (!websocket || websocket.readyState === WebSocket.CLOSED) {
            try {
                websocket = await window.socketPromise;

                websocket.addEventListener("open", () => {
                    // WebSocket connected.
                });

                websocket.addEventListener("message", handleWebSocketMessage);

                websocket.addEventListener("error", (error) => {
                    console.error("WebSocket error:", error);
                });

                websocket.addEventListener("close", (event) => {
                    // WebSocket connection closed, retry after 5 seconds
                    setTimeout(setupWebSocket, 5000);
                });

            } catch (error) {
                console.error("Error during WebSocket setup:", error);
            }
        }
    }

    function openOrUpdatePopup(picode, freq, stationid) {
        if (!LiveMapActive) {
            console.log("Popup is disabled.");
            return;
        }

        const LAT = localStorage.getItem('qthLatitude');
        const LON = localStorage.getItem('qthLongitude');

        let url;
        if (stationid) {
            url = `https://maps.fmdx.org/#qth=${LAT},${LON}&id=${stationid}&findId=*`;
        } else {
            url = `https://maps.fmdx.org/#qth=${LAT},${LON}&freq=${freq}&findPi=${picode}`;
        }

        if (freq !== lastFreq && (!stationid || picode !== '?')) {
            if (popupWindow) {
                popupWindow.blur();
                popupWindow.close();
                popupWindow = null;
            }
            lastFreq = freq;

            return;
        } else if (stationid && stationid !== lastStationId || picode !== '?' && picode !== lastPicode) {
            lastStationId = stationid;
            lastPicode = picode;

            // Open or update the popup
            popupWindow = window.open(url, 'popupWindow', `width=${popupWidth},height=${popupHeight},left=${popupLeft},top=${popupTop}`);
            if (popupWindow) {
                try {
                    popupWindow.focus();
                } catch (e) {
                    console.log('Error focusing the popup:', e);
                }
            }

            lastFreq = freq;
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

            openOrUpdatePopup(picode, freq, stationid);

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

                lastPicode = null;
                lastFreq = null;
                lastStationId = null;

                console.log("All values (picode, freq, stationid) have been reset.");
                openOrUpdatePopup(lastPicode, lastFreq, lastStationId);
            } else {
                LiveMapButton.classList.remove('bg-color-4');
                LiveMapButton.classList.add('bg-color-2');
                console.log("LIVEMAP deactivated.");

                if (popupWindow) {
                    popupWindow.blur();
                    popupWindow.close();
                    popupWindow = null;
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
