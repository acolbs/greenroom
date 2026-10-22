// ---------------------------------------------------------------------------
// teamAnalysis.ts
//
// The pre-draft scouting report for one team:
//   1. Stage — Contender / Middle / Rebuilding, from a visible 0–100 score
//      (top-3 talent, 2025-26 win %, core age).
//   2. Blueprint matches — how closely the roster lines up, player by player,
//      with each of the 13 past contenders in blueprintTeams.json, with each
//      slot weighted by how much that player mattered (minutes and impact).
//   3. Star comps — which past-contender player each of the team's best
//      players plays most like, by play style (lib/playerStyle.ts).
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
import { blueprintStyle, styleSimilarity, type BlueprintStyle } from "./playerStyle";

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
  /** That season's play-style fingerprint, minutes and BPM. */
  style?: BlueprintStyle;
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
  players: bp.players
    .map((p) => ({ ...p, style: blueprintStyle(bp.id, p.name) }))
    .sort((a, b) => a.tier - b.tier),
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
// Player similarity
// ---------------------------------------------------------------------------

const POSITION_ORDER: Position[] = ["PG", "SG", "SF", "PF", "C"];

/** 1 = same position, 0.5 = next to it, 0 = further apart. */
function positionSimilarity(a: Position, b: Position): number {
  const d = Math.abs(POSITION_ORDER.indexOf(a) - POSITION_ORDER.indexOf(b));
  return d === 0 ? 1 : d === 1 ? 0.5 : 0;
}

/** True when the blueprint player is this same person in an earlier season. */
export function isSamePlayer(p: RosterPlayer, b: BlueprintPlayer): boolean {
  return !!b.style && b.style.id === p.id;
}

/**
 * 0–1 match between a current player and a blueprint player, purely on play
 * style (lib/playerStyle.ts). Players without 2025-26 stats (drafted rookies,
 * anyone who missed the season) fall back to role and position, scaled down
 * because labels alone can't show a close match.
 */
