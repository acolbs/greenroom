// ---------------------------------------------------------------------------
// reportCard.ts
//
// Builds an A-F graded offseason report card from roster, payroll, and
// deficit data. Each axis is independently scored 0–100 and graded.
// ---------------------------------------------------------------------------

import type { RosterPlayer, RosterDeficit } from "../types/simulator";
import { computeFormulFitScore } from "./championshipFormula";
import { findClosestBlueprint } from "./blueprintScore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportCardAxis {
  name: string;
  grade: string;
  score: number; // 0–100
  note: string;
}

export interface ReportCard {
  overall: { grade: string; score: number; label: string };
  axes: ReportCardAxis[];
  blueprintTeam: string | null;
  blueprintScore: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreToGrade(score: number): string {
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  if (score >= 35) return "D";
  return "F";
}

function gradeLabel(grade: string): string {
  switch (grade) {
    case "A": return "Elite";
    case "B": return "Strong";
    case "C": return "Average";
    case "D": return "Below Average";
    default:  return "Needs Work";
  }
}

const SOFT_CAP = 165_000_000;
const TAX_LINE = 201_000_000;

// ---------------------------------------------------------------------------
// Axis scorers
// ---------------------------------------------------------------------------

function archetypeBalanceAxis(roster: RosterPlayer[]): ReportCardAxis {
  const score = Math.round(computeFormulFitScore(roster) * 100);
  const grade = scoreToGrade(score);
  const filledCount = Math.round(score / 100 * 9);
  return {
    name: "Archetype Balance",
    grade,
    score,
    note: score >= 80
      ? `${filledCount} of 9 championship formula slots filled — elite construction depth.`
      : score >= 65
      ? `${filledCount} of 9 formula slots filled — solid foundation with a few gaps remaining.`
      : score >= 50
      ? `${filledCount} of 9 formula slots filled — functional roster but meaningful archetype gaps.`
      : `Only ${filledCount} of 9 formula slots filled — significant construction work still needed.`,
  };
}

function salaryEfficiencyAxis(roster: RosterPlayer[], payroll: number): ReportCardAxis {
  let score = 100;

  // Payroll penalty
  if (payroll > TAX_LINE) {
    score -= 60;
  } else if (payroll > SOFT_CAP) {
    const overage = payroll - SOFT_CAP;
    const range = TAX_LINE - SOFT_CAP;
    score -= Math.round((overage / range) * 40);
  }

  // Bonus for roster depth
  if (roster.length >= 10) score = Math.min(100, score + 10);

  score = Math.max(0, score);
  const grade = scoreToGrade(score);
  const payrollStr = "$" + (payroll / 1_000_000).toFixed(1) + "M";

  const note = payroll > TAX_LINE
    ? `Payroll at ${payrollStr} puts you into luxury tax territory — limited future flexibility.`
    : payroll > SOFT_CAP
    ? `Payroll at ${payrollStr} is over the soft cap but below the tax line — manageable flexibility.`
    : `Payroll at ${payrollStr} keeps you under the soft cap — strong financial flexibility.`;

  return { name: "Salary Efficiency", grade, score, note };
}

function blueprintSimilarityAxis(roster: RosterPlayer[]): ReportCardAxis {
  const bp = findClosestBlueprint(roster);
  const score = bp?.score ?? 0;
  const grade = scoreToGrade(score);

  const note = bp
    ? `Your construction most resembles the ${bp.team} (${bp.season}) at ${score}% match.`
    : "Add more players to assess blueprint similarity.";

  return { name: "Blueprint Match", grade, score, note };
}

function needCoverageAxis(deficits: RosterDeficit[]): ReportCardAxis {
  const score = Math.max(0, 100 - deficits.length * 15);
  const grade = scoreToGrade(score);
  const note = deficits.length === 0
    ? "All championship formula slots are covered — no critical needs remaining."
    : deficits.length <= 2
    ? `${deficits.length} formula gap${deficits.length > 1 ? "s" : ""} remaining — close to a complete blueprint.`
    : `${deficits.length} formula gaps remaining — prioritize ${deficits[0]?.offensiveArchetype ?? "key archetype"} coverage.`;

  return { name: "Need Coverage", grade, score, note };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function buildReportCard(
  roster: RosterPlayer[],
  payroll: number,
  deficits: RosterDeficit[]
): ReportCard {
  const axes: ReportCardAxis[] = [
    archetypeBalanceAxis(roster),
    salaryEfficiencyAxis(roster, payroll),
    blueprintSimilarityAxis(roster),
    needCoverageAxis(deficits),
  ];

  const weights = [0.25, 0.25, 0.30, 0.20];
  const weightedScore = axes.reduce((sum, ax, i) => sum + ax.score * weights[i], 0);
  const overallScore = Math.round(weightedScore);
  const overallGrade = scoreToGrade(overallScore);

  const bp = findClosestBlueprint(roster);

  return {
    overall: {
      grade: overallGrade,
      score: overallScore,
      label: gradeLabel(overallGrade),
    },
    axes,
    blueprintTeam: bp?.team ?? null,
    blueprintScore: bp?.score ?? 0,
  };
}
