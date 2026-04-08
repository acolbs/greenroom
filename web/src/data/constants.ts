import type { Team } from "../types/simulator";

// ---------------------------------------------------------------------------
// 2026-27 NBA financial thresholds
// ---------------------------------------------------------------------------

export const SALARY_CAP = 165_000_000;
export const LUXURY_TAX = 201_000_000;
export const FIRST_APRON = 209_000_000;
export const SECOND_APRON = 222_000_000;

// ---------------------------------------------------------------------------
// Draft config
// ---------------------------------------------------------------------------

export const DRAFT_ROUNDS = 2;
export const DRAFT_PICKS_PER_ROUND = 30;
export const TOTAL_DRAFT_PICKS = DRAFT_ROUNDS * DRAFT_PICKS_PER_ROUND; // 60

// ---------------------------------------------------------------------------
// Rookie salary heuristic: maps grade (60–95) → annual salary
// Rough scale: grade 60 → ~$2M (min), grade 95 → ~$10M (top pick)
// ---------------------------------------------------------------------------

export function rookieSalaryFromGrade(grade: number): number {
  const clamped = Math.max(60, Math.min(95, grade));
  const t = (clamped - 60) / (95 - 60);
  return Math.round(2_000_000 + t * 8_000_000);
}

// ---------------------------------------------------------------------------
// All 30 NBA teams
// csvAbbrev = the abbreviation used in master.csv (BBRef standard)
// id        = the canonical abbreviation used everywhere else in the app
// ---------------------------------------------------------------------------

export const TEAMS: Team[] = [
  // Eastern Conference
  { id: "ATL", csvAbbrev: "ATL", city: "Atlanta",       name: "Hawks",        conference: "East" },
  { id: "BKN", csvAbbrev: "BRK", city: "Brooklyn",      name: "Nets",         conference: "East" },
  { id: "BOS", csvAbbrev: "BOS", city: "Boston",        name: "Celtics",      conference: "East" },
  { id: "CHA", csvAbbrev: "CHO", city: "Charlotte",     name: "Hornets",      conference: "East" },
  { id: "CHI", csvAbbrev: "CHI", city: "Chicago",       name: "Bulls",        conference: "East" },
  { id: "CLE", csvAbbrev: "CLE", city: "Cleveland",     name: "Cavaliers",    conference: "East" },
  { id: "DET", csvAbbrev: "DET", city: "Detroit",       name: "Pistons",      conference: "East" },
  { id: "IND", csvAbbrev: "IND", city: "Indiana",       name: "Pacers",       conference: "East" },
  { id: "MIA", csvAbbrev: "MIA", city: "Miami",         name: "Heat",         conference: "East" },
  { id: "MIL", csvAbbrev: "MIL", city: "Milwaukee",     name: "Bucks",        conference: "East" },
  { id: "NYK", csvAbbrev: "NYK", city: "New York",      name: "Knicks",       conference: "East" },
  { id: "ORL", csvAbbrev: "ORL", city: "Orlando",       name: "Magic",        conference: "East" },
  { id: "PHI", csvAbbrev: "PHI", city: "Philadelphia",  name: "76ers",        conference: "East" },
  { id: "TOR", csvAbbrev: "TOR", city: "Toronto",       name: "Raptors",      conference: "East" },
  { id: "WAS", csvAbbrev: "WAS", city: "Washington",    name: "Wizards",      conference: "East" },

  // Western Conference
  { id: "DAL", csvAbbrev: "DAL", city: "Dallas",        name: "Mavericks",    conference: "West" },
  { id: "DEN", csvAbbrev: "DEN", city: "Denver",        name: "Nuggets",      conference: "West" },
  { id: "GSW", csvAbbrev: "GSW", city: "Golden State",  name: "Warriors",     conference: "West" },
  { id: "HOU", csvAbbrev: "HOU", city: "Houston",       name: "Rockets",      conference: "West" },
  { id: "LAC", csvAbbrev: "LAC", city: "LA",            name: "Clippers",     conference: "West" },
  { id: "LAL", csvAbbrev: "LAL", city: "Los Angeles",   name: "Lakers",       conference: "West" },
  { id: "MEM", csvAbbrev: "MEM", city: "Memphis",       name: "Grizzlies",    conference: "West" },
  { id: "MIN", csvAbbrev: "MIN", city: "Minnesota",     name: "Timberwolves", conference: "West" },
  { id: "NOP", csvAbbrev: "NOP", city: "New Orleans",   name: "Pelicans",     conference: "West" },
  { id: "OKC", csvAbbrev: "OKC", city: "Oklahoma City", name: "Thunder",      conference: "West" },
  { id: "PHX", csvAbbrev: "PHO", city: "Phoenix",       name: "Suns",         conference: "West" },
  { id: "POR", csvAbbrev: "POR", city: "Portland",      name: "Trail Blazers",conference: "West" },
  { id: "SAC", csvAbbrev: "SAC", city: "Sacramento",    name: "Kings",        conference: "West" },
  { id: "SAS", csvAbbrev: "SAS", city: "San Antonio",   name: "Spurs",        conference: "West" },
  { id: "UTA", csvAbbrev: "UTA", city: "Utah",          name: "Jazz",         conference: "West" },
];

/** Canonical team ID from a CSV abbreviation (handles BRK→BKN, CHO→CHA, PHO→PHX). */
export function teamIdFromCsvAbbrev(csvAbbrev: string): string | null {
  const team = TEAMS.find((t) => t.csvAbbrev === csvAbbrev || t.id === csvAbbrev);
  return team?.id ?? null;
}

export function teamById(id: string): Team | undefined {
  return TEAMS.find((t) => t.id === id);
}

// ESPN CDN slug for team logos
// Usage: https://a.espncdn.com/i/teamlogos/nba/500/{slug}.png
const ESPN_SLUGS: Record<string, string> = {
  ATL: "atl", BKN: "bkn", BOS: "bos", CHA: "cha", CHI: "chi",
  CLE: "cle", DET: "det", IND: "ind", MIA: "mia", MIL: "mil",
  NYK: "nyk", ORL: "orl", PHI: "phi", TOR: "tor", WAS: "was",
  DAL: "dal", DEN: "den", GSW: "gs",  HOU: "hou", LAC: "lac",
  LAL: "lal", MEM: "mem", MIN: "min", NOP: "no",  OKC: "okc",
  PHX: "phx", POR: "por", SAC: "sac", SAS: "sa",  UTA: "uth",
};

export function teamLogoUrl(teamId: string): string {
  const slug = ESPN_SLUGS[teamId] ?? teamId.toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/nba/500/${slug}.png`;
}
