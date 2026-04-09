// ---------------------------------------------------------------------------
// blueprintScore.ts
//
// Computes how closely a user's roster matches each championship blueprint,
// using weighted cosine similarity across the 9 formula slots.
//
// Adding a new blueprint when more PDFs arrive:
//   1. Run ingest-blueprint.py to add the team to championship-blueprints.json
//   2. Add a 9-element binary vector to BLUEPRINT_VECTORS below
//      (1 = this blueprint team filled that slot, 0 = they didn't)
//   3. That's it — scoring updates automatically.
// ---------------------------------------------------------------------------

import type { RosterPlayer, OffensiveArchetype, DefensiveRole } from "../types/simulator";
import { CHAMPIONSHIP_FORMULA, partialMatchCredit } from "./championshipFormula";
import blueprintsRaw from "./championship-blueprints.json";

// ---------------------------------------------------------------------------
// Public types
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

export interface BlueprintCitation {
  count: number;
  teamNames: string[];
  /** Ready-to-display note for the Scout's Take panel. */
  note: string;
}

// ---------------------------------------------------------------------------
// Blueprint vectors
//
// One entry per blueprint in championship-blueprints.json.
// Each is a 9-element array — one value per CHAMPIONSHIP_FORMULA slot, in order.
//
// Slot index → archetype pair (weight):
//   0  Primary Ball Handler / Point of Attack     (1.00)
//   1  Shot Creator / Wing Stopper                (0.90)
//   2  Stationary Shooter / Helper                (0.85)
//   3  Shot Creator / Helper                      (0.80)
//   4  Roll + Cut Big / Anchor Big                (0.75)
//   5  Roll + Cut Big / Mobile Big                (0.65)
//   6  Movement Shooter / Wing Stopper            (0.60)
//   7  Stationary Shooter / Point of Attack       (0.55)
//   8  Primary Ball Handler / Chaser              (0.50)
// ---------------------------------------------------------------------------

