#!/usr/bin/env bash
# Build the browser demo of the ARES CF-33 Field Dashboard into public/demos/ares-field-dashboard/.
# Usage: scripts/demos/build_field_dashboard_demo.sh /path/to/ares-command-dashboard
# Builds only the React renderer (compiled, minified). No Electron main-process code, settings files,
# logs or audit reports are copied. The Electron bridge is replaced by field-dashboard-shim.js.
set -euo pipefail
SRC="$(cd "$1" && pwd)"
SITE="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$SITE/public/demos/ares-field-dashboard"
WORK="$(mktemp -d)"
cp -r "$SRC/." "$WORK/app"
rm -rf "$WORK/app/.git" "$WORK/app/node_modules"
cd "$WORK/app"
npm install --no-audit --no-fund --ignore-scripts >/dev/null
npx esbuild src/main/defaultSettings.ts --bundle --format=cjs --platform=node --outfile="$WORK/ds.cjs" --log-level=warning
# Built-in defaults only; the Windows user folder is renamed below.
node -e "process.stdout.write(JSON.stringify(require(process.argv[1]).defaultSettings))" "$WORK/ds.cjs" > "$WORK/settings.json"
npx vite build src/renderer --base ./ --outDir "$WORK/dist" --emptyOutDir --logLevel warn
rm -rf "$OUT"; mkdir -p "$OUT"
cp -r "$WORK/dist/." "$OUT/"
cp "$SITE/scripts/demos/field-dashboard-shim.js" "$OUT/demo-backend.js"
python3 - "$OUT/index.html" "$WORK/settings.json" <<'PY'
import sys
html_path, settings_path = sys.argv[1], sys.argv[2]
html = open(html_path, encoding="utf-8").read()
import re
settings = open(settings_path, encoding="utf-8").read()
settings = re.sub(r'C:\\\\Users\\\\[^\\\\"]+', r'C:\\\\Users\\\\Operator', settings, flags=re.I)
assert "willi" not in settings.lower(), "user name still present"
inject = ('<meta name="robots" content="noindex">\n'
          '    <script>window.__FIELD_DEMO_SETTINGS__ = ' + settings + ';</script>\n'
          '    <script src="./demo-backend.js"></script>\n'
          '    <script defer src="/demos/_shared/demo-banner.js" data-back="/projects/ares-field-dashboard/" '
          'data-note="The real field dashboard interface in your browser, with its built-in default settings. Buttons that start programs or open folders on the Toughbook say what they would do instead, and readiness checks show Missing because a browser can&#39;t see the Toughbook&#39;s drives. Changes last until you close the tab."></script>\n')
html = html.replace("<title>", inject + "    <title>", 1)
open(html_path, "w", encoding="utf-8").write(html)
PY
rm -rf "$WORK"
echo "wrote $OUT"
