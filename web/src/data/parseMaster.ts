import type { RosterPlayer, Position, OffensiveArchetype, DefensiveRole, TalentTier, StyleStats } from "../types/simulator";
import {
  normalizeName,
  playerMatchKey,
  parseOffensiveArchetype,
  parseDefensiveRole,
  parsePosition,
  toFloat,
} from "./csvUtils";
import type { ContractRow } from "./parseContracts";
import { teamIdFromCsvAbbrev } from "./constants";
import { buildNbaPools, nbaTalent, talentTier } from "../lib/talentScore";
import styleScale from "./styleScale.json";

const STYLE_KEYS = Object.keys(styleScale);

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
  /** 0–100 unified Talent Score, computed across the full league pool. */
  talentScore: number;
  talentTier: TalentTier;
  style: StyleStats;
}

// ---------------------------------------------------------------------------
// Parse master.csv into a per-player map keyed by BBRef ID.
// For traded players (multiple stints), keeps the row with the most games.
// Skips "2TM" and "3TM" aggregate rows.
// ---------------------------------------------------------------------------

export function parseMasterRows(
  rows: Record<string, string>[],
  /** Pre-draft team by playerMatchKey ("FA" = not on a roster). See roster_moves_2026.csv. */
  moves: Map<string, string> = new Map()
): Map<string, MasterRow> {
  const byId = new Map<string, MasterRow>();

  for (const row of rows) {
    const name = row["Player"]?.trim();
    if (!name) continue;

    // A moved player's full-season row ("2TM") is used, filed under his pre-draft team.
    const move = moves.get(playerMatchKey(name));
    const rawTeam = row["Team"]?.trim() ?? "";
    const isTotal = /^\dTM$/.test(rawTeam);
    if (isTotal && !move) continue;
    const csvTeam = move ?? rawTeam;

    const id = row["Player-additional"]?.trim() || normalizeName(name);

    const oa = parseOffensiveArchetype(row["Offensive Archetype"] ?? "");
    const dr = parseDefensiveRole(row["Defensive Role"] ?? "");

    // Skip rows without archetype data
    if (!oa || !dr) continue;

    const games = toFloat(row["G"]);
    const existing = byId.get(id);

    // Keep the row with the most games (the season total for moved players)
    if (existing && existing.games >= games) continue;

    byId.set(id, {
      id,
      nameKey: playerMatchKey(name),
      name,
      age: toFloat(row["Age"]),
      csvTeamAbbrev: csvTeam,
      canonicalTeamId: csvTeam === "FA" ? null : teamIdFromCsvAbbrev(csvTeam),
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
      style: Object.fromEntries(STYLE_KEYS.map((k) => [k, toFloat(row[k])])),
      talentScore: 0, // filled in the post-pass below once the pool is complete
      talentTier: "Depth",
    });
  }

  // Talent is a percentile within the full league pool, so it can only be
  // computed once every row is parsed. Second pass over the assembled map.
  const pools = buildNbaPools([...byId.values()].map((r) => r.stats));
  for (const r of byId.values()) {
    r.talentScore = nbaTalent(r.stats, pools);
    r.talentTier = talentTier(r.talentScore);
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
      talentScore: row.talentScore,
      talentTier: row.talentTier,
      style: row.style,
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
