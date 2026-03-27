import argparse
import glob
import os
import re
from io import StringIO
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd


def parse_money_cell(x: Any) -> Optional[int]:
  """
  Converts Hoopshype salary cells to integer dollars.
  Returns None for blanks/dashes.
  """
  if x is None:
    return None
  if isinstance(x, float) and pd.isna(x):
    return None

  s = str(x).strip()
  if not s:
    return None
  if s in {"-", "—", "–"}:
    return None

  digits = re.sub(r"[^0-9]", "", s)
  if not digits:
    return None
  return int(digits)


def find_salary_table(df_list: List[pd.DataFrame]) -> Tuple[pd.DataFrame, List[str]]:
  best = None
  best_score = -1
  for df in df_list:
    cols = [str(c).strip() for c in df.columns]
    if not any(c.lower() == "player" for c in cols):
      continue
    # score by number of season-looking columns
    season_cols = [c for c in cols if re.match(r"^\d{4}-\d{2}$", c)]
    score = len(season_cols)
    if score > best_score:
      best_score = score
      best = df
  if best is None:
    raise RuntimeError("Could not locate a Hoopshype salary table in one of the HTML files.")

  best.columns = [str(c).strip() for c in best.columns]
  season_cols = [c for c in best.columns if re.match(r"^\d{4}-\d{2}$", str(c).strip())]
  return best, season_cols


def extract_from_html(html: str) -> pd.DataFrame:
  # read_html expects a file-like object when input is a raw HTML string
  tables = pd.read_html(StringIO(html))
  salary_table, season_cols = find_salary_table(tables)

  # locate player column
  player_col = None
  for c in salary_table.columns:
    if str(c).strip().lower() == "player":
      player_col = c
      break
  if not player_col:
    raise RuntimeError("Salary table has no Player column after normalization.")

  # optional team column
  team_col = None
  for c in salary_table.columns:
    if str(c).strip().lower() in {"team", "tm", "club"}:
      team_col = c
      break

  # iterate rows
  rows: List[Dict[str, Any]] = []
  for _, row in salary_table.iterrows():
    player = row.get(player_col)
    if pd.isna(player) or player is None:
      continue

    team = row.get(team_col) if team_col else None
    team_str = None
    if team_col and team is not None and not pd.isna(team):
      team_str = str(team).strip()

    for sc in season_cols:
      sal = parse_money_cell(row.get(sc))
      if sal is None:
        continue
      rows.append({"player": str(player).strip(), "team": team_str, "season": sc, "salary": sal})

  return pd.DataFrame(rows)


def main() -> None:
  ap = argparse.ArgumentParser()
  ap.add_argument("--input-dir", required=True, help="Directory containing saved Hoopshype HTML files")
  ap.add_argument("--pattern", default="*.html", help="Glob for HTML files (default: *.html)")
  ap.add_argument("--output-wide", default="hoopshype_contracts_wide.csv")
  ap.add_argument("--output-long", default="hoopshype_contracts_long.csv")
  ap.add_argument(
    "--current-season",
    default=None,
    help="If set (e.g. 2025-26), script outputs expiring contracts CSV based on blank next-season salary cells.",
  )
  ap.add_argument("--output-expiring", default="hoopshype_expiring_contracts.csv")
  args = ap.parse_args()

  input_dir = args.input_dir
  file_glob = os.path.join(input_dir, args.pattern)
  files = sorted(glob.glob(file_glob))
  if not files:
    raise RuntimeError(f"No files matched '{file_glob}'.")

  all_rows: List[pd.DataFrame] = []
  for fp in files:
    with open(fp, "r", encoding="utf-8", errors="ignore") as f:
      html = f.read()
    df = extract_from_html(html)
    if len(df) > 0:
      df["sourceFile"] = os.path.basename(fp)
      all_rows.append(df)

  if not all_rows:
    raise RuntimeError("No salary data extracted from the provided HTML files.")

  long_df = pd.concat(all_rows, ignore_index=True)

  # Dedupe: player+team+season should be unique-ish; keep the max salary if duplicates occur.
  long_df = (
    long_df.groupby(["player", "team", "season"], as_index=False)
    .agg({"salary": "max"})
    .sort_values(["player", "season"])
  )

  long_df.to_csv(args.output_long, index=False)

  # Wide
  wide_df = long_df.pivot_table(index=["player", "team"], columns="season", values="salary", aggfunc="max").reset_index()
  wide_df.columns = [str(c) for c in wide_df.columns]
  # Put player/team first
  season_cols = [c for c in wide_df.columns if re.match(r"^\d{4}-\d{2}$", str(c))]
  wide_df = wide_df.reindex(columns=["player", "team"] + season_cols)
  wide_df.to_csv(args.output_wide, index=False)

  if args.current_season:
    cur = args.current_season.strip()
    if cur not in season_cols:
      raise RuntimeError(f"--current-season '{cur}' not found in detected season columns: {season_cols}")
    # Determine next season by column order as seen in the wide df
    idx = season_cols.index(cur)
    if idx + 1 >= len(season_cols):
      raise RuntimeError("No next-season column exists after the selected --current-season.")
    nxt = season_cols[idx + 1]

    # expiring means currentSalary exists and nextSalary is blank
    wide_df_exp = wide_df.copy()
    cur_vals = wide_df_exp[cur]
    nxt_vals = wide_df_exp[nxt]
    exp_mask = cur_vals.notna() & (nxt_vals.isna())

    exp_rows = wide_df_exp.loc[exp_mask, ["player", "team", cur, nxt]].copy()
    exp_rows = exp_rows.rename(columns={cur: "currentSalary", nxt: "nextSeasonSalary"})
    exp_rows["currentSeason"] = cur
    exp_rows["isExpiringAfterCurrentSeason"] = True
    exp_rows = exp_rows.drop(columns=["nextSeasonSalary"])
    exp_rows.to_csv(args.output_expiring, index=False)

  print(f"Wrote wide CSV: {args.output_wide}")
  print(f"Wrote long CSV: {args.output_long}")
  if args.current_season:
    print(f"Wrote expiring CSV: {args.output_expiring}")


if __name__ == "__main__":
  main()

