import type { DraftProspect } from "../types/simulator";
import { parseOffensiveArchetype, parseDefensiveRole, parsePosition, toFloat } from "./csvUtils";
import { rookieSalaryFromGrade } from "./constants";

// ---------------------------------------------------------------------------
// big_board.csv columns (current):
//   Rank, Name, School, Pos, Year, Grade, Offensive Archetype, Defensive Role, Notes
// Legacy: Grade held class year (Freshman) — numeric scout grade was missing.
// ---------------------------------------------------------------------------

function parseScoutGrade(row: Record<string, string>): number {
  const raw = row["Grade"]?.trim() ?? "";
  const n = toFloat(raw);
  if (n >= 60 && n <= 99) return Math.round(n);
  // Non-numeric legacy cell — default mid board grade
  return 72;
}

function parseClassYear(row: Record<string, string>): string | undefined {
  const y = row["Year"]?.trim();
  if (y) return y;
  const g = row["Grade"]?.trim() ?? "";
  if (g && !/^-?\d+(\.\d+)?$/.test(g.replace(/,/g, ""))) return g;
  return undefined;
}

export function parseDraftClass(rows: Record<string, string>[]): DraftProspect[] {
  const prospects: DraftProspect[] = [];

  for (const row of rows) {
    const rank = Math.round(toFloat(row["Rank"] ?? ""));
    const name = row["Name"]?.trim();
    if (!name || rank <= 0) continue;

    const oa = parseOffensiveArchetype(row["Offensive Archetype"] ?? "");
    const dr = parseDefensiveRole(row["Defensive Role"] ?? "");

    // Skip prospects without archetype data
    if (!oa || !dr) continue;

    const grade = parseScoutGrade(row);
    const classYear = parseClassYear(row);

    prospects.push({
      id: `prospect-${rank}`,
      rank,
      name,
      school: row["School"]?.trim() ?? "",
      position: parsePosition(row["Pos"] ?? ""),
      grade,
      classYear,
      offensiveArchetype: oa,
      defensiveRole: dr,
      notes: row["Notes"]?.trim() ?? "",
      projectedSalary: rookieSalaryFromGrade(grade),
    });
  }

  // Ensure sorted by rank ascending
  return prospects.sort((a, b) => a.rank - b.rank);
}
