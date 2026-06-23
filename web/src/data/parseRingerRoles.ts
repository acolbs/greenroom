import type { DraftProspect, OffensiveArchetype, DefensiveRole } from "../types/simulator";
import { normalizeName, parseOffensiveArchetype, parseDefensiveRole } from "./csvUtils";

// ---------------------------------------------------------------------------
// parseRingerRoles.ts
//
// Loads web/public/data/ringer_roles.csv — the user-maintained, authoritative
// archetype labels (imported from The Ringer). Precedence over big_board / ML:
// a row here overrides a prospect's offensive + defensive labels.
//
// Columns: Name, Offensive Archetype, Defensive Role
// Values must use the project taxonomy; rows with unrecognized values are
// skipped so the prospect keeps its existing (board/ML) label.
// ---------------------------------------------------------------------------

export interface RingerRole {
  offensiveArchetype: OffensiveArchetype;
  defensiveRole: DefensiveRole;
}

/** Parse ringer_roles.csv into a name-keyed override map. */
export function parseRingerRolesByName(
  rows: Record<string, string>[]
): Map<string, RingerRole> {
  const map = new Map<string, RingerRole>();
  for (const row of rows) {
    const name = row["Name"]?.trim();
    if (!name) continue;
    const oa = parseOffensiveArchetype(row["Offensive Archetype"] ?? "");
    const dr = parseDefensiveRole(row["Defensive Role"] ?? "");
    if (!oa || !dr) continue; // unrecognized → skip, fall back to existing label
    map.set(normalizeName(name), { offensiveArchetype: oa, defensiveRole: dr });
  }
  return map;
}

/** Override each prospect's archetype labels where the Ringer map has an entry. */
export function applyRingerRoles(
  prospects: DraftProspect[],
  roles: Map<string, RingerRole>
): DraftProspect[] {
  if (roles.size === 0) return prospects;
  return prospects.map((p) => {
    const r = roles.get(normalizeName(p.name));
    return r
      ? { ...p, offensiveArchetype: r.offensiveArchetype, defensiveRole: r.defensiveRole }
      : p;
  });
}
