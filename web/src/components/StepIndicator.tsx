import type { SimulatorPhase } from "../types/simulator";

const STEPS: { phase: SimulatorPhase; label: string; num: number }[] = [
  { phase: "FREE_AGENCY", label: "Free Agency", num: 1 },
  { phase: "DRAFT", label: "Draft", num: 2 },
  { phase: "COMPLETE", label: "Summary", num: 3 },
];

const PHASE_ORDER: SimulatorPhase[] = [
  "SELECT_TEAM",
  "FREE_AGENCY",
  "DRAFT",
  "COMPLETE",
];

interface Props {
  phase: SimulatorPhase;
}

export default function StepIndicator({ phase }: Props) {
  const currentIdx = PHASE_ORDER.indexOf(phase);

  return (
    <div className="step-indicator">
      {STEPS.map((step, i) => {
        const stepIdx = PHASE_ORDER.indexOf(step.phase);
        const isComplete = stepIdx < currentIdx;
        const isActive = stepIdx === currentIdx;
        const isLocked = stepIdx > currentIdx;

        return (
          <div key={step.phase} className="step-indicator__item">
            {i > 0 && (
              <div
                className={`step-indicator__connector${
                  isComplete ? " step-indicator__connector--done" : ""
                }`}
              />
            )}
            <div
              className={[
                "step-indicator__dot",
                isActive ? "step-indicator__dot--active" : "",
                isComplete ? "step-indicator__dot--complete" : "",
                isLocked ? "step-indicator__dot--locked" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {isComplete ? "✓" : step.num}
            </div>
            <div
              className={[
                "step-indicator__label",
                isActive ? "step-indicator__label--active" : "",
                isLocked ? "step-indicator__label--locked" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="step-indicator__label-num">
                Step {step.num}
              </span>
              <span className="step-indicator__label-name">{step.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
