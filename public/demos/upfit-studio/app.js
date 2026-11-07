/* Upfit Studio front end. Talks only to the local Python back end through the pywebview bridge.
   No network calls, no telemetry, no external files. */
"use strict";

// ------------------------------------------------------------------ bridge
async function api(name, ...args) {
  if (window.pywebview && window.pywebview.api && window.pywebview.api[name]) {
    return await window.pywebview.api[name](...args);
  }
  if (window.__pyapi) return JSON.parse(await window.__pyapi(name, JSON.stringify(args)));
  throw new Error("The app back end isn't connected.");
}

// ------------------------------------------------------------------ helpers
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtA = (v) => (v === null || v === undefined ? "TBD" : `${+(+v).toFixed(3)} A`);
const money = (v) => (v === null || v === undefined ? "TBD" : "$" + (+v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const blank = (v) => v === null || v === undefined || v === "";
const show = (v, unit = "") => (blank(v) ? '<span class="muted">TBD</span>' : esc(v) + unit);
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const store = {
  get(k, d) { try { const v = localStorage.getItem("upfit." + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("upfit." + k, JSON.stringify(v)); } catch { /* storage off */ } },
};

const WIRE = {
  red: "#ef4444", black: "#1f2937", white: "#f1f5f9", green: "#22c55e", blue: "#3b82f6", yellow: "#facc15",
  orange: "#f97316", brown: "#a16207", purple: "#a855f7", violet: "#a855f7", gray: "#9ca3af", grey: "#9ca3af",
  pink: "#f472b6", tan: "#d6b38a",
};
function wireColors(name) {
  if (!name) return [null, null];
  const words = String(name).toLowerCase().split(/[\s/()-]+/).filter((w) => WIRE[w]);
  return [WIRE[words[0]] || null, words[1] ? WIRE[words[1]] : null];
}
function swatch(name) {
  const [a, b] = wireColors(name);
  if (!a) return '<span class="swatch" style="background:transparent;border-style:dashed"></span>';
  const bg = b ? `linear-gradient(135deg, ${a} 50%, ${b} 50%)` : a;
  return `<span class="swatch" style="background:${bg}"></span>`;
}

const ICON = {
  dash: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
  map: '<circle cx="5" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="12" r="2"/><path d="M7 6c6 0 6 6 10 6M7 18c6 0 6-6 10-6"/>',
  head: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 9h2M11 9h2M15 9h2M7 13h2M11 13h2M15 13h2"/>',
  outputs: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  circuits: '<path d="M4 12h4l2-5 4 10 2-5h4"/>',
  parts: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
  findings: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
  diagram: '<rect x="3" y="4" width="6" height="6" rx="1"/><rect x="15" y="14" width="6" height="6" rx="1"/><path d="M9 7h4a2 2 0 0 1 2 2v5"/>',
  bench: '<path d="M9 3v6l-5 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-5-9V3"/><path d="M8 3h8"/>',
  tracker: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="13" rx="1"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11v6M8 15h2M12 15h2"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  reports: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  about: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16v.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  zin: '<circle cx="11" cy="11" r="7"/><path d="M8 11h6M11 8v6M20 20l-3.5-3.5"/>',
  zout: '<circle cx="11" cy="11" r="7"/><path d="M8 11h6M20 20l-3.5-3.5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  sandbox: '<path d="M4 7l8-4 8 4-8 4z"/><path d="M4 12l8 4 8-4M4 17l8 4 8-4"/>',
  sync: '<path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5M4 20v-5h5"/>',
  mockup: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><circle cx="12" cy="12" r="4"/>',
  mount: '<path d="M4 20h16M7 20v-5l10-6v11"/><rect x="9" y="5" width="10" height="5" rx="1" transform="rotate(-20 14 7)"/>',
  lab: '<path d="M10 3v5L5 18a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-10V3"/><path d="M8 14h8"/>',
  chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
};
const ic = (name, size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICON[name] || ""}</svg>`;

// ------------------------------------------------------------------ state
const S = {
  st: null,
  view: store.get("view", "dashboard"),
  sel: { circuit: null, diagram: null },
  sim: { slide: null, pressed: new Set(), brake: false, brakePhase: "pop", siren: null, res: null },
  map: { showFree: false, filter: "", vb: null },
  parts: { status: "all", q: "" },
  findings: { sev: "all", q: "" },
  bench: null,
  dirty: false,
};

const VIEWS = [
  { group: "Overview", items: [["dashboard", "Command center", "dash"], ["sandbox", "Sandboxes", "sandbox"]] },
  { group: "Design", items: [["map", "Wiring map", "map"], ["head", "Control head", "head"], ["outputs", "Output board", "outputs"], ["circuits", "Circuits", "circuits"], ["parts", "Parts & BOM", "parts"], ["mockup", "Product mockup", "mockup"], ["diagrams", "Harness diagrams", "diagram"], ["mount", "Head mount designer", "mount"]] },
  { group: "Test", items: [["lab", "Test lab", "lab"], ["bench", "Bench test", "bench"], ["hardware", "Hardware lab", "chip"]] },
  { group: "Build", items: [["tracker", "Install tracker", "tracker"], ["calc", "Wire & fuse calculator", "calc"]] },
  { group: "Records", items: [["findings", "Findings", "findings"], ["history", "Change history", "history"], ["sync", "Sync", "sync"], ["reports", "Reports & exports", "reports"], ["about", "About & safety", "about"]] },
];
// Tools hidden from the sidebar unless "Show more tools" is on (William's audit, 31 Oct 2026):
// the Ben3DBuild mount is bought, and the Hardware lab holds placeholders until hardware is chosen.
// Nothing is removed: they still open from the switch, the palette or a link.
const MORE_TOOLS = new Set(["mount", "hardware"]);
const VIEW_NAMES = Object.fromEntries(VIEWS.flatMap((g) => g.items.map(([id, label, icon]) => [id, { label, icon }])));

// ------------------------------------------------------------------ boot
async function boot() {
  applyTheme(store.get("theme", "dark"));
  try {
    setStateQuiet(await api("state"));
  } catch (e) {
    $("#boot").innerHTML = `<div class="inner"><h3>Couldn't load your config</h3><p class="muted">${esc(e.message || e)}</p></div>`;
    return;
  }
  $("#boot").remove();
  if (!VIEW_NAMES[S.view]) S.view = "dashboard";
  renderChrome();
  go(S.view);
  runSim();
}
let booted = false;
function tryBoot() { if (!booted && (window.pywebview?.api?.state || window.__pyapi)) { booted = true; boot(); } }
window.addEventListener("pywebviewready", tryBoot);
document.addEventListener("DOMContentLoaded", () => { tryBoot(); setTimeout(tryBoot, 300); setTimeout(tryBoot, 1200); });

function applyTheme(t) { document.documentElement.dataset.theme = t; store.set("theme", t); }

function setStateQuiet(st) {
  // One naming rule everywhere: the full product name from the parts list, then the circuit's role.
  (st.circuits || []).forEach((c) => { if (c.role === undefined) { c.role = c.name; c.name = c.title || c.name; } });
  S.st = st;
}
function setState(st) { setStateQuiet(st); renderChrome(); }
function wrapName(t, max = 44, lines = 3) {
  const out = [];
  String(t || "").split(/\s+/).forEach((w) => { const l = out[out.length - 1]; if (l !== undefined && (l + " " + w).length <= max) out[out.length - 1] = l + " " + w; else out.push(w); });
  if (out.length > lines) { out.length = lines; out[lines - 1] = out[lines - 1].slice(0, max - 1) + "…"; }
  return out;
}

function renderChrome() {
  const st = S.st, v = st.vehicle || {};
  const ws = st.workspace || { mode: "live" };
  $("#vehicleChip").innerHTML = `<b>${esc(v.year)} ${esc(v.make)} ${esc(v.model)}</b> ${esc(v.trim)} ${esc(v.cab)}`
    + (ws.mode === "sandbox" ? ` <span class="pill amber" style="margin-left:6px">SANDBOX · ${esc(ws.name)}</span> <button class="btn sm ghost" data-action="exit-sandbox" style="padding:2px 8px">Back to live</button>` : ` <span class="pill good" style="margin-left:6px">LIVE</span>`);
  document.body.classList.toggle("sandbox", ws.mode === "sandbox");
  $("#sbPath").textContent = st.config_path;
  $("#sbLoaded").textContent = "Loaded " + st.loaded_at;
  $("#sbVersion").textContent = "upfit-kit " + st.version;
  const badges = {
    findings: [st.counts.ERROR + st.counts.WARN || st.counts.OPEN, st.counts.ERROR + st.counts.WARN > 0],
    outputs: [st.map.unwired.length || "", st.map.unwired.length > 0],
    history: [st.backups.length || "", false],
  };
  const more = store.get("moreTools", false);
  $("#nav").innerHTML = VIEWS.map((g) => `
    <div class="nav-group"><div class="nav-title">${g.group}</div>
    ${g.items.filter(([id]) => more || !MORE_TOOLS.has(id) || S.view === id).map(([id, label, icon]) => {
      const b = badges[id];
      return `<button class="nav-item ${S.view === id ? "active" : ""}" data-go="${id}">${ic(icon)}<span>${label}</span>${b && b[0] !== "" ? `<span class="nav-badge ${b[1] ? "hot" : ""}">${b[0]}</span>` : ""}</button>`;
    }).join("")}</div>`).join("")
    + `<button class="nav-item nav-more" data-action="more-tools" title="Head mount designer, Hardware lab">${ic(more ? "x" : "plus")}<span>${more ? "Hide extra tools" : `Show more tools (${MORE_TOOLS.size})`}</span></button>`;
}

async function go(view, opts = {}) {
  if (S.dirty && view !== S.view) {
    const ok = await confirmBox("Leave without saving?", "You have changes in this circuit that aren't saved to upfit.yaml.", "Leave", "Stay");
    if (!ok) return;
    S.dirty = false;
  }
  S.view = view;
  store.set("view", view);
  Object.assign(S.sel, opts);
  renderChrome();
  const main = $("#main");
  main.scrollTop = 0;
  main.innerHTML = "";
  const fn = RENDER[view] || RENDER.dashboard;
  fn(main);
}
function refresh() { go(S.view); }

// ------------------------------------------------------------------ global events
document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-go]");
  if (g) { go(g.dataset.go, g.dataset.cid ? { circuit: g.dataset.cid } : {}); return; }
  const a = e.target.closest("[data-action]");
  if (!a) return;
  const act = a.dataset.action;
  if (act === "palette") openPalette();
  if (act === "reload") reload();
  if (act === "theme") applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  if (act === "circuit") go("circuits", { circuit: a.dataset.id });
  if (act === "part") openPartDrawer(a.dataset.id);
  if (act === "output") openOutputDrawer(a.dataset.id);
  if (act === "exit-sandbox") switchScenario(null);
  if (act === "more-tools") { store.set("moreTools", !store.get("moreTools", false)); renderChrome(); }
});
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); }
  if (e.key === "F5") { e.preventDefault(); reload(); }
  if (e.key === "Escape") closeLayer();
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    const btn = $("#saveCircuit") || $("#drawerSave");
    if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
  }
  const typing = /input|textarea|select/i.test(document.activeElement?.tagName || "");
  if (!typing && (S.view === "head" || S.view === "map") && !$("#layer").innerHTML) {
    if (["0", "1", "2", "3"].includes(e.key)) setSlide(e.key === "0" ? null : e.key);
    if (!e.ctrlKey && !e.metaKey && !e.altKey) hotkeyDown(e);
  }
});
// 0.5.6: B (or Shift+B) is a real hold-to-press brake pedal; each head key with a hotkey in
// upfit.yaml (controls.head.keys[].hotkey) works the same way, so you can scroll while holding.
const HELD = new Map(); // key letter -> what it pressed
function hotkeyOf(e) { return (e.code && e.code.startsWith("Key") ? e.code.slice(3) : (e.key || "")).toUpperCase(); }
function hotkeyDown(e) {
  const k = hotkeyOf(e);
  if (e.repeat) { if (HELD.has(k)) e.preventDefault(); return; }
  if (k === "B") { e.preventDefault(); HELD.set(k, { brake: true }); setBrake(true); return; }
  const key = (((S.st.controls || {}).head || {}).keys || []).find((x) => (x.hotkey || "").toUpperCase() === k && x.button);
  if (!key) return;
  const b = ((S.st.controls || {}).buttons || []).find((x) => x.name === key.button);
  if (!b) return;
  e.preventDefault();
  if (b.action === "momentary") { HELD.set(k, { button: b.name }); toggleButton(b.name, true); }
  else if (b.action === "press") pressButton(b, key);
  else toggleButton(b.name);
}
function releaseHeld(k) {
  const h = HELD.get(k); if (!h) return;
  HELD.delete(k);
  if (h.brake) { if (!HEAD.latch) setBrake(false); }
  else if (h.button && !HEAD.latch && S.sim.pressed.has(h.button)) toggleButton(h.button, false);
}
document.addEventListener("keyup", (e) => releaseHeld(hotkeyOf(e)));
window.addEventListener("blur", () => [...HELD.keys()].forEach(releaseHeld));

async function reload() {
  const r = await api("reload");
  if (!r.ok) return toast(r.error, "bad");
  setState(r.state); refresh(); runSim(); toast("Reloaded upfit.yaml", "info");
}

// ------------------------------------------------------------------ layer: toast, modal, drawer
function toast(msg, tone = "good", ms = 3800) {
  const el = document.createElement("div");
  el.className = `toast ${tone}`;
  el.innerHTML = `${ic(tone === "bad" ? "alert" : tone === "info" ? "info" : "check")}<div>${esc(msg)}</div>`;
  $("#toasts").appendChild(el);
  setTimeout(() => el.remove(), ms);
}
function closeLayer() { $("#layer").innerHTML = ""; }
function confirmBox(title, body, yes = "OK", no = "Cancel", danger = false) {
  return new Promise((resolve) => {
    $("#layer").innerHTML = `<div class="scrim" data-x></div><div class="modal" role="dialog"><h3>${esc(title)}</h3><div class="dim">${body}</div>
      <div class="row"><button class="btn ghost" data-no>${esc(no)}</button><button class="btn ${danger ? "danger" : "primary"}" data-yes>${esc(yes)}</button></div></div>`;
    const done = (v) => { closeLayer(); resolve(v); };
    $("[data-yes]", $("#layer")).onclick = () => done(true);
    $("[data-no]", $("#layer")).onclick = () => done(false);
    $("[data-x]", $("#layer")).onclick = () => done(false);
    $("[data-yes]", $("#layer")).focus();
  });
}
function drawer(title, sub, body, foot = "") {
  $("#layer").innerHTML = `<div class="scrim" data-close></div><aside class="drawer" role="dialog">
    <div class="drawer-head"><div style="flex:1;min-width:0"><div class="eyebrow">${sub}</div><h3>${title}</h3></div><button class="icon-btn" data-close title="Close (Esc)">${ic("x")}</button></div>
    <div class="drawer-body">${body}</div>${foot ? `<div class="drawer-foot">${foot}</div>` : ""}</aside>`;
  $$("[data-close]", $("#layer")).forEach((b) => (b.onclick = closeLayer));
  return $(".drawer", $("#layer"));
}
function fieldErrors(root, r) {
  $$(".input", root).forEach((i) => i.classList.remove("err"));
  $$(".ferr", root).forEach((f) => (f.textContent = ""));
  if (r && !r.ok && r.field) {
    const inp = $(`[name="${r.field}"]`, root);
    if (inp) { inp.classList.add("err"); const fe = $(`.ferr[data-for="${r.field}"]`, root); if (fe) fe.textContent = r.error; inp.focus(); }
  }
}

// ------------------------------------------------------------------ simulator core
function keyLabelFor(button) {
  const k = (((S.st.controls || {}).head || {}).keys || []).find((x) => x.button === button);
  return k ? `${k.label || k.cap || button} · SW${k.sw}` : button;
}
async function runSim() {
  const r = await api("simulate", S.sim.slide, [...S.sim.pressed], S.sim.brake, S.sim.brakePhase || "pop");
  if (!r.ok) { toast(r.error, "bad"); return; }
  S.sim.res = r;
  applySim();
}
function setSlide(v) { S.sim.slide = v; runSim(); }
let brakeTimer = null;
function setBrake(v) {
  // Brake pop: flash for pop_seconds, then the then_steady outputs stay on while the pedal is held
  clearTimeout(brakeTimer);
  S.sim.brake = v; S.sim.brakePhase = "pop";
  if (v) {
    const secs = +((S.st.controls || {}).brake_pop || {}).pop_seconds || 2;
    brakeTimer = setTimeout(() => { if (S.sim.brake) { S.sim.brakePhase = "held"; runSim(); } }, secs * 1000);
  }
  runSim();
}
function toggleButton(name, on) {
  if (on === undefined) on = !S.sim.pressed.has(name);
  on ? S.sim.pressed.add(name) : S.sim.pressed.delete(name);
  runSim();
}
// PATTERN-type keys switch nothing on: on the real CanTrol each press steps the flash pattern of
// the outputs the CanTrol flashes (press-state count is set in Whelen Command, not confirmed).
function pressButton(b, key) {
  S.sim.presses = S.sim.presses || {};
  const n = (S.sim.presses[b.name] = (S.sim.presses[b.name] || 0) + 1);
  const states = +b.press_states || 0;
  const step = states ? ((n - 1) % states) + 1 : n;
  toast(`${(key && key.label) || b.name}: ${states ? `pattern state ${step} of ${states}` : `press ${n}`}. ${b.note || ""} Nothing turns on by itself; it changes how the CanTrol-flashed outputs that are already on will flash in the truck. The preview's flash timing is illustrative, so the lights here look the same.`, "info", 7000);
  window.renderHeadResult && window.renderHeadResult();
}
function applySim() {
  const r = S.sim.res;
  if (!r) return;
  const active = r.active || {};
  $$("[data-slide]").forEach((b) => b.classList.toggle("on", (b.dataset.slide || null) === (S.sim.slide || "") || (b.dataset.slide === "" && !S.sim.slide)));
  $$("[data-hbtn]").forEach((b) => b.classList.toggle("on", S.sim.pressed.has(b.dataset.hbtn)));
  $$("[data-brake]").forEach((b) => b.classList.toggle("on", S.sim.brake));
  // map
  const modes = r.modes || {};
  $$("#mapsvg .edge").forEach((g) => {
    const m = modes[g.dataset.src];
    g.classList.toggle("on", !!active[g.dataset.src]);
    g.classList.toggle("steady", !!m && m.mode === "steady");
    g.classList.toggle("flashA", !!m && (m.mode === "sweep" || (m.mode === "flash" && m.phase !== "B")));
    g.classList.toggle("flashB", !!m && m.mode === "flash" && m.phase === "B");
  });
  $$("#mapsvg .pin").forEach((g) => g.classList.toggle("on", !!active[g.dataset.oid]));
  $$("#mapsvg .device").forEach((g) => g.classList.toggle("on", !!r.lit[g.dataset.cid]));
  $$(".otile").forEach((t) => t.classList.toggle("on", !!active[t.dataset.oid]));
  $$("[data-loadtext]").forEach((el) => (el.textContent = loadText(r)));
  $$("[data-loadbar]").forEach((el) => { const pct = Math.min(100, (100 * r.known_load_a) / r.limit_a); el.style.width = pct + "%"; el.parentElement.className = "meter " + (pct > 90 ? "bad" : pct > 70 ? "amber" : "good"); });
  if (S.view === "head" && window.renderHeadResult) window.renderHeadResult();
}
const loadText = (r) => `${r.known_load_a.toFixed(2)} A known of ${r.limit_a} A` + (r.unknown_circuits ? ` · ${r.unknown_circuits} without a measured draw` : "");

