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
// Roster → formula assignment (one player fills at most ONE slot)
// ---------------------------------------------------------------------------

export type SlotMatchType = "exact" | "partial-off" | "partial-def" | "empty";

export interface SlotAssignment {
  slotIndex: number;
  slot: FormulaSlot;
  /** The single player assigned to this slot, or null if open. */
  player: RosterPlayer | null;
  /** 0..slot.weight credit the assigned player provides. */
  credit: number;
  matchType: SlotMatchType;
}

/**
 * Assign each roster player to AT MOST ONE formula slot, and each slot to at
 * most one player, locking the strongest fits first (greedy max-credit match).
 *
 * This is the fix for the old double-counting bug: a player who fills one slot
 * can no longer also be counted toward another. Returns one entry per formula
 * slot, in formula order.
 */
export function assignRosterToFormula(roster: RosterPlayer[]): SlotAssignment[] {
  const slots = CHAMPIONSHIP_FORMULA.slots;

  // Every (player, slot) pair with positive credit, strongest first.
  const pairs: { pi: number; si: number; credit: number }[] = [];
  roster.forEach((p, pi) => {
    slots.forEach((slot, si) => {
      const credit = partialMatchCredit(p, slot);
      if (credit > 0) pairs.push({ pi, si, credit });
    });
  });
  pairs.sort((a, b) => b.credit - a.credit);

  const usedPlayer = new Set<number>();
  const slotHit = new Map<number, { pi: number; credit: number }>();
  for (const pr of pairs) {
    if (usedPlayer.has(pr.pi) || slotHit.has(pr.si)) continue;
    slotHit.set(pr.si, { pi: pr.pi, credit: pr.credit });
    usedPlayer.add(pr.pi);
  }

  return slots.map((slot, si): SlotAssignment => {
    const hit = slotHit.get(si);
    if (!hit) return { slotIndex: si, slot, player: null, credit: 0, matchType: "empty" };
    const p = roster[hit.pi];
    const offHit = p.offensiveArchetype === slot.offensiveArchetype;
    const defHit = p.defensiveRole === slot.defensiveRole;
    const matchType: SlotMatchType =
      offHit && defHit ? "exact" : offHit ? "partial-off" : "partial-def";
    return { slotIndex: si, slot, player: p, credit: hit.credit, matchType };
  });
}

// ---------------------------------------------------------------------------
// Roster deficits — derived from the no-reuse assignment
// ---------------------------------------------------------------------------

/**
 * Slots not satisfied by an EXACT-fit player, most important (highest weight)
 * first; an empty slot outranks a merely partially-covered one of equal weight.
 * A slot loosely covered by a partial fit still counts as a need — you want a
 * true fit there.
 */
export function computeRosterDeficits(roster: RosterPlayer[]): RosterDeficit[] {
  return assignRosterToFormula(roster)
    .filter((a) => a.matchType !== "exact")
    .sort((a, b) => {
      if (b.slot.weight !== a.slot.weight) return b.slot.weight - a.slot.weight;
      const rank = (m: SlotMatchType) => (m === "empty" ? 0 : 1);
      return rank(a.matchType) - rank(b.matchType);
    })
    .map((a) => ({
      offensiveArchetype: a.slot.offensiveArchetype,
      defensiveRole: a.slot.defensiveRole,
      target: a.slot.target,
      current: 0,
      gap: a.slot.target,
      weight: a.slot.weight,
    }));
}

/**
 * Formula fit score (0–1): total assigned credit / total slot weight, using the
 * no-reuse assignment so one great player can't satisfy the whole formula.
 */
export function computeFormulFitScore(roster: RosterPlayer[]): number {
  const totalWeight = CHAMPIONSHIP_FORMULA.slots.reduce((s, slot) => s + slot.weight, 0);
  if (totalWeight <= 0) return 0;
  const filled = assignRosterToFormula(roster).reduce((s, a) => s + a.credit, 0);
  return Math.min(filled / totalWeight, 1);
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
