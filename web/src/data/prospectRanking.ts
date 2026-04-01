import type {
  DraftProspect,
  RosterDeficit,
  RosterPlayer,
  TeamStrength,
  TeamStrengthLabel,
  OffensiveArchetype,
  DefensiveRole,
  Position,
} from "../types/simulator";
import { computeFormulFitScore } from "./championshipFormula";

export type { TeamStrength };

// ---------------------------------------------------------------------------
// Prospect scores
// ---------------------------------------------------------------------------

export interface RankedProspect extends DraftProspect {
  /** Talent ceiling score (0–100). Based on grade + position + archetypes. */
  valueScore: number;
  /** How well the prospect fills the team's top formula gap (0–100). */
  fitScore: number;
  /** Blended recommendation score weighted by team strength (0–100). */
  needsScore: number;
}

// ---------------------------------------------------------------------------
// Archetype / position value multipliers
// ---------------------------------------------------------------------------

const POSITION_CEILING: Record<Position, number> = {
  PG: 1.10,
  SG: 1.00,
  SF: 1.05,
  PF: 0.92,
  C: 0.88,
};

const OFFENSIVE_VALUE: Partial<Record<OffensiveArchetype, number>> = {
  "Primary Ball Handler": 1.12,
  "Shot Creator": 1.10,
  "Movement Shooter": 1.05,
  "Stationary Shooter": 1.03,
  "Secondary Ball Handler": 1.02,
  "Slasher": 0.98,
  "Athletic Finisher": 0.95,
  "Roll + Cut Big": 0.95,
  "Stretch Big": 0.93,
  "Off Screen Shooter": 0.92,
  "Versatile Big": 0.90,
  "Post Scorer": 0.85,
  "Low Minute": 0.70,
};

const DEFENSIVE_VALUE: Partial<Record<DefensiveRole, number>> = {
  "Point of Attack": 1.10,
  "Wing Stopper": 1.08,
  "Anchor Big": 1.03,
  "Mobile Big": 1.01,
  "Helper": 0.98,
  "Chaser": 0.95,
  "Low Activity": 0.80,
};

// ---------------------------------------------------------------------------
// Individual scoring functions
// ---------------------------------------------------------------------------

/**
 * Talent ceiling score for a draft prospect.
 *
 * Primary signal: scout rank (rank 1 = best). Converted to a 0–100 base
 * using a curve that rewards top picks heavily — rank 1 scores ~100, rank 10
 * ~83, rank 30 ~60, rank 81 ~15. Archetype and position multipliers then
 * adjust ±10 points max so scouting rank always dominates.
 */
export function computeValueScore(prospect: DraftProspect): number {
  // Total prospects in the draft class (81 in our big_board)
  const TOTAL = 81;
  // Rank-based base: exponential decay so the top picks score much higher
  const rankPct = 1 - (prospect.rank - 1) / (TOTAL - 1); // 1.0 → 0.0
  const rankBase = Math.pow(rankPct, 0.65) * 85; // 0–85 range from rank alone

  // Archetype/position multipliers capped to ±10 additive points
  const posFactor = POSITION_CEILING[prospect.position] ?? 1.0;
  const offFactor = OFFENSIVE_VALUE[prospect.offensiveArchetype] ?? 1.0;
  const defFactor = DEFENSIVE_VALUE[prospect.defensiveRole] ?? 1.0;
  const archetypeBonus = ((posFactor * offFactor * defFactor) - 1) * 20;
  const clamped = Math.max(-10, Math.min(10, archetypeBonus));

  return Math.min(100, Math.max(0, Math.round(rankBase + clamped)));
}

/**
 * Fit score: how well this prospect fills the team's highest-priority roster gap.
 * Returns the weight of the best matching deficit × 100, or 0 if no match.
 */
export function computeFitScore(
  prospect: DraftProspect,
  deficits: RosterDeficit[]
): number {
  for (const deficit of deficits) {
    if (
      prospect.offensiveArchetype === deficit.offensiveArchetype &&
      prospect.defensiveRole === deficit.defensiveRole
    ) {
      return Math.round(deficit.weight * 100);
    }
  }
  return 0;
}

/**
 * Team strength assessment.
 * Combines formula fit (65%) and top-5 roster ACE star power (35%).
 */
