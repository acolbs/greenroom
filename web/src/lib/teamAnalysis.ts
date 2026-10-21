// ---------------------------------------------------------------------------
// teamAnalysis.ts
//
// The pre-draft scouting report for one team:
//   1. Stage — Contender / Middle / Rebuilding, from a visible 0–100 score
//      (top-3 talent, 2025-26 win %, core age).
//   2. Blueprint matches — how closely the roster's role mix resembles each of
//      the 13 past contenders in blueprintTeams.json.
//   3. Star comps — which past-contender player each of the team's best
//      players plays most like.
//   4. Blueprint needs — the roles the chosen blueprint had that this roster
//      doesn't, in the RosterDeficit shape the draft ranking already uses.
//
// Pure functions, no UI or store coupling.
// ---------------------------------------------------------------------------

import type {
  DefensiveRole,
  OffensiveArchetype,
  Position,
  RosterDeficit,
  RosterPlayer,
  TeamStrengthLabel,
} from "../types/simulator";
import blueprintTeamsRaw from "../data/blueprintTeams.json";
import { normalizeName } from "../data/csvUtils";

// ---------------------------------------------------------------------------
// Blueprint data
// ---------------------------------------------------------------------------

export type BlueprintTier = 1 | 2 | 3;

export interface BlueprintPlayer {
  name: string;
  position: Position;
  /** 1 = star, 2 = starter, 3 = rotation. */
  tier: BlueprintTier;
  offensiveArchetype: OffensiveArchetype;
  defensiveRole: DefensiveRole;
}

export interface BlueprintTeam {
  id: string;
  abbrev: string;
  team: string;
  season: string;
  champion: boolean;
  result: string;
  identity: string;
  /** Rotation, stars first. */
  players: BlueprintPlayer[];
}

export const BLUEPRINT_TEAMS: BlueprintTeam[] = (blueprintTeamsRaw as BlueprintTeam[]).map((bp) => ({
  ...bp,
  players: [...bp.players].sort((a, b) => a.tier - b.tier),
}));

export function blueprintById(id: string): BlueprintTeam | undefined {
  return BLUEPRINT_TEAMS.find((b) => b.id === id);
}

/** "2023-24 Celtics" style short label. */
export function blueprintLabel(bp: BlueprintTeam): string {
  const nickname = bp.team.split(" ").slice(-1)[0];
  return `${bp.season} ${nickname}`;
}

// ---------------------------------------------------------------------------
// Role similarity
//
// Exact archetype = full credit; same family (e.g. two kinds of shooter) =
// half credit. Offense counts a bit more than defense because offensive role
// drives how a roster is built around a star.
// ---------------------------------------------------------------------------

const OFF_FAMILY: Record<OffensiveArchetype, string> = {
  "Primary Ball Handler": "creator",
  "Secondary Ball Handler": "creator",
  "Shot Creator": "creator",
  "Slasher": "creator",
  "Movement Shooter": "shooter",
  "Stationary Shooter": "shooter",
  "Off Screen Shooter": "shooter",
  "Roll + Cut Big": "big",
  "Stretch Big": "big",
  "Versatile Big": "big",
  "Post Scorer": "big",
  "Athletic Finisher": "finisher",
  "Low Minute": "none",
};

const DEF_FAMILY: Record<DefensiveRole, string> = {
  "Point of Attack": "perimeter",
  "Wing Stopper": "perimeter",
  "Chaser": "perimeter",
  "Helper": "help",
  "Low Activity": "help",
  "Anchor Big": "big",
  "Mobile Big": "big",
};

const OFF_SHARE = 0.6;

interface Roles {
  offensiveArchetype: OffensiveArchetype;
  defensiveRole: DefensiveRole;
}

