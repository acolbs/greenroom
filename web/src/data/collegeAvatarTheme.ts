import { normalizeName } from "./csvUtils";

/** ESPN NCAA logo: a.espncdn.com/i/teamlogos/ncaa/500/{id}.png */
export type CollegeTheme = { bg: string; text: string; logoId: number | null };

const INTL: CollegeTheme = { bg: "#1a2233", text: "#94a3b8", logoId: null };

/**
 * Keys are normalizeName(school) — lowercase, no punctuation/diacritics.
 */
const COLLEGE_BY_KEY: Record<string, CollegeTheme> = {
  duke: { bg: "#0d1a3d", text: "#60a5fa", logoId: 150 },
  kansas: { bg: "#1a0a14", text: "#eab308", logoId: 2305 },
  byu: { bg: "#1a1c2e", text: "#a5b4fc", logoId: 252 },
  "north carolina": { bg: "#0f1729", text: "#93c5fd", logoId: 153 },
  houston: { bg: "#1a1410", text: "#f97316", logoId: 248 },
  arkansas: { bg: "#2a1018", text: "#f472b6", logoId: 8 },
  illinois: { bg: "#141a24", text: "#f97316", logoId: 356 },
  louisville: { bg: "#1a0f18", text: "#f9a8d4", logoId: 97 },
  tennessee: { bg: "#1a1510", text: "#fbbf24", logoId: 2633 },
  arizona: { bg: "#0f1724", text: "#fb923c", logoId: 12 },
  alabama: { bg: "#1a1014", text: "#f87171", logoId: 333 },
  michigan: { bg: "#0f1a28", text: "#fcd34d", logoId: 130 },
  washington: { bg: "#141820", text: "#67e8f9", logoId: 264 },
  uconn: { bg: "#0f1728", text: "#a78bfa", logoId: 41 },
  florida: { bg: "#0f1a14", text: "#86efac", logoId: 57 },
  baylor: { bg: "#1a120e", text: "#fdba74", logoId: 239 },
  kentucky: { bg: "#0f1428", text: "#93c5fd", logoId: 96 },
  iowa: { bg: "#141210", text: "#fcd34d", logoId: 2294 },
  "texas tech": { bg: "#1a1014", text: "#f87171", logoId: 2641 },
  "santa clara": { bg: "#151820", text: "#cbd5e1", logoId: 2541 },
  vanderbilt: { bg: "#14121e", text: "#c4b5fd", logoId: 238 },
  "iowa state": { bg: "#141018", text: "#fca5a5", logoId: 66 },
  texas: { bg: "#1a1012", text: "#f97316", logoId: 251 },
  stanford: { bg: "#141210", text: "#fcd34d", logoId: 24 },
  "st johns": { bg: "#1a1018", text: "#f87171", logoId: 2599 },
  purdue: { bg: "#141008", text: "#eab308", logoId: 2509 },
  "wake forest": { bg: "#141820", text: "#86efac", logoId: 154 },
  nebraska: { bg: "#1a1410", text: "#fbbf24", logoId: 158 },
  "ohio state": { bg: "#141010", text: "#f87171", logoId: 194 },
  "nc state": { bg: "#141018", text: "#f87171", logoId: 152 },
  cincinnati: { bg: "#141018", text: "#f87171", logoId: 2132 },
  auburn: { bg: "#141008", text: "#fcd34d", logoId: 2 },
  oregon: { bg: "#0f1a18", text: "#34d399", logoId: 2483 },
  "san diego state": { bg: "#141018", text: "#a78bfa", logoId: 21 },
  miami: { bg: "#141018", text: "#fb7185", logoId: 1930 },
  missouri: { bg: "#141210", text: "#fbbf24", logoId: 142 },
  georgetown: { bg: "#141018", text: "#a5b4fc", logoId: 46 },
  indiana: { bg: "#1a1014", text: "#f87171", logoId: 84 },
  "michigan state": { bg: "#0f1a12", text: "#86efac", logoId: 127 },
  usc: { bg: "#1a1014", text: "#fcd34d", logoId: 30 },
  "new zealand": INTL,
  melbourne: INTL,
  valencia: INTL,
  "reggio emilia": INTL,
  joventut: INTL,
};

export function collegeLogoUrl(logoId: number): string {
  return `https://a.espncdn.com/i/teamlogos/ncaa/500/${logoId}.png`;
}

export function collegeThemeForSchool(school: string): CollegeTheme {
  const key = normalizeName(school.trim());
  return COLLEGE_BY_KEY[key] ?? INTL;
}
