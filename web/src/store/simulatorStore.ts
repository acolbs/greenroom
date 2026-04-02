import { create } from "zustand";
import type {
  SimulatorState,
  SimulatorPhase,
  FreeAgencyDecision,
  RosterPlayer,
  DraftProspect,
  DraftHistoryEntry,
} from "../types/simulator";
import { SALARY_CAP, TOTAL_DRAFT_PICKS, TEAMS, rookieSalaryFromGrade } from "../data/constants";
import { assetUrl } from "../data/assetUrl";
import { parseCsv, normalizeName } from "../data/csvUtils";
import { buildAceLookup } from "../data/aceModel";
import { parseHoopshypeContracts, parseOptionsContracts, buildExpiringContracts, resolvePlayerOptions } from "../data/parseContracts";
import type { ContractRow, OptionRow } from "../data/parseContracts";
import { parseMasterRows, buildTeamRoster } from "../data/parseMaster";
import type { MasterRow } from "../data/parseMaster";
import { parseDraftClass } from "../data/parseBigBoard";
import {
  applyProspectCollegeStats,
  parseProspectStatsByRank,
} from "../data/parseProspectStats";
import {
  CHAMPIONSHIP_FORMULA,
  computeRosterDeficits,
} from "../data/championshipFormula";
import { computeTeamStrength } from "../data/prospectRanking";

// ---------------------------------------------------------------------------
// Singleton data cache — CSVs are fetched once, then reused across team switches
// ---------------------------------------------------------------------------

interface LoadedData {
  masterRows: Map<string, MasterRow>;
  contractMap: Map<string, ContractRow>;
  optionRows: OptionRow[];
  aceMap: Map<string, number>;
  draftClass: DraftProspect[];
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
    const [masterText, statsText, contractsText, optionsText, bigBoardText, prospectStatsText] =
      await Promise.all([
        fetchText("data/master.csv"),
        fetchText("data/2025-2026_Stats.csv"),
        fetchText("data/hoopshype_contracts.csv"),
        fetchText("data/options_contracts.csv"),
        fetchText("data/big_board.csv"),
        fetchText("data/prospect_stats.csv"),
      ]);

    const masterRows = parseMasterRows(parseCsv(masterText));
    const contractMap = parseHoopshypeContracts(parseCsv(contractsText));
    const optionRows = parseOptionsContracts(parseCsv(optionsText));
    const aceMap = buildAceLookup(parseCsv(statsText));
    const prospectStatsByRank = parseProspectStatsByRank(parseCsv(prospectStatsText));
    const draftClass = applyProspectCollegeStats(
      parseDraftClass(parseCsv(bigBoardText)),
      prospectStatsByRank
    );

    return { masterRows, contractMap, optionRows, aceMap, draftClass };
  })();

  // On error, clear the cache so the next attempt can retry
  dataCache.catch(() => { dataCache = null; });

  return dataCache;
}

// ---------------------------------------------------------------------------
// Cap space helper
// ---------------------------------------------------------------------------

function computeCapSpace(roster: RosterPlayer[]): number {
  const committed = roster.reduce((sum, p) => sum + p.currentSalary, 0);
  return SALARY_CAP - committed;
}

// ---------------------------------------------------------------------------
// CPU draft pick assignment
// Simple model: pick N belongs to TEAMS[(N-1) % 30]
// ---------------------------------------------------------------------------

function teamForPick(pickNumber: number): string {
  return TEAMS[(pickNumber - 1) % 30].id;
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
  championshipFormula: CHAMPIONSHIP_FORMULA,
  rosterDeficits: [],
  teamStrength: { score: 0, label: "Rebuilding" },
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
    }, 600);
  }

  // ── After any draft pick, check what comes next ─────────────────────────
  function advanceDraftAfterPick() {
    const state = get();
    const nextPick = state.draftCurrentPick;

    if (nextPick > state.draftTotalPicks) {
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
          teamOptionNameKeys.has(normalizeName(p.name));

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
              nameKey: normalizeName(p.name),
              age: p.age,
              position: p.position,
              offensiveArchetype: p.offensiveArchetype,
              defensiveRole: p.defensiveRole,
              currentSalary: p.currentSalary,
              stats: p.stats,
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
            (o) => o.teamAbbrev === teamId && match && o.nameKey === normalizeName(match.name)
          );
          if (!match || !optRow) return [];
          return [{ ...match, currentSalary: optRow.optionSalary }];
        });

        const finalRoster = [...committed, ...optedInPlayers].sort(
          (a, b) => b.currentSalary - a.currentSalary
        );

        set({
          loading: false,
          phase: "FREE_AGENCY",
          roster: finalRoster,
          expiringContracts: expiring,
          decisions: {},
          draftClass: data.draftClass,
          draftAvailableProspects: data.draftClass,
          capSpace: computeCapSpace(finalRoster),
          rosterDeficits: computeRosterDeficits(finalRoster),
          teamStrength: computeTeamStrength(finalRoster),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load data.";
        set({ loading: false, error: message });
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
        capSpace: computeCapSpace(roster),
        rosterDeficits: computeRosterDeficits(roster),
        teamStrength: computeTeamStrength(roster),
      });
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
      }

      set(update);
    },

    // ── setUserPickNumbers ───────────────────────────────────────────────────
    setUserPickNumbers: (picks) => {
      if (picks.length === 0) return "Enter at least one pick number.";

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
      if (state.userPickNumbers.length === 0) return;

      clearCpuTimer();
      set({
        draftSimActive: true,
        draftSimComplete: false,
        draftCurrentPick: 1,
        draftHistory: [],
        draftAvailableProspects: [...state.draftClass],
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
        id: `draft-${prospect.id}`,
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
      };

      const nextRoster = [...state.roster, rookiePlayer];
      const nextPick = state.draftCurrentPick + 1;

      set({
        roster: nextRoster,
        capSpace: computeCapSpace(nextRoster),
        rosterDeficits: computeRosterDeficits(nextRoster),
        teamStrength: computeTeamStrength(nextRoster),
        draftAvailableProspects: state.draftAvailableProspects.filter(
          (p) => p.id !== prospectId
        ),
        draftHistory: [...state.draftHistory, entry],
        draftCurrentPick: nextPick,
      });

      advanceDraftAfterPick();
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
  selectPayroll(state) > 201_000_000;

export const selectIsOverFirstApron = (state: SimulatorStore) =>
  selectPayroll(state) > 209_000_000;

export const selectIsOverSecondApron = (state: SimulatorStore) =>
  selectPayroll(state) > 222_000_000;

export const selectCurrentUserPick = (state: SimulatorStore): number | null => {
  if (!state.draftSimActive) return null;
  return state.userPickNumbers.includes(state.draftCurrentPick)
    ? state.draftCurrentPick
    : null;
};