// ------------------------------------------------------------------ views
const RENDER = {};

// ---------- command center
RENDER.dashboard = (main) => {
  const st = S.st, c = st.counts, bom = st.bom;
  const circs = st.circuits;
  const avg = Math.round(circs.reduce((s, x) => s + x.completeness, 0) / Math.max(1, circs.length));
  const usedJ1 = st.outputs.filter((o) => o.bank === "J1" && o.state !== "free").length;
  const usedLED = st.outputs.filter((o) => o.bank === "LED" && o.state !== "free").length;
  const prog = Object.values(st.progress);
  const stageCount = Object.fromEntries(st.stages.map((s) => [s.id, prog.filter((p) => p.stage === s.id).length]));
  const stageColors = { planned: "var(--line-2)", parts: "var(--amber)", bench: "var(--accent)", installed: "var(--violet)", verified: "var(--good)" };
  const load = st.total_known_current_a, lim = st.total_output_limit_a;
  const openTop = st.findings.filter((f) => f.severity !== "UNVERIFIED").slice(0, 9);
  const alerts = [];
  if (c.ERROR) alerts.push(["bad", `${c.ERROR} error${c.ERROR > 1 ? "s" : ""} in upfit.yaml`, "Fix these before you rely on any number here.", "findings"]);
  if (c.WARN) alerts.push(["amber", `${c.WARN} warning${c.WARN > 1 ? "s" : ""}`, "A fuse, wire or voltage drop needs a look.", "findings"]);
  if (st.map.unwired.length) alerts.push(["amber", `${st.map.unwired.length} outputs in the control plan aren't wired in upfit.yaml`, `${st.map.unwired.join(", ")}. The approved plan switches them, but no circuit connects to them yet.`, "outputs"]);
  if (!alerts.length) alerts.push(["good", "No errors or warnings", "Open items are blanks waiting on a measurement or a source.", "findings"]);
  main.innerHTML = `<div class="view">
    <div class="page-head"><div><div class="eyebrow">Command center</div><h1>${esc(st.vehicle.year)} ${esc(st.vehicle.make)} ${esc(st.vehicle.model)} ${esc(st.vehicle.trim)} upfit</h1>
      <p>Everything below is read from upfit.yaml. Blanks stay blank until you confirm them; nothing here is a guess.</p></div>
      <div class="actions"><button class="btn" data-go="map">${ic("map")} Wiring map</button><button class="btn primary" data-go="head">${ic("head")} Simulate the head</button></div></div>
    <div class="grid g-4">
      ${kpi("Circuits", circs.length, `${avg}% of electrical data filled in`, avg, "circuits")}
      ${kpi("Parts", st.parts.length, `${st.parts.filter((p) => p.status === "installed").length} installed · ${st.parts.filter((p) => p.status === "purchased").length} bought · ${st.parts.filter((p) => p.status === "planned").length} to buy`, null, "parts")}
      ${kpi("Open items", c.OPEN, `${c.UNVERIFIED} unverified · ${c.WARN} warnings · ${c.ERROR} errors`, null, "findings")}
      ${kpi("CanTrol outputs used", `${usedJ1 + usedLED}<small>/ 40</small>`, `J1 ${usedJ1} of 8 · LED ${usedLED} of 32`, ((usedJ1 + usedLED) / 40) * 100, "outputs")}
    </div>
    <div class="grid g-main" style="margin-top:14px">
      <div class="grid" style="align-content:start">
        <div class="card"><div class="card-head"><h3>Attention</h3><span class="sub">What needs you next</span></div>
          <div class="grid" style="gap:8px">${alerts.map(([tone, t, b, to]) => `<div class="alert ${tone}" style="cursor:pointer" data-go="${to}">${ic(tone === "good" ? "check" : "alert", 18)}<div><b>${esc(t)}</b><span class="dim">${esc(b)}</span></div></div>`).join("")}</div></div>
        <div class="card"><div class="card-head"><h3>Next open items</h3><span class="right"><button class="btn sm ghost" data-go="findings">All ${c.OPEN + c.WARN + c.ERROR}</button></span></div>
          <div class="list">${openTop.map(findingRow).join("") || '<div class="empty">Nothing open.</div>'}</div></div>
        <div class="card"><div class="card-head"><h3>Circuit readiness</h3><span class="sub">Share of current, fuse, wire, runs, ground, fuse spot and mounting filled in</span></div>
          <table class="data"><tbody>${circs.map((x) => `<tr class="click" data-action="circuit" data-id="${x.id}"><td class="mono" style="width:56px;color:var(--accent)">${x.id}</td><td class="ellipsis" style="max-width:340px">${esc(x.name)}</td><td style="width:200px"><div class="meter ${x.completeness >= 80 ? "good" : x.completeness >= 40 ? "amber" : "bad"}"><i style="width:${x.completeness}%"></i></div></td><td class="num" style="width:50px">${x.completeness}%</td><td style="width:70px">${x.open_count ? `<span class="pill OPEN">${x.open_count} open</span>` : '<span class="pill good">Clear</span>'}</td></tr>`).join("")}</tbody></table></div>
      </div>
      <div class="grid" style="align-content:start">
        <div class="card"><div class="card-head"><h3>Known load</h3><span class="sub">Circuits with a confirmed draw</span></div>
          <div class="ring-wrap">${ring(load / lim, `${load.toFixed(1)}`, "A")}
            <div><div class="dim">${load.toFixed(2)} A of the ${lim} A CanTrol output total</div><div class="muted" style="margin-top:6px">${st.circuits_missing_current.length} circuits have no measured draw yet, so the real load is higher. Measure them on the bench.</div></div></div></div>
        <div class="card"><div class="card-head"><h3>Budget in upfit.yaml</h3><span class="sub">Unit price × quantity</span></div>
          <div class="kv"><dt>Spent (bought + installed)</dt><dd class="mono">${money(bom.spent)}</dd><dt>Still to buy</dt><dd class="mono">${money(bom.to_buy)}</dd><dt>Projected</dt><dd class="mono"><b>${money(bom.projected)}</b></dd><dt>Considering</dt><dd class="mono">${money(bom.considering)}</dd><dt>No price yet</dt><dd>${bom.unpriced} parts</dd></dl></div>
          <div class="muted" style="margin-top:10px;font-size:12px">The master shopping list stays the source of truth for totals; this only counts parts in upfit.yaml.</div></div>
        <div class="card"><div class="card-head"><h3>Install progress</h3><span class="right"><button class="btn sm ghost" data-go="tracker">Open tracker</button></span></div>
          <div class="stack">${st.stages.map((s) => `<i style="width:${(100 * stageCount[s.id]) / Math.max(1, prog.length)}%;background:${stageColors[s.id]}"></i>`).join("")}</div>
          <div class="legend">${st.stages.map((s) => `<span><i style="background:${stageColors[s.id]}"></i>${s.label} ${stageCount[s.id]}</span>`).join("")}</div></div>
        <div class="card"><div class="card-head"><h3>Simulator</h3><span class="sub">Approved slide and button plan</span></div>
          <div class="seg">${["", "1", "2", "3"].map((s) => `<button data-slide="${s}" onclick="setSlide(${s ? `'${s}'` : "null"})">${s ? "Slide " + s : "Off"}</button>`).join("")}</div>
          <div style="margin-top:12px" class="dim" data-loadtext></div><div class="meter good" style="margin-top:8px"><i data-loadbar style="width:0"></i></div></div>
      </div>
    </div></div>`;
  applySim();
};
function kpi(label, value, foot, pct, go) {
  return `<div class="card kpi" ${go ? `data-go="${go}" style="cursor:pointer"` : ""}><span class="glyph">${ic(go === "findings" ? "findings" : go === "outputs" ? "outputs" : go === "parts" ? "parts" : "circuits", 20)}</span>
    <div class="label">${esc(label)}</div><div class="value">${value}</div><div class="foot">${esc(foot)}</div>${pct !== null && pct !== undefined ? `<div class="bar"><i style="width:${Math.min(100, pct)}%"></i></div>` : ""}</div>`;
}
function ring(frac, big, unit) {
  const r = 46, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac));
  const col = f > 0.9 ? "var(--bad)" : f > 0.7 ? "var(--amber)" : "var(--good)";
  return `<svg width="120" height="120" viewBox="0 0 120 120"><circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--line)" stroke-width="10"/>
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="${col}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c * f} ${c}" transform="rotate(-90 60 60)"/>
    <text x="60" y="62" text-anchor="middle" font-size="24" font-weight="600">${big}</text><text x="60" y="80" text-anchor="middle" font-size="11" fill="var(--text-3)">${unit}</text></svg>`;
}
function findingRow(f) {
  const isC = /^C\d+$/.test(f.subject), isPart = S.st.parts.some((p) => p.id === f.subject);
  const act = isC ? `data-action="circuit" data-id="${f.subject}"` : isPart ? `data-action="part" data-id="${f.subject}"` : "";
  return `<div class="list-row ${act ? "click" : ""}" ${act}><span class="pill ${f.severity}">${f.severity}</span><span class="subj">${esc(f.subject)}</span><span class="t">${esc(f.message)}</span></div>`;
}

// ---------- wiring map
const MAP = { pinX: 290, devX: 760, devW: 400, top: 70, pinGap: 26 };
RENDER.map = (main) => {
  main.innerHTML = `<div class="view full"><div class="map-wrap">
    <div class="map-top"><h1>Wiring map</h1>
      <div class="search"><span>${ic("search", 14)}</span><input class="input" id="mapFilter" placeholder="Filter: device, color, output…" value="${esc(S.map.filter)}"></div>
      <label class="chip ${S.map.showFree ? "on" : ""}" id="freeToggle">Show free outputs</label>
      <span class="muted" style="font-size:12px">Hover an output to trace it. Click a wire to edit it, a device to open its circuit. Scroll to pan, Ctrl+scroll to zoom.</span>
    </div>
    <div class="map-stage" id="stage"><svg id="mapsvg"></svg>
      <div class="map-zoom"><button class="icon-btn" id="zin" title="Zoom in">${ic("zin")}</button><button class="icon-btn" id="zout" title="Zoom out">${ic("zout")}</button><button class="icon-btn" id="zfit" title="Fit">${ic("fit")}</button></div>
      <div class="map-legend"><div><svg width="34" height="8"><path d="M2 4h30" stroke="var(--accent)" stroke-width="3"/></svg>Wire in upfit.yaml (its real color)</div>
        <div><svg width="34" height="8"><path d="M2 4h30" stroke="var(--amber)" stroke-width="3" stroke-dasharray="4 5"/></svg>In the control plan, not wired in upfit.yaml</div>
        <div><svg width="34" height="8"><path d="M2 4h30" stroke="var(--amber)" stroke-width="4"/></svg>On, steady (Turn On)</div>
        <div><svg width="34" height="8"><path class="legend-flash" d="M2 4h30" stroke="var(--amber)" stroke-width="4"/></svg>On, flashed by the CanTrol</div></div>
    </div>
    <div class="map-sim"><span class="lbl">Simulate</span>
      <div class="seg">${["", "1", "2", "3"].map((s) => `<button data-slide="${s}">${s ? "Slide " + s : "Off"}</button>`).join("")}</div>
      <div class="chips">${(S.st.controls.buttons || []).map((b) => `<span class="chip" data-hbtn="${esc(b.name)}">${esc(keyLabelFor(b.name))}</span>`).join("")}<span class="chip" data-brake>Brake</span></div>
      <div class="load-mini"><span data-loadtext></span><div class="meter good"><i data-loadbar></i></div></div>
    </div></div></div>`;
  drawMap();
  $("#mapFilter").oninput = debounce((e) => { S.map.filter = e.target.value; filterMap(); }, 120);
  $("#freeToggle").onclick = () => { S.map.showFree = !S.map.showFree; S.map.vb = null; RENDER.map(main); };
  $$(".map-sim [data-slide]").forEach((b) => (b.onclick = () => setSlide(b.dataset.slide || null)));
  $$(".map-sim [data-hbtn]").forEach((b) => (b.onclick = () => toggleButton(b.dataset.hbtn)));
  $(".map-sim [data-brake]").onclick = () => setBrake(!S.sim.brake);
  applySim();
};

