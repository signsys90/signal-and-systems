(function() {
  const state = { markers: /* @__PURE__ */ new Map(), layer: null, timer: null, sourceFilter: "all", latestFeatures: [], latestDiagnostics: null };
  function ensureLayer() {
    if (!window.map) return null;
    if (!state.layer) {
      state.layer = L.layerGroup().addTo(window.map);
    }
    return state.layer;
  }
  function providerBadge(provider) {
    if (!provider.enabled) return "Disabled";
    if (!provider.configured) return "Needs config";
    if (provider.connected || provider.count > 0) return "".concat(provider.count || 0, " record(s)");
    return provider.lastError ? "Error" : "Idle";
  }
  function providerLabel(key) {
    if (key === "gpsShare") return "GPS Share";
    return String(key || "").toUpperCase();
  }
  function sourceClass(source) {
    const normalized = String(source || "manual").toLowerCase().replace(/[_\s]+/g, "-");
    return ["aprs", "meshtastic", "dmr", "gps-share", "manual"].includes(normalized) ? normalized : "manual";
  }
  function sourceDisplay(source) {
    const key = sourceClass(source);
    if (key === "gps-share") return "GPS";
    return String(source || key).replace(/[-_]+/g, " ").toUpperCase();
  }
  function titleCase(value) {
    return String(value || "").replace(/_/g, " ").split(" ").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  }
  function capabilityList(value) {
    if (Array.isArray(value)) return value.filter(Boolean).join(", ");
    return String(value || "").trim();
  }
  function sourceBadge(label) {
    const key = sourceClass(label);
    const text = sourceDisplay(label || key);
    return '<span class="command-source-badge source-'.concat(key, '">').concat(window.escapeHtml(text), "</span>");
  }
  function sourceLabels(feature) {
    var _a, _b;
    const sources = Array.isArray((_a = feature == null ? void 0 : feature.properties) == null ? void 0 : _a.sources) ? feature.properties.sources : [];
    if (!sources.length) return [String(((_b = feature == null ? void 0 : feature.properties) == null ? void 0 : _b.bestSource) || "manual").toUpperCase()];
    return sources;
  }
  function popupRow(label, value) {
    if (value === void 0 || value === null) return "";
    const cleaned = String(value).trim();
    if (!cleaned) return "";
    return '<div class="popup-row"><strong>'.concat(window.escapeHtml(label), "</strong><span>").concat(window.escapeHtml(cleaned), "</span></div>");
  }
  function operatorPopupHtml(feature) {
    const p = (feature == null ? void 0 : feature.properties) || {};
    const badges = sourceLabels(feature).map((label) => sourceBadge(label)).join("");
    const capabilities = capabilityList(p.capabilities);
    const subtitle = [p.name, p.assignment || p.assignedIncidentTitle || "unassigned"].filter(Boolean).join(" - ");
    const rows = [
      popupRow("Name", p.name),
      popupRow("Role", titleCase(p.role || "unassigned")),
      popupRow("Status", titleCase(p.status || "monitoring")),
      popupRow("Assignment", p.assignedIncidentTitle || p.assignment || "unassigned"),
      popupRow("Primary Source", sourceDisplay(p.bestSource || "manual")),
      popupRow("Confidence", p.confidenceLabel || "Low"),
      popupRow("Last Seen", p.lastSeen || "unknown"),
      popupRow("Freshness", p.staleLabel || (p.stale ? "Stale" : "Live")),
      popupRow("Capabilities", capabilities),
      popupRow("Check-In Source", p.lastCheckInSource ? titleCase(p.lastCheckInSource) : ""),
      popupRow("Check-In Note", p.lastCheckInNote)
    ].filter(Boolean).join("");
    return '\n      <div class="rf-popup popup-card popup-card-default">\n        <div class="popup-title">'.concat(window.escapeHtml(p.callsign || "UNKNOWN"), "</div>\n        ").concat(subtitle ? '<div class="popup-subtitle">'.concat(window.escapeHtml(subtitle), "</div>") : "", '\n        <div class="popup-grid">').concat(rows, "</div>\n        ").concat(p.manualPreferred ? '<div class="popup-note">Manual fallback currently preferred.</div>' : "", '\n        <div class="command-source-badges">').concat(badges, "</div>\n      </div>");
  }
  function renderProviderStatus(data) {
    const wraps = [
      document.getElementById("rf-provider-status"),
      document.getElementById("rf-provider-status-console")
    ].filter(Boolean);
    if (!wraps.length) return;
    const providers = data.providers || {};
    const html = Object.entries(providers).map(([key, provider]) => {
      var _a, _b, _c;
      return '\n      <div class="info-card compact-card">\n        <div class="info-card-head">\n          <div>\n            <h3>'.concat(providerLabel(key), '</h3>\n            <div class="card-subtle">').concat(provider.connected ? "Connected" : provider.configured ? "Configured" : "Not configured", '</div>\n          </div>\n          <span class="feed-badge ').concat(provider.connected || provider.count ? "feed-live" : provider.lastError ? "feed-alert" : "feed-empty", '">').concat(providerBadge(provider), '</span>\n        </div>\n        <div class="feed-note">').concat(provider.lastError ? window.escapeHtml(provider.lastError) : window.escapeHtml(provider.note || "No current errors."), '</div>\n        <div class="card-subtle">').concat(window.escapeHtml(((_a = provider.sample) == null ? void 0 : _a.callsign) || ((_b = provider.sample) == null ? void 0 : _b.shortName) || ((_c = provider.sample) == null ? void 0 : _c.sourceId) || provider.endpoint || "No sample record yet"), "</div>\n      </div>\n    ");
    }).join("");
    wraps.forEach((wrap) => {
      wrap.innerHTML = html;
    });
  }
  function markerHtml(feature) {
    const staleTier = feature.properties.staleTier || (feature.properties.stale ? "stale" : "live");
    const source = sourceClass(feature.properties.bestSource || "manual");
    const count = Number(feature.properties.sourceCount || 0);
    const text = sourceDisplay(feature.properties.bestSource || "manual").slice(0, 1);
    return '<div class="rf-marker source-'.concat(source, " ").concat(staleTier !== "live" ? "is-stale" : "", " stale-").concat(staleTier, '">').concat(text).concat(count > 1 ? '<span class="rf-count">'.concat(count, "</span>") : "", "</div>");
  }
  function popupHtml(feature) {
    const p = feature.properties;
    const badges = sourceLabels(feature).map((label) => sourceBadge(label)).join("");
    const capabilities = capabilityList(p.capabilities);
    return '\n      <div class="rf-popup">\n        <strong>'.concat(window.escapeHtml(p.callsign || "UNKNOWN"), "</strong>").concat(p.name ? " • ".concat(window.escapeHtml(p.name)) : "", "<br>\n        <span>").concat(window.escapeHtml(p.assignment || "unassigned"), "</span><br>\n        <span>Role: ").concat(window.escapeHtml(titleCase(p.role || "unassigned")), "</span><br>\n        <span>Status: ").concat(window.escapeHtml(titleCase(p.status || "monitoring")), "</span><br>\n        <span>Assignment: ").concat(window.escapeHtml(p.assignedIncidentTitle || p.assignment || "unassigned"), "</span><br>\n        <span>Primary Source: ").concat(window.escapeHtml(sourceDisplay(p.bestSource || "manual")), "</span><br>\n        <span>Confidence: ").concat(window.escapeHtml(p.confidenceLabel || "Low"), "</span>").concat(p.manualPreferred ? "<br><span>Manual fallback currently preferred</span>" : "", "<br>\n        <span>Last seen: ").concat(window.escapeHtml(p.lastSeen || "unknown"), "</span><br>\n        <span>Freshness: ").concat(window.escapeHtml(p.staleLabel || (p.stale ? "Stale" : "Live")), "</span><br>\n        ").concat(capabilities ? "<span>Capabilities: ".concat(window.escapeHtml(capabilities), "</span><br>") : "", "\n        ").concat(p.lastCheckInSource ? "<span>Check-in source: ".concat(window.escapeHtml(titleCase(p.lastCheckInSource)), "</span><br>") : "", "\n        ").concat(p.lastCheckInNote ? "<span>Note: ".concat(window.escapeHtml(p.lastCheckInNote), "</span><br>") : "", '\n        <div class="command-source-badges">').concat(badges, "</div>\n      </div>");
  }
  function applySourceFilter(features) {
    if (state.sourceFilter === "all") return features;
    return features.filter((feature) => {
      const sources = sourceLabels(feature).map((label) => sourceClass(label));
      return sources.includes(state.sourceFilter);
    });
  }
  function renderList(features) {
    const lists = [
      document.getElementById("rf-tracking-list"),
      document.getElementById("rf-tracking-list-console")
    ].filter(Boolean);
    const summaries = [
      document.getElementById("rf-tracking-summary"),
      document.getElementById("rf-tracking-console-summary")
    ].filter(Boolean);
    if (!lists.length && !summaries.length) return;
    summaries.forEach((summary) => {
      summary.textContent = "".concat(features.length, " tracked");
    });
    if (!features.length) {
      lists.forEach((list) => {
        list.innerHTML = '<div class="empty-state">No tracked operators match the current source filter.</div>';
      });
      return;
    }
    const html = features.map((feature) => {
      const p = feature.properties;
      const badges = sourceLabels(feature).map((label) => sourceBadge(label)).join("");
      return '\n        <div class="info-card compact-card">\n          <div class="info-card-head">\n            <div>\n              <h3>'.concat(window.escapeHtml(p.callsign || "UNKNOWN"), '</h3>\n              <div class="card-subtle">').concat(window.escapeHtml(p.name || ""), " ").concat(p.name ? "• " : "").concat(window.escapeHtml(p.assignment || "unassigned"), " ").concat(p.role ? "• ".concat(window.escapeHtml(titleCase(p.role))) : "", '</div>\n            </div>\n            <span class="feed-badge ').concat(p.stale ? "feed-empty" : p.staleTier === "aging" ? "feed-alert" : "feed-live", '">').concat(window.escapeHtml(sourceDisplay(p.bestSource || "manual")), '</span>\n          </div>\n          <div class="feed-note">').concat(window.escapeHtml(p.sourceSummary || "Manual"), " • ").concat(window.escapeHtml(titleCase(p.status || "monitoring")), " • Confidence ").concat(window.escapeHtml(p.confidenceLabel || "Low"), " • ").concat(window.escapeHtml(p.lastSeen || "unknown"), " • ").concat(window.escapeHtml(p.staleLabel || (p.stale ? "Stale" : "Live")), '</div>\n          <div class="command-source-badges">').concat(badges, '</div>\n          <div class="action-row wrap-actions">\n            <button class="button button-secondary" type="button" data-locate-radio="').concat(window.escapeHtml(p.id), '">Locate Radio</button>\n          </div>\n        </div>');
    }).join("");
    lists.forEach((list) => {
      list.innerHTML = html;
      list.querySelectorAll("[data-locate-radio]").forEach((button) => {
        button.addEventListener("click", () => {
          var _a;
          const id = button.getAttribute("data-locate-radio");
          const feature = features.find((item) => item.properties.id === id);
          if (!feature || !window.map) return;
          focusFeatureOnMap(feature);
          if ((_a = window.AresMap) == null ? void 0 : _a.closeMobilePanels) window.AresMap.closeMobilePanels();
        });
      });
    });
  }
  function updateSourceSummary(allFeatures) {
    const counts = { aprs: 0, meshtastic: 0, dmr: 0, "gps-share": 0, manual: 0 };
    allFeatures.forEach((feature) => {
      sourceLabels(feature).forEach((label) => {
        const key = sourceClass(label);
        counts[key] = (counts[key] || 0) + 1;
      });
    });
    [["aprs", "command-source-aprs-count"], ["meshtastic", "command-source-meshtastic-count"], ["dmr", "command-source-dmr-count"], ["gps-share", "command-source-gps-share-count"], ["manual", "command-source-manual-count"]].forEach(([key, id]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(counts[key] || 0);
    });
  }
  function focusFeatureOnMap(feature) {
    var _a;
    if (!feature || !window.map) return;
    const [lng, lat] = feature.geometry.coordinates;
    const marker = ((_a = feature == null ? void 0 : feature.properties) == null ? void 0 : _a.id) ? state.markers.get(feature.properties.id) : null;
    if (marker) {
      marker.openPopup();
    }
    window.dispatchEvent(new CustomEvent("ares:focus-coordinates", { detail: { lat, lng, popupHtml: operatorPopupHtml(feature), zoom: 14 } }));
  }
  function focusById(identifier) {
    const key = String(identifier || "").trim().toLowerCase();
    if (!key) return false;
    const feature = (state.latestFeatures || []).find((item) => {
      const p = (item == null ? void 0 : item.properties) || {};
      return [p.id, p.callsign, p.aprsCallsign, p.sourceId].filter(Boolean).some((value) => String(value).toLowerCase() === key);
    });
    if (!feature) return false;
    focusFeatureOnMap(feature);
    return true;
  }
  function updateMarkers(features) {
    const layer = ensureLayer();
    if (!layer) return;
    const seen = /* @__PURE__ */ new Set();
    features.forEach((feature) => {
      const id = feature.properties.id;
      seen.add(id);
      const [lng, lat] = feature.geometry.coordinates;
      let marker = state.markers.get(id);
      if (!marker) {
        marker = L.marker([lat, lng], { icon: L.divIcon({ className: "rf-div-icon", html: markerHtml(feature), iconSize: [24, 24] }) }).addTo(layer);
        state.markers.set(id, marker);
      } else {
        marker.setLatLng([lat, lng]);
        marker.setIcon(L.divIcon({ className: "rf-div-icon", html: markerHtml(feature), iconSize: [24, 24] }));
      }
      marker.bindPopup(operatorPopupHtml(feature));
      marker.off("click.__focus");
      marker.on("click", () => focusFeatureOnMap(feature));
    });
    Array.from(state.markers.keys()).forEach((id) => {
      if (!seen.has(id)) {
        const marker = state.markers.get(id);
        layer.removeLayer(marker);
        state.markers.delete(id);
      }
    });
  }
  async function refresh() {
    try {
      const [geojson, diagnostics] = await Promise.all([
        fetchJSON("/api/tracking/operators.geojson"),
        fetchJSON("/api/tracking/diagnostics")
      ]);
      renderProviderStatus(diagnostics);
      const allFeatures = Array.isArray(geojson.features) ? geojson.features : [];
      state.latestFeatures = allFeatures;
      state.latestDiagnostics = diagnostics;
      updateSourceSummary(allFeatures);
      const features = applySourceFilter(allFeatures);
      renderList(features);
      updateCommandPanel(features, diagnostics, allFeatures);
      updateMarkers(features);
    } catch (error) {
      console.warn("Tracking refresh failed", error);
    }
  }
  function updateCommandPanel(features, diagnostics, allFeatures = features) {
    const list = document.getElementById("command-operator-list");
    const tracked = document.getElementById("command-tracked-count");
    const poll = document.getElementById("command-poll-status");
    const live = document.getElementById("command-live-count");
    const aging = document.getElementById("command-aging-count");
    const stale = document.getElementById("command-stale-count");
    if (tracked) tracked.textContent = String(features.length);
    const polling = (diagnostics == null ? void 0 : diagnostics.polling) || {};
    if (poll) {
      const statusText = String(polling.status || "standby").replace(/^idle$/i, "Standby").replace(/^polling$/i, "Active").replace(/^ok$/i, "Ready");
      poll.textContent = statusText;
      poll.className = "command-status-" + String(statusText || "standby").toLowerCase().replace(/[^a-z_]+/g, "");
    }
    const counts = { live: 0, aging: 0, stale: 0 };
    features.forEach((feature) => {
      var _a, _b;
      const tier = ((_a = feature == null ? void 0 : feature.properties) == null ? void 0 : _a.staleTier) || (((_b = feature == null ? void 0 : feature.properties) == null ? void 0 : _b.stale) ? "stale" : "live");
      if (tier === "aging") counts.aging += 1;
      else if (tier === "stale" || tier === "very_stale") counts.stale += 1;
      else counts.live += 1;
    });
    if (live) live.textContent = String(counts.live);
    if (aging) aging.textContent = String(counts.aging);
    if (stale) stale.textContent = String(counts.stale);
    if (list) {
      if (!features.length) {
        list.innerHTML = '<div class="empty-state">No tracked operators match the current source filter.</div>';
      } else {
        list.innerHTML = features.slice().sort((a, b) => (a.properties.stale ? 1 : 0) - (b.properties.stale ? 1 : 0)).map((feature) => {
          const p = feature.properties;
          const badges = sourceLabels(feature).map((label) => sourceBadge(label)).join("");
          const trackingOnly = p.role === "rf-only" || String(p.id || "").startsWith("rf-");
          const actionButtons = trackingOnly ? '\n                <button class="button button-secondary" type="button" data-command-locate="'.concat(window.escapeHtml(p.id), '">Locate</button>\n                <button class="button button-ghost" type="button" data-command-popup="').concat(window.escapeHtml(p.id), '">Open Popup</button>') : '\n                <button class="button button-secondary" type="button" data-command-locate="'.concat(window.escapeHtml(p.id), '">Locate</button>\n                <button class="button button-secondary" type="button" data-command-inspect="').concat(window.escapeHtml(p.id), '">Inspect</button>\n                <button class="button button-secondary" type="button" data-command-edit="').concat(window.escapeHtml(p.id), '">Edit</button>\n                <button class="button button-ghost danger" type="button" data-command-delete="').concat(window.escapeHtml(p.id), '">Delete</button>\n                <button class="button button-ghost" type="button" data-command-popup="').concat(window.escapeHtml(p.id), '">Open Popup</button>\n                <button class="button" type="button" data-command-dispatch="').concat(window.escapeHtml(p.id), '">Dispatch</button>');
          return '\n            <div class="command-operator-card">\n              <div class="command-operator-top">\n                <div>\n                  <strong>'.concat(window.escapeHtml(p.callsign || "UNKNOWN"), '</strong>\n                  <div class="command-operator-meta">').concat(window.escapeHtml(p.name || "")).concat(p.name ? " • " : "").concat(window.escapeHtml(p.assignment || "unassigned"), "<br>").concat(window.escapeHtml(p.sourceSummary || p.bestSource || "manual"), " • ").concat(window.escapeHtml(p.staleLabel || "Unknown"), " • ").concat(window.escapeHtml(p.lastSeen || "unknown"), "<small>Visible ").concat(features.length, " of ").concat(allFeatures.length, ' tracked</small></div>\n                  <div class="command-source-badges">').concat(badges, '</div>\n                </div>\n                <span class="feed-badge ').concat(p.stale ? "feed-empty" : p.staleTier === "aging" ? "feed-alert" : "feed-live", '">').concat(window.escapeHtml(sourceDisplay(p.bestSource || "manual")), '</span>\n              </div>\n              <div class="command-operator-actions">\n                ').concat(actionButtons, "\n              </div>\n            </div>");
        }).join("");
        list.querySelectorAll("[data-command-locate]").forEach((button) => {
          button.addEventListener("click", () => {
            const id = button.getAttribute("data-command-locate");
            const feature = features.find((item) => item.properties.id === id);
            if (!feature || !window.map) return;
            const [lng, lat] = feature.geometry.coordinates;
            window.map.setView([lat, lng], 14);
          });
        });
        list.querySelectorAll("[data-command-popup]").forEach((button) => {
          button.addEventListener("click", () => {
            const id = button.getAttribute("data-command-popup");
            const marker = state.markers.get(id);
            if (marker) marker.openPopup();
          });
        });
        list.querySelectorAll("[data-command-inspect]").forEach((button) => {
          button.addEventListener("click", () => {
            var _a, _b, _c;
            const id = button.getAttribute("data-command-inspect");
            (_a = document.querySelector('[data-ops-tab="operators"]')) == null ? void 0 : _a.click();
            (_b = window.setActiveOpsTab) == null ? void 0 : _b.call(window, "operators");
            (_c = window.setSelectedOpsRecord) == null ? void 0 : _c.call(window, "operator", id);
          });
        });
        list.querySelectorAll("[data-command-edit]").forEach((button) => {
          button.addEventListener("click", () => {
            var _a;
            const id = button.getAttribute("data-command-edit");
            (_a = window.openOpsRecordEditor) == null ? void 0 : _a.call(window, "operator", id);
          });
        });
        list.querySelectorAll("[data-command-delete]").forEach((button) => {
          button.addEventListener("click", async () => {
            var _a, _b, _c;
            const id = button.getAttribute("data-command-delete");
            try {
              await ((_a = window.deleteOpsRecord) == null ? void 0 : _a.call(window, "operator", id));
              state.operatorsOpen = true;
              (_b = document.getElementById("command-operator-drawer")) == null ? void 0 : _b.classList.add("is-open");
            } catch (error) {
              console.warn(error);
              (_c = window.showOpsToast) == null ? void 0 : _c.call(window, error.message || "Unable to delete operator.", "error");
            }
          });
        });
        list.querySelectorAll("[data-command-dispatch]").forEach((button) => {
          button.addEventListener("click", () => {
            var _a, _b, _c;
            const id = button.getAttribute("data-command-dispatch");
            (_a = document.getElementById("toggle-dispatch-drawer")) == null ? void 0 : _a.click();
            const incidentSelect = document.getElementById("command-dispatch-incident-select");
            if (incidentSelect && incidentSelect.value) {
              const assignBtn = document.querySelector('[data-dispatch-assign="'.concat(id, '"]'));
              if (assignBtn) assignBtn.scrollIntoView({ block: "center", behavior: "smooth" });
            }
            (_b = document.querySelector('[data-ops-tab="operators"]')) == null ? void 0 : _b.click();
            (_c = window.setSelectedOpsRecord) == null ? void 0 : _c.call(window, "operator", id);
          });
        });
      }
    }
    window.dispatchEvent(new CustomEvent("ares:tracking-updated", { detail: { features, allFeatures, diagnostics, sourceFilter: state.sourceFilter } }));
  }
  function bindSourceFilters() {
    document.querySelectorAll("[data-source-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        state.sourceFilter = button.getAttribute("data-source-filter") || "all";
        document.querySelectorAll("[data-source-filter]").forEach((chip) => chip.classList.toggle("active", chip === button));
        updateSourceSummary(state.latestFeatures);
        const filtered = applySourceFilter(state.latestFeatures);
        renderList(filtered);
        updateCommandPanel(filtered, state.latestDiagnostics || {}, state.latestFeatures);
        updateMarkers(filtered);
      });
    });
  }
  window.AresTracking = { refresh };
  window.addEventListener("load", () => {
    bindSourceFilters();
    refresh();
    state.timer = window.setInterval(refresh, 5e3);
  });
})();
