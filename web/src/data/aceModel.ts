import { normalizeName } from "./csvUtils";

// ---------------------------------------------------------------------------
// ACE model
//
// "ACE" column from 2025-2026_Stats.csv represents the estimated annual
// contract value for each player, denominated in dollars.
//
// This is used as the player's "Estimated Market Salary" throughout the
// simulator — it drives Player option resolution and the re-sign offer value.
// ---------------------------------------------------------------------------

/**
 * Builds a lookup map: normalized player name → ACE dollar value.
 * When a player appears multiple times (two-way, etc.), keeps the highest ACE.
 */
export function buildAceLookup(rows: Record<string, string>[]): Map<string, number> {
  const map = new Map<string, number>();

  for (const row of rows) {
    const name = row["Player"]?.trim();
    if (!name) continue;

    const raw = row["ACE"]?.trim() ?? "";
    if (!raw) continue;

    const n = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(n) || n <= 0) continue;

    const ace = Math.round(n);
    const key = normalizeName(name);
    const prev = map.get(key);
    if (prev === undefined || ace > prev) {
      map.set(key, ace);
    }
  }

  return map;
}
