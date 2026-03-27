import { create } from "zustand";
import type {
  Archetype,
  DraftPick,
  DraftProspect,
  EliteFitModel,
  FreeAgencyDecision,
  RosterPlayer,
  SimulatorState,
  TeamNeeds
} from "../types/simulator";
import { FALLBACK_DRAFT_CLASS, TEAMS } from "../data/mockData";
import { MOCK_PHASE3_PROSPECTS } from "../data/mockPhase3Prospects";
import { mapCsvArchetypesToSimulator, normalizeName } from "../data/archetypeMap";
import { parseBigBoardRows } from "../data/parseBigBoardCsv";
import { parseCsvRecords } from "../data/csvParse";
import {
  CONTENDER_TEAM_CSV_FILES,
  buildEliteFitModelFromContenderRows,
  eliteTemplateShortfall,
  parseContenderRows
} from "../data/contenderModel";
import {
  buildLeagueArchetypePeers,
  enrichDraftProspectsWithInferredArchetypes,
  getLeagueArchetypePeers,
  setLeagueArchetypePeers
} from "../data/prospectArchetypeInference";
import { publicAssetUrl } from "../data/publicAssetUrl";
import { capSpaceFromPayroll } from "../data/capSpace";
import { simulatorTeamIdFromCsvAbbrev } from "../data/csvTeamMap";

const toNumber = (n: number) => (Number.isFinite(n) ? n : 0);

function salaryCapForTeamId(teamId: string | null): number {
  if (!teamId) return 0;
  return TEAMS.find((t) => t.id === teamId)?.salaryCap ?? 0;
}

const DEFAULT_DRAFT_SIM_TOTAL = 90;

let draftCpuTimer: ReturnType<typeof setTimeout> | null = null;

function clearDraftCpuTimer() {
  if (draftCpuTimer) {
    clearTimeout(draftCpuTimer);
    draftCpuTimer = null;
  }
}

function buildDraftSimulationPool(draftClass: DraftProspect[]): DraftProspect[] {
  const raw = draftClass.length > 0 ? [...draftClass] : [...MOCK_PHASE3_PROSPECTS];
  const sorted = [...raw].sort((a, b) => a.overallRank - b.overallRank);
  return sorted.slice(0, Math.min(DEFAULT_DRAFT_SIM_TOTAL, sorted.length));
}

function detachSimDraftPicksFromRoster(state: { roster: RosterPlayer[]; selectedTeamId: string | null }) {
  const roster = state.roster.filter((pl) => !String(pl.id).startsWith("draft-"));
  const cap = salaryCapForTeamId(state.selectedTeamId);
  return { roster, capSpace: capSpaceFromPayroll(cap, roster) };
}

// Hoopshype CSV column headers (wide format).
const CURRENT_SEASON_COL = "2025-26";
const NEXT_SEASON_COL = "2026-27";

const salaryFromProspectGrade = (grade: number) => {
  // Skeleton heuristic: map 60..95 -> roughly 6M..18M.
  const clamped = Math.max(60, Math.min(95, grade));
  const t = (clamped - 60) / (95 - 60);
  return Math.round(6_000_000 + t * 12_000_000);
};

const computeArchetypeCounts = (roster: RosterPlayer[]): Partial<Record<Archetype, number>> => {
  const counts: Partial<Record<Archetype, number>> = {};
  for (const p of roster) {
    counts[p.archetype] = (counts[p.archetype] ?? 0) + 1;
  }
  return counts;
};

const subtractCounts = (base: Partial<Record<Archetype, number>>, current: Partial<Record<Archetype, number>>): TeamNeeds => {
  const needs: TeamNeeds = {};
  const all = new Set<Archetype>([
    ...(Object.keys(base) as Archetype[]),
    ...(Object.keys(current) as Archetype[])
  ]);
  for (const arch of all) {
    const b = base[arch] ?? 0;
    const c = current[arch] ?? 0;
    const gap = Math.max(0, b - c);
    if (gap > 0) needs[arch] = gap;
  }
  return needs;
};

/**
 * Undrafted prospects sorted by legacy archetype need (post–FA baseline vs. current roster)
 * plus elite contender template shortfall. Used only for `getScoutTopPicks` / ScoutAIPrompt.
 * Phase 3 draft UI uses championship `RosterGap[]` + `sortProspectsByChampionshipFit` instead.
 */
