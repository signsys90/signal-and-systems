(function() {
  const BROWSER_GPS_BAUD = 9600;
  const FIX_STALE_MS = 3e4;
  const SHARE_SEND_MS = 1e4;
  const SHARE_ID_KEY = "ares-gps-share-id";
  const SHARE_CALLSIGN_KEY = "ares-gps-share-callsign";
  const state = {
    marker: null,
    latest: null,
    serverLatest: null,
    browserLatest: null,
    browserPort: null,
    browserReader: null,
    browserReading: false,
    browserConnecting: false,
    browserLineBuffer: "",
    browserSentenceCount: 0,
    browserFixCount: 0,
    browserLastError: null,
    share: {
      enabled: false,
      id: null,
      callsign: "",
      timer: null,
      lastSentAt: null,
      lastError: null
    },
    timer: null
  };
  function escapeHtml(value) {
    return window.escapeHtml ? window.escapeHtml(value) : String(value != null ? value : "");
  }
  function formatCoord(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(6) : "-";
  }
  function formatSpeed(value) {
    const number = Number(value);
    return Number.isFinite(number) ? "".concat(number.toFixed(1), " mph") : "-";
  }
  function formatTime(value) {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleTimeString();
    } catch (_) {
      return value;
    }
  }
  function nowIso() {
    return (/* @__PURE__ */ new Date()).toISOString();
  }
  function storageGet(key) {
    try {
      return window.localStorage.getItem(key) || "";
    } catch (_) {
      return "";
    }
  }
  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, String(value || ""));
    } catch (_) {
    }
  }
  function normalizeShareCallsign(value) {
    return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9/_-]+/g, "").slice(0, 24);
  }
  function ensureShareId() {
    var _a;
    if (state.share.id) return state.share.id;
    const stored = storageGet(SHARE_ID_KEY).trim();
    if (stored) {
      state.share.id = stored;
      return stored;
    }
    const id = ((_a = window.crypto) == null ? void 0 : _a.randomUUID) ? window.crypto.randomUUID() : "browser-".concat(Date.now(), "-").concat(Math.random().toString(36).slice(2, 10));
    state.share.id = id;
    storageSet(SHARE_ID_KEY, id);
    return id;
  }
  function getShareCallsign() {
    if (state.share.callsign) return state.share.callsign;
    state.share.callsign = normalizeShareCallsign(storageGet(SHARE_CALLSIGN_KEY));
    return state.share.callsign;
  }
  function notify(message, type = "info") {
    if (window.showOpsToast) window.showOpsToast(message, type);
    else if (type === "error") window.alert(message);
  }
  function browserSerialSupported() {
    return Boolean(navigator.serial && window.isSecureContext);
  }
  function parseCoordinate(raw, hemisphere) {
    const value = String(raw || "").trim();
    if (!value) return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    const dot = value.indexOf(".");
    const degreeLength = dot > 4 ? dot - 2 : ["E", "W"].includes(String(hemisphere).toUpperCase()) ? 3 : 2;
    const degrees = Number(value.slice(0, degreeLength));
    const minutes = Number(value.slice(degreeLength));
    if (!Number.isFinite(degrees) || !Number.isFinite(minutes)) return null;
    let result = degrees + minutes / 60;
    if (["S", "W"].includes(String(hemisphere).toUpperCase())) result *= -1;
    return result;
  }
  function parseNmeaTime(timeValue, dateValue) {
    const time = String(timeValue || "").trim();
    if (time.length < 6) return nowIso();
    const hours = Number(time.slice(0, 2));
    const minutes = Number(time.slice(2, 4));
    const seconds = Number(time.slice(4, 6));
    const milliseconds = time.includes(".") ? Math.round(Number("0.".concat(time.split(".")[1])) * 1e3) : 0;
    if (![hours, minutes, seconds, milliseconds].every(Number.isFinite)) return nowIso();
    const date = String(dateValue || "").trim();
    let year;
    let month;
    let day;
    if (date.length >= 6) {
      day = Number(date.slice(0, 2));
      month = Number(date.slice(2, 4)) - 1;
      const twoDigitYear = Number(date.slice(4, 6));
      year = twoDigitYear >= 80 ? 1900 + twoDigitYear : 2e3 + twoDigitYear;
    } else {
      const now = /* @__PURE__ */ new Date();
      year = now.getUTCFullYear();
      month = now.getUTCMonth();
      day = now.getUTCDate();
    }
    const parsed = new Date(Date.UTC(year, month, day, hours, minutes, seconds, milliseconds));
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : nowIso();
  }
  function verifyChecksum(sentence) {
    const star = sentence.indexOf("*");
    if (star < 0) return true;
    const expected = sentence.slice(star + 1).trim().slice(0, 2).toUpperCase();
    if (!/^[0-9A-F]{2}$/.test(expected)) return false;
    const body = sentence.slice(1, star);
    let checksum = 0;
    for (const char of body) checksum ^= char.charCodeAt(0);
    return checksum.toString(16).toUpperCase().padStart(2, "0") === expected;
  }
  function normalizeSentence(sentence) {
    const cleaned = String(sentence || "").trim();
    const nmeaStart = cleaned.indexOf("$");
    if (nmeaStart < 0) return null;
    const nmea = cleaned.slice(nmeaStart);
    if (!verifyChecksum(nmea)) return null;
    return nmea.split("*")[0].slice(1).split(",");
  }
  function positionIsFresh(status = {}) {
    if (!status.lastFixAt) return false;
    const age = Date.now() - new Date(status.lastFixAt).getTime();
    return Number.isFinite(age) && age <= FIX_STALE_MS;
  }
  function browserStatus(overrides = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    const previous = state.browserLatest || {};
    const lastFixAt = (_b = (_a = overrides.lastFixAt) != null ? _a : previous.lastFixAt) != null ? _b : null;
    const fixStale = !lastFixAt || !positionIsFresh({ lastFixAt });
    return {
      enabled: true,
      configured: true,
      connected: Boolean(state.browserReading),
      connecting: Boolean(state.browserConnecting),
      browserMode: true,
      browserSerialSupported: browserSerialSupported(),
      needsPermission: !state.browserReading && !state.browserPort,
      port: "Browser GPS",
      baudRate: BROWSER_GPS_BAUD,
      reconnectMs: null,
      startedAt: (_d = (_c = overrides.startedAt) != null ? _c : previous.startedAt) != null ? _d : nowIso(),
      lastSentenceAt: (_f = (_e = overrides.lastSentenceAt) != null ? _e : previous.lastSentenceAt) != null ? _f : null,
      lastFixAt,
      lastFixAgeMs: lastFixAt ? Math.max(0, Date.now() - new Date(lastFixAt).getTime()) : null,
      fixStale,
      lastError: state.browserLastError,
      sentenceCount: state.browserSentenceCount,
      fixCount: state.browserFixCount,
      lastSentenceType: (_h = (_g = overrides.lastSentenceType) != null ? _g : previous.lastSentenceType) != null ? _h : null,
      position: (_j = (_i = overrides.position) != null ? _i : previous.position) != null ? _j : null
    };
  }
  function effectiveStatus(serverStatus = state.serverLatest || {}) {
    if (state.browserLatest && (state.browserReading || state.browserLatest.position || state.browserLastError)) {
      return browserStatus();
    }
    if (serverStatus.enabled || serverStatus.position || serverStatus.connected || serverStatus.connecting || serverStatus.lastError) {
      return serverStatus;
    }
    if (browserSerialSupported()) {
      return {
        enabled: true,
        configured: true,
        connected: false,
        connecting: false,
        browserMode: true,
        browserSerialSupported: true,
        needsPermission: true,
        port: "Browser GPS",
        baudRate: BROWSER_GPS_BAUD,
        fixStale: true,
        lastError: null,
        position: null
      };
    }
    return serverStatus;
  }
  function statusLabel(status = {}) {
    var _a;
    if (status.needsPermission) return "Click My GPS";
    if (status.browserMode && !status.browserSerialSupported) return "Unsupported";
    if (!status.enabled) return "Off";
    if (status.lastError && !status.connected) return "Port error";
    if (((_a = status.position) == null ? void 0 : _a.fixValid) && !status.fixStale) return "Fix";
    if (status.connected) return "No fix";
    if (status.connecting) return "Connecting";
    return "Waiting";
  }
  function statusClass(status = {}) {
    var _a;
    if (status.needsPermission) return "is-idle";
    if (status.browserMode && !status.browserSerialSupported) return "is-error";
    if (!status.enabled) return "is-off";
    if (status.lastError && !status.connected) return "is-error";
    if (((_a = status.position) == null ? void 0 : _a.fixValid) && !status.fixStale) return "is-live";
    if (status.connected || status.connecting) return "is-waiting";
    return "is-idle";
  }
  function hasFocusablePosition(status = {}) {
    var _a;
    return Boolean(((_a = status.position) == null ? void 0 : _a.fixValid) && Number.isFinite(Number(status.position.lat)) && Number.isFinite(Number(status.position.lng)));
  }
  function hasShareablePosition(status = state.latest || {}) {
    if (!hasFocusablePosition(status)) return false;
    if (status.fixStale === true) return false;
    if (status.lastFixAt && !positionIsFresh(status)) return false;
    return true;
  }
  function updateShareButton(status = state.latest || {}) {
    const button = document.getElementById("command-share-gps");
    if (!button) return;
    const canShare = hasShareablePosition(status);
    button.disabled = !(state.share.enabled || canShare);
    button.classList.toggle("is-sharing", Boolean(state.share.enabled));
    button.textContent = state.share.enabled ? "Sharing GPS" : "Share GPS";
    button.title = state.share.enabled ? canShare ? "Sharing ".concat(getShareCallsign() || "GPS", " with logged-in dashboard users. Click to stop.") : "Sharing is on and will resume when the GPS has a fresh fix. Click to stop." : canShare ? "Share this GPS fix with logged-in dashboard users." : "Connect GPS and wait for a fresh fix before sharing.";
  }
  function updateChip(status = {}) {
    const chip = document.getElementById("gps-status-chip");
    const label = document.getElementById("gps-status-label");
    const button = document.getElementById("command-focus-gps");
    const canStartBrowser = browserSerialSupported() && !state.browserReading && !state.browserConnecting;
    const canFocus = hasFocusablePosition(status);
    if (chip) {
      chip.classList.remove("is-live", "is-waiting", "is-error", "is-idle", "is-off");
      chip.classList.add(statusClass(status));
      chip.title = status.lastError ? "".concat(status.port || "GPS", ": ").concat(status.lastError) : status.needsPermission ? "Click My GPS and choose the laptop GPS serial port." : "".concat(status.port || "GPS", " @ ").concat(status.baudRate || BROWSER_GPS_BAUD);
    }
    if (label) label.textContent = statusLabel(status);
    if (button) {
      button.disabled = !(canFocus || canStartBrowser);
      button.textContent = canFocus ? "My GPS" : canStartBrowser ? "Connect GPS" : "My GPS";
      button.title = canFocus ? "Center the map on your GPS position." : canStartBrowser ? "Connect to the laptop GPS serial port." : "Waiting for a valid GPS fix.";
    }
    updateShareButton(status);
  }
  function popupHtml(status = {}) {
    var _a, _b, _c;
    const position = status.position || {};
    return '\n      <div class="gps-popup popup-card popup-card-default">\n        <div class="popup-title">Laptop GPS</div>\n        <div class="popup-subtitle">'.concat(escapeHtml(status.port || "COM5"), " @ ").concat(escapeHtml(String(status.baudRate || BROWSER_GPS_BAUD)), ' baud</div>\n        <div class="popup-grid">\n          <div class="popup-row"><strong>Status</strong><span>').concat(escapeHtml(statusLabel(status)), '</span></div>\n          <div class="popup-row"><strong>Latitude</strong><span>').concat(escapeHtml(formatCoord(position.lat)), '</span></div>\n          <div class="popup-row"><strong>Longitude</strong><span>').concat(escapeHtml(formatCoord(position.lng)), '</span></div>\n          <div class="popup-row"><strong>Satellites</strong><span>').concat(escapeHtml((_a = position.satellites) != null ? _a : "-"), '</span></div>\n          <div class="popup-row"><strong>HDOP</strong><span>').concat(escapeHtml((_b = position.hdop) != null ? _b : "-"), '</span></div>\n          <div class="popup-row"><strong>Speed</strong><span>').concat(escapeHtml(formatSpeed(position.speedMph)), '</span></div>\n          <div class="popup-row"><strong>Course</strong><span>').concat(escapeHtml((_c = position.courseDegrees) != null ? _c : "-"), '</span></div>\n          <div class="popup-row"><strong>Updated</strong><span>').concat(escapeHtml(formatTime(position.receivedAt || status.lastFixAt)), "</span></div>\n        </div>\n        ").concat(status.lastError ? '<div class="popup-note">'.concat(escapeHtml(status.lastError), "</div>") : "", "\n      </div>");
  }
  function markerIcon(status = {}) {
    return L.divIcon({
      className: "gps-div-icon",
      html: '<div class="gps-marker '.concat(status.fixStale ? "is-stale" : "is-live", '"><span></span></div>'),
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -12]
    });
  }
  function updateMarker(status = {}) {
    if (!window.map || !window.L) return;
    const position = status.position;
    if (!(position == null ? void 0 : position.fixValid) || !Number.isFinite(Number(position.lat)) || !Number.isFinite(Number(position.lng))) {
      if (state.marker) {
        try {
          window.map.removeLayer(state.marker);
        } catch (_) {
        }
        state.marker = null;
      }
      return;
    }
    const latlng = [Number(position.lat), Number(position.lng)];
    if (!state.marker) {
      state.marker = L.marker(latlng, {
        icon: markerIcon(status),
        zIndexOffset: 850
      }).addTo(window.map);
    } else {
      state.marker.setLatLng(latlng);
      state.marker.setIcon(markerIcon(status));
    }
    state.marker.bindPopup(popupHtml(status));
  }
  function publishStatus(status) {
    state.latest = status;
    updateChip(status);
    updateMarker(status);
    if (state.share.enabled) {
      sendShare().catch((error) => {
        state.share.lastError = error.message || String(error);
        updateShareButton(status);
      });
    }
    window.dispatchEvent(new CustomEvent("ares:gps-updated", { detail: status }));
    return status;
  }
  function updateBrowserStatus(overrides = {}) {
    state.browserLatest = browserStatus(overrides);
    return publishStatus(state.browserLatest);
  }
  function updateBrowserPosition(update) {
    var _a, _b;
    const previous = ((_a = state.browserLatest) == null ? void 0 : _a.position) || {};
    const position = {
      ...previous,
      ...update,
      source: "browser-serial-nmea",
      port: "Browser GPS",
      baudRate: BROWSER_GPS_BAUD,
      receivedAt: nowIso()
    };
    position.fixValid = Number.isFinite(Number(position.lat)) && Number.isFinite(Number(position.lng)) && position.fixValid !== false;
    position.statusLabel = position.fixValid ? "Fix acquired" : "No valid fix";
    if (position.fixValid) state.browserFixCount += 1;
    updateBrowserStatus({
      lastFixAt: position.fixValid ? position.timestamp || position.receivedAt : ((_b = state.browserLatest) == null ? void 0 : _b.lastFixAt) || null,
      position
    });
  }
  function sharePayload(status = state.latest || {}) {
    if (!hasShareablePosition(status)) return null;
    const position = status.position || {};
    return {
      shareId: ensureShareId(),
      callsign: getShareCallsign(),
      lat: Number(position.lat),
      lng: Number(position.lng),
      timestamp: position.timestamp || position.receivedAt || status.lastFixAt || nowIso(),
      accuracyMeters: position.accuracyMeters,
      altitudeMeters: position.altitudeMeters,
      speedMph: position.speedMph,
      courseDegrees: position.courseDegrees,
      satellites: position.satellites,
      hdop: position.hdop,
      note: "Shared from browser GPS"
    };
  }
  async function sendShare(force = false) {
    if (!state.share.enabled) return null;
    const callsign = getShareCallsign();
    if (!callsign) return null;
    const now = Date.now();
    if (!force && state.share.lastSentAt && now - state.share.lastSentAt < SHARE_SEND_MS - 1e3) return null;
    const payload = sharePayload();
    if (!payload) {
      updateShareButton();
      return null;
    }
    const result = await fetchJSON("/api/gps/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    state.share.lastSentAt = now;
    state.share.lastError = null;
    updateShareButton();
    return result;
  }
  function startShareTimer() {
    if (state.share.timer) window.clearInterval(state.share.timer);
    state.share.timer = window.setInterval(() => {
      sendShare().catch((error) => {
        state.share.lastError = error.message || String(error);
        updateShareButton();
        console.warn("GPS share update failed", error);
      });
    }, SHARE_SEND_MS);
  }
  async function startSharing() {
    if (!hasShareablePosition()) {
      notify("Connect GPS and wait for a fresh fix before sharing.", "error");
      updateShareButton();
      return false;
    }
    const existing = getShareCallsign();
    const entered = window.prompt("Callsign to show on the shared map", existing);
    const callsign = normalizeShareCallsign(entered);
    if (!callsign) return false;
    state.share.callsign = callsign;
    storageSet(SHARE_CALLSIGN_KEY, callsign);
    ensureShareId();
    state.share.enabled = true;
    startShareTimer();
    updateShareButton();
    await sendShare(true);
    notify("Sharing GPS as ".concat(callsign, "."), "success");
    return true;
  }
  async function stopSharing() {
    state.share.enabled = false;
    if (state.share.timer) window.clearInterval(state.share.timer);
    state.share.timer = null;
    const id = ensureShareId();
    updateShareButton();
    try {
      await fetchJSON("/api/gps/share/".concat(encodeURIComponent(id)), { method: "DELETE" });
      notify("GPS sharing stopped.", "info");
    } catch (error) {
      state.share.lastError = error.message || String(error);
      notify("GPS sharing is off locally. The shared map marker will expire shortly.", "error");
    }
    return true;
  }
  async function toggleSharing() {
    return state.share.enabled ? stopSharing() : startSharing();
  }
  function parseRmc(parts) {
    const status = parts[2];
    updateBrowserPosition({
      sentenceType: parts[0],
      timestamp: parseNmeaTime(parts[1], parts[9]),
      fixStatus: status || "",
      fixValid: status === "A",
      lat: parseCoordinate(parts[3], parts[4]),
      lng: parseCoordinate(parts[5], parts[6]),
      speedKnots: Number.isFinite(Number(parts[7])) ? Number(parts[7]) : null,
      speedMph: Number.isFinite(Number(parts[7])) ? Number(parts[7]) * 1.15078 : null,
      courseDegrees: Number.isFinite(Number(parts[8])) ? Number(parts[8]) : null
    });
  }
  function parseGga(parts) {
    const fixQuality = Number(parts[6]);
    updateBrowserPosition({
      sentenceType: parts[0],
      timestamp: parseNmeaTime(parts[1]),
      fixQuality: Number.isFinite(fixQuality) ? fixQuality : 0,
      fixValid: Number.isFinite(fixQuality) && fixQuality > 0,
      lat: parseCoordinate(parts[2], parts[3]),
      lng: parseCoordinate(parts[4], parts[5]),
      satellites: Number.isFinite(Number(parts[7])) ? Number(parts[7]) : null,
      hdop: Number.isFinite(Number(parts[8])) ? Number(parts[8]) : null,
      altitudeMeters: Number.isFinite(Number(parts[9])) ? Number(parts[9]) : null
    });
  }
  function parseGll(parts) {
    const status = parts[6];
    updateBrowserPosition({
      sentenceType: parts[0],
      timestamp: parseNmeaTime(parts[5]),
      fixStatus: status || "",
      fixValid: status === "A",
      lat: parseCoordinate(parts[1], parts[2]),
      lng: parseCoordinate(parts[3], parts[4])
    });
  }
  function handleBrowserSentence(sentence) {
    const parts = normalizeSentence(sentence);
    if (!parts || !parts[0]) return;
    state.browserSentenceCount += 1;
    const lastSentenceAt = nowIso();
    const lastSentenceType = parts[0];
    updateBrowserStatus({ lastSentenceAt, lastSentenceType });
    const family = parts[0].slice(-3).toUpperCase();
    if (family === "RMC") parseRmc(parts);
    else if (family === "GGA") parseGga(parts);
    else if (family === "GLL") parseGll(parts);
  }
  function handleBrowserChunk(chunk) {
    const text = typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk, { stream: true });
    state.browserLineBuffer += text;
    if (state.browserLineBuffer.length > 8192) state.browserLineBuffer = state.browserLineBuffer.slice(-8192);
    const lines = state.browserLineBuffer.split(/\r?\n/);
    state.browserLineBuffer = lines.pop() || "";
    lines.forEach(handleBrowserSentence);
  }
  async function closeBrowserSerial() {
    var _a, _b, _c, _d, _e, _f;
    state.browserReading = false;
    state.browserConnecting = false;
    try {
      await ((_b = (_a = state.browserReader) == null ? void 0 : _a.cancel) == null ? void 0 : _b.call(_a));
    } catch (_) {
    }
    try {
      (_d = (_c = state.browserReader) == null ? void 0 : _c.releaseLock) == null ? void 0 : _d.call(_c);
    } catch (_) {
    }
    state.browserReader = null;
    try {
      await ((_f = (_e = state.browserPort) == null ? void 0 : _e.close) == null ? void 0 : _f.call(_e));
    } catch (_) {
    }
    state.browserPort = null;
  }
  async function openBrowserPort(port) {
    var _a;
    state.browserConnecting = true;
    state.browserLastError = null;
    updateBrowserStatus();
    await port.open({
      baudRate: BROWSER_GPS_BAUD,
      dataBits: 8,
      stopBits: 1,
      parity: "none",
      flowControl: "none"
    });
    try {
      await ((_a = port.setSignals) == null ? void 0 : _a.call(port, { dataTerminalReady: true, requestToSend: true }));
    } catch (_) {
    }
    state.browserPort = port;
    state.browserReading = true;
    state.browserConnecting = false;
    state.browserLineBuffer = "";
    updateBrowserStatus({ startedAt: nowIso() });
    const reader = port.readable.getReader();
    state.browserReader = reader;
    try {
      while (state.browserReading) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) handleBrowserChunk(value);
      }
    } finally {
      try {
        reader.releaseLock();
      } catch (_) {
      }
      if (state.browserReader === reader) state.browserReader = null;
    }
  }
  async function connectBrowserSerial(options = {}) {
    if (!browserSerialSupported()) {
      state.browserLastError = window.isSecureContext ? "This browser does not support serial GPS access. Use Chrome or Edge on the laptop." : "Serial GPS access requires HTTPS or localhost.";
      updateBrowserStatus();
      return state.browserLatest;
    }
    if (state.browserReading || state.browserConnecting) return state.browserLatest;
    try {
      const knownPorts = options.preferKnown ? await navigator.serial.getPorts() : [];
      const port = knownPorts[0] || await navigator.serial.requestPort();
      await openBrowserPort(port);
    } catch (error) {
      await closeBrowserSerial();
      state.browserLastError = (error == null ? void 0 : error.name) === "NotFoundError" ? "GPS connection was cancelled." : error.message || String(error);
      updateBrowserStatus();
    }
    return state.browserLatest;
  }
  async function tryReconnectKnownBrowserPort() {
    if (!browserSerialSupported() || state.browserReading || state.browserConnecting) return null;
    try {
      const ports = await navigator.serial.getPorts();
      if (!ports.length) return null;
      return connectBrowserSerial({ preferKnown: true });
    } catch (_) {
      return null;
    }
  }
  function focusGps() {
    var _a;
    const position = (_a = state.latest) == null ? void 0 : _a.position;
    if (!window.map || !(position == null ? void 0 : position.fixValid) || !Number.isFinite(Number(position.lat)) || !Number.isFinite(Number(position.lng))) return false;
    const latlng = [Number(position.lat), Number(position.lng)];
    window.map.setView(latlng, Math.max(window.map.getZoom(), 15), { animate: true });
    if (state.marker) state.marker.openPopup();
    return true;
  }
  async function handleGpsButton() {
    if (focusGps()) return true;
    await connectBrowserSerial();
    return focusGps();
  }
  async function refresh() {
    try {
      const status = await fetchJSON("/api/gps/status");
      state.serverLatest = status;
      return publishStatus(effectiveStatus(status));
    } catch (error) {
      const fallback = {
        enabled: true,
        connected: false,
        lastError: error.message || String(error),
        position: null
      };
      state.serverLatest = fallback;
      return publishStatus(effectiveStatus(fallback));
    }
  }
  function start() {
    var _a, _b, _c, _d;
    (_a = document.getElementById("command-focus-gps")) == null ? void 0 : _a.addEventListener("click", () => {
      handleGpsButton().catch((error) => {
        state.browserLastError = error.message || String(error);
        updateBrowserStatus();
      });
    });
    (_b = document.getElementById("command-share-gps")) == null ? void 0 : _b.addEventListener("click", () => {
      toggleSharing().catch((error) => {
        state.share.lastError = error.message || String(error);
        updateShareButton();
        notify(state.share.lastError, "error");
      });
    });
    (_d = (_c = navigator.serial) == null ? void 0 : _c.addEventListener) == null ? void 0 : _d.call(_c, "disconnect", (event) => {
      if (event.target !== state.browserPort) return;
      closeBrowserSerial().finally(() => {
        state.browserLastError = "GPS serial port disconnected.";
        updateBrowserStatus();
      });
    });
    refresh().then(() => tryReconnectKnownBrowserPort()).catch(() => void 0);
    state.timer = window.setInterval(refresh, 2500);
  }
  window.AresGps = {
    refresh,
    focus: focusGps,
    connect: connectBrowserSerial,
    disconnect: closeBrowserSerial,
    share: startSharing,
    stopSharing,
    toggleSharing,
    sendShare,
    getLatest: () => state.latest
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
