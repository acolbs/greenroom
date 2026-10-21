import type { TeamStrengthLabel } from "../types/simulator";
import { STAGE_THRESHOLDS } from "../lib/teamAnalysis";

const ZONES: { label: TeamStrengthLabel; from: number; to: number }[] = [
  { label: "Rebuilding", from: 0, to: STAGE_THRESHOLDS.middle },
  { label: "Middle", from: STAGE_THRESHOLDS.middle, to: STAGE_THRESHOLDS.contender },
  { label: "Contender", from: STAGE_THRESHOLDS.contender, to: 100 },
];

interface Props {
  score: number;
  label: TeamStrengthLabel;
}

/** 0–100 track split into the three stage zones, with the team's score marked. */
export default function StageMeter({ score, label }: Props) {
  return (
    <div className="meter" role="img" aria-label={`Stage score ${score} of 100: ${label}`}>
      <div className="meter__marker" style={{ left: `${Math.max(2, Math.min(98, score))}%` }}>
        <span className="meter__marker-value">{score}</span>
        <span className="meter__marker-stem" />
      </div>
      <div className="meter__track">
        {ZONES.map((z) => (
          <div
            key={z.label}
            className={`meter__zone meter__zone--${z.label}${z.label === label ? " is-active" : ""}`}
            style={{ width: `${z.to - z.from}%` }}
          />
        ))}
      </div>
      <div className="meter__labels">
        {ZONES.map((z) => (
          <span key={z.label} style={{ width: `${z.to - z.from}%` }}>
            {z.label} {z.from}+
          </span>
        ))}
      </div>
    </div>
  );
}
