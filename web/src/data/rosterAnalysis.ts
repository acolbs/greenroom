/**
 * Championship Synergy — Phase 2 roster vs. ideal rotation targets.
 *
 * Targets are keyed by the same offensive / defensive labels used in `archetypes.csv`
 * and the `top_teams` contender sheets (BBall Index–style roles).
 *
 * Default `CHAMPIONSHIP_FORMULA` was derived from all `top_teams/CONTENDERS MASTER(*).csv`
 * rows (104 rotation players): each row is weighted by `(O% + D%) / 200`, so a player who
 * grades at the 90th percentile on both sides counts more toward “what great teams actually
 * stock.” Those masses are then split into integer slot targets for a 9-man rotation using
 * largest-remainder apportionment. Re-run `scripts/aggregate_contenders.mjs` if you add CSVs,
 * or call `deriveChampionshipFormulaFromContenderRows` with parsed CSV rows at runtime.
 *
 * Naming: some analysts say “Primary Initiator”; in these CSVs that slot is usually
 * `Primary Ball Handler` / `Secondary Ball Handler`.
 */

/** One row from a contender master CSV (after header parse). */
export type ContenderSheetRow = {
  offensiveRole: string;
  defensiveRole: string;
  /** Offensive archetype percentile for that season (0–100). */
  offensivePercentile: number;
  /** Defensive role percentile for that season (0–100). */
  defensivePercentile: number;
};

/** Ideal counts per role on offense and defense (each axis sums to `rotationSize`). */
export type ChampionshipFormula = {
  rotationSize: number;
  offensive: Record<string, number>;
  defensive: Record<string, number>;
};

/** Minimal player shape for tallying (matches `RosterPlayer` / post–FA roster). */
export type RosterPlayerForAnalysis = {
  csvOffensiveArchetype: string;
  csvDefensiveRole: string;
};

export type RoleTally = {
  offensive: Record<string, number>;
  defensive: Record<string, number>;
};

export type RosterGap = {
  axis: "offensive" | "defensive";
  role: string;
  current: number;
  target: number;
  /**
   * `current - target`. Negative ⇒ understaffed vs. the championship template
   * (e.g. target 2, current 0 ⇒ deficit -2).
   */
  deficit: number;
};

/**
 * Default template: quality-weighted aggregate of all `top_teams` contender rotations,
 * apportioned to a 9-man rotation (see module doc).
 */
export const CHAMPIONSHIP_FORMULA: ChampionshipFormula = {
  rotationSize: 9,
  offensive: {
    "Stationary Shooter": 2,
    "Primary Ball Handler": 2,
    "Movement Shooter": 2,
    "Shot Creator": 2,
    "Roll + Cut Big": 1
  },
  defensive: {
    Helper: 2,
    "Low Activity": 1,
    "Anchor Big": 1,
    "Point of Attack": 2,
    Chaser: 1,
    "Wing Stopper": 1,
    "Mobile Big": 1
  }
};

const DEFAULT_PCT = 50;

function clampPercentile(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_PCT;
  return Math.max(0, Math.min(100, n));
}

/** Row quality weight: high O%/D% ⇒ more influence on “what contenders actually run.” */
export function contenderRowQuality(row: ContenderSheetRow): number {
  const o = clampPercentile(row.offensivePercentile);
  const d = clampPercentile(row.defensivePercentile);
  return (o + d) / 200;
}

/**
 * Largest-remainder method: distribute `totalSlots` integer slots across categories
 * proportional to positive masses.
 */
export function apportionIntegerSlots(massByRole: Record<string, number>, totalSlots: number): Record<string, number> {
  const entries = Object.entries(massByRole).filter(([, m]) => m > 0);
  if (entries.length === 0 || totalSlots <= 0) return {};

  const sum = entries.reduce((acc, [, m]) => acc + m, 0);
  if (sum <= 0) return {};

  const withFloor = entries.map(([role, m]) => {
    const exact = (m / sum) * totalSlots;
    const floor = Math.floor(exact);
    return { role, floor, remainder: exact - floor };
  });

  let assigned = withFloor.reduce((acc, x) => acc + x.floor, 0);
  let remaining = totalSlots - assigned;

  const sorted = [...withFloor].sort((a, b) => b.remainder - a.remainder);
  const out: Record<string, number> = {};
  for (const x of withFloor) out[x.role] = x.floor;
  for (let i = 0; i < remaining; i++) {
    const x = sorted[i % sorted.length];
    out[x.role] = (out[x.role] ?? 0) + 1;
  }

  return out;
}

/**
 * Build a `ChampionshipFormula` from contender rows (e.g. parsed from all `top_teams` CSVs).
 */
export function deriveChampionshipFormulaFromContenderRows(
  rows: ContenderSheetRow[],
  rotationSize: number = 9
): ChampionshipFormula {
  const offMass: Record<string, number> = {};
  const defMass: Record<string, number> = {};

  for (const row of rows) {
    const w = contenderRowQuality(row);
    const o = row.offensiveRole.trim();
    const d = row.defensiveRole.trim();
    if (o) offMass[o] = (offMass[o] ?? 0) + w;
    if (d) defMass[d] = (defMass[d] ?? 0) + w;
  }

  return {
    rotationSize,
    offensive: apportionIntegerSlots(offMass, rotationSize),
    defensive: apportionIntegerSlots(defMass, rotationSize)
  };
}

