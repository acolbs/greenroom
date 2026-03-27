import type { Archetype, EliteFitModel, RosterPlayer } from "../types/simulator";
import { SIMULATOR_ARCHETYPES, mapCsvArchetypesToSimulator } from "./archetypeMap";

/** Filenames under `/data/top_teams/` (spaces encoded when fetching). */
export const CONTENDER_TEAM_CSV_FILES = [
  "CONTENDERS MASTER(BOS_2024).csv",
  "CONTENDERS MASTER(CLE_2025).csv",
  "CONTENDERS MASTER(DAL_2024).csv",
  "CONTENDERS MASTER(DEN_2023).csv",
  "CONTENDERS MASTER(GSW_2022).csv",
  "CONTENDERS MASTER(IND_2025).csv",
  "CONTENDERS MASTER(MEM_2022).csv",
  "CONTENDERS MASTER(MIA_2023).csv",
  "CONTENDERS MASTER(MIN_2024).csv",
  "CONTENDERS MASTER(NYK_2024).csv",
  "CONTENDERS MASTER(OKC_2025).csv",
  "CONTENDERS MASTER(PHI_2023).csv",
  "CONTENDERS MASTER(PHX_2022).csv"
] as const;

/**
 * Infer NBA position from contender-sheet offensive/defensive role labels
 * so we can reuse mapCsvArchetypesToSimulator.
 */
export function inferContenderPosition(offensive: string, defensive: string): RosterPlayer["position"] {
  const off = offensive.toLowerCase();
  const def = defensive.toLowerCase();

  if (off.includes("primary ball handler") || off.includes("secondary ball handler")) return "PG";
  if (off.includes("slasher") && def.includes("chaser")) return "PG";

  if (off.includes("versatile big")) return "C";
  if (off.includes("roll + cut") || off.includes("roll + cut big")) return "PF";
  if (off.includes("post scorer") || def.includes("anchor big")) return "C";

  if (def.includes("mobile big")) {
    if (off.includes("movement shooter") || off.includes("shot creator")) return "PF";
    return "C";
  }

  if (off.includes("off screen shooter")) return "SG";

  if (def.includes("point of attack")) {
    if (off.includes("shot creator")) return "SG";
    if (off.includes("movement shooter") || off.includes("stationary shooter")) return "SG";
    return "PG";
  }

  if (def.includes("wing stopper")) {
    if (off.includes("shot creator")) return "SF";
    return "SG";
  }

  if (def.includes("chaser")) return "SF";

  if (off.includes("shot creator") && def.includes("helper")) return "SF";

  if (off.includes("stationary shooter") && def.includes("helper")) return "PF";

  if (off.includes("movement shooter")) return "SF";

  if (off.includes("shot creator")) return "SG";

  return "SF";
}

function rowQuality(oPct: number, dPct: number): number {
  const o = Number.isFinite(oPct) ? Math.max(0, Math.min(100, oPct)) : 50;
  const d = Number.isFinite(dPct) ? Math.max(0, Math.min(100, dPct)) : 50;
  return (o + d) / 200;
}

function parsePct(raw: string): number {
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

export function parseContenderRows(rows: Record<string, string>[]): { off: string; def: string; o: number; d: number }[] {
  const out: { off: string; def: string; o: number; d: number }[] = [];
  for (const row of rows) {
    const off = row["Offensive Role"] || row["Offensive Archetype"] || "";
    const def = row["Defensive Role"] || "";
    if (!off.trim() && !def.trim()) continue;
    const o = parsePct(row["O%"] || "");
    const d = parsePct(row["D%"] || "");
    out.push({ off: off.trim(), def: def.trim(), o, d });
  }
  return out;
}

export function buildEliteFitModelFromContenderRows(
  rows: { off: string; def: string; o: number; d: number }[]
): EliteFitModel {
  const mass: Partial<Record<Archetype, number>> = {};
  let total = 0;

  for (const { off, def, o, d } of rows) {
    const pos = inferContenderPosition(off, def);
    const arch = mapCsvArchetypesToSimulator(pos, off, def);
    const q = rowQuality(o, d);
    mass[arch] = (mass[arch] ?? 0) + q;
    total += q;
  }

  const targetShareByArchetype: Partial<Record<Archetype, number>> = {};
  if (total <= 0) {
    const u = 1 / SIMULATOR_ARCHETYPES.length;
    for (const a of SIMULATOR_ARCHETYPES) targetShareByArchetype[a] = u;
  } else {
    for (const a of SIMULATOR_ARCHETYPES) {
      const m = mass[a] ?? 0;
      if (m > 0) targetShareByArchetype[a] = m / total;
    }
  }

  const maxShare = Math.max(0.0001, ...SIMULATOR_ARCHETYPES.map((a) => targetShareByArchetype[a] ?? 0));
  const priorityByArchetype: Partial<Record<Archetype, number>> = {};
  for (const a of SIMULATOR_ARCHETYPES) {
    const s = targetShareByArchetype[a] ?? 0;
    if (s > 0) priorityByArchetype[a] = s / maxShare;
  }

  return { targetShareByArchetype, priorityByArchetype };
}

/** Expected shortfall vs contender template: positive = under-weighted on current roster. */
export function eliteTemplateShortfall(
  currentCounts: Partial<Record<Archetype, number>>,
  rosterSize: number,
  model: EliteFitModel
): Partial<Record<Archetype, number>> {
  const n = Math.max(1, rosterSize);
  const out: Partial<Record<Archetype, number>> = {};
  for (const a of SIMULATOR_ARCHETYPES) {
    const share = model.targetShareByArchetype[a] ?? 0;
    const expected = share * n;
    const cur = currentCounts[a] ?? 0;
    const gap = expected - cur;
    if (gap > 0.001) out[a] = gap;
  }
  return out;
}
