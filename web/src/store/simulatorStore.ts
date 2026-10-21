import { create } from "zustand";
import type {
  SimulatorState,
  SimulatorPhase,
  FreeAgencyDecision,
  RosterPlayer,
  DraftProspect,
  DraftHistoryEntry,
} from "../types/simulator";
import { SALARY_CAP, LUXURY_TAX, FIRST_APRON, SECOND_APRON, TOTAL_DRAFT_PICKS, TEAMS, DRAFT_ORDER_2026, rookieSalaryFromGrade } from "../data/constants";
import { assetUrl } from "../data/assetUrl";
import { parseCsv, playerMatchKey } from "../data/csvUtils";
import { buildAceLookup } from "../data/aceModel";
import { parseHoopshypeContracts, parseOptionsContracts, buildExpiringContracts, resolvePlayerOptions } from "../data/parseContracts";
import type { ContractRow, OptionRow } from "../data/parseContracts";
import { parseMasterRows, buildTeamRoster } from "../data/parseMaster";
import type { MasterRow } from "../data/parseMaster";
import { parseDraftClass } from "../data/parseBigBoard";
import {
  applyProspectCollegeStats,
  parseProspectStatsByName,
} from "../data/parseProspectStats";
import {
  parseProspectCompsByName,
  parseProspectSuccessByName,
  attachProspectML,
} from "../data/parseProspectML";
import { parsePhysicalsByName, applyProspectPhysicals } from "../data/parsePhysicals";
import type { Physicals } from "../data/parsePhysicals";
import { attachProspectTalent } from "../lib/talentScore";
import { parseRingerRolesByName, applyRingerRoles } from "../data/parseRingerRoles";
import { parseNbaRadarByName } from "../data/parseNbaRadar";
import type { NbaRadarStats } from "../data/parseNbaRadar";
import type { ComparisonData, ActualDraftPick, TeamStrength, TeamStrengthLabel } from "../types/simulator";
import {
  computeStage,
  rankBlueprints,
  starComps,
  blueprintNeeds,
  blueprintById,
  type StageReport,
} from "../lib/teamAnalysis";

// ---------------------------------------------------------------------------
// Singleton data cache — CSVs are fetched once, then reused across team switches
// ---------------------------------------------------------------------------

interface LoadedData {
  masterRows: Map<string, MasterRow>;
  contractMap: Map<string, ContractRow>;
  optionRows: OptionRow[];
  aceMap: Map<string, number>;
  draftClass: DraftProspect[];
  comparisonData: ComparisonData;
  /** 2025-26 win % by master.csv team abbreviation (BRK, CHO, PHO, ...). */
  winPctByCsvTeam: Map<string, number>;
  actualDraft: ActualDraftPick[];
}

let dataCache: Promise<LoadedData> | null = null;

async function fetchText(path: string): Promise<string> {
  const res = await fetch(assetUrl(path));
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.text();
}

