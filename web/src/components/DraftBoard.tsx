import React, { useMemo } from "react";
import type { DraftProspect } from "../types/simulator";
import type { RosterPlayer } from "../types/simulator";
import {
  CHAMPIONSHIP_FORMULA,
  calculateRosterGaps,
  sortProspectsByChampionshipFit,
  tallyCurrentRoster
} from "../data/rosterAnalysis";
import DraftBoardRow from "./DraftBoardRow";
import "./draftPhase.css";

export type DraftBoardViewMode = "overall" | "teamFit";

type Props = {
  roster: RosterPlayer[];
  /** All prospects still on the board (already exclude drafted if you prefer). */
  prospects: DraftProspect[];
  viewMode: DraftBoardViewMode;
  onViewModeChange: (mode: DraftBoardViewMode) => void;
  onDraft: (prospectId: string) => void;
  /** Highlight these prospect ids (e.g. top championship fits). */
  recommendedIds?: Set<string>;
  /** Phase 4: dim rows and disable Draft when the CPU is on the clock. */
  interactionLocked?: boolean;
  /** Phase 4: pick counter / on-clock message. */
  liveStatusLine?: string | null;
};

export default function DraftBoard({
  roster,
  prospects,
  viewMode,
  onViewModeChange,
  onDraft,
  recommendedIds,
  interactionLocked = false,
  liveStatusLine
}: Props) {
  const championshipGaps = useMemo(
    () => calculateRosterGaps(tallyCurrentRoster(roster), CHAMPIONSHIP_FORMULA),
    [roster]
  );

  const sortedOverall = useMemo(
    () => [...prospects].sort((a, b) => a.overallRank - b.overallRank),
    [prospects]
  );

  const sortedTeamFit = useMemo(
    () => sortProspectsByChampionshipFit(prospects, championshipGaps),
    [prospects, championshipGaps]
  );

  const board = viewMode === "overall" ? sortedOverall : sortedTeamFit;

  return (
    <div className="draft-board-shell">
      <div className="draft-board-toolbar">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 650, letterSpacing: "-0.02em" }}>Draft board</div>
          <p className="muted draft-view-caption">
            {viewMode === "overall"
              ? "Overall Big Board: scout rank and grade."
              : "Team-Fit Board: prospects ranked by how well they fill championship-template holes vs. your roster."}
          </p>
        </div>
        <div className="draft-board-tabs" role="tablist" aria-label="Draft board view">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "overall"}
            className={`draft-board-tab${viewMode === "overall" ? " draft-board-tab-active" : ""}`}
            onClick={() => onViewModeChange("overall")}
          >
            Overall Big Board
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "teamFit"}
            className={`draft-board-tab${viewMode === "teamFit" ? " draft-board-tab-active" : ""}`}
            onClick={() => onViewModeChange("teamFit")}
          >
            Team-Fit Board
          </button>
        </div>
      </div>

      <div className="draft-board-table-head" aria-hidden>
        <span>Rank</span>
        <span>Prospect</span>
        <span>Grade</span>
        <span>Action</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {board.length === 0 ? (
          <div className="card">
            <div style={{ fontWeight: 650 }}>No prospects available</div>
            <p className="muted" style={{ marginTop: "0.5rem", fontSize: "0.875rem", lineHeight: 1.55 }}>
              Load prospects from web/public/data/big_board.csv or use MOCK_PHASE3_PROSPECTS for testing.
            </p>
          </div>
        ) : (
          board.map((p, idx) => (
            <DraftBoardRow
              key={p.id}
              prospect={p}
              index={idx}
              recommended={recommendedIds?.has(p.id) ?? false}
              onDraft={onDraft}
              disabled={interactionLocked}
            />
          ))
        )}
      </div>
    </div>
  );
}