/** 0–1 similarity between two players' role pairs. */
export function roleSimilarity(a: Roles, b: Roles): number {
  const side = (x: string, y: string, fx: string, fy: string) =>
    x === y ? 1 : fx === fy && fx !== "none" ? 0.5 : 0;
  const off = side(
    a.offensiveArchetype,
    b.offensiveArchetype,
    OFF_FAMILY[a.offensiveArchetype],
    OFF_FAMILY[b.offensiveArchetype]
  );
  const def = side(a.defensiveRole, b.defensiveRole, DEF_FAMILY[a.defensiveRole], DEF_FAMILY[b.defensiveRole]);
  return OFF_SHARE * off + (1 - OFF_SHARE) * def;
}

// ---------------------------------------------------------------------------
// Core rotation
// ---------------------------------------------------------------------------

const CORE_SIZE = 8;

/** The team's top players by talent, skipping end-of-bench "Low Minute" guys. */
export function coreRotation(roster: RosterPlayer[], size = CORE_SIZE): RosterPlayer[] {
  return [...roster]
    .filter((p) => p.offensiveArchetype !== "Low Minute")
    .sort((a, b) => (b.talentScore ?? 0) - (a.talentScore ?? 0))
    .slice(0, size);
}

// ---------------------------------------------------------------------------
// 1. Stage
// ---------------------------------------------------------------------------

export interface StageComponent {
  key: "talent" | "record" | "age";
  label: string;
  /** Human-readable raw value, e.g. "79.2% wins". */
  display: string;
  /** 0–100 points for this component. */
  points: number;
  /** Share of the final score (sums to 1). */
  weight: number;
}

export interface StageReport {
  score: number;
  label: TeamStrengthLabel;
  components: StageComponent[];
  summary: string;
}

/** What each stage means for the draft, in one line. */
export const STAGE_PLAN: Record<TeamStrengthLabel, string> = {
  Contender: "Win-now team. Draft for fit: fill the roles your blueprint is missing.",
  Middle: "In the mix. Balance fit with talent, and don't reach for need.",
  Rebuilding: "Building for later. Take the best player available and develop.",
};

export const STAGE_THRESHOLDS = { contender: 75, middle: 50 } as const;

const STAGE_WEIGHTS = { talent: 0.45, record: 0.4, age: 0.15 } as const;

/** Linear rescale of x from [lo, hi] onto 0–100, clamped. */
function rescale(x: number, lo: number, hi: number): number {
  return Math.max(0, Math.min(100, ((x - lo) / (hi - lo)) * 100));
}

/** Core age → 0–100: peak at 28, losing 12 points per year either side. */
function agePoints(age: number): number {
  return Math.max(0, Math.min(100, 100 - Math.abs(age - 28) * 12));
}

export function stageLabel(score: number): TeamStrengthLabel {
  if (score >= STAGE_THRESHOLDS.contender) return "Contender";
  if (score >= STAGE_THRESHOLDS.middle) return "Middle";
  return "Rebuilding";
}

/** "Derrick Jones Jr." -> "Jones" */
function lastName(name: string): string {
  const parts = name.split(" ").filter((w) => !/^(jr\.?|sr\.?|ii|iii|iv)$/i.test(w));
  return parts[parts.length - 1] ?? name;
}

export function computeStage(roster: RosterPlayer[], winPct: number | null): StageReport {
  const core = coreRotation(roster);
  const top3 = core.slice(0, 3);
  const talent = top3.length ? top3.reduce((s, p) => s + (p.talentScore ?? 0), 0) / top3.length : 0;

  const top5 = core.slice(0, 5);
  const coreAge = top5.length ? top5.reduce((s, p) => s + p.age, 0) / top5.length : 0;

  // No record (shouldn't happen with 2025-26 data) → neutral .500.
  const record = (winPct ?? 0.5) * 100;

  const components: StageComponent[] = [
    {
      key: "talent",
      label: "Top-3 talent",
      display: top3.map((p) => lastName(p.name)).join(", ") || "None",
      // Every team's top 3 sit above the league median, so stretch the
      // realistic range (65 = no real star, 95 = MVP-level trio) onto 0–100.
      points: Math.round(rescale(talent, 65, 95)),
      weight: STAGE_WEIGHTS.talent,
    },
    {
      key: "record",
      label: "2025-26 record",
      display: `${record.toFixed(1)}% wins`,
      // .250 → 0, .700 (≈57 wins) → 100.
      points: Math.round(rescale(record, 25, 70)),
      weight: STAGE_WEIGHTS.record,
    },
    {
      key: "age",
      label: "Core age",
      display: `${coreAge.toFixed(1)} yrs avg (top 5)`,
      points: Math.round(agePoints(coreAge)),
      weight: STAGE_WEIGHTS.age,
    },
  ];

  const score = Math.round(components.reduce((s, c) => s + c.points * c.weight, 0));
  const label = stageLabel(score);

  return { score, label, components, summary: STAGE_PLAN[label] };
}

