/*
 * Browser-only stand-in for Upfit Studio's Python back end (window.__pyapi, which app.js supports).
 * Answers come from data/recorded.json and the simulator shards, recorded from the real app.
 * The wire & fuse calculator and bench current check are the app's own formulas, carried over
 * line for line from upfit/electrical.py and upfit/bench.py. Every edit is refused: the demo is read-only.
 */
(function () {
  const READ_ONLY = "This is the read-only online demo. Edits, saves and exports work in the desktop app.";
  const DESKTOP = "Not available in the browser demo: this opens files or folders on the computer running the app.";
  const err = (m, field) => ({ ok: false, error: m, field: field || null });
  let rec = null;
  const recP = fetch("data/recorded.json").then((r) => r.json()).then((j) => (rec = j));
  const shardCache = {};
  async function shard(name) {
    if (!shardCache[name]) {
      shardCache[name] = fetch("data/sim-" + name + ".json.gz").then(async (r) => {
        const ds = new DecompressionStream("gzip");
        const text = await new Response(r.body.pipeThrough(ds)).text();
        return JSON.parse(text);
      });
    }
    return shardCache[name];
  }
  const key = (name, args) => JSON.stringify([name, args]);

  // ---- carried over from upfit/electrical.py
  const row = (ref, awg) => { const r = ref.gauges[String(awg)]; if (!r) throw new Error("AWG " + awg + " is not in the wire reference table"); return r; };
  const rpf = (ref, awg) => row(ref, awg).resistance_ohm_per_1000ft / 1000.0;
  const ampacity = (ref, awg) => Number(row(ref, awg).ampacity_a);
  const vdrop = (ref, cur, feed, len, gnd, glen) => cur * (rpf(ref, feed) * len + rpf(ref, gnd == null ? feed : gnd) * glen);
  const dropPct = (d, nom) => (100.0 * d) / nom;
  const minFuse = (cur, h) => cur * h;
  function recFuse(ref, cur, h) { const need = minFuse(cur, h); const sizes = ref.standard_fuse_sizes_a.slice().sort((x, y) => x - y);
    for (const s of sizes) if (s >= need - 1e-9) return Number(s); return null; }
  const thinToThick = (ref) => Object.keys(ref.gauges).sort((x, y) => parseInt(y) - parseInt(x));
  function recAwg(ref, fuse, cur, len, glen, nom, lim) {
    for (const g of thinToThick(ref)) { if (ampacity(ref, g) < fuse) continue;
      if (dropPct(vdrop(ref, cur, g, len, g, glen), nom) <= lim) return g; }
    return null;
  }
  // Python's round(): rounds the exact binary value, ties to even.
  const r3 = (v, n) => {
    const s = v.toFixed(n + 25 > 100 ? 100 : n + 25); // exact enough decimal expansion
    const fixed = Number(v.toFixed(n));
    const tail = s.slice(s.indexOf(".") + 1 + n);
    if (/^50*$/.test(tail)) { // exact tie: choose the even last digit
      const f = Math.pow(10, n); const lo = Math.floor(v * f);
      return (lo % 2 === 0 ? lo : lo + 1) / f;
    }
    return fixed;
  };
  const num = (v) => { if (v === null || v === undefined || v === "") return NaN; const n = Number(v); return Number.isFinite(n) ? n : NaN; };
  function calculate(current_a, length_ft, awg, ground_ft, critical) {
    if (critical === undefined) critical = true;
    const cur = num(current_a), len = num(length_ft);
    const gnd = ground_ft === null || ground_ft === undefined || ground_ft === "" ? len : num(ground_ft);
    if ([cur, len, gnd].some(Number.isNaN)) return err("Enter current and length as numbers");
    if (cur < 0 || len < 0 || gnd < 0) return err("Values can't be negative");
    const ref = rec.ref, sys = rec.system;
    const nominal = Number(sys.nominal_voltage), limit = Number(critical ? sys.critical_drop_pct : sys.noncritical_drop_pct);
    const headroom = Number(sys.fuse_headroom);
    const fuse = recFuse(ref, cur, headroom);
    const rows = thinToThick(ref).map((g) => { const d = vdrop(ref, cur, g, len, g, gnd); const p = dropPct(d, nominal); const amp = ampacity(ref, g);
      return { awg: g, drop_v: r3(d, 3), drop_pct: r3(p, 2), ampacity_a: amp, ok_drop: p <= limit, ok_fuse: fuse !== null && amp >= fuse }; });
    const best = fuse ? recAwg(ref, fuse, cur, len, gnd, nominal, limit) : null;
    const chosen = awg === null || awg === undefined || awg === "" ? null : rows.find((r) => r.awg === String(awg)) || null;
    return { ok: true, fuse_a: fuse, recommended_awg: best, rows, chosen, limit_pct: limit, min_fuse_a: r3(minFuse(cur, headroom), 3), headroom };
  }
  // ---- carried over from upfit/bench.py evaluate_current
  function benchCheck(cid, measured) {
    const step = (rec.calls[key("bench_plan", [])].steps || []).find((s) => s.circuit_id === cid);
    if (!step) return err("No circuit " + cid);
    const m = measured === null || measured === undefined || measured === "" ? null : num(measured);
    if (Number.isNaN(m)) return err("Current must be a number");
    if (m !== null && m < 0) return err("Current can't be negative");
    let status;
    if (step.circuit_type === "speaker") status = "N/A";
    else if (m === null) status = "SKIPPED";
    else if (step.expected_a === null || step.expected_a === undefined) status = "BASELINE";
    else status = step.min_a <= m && m <= step.max_a ? "PASS" : "FAIL";
    return { ok: true, status };
  }

  const WRITES = new Set(["save_circuit", "save_wire", "delete_wire", "save_part", "add_part", "save_bench", "set_progress",
    "restore_backup", "create_scenario", "open_scenario", "promote_scenario", "delete_scenario", "apply_fix", "add_circuit",
    "delete_circuit", "set_control", "set_head_key", "set_canport", "set_flash", "sync_settings", "sync_now", "mount_export",
    "build_outputs", "installer_packet", "preview_circuit", "compare_backup", "mount_preview"]);
  const LOCAL = new Set(["open_path", "open_folder", "choose_config", "open_config"]);

  async function call(name, args) {
    await recP;
    if (name === "simulate") {
      const [slide, pressed, brake, phase] = args;
      const b = !!brake, ph = b && phase === "held" ? "held" : "pop";
      const shardName = (slide || "off") + "-" + (b ? (ph === "held" ? "held" : "brake") : "nobrake");
      const k = JSON.stringify([slide || null, (pressed || []).slice().sort(), b, ph]);
      const d = await shard(shardName);
      return d[k] || err("The online demo simulates up to three buttons at once. The desktop app has no limit.");
    }
    if (name === "calculate") return calculate(...args);
    if (name === "bench_check") return benchCheck(...args);
    if (WRITES.has(name)) return err(READ_ONLY);
    if (LOCAL.has(name)) return err(DESKTOP);
    const hit = rec.calls[key(name, args)] || rec.calls[key(name, [])];
    return hit || err(READ_ONLY);
  }
  // The budget card would only show blanked prices, so it is hidden in the demo.
  const hideBudget = () => document.querySelectorAll(".card").forEach((c) => {
    const h = c.querySelector("h3"); if (h && /^Budget/.test(h.textContent.trim())) c.classList.add("demo-hide"); });
  new MutationObserver(hideBudget).observe(document.documentElement, { childList: true, subtree: true });
  window.__pyapi = async (name, argsJson) => JSON.stringify(await call(name, JSON.parse(argsJson || "[]")));
})();