function loadAllData(): Promise<LoadedData> {
  if (dataCache) return dataCache;

  dataCache = (async (): Promise<LoadedData> => {
    const [
      masterText,
      statsText,
      contractsText,
      optionsText,
      bigBoardText,
      prospectStatsText,
      prospectCompsText,
      prospectSuccessText,
      physicalsText,
      actualDraftText,
    ] = await Promise.all([
      fetchText("data/master.csv"),
      fetchText("data/2025-2026_Stats.csv"),
      fetchText("data/hoopshype_contracts.csv"),
      fetchText("data/options_contracts.csv"),
      fetchText("data/big_board.csv"),
      fetchText("data/prospect_stats.csv"),
      fetchText("data/prospect_comps.csv"),
      fetchText("data/prospect_success.csv"),
      fetchText("data/physicals.csv"),
      fetchText("data/actual_draft_2026.csv"),
    ]);

    // Optional, user-maintained archetype overrides. Missing file → no overrides.
    const ringerRolesText = await fetchText("data/ringer_roles.csv").catch(() => "");
    const ringerRoles = parseRingerRolesByName(
      ringerRolesText ? parseCsv(ringerRolesText) : []
    );

    // Deadline trades and late-season moves, so rosters match the real pre-draft state.
    const movesText = await fetchText("data/roster_moves_2026.csv").catch(() => "");
    const moves = new Map(
      (movesText ? parseCsv(movesText) : []).map((r) => [playerMatchKey(r["Player"] ?? ""), (r["Team"] ?? "").trim()])
    );

    const masterRowsParsed = parseCsv(masterText);
    const masterRows = parseMasterRows(masterRowsParsed, moves);
    const contractMap = parseHoopshypeContracts(parseCsv(contractsText));
    const optionRows = addHoopshypeOptions(
      parseOptionsContracts(parseCsv(optionsText)),
      masterRows,
      contractMap
    );
    const statsRows = parseCsv(statsText);
    const aceMap = buildAceLookup(statsRows);
    const winPctByCsvTeam = new Map<string, number>();
    for (const row of statsRows) {
      const w = Number(row["WIN %"]);
      if (row["Team"] && Number.isFinite(w) && w > 0) winPctByCsvTeam.set(row["Team"], w);
    }
    const actualDraft: ActualDraftPick[] = parseCsv(actualDraftText).map((r) => ({
      pick: Number(r["Pick"]),
      player: r["Player"],
      teamId: r["Team"],
      school: r["School"],
    }));
    const prospectStatsByName = parseProspectStatsByName(parseCsv(prospectStatsText));
    const compsByName = parseProspectCompsByName(parseCsv(prospectCompsText));
    const successByName = parseProspectSuccessByName(parseCsv(prospectSuccessText));
    const physicalsByName = parsePhysicalsByName(parseCsv(physicalsText));
    const nbaRadarByName = parseNbaRadarByName(masterRowsParsed);
    const draftClass = attachProspectTalent(
      applyRingerRoles(
        applyProspectPhysicals(
          attachProspectML(
            applyProspectCollegeStats(parseDraftClass(parseCsv(bigBoardText)), prospectStatsByName),
            compsByName,
            successByName
          ),
          physicalsByName
        ),
        ringerRoles
      )
    );

    const prospectPhysicals: Physicals[] = [...physicalsByName.values()].filter(
      (p) => p.kind === "prospect"
    );
    const comparisonData: ComparisonData = {
      nbaRadarByName,
      physicalsByName,
      prospectPhysicals,
    };

    return {
      masterRows,
      contractMap,
      optionRows,
      aceMap,
      draftClass,
      comparisonData,
      winPctByCsvTeam,
      actualDraft,
    };
  })();

  // On error, clear the cache so the next attempt can retry
  dataCache.catch(() => { dataCache = null; });

  return dataCache;
}

// ---------------------------------------------------------------------------
// options_contracts.csv misses some P$/T$ options that hoopshype lists, which
// made them count as guaranteed money. Fill the gaps from the contract map.
// ---------------------------------------------------------------------------

