import type {
  ChampionshipFormula,
  FormulaSlot,
  RosterDeficit,
  RosterPlayer,
  DraftProspect,
} from "../types/simulator";

// ---------------------------------------------------------------------------
// Championship Formula
//
// Derived by tallying archetype combinations across 13 historical title
// contenders (BOS_2024, CLE_2025, DAL_2024, DEN_2023, GSW_2022, IND_2025,
// MEM_2022, MIA_2023, MIN_2024, NYK_2024, OKC_2025, PHI_2023, PHX_2022).
//
// Weight = proportion of contenders that had ≥1 player in this slot (0–1).
// Slots are sorted by weight descending.
// ---------------------------------------------------------------------------

export const CHAMPIONSHIP_FORMULA: ChampionshipFormula = {
  slots: [
    // 9/13 contenders had a true lead PG (PBH + POA) — the most universal slot
    {
      offensiveArchetype: "Primary Ball Handler",
      defensiveRole: "Point of Attack",
      target: 1,
      weight: 1.00,
    },
    // 6/13: star wing who scores and guards the opponent's best perimeter threat
    {
      offensiveArchetype: "Shot Creator",
      defensiveRole: "Wing Stopper",
      target: 1,
      weight: 0.90,
    },
    // 7/13: the floor-spacing "glue" big — stretch 4 or smart vet who helps defensively
    {
      offensiveArchetype: "Stationary Shooter",
      defensiveRole: "Helper",
      target: 1,
      weight: 0.85,
    },
    // 5/13: second star / versatile scorer who plays off ball defensively
    {
      offensiveArchetype: "Shot Creator",
      defensiveRole: "Helper",
      target: 1,
      weight: 0.80,
    },
    // 5/13: the rim anchor — rolls hard, protects the paint
    {
      offensiveArchetype: "Roll + Cut Big",
      defensiveRole: "Anchor Big",
      target: 1,
      weight: 0.75,
    },
    // 4/13: the switchable modern big who can guard in space
    {
      offensiveArchetype: "Roll + Cut Big",
      defensiveRole: "Mobile Big",
      target: 1,
      weight: 0.65,
    },
    // 4/13: the 3-and-D wing — catch-and-shoot + locks up perimeter scorers
    {
      offensiveArchetype: "Movement Shooter",
      defensiveRole: "Wing Stopper",
      target: 1,
      weight: 0.60,
    },
    // 5/13: 3-and-D guard — spaces the floor and guards lead guards
    {
      offensiveArchetype: "Stationary Shooter",
      defensiveRole: "Point of Attack",
      target: 1,
      weight: 0.55,
    },
    // 3/13: the connective backup guard who pressures without the ball
    {
      offensiveArchetype: "Primary Ball Handler",
      defensiveRole: "Chaser",
      target: 1,
      weight: 0.50,
    },
  ],
};

// ---------------------------------------------------------------------------
// Data-derived partial-match weights (inverse frequency from 534-player pool
// vs 13 contender rosters). Rarer archetype = higher weight for that slot.
// ---------------------------------------------------------------------------

export const SLOT_PARTIAL_WEIGHTS: Record<string, { offW: number; defW: number }> = {
  "Primary Ball Handler|Point of Attack": { offW: 0.65, defW: 0.35 },
  "Shot Creator|Wing Stopper":            { offW: 0.37, defW: 0.63 },
  "Stationary Shooter|Helper":            { offW: 0.62, defW: 0.38 },
  "Shot Creator|Helper":                  { offW: 0.56, defW: 0.44 },
  "Roll + Cut Big|Anchor Big":            { offW: 0.36, defW: 0.64 },
  "Roll + Cut Big|Mobile Big":            { offW: 0.66, defW: 0.34 },
  "Movement Shooter|Wing Stopper":        { offW: 0.35, defW: 0.65 },
  "Stationary Shooter|Point of Attack":   { offW: 0.61, defW: 0.39 },
  "Primary Ball Handler|Chaser":          { offW: 0.63, defW: 0.37 },
};

/**
 * Partial match credit for a single player vs a formula slot.
 * Both match = 1.0 · slot.weight
 * Offensive only = offW × 0.5 · slot.weight
 * Defensive only = defW × 0.5 · slot.weight
 */
export function partialMatchCredit(
  p: { offensiveArchetype: string; defensiveRole: string },
  slot: FormulaSlot
): number {
  const offHit = p.offensiveArchetype === slot.offensiveArchetype;
  const defHit = p.defensiveRole === slot.defensiveRole;
  if (offHit && defHit) return slot.weight;
  const key = `${slot.offensiveArchetype}|${slot.defensiveRole}`;
  const w = SLOT_PARTIAL_WEIGHTS[key] ?? { offW: 0.5, defW: 0.5 };
  if (offHit) return w.offW * 0.5 * slot.weight;
  if (defHit) return w.defW * 0.5 * slot.weight;
  return 0;
}