const sortAvailableProspectsByEliteArchetypeFit = (state: {
  draftClass: DraftProspect[];
  draftedProspects: DraftPick[];
  roster: RosterPlayer[];
  eliteFitModel: EliteFitModel | null;
  freeAgencyBaselineArchetypeCounts: Partial<Record<Archetype, number>>;
}): DraftProspect[] => {
  const { draftClass, draftedProspects, roster, eliteFitModel, freeAgencyBaselineArchetypeCounts } = state;
  const baselineGap = subtractCounts(freeAgencyBaselineArchetypeCounts, computeArchetypeCounts(roster));
  const currentCounts = computeArchetypeCounts(roster);
  const n = roster.length;
  const draftedIds = new Set(draftedProspects.map((d) => d.prospectId));

  const eliteShort =
    eliteFitModel && n > 0 ? eliteTemplateShortfall(currentCounts, n, eliteFitModel) : ({} as TeamNeeds);

  const score = (p: DraftProspect) => {
    const baseNeed = baselineGap[p.projectedArchetype] ?? 0;
    let eliteTerm = 0;
    if (eliteFitModel && n > 0) {
      const gap = eliteShort[p.projectedArchetype] ?? 0;
      const pr = eliteFitModel.priorityByArchetype[p.projectedArchetype] ?? 0.35;
      eliteTerm = gap * (380 + 620 * pr);
    }
    return baseNeed * 1000 + eliteTerm + p.grade * 3 - p.overallRank;
  };

  return [...draftClass]
    .filter((p) => !draftedIds.has(p.id))
    .sort((a, b) => score(b) - score(a));
};

const parseHoopsMoney = (x: unknown): number | null => {
  if (x === null || x === undefined) return null;
  const s = String(x).trim();
  if (!s) return null;
  // In our CSV export, blank salary cells come through as '--'
  if (s === "--" || s === "-" || s === "—") return null;
  const digits = s.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
};

