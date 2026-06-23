#!/usr/bin/env python3
"""
export_physicals.py — flatten the physical-measurement dicts from
prospect_data.py into a CSV the web app can fetch.

Writes web/public/data/physicals.csv with one row per measured player:

    name, kind, height_in, wingspan_in, standing_reach_in, weight_lbs

  • kind = "prospect" rows come from PROSPECT_PHYSICALS (height no-shoes,
    wingspan, weight, standing reach; reach blank when combine data is absent).
  • kind = "nba" rows come from NBA_PHYSICALS (height no-shoes, wingspan,
    weight; NBA reach is not measured here so standing_reach_in is blank).

This is a read-only projection of prospect_data.py — it never mutates the
source dicts. Override the output dir with $GREENROOM_DATA.
"""

import csv

import prospect_data as pd_

OUT = pd_.data_path("physicals.csv")

FIELDS = ["name", "kind", "height_in", "wingspan_in", "standing_reach_in", "weight_lbs"]


def _fmt(v):
    return "" if v is None else f"{v:g}"


def main() -> None:
    rows = []

    for name, (h, ws, wt, reach) in pd_.PROSPECT_PHYSICALS.items():
        rows.append({
            "name": name,
            "kind": "prospect",
            "height_in": _fmt(h),
            "wingspan_in": _fmt(ws),
            "standing_reach_in": _fmt(reach),
            "weight_lbs": _fmt(wt),
        })

    for name, (h, ws, wt) in pd_.NBA_PHYSICALS.items():
        rows.append({
            "name": name,
            "kind": "nba",
            "height_in": _fmt(h),
            "wingspan_in": _fmt(ws),
            "standing_reach_in": "",
            "weight_lbs": _fmt(wt),
        })

    # LF line endings to match the rest of the data pipeline.
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)

    n_pro = sum(1 for r in rows if r["kind"] == "prospect")
    n_nba = sum(1 for r in rows if r["kind"] == "nba")
    print(f"✓ wrote {len(rows)} physicals rows ({n_pro} prospect, {n_nba} nba) -> {OUT}")


if __name__ == "__main__":
    main()
