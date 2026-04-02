import type { DraftProspect, ProspectCollegeStats } from "../types/simulator";
import { toFloat } from "./csvUtils";

function parseNullableFloat(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = parseFloat(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse web/public/data/prospect_stats.csv (Sports-Reference college per-game lines).
 * Keyed by big-board Rank. Rows without sr_found / empty games+pts are skipped.
 */
export function parseProspectStatsByRank(
  rows: Record<string, string>[]
): Map<number, ProspectCollegeStats> {
  const map = new Map<number, ProspectCollegeStats>();

  for (const row of rows) {
    const rank = Math.round(toFloat(row["Rank"] ?? ""));
    if (rank <= 0) continue;

    const srFound = row["sr_found"]?.trim() === "1";
    const games = parseNullableFloat(row["games"]);
    const pts = parseNullableFloat(row["pts_per_g"]);

    if (!srFound && games == null && pts == null) continue;
    if (!srFound && pts == null) continue;

    const tsRaw = parseNullableFloat(row["ts_pct"]);
    const tsPct = tsRaw != null ? (tsRaw > 1 ? tsRaw / 100 : tsRaw) : 0;

    map.set(rank, {
      seasonYear: row["year_id"]?.trim() || "—",
      teamAbbr: row["team_name_abbr"]?.trim() || "",
      confAbbr: row["conf_abbr"]?.trim() || "",
      classYear: row["class"]?.trim() || "",
      games: games ?? 0,
      gamesStarted: Math.round(parseNullableFloat(row["games_started"]) ?? 0),
      mpPerGame: parseNullableFloat(row["mp_per_g"]) ?? 0,
      pts: pts ?? 0,
      trb: parseNullableFloat(row["trb_per_g"]) ?? 0,
      ast: parseNullableFloat(row["ast_per_g"]) ?? 0,
      stl: parseNullableFloat(row["stl_per_g"]) ?? 0,
      blk: parseNullableFloat(row["blk_per_g"]) ?? 0,
      tov: parseNullableFloat(row["tov_per_g"]) ?? 0,
      tsPct,
    });
  }

  return map;
}

export function applyProspectCollegeStats(
  prospects: DraftProspect[],
  byRank: Map<number, ProspectCollegeStats>
): DraftProspect[] {
  return prospects.map((p) => {
    const collegeStats = byRank.get(p.rank);
    return collegeStats ? { ...p, collegeStats } : p;
  });
}