/**
 * Count how many roster players fall into each offensive / defensive role bucket.
 * Unknown / blank labels are skipped (not counted).
 */
export function tallyCurrentRoster(roster: RosterPlayerForAnalysis[]): RoleTally {
  const offensive: Record<string, number> = {};
  const defensive: Record<string, number> = {};

  for (const p of roster) {
    const o = p.csvOffensiveArchetype?.trim() ?? "";
    const d = p.csvDefensiveRole?.trim() ?? "";
    if (o) offensive[o] = (offensive[o] ?? 0) + 1;
    if (d) defensive[d] = (defensive[d] ?? 0) + 1;
  }

  return { offensive, defensive };
}

/**
 * Compare tally vs. formula. Every role that appears in the formula gets an entry;
 * optionally include extra roles the roster has that are not in the formula (surplus-only).
 */
export function calculateRosterGaps(currentTally: RoleTally, formula: ChampionshipFormula): RosterGap[] {
  const gaps: RosterGap[] = [];

  for (const [role, target] of Object.entries(formula.offensive)) {
    const current = currentTally.offensive[role] ?? 0;
    gaps.push({
      axis: "offensive",
      role,
      current,
      target,
      deficit: current - target
    });
  }

  for (const [role, target] of Object.entries(formula.defensive)) {
    const current = currentTally.defensive[role] ?? 0;
    gaps.push({
      axis: "defensive",
      role,
      current,
      target,
      deficit: current - target
    });
  }

  // Biggest holes first: most negative deficit at top
  gaps.sort((a, b) => a.deficit - b.deficit);

  return gaps;
}

/**
 * Same as `calculateRosterGaps` but only entries where `deficit < 0` (true needs).
 */
export function getRosterDeficitsOnly(currentTally: RoleTally, formula: ChampionshipFormula): RosterGap[] {
  return calculateRosterGaps(currentTally, formula).filter((g) => g.deficit < 0);
}

/** Minimal prospect fields used for championship gap matching on the Team-Fit board. */
export type ProspectForChampionshipFit = {
  id: string;
  csvOffensiveArchetype: string;
  csvDefensiveRole: string;
  overallRank: number;
  grade: number;
};

/**
 * How well a prospect covers current roster holes. Each matching role adds weight proportional
 * to how short the roster is (`-deficit` when deficit &lt; 0).
 */
export function championshipFitScore(prospect: ProspectForChampionshipFit, gaps: RosterGap[]): number {
  const off = prospect.csvOffensiveArchetype.trim();
  const def = prospect.csvDefensiveRole.trim();
  let score = 0;
  for (const g of gaps) {
    if (g.deficit >= 0) continue;
    const need = -g.deficit;
    if (g.axis === "offensive" && off === g.role) score += need * 1000;
    if (g.axis === "defensive" && def === g.role) score += need * 1000;
  }
  return score;
}

/**
 * Team-Fit board order: strongest championship fit first, then grade, then overall rank.
 */
export function sortProspectsByChampionshipFit<T extends ProspectForChampionshipFit>(prospects: T[], gaps: RosterGap[]): T[] {
  return [...prospects].sort((a, b) => {
    const sa = championshipFitScore(a, gaps);
    const sb = championshipFitScore(b, gaps);
    if (sb !== sa) return sb - sa;
    if (b.grade !== a.grade) return b.grade - a.grade;
    return a.overallRank - b.overallRank;
  });
}

/** Baseline slot count from CHAMPIONSHIP_FORMULA for this gap's role (0 if not in formula). */
export function formulaTargetForGap(g: RosterGap, formula: ChampionshipFormula): number {
  return g.axis === "offensive" ? (formula.offensive[g.role] ?? 0) : (formula.defensive[g.role] ?? 0);
}

/**
 * Scout / explainable ordering: more negative deficit first; when two roles share the same numeric
 * shortfall, prefer the one with a higher championship template target (more “weighted” slots).
 */
export function compareDeficitsForScout(a: RosterGap, b: RosterGap, formula: ChampionshipFormula): number {
  if (a.deficit !== b.deficit) return a.deficit - b.deficit;
  const ta = formulaTargetForGap(a, formula);
  const tb = formulaTargetForGap(b, formula);
  if (tb !== ta) return tb - ta;
  if (a.axis !== b.axis) return a.axis === "offensive" ? -1 : 1;
  return a.role.localeCompare(b.role);
}

export function sortGapsForScoutPriority(gaps: RosterGap[], formula: ChampionshipFormula): RosterGap[] {
  return [...gaps].filter((g) => g.deficit < 0).sort((a, b) => compareDeficitsForScout(a, b, formula));
}

