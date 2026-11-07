(function() {
  const STORAGE_KEY = "ares-command-drawers";
  const DEFAULT_STATE = { diagnosticsOpen: false, operatorsOpen: false, taskOpen: false, dispatchOpen: false, layersOpen: false };
  const MOBILE_BREAKPOINT = 820;
  const DRAWER_MAP = {
    operators: { panelId: "command-operator-drawer", stateKey: "operatorsOpen" },
    dispatch: { panelId: "command-dispatch-drawer", stateKey: "dispatchOpen" },
    tasks: { panelId: "command-task-drawer", stateKey: "taskOpen" },
    layers: { panelId: "command-layers-drawer", stateKey: "layersOpen" },
    diagnostics: { panelId: "command-diagnostics-drawer", stateKey: "diagnosticsOpen" }
  };
  let controlsBound = false;
  function loadDrawerState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return { ...DEFAULT_STATE, ...parsed };
    } catch (_) {
      return { ...DEFAULT_STATE };
    }
  }
  function saveDrawerState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        diagnosticsOpen: !!state.diagnosticsOpen,
        operatorsOpen: !!state.operatorsOpen,
        taskOpen: !!state.taskOpen,
        dispatchOpen: !!state.dispatchOpen,
        layersOpen: !!state.layersOpen
      }));
    } catch (_) {
    }
  }
  const state = { ...loadDrawerState(), tracking: null, diagnostics: null, sourceFilter: "all", assignments: [], selectedIncidentId: "", searchTerm: "" };
  function sourceClass(source) {
    const normalized = String(source || "manual").toLowerCase().replace(/[_\s]+/g, "-");
    return ["aprs", "meshtastic", "dmr", "gps-share", "manual"].includes(normalized) ? normalized : "manual";
  }
  function sourceBadgeMarkup(source) {
    const key = sourceClass(source);
    const label = key === "gps-share" ? "GPS" : String(source || key).replace(/[-_]+/g, " ").toUpperCase();
    return '<span class="command-source-badge source-'.concat(key, '">').concat(escapeHtml(label), "</span>");
  }
  function isCompactDrawerMode() {
    return window.innerWidth <= MOBILE_BREAKPOINT || document.body.classList.contains("mobile-command-mode") || document.body.classList.contains("mobile-compact");
  }
  function getOpenDrawerActions() {
    return Object.entries(DRAWER_MAP).filter(([, config]) => {
      var _a;
      return (_a = document.getElementById(config.panelId)) == null ? void 0 : _a.classList.contains("is-open");
    }).map(([action]) => action);
  }
  function getActiveDrawerAction() {
    return getOpenDrawerActions()[0] || "";
  }
  function emitDrawerState() {
    try {
      window.dispatchEvent(new CustomEvent("ares:command-drawers", {
        detail: {
          active: getActiveDrawerAction(),
          openPanels: getOpenDrawerActions()
        }
      }));
    } catch (_) {
    }
  }
  function setOpen(id, open) {
    const panel = document.getElementById(id);
    if (!panel) return;
    if (open && isCompactDrawerMode()) {
      Object.values(DRAWER_MAP).forEach((config) => {
        if (config.panelId === id) return;
        const otherPanel = document.getElementById(config.panelId);
        if (otherPanel) otherPanel.classList.remove("is-open");
        state[config.stateKey] = false;
      });
    }
    panel.classList.toggle("is-open", !!open);
    saveDrawerState();
    emitDrawerState();
  }
  function closeAllDrawers() {
    Object.values(DRAWER_MAP).forEach((config) => {
      state[config.stateKey] = false;
      const panel = document.getElementById(config.panelId);
      if (panel) panel.classList.remove("is-open");
    });
    saveDrawerState();
    emitDrawerState();
    refreshMapLayout(70);
  }
  function refreshMapLayout(delay = 80) {
    var _a, _b;
    (_b = (_a = window.AresMap) == null ? void 0 : _a.refreshSize) == null ? void 0 : _b.call(_a, { delay });
  }
  function syncThemeButton(mode) {
    const btn = document.getElementById("command-theme-toggle");
    if (!btn) return;
    const dark = mode === "dark" || mode === "night";
    btn.textContent = dark ? "Day Mode" : "Night Mode";
    btn.setAttribute("aria-pressed", String(dark));
  }
  function setMarkMode(kind) {
    ["incident", "operator", "task"].forEach((name) => {
      const btn = document.getElementById("command-mark-".concat(name));
      if (btn) btn.classList.toggle("is-active", name === kind);
    });
  }
  function titleCase(value) {
    return String(value || "").replace(/_/g, " ").split(" ").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  }
  function relativeTime(value) {
    if (!value) return "No refresh yet";
    const diffMs = Date.now() - new Date(value).getTime();
    const minutes = Math.round(diffMs / 6e4);
    if (minutes < 1) return "just now";
    if (minutes < 60) return "".concat(minutes, " min ago");
    const hours = Math.round(minutes / 60);
    if (hours < 24) return "".concat(hours, " hr ago");
    return "".concat(Math.round(hours / 24), " day ago");
  }
  function escapeHtml(value) {
    return window.escapeHtml ? window.escapeHtml(value) : String(value || "");
  }
  function focusOpsRecord(kind, id) {
    var _a, _b, _c;
    const tab = kind === "incident" ? "incidents" : kind === "operator" ? "operators" : "tasks";
    (_a = document.querySelector('[data-ops-tab="'.concat(tab, '"]'))) == null ? void 0 : _a.click();
    (_b = window.setActiveOpsTab) == null ? void 0 : _b.call(window, tab);
    (_c = window.setSelectedOpsRecord) == null ? void 0 : _c.call(window, kind, id);
  }
  function findCurrentRecord(kind, id) {
    if (kind === "incident") return (window.currentIncidents || []).find((item) => item.id === id) || null;
    if (kind === "operator") return (window.currentOperators || []).find((item) => item.id === id || item.callsign === id) || null;
    if (kind === "task") return (window.currentTasks || []).find((item) => item.id === id) || null;
    return null;
  }
  async function deleteCurrentRecord(kind, id) {
    var _a, _b, _c;
    const record = findCurrentRecord(kind, id);
    if (!record) {
      (_a = window.showOpsToast) == null ? void 0 : _a.call(window, "".concat(titleCase(kind), " not found."), "error");
      return;
    }
    try {
      await ((_b = window.deleteOpsRecord) == null ? void 0 : _b.call(window, kind, id));
      if (kind === "incident" || kind === "task") {
        state.taskOpen = true;
        setOpen("command-task-drawer", true);
      }
      if (kind === "operator") {
        state.operatorsOpen = true;
        setOpen("command-operator-drawer", true);
      }
    } catch (error) {
      console.warn(error);
      (_c = window.showOpsToast) == null ? void 0 : _c.call(window, error.message || "Unable to delete ".concat(kind, "."), "error");
    }
  }
  function focusSearchResult(item = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (item.kind === "layer") {
      (_b = (_a = window.AresLayers) == null ? void 0 : _a.ensureLayerVisible) == null ? void 0 : _b.call(_a, item.id).then(() => {
        var _a2, _b2;
        (_b2 = (_a2 = window.AresLayers) == null ? void 0 : _a2.zoomToLayer) == null ? void 0 : _b2.call(_a2, item.id);
      }).catch(() => {
      });
      return;
    }
    if (item.kind === "operator" && Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng))) {
      (_d = (_c = window.AresMap) == null ? void 0 : _c.focusMarkerByLatLng) == null ? void 0 : _d.call(_c, Number(item.lat), Number(item.lng), "<strong>".concat(escapeHtml(item.label || item.id || "Operator"), "</strong>"));
      state.operatorsOpen = true;
      setOpen("command-operator-drawer", true);
      return;
    }
    if (item.kind === "incident" && item.id) {
      const rec = (window.currentIncidents || []).find((entry) => entry.id === item.id);
      if (rec) (_f = (_e = window.AresMap) == null ? void 0 : _e.focusIncident) == null ? void 0 : _f.call(_e, rec);
      state.taskOpen = true;
      setOpen("command-task-drawer", true);
      return;
    }
    if (item.kind === "task" && Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng))) {
      (_h = (_g = window.AresMap) == null ? void 0 : _g.focusMarkerByLatLng) == null ? void 0 : _h.call(_g, Number(item.lat), Number(item.lng), "<strong>".concat(escapeHtml(item.label || item.id || "Task"), "</strong>"));
      state.taskOpen = true;
      setOpen("command-task-drawer", true);
    }
  }
  function getSearchItems() {
    var _a, _b;
    const term = String(state.searchTerm || "").trim().toLowerCase();
    const items = [];
    (window.currentOperators || []).forEach((item) => items.push({ kind: "operator", id: item.id || item.callsign, label: item.callsign || item.name || item.id, subtitle: [item.name, item.status].filter(Boolean).join(" - "), lat: item.lat, lng: item.lng }));
    (window.currentIncidents || []).forEach((item) => items.push({ kind: "incident", id: item.id, label: item.title || item.name || item.id, subtitle: [item.status, item.priority].filter(Boolean).join(" - "), lat: item.lat, lng: item.lng }));
    (window.currentTasks || []).forEach((item) => items.push({ kind: "task", id: item.id, label: item.title || item.name || item.id, subtitle: [item.status, item.priority].filter(Boolean).join(" - "), lat: item.lat, lng: item.lng }));
    (((_b = (_a = window.AresLayers) == null ? void 0 : _a.getCatalog) == null ? void 0 : _b.call(_a)) || []).forEach((item) => items.push({ kind: "layer", id: item.id, label: item.title, subtitle: item.description || "", color: item.color || "#19488c" }));
    return items.filter((item) => !term || "".concat(item.label, " ").concat(item.subtitle, " ").concat(item.id).toLowerCase().includes(term)).slice(0, 18);
  }
  function parseFrequencyItems(data) {
    var _a, _b;
    if (Array.isArray(data == null ? void 0 : data.frequencies)) return data.frequencies;
    if (Array.isArray(data == null ? void 0 : data.ares_frequencies)) return data.ares_frequencies;
    if (Array.isArray((_a = data == null ? void 0 : data.ares_frequencies) == null ? void 0 : _a.channels)) return data.ares_frequencies.channels;
    if (Array.isArray((_b = data == null ? void 0 : data.ares_frequencies) == null ? void 0 : _b.entries)) return data.ares_frequencies.entries;
    return [];
  }
  function layerStatusMeta(layerId) {
    var _a, _b, _c, _d, _e, _f, _g;
    const status = ((_c = (_b = (_a = window.AresLayers) == null ? void 0 : _a.getLayerLoadStatus) == null ? void 0 : _b.call(_a)) == null ? void 0 : _c[layerId]) || {};
    const active = !!((_e = (_d = window.AresLayers) == null ? void 0 : _d.isLayerActive) == null ? void 0 : _e.call(_d, layerId));
    if (status.status === "error") return { label: "Error", className: "feed-alert", detail: status.error || "Load failed", active };
    if (status.status === "loading") return { label: "Loading", className: "feed-pending", detail: "Fetching layer...", active };
    if (status.status === "loaded") return { label: active ? "Visible" : "Loaded", className: "feed-live", detail: "".concat((_f = status.count) != null ? _f : 0, " records"), active };
    if (status.status === "hidden") return { label: "Hidden", className: "feed-muted", detail: "".concat((_g = status.count) != null ? _g : 0, " cached"), active };
    return { label: active ? "Visible" : "Ready", className: active ? "feed-live" : "feed-muted", detail: "", active };
  }
  function layerSourceMeta(layer = {}) {
    var _a, _b;
    return ((_b = (_a = window.AresSourceUi) == null ? void 0 : _a.layerBadgeMeta) == null ? void 0 : _b.call(_a, layer)) || { label: "Empty", className: "feed-empty", detail: "Awaiting source data" };
  }
  function renderSearchConsole() {
    const target = document.getElementById("command-search-results");
    if (!target) return;
    const items = getSearchItems();
    target.innerHTML = items.length ? items.map((item) => '\n      <button class="command-search-item" type="button" data-search-kind="'.concat(escapeHtml(item.kind), '" data-search-id="').concat(escapeHtml(item.id || ""), '">\n        <div><strong>').concat(escapeHtml(item.label || item.id || item.kind), "</strong><span>").concat(escapeHtml(item.subtitle || titleCase(item.kind)), "</span></div>\n        <em>").concat(escapeHtml(titleCase(item.kind)), "</em>\n      </button>")).join("") : '<div class="empty-state small">No matching operators, incidents, tasks, or layers.</div>';
    target.querySelectorAll(".command-search-item").forEach((button, index) => {
      button.addEventListener("click", () => focusSearchResult(items[index] || {}));
    });
  }
  function formatFeatureRows(feature) {
    const props = (feature == null ? void 0 : feature.properties) || {};
    return Object.entries(props).filter(([, value]) => value !== null && value !== void 0 && value !== "").slice(0, 8).map(([key, value]) => '<div class="command-record-row"><strong>'.concat(escapeHtml(titleCase(key)), "</strong><span>").concat(escapeHtml(String(value)), "</span></div>")).join("");
  }
  async function renderLayerRecords(layerId) {
    var _a, _b, _c, _d;
    const target = document.getElementById("command-layer-records");
    const meta = document.getElementById("command-layer-records-meta");
    if (!target) return;
    const layer = (((_b = (_a = window.AresLayers) == null ? void 0 : _a.getCatalog) == null ? void 0 : _b.call(_a)) || []).find((item) => item.id === layerId);
    const sourceMeta = layerSourceMeta(layer);
    if (meta) meta.textContent = layer ? "".concat(layer.title, " - ").concat(sourceMeta.label) : "Choose a layer";
    if (!layerId) {
      target.innerHTML = '<div class="empty-state">Select a layer to browse live operational records.</div>';
      return;
    }
    target.innerHTML = '<div class="empty-state">Loading layer records...</div>';
    try {
      const data = await ((_d = (_c = window.AresLayers) == null ? void 0 : _c.fetchLayerSnapshot) == null ? void 0 : _d.call(_c, layerId));
      const features = Array.isArray(data == null ? void 0 : data.features) ? data.features : [];
      target.innerHTML = features.length ? features.slice(0, 20).map((feature, idx) => {
        var _a2, _b2, _c2, _d2, _e, _f, _g, _h, _i, _j, _k, _l, _m;
        return '\n        <button class="command-search-item command-record-item" type="button" data-record-lat="'.concat(escapeHtml((_c2 = (_b2 = (_a2 = feature.geometry) == null ? void 0 : _a2.coordinates) == null ? void 0 : _b2[1]) != null ? _c2 : ""), '" data-record-lng="').concat(escapeHtml((_f = (_e = (_d2 = feature.geometry) == null ? void 0 : _d2.coordinates) == null ? void 0 : _e[0]) != null ? _f : ""), '">\n          <div><strong>').concat(escapeHtml(((_g = feature.properties) == null ? void 0 : _g.name) || ((_h = feature.properties) == null ? void 0 : _h.station) || ((_i = feature.properties) == null ? void 0 : _i.title) || "".concat((layer == null ? void 0 : layer.title) || "Record", " ").concat(idx + 1)), "</strong><span>").concat(escapeHtml(((_j = feature.properties) == null ? void 0 : _j.address) || ((_k = feature.properties) == null ? void 0 : _k.county) || ((_l = feature.properties) == null ? void 0 : _l.city) || ((_m = feature.properties) == null ? void 0 : _m.label) || ""), "</span>").concat(formatFeatureRows(feature), "</div>\n          <em>").concat(escapeHtml(titleCase((layer == null ? void 0 : layer.category) || "layer")), "</em>\n        </button>");
      }).join("") : '<div class="empty-state">No layer features returned.</div>';
      target.querySelectorAll("[data-record-lat]").forEach((button) => button.addEventListener("click", () => {
        var _a2, _b2;
        const lat = Number(button.getAttribute("data-record-lat"));
        const lng = Number(button.getAttribute("data-record-lng"));
        if (Number.isFinite(lat) && Number.isFinite(lng)) (_b2 = (_a2 = window.AresMap) == null ? void 0 : _a2.focusMarkerByLatLng) == null ? void 0 : _b2.call(_a2, lat, lng);
      }));
    } catch (error) {
      target.innerHTML = '<div class="empty-state">Unable to load layer records: '.concat(escapeHtml(error.message || error), "</div>");
    }
  }
  async function renderFrequencyReference() {
    const target = document.getElementById("command-frequency-reference");
    const meta = document.getElementById("command-frequency-meta");
    if (!target) return;
    try {
      const data = await fetchJSON("/api/reference");
      const frequencies = parseFrequencyItems(data);
      if (meta) meta.textContent = "".concat(frequencies.length, " entries");
      target.innerHTML = frequencies.length ? frequencies.slice(0, 20).map((item) => {
        const title = item.name || item.label || item.channel || item.frequency || "Frequency";
        const line1 = [item.frequency ? "".concat(item.frequency, " MHz") : "", item.offset ? "Offset ".concat(item.offset) : "", item.mode || ""].filter(Boolean).join(" - ");
        const line2 = [item.call || item.callsign || "", item.tone || (item.toneOut ? "Tx ".concat(item.toneOut).concat(item.toneIn ? "/Rx ".concat(item.toneIn) : "") : ""), item.area || item.site || ""].filter(Boolean).join(" - ");
        const line3 = [item.description || "", item.notes || ""].filter(Boolean).join(" ");
        return '\n        <div class="command-layer-item frequency-item">\n          <div class="command-layer-main">\n            <strong>'.concat(escapeHtml(title), "</strong>\n            <span>").concat(escapeHtml(line1), "</span>\n            ").concat(line2 ? "<span>".concat(escapeHtml(line2), "</span>") : "", "\n            ").concat(line3 ? "<span>".concat(escapeHtml(line3), "</span>") : "", "\n          </div>\n        </div>");
      }).join("") : '<div class="empty-state">No ARES frequency references available.</div>';
    } catch (error) {
      if (meta) meta.textContent = "Unavailable";
      target.innerHTML = '<div class="empty-state">Unable to load frequency references.</div>';
    }
  }
  function renderKeyLayersPanel() {
    var _a, _b, _c;
    const target = document.getElementById("command-key-layers");
    const meta = document.getElementById("command-layer-panel-meta");
    const filter = String(((_a = document.getElementById("command-layer-search")) == null ? void 0 : _a.value) || "").trim().toLowerCase();
    if (!target) return;
    const catalog = ((_c = (_b = window.AresLayers) == null ? void 0 : _b.getCatalog) == null ? void 0 : _c.call(_b)) || [];
    const filtered = catalog.filter((item) => !filter || "".concat(item.title, " ").concat(item.description || "", " ").concat(item.category || "", " ").concat(item.id).toLowerCase().includes(filter));
    const grouped = filtered.reduce((acc, item) => {
      const key = item.category || "reference";
      (acc[key] || (acc[key] = [])).push(item);
      return acc;
    }, {});
    if (meta) meta.textContent = "".concat(filtered.length, " available");
    const categories = ["operations", "infrastructure", "transportation", "statewide", "weather", "reference"];
    target.innerHTML = categories.filter((cat) => {
      var _a2;
      return (_a2 = grouped[cat]) == null ? void 0 : _a2.length;
    }).map((cat) => '\n      <details class="command-layer-group" '.concat(["operations", "infrastructure"].includes(cat) ? "open" : "", ">\n        <summary>").concat(escapeHtml(titleCase(cat)), " <span>").concat(grouped[cat].length, '</span></summary>\n        <div class="command-layer-group-body">\n          ').concat(grouped[cat].map((item) => {
      const layerState = layerStatusMeta(item.id);
      const sourceMeta = layerSourceMeta(item);
      const active = layerState.active;
      const detailParts = Array.from(new Set([sourceMeta.detail, layerState.detail].filter(Boolean)));
      return '\n            <div class="command-layer-item">\n              <div class="command-layer-main">\n                <strong>'.concat(escapeHtml(item.title), "</strong>\n                <span>").concat(escapeHtml(item.description || ""), '</span>\n                <div class="command-layer-statuses">\n                  <span class="feed-badge ').concat(sourceMeta.className, '">').concat(escapeHtml(sourceMeta.label), '</span>\n                  <span class="feed-badge ').concat(layerState.className, '">').concat(escapeHtml(layerState.label), "</span>\n                </div>\n                ").concat(detailParts.length ? '<div class="command-layer-detail">'.concat(escapeHtml(detailParts.join(" - ")), "</div>") : "", '\n              </div>\n              <div class="command-layer-actions">\n                <button class="button button-secondary layer-toggle-btn" type="button" data-layer-id="').concat(escapeHtml(item.id), '">').concat(active ? "Hide" : "Show", '</button>\n                <button class="button button-ghost layer-browse-btn" type="button" data-layer-id="').concat(escapeHtml(item.id), '">Browse</button>\n                <button class="button button-ghost layer-zoom-btn" type="button" data-layer-id="').concat(escapeHtml(item.id), '">Zoom</button>\n              </div>\n            </div>');
    }).join(""), "\n        </div>\n      </details>")).join("") || '<div class="empty-state">No layers match this search.</div>';
    target.querySelectorAll(".layer-toggle-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        var _a2, _b2, _c2, _d, _e, _f;
        const id = button.dataset.layerId;
        const checkbox = document.querySelector('#layer-groups input[data-layer-id="'.concat(id, '"]'));
        const active = !!((_b2 = (_a2 = window.AresLayers) == null ? void 0 : _a2.isLayerActive) == null ? void 0 : _b2.call(_a2, id)) || (checkbox ? checkbox.checked : false);
        try {
          if (active) {
            (_d = (_c2 = window.AresLayers) == null ? void 0 : _c2.removeLayer) == null ? void 0 : _d.call(_c2, id);
            if (checkbox) checkbox.checked = false;
          } else {
            await ((_f = (_e = window.AresLayers) == null ? void 0 : _e.loadLayer) == null ? void 0 : _f.call(_e, id));
            if (checkbox) checkbox.checked = true;
          }
        } catch (error) {
          console.warn("Layer toggle failed", id, error);
        } finally {
          renderKeyLayersPanel();
        }
      });
    });
    target.querySelectorAll(".layer-browse-btn").forEach((button) => button.addEventListener("click", () => renderLayerRecords(button.dataset.layerId)));
    target.querySelectorAll(".layer-zoom-btn").forEach((button) => button.addEventListener("click", async () => {
      var _a2, _b2, _c2, _d;
      const id = button.dataset.layerId;
      try {
        const checkbox = document.querySelector('#layer-groups input[data-layer-id="'.concat(id, '"]'));
        if (checkbox && !checkbox.checked) {
          await ((_b2 = (_a2 = window.AresLayers) == null ? void 0 : _a2.loadLayer) == null ? void 0 : _b2.call(_a2, id));
          checkbox.checked = true;
        }
        (_d = (_c2 = window.AresLayers) == null ? void 0 : _c2.zoomToLayer) == null ? void 0 : _d.call(_c2, id);
        renderKeyLayersPanel();
      } catch (_) {
      }
    }));
  }
  function syncAuthConsole() {
    const token = (() => {
      try {
        return localStorage.getItem("apiAdminToken") || "";
      } catch (_) {
        return "";
      }
    })();
    const input = document.getElementById("command-auth-token");
    const status = document.getElementById("command-auth-status-inline");
    if (input && document.activeElement !== input) input.value = token;
    if (status) status.textContent = token ? "Write access ready" : "Read-only mode";
  }
  function syncCounts() {
    const incidents = Array.isArray(window.currentIncidents) ? window.currentIncidents : [];
    const tasks = Array.isArray(window.currentTasks) ? window.currentTasks : [];
    const incidentCount = document.getElementById("command-incident-count");
    const taskCount = document.getElementById("command-task-count");
    const openIncidents = document.getElementById("command-open-incidents");
    const openTasks = document.getElementById("command-open-tasks");
    const assignmentCount = document.getElementById("command-assignment-count");
    const assignedTasks = document.getElementById("command-assigned-tasks");
    const incidentsMeta = document.getElementById("command-incidents-meta");
    const tasksMeta = document.getElementById("command-tasks-meta");
    const activeIncidents2 = incidents.filter((item) => !["resolved", "closed"].includes(String(item.status || "").toLowerCase()));
    const openTaskItems = tasks.filter((item) => !["done", "closed", "complete", "completed"].includes(String(item.status || "").toLowerCase()));
    const assignedTaskItems = tasks.filter((item) => item.assignedTo && item.assignedTo !== "unassigned");
    if (incidentCount) incidentCount.textContent = String(incidents.length);
    if (taskCount) taskCount.textContent = String(tasks.length);
    if (openIncidents) openIncidents.textContent = String(activeIncidents2.length);
    if (openTasks) openTasks.textContent = String(openTaskItems.length);
    if (assignedTasks) assignedTasks.textContent = String(assignedTaskItems.length);
    if (assignmentCount) assignmentCount.textContent = String((state.assignments || []).length);
    if (incidentsMeta) incidentsMeta.textContent = "".concat(activeIncidents2.length, " active");
    if (tasksMeta) tasksMeta.textContent = "".concat(openTaskItems.length, " open");
    renderIncidentList(incidents);
    renderTaskList(tasks);
  }
  function bindButtons() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B;
    if (controlsBound) return;
    controlsBound = true;
    function toggleDrawer(action) {
      const target = DRAWER_MAP[action];
      if (!target) return;
      if (isCompactDrawerMode()) {
        const panel = document.getElementById(target.panelId);
        const nextOpen = panel ? !panel.classList.contains("is-open") : true;
        Object.values(DRAWER_MAP).forEach((config) => {
          const shouldOpen = config === target ? nextOpen : false;
          state[config.stateKey] = shouldOpen;
          setOpen(config.panelId, shouldOpen);
        });
        refreshMapLayout(90);
        return;
      }
      state[target.stateKey] = !state[target.stateKey];
      setOpen(target.panelId, state[target.stateKey]);
      refreshMapLayout(70);
    }
    function closeDrawer(action) {
      const target = DRAWER_MAP[action];
      if (!target) return;
      state[target.stateKey] = false;
      setOpen(target.panelId, false);
      refreshMapLayout(70);
    }
    (_a = document.getElementById("toggle-diagnostics-drawer")) == null ? void 0 : _a.addEventListener("click", () => {
      toggleDrawer("diagnostics");
    });
    (_b = document.getElementById("toggle-operator-drawer")) == null ? void 0 : _b.addEventListener("click", () => {
      toggleDrawer("operators");
    });
    (_c = document.getElementById("toggle-dispatch-drawer")) == null ? void 0 : _c.addEventListener("click", () => {
      toggleDrawer("dispatch");
    });
    (_d = document.getElementById("close-dispatch-drawer")) == null ? void 0 : _d.addEventListener("click", () => {
      closeDrawer("dispatch");
    });
    (_e = document.getElementById("command-dispatch-refresh")) == null ? void 0 : _e.addEventListener("click", () => {
      refreshDispatchPanel();
    });
    (_f = document.getElementById("command-dispatch-incident-select")) == null ? void 0 : _f.addEventListener("change", (event) => {
      state.selectedIncidentId = event.target.value || "";
      refreshDispatchPanel();
    });
    (_g = document.getElementById("toggle-task-drawer")) == null ? void 0 : _g.addEventListener("click", () => {
      toggleDrawer("tasks");
    });
    (_h = document.getElementById("close-diagnostics-drawer")) == null ? void 0 : _h.addEventListener("click", () => {
      closeDrawer("diagnostics");
    });
    (_i = document.getElementById("close-operator-drawer")) == null ? void 0 : _i.addEventListener("click", () => {
      closeDrawer("operators");
    });
    (_j = document.getElementById("close-task-drawer")) == null ? void 0 : _j.addEventListener("click", () => {
      closeDrawer("tasks");
    });
    (_k = document.getElementById("toggle-layers-drawer")) == null ? void 0 : _k.addEventListener("click", () => {
      toggleDrawer("layers");
      renderSearchConsole();
      renderKeyLayersPanel();
      renderFrequencyReference();
    });
    (_l = document.getElementById("close-layers-drawer")) == null ? void 0 : _l.addEventListener("click", () => {
      closeDrawer("layers");
    });
    (_m = document.getElementById("command-search-input")) == null ? void 0 : _m.addEventListener("input", (event) => {
      state.searchTerm = event.target.value || "";
      renderSearchConsole();
    });
    (_n = document.getElementById("command-layer-search")) == null ? void 0 : _n.addEventListener("input", () => renderKeyLayersPanel());
    (_o = document.getElementById("command-fit-duval")) == null ? void 0 : _o.addEventListener("click", () => {
      var _a2, _b2;
      return (_b2 = (_a2 = window.AresMap) == null ? void 0 : _a2.fitDuval) == null ? void 0 : _b2.call(_a2);
    });
    (_p = document.getElementById("command-refresh-tracking")) == null ? void 0 : _p.addEventListener("click", async () => {
      var _a2, _b2, _c2, _d2, _e2;
      try {
        await Promise.allSettled([(_b2 = (_a2 = window.AresTracking) == null ? void 0 : _a2.refresh) == null ? void 0 : _b2.call(_a2), (_d2 = (_c2 = window.AresSystem) == null ? void 0 : _c2.refresh) == null ? void 0 : _d2.call(_c2), (_e2 = window.renderOperationalWorkspace) == null ? void 0 : _e2.call(window)]);
      } catch (error) {
        console.warn(error);
      }
    });
    (_q = document.getElementById("command-force-poll")) == null ? void 0 : _q.addEventListener("click", async () => {
      var _a2, _b2, _c2, _d2, _e2;
      const btn = document.getElementById("command-force-poll");
      if (btn) btn.disabled = true;
      try {
        await fetchJSON("/api/tracking/poll", { method: "POST" });
        await Promise.allSettled([(_b2 = (_a2 = window.AresTracking) == null ? void 0 : _a2.refresh) == null ? void 0 : _b2.call(_a2), (_d2 = (_c2 = window.AresSystem) == null ? void 0 : _c2.refresh) == null ? void 0 : _d2.call(_c2), (_e2 = window.renderOperationalWorkspace) == null ? void 0 : _e2.call(window)]);
      } catch (error) {
        console.warn("Force poll failed", error);
      } finally {
        if (btn) btn.disabled = false;
      }
    });
    (_r = document.getElementById("command-mark-incident")) == null ? void 0 : _r.addEventListener("click", () => {
      var _a2;
      state.dispatchOpen = false;
      state.taskOpen = false;
      setOpen("command-dispatch-drawer", false);
      setOpen("command-task-drawer", false);
      setMarkMode("incident");
      (_a2 = window.openOpsComposer) == null ? void 0 : _a2.call(window, "incident", { mapPick: true });
      refreshMapLayout(80);
    });
    (_s = document.getElementById("command-mark-operator")) == null ? void 0 : _s.addEventListener("click", () => {
      var _a2;
      state.dispatchOpen = false;
      state.taskOpen = false;
      setOpen("command-dispatch-drawer", false);
      setOpen("command-task-drawer", false);
      setMarkMode("operator");
      (_a2 = window.openOpsComposer) == null ? void 0 : _a2.call(window, "operator", { mapPick: true });
      refreshMapLayout(80);
    });
    (_t = document.getElementById("command-mark-task")) == null ? void 0 : _t.addEventListener("click", () => {
      var _a2;
      state.dispatchOpen = false;
      state.taskOpen = false;
      setOpen("command-dispatch-drawer", false);
      setOpen("command-task-drawer", false);
      setMarkMode("task");
      (_a2 = window.openOpsComposer) == null ? void 0 : _a2.call(window, "task", { mapPick: true });
      refreshMapLayout(80);
    });
    (_u = document.getElementById("command-new-incident")) == null ? void 0 : _u.addEventListener("click", () => {
      var _a2;
      return (_a2 = window.openOpsComposer) == null ? void 0 : _a2.call(window, "incident");
    });
    (_v = document.getElementById("command-new-operator")) == null ? void 0 : _v.addEventListener("click", () => {
      var _a2;
      return (_a2 = window.openOpsComposer) == null ? void 0 : _a2.call(window, "operator");
    });
    (_w = document.getElementById("command-new-task")) == null ? void 0 : _w.addEventListener("click", () => {
      var _a2;
      return (_a2 = window.openOpsComposer) == null ? void 0 : _a2.call(window, "task");
    });
    (_x = document.getElementById("command-auth-save")) == null ? void 0 : _x.addEventListener("click", () => {
      var _a2;
      try {
        localStorage.setItem("apiAdminToken", String(((_a2 = document.getElementById("command-auth-token")) == null ? void 0 : _a2.value) || "").trim());
      } catch (_) {
      }
      if (window.renderAuthPanel) window.renderAuthPanel();
      syncAuthConsole();
    });
    (_y = document.getElementById("command-auth-clear")) == null ? void 0 : _y.addEventListener("click", () => {
      try {
        localStorage.removeItem("apiAdminToken");
      } catch (_) {
      }
      const input = document.getElementById("command-auth-token");
      if (input) input.value = "";
      if (window.renderAuthPanel) window.renderAuthPanel();
      syncAuthConsole();
    });
    (_z = document.getElementById("command-theme-toggle")) == null ? void 0 : _z.addEventListener("click", () => {
      var _a2, _b2;
      const next = ((_b2 = (_a2 = window.AresTheme) == null ? void 0 : _a2.toggle) == null ? void 0 : _b2.call(_a2)) || "day";
      syncThemeButton(next);
    });
    syncThemeButton(((_B = (_A = window.AresTheme) == null ? void 0 : _A.getMode) == null ? void 0 : _B.call(_A)) || "day");
    window.addEventListener("ares:theme-changed", (event) => {
      var _a2;
      return syncThemeButton(((_a2 = event.detail) == null ? void 0 : _a2.mode) || "day");
    });
    window.addEventListener("ares:layers-updated", () => {
      renderKeyLayersPanel();
      renderSearchConsole();
    });
    window.addEventListener("ares:map-pick-started", () => {
      state.dispatchOpen = false;
      state.taskOpen = false;
      setOpen("command-dispatch-drawer", false);
      setOpen("command-task-drawer", false);
      refreshMapLayout(70);
    });
    window.addEventListener("ares:map-pick-ended", () => setMarkMode(""));
    window.addEventListener("ares:map-pick-cancelled", () => setMarkMode(""));
  }
  function renderIncidentList(incidents) {
    const target = document.getElementById("command-incident-list");
    if (!target) return;
    const items = (Array.isArray(incidents) ? incidents : []).slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 6);
    if (!items.length) {
      target.innerHTML = '<div class="empty-state">No incidents yet.</div>';
      return;
    }
    target.innerHTML = items.map((item) => {
      var _a, _b;
      return '\n      <article class="command-task-card '.concat(String(item.status || "").toLowerCase() === "active" ? "is-incident-active" : "", '">\n        <div class="command-task-top">\n          <div>\n            <strong>').concat(escapeHtml(item.title || item.name || item.id), '</strong>\n            <div class="command-task-meta">').concat(escapeHtml(titleCase(item.status || "active")), " - ").concat(escapeHtml(relativeTime(item.updatedAt || item.createdAt)), '</div>\n          </div>\n          <span class="feed-badge ').concat(String(item.priority || "").toLowerCase() === "high" ? "feed-alert" : "feed-live", '">').concat(escapeHtml((item.priority || "normal").toUpperCase()), '</span>\n        </div>\n        <div class="command-task-body">').concat(escapeHtml(item.location || "".concat((_a = item.lat) != null ? _a : " - ", ", ").concat((_b = item.lng) != null ? _b : " - "))).concat(item.assignedOperator ? " - assigned ".concat(escapeHtml(item.assignedOperator)) : "", '</div>\n        <div class="command-task-actions-inline">\n          <button class="button button-secondary" type="button" data-command-inspect-incident="').concat(escapeHtml(item.id), '">Inspect</button>\n          <button class="button button-secondary" type="button" data-command-edit-incident="').concat(escapeHtml(item.id), '">Edit</button>\n          <button class="button button-ghost danger" type="button" data-command-delete-incident="').concat(escapeHtml(item.id), '">Delete</button>\n          <button class="button button-ghost" type="button" data-command-map-incident="').concat(escapeHtml(item.id), '">Map</button>\n        </div>\n      </article>');
    }).join("");
    target.querySelectorAll("[data-command-inspect-incident]").forEach((button) => button.addEventListener("click", () => {
      const id = button.getAttribute("data-command-inspect-incident");
      focusOpsRecord("incident", id);
    }));
    target.querySelectorAll("[data-command-edit-incident]").forEach((button) => button.addEventListener("click", () => {
      var _a;
      const id = button.getAttribute("data-command-edit-incident");
      (_a = window.openOpsRecordEditor) == null ? void 0 : _a.call(window, "incident", id);
    }));
    target.querySelectorAll("[data-command-delete-incident]").forEach((button) => button.addEventListener("click", async () => {
      await deleteCurrentRecord("incident", button.getAttribute("data-command-delete-incident"));
    }));
    target.querySelectorAll("[data-command-map-incident]").forEach((button) => button.addEventListener("click", () => {
      const id = button.getAttribute("data-command-map-incident");
      const record = (window.currentIncidents || []).find((item) => item.id === id);
      if (record && window.map && Number.isFinite(Number(record.lat)) && Number.isFinite(Number(record.lng))) {
        window.dispatchEvent(new CustomEvent("ares:focus-incident", { detail: record }));
      }
    }));
  }
  function renderTaskList(tasks) {
    const target = document.getElementById("command-task-list");
    if (!target) return;
    const items = (Array.isArray(tasks) ? tasks : []).slice().sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)).slice(0, 8);
    if (!items.length) {
      target.innerHTML = '<div class="empty-state">No tasks yet.</div>';
      return;
    }
    target.innerHTML = items.map((item) => {
      var _a, _b;
      return '\n      <article class="command-task-card '.concat(String(item.status || "").toLowerCase() === "open" ? "is-task-open" : "", '">\n        <div class="command-task-top">\n          <div>\n            <strong>').concat(escapeHtml(item.title || item.id), '</strong>\n            <div class="command-task-meta">').concat(escapeHtml(titleCase(item.priority || "medium")), " - ").concat(escapeHtml(titleCase(item.status || "open")), " - ").concat(escapeHtml(relativeTime(item.updatedAt || item.createdAt)), '</div>\n          </div>\n          <span class="feed-badge ').concat(String(item.status || "").toLowerCase() === "open" ? "feed-alert" : "feed-live", '">').concat(escapeHtml(item.assignedTo || "UNASSIGNED"), '</span>\n        </div>\n        <div class="command-task-body">').concat(escapeHtml(item.incidentTitle || "No incident"), " - ").concat(escapeHtml(item.location || "".concat((_a = item.lat) != null ? _a : " - ", ", ").concat((_b = item.lng) != null ? _b : " - ")), '</div>\n        <div class="command-task-actions-inline">\n          <button class="button button-secondary" type="button" data-command-inspect-task="').concat(escapeHtml(item.id), '">Inspect</button>\n          <button class="button button-secondary" type="button" data-command-edit-task="').concat(escapeHtml(item.id), '">Edit</button>\n          <button class="button button-ghost danger" type="button" data-command-delete-task="').concat(escapeHtml(item.id), '">Delete</button>\n          <button class="button button-ghost" type="button" data-command-map-task="').concat(escapeHtml(item.id), '">Map</button>\n        </div>\n      </article>');
    }).join("");
    target.querySelectorAll("[data-command-inspect-task]").forEach((button) => button.addEventListener("click", () => {
      const id = button.getAttribute("data-command-inspect-task");
      focusOpsRecord("task", id);
    }));
    target.querySelectorAll("[data-command-edit-task]").forEach((button) => button.addEventListener("click", () => {
      var _a;
      const id = button.getAttribute("data-command-edit-task");
      (_a = window.openOpsRecordEditor) == null ? void 0 : _a.call(window, "task", id);
    }));
    target.querySelectorAll("[data-command-delete-task]").forEach((button) => button.addEventListener("click", async () => {
      await deleteCurrentRecord("task", button.getAttribute("data-command-delete-task"));
    }));
    target.querySelectorAll("[data-command-map-task]").forEach((button) => button.addEventListener("click", () => {
      const id = button.getAttribute("data-command-map-task");
      const record = (window.currentTasks || []).find((item) => item.id === id);
      if (record && window.map && Number.isFinite(Number(record.lat)) && Number.isFinite(Number(record.lng))) {
        window.dispatchEvent(new CustomEvent("ares:focus-incident", { detail: record }));
      }
    }));
  }
  function activeIncidents() {
    return (Array.isArray(window.currentIncidents) ? window.currentIncidents : []).filter((item) => !["resolved", "closed"].includes(String(item.status || "").toLowerCase()));
  }
  function syncDispatchIncidentOptions() {
    var _a;
    const select = document.getElementById("command-dispatch-incident-select");
    const label = document.getElementById("command-selected-incident-label");
    if (!select) return;
    const incidents = activeIncidents();
    const current = state.selectedIncidentId && incidents.find((item) => item.id === state.selectedIncidentId) ? state.selectedIncidentId : ((_a = incidents[0]) == null ? void 0 : _a.id) || "";
    state.selectedIncidentId = current;
    select.innerHTML = incidents.length ? incidents.map((item) => '<option value="'.concat(escapeHtml(item.id), '" ').concat(item.id === current ? "selected" : "", ">").concat(escapeHtml(item.title || item.id), "</option>")).join("") : '<option value="">No active incidents</option>';
    if (label) {
      const chosen = incidents.find((item) => item.id === current);
      label.textContent = chosen ? chosen.title || chosen.id : " - ";
    }
  }
  async function assignOperator(operatorId, incidentId, note = "Assigned from command dispatch panel") {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i;
    if (!operatorId || !incidentId) return;
    try {
      await ((_a = window.ensureAdminToken) == null ? void 0 : _a.call(window, false));
      await ((_b = window.postWithAdminRetry) == null ? void 0 : _b.call(window, "/api/dispatch/assignments", {
        operatorId,
        incidentId,
        status: "assigned",
        incidentStatus: "active",
        source: "dispatch",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        note
      }, "POST"));
      await Promise.allSettled([
        (_c = window.renderOperationalWorkspace) == null ? void 0 : _c.call(window),
        (_e = (_d = window.AresTracking) == null ? void 0 : _d.refresh) == null ? void 0 : _e.call(_d),
        refreshDispatchPanel(),
        (_g = (_f = window.AresDispatch) == null ? void 0 : _f.refresh) == null ? void 0 : _g.call(_f)
      ]);
      (_h = window.showOpsToast) == null ? void 0 : _h.call(window, "Operator assigned to incident.", "success");
    } catch (error) {
      console.warn(error);
      (_i = window.showOpsToast) == null ? void 0 : _i.call(window, error.message || "Dispatch assignment failed.", "error");
    }
  }
  function renderAssignmentList(items) {
    const target = document.getElementById("command-assignment-list");
    const meta = document.getElementById("command-dispatch-recent-meta");
    if (!target) return;
    const list = Array.isArray(items) ? items.slice(0, 8) : [];
    if (meta) meta.textContent = "".concat(list.length, " recent");
    if (!list.length) {
      target.innerHTML = '<div class="empty-state">No recent assignments yet.</div>';
      return;
    }
    target.innerHTML = list.map((item) => '\n      <article class="command-task-card is-assignment-card">\n        <div class="command-task-top">\n          <div>\n            <strong>'.concat(escapeHtml(item.callsign || item.operatorId || "Operator"), '</strong>\n            <div class="command-task-meta">').concat(escapeHtml(item.incidentTitle || item.incidentId || "Incident"), " - ").concat(escapeHtml(relativeTime(item.createdAt)), '</div>\n          </div>\n          <span class="feed-badge feed-live">').concat(escapeHtml(titleCase(item.status || "assigned")), '</span>\n        </div>\n        <div class="command-task-body">').concat(escapeHtml(item.note || "Assignment recorded"), "</div>\n      </article>")).join("");
  }
  function renderDispatchRecommendations(incident, candidates) {
    const target = document.getElementById("command-dispatch-recommendations");
    const meta = document.getElementById("command-dispatch-meta");
    const recommendCount = document.getElementById("command-dispatch-recommend-count");
    if (!target) return;
    const items = Array.isArray(candidates) ? candidates : [];
    if (recommendCount) recommendCount.textContent = String(items.filter((item) => item.dispatchEligible).length);
    if (meta) meta.textContent = incident ? "".concat(items.length, " candidates for ").concat(incident.title || incident.id) : "Awaiting selection";
    if (!incident) {
      target.innerHTML = '<div class="empty-state">Select an active incident to see nearest operators.</div>';
      return;
    }
    if (!items.length) {
      target.innerHTML = '<div class="empty-state">No mapped operators available for this incident.</div>';
      return;
    }
    target.innerHTML = items.map((item) => '\n      <article class="dispatch-candidate-card '.concat(item.dispatchEligible ? "is-eligible" : "is-limited", '">\n        <div class="dispatch-candidate-top">\n          <div>\n            <strong>').concat(escapeHtml(item.callsign || item.id || "Operator"), '</strong>\n            <div class="command-task-meta">').concat(escapeHtml(titleCase(String(item.status || "available").replace(/_/g, " "))), " - ").concat(escapeHtml(item.distanceMiles), " mi - ").concat(escapeHtml(item.location || item.assignment || "No location note"), '</div>\n          </div>\n          <span class="feed-badge ').concat(item.dispatchEligible ? "feed-live" : "feed-alert", '">').concat(item.dispatchEligible ? "Ready" : "Limited", '</span>\n        </div>\n        <div class="command-source-badges">').concat(Array.isArray(item.sources) ? item.sources.map((s) => sourceBadgeMarkup(s)).join("") : "", '</div>\n        <div class="command-task-actions-inline">\n          <button class="button button-secondary" type="button" data-dispatch-focus="').concat(escapeHtml(item.id || item.callsign), '">Inspect</button>\n          <button class="button" type="button" data-dispatch-assign="').concat(escapeHtml(item.id || item.callsign), '" ').concat(item.dispatchEligible ? "" : "disabled", ">Assign</button>\n        </div>\n      </article>")).join("");
    target.querySelectorAll("[data-dispatch-focus]").forEach((button) => button.addEventListener("click", () => {
      var _a, _b, _c, _d, _e, _f, _g;
      const id = button.getAttribute("data-dispatch-focus");
      (_a = document.querySelector('[data-ops-tab="operators"]')) == null ? void 0 : _a.click();
      state.operatorsOpen = true;
      setOpen("command-operator-drawer", true);
      (_b = window.setActiveOpsTab) == null ? void 0 : _b.call(window, "operators");
      (_c = window.setSelectedOpsRecord) == null ? void 0 : _c.call(window, "operator", id);
      const focused = (_e = (_d = window.AresTracking) == null ? void 0 : _d.focusById) == null ? void 0 : _e.call(_d, id);
      if (!focused) {
        const item = (window.currentOperators || []).find((entry) => entry.id === id || entry.callsign === id);
        if (item && Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng))) {
          window.dispatchEvent(new CustomEvent("ares:focus-coordinates", { detail: { lat: Number(item.lat), lng: Number(item.lng), zoom: 14 } }));
        }
      }
      (_g = (_f = window.AresMap) == null ? void 0 : _f.refreshSize) == null ? void 0 : _g.call(_f, { delay: 60 });
    }));
    target.querySelectorAll("[data-dispatch-assign]").forEach((button) => button.addEventListener("click", async () => {
      const id = button.getAttribute("data-dispatch-assign");
      await assignOperator(id, incident.id);
    }));
  }
  async function refreshDispatchPanel() {
    syncDispatchIncidentOptions();
    const incident = activeIncidents().find((item) => item.id === state.selectedIncidentId) || null;
    try {
      const [assignments, candidates] = await Promise.all([
        fetchJSON("/api/dispatch/assignments").catch(() => []),
        incident ? fetchJSON("/api/dispatch/incidents/".concat(encodeURIComponent(incident.id), "/nearest?limit=6")).catch(() => []) : Promise.resolve([])
      ]);
      state.assignments = Array.isArray(assignments) ? assignments : [];
      renderAssignmentList(state.assignments);
      renderDispatchRecommendations(incident, candidates);
      syncCounts();
    } catch (error) {
      console.warn("Dispatch panel refresh failed", error);
    }
  }
  function handleSelectedRecord(detail = {}) {
    const kind = detail == null ? void 0 : detail.kind;
    if (kind === "operator") {
      state.operatorsOpen = true;
      state.dispatchOpen = false;
      setOpen(DRAWER_MAP.operators.panelId, true);
      setOpen(DRAWER_MAP.dispatch.panelId, false);
      refreshMapLayout(40);
    } else if (kind === "incident" || kind === "task") {
      state.taskOpen = true;
      setOpen(DRAWER_MAP.tasks.panelId, true);
      refreshMapLayout(40);
    }
  }
  function toggleCompactDrawer(action) {
    const target = DRAWER_MAP[action];
    if (!target) return;
    const targetPanel = document.getElementById(target.panelId);
    const nextOpen = targetPanel ? !targetPanel.classList.contains("is-open") : true;
    Object.values(DRAWER_MAP).forEach((config) => {
      const shouldOpen = config === target ? nextOpen : false;
      state[config.stateKey] = shouldOpen;
      setOpen(config.panelId, shouldOpen);
    });
    refreshMapLayout(90);
  }
  window.AresCommandUi = {
    handleSelectedRecord,
    toggleCompactDrawer,
    closeAllDrawers,
    getActiveDrawerAction
  };
  window.addEventListener("ares:tracking-updated", (event) => {
    state.tracking = event.detail || null;
  });
  window.addEventListener("ares:system-diagnostics", (event) => {
    state.diagnostics = event.detail || null;
  });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindButtons, { once: true });
  } else {
    bindButtons();
  }
  window.addEventListener("load", () => {
    syncCounts();
    syncAuthConsole();
    renderFrequencyReference();
    renderSearchConsole();
    renderKeyLayersPanel();
    setOpen("command-diagnostics-drawer", state.diagnosticsOpen);
    setOpen("command-operator-drawer", state.operatorsOpen);
    setOpen("command-task-drawer", state.taskOpen);
    setOpen("command-dispatch-drawer", state.dispatchOpen);
    setOpen("command-layers-drawer", state.layersOpen);
    refreshDispatchPanel();
    refreshMapLayout(120);
    window.setTimeout(() => refreshMapLayout(0), 350);
    window.setInterval(syncCounts, 4e3);
    window.setInterval(refreshDispatchPanel, 15e3);
  });
})();
window.addEventListener("ares:selected-record", (event) => {
  var _a, _b;
  (_b = (_a = window.AresCommandUi) == null ? void 0 : _a.handleSelectedRecord) == null ? void 0 : _b.call(_a, (event == null ? void 0 : event.detail) || {});
});
(function() {
  const MOBILE_BREAKPOINT = 820;
  const DRAWER_LABELS = {
    operators: "Operators",
    dispatch: "Dispatch",
    tasks: "Tasks",
    layers: "Layers",
    diagnostics: "Diagnostics"
  };
  const BOOT_LABELS = {
    starting: "Starting up",
    "map-ready": "Map ready",
    ready: "Command ready",
    degraded: "Needs review",
    failed: "Startup issue",
    "map-failed": "Map issue"
  };
  const MOBILE_NAV_ACTIONS = [
    { id: "operators", label: "Operators" },
    { id: "dispatch", label: "Dispatch" },
    { id: "tasks", label: "Tasks" },
    { id: "layers", label: "Layers" },
    { id: "diagnostics", label: "Diag" }
  ];
  let wasCompact = false;
  let bootSnapshot = { state: "starting", detail: "Initializing command shell" };
  let opsSnapshot = { activeTab: "incidents", selectedRecord: null };
  let lastQuickActionSignature = "";
  function toTitleCase(value) {
    return String(value || "").replace(/_/g, " ").split(" ").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  }
  function inCompactMode() {
    return window.innerWidth <= MOBILE_BREAKPOINT;
  }
  function activeDrawerAction() {
    var _a, _b;
    return ((_b = (_a = window.AresCommandUi) == null ? void 0 : _a.getActiveDrawerAction) == null ? void 0 : _b.call(_a)) || "";
  }
  function setMobileMapPick(active) {
    document.body.classList.toggle("mobile-map-pick-active", Boolean(active));
    syncMobileChrome();
  }
  function clickIfPresent(element) {
    if (!element) return false;
    element.click();
    return true;
  }
  function clickFocusAction(action) {
    return clickIfPresent(document.querySelector('#ops-focus-card [data-action="'.concat(action, '"]')));
  }
  function getCurrentOpsState() {
    var _a;
    const activeTab = window.activeOpsTab || ((_a = document.querySelector(".ops-tab.active")) == null ? void 0 : _a.getAttribute("data-ops-tab")) || opsSnapshot.activeTab || "incidents";
    const selectedRecord = window.selectedOpsRecord || opsSnapshot.selectedRecord || null;
    let record = null;
    if ((selectedRecord == null ? void 0 : selectedRecord.kind) === "incident") {
      record = (window.currentIncidents || []).find((item) => item.id === selectedRecord.id) || null;
    } else if ((selectedRecord == null ? void 0 : selectedRecord.kind) === "operator") {
      record = (window.currentOperators || []).find((item) => item.id === selectedRecord.id || item.callsign === selectedRecord.id) || null;
    } else if ((selectedRecord == null ? void 0 : selectedRecord.kind) === "task") {
      record = (window.currentTasks || []).find((item) => item.id === selectedRecord.id) || null;
    }
    return { activeTab, selectedRecord, record };
  }
  function recordHasCoordinates(record) {
    return Number.isFinite(Number(record == null ? void 0 : record.lat)) && Number.isFinite(Number(record == null ? void 0 : record.lng));
  }
  function focusRecordOnMap(selection, record) {
    var _a, _b, _c, _d, _e, _f;
    if (!selection || !record) return false;
    if (selection.kind === "incident") {
      (_b = (_a = window.AresMap) == null ? void 0 : _a.focusIncident) == null ? void 0 : _b.call(_a, record);
      return true;
    }
    const id = record.id || record.callsign || selection.id;
    const focused = (_d = (_c = window.AresTracking) == null ? void 0 : _c.focusById) == null ? void 0 : _d.call(_c, id);
    if (focused) return true;
    if (recordHasCoordinates(record)) {
      (_f = (_e = window.AresMap) == null ? void 0 : _e.focusMarkerByLatLng) == null ? void 0 : _f.call(
        _e,
        Number(record.lat),
        Number(record.lng),
        "<strong>".concat(window.escapeHtml ? window.escapeHtml(record.title || record.callsign || record.name || id || selection.kind) : String(record.title || record.callsign || record.name || id || selection.kind), "</strong>")
      );
      return true;
    }
    return false;
  }
  function runMobileContextAction(actionId, context = getCurrentOpsState()) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p;
    const selection = context.selectedRecord;
    const record = context.record;
    switch (actionId) {
      case "new-incident":
        (_a = window.openOpsComposer) == null ? void 0 : _a.call(window, "incident");
        return;
      case "new-operator":
        (_b = window.openOpsComposer) == null ? void 0 : _b.call(window, "operator");
        return;
      case "new-task":
        (_c = window.openOpsComposer) == null ? void 0 : _c.call(window, "task");
        return;
      case "mark-incident":
        clickIfPresent(document.getElementById("command-mark-incident"));
        return;
      case "mark-operator":
        clickIfPresent(document.getElementById("command-mark-operator"));
        return;
      case "mark-task":
        clickIfPresent(document.getElementById("command-mark-task"));
        return;
      case "refresh-tracking":
        clickIfPresent(document.getElementById("command-refresh-tracking"));
        return;
      case "force-sync":
        clickIfPresent(document.getElementById("command-force-poll"));
        return;
      case "fit-duval":
        clickIfPresent(document.getElementById("command-fit-duval"));
        return;
      case "dispatch-panel":
        (_e = (_d = window.AresCommandUi) == null ? void 0 : _d.toggleCompactDrawer) == null ? void 0 : _e.call(_d, "dispatch");
        return;
      case "operators-panel":
        (_g = (_f = window.AresCommandUi) == null ? void 0 : _f.toggleCompactDrawer) == null ? void 0 : _g.call(_f, "operators");
        return;
      case "tasks-panel":
        (_i = (_h = window.AresCommandUi) == null ? void 0 : _h.toggleCompactDrawer) == null ? void 0 : _i.call(_h, "tasks");
        return;
      case "layers-panel":
        (_k = (_j = window.AresCommandUi) == null ? void 0 : _j.toggleCompactDrawer) == null ? void 0 : _k.call(_j, "layers");
        return;
      case "diagnostics-panel":
        (_m = (_l = window.AresCommandUi) == null ? void 0 : _l.toggleCompactDrawer) == null ? void 0 : _m.call(_l, "diagnostics");
        return;
      case "focus-edit":
        clickFocusAction("edit");
        return;
      case "focus-message":
        clickFocusAction("add-message-entry");
        return;
      case "focus-channel":
        clickFocusAction("add-comms-entry");
        return;
      case "focus-activity":
        clickFocusAction("add-activity-entry");
        return;
      case "focus-checkin":
        if (!clickFocusAction("checkin")) clickFocusAction("manual-checkin");
        return;
      case "focus-zoom":
        if (!clickFocusAction("zoom")) focusRecordOnMap(selection, record);
        return;
      case "focus-locate-record":
        focusRecordOnMap(selection, record);
        return;
      case "focus-related-incident": {
        const incidentId = (record == null ? void 0 : record.incidentId) || (record == null ? void 0 : record.assignedIncidentId);
        if (incidentId && incidentId !== "unassigned") {
          (_n = window.setSelectedOpsRecord) == null ? void 0 : _n.call(window, "incident", incidentId);
        }
        return;
      }
      case "map-pick-cancel":
        (_p = (_o = window.AresMap) == null ? void 0 : _o.cancelPointPick) == null ? void 0 : _p.call(_o);
        return;
      default:
        return;
    }
  }
  function incidentPriorityLabel(record = {}) {
    const explicit = String(record.priority || "").toLowerCase();
    if (["critical", "high", "medium", "low"].includes(explicit)) return explicit;
    const status = String(record.status || "").toLowerCase();
    if (["open", "active"].includes(status)) return "high";
    if (status === "monitoring") return "medium";
    return "low";
  }
  function incidentHasAssignedOperator(record = {}) {
    const assignment = String(record.assignedOperator || record.assignment || "").trim().toLowerCase();
    return Boolean(assignment) && !["unassigned", "none", "not assigned"].includes(assignment);
  }
  function incidentNeedsUrgentDispatch(record = {}) {
    const priority = incidentPriorityLabel(record);
    const status = String(record.status || "").toLowerCase();
    return ["critical", "high"].includes(priority) || ["open", "active"].includes(status);
  }
  function operatorNeedsReliefNow(record = {}) {
    if (String(record.status || "").toLowerCase() === "needs_relief") return true;
    if (!record.reliefDue) return false;
    const reliefDue = new Date(record.reliefDue).getTime();
    return Number.isFinite(reliefDue) && reliefDue <= Date.now();
  }
  function buildQuickActions(context = getCurrentOpsState()) {
    var _a, _b, _c;
    if (document.body.classList.contains("mobile-map-pick-active")) {
      return [
        { id: "map-pick-cancel", label: "Cancel Pick", tone: "urgent", primary: true },
        { id: "mark-incident", label: "Incident Pin" },
        { id: "mark-operator", label: "Operator Pin" },
        { id: "mark-task", label: "Task Pin" }
      ];
    }
    if (((_a = context.selectedRecord) == null ? void 0 : _a.kind) === "incident" && context.record) {
      if (incidentNeedsUrgentDispatch(context.record)) {
        return [
          {
            id: "dispatch-panel",
            label: incidentHasAssignedOperator(context.record) ? "Dispatch" : "Dispatch Now",
            tone: "urgent",
            primary: true
          },
          { id: "focus-message", label: "Message" },
          { id: "focus-zoom", label: "Zoom" },
          { id: "focus-edit", label: "Edit" }
        ];
      }
      return [
        {
          id: "focus-message",
          label: "Message",
          disabled: !document.querySelector('#ops-focus-card [data-action="add-message-entry"]'),
          tone: "primary",
          primary: true
        },
        { id: "dispatch-panel", label: "Dispatch" },
        { id: "focus-zoom", label: "Zoom" },
        { id: "focus-edit", label: "Edit" }
      ];
    }
    if (((_b = context.selectedRecord) == null ? void 0 : _b.kind) === "operator" && context.record) {
      if (operatorNeedsReliefNow(context.record)) {
        return [
          { id: "focus-checkin", label: "Relief Due", tone: "urgent", primary: true },
          { id: "dispatch-panel", label: "Dispatch" },
          { id: "focus-locate-record", label: "Locate", disabled: !recordHasCoordinates(context.record) },
          { id: "focus-edit", label: "Edit" }
        ];
      }
      return [
        { id: "focus-checkin", label: "Check In", tone: "primary", primary: true },
        { id: "focus-locate-record", label: "Locate", disabled: !recordHasCoordinates(context.record) },
        { id: "dispatch-panel", label: "Dispatch" },
        { id: "focus-edit", label: "Edit" }
      ];
    }
    if (((_c = context.selectedRecord) == null ? void 0 : _c.kind) === "task" && context.record) {
      return [
        { id: "new-task", label: "New Task", tone: "primary", primary: true },
        { id: "focus-locate-record", label: "Locate", disabled: !recordHasCoordinates(context.record) },
        { id: "focus-related-incident", label: "Incident", disabled: !(context.record.incidentId && context.record.incidentId !== "unassigned") },
        { id: "focus-edit", label: "Edit" }
      ];
    }
    if (context.activeTab === "operators") {
      return [
        { id: "new-operator", label: "New Operator", tone: "primary", primary: true },
        { id: "refresh-tracking", label: "Refresh" },
        { id: "dispatch-panel", label: "Dispatch" },
        { id: "mark-operator", label: "Map Pin" }
      ];
    }
    if (context.activeTab === "tasks") {
      return [
        { id: "new-task", label: "New Task", tone: "primary", primary: true },
        { id: "tasks-panel", label: "Tasking" },
        { id: "dispatch-panel", label: "Dispatch" },
        { id: "mark-task", label: "Map Pin" }
      ];
    }
    if (context.activeTab === "tracking") {
      return [
        { id: "refresh-tracking", label: "Refresh", tone: "primary", primary: true },
        { id: "force-sync", label: "Provider Sync" },
        { id: "operators-panel", label: "Operators" },
        { id: "fit-duval", label: "Fit Duval" }
      ];
    }
    if (context.activeTab === "system") {
      return [
        { id: "diagnostics-panel", label: "Diagnostics", tone: "primary", primary: true },
        { id: "layers-panel", label: "Layers" },
        { id: "refresh-tracking", label: "Refresh" },
        { id: "fit-duval", label: "Fit Duval" }
      ];
    }
    return [
      { id: "new-incident", label: "New Incident", tone: "primary", primary: true },
      { id: "dispatch-panel", label: "Dispatch" },
      { id: "mark-incident", label: "Map Pin" },
      { id: "fit-duval", label: "Fit Duval" }
    ];
  }
  function renderMobileActionRow(container, actions, attrName, handler, activeValue = "") {
    if (!container) return;
    container.innerHTML = actions.map((action) => {
      const classes = [
        action.primary ? "is-priority" : "",
        action.tone ? "tone-".concat(action.tone) : ""
      ].filter(Boolean).join(" ");
      return '\n      <button type="button" data-'.concat(attrName, '="').concat(action.id, '" ').concat(classes ? 'class="'.concat(classes, '"') : "", " ").concat(action.disabled ? "disabled" : "", ">\n        ").concat(action.label, "\n      </button>");
    }).join("");
    container.querySelectorAll("[data-".concat(attrName, "]")).forEach((button) => {
      const actionId = button.getAttribute("data-".concat(attrName)) || "";
      button.classList.toggle("is-active", actionId === activeValue);
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        handler(actionId);
      });
    });
  }
  function describeOpsContext(context = getCurrentOpsState(), active = activeDrawerAction()) {
    var _a, _b, _c;
    if (document.body.classList.contains("mobile-map-pick-active")) {
      return {
        label: "Map mark mode",
        detail: "Tap the map to place the selected record, or cancel to return to the console."
      };
    }
    if (((_a = context.selectedRecord) == null ? void 0 : _a.kind) === "incident" && context.record) {
      if (incidentNeedsUrgentDispatch(context.record)) {
        const priority = incidentPriorityLabel(context.record);
        const dispatchLabel = incidentHasAssignedOperator(context.record) ? "Dispatch" : "Dispatch Now";
        return {
          label: "".concat(toTitleCase(priority), " incident"),
          detail: "".concat(context.record.title || context.record.id, " needs immediate field attention. ").concat(dispatchLabel, " is pinned first.")
        };
      }
      return {
        label: "Incident focus",
        detail: "".concat(context.record.title || context.record.id, " is selected for fast dispatch and message actions.")
      };
    }
    if (((_b = context.selectedRecord) == null ? void 0 : _b.kind) === "operator" && context.record) {
      if (operatorNeedsReliefNow(context.record)) {
        return {
          label: "Relief attention",
          detail: "".concat(context.record.callsign || context.record.name || context.record.id, " is due for relief. Check-in is pinned first for accountability.")
        };
      }
      return {
        label: "Operator focus",
        detail: "".concat(context.record.callsign || context.record.name || context.record.id, " is selected for locate, check-in, and dispatch actions.")
      };
    }
    if (((_c = context.selectedRecord) == null ? void 0 : _c.kind) === "task" && context.record) {
      return {
        label: "Task focus",
        detail: "".concat(context.record.title || context.record.id, " is selected for edit and incident jump actions.")
      };
    }
    if (active) {
      return {
        label: "".concat(DRAWER_LABELS[active] || "Panel", " panel"),
        detail: "".concat(DRAWER_LABELS[active] || "Panel", " tools are open. Tap outside to close.")
      };
    }
    if (context.activeTab === "operators") {
      return { label: "Operator board", detail: "Manage operator availability, dispatch routing, and field check-ins." };
    }
    if (context.activeTab === "tasks") {
      return { label: "Task board", detail: "Work the queue, jump to linked incidents, and keep follow-ups moving." };
    }
    if (context.activeTab === "tracking") {
      return { label: "Tracking board", detail: "Watch live RF updates, refresh providers, and locate assets quickly." };
    }
    if (context.activeTab === "system") {
      return { label: "System board", detail: "Review diagnostics, persistence state, and live source health." };
    }
    return { label: "Incident board", detail: "Review active incidents, dispatch operators, and mark new activity on the map." };
  }
  function ensureMobileChrome() {
    const mapShell = document.getElementById("map-shell");
    if (!mapShell) return { strip: null, bar: null, backdrop: null };
    let strip = document.getElementById("mobile-command-strip");
    if (!strip) {
      strip = document.createElement("div");
      strip.id = "mobile-command-strip";
      strip.className = "mobile-command-strip";
      strip.innerHTML = '\n        <div class="mobile-command-strip-copy">\n          <span id="mobile-command-boot-label" class="mobile-command-eyebrow">Starting up</span>\n          <strong id="mobile-command-active-label">Map command view</strong>\n          <span id="mobile-command-detail" class="mobile-command-detail">Initializing command shell</span>\n        </div>\n        <div id="mobile-command-strip-actions" class="mobile-command-strip-actions"></div>\n        <div class="mobile-command-strip-stats">\n          <span class="mobile-command-stat-pill"><span>Tracked</span><strong id="mobile-command-stat-tracked">0</strong></span>\n          <span class="mobile-command-stat-pill"><span>Incidents</span><strong id="mobile-command-stat-incidents">0</strong></span>\n          <span class="mobile-command-stat-pill"><span>Sync</span><strong id="mobile-command-stat-sync">Standby</strong></span>\n        </div>';
      mapShell.appendChild(strip);
    }
    let bar = document.querySelector(".floating-action-bar");
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "floating-action-bar";
      bar.innerHTML = '\n        <div id="mobile-command-quick-row" class="mobile-command-quick-row"></div>\n        <div id="mobile-command-nav-row" class="mobile-command-nav-row"></div>';
      document.body.appendChild(bar);
    }
    let backdrop = document.getElementById("mobile-command-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("button");
      backdrop.type = "button";
      backdrop.id = "mobile-command-backdrop";
      backdrop.className = "mobile-command-backdrop";
      backdrop.setAttribute("aria-label", "Close command panel");
      document.body.appendChild(backdrop);
      backdrop.addEventListener("click", () => {
        var _a, _b;
        return (_b = (_a = window.AresCommandUi) == null ? void 0 : _a.closeAllDrawers) == null ? void 0 : _b.call(_a);
      });
    }
    return { strip, bar, backdrop };
  }
  function removeMobileChrome() {
    var _a, _b, _c;
    (_a = document.getElementById("mobile-command-strip")) == null ? void 0 : _a.remove();
    (_b = document.getElementById("mobile-command-backdrop")) == null ? void 0 : _b.remove();
    (_c = document.querySelector(".floating-action-bar")) == null ? void 0 : _c.remove();
    lastQuickActionSignature = "";
  }
  function syncThemeTogglePlacement(compact) {
    const button = document.getElementById("command-theme-toggle");
    if (!button) return;
    let anchor = document.getElementById("command-theme-toggle-anchor");
    if (!anchor) {
      anchor = document.createElement("span");
      anchor.id = "command-theme-toggle-anchor";
      anchor.hidden = true;
      button.insertAdjacentElement("afterend", anchor);
    }
    const mobileHost = document.getElementById("mobile-command-strip-actions");
    if (compact && mobileHost && button.parentElement !== mobileHost) {
      mobileHost.appendChild(button);
      return;
    }
    if (!compact && anchor.parentElement && button.parentElement !== anchor.parentElement) {
      anchor.parentElement.insertBefore(button, anchor);
    }
  }
  function syncMobileChrome() {
    var _a, _b, _c, _d, _e;
    const compact = inCompactMode();
    document.body.classList.toggle("mobile-compact", compact);
    document.body.classList.toggle("mobile-command-mode", compact);
    if (!compact) {
      syncThemeTogglePlacement(false);
      document.body.classList.remove("mobile-command-sheet-open");
      document.body.classList.remove("mobile-map-pick-active");
      document.body.removeAttribute("data-mobile-command-panel");
      removeMobileChrome();
      wasCompact = false;
      return;
    }
    if (!wasCompact) {
      (_b = (_a = window.AresCommandUi) == null ? void 0 : _a.closeAllDrawers) == null ? void 0 : _b.call(_a);
    }
    wasCompact = true;
    const { strip, bar } = ensureMobileChrome();
    syncThemeTogglePlacement(true);
    const tracked = String(((_c = document.getElementById("command-tracked-count")) == null ? void 0 : _c.textContent) || "0").trim();
    const incidents = String(((_d = document.getElementById("command-incident-count")) == null ? void 0 : _d.textContent) || "0").trim();
    const sync = String(((_e = document.getElementById("command-poll-status")) == null ? void 0 : _e.textContent) || "Standby").trim() || "Standby";
    const active = activeDrawerAction();
    const context = getCurrentOpsState();
    const contextDescription = describeOpsContext(context, active);
    const activeLabel = contextDescription.label || "Map command view";
    const detailText = contextDescription.detail || bootSnapshot.detail || "Tracking ".concat(tracked, " operators and ").concat(incidents, " incidents.");
    document.body.classList.toggle("mobile-command-sheet-open", Boolean(active));
    document.body.dataset.mobileCommandPanel = active || "map";
    if (strip) {
      const boot = strip.querySelector("#mobile-command-boot-label");
      const label = strip.querySelector("#mobile-command-active-label");
      const detail = strip.querySelector("#mobile-command-detail");
      const trackedStat = strip.querySelector("#mobile-command-stat-tracked");
      const incidentStat = strip.querySelector("#mobile-command-stat-incidents");
      const syncStat = strip.querySelector("#mobile-command-stat-sync");
      if (boot) boot.textContent = BOOT_LABELS[bootSnapshot.state] || toTitleCase(String(bootSnapshot.state || "ready"));
      if (label) label.textContent = activeLabel;
      if (detail) detail.textContent = detailText;
      if (trackedStat) trackedStat.textContent = tracked;
      if (incidentStat) incidentStat.textContent = incidents;
      if (syncStat) syncStat.textContent = sync;
    }
    if (bar) {
      const quickRow = bar.querySelector("#mobile-command-quick-row");
      const navRow = bar.querySelector("#mobile-command-nav-row");
      const quickActions = buildQuickActions(context);
      const quickSignature = quickActions.map((action) => "".concat(action.id, ":").concat(action.label, ":").concat(action.disabled ? "1" : "0", ":").concat(action.tone || "", ":").concat(action.primary ? "1" : "0")).join("|");
      if (quickRow && quickSignature !== lastQuickActionSignature) {
        renderMobileActionRow(
          quickRow,
          quickActions,
          "mobile-quick",
          (actionId) => runMobileContextAction(actionId, getCurrentOpsState())
        );
        lastQuickActionSignature = quickSignature;
      }
      if (navRow && !navRow.children.length) {
        renderMobileActionRow(
          navRow,
          MOBILE_NAV_ACTIONS,
          "mobile-action",
          (actionId) => {
            var _a2, _b2;
            return (_b2 = (_a2 = window.AresCommandUi) == null ? void 0 : _a2.toggleCompactDrawer) == null ? void 0 : _b2.call(_a2, actionId);
          },
          active
        );
      } else if (navRow) {
        navRow.querySelectorAll("[data-mobile-action]").forEach((button) => {
          button.classList.toggle("is-active", button.getAttribute("data-mobile-action") === active);
        });
      }
    }
  }
  function humanizeRoleLabels(root = document) {
    root.querySelectorAll("[data-role-label], .ics-role, .operator-role").forEach((el) => {
      const raw = (el.getAttribute("data-role-label") || el.textContent || "").trim();
      if (!raw) return;
      const pretty = raw.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
      el.textContent = pretty;
    });
  }
  function improveInspectButtons(root = document) {
    root.querySelectorAll('[data-action="inspect"], .inspect-button').forEach((btn) => {
      if (btn.dataset.v711Bound === "1") return;
      btn.dataset.v711Bound = "1";
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-target-id") || btn.getAttribute("data-id") || btn.dataset.id;
        if (window.focusRecordOnMap && targetId) {
          window.focusRecordOnMap(targetId);
        }
        if (window.map && window.map.invalidateSize) {
          setTimeout(() => window.map.invalidateSize(), 120);
        }
      });
    });
  }
  function improveOperatorCards(root = document) {
    root.querySelectorAll(".operator-card").forEach((card) => {
      if (card.dataset.v711Enhanced === "1") return;
      card.dataset.v711Enhanced = "1";
      const detail = card.querySelector(".detail, .details, .meta");
      if (detail && !card.querySelector(".status-chip")) {
        const status = card.getAttribute("data-status") || "Ready";
        const assignment = card.getAttribute("data-assignment") || "Unassigned";
        const wrap = document.createElement("div");
        wrap.style.display = "flex";
        wrap.style.gap = "8px";
        wrap.style.flexWrap = "wrap";
        wrap.style.marginBottom = "8px";
        wrap.innerHTML = '<span class="status-chip">'.concat(status, '</span><span class="assignment-chip">').concat(assignment, "</span>");
        card.insertBefore(wrap, card.firstChild);
      }
    });
  }
  function run() {
    syncMobileChrome();
    humanizeRoleLabels(document);
    improveInspectButtons(document);
    improveOperatorCards(document);
  }
  window.addEventListener("ares:ops-state", (event) => {
    var _a, _b;
    opsSnapshot = {
      activeTab: ((_a = event == null ? void 0 : event.detail) == null ? void 0 : _a.activeTab) || opsSnapshot.activeTab || "incidents",
      selectedRecord: ((_b = event == null ? void 0 : event.detail) == null ? void 0 : _b.selectedRecord) || null
    };
    lastQuickActionSignature = "";
    syncMobileChrome();
  });
  window.addEventListener("ares:selected-record", (event) => {
    var _a, _b, _c, _d;
    const kind = ((_a = event == null ? void 0 : event.detail) == null ? void 0 : _a.kind) || ((_b = opsSnapshot.selectedRecord) == null ? void 0 : _b.kind) || "";
    const id = ((_c = event == null ? void 0 : event.detail) == null ? void 0 : _c.id) || ((_d = opsSnapshot.selectedRecord) == null ? void 0 : _d.id) || "";
    if (kind && id) {
      opsSnapshot = { ...opsSnapshot, selectedRecord: { kind, id } };
    }
    lastQuickActionSignature = "";
    syncMobileChrome();
  });
  window.addEventListener("ares:boot-state", (event) => {
    var _a, _b;
    bootSnapshot = {
      state: ((_a = event == null ? void 0 : event.detail) == null ? void 0 : _a.state) || "ready",
      detail: ((_b = event == null ? void 0 : event.detail) == null ? void 0 : _b.detail) || ""
    };
    syncMobileChrome();
  });
  window.addEventListener("ares:tracking-updated", syncMobileChrome);
  window.addEventListener("ares:system-diagnostics", syncMobileChrome);
  window.addEventListener("ares:command-drawers", syncMobileChrome);
  window.addEventListener("ares:map-pick-started", () => setMobileMapPick(true));
  window.addEventListener("ares:map-pick-ended", () => setMobileMapPick(false));
  window.addEventListener("ares:map-pick-cancelled", () => setMobileMapPick(false));
  window.addEventListener("resize", syncMobileChrome);
  window.addEventListener("orientationchange", syncMobileChrome);
  document.addEventListener("DOMContentLoaded", run);
  setTimeout(run, 300);
  setTimeout(run, 1e3);
  setInterval(syncMobileChrome, 2e3);
})();
(function() {
  let layoutFrame = 0;
  let layoutTimer = 0;
  let lastSignature = "";
  function queueFrame(callback) {
    if (layoutFrame) window.cancelAnimationFrame(layoutFrame);
    layoutFrame = window.requestAnimationFrame(() => {
      layoutFrame = 0;
      callback();
    });
  }
  function schedule(delay = 0) {
    if (layoutTimer) {
      window.clearTimeout(layoutTimer);
      layoutTimer = 0;
    }
    const run = () => queueFrame(update);
    if (delay > 0) {
      layoutTimer = window.setTimeout(() => {
        layoutTimer = 0;
        run();
      }, delay);
      return;
    }
    run();
  }
  function update() {
    var _a, _b;
    const shell = document.getElementById("map-shell");
    if (!shell || document.body.classList.contains("mobile-command-mode")) return;
    const toolbar = document.getElementById("map-toolbar");
    const bar = document.getElementById("command-bar");
    const hint = document.getElementById("command-map-hint");
    const shellRect = shell.getBoundingClientRect();
    if (!shellRect.width || !shellRect.height) return;
    const gap = window.innerWidth <= 1100 ? 10 : 12;
    const toolbarBottom = toolbar ? Math.max(0, toolbar.getBoundingClientRect().bottom - shellRect.top) : 74;
    const barTop = Math.round(toolbarBottom + gap);
    const barHeight = bar ? Math.max(0, bar.offsetHeight) : 68;
    const hintTop = Math.round(barTop + barHeight + gap);
    const hintHeight = hint && window.getComputedStyle(hint).position !== "static" ? hint.offsetHeight : 0;
    const drawerTop = Math.round(hintTop + hintHeight + gap);
    const drawerMaxHeight = Math.max(220, Math.round(shellRect.height - drawerTop - gap));
    const signature = "".concat(barTop, ":").concat(hintTop, ":").concat(drawerTop, ":").concat(drawerMaxHeight);
    if (signature === lastSignature) return;
    lastSignature = signature;
    shell.style.setProperty("--command-bar-top", "".concat(barTop, "px"));
    shell.style.setProperty("--command-hint-top", "".concat(hintTop, "px"));
    shell.style.setProperty("--command-drawer-top", "".concat(drawerTop, "px"));
    shell.style.setProperty("--command-drawer-max-height", "".concat(drawerMaxHeight, "px"));
    (_b = (_a = window.AresMap) == null ? void 0 : _a.refreshSize) == null ? void 0 : _b.call(_a, { delay: 40 });
  }
  function installObservers() {
    if (!("ResizeObserver" in window)) return;
    const observer = new ResizeObserver(() => schedule(40));
    ["map-shell", "map-toolbar", "command-bar", "command-map-hint"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
  }
  window.AresCommandLayout = { refresh: schedule };
  window.addEventListener("load", () => {
    installObservers();
    schedule(0);
    schedule(350);
  });
  window.addEventListener("resize", () => schedule(60), { passive: true });
  window.addEventListener("orientationchange", () => schedule(180), { passive: true });
  window.addEventListener("ares:command-drawers", () => schedule(40));
  window.addEventListener("ares:theme-changed", () => schedule(40));
  window.addEventListener("ares:tracking-updated", () => schedule(80));
  window.addEventListener("ares:system-diagnostics", () => schedule(80));
  window.addEventListener("ares:map-pick-started", () => schedule(40));
  window.addEventListener("ares:map-pick-ended", () => schedule(40));
  window.addEventListener("ares:map-pick-cancelled", () => schedule(40));
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => schedule(0), { once: true });
  } else {
    schedule(0);
  }
})();
