/* Control head view: a replica of the Whelen CCTL7 21-button slide head (key positions from
   William's head photo), with a live light preview of every product it switches.
   Flash timing on screen is illustrative; real patterns are set in Whelen Command and in each device. */
"use strict";

const HEAD = {
  // SW number -> [x center, y center, width, height] in the 840 x 440 drawing
  pos: (() => {
    const p = {};
    [75, 173, 268, 363, 458, 553, 648, 743].forEach((x, i) => (p[i + 1] = [x, 73, 78, 62]));
    [363, 458, 553, 648, 743].forEach((x, i) => { p[9 + i] = [x, 174, 78, 62]; p[14 + i] = [x, 261, 78, 62]; });
    [405, 555, 711].forEach((x, i) => (p[19 + i] = [x, 359, 124, 62]));
    return p;
  })(),
  ledX: [82, 129, 176, 223],
  edit: false,
  night: false,
  latch: (() => { try { return localStorage.getItem("upfit.latch") === "1"; } catch (e) { return false; } })(),
  sel: null,
};
const LIGHT = { amber: "#ffb020", white: "#f4f7ff", red: "#ff2d2d", tbd: "#8b95a8" };

function sirenIcon(cap, x, y) {
  const s = `stroke="#2b2f36" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  const t = `transform="translate(${x - 12},${y - 10})"`;
  switch ((cap || "").toUpperCase()) {
    case "STBY": return `<g ${t} ${s}><path d="M2 7h4l5-4v14l-5-4H2z"/><path d="M15 6l6 8M21 6l-6 8"/></g>`;
    case "RAD": return `<g ${t} ${s}><path d="M12 9v11M9 20h6"/><circle cx="12" cy="7" r="2"/><path d="M6 3a8 8 0 0 0 0 9M18 3a8 8 0 0 1 0 9"/></g>`;
    case "HF": return `<g ${t} ${s}><path d="M7 19c-3-3-4-6-3-9l2 1 1-7 2 6 1-7 2 7 1-6 2 7 2-3c1 4-1 9-5 11z"/></g>`;
    case "WAIL": return `<g ${t} ${s}><path d="M1 10c3-9 6 9 9 0s6 9 9 0 4-4 5 0"/></g>`;
    case "YELP": return `<g ${t} ${s}><path d="M1 16l4-12v12l4-12v12l4-12v12l4-12v12l4-12"/></g>`;
    case "PIER": return `<g ${t} ${s}><path d="M14 1L6 12h6l-3 9 9-12h-6z"/></g>`;
    case "MAN": return `<g ${t} ${s}><path d="M5 11h4l3-7c2 0 2 2 1 4h6v4l-2 6H7z"/><path d="M15 1v3M18 2l-1 2"/></g>`;
    case "HORN": return `<g ${t} ${s}><path d="M2 7h6l12-5v16L8 13H2z"/><path d="M6 13l2 6"/></g>`;
    default: return "";
  }
}

function keyText(label, x, y, w) {
  const words = String(label || "").split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const max = w > 100 ? 14 : 9;
  const lines = [];
  words.forEach((wd) => { const l = lines[lines.length - 1]; if (l && (l + " " + wd).length <= max) lines[lines.length - 1] = l + " " + wd; else lines.push(wd); });
  const shown = lines.slice(0, 3), fs = shown.some((l) => l.length > 8) && w < 100 ? 11 : 13;
  return shown.map((l, i) => `<text x="${x}" y="${y + (i - (shown.length - 1) / 2) * (fs + 2) + fs / 3}" text-anchor="middle" class="kt" font-size="${fs}">${esc(l)}</text>`).join("");
}

function headSvg() {
  const head = (S.st.controls || {}).head || {}, keys = head.keys || [];
  const btns = Object.fromEntries(((S.st.controls || {}).buttons || []).map((b) => [b.name, b]));
  let h = `<defs>
    <linearGradient id="kcap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef0f3"/><stop offset=".55" stop-color="#cfd3d9"/><stop offset="1" stop-color="#aeb3ba"/></linearGradient>
    <linearGradient id="kcapN" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5a4a"/><stop offset="1" stop-color="#c81e10"/></linearGradient>
    <linearGradient id="body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2a2c"/><stop offset="1" stop-color="#1b1b1d"/></linearGradient>
    <radialGradient id="ledOn"><stop offset="0" stop-color="#fff2c4"/><stop offset=".45" stop-color="#ff3b30"/><stop offset="1" stop-color="#7a0b06"/></radialGradient>
    <filter id="hglow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <rect x="2" y="2" width="836" height="436" rx="42" fill="#0d0d0e"/>
    <rect x="16" y="16" width="808" height="408" rx="32" fill="url(#body)" stroke="#3a3a3d"/>
    <rect x="28" y="30" width="784" height="86" rx="18" fill="#141415" stroke="#000" stroke-opacity=".6"/>
    <rect x="310" y="128" width="490" height="180" rx="18" fill="#141415"/>
    <rect x="330" y="318" width="470" height="84" rx="16" fill="#141415"/>
    <text x="52" y="180" class="whelen">WHELEN</text><text x="262" y="160" class="reg">®</text>`;
  // slide position LEDs (which LED lights per position: confirm on the head)
  const pos = S.sim.slide ? +S.sim.slide : 0;
  HEAD.ledX.forEach((x, i) => {
    const on = pos > 0 && i === pos;
    h += `<circle cx="${x}" cy="212" r="9" fill="${on ? "url(#ledOn)" : "#4a4c50"}" ${on ? 'filter="url(#hglow)"' : ""} stroke="#111"/>`;
  });
  // slide switch: 4 detents under the 4 LEDs, far left = off
  h += `<rect x="52" y="238" width="202" height="62" rx="10" fill="#0b0b0c" stroke="#333"/>`;
  HEAD.ledX.forEach((x, i) => (h += `<rect class="detent" data-pos="${i}" x="${x - 23}" y="238" width="46" height="62" fill="transparent"><title>${i ? "Slide position " + i : "Off (far left)"}</title></rect>`));
  const tx = HEAD.ledX[pos];
  h += `<g class="thumb" style="transform:translateX(${tx - HEAD.ledX[0]}px)"><rect x="${HEAD.ledX[0] - 28}" y="232" width="56" height="74" rx="8" fill="#1d1d1f" stroke="#000"/>
    ${[0, 1, 2, 3, 4, 5, 6].map((k) => `<rect x="${HEAD.ledX[0] - 26}" y="${244 + k * 8}" width="16" height="4" rx="1" fill="#333"/>`).join("")}
    <rect x="${HEAD.ledX[0] - 6}" y="240" width="30" height="58" rx="6" fill="#262628" stroke="#0a0a0a"/></g>`;
  h += `<text x="153" y="322" text-anchor="middle" class="hcap">${["OFF", "SLIDE 1", "SLIDE 2", "SLIDE 3"][pos]}</text>`;
  // arrow indicator: ◄ 7 dots ►
  h += `<path d="M38 360l16-9v18z" class="tri" id="triL"/><path d="M314 360l-16-9v18z" class="tri" id="triR"/>`;
  for (let i = 0; i < 7; i++) h += `<circle class="adot" data-dot="${i}" cx="${87 + i * 29}" cy="360" r="8"/>`;
  // keys
  keys.forEach((k) => {
    const p = HEAD.pos[k.sw]; if (!p) return;
    const [cx, cy, w, hh] = p, x = cx - w / 2, y = cy - hh / 2;
    const b = k.button ? btns[k.button] : null;
    const isOn = b ? S.sim.pressed.has(b.name) : k.kind === "siren" && S.sim.siren === k.cap;
    const icon = k.kind === "siren" ? sirenIcon(k.cap, cx, cy - 9) : "";
    const lbl = k.label || k.cap || "";
    h += `<g class="hkey ${isOn ? "on" : ""} ${HEAD.sel === k.sw ? "sel" : ""} ${b ? "mapped" : k.kind === "siren" ? "siren" : "free"}" data-sw="${k.sw}" tabindex="0" role="button" aria-label="SW${k.sw} ${esc(lbl)}">
      <title>SW${k.sw} · ${esc(lbl)}${k.cap && k.cap !== lbl ? " (cap: " + esc(k.cap) + ")" : ""}${b ? "\nRuns: " + esc(b.name) + " (" + esc(b.action) + ")\n" + esc(b.note || "") : k.kind === "siren" ? "\nSiren key (simulated, no sound)" : "\nNot assigned"}</title>
      <rect x="${x - 3}" y="${y - 3}" width="${w + 6}" height="${hh + 6}" rx="10" fill="#0a0a0a"/>
      <rect class="cap" x="${x}" y="${y}" width="${w}" height="${hh}" rx="8"/>
      <rect class="ind" x="${cx - 14}" y="${y + 4}" width="28" height="4" rx="2"/>
      ${icon}${k.kind === "siren" ? keyText(lbl, cx, cy + 17, w) : keyText(lbl, cx, cy + 2, w)}
      ${HEAD.edit ? `<text x="${x + 5}" y="${y + 11}" class="swn">SW${k.sw}</text>` : ""}</g>`;
  });
  return `<svg class="cctl7 ${HEAD.night ? "night" : ""} ${HEAD.edit ? "editing" : ""}" viewBox="0 0 840 440" role="img" aria-label="Whelen CCTL7 control head">${h}</svg>`;
}

