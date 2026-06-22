import type { DraftProspect, ProspectComp, ProspectSuccessOdds } from "../types/simulator";
import { toFloat, normalizeName } from "./csvUtils";

/**
 * Parse web/public/data/prospect_comps.csv → top ML comps per prospect.
 * Columns: Rank, Prospect, Pos, Comp_Rank, Comp_Name, Comp_Pos, Comp_Off, Comp_Def, Similarity
 * Keyed by normalized prospect name; comps are ordered best match first.
 */
export function parseProspectCompsByName(
  rows: Record<string, string>[]
): Map<string, ProspectComp[]> {
  const map = new Map<string, ProspectComp[]>();

  for (const row of rows) {
    const prospect = row["Prospect"]?.trim();
    const compName = row["Comp_Name"]?.trim();
    if (!prospect || !compName) continue;

    const key = normalizeName(prospect);
    const comp: ProspectComp = {
      name: compName,
      pos: row["Comp_Pos"]?.trim() || "",
      offensiveArchetype: row["Comp_Off"]?.trim() || "",
      defensiveRole: row["Comp_Def"]?.trim() || "",
      similarity: toFloat(row["Similarity"] ?? ""),
    };
    const list = map.get(key) ?? [];
    list.push(comp);
    map.set(key, list);
  }

  for (const list of map.values()) {
    list.sort((a, b) => b.similarity - a.similarity);
  }
  return map;
}

/**
 * Parse web/public/data/prospect_success.csv → ML success projection per prospect.
 * Columns: Name, Pos, BB_Rank, P_Star, P_Starter, P_Bench, P_Cut, EV, ML_Rank
 * Keyed by normalized prospect name.
 */
export function parseProspectSuccessByName(
  rows: Record<string, string>[]
): Map<string, ProspectSuccessOdds> {
  const map = new Map<string, ProspectSuccessOdds>();

  for (const row of rows) {
    const name = row["Name"]?.trim();
    if (!name) continue;

    map.set(normalizeName(name), {
      star: toFloat(row["P_Star"] ?? ""),
      starter: toFloat(row["P_Starter"] ?? ""),
      bench: toFloat(row["P_Bench"] ?? ""),
      cut: toFloat(row["P_Cut"] ?? ""),
      ev: toFloat(row["EV"] ?? ""),
      mlRank: Math.round(toFloat(row["ML_Rank"] ?? "")),
    });
  }
  return map;
}

/** Attach ML comps + success projection to prospects by normalized name. */
export function attachProspectML(
  prospects: DraftProspect[],
  compsByName: Map<string, ProspectComp[]>,
  successByName: Map<string, ProspectSuccessOdds>
): DraftProspect[] {
  return prospects.map((p) => {
    const key = normalizeName(p.name);
    const comps = compsByName.get(key);
    const successOdds = successByName.get(key);
    if (!comps && !successOdds) return p;
    return { ...p, ...(comps ? { comps } : {}), ...(successOdds ? { successOdds } : {}) };
  });
}
