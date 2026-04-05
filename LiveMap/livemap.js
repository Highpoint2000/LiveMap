/**
 * TX Map Popup — Frontend Plugin
 * Fully standalone, no dependency on other plugins.
 * Works with fm-dx-webserver (any recent version).
 *
 * Fixes & Updates:
 * - Fixed Zoom/Bounds issue on reopen (proper invalidateSize timing)
 * - Flags now render as real images (FlagCDN) to fix Windows Emoji missing support
 * - QTH marker always visible, shows coordinates on mouseover/hover
 * - Comprehensive Console Logging added
 * - Robust ITU extraction and fallback if external list is slow
 */
(function () {
    'use strict';

    // ── Config ────────────────────────────────────────────────────────────────
    const PLUGIN_VERSION = '2.3.0';
    const WIN_ID   = 'txmp-win';
    const MAP_ID   = 'txmp-map';
    const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    const LEAFLET_JS  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    const COUNTRYLIST_JS = 'https://tef.noobish.eu/logos/scripts/js/countryList.js';
    const CORS_PROXY  = 'https://cors-proxy.de:13128/';
    const DB_CACHE_KEY = 'txmp_fmdx_db';
    const DB_DATE_KEY  = 'txmp_fmdx_db_date';

    // ── State ─────────────────────────────────────────────────────────────────
    let leafletLoaded  = false;
    let map            = null;
    let qthMarker      = null;
    let primaryMarker  = null;
    let altMarkers     = [];
    let polylines      = [];
    let resizeObserver = null;

    let qthLat = null;
    let qthLon = null;
    let lastTxInfo  = null;   // raw txInfo from websocket
    let lastItu     = '';     // country_iso/itu from websocket
    let currentFreq = null;
    let currentPi   = null;
    let fmdxDb      = null;   // cached DB: { locations: { id: { lat, lon, stations:[...] } } }

    // Hardcoded fallback for common European FMDX ITUs if external list is missing/slow
    const ITU_FALLBACK = {
        'D':'DE', 'AUT':'AT', 'SUI':'CH', 'F':'FR', 'I':'IT', 'POL':'PL', 'CZE':'CZ',
        'SVK':'SK', 'HNG':'HU', 'SVN':'SI', 'HRV':'HR', 'BEL':'BE', 'NLD':'NL', 'LUX':'LU',
        'DNK':'DK', 'SWE':'SE', 'NOR':'NO', 'FIN':'FI', 'G':'GB', 'IRL':'IE', 'ESP':'ES',
        'POR':'PT', 'GRC':'GR', 'TUR':'TR', 'ROU':'RO', 'BUL':'BG', 'SRB':'RS', 'BIH':'BA',
        'MKD':'MK', 'MNE':'ME', 'ALB':'AL', 'KOS':'XK'
    };

    // ── Load external Country List ────────────────────────────────────────────
    function loadCountryList() {
        if (!document.querySelector(`script[src="${COUNTRYLIST_JS}"]`)) {
            console.log('[TX Map Popup] Loading external countryList.js...');
            const script = document.createElement('script');
            script.src = COUNTRYLIST_JS;
            document.head.appendChild(script);
        }
    }

    // ── Country ISO → Real Image Flag helper ─────────────────────────────────
    function ituToFlagHtml(itu) {
        if (!itu) return '';
        const upperItu = itu.toUpperCase().trim();
        let iso2 = null;

        console.log(`[TX Map Popup] Resolving flag for ITU: "${upperItu}"`);

        // 1. Try lookup using external countryList array
        if (window.countryList && Array.isArray(window.countryList)) {
            const match = window.countryList.find(c => 
                c.itu_code && c.itu_code.toUpperCase() === upperItu
            );
            if (match && match.country_code) {
                iso2 = match.country_code.toUpperCase();
                console.log(`[TX Map Popup] Found ISO2 "${iso2}" via countryList.js`);
            }
        }

        // 2. Try fallback mapping
        if (!iso2 && ITU_FALLBACK[upperItu]) {
            iso2 = ITU_FALLBACK[upperItu];
            console.log(`[TX Map Popup] Found ISO2 "${iso2}" via Fallback Map`);
        }

        // 3. Last Fallback: if itu is already 2-char ISO
        if (!iso2 && upperItu.length === 2) {
            iso2 = upperItu;
            console.log(`[TX Map Popup] Using 2-letter ITU directly as ISO2: "${iso2}"`);
        }
        
        if (!iso2) {
            console.warn(`[TX Map Popup] Could not resolve ISO2 for ITU: "${upperItu}"`);
            return '';
        }

        // Using real image instead of Emoji to fix Windows Emoji-rendering issues!
        const flagUrl = `https://flagcdn.com/16x12/${iso2.toLowerCase()}.png`;
        return `<img src="${flagUrl}" alt="${iso2}" style="vertical-align: middle; margin-right: 5px; margin-bottom: 2px;">`;
    }

    // ── Station name normalisation (same rules as URDS validator) ────────────
    function normalizeStationName(name) {
        if (!name) return '';
        return name
            .replace(/^R\./i, 'Radio ')
            .replace(/^Rdif\./i, 'Radiodiffusion ')
            .trim();
    }

    // ── Styles ────────────────────────────────────────────────────────────────
    function injectStyles() {
        if (document.getElementById('txmp-styles')) return;
        const s = document.createElement('style');
        s.id = 'txmp-styles';
        s.textContent = `
            #${WIN_ID} {
                display: none;
                position: fixed;
                top: 80px;
                left: 30px;
                width: 520px;
                height: 420px;
                z-index: 9999;
                background: var(--color-1, #151a24);
                border: 1px solid var(--color-2, #2a3448);
                border-radius: 10px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                overflow: hidden;
                resize: both;
                min-width: 320px;
                min-height: 260px;
            }
            #txmp-titlebar {
                display: flex;
                align-items: center;
                padding: 0 8px 0 12px;
                background: var(--color-2, #1e2637);
                cursor: move;
                user-select: none;
                border-bottom: 1px solid var(--color-3, #3a4a63);
                height: 36px;
                box-sizing: border-box;
                gap: 8px;
            }
            #txmp-title {
                font-weight: normal; 
                font-size: 13px;
                color: #ffffff;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                flex: 1;
                min-width: 0;
            }
            #txmp-close {
                background: none;
                border: none;
                color: #ffffff;
                font-size: 18px;
                cursor: pointer;
                padding: 0;
                line-height: 1;
                flex-shrink: 0;
                margin-left: auto;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 24px;
                height: 24px;
            }
            #txmp-close:hover { color: #ff5555; }
            #${MAP_ID} {
                width: 100%;
                height: calc(100% - 36px - 28px);
            }
            #txmp-legend {
                display: flex;
                align-items: center;
                gap: 14px;
                padding: 5px 12px;
                background: var(--color-2, #1e2637);
                font-size: 11px;
                color: var(--color-text, #ccc);
                border-top: 1px solid var(--color-3, #3a4a63);
                height: 28px;
                box-sizing: border-box;
                white-space: nowrap;
            }
            .txmp-leg-dot {
                display: inline-block;
                width: 10px; height: 10px;
                border-radius: 50%;
                margin-right: 4px;
                vertical-align: middle;
            }
        `;
        document.head.appendChild(s);
    }

    // ── Window DOM ────────────────────────────────────────────────────────────
    function buildWindow() {
        if (document.getElementById(WIN_ID)) return;

        const win = document.createElement('div');
        win.id = WIN_ID;
        win.innerHTML = `
            <div id="txmp-titlebar">
                <span id="txmp-title">TX Map</span>
                <button id="txmp-close" title="Close">&#10005;</button>
            </div>
            <div id="${MAP_ID}"></div>
            <div id="txmp-legend">
                <span><span class="txmp-leg-dot" style="background:#3399ff;"></span>QTH</span>
                <span><span class="txmp-leg-dot" style="background:#33cc66;"></span>Primary TX</span>
                <span><span class="txmp-leg-dot" style="background:#ff4444;"></span>Alternative TX</span>
            </div>
        `;
        document.body.appendChild(win);

        document.getElementById('txmp-close').addEventListener('click', closeMap);

        // Drag via titlebar
        makeDraggable(win, document.getElementById('txmp-titlebar'));

        // ResizeObserver to invalidate Leaflet size when window is resized manually
        if (window.ResizeObserver) {
            resizeObserver = new ResizeObserver(function () {
                if (map) {
                    setTimeout(function () {
                        map.invalidateSize(true);
                    }, 50);
                }
            });
            resizeObserver.observe(win);
        }
    }

    // ── Draggable ────────────────────────────────────────────────────────────
    function makeDraggable(el, handle) {
        let ox = 0, oy = 0, mx = 0, my = 0;
        handle.addEventListener('mousedown', function (e) {
            // Don't start drag on close button
            if (e.target && e.target.id === 'txmp-close') return;
            e.preventDefault();
            mx = e.clientX; my = e.clientY;
            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', stopDrag);
        });
        function drag(e) {
            ox = mx - e.clientX; oy = my - e.clientY;
            mx = e.clientX; my = e.clientY;
            el.style.top  = Math.max(0, el.offsetTop  - oy) + 'px';
            el.style.left = Math.max(0, el.offsetLeft - ox) + 'px';
        }
        function stopDrag() {
            document.removeEventListener('mousemove', drag);
            document.removeEventListener('mouseup', stopDrag);
        }
    }

    // ── Leaflet loader ────────────────────────────────────────────────────────
    function ensureLeaflet(cb) {
        if (leafletLoaded && window.L) { cb(); return; }
        if (!document.querySelector('link[href*="leaflet"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet'; link.href = LEAFLET_CSS;
            document.head.appendChild(link);
        }
        if (!window.L) {
            console.log('[TX Map Popup] Injecting Leaflet JS...');
            const script = document.createElement('script');
            script.src = LEAFLET_JS;
            script.onload = function () { 
                console.log('[TX Map Popup] Leaflet JS loaded.');
                leafletLoaded = true; 
                cb(); 
            };
            document.head.appendChild(script);
        } else {
            leafletLoaded = true;
            cb();
        }
    }

    // ── Map helpers ───────────────────────────────────────────────────────────
    function circleIcon(color) {
        return window.L.divIcon({
            className: '',
            html: `<svg width="14" height="14" viewBox="0 0 14 14">
                     <circle cx="7" cy="7" r="6" fill="${color}" stroke="#fff" stroke-width="1.5"/>
                   </svg>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
            popupAnchor: [0, -10]
        });
    }

    function clearMap() {
        if (!map) return;
        if (qthMarker)     { map.removeLayer(qthMarker);    qthMarker = null; }
        if (primaryMarker) { map.removeLayer(primaryMarker); primaryMarker = null; }
        altMarkers.forEach(m => map.removeLayer(m));
        altMarkers = [];
        polylines.forEach(p => map.removeLayer(p));
        polylines = [];
    }

    function drawLine(latA, lonA, latB, lonB, color) {
        const line = window.L.polyline([[latA, lonA], [latB, lonB]], {
            color: color,
            weight: 1.5,
            opacity: 0.7,
            dashArray: '5, 4'
        }).addTo(map);
        polylines.push(line);
    }

    // Build popup HTML for a TX entry
    function buildPopupHtml(label, erp, pol, dist, azi) {
        return `<b>${label}</b><br>`
             + `${erp || '?'} kW [${(pol || '?').toUpperCase()}]<br>`
             + `${dist ? Math.round(dist) : '?'} km • ${azi ? Math.round(azi) : '?'}°`;
    }

    function refreshMap(enrichedTxInfo) {
        if (!map || !window.L) return;
        console.log('[TX Map Popup] Redrawing map markers...');

        clearMap();
        const bounds = [];

        // QTH marker - Hover Popup
        if (qthLat !== null && qthLon !== null) {
            qthMarker = window.L.marker([qthLat, qthLon], {
                icon: circleIcon('#3399ff'),
                zIndexOffset: 1000
            }).addTo(map);

            // autoPan: false is important so it doesn't shift the view when hovering
            qthMarker.bindPopup(`<b>QTH</b><br>${qthLat.toFixed(4)}, ${qthLon.toFixed(4)}`, { autoPan: false });
            qthMarker.on('mouseover', function () { this.openPopup(); });
            qthMarker.on('mouseout',  function () { this.closePopup(); });
            
            bounds.push([qthLat, qthLon]);
        }

        // Primary TX
        if (enrichedTxInfo && enrichedTxInfo.lat !== undefined && enrichedTxInfo.lon !== undefined) {
            const popupContent = buildPopupHtml(
                `${enrichedTxInfo.tx || ''} — ${enrichedTxInfo.city || ''} [${enrichedTxInfo.itu || ''}]`,
                enrichedTxInfo.erp,
                enrichedTxInfo.pol,
                enrichedTxInfo.dist,
                enrichedTxInfo.azi
            );
            primaryMarker = window.L.marker([enrichedTxInfo.lat, enrichedTxInfo.lon], {
                icon: circleIcon('#33cc66'),
                zIndexOffset: 900
            }).addTo(map);

            // autoPan: false prevents Leaflet from auto-centering onto the popup
            primaryMarker.bindPopup(popupContent, { autoClose: false, closeOnClick: false, autoPan: false });
            primaryMarker.openPopup();

            bounds.push([enrichedTxInfo.lat, enrichedTxInfo.lon]);
            if (qthLat !== null) drawLine(qthLat, qthLon, enrichedTxInfo.lat, enrichedTxInfo.lon, '#33cc66');
        }

        // Alternative TXes
        if (enrichedTxInfo && Array.isArray(enrichedTxInfo.otherMatches)) {
            enrichedTxInfo.otherMatches.forEach(function (tx) {
                if (tx.lat === undefined || tx.lon === undefined) return;
                const popupContent = buildPopupHtml(
                    `${normalizeStationName(tx.station || '')} — ${tx.name || ''} [${tx.itu || ''}]`,
                    tx.erp,
                    tx.pol,
                    tx.distanceKm,
                    tx.azimuth
                );
                const m = window.L.marker([tx.lat, tx.lon], {
                    icon: circleIcon('#ff4444'),
                    zIndexOffset: 800
                }).addTo(map);

                // Disable autoPan here as well for clean hovering
                m.bindPopup(popupContent, { autoPan: false });
                m.on('mouseover', function () { this.openPopup(); });
                m.on('mouseout',  function () { this.closePopup(); });

                altMarkers.push(m);
                bounds.push([tx.lat, tx.lon]);
                if (qthLat !== null) drawLine(qthLat, qthLon, tx.lat, tx.lon, '#ff4444');
            });
        }

        // Ensure Leaflet has calculated the correct div size first, THEN fit bounds!
        setTimeout(function () {
            map.invalidateSize(true);
            
            // Timeout erhöht von 50ms auf 150ms! 
            // Gibt dem Browser genug Zeit, das Fenster zu rendern, bevor der Zoom berechnet wird.
            setTimeout(function () {
                if (bounds.length > 1) {
                    console.log('[TX Map Popup] Fitting bounds to markers with padding.');
                    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 10 });
                } else if (bounds.length === 1) {
                    map.setView(bounds[0], 7);
                }
            }, 150); 
        }, 50);
    }

    // ── Open / Close map ──────────────────────────────────────────────────────
function openMap() {
        const win = document.getElementById(WIN_ID);
        if (!win) return;
        win.style.display = 'block';
        console.log('[TX Map Popup] Map window opened.');

        ensureLeaflet(function () {
            if (!map) {
                map = window.L.map(MAP_ID, {
                    center: (qthLat !== null) ? [qthLat, qthLon] : [51, 10],
                    zoom: 7,
                    zoomControl: true
                });
                window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                    maxZoom: 18
                }).addTo(map);
            }
            
            // Zwingt Leaflet dazu, die Fenstergröße NACH dem Einblenden exakt zu berechnen,
            // bevor die Koordinaten aufgerufen und zentriert werden.
            setTimeout(function () {
                map.invalidateSize(true);
                
                setTimeout(function () {
                    if (lastTxInfo) {
                        updateTitle(lastTxInfo, lastItu);
                        resolveAndRefresh(lastTxInfo);
                    }
                }, 50);
            }, 100);
        });
    }

    function closeMap() {
        const win = document.getElementById(WIN_ID);
        if (win) {
            win.style.display = 'none';
            console.log('[TX Map Popup] Map window closed.');
        }
    }

    function isMapOpen() {
        const win = document.getElementById(WIN_ID);
        return win && win.style.display !== 'none';
    }

    // ── Title update ──────────────────────────────────────────────────────────
    function updateTitle(txInfo, itu) {
        const titleEl = document.getElementById('txmp-title');
        if (!titleEl) return;
        if (txInfo && txInfo.tx) {
            const flagHtml = ituToFlagHtml(itu || txInfo.itu || '');
            const city = txInfo.city || '';
            const dist = txInfo.dist ? Math.round(txInfo.dist) + ' km' : '';
            const azi  = txInfo.azi  ? Math.round(txInfo.azi)  + '°'  : '';
            
            titleEl.innerHTML =
                `${flagHtml}${txInfo.tx}`
                + (city ? ` • ${city} [${txInfo.itu || ''}]` : '')
                + (dist ? ` • ${dist}` : '')
                + (azi  ? ` • ${azi}`  : '');
        } else {
            titleEl.textContent = 'TX Map';
        }
    }

    // ── Fetch static data (QTH) ───────────────────────────────────────────────
    function fetchStaticData() {
        fetch('./static_data')
            .then(function (r) { return r.json(); })
            .then(function (d) {
                if (d.qthLatitude && d.qthLongitude) {
                    const lat = parseFloat(d.qthLatitude);
                    const lon = parseFloat(d.qthLongitude);
                    if (!isNaN(lat) && !isNaN(lon)) {
                        qthLat = lat;
                        qthLon = lon;
                        console.log(`[TX Map Popup] Initial QTH fetched: ${qthLat}, ${qthLon}`);
                    }
                }
            })
            .catch(function (e) { console.warn('[TX Map Popup] static_data fetch failed:', e); });
    }

    // ── GPS update via data_plugins WebSocket (like livemap.js) ──────────────
    function setupGpsWebSocket() {
        const currentURL = new URL(window.location.href);
        const protocol   = currentURL.protocol === 'https:' ? 'wss:' : 'ws:';
        const port       = currentURL.port || (currentURL.protocol === 'https:' ? '443' : '80');
        const path       = currentURL.pathname.replace(/setup/g, '');
        const wsUrl      = `${protocol}//${currentURL.hostname}:${port}${path}data_plugins`;

        function connect() {
            const ws = new WebSocket(wsUrl);
            ws.addEventListener('message', function (evt) {
                try {
                    const d = JSON.parse(evt.data);
                    if (d.type === 'GPS' && d.value && d.value.status === 'active') {
                        const lat = parseFloat(d.value.lat);
                        const lon = parseFloat(d.value.lon);
                        if (!isNaN(lat) && !isNaN(lon) && (lat !== qthLat || lon !== qthLon)) {
                            qthLat = lat;
                            qthLon = lon;
                            console.log(`[TX Map Popup] GPS QTH updated to: ${qthLat}, ${qthLon}`);
                        }
                    }
                } catch (e) { /* ignore */ }
            });
            ws.addEventListener('close', function () {
                setTimeout(connect, 5000);
            });
        }
        connect();
    }

    // ── FMDX DB fetch (once daily, with CORS proxy) ───────────────────────────
    function loadFmdxDb(callback) {
        const today     = new Date().toISOString().split('T')[0];
        const savedDate = localStorage.getItem(DB_DATE_KEY);
        const savedDb   = localStorage.getItem(DB_CACHE_KEY);

        if (savedDate === today && savedDb) {
            try {
                fmdxDb = JSON.parse(savedDb);
                console.log('[TX Map Popup] FMDX DB loaded from LocalStorage cache.');
                callback(fmdxDb);
                return;
            } catch (e) { /* cache corrupt, refetch */ }
        }

        // We need QTH coords to fetch the DB
        function doFetch() {
            if (qthLat === null || qthLon === null) {
                setTimeout(doFetch, 1000);
                return;
            }
            const apiUrl = `https://maps.fmdx.org/api?qth=${qthLat},${qthLon}`;
            const url    = CORS_PROXY + apiUrl;
            console.log('[TX Map Popup] Fetching fresh FMDX DB via Proxy...');
            fetch(url)
                .then(function (r) {
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    return r.json();
                })
                .then(function (data) {
                    fmdxDb = data;
                    try {
                        localStorage.setItem(DB_CACHE_KEY, JSON.stringify(data));
                        localStorage.setItem(DB_DATE_KEY, today);
                        console.log('[TX Map Popup] FMDX DB fetched and cached to LocalStorage.');
                    } catch (err) {
                        console.warn('[TX Map Popup] LocalStorage Quota Exceeded. FMDX DB will only be kept in memory for this session.');
                    }
                    callback(fmdxDb);
                })
                .catch(function (e) {
                    console.warn('[TX Map Popup] FMDX DB fetch failed:', e);
                    callback(null);
                });
        }
        doFetch();
    }

    // ── Look up coordinates from local FMDX DB ────────────────────────────────
    // Returns { lat, lon } or null
    function coordsFromDb(id) {
        if (!fmdxDb || !fmdxDb.locations) return null;
        const loc = fmdxDb.locations[id];
        if (loc && loc.lat !== undefined) {
            return { lat: parseFloat(loc.lat), lon: parseFloat(loc.lon) };
        }
        // Also iterate (id might be numeric or string)
        const keys = Object.keys(fmdxDb.locations);
        for (let k of keys) {
            const entry = fmdxDb.locations[k];
            if (String(entry.id) === String(id) || String(k) === String(id)) {
                return { lat: parseFloat(entry.lat), lon: parseFloat(entry.lon) };
            }
            // Check stations inside location
            if (entry.stations) {
                for (let st of entry.stations) {
                    if (String(st.id) === String(id)) {
                        return { lat: parseFloat(entry.lat), lon: parseFloat(entry.lon) };
                    }
                }
            }
        }
        return null;
    }

    // ── Enrich txInfo with coordinates from local DB ──────────────────────────
    function resolveAndRefresh(txInfo) {
        if (!txInfo) { refreshMap(null); return; }
        const enriched = JSON.parse(JSON.stringify(txInfo)); // deep copy

        // Primary TX coords
        const primaryCoords = coordsFromDb(enriched.id);
        if (primaryCoords) {
            enriched.lat = primaryCoords.lat;
            enriched.lon = primaryCoords.lon;
        } else {
            console.log(`[TX Map Popup] DB missing coords for Primary ID: ${enriched.id}`);
        }

        // Alt TX coords
        if (Array.isArray(enriched.otherMatches)) {
            enriched.otherMatches.forEach(function (tx) {
                if (tx.lat !== undefined) return; // already have it
                const c = coordsFromDb(tx.id);
                if (c) { tx.lat = c.lat; tx.lon = c.lon; }
            });
        }

        refreshMap(enriched);
    }

    // ── Hook into main WebSocket ───────────────────────────────────────────────
    // We patch handleWebSocketMessage (set by webserver.js / main.js)
    function hookWebSocket() {
        const origHandler = window.handleWebSocketMessage;
        if (typeof origHandler !== 'function') {
            setTimeout(hookWebSocket, 300);
            return;
        }

        console.log('[TX Map Popup] Hooking into WebSocket...');
        window.handleWebSocketMessage = function (event) {
            origHandler(event);
            try {
                const d = JSON.parse(event.data);

                // Extract ITU code dynamically
                if (d.txInfo && d.txInfo.itu) {
                    lastItu = d.txInfo.itu;
                } else if (d.country_iso) {
                    lastItu = d.country_iso;
                }

                // Detect freq / PI change → clear map state
                const freqChanged = d.freq && d.freq !== currentFreq;
                const piChanged   = d.pi   && d.pi   !== currentPi && d.pi !== '?';

                if (freqChanged) currentFreq = d.freq;
                if (piChanged)   currentPi   = d.pi;

                if (d.txInfo) {
                    const ti = d.txInfo;

                    // Only process if we have a real station
                    if (ti.tx && ti.tx.length > 0) {
                        const oldId = lastTxInfo ? lastTxInfo.id : null;
                        const newId = ti.id;

                        const txChanged = (newId !== oldId)
                            || freqChanged
                            || piChanged;

                        if (txChanged) {
                            console.log(`[TX Map Popup] Station changed: ${ti.tx}`);
                            lastTxInfo = JSON.parse(JSON.stringify(ti)); // deep copy

                            if (isMapOpen()) {
                                // Close primary popup before refresh (will reopen after)
                                if (primaryMarker) {
                                    primaryMarker.closePopup();
                                }
                                updateTitle(lastTxInfo, lastItu);
                                resolveAndRefresh(lastTxInfo);
                            }
                        }
                    } else if (freqChanged || piChanged) {
                        // Frequency or PI changed but no TX info yet — clear map
                        lastTxInfo = null;
                        if (isMapOpen()) {
                            clearMap();
                            updateTitle(null, '');
                        }
                    }
                }
            } catch (e) { /* ignore parse errors */ }
        };

        // Also patch the socket's onmessage if it exists
        if (window.socket) {
            window.socket.onmessage = window.handleWebSocketMessage;
        }
    }

    // ── Click handler on station container ────────────────────────────────────
    function setupClickHandler() {
        document.addEventListener('click', function (e) {
            // Ignore clicks on #data-station-others (+N button)
            const othersEl = document.getElementById('data-station-others');
            if (othersEl && (othersEl === e.target || othersEl.contains(e.target))) return;

            // Ignore clicks inside the map window
            const win = document.getElementById(WIN_ID);
            if (win && win.contains(e.target)) return;

            // Click on station container
            const sc = document.getElementById('data-station-container');
            if (sc && (sc === e.target || sc.contains(e.target))) {
                if (!lastTxInfo || !lastTxInfo.tx) return;
                
                console.log('[TX Map Popup] Station container clicked.');
                if (isMapOpen()) {
                    closeMap();
                } else {
                    openMap();
                    updateTitle(lastTxInfo, lastItu);
                    resolveAndRefresh(lastTxInfo);
                }
            }
        });
    }

    // ── Bootstrap ─────────────────────────────────────────────────────────────
    function init() {
        loadCountryList();
        injectStyles();
        buildWindow();
        fetchStaticData();
        setupGpsWebSocket();
        setupClickHandler();

        // Load FMDX DB (once daily), then hook websocket
        loadFmdxDb(function () {
            hookWebSocket();
        });

        console.log(`[TX Map Popup v${PLUGIN_VERSION}] Initialized Successfully.`);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 500);
    }

})();