// ---------------------------------------------------------------------------
// 2. Blueprint matching
// ---------------------------------------------------------------------------

/** How much each blueprint role counts toward the match, by that player's tier. */
const TIER_WEIGHT: Record<BlueprintTier, number> = { 1: 1, 2: 0.75, 3: 0.5 };

/** The app's talent tier on the blueprint's 1–3 scale. */
function playerTier(p: RosterPlayer): BlueprintTier {
  return p.talentTier === "Star" ? 1 : p.talentTier === "Starter" ? 2 : 3;
}

export interface SlotPairing {
  blueprintPlayer: BlueprintPlayer;
  slotIndex: number;
  weight: number;
  /** The roster player filling this blueprint role, or null if nobody fits. */
  player: RosterPlayer | null;
  similarity: number;
}

export interface BlueprintMatchResult {
  blueprint: BlueprintTeam;
  /** 0–100 overall match. */
  score: number;
  /** 0–100 role-mix match across the whole rotation. */
  rosterScore: number;
  /** 0–100 match between the two teams' top players. */
  starScore: number;
  pairings: SlotPairing[];
}

/** Below this, a blueprint role counts as unfilled. */
const FILLED_AT = 0.75;

/**
 * Pair each blueprint role with at most one roster player (and vice versa),
 * locking the best weighted fits first.
 */
function pairRoster(core: RosterPlayer[], bp: BlueprintTeam): SlotPairing[] {
  const pairs: { pi: number; si: number; sim: number; score: number }[] = [];
  bp.players.forEach((bpP, si) => {
    core.forEach((p, pi) => {
      const sim = roleSimilarity(p, bpP);
      if (sim > 0) pairs.push({ pi, si, sim, score: sim * TIER_WEIGHT[bp.players[si].tier] });
    });
  });
  pairs.sort((a, b) => b.score - a.score);

  const usedP = new Set<number>();
  const bySlot = new Map<number, { pi: number; sim: number }>();
  for (const pr of pairs) {
    if (usedP.has(pr.pi) || bySlot.has(pr.si)) continue;
    bySlot.set(pr.si, { pi: pr.pi, sim: pr.sim });
    usedP.add(pr.pi);
  }

  return bp.players.map((bpP, si) => {
    const hit = bySlot.get(si);
    return {
      blueprintPlayer: bpP,
      slotIndex: si,
      weight: TIER_WEIGHT[bpP.tier],
      player: hit ? core[hit.pi] : null,
      similarity: hit?.sim ?? 0,
    };
  });
}

export function matchBlueprint(roster: RosterPlayer[], bp: BlueprintTeam): BlueprintMatchResult {
  const core = coreRotation(roster);
  const pairings = pairRoster(core, bp);
  const totalW = pairings.reduce((s, p) => s + p.weight, 0);
  const rosterScore = totalW ? pairings.reduce((s, p) => s + p.weight * p.similarity, 0) / totalW : 0;

  // Star match: best fit between this team's top two players and the
  // blueprint's stars.
  let star = 0;
  for (const p of core.slice(0, 2)) {
    for (const b of bp.players.filter((x) => x.tier === 1)) star = Math.max(star, roleSimilarity(p, b));
  }

  return {
    blueprint: bp,
    score: Math.round((0.7 * rosterScore + 0.3 * star) * 100),
    rosterScore: Math.round(rosterScore * 100),
    starScore: Math.round(star * 100),
    pairings,
  };
}

