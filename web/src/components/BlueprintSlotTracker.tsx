import { useMemo } from "react";
import { findClosestBlueprint, getSlotFills } from "../data/blueprintScore";
import type { RosterPlayer } from "../types/simulator";

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

// Short display labels so the row doesn't overflow
function shortLabel(off: string, def: string): string {
  const OFF: Record<string, string> = {
    "Primary Ball Handler": "Ball Handler",
    "Secondary Ball Handler": "2nd Handler",
    "Shot Creator": "Shot Creator",
    "Stationary Shooter": "Spot-Up Shooter",
    "Movement Shooter": "Movement Shooter",
    "Athletic Finisher": "Finisher",
    "Roll + Cut Big": "Roll/Cut Big",
    "Stretch Big": "Stretch Big",
    "Versatile Big": "Versatile Big",
    "Post Scorer": "Post Scorer",
    "Offensive Hub": "Offensive Hub",
    "Slasher": "Slasher",
    "Off Screen Shooter": "Off-Screen",
  };
  const DEF: Record<string, string> = {
    "Point of Attack": "POA Defender",
    "Wing Stopper": "Wing Stopper",
    "Helper": "Helper",
    "Anchor Big": "Anchor",
    "Mobile Big": "Mobile Big",
    "Chaser": "Chaser",
    "Low Activity": "Low Activity",
  };
  return `${OFF[off] ?? off} + ${DEF[def] ?? def}`;
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