function arrowState() {
  const ks = ((S.st.controls || {}).head || {}).keys || [];
  const on = (sw) => { const k = ks.find((x) => x.sw === sw); return k && k.button && S.sim.pressed.has(k.button); };
  if (on(21) || (on(19) && on(20))) return "center";
  if (on(19)) return "left";
  if (on(20)) return "right";
  return null;
}

RENDER.head = (main) => {
  const ctl = S.st.controls || {}, head = ctl.head || {};
  if (!head.keys) {
    main.innerHTML = `<div class="view"><div class="empty">upfit.yaml has no controls.head section yet. Update to 0.5.0's upfit.yaml to get the CCTL7 head.</div></div>`;
    return;
  }
  main.innerHTML = `<div class="view head-view">
    <div class="page-head"><div><div class="eyebrow">Control head · ${esc(head.model || "CCTL7")}</div><h1>Run the head, watch every light</h1>
      <p>Click keys like the real head. Momentary keys work while held; hold Shift as you click to keep one pressed while you scroll, or switch on Hold keys. Keyboard: 0-3 moves the slide (far left is off), hold B for the brake${hotkeyHint()}. It never talks to the CanTrol; flash timing is illustrative.</p></div>
      <div class="actions">
        <button class="btn ${HEAD.edit ? "primary" : ""}" id="hEdit">${ic("edit")} ${HEAD.edit ? "Done editing" : "Edit key labels"}</button>
        <button class="btn" id="hNight" title="Show the red night backlight">${HEAD.night ? "Day view" : "Night backlight"}</button>
        <button class="btn ${HEAD.latch ? "primary" : ""}" id="hLatch" title="Momentary keys and the brake stay pressed until you click them again, so you can scroll to the lights">${HEAD.latch ? "Hold keys: on" : "Hold keys"}</button>
        <button class="btn" id="planEdit">Edit plan</button><button class="btn" id="simReset">All off</button></div></div>
    ${HEAD.edit ? `<div class="alert info" style="margin-bottom:12px">${ic("info", 18)}<div><b>Editing key labels</b><span class="dim">Click any key to change its label, the printed cap, or which plan button it runs. Each save backs up upfit.yaml and syncs like any other change.</span></div></div>` : ""}
    <div class="head-grid">
      <div class="head-stage">
        <div class="head-frame" id="headSvg">${headSvg()}</div>
        <div class="head-under">
          <button class="pedal-btn" id="brakeBtn" title="Hold for the brake. Option A: pop flash for ${esc((ctl.brake_pop || {}).pop_seconds || 2)} s, then steady red while held."><span class="pd"></span><span><b>Brake pedal</b><small id="brakeState">Hold to press</small></span></button>
          <div class="siren-read" id="sirenRead"></div>
          <div class="load-mini wide"><span data-loadtext></span><div class="meter good"><i data-loadbar></i></div></div>
        </div>
        <div id="auxPanels"></div>
        <div id="canportPanel"></div>
        <div class="card light-card"><div class="card-head"><h3>Light preview</h3><span class="sub">Each product, where it sits on the truck</span></div><div id="lightScene"></div>
          <div class="legend-row"><span><i class="lg steady"></i>Steady</span><span><i class="lg flash"></i>Flashed by the CanTrol (A / B phase)</span><span><i class="lg pattern"></i>Device's own stored pattern</span><span><i class="lg arrow"></i>Arrow</span><span><i class="lg tbd"></i>Color not confirmed</span></div></div>
      </div>
      <div class="head-side" id="headResult"></div>
    </div></div>`;
  $("#headSvg").innerHTML = headSvg();
  bindHead();
  $("#hEdit").onclick = () => { HEAD.edit = !HEAD.edit; HEAD.sel = null; RENDER.head(main); };
  $("#hNight").onclick = () => { HEAD.night = !HEAD.night; RENDER.head(main); };
  $("#hLatch").onclick = () => { HEAD.latch = !HEAD.latch; try { localStorage.setItem("upfit.latch", HEAD.latch ? "1" : "0"); } catch (e) {} if (!HEAD.latch) { (S.st.controls.buttons || []).forEach((b) => { if (b.action === "momentary") S.sim.pressed.delete(b.name); }); S.sim.brake = false; } RENDER.head(main); runSim(); };
  $("#planEdit").onclick = () => openPlanEditor();
  $("#simReset").onclick = () => { S.sim = { slide: null, pressed: new Set(), brake: false, brakePhase: "pop", siren: null, res: null }; runSim(); };
  const bb = $("#brakeBtn");
  bb.onpointerdown = (e) => { e.preventDefault(); if (HEAD.latch || e.shiftKey) { bb.dataset.latched = "1"; setBrake(!S.sim.brake); return; } bb.dataset.latched = ""; bb.setPointerCapture?.(e.pointerId); setBrake(true); };
  bb.onpointerup = bb.onpointercancel = () => { if (!bb.dataset.latched) setBrake(false); };
  applySim();
};

