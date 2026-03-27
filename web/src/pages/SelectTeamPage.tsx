import React from "react";
import { useNavigate } from "react-router-dom";
import { TEAMS } from "../data/mockData";
import { useSimulatorStore } from "../store/simulatorStore";

export default function SelectTeamPage() {
  const navigate = useNavigate();
  const selectTeam = useSimulatorStore((s) => s.selectTeam);
  const selectedTeamId = useSimulatorStore((s) => s.selectedTeamId);
  const loadingRoster = useSimulatorStore((s) => s.loadingRoster);

  const onSelect = (id: string) => {
    selectTeam(id);
    navigate("/free-agency");
  };

  return (
    <div className="container">
      <header className="page-header">
        <div>
          <h1 className="page-title">Choose your team</h1>
          <p className="page-desc">Select a franchise to load contracts and roster data, then move into free agency and the draft.</p>
        </div>
        <span className="step-pill">Step 1 of 3</span>
      </header>

      <div className="card">
        <p className="muted" style={{ margin: "0 0 1rem", fontSize: "0.8125rem" }}>
          General manager assignment
        </p>
        <div className="grid-30">
          {TEAMS.map((t) => {
            const active = selectedTeamId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                className={`team-tile${active ? " team-tile-active" : ""}`}
                style={{ "--team-accent": t.primaryColor } as React.CSSProperties}
                onClick={() => onSelect(t.id)}
                disabled={loadingRoster}
              >
                <div className="team-tile-name">{t.name}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