export function computeTeamStrength(roster: RosterPlayer[]): TeamStrength {
  if (roster.length === 0) return { score: 0, label: "Rebuilding" };

  const formulaFit = computeFormulFitScore(roster);

  const sorted = [...roster].sort(
    (a, b) => b.estimatedMarketSalary - a.estimatedMarketSalary
  );
  const top5 = sorted.slice(0, 5);
  const avgAce =
    top5.reduce((s, p) => s + p.estimatedMarketSalary, 0) / top5.length;
  // $25 M avg ACE for top-5 = maximum star-power factor
  const aceFactor = Math.min(1, avgAce / 25_000_000);

  const score = 0.65 * formulaFit + 0.35 * aceFactor;

  let label: TeamStrengthLabel;
  if (score >= 0.55) label = "Contender";
  else if (score >= 0.30) label = "Middle";
  else label = "Rebuilding";

  return { score, label };
}

/**
 * Blended recommendation score weighted by team strength.
 *   Contender  → 75% fit  + 25% value (maximize championship formula fit)
 *   Middle     → 40% fit  + 60% value (balance ceiling and needs)
 *   Rebuilding → 10% fit  + 90% value (maximize ceiling and long-term value)
 */
export function computeNeedsScore(
  valueScore: number,
  fitScore: number,
  teamStrength: TeamStrength
): number {
  let fitWeight: number;
  let valueWeight: number;

  switch (teamStrength.label) {
    case "Contender":
      fitWeight = 0.75;
      valueWeight = 0.25;
      break;
    case "Middle":
      fitWeight = 0.40;
      valueWeight = 0.60;
      break;
    case "Rebuilding":
    default:
      fitWeight = 0.10;
      valueWeight = 0.90;
      break;
  }

  return Math.round(fitWeight * fitScore + valueWeight * valueScore);
}

/**
 * Attaches valueScore, fitScore, and needsScore to every available prospect.
 */
export function rankProspectsForTeam(
  prospects: DraftProspect[],
  deficits: RosterDeficit[],
  teamStrength: TeamStrength
): RankedProspect[] {
  return prospects.map((p) => {
    const valueScore = computeValueScore(p);
    const fitScore = computeFitScore(p, deficits);
    const needsScore = computeNeedsScore(valueScore, fitScore, teamStrength);
    return { ...p, valueScore, fitScore, needsScore };
  });
}

// ---------------------------------------------------------------------------
// Smart scout recommendation
// ---------------------------------------------------------------------------

export interface SmartRecommendation {
  prospect: RankedProspect;
  teamStrength: TeamStrength;
  explanation: string;
}

export function getSmartRecommendation(
  available: DraftProspect[],
  deficits: RosterDeficit[],
  teamStrength: TeamStrength
): SmartRecommendation | null {
  if (available.length === 0) return null;

  const ranked = rankProspectsForTeam(available, deficits, teamStrength);
  const byNeeds = [...ranked].sort((a, b) => b.needsScore - a.needsScore);
  const top = byNeeds[0];

  const strengthCtx =
    teamStrength.label === "Contender"
      ? "As a contender, championship formula fit is the priority."
      : teamStrength.label === "Rebuilding"
      ? "As a rebuilding team, ceiling and long-term value come first."
      : "Your team is in the mix — balancing ceiling and fit.";

  let explanation: string;
  if (top.fitScore > 0) {
    explanation =
      `${strengthCtx} ` +
      `${top.name} fills your ${top.offensiveArchetype} / ${top.defensiveRole} gap ` +
      `(formula slot weight: ${top.fitScore}%). ` +
      `Ceiling score: ${top.valueScore}/100 · Needs score: ${top.needsScore}/100.`;
  } else {
    // No available prospect fills a formula deficit
    if (teamStrength.label === "Rebuilding" || teamStrength.label === "Middle") {
      explanation =
        `${strengthCtx} ` +
        `No available prospect fills a formula gap — taking best ceiling. ` +
        `${top.name}: ${top.offensiveArchetype} / ${top.defensiveRole}, ` +
        `Grade ${top.grade}, ceiling score ${top.valueScore}/100.`;
    } else {
      explanation =
        `${strengthCtx} ` +
        `No available prospect addresses your top deficits. ` +
        `Best available: ${top.name} (Grade ${top.grade}, ${top.offensiveArchetype} / ${top.defensiveRole}).`;
    }
  }

  return { prospect: top, teamStrength, explanation };
}
