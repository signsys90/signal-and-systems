(function() {
  function badgeClass(value) {
    return value ? "feed-live" : "feed-empty";
  }
  function formatTime(value) {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleString();
    } catch (_) {
      return value;
    }
  }
  function sourceBadgeHtml(meta = {}) {
    var _a, _b;
    return ((_b = (_a = window.AresSourceUi) == null ? void 0 : _a.badgeHtml) == null ? void 0 : _b.call(_a, meta)) || '<span class="feed-badge '.concat(window.escapeHtml(meta.className || "feed-empty"), '">').concat(window.escapeHtml(meta.label || "Unknown"), "</span>");
  }
  function layerSourceMeta(item = {}) {
    var _a, _b;
    return ((_b = (_a = window.AresSourceUi) == null ? void 0 : _a.layerBadgeMeta) == null ? void 0 : _b.call(_a, item)) || { label: "Empty", className: "feed-empty", detail: "Awaiting source data" };
  }
  function feedSourceMeta(feed = {}) {
    var _a, _b;
    return ((_b = (_a = window.AresSourceUi) == null ? void 0 : _a.feedBadgeMeta) == null ? void 0 : _b.call(_a, feed)) || { label: "Empty", className: "feed-empty", detail: "Awaiting feed data" };
  }
  function summarizeLayerStates(items = []) {
    return items.reduce((acc, item) => {
      const label = String(layerSourceMeta(item).label || "empty").toLowerCase();
      if (label === "live") acc.live += 1;
      else if (label === "fallback") acc.fallback += 1;
      else if (label === "warming") acc.warming += 1;
      else if (label === "broken") acc.broken += 1;
      else if (label === "empty") acc.empty += 1;
      return acc;
    }, { live: 0, fallback: 0, warming: 0, broken: 0, empty: 0 });
  }
  function feedLabel(key) {
    const labels = {
      noaa: "NWS / NOAA",
      fema: "FEMA",
      statewide: "Statewide",
      fl511: "Transportation",
      skywarn: "SKYWARN"
    };
    return labels[key] || String(key || "").toUpperCase();
  }
  function providerLabel(key) {
    return key === "gpsShare" ? "GPS Share" : String(key || "").toUpperCase();
  }
  function envRows(environment = {}) {
    var _a, _b, _c, _d, _e, _f;
    return [
      ["Render Runtime", environment.isRender ? "Yes" : "No"],
      ["Node Env", environment.nodeEnv || "-"],
      ["Runtime", environment.runtimeVersion || "-"],
      ["Tracking Enabled", environment.trackingEnabled ? "Yes" : "No"],
      ["GPS Enabled", environment.gpsEnabled ? "Yes" : "No"],
      ["GPS Port", environment.gpsSerialPort || "-"],
      ["GPS Baud", environment.gpsSerialBaud || "-"],
      ["GPS Sharing", environment.gpsShareEnabled ? "Yes" : "No"],
      ["GPS Share TTL", environment.gpsShareTtlMs ? "".concat(Math.round(environment.gpsShareTtlMs / 1e3), " sec") : "-"],
      ["APRS Enabled", environment.aprsEnabled ? "Yes" : "No"],
      ["Meshtastic Enabled", environment.meshtasticEnabled ? "Yes" : "No"],
      ["DMR Enabled", environment.dmrEnabled ? "Yes" : "No"],
      ["MQTT Broker OK", environment.mqttBrokerHasProtocol ? "Yes" : "No"],
      ["Channel", (_a = environment.meshtasticChannelIndex) != null ? _a : "-"],
      ["APRS Callsigns", (_b = environment.aprsCallsignCount) != null ? _b : 0],
      ["Stale Threshold", environment.trackingStaleMs ? "".concat(Math.round(environment.trackingStaleMs / 6e4), " min") : "-"],
      ["Persistence Mode", environment.persistenceMode || "-"],
      ["App Data Root", environment.appDataRoot || "-"],
      ["Disk Mount", environment.renderDiskMountPath || "-"],
      ["Startup Checks", "".concat(((_d = (_c = environment.startupChecks) == null ? void 0 : _c.errors) == null ? void 0 : _d.length) || 0, " error(s) / ").concat(((_f = (_e = environment.startupChecks) == null ? void 0 : _e.warnings) == null ? void 0 : _f.length) || 0, " warning(s)")]
    ].map(([label, value]) => '<div class="system-row"><span>'.concat(window.escapeHtml(label), "</span><strong>").concat(window.escapeHtml(String(value)), "</strong></div>")).join("");
  }
  function startupNoticeRows(environment = {}) {
    var _a, _b;
    const errors = Array.isArray((_a = environment == null ? void 0 : environment.startupChecks) == null ? void 0 : _a.errors) ? environment.startupChecks.errors : [];
    const warnings = Array.isArray((_b = environment == null ? void 0 : environment.startupChecks) == null ? void 0 : _b.warnings) ? environment.startupChecks.warnings : [];
    const notices = [
      ...errors.map((message) => ({ level: "Broken", className: "feed-alert", message })),
      ...warnings.map((message) => ({ level: "Warning", className: "feed-warn", message }))
    ];
    if (!notices.length) {
      return '<div class="feed-note">Startup configuration looks sane for the current runtime.</div>';
    }
    return notices.map((item) => '\n      <div class="system-row">\n        <span>'.concat(sourceBadgeHtml({ label: item.level, className: item.className }), "</span>\n        <strong>").concat(window.escapeHtml(item.message), "</strong>\n      </div>")).join("");
  }
  function providerRows(tracking = {}) {
    const providers = tracking.providers || {};
    return Object.entries(providers).map(([key, provider]) => {
      var _a;
      return '\n      <div class="info-card compact-card">\n        <div class="info-card-head">\n          <div>\n            <h3>'.concat(window.escapeHtml(providerLabel(key)), '</h3>\n            <div class="card-subtle">').concat(provider.connected ? "Connected" : provider.configured ? "Configured" : "Not configured", '</div>\n          </div>\n          <span class="feed-badge ').concat(provider.connected || provider.count ? "feed-live" : provider.lastError ? "feed-alert" : "feed-empty", '">').concat(window.escapeHtml(String(provider.count || 0)), '</span>\n        </div>\n        <div class="system-row"><span>Last sync</span><strong>').concat(window.escapeHtml(formatTime(provider.lastRunAt)), '</strong></div>\n        <div class="system-row"><span>Last message</span><strong>').concat(window.escapeHtml(formatTime(provider.lastMessageAt)), '</strong></div>\n        <div class="feed-note">').concat(window.escapeHtml(provider.lastError || provider.note || ((_a = provider.configuration) == null ? void 0 : _a.summary) || "No current errors."), "</div>\n      </div>");
    }).join("");
  }
  function feedRows(feeds = {}) {
    const entries = Object.entries(feeds.feeds || {});
    return entries.map(([key, feed]) => {
      const meta = feedSourceMeta(feed);
      return '\n      <div class="system-row">\n        <span>'.concat(window.escapeHtml(feedLabel(key)), " (").concat(window.escapeHtml(String(feed.count || 0)), ")</span>\n        <strong>").concat(sourceBadgeHtml(meta), "</strong>\n      </div>");
    }).join("") || '<div class="empty-state">No feed diagnostics yet.</div>';
  }
  function persistenceCards(persistence = {}) {
    const files = Array.isArray(persistence.files) ? persistence.files : [];
    return files.map((file) => '\n      <div class="info-card compact-card">\n        <div class="info-card-head">\n          <div>\n            <h3>'.concat(window.escapeHtml(file.file), '</h3>\n            <div class="card-subtle">').concat(window.escapeHtml(file.path || ""), '</div>\n          </div>\n          <span class="feed-badge ').concat(file.exists ? "feed-live" : "feed-empty", '">').concat(file.exists ? "Saved" : "Missing", '</span>\n        </div>\n        <div class="system-row"><span>Bytes</span><strong>').concat(window.escapeHtml(String(file.bytes || 0)), '</strong></div>\n        <div class="system-row"><span>Modified</span><strong>').concat(window.escapeHtml(formatTime(file.modifiedAt)), "</strong></div>\n      </div>")).join("");
  }
  function render(data) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E, _F, _G, _H, _I, _J, _K, _L, _M, _N, _O, _P, _Q, _R, _S, _T, _U, _V, _W;
    const grid = document.getElementById("system-diagnostics-grid");
    const list = document.getElementById("system-persistence-list");
    const meta = document.getElementById("system-diagnostics-meta");
    if (!grid || !list) return;
    if (meta) meta.textContent = (data == null ? void 0 : data.generatedAt) ? "Updated ".concat(formatTime(data.generatedAt)) : "Awaiting refresh";
    grid.innerHTML = '\n      <div class="info-card compact-card">\n        <div class="info-card-head"><div><h3>Environment</h3><div class="card-subtle">Current runtime sanity checks</div></div><span class="feed-badge '.concat(badgeClass((_a = data == null ? void 0 : data.environment) == null ? void 0 : _a.mqttBrokerHasProtocol), '">').concat(((_b = data == null ? void 0 : data.environment) == null ? void 0 : _b.mqttBrokerHasProtocol) ? "OK" : "Check MQTT", "</span></div>\n        ").concat(envRows(data.environment || {}), "\n        ").concat(startupNoticeRows(data.environment || {}), '\n      </div>\n      <div class="info-card compact-card">\n        <div class="info-card-head"><div><h3>Tracking</h3><div class="card-subtle">').concat(window.escapeHtml(String(((_c = data == null ? void 0 : data.tracking) == null ? void 0 : _c.totalOperators) || 0)), ' fused operator(s)</div></div><span class="feed-badge ').concat(badgeClass((_d = data == null ? void 0 : data.tracking) == null ? void 0 : _d.enabled), '">').concat(((_e = data == null ? void 0 : data.tracking) == null ? void 0 : _e.enabled) ? "Enabled" : "Disabled", "</span></div>\n        ").concat(providerRows(data.tracking || {}), '\n      </div>\n      <div class="info-card compact-card">\n        <div class="info-card-head"><div><h3>Laptop GPS</h3><div class="card-subtle">').concat(window.escapeHtml(String(((_f = data == null ? void 0 : data.gps) == null ? void 0 : _f.port) || ((_g = data == null ? void 0 : data.environment) == null ? void 0 : _g.gpsSerialPort) || "COM5")), " @ ").concat(window.escapeHtml(String(((_h = data == null ? void 0 : data.gps) == null ? void 0 : _h.baudRate) || ((_i = data == null ? void 0 : data.environment) == null ? void 0 : _i.gpsSerialBaud) || 9600)), '</div></div><span class="feed-badge ').concat(((_k = (_j = data == null ? void 0 : data.gps) == null ? void 0 : _j.position) == null ? void 0 : _k.fixValid) && !((_l = data == null ? void 0 : data.gps) == null ? void 0 : _l.fixStale) ? "feed-live" : ((_m = data == null ? void 0 : data.gps) == null ? void 0 : _m.lastError) ? "feed-alert" : "feed-empty", '">').concat(((_o = (_n = data == null ? void 0 : data.gps) == null ? void 0 : _n.position) == null ? void 0 : _o.fixValid) && !((_p = data == null ? void 0 : data.gps) == null ? void 0 : _p.fixStale) ? "Fix" : ((_q = data == null ? void 0 : data.gps) == null ? void 0 : _q.connected) ? "No fix" : ((_r = data == null ? void 0 : data.gps) == null ? void 0 : _r.enabled) ? "Waiting" : "Off", '</span></div>\n        <div class="system-row"><span>Connected</span><strong>').concat(((_s = data == null ? void 0 : data.gps) == null ? void 0 : _s.connected) ? "Yes" : "No", '</strong></div>\n        <div class="system-row"><span>Last sentence</span><strong>').concat(window.escapeHtml(formatTime((_t = data == null ? void 0 : data.gps) == null ? void 0 : _t.lastSentenceAt)), '</strong></div>\n        <div class="system-row"><span>Last fix</span><strong>').concat(window.escapeHtml(formatTime((_u = data == null ? void 0 : data.gps) == null ? void 0 : _u.lastFixAt)), '</strong></div>\n        <div class="system-row"><span>Satellites</span><strong>').concat(window.escapeHtml(String((_x = (_w = (_v = data == null ? void 0 : data.gps) == null ? void 0 : _v.position) == null ? void 0 : _w.satellites) != null ? _x : "-")), '</strong></div>\n        <div class="system-row"><span>HDOP</span><strong>').concat(window.escapeHtml(String((_A = (_z = (_y = data == null ? void 0 : data.gps) == null ? void 0 : _y.position) == null ? void 0 : _z.hdop) != null ? _A : "-")), '</strong></div>\n        <div class="feed-note">').concat(window.escapeHtml(((_B = data == null ? void 0 : data.gps) == null ? void 0 : _B.lastError) || ((_D = (_C = data == null ? void 0 : data.gps) == null ? void 0 : _C.position) == null ? void 0 : _D.statusLabel) || "Awaiting serial GPS data."), '</div>\n      </div>\n      <div class="info-card compact-card">\n        <div class="info-card-head"><div><h3>Feeds</h3><div class="card-subtle">Live ').concat(window.escapeHtml(String(((_E = data == null ? void 0 : data.feeds) == null ? void 0 : _E.live) || 0)), " - Degraded ").concat(window.escapeHtml(String(((_F = data == null ? void 0 : data.feeds) == null ? void 0 : _F.degraded) || 0)), '</div></div><span class="feed-badge ').concat(((_G = data == null ? void 0 : data.feeds) == null ? void 0 : _G.offline) ? "feed-alert" : "feed-live", '">').concat(((_H = data == null ? void 0 : data.feeds) == null ? void 0 : _H.offline) ? "".concat(data.feeds.offline, " offline") : "Nominal", "</span></div>\n        ").concat(feedRows(data.feeds || {}), '\n      </div>\n      <div class="info-card compact-card">\n        <div class="info-card-head"><div><h3>Persistence</h3><div class="card-subtle">JSON file store summary</div></div><span class="feed-badge ').concat(((_I = data == null ? void 0 : data.persistence) == null ? void 0 : _I.likelyEphemeral) ? "feed-warn" : "feed-live", '">').concat(((_J = data == null ? void 0 : data.persistence) == null ? void 0 : _J.likelyEphemeral) ? "Ephemeral" : window.escapeHtml(String(((_K = data == null ? void 0 : data.persistence) == null ? void 0 : _K.storage) || "json")), '</span></div>\n        <div class="system-row"><span>Mode</span><strong>').concat(window.escapeHtml(String(((_L = data == null ? void 0 : data.persistence) == null ? void 0 : _L.mode) || "-")), '</strong></div>\n        <div class="system-row"><span>Data Root</span><strong>').concat(window.escapeHtml(String(((_M = data == null ? void 0 : data.persistence) == null ? void 0 : _M.dataRoot) || "-")), '</strong></div>\n        <div class="system-row"><span>Disk Mount</span><strong>').concat(window.escapeHtml(String(((_N = data == null ? void 0 : data.persistence) == null ? void 0 : _N.renderDiskMountPath) || "-")), '</strong></div>\n        <div class="system-row"><span>Operators</span><strong>').concat(window.escapeHtml(String(((_P = (_O = data == null ? void 0 : data.persistence) == null ? void 0 : _O.counts) == null ? void 0 : _P.operators) || 0)), '</strong></div>\n        <div class="system-row"><span>Check-ins</span><strong>').concat(window.escapeHtml(String(((_R = (_Q = data == null ? void 0 : data.persistence) == null ? void 0 : _Q.counts) == null ? void 0 : _R.operatorCheckins) || 0)), '</strong></div>\n        <div class="system-row"><span>Incidents</span><strong>').concat(window.escapeHtml(String(((_T = (_S = data == null ? void 0 : data.persistence) == null ? void 0 : _S.counts) == null ? void 0 : _T.incidents) || 0)), '</strong></div>\n        <div class="system-row"><span>Tasks</span><strong>').concat(window.escapeHtml(String(((_V = (_U = data == null ? void 0 : data.persistence) == null ? void 0 : _U.counts) == null ? void 0 : _V.tasks) || 0)), "</strong></div>\n        ").concat(((_W = data == null ? void 0 : data.persistence) == null ? void 0 : _W.likelyEphemeral) ? '<div class="feed-note">This runtime is writing mutable state to the deploy filesystem. On Render, mount a disk and point APP_DATA_ROOT to it if you need persistence across redeploys.</div>' : "", "\n      </div>");
    list.innerHTML = persistenceCards(data.persistence || {});
    renderCommandDiagnostics(data);
  }
  function renderCommandDiagnostics(data) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E, _F, _G, _H, _I, _J, _K, _L, _M, _N, _O, _P, _Q, _R, _S, _T, _U, _V, _W, _X, _Y;
    const grid = document.getElementById("command-diagnostics-grid");
    const raw = document.getElementById("command-diagnostics-raw");
    const aprs = document.getElementById("diag-aprs-enabled");
    const providers = document.getElementById("diag-provider-summary");
    const reqTotal = document.getElementById("diag-request-total");
    const aprsProvider = ((_b = (_a = data == null ? void 0 : data.tracking) == null ? void 0 : _a.providers) == null ? void 0 : _b.aprs) || {};
    if (aprs) aprs.textContent = aprsProvider.connected || aprsProvider.count || ((_c = data == null ? void 0 : data.environment) == null ? void 0 : _c.aprsEnabled) ? "On" : "Off";
    const providerObj = ((_d = data == null ? void 0 : data.tracking) == null ? void 0 : _d.providers) || {};
    const connected = Object.values(providerObj).filter((p) => p.connected || p.count).length;
    if (providers) providers.textContent = "".concat(connected, "/").concat(Object.keys(providerObj).length || 0);
    if (reqTotal) reqTotal.textContent = String(((_e = data == null ? void 0 : data.requests) == null ? void 0 : _e.total) || 0);
    if (grid) {
      const cards = [];
      const clientRuntime = ((_g = (_f = window.AresClientDiagnostics) == null ? void 0 : _f.getSnapshot) == null ? void 0 : _g.call(_f)) || null;
      const dashboardLayerItems = Array.isArray((_i = (_h = data == null ? void 0 : data.sourceDashboard) == null ? void 0 : _h.layers) == null ? void 0 : _i.items) ? data.sourceDashboard.layers.items : [];
      const dashboardLayerCounts = summarizeLayerStates(dashboardLayerItems);
      cards.push('\n        <div class="command-diagnostics-card">\n          <h4>Tracking Status</h4>\n          <div class="command-diagnostics-row"><span>Status</span><strong>'.concat(window.escapeHtml((((_k = (_j = data == null ? void 0 : data.tracking) == null ? void 0 : _j.polling) == null ? void 0 : _k.status) || "standby").replace(/^idle$/, "standby").replace(/^polling$/, "syncing")), '</strong></div>\n          <div class="command-diagnostics-row"><span>Last started</span><strong>').concat(window.escapeHtml(formatTime((_m = (_l = data == null ? void 0 : data.tracking) == null ? void 0 : _l.polling) == null ? void 0 : _m.lastStartedAt)), '</strong></div>\n          <div class="command-diagnostics-row"><span>Last completed</span><strong>').concat(window.escapeHtml(formatTime((_o = (_n = data == null ? void 0 : data.tracking) == null ? void 0 : _n.polling) == null ? void 0 : _o.lastCompletedAt)), '</strong></div>\n          <div class="command-diagnostics-row"><span>Duration</span><strong>').concat(window.escapeHtml(String(((_q = (_p = data == null ? void 0 : data.tracking) == null ? void 0 : _p.polling) == null ? void 0 : _q.lastDurationMs) || 0)), " ms</strong></div>\n        </div>"));
      cards.push('\n        <div class="command-diagnostics-card">\n          <h4>Laptop GPS</h4>\n          <div class="command-diagnostics-row"><span>Port</span><strong>'.concat(window.escapeHtml(String(((_r = data == null ? void 0 : data.gps) == null ? void 0 : _r.port) || ((_s = data == null ? void 0 : data.environment) == null ? void 0 : _s.gpsSerialPort) || "COM5")), '</strong></div>\n          <div class="command-diagnostics-row"><span>Baud</span><strong>').concat(window.escapeHtml(String(((_t = data == null ? void 0 : data.gps) == null ? void 0 : _t.baudRate) || ((_u = data == null ? void 0 : data.environment) == null ? void 0 : _u.gpsSerialBaud) || 9600)), '</strong></div>\n          <div class="command-diagnostics-row"><span>Connected</span><strong>').concat(((_v = data == null ? void 0 : data.gps) == null ? void 0 : _v.connected) ? "Yes" : "No", '</strong></div>\n          <div class="command-diagnostics-row"><span>Fix</span><strong>').concat(((_x = (_w = data == null ? void 0 : data.gps) == null ? void 0 : _w.position) == null ? void 0 : _x.fixValid) && !((_y = data == null ? void 0 : data.gps) == null ? void 0 : _y.fixStale) ? "Valid" : "Waiting", '</strong></div>\n          <div class="command-diagnostics-row"><span>Sentences</span><strong>').concat(window.escapeHtml(String(((_z = data == null ? void 0 : data.gps) == null ? void 0 : _z.sentenceCount) || 0)), '</strong></div>\n          <div class="command-diagnostics-row"><span>Last fix</span><strong>').concat(window.escapeHtml(formatTime((_A = data == null ? void 0 : data.gps) == null ? void 0 : _A.lastFixAt)), '</strong></div>\n          <div class="command-diagnostics-note">').concat(window.escapeHtml(((_B = data == null ? void 0 : data.gps) == null ? void 0 : _B.lastError) || ((_D = (_C = data == null ? void 0 : data.gps) == null ? void 0 : _C.position) == null ? void 0 : _D.statusLabel) || "Awaiting serial GPS data."), "</div>\n        </div>"));
      Object.entries(providerObj).forEach(([key, provider]) => {
        cards.push('\n          <div class="command-diagnostics-card">\n            <h4>'.concat(window.escapeHtml(key.toUpperCase()), '</h4>\n            <div class="command-diagnostics-row"><span>Connected</span><strong>').concat(provider.connected ? "Yes" : "No", '</strong></div>\n            <div class="command-diagnostics-row"><span>Configured</span><strong>').concat(provider.configured ? "Yes" : "No", '</strong></div>\n            <div class="command-diagnostics-row"><span>Records</span><strong>').concat(window.escapeHtml(String(provider.count || 0)), '</strong></div>\n            <div class="command-diagnostics-row"><span>Last sync</span><strong>').concat(window.escapeHtml(formatTime(provider.lastRunAt)), '</strong></div>\n            <div class="command-diagnostics-row"><span>Note</span><strong>').concat(window.escapeHtml(provider.lastError || provider.note || "Nominal"), "</strong></div>\n          </div>"));
      });
      cards.push('\n        <div class="command-diagnostics-card">\n          <div class="command-diagnostics-card-head">\n            <h4>ERAT Source Integrity</h4>\n            <div class="command-diagnostics-badge-list">\n              '.concat(sourceBadgeHtml({ label: "Live", className: "feed-ok" }), "\n              ").concat(sourceBadgeHtml({ label: "Fallback", className: "feed-warn" }), "\n              ").concat(sourceBadgeHtml({ label: "Broken", className: "feed-alert" }), '\n            </div>\n          </div>\n          <div class="command-diagnostics-row"><span>Live layers</span><strong>').concat(window.escapeHtml(String(((_F = (_E = data == null ? void 0 : data.sourceIntegrity) == null ? void 0 : _E.erat) == null ? void 0 : _F.live) || 0)), '</strong></div>\n          <div class="command-diagnostics-row"><span>Fallback layers</span><strong>').concat(window.escapeHtml(String(((_H = (_G = data == null ? void 0 : data.sourceIntegrity) == null ? void 0 : _G.erat) == null ? void 0 : _H.fallback) || 0)), '</strong></div>\n          <div class="command-diagnostics-row"><span>Offline/unknown</span><strong>').concat(window.escapeHtml(String(((_J = (_I = data == null ? void 0 : data.sourceIntegrity) == null ? void 0 : _I.erat) == null ? void 0 : _J.offline) || 0)), "</strong></div>\n        </div>"));
      (((_L = (_K = data == null ? void 0 : data.sourceIntegrity) == null ? void 0 : _K.erat) == null ? void 0 : _L.layers) || []).forEach((item) => {
        const meta = layerSourceMeta(item);
        cards.push('\n          <div class="command-diagnostics-card">\n            <div class="command-diagnostics-card-head">\n              <div>\n                <h4>'.concat(window.escapeHtml(item.title || "ERAT Layer"), '</h4>\n                <div class="command-diagnostics-note">').concat(window.escapeHtml(meta.detail || item.source || "Awaiting source data"), '</div>\n              </div>\n              <div class="command-diagnostics-badge-list">').concat(sourceBadgeHtml(meta), '</div>\n            </div>\n            <div class="command-diagnostics-row"><span>Source</span><strong>').concat(window.escapeHtml(item.source || "Unknown"), '</strong></div>\n            <div class="command-diagnostics-row"><span>Records</span><strong>').concat(window.escapeHtml(String(item.count || 0)), '</strong></div>\n            <div class="command-diagnostics-row"><span>Updated</span><strong>').concat(window.escapeHtml(formatTime(item.updatedAt)), "</strong></div>\n          </div>"));
      });
      cards.push('\n        <div class="command-diagnostics-card">\n          <h4>Requests</h4>\n          <div class="command-diagnostics-row"><span>Total</span><strong>'.concat(window.escapeHtml(String(((_M = data == null ? void 0 : data.requests) == null ? void 0 : _M.total) || 0)), '</strong></div>\n          <div class="command-diagnostics-row"><span>Last request</span><strong>').concat(window.escapeHtml((((_O = (_N = data == null ? void 0 : data.requests) == null ? void 0 : _N.lastRequest) == null ? void 0 : _O.method) || "") + " " + (((_Q = (_P = data == null ? void 0 : data.requests) == null ? void 0 : _P.lastRequest) == null ? void 0 : _Q.url) || "-")), '</strong></div>\n          <div class="command-diagnostics-row"><span>Started</span><strong>').concat(window.escapeHtml(formatTime((_R = data == null ? void 0 : data.requests) == null ? void 0 : _R.startedAt)), "</strong></div>\n        </div>"));
      if (clientRuntime) {
        const latestFault = Array.isArray(clientRuntime.faults) && clientRuntime.faults.length ? clientRuntime.faults[0] : null;
        cards.push('\n          <div class="command-diagnostics-card">\n            <h4>Client Runtime</h4>\n            <div class="command-diagnostics-row"><span>Boot state</span><strong>'.concat(window.escapeHtml(String(clientRuntime.bootState || "unknown")), '</strong></div>\n            <div class="command-diagnostics-row"><span>Map ready</span><strong>').concat(clientRuntime.mapReady ? "Yes" : "No", '</strong></div>\n            <div class="command-diagnostics-row"><span>Client faults</span><strong>').concat(window.escapeHtml(String(((_S = clientRuntime.faults) == null ? void 0 : _S.length) || 0)), '</strong></div>\n            <div class="command-diagnostics-row"><span>Last update</span><strong>').concat(window.escapeHtml(formatTime(clientRuntime.lastUpdatedAt)), '</strong></div>\n            <div class="command-diagnostics-note">').concat(window.escapeHtml(latestFault ? "".concat(latestFault.label, ": ").concat(latestFault.detail) : "No client-side runtime faults captured."), "</div>\n          </div>"));
      }
      cards.push('\n        <div class="command-diagnostics-card">\n          <h4>External Feeds</h4>\n          '.concat(["noaa", "fema", "statewide", "fl511"].map((key) => {
        var _a2, _b2;
        const feed = ((_b2 = (_a2 = data == null ? void 0 : data.feeds) == null ? void 0 : _a2.feeds) == null ? void 0 : _b2[key]) || {};
        const meta = feedSourceMeta(feed);
        return '<div class="command-diagnostics-row"><span>'.concat(window.escapeHtml(feedLabel(key)), "</span><strong>").concat(sourceBadgeHtml(meta), "</strong></div>");
      }).join(""), "\n        </div>"));
      if ((_V = (_U = (_T = data == null ? void 0 : data.sourceDashboard) == null ? void 0 : _T.layers) == null ? void 0 : _U.items) == null ? void 0 : _V.length) {
        cards.push('\n          <div class="command-diagnostics-card">\n            <h4>Live Data Layer Engine</h4>\n            <div class="command-diagnostics-row"><span>Policy</span><strong>'.concat(window.escapeHtml(((_X = (_W = data == null ? void 0 : data.sourceDashboard) == null ? void 0 : _W.policy) == null ? void 0 : _X.mode) || "live-preferred"), '</strong></div>\n            <div class="command-diagnostics-row"><span>Live</span><strong>').concat(window.escapeHtml(String(dashboardLayerCounts.live || 0)), '</strong></div>\n            <div class="command-diagnostics-row"><span>Fallback</span><strong>').concat(window.escapeHtml(String(dashboardLayerCounts.fallback || 0)), '</strong></div>\n            <div class="command-diagnostics-row"><span>Warming</span><strong>').concat(window.escapeHtml(String(dashboardLayerCounts.warming || 0)), '</strong></div>\n            <div class="command-diagnostics-row"><span>Empty / Broken</span><strong>').concat(window.escapeHtml(String((dashboardLayerCounts.empty || 0) + (dashboardLayerCounts.broken || 0))), "</strong></div>\n          </div>"));
      }
      if (Array.isArray((_Y = data == null ? void 0 : data.liveLayers) == null ? void 0 : _Y.sync)) {
        cards.push('\n          <div class="command-diagnostics-card">\n            <h4>Operational Layer Sync</h4>\n            '.concat(data.liveLayers.sync.slice(0, 6).map((item) => {
          const meta = layerSourceMeta(item);
          return '<div class="command-diagnostics-row"><span>'.concat(window.escapeHtml(item.title), "</span><strong>").concat(sourceBadgeHtml(meta), "</strong></div>");
        }).join(""), "\n          </div>"));
      }
      grid.innerHTML = cards.join("");
    }
    if (raw) raw.textContent = JSON.stringify(data, null, 2);
    const providerValues = Object.values(providerObj);
    const degraded = providerValues.some((p) => p.enabled && p.configured && !p.connected && !p.count);
    const mapHealth = document.getElementById("map-health");
    if (mapHealth && !document.getElementById("command-degraded-chip")) {
      const chip2 = document.createElement("span");
      chip2.id = "command-degraded-chip";
      chip2.className = "command-alert-chip";
      chip2.textContent = "Providers nominal";
      mapHealth.insertAdjacentElement("afterend", chip2);
    }
    const chip = document.getElementById("command-degraded-chip");
    if (chip) {
      chip.textContent = degraded ? "Degraded mode" : "Providers nominal";
      chip.classList.toggle("is-degraded", degraded);
      chip.classList.toggle("is-nominal", !degraded);
    }
    window.dispatchEvent(new CustomEvent("ares:system-diagnostics", { detail: data }));
  }
  async function refreshSystemDiagnostics() {
    const data = await fetchJSON("/api/system/diagnostics");
    render(data);
  }
  async function downloadSnapshot() {
    const response = await fetch("/api/system/snapshot");
    if (!response.ok) throw new Error("Snapshot download failed");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ares-duval-snapshot.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  window.AresSystem = { refresh: refreshSystemDiagnostics };
  window.addEventListener("load", () => {
    var _a, _b;
    (_a = document.getElementById("refresh-system-diagnostics")) == null ? void 0 : _a.addEventListener("click", () => {
      refreshSystemDiagnostics().catch((error) => console.warn("Diagnostics refresh failed", error));
    });
    (_b = document.getElementById("download-system-snapshot")) == null ? void 0 : _b.addEventListener("click", () => {
      downloadSnapshot().catch((error) => console.warn("Snapshot download failed", error));
    });
    refreshSystemDiagnostics().catch((error) => console.warn("Initial diagnostics refresh failed", error));
  });
})();
(function() {
  function normalizeMeshtasticLabels(root = document) {
    const nodes = root.querySelectorAll("*");
    nodes.forEach((el) => {
      if (!el || !el.textContent) return;
      if (el.textContent.includes("Liam Cottle")) {
        el.textContent = el.textContent.replace(/Liam Cottle/g, "AreYouMeshingWith.Us");
      }
      if (el.textContent.includes("meshtastic.liamcottle.net")) {
        el.textContent = el.textContent.replace(/meshtastic\.liamcottle\.net/g, "map.areyoumeshingwith.us");
      }
    });
  }
  document.addEventListener("DOMContentLoaded", () => normalizeMeshtasticLabels(document));
  setTimeout(() => normalizeMeshtasticLabels(document), 500);
})();
