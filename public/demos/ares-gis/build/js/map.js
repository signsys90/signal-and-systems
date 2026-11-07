const leafletLib = typeof window !== "undefined" ? window.L : null;
const map = leafletLib && typeof leafletLib.map === "function" ? leafletLib.map("map", { zoomControl: false }) : null;
window.map = map;
window.AresMapBootstrapError = leafletLib ? null : "Leaflet library failed to initialize";
let duvalBounds = null;
let locateMarker = null;
let searchMarker = null;
let pointPickState = null;
let pointPickMarker = null;
let baseTileLayer = null;
let baseTileOverlay = null;
let baseTileFallbackTimer = null;
let baseTileRequestId = 0;
let incidentFocusLayer = null;
let focusedMarker = null;
const BASEMAP_CONFIG = {
  day: [
    {
      provider: "osm-day",
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: "&copy; OpenStreetMap contributors",
      subdomains: "abc",
      opacity: 1
    }
  ],
  dark: [
    {
      provider: "esri-dark",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      overlayUrl: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      attribution: "Tiles &copy; Esri",
      maxNativeZoom: 16,
      opacity: 1
    },
    {
      provider: "osm-dark-fallback",
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: "&copy; OpenStreetMap contributors",
      subdomains: "abc",
      opacity: 1
    }
  ]
};
function getOpenDrawerPadding() {
  const top = 132;
  const bottom = 24;
  const leftDrawer = document.getElementById("command-operator-drawer");
  const rightDrawer = document.getElementById("command-diagnostics-drawer");
  const dispatchDrawer = document.getElementById("command-dispatch-drawer");
  const left = (leftDrawer == null ? void 0 : leftDrawer.classList.contains("is-open")) ? Math.max(24, Math.round(leftDrawer.getBoundingClientRect().width) + 36) : 24;
  const rightCandidates = [rightDrawer, dispatchDrawer].filter(Boolean);
  const rightOpen = rightCandidates.find((el) => el.classList.contains("is-open"));
  const right = rightOpen ? Math.max(24, Math.round(rightOpen.getBoundingClientRect().width) + 36) : 24;
  return { left, right, top, bottom };
}
function escapeHtml(value) {
  return String(value != null ? value : "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function buildPointPickPopup(latlng, state = {}) {
  if (typeof state.popupHtml === "function") {
    try {
      const html = state.popupHtml(latlng, state);
      if (html) return html;
    } catch (_) {
    }
  }
  if (typeof state.popupHtml === "string" && state.popupHtml.trim()) return state.popupHtml;
  const details = state.details && typeof state.details === "object" ? state.details : null;
  if (details) {
    const rows = [];
    const push = (label, value) => {
      if (value === void 0 || value === null) return;
      const cleaned = String(value).trim();
      if (!cleaned) return;
      rows.push('<div style="margin-top:4px;"><strong>'.concat(escapeHtml(label), ":</strong> ").concat(escapeHtml(cleaned), "</div>"));
    };
    const heading2 = details.heading || details.title || "Operator Location";
    push("Callsign", details.callsign);
    push("Name", details.name);
    push("Status", details.status);
    push("ICS Role", details.role || details.icsRole);
    push("Assignment", details.assignment);
    push("Capabilities", details.capabilities);
    push("Location", details.location);
    push("Latitude", Number(latlng.lat).toFixed(6));
    push("Longitude", Number(latlng.lng).toFixed(6));
    return "<div><strong>".concat(escapeHtml(heading2), "</strong>").concat(rows.join(""), "</div>");
  }
  const heading = state.label || "Selected point";
  return "".concat(escapeHtml(heading), '<br><span style="font-size:12px;color:#64748b;">').concat(Number(latlng.lat).toFixed(6), ", ").concat(Number(latlng.lng).toFixed(6), "</span>");
}
function refreshMapSize(options = {}) {
  if (!window.map) return;
  const { pan = false, delay = 0 } = options;
  const run = () => {
    try {
      window.map.invalidateSize({ pan, debounceMoveend: true });
    } catch (_) {
      try {
        window.map.invalidateSize(pan);
      } catch (_2) {
      }
    }
  };
  if (delay > 0) {
    window.setTimeout(() => requestAnimationFrame(run), delay);
  } else {
    requestAnimationFrame(run);
  }
}
function installMapResizeStabilizers() {
  const mapEl = document.getElementById("map");
  const shellEl = document.getElementById("map-shell");
  if (!mapEl || !window.map) return;
  let resizeRefreshTimer = null;
  let lastSignature = "";
  function currentSignature() {
    const mapWidth = mapEl.clientWidth || 0;
    const mapHeight = mapEl.clientHeight || 0;
    const shellWidth = (shellEl == null ? void 0 : shellEl.clientWidth) || 0;
    const shellHeight = (shellEl == null ? void 0 : shellEl.clientHeight) || 0;
    return "".concat(mapWidth, "x").concat(mapHeight, ":").concat(shellWidth, "x").concat(shellHeight);
  }
  function scheduleRefresh(delay = 40) {
    const signature = currentSignature();
    if (signature === lastSignature) return;
    lastSignature = signature;
    if (resizeRefreshTimer) window.clearTimeout(resizeRefreshTimer);
    resizeRefreshTimer = window.setTimeout(() => {
      resizeRefreshTimer = null;
      refreshMapSize();
    }, delay);
  }
  lastSignature = currentSignature();
  if ("ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(() => scheduleRefresh(50));
    resizeObserver.observe(mapEl);
    if (shellEl) resizeObserver.observe(shellEl);
  }
  window.addEventListener("resize", () => scheduleRefresh(40), { passive: true });
  window.addEventListener("orientationchange", () => scheduleRefresh(140), { passive: true });
  window.addEventListener("pageshow", () => scheduleRefresh(80), { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleRefresh(60);
  });
}
function clearPointPickMarker() {
  if (!map) return;
  if (pointPickMarker) {
    map.removeLayer(pointPickMarker);
    pointPickMarker = null;
  }
}
function updateMapPickUi(active = false, label = "Click map to select location") {
  var _a;
  const shell = document.getElementById("map-shell");
  const existing = document.getElementById("map-pick-banner");
  if (!active) {
    if (shell) shell.classList.remove("map-pick-active");
    if (existing) existing.remove();
    return;
  }
  if (shell) shell.classList.add("map-pick-active");
  let banner = existing;
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "map-pick-banner";
    banner.className = "map-pick-banner";
    shell == null ? void 0 : shell.appendChild(banner);
  }
  banner.innerHTML = "<strong>Map Mark Mode</strong><span>".concat(label, '</span><button type="button" id="map-pick-cancel" class="button button-ghost button-small">Cancel</button>');
  (_a = banner.querySelector("#map-pick-cancel")) == null ? void 0 : _a.addEventListener("click", () => cancelPointPick());
}
function beginPointPick(options = {}) {
  cancelPointPick({ silent: true });
  pointPickState = {
    label: options.label || "Click map to select location",
    details: options.details || null,
    popupHtml: options.popupHtml || null,
    onPick: typeof options.onPick === "function" ? options.onPick : null,
    onCancel: typeof options.onCancel === "function" ? options.onCancel : null
  };
  updateMapPickUi(true, pointPickState.label);
  window.dispatchEvent(new CustomEvent("ares:map-pick-started", { detail: { label: pointPickState.label } }));
}
function cancelPointPick(options = {}) {
  const { silent = false } = options;
  const current = pointPickState;
  pointPickState = null;
  updateMapPickUi(false);
  clearPointPickMarker();
  window.dispatchEvent(new CustomEvent("ares:map-pick-cancelled"));
  if (!silent && (current == null ? void 0 : current.onCancel)) current.onCancel();
}
function buildLegend(items) {
  const legend = document.getElementById("map-legend");
  legend.innerHTML = "";
  items.forEach((item) => {
    const chip = document.createElement("div");
    chip.className = "legend-chip";
    chip.innerHTML = '<span class="legend-dot" style="background:'.concat(item.color, '"></span><span>').concat(item.label, "</span>");
    legend.appendChild(chip);
  });
}
function normalizedThemeMode(mode = "day") {
  return String(mode).toLowerCase() === "night" || String(mode).toLowerCase() === "dark" ? "dark" : "day";
}
function getBasemapConfig(mode = "day", index = 0) {
  const variants = BASEMAP_CONFIG[normalizedThemeMode(mode)] || BASEMAP_CONFIG.day;
  return variants[Math.max(0, Math.min(index, variants.length - 1))];
}
function applyBasemapDataset(mode, config = {}) {
  var _a;
  const mapEl = (_a = map == null ? void 0 : map.getContainer) == null ? void 0 : _a.call(map);
  if (!mapEl) return;
  mapEl.dataset.basemapMode = normalizedThemeMode(mode);
  mapEl.dataset.basemapProvider = config.provider || "unknown";
}
function clearBasemapLayer() {
  if (baseTileFallbackTimer) {
    clearTimeout(baseTileFallbackTimer);
    baseTileFallbackTimer = null;
  }
  if (baseTileLayer) {
    try {
      baseTileLayer.off();
    } catch (_) {
    }
    try {
      map.removeLayer(baseTileLayer);
    } catch (_) {
    }
    baseTileLayer = null;
  }
  if (baseTileOverlay) {
    try {
      map.removeLayer(baseTileOverlay);
    } catch (_) {
    }
    baseTileOverlay = null;
  }
}
function setBaseMapTheme(mode = "day", variantIndex = 0) {
  var _a;
  if (!map || !window.L) return;
  if (map._animatingZoom) {
    map.once("zoomend", () => setBaseMapTheme(mode, variantIndex));
    return;
  }
  const requestId = ++baseTileRequestId;
  const resolvedMode = normalizedThemeMode(mode);
  const config = getBasemapConfig(resolvedMode, variantIndex);
  const variants = BASEMAP_CONFIG[resolvedMode] || [];
  clearBasemapLayer();
  applyBasemapDataset(resolvedMode, config);
  let loaded = false;
  let tileErrors = 0;
  baseTileLayer = L.tileLayer(config.url, {
    maxZoom: 19,
    maxNativeZoom: config.maxNativeZoom || 19,
    attribution: config.attribution,
    subdomains: config.subdomains || "abc",
    crossOrigin: true,
    updateWhenIdle: true,
    keepBuffer: 4,
    opacity: (_a = config.opacity) != null ? _a : 1
  });
  const tileLayer = baseTileLayer;
  function isCurrentLayer() {
    return requestId === baseTileRequestId && tileLayer === baseTileLayer;
  }
  tileLayer.on("load", () => {
    if (!isCurrentLayer()) return;
    loaded = true;
    if (baseTileFallbackTimer) {
      clearTimeout(baseTileFallbackTimer);
      baseTileFallbackTimer = null;
    }
    refreshMapSize({ delay: 20 });
    window.setTimeout(() => refreshMapSize({ delay: 0 }), 180);
  });
  tileLayer.on("tileerror", () => {
    if (!isCurrentLayer()) return;
    tileErrors += 1;
    const hasFallback = variantIndex + 1 < variants.length;
    if (!loaded && hasFallback && tileErrors >= 4) {
      setBaseMapTheme(resolvedMode, variantIndex + 1);
      return;
    }
    refreshMapSize({ delay: 60 });
  });
  if (variantIndex + 1 < variants.length) {
    baseTileFallbackTimer = window.setTimeout(() => {
      if (!loaded && isCurrentLayer()) setBaseMapTheme(resolvedMode, variantIndex + 1);
    }, 4500);
  }
  tileLayer.addTo(map);
  if (config.overlayUrl) {
    baseTileOverlay = L.tileLayer(config.overlayUrl, {
      maxZoom: 19,
      maxNativeZoom: config.maxNativeZoom || 19,
      crossOrigin: true,
      updateWhenIdle: true,
      keepBuffer: 4
    }).addTo(map);
  }
}
function clearIncidentFocus() {
  if (!map) return;
  if (incidentFocusLayer) {
    try {
      map.removeLayer(incidentFocusLayer);
    } catch (_) {
    }
  }
  incidentFocusLayer = null;
}
function focusMarkerByLatLng(lat, lng, popupHtml = "") {
  if (!map || !window.L) return;
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return;
  const ll = [Number(lat), Number(lng)];
  if (focusedMarker) {
    try {
      map.removeLayer(focusedMarker);
    } catch (_) {
    }
  }
  focusedMarker = L.circleMarker(ll, { radius: 11, color: "#f59e0b", weight: 3, fillColor: "#f59e0b", fillOpacity: 0.18 }).addTo(map);
  if (popupHtml) focusedMarker.bindPopup(popupHtml).openPopup();
  map.setView(ll, Math.max(map.getZoom(), 13), { animate: true });
}
function buildDetailedOpsPopup(record = {}, kind = "record") {
  var _a;
  const rows = [];
  const push = (label, value) => {
    if (value === void 0 || value === null || value === "") return;
    rows.push('<div class="popup-row"><strong>'.concat(escapeHtml(label), "</strong><span>").concat(escapeHtml(String(value)), "</span></div>"));
  };
  const heading = record.title || record.callsign || record.name || record.id || "Record";
  if (kind === "operator") {
    push("Callsign", record.callsign);
    push("Name", record.name);
    push("Role", record.role ? String(record.role).replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()) : "");
    push("Status", record.status);
    push("Assignment", record.assignment || record.assignedIncidentTitle || record.assignedIncidentId);
    push("Capabilities", Array.isArray(record.capabilities) ? record.capabilities.join(", ") : record.capabilities);
    push("Primary Source", ((_a = record.tracking) == null ? void 0 : _a.bestSource) || record.sourceSummary);
    push("Last Check-In", record.lastCheckIn);
    push("Check-In Source", record.lastCheckInSource);
    push("Check-In Note", record.lastCheckInNote);
    push("APRS Callsign", record.aprsCallsign);
    push("Meshtastic Node", record.meshtasticNodeId);
    push("DMR ID", record.dmrId);
    push("Aliases", Array.isArray(record.aliases) ? record.aliases.join(", ") : record.aliases);
  } else if (kind === "incident") {
    push("Type", record.type);
    push("Priority", record.priority);
    push("Status", record.status);
    push("Assigned Operator", record.assignedOperator || record.assignment);
    push("Location", record.location);
    push("Radius", record.radiusMiles || record.radius);
    push("Notes", record.notes);
    push("Updated", record.updatedAt || record.createdAt);
  } else if (kind === "task") {
    push("Priority", record.priority);
    push("Status", record.status);
    push("Assigned To", record.assignedTo);
    push("Incident", record.incidentTitle || record.incidentId);
    push("Location", record.location);
    push("Due", record.due);
    push("Notes", record.notes);
    push("Updated", record.updatedAt || record.createdAt);
  }
  if (Number.isFinite(Number(record.lat)) && Number.isFinite(Number(record.lng))) {
    push("Latitude", Number(record.lat).toFixed(6));
    push("Longitude", Number(record.lng).toFixed(6));
  }
  return '<div class="popup-card popup-card-default"><div class="popup-title">'.concat(escapeHtml(heading), '</div><div class="popup-grid">').concat(rows.join(""), "</div></div>");
}
function focusIncident(record = {}) {
  if (!map || !window.L) return;
  const lat = Number(record.lat);
  const lng = Number(record.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  clearIncidentFocus();
  const radiusMeters = (() => {
    const miles = Number(record.radiusMiles || record.radius || record.distanceMiles || 0);
    if (Number.isFinite(miles) && miles > 0) return miles * 1609.34;
    return 804.67;
  })();
  incidentFocusLayer = L.layerGroup().addTo(map);
  const marker = L.circleMarker([lat, lng], { radius: 10, color: "#ef4444", weight: 3, fillColor: "#ef4444", fillOpacity: 0.2 }).addTo(incidentFocusLayer);
  const ring = L.circle([lat, lng], { radius: radiusMeters, color: "#f59e0b", weight: 2, fillColor: "#f59e0b", fillOpacity: 0.06, className: "incident-radius-ring" }).addTo(incidentFocusLayer);
  marker.bindTooltip(record.title || record.name || "Incident", { permanent: false, direction: "top" });
  marker.bindPopup(buildDetailedOpsPopup(record, "incident")).openPopup();
  const bounds = ring.getBounds();
  const pad = getOpenDrawerPadding();
  map.fitBounds(bounds.pad(0.28), { paddingTopLeft: [pad.left, pad.top], paddingBottomRight: [pad.right, pad.bottom], animate: true });
}
function focusSelectedRecord(detail = {}) {
  var _a, _b;
  const kind = detail.kind;
  const record = detail.record;
  if (!kind || !record) return;
  if (kind === "incident") {
    focusIncident(record);
    return;
  }
  if (!Number.isFinite(Number(record.lat)) || !Number.isFinite(Number(record.lng))) return;
  if (kind === "operator") {
    if ((_b = (_a = window.AresTracking) == null ? void 0 : _a.focusById) == null ? void 0 : _b.call(_a, record.id || record.callsign)) return;
    focusMarkerByLatLng(record.lat, record.lng, buildDetailedOpsPopup(record, "operator"));
    return;
  }
  if (kind === "task") {
    focusMarkerByLatLng(record.lat, record.lng, buildDetailedOpsPopup(record, "task"));
  }
}
async function initMap() {
  var _a, _b;
  if (!map || !window.L) {
    throw new Error(window.AresMapBootstrapError || "Leaflet library failed to initialize");
  }
  const config = await fetchJSON("/api/config");
  map.setView([config.map.lat, config.map.lng], config.map.zoom);
  L.control.zoom({ position: "topright" }).addTo(map);
  setBaseMapTheme(((_b = (_a = window.AresTheme) == null ? void 0 : _a.getMode) == null ? void 0 : _b.call(_a)) || "day");
  const bounds = config.bounds || { xmin: -82.05, ymin: 30.05, xmax: -81.25, ymax: 30.62 };
  duvalBounds = L.latLngBounds(
    [bounds.ymin, bounds.xmin],
    [bounds.ymax, bounds.xmax]
  );
  buildLegend([
    { label: "Fire / Rescue", color: "#ef6c00" },
    { label: "Hospitals", color: "#c62828" },
    { label: "Shelters", color: "#2e7d32" },
    { label: "Law Enforcement", color: "#3949ab" },
    { label: "ARES / Radio", color: "#7b1fa2" },
    { label: "Flood / Weather", color: "#00838f" }
  ]);
  installMapResizeStabilizers();
  refreshMapSize({ delay: 80 });
  window.setTimeout(() => refreshMapSize({ delay: 0 }), 250);
  window.setTimeout(() => refreshMapSize({ delay: 0 }), 1e3);
}
function fitDuval() {
  if (map && duvalBounds) {
    const pad = getOpenDrawerPadding();
    map.fitBounds(duvalBounds, { paddingTopLeft: [pad.left, pad.top], paddingBottomRight: [pad.right, pad.bottom], animate: true });
  }
}
function locateMe() {
  if (!map) return;
  map.locate({ setView: true, maxZoom: 13, enableHighAccuracy: true });
}
function openDirections(lat, lng, label = "Destination") {
  window.open("https://www.google.com/maps/dir/?api=1&destination=".concat(lat, ",").concat(lng, "&destination_place_id=").concat(encodeURIComponent(label)), "_blank", "noopener");
}
function openDirectionsToAddress(address, label = "Destination") {
  window.open("https://www.google.com/maps/dir/?api=1&destination=".concat(encodeURIComponent(address)), "_blank", "noopener");
}
async function zoomToAddress(address, label = "Location") {
  if (!map || !window.L) return;
  const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=".concat(encodeURIComponent(address));
  try {
    const response = await fetch(url, {
      headers: { "Accept": "application/json" }
    });
    const data = await response.json();
    const first = Array.isArray(data) ? data[0] : null;
    if (first) {
      const lat = Number(first.lat);
      const lon = Number(first.lon);
      if (searchMarker) map.removeLayer(searchMarker);
      searchMarker = L.circleMarker([lat, lon], {
        radius: 9,
        color: "#ef6c00",
        weight: 3,
        fillColor: "#ef6c00",
        fillOpacity: 0.18
      }).addTo(map).bindPopup("".concat(label, '<br><span style="font-size:12px;color:#64748b;">').concat(address, "</span>")).openPopup();
      map.setView([lat, lon], 15);
      return;
    }
  } catch (error) {
    console.warn("Address geocode failed", error);
  }
  window.open("https://www.google.com/maps/search/?api=1&query=".concat(encodeURIComponent(address)), "_blank", "noopener");
}
if (map && window.L) {
  map.on("click", (event) => {
    if (!pointPickState) return;
    try {
      L.DomEvent.stop(event.originalEvent);
    } catch (_) {
    }
    try {
      map.closePopup();
    } catch (_) {
    }
    clearPointPickMarker();
    pointPickMarker = L.circleMarker(event.latlng, {
      radius: 10,
      color: "#ef6c00",
      weight: 3,
      fillColor: "#ef6c00",
      fillOpacity: 0.22
    }).addTo(map).bindPopup(buildPointPickPopup(event.latlng, pointPickState)).openPopup();
    const callback = pointPickState.onPick;
    pointPickState = null;
    updateMapPickUi(false);
    window.dispatchEvent(new CustomEvent("ares:map-pick-ended", { detail: { lat: event.latlng.lat, lng: event.latlng.lng } }));
    window.setTimeout(() => {
      if (callback) callback({ lat: event.latlng.lat, lng: event.latlng.lng });
    }, 0);
  });
  map.on("locationfound", (event) => {
    if (locateMarker) map.removeLayer(locateMarker);
    locateMarker = L.circleMarker(event.latlng, {
      radius: 8,
      color: "#19488c",
      weight: 2,
      fillColor: "#19488c",
      fillOpacity: 0.25
    }).addTo(map).bindPopup("Your current location").openPopup();
  });
}
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && pointPickState) cancelPointPick();
});
window.addEventListener("ares:focus-incident", (event) => {
  if (event.detail) focusIncident(event.detail);
});
window.addEventListener("ares:focus-coordinates", (event) => {
  const d = event.detail || {};
  focusMarkerByLatLng(d.lat, d.lng, d.popupHtml || "");
});
window.addEventListener("ares:selected-record", (event) => {
  focusSelectedRecord(event.detail || {});
});
window.AresMap = { fitDuval, locateMe, openDirections, openDirectionsToAddress, zoomToAddress, refreshSize: refreshMapSize, beginPointPick, cancelPointPick, setBaseMapTheme, focusIncident, clearIncidentFocus, focusMarkerByLatLng, getOpenDrawerPadding, ready: Boolean(map && window.L) };
window.addEventListener("ares:theme-changed", (event) => {
  var _a;
  setBaseMapTheme(((_a = event == null ? void 0 : event.detail) == null ? void 0 : _a.mode) || "day");
  refreshMapSize({ delay: 120 });
});