function pickTopProspectForPrioritizedHole<T extends ProspectForChampionshipFit & { name: string }>(
  gap: RosterGap,
  prospects: T[],
  allGaps: RosterGap[]
): T | null {
  if (prospects.length === 0) return null;
  const match = prospects.filter((p) =>
    gap.axis === "offensive"
      ? p.csvOffensiveArchetype.trim() === gap.role
      : p.csvDefensiveRole.trim() === gap.role
  );
  const pool = match.length > 0 ? match : prospects;
  const sorted = sortProspectsByChampionshipFit(pool, allGaps);
  return sorted[0] ?? null;
}

/**
 * Narrates the biggest hole(s) with explicit CHAMPIONSHIP_FORMULA targets and tie-break logic.
 */
export function buildExplainableScoutBriefing<T extends ProspectForChampionshipFit & { name: string }>(
  gaps: RosterGap[],
  formula: ChampionshipFormula,
  prospects: T[]
): string {
  if (prospects.length === 0) {
    return "Boss, the board is empty—there's nobody left to recommend. Refresh data or add prospects to big_board.csv.";
  }

  const prioritized = sortGapsForScoutPriority(gaps, formula);
  if (prioritized.length === 0) {
    const bpa = sortProspectsByChampionshipFit(prospects, gaps)[0]?.name ?? "the top overall prospect";
    return `Boss, every role in our championship template is at or above target (offense and defense each allocate ${formula.rotationSize} weighted rotation slots from historical contenders). I'd go best player available — ${bpa}.`;
  }

  const primary = prioritized[0];
  const need = -primary.deficit;
  const target = formulaTargetForGap(primary, formula);
  const rec = pickTopProspectForPrioritizedHole(primary, prospects, gaps);
  const recName = rec?.name ?? "the best Team-Fit option on the board";

  const tiedWorst = prioritized.filter((g) => g.deficit === primary.deficit);
  const nextHoles = prioritized.slice(1, 3).map((g) => `${g.role} (target ${formulaTargetForGap(g, formula)})`);

  if (tiedWorst.length === 1) {
    const axisWord = primary.axis === "offensive" ? "offense" : "defense";
    const alsoClause = nextHoles.length ? ` Next template priorities: ${nextHoles.join("; ")}.` : "";
    return `Boss, on ${axisWord} we're light at ${primary.role}: ${primary.current} on the roster versus a CHAMPIONSHIP_FORMULA baseline of ${target} (quality-weighted contender rotations). That's ${need} slot${need === 1 ? "" : "s"} short.${alsoClause} I recommend drafting ${recName} to close that gap.`;
  }

  const p = primary;
  const tP = formulaTargetForGap(p, formula);
  const others = tiedWorst.slice(1);

  if (others.length === 1) {
    const o = others[0];
    const tO = formulaTargetForGap(o, formula);
    const rec2 = pickTopProspectForPrioritizedHole(p, prospects, gaps);
    return `Boss, we have identical deficits for ${p.role} and ${o.role}. However, based on our historical analysis of title contenders, ${p.role} is prioritized higher in the baseline formula (target: ${tP}) than ${o.role} (target: ${tO}). I strongly recommend drafting ${rec2?.name ?? recName} to secure our ${p.axis === "offensive" ? "primary offensive engine" : "defensive template"} depth.`;
  }

  const othersPhrase = others.map((g) => `${g.role} (target ${formulaTargetForGap(g, formula)})`).join(", ");
  const rec3 = pickTopProspectForPrioritizedHole(p, prospects, gaps);
  return `Boss, we share the same numeric shortfall across ${tiedWorst.length} roles: ${tiedWorst
    .map((g) => g.role)
    .join(", ")}. I break the tie using CHAMPIONSHIP_FORMULA targets — ${p.role} leads at ${tP} slots vs. ${othersPhrase}. I recommend drafting ${rec3?.name ?? recName} to address ${p.role} first.`;
}

/** Single worst hole (most negative deficit), if any. */
export function getBiggestRosterDeficit(gaps: RosterGap[]): RosterGap | null {
  const negatives = gaps.filter((g) => g.deficit < 0);
  if (negatives.length === 0) return null;
  return negatives.reduce((worst, g) => (g.deficit < worst.deficit ? g : worst), negatives[0]);
}

function parsePercentileCell(raw: string): number {
  const n = Number(String(raw ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? clampPercentile(n) : DEFAULT_PCT;
}

/**
 * Map one parsed CSV row (e.g. from `top_teams` “CONTENDERS MASTER” files) into `ContenderSheetRow`.
 * Returns `null` if both role columns are empty.
 */
export function contenderSheetRowFromCsvRecord(row: Record<string, string>): ContenderSheetRow | null {
  const offensiveRole = (row["Offensive Role"] ?? row["Offensive Archetype"] ?? "").trim();
  const defensiveRole = (row["Defensive Role"] ?? "").trim();
  if (!offensiveRole && !defensiveRole) return null;
  return {
    offensiveRole,
    defensiveRole,
    offensivePercentile: parsePercentileCell(row["O%"] ?? ""),
    defensivePercentile: parsePercentileCell(row["D%"] ?? "")
  };
}