function bindHead() {
  const root = $("#headSvg"), ctl = S.st.controls || {};
  const btns = Object.fromEntries((ctl.buttons || []).map((b) => [b.name, b]));
  $$(".detent", root).forEach((d) => (d.onclick = () => setSlide(+d.dataset.pos ? d.dataset.pos : null)));
  $$(".hkey", root).forEach((g) => {
    const sw = +g.dataset.sw, k = ctl.head.keys.find((x) => x.sw === sw), b = k.button ? btns[k.button] : null;
    if (HEAD.edit) { g.onclick = () => openKeyEditor(sw); return; }
    if (k.kind === "siren") {
      const mom = k.cap === "HORN" || k.cap === "MAN";
      if (mom) {
        g.onpointerdown = () => { S.sim.siren = k.cap; redrawHead(); };
        g.onpointerup = g.onpointerleave = () => { if (S.sim.siren === k.cap) { S.sim.siren = null; redrawHead(); } };
      } else g.onclick = () => { S.sim.siren = k.cap === "STBY" || S.sim.siren === k.cap ? null : k.cap; redrawHead(); };
      return;
    }
    if (!b) { g.onclick = () => toast(`SW${sw} isn't assigned to a plan button. Use Edit key labels to assign it.`, "info"); return; }
    if (b.action === "momentary") {
      // Shift+click or Hold keys: stays pressed until clicked again (so you can scroll to the lights)
      let latched = false;
      g.onpointerdown = (e) => { latched = HEAD.latch || e.shiftKey; latched ? toggleButton(b.name) : toggleButton(b.name, true); };
      g.onpointerup = g.onpointerleave = () => { if (!latched && S.sim.pressed.has(b.name)) toggleButton(b.name, false); };
    } else if (b.action === "press") {
      g.onclick = () => pressButton(b, k);
    } else g.onclick = () => toggleButton(b.name);
    g.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); g.onclick ? g.onclick() : null; } };
  });
}
function redrawHead() {
  const box = $("#headSvg"); if (!box) return;
  box.innerHTML = headSvg(); bindHead(); paintArrows(); paintSiren();
}
function paintArrows() {
  const st = arrowState();
  $$("#headSvg .adot").forEach((d) => {
    const i = +d.dataset.dot;
    d.classList.remove("sweepL", "sweepR", "center");
    d.style.animationDelay = "";
    if (!st) return;
    const cls = st === "left" ? "sweepL" : st === "right" ? "sweepR" : "center";
    const step = st === "left" ? 6 - i : st === "right" ? i : Math.abs(3 - i);
    d.classList.add(cls); d.style.animationDelay = `${step * 0.09}s`;
  });
  $("#triL")?.classList.toggle("on", st === "left" || st === "center");
  $("#triR")?.classList.toggle("on", st === "right" || st === "center");
}
function paintSiren() {
  const el = $("#sirenRead"); if (!el) return;
  const slide3 = S.sim.slide === "3";
  el.innerHTML = S.sim.siren ? `<span class="pill bad">Siren ${esc(S.sim.siren)}</span><small>Simulated, no sound${slide3 ? ". Plan: no siren tone in slide 3" : ""}</small>` : `<span class="pill muted">Siren standby</span><small>Top-row keys pick a tone (simulated)</small>`;
}

