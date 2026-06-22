#!/usr/bin/env python3
"""
compose_big_board.py — build the app-facing CSVs from sources + model output.

  reads   big_board_base.csv, prospect_stats_base.csv  (sources)
          prospect_archetype_ml.csv                     (model output)
  writes  big_board.csv, prospect_stats.csv             (consumed by the web app)

This is the only step that writes big_board.csv / prospect_stats.csv. The model
scripts never touch them, so no file is ever both an input and an output.

A prospect's archetype columns are overwritten with the ML prediction when one
exists (matched by Name); otherwise the base (scout) archetype is kept.
"""

import argparse
import pandas as pd

from prospect_data import data_path


def overlay_archetypes(df, ml_map):
    df = df.copy()
    for idx, row in df.iterrows():
        rec = ml_map.get(row["Name"])
        if rec is not None:
            df.at[idx, "Offensive Archetype"] = rec["ML Offensive Archetype"]
            df.at[idx, "Defensive Role"] = rec["ML Defensive Role"]
    return df


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="write composed CSVs to *.composed for diffing instead of "
                         "overwriting big_board.csv / prospect_stats.csv")
    args = ap.parse_args()

    ml = pd.read_csv(data_path("prospect_archetype_ml.csv"))
    ml_map = {r["Name"]: r for _, r in ml.iterrows()}

    big_board = pd.read_csv(data_path("big_board_base.csv"))
    prospects = pd.read_csv(data_path("prospect_stats_base.csv"), low_memory=False)

    big_board_out = overlay_archetypes(big_board, ml_map)
    prospects_out = overlay_archetypes(prospects, ml_map)

    bb_path = data_path("big_board.csv" if not args.check else "big_board.csv.composed")
    ps_path = data_path("prospect_stats.csv" if not args.check else "prospect_stats.csv.composed")

    big_board_out.to_csv(bb_path, index=False, lineterminator="\n")
    prospects_out.to_csv(ps_path, index=False, lineterminator="\n")
    print(f"✓ Wrote {bb_path}")
    print(f"✓ Wrote {ps_path}")


if __name__ == "__main__":
    main()
