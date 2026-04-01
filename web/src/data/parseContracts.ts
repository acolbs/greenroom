import type { ExpiringContract, OptionType, OffensiveArchetype, DefensiveRole, Position } from "../types/simulator";
import {
  parseSalaryString,
  isPlayerOptionSalary,
  normalizeName,
  parsePosition,
} from "./csvUtils";

// ---------------------------------------------------------------------------
// Hoopshype contracts
// Columns: Rank, Player, 2025-26, 2026-27, 2027-28, 2028-29
// P$ prefix on a salary value = Player option for that year
// ---------------------------------------------------------------------------

export interface ContractRow {
  name: string;
  /** Normalized name for cross-CSV matching. */
  nameKey: string;
  /** 2025-26 cap hit. */
  currentSalary: number;
  /**
   * 2026-27 value.
   * null  = contract expires after 2025-26 (the "--" case)
   * number = guaranteed or player-option salary (see nextIsPlayerOption)
   */
  nextSeasonSalary: number | null;
  /** True when the 2026-27 column has a "P$" prefix. */
  nextIsPlayerOption: boolean;
}

export function parseHoopshypeContracts(rows: Record<string, string>[]): Map<string, ContractRow> {
  const map = new Map<string, ContractRow>();

  for (const row of rows) {
    const name = row["Player"]?.trim();
    if (!name) continue;

    const currentSalary = parseSalaryString(row["2025-26"] ?? "");
    if (currentSalary === null) continue;

    const nextRaw = row["2026-27"] ?? "";
    const nextSeasonSalary = parseSalaryString(nextRaw);
    const nextIsPlayerOption = isPlayerOptionSalary(nextRaw);

    const entry: ContractRow = {
      name,
      nameKey: normalizeName(name),
      currentSalary,
      nextSeasonSalary,
      nextIsPlayerOption,
    };

    // Prefer the first occurrence (highest-ranked contract) if a player
    // appears more than once due to duplicate rows in the source CSV.
    if (!map.has(entry.nameKey)) {
      map.set(entry.nameKey, entry);
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// Options contracts
// Columns: Player (120), Pos, Team, Age, Option, Option Salary, Status
// Option values: "Player" | "Club"
// ---------------------------------------------------------------------------

export interface OptionRow {
  name: string;
  nameKey: string;
  position: Position;
  teamAbbrev: string;
  optionType: OptionType;
  optionSalary: number;
}

export function parseOptionsContracts(rows: Record<string, string>[]): OptionRow[] {
  const results: OptionRow[] = [];

  for (const row of rows) {
    // The column header is "Player (120)" in the source
    const name = (row["Player (120)"] ?? row["Player"] ?? "").trim();
    if (!name) continue;

    const optionRaw = row["Option"]?.trim();
    if (optionRaw !== "Player" && optionRaw !== "Club") continue;

    const salaryRaw = row["Option Salary"] ?? "";
    const optionSalary = parseSalaryString(salaryRaw);
    if (optionSalary === null) continue;

    results.push({
      name,
      nameKey: normalizeName(name),
      position: parsePosition(row["Pos"] ?? ""),
      teamAbbrev: row["Team"]?.trim() ?? "",
      optionType: optionRaw as OptionType,
      optionSalary,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Option resolution for Player options
//
// Rule:
//   estimatedMarketSalary > optionSalary → player opts out (becomes UFA)
//   estimatedMarketSalary ≤ optionSalary → player opts in (stays on roster)
// ---------------------------------------------------------------------------

export function resolvePlayerOptions(
  expiring: ExpiringContract[]
): { roster: Pick<ExpiringContract, "playerId" | "name">[], expiring: ExpiringContract[] } {
  const optedIn: Pick<ExpiringContract, "playerId" | "name">[] = [];
  const remaining: ExpiringContract[] = [];

  for (const contract of expiring) {
    if (contract.optionType !== "Player" || contract.optionSalary === undefined) {
      remaining.push(contract);
      continue;
    }

    if (contract.estimatedMarketSalary > contract.optionSalary) {
      // Player opts out → stays in expiring list as a plain UFA
      remaining.push({ ...contract, playerOptedOut: true, optionType: undefined, optionSalary: undefined });
    } else {
      // Player opts in → removed from free agency board
      optedIn.push({ playerId: contract.playerId, name: contract.name });
    }
  }

  return { roster: optedIn, expiring: remaining };
}

// ---------------------------------------------------------------------------
// Build the full expiring-contracts list for a team
// ---------------------------------------------------------------------------

export interface BuildExpiringParams {
  teamId: string;
  /** All player rows parsed from master.csv for this team. */
  teamPlayers: Array<{
    id: string;
    name: string;
    nameKey: string;
    age: number;
    position: Position;
    offensiveArchetype: OffensiveArchetype;
    defensiveRole: DefensiveRole;
    currentSalary: number;
    stats: ExpiringContract["stats"];
  }>;
  contractMap: Map<string, ContractRow>;
  optionRows: OptionRow[];
  aceMap: Map<string, number>;
}

export function buildExpiringContracts(params: BuildExpiringParams): ExpiringContract[] {
  const { teamId, teamPlayers, contractMap, optionRows, aceMap } = params;

  // Build option lookup for this team (by normalized name)
  const optionByName = new Map<string, OptionRow>();
  for (const opt of optionRows) {
    if (opt.teamAbbrev === teamId) {
      optionByName.set(opt.nameKey, opt);
    }
  }

  const expiring: ExpiringContract[] = [];

  for (const player of teamPlayers) {
    const contract = contractMap.get(player.nameKey);
    // Use the 2025-26 salary from hoopshype; fall back to master.csv value.
    const currentSalary = contract?.currentSalary ?? player.currentSalary;
    const aceValue = aceMap.get(player.nameKey);
    const estimatedMarketSalary = aceValue ?? currentSalary;
    const isSalaryEstimate = aceValue === undefined;

    const option = optionByName.get(player.nameKey);

    expiring.push({
      playerId: player.id,
      name: player.name,
      age: player.age,
      position: player.position,
      offensiveArchetype: player.offensiveArchetype,
      defensiveRole: player.defensiveRole,
      currentSalary,
      estimatedMarketSalary,
      isSalaryEstimate,
      stats: player.stats,
      ...(option
        ? { optionType: option.optionType, optionSalary: option.optionSalary }
        : {}),
    });
  }

  return expiring;
}
