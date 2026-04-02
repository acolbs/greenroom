import { assetUrl } from "./assetUrl";
import { normalizeName } from "./csvUtils";
import headshotIndex from "./headshotIndex.json";

export type HeadshotIndexPool = keyof typeof headshotIndex;

/** Public URL for a player headshot, or null if no file matches this name. */
export function headshotUrl(name: string, pool: HeadshotIndexPool): string | null {
  const key = normalizeName(name);
  const rel = headshotIndex[pool][key];
  return rel ? assetUrl(rel) : null;
}
