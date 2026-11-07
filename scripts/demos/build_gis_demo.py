"""Package the ARES Duval GIS browser demo into public/demos/ares-gis/.

Inputs (made by running the real server locally on a demo copy, see the GIS demo notes on the project page):
  argv[1]  the demo copy of the ares-duval-gis repo (its public/ folder after `npm run build:client`)
  argv[2]  the rendered index page saved from that server (GET /)
  argv[3]  the recorded GET /api answers (JSON map of path -> {status, body})
Copies only the browser files (HTML, CSS, client JS and vendored Leaflet). No server code, data
files, tests, logs or notes are copied. The API is replaced by scripts/demos/gis-shim.js.
"""
import json, re, shutil, sys
from pathlib import Path

src = Path(sys.argv[1]).resolve()
index_html = Path(sys.argv[2]).read_text(encoding="utf-8")
rec = json.loads(Path(sys.argv[3]).read_text(encoding="utf-8"))
site = Path(__file__).resolve().parents[2]
out = site / "public/demos/ares-gis"

text = json.dumps(rec, separators=(",", ":"), ensure_ascii=False)
text = text.replace(str(src), "/srv/ares-duval-gis-demo")
for bad in ("demo-local", "/tmp/", "KR4JSQ", "W4IZ", "147.255"):
    assert bad not in text, f"recorded answers still contain {bad!r}"

if out.exists():
    shutil.rmtree(out)
out.mkdir(parents=True)
shutil.copytree(src / "public/build", out / "build")
shutil.copytree(src / "public/css", out / "css")

html = index_html
html = re.sub(r'(href|src)="/(build|css|js)/', r'\1="./\2/', html)
inject = ('<meta name="robots" content="noindex">\n'
          '  <script src="./demo-data.js"></script>\n'
          '  <script src="./demo-backend.js"></script>\n'
          '  <script defer src="/demos/_shared/demo-banner.js" data-back="/projects/ares-gis-dashboard/" '
          'data-note="The real GIS command dashboard in your browser with fictional DEMO operators, incidents and tasks. Public infrastructure layers are real; repeater and frequency lists are left out. Live tracking is off and changes are turned off."></script>\n')
html = html.replace("<script>", inject + "  <script>", 1)
assert 'src="/build' not in html and 'href="/css' not in html
(out / "index.html").write_text(html, encoding="utf-8")
(out / "demo-data.js").write_text("window.__GIS_DEMO__ = " + text + ";\n", encoding="utf-8")
shutil.copy(site / "scripts/demos/gis-shim.js", out / "demo-backend.js")
total = sum(f.stat().st_size for f in out.rglob("*") if f.is_file())
print("wrote", out, f"{total/1e6:.2f} MB")