function drawMap() {
  const st = S.st, m = st.map, svg = $("#mapsvg");
  const outs = S.map.showFree ? st.outputs.map((o) => o.id) : m.outputs_used;
  const pinY = {};
  let y = MAP.top + 66, lastBank = null;
  outs.forEach((oid) => {
    const bank = oid.split("-")[0];
    if (lastBank && bank !== lastBank) y += 22;
    lastBank = bank; pinY[oid] = y; y += MAP.pinGap;
  });
  const modBottom = y + 6;
  let oy = modBottom + 70;
  const otherY = {};
  m.other_sources.forEach((src) => { otherY[src] = oy; oy += MAP.pinGap + 6; });
  const srcY = (src) => pinY[src] ?? otherY[src];
  // devices, ordered by their first source position
  const byC = {};
  m.edges.forEach((e) => (byC[e.circuit_id] = byC[e.circuit_id] || []).push(e));
  const devs = Object.keys(byC).sort((a, b) => Math.min(...byC[a].map((e) => srcY(e.source) ?? 9e9)) - Math.min(...byC[b].map((e) => srcY(e.source) ?? 9e9)));
  const devPos = {};
  const circ0 = Object.fromEntries(st.circuits.map((c) => [c.id, c]));
  const devExtra = (c) => (wrapName(c.product || c.name).length - 1) * 15;
  let dy = MAP.top;
  devs.forEach((cid) => {
    const n = byC[cid].length, h = 62 + devExtra(circ0[cid]) + n * 22;
    const want = Math.min(...byC[cid].map((e) => srcY(e.source) ?? dy)) - 40;
    dy = Math.max(dy, want * 0.55 + dy * 0.45);
    devPos[cid] = { y: dy, h, x: devExtra(circ0[cid]) };
    dy += h + 14;
  });
  const H = Math.max(oy, dy) + 60, W = MAP.devX + MAP.devW + 80;
  const circ = Object.fromEntries(st.circuits.map((c) => [c.id, c]));
  const unwired = new Set(m.unwired);
  const used = new Set(m.edges.filter((e) => e.from_cantrol).map((e) => e.source));
  let h = `<defs><filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
  // module
  h += `<g class="module"><rect class="body" x="40" y="${MAP.top}" width="${MAP.pinX - 40}" height="${modBottom - MAP.top}" rx="14"/>
    <text x="60" y="${MAP.top + 26}" font-weight="600" font-size="14">Whelen CanTrol WC</text><text x="60" y="${MAP.top + 44}" font-size="11" fill="var(--text-3)">Module under the driver rear seat</text></g>`;
  outs.forEach((oid) => {
    const o = st.outputs.find((x) => x.id === oid);
    const cls = unwired.has(oid) ? "planned" : used.has(oid) ? "used" : "free";
    h += `<g class="pin ${cls}" data-oid="${oid}"><text x="${MAP.pinX - 16}" y="${pinY[oid] + 4}" text-anchor="end" class="mono">${oid.replace("-", " ")}</text>
      <text x="62" y="${pinY[oid] + 4}" font-size="10.5" fill="var(--text-3)">${o ? o.limit_a + " A" : ""}</text><circle cx="${MAP.pinX}" cy="${pinY[oid]}" r="5.5"/></g>`;
  });
  if (m.other_sources.length) {
    h += `<g class="module"><rect class="body" x="40" y="${modBottom + 30}" width="${MAP.pinX - 40}" height="${oy - modBottom - 30}" rx="14"/><text x="60" y="${modBottom + 54}" font-weight="600" font-size="13">Other sources</text></g>`;
    m.other_sources.forEach((src) => {
      h += `<g class="pin used" data-oid="${esc(src)}"><text x="${MAP.pinX - 16}" y="${otherY[src] + 4}" text-anchor="end" font-size="11.5">${esc(src.length > 30 ? src.slice(0, 29) + "…" : src)}</text><circle cx="${MAP.pinX}" cy="${otherY[src]}" r="5.5"/></g>`;
    });
  }
  // planned stubs
  m.unwired.forEach((oid) => {
    if (pinY[oid] === undefined) return;
    h += `<g class="edge planned" data-src="${oid}" data-planned="1"><path class="core" stroke="var(--amber)" d="M${MAP.pinX} ${pinY[oid]} h120"/><text x="${MAP.pinX + 128}" y="${pinY[oid] + 4}" font-size="11" fill="var(--amber)" paint-order="stroke" stroke="var(--bg)" stroke-width="4">not wired yet</text></g>`;
  });
  // edges
  m.edges.forEach((e, i) => {
    const y1 = srcY(e.source); if (y1 === undefined) return;
    const d = devPos[e.circuit_id], k = byC[e.circuit_id].indexOf(e), y2 = d.y + 62 + d.x + k * 22;
    const [c1, c2] = wireColors(e.color);
    const col = c1 || "var(--accent)";
    const mid = (MAP.pinX + MAP.devX) / 2;
    const path = `M${MAP.pinX} ${y1} C${mid} ${y1}, ${mid} ${y2}, ${MAP.devX} ${y2}`;
    const under = c1 === WIRE.black ? "#64748b" : "var(--bg)";
    h += `<g class="edge" data-i="${i}" data-src="${esc(e.source)}" data-cid="${e.circuit_id}"><title>${esc(e.source)} → ${esc(e.circuit_id)} ${esc(e.color || "")} ${esc(e.function)}</title>
      <path class="under" d="${path}" style="stroke:${under}"/><path class="core" d="${path}" stroke="${col}"/>${c2 ? `<path class="core" d="${path}" stroke="${c2}" stroke-dasharray="6 10" />` : ""}<path class="hit" d="${path}"/></g>`;
  });
  // devices
  devs.forEach((cid) => {
    const c = circ[cid], d = devPos[cid];
    const part = st.parts.find((p) => p.id === c.part);
    const nl = wrapName(c.product || c.name), dx = d.x;
    h += `<g class="device" data-cid="${cid}"><rect class="body" x="${MAP.devX}" y="${d.y}" width="${MAP.devW}" height="${d.h}"/>
      <circle class="beacon" cx="${MAP.devX + MAP.devW - 18}" cy="${d.y + 18}" r="6"/>
      <title>${esc(c.name)}</title><text class="id" x="${MAP.devX + 14}" y="${d.y + 20}">${cid}</text>${nl.map((l, i) => `<text x="${MAP.devX + 52}" y="${d.y + 20 + i * 15}" font-size="12.5" font-weight="600">${esc(l)}</text>`).join("")}
      <text x="${MAP.devX + 52}" y="${d.y + 36 + dx}" font-size="11.5" fill="var(--text-2)">${esc(c.role || "")}</text>
      <text class="sub" x="${MAP.devX + 14}" y="${d.y + 52 + dx}">${esc(part ? part.status : "")} · ${esc(c.type)}${c.current_a !== null && c.current_a !== undefined ? " · " + c.current_a + " A" : " · draw TBD"}</text>
      ${byC[cid].map((e, k) => `<circle class="slot" cx="${MAP.devX}" cy="${d.y + 62 + dx + k * 22}" r="4.5"/><text x="${MAP.devX + 14}" y="${d.y + 66 + dx + k * 22}" font-size="11.5" fill="var(--text-2)">${e.color ? esc(e.color) + " · " + esc((e.function || "").slice(0, 38)) : "Whole-circuit feed (no wires listed)"}</text>`).join("")}</g>`;
  });
  svg.innerHTML = h;
  svg.dataset.w = W; svg.dataset.h = H;
  if (!S.map.vb) S.map.vb = fitWidth(W);
  setVB();
  bindMap(svg);
  filterMap();
}
function fitWidth(W) {
  const r = $("#stage").getBoundingClientRect();
  return { x: 0, y: 0, w: W, h: (W * r.height) / Math.max(1, r.width) };
}
function setVB() { const v = S.map.vb; $("#mapsvg").setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`); }
function bindMap(svg) {
  const stage = $("#stage");
  let drag = null;
  stage.onpointerdown = (e) => { if (e.target.closest(".edge,.device,.pin,.map-zoom,.map-legend")) return; drag = { x: e.clientX, y: e.clientY, vb: { ...S.map.vb } }; stage.classList.add("drag"); stage.setPointerCapture(e.pointerId); };
  stage.onpointermove = (e) => {
    if (!drag) return;
    const r = svg.getBoundingClientRect(), k = Math.max(drag.vb.w / r.width, drag.vb.h / r.height);
    S.map.vb.x = drag.vb.x - (e.clientX - drag.x) * k; S.map.vb.y = drag.vb.y - (e.clientY - drag.y) * k; setVB();
  };
  stage.onpointerup = () => { drag = null; stage.classList.remove("drag"); };
  stage.onwheel = (e) => {
    e.preventDefault();
    if (e.ctrlKey) return zoom(e.deltaY < 0 ? 0.88 : 1.14, e);
    const v = S.map.vb, k = v.w / svg.getBoundingClientRect().width;
    v.x += (e.shiftKey ? e.deltaY : e.deltaX) * k; if (!e.shiftKey) v.y += e.deltaY * k; setVB();
  };
  $("#zin").onclick = () => zoom(0.8); $("#zout").onclick = () => zoom(1.25);
  $("#zfit").onclick = () => { const W = +svg.dataset.w, H = +svg.dataset.h, r = svg.getBoundingClientRect(); const k = Math.max(W / r.width, H / r.height); S.map.vb = { x: 0, y: 0, w: r.width * k, h: r.height * k }; setVB(); };
  $$(".pin", svg).forEach((p) => {
    p.onmouseenter = () => traceSource(p.dataset.oid);
    p.onmouseleave = () => traceSource(null);
    p.onclick = () => { if (/^(J1|LED)-\d+$/.test(p.dataset.oid)) openOutputDrawer(p.dataset.oid); };
  });
  $$(".edge", svg).forEach((g) => {
    g.onmouseenter = () => g.classList.add("hl"); g.onmouseleave = () => g.classList.remove("hl");
    g.onclick = () => { if (g.dataset.planned) openOutputDrawer(g.dataset.src); else openEdgeDrawer(S.st.map.edges[+g.dataset.i]); };
  });
  $$(".device", svg).forEach((d) => (d.onclick = () => openCircuitDrawer(d.dataset.cid)));
}
function zoom(f, e) {
  const v = S.map.vb, svg = $("#mapsvg"), r = svg.getBoundingClientRect();
  let cx = v.x + v.w / 2, cy = v.y + v.h / 2;
  if (e) { const k = Math.max(v.w / r.width, v.h / r.height); cx = v.x + (e.clientX - r.left) * k; cy = v.y + (e.clientY - r.top) * k; }
  const nw = Math.min(Math.max(v.w * f, 200), +svg.dataset.w * 3), nh = (nw / v.w) * v.h;
  S.map.vb = { x: cx - ((cx - v.x) * nw) / v.w, y: cy - ((cy - v.y) * nh) / v.h, w: nw, h: nh }; setVB();
}
function traceSource(src) {
  $$("#mapsvg .edge").forEach((g) => { g.classList.toggle("dim", !!src && g.dataset.src !== src); g.classList.toggle("hl", !!src && g.dataset.src === src); });
  const lit = new Set(src ? S.st.map.edges.filter((e) => e.source === src).map((e) => e.circuit_id) : []);
  $$("#mapsvg .device").forEach((d) => d.classList.toggle("dim", !!src && !lit.has(d.dataset.cid)));
}
function filterMap() {
  const q = S.map.filter.trim().toLowerCase();
  if (!q) { $$("#mapsvg .edge, #mapsvg .device").forEach((g) => g.classList.remove("dim")); return; }
  const edges = S.st.map.edges, circ = Object.fromEntries(S.st.circuits.map((c) => [c.id, c]));
  const hit = new Set();
  edges.forEach((e, i) => { const t = `${e.source} ${e.circuit_id} ${circ[e.circuit_id].name} ${e.color} ${e.function} ${e.connects_to}`.toLowerCase(); if (t.includes(q)) hit.add(i); });
  const devHit = new Set(edges.filter((e, i) => hit.has(i)).map((e) => e.circuit_id));
  $$("#mapsvg .edge").forEach((g) => g.classList.toggle("dim", !g.dataset.planned && !hit.has(+g.dataset.i)));
  $$("#mapsvg .device").forEach((d) => d.classList.toggle("dim", !devHit.has(d.dataset.cid)));
}