/** Every blueprint, best match first. Ties go to champions. */
export function rankBlueprints(roster: RosterPlayer[]): BlueprintMatchResult[] {
  return BLUEPRINT_TEAMS.map((bp) => matchBlueprint(roster, bp)).sort(
    (a, b) => b.score - a.score || Number(b.blueprint.champion) - Number(a.blueprint.champion)
  );
}

// ---------------------------------------------------------------------------
// 3. Star comps — "plays like"
// ---------------------------------------------------------------------------

export interface PlayerComp {
  player: RosterPlayer;
  comp: BlueprintPlayer;
  blueprint: BlueprintTeam;
  similarity: number;
}

const POSITION_ORDER: Position[] = ["PG", "SG", "SF", "PF", "C"];

/** 1 = same position, 0.5 = next to it, 0 = further apart. */
function positionSimilarity(a: Position, b: Position): number {
  const d = Math.abs(POSITION_ORDER.indexOf(a) - POSITION_ORDER.indexOf(b));
  return d === 0 ? 1 : d === 1 ? 0.5 : 0;
}

/**
 * For each of the team's top players, the most similar player from any past
 * contender: same role first, then same position and same tier (stars are
 * compared with stars). Ties go to champions. Never compares a player to his
 * own past self.
 */
export function starComps(roster: RosterPlayer[], count = 3): PlayerComp[] {
  return coreRotation(roster, count).flatMap((player) => {
    const self = normalizeName(player.name);
    const tier = playerTier(player);
    let best: PlayerComp | null = null;
    let bestKey = -1;
    for (const bp of BLUEPRINT_TEAMS) {
      for (const c of bp.players) {
        if (normalizeName(c.name) === self) continue;
        const role = roleSimilarity(player, c);
        const similarity = 0.7 * role + 0.2 * positionSimilarity(player.position, c.position) + 0.1 * (c.tier === tier ? 1 : 0);
        const key = similarity + (bp.champion ? 0.001 : 0);
        if (key > bestKey) {
          bestKey = key;
          best = { player, comp: c, blueprint: bp, similarity };
        }
      }
    }
    return best ? [best] : [];
  });
}

// ---------------------------------------------------------------------------
// 4. Blueprint needs → draft deficits
// ---------------------------------------------------------------------------

/**
 * Blueprint roles this roster doesn't fill, most important first, as the
 * RosterDeficit list the draft ranking consumes.
 */
export function blueprintNeeds(roster: RosterPlayer[], bp: BlueprintTeam): RosterDeficit[] {
  return pairRoster(coreRotation(roster), bp)
    .filter((p) => p.similarity < FILLED_AT)
    .sort((a, b) => b.weight - a.weight)
    .map((p) => ({
      offensiveArchetype: p.blueprintPlayer.offensiveArchetype,
      defensiveRole: p.blueprintPlayer.defensiveRole,
      target: 1,
      current: 0,
      gap: 1,
      weight: p.weight,
    }));
}

// ---------------------------------------------------------------------------
// Role citation — "how many past contenders had a player like this?"
// ---------------------------------------------------------------------------

export interface RoleCitation {
  count: number;
  teamNames: string[];
  note: string;
}

export function roleCitation(off: OffensiveArchetype, def: DefensiveRole): RoleCitation | null {
  const hits = BLUEPRINT_TEAMS.filter((bp) =>
    bp.players.some((p) => p.offensiveArchetype === off && p.defensiveRole === def)
  );
  if (hits.length === 0) return null;
  const champs = hits.filter((bp) => bp.champion).length;
  return {
    count: hits.length,
    teamNames: hits.map(blueprintLabel),
    note:
      `${hits.length} of ${BLUEPRINT_TEAMS.length} recent contenders had a ${off} / ${def} in the rotation` +
      (champs ? `, including ${champs} champion${champs > 1 ? "s" : ""}.` : "."),
  };
}
