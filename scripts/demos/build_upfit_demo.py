"""Build the browser demo of Upfit Studio into public/demos/upfit-studio/.

Usage: python3 scripts/demos/build_upfit_demo.py /path/to/f150-upfit-studio
Needs PyYAML. Works on a temporary copy with prices blanked and part notes removed
(the same rules as the site's screenshots). Copies only the UI files (HTML, CSS, JS);
the Python back end is replaced by recorded answers plus scripts/demos/upfit-shim.js.
"""
import gzip, hashlib, itertools, json, re, shutil, sys, tempfile
from pathlib import Path

src = Path(sys.argv[1]).resolve()
site = Path(__file__).resolve().parents[2]
out = site / "public/demos/upfit-studio"
tmp = Path(tempfile.mkdtemp()) / "us"
shutil.copytree(src, tmp, ignore=shutil.ignore_patterns(".git", "build", "dist", "outputs", "*.egg-info", ".pytest_cache"))

# Public-safe config: no prices, no part notes.
import yaml
cfg_path = tmp / "config/upfit.yaml"
cfg = yaml.safe_load(cfg_path.read_text(encoding="utf-8"))
for p in (cfg.get("parts") or {}).values() if isinstance(cfg.get("parts"), dict) else (cfg.get("parts") or []):
    if isinstance(p, dict):
        if "price_usd" in p: p["price_usd"] = None
        p.pop("notes", None)
cfg_path.write_text(yaml.safe_dump(cfg, sort_keys=False, allow_unicode=True), encoding="utf-8")

sys.path.insert(0, str(tmp))
from upfit.studio_api import StudioApi  # noqa: E402
from upfit import __version__  # noqa: E402
a = StudioApi(str(cfg_path))
CFG_SHOWN = "C:\\upfit-kit\\config\\upfit.yaml"

def clean(obj):
    s = json.dumps(obj, separators=(",", ":"), ensure_ascii=False)
    s = s.replace(json.dumps(str(cfg_path))[1:-1], CFG_SHOWN.replace("\\", "\\\\")).replace("config/upfit.yaml", CFG_SHOWN.replace("\\", "\\\\"))
    s = s.replace(str(tmp), "C:\\\\upfit-kit")
    return json.loads(s)

rec = {}
def keep(name, args, res): rec[json.dumps([name, list(args)], separators=(",", ":"))] = clean(res)
state = a.state()
keep("state", [], state); keep("reload", [], state)
for name in ["sync_status", "portfolio_preview", "canport_info", "compare_command_file", "bench_plan",
             "continuity_checklist", "install_sheet_text", "mount_defaults", "run_tests", "list_backups"]:
    keep(name, [], getattr(a, name)())
keep("compare_scenario", [None], a.compare_scenario(None))
for c in state["circuits"]:
    keep("harness_svg", [c["id"]], a.harness_svg(c["id"]))

# Simulator: every slide position x brake state x up to three buttons at once.
names = sorted(b["name"] for b in a.cfg["controls"]["buttons"])
shards = {}
for k in range(4):
    for combo in itertools.combinations(names, k):
        for slide in (None, "1", "2", "3"):
            for brake, phase in ((False, "pop"), (True, "pop"), (True, "held")):
                key = json.dumps([slide, list(combo), brake, phase], separators=(",", ":"), ensure_ascii=False)
                shard = f"{slide or 'off'}-{'held' if brake and phase == 'held' else 'brake' if brake else 'nobrake'}"
                shards.setdefault(shard, {})[key] = clean(a.simulate(slide, list(combo), brake, phase))

ref = {"gauges": a.ref["gauges"], "standard_fuse_sizes_a": a.ref["standard_fuse_sizes_a"]}
sysc = {k: a.cfg["system"][k] for k in ("nominal_voltage", "critical_drop_pct", "noncritical_drop_pct", "fuse_headroom")}

if out.exists(): shutil.rmtree(out)
(out / "data").mkdir(parents=True)
ui = src / "upfit/ui"
for f in ui.iterdir():
    if f.suffix in (".css", ".js"): shutil.copy(f, out / f.name)
html = (ui / "index.html").read_text(encoding="utf-8")
html = html.replace("connect-src 'none'", "connect-src 'self'")
inject = ('<meta name="robots" content="noindex">\n'
          '<script src="demo-backend.js"></script>\n'
          '<script defer src="/demos/_shared/demo-banner.js" data-back="/projects/upfit-studio/" '
          'data-note="The real Upfit Studio interface in your browser, answered from a recorded copy of the F-150 plan (prices and part notes removed). The simulator covers every slide position, the brake and up to three buttons at once. Edits are turned off."></script>\n'
          '<style>.demo-hide{display:none!important}</style>\n')
html = html.replace("</head>", inject + "</head>", 1)
(out / "index.html").write_text(html, encoding="utf-8")
shutil.copy(site / "scripts/demos/upfit-shim.js", out / "demo-backend.js")
(out / "data/recorded.json").write_text(json.dumps({"version": __version__, "calls": rec, "ref": ref, "system": sysc}, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
for name, d in shards.items():
    (out / f"data/sim-{name}.json.gz").write_bytes(gzip.compress(json.dumps(d, separators=(",", ":"), ensure_ascii=False).encode(), 9, mtime=0))
total = sum(f.stat().st_size for f in out.rglob("*") if f.is_file())
print("wrote", out, f"{total/1e6:.2f} MB", "version", __version__)
shutil.rmtree(tmp.parent)
