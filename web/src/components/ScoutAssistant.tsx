import React, { useMemo } from "react";
import type { DraftProspect } from "../types/simulator";
import {
  CHAMPIONSHIP_FORMULA,
  type ChampionshipFormula,
  type RosterGap,
  buildExplainableScoutBriefing,
  formulaTargetForGap,
  sortGapsForScoutPriority
} from "../data/rosterAnalysis";
import "./draftPhase.css";

type Props = {
  /** From `calculateRosterGaps` (typically worst-first; tie-break uses formula in panel order). */
  gaps: RosterGap[];
  /** Available prospects only (not yet drafted). */
  prospects: DraftProspect[];
  /** Defaults to CHAMPIONSHIP_FORMULA; inject to test or override. */
  formula?: ChampionshipFormula;
};

const TOP_HOLES = 3;

export default function ScoutAssistant({ gaps, prospects, formula = CHAMPIONSHIP_FORMULA }: Props) {
  const prioritizedDeficits = useMemo(
    () => sortGapsForScoutPriority(gaps, formula).slice(0, TOP_HOLES),
    [gaps, formula]
  );

  const briefing = useMemo(
    () => buildExplainableScoutBriefing(gaps, formula, prospects),
    [gaps, formula, prospects]
  );

  return (
    <div className="scout-assistant card-sticky">
      <div className="scout-assistant-header">
        <span className="scout-assistant-title">Scout</span>
        <span className="pill pill-accent">Advisor</span>
      </div>
      <div className="scout-assistant-body">
        <div className="scout-bubble" role="status">
          {briefing}
        </div>

        <div className="scout-gaps-panel">
          <div className="scout-gaps-title">Top holes vs. CHAMPIONSHIP_FORMULA targets</div>
          {gaps.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: "0.8125rem" }}>
              No gap data.
            </p>
          ) : prioritizedDeficits.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: "0.8125rem" }}>
              No critical shortfalls — you’re at or above target on every formula role.
            </p>
          ) : (
            prioritizedDeficits.map((g) => (
              <div key={`${g.axis}-${g.role}`} className="scout-gap-row">
                <span>
                  <span className="muted">{g.axis === "offensive" ? "Off" : "Def"}</span> · {g.role}
                  <span className="scout-gap-target-hint">(template {formulaTargetForGap(g, formula)})</span>
                </span>
                <span className="scout-gap-deficit">
                  {g.current}/{g.target}
                  {g.deficit !== 0 ? ` (${g.deficit})` : ""}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
