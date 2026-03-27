import type { Archetype, DraftProspect } from "../types/simulator";
import { mapCsvArchetypesToSimulator, normalizeName, parseDirectSimulatorArchetype } from "./archetypeMap";

function lowerKeyRow(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!k) continue;
    out[k.trim().toLowerCase()] = String(v ?? "").trim();
  }
  return out;
}

function cell(r: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const v = r[key.toLowerCase()];
    if (v !== undefined && v !== "") return v;
  }
  return "";
}

function parseRank(raw: string, fallback: number): number {
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function normalizeDraftPosition(p: string): DraftProspect["position"] {
  const full = p.trim().toUpperCase().replace(/\s+/g, "");
  if (full === "F-C" || full === "C-F" || full === "PF/C" || full === "C/PF") return "C";
  const primary = full.split("/")[0]?.split(",")[0]?.trim() ?? full;
  const u = primary || full;
  if (u === "PG" || u === "SG" || u === "SF" || u === "PF" || u === "C") return u;
  if (u === "G") return "SG";
  if (u === "F") return "SF";
  return "SF";
}

/**
 * Expects rows from Papa.parse with header: true.
 * Supported columns (case-insensitive): Rank, Name/Player, School/College, Pos, Grade,
 * Offensive Archetype, Defensive Role, Notes — OR ProjectedArchetype matching simulator enum.
 */
export function parseBigBoardRows(rows: Record<string, unknown>[]): DraftProspect[] {
  const out: DraftProspect[] = [];
  let idx = 0;

  for (const raw of rows) {
    const r = lowerKeyRow(raw);
    const name = cell(r, "name", "player", "prospect");
    if (!name) continue;

    idx += 1;
    const rank = parseRank(cell(r, "rank", "overall rank", "overall", "pick", "#", "overallrank", "ovr"), idx);
    const school = cell(r, "school", "college", "university", "team");
    const posRaw = cell(r, "pos", "position");
    const position = normalizeDraftPosition(posRaw || "SF");

    const gradeRaw = cell(r, "grade", "scouting grade", "score");
    const grade = gradeRaw ? Math.max(0, Math.min(100, Number(gradeRaw))) : NaN;
    const gradeFinal = Number.isFinite(grade) ? grade : Math.max(60, 100 - rank);

    const direct = cell(r, "projectedarchetype", "projected archetype", "sim archetype", "archetype");
    const off = cell(r, "offensive archetype", "offensivearchetype", "off archetype", "offensive role");
    const def = cell(r, "defensive role", "defensiverole", "defensive", "def role");
    const offTrim = off.trim();
    const defTrim = def.trim();

    let projectedArchetype: Archetype;
    const directParsed = direct ? parseDirectSimulatorArchetype(direct) : null;
    if (directParsed) projectedArchetype = directParsed;
    else projectedArchetype = mapCsvArchetypesToSimulator(position, offTrim, defTrim);

    const archetypeFromCsv = Boolean(directParsed) || (offTrim.length > 0 && defTrim.length > 0);

    const fitNotes = cell(r, "notes", "fit", "fitnotes", "summary", "comment");

    out.push({
      id: `bb-${rank}-${normalizeName(name)}`,
      name,
      school: school || "—",
      position,
      overallRank: rank,
      grade: Math.round(gradeFinal),
      projectedArchetype,
      csvOffensiveArchetype: offTrim,
      csvDefensiveRole: defTrim,
      fitNotes: fitNotes || "",
      archetypeFromCsv
    });
  }

  return out.sort((a, b) => a.overallRank - b.overallRank);
}
