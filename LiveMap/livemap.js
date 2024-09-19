////////////////////////////////////////////////////////////
///                                                      /// 
///  LIVEMAP SCRIPT FOR FM-DX-WEBSERVER (V1.2a)          /// 
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
    const plugin_version = 'V1.2';
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
        iframe.width = iframeWidth + 'px';
        iframe.height = (iframeHeight) + 'px'; // Adjust height to make space for header
        iframe.style.border = 'none'; // Remove border for a clean look
        iframe.style.position = 'relative'; // Relative positioning for the header
		iframe.style.paddingTop = '30px'; // Füge Padding oben hinzu
        return iframe;
    }

    function createIframeHeader(picode, freq, stationid, station, city, distance, ps, itu) {
        const header = document.createElement('div');
        header.style.backgroundColor = 'bg-color-2';
        header.style.color = 'white';
        header.style.padding = '10px';
        header.style.position = 'absolute';
        header.style.top = '0';
        header.style.left = '0';
        header.style.width = '100%';
        header.style.zIndex = '1'; // Make sure it appears above other elements
        // header.innerHTML = `${freq} MHz | ${picode} | ${station} from ${city} [${distance} km]`;
        return header;
    }
	
	function openOrUpdateIframe(picode, freq, stationid, station, city, distance, ps, itu) {
		
        if (!LiveMapActive) {
            return;
        }

        const LAT = localStorage.getItem('qthLatitude') || '0'; // Default value if not set
        const LON = localStorage.getItem('qthLongitude') || '0'; // Default value if not set

        let url;

        if (stationid) {
            url = `https://maps.fmdx.org/#qth=${LAT},${LON}&id=${stationid}&findId=*`;
        } else if (picode !== '?') {
            url = `https://maps.fmdx.org/#qth=${LAT},${LON}&freq=${freq}&findPi=${picode}`;
        } else {
            url = `https://maps.fmdx.org/#lat=${LAT}&lon=${LON}&r=150`;
        }

        const uniqueUrl = `${url}&t=${new Date().getTime()}`;

function createAndInsertIframe() {
    const newIframe = createIframe();
    const header = createIframeHeader(picode, freq, stationid, station, city, distance, ps, itu); // Create the header
    const closeButton = createCloseButton(); // Create the close button
    newIframe.src = uniqueUrl;

    // Create or show the iframeContainer at the last position
    if (!iframeContainer) {
        iframeContainer = document.createElement('div');
        iframeContainer.id = 'movableDiv';
        iframeContainer.classList.add('bg-color-2');
        iframeContainer.style.width = (iframeWidth + 20) + 'px'; // Account for 10px border
        iframeContainer.style.height = (iframeHeight + 20) + 'px'; // Account for 10px border
        iframeContainer.style.left = iframeLeft + 'px';
        iframeContainer.style.top = iframeTop + 'px';
        iframeContainer.style.position = 'fixed';
        iframeContainer.style.opacity = '0'; // Start invisible
        iframeContainer.style.transition = 'opacity 0.5s'; // Smooth transition
        iframeContainer.appendChild(header); // Add the header to the container
        iframeContainer.appendChild(closeButton); // Add the close button
        iframeContainer.appendChild(newIframe);
        document.body.appendChild(iframeContainer);
        addDragFunctionality(iframeContainer);
        addResizeFunctionality(iframeContainer); // Add resize functionality
        iframeContainer.style.opacity = '1'; // Fade in the container
        newIframe.style.visibility = 'visible'; // Make the iframe visible
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

        // Remove old iframes after the new iframe is visible
        const existingIframes = iframeContainer.querySelectorAll('iframe:not(:last-child)');
        existingIframes.forEach(iframe => {
            iframe.parentNode.removeChild(iframe);
        });
    }
}

        if (freq === '0.0' || (picode !== '?' && picode !== lastPicode) || (stationid && stationid !== lastStationId)) {
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
			const station = data.txInfo.tx;
			const distance = data.txInfo.dist;
			const ps = data.ps;
            let stationid;

            if (itu === "POL") {
                stationid = await fetchstationid(freq, picode, city);
            } else {
                stationid = data.txInfo.id;
            }

            openOrUpdateIframe(picode, freq, stationid, station, city, distance, ps, itu);

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
            // Check if the click is not on the resize element
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
            // Save the new position
            localStorage.setItem('iframeLeft', element.style.left);
            localStorage.setItem('iframeTop', element.style.top);
            document.onmousemove = null;
            document.onmouseup = null;
        }
    }

    function addResizeFunctionality(element) {
        const resizer = document.createElement('div');
        resizer.id = 'resizer'; // Add ID for the resize element
        resizer.style.width = '10px';
        resizer.style.height = '10px';
        resizer.style.background = 'blue'; // Color for visibility
        resizer.style.cursor = 'nwse-resize';
        resizer.style.position = 'absolute';
        resizer.style.right = '0';
        resizer.style.bottom = '0';
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
            if (newWidth > 100 && newHeight > 100) { // Minimum size
                element.style.width = newWidth + 'px';
                element.style.height = newHeight + 'px';
                const iframe = element.querySelector('iframe');
                if (iframe) {
                    iframe.width = (newWidth - 20) + 'px'; // Adjust for border
                    iframe.height = (newHeight - 20) + 'px'; // Adjust for border
                }
            }
        }

        function stopResize() {
            const newWidth = parseInt(element.style.width);
            const newHeight = parseInt(element.style.height);
            localStorage.setItem('iframeWidth', newWidth); // Save new width
            localStorage.setItem('iframeHeight', newHeight); // Save new height
            iframeWidth = newWidth - 20; // Update width variable for iframe
            iframeHeight = newHeight - 20; // Update height variable for iframe
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

                lastPicode = '?'; // Set picode to '?' initially
                lastFreq = '0.0';
                lastStationId = null;

                // Create or show the iframeContainer at the last position
                if (!iframeContainer) {
                    openOrUpdateIframe(lastPicode, lastFreq, lastStationId); // Create and insert the iframe
                } else {
                    iframeContainer.style.display = 'block'; // Make iframe visible again
                    iframeContainer.style.left = iframeLeft + 'px'; // Restore last left position
                    iframeContainer.style.top = iframeTop + 'px'; // Restore last top position
                    iframeContainer.style.width = (iframeWidth + 20) + 'px'; // Restore last width
                    iframeContainer.style.height = (iframeHeight + 20) + 'px'; // Restore last height
                }
            } else {
                LiveMapButton.classList.remove('bg-color-4');
                LiveMapButton.classList.add('bg-color-2');
                console.log("LIVEMAP deactivated.");

                if (iframeContainer) {
                    // Save the position before removing
                    iframeLeft = parseInt(iframeContainer.style.left);
                    iframeTop = parseInt(iframeContainer.style.top);
                    localStorage.setItem('iframeLeft', iframeLeft);
                    localStorage.setItem('iframeTop', iframeTop);

                    const iframes = document.querySelectorAll('iframe');
                    iframes.forEach(iframe => {
                        iframe.style.opacity = '0'; // Or use iframe.parentNode.removeChild(iframe);
                        iframe.style.transition = 'opacity 0.5s'; // Add a smooth transition animation
                    });

                    iframeContainer.classList.add('fade-out');

                    iframeContainer.addEventListener('animationend', () => {
                        document.body.removeChild(iframeContainer);
                        iframeContainer = null; // Reset iframeContainer
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
