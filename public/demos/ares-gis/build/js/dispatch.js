(function() {
  const state = { layer: null };
  function ensureLayer() {
    if (!window.map) return null;
    if (!state.layer) state.layer = L.geoJSON([], {
      style: () => ({ color: "#ef6c00", weight: 2, opacity: 0.9, dashArray: "6 6" }),
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};
        layer.bindPopup("<strong>".concat(window.escapeHtml ? window.escapeHtml(p.callsign || "Operator") : p.callsign || "Operator", "</strong><br>").concat(window.escapeHtml ? window.escapeHtml(p.incidentTitle || "Assigned incident") : p.incidentTitle || "Assigned incident"));
      }
    }).addTo(window.map);
    return state.layer;
  }
  async function refresh() {
    try {
      const geojson = await fetchJSON("/api/dispatch/assignments.geojson");
      const layer = ensureLayer();
      if (!layer) return;
      layer.clearLayers();
      if (geojson && Array.isArray(geojson.features) && geojson.features.length) layer.addData(geojson);
    } catch (error) {
      console.warn("Dispatch overlay refresh failed", error);
    }
  }
  window.AresDispatch = { refresh };
  window.addEventListener("load", () => window.setTimeout(refresh, 800));
})();