// ---------- drawers shared by map, outputs and circuits
function openEdgeDrawer(e) {
  const c = S.st.circuits.find((x) => x.id === e.circuit_id);
  if (e.wire_index === null || e.wire_index === undefined) {
    const body = `<div class="alert info">${ic("info", 18)}<div><b>Whole-circuit feed</b><span class="dim">${esc(c.id)} has no individual wires in upfit.yaml yet, so the map draws one line from ${esc(e.source)}. Add the real wires once you have them from the manual.</span></div></div>
      ${kvCircuit(c)}${wireForm({})}`;
    const d = drawer(`${esc(c.id)} ${esc(c.name)}`, "Add a wire", body, `<button class="btn primary" id="drawerSave">${ic("plus")} Add wire</button><button class="btn ghost" data-close>Cancel</button><span style="margin-left:auto"></span><button class="btn" data-action="circuit" data-id="${c.id}">Open circuit</button>`);
    $("#drawerSave").onclick = () => saveWire(d, c.id, null);
    return;
  }
  openWireDrawer(c.id, e.wire_index);
}
function wireForm(w) {
  const lt = w.light || {}, drives = S.st.light_drives || [], colors = S.st.light_colors || [];
  const DRV = { output: "Follows the CanTrol output (steady or flashed)", pattern: "Device runs its own pattern", "arrow-left": "Arrow left", "arrow-right": "Arrow right", power: "Device power only", input: "Control input (pattern step, sync, relay)" };
  return `<div class="form-grid"><div class="field"><label>Wire color</label><input class="input" name="color" value="${esc(w.color)}" placeholder="e.g. Red, Red/White"><div class="ferr" data-for="color"></div></div>
    <div class="field"><label>Function</label><input class="input" name="function" value="${esc(w.function)}" placeholder="e.g. Mode 1"><div class="ferr" data-for="function"></div></div>
    <div class="field wide"><label>Connects to</label><input class="input" name="connects_to" value="${esc(w.connects_to)}" placeholder="e.g. LED Output 12, J1 Output 4 via 3A fuse"><div class="hint">Name the CanTrol output as "J1 Output n" or "LED Output n" so the map can draw it. Blank means not decided yet.</div></div>
    <div class="field"><label>What the light does</label><select class="input" name="light_drive"><option value="">Not set (no light preview)</option>${drives.map((d) => `<option value="${d}" ${lt.drive === d ? "selected" : ""}>${esc(DRV[d] || d)}</option>`).join("")}</select><div class="ferr" data-for="light_drive"></div></div>
    <div class="field"><label>Light color</label><select class="input" name="light_color"><option value="">Not confirmed (shows as TBD)</option>${colors.map((c) => `<option value="${c}" ${lt.color === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select><div class="ferr" data-for="light_color"></div><div class="hint">Only pick a color the maker's manual or your bench confirms.</div></div></div>`;
}
function openWireDrawer(cid, idx) {
  const c = S.st.circuits.find((x) => x.id === cid), w = c.wires[idx];
  const d = drawer(`${swatch(w.color)}${esc(w.color || "Wire")} · ${esc(w.function)}`, `${esc(c.id)} ${esc(c.name)} · wire ${idx + 1} of ${c.wires.length}`,
    `${wireForm(w)}<div class="alert amber">${ic("alert", 18)}<div><b>Check before you save</b><span class="dim">Wire colors and functions come from the maker's manual. Don't save a color you haven't confirmed; leave it blank instead.</span></div></div>`,
    `<button class="btn primary" id="drawerSave">Save to upfit.yaml</button><button class="btn ghost" data-close>Cancel</button><span style="margin-left:auto"></span><button class="btn danger" id="wireDel">Delete wire</button>`);
  $("#drawerSave").onclick = () => saveWire(d, cid, idx);
  $("#wireDel").onclick = async () => {
    if (!(await confirmBox("Delete this wire?", `${esc(cid)}: ${esc(w.color)} ${esc(w.function)}. A backup of upfit.yaml is made first.`, "Delete", "Cancel", true))) return;
    const r = await api("delete_wire", cid, idx);
    if (!r.ok) return toast(r.error, "bad");
    afterSave(r, "Wire deleted");
  };
}
async function saveWire(d, cid, idx) {
  const raw = Object.fromEntries($$(".input", d).map((i) => [i.name, i.value]));
  const r = await api("save_wire", cid, idx, raw);
  fieldErrors(d, r);
  if (!r.ok) return r.field ? null : toast(r.error, "bad");
  afterSave(r, idx === null ? "Wire added" : "Wire saved");
}
function afterSave(r, msg) {
  closeLayer(); setState(r.state); S.map.vb = S.view === "map" ? S.map.vb : null; refresh(); runSim();
  toast(`${msg}. Backup: ${r.backup}`);
  syncBadge(r.sync);
  if (r.sync && r.sync.note === "Syncing…") setTimeout(pollSync, 1500);
}
function syncBadge(last) {
  const el = $("#sbSync"); if (!el) return;
  if (!last) return;
  const t = (last.when || "").slice(11, 16);
  el.className = "sync-chip " + (last.ok === true ? "ok" : last.ok === false ? "bad" : "");
  el.textContent = last.ok === true ? `Synced ${t}` : last.ok === false ? `Sync failed ${t}` : (last.note || "Sync");
  el.title = (last.targets || []).map((x) => `${x.target}: ${x.detail}`).join("\n") || last.note || "";
}
async function pollSync() { const r = await api("sync_status"); if (r.ok) { syncBadge(r.last); if (r.last && r.last.note === "Syncing…") setTimeout(pollSync, 2000); } }
function kvCircuit(c) {
  const calc = c.calc || {};
  return `<dl class="kv"><dt>Type</dt><dd>${esc(c.type)}${c.critical ? ' · <span class="pill amber">critical</span>' : ""}</dd><dt>Source</dt><dd>${show(c.source)}</dd><dt>CanTrol output</dt><dd>${show(c.controller_output)}</dd>
    <dt>Current draw</dt><dd>${show(c.current_a, " A")}</dd><dt>Fuse / limit</dt><dd>${show(c.fuse_a, " A")}</dd><dt>Wire</dt><dd>${show(c.wire_awg, " AWG")}, feed ${show(c.feed_length_ft, " ft")}</dd>
    <dt>Voltage drop</dt><dd>${calc.drop_pct !== null && calc.drop_pct !== undefined ? `${calc.drop_pct.toFixed(2)}% (limit ${calc.drop_limit_pct}%)` : '<span class="muted">needs current, gauge and run</span>'}</dd><dt>Mounting</dt><dd>${show(c.mounting)}</dd></dl>`;
}
function openCircuitDrawer(cid) {
  const c = S.st.circuits.find((x) => x.id === cid);
  const fs = S.st.findings.filter((f) => f.subject === cid);
  drawer(esc(c.name), `${cid} · ${esc(c.type)} circuit`,
    `${kvCircuit(c)}<h2 class="section" style="margin:6px 0 0">Wires</h2>${wiresTable(c, false)}
     <h2 class="section" style="margin:6px 0 0">Open and unverified</h2><div class="list">${fs.map(findingRow).join("") || '<div class="muted">Nothing open.</div>'}</div>`,
    `<button class="btn primary" data-action="circuit" data-id="${cid}">${ic("circuits")} Edit circuit</button><button class="btn" id="cdDiag">${ic("diagram")} Diagram</button><button class="btn ghost" data-close>Close</button>`);
  $("#cdDiag").onclick = () => { closeLayer(); go("diagrams", { diagram: cid }); };
}
function wiresTable(c, editable) {
  if (!c.wires || !c.wires.length) return '<div class="muted">No individual wires recorded.</div>';
  return `<table class="data"><thead><tr><th>Color</th><th>Function</th><th>Connects to</th>${editable ? "<th></th>" : ""}</tr></thead><tbody>
    ${c.wires.map((w, i) => `<tr ${editable ? `class="click" data-wire="${i}"` : ""}><td style="white-space:nowrap">${swatch(w.color)}${show(w.color)}</td><td>${esc(w.function)}</td><td>${show(w.connects_to)}</td>${editable ? `<td class="muted" style="width:40px">Edit</td>` : ""}</tr>`).join("")}</tbody></table>`;
}
function openOutputDrawer(oid) {
  const o = S.st.outputs.find((x) => x.id === oid);
  if (!o) return;
  const circ = Object.fromEntries(S.st.circuits.map((c) => [c.id, c]));
  const planned = S.st.map.unwired.includes(oid);
  drawer(esc(o.label), `${o.bank === "J1" ? "J1 high-current output" : "LED output"} · ${o.limit_a} A limit (guide 14580G p.3)`,
    `${planned ? `<div class="alert amber">${ic("alert", 18)}<div><b>In the control plan, not in upfit.yaml</b><span class="dim">The approved slide and button plan switches ${esc(oid)}, but no circuit's wire connects to it yet. Add the wire to the right circuit once its wiring is confirmed.</span></div></div>` : ""}
     <dl class="kv"><dt>State</dt><dd><span class="pill ${o.state === "free" ? "muted" : o.state === "over" ? "bad" : o.state === "planned" ? "amber" : "info"}">${o.state}</span></dd>
     <dt>Known load</dt><dd>${o.known_a} A of ${o.limit_a} A${o.unknown ? ` · ${o.unknown} circuit(s) without a draw` : ""}</dd>
     <dt>Turned on by</dt><dd>${o.uses.length ? o.uses.map((u) => `<span class="pill muted" style="margin:0 4px 4px 0">${esc(u)}</span>`).join("") : '<span class="muted">Nothing in the control plan</span>'}</dd></dl>
     <h2 class="section" style="margin:6px 0 0">Connected</h2>
     ${o.wires.length ? `<div class="list">${o.wires.map((w) => `<div class="list-row click" data-action="circuit" data-id="${w.circuit_id}">${swatch(w.color)}<span class="subj">${w.circuit_id}</span><span class="t">${esc(circ[w.circuit_id].name)}<div class="muted">${esc(w.color || "Feed")} · ${esc(w.function)}</div></span></div>`).join("")}</div>` : '<div class="muted">Nothing wired to this output.</div>'}`,
    `<button class="btn ghost" data-close>Close</button>`);
}

// ---------- control head: see head.js (exact CCTL7 replica, light preview)

// ---------- output board
RENDER.outputs = (main) => {
  const st = S.st, circ = Object.fromEntries(st.circuits.map((c) => [c.id, c]));
  const tile = (o) => `<div class="otile ${o.state}" data-oid="${o.id}" data-action="output" data-id="${o.id}">
      <div class="h"><b>${o.id.replace("-", " ")}</b><span class="pill ${o.state === "free" ? "muted" : o.state === "over" ? "bad" : o.state === "planned" ? "amber" : "info"}">${o.state}</span><span class="lim">${o.limit_a} A</span></div>
      <div class="who">${o.circuits.length ? o.circuits.map((c) => `${o.wires.filter((w) => w.circuit_id === c).map((w) => swatch(w.color)).join("")}<span class="dim">${esc(circ[c].name)}</span>`).join("<br>") : o.state === "planned" ? '<span style="color:var(--amber)">Plan uses it, no wire in upfit.yaml</span>' : '<span class="muted">Free</span>'}</div>
      ${o.circuits.length ? `<div class="meter ${o.known_a > o.limit_a ? "bad" : "good"}"><i style="width:${Math.min(100, (100 * o.known_a) / o.limit_a)}%"></i></div>` : ""}
      <div class="uses">${o.uses.map((u) => `<span>${esc(u)}</span>`).join("")}</div></div>`;
  const j1 = st.outputs.filter((o) => o.bank === "J1"), led = st.outputs.filter((o) => o.bank === "LED");
  const n = (arr, s) => arr.filter((o) => o.state === s).length;
  main.innerHTML = `<div class="view">
    <div class="page-head"><div><div class="eyebrow">Output board</div><h1>All 40 CanTrol outputs at a glance</h1>
      <p>Which output feeds what, what the plan uses it for, and the known load against each output's limit. Free outputs are your spares.</p></div>
      <div class="actions"><div class="seg">${["", "1", "2", "3"].map((s) => `<button data-slide="${s}">${s ? "Slide " + s : "Off"}</button>`).join("")}</div></div></div>
    ${st.map.unwired.length ? `<div class="alert amber" style="margin-bottom:14px">${ic("alert", 18)}<div><b>${st.map.unwired.length} planned outputs have no wire in upfit.yaml: ${st.map.unwired.join(", ")}</b><span class="dim">These come from the approved rocker and U-Lite changes. Add the wires to circuits C04/C05 and C12 once you confirm them, and the board and simulator fill in.</span></div></div>` : ""}
    <h2 class="section">J1 high-current outputs · 10 A each <span class="muted" style="text-transform:none;letter-spacing:0">· ${n(j1, "used")} used, ${n(j1, "planned")} planned, ${n(j1, "free")} free</span></h2><div class="board j1">${j1.map(tile).join("")}</div>
    <h2 class="section">LED outputs · 2.5 A each <span class="muted" style="text-transform:none;letter-spacing:0">· ${n(led, "used")} used, ${n(led, "planned")} planned, ${n(led, "free")} free</span></h2><div class="board">${led.map(tile).join("")}</div>
    <div class="muted" style="margin-top:16px;font-size:12px">Limits from Whelen guide 14580G p.3 (J1 10 A fused, LED 2.5 A internally limited, 40 A total). Pin numbers are inferred from the guide and not yet confirmed on your module.</div></div>`;
  $$("[data-slide]", main).forEach((b) => (b.onclick = () => setSlide(b.dataset.slide || null)));
  applySim();
};

// ---------- circuits
RENDER.circuits = (main) => {
  const st = S.st;
  if (!S.sel.circuit || !st.circuits.find((c) => c.id === S.sel.circuit)) S.sel.circuit = st.circuits[0]?.id;
  main.innerHTML = `<div class="view"><div class="page-head"><div><div class="eyebrow">Circuits</div><h1>Edit circuits with live checks</h1>
    <p>Fill in what you've confirmed. Voltage drop, wire protection and fuse size update as you type. Nothing is written until you save, and every save backs up upfit.yaml first.</p></div></div>
    <div class="split"><div class="card pad-0 listpane"><div style="padding:12px"><div class="search"><span>${ic("search", 14)}</span><input class="input" id="cq" placeholder="Filter circuits"></div></div><div id="clist" style="padding:0 8px 8px"></div></div>
    <div id="cdetail"></div></div></div>`;
  const drawList = () => {
    const q = ($("#cq").value || "").toLowerCase();
    $("#clist").innerHTML = st.circuits.filter((c) => `${c.id} ${c.name} ${c.controller_output}`.toLowerCase().includes(q)).map((c) => `
      <div class="circ-item ${c.id === S.sel.circuit ? "sel" : ""}" data-cid="${c.id}"><div class="top"><span class="id">${c.id}</span><span class="nm ellipsis">${esc(c.name)}</span>${c.open_count ? `<span class="pill OPEN">${c.open_count}</span>` : ""}</div>
      <div class="out ellipsis">${esc(c.controller_output || c.source || "")}</div><div class="meter ${c.completeness >= 80 ? "good" : c.completeness >= 40 ? "amber" : "bad"}" style="height:4px"><i style="width:${c.completeness}%"></i></div></div>`).join("");
    $$(".circ-item", $("#clist")).forEach((el) => (el.onclick = async () => {
      if (S.dirty && !(await confirmBox("Discard changes?", "This circuit has changes that aren't saved.", "Discard", "Keep editing"))) return;
      S.dirty = false; S.sel.circuit = el.dataset.cid; drawList(); drawCircuit();
    }));
  };
  $("#cq").oninput = drawList;
  drawList(); drawCircuit();
};
function drawCircuit() {
  const st = S.st, c = st.circuits.find((x) => x.id === S.sel.circuit), box = $("#cdetail");
  if (!c) { box.innerHTML = '<div class="empty">No circuits.</div>'; return; }
  const val = (k) => { if (k.startsWith("ground.")) { const g = c.ground || {}; return g[k.slice(7)]; } return c[k]; };
  const fs = st.findings.filter((f) => f.subject === c.id);
  box.innerHTML = `<div class="grid">
    <div class="card"><div class="card-head"><div><div class="eyebrow">${c.id} · ${esc(c.type)}${c.critical ? " · critical" : ""}</div><h3 style="font-size:17px;margin-top:2px">${esc(c.name)}</h3></div>
      <span class="right" style="display:flex;gap:8px"><button class="btn sm" id="cMap">${ic("map", 14)} Map</button><button class="btn sm" id="cDiag">${ic("diagram", 14)} Diagram</button></span></div>
      <dl class="kv" style="margin-bottom:16px"><dt>Part</dt><dd><a href="#" data-action="part" data-id="${esc(c.part)}" style="color:var(--accent)">${esc((st.parts.find((p) => p.id === c.part) || {}).name || c.part)}</a></dd><dt>Source</dt><dd>${show(c.source)}</dd><dt>CanTrol output</dt><dd>${show(c.controller_output)}</dd></dl>
      <div class="form-grid" id="cform">${st.circuit_fields.map((f) => `<div class="field ${f.kind === "text" ? "wide" : ""}"><label>${esc(f.label)}</label>
        ${f.kind === "awg" ? `<select class="input" name="${f.key}"><option value="">Blank (not confirmed)</option>${st.gauges.map((g) => `<option ${String(val(f.key)) === g ? "selected" : ""}>${g}</option>`).join("")}</select>` : `<input class="input" name="${f.key}" value="${esc(val(f.key))}" ${f.kind === "float" ? 'inputmode="decimal"' : ""} placeholder="Blank = not confirmed">`}
        <div class="ferr" data-for="${f.key}"></div></div>`).join("")}</div>
      <div class="live-box" id="live" style="margin-top:16px"></div>
      <div class="savebar"><button class="btn primary" id="saveCircuit" disabled>Save to upfit.yaml</button><button class="btn ghost" id="undoCircuit">Undo changes</button><span class="dirty" id="dirtyNote"></span><span class="muted" style="margin-left:auto;font-size:12px">Ctrl+S saves</span></div></div>
    <div class="card"><div class="card-head"><h3>Wires</h3><span class="sub">${(c.wires || []).length} recorded</span><span class="right"><button class="btn sm" id="addWire">${ic("plus", 14)} Add wire</button></span></div>${wiresTable(c, true)}</div>
    ${c.relay ? `<div class="card"><div class="card-head"><h3>Relay pins</h3></div><dl class="kv">${Object.entries(c.relay).map(([k, v]) => `<dt class="mono">${esc(k)}</dt><dd>${show(v)}</dd>`).join("")}</dl></div>` : ""}
    <div class="card"><div class="card-head"><h3>Open and unverified</h3><span class="sub">${fs.length}</span></div><div class="list">${fs.map(findingRow).join("") || '<div class="muted">Nothing open.</div>'}</div>
      ${(c.open_items || []).length ? `<h2 class="section">Open items in upfit.yaml</h2><ul class="dim" style="margin:0;padding-left:18px">${c.open_items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div></div>`;
  const orig = Object.fromEntries(st.circuit_fields.map((f) => [f.key, blank(val(f.key)) ? "" : String(val(f.key))]));
  const form = $("#cform");
  const changed = () => Object.fromEntries($$(".input", form).filter((i) => i.value.trim() !== orig[i.name]).map((i) => [i.name, i.value]));
  const live = debounce(async () => {
    const ch = changed();
    $$(".input", form).forEach((i) => i.classList.toggle("dirty", i.name in ch));
    S.dirty = Object.keys(ch).length > 0;
    $("#saveCircuit").disabled = !S.dirty;
    $("#dirtyNote").textContent = S.dirty ? `${Object.keys(ch).length} unsaved change${Object.keys(ch).length > 1 ? "s" : ""}` : "";
    const r = await api("preview_circuit", c.id, ch);
    fieldErrors(form, r);
    if (!r.ok) { $("#saveCircuit").disabled = true; return; }
    const opens = r.findings.filter((f) => f.severity !== "UNVERIFIED");
    $("#live").innerHTML = r.lines.map((l) => `<div class="live-line ${l.tone}"><span class="ic">${ic(l.tone === "good" ? "check" : l.tone === "bad" ? "alert" : "info", 15)}</span><span>${esc(l.text)}</span></div>`).join("")
      + (opens.length ? `<div class="live-line note" style="margin-top:4px"><span class="ic"></span><b>Still open for this circuit: ${opens.length}</b></div>` + opens.slice(0, 6).map((f) => `<div class="live-line ${f.severity === "ERROR" || f.severity === "WARN" ? "bad" : "note"}"><span class="ic"></span><span><span class="pill ${f.severity}">${f.severity}</span> ${esc(f.message)}</span></div>`).join("") : "");
  }, 140);
  $$(".input", form).forEach((i) => (i.oninput = i.onchange = live));
  live();
  $("#undoCircuit").onclick = () => { S.dirty = false; drawCircuit(); };
  $("#saveCircuit").onclick = async () => {
    const ch = changed();
    if (!(await confirmBox(`Save ${c.id} to upfit.yaml?`, `${Object.keys(ch).length} field(s) change. A timestamped backup is made first, and comments in the file are kept.`, "Save", "Cancel"))) return;
    const r = await api("save_circuit", c.id, ch);
    fieldErrors(form, r);
    if (!r.ok) return toast(r.error, "bad");
    S.dirty = false; setState(r.state); RENDER.circuits($("#main")); runSim(); toast(`${c.id} saved. Backup: ${r.backup}`);
  };
  $("#addWire").onclick = () => {
    const d = drawer(`Add a wire to ${esc(c.id)}`, esc(c.name), wireForm({}), `<button class="btn primary" id="drawerSave">${ic("plus")} Add wire</button><button class="btn ghost" data-close>Cancel</button>`);
    $("#drawerSave").onclick = () => saveWire(d, c.id, null);
  };
  $$("[data-wire]", box).forEach((tr) => (tr.onclick = () => openWireDrawer(c.id, +tr.dataset.wire)));
  $("#cMap").onclick = () => { go("map"); setTimeout(() => { S.map.filter = c.id; $("#mapFilter").value = c.id; filterMap(); }, 30); };
  $("#cDiag").onclick = () => go("diagrams", { diagram: c.id });
}

// ---------- parts
RENDER.parts = (main) => {
  const st = S.st, P = S.parts;
  const statuses = ["all", ...st.part_statuses];
  const cats = [...new Set(st.parts.map((p) => p.category).filter(Boolean))].sort();
  main.innerHTML = `<div class="view"><div class="page-head"><div><div class="eyebrow">Parts & BOM</div><h1>Products in this build</h1>
    <p>Edit names, SKUs, prices, quantities, status and spec sources. Totals update after each save. Use the full product name, the way it appears in the project document.</p></div>
    <div class="actions"><button class="btn primary" id="addPart">${ic("plus")} Add part</button></div></div>
    <div class="grid g-4" style="margin-bottom:14px">
      ${kpi("Spent", money(st.bom.spent), "Bought and installed", null)}${kpi("Still to buy", money(st.bom.to_buy), "Status planned", null)}${kpi("Projected", money(st.bom.projected), "Spent + to buy", null)}${kpi("No price yet", st.bom.unpriced, "Parts missing a unit price or quantity", null)}</div>
    <div class="toolbar"><div class="chips">${statuses.map((s) => `<span class="chip ${P.status === s ? "on" : ""}" data-st="${s}">${s === "all" ? "All" : s[0].toUpperCase() + s.slice(1)} <span class="n">${s === "all" ? st.parts.length : st.parts.filter((p) => p.status === s).length}</span></span>`).join("")}</div>
      <select class="input" id="pcat" style="width:auto"><option value="">All categories</option>${cats.map((c) => `<option ${P.cat === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
      <div class="grow"></div><div class="search"><span>${ic("search", 14)}</span><input class="input" id="pq" placeholder="Search name, SKU, maker" value="${esc(P.q)}"></div></div>
    <div class="card pad-0"><table class="data"><thead><tr><th>Product</th><th>Status</th><th>Category</th><th>SKU</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Line</th><th>Source</th></tr></thead><tbody id="ptbody"></tbody></table></div></div>`;
  const draw = () => {
    const q = P.q.toLowerCase();
    const rows = st.parts.filter((p) => (P.status === "all" || p.status === P.status) && (!P.cat || p.category === P.cat) && `${p.name} ${p.sku} ${p.manufacturer} ${p.id}`.toLowerCase().includes(q));
    $("#ptbody").innerHTML = rows.map((p) => {
      const line = p.price_usd !== null && p.price_usd !== undefined && p.qty !== null && p.qty !== undefined ? p.price_usd * p.qty : null;
      return `<tr class="click" data-action="part" data-id="${esc(p.id)}"><td><div style="font-weight:500">${esc(p.name)}</div><div class="muted mono" style="font-size:11.5px">${esc(p.id)}${p.manufacturer ? " · " + esc(p.manufacturer) : ""}</div></td>
        <td><span class="pill ${p.status}">${esc(p.status)}</span></td><td class="dim">${show(p.category)}</td><td class="mono">${show(p.sku)}</td><td class="num">${show(p.qty)}</td><td class="num">${money(p.price_usd)}</td><td class="num">${line === null ? '<span class="muted">TBD</span>' : money(line)}</td>
        <td>${p.spec_source ? `<span class="pill good">linked</span>` : '<span class="pill OPEN">none</span>'}</td></tr>`;
    }).join("") || `<tr><td colspan="8"><div class="empty">No parts match.</div></td></tr>`;
  };
  $$("[data-st]", main).forEach((c) => (c.onclick = () => { P.status = c.dataset.st; RENDER.parts(main); }));
  $("#pcat").onchange = (e) => { P.cat = e.target.value; draw(); };
  $("#pq").oninput = (e) => { P.q = e.target.value; draw(); };
  $("#addPart").onclick = () => openPartDrawer(null);
  draw();
};
function partForm(p, isNew) {
  const st = S.st;
  return `${isNew ? `<div class="field"><label>Part id</label><input class="input" name="id" placeholder="e.g. rocker_relay_b"><div class="hint">Short id used by circuits: lower case letters, digits and _.</div><div class="ferr" data-for="id"></div></div>` : ""}
    <div class="form-grid">${st.part_fields.map((f) => `<div class="field ${["name", "spec_source"].includes(f.key) ? "wide" : ""}"><label>${esc(f.label)}</label>
      ${f.kind === "status" ? `<select class="input" name="status">${st.part_statuses.map((s) => `<option ${p.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>` : `<input class="input" name="${f.key}" value="${esc(p[f.key])}" placeholder="${["name", "status"].includes(f.key) ? "Required" : "Blank = not confirmed"}">`}
      <div class="ferr" data-for="${f.key}"></div></div>`).join("")}</div>`;
}
function openPartDrawer(pid) {
  const st = S.st, isNew = !pid, p = isNew ? { status: "planned", qty: 1 } : st.parts.find((x) => x.id === pid);
  if (!p) return;
  const usedBy = isNew ? [] : st.circuits.filter((c) => c.part === pid);
  const fs = isNew ? [] : st.findings.filter((f) => f.subject === pid);
  const specs = p.specs && Object.keys(p.specs).length ? `<h2 class="section" style="margin:4px 0 0">Specs</h2><dl class="kv">${Object.entries(p.specs).map(([k, v]) => `<dt>${esc(k.replace(/_/g, " "))}</dt><dd>${esc(typeof v === "object" ? JSON.stringify(v) : v)}</dd>`).join("")}</dl>` : "";
  const d = drawer(isNew ? "Add a part" : esc(p.name), isNew ? "New product" : `${esc(pid)} · ${esc(p.status)}`,
    `${partForm(p, isNew)}${specs}
     ${usedBy.length ? `<h2 class="section" style="margin:4px 0 0">Used by</h2><div class="list">${usedBy.map((c) => `<div class="list-row click" data-action="circuit" data-id="${c.id}"><span class="subj">${c.id}</span><span class="t">${esc(c.name)}</span></div>`).join("")}</div>` : ""}
     ${(p.notes || []).length ? `<h2 class="section" style="margin:4px 0 0">Notes</h2><ul class="dim" style="margin:0;padding-left:18px">${p.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
     ${fs.length ? `<h2 class="section" style="margin:4px 0 0">Open</h2><div class="list">${fs.map(findingRow).join("")}</div>` : ""}`,
    `<button class="btn primary" id="drawerSave">${isNew ? "Add part" : "Save to upfit.yaml"}</button><button class="btn ghost" data-close>Cancel</button>`);
  $("#drawerSave").onclick = async () => {
    const raw = Object.fromEntries($$(".input", d).filter((i) => i.name !== "id").map((i) => [i.name, i.value]));
    const r = isNew ? await api("add_part", $('[name="id"]', d).value.trim(), raw) : await api("save_part", pid, raw);
    fieldErrors(d, r);
    if (!r.ok) return r.field ? null : toast(r.error, "bad");
    afterSave(r, isNew ? "Part added" : "Part saved");
  };
}

// ---------- findings
RENDER.findings = (main) => {
  const st = S.st, F = S.findings;
  const sevs = ["all", "ERROR", "WARN", "OPEN", "UNVERIFIED"];
  main.innerHTML = `<div class="view"><div class="page-head"><div><div class="eyebrow">Findings</div><h1>Everything still open</h1><p>Errors and warnings first. Open items are blanks waiting on a measurement or a source; unverified items came from general knowledge.</p></div></div>
    <div class="toolbar"><div class="chips">${sevs.map((s) => `<span class="chip ${F.sev === s ? "on" : ""}" data-sev="${s}">${s === "all" ? "All" : s} <span class="n">${s === "all" ? st.findings.length : st.counts[s]}</span></span>`).join("")}</div><div class="grow"></div>
      <div class="search"><span>${ic("search", 14)}</span><input class="input" id="fq" placeholder="Search findings" value="${esc(F.q)}"></div></div>
    <div class="card"><div class="list" id="flist"></div></div></div>`;
  const draw = () => {
    const q = F.q.toLowerCase();
    const rows = st.findings.filter((f) => (F.sev === "all" || f.severity === F.sev) && `${f.subject} ${f.message}`.toLowerCase().includes(q));
    $("#flist").innerHTML = rows.map(findingRow).join("") || '<div class="empty">Nothing matches.</div>';
  };
  $$("[data-sev]", main).forEach((c) => (c.onclick = () => { F.sev = c.dataset.sev; RENDER.findings(main); }));
  $("#fq").oninput = (e) => { F.q = e.target.value; draw(); };
  draw();
};

// ---------- diagrams
RENDER.diagrams = (main) => {
  const st = S.st;
  if (!S.sel.diagram) S.sel.diagram = st.circuits[0]?.id;
  main.innerHTML = `<div class="view"><div class="page-head"><div><div class="eyebrow">Harness diagrams</div><h1>Per-circuit harness drawings</h1>
    <p>Drawn by WireViz from upfit.yaml when you build outputs. ${Object.keys(st.harness).length} of ${st.circuits.length} circuits have a drawing.</p></div>
    <div class="actions"><button class="btn primary" id="buildDiag">${ic("bolt")} Build outputs</button></div></div>
    <div class="split"><div class="card pad-0 listpane"><div style="padding:8px">${st.circuits.map((c) => `<div class="circ-item ${c.id === S.sel.diagram ? "sel" : ""}" data-did="${c.id}"><div class="top"><span class="id">${c.id}</span><span class="nm ellipsis">${esc(c.name)}</span>${st.harness[c.id] ? "" : '<span class="pill muted">none</span>'}</div></div>`).join("")}</div></div>
    <div class="card"><div class="card-head"><h3 id="dTitle"></h3><span class="right" style="display:flex;gap:8px;align-items:center"><span class="muted" style="font-size:12px">Zoom</span><input type="range" id="dz" min="40" max="250" value="100"></span></div><div class="diagram" id="dview"><div class="empty">Loading…</div></div></div></div></div>`;
  $$("[data-did]", main).forEach((el) => (el.onclick = () => { S.sel.diagram = el.dataset.did; RENDER.diagrams(main); }));
  $("#buildDiag").onclick = buildOutputs;
  const c = st.circuits.find((x) => x.id === S.sel.diagram);
  $("#dTitle").textContent = c ? `${c.id} ${c.name}` : "";
  api("harness_svg", S.sel.diagram).then((r) => {
    $("#dview").innerHTML = r.ok ? r.svg : `<div class="empty" style="color:#475569">${esc(r.error)}</div>`;
    const svg = $("#dview svg");
    $("#dz").oninput = (e) => { if (svg) svg.style.transform = `scale(${e.target.value / 100})`; };
  });
};
async function buildOutputs() {
  toast("Building install sheet, BOM, findings and diagrams…", "info");
  const r = await api("build_outputs", true);
  if (!r.ok) return toast(r.error, "bad");
  const rr = await api("reload"); if (rr.ok) setState(rr.state);
  refresh();
  const problem = (r.harness || []).find((l) => /not found|failed/i.test(l));
  if (problem) return toast(`Built in ${r.folder}, but no diagrams were drawn: ${problem}`, "bad", 12000);
  toast(`Built in ${r.folder}. BOM known total ${money(r.bom_total)}.`);
}

// ---------- bench
RENDER.bench = async (main) => {
  if (!S.bench) {
    const r = await api("bench_plan");
    S.bench = { plan: r.steps, i: -1, results: {}, supply: "" };
  }
  const B = S.bench;
  if (B.i < 0) {
    main.innerHTML = `<div class="view"><div class="page-head"><div><div class="eyebrow">Bench test</div><h1>Step through every circuit on the bench</h1>
      <p>Type the clamp-meter reading and tick each check. The app compares the reading with the draw in upfit.yaml (±20%) and saves a dated report. It never switches anything itself.</p></div></div>
      <div class="grid g-main"><div class="card"><div class="card-head"><h3>Before you start</h3></div>
        <div class="grid" style="gap:8px">
          <div class="alert bad">${ic("alert", 18)}<div><b>Bench only through the CanTrol</b><span class="dim">Never put 12 V straight on an E68Xtreme module wire or any LED-output device. Fuse the bench supply output.</span></div></div>
          <div class="alert amber">${ic("alert", 18)}<div><b>Hearing protection for the siren speakers</b><span class="dim">And keep the speakers pointed away from you.</span></div></div>
          <div class="alert info">${ic("info", 18)}<div><b>Passing on the bench is not an install check</b><span class="dim">It doesn't confirm in-truck wiring, grounds or fuse sizing.</span></div></div></div>
        <div class="field" style="margin-top:16px"><label>Supply voltage at the bench (V)</label><input class="input big-input" id="supply" value="${esc(B.supply)}" placeholder="13.8"></div>
        <div style="margin-top:14px"><button class="btn primary" id="bstart">Start with ${esc(B.plan[0]?.circuit_id)}</button></div></div>
        <div class="card"><div class="card-head"><h3>Plan</h3><span class="sub">${B.plan.length} circuits</span></div><div class="list">${B.plan.map((s) => `<div class="list-row"><span class="subj">${s.circuit_id}</span><span class="t">${esc(s.name)}<div class="muted" style="font-size:12px">${s.expected_a === null ? "No draw on file: the reading becomes a baseline" : `Expect ${s.min_a}–${s.max_a} A`}</div></span>${B.results[s.circuit_id] ? `<span class="pill ${B.results[s.circuit_id].status}">${B.results[s.circuit_id].status}</span>` : ""}</div>`).join("")}</div></div></div></div>`;
    $("#bstart").onclick = () => { B.supply = $("#supply").value; B.i = 0; RENDER.bench(main); };
    return;
  }
  if (B.i >= B.plan.length) {
    const res = B.plan.map((s) => B.results[s.circuit_id]).filter(Boolean);
    const pass = res.filter((r) => ["PASS", "BASELINE", "N/A"].includes(r.status) && Object.values(r.checks).every(Boolean)).length;
    main.innerHTML = `<div class="view"><div class="page-head"><div><div class="eyebrow">Bench test</div><h1>${pass} of ${res.length} circuits passed</h1><p>Save the report to keep it with your files.</p></div>
      <div class="actions"><button class="btn" id="brestart">Start over</button><button class="btn primary" id="bsave">Save report</button></div></div>
      <div class="card pad-0"><table class="data"><thead><tr><th>Circuit</th><th>Current</th><th class="num">Measured</th><th>Checks</th><th>Notes</th></tr></thead><tbody>
      ${B.plan.map((s) => { const r = B.results[s.circuit_id]; return `<tr><td><span class="mono" style="color:var(--accent)">${s.circuit_id}</span> ${esc(s.name)}</td><td><span class="pill ${r ? r.status : "muted"}">${r ? r.status : "not run"}</span></td><td class="num">${r && r.measured_a !== "" ? esc(r.measured_a) + " A" : "-"}</td><td>${r ? Object.values(r.checks).filter(Boolean).length + " / " + Object.keys(r.checks).length : "-"}</td><td class="dim">${esc(r?.notes || "")}</td></tr>`; }).join("")}</tbody></table></div></div>`;
    $("#brestart").onclick = () => { S.bench = null; RENDER.bench(main); };
    $("#bsave").onclick = async () => {
      const r = await api("save_bench", B.supply, B.plan.filter((s) => B.results[s.circuit_id]).map((s) => ({ circuit_id: s.circuit_id, ...B.results[s.circuit_id] })));
      if (!r.ok) return toast(r.error, "bad");
      toast(`Report saved: ${r.path}`);
    };
    return;
  }
  const s = B.plan[B.i], prev = B.results[s.circuit_id] || { measured_a: "", checks: {}, notes: "", status: "" };
  main.innerHTML = `<div class="view"><div class="page-head"><div><div class="eyebrow">Bench test · ${B.i + 1} of ${B.plan.length}</div><h1>${s.circuit_id} ${esc(s.name)}</h1>
    <p>${s.circuit_type === "speaker" ? "Speaker circuit: no current reading, just the tone check." : s.expected_a === null ? "No draw on file yet. Your reading is saved as a baseline; add it to upfit.yaml once you trust it." : `Expected ${s.expected_a} A, pass between ${s.min_a} and ${s.max_a} A.`}</p></div></div>
    <div class="steps-dots" style="margin-bottom:16px">${B.plan.map((x, k) => { const r = B.results[x.circuit_id]; return `<i class="${k === B.i ? "cur" : r ? (r.status === "FAIL" ? "fail" : "done") : ""}"></i>`; }).join("")}</div>
    <div class="grid g-main"><div class="card wizard-step">
      ${s.circuit_type !== "speaker" ? `<div class="field"><label>Measured current (A)</label><div style="display:flex;gap:12px;align-items:center"><input class="input big-input" id="meas" value="${esc(prev.measured_a)}" placeholder="blank = not measured" style="max-width:260px"><span id="mstat"></span></div><div class="ferr" id="merr"></div></div>` : ""}
      <div class="grid" style="gap:8px">${s.checks.map((c, k) => `<label class="check"><input type="checkbox" data-ck="${k}" ${prev.checks[c] ? "checked" : ""}><span>${esc(c)}</span></label>`).join("")}</div>
      <div class="field"><label>Notes</label><textarea class="input" id="bnotes" rows="2">${esc(prev.notes)}</textarea></div>
      <div style="display:flex;gap:8px"><button class="btn" id="bback" ${B.i === 0 ? "disabled" : ""}>Back</button><button class="btn ghost" id="bskip">Skip</button><span style="flex:1"></span><button class="btn primary" id="bnext">${B.i === B.plan.length - 1 ? "Finish" : "Next circuit"}</button></div></div>
      <div class="card">${kvCircuit(S.st.circuits.find((c) => c.id === s.circuit_id))}</div></div></div>`;
  const meas = $("#meas");
  const check = async () => {
    if (!meas) return "N/A";
    const r = await api("bench_check", s.circuit_id, meas.value.trim());
    $("#merr").textContent = r.ok ? "" : r.error;
    if (r.ok) $("#mstat").innerHTML = `<span class="pill ${r.status}">${r.status}</span>`;
    return r.ok ? r.status : null;
  };
  if (meas) { meas.oninput = debounce(check, 150); check(); meas.focus(); }
  const record = async (skip) => {
    const status = skip ? (s.circuit_type === "speaker" ? "N/A" : "SKIPPED") : await check();
    if (status === null) return false;
    B.results[s.circuit_id] = {
      measured_a: skip || !meas ? "" : meas.value.trim(), status,
      checks: Object.fromEntries(s.checks.map((c, k) => [c, !skip && $(`[data-ck="${k}"]`).checked])), notes: skip ? "Skipped at the bench" : $("#bnotes").value,
    };
    return true;
  };
  $("#bnext").onclick = async () => { if (await record(false)) { B.i++; RENDER.bench(main); } };
  $("#bskip").onclick = async () => { await record(true); B.i++; RENDER.bench(main); };
  $("#bback").onclick = () => { B.i--; RENDER.bench(main); };
};

// ---------- tracker
RENDER.tracker = (main) => {
  const st = S.st;
  main.innerHTML = `<div class="view"><div class="page-head"><div><div class="eyebrow">Install tracker</div><h1>Where each circuit stands</h1>
    <p>Drag a card to move it. Progress is saved to install_progress.yaml next to upfit.yaml; it never changes upfit.yaml.</p></div></div>
    <div class="kanban">${st.stages.map((sg) => {
      const cards = st.circuits.filter((c) => st.progress[c.id].stage === sg.id);
      return `<div class="kcol" data-stage="${sg.id}"><div class="kcol-h"><span class="pill ${sg.id === "installed" ? "installed-stage" : sg.id}">${esc(sg.label)}</span><span class="n">${cards.length}</span></div>
        ${cards.map((c) => `<div class="kcard" draggable="true" data-kc="${c.id}"><div style="display:flex;gap:6px;align-items:center"><span class="id">${c.id}</span><span class="muted" style="margin-left:auto;font-size:11px">${esc(st.progress[c.id].updated)}</span></div>
          <div style="font-weight:500;font-size:13px">${esc(c.name)}</div>${st.progress[c.id].note ? `<div class="note">${esc(st.progress[c.id].note)}</div>` : ""}
          <div class="meter ${c.completeness >= 80 ? "good" : "amber"}" style="height:4px"><i style="width:${c.completeness}%"></i></div></div>`).join("")}</div>`;
    }).join("")}</div></div>`;
  $$(".kcard", main).forEach((k) => {
    k.ondragstart = (e) => e.dataTransfer.setData("text/plain", k.dataset.kc);
    k.ondblclick = () => editProgress(k.dataset.kc);
    k.onclick = () => editProgress(k.dataset.kc);
  });
  $$(".kcol", main).forEach((col) => {
    col.ondragover = (e) => { e.preventDefault(); col.classList.add("over"); };
    col.ondragleave = () => col.classList.remove("over");
    col.ondrop = async (e) => { e.preventDefault(); col.classList.remove("over"); await moveProgress(e.dataTransfer.getData("text/plain"), col.dataset.stage); };
  });
};
async function moveProgress(cid, stage, note) {
  const r = await api("set_progress", cid, stage, note ?? null);
  if (!r.ok) return toast(r.error, "bad");
  S.st.progress = r.progress; RENDER.tracker($("#main")); renderChrome();
}
function editProgress(cid) {
  const st = S.st, p = st.progress[cid], c = st.circuits.find((x) => x.id === cid);
  const d = drawer(esc(c.name), `${cid} · install progress`,
    `<div class="field"><label>Stage</label><select class="input" name="stage">${st.stages.map((s) => `<option value="${s.id}" ${p.stage === s.id ? "selected" : ""}>${esc(s.label)}</option>`).join("")}</select></div>
     <div class="field"><label>Note</label><textarea class="input" name="note" rows="3">${esc(p.note)}</textarea></div>`,
    `<button class="btn primary" id="drawerSave">Save</button><button class="btn ghost" data-close>Cancel</button><span style="margin-left:auto"></span><button class="btn" data-action="circuit" data-id="${cid}">Open circuit</button>`);
  $("#drawerSave").onclick = async () => { const stg = $('[name="stage"]', d).value, note = $('[name="note"]', d).value; closeLayer(); await moveProgress(cid, stg, note); toast("Progress saved"); };
}

// ---------- calculator
RENDER.calc = (main) => {
  const C = (S.calc = S.calc || { current: "", length: "", ground: "", critical: true });
  main.innerHTML = `<div class="view"><div class="page-head"><div><div class="eyebrow">Wire & fuse calculator</div><h1>Size a run before you buy wire</h1>
    <p>Uses the same numbers as the validator: copper resistance per gauge, ${S.st.system.fuse_headroom}× fuse headroom, ${S.st.system.critical_drop_pct}% drop limit for warning-light circuits and ${S.st.system.noncritical_drop_pct}% for convenience loads.</p></div></div>
    <div class="grid g-main"><div class="card"><div class="form-grid">
      <div class="field"><label>Current draw (A)</label><input class="input big-input" id="kc" value="${esc(C.current)}" placeholder="2.0"></div>
      <div class="field"><label>Feed run (ft)</label><input class="input big-input" id="kl" value="${esc(C.length)}" placeholder="12"></div>
      <div class="field"><label>Ground run (ft)</label><input class="input big-input" id="kg" value="${esc(C.ground)}" placeholder="same as feed"></div>
      <div class="field"><label>Circuit kind</label><div class="seg"><button data-crit="1" class="${C.critical ? "on" : ""}">Warning / critical</button><button data-crit="0" class="${C.critical ? "" : "on"}">Convenience</button></div></div></div>
      <div id="kout" style="margin-top:18px"></div></div>
      <div class="card"><div class="card-head"><h3>About these numbers</h3></div><div class="dim" style="display:grid;gap:10px">
        <div>Wire ampacity values in wire_reference.yaml are conservative planning numbers from general knowledge, not from a standard. Replace them with your wire maker's rating before you rely on them.</div>
        <div>Voltage drop counts the feed and the ground return. Bundled wire and under-hood heat lower the real rating.</div>
        <div>CanTrol outputs are already limited: J1 outputs 10 A fused, LED outputs 2.5 A (guide 14580G p.3).</div></div></div></div></div>`;
  const run = debounce(async () => {
    C.current = $("#kc").value; C.length = $("#kl").value; C.ground = $("#kg").value;
    if (!C.current || !C.length) { $("#kout").innerHTML = '<div class="muted">Enter a current and a run length.</div>'; return; }
    const r = await api("calculate", C.current, C.length, null, C.ground || null, C.critical);
    if (!r.ok) { $("#kout").innerHTML = `<div class="alert bad">${ic("alert", 18)}<div>${esc(r.error)}</div></div>`; return; }
    $("#kout").innerHTML = `<div class="grid g-3" style="margin-bottom:14px">${kpi("Fuse", r.fuse_a ? r.fuse_a + " A" : "None fits", `Load × ${r.headroom} = ${r.min_fuse_a} A`, null)}${kpi("Thinnest wire", r.recommended_awg ? r.recommended_awg + " AWG" : "None fits", `Carries the fuse, drop under ${r.limit_pct}%`, null)}${kpi("Drop limit", r.limit_pct + "%", C.critical ? "Warning-light circuit" : "Convenience load", null)}</div>
      <table class="data"><thead><tr><th>AWG</th><th class="num">Drop</th><th>Drop vs limit</th><th class="num">Carries</th><th>Verdict</th></tr></thead><tbody>
      ${r.rows.map((x) => `<tr ${x.awg === r.recommended_awg ? 'class="sel"' : ""}><td class="mono"><b>${x.awg}</b></td><td class="num">${x.drop_v.toFixed(3)} V · ${x.drop_pct.toFixed(2)}%</td><td style="width:34%"><div class="meter ${x.ok_drop ? "good" : "bad"}"><i style="width:${Math.min(100, (100 * x.drop_pct) / (r.limit_pct * 2))}%"></i></div></td><td class="num">${x.ampacity_a} A</td>
        <td>${x.ok_drop && x.ok_fuse ? `<span class="pill good">Works${x.awg === r.recommended_awg ? " · thinnest" : ""}</span>` : !x.ok_fuse ? '<span class="pill bad">Smaller than fuse</span>' : '<span class="pill bad">Too much drop</span>'}</td></tr>`).join("")}</tbody></table>`;
  }, 120);
  $$("#kc,#kl,#kg", main).forEach((i) => (i.oninput = run));
  $$("[data-crit]", main).forEach((b) => (b.onclick = () => { C.critical = b.dataset.crit === "1"; $$("[data-crit]", main).forEach((x) => x.classList.toggle("on", x === b)); run(); }));
  run();
};

// ---------- history
RENDER.history = (main) => {
  const st = S.st;
  main.innerHTML = `<div class="view"><div class="page-head"><div><div class="eyebrow">Change history</div><h1>Every save, with a way back</h1>
    <p>Each save writes a timestamped backup of upfit.yaml first. Compare any backup with the file as it is now, or restore it (the current file is backed up again before a restore).</p></div></div>
    <div class="grid g-main"><div class="card pad-0"><table class="data"><thead><tr><th>Backup</th><th>Saved</th><th class="num">Size</th><th></th></tr></thead><tbody>
      ${st.backups.map((b) => `<tr><td class="mono">${esc(b.name)}</td><td>${esc(b.when)}</td><td class="num">${(b.bytes / 1024).toFixed(1)} KB</td><td style="white-space:nowrap;text-align:right"><button class="btn sm" data-cmp="${esc(b.name)}">Compare</button> <button class="btn sm danger" data-rst="${esc(b.name)}">Restore</button></td></tr>`).join("") || `<tr><td colspan="4"><div class="empty">No backups yet. They appear after your first save.</div></td></tr>`}</tbody></table></div>
    <div class="card"><div class="card-head"><h3>What changed since that backup</h3></div><div id="cmpOut" class="muted">Pick Compare on a backup.</div></div></div></div>`;
  $$("[data-cmp]", main).forEach((b) => (b.onclick = async () => {
    const r = await api("compare_backup", b.dataset.cmp);
    if (!r.ok) return toast(r.error, "bad");
    $("#cmpOut").innerHTML = r.lines.length ? `<div class="list">${r.lines.map((l) => `<div class="list-row"><span class="pill ${l.startsWith("ADDED") ? "good" : l.startsWith("REMOVED") ? "bad" : l.includes("re-run") ? "amber" : "info"}">${esc(l.split(" ")[0])}</span><span class="t mono" style="font-size:12px">${esc(l.slice(l.indexOf(" ") + 1))}</span></div>`).join("")}</div>` : '<div class="muted">No differences in parts, circuits, vehicle or system.</div>';
  }));
  $$("[data-rst]", main).forEach((b) => (b.onclick = async () => {
    if (!(await confirmBox("Restore this backup?", `upfit.yaml will be replaced with <span class="mono">${esc(b.dataset.rst)}</span>. The current file is backed up first, so you can undo this.`, "Restore", "Cancel", true))) return;
    const r = await api("restore_backup", b.dataset.rst);
    if (!r.ok) return toast(r.error, "bad");
    setState(r.state); refresh(); runSim(); toast(`Restored. Previous file kept as ${r.backup}`);
  }));
};

// ---------- reports
RENDER.reports = async (main) => {
  main.innerHTML = `<div class="view"><div class="page-head"><div><div class="eyebrow">Reports & exports</div><h1>Install sheet and build outputs</h1>
    <p>Build outputs writes install_sheet.txt, findings.txt, bom.csv and the harness drawings to the outputs folder beside your config. Files are written only when you press the button.</p></div>
    <div class="actions"><button class="btn" id="copySheet">${ic("copy")} Copy install sheet</button><button class="btn" id="openOut">${ic("folder")} Open outputs folder</button><button class="btn primary" id="buildOut">${ic("bolt")} Build outputs</button></div></div>
    <div class="card" style="margin-bottom:14px"><div class="card-head"><h3>Installer / EVT quote packet</h3><span class="sub">For shops and emergency vehicle technicians</span></div>
      <p class="dim" style="margin:0 0 10px">One ZIP to email to a shop: Installer_Packet.html (print it or save as PDF), plus parts, circuits, wires, labor scope and the Whelen Command programming sheet as CSV files. Prices and anything listed under packet.redact in upfit.yaml are left out unless you tick the box. The app only writes the files; you send them.</p>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><label class="dim"><input type="checkbox" id="pkPrices"> Include prices</label>
        <button class="btn primary" id="pkBuild">${ic("bolt")} Build installer packet</button><span id="pkOut" class="dim"></span></div></div>
    <pre class="sheet" id="sheet">Loading…</pre></div>`;
  const r = await api("install_sheet_text");
  $("#sheet").textContent = r.text;
  $("#buildOut").onclick = buildOutputs;
  $("#pkBuild").onclick = async () => {
    const x = await api("installer_packet", $("#pkPrices").checked);
    if (!x.ok) return toast(x.error, "bad");
    $("#pkOut").innerHTML = `Saved <span class="mono">${esc(x.zip)}</span> <button class="btn" id="pkOpen">Open packet</button>`;
    $("#pkOpen").onclick = async () => { const y = await api("open_path", x.html); if (!y.ok) toast(y.error, "bad"); };
    toast("Installer packet built", "good");
  };
  $("#openOut").onclick = async () => { const x = await api("open_folder", "outputs"); x.ok ? toast("Opened " + x.folder, "info") : toast(x.error, "bad"); };
  $("#copySheet").onclick = async () => {
    try { await navigator.clipboard.writeText(r.text); toast("Install sheet copied. Paste into Google Docs."); }
    catch { const rg = document.createRange(); rg.selectNodeContents($("#sheet")); const s = getSelection(); s.removeAllRanges(); s.addRange(rg); document.execCommand("copy"); toast("Install sheet copied."); }
  };
};

// ---------- about
RENDER.about = (main) => {
  const st = S.st;
  main.innerHTML = `<div class="view"><div class="page-head"><div><div class="eyebrow">About & safety</div><h1>How this tool stays safe</h1></div></div>
    <div class="grid g-2">
      <div class="card"><div class="card-head"><h3>Rules it follows</h3></div><div class="list">
        ${[["The CanTrol stays the only controller", "This app never sits in the warning-light or siren path. The simulator shows the plan; it doesn't drive anything."],
          ["Read-only toward the truck", "No writes to the BCM, the Ford CAN bus or the CanTrol. No USB, serial or CAN access at all."],
          ["Private and offline", "No network, no telemetry, no accounts. The page can't load anything from the internet."],
          ["Your file, your call", "upfit.yaml changes only when you press Save or Restore, and a timestamped backup is written first."],
          ["Blanks stay blank", "Every unconfirmed value shows as TBD and becomes an open item. Nothing is guessed."]].map(([t, b]) => `<div class="list-row">${ic("check")}<span class="t"><b>${t}</b><div class="dim">${b}</div></span></div>`).join("")}</div></div>
      <div class="card"><div class="card-head"><h3>This copy</h3></div><dl class="kv"><dt>Version</dt><dd>upfit-kit ${esc(st.version)}</dd><dt>Config</dt><dd class="mono" style="word-break:break-all">${esc(st.config_path)}</dd>
        <dt>Install progress</dt><dd>install_progress.yaml next to the config</dd><dt>Outputs</dt><dd>outputs folder beside the config folder</dd><dt>Control plan</dt><dd>${esc(st.controls.source || "none in upfit.yaml")}</dd></dl>
        <div style="margin-top:14px;display:flex;gap:8px"><button class="btn" id="openCfg">${ic("folder")} Open config folder</button>${window.pywebview ? `<button class="btn" id="pickCfg">Open another config…</button>` : ""}</div>
        <h2 class="section">Keyboard</h2><dl class="kv"><dt class="mono">Ctrl K</dt><dd>Search and jump anywhere</dd><dt class="mono">Ctrl S</dt><dd>Save the open circuit or drawer</dd><dt class="mono">F5</dt><dd>Reload upfit.yaml</dd><dt class="mono">0 1 2 3 · B</dt><dd>Slide position and brake (map and head)</dd><dt class="mono">Esc</dt><dd>Close a drawer</dd></dl></div></div></div>`;
  $("#openCfg").onclick = async () => { const x = await api("open_folder", "config"); x.ok ? toast("Opened " + x.folder, "info") : toast(x.error, "bad"); };
  const pick = $("#pickCfg");
  if (pick) pick.onclick = async () => { const r = await api("choose_config"); if (r.ok) { setState(r.state); refresh(); runSim(); toast("Opened " + r.state.config_path, "info"); } else if (r.error) toast(r.error, "bad"); };
};

// ------------------------------------------------------------------ command palette
function openPalette() {
  const st = S.st;
  const items = [
    ...Object.entries(VIEW_NAMES).map(([id, v]) => ({ t: v.label, k: "Go to", run: () => go(id) })),
    ...st.circuits.map((c) => ({ t: `${c.id} ${c.name}`, k: "Circuit", run: () => go("circuits", { circuit: c.id }) })),
    ...st.parts.map((p) => ({ t: p.name, k: "Part", run: () => openPartDrawer(p.id) })),
    ...st.outputs.filter((o) => o.state !== "free").map((o) => ({ t: `${o.id} ${o.label}`, k: "Output", run: () => openOutputDrawer(o.id) })),
    ...(st.controls.buttons || []).map((b) => ({ t: `Press ${b.name}`, k: "Simulator", run: () => { go("head"); toggleButton(b.name, true); } })),
    ...["1", "2", "3"].map((s) => ({ t: `Slide position ${s}`, k: "Simulator", run: () => { go("head"); setSlide(s); } })),
    { t: "Build outputs", k: "Action", run: buildOutputs }, { t: "Reload upfit.yaml", k: "Action", run: reload },
    { t: "Toggle light or dark", k: "Action", run: () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark") },
    { t: "Add a part", k: "Action", run: () => { go("parts"); openPartDrawer(null); } },
  ];
  $("#layer").innerHTML = `<div class="scrim" data-close></div><div class="palette"><input id="pin" placeholder="Search circuits, parts, outputs, actions…" autocomplete="off"><div class="results" id="pres"></div></div>`;
  $("[data-close]", $("#layer")).onclick = closeLayer;
  let sel = 0, shown = [];
  const draw = () => {
    const q = $("#pin").value.toLowerCase().split(/\s+/).filter(Boolean);
    shown = items.filter((x) => q.every((w) => `${x.t} ${x.k}`.toLowerCase().includes(w))).slice(0, 60);
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    $("#pres").innerHTML = shown.map((x, i) => `<div class="res ${i === sel ? "on" : ""}" data-i="${i}"><span>${esc(x.t)}</span><span class="k">${esc(x.k)}</span></div>`).join("") || '<div class="empty">No matches</div>';
    $$(".res", $("#pres")).forEach((r) => (r.onclick = () => pick(+r.dataset.i)));
    $(".res.on", $("#pres"))?.scrollIntoView({ block: "nearest" });
  };
  const pick = (i) => { const x = shown[i]; closeLayer(); if (x) x.run(); };
  $("#pin").oninput = () => { sel = 0; draw(); };
  $("#pin").onkeydown = (e) => {
    if (e.key === "ArrowDown") { sel = Math.min(sel + 1, shown.length - 1); draw(); e.preventDefault(); }
    if (e.key === "ArrowUp") { sel = Math.max(sel - 1, 0); draw(); e.preventDefault(); }
    if (e.key === "Enter") pick(sel);
  };
  draw(); $("#pin").focus();
}

// ------------------------------------------------------------------ sandboxes
async function switchScenario(name) {
  if (S.dirty && !(await confirmBox("Discard changes?", "The open circuit has unsaved changes.", "Discard", "Stay"))) return;
  S.dirty = false;
  const r = await api("open_scenario", name);
  if (!r.ok) return toast(r.error, "bad");
  setState(r.state); S.map.vb = null; refresh(); runSim();
  toast(name ? `Working in sandbox ${r.state.workspace.name}. upfit.yaml is untouched.` : "Back on the live upfit.yaml", "info");
}
RENDER.sandbox = (main) => {
  const st = S.st, ws = st.workspace;
  main.innerHTML = `<div class="view"><div class="page-head"><div><div class="eyebrow">Sandboxes</div><h1>Try a configuration without touching upfit.yaml</h1>
    <p>A sandbox is a full copy of your config. Edit circuits, wires, parts and the control plan, mock up products, and run the test lab on it. Compare it with the live file, then promote it when you're sure, or throw it away.</p></div>
    <div class="actions">${ws.mode === "sandbox" ? `<button class="btn" data-action="exit-sandbox">Back to live</button>` : ""}</div></div>
    <div class="grid g-main"><div class="grid" style="align-content:start">
      <div class="card"><div class="card-head"><h3>New sandbox</h3></div><div class="form-grid">
        <div class="field"><label>Name</label><input class="input" name="name" id="sbName" placeholder="e.g. Rockers on J1-7"><div class="ferr" data-for="name"></div></div>
        <div class="field"><label>Start from</label><select class="input" id="sbBase"><option value="">Live upfit.yaml</option>${st.scenarios.map((x) => `<option>${esc(x.name)}</option>`).join("")}</select></div></div>
        <div style="margin-top:12px"><button class="btn primary" id="sbCreate">${ic("plus")} Create and open</button></div></div>
      <div class="card pad-0"><table class="data"><thead><tr><th>Sandbox</th><th>Changed</th><th></th></tr></thead><tbody>
        <tr class="${ws.mode === "live" ? "sel" : ""}"><td><b>Live upfit.yaml</b><div class="muted mono" style="font-size:11.5px">${esc(ws.live_path)}</div></td><td></td><td style="text-align:right">${ws.mode === "live" ? '<span class="pill good">open</span>' : '<button class="btn sm" data-action="exit-sandbox">Open</button>'}</td></tr>
        ${st.scenarios.map((x) => `<tr class="${x.active ? "sel" : ""}"><td><b>${esc(x.name)}</b></td><td class="dim">${esc(x.modified)}</td><td style="white-space:nowrap;text-align:right">
          ${x.active ? '<span class="pill amber">open</span>' : `<button class="btn sm" data-open="${esc(x.name)}">Open</button>`} <button class="btn sm" data-cmp="${esc(x.name)}">Compare</button> <button class="btn sm primary" data-promote="${esc(x.name)}">Promote</button> <button class="btn sm danger" data-del="${esc(x.name)}">Delete</button></td></tr>`).join("")}
        </tbody></table></div></div>
      <div class="card"><div class="card-head"><h3>Differences from live</h3></div><div id="sbDiff" class="muted">Pick Compare on a sandbox.</div></div></div></div>`;
  $("#sbCreate").onclick = async () => {
    const r = await api("create_scenario", $("#sbName").value, $("#sbBase").value || null);
    fieldErrors(main, r);
    if (!r.ok) return r.field ? null : toast(r.error, "bad");
    setState(r.state); S.map.vb = null; refresh(); runSim(); toast(`Sandbox ${r.state.workspace.name} open. upfit.yaml is untouched.`, "info");
  };
  $$("[data-open]", main).forEach((b) => (b.onclick = () => switchScenario(b.dataset.open)));
  $$("[data-cmp]", main).forEach((b) => (b.onclick = async () => {
    const r = await api("compare_scenario", b.dataset.cmp);
    if (!r.ok) return toast(r.error, "bad");
    $("#sbDiff").innerHTML = diffList(r.lines);
  }));
  $$("[data-promote]", main).forEach((b) => (b.onclick = async () => {
    const d = await api("compare_scenario", b.dataset.promote);
    if (!(await confirmBox(`Make ${b.dataset.promote} your live upfit.yaml?`, `${d.lines ? d.lines.length : "?"} change(s). The live file is backed up first, so you can restore it from Change history.`, "Promote", "Cancel", true))) return;
    const r = await api("promote_scenario", b.dataset.promote);
    if (!r.ok) return toast(r.error, "bad");
    setState(r.state); refresh(); runSim(); toast(`Promoted. Old live file kept as ${r.backup}`);
  }));
  $$("[data-del]", main).forEach((b) => (b.onclick = async () => {
    if (!(await confirmBox(`Delete sandbox ${b.dataset.del}?`, "This removes the sandbox file. Your live upfit.yaml isn't affected.", "Delete", "Cancel", true))) return;
    const r = await api("delete_scenario", b.dataset.del);
    if (!r.ok) return toast(r.error, "bad");
    setState(r.state); refresh(); runSim();
  }));
};
function diffList(lines) {
  if (!lines.length) return '<div class="muted">No differences in parts, circuits, the control plan, vehicle or system.</div>';
  return `<div class="list">${lines.map((l) => `<div class="list-row"><span class="pill ${l.startsWith("ADDED") ? "good" : l.startsWith("REMOVED") ? "bad" : l.includes("re-run") ? "amber" : "info"}">${esc(l.split(" ")[0])}</span><span class="t mono" style="font-size:12px">${esc(l.slice(l.indexOf(" ") + 1))}</span></div>`).join("")}</div>`;
}

// ------------------------------------------------------------------ control plan editor
function outPicker(selected) {
  const st = S.st, used = new Set(st.outputs.filter((o) => o.state !== "free").map((o) => o.id));
  const cell = (id) => `<button type="button" class="${selected.has(id) ? "on" : ""} ${used.has(id) ? "used" : ""}" data-pick="${id}" title="${esc((st.outputs.find((o) => o.id === id) || {}).circuits?.join(", ") || "free")}">${id.split("-")[1]}</button>`;
  return `<div class="outpick"><div class="bank">J1 · 10 A</div>${[...Array(8)].map((_, i) => cell(`J1-${i + 1}`)).join("")}<div class="bank">LED · 2.5 A</div>${[...Array(32)].map((_, i) => cell(`LED-${i + 1}`)).join("")}</div>`;
}
function bindPicker(root, selected, onChange) {
  $$("[data-pick]", root).forEach((b) => (b.onclick = () => { const id = b.dataset.pick; selected.has(id) ? selected.delete(id) : selected.add(id); b.classList.toggle("on"); onChange && onChange(); }));
}
function controlTargets() {
  const c = S.st.controls || {};
  return [...Object.keys(c.slide || {}).map((k) => [`slide:${k}`, `Slide ${k} · ${c.slide[k].label || ""}`, c.slide[k].outputs || []]),
    ...(c.buttons || []).map((b) => [`button:${b.name}`, b.name, b.outputs || []]),
    ...(c.brake_pop ? [["brake", "Brake pop", c.brake_pop.outputs || []]] : [])];
}
function openPlanEditor(target) {
  const targets = controlTargets();
  if (!targets.length) return toast("upfit.yaml has no control plan to edit", "bad");
  let cur = target || targets[0][0];
  const render = () => {
    const t = targets.find((x) => x[0] === cur), sel = new Set(t[2]);
    const entry = cur === "brake" ? (S.st.controls.brake_pop || {}) : cur.startsWith("slide:") ? S.st.controls.slide[cur.slice(6)] : (S.st.controls.buttons || []).find((b) => b.name === cur.slice(7));
    const fl = {}; const raw = (entry || {}).flash || {};
    (Array.isArray(raw) ? { A: raw } : raw) && Object.entries(Array.isArray(raw) ? { A: raw } : raw).forEach(([ph, outs]) => (outs || []).forEach((o) => (fl[o] = ph)));
    const noSteady = new Set(S.st.circuits.filter((c) => (S.st.parts.find((p) => p.id === c.part) || {}).steady_burn === false).flatMap((c) => S.st.map.edges.filter((e) => e.circuit_id === c.id && e.from_cantrol).map((e) => e.source)));
    const modeRows = () => [...sel].sort((a, b) => (a[0] === b[0] ? 0 : a[0] === "J" ? -1 : 1) || +a.split("-")[1] - +b.split("-")[1]).map((o) => `<div class="mode-row"><span class="mono">${o}</span><span class="dim ellipsis">${esc((S.st.outputs.find((x) => x.id === o) || {}).circuits?.map((cid) => (S.st.circuits.find((c) => c.id === cid) || {}).product || cid).join(", ") || "not wired")}</span>
      <div class="seg sm">${[["", "Steady"], ["A", "Flash A"], ["B", "Flash B"]].map(([v, l]) => `<button type="button" data-mode="${o}" data-v="${v}" class="${(fl[o] || "") === v ? "on" : ""}">${l}</button>`).join("")}</div>${noSteady.has(o) && !fl[o] ? '<span class="pill bad">Can\'t burn steady</span>' : ""}</div>`).join("") || '<div class="muted">Pick outputs above.</div>';
    const sandbox = S.st.workspace.mode === "sandbox";
    const d = drawer("Edit the control plan", sandbox ? `Sandbox ${esc(S.st.workspace.name)}` : "Live upfit.yaml",
      `${sandbox ? "" : `<div class="alert amber">${ic("alert", 18)}<div><b>You're editing the live file</b><span class="dim">Try changes in a sandbox first: Sandboxes, then New sandbox. A backup is made either way.</span></div></div>`}
       <div class="field"><label>Control</label><select class="input" id="peT">${targets.map((x) => `<option value="${esc(x[0])}" ${x[0] === cur ? "selected" : ""}>${esc(x[1])}</option>`).join("")}</select></div>
       <div class="field"><label>Outputs it turns on <span class="muted" id="peN">(${sel.size})</span></label>${outPicker(sel)}<div class="hint">Bright numbers are wired in upfit.yaml; dim ones are free. This changes the plan only, not the CanTrol: program the module in Whelen Command to match.</div></div>
       <div class="field"><label>Steady or flashed by the CanTrol</label><div id="peModes">${modeRows()}</div><div class="hint">Steady = Turn On in Command (the device runs its own pattern). Flash A / B = the CanTrol flashes that output; A and B are opposite phases. Products that can't burn steady must be on Flash.</div></div>`,
      `<button class="btn primary" id="drawerSave">Save plan</button><button class="btn ghost" data-close>Cancel</button>`);
    const bindModes = () => $$("[data-mode]", d).forEach((b) => (b.onclick = () => { fl[b.dataset.mode] = b.dataset.v; if (!b.dataset.v) delete fl[b.dataset.mode]; $("#peModes").innerHTML = modeRows(); bindModes(); }));
    bindPicker(d, sel, () => { $("#peN").textContent = `(${sel.size})`; $("#peModes").innerHTML = modeRows(); bindModes(); });
    bindModes();
    $("#peT").onchange = (e) => { cur = e.target.value; render(); };
    $("#drawerSave").onclick = async () => {
      const r0 = await api("set_control", cur, [...sel].sort((a, b) => (a[0] === b[0] ? 0 : a[0] === "J" ? -1 : 1) || +a.split("-")[1] - +b.split("-")[1]));
      if (!r0.ok) return toast(r0.error, "bad");
      const flash = { A: [...sel].filter((o) => fl[o] === "A"), B: [...sel].filter((o) => fl[o] === "B") };
      const r = await api("set_flash", cur, flash);
      if (!r.ok) return toast(r.error, "bad");
      afterSave(r, "Control plan saved");
    };
  };
  render();
}

// ------------------------------------------------------------------ test lab
RENDER.lab = async (main) => {
  main.innerHTML = `<div class="view"><div class="page-head"><div><div class="eyebrow">Test lab</div><h1>Simulated tests of the whole build</h1>
    <p>Runs the control plan through every slide position, each button, the brake and everything at once, then checks the wiring for conflicts, over-limit outputs and gaps. These are simulations on paper: they don't replace the bench.</p></div>
    <div class="actions"><button class="btn primary" id="runLab">${ic("play")} Run all tests</button></div></div><div id="labOut"><div class="empty"><div class="spinner"></div>Running…</div></div></div>`;
  $("#runLab").onclick = () => RENDER.lab(main);
  const r = await api("run_tests");
  if (!r.ok) { $("#labOut").innerHTML = `<div class="alert bad">${esc(r.error)}</div>`; return; }
  const cnt = (st) => r.runs.filter((x) => x.status === st).length;
  const sev = (sv) => r.checks.filter((x) => x.severity === sv).length;
  $("#labOut").innerHTML = `
    <div class="grid g-4" style="margin-bottom:14px">${kpi("Scenarios run", r.runs.length, `${cnt("PASS")} pass · ${cnt("INCOMPLETE")} incomplete · ${cnt("FAIL")} fail`, (100 * (r.runs.length - cnt("FAIL"))) / r.runs.length)}
      ${kpi("Wiring checks", r.checks.length, `${sev("ERROR")} errors · ${sev("WARN")} warnings · ${sev("OPEN")} open`, null)}
      ${kpi("Validator", r.errors + r.warnings, `${r.errors} errors · ${r.warnings} warnings`, null)}
      ${kpi("Suggested fixes", r.fixes.length, "Calculated from data you've confirmed", null)}</div>
    ${cnt("FAIL") || r.errors || sev("ERROR") ? `<div class="alert bad" style="margin-bottom:14px">${ic("alert", 18)}<div><b>Something fails</b><span class="dim">Fix the failures below before you rely on this layout.</span></div></div>` : `<div class="alert ${cnt("INCOMPLETE") ? "amber" : "good"}" style="margin-bottom:14px">${ic(cnt("INCOMPLETE") ? "info" : "check", 18)}<div><b>${cnt("INCOMPLETE") ? "No failures, but the picture is incomplete" : "Every scenario passes"}</b><span class="dim">${cnt("INCOMPLETE") ? "Circuits without a measured draw, or outputs the plan uses that aren't wired yet, keep a scenario from a full pass." : "Run the same layout on the bench next."}</span></div></div>`}
    <div class="grid g-main"><div class="card pad-0"><table class="data"><thead><tr><th>Scenario</th><th>Result</th><th class="num">Known load</th><th class="num">Outputs</th><th>Notes</th><th></th></tr></thead><tbody>
      ${r.runs.map((x, i) => `<tr><td><b>${esc(x.name)}</b></td><td><span class="pill ${x.status === "PASS" ? "good" : x.status === "FAIL" ? "bad" : "amber"}">${x.status}</span></td><td class="num">${x.known_a.toFixed(2)} A</td><td class="num">${x.outputs_on}</td><td class="dim" style="font-size:12.5px">${x.problems.map(esc).join("<br>") || "—"}</td><td><button class="btn sm" data-run="${i}">${ic("play", 12)} Show</button></td></tr>`).join("")}</tbody></table></div>
      <div class="grid" style="align-content:start">
        <div class="card"><div class="card-head"><h3>Suggested fixes</h3><span class="sub">Each asks before it saves</span></div>
          <div class="list">${r.fixes.map((f, i) => `<div class="list-row"><span class="t"><b>${esc(f.label)}</b><div class="muted" style="font-size:12px">${esc(f.reason)}</div></span>${f.value !== null ? `<button class="btn sm primary" data-fix="${i}">Apply</button>` : `<button class="btn sm" data-go="calc">Calculator</button>`}</div>`).join("") || '<div class="muted">No fixes to suggest. A fix appears when a confirmed draw and run show a wire or fuse should change.</div>'}</div></div>
        <div class="card"><div class="card-head"><h3>Wiring checks</h3><span class="sub">${r.checks.length}</span></div>
          <div class="list">${r.checks.map((c) => `<div class="list-row ${/^C\d+$/.test(c.subject) || /^(J1|LED)-/.test(c.subject) ? "click" : ""}" ${/^C\d+$/.test(c.subject) ? `data-action="circuit" data-id="${c.subject}"` : /^(J1|LED)-/.test(c.subject) ? `data-action="output" data-id="${c.subject}"` : ""}><span class="pill ${c.severity}">${c.severity}</span><span class="subj" style="min-width:64px">${esc(c.subject)}</span><span class="t">${esc(c.message)}</span></div>`).join("") || '<div class="muted">No wiring problems found.</div>'}</div></div></div></div>
    <div class="muted" style="margin-top:12px;font-size:12px">Ran ${esc(r.ran_at)} on ${S.st.workspace.mode === "sandbox" ? "sandbox " + esc(S.st.workspace.name) : "the live upfit.yaml"}.</div>`;
  $$("[data-run]", main).forEach((b) => (b.onclick = () => { const x = r.runs[+b.dataset.run]; S.sim = { slide: x.slide, pressed: new Set(x.pressed), brake: x.brake, res: null }; go("head"); runSim(); }));
  $$("[data-fix]", main).forEach((b) => (b.onclick = async () => {
    const f = r.fixes[+b.dataset.fix];
    if (!(await confirmBox(f.label + "?", `${esc(f.reason)}.<br><br>Saves ${esc(f.field)} = ${esc(f.value)} on ${esc(f.circuit_id)}, with a backup first.`, "Apply", "Cancel"))) return;
    const x = await api("apply_fix", f.circuit_id, f.field, f.value);
    if (!x.ok) return toast(x.error, "bad");
    setState(x.state); toast(`${f.circuit_id} updated. Backup: ${x.backup}`); RENDER.lab(main);
  }));
};

// ------------------------------------------------------------------ product mockup
RENDER.mockup = (main) => {
  const st = S.st;
  const M = (S.mock = S.mock || { step: 0, partMode: "new", part: { name: "", manufacturer: "", price_usd: "", qty: "1", status: "considering" }, partId: "", circuit: { name: "", type: "power", current_a: "", fuse_a: "", wire_awg: "" }, outputs: new Set(), wires: [{ color: "Red", function: "Power", connects_to: "" }, { color: "Black", function: "Ground", connects_to: "Chassis ground" }], targets: new Set() });
  const steps = ["Product", "Circuit", "Outputs & wires", "Control plan", "Review"];
  const free = st.outputs.filter((o) => o.state === "free").map((o) => o.id);
  const body = () => {
    if (M.step === 0) return `<div class="seg" style="margin-bottom:14px"><button data-pm="new" class="${M.partMode === "new" ? "on" : ""}">New product</button><button data-pm="existing" class="${M.partMode === "existing" ? "on" : ""}">Product already in parts</button></div>
      ${M.partMode === "existing" ? `<div class="field"><label>Part</label><select class="input" id="mPart">${st.parts.map((p) => `<option value="${esc(p.id)}" ${M.partId === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div>`
        : `<div class="form-grid"><div class="field wide"><label>Full product name</label><input class="input" data-m="part.name" value="${esc(M.part.name)}" placeholder="As the maker names it"></div>
          <div class="field"><label>Manufacturer</label><input class="input" data-m="part.manufacturer" value="${esc(M.part.manufacturer)}"></div>
          <div class="field"><label>Unit price (USD)</label><input class="input" data-m="part.price_usd" value="${esc(M.part.price_usd)}"></div>
          <div class="field"><label>Quantity</label><input class="input" data-m="part.qty" value="${esc(M.part.qty)}"></div>
          <div class="field"><label>Status</label><select class="input" data-m="part.status">${st.part_statuses.map((x) => `<option ${M.part.status === x ? "selected" : ""}>${x}</option>`).join("")}</select></div></div>`}`;
    if (M.step === 1) return `<div class="form-grid"><div class="field wide"><label>Circuit name</label><input class="input" data-m="circuit.name" value="${esc(M.circuit.name || M.part.name)}"></div>
      <div class="field"><label>Type</label><select class="input" data-m="circuit.type">${st.circuit_types.map((x) => `<option ${M.circuit.type === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
      <div class="field"><label>Current draw (A)</label><input class="input" data-m="circuit.current_a" value="${esc(M.circuit.current_a)}" placeholder="From the spec sheet; blank if unknown"></div>
      <div class="field"><label>Wire gauge (AWG)</label><select class="input" data-m="circuit.wire_awg"><option value="">Blank</option>${st.gauges.map((g) => `<option ${M.circuit.wire_awg === g ? "selected" : ""}>${g}</option>`).join("")}</select></div></div>
      <div class="hint" style="margin-top:10px">Leave the draw blank if the maker doesn't publish it. The test lab will flag it as open instead of guessing.</div>`;
    if (M.step === 2) return `<div class="field"><label>CanTrol outputs it uses (${M.outputs.size})</label>${outPicker(M.outputs)}<div class="hint">Free outputs: ${free.length}. J1 outputs carry 10 A, LED outputs 2.5 A. Picking an output that's already used shows up as a conflict in the test lab.</div></div>
      <h2 class="section">Wires</h2><div class="grid" style="gap:8px" id="mWires">${M.wires.map((w, i) => `<div class="wire-row"><input class="input" data-w="${i}.color" value="${esc(w.color)}" placeholder="Color"><input class="input" data-w="${i}.function" value="${esc(w.function)}" placeholder="Function"><input class="input" data-w="${i}.connects_to" value="${esc(w.connects_to)}" placeholder="e.g. LED Output 18"><button class="icon-btn" data-wdel="${i}">${ic("x", 14)}</button></div>`).join("")}</div>
      <div style="margin-top:8px;display:flex;gap:8px"><button class="btn sm" id="mAddWire">${ic("plus", 14)} Wire</button><button class="btn sm" id="mAuto">Connect first wire to the first picked output</button></div>`;
    if (M.step === 3) return `<div class="hint" style="margin-bottom:10px">Which slide positions and buttons should turn this product's outputs on? This edits the plan in the sandbox; nothing is sent to the CanTrol.</div>
      <div class="grid" style="gap:6px">${controlTargets().map(([id, label]) => `<label class="check"><input type="checkbox" data-tg="${esc(id)}" ${M.targets.has(id) ? "checked" : ""}><span>${esc(label)}</span></label>`).join("")}</div>`;
    const draw = parseFloat(M.circuit.current_a);
    const lims = [...M.outputs].map((o) => (o.startsWith("J1") ? 10 : 2.5));
    const over = !isNaN(draw) && lims.length === 1 && draw > lims[0];
    return `<dl class="kv"><dt>Product</dt><dd>${esc(M.partMode === "existing" ? (st.parts.find((p) => p.id === M.partId) || {}).name : M.part.name)}</dd><dt>Circuit</dt><dd>${esc(M.circuit.name || M.part.name)} (${esc(M.circuit.type)}) as ${esc(st.next_circuit_id)}</dd>
      <dt>Draw</dt><dd>${M.circuit.current_a ? esc(M.circuit.current_a) + " A" : '<span class="muted">TBD</span>'}</dd><dt>Outputs</dt><dd>${[...M.outputs].join(", ") || '<span class="muted">none</span>'}</dd>
      <dt>Wires</dt><dd>${M.wires.filter((w) => w.function).map((w) => `${swatch(w.color)}${esc(w.color)} ${esc(w.function)} → ${esc(w.connects_to || "TBD")}`).join("<br>")}</dd><dt>Turned on by</dt><dd>${controlTargets().filter((x) => M.targets.has(x[0])).map((x) => esc(x[1])).join(", ") || '<span class="muted">nothing yet</span>'}</dd></dl>
      ${over ? `<div class="alert bad" style="margin-top:12px">${ic("alert", 18)}<div><b>${draw} A is over the ${lims[0]} A output limit</b><span class="dim">Use a J1 output or drive a relay from the output. The test lab will fail this until it's fixed.</span></div></div>` : ""}
      <div class="alert info" style="margin-top:12px">${ic("info", 18)}<div><b>${st.workspace.mode === "sandbox" ? `Goes into sandbox ${esc(st.workspace.name)}` : "A new sandbox will be created for it"}</b><span class="dim">Your live upfit.yaml stays as it is until you promote the sandbox.</span></div></div>`;
  };
  main.innerHTML = `<div class="view"><div class="page-head"><div><div class="eyebrow">Product mockup</div><h1>Try a new product before you buy it</h1>
    <p>Describe the product, pick its CanTrol outputs and wires, place it in the control plan, then see it on the wiring map, in the simulator and in the test lab. Mockups go into a sandbox.</p></div></div>
    <div class="wizard-nav">${steps.map((x, i) => `<span class="${i === M.step ? "on" : i < M.step ? "done" : ""}">${i + 1}. ${x}</span>`).join("")}</div>
    <div class="grid g-main"><div class="card"><div id="mBody">${body()}</div><div class="ferr" id="mErr" style="margin-top:10px"></div>
      <div style="display:flex;gap:8px;margin-top:18px"><button class="btn" id="mBack" ${M.step === 0 ? "disabled" : ""}>Back</button><span style="flex:1"></span>${M.step < 4 ? `<button class="btn primary" id="mNext">Next</button>` : `<button class="btn primary" id="mCreate">${ic("play")} Create mockup and test it</button>`}</div></div>
      <div class="card"><div class="card-head"><h3>Where it can go</h3><span class="sub">${free.length} free outputs</span></div><div class="out-strip">${free.map((o) => `<span class="out-tag">${o}</span>`).join("")}</div>
        <div class="muted" style="margin-top:12px;font-size:12px">Run the mockup through the test lab before you order anything, then bench it through the CanTrol before you drill.</div></div></div></div>`;
  const sync = () => {
    $$("[data-m]", main).forEach((i) => { const [a, b] = i.dataset.m.split("."); M[a][b] = i.value; });
    $$("[data-w]", main).forEach((i) => { const [k, f] = i.dataset.w.split("."); M.wires[+k][f] = i.value; });
    if ($("#mPart")) M.partId = $("#mPart").value;
    $$("[data-tg]", main).forEach((c) => (c.checked ? M.targets.add(c.dataset.tg) : M.targets.delete(c.dataset.tg)));
  };
  $$("[data-pm]", main).forEach((b) => (b.onclick = () => { sync(); M.partMode = b.dataset.pm; RENDER.mockup(main); }));
  bindPicker(main, M.outputs);
  $("#mAddWire") && ($("#mAddWire").onclick = () => { sync(); M.wires.push({ color: "", function: "", connects_to: "" }); RENDER.mockup(main); });
  $("#mAuto") && ($("#mAuto").onclick = () => { sync(); const o = [...M.outputs][0]; if (!o) return toast("Pick an output first", "bad"); M.wires[0].connects_to = (o.startsWith("J1") ? "J1 Output " : "LED Output ") + o.split("-")[1]; RENDER.mockup(main); });
  $$("[data-wdel]", main).forEach((b) => (b.onclick = () => { sync(); M.wires.splice(+b.dataset.wdel, 1); RENDER.mockup(main); }));
  $("#mBack").onclick = () => { sync(); M.step--; RENDER.mockup(main); };
  $("#mNext") && ($("#mNext").onclick = () => {
    sync();
    if (M.step === 0 && M.partMode === "new" && !M.part.name.trim()) return ($("#mErr").textContent = "Give the product its full name.");
    M.step++; RENDER.mockup(main);
  });
  $("#mCreate") && ($("#mCreate").onclick = async () => {
    sync();
    const name = M.partMode === "existing" ? (st.parts.find((p) => p.id === M.partId) || {}).name : M.part.name;
    let r;
    if (S.st.workspace.mode !== "sandbox") {
      r = await api("create_scenario", "Mockup " + name.slice(0, 40) + " " + new Date().toTimeString().slice(0, 5).replace(":", ""), null);
      if (!r.ok) return ($("#mErr").textContent = r.error);
      setState(r.state);
    }
    let partId = M.partId;
    if (M.partMode === "new") {
      partId = "mock_" + name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30);
      if (S.st.parts.some((p) => p.id === partId)) partId += "_" + Date.now().toString().slice(-4);
      r = await api("add_part", partId, M.part);
      if (!r.ok) return ($("#mErr").textContent = r.error);
    }
    const outs = [...M.outputs];
    r = await api("add_circuit", { ...M.circuit, name: M.circuit.name || name, part: partId, controller_output: outs.map((o) => (o.startsWith("J1") ? "J1 Output " : "LED Output ") + o.split("-")[1]).join(", ") || null, source: "CanTrol output" }, M.wires);
    if (!r.ok) return ($("#mErr").textContent = r.error);
    for (const t of M.targets) {
      const cur = controlTargets().find((x) => x[0] === t);
      const x = await api("set_control", t, [...new Set([...(cur ? cur[2] : []), ...outs])]);
      if (!x.ok) return ($("#mErr").textContent = x.error);
      r = x;
    }
    setState(r.state); S.mock = null; S.map.vb = null; runSim();
    toast(`Mockup added to sandbox ${S.st.workspace.name}. Running the test lab.`);
    go("lab");
  });
};

// ------------------------------------------------------------------ mount designer
RENDER.mount = async (main) => {
  const d = await api("mount_defaults");
  const V = (S.mountVals = S.mountVals || { ...d.values });
  const groups = [...new Set(d.params.map((p) => p.group))];
  main.innerHTML = `<div class="view"><div class="page-head"><div><div class="eyebrow">Head mount designer</div><h1>Parametric CCTL7 control-head mount</h1>
    <p>Set the angle, offsets and base pattern, then export an OpenSCAD file and STL. The head size has no default: measure your head with calipers. Print PLA to check fit, then PETG or ABS for the truck.</p></div>
    <div class="actions"><button class="btn primary" id="mtExport">${ic("bolt")} Export .scad${d.openscad ? " + STL" : ""}</button></div></div>
    <div class="grid g-main"><div class="card"><div id="mtForm">${groups.map((g) => `<h2 class="section" style="margin-top:4px">${esc(g)}</h2><div class="form-grid">${d.params.filter((p) => p.group === g).map((p) => `<div class="field"><label>${esc(p.label)} (${p.key.endsWith("_deg") ? "deg" : "mm"})</label><input class="input" name="${p.key}" value="${esc(V[p.key] ?? "")}" placeholder="${p.default === null ? "Measure" : p.default}"><div class="hint">${esc(p.note)}</div><div class="ferr" data-for="${p.key}"></div></div>`).join("")}</div>`).join("")}
      <h2 class="section">Pattern and material</h2><div class="form-grid"><div class="field"><label>Base hole pattern</label><select class="input" name="pattern">${Object.entries(d.patterns).map(([k, v]) => `<option value="${k}" ${V.pattern === k ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></div>
      <div class="field"><label>Material</label><select class="input" name="material">${Object.keys(d.materials).map((k) => `<option ${V.material === k ? "selected" : ""}>${k}</option>`).join("")}</select></div></div></div></div>
    <div class="grid" style="align-content:start"><div class="card"><div class="card-head"><h3>Preview</h3><span class="sub">Side and front views to scale</span></div><svg class="mount-svg" id="mtSvg"></svg><div id="mtInfo" style="margin-top:10px"></div></div>
      <div class="card"><div class="card-head"><h3>Print guidance</h3><span class="sub">General knowledge, not from a filament maker</span></div><div id="mtMat" class="dim"></div></div>
      <div class="card"><div class="card-head"><h3>Fit in your truck</h3></div><div class="dim" style="display:grid;gap:8px">
        <div>You already bought the Ben3DBuild Ford Overhead Mount for Whelen CCTL 6/7 (F-150 2015-2020). Use this designer for a second spot or a custom angle.</div>
        <div>Panoramic roof: no overhead or roof-skin mounts. Keep the head and its cable clear of the curtain airbag and the passenger airbag deployment zone.</div></div></div>
      <div id="mtResult"></div></div></div></div>`;
  const vals = () => Object.fromEntries($$("#mtForm .input", main).map((i) => [i.name, i.value]));
  const update = debounce(async () => {
    Object.assign(V, vals());
    const r = await api("mount_preview", V);
    fieldErrors(main, r);
    const mat = d.materials[V.material];
    $("#mtMat").innerHTML = mat ? `<b>${esc(V.material)}</b>: ${esc(mat.use)}<br>Start with ${mat.walls} walls and ${mat.infill_pct}% infill.` : "";
    if (!r.ok) return;
    drawMount(r.params, r.geometry);
    $("#mtInfo").innerHTML = r.missing.length ? `<div class="alert amber">${ic("alert", 18)}<div><b>Measure the head</b><span class="dim">Enter ${r.missing.map((k) => k.replace("head_", "").replace("_mm", "")).join(", ")} to draw the cradle and export.</span></div></div>`
      : `<dl class="kv"><dt>Pocket</dt><dd class="mono">${r.geometry.inner_w.toFixed(1)} × ${r.geometry.inner_h.toFixed(1)} × ${r.geometry.inner_d.toFixed(1)} mm</dd><dt>Cradle outside</dt><dd class="mono">${r.geometry.outer_w.toFixed(1)} × ${r.geometry.outer_h.toFixed(1)} × ${r.geometry.outer_d.toFixed(1)} mm</dd><dt>Overall height</dt><dd class="mono">${r.geometry.top_z} mm</dd></dl>
        ${r.geometry.warnings.map((w) => `<div class="alert amber" style="margin-top:8px">${ic("alert", 18)}<div>${esc(w)}</div></div>`).join("")}`;
  }, 120);
  $$("#mtForm .input", main).forEach((i) => (i.oninput = i.onchange = update));
  update();
  $("#mtExport").onclick = async () => {
    Object.assign(V, vals());
    const r = await api("mount_export", V);
    fieldErrors(main, r);
    if (!r.ok) return toast(r.error, "bad");
    $("#mtResult").innerHTML = `<div class="card"><div class="card-head"><h3>Exported</h3><span class="right"><button class="btn sm" id="mtOpen">${ic("folder", 14)} Open folder</button></span></div><dl class="kv"><dt>OpenSCAD</dt><dd class="mono" style="word-break:break-all">${esc(r.scad)}</dd><dt>STL</dt><dd>${r.stl ? `<span class="mono" style="word-break:break-all">${esc(r.stl)}</span>` : ""}<div class="muted">${esc(r.stl_status)}</div></dd></dl></div>`;
    $("#mtOpen").onclick = () => api("open_folder", "outputs");
    toast(r.stl ? "Mount exported: .scad and STL" : "Mount .scad exported", r.stl ? "good" : "info");
  };
};
function drawMount(p, g) {
  const svg = $("#mtSvg");
  if (!svg) return;
  const W = 560, H = 300, pad = 24;
  const baseL = p.base_length_mm, baseW = p.base_width_mm, bt = p.base_thick_mm, rz = p.riser_mm;
  const oh = g ? g.outer_h : 60, od = g ? g.outer_d : 30, ow = g ? g.outer_w : 120;
  const t = (p.tilt_deg * Math.PI) / 180;
  const sideW = Math.max(baseW, od + Math.abs(p.offset_y_mm) * 2 + oh * Math.abs(Math.sin(t)) * 2) + 20;
  const frontW = Math.max(baseL, ow + Math.abs(p.offset_x_mm) * 2) + 20;
  const tall = bt + rz + oh + od + 20;
  const k = Math.min((W / 2 - pad * 1.5) / sideW, (W / 2 - pad * 1.5) / frontW, (H - 2 * pad - 14) / tall);
  const gY = H - pad;
  let s = `<text x="${pad}" y="16">SIDE (driver to the right)</text><text x="${W / 2 + pad / 2}" y="16">FRONT (facing the head)</text>`;
  // side view
  const sx0 = pad + (W / 2 - pad * 1.5) / 2;
  s += `<rect class="part" x="${sx0 - (baseW / 2) * k}" y="${gY - bt * k}" width="${baseW * k}" height="${bt * k}"/>`;
  const px = sx0 + p.offset_y_mm * k, py = gY - (bt + rz) * k;
  s += `<rect class="part" x="${px - p.wall_mm * k}" y="${py}" width="${(p.wall_mm + od * 0.6) * k}" height="${rz * k}"/>`;
  const pts = [[0, 0], [od, 0], [od, oh], [0, oh]].map(([y, z]) => { const yy = y * Math.cos(t) - z * Math.sin(t), zz = y * Math.sin(t) + z * Math.cos(t); return `${px + yy * k},${py - zz * k}`; }).join(" ");
  s += `<polygon class="part" points="${pts}"/>`;
  if (g) {
    const hp = [[p.wall_mm, p.wall_mm], [p.wall_mm + g.inner_d - p.clearance_mm, p.wall_mm], [p.wall_mm + g.inner_d - p.clearance_mm, p.wall_mm + g.inner_h], [p.wall_mm, p.wall_mm + g.inner_h]]
      .map(([y, z]) => { const yy = y * Math.cos(t) - z * Math.sin(t), zz = y * Math.sin(t) + z * Math.cos(t); return `${px + yy * k},${py - zz * k}`; }).join(" ");
    s += `<polygon class="head" points="${hp}"/>`;
  }
  s += `<line class="dim" x1="${pad / 2}" x2="${W / 2 - pad / 2}" y1="${gY}" y2="${gY}"/><text x="${sx0 - 20}" y="${gY + 14}">tilt ${p.tilt_deg}°</text>`;
  // front view
  const fx0 = W / 2 + (W / 2 - pad / 2) / 2;
  s += `<rect class="part" x="${fx0 - (baseL / 2) * k}" y="${gY - bt * k}" width="${baseL * k}" height="${bt * k}"/>`;
  const cx = fx0 + p.offset_x_mm * k, fh = oh * Math.cos(t) + od * Math.abs(Math.sin(t));
  s += `<rect class="part" x="${cx - (ow / 2) * k}" y="${gY - (bt + rz) * k}" width="${ow * k}" height="${rz * k}"/>`;
  s += `<rect class="part" x="${cx - (ow / 2) * k}" y="${gY - (bt + rz + fh) * k}" width="${ow * k}" height="${fh * k}"/>`;
  if (g) s += `<rect class="head" x="${cx - (g.inner_w / 2 - p.lip_mm) * k}" y="${gY - (bt + rz + fh - p.wall_mm) * k}" width="${(g.inner_w - 2 * p.lip_mm) * k}" height="${(fh - p.wall_mm - p.lip_mm) * k}"/>`;
  const holes = p.pattern === "2-hole" ? [-1, 1].map((sx) => sx * p.hole_spacing_x_mm / 2) : [-1, 1].map((sx) => sx * p.hole_spacing_x_mm / 2);
  holes.forEach((hx) => (s += `<rect x="${fx0 + hx * k - (p.hole_dia_mm / 2) * k}" y="${gY - bt * k}" width="${p.hole_dia_mm * k}" height="${bt * k}" fill="var(--bg)"/>`));
  s += `<text x="${fx0 - 30}" y="${gY + 14}">${baseL} mm base</text>`;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.innerHTML = s;
}

// ------------------------------------------------------------------ hardware lab
RENDER.hardware = async (main) => {
  const cards = [
    ["5", "Bench test rig with reports", "ready", "The bench wizard and its dated reports are built. The engine has a driver slot (bench.Driver: energize, read current, confirm, de-energize) so a rig can replace typing readings.", "Your pick of controller (ESP32 or Raspberry Pi), relay board and INA226 boards, plus their part numbers, before I write a driver. I won't guess at their APIs."],
    ["6", "Harness continuity and polarity tester", "partial", "The checklist below is generated from every wire in upfit.yaml: end to end, no short to ground, no short to neighbours, polarity at the plug. Works with any meter that has continuity.", "A multimeter (memory says you don't have one yet). A dedicated tester needs a hardware choice."],
    ["7", "Passive CanTrol output logger", "planned", "The map already knows every output and what it feeds, so a log can be labelled automatically. Voltage-sense only, never on the CanTrol bus.", "Optocoupler board choice. Whelen's docs for any Gen 3 diagnostic interface: none confirmed, so none assumed."],
    ["8", "AGM battery and charging monitor", "planned", "Simulator loads per mode are ready to compare against measured current once a shunt is in.", "Victron SmartShunt (VE.Direct, documented protocol) or a DIY INA226 shunt; tell me which."],
    ["9", "Read-only OBD-II dashboard", "planned", "Would run read-only queries only (RPM, voltage, coolant, idle), never write or programming commands.", "OBDLink model. Needs a read-only allow-list I can test against the adapter."],
    ["10", "In-cab thermal monitor", "planned", "Thresholds per device would come from each maker's operating range, sourced, not guessed.", "Sensor type and where they mount (console, storage, Toughbook)."],
  ];
  const tone = { ready: "good", partial: "info", planned: "muted" };
  main.innerHTML = `<div class="view"><div class="page-head"><div><div class="eyebrow">Hardware lab</div><h1>Test and monitoring hardware</h1>
    <p>Projects 5 to 10 from your list. Software that works today is live; anything that needs a device waits for your hardware choice, because the rules say no guessing at hardware APIs.</p></div></div>
    <div class="grid g-3">${cards.map(([n, t, st, have, need]) => `<div class="card hw-card"><div class="status-row"><span class="pill ${tone[st]}">${st === "ready" ? "Software ready" : st === "partial" ? "Usable now" : "Needs hardware"}</span><span class="muted mono">Project ${n}</span></div><h3>${esc(t)}</h3><div class="dim">${esc(have)}</div><div><b style="font-size:12px;color:var(--text-3);text-transform:uppercase;letter-spacing:.6px">Needed from you</b><div class="dim">${esc(need)}</div></div>${n === "5" ? `<button class="btn sm" data-go="bench">${ic("bench", 14)} Open bench test</button>` : ""}</div>`).join("")}</div>
    <h2 class="section">Continuity and polarity checklist</h2><div class="toolbar"><button class="btn" id="ccCopy">${ic("copy")} Copy checklist</button></div><pre class="sheet" id="cc">Loading…</pre></div>`;
  const r = await api("continuity_checklist");
  $("#cc").textContent = r.text;
  $("#ccCopy").onclick = async () => { try { await navigator.clipboard.writeText(r.text); toast("Checklist copied"); } catch { toast("Select the text and copy it", "info"); } };
};
