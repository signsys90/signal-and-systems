"""Turn a COPY of the ares-duval-gis repo into the demo copy used to record the online demo.

Usage: python3 scripts/demos/prepare_gis_demo_copy.py /path/to/copy-of-ares-duval-gis
Never run this on the real repo. It replaces the operator, incident, task and check-in files with
fictional DEMO records, empties the repeater and frequency lists, and swaps a real frequency used
as a form placeholder for a neutral one. Then, in the copy:
  npm install && npm run build:client
  PORT=4501 BASIC_AUTH_USERNAME=demo BASIC_AUTH_PASSWORD=<any local value> TRACKING_ENABLED=false \
    APRS_ENABLED=false MESHTASTIC_ENABLED=false DMR_ENABLED=false GPS_ENABLED=false GPS_SHARE_ENABLED=false node server.js
record the GET /api answers by loading the page and opening each panel (Playwright), save GET / as the
index page, and pass all three to build_gis_demo.py.
"""
import json, sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
assert (root / "server.js").exists() and not (root / ".git").exists(), "point this at a copy without .git"
now = "2026-11-06T18:00:00.000Z"
ops = [
    dict(id="op-demo-1", callsign="DEMO1", name="Demo Operator 1", status="available", role="net_control", location="Demo staging (Downtown)", lat=30.3263, lng=-81.6558, capabilities=["voice", "GIS"]),
    dict(id="op-demo-2", callsign="DEMO2", name="Demo Operator 2", status="deployed", role="field_operator", location="Demo shelter team", lat=30.2868, lng=-81.5634, capabilities=["voice", "winlink"]),
    dict(id="op-demo-3", callsign="DEMO3", name="Demo Operator 3", status="standby", role="field_operator", location="Demo hospital liaison", lat=30.3497, lng=-81.6648, capabilities=["voice", "packet"]),
    dict(id="op-demo-4", callsign="DEMO4", name="Demo Operator 4", status="available", role="logistics", location="Demo Westside", lat=30.2949, lng=-81.7532, capabilities=["logistics", "mesh"]),
]
for o in ops:
    o.update(assignedIncidentId="unassigned", assignedIncidentTitle="unassigned", assignment="unassigned", aprsCallsign="", meshtasticNodeId="",
             dmrId="", aliases=[], lastCheckIn=now, lastCheckInSource="manual", lastCheckInNote="Demo check-in", lastCheckInReporter="", lastVoiceReport="")
inc = [
    dict(id="inc-demo-1", title="DEMO: Severe weather monitoring", type="weather", status="monitoring", lat=30.3322, lng=-81.6557, notes="Fictional exercise incident for the online demo.", createdAt=now),
    dict(id="inc-demo-2", title="DEMO: Shelter communications support", type="shelter", status="active", lat=30.2868, lng=-81.5634, notes="Fictional exercise incident for the online demo.", createdAt=now),
]
tasks = [
    dict(id="task-demo-1", title="DEMO: Verify shelter radio coverage", priority="high", status="open", assignedTo="DEMO2", incidentId="inc-demo-2", incidentTitle=inc[1]["title"], due=None, location="Demo shelter", lat=30.2868, lng=-81.5634, notes="Fictional task.", createdAt=now),
    dict(id="task-demo-2", title="DEMO: Hourly weather net check-in", priority="medium", status="in_progress", assignedTo="DEMO1", incidentId="inc-demo-1", incidentTitle=inc[0]["title"], due=None, location="Demo net control", lat=30.3263, lng=-81.6558, notes="Fictional task.", createdAt=now),
]
db = root / "data/db"
for name, rows in [("operators", ops), ("incidents", inc), ("tasks", tasks), ("operator-assignments", []), ("operator-checkins", [])]:
    (db / f"{name}.json").write_text(json.dumps(rows, indent=2))
empty = {"type": "FeatureCollection", "features": []}
for name in ["repeaters.geojson", "validated_repeaters.geojson"]:
    (root / "data/geojson" / name).write_text(json.dumps(empty))
for name in ["ares_frequencies.json", "repeater_sites.json"]:
    p = root / "data/reference" / name
    d = json.loads(p.read_text())
    d = [] if isinstance(d, list) else {k: ([] if isinstance(v, list) else v) for k, v in d.items()}
    p.write_text(json.dumps(d))
lite = root / "data/geojson/validated_all_layers_lite.geojson"
d = json.loads(lite.read_text())
d["features"] = [f for f in d["features"] if "repeater" not in json.dumps(f.get("properties", {})).lower()]
lite.write_text(json.dumps(d))
app = root / "public/js/app.js"
s = app.read_text(encoding="utf-8")
s = s.replace("147.255 (+) PL 127.3", "e.g. 000.000 (+) PL 000.0").replace('placeholder="147.255 (+)"', 'placeholder="e.g. 000.000 (+)"')
app.write_text(s, encoding="utf-8")
print("demo copy ready:", root)
