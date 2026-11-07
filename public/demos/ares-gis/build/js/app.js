const diagnosticsState = { successes: [], failures: [] };
const clientDiagnosticsState = {
  faults: [],
  bootState: "starting",
  mapReady: false,
  lastUpdatedAt: (/* @__PURE__ */ new Date()).toISOString()
};
const clientFaultKeys = /* @__PURE__ */ new Set();
function escapeHtml(value) {
  if (value === null || value === void 0) return "";
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
window.escapeHtml = escapeHtml;
function safeClosest(target, selector) {
  if (!target || !selector) return null;
  if (typeof target.closest === "function") return target.closest(selector);
  const element = target.nodeType === 1 ? target : target.parentElement;
  return element && typeof element.closest === "function" ? element.closest(selector) : null;
}
window.safeClosest = safeClosest;
let currentReference = null;
let currentFeeds = null;
let currentIncidents = [];
let currentOperators = [];
let currentTasks = [];
let activeOpsTab = "incidents";
let selectedOpsRecord = null;
let composerState = { kind: null, mode: "create", recordId: null };
let composerDraft = null;
let composerOpenSequence = 0;
let operatorStatusFilter = "all";
let operatorCheckinCache = {};
function markBootState(state, detail = "") {
  try {
    window.__ARES_BOOT__ = window.__ARES_BOOT__ || {};
    window.__ARES_BOOT__.state = state;
    window.__ARES_BOOT__.detail = detail || "";
    window.__ARES_BOOT__.ready = state === "ready" || state === "degraded";
    window.dispatchEvent(new CustomEvent("ares:boot-state", { detail: { state, detail } }));
  } catch (_) {
  }
}
function isIosWebKitClient() {
  const ua = navigator.userAgent || "";
  const isiOSDevice = /iP(hone|od|ad)/i.test(ua) || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  const isAppleWebKit = /AppleWebKit/i.test(ua) && !/(CriOS|FxiOS|EdgiOS|OPiOS)/i.test(ua);
  return isiOSDevice && isAppleWebKit;
}
function prefersStagedMobileBoot() {
  var _a, _b;
  const narrowViewport = (_b = (_a = window.matchMedia) == null ? void 0 : _a.call(window, "(max-width: 1024px)")) == null ? void 0 : _b.matches;
  return Boolean(narrowViewport && isIosWebKitClient());
}
async function runBootTask(label, task) {
  try {
    await task();
    return { label, ok: true };
  } catch (error) {
    const message = (error == null ? void 0 : error.message) || String(error);
    recordDiagnostic("failure", label, message);
    showLoadError("Failed loading ".concat(label, ": ").concat(message));
    return { label, ok: false, message };
  }
}
async function runDeferredBootTask(label, task, delay = 0) {
  if (delay > 0) {
    await new Promise((resolve) => window.setTimeout(resolve, delay));
  }
  if ("requestAnimationFrame" in window) {
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
  }
  return runBootTask(label, task);
}
function confidenceLabel(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Low";
  if (numeric >= 0.9) return "High";
  if (numeric >= 0.7) return "Medium";
  return "Low";
}
function sourceDisplayLabel(value) {
  const normalized = String(value || "manual").replace(/[-_]+/g, " ");
  return normalized.toLowerCase() === "gps share" ? "GPS Share" : titleCase(normalized);
}
async function loadOperatorCheckins(record) {
  const key = (record == null ? void 0 : record.id) || (record == null ? void 0 : record.callsign);
  if (!key) return [];
  if (operatorCheckinCache[key]) return operatorCheckinCache[key];
  const items = await fetchJSON("/api/operators/".concat(encodeURIComponent(key), "/checkins?limit=8")).catch(() => []);
  operatorCheckinCache[key] = Array.isArray(items) ? items : [];
  return operatorCheckinCache[key];
}
function renderOperatorTimeline(target, record, items) {
  var _a;
  if (!target || !record) return;
  const activity = [];
  if ((_a = record.tracking) == null ? void 0 : _a.lastSeen) {
    activity.push({
      kind: "tracking",
      title: "".concat(sourceDisplayLabel(record.tracking.bestSource), " position update"),
      meta: "".concat(record.tracking.staleLabel || "Unknown", " - confidence ").concat(confidenceLabel(record.tracking.confidence)),
      time: record.tracking.lastSeen
    });
  }
  (Array.isArray(items) ? items : []).forEach((item) => {
    activity.push({
      kind: "checkin",
      title: "".concat(sourceDisplayLabel(item.source), " check-in - ").concat(titleCase(String(item.status || "available").replace(/_/g, " "))),
      meta: [item.location, item.note, item.reporter ? "reported by ".concat(item.reporter) : ""].filter(Boolean).join(" - ") || "No note",
      time: item.createdAt || item.timestamp
    });
  });
  activity.sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));
  target.innerHTML = activity.length ? activity.slice(0, 8).map((item) => '\n    <div class="timeline-item timeline-'.concat(item.kind, '">\n      <div class="timeline-time">').concat(escapeHtml(relativeTime(item.time)), '</div>\n      <div class="timeline-body"><strong>').concat(escapeHtml(item.title), "</strong><span>").concat(escapeHtml(item.meta), "</span></div>\n    </div>")).join("") : '<div class="empty-state small">No recent operator activity yet.</div>';
}
window.currentIncidents = currentIncidents;
window.currentOperators = currentOperators;
window.currentTasks = currentTasks;
window.selectedOpsRecord = selectedOpsRecord;
async function loadDispatchRecommendations(incidentId) {
  return fetchJSON("/api/dispatch/incidents/".concat(encodeURIComponent(incidentId), "/nearest?limit=5")).catch(() => []);
}
function renderDispatchCandidates(target, incident, candidates) {
  if (!target) return;
  const items = Array.isArray(candidates) ? candidates : [];
  if (!items.length) {
    target.innerHTML = '<div class="empty-state small">No mapped operators are currently available for dispatch recommendations.</div>';
    return;
  }
  target.innerHTML = items.map((item) => {
    const status = titleCase(String(item.status || "available").replace(/_/g, " "));
    return '\n      <div class="dispatch-candidate '.concat(item.dispatchEligible ? "eligible" : "limited", '">\n        <div class="dispatch-candidate-main">\n          <strong>').concat(escapeHtml(item.callsign || item.name || "Operator"), "</strong>\n          <span>").concat(escapeHtml(item.name || "")).concat(item.name ? " - " : "").concat(escapeHtml(status), " - ").concat(escapeHtml(item.distanceMiles), ' mi away</span>\n        </div>\n        <div class="dispatch-candidate-actions">\n          <button class="button button-secondary dispatch-focus-operator" data-operator-id="').concat(escapeHtml(item.id || item.callsign), '">Inspect</button>\n          <button class="button dispatch-assign-operator" data-operator-id="').concat(escapeHtml(item.id || item.callsign), '" data-incident-id="').concat(escapeHtml(incident.id), '">Dispatch</button>\n        </div>\n      </div>');
  }).join("");
  target.querySelectorAll(".dispatch-focus-operator").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.operatorId;
      if (!id) return;
      setActiveOpsTab("operators");
      setSelectedOpsRecord("operator", id);
    });
  });
  target.querySelectorAll(".dispatch-assign-operator").forEach((button) => {
    button.addEventListener("click", async () => {
      var _a, _b;
      const operatorId = button.dataset.operatorId;
      const incidentId = button.dataset.incidentId;
      if (!operatorId || !incidentId) return;
      try {
        await ensureAdminToken(false);
        await postWithAdminRetry("/api/dispatch/assignments", {
          operatorId,
          incidentId,
          status: "assigned",
          incidentStatus: "active",
          source: "dispatch",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          note: "Assigned from dispatch recommendations"
        }, "POST");
        showOpsToast("Operator dispatched to incident.", "success");
        await renderOperationalWorkspace();
        setActiveOpsTab("incidents");
        setSelectedOpsRecord("incident", incidentId);
        (_b = (_a = window.AresDispatch) == null ? void 0 : _a.refresh) == null ? void 0 : _b.call(_a);
      } catch (error) {
        console.error(error);
        showOpsToast(error.message || "Unable to dispatch operator.", "error");
      }
    });
  });
}
function scheduleMapRefresh(delay = 60) {
  var _a;
  if (!((_a = window.AresMap) == null ? void 0 : _a.refreshSize)) return;
  window.AresMap.refreshSize({ delay });
}
function syncOpsGlobals() {
  window.currentIncidents = currentIncidents;
  window.currentOperators = currentOperators;
  window.currentTasks = currentTasks;
  window.selectedOpsRecord = selectedOpsRecord;
  window.activeOpsTab = activeOpsTab;
  try {
    window.dispatchEvent(new CustomEvent("ares:ops-state", {
      detail: {
        activeTab: activeOpsTab,
        selectedRecord: selectedOpsRecord ? { ...selectedOpsRecord } : null
      }
    }));
  } catch (_) {
  }
}
function getDefaultMapCenter() {
  try {
    if (window.map && typeof window.map.getCenter === "function") {
      const center = window.map.getCenter();
      if (center && Number.isFinite(center.lat) && Number.isFinite(center.lng)) return center;
    }
  } catch (_) {
  }
  return { lat: 30.3322, lng: -81.6557 };
}
function formatCoordinateInput(value, digits = 6) {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(digits) : "";
}
function readComposerDraftForm() {
  const form = document.getElementById("ops-composer-form");
  if (!form || !composerState.kind) return null;
  const fd = new FormData(form);
  const values = {};
  for (const [key, value] of fd.entries()) values[key] = value;
  return {
    kind: composerState.kind,
    mode: composerState.mode,
    recordId: composerState.recordId,
    values
  };
}
function buildLocationSummary(values = {}) {
  const lat = Number(values.lat);
  const lng = Number(values.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return "".concat(lat.toFixed(5), ", ").concat(lng.toFixed(5));
  return "";
}
function beginMapLocationPick(kind) {
  var _a;
  const draft = readComposerDraftForm() || composerDraft || { kind, mode: composerState.mode || "create", recordId: composerState.recordId, values: {} };
  composerDraft = draft;
  closeComposer({ preserveDraft: true });
  const label = kind === "incident" ? "incident" : kind === "operator" ? "operator" : "task";
  showOpsToast("Click the map to set the ".concat(label, " location. Press Esc to cancel."), "info");
  const picker = (_a = window.AresMap) == null ? void 0 : _a.beginPointPick;
  if (typeof picker !== "function") {
    showOpsToast("Map point picker is unavailable in this build.", "error");
    openComposer(kind, draft.mode || "create", draft.values || {});
    return;
  }
  const currentValues = { ...draft.values || {} };
  const detailState = kind === "operator" ? {
    heading: "Operator Location Pin",
    callsign: currentValues.callsign || currentValues.id || "",
    name: currentValues.name || "",
    status: currentValues.status || "",
    role: currentValues.role || currentValues.icsRole || (selectedOpsRecord == null ? void 0 : selectedOpsRecord.role) || "",
    assignment: currentValues.assignedIncidentTitle || currentValues.assignment || (selectedOpsRecord == null ? void 0 : selectedOpsRecord.assignedIncidentTitle) || currentValues.assignedIncidentId || "Unassigned",
    capabilities: currentValues.capabilities || "",
    location: currentValues.location || (selectedOpsRecord == null ? void 0 : selectedOpsRecord.location) || ""
  } : null;
  picker({
    kind,
    label: "Select ".concat(titleCase(label), " location"),
    details: detailState,
    onPick: ({ lat, lng }) => {
      const nextValues = { ...(composerDraft == null ? void 0 : composerDraft.values) || draft.values || {} };
      nextValues.lat = formatCoordinateInput(lat);
      nextValues.lng = formatCoordinateInput(lng);
      if ((kind === "operator" || kind === "task") && !String(nextValues.location || "").trim()) {
        nextValues.location = buildLocationSummary(nextValues) || "".concat(lat.toFixed(5), ", ").concat(lng.toFixed(5));
      }
      composerDraft = { kind, mode: draft.mode || "create", recordId: draft.recordId || null, values: nextValues };
      openComposer(kind, composerDraft.mode || "create", nextValues);
      showOpsToast("".concat(titleCase(label), " location captured from map."), "success");
    },
    onCancel: () => {
      const restore = composerDraft || draft;
      if (restore) openComposer(kind, restore.mode || "create", restore.values || {});
      showOpsToast("Map location pick cancelled.", "info");
    }
  });
}
function useMapCenterForComposer(kind) {
  const form = document.getElementById("ops-composer-form");
  if (!form) return;
  const center = getDefaultMapCenter();
  const latInput = form.querySelector('[name="lat"]');
  const lngInput = form.querySelector('[name="lng"]');
  if (latInput) latInput.value = formatCoordinateInput(center.lat);
  if (lngInput) lngInput.value = formatCoordinateInput(center.lng);
  const locationInput = form.querySelector('[name="location"]');
  if (locationInput && !String(locationInput.value || "").trim()) {
    locationInput.value = "".concat(center.lat.toFixed(5), ", ").concat(center.lng.toFixed(5));
  }
  showOpsToast("".concat(titleCase(kind), " coordinates set from current map center."), "success");
}
function safeBind(element, eventName, handler) {
  if (!element || !handler) return;
  element.__opsBound = element.__opsBound || {};
  if (element.__opsBound[eventName]) return;
  element.addEventListener(eventName, handler);
  element.__opsBound[eventName] = true;
}
function registerWindowOpsHandlers() {
  window.openOpsComposer = function(kind, options = {}) {
    try {
      if (options && options.mapPick) {
        composerState.kind = kind;
        composerState.mode = "create";
        composerState.recordId = null;
        composerDraft = { kind, mode: "create", recordId: null, values: {} };
        beginMapLocationPick(kind);
      } else {
        openComposer(kind);
      }
      console.info("[OPS] composer opened for", kind, options);
    } catch (error) {
      console.error("[OPS] composer open failed", error);
      showOpsToast((error == null ? void 0 : error.message) || "Form failed to open.", "error");
    }
  };
  window.handleSaveAdminToken = function(event) {
    if (event) event.preventDefault();
    try {
      const ok = saveAdminTokenFromForm();
      if (ok) showOpsToast("Admin token saved.", "success");
    } catch (error) {
      console.error("[OPS] token save failed", error);
      showOpsToast((error == null ? void 0 : error.message) || "Unable to save token.", "error");
    }
    return false;
  };
  window.handleClearAdminToken = function(event) {
    if (event) event.preventDefault();
    try {
      clearAdminToken();
    } catch (error) {
      console.error("[OPS] token clear failed", error);
      showOpsToast((error == null ? void 0 : error.message) || "Unable to clear token.", "error");
    }
    return false;
  };
}
function bindOpsConsoleControls() {
  const createHandlers = {
    incident: () => window.openOpsComposer("incident"),
    operator: () => window.openOpsComposer("operator"),
    task: () => window.openOpsComposer("task")
  };
  ["incident", "operator", "task"].forEach((kind) => {
    safeBind(document.getElementById("create-".concat(kind)), "click", createHandlers[kind]);
    document.querySelectorAll('[data-ops-create="'.concat(kind, '"]')).forEach((button) => safeBind(button, "click", createHandlers[kind]));
  });
  const tokenForm = document.getElementById("ops-token-form");
  if (tokenForm && !tokenForm.__opsSubmitBound) {
    tokenForm.addEventListener("submit", window.handleSaveAdminToken);
    tokenForm.__opsSubmitBound = true;
  }
  safeBind(document.getElementById("ops-set-token"), "click", window.handleSaveAdminToken);
  safeBind(document.getElementById("ops-clear-token"), "click", window.handleClearAdminToken);
  safeBind(document.getElementById("ops-composer-close"), "click", closeComposer);
  document.querySelectorAll('[data-close-ops-modal="true"]').forEach((el) => safeBind(el, "click", closeComposer));
  safeBind(document.getElementById("fit-duval"), "click", () => {
    var _a, _b;
    return (_b = (_a = window.AresMap) == null ? void 0 : _a.fitDuval) == null ? void 0 : _b.call(_a);
  });
  safeBind(document.getElementById("locate-me"), "click", () => {
    var _a, _b;
    return (_b = (_a = window.AresMap) == null ? void 0 : _a.locateMe) == null ? void 0 : _b.call(_a);
  });
  safeBind(document.getElementById("refresh-feeds"), "click", async () => {
    try {
      await refreshFeeds();
      await syncRealtimeConsoles();
    } catch (error) {
      showLoadError("Refresh failed: ".concat(error.message || error));
    }
  });
  document.querySelectorAll(".ops-tab").forEach((button) => {
    safeBind(button, "click", () => setActiveOpsTab(button.dataset.opsTab || "incidents"));
  });
  document.querySelectorAll(".section-chip").forEach((button) => {
    safeBind(button, "click", () => {
      setActiveSection(button.dataset.section || "all");
      scheduleMapRefresh(90);
    });
  });
  document.querySelectorAll(".accordion-toggle").forEach((button) => {
    safeBind(button, "click", () => {
      var _a;
      (_a = button.closest(".accordion")) == null ? void 0 : _a.classList.toggle("open");
      scheduleMapRefresh(90);
    });
  });
}
registerWindowOpsHandlers();
window.renderOperationalWorkspace = renderOperationalWorkspace;
window.openComposer = openComposer;
window.setSelectedOpsRecord = setSelectedOpsRecord;
window.renderAuthPanel = renderAuthPanel;
window.ensureAdminToken = ensureAdminToken;
window.clearAdminToken = clearAdminToken;
window.renderOperationalWorkspace = renderOperationalWorkspace;
window.setActiveOpsTab = setActiveOpsTab;
window.showOpsToast = showOpsToast;
function showOpsToast(message, variant = "info") {
  let host = document.getElementById("ops-toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "ops-toast-host";
    host.className = "ops-toast-host";
    document.body.appendChild(host);
  }
  const toast = document.createElement("div");
  toast.className = "ops-toast ".concat(variant);
  toast.textContent = message;
  host.appendChild(toast);
  window.setTimeout(() => {
    toast.classList.add("leaving");
    window.setTimeout(() => toast.remove(), 250);
  }, 3200);
}
function relativeTime(value) {
  if (!value) return "No refresh yet";
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 6e4);
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return "Updated ".concat(minutes, " min ago");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return "Updated ".concat(hours, " hr ago");
  return "Updated ".concat(Math.round(hours / 24), " day ago");
}
function titleCase(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}
const ICS_OPERATOR_ROLES = [
  { value: "unassigned", label: "Unassigned" },
  { value: "net_control", label: "Net Control" },
  { value: "field_operator", label: "Field Operator" },
  { value: "shadow", label: "Shadow / Liaison" },
  { value: "logistics", label: "Logistics" },
  { value: "damage_assessment", label: "Damage Assessment" },
  { value: "shelter", label: "Shelter Communications" },
  { value: "planning", label: "Planning / Intel" }
];
const RESOURCE_TYPE_OPTIONS = [
  { value: "operator", label: "Operator" },
  { value: "net_control", label: "Net Control" },
  { value: "rapid_response", label: "Rapid Response" },
  { value: "mobile", label: "Mobile Unit" },
  { value: "shelter", label: "Shelter Team" },
  { value: "damage_assessment", label: "Damage Assessment" },
  { value: "logistics", label: "Logistics" },
  { value: "planning", label: "Planning / Intel" },
  { value: "liaison", label: "Liaison / Shadow" }
];
const REACHABILITY_OPTIONS = [
  { value: "unknown", label: "Unknown" },
  { value: "voice", label: "Voice" },
  { value: "data", label: "Data" },
  { value: "voice_data", label: "Voice + Data" },
  { value: "limited", label: "Limited" },
  { value: "lost", label: "Lost Contact" }
];
const GOKIT_STATUS_OPTIONS = [
  { value: "unknown", label: "Unknown" },
  { value: "ready", label: "Ready" },
  { value: "partial", label: "Partial" },
  { value: "resupply_needed", label: "Resupply Needed" },
  { value: "unavailable", label: "Unavailable" }
];
const VEHICLE_STATUS_OPTIONS = [
  { value: "unknown", label: "Unknown" },
  { value: "available", label: "Available" },
  { value: "limited", label: "Limited" },
  { value: "out_of_service", label: "Out of Service" }
];
function getOperatorCallsign(item) {
  return (item == null ? void 0 : item.callsign) || (item == null ? void 0 : item.name) || (item == null ? void 0 : item.id) || "UNKNOWN";
}
function getIncidentDisplayName(item) {
  return (item == null ? void 0 : item.title) || (item == null ? void 0 : item.name) || (item == null ? void 0 : item.id) || "Untitled Incident";
}
function buildSelectOptions(items = [], selected = "") {
  return items.map((item) => {
    var _a, _b;
    const value = (_a = item == null ? void 0 : item.value) != null ? _a : item;
    const label = (_b = item == null ? void 0 : item.label) != null ? _b : titleCase(item);
    return '<option value="'.concat(escapeHtml(value), '" ').concat(String(selected) === String(value) ? "selected" : "", ">").concat(escapeHtml(label), "</option>");
  }).join("");
}
function resolveIncidentDisplay(record = {}) {
  if (record.assignedIncidentTitle) return record.assignedIncidentTitle;
  if (record.incidentTitle) return record.incidentTitle;
  if (record.assignment && record.assignment !== "unassigned") return record.assignment;
  if (record.assignedIncidentId) {
    const match = currentIncidents.find((item) => item.id === record.assignedIncidentId);
    if (match) return getIncidentDisplayName(match);
  }
  if (record.incidentId) {
    const match = currentIncidents.find((item) => item.id === record.incidentId);
    if (match) return getIncidentDisplayName(match);
  }
  return "unassigned";
}
function buildOperatorOptions(selected = "unassigned") {
  const options = ['<option value="unassigned">Unassigned</option>'];
  currentOperators.forEach((item) => {
    const value = getOperatorCallsign(item);
    const label = (item == null ? void 0 : item.name) ? "".concat(value, " - ").concat(item.name) : value;
    options.push('<option value="'.concat(escapeHtml(value), '" ').concat(String(selected) === String(value) ? "selected" : "", ">").concat(escapeHtml(label), "</option>"));
  });
  return options.join("");
}
function buildIncidentOptions(selected = "unassigned") {
  const options = ['<option value="unassigned">Unassigned</option>'];
  currentIncidents.forEach((item) => {
    const value = item.id;
    const label = getIncidentDisplayName(item);
    options.push('<option value="'.concat(escapeHtml(value), '" ').concat(String(selected) === String(value) ? "selected" : "", ">").concat(escapeHtml(label), "</option>"));
  });
  return options.join("");
}
function buildRoleOptions(selected = "unassigned") {
  return buildSelectOptions(ICS_OPERATOR_ROLES, selected);
}
function buildAssignmentSelect(name, selected = "unassigned", type = "operator") {
  const options = type === "incident" ? buildIncidentOptions(selected) : type === "role" ? buildRoleOptions(selected) : buildOperatorOptions(selected);
  return '<select name="'.concat(name, '">').concat(options, "</select>");
}
function formatMultilineValue(value, emptyText = "None") {
  const text = String(value || "").trim();
  if (!text) return emptyText;
  return escapeHtml(text).replace(/\r?\n/g, "<br />");
}
function formatDateTimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return "".concat(year, "-").concat(month, "-").concat(day, "T").concat(hours, ":").concat(minutes);
}
function formatDateTimeDisplay(value, emptyText = "Not set") {
  if (!value) return emptyText;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}
