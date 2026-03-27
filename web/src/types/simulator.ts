export type Archetype =
  | "PG Playmaker"
  | "SG Shooter"
  | "Wing Stopper"
  | "Rim Protector"
  | "Stretch Big"
  | "Bench Spark"
  | "Two-Way Wing";

export type Team = {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  salaryCap: number;
};

export type PlayerStats = {
  pointsPerGame: number;
  reboundsPerGame: number;
  assistsPerGame: number;
  fgPct: number; // 0-1
};

export type RosterPlayer = {
  id: string;
  name: string;
  position: "PG" | "SG" | "SF" | "PF" | "C";
  /** Mapped enum for draft/fit logic */
  archetype: Archetype;
  /** Raw `archetypes.csv` offensive label (master fallback) for display */
  csvOffensiveArchetype: string;
  /** Raw `archetypes.csv` defensive label (master fallback) for display */
  csvDefensiveRole: string;
  stats: PlayerStats;
  currentSalary: number; // current contract salary (used to compute cap changes)
};

export type ExpiringContract = {
  playerId: string;
  name: string;
  position: "PG" | "SG" | "SF" | "PF" | "C";
  currentSalary: number;
  estimatedMarketSalary: number;
  archetype: Archetype;
  csvOffensiveArchetype: string;
  csvDefensiveRole: string;
  stats: PlayerStats;
};

export type FreeAgencyDecision = "RE_SIGN" | "LET_WALK";

export type DraftProspect = {
  id: string;
  name: string;
  school: string;
  position: "PG" | "SG" | "SF" | "PF" | "C";
  overallRank: number; // lower is better (e.g., 1..60)
  grade: number; // 0-100
  projectedArchetype: Archetype;
  /** `big_board.csv` offensive label (same vocabulary as archetypes.csv) */
  csvOffensiveArchetype: string;
  /** `big_board.csv` defensive label */
  csvDefensiveRole: string;
  fitNotes: string;
  /** True when big_board.csv supplied a simulator archetype or both offensive + defensive columns */
  archetypeFromCsv?: boolean;
};

export type TeamNeeds = Partial<Record<Archetype, number>>;

/** Quality-weighted archetype mix from historical contender rosters (`top_teams` CSVs). */
export type EliteFitModel = {
  targetShareByArchetype: Partial<Record<Archetype, number>>;
  priorityByArchetype: Partial<Record<Archetype, number>>;
};

export type DraftPick = {
  prospectId: string;
};

/** One selection in the live draft simulation (CPU or user). */
export type DraftHistoryEntry = {
  pickNumber: number;
  prospectId: string;
  prospectName: string;
  pickedBy: "cpu" | "user";
};

export type SimulatorState = {
  selectedTeamId: string | null;
  loadingRoster: boolean;
  loadError: string | null;
  capSpace: number;
  roster: RosterPlayer[];
  expiringContracts: ExpiringContract[];
  decisions: Record<string, FreeAgencyDecision | undefined>; // playerId -> decision
  draftedProspects: DraftPick[];
  draftClass: DraftProspect[];
  // Archetype counts when the free agency phase starts (used to compute "gaps").
  freeAgencyBaselineArchetypeCounts: Partial<Record<Archetype, number>>;
  /** Derived from `top_teams` contender sheets — drives View B (fit) vs elite template */
  eliteFitModel: EliteFitModel | null;

  /** Phase 4 — live draft simulation (3 rounds × 30 picks max, capped by board size). */
  draftSimulationActive: boolean;
  draftSimulationComplete: boolean;
  draftTotalPicks: number;
  draftCurrentPick: number;
  /** 1-based pick numbers when the user is on the clock (e.g. [14, 45, 78]). */
  draftUserPickSlots: number[];
  /** Prospects not yet taken in the sim (CPU removes picks here; user picks too). */
  draftAvailableProspects: DraftProspect[];
  draftHistory: DraftHistoryEntry[];
  draftSetupError: string | null;
};

