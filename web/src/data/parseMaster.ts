import type { RosterPlayer, Position, OffensiveArchetype, DefensiveRole } from "../types/simulator";
import {
  normalizeName,
  parseOffensiveArchetype,
  parseDefensiveRole,
  parsePosition,
  toFloat,
} from "./csvUtils";
import type { ContractRow } from "./parseContracts";
import { teamIdFromCsvAbbrev } from "./constants";

// ---------------------------------------------------------------------------
// Raw shape parsed directly from master.csv columns
// ---------------------------------------------------------------------------

export interface MasterRow {
  id: string;
  nameKey: string;
  name: string;
  age: number;
  csvTeamAbbrev: string;
  canonicalTeamId: string | null;
  position: Position;
  offensiveArchetype: OffensiveArchetype;
  defensiveRole: DefensiveRole;
  games: number;
  stats: RosterPlayer["stats"];
}

// ---------------------------------------------------------------------------
// Parse master.csv into a per-player map keyed by BBRef ID.
// For traded players (multiple stints), keeps the row with the most games.
// Skips "2TM" and "3TM" aggregate rows.
// ---------------------------------------------------------------------------

export function parseMasterRows(rows: Record<string, string>[]): Map<string, MasterRow> {
  const byId = new Map<string, MasterRow>();

  for (const row of rows) {
    const csvTeam = row["Team"]?.trim() ?? "";
    if (csvTeam === "2TM" || csvTeam === "3TM") continue;

    const name = row["Player"]?.trim();
    if (!name) continue;

    const id = row["Player-additional"]?.trim() || normalizeName(name);

    const oa = parseOffensiveArchetype(row["Offensive Archetype"] ?? "");
    const dr = parseDefensiveRole(row["Defensive Role"] ?? "");

    // Skip rows without archetype data
    if (!oa || !dr) continue;

    const games = toFloat(row["G"]);
    const existing = byId.get(id);

    // Keep the stint with the most games (≈ current team for traded players)
    if (existing && existing.games >= games) continue;

    byId.set(id, {
      id,
      nameKey: normalizeName(name),
      name,
      age: toFloat(row["Age"]),
      csvTeamAbbrev: csvTeam,
      canonicalTeamId: teamIdFromCsvAbbrev(csvTeam),
      position: parsePosition(row["Pos"] ?? ""),
      offensiveArchetype: oa,
      defensiveRole: dr,
      games,
      stats: {
        pts: toFloat(row["PTS"]),
        trb: toFloat(row["TRB"]),
        ast: toFloat(row["AST"]),
        tsPct: toFloat(row["TS%"]),
        bpm: toFloat(row["BPM"]),
        vorp: toFloat(row["VORP"]),
        ws: toFloat(row["WS"]),
        usgPct: toFloat(row["USG%"]),
      },
    });
  }

  return byId;
}

// ---------------------------------------------------------------------------
// Build the roster for one team, enriched with salary and ACE data.
// ---------------------------------------------------------------------------

export interface BuildRosterParams {
  teamId: string;
  masterRows: Map<string, MasterRow>;
  contractMap: Map<string, ContractRow>;
  aceMap: Map<string, number>;
}

export function buildTeamRoster(params: BuildRosterParams): RosterPlayer[] {
  const { teamId, masterRows, contractMap, aceMap } = params;

  // Find the csvAbbrev for this team so we can match against master.csv Team column
  // We use canonicalTeamId on each row (already normalized in parseMasterRows)
  const roster: RosterPlayer[] = [];

  for (const row of masterRows.values()) {
    if (row.canonicalTeamId !== teamId) continue;

    const contract = contractMap.get(row.nameKey);
    const currentSalary = contract?.currentSalary ?? 0;
    const nextSeasonSalary = contract?.nextSeasonSalary ?? null;

    const aceValue = aceMap.get(row.nameKey);
    const estimatedMarketSalary = aceValue ?? currentSalary;
    const isSalaryEstimate = aceValue === undefined;

    roster.push({
      id: row.id,
      name: row.name,
      age: row.age,
      position: row.position,
      teamAbbrev: teamId,
      offensiveArchetype: row.offensiveArchetype,
      defensiveRole: row.defensiveRole,
      currentSalary,
      nextSeasonSalary,
      estimatedMarketSalary,
      isSalaryEstimate,
      stats: row.stats,
    });
  }

  // Sort by salary descending (highest-paid first)
  return roster.sort((a, b) => b.currentSalary - a.currentSalary);
}

// ---------------------------------------------------------------------------
// Build a lightweight archetype-only lookup — used by the ACE/formula engine
// keyed by normalized player name
// ---------------------------------------------------------------------------

export interface ArchetypeEntry {
  offensiveArchetype: OffensiveArchetype;
  defensiveRole: DefensiveRole;
}

export function buildArchetypeMap(
  masterRows: Map<string, MasterRow>
): Map<string, ArchetypeEntry> {
  const map = new Map<string, ArchetypeEntry>();
  for (const row of masterRows.values()) {
    map.set(row.nameKey, {
      offensiveArchetype: row.offensiveArchetype,
      defensiveRole: row.defensiveRole,
    });
  }
  return map;
}
