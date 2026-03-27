import type { Archetype } from "../types/simulator";

export const SIMULATOR_ARCHETYPES: Archetype[] = [
  "PG Playmaker",
  "SG Shooter",
  "Wing Stopper",
  "Rim Protector",
  "Stretch Big",
  "Bench Spark",
  "Two-Way Wing"
];

export const normalizeName = (s: string) =>
  String(s)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();

/**
 * Maps `archetypes.csv` columns (Offensive Archetype, Defensive Role) plus NBA position
 * into the simulator's compact archetype enum (used for roster + draft fit).
 */
export function mapCsvArchetypesToSimulator(
  pos: "PG" | "SG" | "SF" | "PF" | "C",
  offensiveArchetype: string,
  defensiveRole: string
): Archetype {
  const off = String(offensiveArchetype ?? "").toLowerCase();
  const def = String(defensiveRole ?? "").toLowerCase();

  if (def.includes("wing stopper")) return "Wing Stopper";
  if (def.includes("rim protector")) return "Rim Protector";
  if (def.includes("stretch big")) return "Stretch Big";
  if (def.includes("anchor big")) return "Rim Protector";
  if (def.includes("mobile big")) return pos === "C" ? "Rim Protector" : "Stretch Big";
  if (def.includes("point of attack")) return pos === "PG" ? "PG Playmaker" : "Two-Way Wing";
  if (def.includes("chaser")) return "Two-Way Wing";
  if (def.includes("helper")) return "Bench Spark";

  if (off.includes("primary ball handler") || off.includes("secondary ball handler")) {
    if (pos === "PG") return "PG Playmaker";
    if (pos === "SG") return "PG Playmaker";
    return "Two-Way Wing";
  }

  if (
    off.includes("shooter") ||
    off.includes("movement shooter") ||
    off.includes("off screen shooter") ||
    off.includes("stationary shooter")
  ) {
    return pos === "SG" || pos === "PG" ? "SG Shooter" : "Bench Spark";
  }

  if (off.includes("athletic finisher")) return "Two-Way Wing";
  if (off.includes("low activity") || off.includes("low minute")) return "Bench Spark";
  if (off.includes("roll") || off.includes("versatile big")) return pos === "C" ? "Rim Protector" : "Stretch Big";
  if (off.includes("shot creator")) return pos === "C" || pos === "PF" ? "Stretch Big" : "Two-Way Wing";

  return pos === "C" ? "Rim Protector" : "Bench Spark";
}

export function parseDirectSimulatorArchetype(raw: string): Archetype | null {
  const t = String(raw ?? "").trim().toLowerCase();
  for (const a of SIMULATOR_ARCHETYPES) {
    if (a.toLowerCase() === t) return a;
  }
  return null;
}
