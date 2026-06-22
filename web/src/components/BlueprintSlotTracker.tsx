import { useMemo } from "react";
import { findClosestBlueprint, getSlotFills } from "../data/blueprintScore";
import type { RosterPlayer } from "../types/simulator";
import { OFF_SHORT_LABEL, DEF_SHORT_LABEL } from "../data/archetypes";

interface Props {
  roster: RosterPlayer[];
}

const MATCH_ICON: Record<string, string> = {
  exact: "✓",
  "partial-off": "~",
  "partial-def": "~",
  empty: "○",
};

const MATCH_COLOR: Record<string, string> = {
  exact: "var(--color-accent)",
  "partial-off": "#e8a838",
  "partial-def": "#e8a838",
  empty: "var(--color-text-muted)",
};

// Short display labels so the row doesn't overflow (see data/archetypes.ts)
function shortLabel(off: string, def: string): string {
  const offLabel = (OFF_SHORT_LABEL as Record<string, string>)[off] ?? off;
  const defLabel = (DEF_SHORT_LABEL as Record<string, string>)[def] ?? def;
  return `${offLabel} + ${defLabel}`;
}

export default function BlueprintSlotTracker({ roster }: Props) {
  const closest = useMemo(() => findClosestBlueprint(roster), [roster]);
  const fills = useMemo(
    () => closest ? getSlotFills(roster, closest.blueprintId) : [],
    [roster, closest]
  );

  if (!closest) {
    return (
      <div className="blueprint-tracker">
        <div className="blueprint-tracker__header">
          <span className="blueprint-tracker__title">Blueprint Fit</span>
        </div>
        <div className="blueprint-tracker__empty">Start drafting to see your blueprint match.</div>
      </div>
    );
  }

  const filled = fills.filter((f) => f.matchType !== "empty").length;
  const total = fills.length;

  return (
    <div className="blueprint-tracker">
      {/* Header: closest team + score */}
      <div className="blueprint-tracker__header">
        <div>
          <div className="blueprint-tracker__title">Blueprint Fit</div>
          <div className="blueprint-tracker__team">
            {closest.team} · {closest.season}
          </div>
        </div>
        <div
          className="blueprint-tracker__score"
          style={{
            color:
              closest.score >= 70
                ? "var(--color-accent)"
                : closest.score >= 45
                ? "#e8a838"
                : "var(--color-text-muted)",
          }}
        >
          {closest.score}%
        </div>
      </div>

      {/* Progress bar */}
      <div className="blueprint-tracker__bar-wrap">
        <div
          className="blueprint-tracker__bar"
          style={{ width: `${(filled / total) * 100}%` }}
        />
      </div>
      <div className="blueprint-tracker__progress-label">
        {filled} of {total} slots filled
      </div>

      {/* Slot rows */}
      <div className="blueprint-tracker__slots">
        {fills.map((fill, i) => (
          <div
            key={i}
            className={`blueprint-tracker__slot${fill.matchType === "empty" ? " blueprint-tracker__slot--empty" : ""}`}
          >
            {/* Weight bar on left edge */}
            <div
              className="blueprint-tracker__slot-weight"
              style={{ height: `${fill.weight * 100}%` }}
            />

            {/* Status icon */}
            <span
              className="blueprint-tracker__slot-icon"
              style={{ color: MATCH_COLOR[fill.matchType] }}
            >
              {MATCH_ICON[fill.matchType]}
            </span>

            {/* Role label */}
            <div className="blueprint-tracker__slot-info">
              <div className="blueprint-tracker__slot-label">
                {shortLabel(fill.offensiveArchetype, fill.defensiveRole)}
              </div>
              {fill.player ? (
                <div
                  className="blueprint-tracker__slot-player"
                  style={{ color: MATCH_COLOR[fill.matchType] }}
                >
                  {fill.player}
                  {fill.matchType === "partial-off" && (
                    <span className="blueprint-tracker__slot-partial"> (off. role)</span>
                  )}
                  {fill.matchType === "partial-def" && (
                    <span className="blueprint-tracker__slot-partial"> (def. role)</span>
                  )}
                </div>
              ) : (
                <div className="blueprint-tracker__slot-open">— Open</div>
              )}
            </div>

            {/* Importance weight indicator */}
            <div className="blueprint-tracker__slot-wt">
              {"●".repeat(Math.round(fill.weight * 4))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
