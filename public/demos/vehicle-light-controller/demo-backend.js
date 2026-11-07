/*
 * Browser-only demo backend for the Vehicle Light Controller.
 * Mirrors the app's simulation mode (MockRelayDriver + LightController rules)
 * so the real dashboard UI runs with no server and no relay hardware.
 * Nothing leaves the browser; state resets on reload.
 */
(function () {
  const CONFIG = window.__VLC_DEMO_CONFIG__;
  const now = () => new Date().toISOString();
  const s = {
    simulation: true,
    connected: false,
    system: "STARTING",
    watchdog: CONFIG.safety.watchdog_enabled ? "IDLE" : "DISABLED",
    ui_mode: "console",
    last: null,
    active: new Set(),
    faults: [],
    logs: [],
    channels: {},
  };
  const order = CONFIG.channels.map((c) => c.id);
  CONFIG.channels.forEach((c) => {
    s.channels[c.id] = { id: c.id, channel: c.channel, label: c.label, mapping: "Relay CH" + c.channel,
      is_on: !!c.default_state, status: c.default_state ? "ON" : "OFF", controlled_by: "laptop",
      last_command_timestamp: null, fault: null };
  });
  const listeners = new Set();

  function fault(source, message, detail) {
    const e = { timestamp: now(), source, message, detail: detail || null };
    s.faults.push(e); s.faults = s.faults.slice(-25);
    s.logs.push(Object.assign({}, e));
  }
  function result(r) {
    const out = Object.assign({ timestamp: now(), channel: null, profile: null, requested_state: null,
      error: null, simulation_mode: s.simulation }, r);
    s.logs.push(out); s.logs = s.logs.slice(-200);
    return out;
  }
  function conn() {
    if (s.system === "FAULT" && !s.simulation && !s.connected) return "FAULT";
    if (s.simulation && s.connected) return "SIMULATION";
    if (s.connected) return "CONNECTED";
    return "DISCONNECTED";
  }
  function status() {
    return {
      app_name: CONFIG.app_name,
      system_state: s.system === "STARTING" ? "OK" : s.system,
      relay_connection: conn(), simulation_mode: s.simulation, watchdog_status: s.watchdog,
      ui_mode: s.ui_mode, last_command_timestamp: s.last,
      channels: order.map((id) => Object.assign({}, s.channels[id])),
      profiles: CONFIG.profiles.map((p) => ({ id: p.id, label: p.label, description: p.description || "",
        states: p.states || {}, ui_mode: p.ui_mode || null })),
      active_profiles: Array.from(s.active).sort(),
      faults: s.faults.slice(-8),
    };
  }
  function broadcast() {
    const msg = JSON.stringify({ type: "status", status: status() });
    listeners.forEach((ws) => ws._emit(msg));
  }
  // Driver: only the simulated board can connect in a browser. With simulation
  // off, the app would open the configured COM port; here that port never exists.
  function driverConnect() {
    if (!s.simulation) throw new Error("Could not open " + CONFIG.serial.com_port +
      " (browser demo: no USB relay board is attached)");
    s.connected = true;
  }
  function driverReady() { if (!s.connected) throw new Error("Mock relay driver is disconnected"); }
  function resolve(id) {
    if (s.channels[id]) return s.channels[id];
    const n = Number(id);
    const hit = Object.values(s.channels).find((c) => c.channel === n);
    if (hit) return hit;
    throw new Error("Invalid channel '" + id + "'");
  }
  function attemptAllOffAfterFault(reason) {
    try {
      driverReady();
      const t = now();
      Object.values(s.channels).forEach((c) => Object.assign(c, { is_on: false, status: "OFF",
        controlled_by: "safety lockout", last_command_timestamp: t, fault: null }));
      s.last = t;
      s.logs.push({ timestamp: t, source: "system", action: "all_off_after_fault", channel: null, profile: null,
        requested_state: false, result: "attempted after " + reason, simulation_mode: s.simulation });
    } catch (e) { fault("all_off_after_fault", e.message, reason); }
  }
  function allOffUnlocked(source, by) {
    const t = now();
    try {
      driverReady();
      Object.values(s.channels).forEach((c) => Object.assign(c, { is_on: false, status: "OFF",
        controlled_by: by, last_command_timestamp: t, fault: null }));
      s.active.clear(); s.last = t; s.system = "OK"; s.ui_mode = "console";
      return { timestamp: t, success: true, source, action: "all_off", requested_state: false, result: "all channels off" };
    } catch (e) {
      s.system = "FAULT"; fault("all_off", e.message);
      Object.values(s.channels).forEach((c) => { c.status = "FAULT"; c.fault = "ALL OFF could not be confirmed"; });
      return { timestamp: t, success: false, source, action: "all_off", requested_state: false, result: "fault", error: e.message };
    }
  }
  const api = {
    connect(source) {
      const t = now();
      try { driverConnect(); s.system = "OK";
        return result({ timestamp: t, success: true, source, action: "connect", result: "connected" });
      } catch (e) { s.system = "FAULT"; fault("connect", e.message);
        return result({ timestamp: t, success: false, source, action: "connect", result: "fault", error: e.message }); }
    },
    disconnect(source) {
      api.allOff("system");
      s.connected = false;
      return result({ success: true, source, action: "disconnect", result: "disconnected" });
    },
    setChannel(id, state, source, by) {
      const t = now();
      try {
        const c = resolve(id); driverReady();
        Object.assign(c, { is_on: state, status: state ? "ON" : "OFF", controlled_by: by || "laptop",
          last_command_timestamp: t, fault: null });
        s.last = t; s.system = "OK";
        return result({ timestamp: t, success: true, source, action: "set_channel", channel: c.id, requested_state: state, result: state ? "on" : "off" });
      } catch (e) {
        s.system = "FAULT"; fault("channel", e.message, id); attemptAllOffAfterFault("channel command failure");
        return result({ timestamp: t, success: false, source, action: "set_channel", channel: id, requested_state: state, result: "fault", error: e.message });
      }
    },
    toggle(id, source) { const c = resolve(id); return api.setChannel(c.id, !c.is_on, source); },
    pulse(id, ms, source) {
      const t = now();
      try { const c = resolve(id); driverReady();
        Object.assign(c, { is_on: false, status: "OFF", controlled_by: "laptop", last_command_timestamp: t, fault: null });
        s.last = t;
        return result({ timestamp: t, success: true, source, action: "pulse_channel", channel: c.id, requested_state: false, result: "pulsed " + ms + " ms" });
      } catch (e) { s.system = "FAULT"; fault("pulse_channel", e.message); attemptAllOffAfterFault("pulse failure");
        return result({ timestamp: t, success: false, source, action: "pulse_channel", channel: id, requested_state: false, result: "fault", error: e.message }); }
    },
    profile(pid, source) {
      const p = CONFIG.profiles.find((x) => x.id === pid);
      if (!p) { const m = "Invalid profile '" + pid + "'"; fault("profile", m);
        return result({ success: false, source, action: "activate_profile", profile: pid, result: "fault", error: m }); }
      if (p.id === "all_off") { const r = allOffUnlocked(source, "profile"); r.profile = p.id; s.active.clear(); return result(r); }
      const t = now(); let n = 0;
      try {
        Object.entries(p.states || {}).forEach(([cid, st]) => { const c = resolve(cid); driverReady();
          Object.assign(c, { is_on: st, status: st ? "ON" : "OFF", controlled_by: "profile", last_command_timestamp: t, fault: null }); n++; });
        if (p.ui_mode) s.ui_mode = p.ui_mode;
        s.active.add(p.id); s.last = t; s.system = "OK";
        return result({ timestamp: t, success: true, source, action: "activate_profile", profile: p.id, result: "applied " + n + " channel changes" });
      } catch (e) { s.system = "FAULT"; fault("profile", e.message, p.id); attemptAllOffAfterFault("profile activation failure");
        return result({ timestamp: t, success: false, source, action: "activate_profile", profile: p.id, result: "fault", error: e.message }); }
    },
    allOff(source) { return result(allOffUnlocked(source, source !== "ui" && source !== "api" ? "safety" : "laptop")); },
    simulation(enabled, source) {
      if (enabled === s.simulation) return { timestamp: now(), success: true, source, action: "simulation_mode", requested_state: enabled, result: "unchanged", simulation_mode: s.simulation };
      api.allOff("system");
      s.connected = false; s.simulation = enabled;
      const t = now();
      try { driverConnect();
        return result({ timestamp: t, success: true, source, action: "simulation_mode", requested_state: enabled, result: enabled ? "enabled" : "disabled" });
      } catch (e) { s.system = "FAULT"; fault("simulation_mode", e.message);
        return result({ timestamp: t, success: false, source, action: "simulation_mode", requested_state: enabled, result: "fault", error: e.message }); }
    },
  };

  // Startup safety, as in the app: connect, then ALL OFF.
  api.connect("system");
  if (CONFIG.safety.all_off_on_startup) api.allOff("system");
  s.system = s.faults.length ? "FAULT" : "OK";
  if (CONFIG.safety.watchdog_enabled) {
    setInterval(() => {
      if (s.connected) { s.watchdog = "OK"; if (s.system !== "FAULT") s.system = "OK"; }
      else { s.watchdog = "FAULT"; s.system = "FAULT"; fault("watchdog", "Relay driver health check failed"); attemptAllOffAfterFault("watchdog failure"); }
      broadcast();
    }, Math.max(1, CONFIG.safety.watchdog_timeout_seconds) * 1000);
  }

  const json = (body, code) => Promise.resolve(new Response(JSON.stringify(body), { status: code || 200, headers: { "Content-Type": "application/json" } }));
  const realFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const url = new URL(typeof input === "string" ? input : input.url, location.href);
    const path = url.pathname.replace(/^.*?(\/api\/)/, "/api/");
    if (!path.startsWith("/api/")) return realFetch(input, init);
    const method = ((init && init.method) || "GET").toUpperCase();
    let body = {};
    try { body = init && init.body ? JSON.parse(init.body) : {}; } catch (e) {}
    let out; let m;
    if (method === "GET" && path === "/api/status") return json(status());
    if (method === "GET" && path === "/api/config") return json(Object.assign({}, CONFIG, { simulation_mode: s.simulation }));
    if (method === "GET" && path === "/api/health") { const st = status();
      return json({ ok: st.system_state === "OK" && ["CONNECTED", "SIMULATION"].includes(st.relay_connection) && st.watchdog_status !== "FAULT",
        app_name: st.app_name, system_state: st.system_state, relay_connection: st.relay_connection, simulation_mode: st.simulation_mode,
        watchdog_status: st.watchdog_status, channel_count: st.channels.length, active_channel_count: st.channels.filter((c) => c.is_on).length,
        active_profiles: st.active_profiles, fault_count: st.faults.length, last_command_timestamp: st.last_command_timestamp }); }
    if (method === "GET" && path === "/api/logs/recent") {
      const limit = Number(url.searchParams.get("limit") || 50);
      return json({ entries: s.logs.slice().sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)).slice(0, limit) });
    }
    try {
      if (path === "/api/connect") out = api.connect("api");
      else if (path === "/api/disconnect") out = api.disconnect("api");
      else if (path === "/api/all-off") out = api.allOff("api");
      else if (path === "/api/simulation-mode") out = api.simulation(!!body.enabled, "api");
      else if ((m = path.match(/^\/api\/channel\/([^/]+)\/(on|off|toggle|pulse)$/))) {
        const id = decodeURIComponent(m[1]);
        out = m[2] === "on" ? api.setChannel(id, true, "api") : m[2] === "off" ? api.setChannel(id, false, "api")
          : m[2] === "toggle" ? api.toggle(id, "api") : api.pulse(id, body.duration_ms || 500, "api");
      } else if ((m = path.match(/^\/api\/profile\/([^/]+)\/activate$/))) out = api.profile(decodeURIComponent(m[1]), "api");
      else return json({ detail: "Not Found" }, 404);
    } catch (e) { return json({ detail: e.message }, 400); }
    broadcast();
    return json(out);
  };

  class DemoSocket extends EventTarget {
    constructor() { super(); this.readyState = 0; listeners.add(this);
      setTimeout(() => { this.readyState = 1; this.dispatchEvent(new Event("open"));
        this._emit(JSON.stringify({ type: "status", status: status() })); }, 50); }
    _emit(data) { if (this.readyState === 1) this.dispatchEvent(new MessageEvent("message", { data })); }
    send() {}
    close() { this.readyState = 3; listeners.delete(this); }
  }
  DemoSocket.OPEN = 1; DemoSocket.CLOSED = 3; DemoSocket.CONNECTING = 0;
  window.WebSocket = DemoSocket;
})();
