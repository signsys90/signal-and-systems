"""One-off: add the Live demo / Source sections to the project pages and retire dead GitHub links (7 Nov 2026)."""
import re
from pathlib import Path

site = Path(__file__).resolve().parents[2]
P = lambda slug: site / f"src/content/docs/projects/{slug}/index.mdx"

GITLAB = ("**Source:** kept in a private GitLab repository under Signal & Systems Engineering, LLC. "
          "The code is not public and there is no source download.")

SECTIONS = {
"vehicle-light-controller": f"""## Live demo

**[Open the live demo](/demos/vehicle-light-controller/)**. It opens the real dashboard in your browser.

- **What runs:** the app's own dashboard page, styles and script (version 0.1.0). The Python back end is replaced by a small browser stand-in that follows the app's simulation mode rules: ALL OFF at startup, channel toggles, the six operating modes, the watchdog, the event log and the safety lockout after a fault.
- **Try:** Parked Incident Mode, then a direct channel, then ALL OFF. Turning Simulation Mode off shows the fault the app raises when no USB relay board is attached, and the safety lockout that follows.
- **What it is not:** no relay board, no serial port and no vehicle. Nothing is saved, and a reload starts fresh.
- **How I checked it (7 Nov 2026):** the same steps in the demo and in the real app running locally in simulation mode gave the same channel states, control sources and log entries.

{GITLAB} The demo ships only the files a browser needs to draw the dashboard.
""",
"upfit-studio": f"""## Live demo

**[Open the live demo](/demos/upfit-studio/)**. It opens the real Upfit Studio interface in your browser.

- **What runs:** the app's own interface (version 0.8.13, the build in my GitLab repository on 7 Nov 2026) on a recorded copy of the F-150 plan, with prices and part notes removed and the budget card hidden.
- **Interactive:** every screen reads the plan. The control head simulator answers every slide position, the brake (pop and held) and any mix of up to three buttons, from 4,536 answers recorded from the real app. The wire and fuse calculator and the bench current check use the app's own formulas, carried over to the browser. I checked them against the app on 547 sample inputs on 7 Nov 2026, and all 547 matched.
- **Turned off:** edits, saves, sandboxes, sync, exports, the installer packet and anything that opens files or folders. The app says so when you try.
- **CANport:** the demo's eight CANport slots match the Whelen Command CANport setup on this page and on the F-150 output plan page. Nothing about CANport changed with this demo.

{GITLAB} The demo ships only the interface files and the recorded, public-safe answers.
""",
"ares-field-dashboard": f"""## Live demo

**[Open the live demo](/demos/ares-field-dashboard/)**. It opens the real field dashboard interface in your browser.

- **What runs:** the dashboard's React interface, compiled from the repository, with its built-in default settings (mission packs, PACE plan, checklists, hardware list and launcher list). The Windows user folder in the default program paths is shown as `C:\\Users\\Operator`.
- **Try:** switch mission packs, tick checklist items, edit the PACE plan or settings, and add an operator log entry. Changes last until you close the tab.
- **What it is not:** buttons that start programs, open folders or pick files belong to the Toughbook. In the browser they say what they would do. Readiness checks show "Missing" because a browser can't see the Toughbook's drives. The two COM ports are demo entries. Battery and network come from your own browser.

{GITLAB} The demo ships only the compiled interface. The Electron main process, my settings files and logs are not included.
""",
"ares-gis-dashboard": f"""## Live demo

**[Open the live demo](/demos/ares-gis/)**. It opens the real GIS command dashboard in your browser.

- **What runs:** the dashboard's own map client, styles and scripts. Its answers were recorded on 7 Nov 2026 from the real server running on a local demo copy.
- **Demo data only:** four fictional operators (DEMO1 to DEMO4), two fictional exercise incidents and two fictional tasks. Live APRS, Meshtastic, DMR and GPS tracking are off. Repeater and frequency lists are removed, and so is a real frequency that appeared as a form hint. The public infrastructure layers (hospitals, fire stations, shelters, law enforcement, EOC, bridges) are the same ones the app uses.
- **Try:** the Operators, Dispatch, Tasking, Layers and Diagnostics panels, night mode and the map layers.
- **Turned off:** creating, editing or deleting anything, location sharing and the traffic camera images. The deployed system stays private behind its login.

{GITLAB} The demo ships only the browser files. The server code, my data files and the deployment settings are not included.
""",
"responder-id-scanner": f"""## Online access

There is no online demo of the ID Scanner, on purpose. It handles driver license data, so it is built to run only on the Toughbook with no network at all, and a hosted copy would go against its privacy rules. The screenshots below use a synthetic TEST DATA record.

{GITLAB} The GitLab repository holds the upstream AAMVA decoder project the scanner builds on (see Architecture below).
""",
}