async function openKeyEditor(sw) {
  const ctl = S.st.controls, k = ctl.head.keys.find((x) => x.sw === sw);
  HEAD.sel = sw; redrawHead();
  const opts = (ctl.buttons || []).map((b) => {
    const on = ctl.head.keys.find((x) => x.button === b.name);
    return `<option value="${esc(b.name)}" ${k.button === b.name ? "selected" : ""}>${esc(b.name)}${on && on.sw !== sw ? ` (now on SW${on.sw})` : ""}</option>`;
  }).join("");
  const b = (ctl.buttons || []).find((x) => x.name === k.button);
  const d = drawer(`SW${sw} · ${esc(k.label || k.cap || "Blank key")}`, `${esc(k.kind)} key · printed cap: ${esc(k.cap || "blank")}`,
    `<div class="form-grid">
      <div class="field"><label>Label on the key</label><input class="input" name="label" maxlength="18" value="${esc(k.label || "")}"><div class="ferr" data-for="label"></div><div class="hint">What the app shows on this key. Up to 18 characters.</div></div>
      <div class="field"><label>Printed cap</label><input class="input" name="cap" value="${esc(k.cap || "")}"><div class="hint">What's printed on your physical key (blank keys stay blank).</div></div>
      ${k.kind === "siren" ? "" : `<div class="field wide"><label>Runs plan button</label><select class="input" name="button"><option value="">Not assigned</option>${opts}</select><div class="ferr" data-for="button"></div><div class="hint">Moving a plan button here frees it from the key it was on.</div></div>`}
    </div>
    ${b ? `<div class="card" style="margin-top:6px"><div class="card-head"><h3>${esc(b.name)}</h3><span class="sub">${esc(b.action)}</span></div><div class="dim" style="font-size:12.5px">${esc(b.note || "")}</div><div class="out-strip" style="margin-top:8px">${(b.outputs || []).map((o) => `<span class="out-tag">${o}</span>`).join("")}</div></div>` : ""}`,
    `<button class="btn primary" id="drawerSave">Save key</button><button class="btn ghost" data-close>Cancel</button>`);
  $("#drawerSave").onclick = async () => {
    const raw = Object.fromEntries($$(".input", d).map((i) => [i.name, i.value]));
    const r = await api("set_head_key", sw, raw);
    fieldErrors(d, r);
    if (!r.ok) return r.field ? null : toast(r.error, "bad");
    HEAD.sel = null;
    afterSave(r, `SW${sw} saved`);
  };
}

