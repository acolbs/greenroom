import Papa from "papaparse";
import type { Position } from "../types/simulator";
import {
  OFFENSIVE_ARCHETYPE_SET,
  DEFENSIVE_ROLE_SET,
  type OffensiveArchetype,
  type DefensiveRole,
} from "./archetypes";

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

/** True when the raw Hoopshype salary string has a "T$" team-option prefix. */
export function isTeamOptionSalary(raw: string): boolean {
  return String(raw ?? "").trim().startsWith("T$");
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

const NAME_ALIASES: Record<string, string> = {
  "nicolas claxton": "nic claxton",
  "santiago aldama": "santi aldama",
  "herbert jones": "herb jones",
  "carlton carrington": "bub carrington",
  "hansen yang": "yang hansen",
  "cameron whitmore": "cam whitmore",
  "gregory jackson": "gg jackson",
  "yanic konan niederhauser": "yannick niederhauser",
};

/**
 * Sources disagree on suffixes ("Jr.", "III") and nicknames, so cross-CSV
 * joins (contracts, options, ACE) use this looser key instead of normalizeName.
 */
export function playerMatchKey(name: string): string {
  const base = normalizeName(name).replace(/\s(jr|sr|ii|iii|iv|v)$/, "");
  return NAME_ALIASES[base] ?? base;
}

// ---------------------------------------------------------------------------
// Type-safe archetype/role parsers
// ---------------------------------------------------------------------------

export function parseOffensiveArchetype(raw: string): OffensiveArchetype | null {
  const s = raw.trim();
  return OFFENSIVE_ARCHETYPE_SET.has(s) ? (s as OffensiveArchetype) : null;
}

export function parseDefensiveRole(raw: string): DefensiveRole | null {
  const s = raw.trim();
  return DEFENSIVE_ROLE_SET.has(s) ? (s as DefensiveRole) : null;
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
