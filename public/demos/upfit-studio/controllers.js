/* 0.6.0 (file renamed from aux.js in 0.8.1: AUX is a reserved name on Windows): the two stand-alone controllers on the Control head page, beside the CCTL7.
   - SpeedTech Lights Super Take Down Grand Control Switch Box (C-GCBSTD): runs the visor bar.
     Button functions from the STL manual (source-docs/stl-grand-control/80775STL_Grand_Control_STD.pdf, p.4).
   - BooYu controller for the BooYu Rear LED TIR Amber Warning Light & Traffic Advisor:
     POWER, NEXT, LAST, three arrow keys, a 2-digit mode display and 8 blue indicator LEDs (William's photo).
   Each one only gets 12V when its CanTrol output is on (J1-2 / J1-3), as in the plan.
   What each one does to its light is drawn in the same Light preview as everything else.
   Nothing here is bench-tested; flash timing is illustrative. */
"use strict";

const AUX = {
  stl: { power: true, mode: 1, pattern: { 1: 1, 2: 1 }, steady: false, random: false, td: false, std: false, night: false },
  booyu: { power: true, mode: 1, dir: null },
};

function auxCfg(type) { return (((S.st.controls || {}).aux_heads) || []).find((h) => h.type === type) || null; }
function auxSupplied(cfg) {
  const r = S.sim.res; return !!(cfg && r && r.active && r.active[cfg.supply]);
}

// ---------------------------------------------------------------- light cells for the preview
// Called from cellsFor() in head.js for the visor bar and the BooYu. Returns null to use the default.
window.auxCells = function auxCells(dev) {
  const stlCfg = auxCfg("stl_grand_control"), byCfg = auxCfg("booyu_controller");
  const n = dev.segments || 8;
  const off = Array.from({ length: n }, () => ({ cls: "off" }));
  if (stlCfg && dev.part_id === stlCfg.part) {
    if (!dev.powered) return off;
    const s = AUX.stl;
    // TD / Super TD are steady burn and work without POWER (manual p.4). Their LED colour isn't confirmed.
    if (s.std || s.td) return off.map(() => ({ cls: "steady", c: LIGHT.tbd, tbd: true }));
    if (!s.power || !s.mode) return off;
    const amber = LIGHT.amber;
    if (s.steady) return off.map(() => ({ cls: "steady", c: amber }));
    return off.map((_, i) => ({ cls: "pattern " + (i < n / 2 ? "flashA" : "flashB"), c: amber }));
  }
  if (byCfg && dev.part_id === byCfg.part) {
    if (!dev.powered || !AUX.booyu.power) return off;
    const b = AUX.booyu, amber = LIGHT.amber;
    if (b.dir) {
      return off.map((_, i) => {
        const step = b.dir === "right" ? i : b.dir === "left" ? n - 1 - i : Math.abs((n - 1) / 2 - i) | 0;
        const steps = b.dir === "center" ? n / 2 : n;
        return { cls: "arrow", c: amber, delay: step * (0.7 / steps) };
      });
    }
    if (b.mode === 1) return off.map(() => ({ cls: "steady", c: amber }));
    return off.map((_, i) => ({ cls: "pattern " + (i % 2 ? "flashB" : "flashA"), c: amber }));
  }
  return null;
};

function auxStateText(dev) {
  const stlCfg = auxCfg("stl_grand_control"), byCfg = auxCfg("booyu_controller");
  if (stlCfg && dev.part_id === stlCfg.part) {
    const s = AUX.stl;
    if (!dev.powered) return `No 12V: ${stlCfg.supply} is off`;
    if (s.std) return "Super TD steady burn";
    if (s.td) return "TD steady burn";
    if (!s.power) return "Switch box POWER off";
    if (!s.mode) return "No mode on";
    return `Mode ${s.mode}, ${s.steady ? "steady burn" : s.random ? "random patterns" : `pattern ${s.pattern[s.mode]}`}`;
  }
  if (byCfg && dev.part_id === byCfg.part) {
    const b = AUX.booyu;
    if (!dev.powered) return `No 12V: ${byCfg.supply} is off`;
    if (!b.power) return "Controller POWER off";
    if (b.dir) return { left: "Arrow left", right: "Arrow right", center: "Center out" }[b.dir];
    return `Mode ${b.mode}: ${booyuPatternName(b.mode)}`;
  }
  return null;
}
window.auxStateText = auxStateText;

