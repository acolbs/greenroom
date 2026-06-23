import type { ProspectCollegeStats } from "../types/simulator";
import type { NbaRadarStats } from "../data/parseNbaRadar";
import type { Physicals } from "../data/parsePhysicals";

// ---------------------------------------------------------------------------
// Radar — six comparison axes.
//
// Both prospect (college) and NBA-comp stats are PER-GAME, so we map each axis
// onto a fixed 0–100 scale (not a population percentile). Fixed scaling keeps
// the two shapes directly comparable — the whole point of the overlay — and is
// stable regardless of which two players are being compared.
// ---------------------------------------------------------------------------

export type RadarAxisKey =
  | "scoring"
  | "efficiency"
  | "playmaking"
  | "rebounding"
  | "defense"
  | "shooting";

export interface RadarAxisConfig {
  key: RadarAxisKey;
  label: string;
  /** Maps a raw stat to 0–100. */
  norm: (raw: number) => number;
  /** Formats a raw stat for display. */
  fmt: (raw: number) => string;
}

const clamp100 = (x: number): number => Math.max(0, Math.min(100, x));
/** Linear map [lo,hi] -> [0,100], clamped. */
const band = (raw: number, lo: number, hi: number): number =>
  clamp100(((raw - lo) / (hi - lo)) * 100);
const pct = (v01: number): string => `${(v01 * 100).toFixed(1)}%`;
const one = (v: number): string => v.toFixed(1);

/** Axis order is the vertex order around the hexagon (12 o'clock, clockwise). */
export const RADAR_AXES: RadarAxisConfig[] = [
  { key: "scoring", label: "Scoring", norm: (r) => band(r, 0, 30), fmt: one },
  { key: "efficiency", label: "Efficiency", norm: (r) => band(r, 0.45, 0.7), fmt: pct },
  { key: "playmaking", label: "Playmaking", norm: (r) => band(r, 0, 10), fmt: one },
  { key: "rebounding", label: "Rebounding", norm: (r) => band(r, 0, 13), fmt: one },
  { key: "defense", label: "Defense", norm: (r) => band(r, 0, 4), fmt: one },
  { key: "shooting", label: "Shooting", norm: (r) => band(r, 0.2, 0.45), fmt: pct },
];

export interface RadarPoint {
  key: RadarAxisKey;
  label: string;
  /** Underlying per-game stat (PPG, TS% as 0–1, etc.). */
  raw: number;
  /** 0–100 position along the axis. */
  norm: number;
  /** Display string for the raw stat. */
  display: string;
}

/** Raw per-game inputs, one number per axis (TS%/3P% as 0–1). */
export interface RadarInput {
  scoring: number;
  efficiency: number;
  playmaking: number;
  rebounding: number;
  defense: number;
  shooting: number;
}

export function radarFromInput(input: RadarInput): RadarPoint[] {
  return RADAR_AXES.map((axis) => {
    const raw = input[axis.key];
    return {
      key: axis.key,
      label: axis.label,
      raw,
      norm: axis.norm(raw),
      display: axis.fmt(raw),
    };
  });
}

export function radarFromCollege(s: ProspectCollegeStats): RadarPoint[] {
  return radarFromInput({
    scoring: s.pts,
    efficiency: s.tsPct,
    playmaking: s.ast,
    rebounding: s.trb,
    defense: s.stl + s.blk,
    shooting: s.fg3Pct,
  });
}

export function radarFromNba(s: NbaRadarStats): RadarPoint[] {
  return radarFromInput({
    scoring: s.pts,
    efficiency: s.tsPct,
    playmaking: s.ast,
    rebounding: s.trb,
    defense: s.stl + s.blk,
    shooting: s.fg3Pct,
  });
}

// ---------------------------------------------------------------------------
// Physicals — sliders with a percentile-within-population readout.
// ---------------------------------------------------------------------------

export type PhysicalKey = "heightIn" | "wingspanIn" | "standingReachIn" | "weightLbs";

export interface PhysicalAxisConfig {
  key: PhysicalKey;
  label: string;
  /** Slider domain [min,max] in the measurement's native unit. */
  min: number;
  max: number;
  /** Formats inches/pounds for display. */
  fmt: (raw: number) => string;
}

/** Inches → 6'7" style; keeps a quarter-inch when present. */
export function inchesToFeet(inches: number): string {
  const ft = Math.floor(inches / 12);
  const rem = inches - ft * 12;
  const whole = Math.floor(rem);
  const frac = rem - whole;
  const eighths = Math.round(frac * 8);
  const fracStr =
    eighths === 0 ? "" :
    eighths === 2 ? "¼" :
    eighths === 4 ? "½" :
    eighths === 6 ? "¾" :
    `.${(frac * 10).toFixed(0)}`;
  return `${ft}'${whole}${fracStr}"`;
}

export const PHYSICAL_AXES: PhysicalAxisConfig[] = [
  { key: "heightIn", label: "Height", min: 70, max: 88, fmt: inchesToFeet },
  { key: "wingspanIn", label: "Wingspan", min: 72, max: 94, fmt: inchesToFeet },
  { key: "standingReachIn", label: "Standing Reach", min: 92, max: 120, fmt: inchesToFeet },
  { key: "weightLbs", label: "Weight", min: 160, max: 280, fmt: (w) => `${Math.round(w)} lb` },
];

/**
 * Percentile rank (0–100) of `value` within `population` (inclusive midrank).
 * Empty population → 50 (no information). Ignores null/NaN members.
 */
export function percentile(value: number, population: number[]): number {
  const vals = population.filter((v) => Number.isFinite(v));
  if (vals.length === 0) return 50;
  let below = 0;
  let equal = 0;
  for (const v of vals) {
    if (v < value) below += 1;
    else if (v === value) equal += 1;
  }
  return clamp100(((below + 0.5 * equal) / vals.length) * 100);
}

export interface PhysicalRow {
  key: PhysicalKey;
  label: string;
  /** Subject's measurement, or null when unknown. */
  value: number | null;
  /** Comp player's measurement, or null when unknown. */
  compValue: number | null;
  /** 0–1 position of value along [min,max]. */
  fill: number;
  /** 0–1 position of compValue along [min,max], or null. */
  compFill: number | null;
  /** Subject percentile within the population, or null when value unknown. */
  percentile: number | null;
  display: string;
  compDisplay: string | null;
  min: number;
  max: number;
}

const frac = (raw: number, min: number, max: number): number =>
  Math.max(0, Math.min(1, (raw - min) / (max - min)));

/**
 * Build the four physical comparison rows. `population` supplies the percentile
 * cohort (e.g. all prospects' physicals); comp is the overlay player.
 */
export function buildPhysicalRows(
  subject: Physicals,
  comp: Physicals | null,
  population: Physicals[]
): PhysicalRow[] {
  return PHYSICAL_AXES.map((axis) => {
    const value = subject[axis.key];
    const compValue = comp ? comp[axis.key] : null;
    const pop = population
      .map((p) => p[axis.key])
      .filter((v): v is number => v != null && Number.isFinite(v));

    return {
      key: axis.key,
      label: axis.label,
      value,
      compValue,
      fill: value != null ? frac(value, axis.min, axis.max) : 0,
      compFill: compValue != null ? frac(compValue, axis.min, axis.max) : null,
      percentile: value != null ? Math.round(percentile(value, pop)) : null,
      display: value != null ? axis.fmt(value) : "—",
      compDisplay: compValue != null ? axis.fmt(compValue) : null,
      min: axis.min,
      max: axis.max,
    };
  });
}
