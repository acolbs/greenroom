import argparse
import csv
import re
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import requests
from io import StringIO


def parse_money_cell(x: Any) -> Optional[int]:
  """
  Hoopshype salary cells are usually like:
    - '$59,606,817'
    - 'P$62,841,702' (player option marker)
    - '-' or '' for blanks
  We return an int salary, or None if blank.
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

  # Keep digits only.
  digits = re.sub(r"[^0-9]", "", s)
  if not digits:
    return None
  return int(digits)


def pick_salary_table(tables: List[pd.DataFrame]) -> pd.DataFrame:
  """
  Find the table that has a 'Player' column and looks like the salaries schedule.
  """
  best = None
  best_score = -1
  for t in tables:
    cols = [str(c).strip() for c in t.columns]
    if not any(c.lower() == "player" for c in cols):
      continue

    # Score by number of season columns (anything that looks like YYYY-YY)
    season_cols = [c for c in cols if re.match(r"^\d{4}-\d{2}$", c)]
    score = len(season_cols)
    if score > best_score:
      best_score = score
      best = t

  if best is None:
    raise RuntimeError(
      "Could not find the Hoopshype salaries table. "
      "Try updating the script for the current page markup."
    )
  return best


def normalize_columns(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
  # Strip whitespace from columns.
  df = df.copy()
  df.columns = [str(c).strip() for c in df.columns]

  # Identify season-like columns.
  season_cols = [c for c in df.columns if re.match(r"^\d{4}-\d{2}$", c)]
  if not season_cols:
    # Sometimes Hoopshype headers are not perfectly formatted; try to salvage.
    # We'll consider columns that contain a dash and 2-digit suffix.
    season_cols = [c for c in df.columns if re.search(r"\d{4}-\d{2}", c)]

  return df, season_cols


def scrape_to_tables(url: str) -> List[pd.DataFrame]:
  headers = {"User-Agent": "Mozilla/5.0 (compatible; GM-Sim/1.0)"}
  resp = requests.get(url, headers=headers, timeout=30)
  resp.raise_for_status()

  # pandas read_html can parse the main table from the HTML response.
  # If it fails, you may need to switch to a BeautifulSoup-based parser.
  # Important: wrap HTML in StringIO so pandas doesn't try to treat it as a file path.
  tables = pd.read_html(StringIO(resp.text))
  return tables


def main() -> None:
  ap = argparse.ArgumentParser()
  ap.add_argument(
    "--url",
    default="https://www.hoopshype.com/salaries/players/",
    help="Hoopshype salaries players page URL",
  )
  ap.add_argument("--output-wide", default="hoopshype_contracts_wide.csv")
  ap.add_argument("--output-long", default="hoopshype_contracts_long.csv")
  ap.add_argument(
    "--current-season",
    default=None,
    help="Season label like '2025-26'. If set, script will also compute expiring contracts based on next-season blank.",
  )
  ap.add_argument(
    "--output-expiring",
    default="hoopshype_expiring_contracts.csv",
    help="If --current-season is set, write expiring-contract rows here.",
  )
  args = ap.parse_args()

  tables = scrape_to_tables(args.url)
  salary_table = pick_salary_table(tables)
  salary_table, season_cols = normalize_columns(salary_table)

  # Ensure we have 'Player' column.
  player_col = None
  for c in salary_table.columns:
    if str(c).strip().lower() == "player":
      player_col = c
      break
  if not player_col:
    raise RuntimeError("Table has no 'Player' column after normalization.")

  # Optional team column.
  team_col = None
  for c in salary_table.columns:
    if str(c).strip().lower() in {"team", "tm", "club"}:
      team_col = c
      break

  # Parse salary cells.
  parsed: List[Dict[str, Any]] = []
  for _, row in salary_table.iterrows():
    player = row[player_col]
    if pd.isna(player):
      continue
    team = row[team_col] if team_col else None

    rec: Dict[str, Any] = {
      "player": str(player).strip(),
      "team": str(team).strip() if team is not None and not pd.isna(team) else None
    }
    for sc in season_cols:
      rec[sc] = parse_money_cell(row.get(sc))
    parsed.append(rec)

  wide_df = pd.DataFrame(parsed)

  # Sort salary columns if they look like seasons.
  # We'll keep them as provided, but enforce player/team first.
  out_cols = ["player", "team"] + season_cols
  wide_df = wide_df.reindex(columns=out_cols)
  wide_df.to_csv(args.output_wide, index=False)

  # Long format: one row per player per season where salary exists.
  long_rows: List[Dict[str, Any]] = []
  for rec in parsed:
    player = rec["player"]
    team = rec["team"]
    for sc in season_cols:
      sal = rec.get(sc)
      if sal is None:
        continue
      long_rows.append({"player": player, "team": team, "season": sc, "salary": sal})
  long_df = pd.DataFrame(long_rows)
  long_df.to_csv(args.output_long, index=False)

  # Optional expiring detection: "blank next year means free agent after current season".
  if args.current_season:
    cur = args.current_season.strip()
    if cur not in season_cols:
      raise RuntimeError(f"--current-season '{cur}' not found in detected season columns: {season_cols}")

    idx = season_cols.index(cur)
    if idx + 1 >= len(season_cols):
      raise RuntimeError("No next-season column exists after the selected --current-season.")
    nxt = season_cols[idx + 1]

    expiring_rows: List[Dict[str, Any]] = []
    for rec in parsed:
      cur_sal = rec.get(cur)
      nxt_sal = rec.get(nxt)
      if cur_sal is None:
        continue
      if nxt_sal is None:
        expiring_rows.append(
          {
            "player": rec["player"],
            "team": rec["team"],
            "currentSeason": cur,
            "nextSeason": nxt,
            "currentSalary": cur_sal,
            "isExpiringAfterCurrentSeason": True,
          }
        )

    expiring_df = pd.DataFrame(expiring_rows)
    expiring_df.to_csv(args.output_expiring, index=False)

    print(f"Wrote expiring contracts based on blank '{nxt}' cells for '{cur}'. Rows: {len(expiring_rows)}")

  print(f"Wrote wide CSV: {args.output_wide}")
  print(f"Wrote long CSV: {args.output_long}")


if __name__ == "__main__":
  main()