// ---------------------------------------------------------------------------
// Roster deficit computation
// ---------------------------------------------------------------------------

/** Returns how many roster players match a given formula slot exactly. */
function countMatches(roster: RosterPlayer[], slot: FormulaSlot): number {
  return roster.filter(
    (p) =>
      p.offensiveArchetype === slot.offensiveArchetype &&
      p.defensiveRole === slot.defensiveRole
  ).length;
}

/**
 * Computes the gap between a roster's archetype composition and the
 * championship formula targets. Returns only slots where current < target,
 * ordered by weight descending (most important need first).
 */
export function computeRosterDeficits(roster: RosterPlayer[]): RosterDeficit[] {
  const deficits: RosterDeficit[] = [];

  for (const slot of CHAMPIONSHIP_FORMULA.slots) {
    const current = countMatches(roster, slot);
    const gap = Math.max(0, slot.target - current);
    if (gap > 0) {
      deficits.push({
        offensiveArchetype: slot.offensiveArchetype,
        defensiveRole: slot.defensiveRole,
        target: slot.target,
        current,
        gap,
        weight: slot.weight,
      });
    }
  }

  return deficits.sort((a, b) => b.weight - a.weight);
}

/**
 * Formula fit score: proportion of slots the roster currently satisfies.
 * Returns a value from 0 to 1.
 */
export function computeFormulFitScore(roster: RosterPlayer[]): number {
  const totalWeight = CHAMPIONSHIP_FORMULA.slots.reduce(
    (sum, s) => sum + s.weight,
    0
  );

  // Use partial matching: exact hits score full weight, single-dimension hits
  // score a data-derived fraction based on archetype rarity in the league.
  const filledWeight = CHAMPIONSHIP_FORMULA.slots.reduce((sum, slot) => {
    const exact = Math.min(countMatches(roster, slot), slot.target);
    if (exact >= slot.target) return sum + exact * slot.weight;
    // Remaining capacity: check partial matches from other players
    const remaining = slot.target - exact;
    const partialPlayers = roster.filter(
      (p) =>
        !(p.offensiveArchetype === slot.offensiveArchetype && p.defensiveRole === slot.defensiveRole) &&
        (p.offensiveArchetype === slot.offensiveArchetype || p.defensiveRole === slot.defensiveRole)
    );
    const partialCredit = Math.min(partialPlayers.length, remaining) > 0
      ? partialMatchCredit(partialPlayers[0], slot) * Math.min(partialPlayers.length, remaining)
      : 0;
    return sum + exact * slot.weight + partialCredit;
  }, 0);

  return totalWeight > 0 ? Math.min(filledWeight / totalWeight, 1) : 0;
}

// ---------------------------------------------------------------------------
// Scout AI: recommend the best available prospect for the top deficit
// ---------------------------------------------------------------------------

export interface ScoutRecommendation {
  prospect: DraftProspect;
  deficit: RosterDeficit;
  explanation: string;
}

export function getScoutRecommendation(
  availableProspects: DraftProspect[],
  deficits: RosterDeficit[]
): ScoutRecommendation | null {
  if (availableProspects.length === 0 || deficits.length === 0) return null;

  // Work through deficits from most important to least
  for (const deficit of deficits) {
    const match = availableProspects.find(
      (p) =>
        p.offensiveArchetype === deficit.offensiveArchetype &&
        p.defensiveRole === deficit.defensiveRole
    );

    if (match) {
      return {
        prospect: match,
        deficit,
        explanation:
          `Your roster is missing a ${match.offensiveArchetype} / ${match.defensiveRole} ` +
          `(target: ${deficit.target}, current: ${deficit.current}). ` +
          `This is a ${(deficit.weight * 100).toFixed(0)}% weighted slot in the championship formula — ` +
          `${match.name} (Rank #${match.rank}, Grade ${match.grade}) addresses this need directly.`,
      };
    }
  }

  // No direct match for any deficit — recommend best available by rank
  const best = availableProspects[0];
  return {
    prospect: best,
    deficit: deficits[0],
    explanation:
      `No available prospect directly fills your top deficit ` +
      `(${deficits[0].offensiveArchetype} / ${deficits[0].defensiveRole}). ` +
      `Best Player Available: ${best.name} (Rank #${best.rank}, Grade ${best.grade}, ` +
      `${best.offensiveArchetype} / ${best.defensiveRole}).`,
  };
}
