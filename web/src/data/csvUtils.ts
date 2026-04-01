import Papa from "papaparse";
import type { OffensiveArchetype, DefensiveRole, Position } from "../types/simulator";

// ---------------------------------------------------------------------------
// Core parser — normalizes every cell to a trimmed string
// ---------------------------------------------------------------------------

export function parseCsv(text: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  return result.data.map((row) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      if (!k.trim()) continue;
      out[k.trim()] = v == null || v === "" ? "" : String(v).trim();
    }
    return out;
  });
}

// ---------------------------------------------------------------------------
// Salary parsing
// ---------------------------------------------------------------------------

/** Strips "$", commas, and the "P$" player-option prefix → number or null. */
export function parseSalaryString(raw: string): number | null {
  const s = String(raw ?? "").trim();
  if (!s || s === "--" || s === "-" || s === "—") return null;
  const digits = s.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** True when the raw Hoopshype salary string has a "P$" player-option prefix. */
export function isPlayerOptionSalary(raw: string): boolean {
  return String(raw ?? "").trim().startsWith("P$");
}

// ---------------------------------------------------------------------------
// Name normalization — used as a fuzzy match key across CSVs
// ---------------------------------------------------------------------------

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z\s]/g, "")        // keep only letters and spaces
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Type-safe archetype/role parsers
// ---------------------------------------------------------------------------

const OFFENSIVE_ARCHETYPES = new Set<string>([
  "Athletic Finisher",
  "Low Minute",
  "Movement Shooter",
  "Off Screen Shooter",
  "Post Scorer",
  "Primary Ball Handler",
  "Roll + Cut Big",
  "Secondary Ball Handler",
  "Shot Creator",
  "Slasher",
  "Stationary Shooter",
  "Stretch Big",
  "Versatile Big",
]);

const DEFENSIVE_ROLES = new Set<string>([
  "Anchor Big",
  "Chaser",
  "Helper",
  "Low Activity",
  "Mobile Big",
  "Point of Attack",
  "Wing Stopper",
]);

export function parseOffensiveArchetype(raw: string): OffensiveArchetype | null {
  const s = raw.trim();
  return OFFENSIVE_ARCHETYPES.has(s) ? (s as OffensiveArchetype) : null;
}

export function parseDefensiveRole(raw: string): DefensiveRole | null {
  const s = raw.trim();
  return DEFENSIVE_ROLES.has(s) ? (s as DefensiveRole) : null;
}

const POSITIONS = new Set<string>(["PG", "SG", "SF", "PF", "C"]);

/** Normalizes multi-position strings (e.g. "SG/PF", "SF-PF") to the first listed. */
export function parsePosition(raw: string): Position {
  const s = raw.trim().split(/[/\-,]/)[0].toUpperCase();
  return POSITIONS.has(s) ? (s as Position) : "SF";
}

// ---------------------------------------------------------------------------
// Generic numeric parser
// ---------------------------------------------------------------------------

export function toFloat(raw: string | undefined): number {
  if (!raw) return 0;
  const n = parseFloat(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}
