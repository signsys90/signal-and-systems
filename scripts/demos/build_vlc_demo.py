"""Build the browser demo of the Vehicle Light Controller into public/demos/vehicle-light-controller/.

Usage: python3 scripts/demos/build_vlc_demo.py /path/to/vehicle-lighting-controller
Copies only the dashboard's front end (template rendered to HTML, CSS, JS). No Python source,
logs, local config or tests are copied. The backend is replaced by scripts/demos/vlc-shim.js.
"""
import json, shutil, sys
from pathlib import Path
import jinja2

src = Path(sys.argv[1]).resolve()
site = Path(__file__).resolve().parents[2]
out = site / "public/demos/vehicle-light-controller"
cfg = json.loads((src / "config/default_config.json").read_text())
cfg["serial"]["timeout_seconds"] = float(cfg["serial"].get("timeout_seconds", 1))

class Obj(dict):
    __getattr__ = dict.get
def wrap(x):
    if isinstance(x, dict): return Obj({k: wrap(v) for k, v in x.items()})
    if isinstance(x, list): return [wrap(v) for v in x]
    return x
w = wrap(cfg)
env = jinja2.Environment(loader=jinja2.FileSystemLoader(str(src / "app/templates")), autoescape=True)
html = env.get_template("index.html").render(request=None, app_name=w.app_name, channels=w.channels,
    profiles=w.profiles, serial=w.serial, safety=w.safety)
html = html.replace('href="/static/', 'href="./static/').replace('src="/static/', 'src="./static/')
inject = (
    "<script>window.__VLC_DEMO_CONFIG__ = " + json.dumps(cfg) + ";</script>\n"
    '    <script src="./demo-backend.js"></script>\n'
    '    <script defer src="/demos/_shared/demo-banner.js" data-back="/projects/vehicle-light-controller/" '
    'data-note="The real dashboard running in your browser. A simulated relay board stands in for the USB hardware, as in the app&#39;s simulation mode. Nothing is saved or sent."></script>\n'
    '    <meta name="robots" content="noindex">\n'
)
html = html.replace("<script defer", inject + "    <script defer", 1)
if out.exists(): shutil.rmtree(out)
(out / "static").mkdir(parents=True)
shutil.copytree(src / "app/static/css", out / "static/css")
shutil.copytree(src / "app/static/js", out / "static/js")
shutil.copy(site / "scripts/demos/vlc-shim.js", out / "demo-backend.js")
(out / "index.html").write_text(html)
print("wrote", out)
