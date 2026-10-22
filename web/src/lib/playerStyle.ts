// ---------------------------------------------------------------------------
// playerStyle.ts
//
// Play-style fingerprints and how alike two of them are. The fingerprints,
// weights and scale anchors come from scripts/build_player_style.py, which
// documents the method and prints its validation every run:
//
//   - 20 season-relative z-scores (usage, playmaking, shot diet, rebounding,
//     defense, efficiency, position mix), shrunk toward average for players
//     with few minutes.
//   - Weighted Euclidean distance, weights tuned so a player's next season is
//     found as his own closest match.
//   - Percent match: 100% = as alike as a typical player is to himself one
//     season later, 0% = no more alike than two random NBA players.
// ---------------------------------------------------------------------------

import styleData from "../data/playerStyle.json";

export interface BlueprintStyle {
  /** Basketball-Reference player ID, used to spot a player's own past season. */
  id: string;
  /** Minutes per game and BPM with that team that season, used to weight the slot. */
  mpg: number;
  bpm: number;
  z: number[];
}

interface StyleFile {
  features: string[];
  weights: number[];
  anchors: { self: number; random: number };
  current: Record<string, number[]>;
  currentMpg: Record<string, number>;
  blueprint: Record<string, Record<string, BlueprintStyle>>;
}

const DATA = styleData as StyleFile;
const W_SUM = DATA.weights.reduce((a, b) => a + b, 0);

/** 2025-26 fingerprint by Basketball-Reference ID (the master.csv player id). */
export function currentStyle(playerId: string): number[] | undefined {
  return DATA.current[playerId];
}

/** 2025-26 minutes per game by Basketball-Reference ID. */
export function currentMpg(playerId: string): number | undefined {
  return DATA.currentMpg[playerId];
}

/** That season's fingerprint, minutes and BPM for one blueprint player. */
export function blueprintStyle(blueprintId: string, name: string): BlueprintStyle | undefined {
  return DATA.blueprint[blueprintId]?.[name];
}

export function styleDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < DATA.weights.length; i++) sum += DATA.weights[i] * (a[i] - b[i]) ** 2;
  return Math.sqrt(sum / W_SUM);
}

/** 0–1 play-style match on the self-match (1) to random-pair (0) scale. */
export function styleSimilarity(a: number[], b: number[]): number {
  const { self, random } = DATA.anchors;
  const s = 1 - (styleDistance(a, b) - self) / (random - self);
  return Math.min(1, Math.max(0, s));
}
