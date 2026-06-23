import type { DraftProspect } from "../types/simulator";
import { normalizeName } from "./csvUtils";

/** One player's physical measurements (inches / pounds). reach is null when unknown. */
export interface Physicals {
  name: string;
  kind: "prospect" | "nba";
  heightIn: number;
  wingspanIn: number;
  standingReachIn: number | null;
  weightLbs: number;
}

function num(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse web/public/data/physicals.csv (exported from scripts/prospect_data.py).
 * Columns: name, kind, height_in, wingspan_in, standing_reach_in, weight_lbs
 * Returns a map keyed by normalized name. Rows missing height/wingspan/weight
 * are skipped (reach may be blank).
 */
export function parsePhysicalsByName(
  rows: Record<string, string>[]
): Map<string, Physicals> {
  const map = new Map<string, Physicals>();

  for (const row of rows) {
    const name = row["name"]?.trim();
    if (!name) continue;

    const heightIn = num(row["height_in"]);
    const wingspanIn = num(row["wingspan_in"]);
    const weightLbs = num(row["weight_lbs"]);
    if (heightIn == null || wingspanIn == null || weightLbs == null) continue;

    map.set(normalizeName(name), {
      name,
      kind: row["kind"]?.trim() === "nba" ? "nba" : "prospect",
      heightIn,
      wingspanIn,
      standingReachIn: num(row["standing_reach_in"]),
      weightLbs,
    });
  }

  return map;
}

/** Attach physical measurements to prospects by normalized name. */
export function applyProspectPhysicals(
  prospects: DraftProspect[],
  byName: Map<string, Physicals>
): DraftProspect[] {
  return prospects.map((p) => {
    const physicals = byName.get(normalizeName(p.name));
    return physicals ? { ...p, physicals } : p;
  });
}