const BLUEPRINT_VECTORS: Record<string, number[]> = {
  // Dallas Mavericks 2023–24: superstar-centric 5-out, dual rim protectors, 3-and-D wings
  //   0  1  2  3  4  5  6  7  8
  "mavericks-2023-24": [
    1, // 0: PBH/POA  — Luka Dončić
    1, // 1: SC/WS    — Kyrie Irving (creator) + DFS/Grimes (stoppers)
    1, // 2: SS/H     — P.J. Washington as floor spacer
    1, // 3: SC/H     — Kyrie as secondary creator
    1, // 4: RCB/AB   — Dereck Lively II (anchor big)
    0, // 5: RCB/MB   — both bigs are anchor-type, not mobile
    1, // 6: MS/WS    — Dorian Finney-Smith, Josh Green
    0, // 7: SS/POA   — no classic 3-and-D guard slot
    0, // 8: PBH/C    — no dedicated pressure backup PG
  ],

  // Indiana Pacers 2024–25: ball-movement offense, PnR-heavy, pace + efficiency
  //   0  1  2  3  4  5  6  7  8
  "pacers-2024-25": [
    1, // 0: PBH/POA  — Tyrese Haliburton
    0, // 1: SC/WS    — no elite two-way wing creator
    1, // 2: SS/H     — Mathurin/Nembhard as spacing wings
    0, // 3: SC/H     — no dedicated shot creator helper
    1, // 4: RCB/AB   — Myles Turner (roll-man + anchor)
    0, // 5: RCB/MB   — no true mobile big
    1, // 6: MS/WS    — Mathurin as movement shooter on wing
    1, // 7: SS/POA   — Nembhard as 3-and-D guard
    0, // 8: PBH/C    — no dedicated high-pressure backup guard
  ],

  // OKC Thunder 2025–26: defense-first, turnover-forcing, elite ball security
  //   0  1  2  3  4  5  6  7  8
  "thunder-2025-26": [
    1, // 0: PBH/POA  — Shai Gilgeous-Alexander
    1, // 1: SC/WS    — Jalen Williams (two-way wing creator)
    0, // 2: SS/H     — no classic stationary shooter helper
    0, // 3: SC/H     — no second shot-creator helper
    0, // 4: RCB/AB   — Chet is more mobile big than anchor
    1, // 5: RCB/MB   — Chet Holmgren + Hartenstein as connector bigs
    0, // 6: MS/WS    — no classic movement shooter wing stopper
    1, // 7: SS/POA   — Alex Caruso (defensive coordinator)
    1, // 8: PBH/C    — Cason Wallace / Luguentz Dort (pressure guards)
  ],

  // Cleveland Cavaliers 2024–25: rim-and-3 efficiency, size-anchored defense
  //   0  1  2  3  4  5  6  7  8
  "cavaliers-2024-25": [
    1, // 0: PBH/POA  — Donovan Mitchell (primary ball handler)
    0, // 1: SC/WS    — no elite wing-stopper/creator combo
    1, // 2: SS/H     — Strus/Niang as spot-up spacers
    1, // 3: SC/H     — Mitchell doubles as shot creator helper
    1, // 4: RCB/AB   — Jarrett Allen (anchor big)
    1, // 5: RCB/MB   — Evan Mobley (mobile big)
    0, // 6: MS/WS    — no classic movement shooter wing stopper
    0, // 7: SS/POA   — no classic 3-and-D guard
    0, // 8: PBH/C    — no dedicated pressure PG
  ],
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type Blueprint = (typeof blueprintsRaw)["blueprints"][number];

function slotLabel(idx: number): string {
  const slot = CHAMPIONSHIP_FORMULA.slots[idx];
  if (!slot) return "";
  return `${slot.offensiveArchetype} / ${slot.defensiveRole}`;
}

/** Convert a roster into a feature vector using partial matching (0–1 per slot). */
function rosterToVector(roster: RosterPlayer[]): number[] {
  return CHAMPIONSHIP_FORMULA.slots.map((slot) => {
    const exact = roster.filter(
      (p) => p.offensiveArchetype === slot.offensiveArchetype && p.defensiveRole === slot.defensiveRole
    ).length;
    if (exact >= slot.target) return 1;
    // partial: best partial credit from any non-exact player
    const partialPlayers = roster.filter(
      (p) => !(p.offensiveArchetype === slot.offensiveArchetype && p.defensiveRole === slot.defensiveRole) &&
        (p.offensiveArchetype === slot.offensiveArchetype || p.defensiveRole === slot.defensiveRole)
    );
    if (partialPlayers.length === 0) return exact >= slot.target ? 1 : 0;
    // Return partial credit (normalized to slot.weight = 1 scale)
    return partialMatchCredit(partialPlayers[0], slot) / slot.weight;
  });
}

/**
 * Weighted cosine similarity between two binary vectors.
 * Weights are the formula slot weights so high-importance slots
 * contribute more to the final score.
 */
function weightedCosine(a: number[], b: number[]): number {
  const weights = CHAMPIONSHIP_FORMULA.slots.map((s) => s.weight);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const w = weights[i];
    dot += w * a[i] * b[i];
    normA += w * a[i] * a[i];
    normB += w * b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Pick the most relevant construction principle from a blueprint to cite.
 * Tries to find one that mentions a word from any matched slot label.
 * Falls back to the first principle.
 */
function pickCitation(
  principles: string[],
  matchedSlotLabels: string[]
): string {
  if (principles.length === 0) return "";
  if (matchedSlotLabels.length === 0) return principles[0];

  // Keywords from matched slot labels (lowercase, de-duped)
  const keywords = [
    ...new Set(
      matchedSlotLabels.flatMap((label) =>
        label
          .split(/[\s/]+/)
          .map((w) => w.toLowerCase())
          .filter((w) => w.length > 3)
      )
    ),
  ];

  const hit = principles.find((p) =>
    keywords.some((kw) => p.toLowerCase().includes(kw))
  );

  return hit ?? principles[0];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Given the current roster, find the blueprint team it most closely resembles.
 * Returns null if the roster is empty or no vectors are defined.
 */
export function findClosestBlueprint(
  roster: RosterPlayer[]
): BlueprintMatch | null {
  if (roster.length === 0) return null;

  const rv = rosterToVector(roster);
  const blueprints = blueprintsRaw.blueprints as Blueprint[];

  let best: BlueprintMatch | null = null;
  let bestSim = -1;

  for (const bp of blueprints) {
    const bv = BLUEPRINT_VECTORS[bp.id];
    if (!bv) continue; // no vector defined — skip until one is added

    const sim = weightedCosine(rv, bv);

    // Slots where both the user's roster AND this blueprint score 1
    const matchedSlotLabels = rv
      .map((v, i) => (v === 1 && bv[i] === 1 ? slotLabel(i) : null))
      .filter((x): x is string => x !== null);

    const principles = (bp as any).construction_principles as string[];
    const citationPrinciple = pickCitation(principles ?? [], matchedSlotLabels);

    if (sim > bestSim) {
      bestSim = sim;
      best = {
        blueprintId: bp.id,
        team: bp.team,
        season: bp.season,
        result: bp.result,
        score: Math.round(sim * 100),
        matchedSlotLabels,
        citationPrinciple,
        identitySentence: bp.identity_sentence,
      };
    }
  }

  return best;
}

/**
 * For a given FA player's archetype + defensive role, return how many blueprint
 * teams featured that exact slot, and a ready-to-display citation note.
 *
 * Returns null if the archetype combo doesn't map to any formula slot.
 */
export function getBlueprintCitation(
  offArch: OffensiveArchetype,
  defRole: DefensiveRole
): BlueprintCitation | null {
  const slotIdx = CHAMPIONSHIP_FORMULA.slots.findIndex(
    (s) => s.offensiveArchetype === offArch && s.defensiveRole === defRole
  );

  if (slotIdx === -1) return null;

  const blueprints = blueprintsRaw.blueprints as Blueprint[];
  const teamNames: string[] = [];

  for (const bp of blueprints) {
    const bv = BLUEPRINT_VECTORS[bp.id];
    if (bv && bv[slotIdx] === 1) {
      teamNames.push(`${bp.team} (${bp.season})`);
    }
  }

  if (teamNames.length === 0) return null;

  const total = blueprints.filter((bp) => BLUEPRINT_VECTORS[bp.id]).length;
  const slot = CHAMPIONSHIP_FORMULA.slots[slotIdx];

  return {
    count: teamNames.length,
    teamNames,
    note:
      `${offArch} / ${slot.defensiveRole} is a ${(slot.weight * 100).toFixed(0)}%-weight formula slot — ` +
      `${teamNames.length} of ${total} blueprint teams built around it, including ${teamNames[0]}.`,
  };
}

export interface PlayerBlueprintMapping {
  playerName: string;
  offensiveArchetype: string;
  defensiveRole: string;
  /** "exact" | "partial-off" | "partial-def" | "none" */
  matchType: "exact" | "partial-off" | "partial-def" | "none";
  slotLabel: string;
  matchStrength: number; // 0–1
}

/**
 * Map each roster player to their best matching slot in the closest blueprint.
 * Used to show "Player X fills the Shot Creator / Wing Stopper role" on the Summary page.
 */
export function mapRosterToBlueprint(
  roster: RosterPlayer[],
  blueprintId: string
): PlayerBlueprintMapping[] {
  const bv = BLUEPRINT_VECTORS[blueprintId];
  if (!bv) return [];

  return roster.map((p) => {
    // Try exact match first
    const exactIdx = CHAMPIONSHIP_FORMULA.slots.findIndex(
      (s, i) => bv[i] === 1 && s.offensiveArchetype === p.offensiveArchetype && s.defensiveRole === p.defensiveRole
    );
    if (exactIdx !== -1) {
      return {
        playerName: p.name,
        offensiveArchetype: p.offensiveArchetype,
        defensiveRole: p.defensiveRole,
        matchType: "exact",
        slotLabel: slotLabel(exactIdx),
        matchStrength: 1,
      };
    }

    // Try partial: offensive match in a blueprint slot
    const offIdx = CHAMPIONSHIP_FORMULA.slots.findIndex(
      (s, i) => bv[i] === 1 && s.offensiveArchetype === p.offensiveArchetype
    );
    if (offIdx !== -1) {
      const credit = partialMatchCredit(p, CHAMPIONSHIP_FORMULA.slots[offIdx]) / CHAMPIONSHIP_FORMULA.slots[offIdx].weight;
      return {
        playerName: p.name,
        offensiveArchetype: p.offensiveArchetype,
        defensiveRole: p.defensiveRole,
        matchType: "partial-off",
        slotLabel: slotLabel(offIdx),
        matchStrength: credit,
      };
    }

    // Try partial: defensive match in a blueprint slot
    const defIdx = CHAMPIONSHIP_FORMULA.slots.findIndex(
      (s, i) => bv[i] === 1 && s.defensiveRole === p.defensiveRole
    );
    if (defIdx !== -1) {
      const credit = partialMatchCredit(p, CHAMPIONSHIP_FORMULA.slots[defIdx]) / CHAMPIONSHIP_FORMULA.slots[defIdx].weight;
      return {
        playerName: p.name,
        offensiveArchetype: p.offensiveArchetype,
        defensiveRole: p.defensiveRole,
        matchType: "partial-def",
        slotLabel: slotLabel(defIdx),
        matchStrength: credit,
      };
    }

    return {
      playerName: p.name,
      offensiveArchetype: p.offensiveArchetype,
      defensiveRole: p.defensiveRole,
      matchType: "none",
      slotLabel: "",
      matchStrength: 0,
    };
  });
}

/**
 * Get all blueprints ranked by similarity to the current roster.
 * Useful for showing a "rankings" view if needed later.
 */
export function rankAllBlueprints(
  roster: RosterPlayer[]
): Array<{ team: string; season: string; score: number }> {
  if (roster.length === 0) return [];

  const rv = rosterToVector(roster);
  const blueprints = blueprintsRaw.blueprints as Blueprint[];

  return blueprints
    .filter((bp) => BLUEPRINT_VECTORS[bp.id])
    .map((bp) => ({
      team: bp.team,
      season: bp.season,
      score: Math.round(weightedCosine(rv, BLUEPRINT_VECTORS[bp.id]) * 100),
    }))
    .sort((a, b) => b.score - a.score);
}