// ------------------------------------------------------------------ light preview
function colorOf(c, i, n) {
  if (!c) return { c: LIGHT.tbd, tbd: true };
  if (c === "amber/white") return { c: i % 2 ? LIGHT.white : LIGHT.amber };
  if (c === "factory") return { c: i < n / 2 ? LIGHT.white : LIGHT.red };
  return { c: LIGHT[c] || LIGHT.tbd, tbd: !LIGHT[c] };
}
function cellsFor(dev) {
  const aux = window.auxCells && window.auxCells(dev);  // visor bar / BooYu follow their own controllers (controllers.js)
  if (aux) return aux;
  if (dev.kind === "pods-wide") {
    // Two bars (driver and passenger) wired in parallel: both show the same thing at the same time.
    const one = cellsFor({ ...dev, kind: "bar", segments: 6 });
    return [...one, ...one.map((x) => ({ ...x }))];
  }
  const n = dev.kind === "factory" ? 2 : dev.segments || 6;
  const off = Array.from({ length: n }, () => ({ cls: "off" }));
  const lights = dev.channels.filter((ch) => ch.on && !["power", "input"].includes(ch.drive));
  if (!dev.powered || !lights.length) return off;
  if (dev.kind === "modules") {
    return off.map((_, i) => {
      const ch = lights.find((x) => x.module === i + 1);
      if (!ch) return { cls: "off" };
      const col = colorOf(ch.color, i, n);
      if (ch.state === "sweep") return { cls: "arrow", c: col.c, tbd: col.tbd, delay: ch.step * (0.7 / (ch.steps || n)) };
      return { cls: ch.state === "steady" ? "steady" : ch.state === "flash" ? "flash" + (ch.phase || "A") : "pattern", c: col.c, tbd: col.tbd };
    });
  }
  if (dev.kind === "factory") {
    return off.map((_, i) => {
      const ch = lights.find((x) => (i === 0 ? /front|input 1/i : /rear|input 2/i).test(x.label));
      return ch ? { cls: i ? "flashB" : "flashA", c: i ? LIGHT.red : LIGHT.white } : { cls: "off" };
    });
  }
  const arrows = lights.filter((x) => x.state.startsWith("arrow"));
  if (arrows.length) {
    const dir = arrows.length > 1 ? "center" : arrows[0].state === "arrow-left" ? "left" : "right";
    return off.map((_, i) => {
      const step = dir === "left" ? n - 1 - i : dir === "right" ? i : Math.abs((n - 1) / 2 - i);
      const col = colorOf(arrows[0].color, i, n);
      return { cls: "arrow", c: col.c, tbd: col.tbd, delay: step * (0.7 / n) };
    });
  }
  const pick = lights.find((x) => x.state === "steady") || lights.find((x) => x.state === "flash") || lights[0];
  return off.map((_, i) => {
    const col = colorOf(pick.color, i, n);
    if (pick.state === "steady") return { cls: "steady", c: col.c, tbd: col.tbd };
    if (pick.state === "flash") return { cls: "flash" + (pick.phase || "A"), c: col.c, tbd: col.tbd };
    const half = i < n / 2 ? "A" : "B";
    return { cls: "pattern flash" + (dev.kind === "pods" ? (i % 2 ? "B" : "A") : half), c: col.c, tbd: col.tbd };
  });
}
function stateChips(dev) {
  const ax = dev.on && window.auxStateText && window.auxStateText(dev);
  if (ax) return `<span class="pill info">${esc(ax)}</span>`;
  const lights = dev.channels.filter((ch) => ch.on && !["power", "input"].includes(ch.drive));
  if (!dev.powered && lights.length) return '<span class="pill bad">No power wire on</span>';
  if (!lights.length) return '<span class="pill muted">Off</span>';
  const name = (ch) => ch.state === "steady" ? "Steady" : ch.state === "flash" ? `Flash ${ch.phase || "A"}` : ch.state === "pattern" ? "Own pattern" : ch.state === "arrow-left" ? "Arrow ◄" : ch.state === "arrow-right" ? "Arrow ►" : ch.state === "sweep" ? "CanTrol sweep" : ch.state;
  const groups = {};
  lights.forEach((ch) => { const key = `${name(ch)} · ${ch.color || "color TBD"}`; (groups[key] = groups[key] || []).push(ch.source || ch.via || ""); });
  return Object.entries(groups).map(([k, srcs]) => `<span class="pill ${/Steady/.test(k) ? "good" : /Flash/.test(k) ? "amber" : "info"}" title="${esc(srcs.join(", "))}">${esc(k)}</span>`).join(" ")
    + (!dev.steady_ok && lights.some((x) => x.state === "steady") ? ' <span class="pill bad">STEADY: not allowed</span>' : "");
}
function deviceHtml(dev) {
  const cells = cellsFor(dev);
  const cell = (x, i) => `<i class="cell ${x.cls} ${x.tbd ? "tbd" : ""}" style="${x.c ? `--c:${x.c};` : ""}${x.delay !== undefined ? `animation-delay:${x.delay.toFixed(2)}s` : ""}"></i>`;
  let body;
  if (dev.kind === "pods") body = `<div class="lamp pods">${cells.map((x, i) => `<div class="pod">${cell(x, i)}</div>`).join("")}</div>`;
  else if (dev.kind === "pods-wide") body = `<div class="lamp pods-wide"><div class="bar">${cells.slice(0, 6).map(cell).join("")}</div><div class="bar">${cells.slice(6).map((x, i) => cell(x, i + 6)).join("")}</div></div>`;
  else if (dev.kind === "factory") body = `<div class="lamp factory"><div><small>Front</small>${cell(cells[0], 0)}</div><div><small>Rear</small>${cell(cells[1], 1)}</div></div>`;
  else if (dev.kind === "modules") body = `<div class="lamp stick">${cells.map((x, i) => `<div class="mod">${cell(x, i)}<small>${i + 1}</small></div>`).join("")}</div>`;
  else body = `<div class="lamp bar ${dev.split ? "split" : ""}">${cells.map((x, i) => (dev.split && i === cells.length / 2 ? '<span class="gap"></span>' : "") + cell(x, i)).join("")}</div>`;
  return `<div class="dev ${dev.on ? "on" : ""}" data-part="${esc(dev.part_id)}"><div class="dev-name" title="${esc(dev.product)}">${esc(dev.product)}</div>${body}<div class="dev-state">${stateChips(dev)}</div>
    <div class="dev-meta">${dev.circuits.map((c) => `<a href="#" data-action="circuit" data-id="${c}">${c}</a>`).join(" ")}${dev.status ? ` · ${esc(dev.status)}` : ""}${dev.steady_ok ? "" : " · flash only"}</div></div>`;
}
function renderLightScene(r) {
  const box = $("#lightScene"); if (!box) return;
  const zones = S.st.zones || [];
  const devs = r.devices || [];
  box.innerHTML = zones.map((z) => {
    const ds = devs.filter((d) => d.zone === z.id);
    return ds.length ? `<div class="zone"><div class="zone-h">${esc(z.label)}</div><div class="zone-b">${ds.map(deviceHtml).join("")}</div></div>` : "";
  }).join("") + (devs.filter((d) => !zones.some((z) => z.id === d.zone)).map(deviceHtml).join(""));
}

