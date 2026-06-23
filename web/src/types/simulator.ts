// ---------------------------------------------------------------------------
// Archetype unions — single source of truth lives in data/archetypes.ts.
// Re-exported here so existing `types/simulator` imports keep working.
// ---------------------------------------------------------------------------

import type { OffensiveArchetype, DefensiveRole } from "../data/archetypes";
export type { OffensiveArchetype, DefensiveRole };
import type { Physicals } from "../data/parsePhysicals";
import type { NbaRadarStats } from "../data/parseNbaRadar";

export type Position = "PG" | "SG" | "SF" | "PF" | "C";

export type OptionType = "Player" | "Club";

export type FreeAgencyDecision =
  | "RE_SIGN"       // User re-signs an expiring player at their ACE value
  | "LET_WALK"      // User lets an expiring player walk
  | "PICK_UP_OPTION"  // User picks up a Club option
  | "DECLINE_OPTION"; // User declines a Club option

export type SimulatorPhase = "SELECT_TEAM" | "FREE_AGENCY" | "DRAFT" | "COMPLETE";

export type TeamStrengthLabel = "Contender" | "Middle" | "Rebuilding";

/** Display tier derived from the 0–100 talentScore (see lib/talentScore.ts). */
export type TalentTier = "Star" | "Starter" | "Rotation" | "Depth";

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
  /** 0–100 unified Talent Score (lib/talentScore.ts). */
  talentScore?: number;
  talentTier?: TalentTier;
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
  /** 0–100 unified Talent Score (lib/talentScore.ts). */
  talentScore?: number;
  talentTier?: TalentTier;
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
  /** 3-point percentage, 0–1. */
  fg3Pct: number;
}

/** One ML player comparison (from prospect_comps.csv). */
export interface ProspectComp {
  /** Comparable NBA player's name. */
  name: string;
  /** Comparable's listed position. */
  pos: string;
  /** Comparable's offensive archetype + defensive role (display labels). */
  offensiveArchetype: string;
  defensiveRole: string;
  /** Style-match similarity, 0–100. */
  similarity: number;
}

/** ML success projection (from prospect_success.csv) — percentages 0–100. */
export interface ProspectSuccessOdds {
  star: number;
  starter: number;
  bench: number;
  cut: number;
  /** Expected value 1.0–4.0 (Cut→Star). */
  ev: number;
  /** Rank by EV across the prospect pool. */
  mlRank: number;
}

export interface DraftProspect {
  /** Stable ID: "prospect-{rank}" */
  id: string;
  rank: number;
  name: string;
  school: string;
  position: Position;
  /** 60–95 numeric scout grade (big_board `Grade` column). */
  grade: number;
  /** College year / label when present (e.g. Freshman, International). */
  classYear?: string;
  offensiveArchetype: OffensiveArchetype;
  defensiveRole: DefensiveRole;
  notes: string;
  /** Heuristic rookie salary computed from grade. */
  projectedSalary: number;
  /** Merged from prospect_stats.csv by name when available. */
  collegeStats?: ProspectCollegeStats;
  /** Top ML comps (prospect_comps.csv), best match first. */
  comps?: ProspectComp[];
  /** ML success projection (prospect_success.csv). */
  successOdds?: ProspectSuccessOdds;
  /** Physical measurements (physicals.csv) when available. */
  physicals?: Physicals;
  /** 0–100 unified Talent Score (lib/talentScore.ts). */
  talentScore?: number;
  talentTier?: TalentTier;
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
// Blueprint scoring
// ---------------------------------------------------------------------------

export interface BlueprintMatch {
  blueprintId: string;
  team: string;
  season: string;
  result: string;
  /** 0–100 weighted cosine similarity between roster and blueprint. */
  score: number;
  /** Formula slot labels that both the user's roster AND this blueprint fill. */
  matchedSlotLabels: string[];
  /** A specific construction principle from the blueprint to cite in the UI. */
  citationPrinciple: string;
  /** One-sentence identity summary pulled from the blueprint doc. */
  identitySentence: string;
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
  blueprintMatch: BlueprintMatch | null;

  // Comparison data for the player-detail radar / physicals (loaded with draft data)
  comparisonData: ComparisonData | null;

  // Async state
  loading: boolean;
  error: string | null;
}

/** Lookups powering the player-comparison radar + physicals overlay. */
export interface ComparisonData {
  /** Per-game NBA radar stats by normalized name (comp players). */
  nbaRadarByName: Map<string, NbaRadarStats>;
  /** Physical measurements by normalized name (prospects + NBA). */
  physicalsByName: Map<string, Physicals>;
  /** All prospect physicals — the percentile cohort for the sliders. */
  prospectPhysicals: Physicals[];
}
