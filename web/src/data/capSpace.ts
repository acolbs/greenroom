import type { RosterPlayer } from "../types/simulator";

const safeSalary = (n: number) => (Number.isFinite(n) && n >= 0 ? n : 0);

/** Sum of cap hits for everyone currently on the roster. */
export function totalRosterPayroll(roster: RosterPlayer[]): number {
  return roster.reduce((sum, p) => sum + safeSalary(p.currentSalary), 0);
}

/**
 * Cap space for the UI: salary cap minus full roster payroll, floored at zero.
 * Always derive from the current roster — do not maintain a separate running total.
 */
export function capSpaceFromPayroll(salaryCap: number, roster: RosterPlayer[]): number {
  return Math.max(0, safeSalary(salaryCap) - totalRosterPayroll(roster));
}
