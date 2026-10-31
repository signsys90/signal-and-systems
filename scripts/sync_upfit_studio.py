"""Refresh the site's Upfit Studio data from a checkout of the private f150-upfit-studio repo.

Writes two files, both public-safe (no notes on parts, no prices, no order numbers):
  src/data/f150-upfit/upfit-studio.json  - same export the app's own Sync writes (portfolio_data)
  src/data/f150-upfit/canport.json       - the Whelen Command CANport plan (controls.canport)

canport.json is the single source for every CANport table on the site (UpfitStudioPlan show="canport"):
the Upfit Studio page and the F-150 output plan page. Re-run this after any CANport change.

Usage (from the site repo root):
  python3 scripts/sync_upfit_studio.py /path/to/f150-upfit-studio [--wln path/to/command_file.wln]
--wln defaults to the newest programmed Command file in the app's tests/fixtures.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]
OUT = SITE / "src" / "data" / "f150-upfit"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("app", type=Path, help="checkout of signsys90/f150-upfit-studio")
    ap.add_argument("--wln", type=Path, default=None)
    ap.add_argument("--skip-studio-json", action="store_true", help="only write canport.json")
    a = ap.parse_args()
    sys.path.insert(0, str(a.app))
    import yaml  # noqa: PLC0415
    from upfit import __version__, canport, command_file  # noqa: PLC0415
    from upfit.sync import portfolio_data  # noqa: PLC0415

    cfg = yaml.safe_load((a.app / "config" / "upfit.yaml").read_text(encoding="utf-8"))
    if not a.skip_studio_json:
        (OUT / "upfit-studio.json").write_text(json.dumps(portfolio_data(cfg, False), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    cp = canport.config(cfg)
    rows = canport.clean_commands(cfg, cp.get("commands") or [])
    wln = a.wln
    if wln is None:
        fx = sorted((a.app / "tests" / "fixtures").glob("*programmed*.wln"))
        wln = fx[-1] if fx else None
    cmp = command_file.compare(cfg, wln) if wln else None
    data = {
        "generated_by": f"Upfit Studio {__version__} (scripts/sync_upfit_studio.py)",
        "vehicle": cp.get("vehicle"),
        "kit": cp.get("kit"),
        "source": cp.get("source"),
        "max_commands": canport.MAX_COMMANDS,
        "catalog_size": len(canport.catalog(cfg)),
        "value_signals": sorted(canport.VALUE_SIGNALS),
        "commands": [{**r, "value_signal": r["signal"] in canport.VALUE_SIGNALS} for r in rows],
        "command_file": None if not cmp else {
            "file": cmp["file"], "command_version": cmp["command_version"],
            "can_in_file": cmp["can_in_file"], "only_in_file": cmp["only_in_file"], "only_in_plan": cmp["only_in_plan"],
        },
    }
    (OUT / "canport.json").write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote canport.json ({len(rows)} CAN commands) from upfit-kit {__version__}")


if __name__ == "__main__":
    main()
