// ---------------------------------------------------------------------------
// Archetype unions — derived directly from archetypes.csv values
// ---------------------------------------------------------------------------

export type OffensiveArchetype =
  | "Athletic Finisher"
  | "Low Minute"
  | "Movement Shooter"
  | "Off Screen Shooter"
  | "Post Scorer"
  | "Primary Ball Handler"
  | "Roll + Cut Big"
  | "Secondary Ball Handler"
  | "Shot Creator"
  | "Slasher"
  | "Stationary Shooter"
  | "Stretch Big"
  | "Versatile Big";

export type DefensiveRole =
  | "Anchor Big"
  | "Chaser"
  | "Helper"
  | "Low Activity"
  | "Mobile Big"
  | "Point of Attack"
  | "Wing Stopper";

export type Position = "PG" | "SG" | "SF" | "PF" | "C";

export type OptionType = "Player" | "Club";

export type FreeAgencyDecision =
  | "RE_SIGN"       // User re-signs an expiring player at their ACE value
  | "LET_WALK"      // User lets an expiring player walk
  | "PICK_UP_OPTION"  // User picks up a Club option
  | "DECLINE_OPTION"; // User declines a Club option

export type SimulatorPhase = "SELECT_TEAM" | "FREE_AGENCY" | "DRAFT" | "COMPLETE";

export type TeamStrengthLabel = "Contender" | "Middle" | "Rebuilding";

export interface TeamStrength {
  score: number;
  label: TeamStrengthLabel;
}

// ---------------------------------------------------------------------------
// Player data
// ---------------------------------------------------------------------------

export interface PlayerStats {
  pts: number;
  trb: number;
  ast: number;
  tsPct: number;   // True Shooting %
  bpm: number;     // Box Plus/Minus
  vorp: number;
  ws: number;      // Win Shares
  usgPct: number;  // Usage %
}

export interface RosterPlayer {
  /** BBRef player ID (e.g. "thompam01") or "draft-{rank}" for rookies. */
  id: string;
  name: string;
  age: number;
  position: Position;
  /** Canonical team abbreviation (BKN / CHA / PHX normalized). */
  teamAbbrev: string;
  offensiveArchetype: OffensiveArchetype;
  defensiveRole: DefensiveRole;
  /** 2025-26 cap hit from Hoopshype. */
  currentSalary: number;
  /** 2026-27 salary from Hoopshype — null means the contract expires. */
  nextSeasonSalary: number | null;
  /** ACE model value. Falls back to currentSalary when ACE lookup misses. */
  estimatedMarketSalary: number;
  /** True when ACE lookup failed and currentSalary was used as a proxy. */
  isSalaryEstimate: boolean;
  stats: PlayerStats;
}

// ---------------------------------------------------------------------------
// Free agency
// ---------------------------------------------------------------------------

export interface ExpiringContract {
  playerId: string;
  name: string;
  age: number;
  position: Position;
  offensiveArchetype: OffensiveArchetype;
  defensiveRole: DefensiveRole;
  currentSalary: number;
  estimatedMarketSalary: number;
  isSalaryEstimate: boolean;
  stats: PlayerStats;
  /** Present when contract has a Player or Club option. */
  optionType?: OptionType;
  optionSalary?: number;
  /**
   * Set after automatic Player-option resolution:
   * true  = player opted out (market > option salary) → hits free agency
   * false = player opted in → stays on roster at optionSalary
   * undefined = Club option (user decides) or plain UFA
   */
  playerOptedOut?: boolean;
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export interface Team {
  /** Canonical abbreviation used as the primary key throughout the app. */
  id: string;
  /** Abbreviation used in master.csv (differs for BRK/BKN, CHO/CHA, PHO/PHX). */
  csvAbbrev: string;
  city: string;
  name: string;
  conference: "East" | "West";
}

// ---------------------------------------------------------------------------
// Draft
// ---------------------------------------------------------------------------

/** Per-game college line from prospect_stats.csv (when sr_found / data present). */
export interface ProspectCollegeStats {
  seasonYear: string;
  teamAbbr: string;
  confAbbr: string;
  classYear: string;
  games: number;
  gamesStarted: number;
  mpPerGame: number;
  pts: number;
  trb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  /** 0–1 (CSV may use .578) */
  tsPct: number;
}

export interface DraftProspect {
  /** Stable ID: "prospect-{rank}" */
  id: string;
  rank: number;
  name: string;
  school: string;
  position: Position;
  /** 60–95 talent grade from big_board.csv */
  grade: number;
  offensiveArchetype: OffensiveArchetype;
  defensiveRole: DefensiveRole;
  notes: string;
  /** Heuristic rookie salary computed from grade. */
  projectedSalary: number;
  /** Merged from prospect_stats.csv by Rank when available. */
  collegeStats?: ProspectCollegeStats;
}

export interface DraftHistoryEntry {
  pickNumber: number;
  prospectId: string;
  /** "user" or a team abbreviation for CPU picks. */
  pickedBy: string;
}

// ---------------------------------------------------------------------------
// Championship Formula
// ---------------------------------------------------------------------------

export interface FormulaSlot {
  offensiveArchetype: OffensiveArchetype;
  defensiveRole: DefensiveRole;
  /** Ideal count in a 9-man rotation. */
  target: number;
  /**
   * 0–1 importance weight derived from how consistently this archetype
   * appears across historical title contenders.
   */
  weight: number;
}

export interface ChampionshipFormula {
  /** 9-man rotation archetype targets, ordered by weight descending. */
  slots: FormulaSlot[];
}

export interface RosterDeficit {
  offensiveArchetype: OffensiveArchetype;
  defensiveRole: DefensiveRole;
  target: number;
  current: number;
  /** target - current, always ≥ 1 when included in the deficits list. */
  gap: number;
  weight: number;
}

// ---------------------------------------------------------------------------
// Full simulator state (Zustand store shape)
// ---------------------------------------------------------------------------

export interface SimulatorState {
  phase: SimulatorPhase;
  selectedTeamId: string | null;

  // Roster & free agency
  roster: RosterPlayer[];
  expiringContracts: ExpiringContract[];
  decisions: Record<string, FreeAgencyDecision>;

  // Draft
  draftClass: DraftProspect[];
  draftAvailableProspects: DraftProspect[];
  draftHistory: DraftHistoryEntry[];
  draftCurrentPick: number;
  draftTotalPicks: number;
  userPickNumbers: number[];
  draftSimActive: boolean;
  draftSimComplete: boolean;

  // Analysis
  championshipFormula: ChampionshipFormula | null;
  rosterDeficits: RosterDeficit[];
  teamStrength: TeamStrength;

  // Async state
  loading: boolean;
  error: string | null;
}