function operatorNeedsRelief(item = {}) {
  if (String(item.status || "").toLowerCase() === "needs_relief") return true;
  if (!item.reliefDue) return false;
  const reliefDue = new Date(item.reliefDue).getTime();
  return Number.isFinite(reliefDue) && reliefDue <= Date.now();
}
function operatorResourceSummary(item = {}) {
  return [item.resourceType ? titleCase(item.resourceType) : "", item.team || ""].filter(Boolean).join(" - ") || "General operator";
}
function incidentCommsSummary(item = {}) {
  return [item.primaryFrequency || "", item.tacticalFrequency || ""].filter(Boolean).join(" / ") || "Comms plan not set";
}
function confirmDestructive(message) {
  return window.confirm(message);
}
function adminHeaders() {
  const token = localStorage.getItem("apiAdminToken") || "";
  return token ? { "x-api-token": token, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}
async function requestJSON(url, options = {}) {
  const response = await fetch(url, options);
  let payload = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else {
    const text = await response.text();
    payload = text ? { error: text } : null;
  }
  if (!response.ok) {
    const err = new Error((payload == null ? void 0 : payload.error) || (payload == null ? void 0 : payload.message) || "Request failed: ".concat(response.status));
    err.status = response.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}
const OPS_STATUS_KEY = "aresDuvalOpsStatusV37";
function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
}
function loadOpsStatusStore() {
  return safeJsonParse(localStorage.getItem(OPS_STATUS_KEY) || "{}", {});
}
function saveOpsStatusStore(store) {
  localStorage.setItem(OPS_STATUS_KEY, JSON.stringify(store));
}
function getOpsKey(props = {}) {
  return [props.station || props.name || "Location", props.address || "", props.frequency || "", props.type || props.category || ""].join("|");
}
function normalizeStatus(value) {
  const allowed = { available: "Available", monitoring: "Monitoring", unavailable: "Unavailable" };
  return allowed[String(value || "").toLowerCase()] || "Available";
}
function statusClass(value) {
  const normalized = normalizeStatus(value).toLowerCase();
  return normalized === "monitoring" ? "status-monitoring" : normalized === "unavailable" ? "status-unavailable" : "status-available";
}
function formatLastUpdated(value) {
  if (!value) return "Not checked in yet";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "Not checked in yet";
  return dt.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function getOpsRecord(props = {}) {
  const store = loadOpsStatusStore();
  const record = store[getOpsKey(props)] || {};
  return {
    status: normalizeStatus(record.status),
    lastUpdated: record.lastUpdated || null
  };
}
function updateOpsRecord(props = {}, nextStatus, touchTimestamp = false) {
  const store = loadOpsStatusStore();
  const key = getOpsKey(props);
  const current = store[key] || {};
  store[key] = {
    status: normalizeStatus(nextStatus || current.status),
    lastUpdated: touchTimestamp ? (/* @__PURE__ */ new Date()).toISOString() : current.lastUpdated || null
  };
  saveOpsStatusStore(store);
}
function collectOperationalAssets(reference) {
  if (!reference) return [];
  const groups = [
    { label: "Fire / Rescue", data: reference.jfrd_station_directory },
    { label: "Shelter", data: reference.shelters_official },
    { label: "Hospital", data: reference.hospital_directory },
    { label: "Radio", data: reference.repeater_sites }
  ];
  const assets = [];
  groups.forEach((group) => {
    var _a;
    (((_a = group.data) == null ? void 0 : _a.features) || []).forEach((feature) => {
      const props = feature.properties || {};
      assets.push({ feature, props, label: group.label });
    });
  });
  return assets;
}
function renderOpsStatusPanel(reference) {
  const container = document.getElementById("ops-status-cards");
  const summary = document.getElementById("ops-status-summary");
  if (!container || !summary) return;
  const assets = collectOperationalAssets(reference);
  summary.textContent = "".concat(assets.length, " tracked");
  container.innerHTML = "";
  assets.slice(0, 18).forEach((asset) => {
    const { props, feature, label } = asset;
    const record = getOpsRecord(props);
    const card = document.createElement("div");
    const opsJson = JSON.stringify(props).replace(/"/g, "&quot;");
    card.className = "info-card compact-card ops-card";
    card.innerHTML = '\n      <div class="info-card-head">\n        <div>\n          <div class="ops-type">'.concat(label, "</div>\n          <h3>").concat(props.station || props.name || "Location", '</h3>\n          <div class="card-subtle">').concat(props.address || props.location || "Address not listed", '</div>\n        </div>\n      </div>\n      <div class="status-line">\n        <span class="status-chip ').concat(statusClass(record.status), '">Status: ').concat(record.status, "</span>\n        <span>Last Updated: ").concat(formatLastUpdated(record.lastUpdated), "</span>\n      </div>\n      ").concat(featureActions(props, feature), '\n      <div class="action-row compact-three">\n        <button class="button button-ghost ops-action" data-action="set-status" data-status="Available" data-ops=\'').concat(opsJson, '\'>Available</button>\n        <button class="button button-ghost ops-action" data-action="set-status" data-status="Monitoring" data-ops=\'').concat(opsJson, '\'>Monitoring</button>\n        <button class="button button-ghost ops-action" data-action="set-status" data-status="Unavailable" data-ops=\'').concat(opsJson, '\'>Unavailable</button>\n      </div>\n      <div class="action-row">\n        <button class="button button-secondary ops-action" data-action="check-in" data-ops=\'').concat(opsJson, '\'>Check In</button>\n        <button class="button button-secondary ops-action" data-action="clear-status" data-ops=\'').concat(opsJson, "'>Clear</button>\n      </div>\n    ");
    container.appendChild(card);
  });
  wireCardActions(container);
}
function showLoadError(message) {
  const cards = document.getElementById("feed-cards");
  if (cards) {
    const card = document.createElement("div");
    card.className = "feed-card";
    card.innerHTML = '<div class="feed-card-head"><div><h3>Load issue</h3><div class="card-subtle">'.concat(message, '</div></div><span class="feed-badge feed-alert">Error</span></div>');
    cards.prepend(card);
  }
}
function recordDiagnostic(kind, label, detail) {
  const bucket = kind === "failure" ? diagnosticsState.failures : diagnosticsState.successes;
  bucket.push({ label, detail });
  renderDiagnostics();
}
function describeClientFault(detail) {
  if (!detail) return "Unknown client fault";
  if (typeof detail === "string") return detail;
  if (detail.stack) return detail.stack;
  if (detail.message) return detail.message;
  try {
    return JSON.stringify(detail);
  } catch (_) {
    return String(detail);
  }
}
function recordClientFault(label, detail) {
  const message = describeClientFault(detail);
  const key = "".concat(label, ":").concat(message);
  if (clientFaultKeys.has(key)) return;
  clientFaultKeys.add(key);
  clientDiagnosticsState.faults.unshift({
    label,
    detail: message,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  clientDiagnosticsState.faults = clientDiagnosticsState.faults.slice(0, 10);
  clientDiagnosticsState.lastUpdatedAt = (/* @__PURE__ */ new Date()).toISOString();
  recordDiagnostic("failure", label, message);
}
window.AresClientDiagnostics = {
  recordFault: recordClientFault,
  getSnapshot() {
    return {
      ...clientDiagnosticsState,
      faults: clientDiagnosticsState.faults.slice()
    };
  }
};
function renderDiagnostics() {
  const cards = document.getElementById("diagnostics-cards");
  const summary = document.getElementById("diagnostics-summary");
  const startup = document.getElementById("status-startup");
  if (!cards || !summary || !startup) return;
  cards.innerHTML = "";
  const s = diagnosticsState.successes.length;
  const f = diagnosticsState.failures.length;
  summary.textContent = "".concat(s, " ok / ").concat(f, " issues");
  startup.textContent = f ? "Startup with ".concat(f, " issue").concat(f === 1 ? "" : "s") : "Core layers loaded";
  if (!s && !f) {
    cards.innerHTML = '<div class="info-card compact-card"><div class="card-subtle">Waiting for startup checks...</div></div>';
    summary.textContent = "Pending";
    startup.textContent = "Starting...";
    return;
  }
  diagnosticsState.failures.slice(0, 6).forEach((item) => {
    const card = document.createElement("div");
    card.className = "info-card compact-card";
    card.innerHTML = '<div class="info-card-head"><div><h3>'.concat(item.label, '</h3><div class="card-subtle">').concat(item.detail, '</div></div><span class="feed-badge feed-alert">Issue</span></div>');
    cards.appendChild(card);
  });
  diagnosticsState.successes.slice(0, 6).forEach((item) => {
    const card = document.createElement("div");
    card.className = "info-card compact-card";
    card.innerHTML = '<div class="info-card-head"><div><h3>'.concat(item.label, '</h3><div class="card-subtle">').concat(item.detail, '</div></div><span class="feed-badge feed-ok">OK</span></div>');
    cards.appendChild(card);
  });
  updateQuickStats();
}
function feedBadgeClass(feed) {
  return buildFeedSourceBadgeMeta(feed).className;
}
function feedBadgeLabel(feed) {
  return buildFeedSourceBadgeMeta(feed).label;
}
function formatRecordCount(value) {
  const count = Number.isFinite(Number(value)) ? Number(value) : 0;
  return "".concat(count, " record").concat(count === 1 ? "" : "s");
}
function buildFeedSourceBadgeMeta(feed = {}) {
  const state = String((feed == null ? void 0 : feed.state) || "").toLowerCase();
  if (state === "live") return { label: "Live", className: "feed-ok", detail: "".concat(feed.source || "Feed source", " - ").concat(formatRecordCount(feed.count)) };
  if (state === "degraded" || state === "cached" || state === "reference") {
    return { label: "Fallback", className: state === "degraded" ? "feed-warn" : "feed-info", detail: "".concat(feed.source || "Cached source", " - ").concat(formatRecordCount(feed.count)) };
  }
  if (state === "warming" || state === "loading") return { label: "Warming", className: "feed-pending", detail: "Refreshing feed status..." };
  if (state === "offline" || (feed == null ? void 0 : feed.error) || (feed == null ? void 0 : feed.lastError)) return { label: "Broken", className: "feed-alert", detail: (feed == null ? void 0 : feed.error) || (feed == null ? void 0 : feed.lastError) || "Feed unavailable" };
  return { label: "Empty", className: "feed-empty", detail: "".concat(feed.source || "Feed source", " - no records yet") };
}
function buildLayerSourceBadgeMeta(layer = {}) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i;
  const status = String((_b = (_a = layer == null ? void 0 : layer.currentStatus) != null ? _a : layer == null ? void 0 : layer.status) != null ? _b : "").toLowerCase();
  const mode = String((_d = (_c = layer == null ? void 0 : layer.currentMode) != null ? _c : layer == null ? void 0 : layer.mode) != null ? _d : "").toLowerCase();
  const count = Number.isFinite(Number((_f = (_e = layer == null ? void 0 : layer.currentCount) != null ? _e : layer == null ? void 0 : layer.count) != null ? _f : layer == null ? void 0 : layer.featureCount)) ? Number((_h = (_g = layer == null ? void 0 : layer.currentCount) != null ? _g : layer == null ? void 0 : layer.count) != null ? _h : layer == null ? void 0 : layer.featureCount) : 0;
  const source = (layer == null ? void 0 : layer.currentSource) || (layer == null ? void 0 : layer.source) || (mode === "static" || status === "static" || (layer == null ? void 0 : layer.remote) === false ? "Local static layer" : "Live source");
  const error = (layer == null ? void 0 : layer.currentError) || (layer == null ? void 0 : layer.error) || "";
  const warming = Boolean((_i = layer == null ? void 0 : layer.currentWarming) != null ? _i : layer == null ? void 0 : layer.warming);
  const countDetail = formatRecordCount(count);
  if (warming && (!status || status === "unknown")) {
    return { label: "Warming", className: "feed-pending", detail: "Refreshing live source status..." };
  }
  if (mode === "static" || status === "static" || (layer == null ? void 0 : layer.remote) === false) {
    return { label: "Static", className: "feed-muted", detail: "".concat(source, " - ").concat(countDetail) };
  }
  if (status === "offline" || mode === "offline" || error) {
    const fallbackDetail = (layer == null ? void 0 : layer.fallbackAvailable) ? "Fallback is available." : "No fallback available.";
    return { label: "Broken", className: "feed-alert", detail: error || "".concat(source, " unavailable. ").concat(fallbackDetail) };
  }
  if (status === "fallback" || mode === "fallback") {
    if (count > 0) return { label: "Fallback", className: "feed-warn", detail: "".concat(source, " - ").concat(countDetail) };
    return { label: "Empty", className: "feed-empty", detail: "".concat(source, " returned no records") };
  }
  if (status === "live" || mode === "live") {
    if (count > 0) return { label: "Live", className: "feed-ok", detail: "".concat(source, " - ").concat(countDetail) };
    return { label: "Empty", className: "feed-empty", detail: "".concat(source, " returned no records") };
  }
  return { label: "Empty", className: "feed-empty", detail: "".concat(source, " - awaiting source data") };
}
function renderSourceBadge(meta = {}) {
  return '<span class="feed-badge '.concat(escapeHtml(meta.className || "feed-empty"), '">').concat(escapeHtml(meta.label || "Unknown"), "</span>");
}
window.AresSourceUi = {
  feedBadgeMeta: buildFeedSourceBadgeMeta,
  layerBadgeMeta: buildLayerSourceBadgeMeta,
  badgeHtml: renderSourceBadge,
  formatRecordCount
};
function renderLayerGroups(layers, filter = "") {
  const groupsEl = document.getElementById("layer-groups");
  const query = filter.trim().toLowerCase();
  const visibleLayers = layers.filter((layer) => {
    const haystack = "".concat(layer.title, " ").concat(layer.description, " ").concat(layer.category).toLowerCase();
    return !query || haystack.includes(query);
  });
  document.getElementById("layer-results-count").textContent = "".concat(visibleLayers.length, " shown");
  document.getElementById("status-layer-count").textContent = "".concat(window.AresLayers.getActiveLayerCount(), " active");
  const grouped = visibleLayers.reduce((acc, layer) => {
    const key = layer.category || "reference";
    acc[key] = acc[key] || [];
    acc[key].push(layer);
    return acc;
  }, {});
  groupsEl.innerHTML = "";
  ["operations", "infrastructure", "transportation", "statewide", "weather", "reference"].forEach((category) => {
    const items = grouped[category];
    if (!items || !items.length) return;
    const group = document.createElement("div");
    group.className = "layer-group";
    const label = category === "operations" ? "Operations" : category === "statewide" ? "Statewide Ops" : titleCase(category);
    group.innerHTML = '<div class="layer-group-title">'.concat(label, '</div><div class="layer-list"></div>');
    const list = group.querySelector(".layer-list");
    items.forEach((layer) => {
      var _a, _b;
      const sourceMeta = buildLayerSourceBadgeMeta(layer);
      const countValue = Number.isFinite(Number((_a = layer.currentCount) != null ? _a : layer.featureCount)) ? Number((_b = layer.currentCount) != null ? _b : layer.featureCount) : 0;
      const row = document.createElement("label");
      row.className = "layer-item";
      row.innerHTML = '\n        <input type="checkbox" data-layer-id="'.concat(layer.id, '" ').concat(layer.defaultVisible ? "checked" : "", '>\n        <div class="layer-item-main">\n          <div class="layer-item-title"><span class="layer-swatch" style="background:').concat(escapeHtml(layer.color), '"></span><span>').concat(escapeHtml(layer.title), '</span></div>\n          <div class="layer-item-desc">').concat(escapeHtml(layer.description || ""), '</div>\n          <div class="layer-item-statuses">').concat(renderSourceBadge(sourceMeta), '</div>\n          <div class="layer-item-detail">').concat(escapeHtml(sourceMeta.detail || ""), '</div>\n        </div>\n        <div class="layer-feature-count">').concat(escapeHtml(String(countValue)), "</div>\n      ");
      const input = row.querySelector("input");
      input.addEventListener("change", async (event) => {
        const id = event.target.dataset.layerId;
        try {
          if (event.target.checked) {
            await window.AresLayers.loadLayer(id);
            recordDiagnostic("success", getLayerTitle(id), "Layer loaded by user.");
          } else {
            window.AresLayers.removeLayer(id);
          }
        } catch (error) {
          event.target.checked = false;
          recordDiagnostic("failure", getLayerTitle(id), error.message || String(error));
          showLoadError("Layer failed: ".concat(getLayerTitle(id), " - ").concat(error.message || error));
        }
        document.getElementById("status-layer-count").textContent = "".concat(window.AresLayers.getActiveLayerCount(), " active");
      });
      list.appendChild(row);
    });
    groupsEl.appendChild(group);
  });
}
function getLayerTitle(layerId) {
  const meta = layerCatalog.find((layer) => layer.id === layerId);
  return (meta == null ? void 0 : meta.title) || layerId;
}
async function renderLayers() {
  var _a;
  const layers = await fetchJSON("/api/layers");
  layerCatalog.splice(0, layerCatalog.length, ...layers);
  renderLayerGroups(layers, document.getElementById("layer-search").value);
  const defaults = layers.filter((item) => item.defaultVisible);
  const results = await Promise.allSettled(defaults.map((layer) => window.AresLayers.loadLayer(layer.id)));
  results.forEach((result, index) => {
    const layer = defaults[index];
    if (result.status === "fulfilled") recordDiagnostic("success", layer.title, "Default layer loaded.");
    else {
      recordDiagnostic("failure", layer.title, result.reason.message || String(result.reason));
      const input = document.querySelector('#layer-groups input[data-layer-id="'.concat(layer.id, '"]'));
      if (input) input.checked = false;
    }
  });
  const priorityIds = ["official_jfrd_stations_arcgis", "official_hospitals_arcgis", "official_shelters_arcgis", "official_police_stations_arcgis", "repeaters", "eoc"];
  const alreadyLoaded = new Set(defaults.map((item) => item.id));
  const additional = layers.filter((item) => priorityIds.includes(item.id) && !alreadyLoaded.has(item.id));
  await Promise.allSettled(additional.map((layer) => window.AresLayers.loadLayer(layer.id)));
  document.getElementById("status-layer-count").textContent = "".concat(window.AresLayers.getActiveLayerCount(), " active");
  if ((_a = window.AresMap) == null ? void 0 : _a.fitDuval) setTimeout(() => window.AresMap.fitDuval(), 200);
}
async function renderFeeds() {
  const data = await fetchJSON("/api/feeds");
  currentFeeds = data;
  const cards = document.getElementById("feed-cards");
  cards.innerHTML = "";
  const feeds = [
    { key: "noaa", title: "NOAA / NWS Alerts", description: "Official alert pull and optional polygon overlay." },
    { key: "fema", title: "FEMA OpenFEMA", description: "Recent declaration summaries." },
    { key: "fl511", title: "Sigalert", description: "Regional traffic quick link and transportation awareness for ops routing." },
    { key: "statewide", title: "Florida State Ops", description: "Statewide FDEM / GATOR feeds and storm operations overlays." },
    { key: "skywarn", title: "SKYWARN", description: "Official status/reference source." }
  ];
  const updatedTimes = [];
  feeds.forEach((entry) => {
    var _a, _b;
    const feed = data[entry.key] || {};
    if (feed.updatedAt) updatedTimes.push(feed.updatedAt);
    const card = document.createElement("div");
    card.className = "feed-card";
    const note = feed.note ? '<div class="feed-note">'.concat(feed.note, "</div>") : "";
    const updatedLabel = feed.updatedAt ? new Date(feed.updatedAt).toLocaleTimeString() : " - ";
    const focusLabel = escapeHtml(feed.focusLabel || "Operational");
    const healthDetail = feed.lastError ? "Last error: ".concat(feed.lastError) : feed.state === "live" ? "Endpoint reachable and current." : feed.state === "degraded" ? "Fallback or hybrid mode in use." : feed.state === "cached" ? "Using last successful snapshot." : feed.state === "reference" ? "Reference page reachability check." : "Feed is currently unavailable.";
    card.innerHTML = '\n      <div class="feed-card-head">\n        <div>\n          <h3>'.concat(entry.title, '</h3>\n          <div class="card-subtle">').concat(entry.description, '</div>\n        </div>\n        <span class="feed-badge ').concat(feedBadgeClass(feed), '">').concat(feedBadgeLabel(feed), '</span>\n      </div>\n      <div class="feed-card-meta">\n        <div class="meta-tile"><span class="meta-label">Items</span><span class="meta-value">').concat((_a = feed.count) != null ? _a : 0, '</span></div>\n        <div class="meta-tile"><span class="meta-label">Source</span><span class="meta-value">').concat(feed.source || "Unknown", '</span></div>\n        <div class="meta-tile"><span class="meta-label">Updated</span><span class="meta-value">').concat(updatedLabel, '</span></div>\n        <div class="meta-tile"><span class="meta-label">Mode</span><span class="meta-value">').concat(feed.cacheLabel || (feed.cached ? "Cached" : "Fresh"), '</span></div>\n        <div class="meta-tile"><span class="meta-label">Focus</span><span class="meta-value">').concat(focusLabel, '</span></div>\n      </div>\n      <div class="feed-note">').concat(healthDetail, "</div>\n      ").concat(note, "\n    ");
    cards.appendChild(card);
    if (feed.state === "offline") {
      recordDiagnostic("failure", entry.title, feed.lastError || "Feed is offline.");
    } else {
      recordDiagnostic("success", entry.title, "".concat(feed.stateLabel || "Feed", " - ").concat((_b = feed.count) != null ? _b : 0, " item(s)."));
    }
  });
  const latest = updatedTimes.sort().reverse()[0];
  document.getElementById("status-last-refresh").textContent = relativeTime(latest);
  updateQuickStats();
}
function setLayerCheckedState(layerId, enabled) {
  const input = document.querySelector('#layer-groups input[data-layer-id="'.concat(layerId, '"]'));
  if (input) input.checked = enabled;
}
async function toggleLayerSafe(layerId, enabled) {
  try {
    if (enabled) {
      await window.AresLayers.loadLayer(layerId);
      recordDiagnostic("success", getLayerTitle(layerId), "Layer loaded by statewide preset.");
    } else {
      window.AresLayers.removeLayer(layerId);
    }
    setLayerCheckedState(layerId, enabled);
  } catch (error) {
    setLayerCheckedState(layerId, false);
    recordDiagnostic("failure", getLayerTitle(layerId), error.message || String(error));
    showToast("Preset layer failed: ".concat(getLayerTitle(layerId)), "error");
  }
}
async function applyStatewideOpsPreset(preset, reference = currentReference) {
  var _a, _b;
  const presets = {
    power: ["florida_power_outages_arcgis"],
    transportation: ["fl511_traffic_cameras_arcgis", "fl511_message_boards_arcgis"],
    river: ["fema_flood_zones_live", "noaa_alert_polygons_live"],
    all: ["florida_power_outages_arcgis", "fl511_traffic_cameras_arcgis", "fl511_message_boards_arcgis", "fema_flood_zones_live", "noaa_alert_polygons_live"]
  };
  const layerIds = presets[preset] || [];
  for (const id of layerIds) {
    await toggleLayerSafe(id, true);
  }
  document.getElementById("status-layer-count").textContent = "".concat(window.AresLayers.getActiveLayerCount(), " active");
  updateQuickStats();
  if (preset === "river") {
    const riverLink = (_b = (_a = reference == null ? void 0 : reference.gator_reference) == null ? void 0 : _a.links) == null ? void 0 : _b.find((item) => item.id === "river-forecast-dashboard");
    if (riverLink == null ? void 0 : riverLink.url) window.open(riverLink.url, "_blank", "noopener,noreferrer");
  }
}
function renderGatorReference(reference) {
  var _a;
  const list = document.getElementById("gator-links-list");
  const summary = document.getElementById("gator-summary");
  if (!list || !summary) return;
  const links = ((_a = reference.gator_reference) == null ? void 0 : _a.links) || [];
  summary.textContent = "".concat(links.length, " resources");
  list.innerHTML = '\n    <div class="info-card compact-card gator-ops-card">\n      <div class="info-card-head">\n        <div>\n          <h3>Statewide Ops Presets</h3>\n          <div class="card-subtle">Quick-load high-value statewide layers for power, transportation, and river/flood operations.</div>\n        </div>\n        <span class="feed-badge feed-info">OPS</span>\n      </div>\n      <div class="action-row wrap-actions">\n        <button class="button button-secondary" type="button" data-statewide-preset="power">Power</button>\n        <button class="button button-secondary" type="button" data-statewide-preset="transportation">Transport</button>\n        <button class="button button-secondary" type="button" data-statewide-preset="river">River</button>\n        <button class="button" type="button" data-statewide-preset="all">All State Ops</button>\n      </div>\n    </div>';
  links.forEach((item) => {
    const card = document.createElement("div");
    card.className = "info-card compact-card";
    card.innerHTML = '\n      <div class="info-card-head">\n        <div>\n          <h3>'.concat(escapeHtml(item.title), '</h3>\n          <div class="card-subtle">').concat(escapeHtml(item.description || ""), '</div>\n        </div>\n        <span class="feed-badge feed-info">FDEM</span>\n      </div>\n      <div class="action-row">\n        <a class="button button-secondary" href="').concat(escapeHtml(item.url), '" target="_blank" rel="noopener noreferrer">Open</a>\n      </div>\n    ');
    list.appendChild(card);
  });
  list.querySelectorAll("[data-statewide-preset]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await applyStatewideOpsPreset(button.dataset.statewidePreset, reference);
        showToast("Loaded ".concat(button.textContent.trim(), " statewide preset"), "success");
      } finally {
        button.disabled = false;
      }
    });
  });
}
function renderFl511Reference(reference) {
  var _a;
  const list = document.getElementById("fl511-links-list");
  const summary = document.getElementById("fl511-summary");
  if (!list || !summary) return;
  const links = ((_a = reference.fl511_reference) == null ? void 0 : _a.links) || [];
  summary.textContent = "".concat(links.length, " resources");
  list.innerHTML = '\n    <div class="info-card compact-card gator-ops-card">\n      <div class="info-card-head">\n        <div>\n          <h3>Statewide Ops Presets</h3>\n          <div class="card-subtle">Quick-load high-value statewide layers for power, transportation, and river/flood operations.</div>\n        </div>\n        <span class="feed-badge feed-info">OPS</span>\n      </div>\n      <div class="action-row wrap-actions">\n        <button class="button button-secondary" type="button" data-statewide-preset="power">Power</button>\n        <button class="button button-secondary" type="button" data-statewide-preset="transportation">Transport</button>\n        <button class="button button-secondary" type="button" data-statewide-preset="river">River</button>\n        <button class="button" type="button" data-statewide-preset="all">All State Ops</button>\n      </div>\n    </div>';
  links.forEach((item) => {
    const card = document.createElement("div");
    card.className = "info-card compact-card";
    card.innerHTML = '\n      <div class="info-card-head">\n        <div>\n          <h3>'.concat(escapeHtml(item.title), '</h3>\n          <div class="card-subtle">').concat(escapeHtml(item.description || ""), '</div>\n        </div>\n        <span class="feed-badge feed-info">FL511</span>\n      </div>\n      <div class="action-row">\n        <a class="button button-secondary" href="').concat(escapeHtml(item.url), '" target="_blank" rel="noopener noreferrer">Open</a>\n      </div>\n    ');
    list.appendChild(card);
  });
  list.querySelectorAll("[data-statewide-preset]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      const originalLabel = button.textContent;
      button.textContent = "Loading...";
      try {
        await applyStatewideOpsPreset(button.dataset.statewidePreset, reference);
        showToast("Loaded ".concat(originalLabel.trim(), " statewide preset"), "success");
      } catch (error) {
        console.error("FL511 statewide preset failed:", error);
        showToast("Failed to load ".concat(originalLabel.trim(), " preset"), "error");
      } finally {
        button.disabled = false;
        button.textContent = originalLabel;
      }
    });
  });
}
function renderFreqs(reference) {
  var _a;
  const list = document.getElementById("freq-list");
  list.innerHTML = "";
  const channels = ((_a = reference.ares_frequencies) == null ? void 0 : _a.channels) || [];
  document.getElementById("freq-summary").textContent = "".concat(channels.length, " channels");
  channels.forEach((channel) => {
    const card = document.createElement("div");
    card.className = "info-card compact-card";
    card.innerHTML = '\n      <div class="info-card-head">\n        <div>\n          <h3>'.concat(channel.name, '</h3>\n          <div class="card-subtle">').concat(channel.description, '</div>\n        </div>\n        <span class="operator-status status-available">').concat(channel.frequency, '</span>\n      </div>\n      <div class="mini-meta">').concat(channel.call || " - ", " - TX/RX Tone ").concat(channel.toneOut || "CSQ").concat(channel.toneIn ? " / ".concat(channel.toneIn) : "", "</div>\n    ");
    list.appendChild(card);
  });
}
function featureLatLng(feature) {
  var _a, _b;
  const coords = (_a = feature == null ? void 0 : feature.geometry) == null ? void 0 : _a.coordinates;
  if (!coords || ((_b = feature.geometry) == null ? void 0 : _b.type) !== "Point") return null;
  return { lat: coords[1], lng: coords[0] };
}
function featureActions(props = {}, feature = null) {
  const ll = featureLatLng(feature);
  const label = encodeURIComponent(props.name || props.station || "Location");
  const address = encodeURIComponent(props.address || "");
  const zoomBtn = ll ? '<button class="button button-secondary card-action" data-action="zoom" data-lat="'.concat(ll.lat, '" data-lng="').concat(ll.lng, '" data-label="').concat(label, '">Zoom</button>') : props.address ? '<button class="button button-secondary card-action" data-action="zoom-address" data-address="'.concat(address, '" data-label="').concat(label, '">Zoom</button>') : "";
  const dirBtn = ll ? '<button class="button button-secondary card-action" data-action="directions" data-lat="'.concat(ll.lat, '" data-lng="').concat(ll.lng, '" data-label="').concat(label, '" data-address="').concat(address, '">Directions</button>') : props.address ? '<button class="button button-secondary card-action" data-action="directions-address" data-address="'.concat(address, '" data-label="').concat(label, '">Directions</button>') : "";
  return '<div class="toolbar-grid">'.concat(zoomBtn).concat(dirBtn, "</div>");
}
function wireCardActions(container) {
  container.querySelectorAll(".card-action").forEach((btn) => {
    btn.addEventListener("click", async () => {
      var _a, _b, _c;
      const label = decodeURIComponent(btn.dataset.label || "Location");
      const address = decodeURIComponent(btn.dataset.address || "");
      if (btn.dataset.action === "zoom") {
        const lat = Number(btn.dataset.lat);
        const lng = Number(btn.dataset.lng);
        map.setView([lat, lng], 14);
        return;
      }
      if (btn.dataset.action === "directions" && ((_a = window.AresMap) == null ? void 0 : _a.openDirections)) {
        const lat = Number(btn.dataset.lat);
        const lng = Number(btn.dataset.lng);
        window.AresMap.openDirections(lat, lng, label);
        return;
      }
      if (btn.dataset.action === "zoom-address" && ((_b = window.AresMap) == null ? void 0 : _b.zoomToAddress) && address) {
        await window.AresMap.zoomToAddress(address, label);
        return;
      }
      if (btn.dataset.action === "directions-address" && ((_c = window.AresMap) == null ? void 0 : _c.openDirectionsToAddress) && address) {
        window.AresMap.openDirectionsToAddress(address, label);
      }
    });
  });
  container.querySelectorAll(".ops-action").forEach((btn) => {
    btn.addEventListener("click", () => {
      const props = safeJsonParse((btn.dataset.ops || "").replace(/&quot;/g, '"'), {});
      if (btn.dataset.action === "set-status") {
        updateOpsRecord(props, btn.dataset.status, true);
      } else if (btn.dataset.action === "check-in") {
        const current = getOpsRecord(props);
        updateOpsRecord(props, current.status, true);
      } else if (btn.dataset.action === "clear-status") {
        const store = loadOpsStatusStore();
        delete store[getOpsKey(props)];
        saveOpsStatusStore(store);
      }
      renderReferencePanels();
    });
  });
}
function renderFeatureList(targetId, featureCollection, titleField = "name") {
  const list = document.getElementById(targetId);
  list.innerHTML = "";
  const features = (featureCollection == null ? void 0 : featureCollection.features) || [];
  features.forEach((feature) => {
    const props = feature.properties || {};
    const record = getOpsRecord(props);
    const card = document.createElement("div");
    card.className = "info-card compact-card ops-card";
    card.innerHTML = '\n      <div class="info-card-head">\n        <div>\n          <h3>'.concat(props[titleField] || props.name || "Location", '</h3>\n          <div class="card-subtle">').concat(props.address || "Address not listed", '</div>\n        </div>\n      </div>\n      <div class="status-line">\n        <span class="status-chip ').concat(statusClass(record.status), '">Status: ').concat(record.status, "</span>\n        <span>Last Updated: ").concat(formatLastUpdated(record.lastUpdated), '</span>\n      </div>\n      <div class="mini-meta">').concat(props.phone || props.category || props.site || props.county || props.beds ? [props.phone, props.category, props.site, props.county, props.beds].filter(Boolean).join(" - ") : "", "</div>\n      ").concat(featureActions(props, feature), "\n    ");
    list.appendChild(card);
  });
  wireCardActions(list);
  return features.length;
}
function renderEratSync(reference) {
  const list = document.getElementById("erat-sync-list");
  const summary = document.getElementById("erat-sync-summary");
  if (!list || !summary) return;
  const items = reference.erat_sync_status || [];
  list.innerHTML = "";
  const liveCount = items.filter((item) => item.status === "live").length;
  const fallbackCount = items.filter((item) => item.status === "fallback").length;
  summary.textContent = "".concat(liveCount, " live / ").concat(fallbackCount, " fallback");
  items.forEach((item) => {
    var _a;
    const card = document.createElement("div");
    card.className = "info-card compact-card";
    const badge = item.status === "live" ? "feed-ok" : item.status === "fallback" ? "feed-warn" : "feed-empty";
    const label = item.status === "live" ? "Live" : item.status === "fallback" ? "Fallback" : "Unknown";
    card.innerHTML = '\n      <div class="info-card-head">\n        <div>\n          <h3>'.concat(item.title, '</h3>\n          <div class="card-subtle">').concat(item.source || "Unknown source", '</div>\n        </div>\n        <span class="feed-badge ').concat(badge, '">').concat(label, '</span>\n      </div>\n      <div class="mini-meta">').concat((_a = item.count) != null ? _a : 0, " features - Priority ").concat(item.priority, "</div>\n    ");
    list.appendChild(card);
  });
}
function renderValidationSummary(reference) {
  const container = document.getElementById("validation-summary");
  container.innerHTML = "";
  const summary = reference.validation_summary || {};
  const items = [
    ["Total records", summary.total_records || summary.total_features || " - "],
    ["Validated", summary.validated_records || summary.validated || " - "],
    ["Manual review", summary.manual_review_needed || summary.manual_review || " - "],
    ["Unique layers", summary.unique_layers || summary.layer_count || " - "]
  ];
  items.forEach(([label, value]) => {
    const el = document.createElement("div");
    el.className = "mini-stat";
    el.innerHTML = "<strong>".concat(label, "</strong><span>").concat(value, "</span>");
    container.appendChild(el);
  });
  document.getElementById("validation-summary-pill").textContent = "".concat(items.length, " checks");
}
async function renderReferencePanels() {
  var _a;
  const reference = await fetchJSON("/api/reference");
  currentReference = reference;
  renderFreqs(reference);
  renderGatorReference(reference);
  renderFl511Reference(reference);
  const total = renderFeatureList("jso-list", reference.jso_substations) + renderFeatureList("fhp-list", reference.fhp_stations) + renderFeatureList("shelter-list", reference.shelters_official) + renderFeatureList("jfrd-list", reference.jfrd_station_directory, "station");
  document.getElementById("agency-summary").textContent = "".concat(total, " refs");
  document.getElementById("jfrd-summary").textContent = "".concat((((_a = reference.jfrd_station_directory) == null ? void 0 : _a.features) || []).length, " stations");
  renderEratSync(reference);
  renderValidationSummary(reference);
  renderOpsStatusPanel(reference);
  recordDiagnostic("success", "Reference panels", "".concat(total, " reference items loaded."));
  updateQuickStats();
}
async function refreshFeeds() {
  const token = await ensureAdminToken(false);
  await fetchJSON("/api/feeds/refresh", { method: "POST", headers: token ? { "x-api-token": token } : {} });
  await renderFeeds();
}
function initAccordions() {
  bindOpsConsoleControls();
  bindOperatorStatusFilters();
}
function renderAuthPanel() {
  const statusEl = document.getElementById("ops-auth-status");
  const input = document.getElementById("ops-token-input");
  const setBtn = document.getElementById("ops-set-token");
  const clearBtn = document.getElementById("ops-clear-token");
  const token = localStorage.getItem("apiAdminToken") || "";
  if (input) input.value = token;
  if (statusEl) statusEl.textContent = token ? "Write access ready - token saved" : "Read-only mode - token required for add, edit, archive, and delete";
  if (setBtn) setBtn.textContent = token ? "Update Token" : "Save Token";
  if (clearBtn) clearBtn.disabled = !token;
}
function focusAuthPanel() {
  var _a, _b;
  (_a = document.getElementById("ops-auth-panel")) == null ? void 0 : _a.scrollIntoView({ behavior: "smooth", block: "center" });
  (_b = document.getElementById("ops-token-input")) == null ? void 0 : _b.focus();
}
function saveAdminTokenFromForm() {
  var _a;
  const input = document.getElementById("ops-token-input");
  const token = ((_a = input == null ? void 0 : input.value) == null ? void 0 : _a.trim()) || "";
  if (!token) {
    window.alert("Paste the API admin token and save it first.");
    input == null ? void 0 : input.focus();
    return false;
  }
  localStorage.setItem("apiAdminToken", token);
  renderAuthPanel();
  showOpsToast("Admin token saved.", "success");
  return true;
}
async function ensureAdminToken(forcePrompt = false) {
  if (forcePrompt) {
    const saved = saveAdminTokenFromForm();
    if (!saved) throw new Error("Admin token is required to save changes.");
  }
  const token = localStorage.getItem("apiAdminToken") || "";
  if (!token) {
    focusAuthPanel();
    throw new Error("Set the API admin token in Console Auth before saving changes.");
  }
  return token;
}
function clearAdminToken() {
  localStorage.removeItem("apiAdminToken");
  const input = document.getElementById("ops-token-input");
  if (input) input.value = "";
  renderAuthPanel();
  showOpsToast("Admin token cleared.", "info");
}
function buildComposerFields(kind, record = {}) {
  const value = (key, fallback = "") => {
    var _a;
    return (_a = record[key]) != null ? _a : fallback;
  };
  const latValue = escapeHtml(value("lat", getDefaultMapCenter().lat.toFixed(6)));
  const lngValue = escapeHtml(value("lng", getDefaultMapCenter().lng.toFixed(6)));
  const locationTools = '\n    <div class="ops-location-tools">\n      <button type="button" class="button button-secondary button-small" data-location-action="pick-on-map" data-kind="'.concat(kind, '">Click Map to Mark</button>\n      <button type="button" class="button button-ghost button-small" data-location-action="use-map-center" data-kind="').concat(kind, '">Use Map Center</button>\n      <span class="ops-location-hint">Manual coordinates still work below.</span>\n    </div>');
  if (kind === "incident") {
    return '\n      <div class="ops-form-grid two-up">\n        <label class="form-field"><span>Title</span><input name="title" required value="'.concat(escapeHtml(value("title")), '" /></label>\n        <label class="form-field"><span>Type</span><input name="type" value="').concat(escapeHtml(value("type", "general")), '" /></label>\n      </div>\n      <div class="ops-form-grid three-up">\n        <label class="form-field"><span>Status</span><select name="status"><option>monitoring</option><option>open</option><option>active</option><option>resolved</option><option>closed</option><option>archived</option></select></label>\n        <label class="form-field"><span>Priority</span><select name="priority"><option>low</option><option selected>medium</option><option>high</option><option>critical</option></select></label>\n        <label class="form-field"><span>Assigned Operator</span>').concat(buildAssignmentSelect("assignedOperator", value("assignedOperator", value("assignment", "unassigned")), "operator"), '</label>\n      </div>\n      <label class="form-field"><span>Notes</span><input name="notes" value="').concat(escapeHtml(value("notes")), '" /></label>\n      <div class="ops-form-grid two-up">\n        <label class="form-field"><span>Operational Period</span><input name="operationalPeriod" value="').concat(escapeHtml(value("operationalPeriod")), '" placeholder="2026-04-10 Day / Night" /></label>\n        <label class="form-field"><span>Incident Commander</span><input name="incidentCommander" value="').concat(escapeHtml(value("incidentCommander")), '" placeholder="Callsign or name" /></label>\n      </div>\n      <div class="ops-form-grid three-up">\n        <label class="form-field"><span>Net Control</span><input name="netControl" value="').concat(escapeHtml(value("netControl")), '" placeholder="Primary NCS / control station" /></label>\n        <label class="form-field"><span>Primary Frequency</span><input name="primaryFrequency" value="').concat(escapeHtml(value("primaryFrequency")), '" placeholder="e.g. 000.000 (+) PL 000.0" /></label>\n        <label class="form-field"><span>Tactical Frequency</span><input name="tacticalFrequency" value="').concat(escapeHtml(value("tacticalFrequency")), '" placeholder="Simplex / tactical net" /></label>\n      </div>\n      <label class="form-field"><span>Staging Location</span><input name="stagingLocation" value="').concat(escapeHtml(value("stagingLocation")), '" placeholder="Shelter 4 parking lot / county staging" /></label>\n      <div class="ops-form-grid two-up">\n        <label class="form-field"><span>Objectives</span><textarea name="objectives" rows="4" placeholder="Primary communications objectives for this incident">').concat(escapeHtml(value("objectives")), '</textarea></label>\n        <label class="form-field"><span>SITREP / Command Notes</span><textarea name="sitrep" rows="4" placeholder="Current situation, priorities, blockers, next actions">').concat(escapeHtml(value("sitrep")), "</textarea></label>\n      </div>\n      ").concat(locationTools, '\n      <div class="ops-form-grid two-up">\n        <label class="form-field"><span>Latitude</span><input name="lat" type="number" step="0.000001" value="').concat(latValue, '" /></label>\n        <label class="form-field"><span>Longitude</span><input name="lng" type="number" step="0.000001" value="').concat(lngValue, '" /></label>\n      </div>');
  }
  if (kind === "operator") {
    return '\n      <input type="hidden" name="id" value="'.concat(escapeHtml(value("id", value("callsign", ""))), '" />\n      <div class="ops-form-grid two-up">\n        <label class="form-field"><span>Callsign</span><input name="callsign" required value="').concat(escapeHtml(value("callsign")), '" /></label>\n        <label class="form-field"><span>Name</span><input name="name" value="').concat(escapeHtml(value("name")), '" /></label>\n      </div>\n      <div class="ops-form-grid two-up">\n        <label class="form-field"><span>Status</span><select name="status"><option>available</option><option>monitoring</option><option>assigned</option><option>en_route</option><option>on_scene</option><option>needs_relief</option><option>offline</option><option>unavailable</option></select></label>\n        <label class="form-field"><span>ICS Role</span>').concat(buildAssignmentSelect("role", value("role", "unassigned"), "role"), '</label>\n      </div>\n      <div class="ops-form-grid two-up">\n        <label class="form-field"><span>Assigned Incident</span>').concat(buildAssignmentSelect("assignedIncidentId", value("assignedIncidentId", "unassigned"), "incident"), '</label>\n        <label class="form-field"><span>Capabilities</span><input name="capabilities" placeholder="mobile, shelter, logistics" value="').concat(escapeHtml(Array.isArray(value("capabilities", [])) ? value("capabilities", []).join(", ") : value("capabilities", "")), '" /></label>\n      </div>\n      <div class="ops-form-grid three-up">\n        <label class="form-field"><span>Resource Type</span><select name="resourceType">').concat(buildSelectOptions(RESOURCE_TYPE_OPTIONS, value("resourceType", "operator")), '</select></label>\n        <label class="form-field"><span>Tactical Callsign</span><input name="tacticalCallsign" value="').concat(escapeHtml(value("tacticalCallsign")), '" placeholder="Shelter 4 / Rover 2" /></label>\n        <label class="form-field"><span>Team / Unit</span><input name="team" value="').concat(escapeHtml(value("team")), '" placeholder="Branch, division, or team" /></label>\n      </div>\n      <div class="ops-form-grid three-up">\n        <label class="form-field"><span>Reachability</span><select name="reachability">').concat(buildSelectOptions(REACHABILITY_OPTIONS, value("reachability", "unknown")), '</select></label>\n        <label class="form-field"><span>Go-Kit Status</span><select name="goKitStatus">').concat(buildSelectOptions(GOKIT_STATUS_OPTIONS, value("goKitStatus", "unknown")), '</select></label>\n        <label class="form-field"><span>Vehicle Status</span><select name="vehicleStatus">').concat(buildSelectOptions(VEHICLE_STATUS_OPTIONS, value("vehicleStatus", "unknown")), '</select></label>\n      </div>\n      <div class="ops-form-grid two-up">\n        <label class="form-field"><span>Home Base</span><input name="homeBase" value="').concat(escapeHtml(value("homeBase")), '" placeholder="Home / staging / repeater site" /></label>\n        <label class="form-field"><span>Relief Due</span><input name="reliefDue" type="datetime-local" value="').concat(escapeHtml(formatDateTimeLocalValue(value("reliefDue"))), '" /></label>\n      </div>\n      <div class="ops-form-grid three-up">\n        <label class="form-field"><span>Shift Start</span><input name="shiftStart" type="datetime-local" value="').concat(escapeHtml(formatDateTimeLocalValue(value("shiftStart"))), '" /></label>\n        <label class="form-field"><span>Shift End</span><input name="shiftEnd" type="datetime-local" value="').concat(escapeHtml(formatDateTimeLocalValue(value("shiftEnd"))), '" /></label>\n        <label class="form-field"><span>Last Voice Contact</span><input name="lastVoiceContact" type="datetime-local" value="').concat(escapeHtml(formatDateTimeLocalValue(value("lastVoiceContact"))), '" /></label>\n      </div>\n      <div class="ops-form-grid one-up">\n        <label class="form-field"><span>Location / Label</span><input name="location" value="').concat(escapeHtml(value("location")), '" placeholder="Shelter 4, Staging, or coordinates" /></label>\n      </div>\n      ').concat(locationTools, '\n      <div class="ops-form-grid two-up">\n        <label class="form-field"><span>Latitude</span><input name="lat" type="number" step="0.000001" value="').concat(escapeHtml(value("lat", "")), '" /></label>\n        <label class="form-field"><span>Longitude</span><input name="lng" type="number" step="0.000001" value="').concat(escapeHtml(value("lng", "")), '" /></label>\n      </div>\n      <label class="form-field"><span>Last Check-In</span><input name="lastCheckIn" value="').concat(escapeHtml(value("lastCheckIn")), '" placeholder="2026-03-27T14:00:00Z" /></label>');
  }
  return '\n    <div class="ops-form-grid two-up">\n      <label class="form-field"><span>Title</span><input name="title" required value="'.concat(escapeHtml(value("title")), '" /></label>\n      <label class="form-field"><span>Assigned Operator</span>').concat(buildAssignmentSelect("assignedTo", value("assignedTo", "unassigned"), "operator"), '</label>\n    </div>\n    <div class="ops-form-grid three-up">\n      <label class="form-field"><span>Priority</span><select name="priority"><option>low</option><option selected>medium</option><option>high</option><option>critical</option></select></label>\n      <label class="form-field"><span>Status</span><select name="status"><option>open</option><option>assigned</option><option>blocked</option><option>closed</option></select></label>\n      <label class="form-field"><span>Due</span><input name="due" type="date" value="').concat(escapeHtml(value("due") || ""), '" /></label>\n    </div>\n    <div class="ops-form-grid one-up">\n      <label class="form-field"><span>Linked Incident</span>').concat(buildAssignmentSelect("incidentId", value("incidentId", "unassigned"), "incident"), '</label>\n    </div>\n    <label class="form-field"><span>Location / Label</span><input name="location" value="').concat(escapeHtml(value("location")), '" placeholder="Road closure, shelter, staging area" /></label>\n    ').concat(locationTools, '\n    <div class="ops-form-grid two-up">\n      <label class="form-field"><span>Latitude</span><input name="lat" type="number" step="0.000001" value="').concat(escapeHtml(value("lat", "")), '" /></label>\n      <label class="form-field"><span>Longitude</span><input name="lng" type="number" step="0.000001" value="').concat(escapeHtml(value("lng", "")), '" /></label>\n    </div>\n    <label class="form-field"><span>Notes</span><textarea name="notes" rows="3">').concat(escapeHtml(value("notes")), "</textarea></label>");
}
function applySelectValues(form, record = {}) {
  form.querySelectorAll("select").forEach((select) => {
    const current = record[select.name];
    if (current) select.value = current;
  });
}
async function hydrateComposerSources(kind) {
  const needsIncidents = kind === "operator" || kind === "task";
  const needsOperators = kind === "incident" || kind === "task";
  if (!needsIncidents && !needsOperators) return;
  const [incidents, operators] = await Promise.all([
    needsIncidents ? fetchJSON("/api/incidents").catch(() => currentIncidents) : Promise.resolve(currentIncidents),
    needsOperators ? fetchJSON("/api/operators").catch(() => currentOperators) : Promise.resolve(currentOperators)
  ]);
  if (needsIncidents) currentIncidents = Array.isArray(incidents) ? incidents : currentIncidents;
  if (needsOperators) currentOperators = Array.isArray(operators) ? operators : currentOperators;
  syncOpsGlobals();
}
function openComposer(kind, mode = "create", record = null) {
  const resolvedRecordId = (record == null ? void 0 : record.id) || (record == null ? void 0 : record.callsign) || null;
  const sequence = ++composerOpenSequence;
  composerState = { kind, mode, recordId: resolvedRecordId };
  composerDraft = { kind, mode, recordId: resolvedRecordId, values: record || {} };
  (async () => {
    var _a;
    await hydrateComposerSources(kind);
    if (sequence !== composerOpenSequence) return;
    const modal = document.getElementById("ops-modal");
    const card = document.getElementById("ops-composer-card");
    const form = document.getElementById("ops-composer-form");
    const title = document.getElementById("ops-composer-title");
    const subtitle = document.getElementById("ops-composer-subtitle");
    if (!modal || !card || !form || !title || !subtitle) {
      console.error("Ops composer modal not available");
      showOpsToast("Form failed to open. Reload the page and try again.", "error");
      return;
    }
    title.textContent = "".concat(mode === "edit" ? "Edit" : "New", " ").concat(titleCase(kind));
    subtitle.textContent = mode === "edit" ? "Update the selected record and save it back to the console." : "Create a new operational record with all allowed fields.";
    form.innerHTML = "".concat(buildComposerFields(kind, record || {}), '\n      <div class="ops-form-actions">\n        <button type="submit" class="button">').concat(mode === "edit" ? "Save Changes" : "Create ".concat(titleCase(kind)), '</button>\n        <button type="button" class="button button-secondary" id="ops-composer-cancel">Cancel</button>\n      </div>');
    applySelectValues(form, record || {});
    form.querySelectorAll("[data-location-action]").forEach((button) => {
      safeBind(button, "click", () => {
        const action = button.dataset.locationAction;
        const targetKind = button.dataset.kind || kind;
        if (action === "pick-on-map") beginMapLocationPick(targetKind);
        if (action === "use-map-center") useMapCenterForComposer(targetKind);
      });
    });
    modal.classList.remove("is-hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    (_a = document.getElementById("ops-composer-cancel")) == null ? void 0 : _a.addEventListener("click", closeComposer);
    form.onsubmit = async (event) => {
      event.preventDefault();
      await submitComposerForm();
    };
    window.setTimeout(() => {
      var _a2;
      (_a2 = form.querySelector("input, select, textarea")) == null ? void 0 : _a2.focus();
    }, 0);
  })().catch((error) => {
    console.error(error);
    showOpsToast((error == null ? void 0 : error.message) || "Unable to open the form right now.", "error");
  });
}
function closeComposer(options = {}) {
  const { preserveDraft = false } = options;
  composerOpenSequence += 1;
  const modal = document.getElementById("ops-modal");
  const form = document.getElementById("ops-composer-form");
  if (form) form.onsubmit = null;
  if (modal) {
    modal.classList.add("is-hidden");
    modal.setAttribute("aria-hidden", "true");
  }
  document.body.classList.remove("modal-open");
  if (!preserveDraft) composerDraft = null;
  composerState = { kind: null, mode: "create", recordId: null };
}
function parseComposerPayload(kind, form) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E, _F, _G, _H, _I, _J;
  const fd = new FormData(form);
  const obj = Object.fromEntries(fd.entries());
  const parseCoord = (value) => {
    if (value === void 0 || value === null || value === "") return void 0;
    const num = Number(value);
    return Number.isFinite(num) ? num : void 0;
  };
  if (kind === "incident") {
    return {
      title: (_a = obj.title) == null ? void 0 : _a.trim(),
      type: ((_b = obj.type) == null ? void 0 : _b.trim()) || "general",
      status: obj.status || "monitoring",
      priority: obj.priority || "medium",
      lat: (_c = parseCoord(obj.lat)) != null ? _c : getDefaultMapCenter().lat,
      lng: (_d = parseCoord(obj.lng)) != null ? _d : getDefaultMapCenter().lng,
      notes: ((_e = obj.notes) == null ? void 0 : _e.trim()) || "",
      assignedOperator: obj.assignedOperator || obj.assignment || "unassigned",
      operationalPeriod: ((_f = obj.operationalPeriod) == null ? void 0 : _f.trim()) || "",
      incidentCommander: ((_g = obj.incidentCommander) == null ? void 0 : _g.trim()) || "",
      netControl: ((_h = obj.netControl) == null ? void 0 : _h.trim()) || "",
      primaryFrequency: ((_i = obj.primaryFrequency) == null ? void 0 : _i.trim()) || "",
      tacticalFrequency: ((_j = obj.tacticalFrequency) == null ? void 0 : _j.trim()) || "",
      stagingLocation: ((_k = obj.stagingLocation) == null ? void 0 : _k.trim()) || "",
      objectives: ((_l = obj.objectives) == null ? void 0 : _l.trim()) || "",
      sitrep: ((_m = obj.sitrep) == null ? void 0 : _m.trim()) || ""
    };
  }
  if (kind === "operator") {
    return {
      id: ((_n = obj.id) == null ? void 0 : _n.trim()) || void 0,
      callsign: (_o = obj.callsign) == null ? void 0 : _o.trim(),
      name: ((_p = obj.name) == null ? void 0 : _p.trim()) || "",
      status: obj.status || "available",
      role: ((_q = obj.role) == null ? void 0 : _q.trim()) || "unassigned",
      assignedIncidentId: ((_r = obj.assignedIncidentId) == null ? void 0 : _r.trim()) || "unassigned",
      location: ((_s = obj.location) == null ? void 0 : _s.trim()) || "",
      lat: parseCoord(obj.lat),
      lng: parseCoord(obj.lng),
      capabilities: String(obj.capabilities || "").split(",").map((item) => item.trim()).filter(Boolean),
      lastCheckIn: ((_t = obj.lastCheckIn) == null ? void 0 : _t.trim()) || void 0,
      resourceType: ((_u = obj.resourceType) == null ? void 0 : _u.trim()) || "operator",
      tacticalCallsign: ((_v = obj.tacticalCallsign) == null ? void 0 : _v.trim()) || "",
      team: ((_w = obj.team) == null ? void 0 : _w.trim()) || "",
      homeBase: ((_x = obj.homeBase) == null ? void 0 : _x.trim()) || "",
      reachability: ((_y = obj.reachability) == null ? void 0 : _y.trim()) || "unknown",
      goKitStatus: ((_z = obj.goKitStatus) == null ? void 0 : _z.trim()) || "unknown",
      vehicleStatus: ((_A = obj.vehicleStatus) == null ? void 0 : _A.trim()) || "unknown",
      shiftStart: ((_B = obj.shiftStart) == null ? void 0 : _B.trim()) || "",
      shiftEnd: ((_C = obj.shiftEnd) == null ? void 0 : _C.trim()) || "",
      reliefDue: ((_D = obj.reliefDue) == null ? void 0 : _D.trim()) || "",
      lastVoiceContact: ((_E = obj.lastVoiceContact) == null ? void 0 : _E.trim()) || ""
    };
  }
  return {
    title: (_F = obj.title) == null ? void 0 : _F.trim(),
    assignedTo: ((_G = obj.assignedTo) == null ? void 0 : _G.trim()) || "unassigned",
    incidentId: ((_H = obj.incidentId) == null ? void 0 : _H.trim()) || "unassigned",
    priority: obj.priority || "medium",
    status: obj.status || "open",
    due: obj.due || null,
    location: ((_I = obj.location) == null ? void 0 : _I.trim()) || "",
    lat: parseCoord(obj.lat),
    lng: parseCoord(obj.lng),
    notes: ((_J = obj.notes) == null ? void 0 : _J.trim()) || ""
  };
}
async function submitComposerForm() {
  const form = document.getElementById("ops-composer-form");
  if (!form || !composerState.kind) return;
  const payload = parseComposerPayload(composerState.kind, form);
  const baseEndpoint = "/api/".concat(composerState.kind === "incident" ? "incidents" : composerState.kind === "operator" ? "operators" : "tasks");
  const resolvedRecordIdRaw = composerState.recordId || payload.id || payload.callsign || null;
  const resolvedRecordId = resolvedRecordIdRaw ? String(resolvedRecordIdRaw).replace(/[<>]/g, "").trim() : null;
  const endpoint = "".concat(baseEndpoint).concat(composerState.mode === "edit" && resolvedRecordId ? "/".concat(encodeURIComponent(resolvedRecordId)) : "");
  const method = composerState.mode === "edit" ? "PATCH" : "POST";
  let saved;
  try {
    await ensureAdminToken(false);
    saved = await postWithAdminRetry(endpoint, payload, method);
  } catch (error) {
    console.error(error);
    showOpsToast(error.message || "Unable to save record. Check Console Auth and try again.", "error");
    return;
  }
  activeOpsTab = "".concat(composerState.kind, "s").replace("incidentss", "incidents");
  selectedOpsRecord = (saved == null ? void 0 : saved.id) || (saved == null ? void 0 : saved.callsign) ? { kind: composerState.kind, id: saved.id || saved.callsign } : selectedOpsRecord;
  syncOpsGlobals();
  closeComposer();
  showOpsToast("".concat(titleCase(composerState.kind), " saved successfully."), "success");
  await syncRealtimeConsoles();
  await syncRealtimeConsoles(350);
  setActiveOpsTab(composerState.kind === "incident" ? "incidents" : "".concat(composerState.kind, "s"));
}
function openEditorForSelectedRecord() {
  if (!selectedOpsRecord) return;
  openOpsRecordEditor(selectedOpsRecord.kind, selectedOpsRecord.id);
}
function findOpsRecord(kind, id) {
  if (!kind || !id) return null;
  if (kind === "incident") return currentIncidents.find((item) => item.id === id) || null;
  if (kind === "operator") return currentOperators.find((item) => item.id === id || item.callsign === id) || null;
  if (kind === "task") return currentTasks.find((item) => item.id === id) || null;
  return null;
}
function openOpsRecordEditor(kind, id) {
  const record = findOpsRecord(kind, id);
  if (!record) return false;
  openComposer(kind, "edit", record);
  return true;
}
async function deleteOpsRecord(kind, id, options = {}) {
  const { confirm = true, focusTab = true } = options;
  const record = findOpsRecord(kind, id);
  if (!record) return false;
  if (confirm && !confirmDestructive("Delete this ".concat(kind, "? This cannot be undone."))) return false;
  await ensureAdminToken(false);
  const endpointId = kind === "operator" ? record.id || record.callsign || id : record.id || id;
  const endpoint = "/api/".concat(kind === "incident" ? "incidents" : kind === "operator" ? "operators" : "tasks", "/").concat(encodeURIComponent(endpointId));
  await apiDeleteWithAdminRetry(endpoint);
  showOpsToast("".concat(titleCase(kind), " deleted."), "success");
  if (selectedOpsRecord && selectedOpsRecord.kind === kind && selectedOpsRecord.id === id) {
    selectedOpsRecord = null;
    syncOpsGlobals();
  }
  await syncRealtimeConsoles();
  if (focusTab) {
    if (kind === "incident") setActiveOpsTab("incidents");
    if (kind === "operator") setActiveOpsTab("operators");
    if (kind === "task") setActiveOpsTab("tasks");
  }
  return true;
}
window.openOpsRecordEditor = openOpsRecordEditor;
window.deleteOpsRecord = deleteOpsRecord;
function initInteractions() {
  document.getElementById("layer-search").addEventListener("input", (event) => {
    renderLayerGroups(layerCatalog, event.target.value);
  });
  bindOpsConsoleControls();
  bindOperatorStatusFilters();
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeComposer();
  });
}
async function renderOperationalWorkspace() {
  var _a;
  const [incidents, operators, tasks] = await Promise.all([
    fetchJSON("/api/incidents").catch(() => []),
    fetchJSON("/api/operators").catch(() => []),
    fetchJSON("/api/tasks").catch(() => [])
  ]);
  currentIncidents = Array.isArray(incidents) ? incidents : [];
  currentOperators = Array.isArray(operators) ? operators : [];
  currentTasks = Array.isArray(tasks) ? tasks : [];
  syncOpsGlobals();
  operatorCheckinCache = {};
  const selectedExists = selectedOpsRecord && (selectedOpsRecord.kind === "incident" && currentIncidents.some((item) => item.id === selectedOpsRecord.id) || selectedOpsRecord.kind === "operator" && currentOperators.some((item) => item.id === selectedOpsRecord.id || item.callsign === selectedOpsRecord.id) || selectedOpsRecord.kind === "task" && currentTasks.some((item) => item.id === selectedOpsRecord.id));
  if (!selectedExists) selectedOpsRecord = null;
  renderOpsSummary();
  if (!selectedOpsRecord) {
    if (activeOpsTab === "operators" && currentOperators.length) selectedOpsRecord = { kind: "operator", id: currentOperators[0].id || currentOperators[0].callsign };
    else if (activeOpsTab === "tasks" && currentTasks.length) selectedOpsRecord = { kind: "task", id: currentTasks[0].id };
    else if (currentIncidents.length) selectedOpsRecord = { kind: "incident", id: currentIncidents[0].id };
    else if (currentOperators.length) selectedOpsRecord = { kind: "operator", id: currentOperators[0].id || currentOperators[0].callsign };
    else if (currentTasks.length) selectedOpsRecord = { kind: "task", id: currentTasks[0].id };
  }
  renderIncidentList();
  renderOperatorList();
  renderTaskList();
  renderOpsRecommendations();
  renderOpsFocusCard();
  setActiveOpsTab(activeOpsTab);
  updateQuickStats();
  if ((_a = window.AresSystem) == null ? void 0 : _a.refresh) window.AresSystem.refresh().catch(() => {
  });
}
async function syncRealtimeConsoles(delay = 0) {
  var _a, _b, _c, _d, _e, _f;
  const waitMs = Number(delay);
  if (Number.isFinite(waitMs) && waitMs > 0) {
    await new Promise((resolve) => window.setTimeout(resolve, waitMs));
  }
  await renderOperationalWorkspace();
  const refreshers = [
    (_b = (_a = window.AresDispatch) == null ? void 0 : _a.refresh) == null ? void 0 : _b.call(_a),
    (_d = (_c = window.AresTracking) == null ? void 0 : _c.refresh) == null ? void 0 : _d.call(_c),
    (_f = (_e = window.AresSystem) == null ? void 0 : _e.refresh) == null ? void 0 : _f.call(_e)
  ].filter(Boolean);
  if (refreshers.length) {
    await Promise.allSettled(refreshers);
  }
}
function isOperatorStale(item) {
  if (!(item == null ? void 0 : item.lastCheckIn)) return true;
  const age = Date.now() - new Date(item.lastCheckIn).getTime();
  return !Number.isFinite(age) || age / 6e4 >= 60;
}
function matchOperatorStatusFilter(item, filter) {
  const status = String((item == null ? void 0 : item.status) || "").toLowerCase();
  if (filter === "stale") return isOperatorStale(item);
  if (filter === "needs_relief") return operatorNeedsRelief(item);
  return status === String(filter || "").toLowerCase();
}
function renderOperatorStatusBoard() {
  const summary = document.getElementById("operator-status-summary");
  const filters = document.getElementById("operator-status-filters");
  if (summary) {
    const counts = {
      all: currentOperators.length,
      available: currentOperators.filter((item) => String(item.status || "").toLowerCase() === "available").length,
      en_route: currentOperators.filter((item) => String(item.status || "").toLowerCase() === "en_route").length,
      assigned: currentOperators.filter((item) => String(item.status || "").toLowerCase() === "assigned").length,
      on_scene: currentOperators.filter((item) => String(item.status || "").toLowerCase() === "on_scene").length,
      needs_relief: currentOperators.filter((item) => operatorNeedsRelief(item)).length,
      stale: currentOperators.filter((item) => isOperatorStale(item)).length
    };
    summary.innerHTML = '\n      <div class="operator-status-stat"><strong>'.concat(counts.all, '</strong><span>Total</span></div>\n      <div class="operator-status-stat"><strong>').concat(counts.available, '</strong><span>Available</span></div>\n      <div class="operator-status-stat"><strong>').concat(counts.assigned + counts.en_route + counts.on_scene, '</strong><span>Committed</span></div>\n      <div class="operator-status-stat attention"><strong>').concat(counts.stale, "</strong><span>Stale</span></div>");
  }
  filters == null ? void 0 : filters.querySelectorAll("[data-operator-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.operatorFilter === operatorStatusFilter);
  });
}
function bindOperatorStatusFilters() {
  var _a;
  (_a = document.getElementById("operator-status-filters")) == null ? void 0 : _a.querySelectorAll("[data-operator-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      operatorStatusFilter = button.dataset.operatorFilter || "all";
      renderOperatorList();
    });
  });
}
function openOperatorCheckInComposer(record) {
  var _a, _b, _c;
  if (!record) return;
  const modal = document.getElementById("ops-modal");
  const form = document.getElementById("ops-composer-form");
  const title = document.getElementById("ops-composer-title");
  const subtitle = document.getElementById("ops-composer-subtitle");
  if (!modal || !form || !title || !subtitle) return;
  composerState = { kind: "operator-checkin", mode: "create", recordId: record.id || record.callsign };
  composerDraft = null;
  title.textContent = "Manual Check-In - ".concat(record.callsign || record.name || "Operator");
  subtitle.textContent = "Log a manual or voice-reported check-in and update operator status.";
  form.innerHTML = '\n    <div class="ops-form-grid two-up">\n      <label class="form-field"><span>Callsign</span><input disabled value="'.concat(escapeHtml(record.callsign || ""), '" /></label>\n      <label class="form-field"><span>Status</span><select name="status"><option ').concat(record.status === "available" ? "selected" : "", ">available</option><option ").concat(record.status === "en_route" ? "selected" : "", ">en_route</option><option ").concat(record.status === "assigned" ? "selected" : "", ">assigned</option><option ").concat(record.status === "on_scene" ? "selected" : "", ">on_scene</option><option ").concat(record.status === "monitoring" ? "selected" : "", ">monitoring</option><option ").concat(record.status === "needs_relief" ? "selected" : "", ">needs_relief</option><option ").concat(record.status === "offline" ? "selected" : "", '>offline</option></select></label>\n    </div>\n    <div class="ops-form-grid two-up">\n      <label class="form-field"><span>Check-In Source</span><select name="source"><option value="manual">manual</option><option value="voice">voice</option><option value="map">map</option><option value="rf_confirmed">rf_confirmed</option></select></label>\n      <label class="form-field"><span>Reporter</span><input name="reporter" value="Net Control" /></label>\n    </div>\n    <label class="form-field"><span>Location / Label</span><input name="location" value="').concat(escapeHtml(record.location || ""), '" placeholder="Shelter 3, Staging, voice report, etc." /></label>\n    <div class="ops-form-grid two-up">\n      <label class="form-field"><span>Latitude</span><input name="lat" type="number" step="0.000001" value="').concat(escapeHtml((_a = record.lat) != null ? _a : ""), '" /></label>\n      <label class="form-field"><span>Longitude</span><input name="lng" type="number" step="0.000001" value="').concat(escapeHtml((_b = record.lng) != null ? _b : ""), '" /></label>\n    </div>\n    <label class="form-field"><span>Check-In Note</span><textarea name="note" rows="3" placeholder="Voice report, operational update, ETA, relief request, etc."></textarea></label>\n    <div class="ops-form-actions">\n      <button type="submit" class="button">Save Check-In</button>\n      <button type="button" class="button button-secondary" id="ops-composer-cancel">Cancel</button>\n    </div>');
  modal.classList.remove("is-hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  (_c = document.getElementById("ops-composer-cancel")) == null ? void 0 : _c.addEventListener("click", closeComposer);
  form.onsubmit = async (event) => {
    event.preventDefault();
    const fd = new FormData(form);
    const payload = {
      status: String(fd.get("status") || record.status || "available"),
      source: String(fd.get("source") || "manual"),
      reporter: String(fd.get("reporter") || ""),
      location: String(fd.get("location") || ""),
      lat: fd.get("lat") === "" ? null : Number(fd.get("lat")),
      lng: fd.get("lng") === "" ? null : Number(fd.get("lng")),
      note: String(fd.get("note") || ""),
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    try {
      await ensureAdminToken(false);
      await postWithAdminRetry("/api/operators/".concat(encodeURIComponent(record.id || record.callsign), "/checkins"), payload, "POST");
      closeComposer();
      showOpsToast("Manual check-in saved.", "success");
      await syncRealtimeConsoles();
      await syncRealtimeConsoles(400);
      selectedOpsRecord = { kind: "operator", id: record.id || record.callsign };
      syncOpsGlobals();
      renderOpsFocusCard();
    } catch (error) {
      console.error(error);
      showOpsToast(error.message || "Unable to save manual check-in.", "error");
    }
  };
}
function normalizeDateTimeSubmission(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toISOString();
}
function incidentEntryConfig(kind) {
  if (kind === "comms") {
    return {
      label: "Comms Plan",
      endpoint: "comms-plan",
      title: "Channel",
      subtitle: "Track tactical and command channels for this incident."
    };
  }
  if (kind === "message") {
    return {
      label: "Message Log",
      endpoint: "messages",
      title: "Message",
      subtitle: "Track formal message traffic and handling status."
    };
  }
  return {
    label: "Activity Log",
    endpoint: "activity-log",
    title: "Activity Entry",
    subtitle: "Track ICS-214 style unit activities and significant events."
  };
}
function incidentEntryList(record = {}, kind) {
  if (kind === "comms") return Array.isArray(record.commsPlan) ? record.commsPlan : [];
  if (kind === "message") return Array.isArray(record.messageLog) ? record.messageLog : [];
  return Array.isArray(record.activityLog) ? record.activityLog : [];
}
function buildIncidentEntryForm(kind, incident, entry = {}) {
  const value = (key, fallback = "") => {
    var _a;
    return (_a = entry[key]) != null ? _a : fallback;
  };
  if (kind === "comms") {
    return '\n      <div class="ops-form-grid three-up">\n        <label class="form-field"><span>Assignment</span><input name="assignment" value="'.concat(escapeHtml(value("assignment")), '" placeholder="Command / Shelter 4 / Logistics" /></label>\n        <label class="form-field"><span>Function</span><input name="function" value="').concat(escapeHtml(value("function")), '" placeholder="Primary / Tactical / Backup" /></label>\n        <label class="form-field"><span>Status</span><select name="status">').concat(buildSelectOptions([{ value: "planned", label: "Planned" }, { value: "active", label: "Active" }, { value: "reserve", label: "Reserve" }, { value: "closed", label: "Closed" }], value("status", "planned")), '</select></label>\n      </div>\n      <div class="ops-form-grid three-up">\n        <label class="form-field"><span>Frequency</span><input name="frequency" value="').concat(escapeHtml(value("frequency")), '" placeholder="e.g. 000.000 (+)" /></label>\n        <label class="form-field"><span>Tone / NAC</span><input name="tone" value="').concat(escapeHtml(value("tone")), '" placeholder="PL 127.3 / NAC" /></label>\n        <label class="form-field"><span>Mode</span><input name="mode" value="').concat(escapeHtml(value("mode")), '" placeholder="FM / DMR / Simplex" /></label>\n      </div>\n      <div class="ops-form-grid two-up">\n        <label class="form-field"><span>Assigned Operator</span><input name="operator" value="').concat(escapeHtml(value("operator")), '" placeholder="Callsign or unit" /></label>\n        <label class="form-field"><span>Primary Channel</span><select name="isPrimary">').concat(buildSelectOptions([{ value: "false", label: "No" }, { value: "true", label: "Yes" }], String(Boolean(value("isPrimary", false)))), '</select></label>\n      </div>\n      <label class="form-field"><span>Notes</span><textarea name="notes" rows="3" placeholder="Coverage, repeater notes, handling restrictions">').concat(escapeHtml(value("notes")), "</textarea></label>");
  }
  if (kind === "message") {
    return '\n      <div class="ops-form-grid two-up">\n        <label class="form-field"><span>From</span><input name="from" value="'.concat(escapeHtml(value("from")), '" placeholder="Originating station / person" /></label>\n        <label class="form-field"><span>To</span><input name="to" value="').concat(escapeHtml(value("to")), '" placeholder="Recipient / destination" /></label>\n      </div>\n      <div class="ops-form-grid three-up">\n        <label class="form-field"><span>Precedence</span><select name="precedence">').concat(buildSelectOptions([{ value: "routine", label: "Routine" }, { value: "priority", label: "Priority" }, { value: "welfare", label: "Welfare" }, { value: "emergency", label: "Emergency" }], value("precedence", "routine")), '</select></label>\n        <label class="form-field"><span>Status</span><select name="status">').concat(buildSelectOptions([{ value: "logged", label: "Logged" }, { value: "queued", label: "Queued" }, { value: "sent", label: "Sent" }, { value: "delivered", label: "Delivered" }, { value: "closed", label: "Closed" }], value("status", "logged")), '</select></label>\n        <label class="form-field"><span>Via</span><input name="via" value="').concat(escapeHtml(value("via")), '" placeholder="Voice / digital / runner / Winlink" /></label>\n      </div>\n      <div class="ops-form-grid two-up">\n        <label class="form-field"><span>Logged At</span><input name="createdAt" type="datetime-local" value="').concat(escapeHtml(formatDateTimeLocalValue(value("createdAt", (/* @__PURE__ */ new Date()).toISOString()))), '" /></label>\n        <label class="form-field"><span>Reply Expected</span><select name="replyExpected">').concat(buildSelectOptions([{ value: "false", label: "No" }, { value: "true", label: "Yes" }], String(Boolean(value("replyExpected", false)))), '</select></label>\n      </div>\n      <label class="form-field"><span>Subject</span><input name="subject" value="').concat(escapeHtml(value("subject")), '" placeholder="Message subject / traffic summary" /></label>\n      <label class="form-field"><span>Message Body</span><textarea name="body" rows="4" placeholder="Full traffic text or summary">').concat(escapeHtml(value("body")), "</textarea></label>");
  }
  return '\n    <div class="ops-form-grid two-up">\n      <label class="form-field"><span>Author</span><input name="author" value="'.concat(escapeHtml(value("author")), '" placeholder="Net Control / operator / section" /></label>\n      <label class="form-field"><span>Resource</span><input name="resource" value="').concat(escapeHtml(value("resource")), '" placeholder="Callsign / team / asset" /></label>\n    </div>\n    <div class="ops-form-grid three-up">\n      <label class="form-field"><span>Location</span><input name="location" value="').concat(escapeHtml(value("location")), '" placeholder="Shelter / EOC / field site" /></label>\n      <label class="form-field"><span>Operational Period</span><input name="operationalPeriod" value="').concat(escapeHtml(value("operationalPeriod", (incident == null ? void 0 : incident.operationalPeriod) || "")), '" placeholder="Day / Night / OP name" /></label>\n      <label class="form-field"><span>Logged At</span><input name="createdAt" type="datetime-local" value="').concat(escapeHtml(formatDateTimeLocalValue(value("createdAt", (/* @__PURE__ */ new Date()).toISOString()))), '" /></label>\n    </div>\n    <label class="form-field"><span>Activity</span><textarea name="activity" rows="4" placeholder="Significant action, unit event, handoff, or status change">').concat(escapeHtml(value("activity")), "</textarea></label>");
}
function parseIncidentEntryPayload(kind, form) {
  const fd = new FormData(form);
  if (kind === "comms") {
    return {
      assignment: String(fd.get("assignment") || "").trim(),
      function: String(fd.get("function") || "").trim(),
      status: String(fd.get("status") || "planned").trim(),
      frequency: String(fd.get("frequency") || "").trim(),
      tone: String(fd.get("tone") || "").trim(),
      mode: String(fd.get("mode") || "").trim(),
      operator: String(fd.get("operator") || "").trim(),
      isPrimary: String(fd.get("isPrimary") || "false") === "true",
      notes: String(fd.get("notes") || "").trim()
    };
  }
  if (kind === "message") {
    return {
      from: String(fd.get("from") || "").trim(),
      to: String(fd.get("to") || "").trim(),
      precedence: String(fd.get("precedence") || "routine").trim(),
      status: String(fd.get("status") || "logged").trim(),
      via: String(fd.get("via") || "").trim(),
      createdAt: normalizeDateTimeSubmission(fd.get("createdAt")),
      replyExpected: String(fd.get("replyExpected") || "false") === "true",
      subject: String(fd.get("subject") || "").trim(),
      body: String(fd.get("body") || "").trim()
    };
  }
  return {
    author: String(fd.get("author") || "").trim(),
    resource: String(fd.get("resource") || "").trim(),
    location: String(fd.get("location") || "").trim(),
    operationalPeriod: String(fd.get("operationalPeriod") || "").trim(),
    createdAt: normalizeDateTimeSubmission(fd.get("createdAt")),
    activity: String(fd.get("activity") || "").trim()
  };
}
function openIncidentOpsComposer(kind, incident, entry = null) {
  var _a;
  if (!(incident == null ? void 0 : incident.id)) return;
  const modal = document.getElementById("ops-modal");
  const form = document.getElementById("ops-composer-form");
  const title = document.getElementById("ops-composer-title");
  const subtitle = document.getElementById("ops-composer-subtitle");
  if (!modal || !form || !title || !subtitle) return;
  const config = incidentEntryConfig(kind);
  const mode = entry ? "edit" : "create";
  composerState = { kind: "incident-".concat(kind), mode, recordId: incident.id };
  composerDraft = null;
  title.textContent = "".concat(mode === "edit" ? "Edit" : "Add", " ").concat(config.title);
  subtitle.textContent = "".concat(config.subtitle, " Incident: ").concat(incident.title || incident.id, ".");
  form.innerHTML = "\n    ".concat(buildIncidentEntryForm(kind, incident, entry || {}), '\n    <div class="ops-form-actions">\n      <button type="submit" class="button">').concat(mode === "edit" ? "Save Changes" : "Add ".concat(config.title), '</button>\n      <button type="button" class="button button-secondary" id="ops-composer-cancel">Cancel</button>\n    </div>');
  modal.classList.remove("is-hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  (_a = document.getElementById("ops-composer-cancel")) == null ? void 0 : _a.addEventListener("click", closeComposer);
  form.onsubmit = async (event) => {
    event.preventDefault();
    try {
      await ensureAdminToken(false);
      const payload = parseIncidentEntryPayload(kind, form);
      const endpointBase = "/api/incidents/".concat(encodeURIComponent(incident.id), "/").concat(config.endpoint);
      const endpoint = (entry == null ? void 0 : entry.id) ? "".concat(endpointBase, "/").concat(encodeURIComponent(entry.id)) : endpointBase;
      const method = (entry == null ? void 0 : entry.id) ? "PATCH" : "POST";
      await postWithAdminRetry(endpoint, payload, method);
      closeComposer();
      showOpsToast("".concat(config.title, " saved."), "success");
      await syncRealtimeConsoles();
      await syncRealtimeConsoles(300);
      selectedOpsRecord = { kind: "incident", id: incident.id };
      syncOpsGlobals();
      renderOpsFocusCard();
    } catch (error) {
      console.error(error);
      showOpsToast(error.message || "Unable to save ".concat(config.title.toLowerCase(), "."), "error");
    }
  };
}
async function handleIncidentEntryAction(action, incident, kind, entryId = "") {
  if (!(incident == null ? void 0 : incident.id) || !kind) return;
  const config = incidentEntryConfig(kind);
  const entry = incidentEntryList(incident, kind).find((item) => item.id === entryId) || null;
  if (action === "edit") {
    if (entry) openIncidentOpsComposer(kind, incident, entry);
    return;
  }
  if (action === "delete") {
    if (!entry || !confirmDestructive("Delete this ".concat(config.title.toLowerCase(), " entry?"))) return;
    try {
      await ensureAdminToken(false);
      await apiDeleteWithAdminRetry("/api/incidents/".concat(encodeURIComponent(incident.id), "/").concat(config.endpoint, "/").concat(encodeURIComponent(entry.id)));
      showOpsToast("".concat(config.title, " entry deleted."), "success");
      await syncRealtimeConsoles();
      selectedOpsRecord = { kind: "incident", id: incident.id };
      syncOpsGlobals();
      renderOpsFocusCard();
    } catch (error) {
      console.error(error);
      showOpsToast(error.message || "Unable to delete ".concat(config.title.toLowerCase(), " entry."), "error");
    }
  }
}
function renderOpsSummary() {
  var _a;
  const openIncidents = currentIncidents.filter((item) => !["closed", "resolved", "archived"].includes(String(item.status || "").toLowerCase())).length;
  const availableOperators = currentOperators.filter((item) => String(item.status || "").toLowerCase() === "available").length;
  const openTasks = currentTasks.filter((item) => !["closed", "done", "complete"].includes(String(item.status || "").toLowerCase())).length;
  const overdueOperators = currentOperators.filter((item) => {
    if (!item.lastCheckIn) return true;
    return (Date.now() - new Date(item.lastCheckIn).getTime()) / 6e4 >= 60;
  }).length;
  const reliefDueOperators = currentOperators.filter((item) => operatorNeedsRelief(item)).length;
  const highIncidents = currentIncidents.filter((item) => ["high", "critical"].includes(String(item.priority || "").toLowerCase()) || ["open", "active"].includes(String(item.status || "").toLowerCase())).length;
  document.getElementById("ops-summary-incidents").textContent = String(openIncidents);
  document.getElementById("ops-summary-operators").textContent = String(availableOperators);
  document.getElementById("ops-summary-tasks").textContent = String(openTasks);
  document.getElementById("ops-summary-attention").textContent = String(overdueOperators + highIncidents + reliefDueOperators);
  const attentionEl = document.getElementById("ops-summary-attention");
  if (attentionEl) (_a = attentionEl.closest(".ops-summary-card")) == null ? void 0 : _a.classList.toggle("attention", overdueOperators + highIncidents + reliefDueOperators > 0);
}
function renderIncidentList() {
  const list = document.getElementById("incident-list");
  if (!list) return;
  const items = [...currentIncidents].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  document.getElementById("incident-queue-meta").textContent = "".concat(items.length, " incidents");
  list.innerHTML = items.length ? items.map((item) => buildIncidentCard(item)).join("") : '<div class="empty-state">No incidents yet.</div>';
  wireOpsCards(list, "incident");
}
function renderOperatorList() {
  const list = document.getElementById("operator-list");
  if (!list) return;
  const rank = { needs_relief: 0, unavailable: 1, offline: 2, assigned: 3, en_route: 4, on_scene: 5, monitoring: 6, available: 7 };
  let items = [...currentOperators].sort((a, b) => {
    var _a, _b;
    const statusA = operatorNeedsRelief(a) ? "needs_relief" : String(a.status || "").toLowerCase();
    const statusB = operatorNeedsRelief(b) ? "needs_relief" : String(b.status || "").toLowerCase();
    return ((_a = rank[statusA]) != null ? _a : 9) - ((_b = rank[statusB]) != null ? _b : 9);
  });
  if (operatorStatusFilter !== "all") {
    items = items.filter((item) => matchOperatorStatusFilter(item, operatorStatusFilter));
  }
  document.getElementById("operator-board-meta").textContent = "".concat(items.length, " operators");
  renderOperatorStatusBoard();
  list.innerHTML = items.length ? items.map((item) => buildOperatorCard(item)).join("") : '<div class="empty-state">No operators match this filter.</div>';
  wireOpsCards(list, "operator");
}
function renderTaskList() {
  const list = document.getElementById("task-list");
  if (!list) return;
  const priorityRank = { critical: 0, high: 1, medium: 2, low: 3 };
  const items = [...currentTasks].sort((a, b) => {
    var _a, _b;
    return ((_a = priorityRank[String(a.priority || "").toLowerCase()]) != null ? _a : 9) - ((_b = priorityRank[String(b.priority || "").toLowerCase()]) != null ? _b : 9);
  });
  document.getElementById("task-board-meta").textContent = "".concat(items.length, " tasks");
  list.innerHTML = items.length ? items.map((item) => buildTaskCard(item)).join("") : '<div class="empty-state">No tasks yet.</div>';
  wireOpsCards(list, "task");
}
function buildIncidentCard(item) {
  const selected = (selectedOpsRecord == null ? void 0 : selectedOpsRecord.kind) === "incident" && selectedOpsRecord.id === item.id;
  const priority = String(item.priority || inferIncidentPriority(item.status)).toLowerCase();
  const status = String(item.status || "monitoring").toLowerCase();
  return '\n    <article class="ops-item-card '.concat(selected ? "is-selected" : "", '" data-ops-kind="incident" data-ops-id="').concat(item.id, '">\n      <div class="ops-item-top">\n        <div>\n          <div class="ops-item-title">').concat(escapeHtml(item.title || "Untitled Incident"), '</div>\n          <div class="ops-item-subtitle">').concat(escapeHtml(item.type || "general"), " - OP ").concat(escapeHtml(item.operationalPeriod || "Current"), " - Assigned ").concat(escapeHtml(item.assignedOperator || item.assignment || "unassigned"), " - Created ").concat(relativeTime(item.createdAt), '</div>\n        </div>\n        <div class="ops-badges">\n          <span class="ops-badge priority-').concat(priority, '">').concat(priority, '</span>\n          <span class="ops-badge status-').concat(status, '">').concat(status, '</span>\n        </div>\n      </div>\n      <div class="ops-item-meta">\n        <span>Notes: ').concat(item.notes ? escapeHtml(String(item.notes).slice(0, 60)) : "None", "</span>\n        <span>").concat(item.incidentCommander || item.netControl ? "IC ".concat(escapeHtml(item.incidentCommander || "Unassigned"), " - Net ").concat(escapeHtml(item.netControl || "TBD")) : "Command roles not set", "</span>\n        <span>").concat(escapeHtml(incidentCommsSummary(item)), "</span>\n        <span>").concat(typeof item.lat === "number" ? "".concat(item.lat.toFixed(3), ", ").concat(item.lng.toFixed(3)) : "Map position unavailable", '</span>\n      </div>\n      <div class="ops-item-actions">\n        <button class="button button-secondary ops-card-action" data-action="focus-incident" data-id="').concat(item.id, '">Focus</button>\n        <button class="button button-ghost ops-card-action" data-action="edit-incident" data-id="').concat(item.id, '">Edit</button>\n      </div>\n    </article>');
}
function buildOperatorCard(item) {
  const selected = (selectedOpsRecord == null ? void 0 : selectedOpsRecord.kind) === "operator" && selectedOpsRecord.id === (item.id || item.callsign);
  const status = String(item.status || "available").toLowerCase();
  const reliefLabel = operatorNeedsRelief(item) ? "Relief due ".concat(formatDateTimeDisplay(item.reliefDue, "now")) : "Relief not due";
  return '\n    <article class="ops-item-card '.concat(selected ? "is-selected" : "", '" data-ops-kind="operator" data-ops-id="').concat(item.id || item.callsign, '">\n      <div class="ops-item-top">\n        <div>\n          <div class="ops-item-title">').concat(escapeHtml(item.callsign || "UNKNOWN"), " ").concat(item.name ? " -  ".concat(escapeHtml(item.name)) : "", '</div>\n          <div class="ops-item-subtitle">').concat(titleCase(item.role || "unassigned"), " - ").concat(escapeHtml(operatorResourceSummary(item)), " - Incident ").concat(escapeHtml(resolveIncidentDisplay(item)), " - Check-in ").concat(relativeTime(item.lastCheckIn), '</div>\n        </div>\n        <div class="ops-badges">\n          <span class="ops-badge status-').concat(status, '">').concat(status, "</span>\n          ").concat(operatorNeedsRelief(item) ? '<span class="ops-badge priority-high">needs relief</span>' : "", '\n        </div>\n      </div>\n      <div class="ops-item-meta">\n        <span>').concat(item.location || (typeof item.lat === "number" ? "".concat(item.lat.toFixed(3), ", ").concat(item.lng.toFixed(3)) : "Location not set"), "</span>\n        <span>").concat(Array.isArray(item.capabilities) && item.capabilities.length ? item.capabilities.join(", ") : "No capabilities listed", "</span>\n        <span>").concat(reliefLabel, "</span>\n        <span>").concat(item.lastCheckInNote ? escapeHtml(item.lastCheckInNote) : "No recent manual note", '</span>\n      </div>\n      <div class="ops-item-actions">\n        <button class="button button-secondary ops-card-action" data-action="focus-operator" data-id="').concat(item.id, '">Inspect</button>\n        <button class="button button-ghost ops-card-action" data-action="edit-operator" data-id="').concat(item.id, '">Edit</button>\n      </div>\n    </article>');
}
function buildTaskCard(item) {
  const selected = (selectedOpsRecord == null ? void 0 : selectedOpsRecord.kind) === "task" && selectedOpsRecord.id === item.id;
  const priority = String(item.priority || "medium").toLowerCase();
  const status = String(item.status || "open").toLowerCase();
  return '\n    <article class="ops-item-card '.concat(selected ? "is-selected" : "", '" data-ops-kind="task" data-ops-id="').concat(item.id, '">\n      <div class="ops-item-top">\n        <div>\n          <div class="ops-item-title">').concat(item.title || "Untitled Task", '</div>\n          <div class="ops-item-subtitle">Assigned to ').concat(item.assignedTo || "unassigned", " - Incident ").concat(item.incidentTitle || resolveIncidentDisplay(item)).concat(item.due ? " - Due ".concat(item.due) : "", '</div>\n        </div>\n        <div class="ops-badges">\n          <span class="ops-badge priority-').concat(priority, '">').concat(priority, '</span>\n          <span class="ops-badge status-').concat(status, '">').concat(status, '</span>\n        </div>\n      </div>\n      <div class="ops-item-meta">\n        <span>').concat(item.notes ? escapeHtml(String(item.notes).slice(0, 70)) : "No notes", "</span>\n        <span>").concat(item.location || (typeof item.lat === "number" ? "".concat(item.lat.toFixed(3), ", ").concat(item.lng.toFixed(3)) : "No map point"), '</span>\n      </div>\n      <div class="ops-item-actions">\n        <button class="button button-secondary ops-card-action" data-action="focus-task" data-id="').concat(item.id, '">Inspect</button>\n        <button class="button button-ghost ops-card-action" data-action="edit-task" data-id="').concat(item.id, '">Edit</button>\n      </div>\n    </article>');
}
function wireOpsCards(container) {
  container.querySelectorAll("[data-ops-kind][data-ops-id]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (safeClosest(event.target, "button")) return;
      setSelectedOpsRecord(card.dataset.opsKind, card.dataset.opsId);
    });
  });
  container.querySelectorAll(".ops-card-action").forEach((button) => {
    button.addEventListener("click", () => {
      var _a;
      const action = button.dataset.action;
      const id = button.dataset.id;
      if (action === "focus-incident") {
        setSelectedOpsRecord("incident", id);
      }
      if (action === "focus-operator") {
        setSelectedOpsRecord("operator", id);
      }
      if (action === "focus-task") {
        setSelectedOpsRecord("task", id);
      }
      (_a = document.getElementById("ops-focus-card")) == null ? void 0 : _a.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });
}
function getOpsTabForRecordKind(kind) {
  if (kind === "operator") return "operators";
  if (kind === "task") return "tasks";
  return "incidents";
}
function setSelectedOpsRecord(kind, id) {
  selectedOpsRecord = { kind, id };
  setActiveSection("operations");
  setActiveOpsTab(getOpsTabForRecordKind(kind));
  syncOpsGlobals();
  renderIncidentList();
  renderOperatorList();
  renderTaskList();
  renderOpsFocusCard();
  window.requestAnimationFrame(() => {
    var _a;
    (_a = document.getElementById("ops-focus-card")) == null ? void 0 : _a.scrollIntoView({ behavior: "auto", block: "start" });
  });
  const record = getSelectedRecordByKind(kind, id);
  window.dispatchEvent(new CustomEvent("ares:selected-record", { detail: { kind, id, record } }));
}
function getSelectedRecordByKind(kind, id) {
  if (kind === "incident") return currentIncidents.find((item) => item.id === id) || null;
  if (kind === "operator") return currentOperators.find((item) => item.id === id || item.callsign === id) || null;
  if (kind === "task") return currentTasks.find((item) => item.id === id) || null;
  return null;
}
function readInlineFocusPayload(kind, container, record = {}) {
  const payload = {};
  container.querySelectorAll("[data-inline-field]").forEach((field) => {
    const name = field.dataset.inlineField;
    if (!name) return;
    payload[name] = field.value;
  });
  if (kind === "incident") {
    return {
      status: payload.status || record.status || "monitoring",
      priority: payload.priority || record.priority || "medium",
      assignedOperator: payload.assignedOperator || payload.assignment || record.assignedOperator || record.assignment || "unassigned",
      operationalPeriod: payload.operationalPeriod || record.operationalPeriod || "",
      incidentCommander: payload.incidentCommander || record.incidentCommander || "",
      netControl: payload.netControl || record.netControl || "",
      primaryFrequency: payload.primaryFrequency || record.primaryFrequency || "",
      tacticalFrequency: payload.tacticalFrequency || record.tacticalFrequency || "",
      stagingLocation: payload.stagingLocation || record.stagingLocation || ""
    };
  }
  if (kind === "operator") {
    return {
      status: payload.status || record.status || "available",
      role: payload.role || record.role || "unassigned",
      assignedIncidentId: payload.assignedIncidentId || record.assignedIncidentId || "unassigned",
      location: payload.location || record.location || "",
      lat: payload.lat ? Number(payload.lat) : record.lat,
      lng: payload.lng ? Number(payload.lng) : record.lng,
      lastCheckIn: payload.lastCheckIn || record.lastCheckIn || void 0,
      resourceType: payload.resourceType || record.resourceType || "operator",
      tacticalCallsign: payload.tacticalCallsign || record.tacticalCallsign || "",
      team: payload.team || record.team || "",
      reachability: payload.reachability || record.reachability || "unknown",
      reliefDue: payload.reliefDue || record.reliefDue || ""
    };
  }
  return {
    status: payload.status || record.status || "open",
    priority: payload.priority || record.priority || "medium",
    assignedTo: payload.assignedTo || record.assignedTo || "unassigned",
    incidentId: payload.incidentId || record.incidentId || "unassigned",
    location: payload.location || record.location || "",
    lat: payload.lat ? Number(payload.lat) : record.lat,
    lng: payload.lng ? Number(payload.lng) : record.lng
  };
}
async function handleFocusCardAction(action, kind, record, container) {
  if (!action || !kind || !record) return;
  if (action === "zoom" && typeof record.lat === "number" && typeof record.lng === "number") {
    if (window.map && typeof window.map.setView === "function") {
      window.map.setView([record.lat, record.lng], 14);
    }
    return;
  }
  if (action === "edit") {
    openEditorForSelectedRecord();
    return;
  }
  if (action === "refresh") {
    await renderOperationalWorkspace();
    return;
  }
  if (action === "checkin" && kind === "operator") {
    try {
      await ensureAdminToken(false);
      await postWithAdminRetry("/api/operators/".concat(record.id, "/checkins"), { timestamp: (/* @__PURE__ */ new Date()).toISOString(), source: "manual", status: record.status || "available", location: record.location || "", lat: record.lat, lng: record.lng, note: "Quick check-in" }, "POST");
      showOpsToast("Operator check-in updated.", "success");
      await syncRealtimeConsoles();
    } catch (error) {
      console.error(error);
      showOpsToast(error.message || "Unable to update operator.", "error");
    }
    return;
  }
  if (action === "manual-checkin" && kind === "operator") {
    openOperatorCheckInComposer(record);
    return;
  }
  if (kind === "incident" && action === "add-comms-entry") {
    openIncidentOpsComposer("comms", record);
    return;
  }
  if (kind === "incident" && action === "add-message-entry") {
    openIncidentOpsComposer("message", record);
    return;
  }
  if (kind === "incident" && action === "add-activity-entry") {
    openIncidentOpsComposer("activity", record);
    return;
  }
  if (action === "save-inline") {
    try {
      await ensureAdminToken(false);
      const payload = readInlineFocusPayload(kind, container, record);
      const endpoint = "/api/".concat(kind === "incident" ? "incidents" : kind === "operator" ? "operators" : "tasks", "/").concat(record.id);
      await postWithAdminRetry(endpoint, payload, "PATCH");
      showOpsToast("".concat(titleCase(kind), " updated."), "success");
      await syncRealtimeConsoles();
    } catch (error) {
      console.error(error);
      showOpsToast(error.message || "Unable to save changes.", "error");
    }
    return;
  }
  if (action === "archive") {
    if (!confirmDestructive("Archive this ".concat(kind, "?"))) return;
    try {
      await ensureAdminToken(false);
      const payload = kind === "task" ? { status: "archived" } : { status: "archived" };
      const endpoint = "/api/".concat(kind === "incident" ? "incidents" : kind === "operator" ? "operators" : "tasks", "/").concat(record.id);
      await postWithAdminRetry(endpoint, payload, "PATCH");
      showOpsToast("".concat(titleCase(kind), " archived."), "success");
      if (selectedOpsRecord && selectedOpsRecord.kind === kind && selectedOpsRecord.id === record.id) {
        selectedOpsRecord = null;
        syncOpsGlobals();
      }
      await syncRealtimeConsoles();
      if (kind === "incident") setActiveOpsTab("incidents");
      if (kind === "task") setActiveOpsTab("tasks");
    } catch (error) {
      console.error(error);
      showOpsToast(error.message || "Unable to archive record.", "error");
    }
    return;
  }
  if (action === "delete") {
    try {
      await deleteOpsRecord(kind, record.id);
    } catch (error) {
      console.error(error);
      showOpsToast(error.message || "Unable to delete record.", "error");
    }
  }
}
function renderOpsFocusCard() {
  var _a, _b;
  const el = document.getElementById("ops-focus-card");
  if (!el) return;
  if (!selectedOpsRecord) {
    el.className = "ops-focus-body empty-state";
    el.innerHTML = "Select an incident, operator, or task to inspect it here.";
    return;
  }
  el.className = "ops-focus-body";
  let record = null;
  if (selectedOpsRecord.kind === "incident") record = currentIncidents.find((item) => item.id === selectedOpsRecord.id);
  if (selectedOpsRecord.kind === "operator") record = currentOperators.find((item) => item.id === selectedOpsRecord.id || item.callsign === selectedOpsRecord.id);
  if (selectedOpsRecord.kind === "task") record = currentTasks.find((item) => item.id === selectedOpsRecord.id);
  if (!record) {
    el.className = "ops-focus-body empty-state";
    el.innerHTML = "Selected record not found.";
    return;
  }
  el.innerHTML = buildFocusCardMarkup(selectedOpsRecord.kind, record);
  el.querySelectorAll(".ops-focus-action").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.action;
      await handleFocusCardAction(action, selectedOpsRecord.kind, record, el);
    });
  });
  if (selectedOpsRecord.kind === "incident") {
    el.querySelectorAll(".ops-incident-entry-action").forEach((button) => {
      button.addEventListener("click", async () => {
        await handleIncidentEntryAction(button.dataset.entryAction, record, button.dataset.entryKind, button.dataset.entryId || "");
      });
    });
  }
  if (selectedOpsRecord.kind === "operator") {
    const timelineEl = document.getElementById("operator-timeline");
    if (timelineEl) {
      loadOperatorCheckins(record).then((items) => renderOperatorTimeline(timelineEl, record, items)).catch(() => {
        timelineEl.innerHTML = '<div class="empty-state small">Unable to load operator activity.</div>';
      });
    }
  }
  if (selectedOpsRecord.kind === "incident") {
    const dispatchEl = document.getElementById("incident-dispatch-panel");
    if (dispatchEl) {
      loadDispatchRecommendations(record.id).then((items) => renderDispatchCandidates(dispatchEl, record, items)).catch(() => {
        dispatchEl.innerHTML = '<div class="empty-state small">Unable to load dispatch recommendations.</div>';
      });
    }
  }
  (_b = (_a = window.AresDispatch) == null ? void 0 : _a.refresh) == null ? void 0 : _b.call(_a);
}
function renderIncidentCommsEntries(record = {}) {
  const items = incidentEntryList(record, "comms");
  if (!items.length) return '<div class="empty-state small">No comm plan entries yet.</div>';
  return '<div class="incident-log-list">'.concat(items.map((entry) => '\n    <div class="incident-log-entry">\n      <div class="incident-log-entry-head">\n        <div>\n          <strong>'.concat(escapeHtml(entry.assignment || entry.function || "Channel"), "</strong>\n          <span>").concat(escapeHtml([entry.frequency, entry.mode, entry.tone].filter(Boolean).join(" - ") || "Frequency not set"), '</span>\n        </div>\n        <div class="incident-log-badges">\n          ').concat(entry.isPrimary ? '<span class="ops-badge priority-high">primary</span>' : "", '\n          <span class="ops-badge status-monitoring">').concat(escapeHtml(entry.status || "planned"), '</span>\n        </div>\n      </div>\n      <div class="incident-log-entry-body">').concat(escapeHtml([entry.function, entry.operator, entry.notes].filter(Boolean).join(" - ") || "No channel notes yet"), '</div>\n      <div class="incident-log-entry-actions">\n        <button class="button button-secondary button-small ops-incident-entry-action" type="button" data-entry-kind="comms" data-entry-action="edit" data-entry-id="').concat(escapeHtml(entry.id), '">Edit</button>\n        <button class="button button-ghost button-small ops-incident-entry-action" type="button" data-entry-kind="comms" data-entry-action="delete" data-entry-id="').concat(escapeHtml(entry.id), '">Delete</button>\n      </div>\n    </div>')).join(""), "</div>");
}
function renderIncidentMessageEntries(record = {}) {
  const items = incidentEntryList(record, "message");
  if (!items.length) return '<div class="empty-state small">No formal message traffic logged yet.</div>';
  return '<div class="incident-log-list">'.concat(items.map((entry) => '\n    <div class="incident-log-entry">\n      <div class="incident-log-entry-head">\n        <div>\n          <strong>'.concat(escapeHtml(entry.subject || "Message"), "</strong>\n          <span>").concat(escapeHtml([entry.from, entry.to].filter(Boolean).join(" -> ") || "Origin and destination not set"), '</span>\n        </div>\n        <div class="incident-log-badges">\n          <span class="ops-badge priority-').concat(entry.precedence === "emergency" ? "critical" : entry.precedence === "priority" ? "high" : "medium", '">').concat(escapeHtml(entry.precedence || "routine"), '</span>\n          <span class="ops-badge status-monitoring">').concat(escapeHtml(entry.status || "logged"), '</span>\n        </div>\n      </div>\n      <div class="incident-log-entry-body">').concat(escapeHtml(entry.body || "No message body captured."), '</div>\n      <div class="incident-log-entry-meta">').concat(escapeHtml([formatDateTimeDisplay(entry.createdAt), entry.via ? "via ".concat(entry.via) : "", entry.replyExpected ? "reply expected" : ""].filter(Boolean).join(" - ")), '</div>\n      <div class="incident-log-entry-actions">\n        <button class="button button-secondary button-small ops-incident-entry-action" type="button" data-entry-kind="message" data-entry-action="edit" data-entry-id="').concat(escapeHtml(entry.id), '">Edit</button>\n        <button class="button button-ghost button-small ops-incident-entry-action" type="button" data-entry-kind="message" data-entry-action="delete" data-entry-id="').concat(escapeHtml(entry.id), '">Delete</button>\n      </div>\n    </div>')).join(""), "</div>");
}
function renderIncidentActivityEntries(record = {}) {
  const items = incidentEntryList(record, "activity");
  if (!items.length) return '<div class="empty-state small">No activity log entries yet.</div>';
  return '<div class="incident-log-list">'.concat(items.map((entry) => '\n    <div class="incident-log-entry">\n      <div class="incident-log-entry-head">\n        <div>\n          <strong>'.concat(escapeHtml(entry.author || entry.resource || "Activity"), "</strong>\n          <span>").concat(escapeHtml([entry.location, entry.operationalPeriod].filter(Boolean).join(" - ") || formatDateTimeDisplay(entry.createdAt)), '</span>\n        </div>\n      </div>\n      <div class="incident-log-entry-body">').concat(escapeHtml(entry.activity || "No activity text captured."), '</div>\n      <div class="incident-log-entry-meta">').concat(escapeHtml([formatDateTimeDisplay(entry.createdAt), entry.resource || ""].filter(Boolean).join(" - ")), '</div>\n      <div class="incident-log-entry-actions">\n        <button class="button button-secondary button-small ops-incident-entry-action" type="button" data-entry-kind="activity" data-entry-action="edit" data-entry-id="').concat(escapeHtml(entry.id), '">Edit</button>\n        <button class="button button-ghost button-small ops-incident-entry-action" type="button" data-entry-kind="activity" data-entry-action="delete" data-entry-id="').concat(escapeHtml(entry.id), '">Delete</button>\n      </div>\n    </div>')).join(""), "</div>");
}
function buildFocusCardMarkup(kind, record) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const operatorOptions = buildOperatorOptions(kind === "incident" ? record.assignedOperator || record.assignment || "unassigned" : record.assignedTo || "unassigned");
  const incidentOptions = buildIncidentOptions(kind === "operator" ? record.assignedIncidentId || "unassigned" : record.incidentId || "unassigned");
  const roleOptions = buildRoleOptions(record.role || "unassigned");
  if (kind === "incident") {
    return '\n      <div class="ops-item-top">\n        <div>\n          <div class="ops-item-title">'.concat(escapeHtml(record.title || "Untitled Incident"), '</div>\n          <div class="ops-focus-meta">').concat(escapeHtml(record.type || "general"), " incident - OP ").concat(escapeHtml(record.operationalPeriod || "Current"), " - ").concat(relativeTime(record.createdAt), '</div>\n        </div>\n        <div class="ops-badges">\n          <span class="ops-badge priority-').concat(String(record.priority || inferIncidentPriority(record.status)).toLowerCase(), '">').concat(String(record.priority || inferIncidentPriority(record.status)).toLowerCase(), '</span>\n          <span class="ops-badge status-').concat(String(record.status || "monitoring").toLowerCase(), '">').concat(String(record.status || "monitoring").toLowerCase(), '</span>\n        </div>\n      </div>\n      <div class="ops-focus-grid">\n        <div class="ops-focus-stat"><strong>Coordinates</strong><span>').concat(typeof record.lat === "number" ? "".concat(record.lat.toFixed(4), ", ").concat(record.lng.toFixed(4)) : "Unavailable", '</span></div>\n        <div class="ops-focus-stat"><strong>Assigned Operator</strong><span>').concat(escapeHtml(record.assignedOperator || record.assignment || "unassigned"), '</span></div>\n        <div class="ops-focus-stat"><strong>Incident Commander</strong><span>').concat(escapeHtml(record.incidentCommander || "Not assigned"), '</span></div>\n        <div class="ops-focus-stat"><strong>Net Control</strong><span>').concat(escapeHtml(record.netControl || "Not assigned"), '</span></div>\n        <div class="ops-focus-stat"><strong>Primary Frequency</strong><span>').concat(escapeHtml(record.primaryFrequency || "Not set"), '</span></div>\n        <div class="ops-focus-stat"><strong>Tactical Frequency</strong><span>').concat(escapeHtml(record.tacticalFrequency || "Not set"), '</span></div>\n        <div class="ops-focus-stat"><strong>Staging Location</strong><span>').concat(escapeHtml(record.stagingLocation || "Not set"), '</span></div>\n        <div class="ops-focus-stat"><strong>Comms Plan</strong><span>').concat(record.commsPlanCount || 0, " channel").concat(record.commsPlanCount === 1 ? "" : "s", '</span></div>\n        <div class="ops-focus-stat"><strong>Message Log</strong><span>').concat(record.messageLogCount || 0, " message").concat(record.messageLogCount === 1 ? "" : "s", '</span></div>\n        <div class="ops-focus-stat"><strong>Activity Log</strong><span>').concat(record.activityLogCount || 0, " entr").concat(record.activityLogCount === 1 ? "y" : "ies", '</span></div>\n        <div class="ops-focus-stat"><strong>Last Assignment</strong><span>').concat(record.lastAssignmentAt ? "".concat(titleCase(record.lastAssignmentAction || "updated"), " - ").concat(formatDateTimeDisplay(record.lastAssignmentAt)) : "No assignment updates yet", '</span></div>\n        <div class="ops-focus-stat"><strong>Objectives</strong><span>').concat(formatMultilineValue(record.objectives, "No objectives captured"), '</span></div>\n        <div class="ops-focus-stat"><strong>SITREP</strong><span>').concat(formatMultilineValue(record.sitrep, "No SITREP captured"), '</span></div>\n        <div class="ops-focus-stat"><strong>Notes</strong><span>').concat(formatMultilineValue(record.notes, "None yet"), '</span></div>\n      </div>\n      <div class="ops-timeline-block">\n        <div class="ops-section-title">Comms Plan</div>\n        <div class="incident-log-toolbar">\n          <button class="button button-secondary button-small ops-focus-action" type="button" data-action="add-comms-entry">Add Channel</button>\n        </div>\n        ').concat(renderIncidentCommsEntries(record), '\n      </div>\n      <div class="ops-timeline-block">\n        <div class="ops-section-title">Message Log</div>\n        <div class="incident-log-toolbar">\n          <button class="button button-secondary button-small ops-focus-action" type="button" data-action="add-message-entry">Add Message</button>\n        </div>\n        ').concat(renderIncidentMessageEntries(record), '\n      </div>\n      <div class="ops-timeline-block">\n        <div class="ops-section-title">Activity Log</div>\n        <div class="incident-log-toolbar">\n          <button class="button button-secondary button-small ops-focus-action" type="button" data-action="add-activity-entry">Add Activity</button>\n        </div>\n        ').concat(renderIncidentActivityEntries(record), '\n      </div>\n      <div class="ops-timeline-block">\n        <div class="ops-section-title">Dispatch Recommendations</div>\n        <div class="dispatch-recommendations" id="incident-dispatch-panel">Loading nearest operators...</div>\n      </div>\n      <div class="ops-inline-controls">\n        <label class="form-field compact"><span>Status</span><select data-inline-field="status"><option ').concat(record.status === "monitoring" ? "selected" : "", ">monitoring</option><option ").concat(record.status === "open" ? "selected" : "", ">open</option><option ").concat(record.status === "active" ? "selected" : "", ">active</option><option ").concat(record.status === "resolved" ? "selected" : "", ">resolved</option><option ").concat(record.status === "closed" ? "selected" : "", ">closed</option><option ").concat(record.status === "archived" ? "selected" : "", '>archived</option></select></label>\n        <label class="form-field compact"><span>Priority</span><select data-inline-field="priority"><option ').concat(record.priority === "low" ? "selected" : "", ">low</option><option ").concat(record.priority === "medium" ? "selected" : "", ">medium</option><option ").concat(record.priority === "high" ? "selected" : "", ">high</option><option ").concat(record.priority === "critical" ? "selected" : "", '>critical</option></select></label>\n        <label class="form-field compact"><span>Assigned Operator</span><select data-inline-field="assignedOperator">').concat(operatorOptions, '</select></label>\n        <label class="form-field compact"><span>Operational Period</span><input data-inline-field="operationalPeriod" value="').concat(escapeHtml(record.operationalPeriod || ""), '" /></label>\n        <label class="form-field compact"><span>Incident Commander</span><input data-inline-field="incidentCommander" value="').concat(escapeHtml(record.incidentCommander || ""), '" /></label>\n        <label class="form-field compact"><span>Net Control</span><input data-inline-field="netControl" value="').concat(escapeHtml(record.netControl || ""), '" /></label>\n        <label class="form-field compact"><span>Primary Frequency</span><input data-inline-field="primaryFrequency" value="').concat(escapeHtml(record.primaryFrequency || ""), '" /></label>\n        <label class="form-field compact"><span>Tactical Frequency</span><input data-inline-field="tacticalFrequency" value="').concat(escapeHtml(record.tacticalFrequency || ""), '" /></label>\n        <label class="form-field compact"><span>Staging</span><input data-inline-field="stagingLocation" value="').concat(escapeHtml(record.stagingLocation || ""), '" /></label>\n      </div>\n      <div class="ops-focus-actions">\n        <button class="button ops-focus-action" data-action="zoom">Zoom to Incident</button>\n        <button class="button button-secondary ops-focus-action" data-action="save-inline">Save Inline</button>\n        <button class="button button-secondary ops-focus-action" data-action="edit">Full Edit</button>\n        <button class="button button-ghost ops-focus-action" data-action="archive">Archive</button>\n        <button class="button button-ghost danger ops-focus-action" data-action="delete">Delete</button>\n      </div>');
  }
  if (kind === "operator") {
    return '\n      <div class="ops-item-top">\n        <div>\n          <div class="ops-item-title">'.concat(escapeHtml(record.callsign || "UNKNOWN"), '</div>\n          <div class="ops-focus-meta">').concat(escapeHtml(record.name || "Unknown Operator"), " - ").concat(titleCase(record.role || "unassigned"), " - ").concat(escapeHtml(operatorResourceSummary(record)), " - ").concat(relativeTime(record.lastCheckIn), '</div>\n        </div>\n        <div class="ops-badges">\n          <span class="ops-badge status-').concat(String(record.status || "available").toLowerCase(), '">').concat(String(record.status || "available").toLowerCase(), "</span>\n          ").concat(operatorNeedsRelief(record) ? '<span class="ops-badge priority-high">needs relief</span>' : "", '\n        </div>\n      </div>\n      <div class="ops-focus-grid">\n        <div class="ops-focus-stat"><strong>Location</strong><span>').concat(escapeHtml(record.location || "Unknown"), '</span></div>\n        <div class="ops-focus-stat"><strong>Coordinates</strong><span>').concat(typeof record.lat === "number" ? "".concat(record.lat.toFixed(4), ", ").concat(record.lng.toFixed(4)) : "Unavailable", '</span></div>\n        <div class="ops-focus-stat"><strong>Resource Type</strong><span>').concat(escapeHtml(titleCase(record.resourceType || "operator")), '</span></div>\n        <div class="ops-focus-stat"><strong>Team / Unit</strong><span>').concat(escapeHtml(record.team || "Not assigned"), '</span></div>\n        <div class="ops-focus-stat"><strong>Tactical Callsign</strong><span>').concat(escapeHtml(record.tacticalCallsign || "Not set"), '</span></div>\n        <div class="ops-focus-stat"><strong>Reachability</strong><span>').concat(escapeHtml(titleCase(record.reachability || "unknown")), '</span></div>\n        <div class="ops-focus-stat"><strong>Go-Kit</strong><span>').concat(escapeHtml(titleCase(record.goKitStatus || "unknown")), '</span></div>\n        <div class="ops-focus-stat"><strong>Vehicle</strong><span>').concat(escapeHtml(titleCase(record.vehicleStatus || "unknown")), '</span></div>\n        <div class="ops-focus-stat"><strong>Home Base</strong><span>').concat(escapeHtml(record.homeBase || "Not set"), '</span></div>\n        <div class="ops-focus-stat"><strong>Shift Window</strong><span>').concat(record.shiftStart || record.shiftEnd ? "".concat(formatDateTimeDisplay(record.shiftStart), " - ").concat(formatDateTimeDisplay(record.shiftEnd)) : "Not set", '</span></div>\n        <div class="ops-focus-stat"><strong>Relief Due</strong><span>').concat(record.reliefDue ? "".concat(formatDateTimeDisplay(record.reliefDue)).concat(operatorNeedsRelief(record) ? " - attention" : "") : "Not set", '</span></div>\n        <div class="ops-focus-stat"><strong>Assignment Lifecycle</strong><span>').concat(escapeHtml(titleCase(record.assignmentStatus || "unassigned"))).concat(record.assignmentLastMovedAt ? " - ".concat(formatDateTimeDisplay(record.assignmentLastMovedAt)) : "", '</span></div>\n        <div class="ops-focus-stat"><strong>Capabilities</strong><span>').concat(Array.isArray(record.capabilities) && record.capabilities.length ? escapeHtml(record.capabilities.join(", ")) : "None listed", '</span></div>\n        <div class="ops-focus-stat"><strong>APRS Callsign</strong><span>').concat(escapeHtml(record.aprsCallsign || " - "), '</span></div>\n        <div class="ops-focus-stat"><strong>Meshtastic Node</strong><span>').concat(escapeHtml(record.meshtasticNodeId || " - "), '</span></div>\n        <div class="ops-focus-stat"><strong>DMR ID</strong><span>').concat(escapeHtml(record.dmrId || " - "), '</span></div>\n        <div class="ops-focus-stat"><strong>Aliases</strong><span>').concat(Array.isArray(record.aliases) && record.aliases.length ? escapeHtml(record.aliases.join(", ")) : "None listed", '</span></div>\n        <div class="ops-focus-stat"><strong>ICS Role</strong><span>').concat(titleCase(record.role || "unassigned"), '</span></div>\n        <div class="ops-focus-stat"><strong>Assigned Incident</strong><span>').concat(escapeHtml(resolveIncidentDisplay(record)), '</span></div>\n        <div class="ops-focus-stat"><strong>Last Check-in</strong><span>').concat(relativeTime(record.lastCheckIn), '</span></div>\n        <div class="ops-focus-stat"><strong>Check-in Source</strong><span>').concat(titleCase(String(record.lastCheckInSource || "manual").replace(/_/g, " ")), '</span></div>\n        <div class="ops-focus-stat"><strong>Check-in Note</strong><span>').concat(record.lastCheckInNote ? escapeHtml(record.lastCheckInNote) : "None", '</span></div>\n        <div class="ops-focus-stat"><strong>Last Voice Contact</strong><span>').concat(formatDateTimeDisplay(record.lastVoiceContact), '</span></div>\n        <div class="ops-focus-stat"><strong>Best Tracking Source</strong><span>').concat(sourceDisplayLabel(((_a = record.tracking) == null ? void 0 : _a.bestSource) || "manual"), '</span></div>\n        <div class="ops-focus-stat"><strong>Tracking Confidence</strong><span>').concat(confidenceLabel((_b = record.tracking) == null ? void 0 : _b.confidence)).concat(((_c = record.tracking) == null ? void 0 : _c.manualPreferred) ? " - Manual preferred" : "", '</span></div>\n        <div class="ops-focus-stat"><strong>RF Freshness</strong><span>').concat(((_d = record.tracking) == null ? void 0 : _d.staleLabel) || "Unknown", '</span></div>\n        <div class="ops-focus-stat"><strong>Source Mix</strong><span>').concat(escapeHtml(record.sourceSummary || "Manual"), '</span></div>\n      </div>\n      <div class="ops-timeline-block">\n        <div class="ops-section-title">Operator Activity</div>\n        <div class="ops-timeline" id="operator-timeline">Loading activity...</div>\n      </div>\n      <div class="ops-inline-controls">\n        <label class="form-field compact"><span>Status</span><select data-inline-field="status"><option ').concat(record.status === "available" ? "selected" : "", ">available</option><option ").concat(record.status === "en_route" ? "selected" : "", ">en_route</option><option ").concat(record.status === "assigned" ? "selected" : "", ">assigned</option><option ").concat(record.status === "on_scene" ? "selected" : "", ">on_scene</option><option ").concat(record.status === "monitoring" ? "selected" : "", ">monitoring</option><option ").concat(record.status === "needs_relief" ? "selected" : "", ">needs_relief</option><option ").concat(record.status === "offline" ? "selected" : "", ">offline</option><option ").concat(record.status === "unavailable" ? "selected" : "", '>unavailable</option></select></label>\n        <label class="form-field compact"><span>ICS Role</span><select data-inline-field="role">').concat(roleOptions, '</select></label>\n        <label class="form-field compact"><span>Assigned Incident</span><select data-inline-field="assignedIncidentId">').concat(incidentOptions, '</select></label>\n        <label class="form-field compact"><span>Resource Type</span><select data-inline-field="resourceType">').concat(buildSelectOptions(RESOURCE_TYPE_OPTIONS, record.resourceType || "operator"), '</select></label>\n        <label class="form-field compact"><span>Tactical Callsign</span><input data-inline-field="tacticalCallsign" value="').concat(escapeHtml(record.tacticalCallsign || ""), '" /></label>\n        <label class="form-field compact"><span>Team</span><input data-inline-field="team" value="').concat(escapeHtml(record.team || ""), '" /></label>\n        <label class="form-field compact"><span>Reachability</span><select data-inline-field="reachability">').concat(buildSelectOptions(REACHABILITY_OPTIONS, record.reachability || "unknown"), '</select></label>\n        <label class="form-field compact"><span>Relief Due</span><input data-inline-field="reliefDue" type="datetime-local" value="').concat(escapeHtml(formatDateTimeLocalValue(record.reliefDue)), '" /></label>\n        <label class="form-field compact"><span>Location</span><input data-inline-field="location" value="').concat(escapeHtml(record.location || ""), '" /></label>\n        <label class="form-field compact"><span>Latitude</span><input data-inline-field="lat" type="number" step="0.000001" value="').concat(escapeHtml((_e = record.lat) != null ? _e : ""), '" /></label>\n        <label class="form-field compact"><span>Longitude</span><input data-inline-field="lng" type="number" step="0.000001" value="').concat(escapeHtml((_f = record.lng) != null ? _f : ""), '" /></label>\n      </div>\n      <div class="ops-focus-actions">\n        <button class="button ops-focus-action" data-action="checkin">Check In Now</button>\n        <button class="button button-secondary ops-focus-action" data-action="manual-checkin">Manual Check-In</button>\n        <button class="button button-secondary ops-focus-action" data-action="zoom">Zoom to Operator</button>\n        <button class="button button-secondary ops-focus-action" data-action="save-inline">Save Inline</button>\n        <button class="button button-secondary ops-focus-action" data-action="edit">Full Edit</button>\n        <button class="button button-ghost danger ops-focus-action" data-action="delete">Delete</button>\n      </div>');
  }
  return '\n    <div class="ops-item-top">\n      <div>\n        <div class="ops-item-title">'.concat(record.title, '</div>\n        <div class="ops-focus-meta">Task - ').concat(record.incidentTitle || resolveIncidentDisplay(record), " - ").concat(relativeTime(record.createdAt), '</div>\n      </div>\n      <div class="ops-badges">\n        <span class="ops-badge priority-').concat(String(record.priority || "medium").toLowerCase(), '">').concat(String(record.priority || "medium").toLowerCase(), '</span>\n        <span class="ops-badge status-').concat(String(record.status || "open").toLowerCase(), '">').concat(String(record.status || "open").toLowerCase(), '</span>\n      </div>\n    </div>\n    <div class="ops-focus-grid">\n      <div class="ops-focus-stat"><strong>Due</strong><span>').concat(record.due || "Not set", '</span></div>\n      <div class="ops-focus-stat"><strong>Assigned Operator</strong><span>').concat(record.assignedTo || "unassigned", '</span></div>\n      <div class="ops-focus-stat"><strong>Linked Incident</strong><span>').concat(record.incidentTitle || resolveIncidentDisplay(record), '</span></div>\n      <div class="ops-focus-stat"><strong>Location</strong><span>').concat(record.location || "Unknown", '</span></div>\n      <div class="ops-focus-stat"><strong>Coordinates</strong><span>').concat(typeof record.lat === "number" ? "".concat(record.lat.toFixed(4), ", ").concat(record.lng.toFixed(4)) : "Unavailable", '</span></div>\n      <div class="ops-focus-stat"><strong>Notes</strong><span>').concat(record.notes ? escapeHtml(record.notes) : "None yet", '</span></div>\n    </div>\n    <div class="ops-inline-controls">\n      <label class="form-field compact"><span>Status</span><select data-inline-field="status"><option ').concat(record.status === "open" ? "selected" : "", ">open</option><option ").concat(record.status === "assigned" ? "selected" : "", ">assigned</option><option ").concat(record.status === "blocked" ? "selected" : "", ">blocked</option><option ").concat(record.status === "closed" ? "selected" : "", ">closed</option><option ").concat(record.status === "archived" ? "selected" : "", '>archived</option></select></label>\n      <label class="form-field compact"><span>Priority</span><select data-inline-field="priority"><option ').concat(record.priority === "low" ? "selected" : "", ">low</option><option ").concat(record.priority === "medium" ? "selected" : "", ">medium</option><option ").concat(record.priority === "high" ? "selected" : "", ">high</option><option ").concat(record.priority === "critical" ? "selected" : "", '>critical</option></select></label>\n      <label class="form-field compact"><span>Assigned Operator</span><select data-inline-field="assignedTo">').concat(operatorOptions, '</select></label>\n      <label class="form-field compact"><span>Linked Incident</span><select data-inline-field="incidentId">').concat(incidentOptions, '</select></label>\n      <label class="form-field compact"><span>Location</span><input data-inline-field="location" value="').concat(escapeHtml(record.location || ""), '" /></label>\n      <label class="form-field compact"><span>Latitude</span><input data-inline-field="lat" type="number" step="0.000001" value="').concat(escapeHtml((_g = record.lat) != null ? _g : ""), '" /></label>\n      <label class="form-field compact"><span>Longitude</span><input data-inline-field="lng" type="number" step="0.000001" value="').concat(escapeHtml((_h = record.lng) != null ? _h : ""), '" /></label>\n    </div>\n    <div class="ops-focus-actions">\n      <button class="button button-secondary ops-focus-action" data-action="save-inline">Save Inline</button>\n      <button class="button button-secondary ops-focus-action" data-action="edit">Full Edit</button>\n      <button class="button button-ghost ops-focus-action" data-action="archive">Archive</button>\n      <button class="button button-ghost danger ops-focus-action" data-action="delete">Delete</button>\n      <button class="button button-secondary ops-focus-action" data-action="refresh">Refresh Console</button>\n    </div>');
}
function renderOpsRecommendations() {
  const container = document.getElementById("ops-recommendations");
  if (!container) return;
  const recs = [];
  const urgentIncident = currentIncidents.find((item) => ["critical", "high"].includes(String(item.priority || inferIncidentPriority(item.status)).toLowerCase()) || ["open", "active"].includes(String(item.status || "").toLowerCase()));
  if (urgentIncident) recs.push("Prioritize ".concat(urgentIncident.title, " and verify an assigned operator plus linked field unit coverage."));
  const incompleteComms = currentIncidents.find((item) => ["open", "active", "monitoring"].includes(String(item.status || "").toLowerCase()) && (!item.primaryFrequency || !item.netControl || !item.incidentCommander));
  if (incompleteComms) recs.push("Complete the command workspace for ".concat(incompleteComms.title, ": confirm IC, Net Control, and primary frequency before the next shift handoff."));
  const missingCommsPlan = currentIncidents.find((item) => ["open", "active", "monitoring"].includes(String(item.status || "").toLowerCase()) && !(item.commsPlanCount > 0));
  if (missingCommsPlan) recs.push("Add a comms plan entry for ".concat(missingCommsPlan.title, " so tactical and command channels are visible to operators."));
  const missingActivityLog = currentIncidents.find((item) => ["open", "active"].includes(String(item.status || "").toLowerCase()) && !(item.activityLogCount > 0));
  if (missingActivityLog) recs.push("Start the activity log for ".concat(missingActivityLog.title, " so handoffs and significant actions are captured."));
  const staleOp = currentOperators.find((item) => !item.lastCheckIn || (Date.now() - new Date(item.lastCheckIn).getTime()) / 6e4 >= 60);
  if (staleOp) recs.push("Request a check-in from ".concat(staleOp.callsign || staleOp.name || "an operator", " - last update is stale."));
  const reliefDue = currentOperators.find((item) => operatorNeedsRelief(item));
  if (reliefDue) recs.push("Plan relief or welfare contact for ".concat(reliefDue.callsign || reliefDue.name || "an operator", " - accountability indicates relief is due."));
  const unassignedTask = currentTasks.find((item) => !item.assignedTo || item.assignedTo === "unassigned");
  if (unassignedTask) recs.push("Assign or close ".concat(unassignedTask.title, " so it does not drift during activation."));
  if (!recs.length) recs.push("No immediate friction points detected. Continue monitoring feed and operator status.");
  container.innerHTML = recs.map((text) => '<div class="ops-recommendation-item">'.concat(escapeHtml(text), "</div>")).join("");
}
function setActiveOpsTab(tab) {
  activeOpsTab = tab;
  document.querySelectorAll(".ops-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.opsTab === tab);
  });
  document.querySelectorAll("[data-ops-panel]").forEach((panel) => {
    panel.classList.toggle("is-hidden", panel.dataset.opsPanel !== tab);
  });
  syncOpsGlobals();
}
function inferIncidentPriority(status) {
  const normalized = String(status || "").toLowerCase();
  if (["open", "active"].includes(normalized)) return "high";
  if (normalized === "monitoring") return "medium";
  return "low";
}
async function postWithAdminRetry(url, payload, method = "POST") {
  try {
    return await requestJSON(url, {
      method,
      headers: adminHeaders(),
      body: JSON.stringify(payload)
    });
  } catch (error) {
    if ((error == null ? void 0 : error.status) === 403) {
      clearAdminToken();
      await ensureAdminToken(true);
      return requestJSON(url, {
        method,
        headers: adminHeaders(),
        body: JSON.stringify(payload)
      });
    }
    throw error;
  }
}
async function apiDeleteWithAdminRetry(url) {
  try {
    return await requestJSON(url, { method: "DELETE", headers: adminHeaders() });
  } catch (error) {
    if ((error == null ? void 0 : error.status) === 403) {
      clearAdminToken();
      await ensureAdminToken(true);
      return requestJSON(url, { method: "DELETE", headers: adminHeaders() });
    }
    throw error;
  }
}
function updateQuickStats() {
  var _a, _b;
  const layerEl = document.getElementById("quick-stat-layers");
  const feedEl = document.getElementById("quick-stat-feeds");
  const assetsEl = document.getElementById("quick-stat-assets");
  const issuesEl = document.getElementById("quick-stat-issues");
  const mapHealth = document.getElementById("map-health");
  if (!layerEl || !feedEl || !assetsEl || !issuesEl || !mapHealth) return;
  const activeLayers = ((_b = (_a = window.AresLayers) == null ? void 0 : _a.getActiveLayerCount) == null ? void 0 : _b.call(_a)) || 0;
  const feedsLive = currentFeeds ? Object.values(currentFeeds).filter((feed) => feed && !feed.error).length : 0;
  const trackedAssets = (currentReference ? collectOperationalAssets(currentReference).length : 0) + currentIncidents.length + currentOperators.length;
  const issues = diagnosticsState.failures.length;
  layerEl.textContent = String(activeLayers);
  feedEl.textContent = String(feedsLive);
  assetsEl.textContent = String(trackedAssets);
  issuesEl.textContent = String(issues);
  mapHealth.textContent = issues ? "".concat(issues, " issue").concat(issues === 1 ? "" : "s", " need attention") : "Systems nominal";
  mapHealth.style.color = issues ? "var(--danger)" : "var(--success)";
  mapHealth.classList.toggle("is-degraded", Boolean(issues));
  mapHealth.classList.toggle("is-nominal", !issues);
}
function setActiveSection(section) {
  document.querySelectorAll(".section-chip").forEach((button) => {
    button.classList.toggle("active", button.dataset.section === section);
  });
  document.querySelectorAll("[data-section-panel]").forEach((panel) => {
    const match = section === "all" || panel.dataset.sectionPanel === section;
    panel.classList.toggle("is-hidden", !match);
  });
}
function initShellUi() {
  var _a, _b, _c;
  const openBtn = document.getElementById("sidebar-open");
  const closeBtn = document.getElementById("sidebar-close");
  const sidebar = document.getElementById("sidebar");
  const mobileQuery = window.matchMedia("(max-width: 1024px)");
  const visualViewport = window.visualViewport || null;
  const iosWebKit = isIosWebKitClient();
  let viewportSyncTimer = null;
  let lastViewportSignature = "";
  function syncViewportShell() {
    const viewportHeight = Math.max(
      320,
      Math.round((visualViewport == null ? void 0 : visualViewport.height) || window.innerHeight || document.documentElement.clientHeight || 0)
    );
    const viewportWidth = Math.max(
      320,
      Math.round((visualViewport == null ? void 0 : visualViewport.width) || window.innerWidth || document.documentElement.clientWidth || 0)
    );
    const nextSignature = "".concat(viewportWidth, "x").concat(viewportHeight);
    const bodyNeedsClassUpdate = document.body.classList.contains("ios-webkit") !== iosWebKit;
    if (!bodyNeedsClassUpdate && nextSignature === lastViewportSignature) return false;
    lastViewportSignature = nextSignature;
    document.documentElement.style.setProperty("--app-height", "".concat(viewportHeight, "px"));
    document.documentElement.style.setProperty("--app-width", "".concat(viewportWidth, "px"));
    document.body.classList.toggle("ios-webkit", iosWebKit);
    return true;
  }
  function scheduleViewportShellSync(delay = 0) {
    if (viewportSyncTimer) window.clearTimeout(viewportSyncTimer);
    viewportSyncTimer = window.setTimeout(() => {
      viewportSyncTimer = null;
      if (syncViewportShell()) scheduleMapRefresh(140);
    }, delay);
  }
  function applySidebarState(isOpen) {
    if (mobileQuery.matches) {
      document.body.classList.toggle("sidebar-open", Boolean(isOpen));
      document.body.classList.toggle("sidebar-collapsed", !isOpen);
    } else {
      document.body.classList.remove("sidebar-open");
      document.body.classList.remove("sidebar-collapsed");
    }
    scheduleMapRefresh(180);
  }
  function syncSidebarState() {
    applySidebarState(mobileQuery.matches ? false : false);
  }
  syncSidebarState();
  syncViewportShell();
  (_a = mobileQuery.addEventListener) == null ? void 0 : _a.call(mobileQuery, "change", syncSidebarState);
  (_b = mobileQuery.addListener) == null ? void 0 : _b.call(mobileQuery, syncSidebarState);
  window.addEventListener("resize", () => scheduleViewportShellSync(30), { passive: true });
  window.addEventListener("orientationchange", () => scheduleViewportShellSync(180), { passive: true });
  (_c = visualViewport == null ? void 0 : visualViewport.addEventListener) == null ? void 0 : _c.call(visualViewport, "resize", () => scheduleViewportShellSync(20), { passive: true });
  openBtn == null ? void 0 : openBtn.addEventListener("click", () => {
    applySidebarState(true);
    scheduleViewportShellSync(40);
  });
  closeBtn == null ? void 0 : closeBtn.addEventListener("click", () => {
    applySidebarState(false);
    scheduleViewportShellSync(40);
  });
  if (sidebar) {
    sidebar.addEventListener("click", (event) => event.stopPropagation());
    const disableMapSidebarInteractions = () => {
      var _a2, _b2, _c2, _d;
      if (!window.map) return;
      try {
        (_a2 = window.map.scrollWheelZoom) == null ? void 0 : _a2.disable();
        (_b2 = window.map.touchZoom) == null ? void 0 : _b2.disable();
        (_c2 = window.map.boxZoom) == null ? void 0 : _c2.disable();
        (_d = window.map.keyboard) == null ? void 0 : _d.disable();
      } catch (_) {
      }
    };
    const enableMapSidebarInteractions = () => {
      var _a2, _b2, _c2, _d;
      if (!window.map) return;
      try {
        (_a2 = window.map.scrollWheelZoom) == null ? void 0 : _a2.enable();
        (_b2 = window.map.touchZoom) == null ? void 0 : _b2.enable();
        (_c2 = window.map.boxZoom) == null ? void 0 : _c2.enable();
        (_d = window.map.keyboard) == null ? void 0 : _d.enable();
      } catch (_) {
      }
    };
    sidebar.addEventListener("mouseenter", disableMapSidebarInteractions);
    sidebar.addEventListener("mouseleave", enableMapSidebarInteractions);
    sidebar.addEventListener("wheel", (event) => event.stopPropagation(), { passive: true });
    sidebar.addEventListener("touchstart", disableMapSidebarInteractions, { passive: true });
    sidebar.addEventListener("touchmove", (event) => event.stopPropagation(), { passive: true });
    sidebar.addEventListener("touchend", enableMapSidebarInteractions, { passive: true });
  }
  document.addEventListener("click", (event) => {
    if (!mobileQuery.matches) return;
    if (safeClosest(event.target, "#sidebar") || safeClosest(event.target, "#sidebar-open") || safeClosest(event.target, "#command-bar") || safeClosest(event.target, ".command-drawer") || safeClosest(event.target, ".floating-action-bar")) return;
    applySidebarState(false);
  });
  setActiveSection("overview");
  scheduleMapRefresh(180);
  document.addEventListener("keydown", (event) => {
    if (!mobileQuery.matches || event.key !== "Escape") return;
    applySidebarState(false);
  });
}
async function init() {
  var _a;
  clientDiagnosticsState.bootState = "starting";
  clientDiagnosticsState.lastUpdatedAt = (/* @__PURE__ */ new Date()).toISOString();
  markBootState("starting", "Initializing command shell");
  renderDiagnostics();
  initAccordions();
  initInteractions();
  initShellUi();
  renderAuthPanel();
  bindOpsConsoleControls();
  bindOperatorStatusFilters();
  try {
    if (!window.L || !((_a = window.AresMap) == null ? void 0 : _a.ready)) throw new Error(window.AresMapBootstrapError || "Leaflet library failed to initialize");
    await initMap();
    clientDiagnosticsState.mapReady = true;
    clientDiagnosticsState.bootState = "map-ready";
    clientDiagnosticsState.lastUpdatedAt = (/* @__PURE__ */ new Date()).toISOString();
    markBootState("map-ready", "Map shell is ready");
    scheduleMapRefresh(150);
  } catch (error) {
    console.error(error);
    clientDiagnosticsState.mapReady = false;
    clientDiagnosticsState.bootState = "map-failed";
    clientDiagnosticsState.lastUpdatedAt = (/* @__PURE__ */ new Date()).toISOString();
    markBootState("map-failed", error.message || String(error));
    recordDiagnostic("failure", "map bootstrap", error.message || String(error));
    showLoadError("Map failed to load: ".concat(error.message || error));
  }
  const stagedMobileBoot = prefersStagedMobileBoot();
  const results = stagedMobileBoot ? [
    await runBootTask("dispatch console", renderOperationalWorkspace),
    await runBootTask("feeds", renderFeeds),
    await runDeferredBootTask("layers", renderLayers, 120),
    await runDeferredBootTask("reference panels", renderReferencePanels, 220)
  ] : await Promise.all([
    runBootTask("layers", renderLayers),
    runBootTask("feeds", renderFeeds),
    runBootTask("reference panels", renderReferencePanels),
    runBootTask("dispatch console", renderOperationalWorkspace)
  ]);
  clientDiagnosticsState.bootState = diagnosticsState.failures.length ? "degraded" : "ready";
  clientDiagnosticsState.lastUpdatedAt = (/* @__PURE__ */ new Date()).toISOString();
  const failedBootTask = results.find((item) => item && item.ok === false);
  markBootState(clientDiagnosticsState.bootState, (failedBootTask == null ? void 0 : failedBootTask.message) || (stagedMobileBoot ? "Staged mobile boot completed" : "Application boot completed"));
  renderDiagnostics();
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindOpsConsoleControls, { once: true });
} else {
  bindOpsConsoleControls();
  bindOperatorStatusFilters();
}
init().catch((error) => {
  console.error(error);
  clientDiagnosticsState.bootState = "failed";
  clientDiagnosticsState.lastUpdatedAt = (/* @__PURE__ */ new Date()).toISOString();
  markBootState("failed", error.message || String(error));
  recordDiagnostic("failure", "App bootstrap", error.message || String(error));
  showLoadError("App failed to load: ".concat(error.message || error));
});
window.addEventListener("error", (event) => {
  recordClientFault("Client runtime", (event == null ? void 0 : event.error) || (event == null ? void 0 : event.message) || "Unknown window error");
});
window.addEventListener("unhandledrejection", (event) => {
  recordClientFault("Unhandled promise", (event == null ? void 0 : event.reason) || "Unknown promise rejection");
});