/** ACE column from `2025-2026_Stats.csv` — annual contract $ (parsed as number). */
const parseAceDollars = (raw: string): number | null => {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

const buildAceByPlayerKey = (rows: Record<string, string>[]): Map<string, number> => {
  const m = new Map<string, number>();
  for (const row of rows) {
    const player = row["Player"]?.trim();
    if (!player) continue;
    const ace = parseAceDollars(row["ACE"] ?? "");
    if (ace === null) continue;
    const key = normalizeName(player);
    const prev = m.get(key);
    if (prev === undefined || ace > prev) m.set(key, ace);
  }
  return m;
};

type LoadedData = {
  hoopSalaryByPlayer: Map<string, { currentSalary: number; nextSalary: number | null }>;
  rosterByTeam: Map<string, RosterPlayer[]>;
  draftClass: DraftProspect[];
  eliteFitModel: EliteFitModel;
  aceByPlayerKey: Map<string, number>;
};

let loadedDataPromise: Promise<LoadedData> | null = null;

const loadHoopshypeRosterData = async (): Promise<LoadedData> => {
  if (loadedDataPromise) return loadedDataPromise;

  loadedDataPromise = (async () => {
    const csvTexts = await Promise.all([
      fetch(publicAssetUrl("data/hoopshype_contracts.csv")).then((r) => r.text()),
      fetch(publicAssetUrl("data/master.csv")).then((r) => r.text()),
      fetch(publicAssetUrl("data/pergame.csv")).then((r) => r.text()),
      fetch(publicAssetUrl("data/archetypes.csv")).then((r) => r.text()),
      fetch(publicAssetUrl("data/big_board.csv")).then((r) => r.text()),
      fetch(publicAssetUrl("data/2025-2026_Stats.csv"))
        .then((r) => (r.ok ? r.text() : ""))
        .catch(() => ""),
      ...CONTENDER_TEAM_CSV_FILES.map((f) =>
        fetch(publicAssetUrl(`data/top_teams/${encodeURI(f)}`))
          .then((r) => (r.ok ? r.text() : ""))
          .catch(() => "")
      )
    ]);

    const [
      contractsCsvText,
      masterCsvText,
      pergameCsvText,
      archetypesCsvText,
      bigBoardCsvText,
      stats2025CsvText,
      ...contenderCsvTexts
    ] = csvTexts;

    const contractsRows = parseCsvRecords(contractsCsvText);
    const hoopSalaryByPlayer = new Map<string, { currentSalary: number; nextSalary: number | null }>();

    for (const r of contractsRows) {
      const player = r["Player"];
      if (!player) continue;
      const playerKey = normalizeName(player);
      const cur = parseHoopsMoney(r[CURRENT_SEASON_COL]);
      if (cur === null) continue;
      const nxt = parseHoopsMoney(r[NEXT_SEASON_COL]);
      const existing = hoopSalaryByPlayer.get(playerKey);
      // If duplicates exist, keep the max current salary.
      if (!existing || cur > existing.currentSalary) {
        hoopSalaryByPlayer.set(playerKey, { currentSalary: cur, nextSalary: nxt });
      }
    }

    const masterRows = parseCsvRecords(masterCsvText);
    const pergameRows = parseCsvRecords(pergameCsvText);
    const archetypesRows = parseCsvRecords(archetypesCsvText);
    const aceByPlayerKey = buildAceByPlayerKey(parseCsvRecords(stats2025CsvText));

    const archetypesByPlayer = new Map<string, { offensive: string; defensive: string }>();
    for (const ar of archetypesRows) {
      const p = ar["Player"];
      if (!p) continue;
      const off = ar["Offensive Archetype"] ?? "";
      const def = ar["Defensive Role"] ?? "";
      archetypesByPlayer.set(normalizeName(p), { offensive: off, defensive: def });
    }

    // pergame.csv provides our basic stats for PlayerCard.
    const pergameByPlayerTeam = new Map<
      string,
      { fgPct: number; pointsPerGame: number; reboundsPerGame: number; assistsPerGame: number; pos: RosterPlayer["position"] }
    >();
    for (const pr of pergameRows) {
      const name = pr["Player"];
      const team = pr["Team"];
      const pos = pr["Pos"];
      if (!name || !team || !pos) continue;

      const points = Number(pr["PTS"]);
      const rebounds = Number(pr["TRB"]);
      const assists = Number(pr["AST"]);
      const fgPctRaw = Number(pr["FG%"]);

      if (!Number.isFinite(points) || !Number.isFinite(rebounds) || !Number.isFinite(assists) || !Number.isFinite(fgPctRaw)) continue;
      const fgPct = fgPctRaw > 1 ? fgPctRaw / 100 : fgPctRaw;

      const key = `${normalizeName(name)}|${team}`;
      pergameByPlayerTeam.set(key, {
        fgPct,
        pointsPerGame: points,
        reboundsPerGame: rebounds,
        assistsPerGame: assists,
        pos: pos as RosterPlayer["position"]
      });
    }

    const contenderParsed = contenderCsvTexts.flatMap((text) => parseContenderRows(parseCsvRecords(text)));
    const eliteFitModel = buildEliteFitModelFromContenderRows(contenderParsed);

    const leaguePeers = buildLeagueArchetypePeers(masterRows, pergameByPlayerTeam, archetypesByPlayer);
    setLeagueArchetypePeers(leaguePeers);

    const bigBoardRows = parseCsvRecords(bigBoardCsvText);
    const parsedBoard = parseBigBoardRows(bigBoardRows as Record<string, unknown>[]);
    const enrichedBoard = enrichDraftProspectsWithInferredArchetypes(parsedBoard, leaguePeers);
    const draftClass = enrichedBoard.length > 0 ? enrichedBoard : FALLBACK_DRAFT_CLASS;

    const rosterByTeam = new Map<string, RosterPlayer[]>();

    for (const mr of masterRows) {
      const name = mr["Player"];
      const teamRaw = mr["Team"];
      const pos = mr["Pos"];
      const offArch = mr["Offensive Archetype"];
      const defRole = mr["Defensive Role"];
      if (!name || !teamRaw || !pos) continue;

      const csvTeam = String(teamRaw).trim();
      const simTeamId = simulatorTeamIdFromCsvAbbrev(csvTeam);

      const playerKey = normalizeName(name);
      const salaryRow = hoopSalaryByPlayer.get(playerKey);
      if (!salaryRow) continue;

      const pgKey = `${playerKey}|${csvTeam}`;
      const pg = pergameByPlayerTeam.get(pgKey);
      if (!pg) continue;

      const simPosition = pos as RosterPlayer["position"];
      const archRow = archetypesByPlayer.get(playerKey);
      const off = archRow?.offensive ?? offArch ?? "";
      const def = archRow?.defensive ?? defRole ?? "";
      const offTrim = String(off).trim();
      const defTrim = String(def).trim();
      const archetype = mapCsvArchetypesToSimulator(simPosition, offTrim, defTrim);

      const rosterPlayer: RosterPlayer = {
        id: `roster-${playerKey}-${simTeamId}`,
        name,
        position: simPosition,
        archetype,
        csvOffensiveArchetype: offTrim,
        csvDefensiveRole: defTrim,
        stats: {
          pointsPerGame: toNumber(pg.pointsPerGame),
          reboundsPerGame: toNumber(pg.reboundsPerGame),
          assistsPerGame: toNumber(pg.assistsPerGame),
          fgPct: toNumber(pg.fgPct)
        },
        currentSalary: salaryRow.currentSalary
      };

      const list = rosterByTeam.get(simTeamId) ?? [];
      list.push(rosterPlayer);
      rosterByTeam.set(simTeamId, list);
    }

    return { hoopSalaryByPlayer, rosterByTeam, draftClass, eliteFitModel, aceByPlayerKey };
  })();

  return loadedDataPromise;
};

type SimulatorStore = SimulatorState & {
  selectTeam: (teamId: string) => void;
  decideSalary: (playerId: string, decision: FreeAgencyDecision) => void;
  draftProspect: (prospectId: string) => void;
  reset: () => void;
  reloadDraftBoardFromCsv: () => Promise<void>;
  getScoutTopPicks: () => DraftProspect[];
  getTeamNeedsGaps: () => TeamNeeds;
  startDraftSimulation: (commaSeparatedUserPickNumbers: string) => void;
  advanceDraft: () => void;
  userDraftAtCurrentPick: (prospectId: string) => void;
  stopDraftCpuTimer: () => void;
  /** Clear live-draft sim state and remove rookies from this session so the user can re-enter picks. */
  resetLiveDraftSession: () => void;
};

export const useSimulatorStore = create<SimulatorStore>((set, get) => ({
  selectedTeamId: null,
  loadingRoster: false,
  loadError: null,
  capSpace: 0,
  roster: [],
  expiringContracts: [],
  decisions: {},
  draftedProspects: [],
  draftClass: [],
  freeAgencyBaselineArchetypeCounts: {},
  eliteFitModel: null,
  draftSimulationActive: false,
  draftSimulationComplete: false,
  draftTotalPicks: DEFAULT_DRAFT_SIM_TOTAL,
  draftCurrentPick: 1,
  draftUserPickSlots: [],
  draftAvailableProspects: [],
  draftHistory: [],
  draftSetupError: null,

  selectTeam: (teamId) => {
    const team = TEAMS.find((t) => t.id === teamId);
    if (!team) {
      clearDraftCpuTimer();
      set({
        selectedTeamId: teamId,
        loadingRoster: false,
        loadError: "Unknown team.",
        capSpace: 0,
        roster: [],
        expiringContracts: [],
        decisions: {},
        draftedProspects: [],
        draftClass: [],
        freeAgencyBaselineArchetypeCounts: {},
        eliteFitModel: null,
        draftSimulationActive: false,
        draftSimulationComplete: false,
        draftTotalPicks: DEFAULT_DRAFT_SIM_TOTAL,
        draftCurrentPick: 1,
        draftUserPickSlots: [],
        draftAvailableProspects: [],
        draftHistory: [],
        draftSetupError: null
      });
      return;
    }

    clearDraftCpuTimer();
    set({
      selectedTeamId: teamId,
      loadingRoster: true,
      loadError: null,
      capSpace: 0,
      roster: [],
      expiringContracts: [],
      decisions: {},
      draftedProspects: [],
      draftClass: FALLBACK_DRAFT_CLASS,
      freeAgencyBaselineArchetypeCounts: {},
      eliteFitModel: null,
      draftSimulationActive: false,
      draftSimulationComplete: false,
      draftTotalPicks: DEFAULT_DRAFT_SIM_TOTAL,
      draftCurrentPick: 1,
      draftUserPickSlots: [],
      draftAvailableProspects: [],
      draftHistory: [],
      draftSetupError: null
    });

    (async () => {
      try {
        const data = await loadHoopshypeRosterData();
        const rosterForTeam = data.rosterByTeam.get(teamId) ?? [];

        const expiringContracts = rosterForTeam
          .map((p) => {
            const salaryRow = data.hoopSalaryByPlayer.get(normalizeName(p.name));
            if (!salaryRow) return null;
            const isExpiring = salaryRow.nextSalary === null;
            if (!isExpiring) return null;

            const aceSalary = data.aceByPlayerKey.get(normalizeName(p.name));
            if (aceSalary === undefined) return null;

            return {
              playerId: p.id,
              name: p.name,
              position: p.position,
              currentSalary: p.currentSalary,
              estimatedMarketSalary: aceSalary,
              archetype: p.archetype,
              csvOffensiveArchetype: p.csvOffensiveArchetype,
              csvDefensiveRole: p.csvDefensiveRole,
              stats: p.stats
            };
          })
          .filter((x) => x !== null) as any[];

        const capSpace = capSpaceFromPayroll(team.salaryCap, rosterForTeam);

        set({
          loadingRoster: false,
          loadError: null,
          capSpace,
          roster: rosterForTeam,
          expiringContracts,
          decisions: {},
          draftedProspects: [],
          draftClass: data.draftClass,
          freeAgencyBaselineArchetypeCounts: computeArchetypeCounts(rosterForTeam),
          eliteFitModel: data.eliteFitModel,
          draftSimulationActive: false,
          draftSimulationComplete: false,
          draftTotalPicks: DEFAULT_DRAFT_SIM_TOTAL,
          draftCurrentPick: 1,
          draftUserPickSlots: [],
          draftAvailableProspects: [],
          draftHistory: [],
          draftSetupError: null
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load contract data.";
        set({ loadingRoster: false, loadError: msg, eliteFitModel: null });
      }
    })();
  },

  decideSalary: (playerId, decision) => {
    const state = get();
    if (!state.selectedTeamId) return;
    if (!state.expiringContracts.some((c) => c.playerId === playerId)) return;

    const contract = state.expiringContracts.find((c) => c.playerId === playerId);
    if (!contract) return;

    const prev = state.decisions[playerId];
    if (prev === decision) return;

    let roster = [...state.roster];

    // Revert previous choice so cap/roster match "undecided" before applying the new one.
    if (prev === "RE_SIGN") {
      roster = roster.map((p) =>
        p.id === playerId ? { ...p, currentSalary: contract.currentSalary } : p
      );
    } else if (prev === "LET_WALK") {
      if (!roster.some((p) => p.id === playerId)) {
        roster.push({
          id: contract.playerId,
          name: contract.name,
          position: contract.position,
          archetype: contract.archetype,
          csvOffensiveArchetype: contract.csvOffensiveArchetype,
          csvDefensiveRole: contract.csvDefensiveRole,
          stats: contract.stats,
          currentSalary: contract.currentSalary
        });
      }
    }

    if (decision === "RE_SIGN") {
      if (!roster.some((p) => p.id === playerId)) return;
      roster = roster.map((p) =>
        p.id === playerId ? { ...p, currentSalary: contract.estimatedMarketSalary } : p
      );
    } else {
      if (!roster.some((p) => p.id === playerId)) return;
      roster = roster.filter((p) => p.id !== playerId);
    }

    const cap = salaryCapForTeamId(state.selectedTeamId);
    set({
      capSpace: capSpaceFromPayroll(cap, roster),
      roster,
      decisions: { ...state.decisions, [playerId]: decision }
    });
  },

  draftProspect: (prospectId) => {
    const state = get();
    const prospect = state.draftClass.find((p) => p.id === prospectId);
    if (!prospect) return;
    if (state.draftedProspects.some((d) => d.prospectId === prospectId)) return;

    const salary = salaryFromProspectGrade(prospect.grade);
    const newPlayer: RosterPlayer = {
      id: `draft-${prospectId}`,
      name: prospect.name,
      position: prospect.position,
      archetype: prospect.projectedArchetype,
      csvOffensiveArchetype: prospect.csvOffensiveArchetype,
      csvDefensiveRole: prospect.csvDefensiveRole,
      stats: {
        // Skeleton placeholders.
        pointsPerGame: Math.round(5 + (prospect.grade / 100) * 10),
        reboundsPerGame: Math.round(1 + (prospect.grade / 100) * 6),
        assistsPerGame: prospect.position === "PG" ? Math.round(3 + (prospect.grade / 100) * 4) : 1,
        fgPct: 0.42
      },
      currentSalary: salary
    };

    const nextPick: DraftPick = { prospectId };
    const nextRoster = [...state.roster, newPlayer];
    const cap = salaryCapForTeamId(state.selectedTeamId);
    set({
      draftedProspects: [...state.draftedProspects, nextPick],
      roster: nextRoster,
      capSpace: capSpaceFromPayroll(cap, nextRoster)
    });
  },

  reset: () => {
    clearDraftCpuTimer();
    set({
      selectedTeamId: null,
      loadingRoster: false,
      loadError: null,
      capSpace: 0,
      roster: [],
      expiringContracts: [],
      decisions: {},
      draftedProspects: [],
      draftClass: [],
      freeAgencyBaselineArchetypeCounts: {},
      eliteFitModel: null,
      draftSimulationActive: false,
      draftSimulationComplete: false,
      draftTotalPicks: DEFAULT_DRAFT_SIM_TOTAL,
      draftCurrentPick: 1,
      draftUserPickSlots: [],
      draftAvailableProspects: [],
      draftHistory: [],
      draftSetupError: null
    });
  },

  reloadDraftBoardFromCsv: async () => {
    try {
      const text = await fetch(publicAssetUrl("data/big_board.csv")).then((r) => r.text());
      const board = parseBigBoardRows(parseCsvRecords(text));
      const enriched = enrichDraftProspectsWithInferredArchetypes(board, getLeagueArchetypePeers());
      if (enriched.length > 0) set({ draftClass: enriched });
    } catch {
      // Keep existing draftClass if fetch/parse fails.
    }
  },

  stopDraftCpuTimer: () => {
    clearDraftCpuTimer();
  },

  resetLiveDraftSession: () => {
    clearDraftCpuTimer();
    const state = get();
    const { roster, capSpace } = detachSimDraftPicksFromRoster(state);
    set({
      roster,
      capSpace,
      draftedProspects: [],
      draftSimulationActive: false,
      draftSimulationComplete: false,
      draftTotalPicks: DEFAULT_DRAFT_SIM_TOTAL,
      draftCurrentPick: 1,
      draftUserPickSlots: [],
      draftAvailableProspects: [],
      draftHistory: [],
      draftSetupError: null
    });
  },

  startDraftSimulation: (commaSeparatedUserPickNumbers: string) => {
    clearDraftCpuTimer();
    const state = get();
    const parsed = commaSeparatedUserPickNumbers
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number.parseInt(s, 10))
      .filter((n) => Number.isFinite(n));

    const uniqueSorted = [...new Set(parsed)].sort((a, b) => a - b);
    if (uniqueSorted.length === 0) {
      set({ draftSetupError: "Enter at least one pick number (e.g. 14, 45, 78)." });
      return;
    }

    const pool = buildDraftSimulationPool(state.draftClass);
    if (pool.length === 0) {
      set({ draftSetupError: "No prospects loaded. Check big_board.csv or try again after data loads." });
      return;
    }

    const totalPicks = pool.length;
    for (const p of uniqueSorted) {
      if (p < 1 || p > totalPicks || !Number.isInteger(p)) {
        set({
          draftSetupError: `Each pick must be an integer from 1 to ${totalPicks} (this board runs ${totalPicks} picks).`
        });
        return;
      }
    }

    const { roster: rosterWithoutSimPicks, capSpace: capAfterStrip } = detachSimDraftPicksFromRoster(state);

    set({
      draftSetupError: null,
      draftedProspects: [],
      roster: rosterWithoutSimPicks,
      capSpace: capAfterStrip,
      draftSimulationActive: true,
      draftSimulationComplete: false,
      draftTotalPicks: totalPicks,
      draftCurrentPick: 1,
      draftUserPickSlots: uniqueSorted,
      draftAvailableProspects: pool,
      draftHistory: []
    });

    draftCpuTimer = setTimeout(() => {
      draftCpuTimer = null;
      get().advanceDraft();
    }, 400);
  },

  advanceDraft: () => {
    const state = get();
    if (!state.draftSimulationActive || state.draftSimulationComplete) return;
    if (state.draftCurrentPick > state.draftTotalPicks) {
      set({ draftSimulationComplete: true });
      return;
    }
    if (state.draftUserPickSlots.includes(state.draftCurrentPick)) {
      return;
    }
    if (state.draftAvailableProspects.length === 0) {
      set({ draftSimulationComplete: true });
      return;
    }

    const best = [...state.draftAvailableProspects].sort((a, b) => a.overallRank - b.overallRank)[0];
    const entry = {
      pickNumber: state.draftCurrentPick,
      prospectId: best.id,
      prospectName: best.name,
      pickedBy: "cpu" as const
    };

    set({
      draftHistory: [...state.draftHistory, entry],
      draftAvailableProspects: state.draftAvailableProspects.filter((p) => p.id !== best.id),
      draftCurrentPick: state.draftCurrentPick + 1
    });

    const next = get();
    if (next.draftCurrentPick > next.draftTotalPicks) {
      set({ draftSimulationComplete: true });
      return;
    }
    if (next.draftAvailableProspects.length === 0) {
      set({ draftSimulationComplete: true });
      return;
    }
    if (!next.draftUserPickSlots.includes(next.draftCurrentPick)) {
      draftCpuTimer = setTimeout(() => {
        draftCpuTimer = null;
        get().advanceDraft();
      }, 500);
    }
  },

  userDraftAtCurrentPick: (prospectId: string) => {
    clearDraftCpuTimer();
    const state = get();
    if (!state.draftSimulationActive || state.draftSimulationComplete) return;
    if (!state.draftUserPickSlots.includes(state.draftCurrentPick)) return;

    const prospect = state.draftAvailableProspects.find((p) => p.id === prospectId);
    if (!prospect) return;

    const salary = salaryFromProspectGrade(prospect.grade);
    const newPlayer: RosterPlayer = {
      id: `draft-${prospect.id}`,
      name: prospect.name,
      position: prospect.position,
      archetype: prospect.projectedArchetype,
      csvOffensiveArchetype: prospect.csvOffensiveArchetype,
      csvDefensiveRole: prospect.csvDefensiveRole,
      stats: {
        pointsPerGame: Math.round(5 + (prospect.grade / 100) * 10),
        reboundsPerGame: Math.round(1 + (prospect.grade / 100) * 6),
        assistsPerGame: prospect.position === "PG" ? Math.round(3 + (prospect.grade / 100) * 4) : 1,
        fgPct: 0.42
      },
      currentSalary: salary
    };

    const entry = {
      pickNumber: state.draftCurrentPick,
      prospectId: prospect.id,
      prospectName: prospect.name,
      pickedBy: "user" as const
    };

    const nextRoster = [...state.roster, newPlayer];
    const cap = salaryCapForTeamId(state.selectedTeamId);
    set({
      draftedProspects: [...state.draftedProspects, { prospectId }],
      roster: nextRoster,
      capSpace: capSpaceFromPayroll(cap, nextRoster),
      draftHistory: [...state.draftHistory, entry],
      draftAvailableProspects: state.draftAvailableProspects.filter((p) => p.id !== prospectId),
      draftCurrentPick: state.draftCurrentPick + 1
    });

    const after = get();
    if (after.draftCurrentPick > after.draftTotalPicks) {
      set({ draftSimulationComplete: true });
      return;
    }
    if (after.draftAvailableProspects.length === 0) {
      set({ draftSimulationComplete: true });
      return;
    }
    if (!after.draftUserPickSlots.includes(after.draftCurrentPick)) {
      draftCpuTimer = setTimeout(() => {
        draftCpuTimer = null;
        get().advanceDraft();
      }, 500);
    }
  },

  getTeamNeedsGaps: () => {
    const state = get();
    const currentCounts = computeArchetypeCounts(state.roster);
    return subtractCounts(state.freeAgencyBaselineArchetypeCounts, currentCounts);
  },

  getScoutTopPicks: () => {
    return sortAvailableProspectsByEliteArchetypeFit(get()).slice(0, 3);
  }
}));

