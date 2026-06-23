// ---------------------------------------------------------------------------
// talentScore.ts
//
// A unified 0–100 "Talent Score" for both draft prospects and NBA players,
// normalized by PERCENTILE WITHIN ITS OWN POOL (prospects vs prospects, pros
// vs pros). This is the missing ingredient that lets fit scoring (sub-project C)
// stop ranking a clearly-better player below a worse one just because the worse
// one's archetype matches a slot — the "Curry should never read as low" fix.
//
// This module only PRODUCES the number. Wiring it into recommendations happens
// in sub-project C. Pure functions, no UI coupling.
// ---------------------------------------------------------------------------

import { percentile } from "./playerMetrics";
import type { PlayerStats, DraftProspect, TalentTier } from "../types/simulator";

/** Display tier from a 0–100 talent score. */
export function talentTier(score: number): TalentTier {
  if (score >= 85) return "Star";
  if (score >= 65) return "Starter";
  if (score >= 40) return "Rotation";
  return "Depth";
}

// ---------------------------------------------------------------------------
// NBA players — blend of impact metrics from master.csv (PlayerStats).
//   0.5 BPM (per-possession impact) + 0.3 VORP + 0.2 Win Shares
// BPM-weighting is why per-possession stars (e.g. Curry) land near the top.
// ---------------------------------------------------------------------------

export interface NbaTalentPools {
  bpm: number[];
  vorp: number[];
  ws: number[];
}

/** Build the percentile pools once from the full league population. */
export function buildNbaPools(allStats: PlayerStats[]): NbaTalentPools {
  return {
    bpm: allStats.map((s) => s.bpm),
    vorp: allStats.map((s) => s.vorp),
    ws: allStats.map((s) => s.ws),
  };
}

/** 0–100 talent score for one player against the league pools. */
export function nbaTalent(stats: PlayerStats, pools: NbaTalentPools): number {
  const score =
    0.5 * percentile(stats.bpm, pools.bpm) +
    0.3 * percentile(stats.vorp, pools.vorp) +
    0.2 * percentile(stats.ws, pools.ws);
  return Math.round(score);
}

// ---------------------------------------------------------------------------
// Draft prospects — blend of the success model + scout grade.
//   0.7 EV (expected value, already an NBA-success projection) + 0.3 Grade
// Falls back to whichever signal is present.
// ---------------------------------------------------------------------------

export interface ProspectTalentPools {
  ev: number[];
  grade: number[];
}

const hasGrade = (p: DraftProspect): boolean =>
  Number.isFinite(p.grade) && p.grade > 0;
const hasEv = (p: DraftProspect): boolean =>
  !!p.successOdds && Number.isFinite(p.successOdds.ev);

/** Build prospect percentile pools from the draft class. */
export function buildProspectPools(prospects: DraftProspect[]): ProspectTalentPools {
  return {
    ev: prospects.filter(hasEv).map((p) => p.successOdds!.ev),
    grade: prospects.filter(hasGrade).map((p) => p.grade),
  };
}

/** 0–100 talent score for one prospect against the prospect pools. */
export function prospectTalent(p: DraftProspect, pools: ProspectTalentPools): number {
  const ev = hasEv(p) && pools.ev.length > 0;
  const grade = hasGrade(p) && pools.grade.length > 0;

  let score: number;
  if (ev && grade) {
    score = 0.7 * percentile(p.successOdds!.ev, pools.ev) + 0.3 * percentile(p.grade, pools.grade);
  } else if (grade) {
    score = percentile(p.grade, pools.grade);
  } else if (ev) {
    score = percentile(p.successOdds!.ev, pools.ev);
  } else {
    score = 50; // no signal — neutral
  }
  return Math.round(score);
}

// ---------------------------------------------------------------------------
// Attach helpers — return new arrays with talentScore/talentTier populated.
// ---------------------------------------------------------------------------

/** Annotate a draft class with talentScore + talentTier (single pass). */
export function attachProspectTalent(prospects: DraftProspect[]): DraftProspect[] {
  const pools = buildProspectPools(prospects);
  return prospects.map((p) => {
    const talentScore = prospectTalent(p, pools);
    return { ...p, talentScore, talentTier: talentTier(talentScore) };
  });
}
