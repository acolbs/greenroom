import React from "react";
import type { FreeAgencyDecision } from "../types/simulator";

type Props = {
  value?: FreeAgencyDecision;
  onChoose: (decision: FreeAgencyDecision) => void;
  disabled?: boolean;
};

export default function SalaryDecisionToggle({ value, onChoose, disabled }: Props) {
  const chose = value;
  return (
    <div className="row" style={{ justifyContent: "stretch", width: "100%", gap: "0.5rem" }}>
      <button
        className={`btn ${chose === "RE_SIGN" ? "btn-primary" : ""}`}
        style={{ flex: 1 }}
        disabled={disabled}
        onClick={() => onChoose("RE_SIGN")}
        type="button"
      >
        Re-sign
      </button>
      <button
        className={`btn ${chose === "LET_WALK" ? "btn-primary" : ""}`}
        style={{ flex: 1 }}
        disabled={disabled}
        onClick={() => onChoose("LET_WALK")}
        type="button"
      >
        Let walk
      </button>
    </div>
  );
}