function booyuPatternName(m) {
  const p = ((auxCfg("booyu_controller") || {}).patterns || {})[m] || ((auxCfg("booyu_controller") || {}).patterns || {})[String(m)];
  return p || "not recorded yet";
}

// ---------------------------------------------------------------- the two controller panels
window.auxPanelsHtml = function auxPanelsHtml() {
  const stl = auxCfg("stl_grand_control"), by = auxCfg("booyu_controller");
  if (!stl && !by) return "";
  return `<div class="aux-row">${stl ? stlPanel(stl) : ""}${by ? booyuPanel(by) : ""}</div>`;
};

function stlPanel(cfg) {
  const s = AUX.stl, sup = auxSupplied(cfg);
  const lit = (on) => (sup && on ? "lit" : "");
  const key = (id, label, on, title) => `<button class="akey ${lit(on)} ${s.night && sup ? "night" : ""}" data-stl="${id}" title="${esc(title)}">${label}</button>`;
  return `<div class="card aux-card"><div class="card-head"><h3>${esc(cfg.short_label || "Grand Control Box")}</h3><span class="sub">${sup ? `12V from ${esc(cfg.supply)}` : `<span class="pill muted">No 12V: ${esc(cfg.supply)} off</span>`}</span></div>
    <div class="dim aux-name" title="${esc(cfg.name)}">${esc(cfg.name)} · runs the visor bar</div>
    <div class="stl-box ${sup ? "" : "dark"}">
      <div class="stl-row">${key("power", "POWER", s.power, "Turns the switch box on or off")}${key("m1", "MODE1", s.power && s.mode === 1, "Flash pattern memory 1")}${key("m2", "MODE2", s.power && s.mode === 2, "Flash pattern memory 2")}</div>
      <div class="stl-row">${key("pattern", "PATTERN", s.power && (s.steady || s.random), "Press: next pattern. Hold 3 s: steady burn on/off. Hold 5 s: random patterns on/off")}${key("td", "TD", s.td, "1st press TD steady burn on, 2nd press off. Works without POWER")}${key("std", "SUPER<br>TD", s.std, "1st press Super TD steady burn on, 2nd press off. Works without POWER")}${key("night", "NIGHT", s.night, "Backlight on/off")}</div>
    </div>
    <div class="aux-read">${sup ? esc(stlRead()) : "Move the CCTL7 slide to 1, 2 or 3 to feed it."}</div>
    <div class="muted aux-foot">POWER and active keys light blue, NIGHT backlights the keys red (your description; the STL manual only says NIGHT turns on the backlight). Hold PATTERN 3 s for steady burn, 5 s for random. Today the box is on the 12V socket; the plan moves it to ${esc(cfg.supply)}.</div></div>`;
}
function stlRead() {
  const s = AUX.stl;
  if (s.std) return "Super TD steady burn (TD LED colour not confirmed)";
  if (s.td) return "TD steady burn (TD LED colour not confirmed)";
  if (!s.power) return "POWER off. TD and Super TD still work.";
  if (!s.mode) return "On, no mode selected";
  return `Mode ${s.mode}: ${s.steady ? "steady burn" : s.random ? "random patterns" : `pattern ${s.pattern[s.mode]} (STL doesn't list the patterns in this manual)`}`;
}

function booyuPanel(cfg) {
  const b = AUX.booyu, sup = auxSupplied(cfg), on = sup && b.power;
  const disp = !on ? "" : b.dir ? { left: "◄", right: "►", center: "◄►" }[b.dir] : String(b.mode).padStart(2, " ");
  const cells = on ? window.auxCells({ part_id: cfg.part, powered: true, segments: 8 }) : Array.from({ length: 8 }, () => ({ cls: "off" }));
  const leds = cells.map((x) => `<i class="bled ${x.cls === "off" ? "" : x.cls.replace("pattern ", "")}" style="${x.delay !== undefined ? `animation-delay:${x.delay.toFixed(2)}s` : ""}"></i>`).join("");
  const k = (id, label, title, lit) => `<button class="akey by ${lit ? "lit" : ""}" data-by="${id}" title="${esc(title)}">${label}</button>`;
  return `<div class="card aux-card"><div class="card-head"><h3>${esc(cfg.short_label || "BooYu controller")}</h3><span class="sub">${sup ? `12V from ${esc(cfg.supply)}` : `<span class="pill muted">No 12V: ${esc(cfg.supply)} off</span>`}</span></div>
    <div class="dim aux-name" title="${esc(cfg.name)}">${esc(cfg.name)}</div>
    <div class="by-box ${sup ? "" : "dark"}">
      <div class="by-top"><div class="by-disp">${esc(disp)}</div><div class="by-leds">${leds}</div></div>
      <div class="by-keys">${k("left", "◄", "Arrow left", on && b.dir === "left")}${k("center", "◄►", "Center out", on && b.dir === "center")}${k("right", "►", "Arrow right", on && b.dir === "right")}
        ${k("last", "LAST", "Previous flash mode", false)}${k("next", "NEXT", "Next flash mode", false)}${k("power", "POWER", "Turns the controller on or off", on)}</div>
    </div>
    <div class="aux-read">${on ? esc(b.dir ? `${{ left: "Arrow left", right: "Arrow right", center: "Center out" }[b.dir]} (press again for flash modes)` : `Mode ${b.mode} of ${cfg.modes || 26}: ${booyuPatternName(b.mode)}`) : sup ? "POWER off" : "Move the CCTL7 slide to 1, 2 or 3 to feed it."}</div>
    <div class="muted aux-foot">Modes 1 to ${cfg.modes || 26} plus 3 arrow modes (your photo). Only mode 1 is recorded (steady burn, whole bar amber); the rest show a placeholder flash until you send the pattern video. What the display shows in arrow modes, and whether the 8 blue LEDs map one-to-one to the bar, isn't confirmed.</div></div>`;
}

// ---------------------------------------------------------------- key handling
window.bindAux = function bindAux() {
  $$("[data-stl]").forEach((btn) => {
    const id = btn.dataset.stl;
    if (id === "pattern") {
      let t0 = 0;
      btn.onpointerdown = () => { t0 = Date.now(); };
      btn.onpointerup = () => { if (!t0) return; const held = (Date.now() - t0) / 1000; t0 = 0; stlPress("pattern", held); };
      btn.onpointerleave = () => { t0 = 0; };
    } else btn.onclick = () => stlPress(id, 0);
  });
  $$("[data-by]").forEach((btn) => (btn.onclick = () => booyuPress(btn.dataset.by)));
};

function stlPress(id, held) {
  const s = AUX.stl, cfg = auxCfg("stl_grand_control");
  if (!auxSupplied(cfg)) { toast(`The Grand Control Box has no 12V: ${cfg.supply} is off. Move the CCTL7 slide to 1, 2 or 3.`, "info"); return; }
  if (id === "power") s.power = !s.power;
  else if (id === "night") s.night = !s.night;
  else if (id === "td") s.td = !s.td;
  else if (id === "std") s.std = !s.std;
  else if (!s.power) { toast("Turn the switch box POWER on first (TD, Super TD and NIGHT work without it).", "info"); return; }
  else if (id === "m1" || id === "m2") { const m = id === "m1" ? 1 : 2; s.mode = s.mode === m ? null : m; }
  else if (id === "pattern") {
    if (held >= 5) { s.random = !s.random; s.steady = false; toast(`Random pattern mode ${s.random ? "on" : "off"} (held 5 s)`, "info"); }
    else if (held >= 3) { s.steady = !s.steady; s.random = false; toast(`Steady burn ${s.steady ? "on" : "off"} (held 3 s)`, "info"); }
    else if (s.mode) { s.pattern[s.mode] = (s.pattern[s.mode] || 1) + 1; s.steady = false; s.random = false; }
    else { toast("Pick MODE1 or MODE2 first; PATTERN changes the pattern in that mode.", "info"); return; }
  }
  auxRefresh();
}

function booyuPress(id) {
  const b = AUX.booyu, cfg = auxCfg("booyu_controller"), n = +cfg.modes || 26;
  if (!auxSupplied(cfg)) { toast(`The BooYu has no 12V: ${cfg.supply} is off. Move the CCTL7 slide to 1, 2 or 3.`, "info"); return; }
  if (id === "power") b.power = !b.power;
  else if (!b.power) { toast("Turn the BooYu controller POWER on first.", "info"); return; }
  else if (id === "next" || id === "last") { b.dir = null; b.mode = ((b.mode - 1 + (id === "next" ? 1 : -1) + n) % n) + 1; }
  else b.dir = b.dir === id ? null : id;
  auxRefresh();
}

function auxRefresh() {
  const box = $("#auxPanels");
  if (box) { box.innerHTML = window.auxPanelsHtml(); window.bindAux(); }
  if (S.sim.res && typeof renderLightScene === "function") renderLightScene(S.sim.res);
}
window.auxRefresh = auxRefresh;

// ---------------------------------------------------------------- 0.8.0: CANport (OBDII) inputs
// Up to 8 CAN signal commands picked from Whelen Command's list for the vehicle. "On" simulates the
// truck sending that signal (e.g. pressing the brake pedal) so you can see what it triggers.
const CAN = { info: null, on: new Set(), edit: false };

window.canportPanelHtml = function canportPanelHtml() {
  const cp = (S.st.controls || {}).canport;
  if (!cp) return "";
  const info = CAN.info;
  if (!info) { loadCanInfo(); return `<div class="card"><div class="card-head"><h3>CANport inputs</h3></div><div class="muted">Loading…</div></div>`; }
  const bySlot = Object.fromEntries((info.commands || []).map((c) => [c.slot, c]));
  const rows = Array.from({ length: info.max }, (_, i) => i + 1).map((slot) => {
    const c = bySlot[slot] || {};
    if (CAN.edit) {
      const sig = `<select data-can-sig="${slot}"><option value="">Unused</option>${info.signals.map((s) => `<option ${s === c.signal ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>`;
      const act = `<select data-can-act="${slot}">${info.actions.map((a) => `<option ${a === (c.action || "None (input only)") ? "selected" : ""}>${esc(a)}</option>`).join("")}</select>`;
      return `<tr><td class="mono">CAN ${slot}</td><td>${sig}</td><td>${act}</td><td></td></tr>`;
    }
    if (!c.signal) return `<tr class="dim"><td class="mono">CAN ${slot}</td><td colspan="3">Unused</td></tr>`;
    const value = info.value_signals.includes(c.signal);
    const on = CAN.on.has(slot);
    return `<tr><td class="mono">CAN ${slot}</td><td>${esc(c.signal)}${value ? ' <span class="pill amber" title="A value, not on/off: its threshold is set in Command">value</span>' : ""}</td><td>${esc(c.action)}</td>
      <td>${value ? '<span class="muted">not simulated</span>' : `<button class="btn ${on ? "primary" : ""}" data-can-on="${slot}" title="Simulate the truck sending this signal">${on ? "Signal on" : "Signal off"}</button>`}</td></tr>`;
  }).join("");
  const warn = (info.checks || []).map((w) => `<div class="alert ${w.severity === "ERROR" ? "bad" : "amber"}">${ic("alert", 18)}<div><b>${esc(w.subject)}</b><span class="dim">${esc(w.message)}</span></div></div>`).join("");
  return `<div class="card"><div class="card-head"><h3>CANport inputs (OBDII)</h3><span class="sub">${esc(cp.vehicle || "")} · up to ${info.max} signals</span>
      <div style="margin-left:auto;display:flex;gap:8px">${CAN.edit ? `<button class="btn" id="canCancel">Cancel</button><button class="btn primary" id="canSave">Save</button>` : `<button class="btn" id="canWln" title="Read-only: compare a Whelen Command .wln file's CAN signals with this plan">Compare with Command file</button><button class="btn" id="canEdit">${ic("edit")} Edit signals</button>`}</div></div>
    ${warn}${canCompareHtml()}<table class="data compact"><thead><tr><th>Slot</th><th>Signal (Command name)</th><th>Does</th><th>Simulate</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="muted aux-foot">Signal names come from Whelen Command's Configure CANport list for ${esc(cp.vehicle || "this vehicle")} (${info.signals.length} signals). Studio only plans and simulates these; you pick them in Command and transfer them to the CANport over USB. Kit: ${esc(cp.kit || "")}.</div></div>`;
};

function canCompareHtml() {
  const r = CAN.cmp; if (!r) return "";
  const list = (a) => (a.length ? a.map(esc).join(", ") : "none");
  const same = !r.only_in_file.length && !r.only_in_plan.length;
  return `<div class="alert ${same ? "" : "amber"}">${ic("alert", 18)}<div><b>${esc(r.file)}${r.command_version ? ` (Command ${esc(r.command_version)})` : ""}: ${same ? "CAN signals match the plan" : "CAN signals differ from the plan"}</b>
    <span class="dim">In the file: ${list(r.can_in_file)}.</span>
    ${r.only_in_file.length ? `<span class="dim">Only in the Command file: ${list(r.only_in_file)}.</span>` : ""}
    ${r.only_in_plan.length ? `<span class="dim">Only in this plan: ${list(r.only_in_plan)}.</span>` : ""}
    <span class="dim">${esc(r.note)}</span></div></div>`;
}
async function loadCanInfo() {
  const r = await api("canport_info");
  if (!r.ok) { toast(r.error, "bad"); return; }
  CAN.info = r; canRefresh();
}
function canRefresh() {
  const box = $("#canportPanel"); if (!box) return;
  box.innerHTML = window.canportPanelHtml(); window.bindCanport();
}
window.canRefresh = canRefresh;

window.bindCanport = function bindCanport() {
  $("#canWln") && ($("#canWln").onclick = async () => {
    const r = await api("compare_command_file");
    if (!r.ok) { if (r.error) toast(r.error, "bad"); return; }
    CAN.cmp = r; canRefresh();
  });
  $("#canEdit") && ($("#canEdit").onclick = () => { CAN.edit = true; canRefresh(); });
  $("#canCancel") && ($("#canCancel").onclick = () => { CAN.edit = false; canRefresh(); });
  $("#canSave") && ($("#canSave").onclick = async () => {
    const cmds = $$("[data-can-sig]").map((s) => ({ slot: +s.dataset.canSig, signal: s.value, action: $(`[data-can-act="${s.dataset.canSig}"]`).value }))
      .filter((c) => c.signal)
      .map((c) => { const old = (CAN.info.commands || []).find((x) => x.signal === c.signal && x.action === c.action); return old && old.note ? { ...c, note: old.note } : c; });
    const r = await api("set_canport", cmds);
    if (!r.ok) return toast(r.error, "bad");
    CAN.edit = false; CAN.on.clear(); CAN.info = null;
    afterSave(r, "CANport signals saved");
  });
  $$("[data-can-on]").forEach((b) => (b.onclick = () => {
    const slot = +b.dataset.canOn, c = (CAN.info.commands || []).find((x) => x.slot === slot);
    const on = !CAN.on.has(slot);
    on ? CAN.on.add(slot) : CAN.on.delete(slot);
    if (c.action === "Arrows off when signal ends") {
      const arrows = ((S.st.controls || {}).buttons || []).filter((x) => x.sweep).map((x) => x.name);
      if (!on) { const was = arrows.filter((n) => S.sim.pressed.has(n)); was.forEach((n) => S.sim.pressed.delete(n)); runSim();
        toast(`${c.signal} off: ${was.length ? was.join(", ") + " switched off" : "no arrows were on"}. You can press them on again.`, "info", 6000); }
      else { toast(`${c.signal} on: arrows unchanged`, "info"); canRefresh(); }
    } else if (c.action === "SCENE and TAKE DOWN off when signal starts") {
      if (on) { const was = ["SCENE", "TAKE DOWN"].filter((n) => S.sim.pressed.has(n)); was.forEach((n) => S.sim.pressed.delete(n)); runSim();
        toast(`${c.signal} on: ${was.length ? was.join(" and ") + " switched off" : "SCENE and TAKE DOWN were already off"}. You can press them on again.`, "info", 6000); }
      else { toast(`${c.signal} off: nothing changes`, "info"); canRefresh(); }
    } else if (c.action === "Brake pop") setBrake(on);
    else if (c.action && c.action !== "None (input only)") toggleButton(c.action, on);
    else { toast(`${c.signal} ${on ? "on" : "off"}: no action planned for it yet`, "info"); canRefresh(); }
  }));
};
window.CAN_EDITING = () => CAN.edit;