def insert_after_header(text, block):
    m = re.search(r"^<ProjectHeader[^\n]*/>\n", text, flags=re.M)
    assert m, "no ProjectHeader"
    return text[: m.end()] + "\n" + block + "\n" + text[m.end():]

for slug, block in SECTIONS.items():
    p = P(slug); t = p.read_text(encoding="utf-8")
    if "## Live demo" in t or "## Online access" in t:
        continue
    t = insert_after_header(t, block)
    t = re.sub(r"^updated: .*$", "updated: 2026-11-07", t, count=1, flags=re.M)
    p.write_text(t, encoding="utf-8")

# Upfit Studio facts that moved with GitLab.
p = P("upfit-studio"); t = p.read_text(encoding="utf-8")
t = t.replace("['Source', 'Private GitHub repository']", "['Source', 'Private GitLab repository (moved from GitHub, Nov 2026)']")
t = t.replace("| 0.8.3 to 0.8.10 | 31 Oct | CANport slots 3 to 8, read-only Command file compare, notes matched to Command file \"-3\" |\n",
              "| 0.8.3 to 0.8.10 | 31 Oct | CANport slots 3 to 8, read-only Command file compare, notes matched to Command file \"-3\" |\n"
              "| 0.8.11 to 0.8.13 | 31 Oct | Command file \"-4\" stored with a test (same CAN signals as \"-3\"); harness diagram labels wrap; Build outputs finds WireViz and Graphviz and says when it can't draw |\n")
p.write_text(t, encoding="utf-8")

# This site's own page: source and pipeline now on GitLab.
p = P("signal-and-systems-site"); t = p.read_text(encoding="utf-8")
t = t.replace("source={{ label: 'Source on GitHub', href: 'https://github.com/signsys90/signal-and-systems' }}",
              "source={{ label: 'Source in a private GitLab repository (moved from GitHub, Nov 2026)' }}")
t = t.replace("MDX pages in GitHub ─► push to main", "MDX pages in GitLab ─► push to main")
t = t.replace("5. Connect the GitHub repository to Cloudflare Pages.", "5. Connect the repository to Cloudflare Pages (first GitHub; GitLab from Nov 2026).")
t = re.sub(r"^updated: .*$", "updated: 2026-11-07", t, count=1, flags=re.M)
p.write_text(t, encoding="utf-8")

# Build log pages: the GitHub account is gone, so its pull request links are dead. Keep the numbers as text.
for p in (site / "src/content/docs/log").glob("*.mdx"):
    t = p.read_text(encoding="utf-8"); o = t
    t = re.sub(r"\[((?:PR )?#\d+)\]\(https://github\.com/signsys90/signal-and-systems/pull/\d+\)", r"\1", t)
    t = re.sub(r"\[([^\]]+)\]\(https://github\.com/signsys90/signal-and-systems[^)]*\)", r"\1", t)
    t = re.sub(r",\s*href:\s*'https://github\.com/signsys90/signal-and-systems[^']*'", "", t)
    t = t.replace("**Source:** github.com/signsys90/signal-and-systems", "**Source:** private GitLab repository (the original GitHub repository is closed)")
    if t != o:
        p.write_text(t, encoding="utf-8"); print("unlinked", p.name)

r = site / "README.md"; t = r.read_text(encoding="utf-8")
r.write_text(t.replace("Turn on two-factor login for both GitHub and Cloudflare.", "Turn on two-factor login for both GitLab and Cloudflare."), encoding="utf-8")
print("done")
