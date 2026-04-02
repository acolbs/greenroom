import type { Position } from "../types/simulator";

/** Darkened primary + readable accent for avatar ring, initials, and borders. */
export const TEAM_AVATAR_COLORS: Record<string, { bg: string; text: string }> = {
  ATL: { bg: "#3a181c", text: "#ff6b6b" },
  BKN: { bg: "#0f0f0f", text: "#b8b8b8" },
  BOS: { bg: "#0f2418", text: "#5eead4" },
  CHA: { bg: "#15182e", text: "#67e8f9" },
  CHI: { bg: "#2a1016", text: "#fb9aad" },
  CLE: { bg: "#281018", text: "#fbbf24" },
  DET: { bg: "#1a1522", text: "#f87171" },
  IND: { bg: "#0f1e36", text: "#fcd34d" },
  MIA: { bg: "#250a12", text: "#fb7185" },
  MIL: { bg: "#0f2915", text: "#86efac" },
  NYK: { bg: "#14213d", text: "#fdba74" },
  ORL: { bg: "#102a3d", text: "#7dd3fc" },
  PHI: { bg: "#132447", text: "#93c5fd" },
  TOR: { bg: "#241012", text: "#f87171" },
  WAS: { bg: "#1a1528", text: "#fb7185" },
  DAL: { bg: "#10283d", text: "#7dd3fc" },
  DEN: { bg: "#152238", text: "#fcd34d" },
  GSW: { bg: "#172554", text: "#fcd34d" },
  HOU: { bg: "#240f12", text: "#f87171" },
  LAC: { bg: "#1a1525", text: "#fca5a5" },
  LAL: { bg: "#2d1b4e", text: "#fcd34d" },
  MEM: { bg: "#1a1f3a", text: "#a5b4fc" },
  MIN: { bg: "#142130", text: "#86efac" },
  NOP: { bg: "#1a1a24", text: "#fdba74" },
  OKC: { bg: "#102a40", text: "#7dd3fc" },
  PHX: { bg: "#1e1435", text: "#fb923c" },
  POR: { bg: "#2a1216", text: "#f87171" },
  SAC: { bg: "#221530", text: "#c4b5fd" },
  SAS: { bg: "#1a1a1a", text: "#d4d4d8" },
  UTA: { bg: "#152238", text: "#fcd34d" },
};

const POS_FALLBACK: Record<Position, { bg: string; text: string }> = {
  PG: { bg: "#1a3a6e", text: "#79b8ff" },
  SG: { bg: "#2d1f5e", text: "#c084fc" },
  SF: { bg: "#3a2200", text: "#fb923c" },
  PF: { bg: "#3a1a00", text: "#f97316" },
  C: { bg: "#0d2e20", text: "#34d399" },
};

const DEFAULT_COLORS = { bg: "#1a2230", text: "#b0bec5" };

export function avatarColorsForTeam(
  teamId: string | null | undefined,
  position: Position
): { bg: string; text: string } {
  if (teamId && TEAM_AVATAR_COLORS[teamId]) {
    return TEAM_AVATAR_COLORS[teamId];
  }
  return POS_FALLBACK[position] ?? DEFAULT_COLORS;
}
