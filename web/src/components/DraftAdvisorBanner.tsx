import type { DraftProspect, RosterDeficit, RosterPlayer } from "../types/simulator";
import type { SmartRecommendation } from "../data/prospectRanking";
import type { TeamStrength } from "../data/prospectRanking";
import { findClosestBlueprint } from "../data/blueprintScore";
import { CHAMPIONSHIP_FORMULA } from "../data/championshipFormula";

interface Props {
  recommendation: SmartRecommendation | null;
  deficits: RosterDeficit[];
  teamStrength: TeamStrength;
  roster: RosterPlayer[];
  isUserTurn: boolean;
  isCpuPicking: boolean;
}

function buildReason(
  recommendation: SmartRecommendation,
  deficits: RosterDeficit[],
  roster: RosterPlayer[]
): string {
  const p = recommendation.prospect;

  // Check if this prospect fills a formula deficit
  const filledDeficit = deficits.find(
    (d) =>
      d.offensiveArchetype === p.offensiveArchetype &&
      d.defensiveRole === p.defensiveRole
  );

  // Blueprint context
  const bp = findClosestBlueprint(roster);
  const slot = CHAMPIONSHIP_FORMULA.slots.find(
    (s) =>
      s.offensiveArchetype === p.offensiveArchetype &&
      s.defensiveRole === p.defensiveRole
  );
  const slotWeight = slot ? `${(slot.weight * 100).toFixed(0)}%-weight formula slot` : null;

  if (filledDeficit && slotWeight) {
    const bpStr = bp ? ` — featured on the ${bp.team} blueprint` : "";
    return `Fills your ${p.offensiveArchetype} / ${p.defensiveRole} gap, a ${slotWeight}${bpStr}.`;
  }

  if (filledDeficit) {
    return `Directly addresses your top roster gap: ${p.offensiveArchetype} / ${p.defensiveRole}.`;
  }

  if (bp && bp.score > 0) {
    return `Best player available. Your roster is ${bp.score}% aligned with the ${bp.team} blueprint — stay the course.`;
  }

  return `Best player available: Grade ${p.grade}/100, Scout Rank #${p.rank}.`;
}

export default function DraftAdvisorBanner({
  recommendation,
  deficits,
  teamStrength,
  roster,
  isUserTurn,
  isCpuPicking,
}: Props) {
  if (!isUserTurn && !isCpuPicking) return null;

  const tsColor =
    teamStrength.label === "Contender"
      ? "var(--color-accent)"
      : teamStrength.label === "Middle"
      ? "var(--color-warning)"
      : "var(--color-text-muted)";

  return (
    <div className="draft-advisor-banner">
      <div className="draft-advisor-banner__left">
        <div className="draft-advisor-banner__header">
          <div className="draft-advisor-banner__dot" />
          <span className="draft-advisor-banner__label">Scout AI</span>
          <span className="draft-advisor-banner__tier" style={{ color: tsColor, borderColor: tsColor + "55" }}>
            {teamStrength.label}
          </span>
        </div>

        {isCpuPicking ? (
          <div className="draft-advisor-banner__cpu">CPU is selecting…</div>
        ) : recommendation ? (
          <div className="draft-advisor-banner__body">
            <span className="draft-advisor-banner__verb">Recommends</span>
            <span className="draft-advisor-banner__name">{recommendation.prospect.name}</span>
            <span className="draft-advisor-banner__meta">
              {recommendation.prospect.position} · {recommendation.prospect.school} · Grade {recommendation.prospect.grade}
            </span>
          </div>
        ) : (
          <div className="draft-advisor-banner__cpu">No prospects available.</div>
        )}
      </div>

      {recommendation && !isCpuPicking && (
        <div className="draft-advisor-banner__reason">
          {buildReason(recommendation, deficits, roster)}
        </div>
      )}
    </div>
  );
}