export function playerSimilarity(p: RosterPlayer, b: BlueprintPlayer): number {
  if (p.style && b.style) return styleSimilarity(p.style, b.style.z);
  return 0.6 * (0.8 * roleSimilarity(p, b) + 0.2 * positionSimilarity(p.position, b.position));
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

/** Fallback slot weight by tier, for a blueprint player without minutes data. */
const TIER_WEIGHT: Record<BlueprintTier, number> = { 1: 1, 2: 0.75, 3: 0.5 };

export interface SlotPairing {
  blueprintPlayer: BlueprintPlayer;
  slotIndex: number;
  /** Share of the blueprint this slot is worth (all slots sum to 1). */
  weight: number;
  /** The roster player filling this blueprint role, or null if nobody fits. */
  player: RosterPlayer | null;
  similarity: number;
}

export interface BlueprintMatchResult {
  blueprint: BlueprintTeam;
  /** 0–100: importance-weighted average match across the blueprint's slots. */
  score: number;
  /** 0–100 match on the blueprint's star slots alone. */
  starScore: number;
  pairings: SlotPairing[];
}

/** At or above this, a blueprint slot counts as filled. */
export const FILLED_AT = 0.6;

/**
 * How much each blueprint player mattered to that team: half his share of the
 * rotation's minutes per game, half his share of its per-game impact
 * (minutes x (BPM + 2), the per-game form of value over replacement).
 * Per-game, so an injury-shortened season doesn't shrink a starter's role.
 * Sums to 1 across the rotation.
 */
export function slotWeights(bp: BlueprintTeam): number[] {
  if (bp.players.some((p) => !p.style)) {
    const total = bp.players.reduce((s, p) => s + TIER_WEIGHT[p.tier], 0);
    return bp.players.map((p) => TIER_WEIGHT[p.tier] / total);
  }
  const mpg = bp.players.map((p) => p.style!.mpg);
  const impact = bp.players.map((p) => p.style!.mpg * Math.max(0, p.style!.bpm + 2));
  const mpgSum = mpg.reduce((a, b) => a + b, 0);
  const impactSum = impact.reduce((a, b) => a + b, 0);
  return bp.players.map((_, i) => 0.5 * (mpg[i] / mpgSum) + 0.5 * (impactSum ? impact[i] / impactSum : mpg[i] / mpgSum));
}

/**
 * Minimum-cost assignment of rows to distinct columns (Hungarian algorithm,
 * O(rows² x cols)). Requires rows <= cols. Returns the column for each row.
 */
function assign(cost: number[][]): number[] {
  const n = cost.length;
  const m = cost[0]?.length ?? 0;
  const u = new Array(n + 1).fill(0);
  const v = new Array(m + 1).fill(0);
  const p = new Array(m + 1).fill(0); // p[col] = row assigned to col (1-based)
  const way = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(m + 1).fill(Infinity);
    const used = new Array(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  const result = new Array(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j]) result[p[j] - 1] = j - 1;
  return result;
}

/**
 * How well a player can fill a blueprint slot: his play-style match, scaled
 * down when his role is smaller than the slot's (a 15-minute bench player
 * can't fully stand in for a 34-minute starter). Square root, so the penalty
 * is gentle: half the minutes keeps ~71% of the match.
 */
export function slotFit(p: RosterPlayer, b: BlueprintPlayer): number {
  const sim = playerSimilarity(p, b);
  if (!p.mpg || !b.style?.mpg) return sim;
  return sim * Math.min(1, Math.sqrt(p.mpg / b.style.mpg));
}

/**
 * Assign roster players to blueprint slots, each player used at most once,
 * to maximise the importance-weighted total fit. Exact (Hungarian
 * algorithm), over the whole rotation, not just the most talented players.
 */
function pairRoster(rotation: RosterPlayer[], bp: BlueprintTeam): SlotPairing[] {
  const weights = slotWeights(bp);
  const sim = bp.players.map((b) => rotation.map((p) => slotFit(p, b)));
  // Pad with empty "nobody" columns so every slot can be assigned.
  const cols = Math.max(rotation.length, bp.players.length);
  const cost = sim.map((row, si) => Array.from({ length: cols }, (_, pi) => -(weights[si] * (row[pi] ?? 0))));
  const pick = assign(cost);
  return bp.players.map((b, si) => {
    const pi = pick[si];
    const player = pi >= 0 && pi < rotation.length ? rotation[pi] : null;
    return {
      blueprintPlayer: b,
      slotIndex: si,
      weight: weights[si],
      player,
      similarity: player ? sim[si][pi] : 0,
    };
  });
}

/** Everyone who plays real minutes: the candidates for blueprint slots. */
function rotationPlayers(roster: RosterPlayer[]): RosterPlayer[] {
  return roster.filter((p) => p.offensiveArchetype !== "Low Minute");
}

export function matchBlueprint(roster: RosterPlayer[], bp: BlueprintTeam): BlueprintMatchResult {
  const pairings = pairRoster(rotationPlayers(roster), bp);
  const score = pairings.reduce((s, p) => s + p.weight * p.similarity, 0);
  const stars = pairings.filter((p) => p.blueprintPlayer.tier === 1);
  const starW = stars.reduce((s, p) => s + p.weight, 0);
  const starScore = starW ? stars.reduce((s, p) => s + p.weight * p.similarity, 0) / starW : 0;

  return {
    blueprint: bp,
    score: Math.round(score * 100),
    starScore: Math.round(starScore * 100),
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

export interface CompMatch {
  comp: BlueprintPlayer;
  blueprint: BlueprintTeam;
  similarity: number;
}

export interface PlayerComp extends CompMatch {
  player: RosterPlayer;
  /** True when the closest match is this player's own earlier season. */
  isSelf: boolean;
  /** The closest match who is someone else, shown under a self-match. */
  other?: CompMatch;
}

/**
 * For each of the team's top players, the closest blueprint player by play
 * style. A player's own earlier season is allowed (and usually wins); when it
 * does, the closest other player is returned too. Ties go to champions.
 */
export function starComps(roster: RosterPlayer[], count = 3): PlayerComp[] {
  return coreRotation(roster, count).flatMap((player) => {
    const ranked: (CompMatch & { self: boolean })[] = [];
    for (const bp of BLUEPRINT_TEAMS) {
      for (const c of bp.players) {
        ranked.push({ comp: c, blueprint: bp, similarity: playerSimilarity(player, c), self: isSamePlayer(player, c) });
      }
    }
    ranked.sort(
      (a, b) => b.similarity - a.similarity || Number(b.blueprint.champion) - Number(a.blueprint.champion)
    );
    const top = ranked[0];
    if (!top) return [];
    const other = top.self ? ranked.find((r) => !r.self) : undefined;
    return [
      {
        player,
        comp: top.comp,
        blueprint: top.blueprint,
        similarity: top.similarity,
        isSelf: top.self,
        other: other && { comp: other.comp, blueprint: other.blueprint, similarity: other.similarity },
      },
    ];
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
  const pairings = pairRoster(rotationPlayers(roster), bp);
  // Scale so the blueprint's most important slot weighs 1 in the draft ranking.
  const top = Math.max(...pairings.map((p) => p.weight));
  return pairings
    .filter((p) => p.similarity < FILLED_AT)
    .sort((a, b) => b.weight - a.weight)
    .map((p) => ({
      offensiveArchetype: p.blueprintPlayer.offensiveArchetype,
      defensiveRole: p.blueprintPlayer.defensiveRole,
      target: 1,
      current: 0,
      gap: 1,
      weight: p.weight / top,
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
