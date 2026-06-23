import { toFloat, normalizeName } from "./csvUtils";

/** Per-game NBA stats needed for the comparison radar (from master.csv). */
export interface NbaRadarStats {
  name: string;
  pts: number;
  trb: number;
  ast: number;
  stl: number;
  blk: number;
  /** 0–1 */
  tsPct: number;
  /** 0–1 */
  fg3Pct: number;
}

/**
 * Parse raw master.csv rows into a name-keyed map of the six radar stats.
 * master.csv figures are already per-game; TS%/3P% are 0–1.
 *
 * For traded players we keep the row with the most games. A 2TM/3TM row holds
 * the full-season total (more games than any single stint), so it wins — giving
 * the complete-season shape. We deliberately do NOT skip 2TM/3TM here: some
 * traded players (e.g. Marvin Bagley III) appear ONLY as an aggregate row, and
 * skipping it would drop them from the radar entirely.
 */
export function parseNbaRadarByName(
  rows: Record<string, string>[]
): Map<string, NbaRadarStats> {
  const map = new Map<string, NbaRadarStats>();
  const gamesByKey = new Map<string, number>();

  for (const row of rows) {
    const name = row["Player"]?.trim();
    if (!name) continue;

    const key = normalizeName(name);
    const games = toFloat(row["G"]);
    const prevGames = gamesByKey.get(key);
    if (prevGames != null && prevGames >= games) continue;
    gamesByKey.set(key, games);

    map.set(key, {
      name,
      pts: toFloat(row["PTS"]),
      trb: toFloat(row["TRB"]),
      ast: toFloat(row["AST"]),
      stl: toFloat(row["STL"]),
      blk: toFloat(row["BLK"]),
      tsPct: toFloat(row["TS%"]),
      fg3Pct: toFloat(row["3P%"]),
    });
  }

  return map;
}