function hotkeyHint() {
  const ks = (((S.st.controls || {}).head || {}).keys || []).filter((k) => k.hotkey && k.button);
  return ks.length ? ", " + ks.map((k) => `${esc(k.hotkey.toUpperCase())} for ${esc(k.label || k.button)}`).join(", ") : "";
}
window.renderHeadResult = function renderHeadResult() {
  const r = S.sim.res, box = $("#headResult");
  if (!r || !box) return;
  redrawHead();
  if ($("#auxPanels") && window.auxPanelsHtml) { $("#auxPanels").innerHTML = window.auxPanelsHtml(); window.bindAux(); }
  if ($("#canportPanel") && window.canportPanelHtml && !(window.CAN_EDITING && window.CAN_EDITING())) { $("#canportPanel").innerHTML = window.canportPanelHtml(); window.bindCanport(); }
  renderLightScene(r);
  const bs = $("#brakeState");
  if (bs) bs.textContent = S.sim.brake ? (S.sim.brakePhase === "held" ? "Held: steady red" : "Pop flash") : "Hold to press";
  $("#brakeBtn")?.classList.toggle("on", S.sim.brake);
  const modes = r.modes || {}, prodOf = {};
  S.st.map.edges.forEach((e) => { if (e.from_cantrol) (prodOf[e.source] = prodOf[e.source] || new Set()).add((S.st.circuits.find((c) => c.id === e.circuit_id) || {}).product || e.circuit_id); });
  const outs = Object.keys(r.active);
  const warn = r.warnings || [];
  box.innerHTML = `
    ${warn.length ? warn.map((w) => `<div class="alert ${w.severity === "ERROR" ? "bad" : "amber"}">${ic("alert", 18)}<div><b>${esc(w.subject)}</b><span class="dim">${esc(w.message)}</span></div></div>`).join("") : ""}
    ${r.unwired_on.length ? `<div class="alert amber">${ic("alert", 18)}<div><b>${r.unwired_on.join(", ")} on, but not wired in upfit.yaml</b><span class="dim">Add their wires to the right circuits so the load and map are complete.</span></div></div>` : ""}
    <div class="card"><div class="card-head"><h3>Outputs on</h3><span class="sub">${outs.length} of 40</span></div>
      ${outs.length ? `<table class="data compact"><thead><tr><th>Output</th><th>Mode</th><th>Feeds</th><th>Set by</th></tr></thead><tbody>${outs.map((o) => { const m = modes[o] || {}; return `<tr class="click" data-action="output" data-id="${o}"><td class="mono">${o}</td><td>${m.mode === "flash" ? `<span class="pill amber">Flash ${m.phase || "A"}</span>` : m.mode === "sweep" ? `<span class="pill amber">Sweep ${(m.step || 0) + 1}/${m.steps || 1}</span>` : '<span class="pill good">Steady</span>'}</td><td class="dim ellipsis" style="max-width:220px" title="${esc([...(prodOf[o] || [])].join(", "))}">${esc([...(prodOf[o] || ["not wired"])].join(", "))}</td><td class="dim">${esc(m.by || "")}</td></tr>`; }).join("")}</tbody></table>` : '<div class="muted">Nothing on. Move the slide or press a key.</div>'}
      ${Object.keys(r.off_by).length ? `<div class="muted" style="margin-top:10px;font-size:12px">Forced off: ${Object.entries(r.off_by).map(([o, b]) => `${o} by ${esc(b)}`).join(", ")}</div>` : ""}</div>
    ${pressedPatternHtml()}
    <div class="card"><div class="card-head"><h3>Priority</h3><span class="sub">Top wins</span></div><div class="chips">${((S.st.controls || {}).priority || []).map((p, i) => `<span class="chip">${i + 1}. ${esc(p)}</span>`).join("")}</div></div>
    ${r.notes.length ? `<div class="card"><div class="card-head"><h3>Plan notes</h3></div><div class="list">${r.notes.map((n) => `<div class="list-row">${ic("info")}<span class="t dim">${esc(n)}</span></div>`).join("")}</div></div>` : ""}
    <div class="muted" style="font-size:11.5px">Source: ${esc(((S.st.controls || {}).head || {}).source || "")}. Slide LEDs: which LED lights at each position is not confirmed yet.</div>`;
  paintSiren();
};

