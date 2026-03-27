import type { Archetype, DraftProspect, PlayerStats, RosterPlayer } from "../types/simulator";
import { mapCsvArchetypesToSimulator, normalizeName } from "./archetypeMap";

export type LeagueArchetypePeer = {
  position: RosterPlayer["position"];
  stats: PlayerStats;
  archetype: Archetype;
};

let cachedLeaguePeers: LeagueArchetypePeer[] | null = null;

export function setLeagueArchetypePeers(peers: LeagueArchetypePeer[]): void {
  cachedLeaguePeers = peers;
}

export function getLeagueArchetypePeers(): LeagueArchetypePeer[] | null {
  return cachedLeaguePeers;
}

type PerGameRow = {
  fgPct: number;
  pointsPerGame: number;
  reboundsPerGame: number;
  assistsPerGame: number;
  pos: RosterPlayer["position"];
};

/** All master.csv players with per-game stats — used as kNN pool (no salary filter). */
export function buildLeagueArchetypePeers(
  masterRows: Record<string, string>[],
  pergameByPlayerTeam: Map<string, PerGameRow>,
  archetypesByPlayer: Map<string, { offensive: string; defensive: string }>
): LeagueArchetypePeer[] {
  const peers: LeagueArchetypePeer[] = [];

  for (const mr of masterRows) {
    const name = mr["Player"];
    const team = mr["Team"];
    const pos = mr["Pos"];
    const offArch = mr["Offensive Archetype"] ?? "";
    const defRole = mr["Defensive Role"] ?? "";
    if (!name || !team || !pos) continue;

    const playerKey = normalizeName(name);
    const pgKey = `${playerKey}|${team}`;
    const pg = pergameByPlayerTeam.get(pgKey);
    if (!pg) continue;

    const simPosition = pos as RosterPlayer["position"];
    const archRow = archetypesByPlayer.get(playerKey);
    const off = archRow?.offensive ?? offArch ?? "";
    const def = archRow?.defensive ?? defRole ?? "";
    const archetype = mapCsvArchetypesToSimulator(simPosition, off, def);

    peers.push({
      position: simPosition,
      archetype,
      stats: {
        pointsPerGame: pg.pointsPerGame,
        reboundsPerGame: pg.reboundsPerGame,
        assistsPerGame: pg.assistsPerGame,
        fgPct: pg.fgPct
      }
    });
  }

  return peers;
}

/** Rough scouting profile from board rank/grade when we have no measurements. */
export function syntheticProspectStats(grade: number, position: DraftProspect["position"]): PlayerStats {
  const g = Math.max(60, Math.min(100, grade));
  const t = (g - 60) / 40;

  const profiles: Record<DraftProspect["position"], PlayerStats> = {
    PG: { pointsPerGame: 12 + t * 14, reboundsPerGame: 3 + t * 3, assistsPerGame: 5 + t * 7, fgPct: 0.43 + t * 0.1 },
    SG: { pointsPerGame: 14 + t * 16, reboundsPerGame: 3.5 + t * 3, assistsPerGame: 3 + t * 4, fgPct: 0.44 + t * 0.09 },
    SF: { pointsPerGame: 13 + t * 15, reboundsPerGame: 5 + t * 4, assistsPerGame: 2.5 + t * 3, fgPct: 0.45 + t * 0.08 },
    PF: { pointsPerGame: 12 + t * 14, reboundsPerGame: 6 + t * 6, assistsPerGame: 2 + t * 2.5, fgPct: 0.47 + t * 0.07 },
    C: { pointsPerGame: 11 + t * 12, reboundsPerGame: 8 + t * 7, assistsPerGame: 1.5 + t * 2, fgPct: 0.55 + t * 0.06 }
  };

  return profiles[position];
}

type Z = { mean: number; sd: number };

function zParamsForPosition(peers: LeagueArchetypePeer[], pos: RosterPlayer["position"]): Z[] {
  const subset = peers.filter((p) => p.position === pos);
  if (subset.length < 5) return [];

  const dims: (keyof PlayerStats)[] = ["pointsPerGame", "reboundsPerGame", "assistsPerGame", "fgPct"];
  return dims.map((dim) => {
    const vals = subset.map((p) => p.stats[dim]);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const var_ = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, vals.length - 1);
    const sd = Math.sqrt(var_) || 1e-6;
    return { mean, sd };
  });
}

function zDistance(a: PlayerStats, b: PlayerStats, params: Z[]): number {
  const dims: (keyof PlayerStats)[] = ["pointsPerGame", "reboundsPerGame", "assistsPerGame", "fgPct"];
  let sum = 0;
  for (let i = 0; i < dims.length; i++) {
    const d = dims[i];
    const { mean, sd } = params[i];
    const za = (a[d] - mean) / sd;
    const zb = (b[d] - mean) / sd;
    sum += (za - zb) ** 2;
  }
  return Math.sqrt(sum);
}

const K_NEIGHBORS = 12;

/**
 * Pick simulator archetype from weighted vote among nearest NBA peers at the same position
 * (synthetic stat profile from grade + position).
 */
export function inferProspectArchetypeFromPeers(prospect: DraftProspect, peers: LeagueArchetypePeer[]): Archetype {
  const pool = peers.filter((p) => p.position === prospect.position);
  if (pool.length < 8) return prospect.projectedArchetype;

  const params = zParamsForPosition(peers, prospect.position);
  if (params.length === 0) return prospect.projectedArchetype;

  const syn = syntheticProspectStats(prospect.grade, prospect.position);

  const scored = pool.map((p) => ({
    p,
    d: zDistance(syn, p.stats, params)
  }));
  scored.sort((x, y) => x.d - y.d);
  const nearest = scored.slice(0, K_NEIGHBORS);

  const weights: Partial<Record<Archetype, number>> = {};
  for (const { p, d } of nearest) {
    const w = 1 / (1 + d);
    weights[p.archetype] = (weights[p.archetype] ?? 0) + w;
  }

  let best: Archetype = prospect.projectedArchetype;
  let bestW = -1;
  for (const a of Object.keys(weights) as Archetype[]) {
    const w = weights[a] ?? 0;
    if (w > bestW) {
      bestW = w;
      best = a;
    }
  }
  return best;
}

export function enrichDraftProspectsWithInferredArchetypes(
  board: DraftProspect[],
  peers: LeagueArchetypePeer[] | null
): DraftProspect[] {
  if (!peers || peers.length === 0) return board;
  return board.map((p) => {
    if (p.archetypeFromCsv) return p;
    return {
      ...p,
      projectedArchetype: inferProspectArchetypeFromPeers(p, peers)
    };
  });
}
