const activeLayers = {};
const layerCatalog = [];
const layerFeatureCache = {};
const layerLoadState = {};
function emitLayerStateChanged() {
  window.dispatchEvent(new CustomEvent("ares:layers-updated", { detail: { active: Object.keys(activeLayers), status: layerLoadState } }));
}
function safeText(value) {
  return String(value != null ? value : "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function safeClosestTarget(target, selector) {
  if (window.safeClosest) return window.safeClosest(target, selector);
  if (!target || !selector) return null;
  if (typeof target.closest === "function") return target.closest(selector);
  const element = target.nodeType === 1 ? target : target.parentElement;
  return element && typeof element.closest === "function" ? element.closest(selector) : null;
}
function cameraPreviewSrc(camera = {}) {
  const params = new URLSearchParams();
  if (camera.imageUrl) params.set("src", camera.imageUrl);
  if (camera.imageKey) params.set("imageKey", camera.imageKey);
  if (camera.cameraId) params.set("id", camera.cameraId);
  return "/api/reference/fl511-camera-image?".concat(params.toString());
}
function ensureCameraPreviewModal() {
  let modal = document.getElementById("camera-preview-modal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "camera-preview-modal";
  modal.className = "camera-preview-modal hidden";
  modal.innerHTML = '\n    <div class="camera-preview-backdrop" data-camera-close="1"></div>\n    <div class="camera-preview-dialog" role="dialog" aria-modal="true" aria-label="FL511 camera preview">\n      <div class="camera-preview-header">\n        <div>\n          <div class="camera-preview-eyebrow">FL511 Traffic Camera</div>\n          <h3 id="camera-preview-title">Camera Preview</h3>\n          <div id="camera-preview-meta" class="camera-preview-meta"></div>\n        </div>\n        <button type="button" class="camera-preview-close" data-camera-close="1" aria-label="Close camera preview">×</button>\n      </div>\n      <div class="camera-preview-body">\n        <img id="camera-preview-image" alt="FL511 camera feed" />\n      </div>\n      <div class="camera-preview-footer">\n        <div class="camera-preview-note">Live page embeds may be blocked by FL511. This viewer uses the direct camera image instead.</div>\n        <div class="camera-preview-actions">\n          <button type="button" class="button button-secondary" id="camera-preview-refresh">Refresh</button>\n          <a class="button" id="camera-preview-open" target="_blank" rel="noopener noreferrer">Open in FL511</a>\n        </div>\n      </div>\n    </div>\n  ';
  document.body.appendChild(modal);
  modal.addEventListener("click", (event) => {
    if (safeClosestTarget(event.target, '[data-camera-close="1"]')) {
      closeCameraPreviewModal();
    }
  });
  const refreshButton = modal.querySelector("#camera-preview-refresh");
  refreshButton.addEventListener("click", () => {
    const image = modal.querySelector("#camera-preview-image");
    const src = image.getAttribute("data-base-src");
    if (!src) return;
    image.src = "".concat(src).concat(src.includes("?") ? "&" : "?", "_=").concat(Date.now());
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) {
      closeCameraPreviewModal();
    }
  });
  return modal;
}
function openCameraPreviewModal({ title, meta, imageUrl, openUrl }) {
  const modal = ensureCameraPreviewModal();
  const image = modal.querySelector("#camera-preview-image");
  const titleEl = modal.querySelector("#camera-preview-title");
  const metaEl = modal.querySelector("#camera-preview-meta");
  const openLink = modal.querySelector("#camera-preview-open");
  titleEl.textContent = title || "FL511 Camera Preview";
  metaEl.textContent = meta || "";
  const baseSrc = cameraPreviewSrc(imageUrl || {});
  image.setAttribute("data-base-src", baseSrc);
  image.onerror = () => {
    image.onerror = null;
    image.alt = "FL511 camera feed unavailable";
  };
  image.src = "".concat(baseSrc).concat(baseSrc.includes("?") ? "&" : "?", "_=").concat(Date.now());
  openLink.href = openUrl || imageUrl;
  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}
function closeCameraPreviewModal() {
  const modal = document.getElementById("camera-preview-modal");
  if (!modal) return;
  modal.classList.add("hidden");
  document.body.classList.remove("modal-open");
}
function powerSeverity(props = {}) {
  const pct = Number(props.percent_out || 0);
  const cust = Number(props.customers_out || 0);
  if (pct >= 40 || cust >= 25e3) return { level: "critical", label: "Critical" };
  if (pct >= 20 || cust >= 1e4) return { level: "high", label: "High" };
  if (pct >= 8 || cust >= 2500) return { level: "moderate", label: "Moderate" };
  return { level: "low", label: "Low" };
}
function markerGlyph(meta = {}, props = {}) {
  const icon = meta.icon || "";
  const source = String(props.source || "").toLowerCase();
  if (icon === "hospital") return "H";
  if (icon === "fire") return "F";
  if (icon === "shield") return "L";
  if (icon === "home") return "S";
  if (icon === "radio") return "R";
  if (icon === "bridge") return "Br";
  if (icon === "route") return "X";
  if (icon === "building") return "EOC";
  if (icon === "alert") return "!";
  if (icon === "water") return "W";
  if (icon === "camera" || source.includes("camera")) return "CAM";
  if (icon === "message" || source.includes("message board")) return "DMS";
  if (icon === "power" || source.includes("power outage")) {
    const sev = powerSeverity(props).level;
    return sev === "critical" ? "P4" : sev === "high" ? "P3" : sev === "moderate" ? "P2" : "P1";
  }
  return props.station ? "S" : "•";
}
function getMarkerStyle(meta = {}, props = {}) {
  let fill = meta.color || "#19488c";
  let opacity = meta.official ? 0.35 : 0.22;
  let radius = meta.official ? 9 : 7;
  let weight = meta.official ? 3 : 2;
  if ((meta.id || "").includes("noaa_alert")) {
    const sev = String(props.severity || "").toLowerCase();
    fill = sev.includes("extreme") || sev.includes("severe") ? "#b91c1c" : sev.includes("moderate") ? "#d97706" : "#2563eb";
    opacity = 0.35;
  }
  if ((meta.id || "").includes("fl511_traffic_cameras")) {
    fill = "#0f766e";
    opacity = 0.28;
    radius = 10;
    weight = 3;
  }
  if ((meta.id || "").includes("fl511_message_boards")) {
    fill = "#8b5e34";
    opacity = 0.28;
    radius = 10;
    weight = 3;
  }
  if ((meta.id || "").includes("florida_power_outages")) {
    const sev = powerSeverity(props).level;
    fill = sev === "critical" ? "#7f1d1d" : sev === "high" ? "#b91c1c" : sev === "moderate" ? "#d97706" : "#e11d48";
    opacity = sev === "critical" ? 0.38 : sev === "high" ? 0.34 : 0.3;
    radius = sev === "critical" ? 13 : sev === "high" ? 12 : sev === "moderate" ? 11 : 10;
    weight = 3;
  }
  return {
    radius,
    color: fill,
    weight,
    fillColor: fill,
    fillOpacity: opacity
  };
}
function getPolygonStyle(meta = {}, props = {}) {
  let color = meta.color || "#19488c";
  let weight = 2;
  let fillOpacity = 0.1;
  let dashArray = null;
  if ((meta.id || "").includes("flood") || props.source === "FEMA NFHL") {
    color = "#0f766e";
    weight = 3;
    fillOpacity = 0.18;
  }
  if ((meta.id || "").includes("noaa_alert")) {
    const sev = String(props.severity || "").toLowerCase();
    color = sev.includes("extreme") || sev.includes("severe") ? "#b91c1c" : sev.includes("moderate") ? "#d97706" : "#2563eb";
    weight = 3;
    fillOpacity = 0.15;
    dashArray = "6 4";
  }
  return { color, weight, fillColor: color, fillOpacity, dashArray };
}
function buildPopupHtml(feature, meta = {}, fallbackTitle = "Feature") {
  var _a, _b, _c, _d;
  const props = feature.properties || {};
  const title = props.name || props.station || props.callsign || props.title || meta.title || fallbackTitle;
  const isCamera = (meta.id || "").includes("fl511_traffic_cameras");
  const isBoard = (meta.id || "").includes("fl511_message_boards");
  const isPower = (meta.id || "").includes("florida_power_outages");
  let rowsHtml = "";
  if (isCamera) {
    const quickRows = [
      ["Roadway", props.roadway || props.address || ""],
      ["Direction", props.direction || ""],
      ["County", props.county || ""],
      ["Camera ID", props.camera_id || ""],
      ["Last Updated", props.timestamp || ""],
      ["Source", props.source || ""]
    ].filter(([, value]) => value);
    rowsHtml = quickRows.map(([label, value]) => '<div class="popup-row"><strong>'.concat(safeText(label), "</strong><span>").concat(safeText(value), "</span></div>")).join("");
  } else if (isBoard) {
    const boardMessage = [props.message_1, props.message_2].filter(Boolean).join(" / ");
    const quickRows = [
      ["Roadway", props.roadway || props.address || ""],
      ["Direction", props.direction || ""],
      ["Message", boardMessage || "No active text"],
      ["Source", props.source || ""]
    ].filter(([, value]) => value);
    rowsHtml = quickRows.map(([label, value]) => '<div class="popup-row"><strong>'.concat(safeText(label), "</strong><span>").concat(safeText(value), "</span></div>")).join("");
  } else if (isPower) {
    const quickRows = [
      ["County", props.county || ""],
      ["Provider", props.provider || ""],
      ["Customers Out", (_a = props.customers_out) != null ? _a : ""],
      ["Percent Out", (_b = props.percent_out) != null ? _b : ""],
      ["Severity", powerSeverity(props).label],
      ["Outage Type", props.outage_type || ""],
      ["Source", props.source || ""]
    ].filter(([, value]) => value !== "" && value !== null && value !== void 0);
    rowsHtml = quickRows.map(([label, value]) => '<div class="popup-row"><strong>'.concat(safeText(label), "</strong><span>").concat(safeText(value), "</span></div>")).join("");
  } else {
    rowsHtml = Object.entries(props).filter(([key, value]) => value !== null && value !== void 0 && value !== "").slice(0, 14).map(([key, value]) => {
      const label = key.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
      return '<div class="popup-row"><strong>'.concat(safeText(label), "</strong><span>").concat(safeText(value), "</span></div>");
    }).join("");
  }
  let actions = "";
  if (isCamera && (props.camera_direct_image_url || props.camera_image_url)) {
    const previewMeta = [props.roadway, props.direction, props.county].filter(Boolean).join(" • ");
    const previewCamera = {
      imageUrl: props.camera_image_url || props.camera_direct_image_url || "",
      imageKey: props.camera_image_key || "",
      cameraId: props.camera_id || ""
    };
    actions += '<button class="popup-action" type="button" data-camera-preview="'.concat(safeText(JSON.stringify(previewCamera)), '" data-camera-title="').concat(safeText(title), '" data-camera-meta="').concat(safeText(previewMeta), '" data-camera-open="').concat(safeText(props.camera_url || previewCamera.imageUrl || ""), '">View Feed</button>');
  }
  if (isCamera && props.camera_url) {
    actions += '<a class="popup-action popup-action-secondary" href="'.concat(safeText(props.camera_url), '" target="_blank" rel="noopener noreferrer">Open in FL511</a>');
  }
  if ((isCamera || isBoard) && ((_d = (_c = feature.geometry) == null ? void 0 : _c.coordinates) == null ? void 0 : _d.length) >= 2) {
    const [lng, lat] = feature.geometry.coordinates;
    actions += '<a class="popup-action popup-action-secondary" href="https://www.google.com/maps/dir/?api=1&destination='.concat(encodeURIComponent(lat), ",").concat(encodeURIComponent(lng), '" target="_blank" rel="noopener noreferrer">Directions</a>');
  }
  return '<div class="popup-card popup-card-'.concat(isCamera ? "camera" : isBoard ? "board" : isPower ? "power" : "default", '"><div class="popup-title">').concat(safeText(title), '</div><div class="popup-grid">').concat(rowsHtml, "</div>").concat(actions ? '<div class="popup-actions">'.concat(actions, "</div>") : "", "</div>");
}
function getLayerMeta(layerId) {
  return layerCatalog.find((layer) => layer.id === layerId) || {};
}
function isPointOnly(data) {
  const features = Array.isArray(data.features) ? data.features : [];
  return features.length > 0 && features.every((f) => {
    var _a;
    return (((_a = f.geometry) == null ? void 0 : _a.type) || "").includes("Point");
  });
}
function cacheLayerData(layerId, data) {
  layerFeatureCache[layerId] = data;
  try {
    localStorage.setItem("ares-layer-cache:".concat(layerId), JSON.stringify({ savedAt: (/* @__PURE__ */ new Date()).toISOString(), data }));
  } catch (e) {
  }
}
function getCachedLayerData(layerId) {
  if (layerFeatureCache[layerId]) return layerFeatureCache[layerId];
  try {
    const raw = localStorage.getItem("ares-layer-cache:".concat(layerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw).data || null;
    if (parsed) layerFeatureCache[layerId] = parsed;
    return parsed;
  } catch (e) {
    return null;
  }
}
async function fetchLayerWithCache(layerId) {
  try {
    const data = await fetchJSON("/api/layers/".concat(layerId));
    cacheLayerData(layerId, data);
    return data;
  } catch (error) {
    const cached = getCachedLayerData(layerId);
    if (cached) return cached;
    throw error;
  }
}
async function loadLayer(layerId) {
  var _a, _b, _c;
  layerLoadState[layerId] = { status: "loading", error: null, count: (_c = (_b = (_a = layerFeatureCache[layerId]) == null ? void 0 : _a.features) == null ? void 0 : _b.length) != null ? _c : null, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  emitLayerStateChanged();
  const data = await fetchLayerWithCache(layerId);
  const meta = { ...getLayerMeta(layerId), id: layerId };
  if (activeLayers[layerId]) {
    map.removeLayer(activeLayers[layerId]);
  }
  const options = {
    pointToLayer: (feature, latlng) => {
      const marker = L.circleMarker(latlng, getMarkerStyle(meta, feature.properties || {}));
      marker.bindTooltip(markerGlyph(meta, feature.properties || {}), {
        permanent: true,
        direction: "center",
        className: "map-glyph"
      });
      return marker;
    },
    style: (feature) => getPolygonStyle(meta, feature.properties || {}),
    onEachFeature: (feature, layer2) => layer2.bindPopup(buildPopupHtml(feature, meta, layerId))
  };
  const clusterZoom = (meta.id || "").includes("fl511_traffic_cameras") ? 11 : (meta.id || "").includes("fl511_message_boards") ? 12 : 13;
  const layer = isPointOnly(data) ? L.markerClusterGroup({ disableClusteringAtZoom: clusterZoom }).addLayer(L.geoJSON(data, options)) : L.geoJSON(data, options);
  activeLayers[layerId] = layer;
  map.addLayer(layer);
  layerLoadState[layerId] = { status: "loaded", error: null, count: Array.isArray(data.features) ? data.features.length : 0, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  emitLayerStateChanged();
  return layer;
}
function removeLayer(layerId) {
  var _a, _b, _c;
  if (activeLayers[layerId]) {
    map.removeLayer(activeLayers[layerId]);
    delete activeLayers[layerId];
  }
  layerLoadState[layerId] = { status: "hidden", error: null, count: (_c = (_b = (_a = layerFeatureCache[layerId]) == null ? void 0 : _a.features) == null ? void 0 : _b.length) != null ? _c : 0, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  emitLayerStateChanged();
}
function getActiveLayerCount() {
  return Object.keys(activeLayers).length;
}
function zoomToLayer(layerId) {
  const layer = activeLayers[layerId];
  if (!layer) return false;
  try {
    const bounds = layer.getBounds ? layer.getBounds() : null;
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds.pad(0.08));
      return true;
    }
  } catch (e) {
  }
  return false;
}
async function ensureLayerVisible(layerId) {
  if (!activeLayers[layerId]) await loadLayer(layerId);
  return zoomToLayer(layerId);
}
async function fetchLayerSnapshot(layerId) {
  try {
    const data = await fetchLayerWithCache(layerId);
    layerLoadState[layerId] = { status: "loaded", error: null, count: Array.isArray(data == null ? void 0 : data.features) ? data.features.length : 0, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    emitLayerStateChanged();
    return data;
  } catch (error) {
    layerLoadState[layerId] = { status: "error", error: (error == null ? void 0 : error.message) || String(error), count: 0, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    emitLayerStateChanged();
    throw error;
  }
}
document.addEventListener("click", (event) => {
  const trigger = safeClosestTarget(event.target, "[data-camera-preview]");
  if (!trigger) return;
  event.preventDefault();
  openCameraPreviewModal({
    imageUrl: (() => {
      try {
        return JSON.parse(trigger.getAttribute("data-camera-preview") || "{}");
      } catch (e) {
        return { imageUrl: trigger.getAttribute("data-camera-preview") || "" };
      }
    })(),
    title: trigger.getAttribute("data-camera-title") || "FL511 Camera Preview",
    meta: trigger.getAttribute("data-camera-meta") || "",
    openUrl: trigger.getAttribute("data-camera-open") || trigger.getAttribute("data-camera-preview")
  });
});
window.AresLayers = {
  getLayerMeta,
  getLayerDataSnapshot: () => layerFeatureCache,
  getLayerLoadStatus: () => ({ ...layerLoadState }),
  isLayerActive: (layerId) => Boolean(activeLayers[layerId]),
  getActiveLayerCount,
  loadLayer: async (layerId) => {
    try {
      return await loadLayer(layerId);
    } catch (error) {
      layerLoadState[layerId] = { status: "error", error: (error == null ? void 0 : error.message) || String(error), count: 0, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      emitLayerStateChanged();
      throw error;
    }
  },
  removeLayer,
  zoomToLayer,
  ensureLayerVisible,
  fetchLayerSnapshot,
  getCatalog: () => layerCatalog.slice()
};