function pressedPatternHtml() {
  const p = S.sim.presses || {}, btns = (S.st.controls || {}).buttons || [];
  const rows = Object.entries(p).map(([name, n]) => {
    const b = btns.find((x) => x.name === name) || {}, st = +b.press_states || 0;
    return `<div class="list-row">${ic("info")}<span class="t"><b>${esc(name)}</b> <span class="dim">${st ? `pattern state ${((n - 1) % st) + 1} of ${st}` : `pressed ${n}x`}. Turns nothing on; steps the CanTrol-flashed pattern in the truck.</span></span></div>`;
  });
  return rows.length ? `<div class="card"><div class="card-head"><h3>Pattern keys</h3><span class="sub">Press state</span></div><div class="list">${rows.join("")}</div></div>` : "";
}

// ------------------------------------------------------------------ sync view
RENDER.sync = async (main) => {
  main.innerHTML = `<div class="view"><div class="empty"><div class="spinner"></div>Loading sync settings…</div></div>`;
  const r = await api("sync_status");
  if (!r.ok) { main.innerHTML = `<div class="view"><div class="alert bad">${esc(r.error)}</div></div>`; return; }
  const s = r.settings, last = r.last || {};
  const live = S.st.workspace.mode !== "sandbox";
  main.innerHTML = `<div class="view">
    <div class="page-head"><div><div class="eyebrow">Sync</div><h1>Every save, everywhere, with no retyping</h1>
      <p>Each save to the live upfit.yaml is logged, then copied and committed to the targets below. A push only happens where you switch it on, using your own Git and GitHub sign-in; before each push the app pulls the latest from GitHub, so changes made elsewhere never block it. The app itself never goes online. Sandbox saves stay local until you promote them.</p></div>
      <div class="actions"><button class="btn primary" id="syncNow" ${live ? "" : "disabled"}>${ic("play")} Sync now</button></div></div>
    ${r.git ? "" : `<div class="alert amber" style="margin-bottom:12px">${ic("alert", 18)}<div><b>Git isn't installed on this PC</b><span class="dim">Install Git for Windows (it includes the GitHub sign-in helper), then clone your repos. Folder sync works without it.</span></div></div>`}
    <div class="grid g-2">
      <div class="card"><div class="card-head"><h3>Settings</h3><span class="sub">config/sync.yaml</span></div>
        <label class="check"><input type="checkbox" id="sEnabled" ${s.enabled ? "checked" : ""}> Sync after every save</label>
        <h2 class="section">Project repo <span class="muted" style="text-transform:none;letter-spacing:0">· the Claude project reads your build from here</span></h2>
        <div class="field"><label>Local clone folder</label><input class="input" id="sPr" value="${esc(s.project_repo.path)}" placeholder="C:\\Users\\you\\Documents\\GitHub\\f150-upfit"></div>
        <div class="field"><label>Subfolder in the repo</label><input class="input" id="sPrSub" value="${esc(s.project_repo.subdir)}"></div>
        <label class="check"><input type="checkbox" id="sPrPush" ${s.project_repo.push ? "checked" : ""}> Pull latest, then push after each commit</label>
        <h2 class="section">Signal &amp; Systems portfolio <span class="muted" style="text-transform:none;letter-spacing:0">· public-safe data only</span></h2>
        <div class="field"><label>Local clone of signal-and-systems</label><input class="input" id="sPo" value="${esc(s.portfolio_repo.path)}" placeholder="C:\\Users\\you\\Documents\\GitHub\\signal-and-systems"></div>
        <div class="field"><label>Data file in that repo</label><input class="input" id="sPoFile" value="${esc(s.portfolio_repo.data_file)}"></div>
        <label class="check"><input type="checkbox" id="sPoPrice" ${s.portfolio_repo.include_prices ? "checked" : ""}> Include part prices</label>
        <label class="check"><input type="checkbox" id="sPoPush" ${s.portfolio_repo.push ? "checked" : ""}> Pull latest, then push after each commit (your site redeploys on every push to main)</label>
        <h2 class="section">Plain folder <span class="muted" style="text-transform:none;letter-spacing:0">· for example your OneDrive project folder</span></h2>
        <div class="field"><label>Folder</label><input class="input" id="sFo" value="${esc(s.folder.path)}"></div>
        <div style="display:flex;gap:8px;margin-top:10px"><button class="btn primary" id="sSave">Save settings</button><button class="btn" id="sPreview">Preview portfolio data</button></div></div>
      <div class="grid" style="align-content:start">
        <div class="card"><div class="card-head"><h3>Last sync</h3><span class="sub">${esc(last.when || "not yet")}</span></div>
          ${(last.targets || []).length ? `<div class="list">${last.targets.map((t) => `<div class="list-row"><span class="pill ${t.ok ? "good" : "bad"}">${t.ok ? "OK" : "Failed"}</span><span class="t"><b>${esc(t.target)}</b><div class="muted" style="font-size:12px">${esc(t.detail)}</div></span></div>`).join("")}</div>` : `<div class="muted">${esc(last.note || "Nothing synced yet in this session.")}</div>`}</div>
        <div class="card"><div class="card-head"><h3>Change log</h3><span class="sub">config/sync_log.yaml · newest first</span></div>
          ${r.log.length ? `<table class="data compact"><tbody>${r.log.map((x) => `<tr><td class="mono dim" style="white-space:nowrap">${esc(x.when)}</td><td>${esc(x.change)}</td><td class="mono dim">${esc(x.backup || "")}</td></tr>`).join("")}</tbody></table>` : '<div class="muted">No saves logged yet.</div>'}</div>
        <div class="card"><div class="card-head"><h3>What goes where</h3></div><div class="dim" style="font-size:12.5px;line-height:1.6">
          Project repo: upfit.yaml, install_progress.yaml and sync_log.yaml, exactly as saved.<br>
          Portfolio: one JSON file with products, circuits, wires, the control plan and the head key labels. No notes, order numbers or prices unless you tick prices.<br>
          Folder: the same three files as the project repo.</div></div>
      </div></div></div>`;
  const val = () => ({
    enabled: $("#sEnabled").checked,
    project_repo: { path: $("#sPr").value, subdir: $("#sPrSub").value, push: $("#sPrPush").checked },
    portfolio_repo: { path: $("#sPo").value, data_file: $("#sPoFile").value, push: $("#sPoPush").checked, include_prices: $("#sPoPrice").checked },
    folder: { path: $("#sFo").value },
  });
  $("#sSave").onclick = async () => { const x = await api("sync_settings", val()); x.ok ? toast("Sync settings saved") : toast(x.error, "bad"); };
  $("#sPreview").onclick = async () => {
    const x = await api("portfolio_preview");
    if (!x.ok) return toast(x.error, "bad");
    drawer("Portfolio data preview", "What the site would receive", `<pre class="code" style="max-height:70vh;overflow:auto;font-size:11.5px">${esc(JSON.stringify(x.data, null, 2))}</pre>`, `<button class="btn ghost" data-close>Close</button>`);
  };
  $("#syncNow").onclick = async () => {
    await api("sync_settings", val());
    $("#syncNow").disabled = true;
    const x = await api("sync_now");
    syncBadge(x.last);
    x.ok ? toast(x.last.ok === false ? "Sync finished with errors" : x.last.note || "Synced", x.last.ok === false ? "bad" : "good") : toast(x.error, "bad");
    RENDER.sync(main);
  };
};