function addHoopshypeOptions(
  optionRows: OptionRow[],
  masterRows: Map<string, MasterRow>,
  contractMap: Map<string, ContractRow>
): OptionRow[] {
  const known = new Set(optionRows.map((o) => o.nameKey));
  const result = [...optionRows];

  for (const row of masterRows.values()) {
    const contract = contractMap.get(row.nameKey);
    if (!contract || contract.nextSeasonSalary === null) continue;
    if (!contract.nextIsPlayerOption && !contract.nextIsTeamOption) continue;
    if (!row.canonicalTeamId || known.has(row.nameKey)) continue;

    known.add(row.nameKey);
    result.push({
      name: row.name,
      nameKey: row.nameKey,
      position: row.position,
      teamAbbrev: row.canonicalTeamId,
      optionType: contract.nextIsTeamOption ? "Club" : "Player",
      optionSalary: contract.nextSeasonSalary,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Cap space helper
// ---------------------------------------------------------------------------

function computeCapSpace(roster: RosterPlayer[]): number {
  const committed = roster.reduce((sum, p) => sum + p.currentSalary, 0);
  return SALARY_CAP - committed;
}

// ---------------------------------------------------------------------------
// Roster-derived state
// ---------------------------------------------------------------------------

/** Cap space and blueprint needs for a roster, given the blueprint target. */
function rosterDerived(roster: RosterPlayer[], targetBlueprintId: string | null) {
  const bp = targetBlueprintId ? blueprintById(targetBlueprintId) : undefined;
  return {
    capSpace: computeCapSpace(roster),
    rosterDeficits: bp ? blueprintNeeds(roster, bp) : [],
  };
}

function effectiveStrength(stage: StageReport | null, override: TeamStrengthLabel | null): TeamStrength {
  return { score: (stage?.score ?? 0) / 100, label: override ?? stage?.label ?? "Rebuilding" };
}

// Drafted rookies are tagged by id prefix so a re-run draft can strip them.
const DRAFTED_ID_PREFIX = "draft-";

function rosterWithoutRookies(roster: RosterPlayer[], targetBlueprintId: string | null) {
  const kept = roster.filter((p) => !p.id.startsWith(DRAFTED_ID_PREFIX));
  return { roster: kept, ...rosterDerived(kept, targetBlueprintId) };
}

/** Stage of every team from its 2025-26 roster, for the team picker. */
export interface TeamStageSummary {
  score: number;
  label: TeamStrengthLabel;
}

// ---------------------------------------------------------------------------
// CPU draft pick assignment
// Uses the real 2026 order, round-robin past its end
// ---------------------------------------------------------------------------

export function teamForPick(pickNumber: number): string {
  // Use the actual 2026 draft order; fall back to round-robin if out of range.
  return DRAFT_ORDER_2026[pickNumber - 1] ?? TEAMS[(pickNumber - 1) % 30].id;
}

// ---------------------------------------------------------------------------
// CPU pick logic — best available by rank (for CPU teams without a profile).
// Formula deficit weighting for user's team is handled via Scout AI.
// ---------------------------------------------------------------------------

function cpuSelectProspect(available: DraftProspect[]): DraftProspect | null {
  if (available.length === 0) return null;
  return available[0]; // sorted by rank ascending
}

// ---------------------------------------------------------------------------
// Draft timer
// ---------------------------------------------------------------------------

let cpuTimer: ReturnType<typeof setTimeout> | null = null;

/** Milliseconds between CPU picks. */
let cpuDelay = 600;

export function setCpuPickDelay(ms: number) {
  cpuDelay = ms;
}

function clearCpuTimer() {
  if (cpuTimer) { clearTimeout(cpuTimer); cpuTimer = null; }
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_STATE: SimulatorState & { capSpace: number } = {
  phase: "SELECT_TEAM",
  selectedTeamId: null,
  roster: [],
  expiringContracts: [],
  decisions: {},
  draftClass: [],
  draftAvailableProspects: [],
  draftHistory: [],
  draftCurrentPick: 1,
  draftTotalPicks: TOTAL_DRAFT_PICKS,
  userPickNumbers: [],
  draftSimActive: false,
  draftSimComplete: false,
  seasonRoster: [],
  stage: null,
  stageOverride: null,
  blueprintRanking: [],
  targetBlueprintId: null,
  comps: [],
  rosterDeficits: [],
  teamStrength: { score: 0, label: "Rebuilding" },
  actualDraft: [],
  comparisonData: null,
  loading: false,
  error: null,
  capSpace: SALARY_CAP,
};

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface SimulatorStore extends SimulatorState {
  capSpace: number;

  /** Load CSVs and build the roster for the chosen team. */
  selectTeam: (teamId: string) => Promise<void>;

  /**
   * Record a free-agency decision for an expiring-contract player.
   * RE_SIGN / PICK_UP_OPTION → adds to roster.
   * LET_WALK / DECLINE_OPTION → removes from board.
   */
  makeFreeAgencyDecision: (playerId: string, decision: FreeAgencyDecision) => void;

  /** Take back a free-agency decision (removes the player if they'd been kept). */
  undoFreeAgencyDecision: (playerId: string) => void;

  /** Move the simulator forward to the given phase. */
  advanceToPhase: (phase: SimulatorPhase) => void;

  /**
   * Validate and set the pick numbers owned by the user.
   * Returns an error string on invalid input, null on success.
   */
  setUserPickNumbers: (picks: number[]) => string | null;

  /**
   * Begin the live draft simulation.
   * CPU immediately auto-picks until the first user pick is reached.
   */
  startDraftSimulation: () => void;

  /** User selects a prospect at their current pick. */
  userDraftPick: (prospectId: string) => void;

  /** Force a stage (or null to go back to the computed one). */
  setStageOverride: (label: TeamStrengthLabel | null) => void;

  /** Choose which past contender to build toward. */
  setTargetBlueprint: (blueprintId: string) => void;

  /** Stage of all 30 teams, for the team picker. */
  loadTeamStages: () => Promise<Record<string, TeamStageSummary>>;

  /** Reset everything back to the initial state. */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useSimulatorStore = create<SimulatorStore>((set, get) => {

  // ── CPU auto-draft loop ─────────────────────────────────────────────────
  function scheduleCpuPicks() {
    clearCpuTimer();
    cpuTimer = setTimeout(() => {
      const state = get();
      if (!state.draftSimActive || state.draftSimComplete) return;

      const pick = state.draftCurrentPick;

      // Stop when we reach a user pick (UI waits for user input)
      if (state.userPickNumbers.includes(pick)) return;

      // Draft is over
      if (pick > state.draftTotalPicks) {
        set({ draftSimActive: false, draftSimComplete: true });
        return;
      }

      const prospect = cpuSelectProspect(state.draftAvailableProspects);
      if (!prospect) {
        set({ draftSimActive: false, draftSimComplete: true });
        return;
      }

      const entry: DraftHistoryEntry = {
        pickNumber: pick,
        prospectId: prospect.id,
        pickedBy: teamForPick(pick),
      };

      const nextPick = pick + 1;
      const isDraftOver = nextPick > state.draftTotalPicks;

      set({
        draftAvailableProspects: state.draftAvailableProspects.filter(
          (p) => p.id !== prospect.id
        ),
        draftHistory: [...state.draftHistory, entry],
        draftCurrentPick: nextPick,
        ...(isDraftOver
          ? { draftSimActive: false, draftSimComplete: true }
          : {}),
      });

      if (!isDraftOver) scheduleCpuPicks();
    }, cpuDelay);
  }

  // ── After any draft pick, check what comes next ─────────────────────────
  function advanceDraftAfterPick() {
    const state = get();
    const nextPick = state.draftCurrentPick;

    // End the draft once we run past the last pick OR exhaust the prospect pool
    // (the class can be smaller than the 60 pick slots).
    if (nextPick > state.draftTotalPicks || state.draftAvailableProspects.length === 0) {
      set({ draftSimActive: false, draftSimComplete: true });
      return;
    }

    // If next pick is also a CPU pick, schedule it
    if (!state.userPickNumbers.includes(nextPick)) {
      scheduleCpuPicks();
    }
    // Otherwise: UI is waiting for the user — do nothing
  }

  return {
    ...INITIAL_STATE,

    // ── selectTeam ──────────────────────────────────────────────────────────
    selectTeam: async (teamId) => {
      const team = TEAMS.find((t) => t.id === teamId);
      if (!team) {
        set({ error: `Unknown team: ${teamId}` });
        return;
      }

      set({ loading: true, error: null, selectedTeamId: teamId });

      try {
        const data = await loadAllData();

        // Build the full parsed roster from master.csv + contracts + ACE
        const fullRoster = buildTeamRoster({
          teamId,
          masterRows: data.masterRows,
          contractMap: data.contractMap,
          aceMap: data.aceMap,
        });

        // Players with a Club or Player option must go to the free agency board
        // even though hoopshype lists an option salary in the 2026-27 column.
        const teamOptionNameKeys = new Set(
          data.optionRows
            .filter((o) => o.teamAbbrev === teamId)
            .map((o) => o.nameKey)
        );

        const hasOption = (p: RosterPlayer) =>
          teamOptionNameKeys.has(playerMatchKey(p.name));

        // Committed = guaranteed 2026-27 salary with no option clause.
        // Set currentSalary to next-season value so cap math is correct.
        const committed: RosterPlayer[] = fullRoster
          .filter((p) => p.nextSeasonSalary !== null && !hasOption(p))
          .map((p) => ({ ...p, currentSalary: p.nextSeasonSalary! }));

        // Expiring = contract runs out OR player/club option needs a decision.
        const rawExpiring = buildExpiringContracts({
          teamId,
          teamPlayers: fullRoster
            .filter((p) => p.nextSeasonSalary === null || hasOption(p))
            .map((p) => ({
              id: p.id,
              name: p.name,
              nameKey: playerMatchKey(p.name),
              age: p.age,
              position: p.position,
              offensiveArchetype: p.offensiveArchetype,
              defensiveRole: p.defensiveRole,
              currentSalary: p.currentSalary,
              stats: p.stats,
              talentScore: p.talentScore,
              talentTier: p.talentTier,
            })),
          contractMap: data.contractMap,
          optionRows: data.optionRows,
          aceMap: data.aceMap,
        });

        // Auto-resolve Player options
        // Strip Low Minute players — these are end-of-bench fillers with no
        // meaningful free agency value and clutter the decision board.
        const filteredExpiring = rawExpiring.filter(
          (c) => c.offensiveArchetype !== "Low Minute"
        );

        const { roster: optedIn, expiring } = resolvePlayerOptions(filteredExpiring);

        // Players who opted in: find them in the full roster and add at option salary
        const optedInPlayers: RosterPlayer[] = optedIn.flatMap(({ playerId }) => {
          const match = fullRoster.find((p) => p.id === playerId);
          const optRow = data.optionRows.find(
            (o) => o.teamAbbrev === teamId && match && o.nameKey === playerMatchKey(match.name)
          );
          if (!match || !optRow) return [];
          return [{ ...match, currentSalary: optRow.optionSalary }];
        });

        const finalRoster = [...committed, ...optedInPlayers].sort(
          (a, b) => b.currentSalary - a.currentSalary
        );

        const stage = computeStage(fullRoster, data.winPctByCsvTeam.get(team.csvAbbrev) ?? null);
        const blueprintRanking = rankBlueprints(fullRoster);
        const targetBlueprintId = blueprintRanking[0]?.blueprint.id ?? null;

        set({
          loading: false,
          phase: "ANALYSIS",
          seasonRoster: fullRoster,
          stage,
          stageOverride: null,
          blueprintRanking,
          targetBlueprintId,
          comps: starComps(fullRoster),
          teamStrength: effectiveStrength(stage, null),
          actualDraft: data.actualDraft,
          roster: finalRoster,
          expiringContracts: expiring,
          decisions: {},
          draftClass: data.draftClass,
          draftAvailableProspects: data.draftClass,
          comparisonData: data.comparisonData,
          ...rosterDerived(finalRoster, targetBlueprintId),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load data.";
        set({ loading: false, error: message, selectedTeamId: null });
      }
    },

    // ── makeFreeAgencyDecision ───────────────────────────────────────────────
    makeFreeAgencyDecision: (playerId, decision) => {
      const state = get();
      const contract = state.expiringContracts.find((c) => c.playerId === playerId);
      if (!contract) return;

      let roster = [...state.roster];

      const basePlayer = {
        id: contract.playerId,
        name: contract.name,
        age: contract.age,
        position: contract.position,
        teamAbbrev: state.selectedTeamId ?? "",
        offensiveArchetype: contract.offensiveArchetype,
        defensiveRole: contract.defensiveRole,
        estimatedMarketSalary: contract.estimatedMarketSalary,
        isSalaryEstimate: contract.isSalaryEstimate,
        stats: contract.stats,
        talentScore: contract.talentScore,
        talentTier: contract.talentTier,
      };

      if (decision === "RE_SIGN") {
        const newPlayer: RosterPlayer = {
          ...basePlayer,
          currentSalary: contract.estimatedMarketSalary,
          nextSeasonSalary: contract.estimatedMarketSalary,
        };
        roster = [...roster, newPlayer].sort((a, b) => b.currentSalary - a.currentSalary);
      } else if (decision === "PICK_UP_OPTION") {
        if (!contract.optionSalary) return;
        const newPlayer: RosterPlayer = {
          ...basePlayer,
          currentSalary: contract.optionSalary,
          nextSeasonSalary: contract.optionSalary,
        };
        roster = [...roster, newPlayer].sort((a, b) => b.currentSalary - a.currentSalary);
      }
      // LET_WALK / DECLINE_OPTION: player is simply not added to the roster

      set({
        roster,
        // Keep contract in the list so the FA card stays mounted and outcome
        // animations can run; UI uses `decisions` to show resolved state.
        expiringContracts: state.expiringContracts,
        decisions: { ...state.decisions, [playerId]: decision },
        ...rosterDerived(roster, state.targetBlueprintId),
      });
    },

    // ── undoFreeAgencyDecision ───────────────────────────────────────────────
    undoFreeAgencyDecision: (playerId) => {
      const state = get();
      if (!(playerId in state.decisions)) return;
      const decisions = { ...state.decisions };
      delete decisions[playerId];
      const roster = state.roster.filter((p) => p.id !== playerId);
      set({ decisions, roster, ...rosterDerived(roster, state.targetBlueprintId) });
    },

    // ── advanceToPhase ───────────────────────────────────────────────────────
    advanceToPhase: (phase) => {
      const state = get();
      const update: Partial<SimulatorStore> = { phase };

      if (phase === "DRAFT") {
        update.draftAvailableProspects = [...state.draftClass];
        update.draftHistory = [];
        update.draftCurrentPick = 1;
        update.draftSimActive = false;
        update.draftSimComplete = false;
        update.userPickNumbers = [];
        Object.assign(update, rosterWithoutRookies(state.roster, state.targetBlueprintId));
      }

      set(update);
    },

    // ── setUserPickNumbers ───────────────────────────────────────────────────
    setUserPickNumbers: (picks) => {
      // Empty is allowed: a team with no picks in the real draft order just
      // watches the full CPU simulation.
      const invalid = picks.filter((p) => p < 1 || p > TOTAL_DRAFT_PICKS);
      if (invalid.length > 0)
        return `Pick numbers must be between 1 and ${TOTAL_DRAFT_PICKS}.`;

      if (new Set(picks).size !== picks.length) return "Duplicate pick numbers.";

      set({ userPickNumbers: picks.slice().sort((a, b) => a - b) });
      return null;
    },

    // ── startDraftSimulation ─────────────────────────────────────────────────
    startDraftSimulation: () => {
      const state = get();

      clearCpuTimer();
      set({
        draftSimActive: true,
        draftSimComplete: false,
        draftCurrentPick: 1,
        draftHistory: [],
        draftAvailableProspects: [...state.draftClass],
        ...rosterWithoutRookies(state.roster, state.targetBlueprintId),
      });

      // If pick 1 belongs to CPU, start auto-picking immediately
      if (!state.userPickNumbers.includes(1)) {
        scheduleCpuPicks();
      }
    },

    // ── userDraftPick ────────────────────────────────────────────────────────
    userDraftPick: (prospectId) => {
      const state = get();
      if (!state.draftSimActive) return;
      if (!state.userPickNumbers.includes(state.draftCurrentPick)) return;

      const prospect = state.draftAvailableProspects.find(
        (p) => p.id === prospectId
      );
      if (!prospect) return;

      const entry: DraftHistoryEntry = {
        pickNumber: state.draftCurrentPick,
        prospectId: prospect.id,
        pickedBy: state.selectedTeamId ?? "user",
      };

      // Add prospect to roster as a rookie
      const rookiePlayer: RosterPlayer = {
        id: `${DRAFTED_ID_PREFIX}${prospect.id}`,
        name: prospect.name,
        age: 20,
        position: prospect.position,
        teamAbbrev: state.selectedTeamId ?? "",
        offensiveArchetype: prospect.offensiveArchetype,
        defensiveRole: prospect.defensiveRole,
        currentSalary: rookieSalaryFromGrade(prospect.grade),
        nextSeasonSalary: rookieSalaryFromGrade(prospect.grade),
        estimatedMarketSalary: rookieSalaryFromGrade(prospect.grade),
        isSalaryEstimate: false,
        stats: { pts: 0, trb: 0, ast: 0, tsPct: 0, bpm: 0, vorp: 0, ws: 0, usgPct: 0 },
        talentScore: prospect.talentScore,
        talentTier: prospect.talentTier,
      };

      const nextRoster = [...state.roster, rookiePlayer];
      const nextPick = state.draftCurrentPick + 1;

      set({
        roster: nextRoster,
        ...rosterDerived(nextRoster, state.targetBlueprintId),
        draftAvailableProspects: state.draftAvailableProspects.filter(
          (p) => p.id !== prospectId
        ),
        draftHistory: [...state.draftHistory, entry],
        draftCurrentPick: nextPick,
      });

      advanceDraftAfterPick();
    },

    // ── stage override / blueprint target ────────────────────────────────────
    setStageOverride: (label) => {
      const state = get();
      set({ stageOverride: label, teamStrength: effectiveStrength(state.stage, label) });
    },

    setTargetBlueprint: (blueprintId) => {
      const state = get();
      if (!blueprintById(blueprintId)) return;
      set({ targetBlueprintId: blueprintId, ...rosterDerived(state.roster, blueprintId) });
    },

    loadTeamStages: async () => {
      const data = await loadAllData();
      const out: Record<string, TeamStageSummary> = {};
      for (const team of TEAMS) {
        const roster = buildTeamRoster({
          teamId: team.id,
          masterRows: data.masterRows,
          contractMap: data.contractMap,
          aceMap: data.aceMap,
        });
        const stage = computeStage(roster, data.winPctByCsvTeam.get(team.csvAbbrev) ?? null);
        out[team.id] = { score: stage.score, label: stage.label };
      }
      return out;
    },

    // ── reset ────────────────────────────────────────────────────────────────
    reset: () => {
      clearCpuTimer();
      // Don't clear the data cache — CSVs stay loaded
      set({ ...INITIAL_STATE });
    },
  };
});

// ---------------------------------------------------------------------------
// Selectors — derive computed values from store state without re-renders
// ---------------------------------------------------------------------------

export const selectPayroll = (state: SimulatorStore) =>
  state.roster.reduce((sum, p) => sum + p.currentSalary, 0);

export const selectIsOverTax = (state: SimulatorStore) =>
  selectPayroll(state) > LUXURY_TAX;

export const selectIsOverFirstApron = (state: SimulatorStore) =>
  selectPayroll(state) > FIRST_APRON;

export const selectIsOverSecondApron = (state: SimulatorStore) =>
  selectPayroll(state) > SECOND_APRON;

export const selectCurrentUserPick = (state: SimulatorStore): number | null => {
  if (!state.draftSimActive) return null;
  return state.userPickNumbers.includes(state.draftCurrentPick)
    ? state.draftCurrentPick
    : null;
};
