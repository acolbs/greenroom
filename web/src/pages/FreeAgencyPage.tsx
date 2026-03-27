import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TEAMS } from "../data/mockData";
import { useSimulatorStore } from "../store/simulatorStore";
import PlayerCard from "../components/PlayerCard";
import ScoutAIPrompt from "../components/ScoutAIPrompt";
import CurrentRosterModal from "../components/CurrentRosterModal";

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function FreeAgencyPage() {
  const navigate = useNavigate();
  const selectedTeamId = useSimulatorStore((s) => s.selectedTeamId);
  const loadingRoster = useSimulatorStore((s) => s.loadingRoster);
  const loadError = useSimulatorStore((s) => s.loadError);
  const capSpace = useSimulatorStore((s) => s.capSpace);
  const expiringContracts = useSimulatorStore((s) => s.expiringContracts);
  const decisions = useSimulatorStore((s) => s.decisions);
  const decideSalary = useSimulatorStore((s) => s.decideSalary);
  const roster = useSimulatorStore((s) => s.roster);

  const [rosterModalOpen, setRosterModalOpen] = useState(false);

  const team = TEAMS.find((t) => t.id === selectedTeamId);
  const remaining = expiringContracts.filter((c) => !decisions[c.playerId]).length;
  const allDecided = remaining === 0;

  if (loadError) {
    return (
      <div className="container">
        <div className="card">
          <div className="page-title" style={{ fontSize: "1.125rem" }}>
            Failed to load data
          </div>
          <p className="muted" style={{ marginTop: "0.5rem" }}>
            {loadError}
          </p>
        </div>
      </div>
    );
  }

  if (loadingRoster) {
    return (
      <div className="container">
        <div className="card">
          <div className="page-title" style={{ fontSize: "1.125rem" }}>
            Loading roster and contracts
          </div>
          <p className="muted" style={{ marginTop: "0.5rem" }}>
            Building the free agency board from your CSV data.
          </p>
        </div>
      </div>
    );
  }

  if (!selectedTeamId || !team) {
    return (
      <div className="container">
        <div className="card">
          <div className="page-title" style={{ fontSize: "1.125rem" }}>
            No team selected
          </div>
          <p className="muted" style={{ marginTop: "0.5rem" }}>
            Choose a team to begin the simulation.
          </p>
          <div style={{ marginTop: "1rem" }}>
            <button className="btn btn-primary" type="button" onClick={() => navigate("/select-team")}>
              Select team
            </button>
          </div>
        </div>
      </div>
    );
  }

  const onGoDraft = () => {
    if (!allDecided) return;
    navigate("/draft");
  };

  return (
    <div className="container">
      <header className="page-header">
        <div>
          <h1 className="page-title">{team.name}</h1>
          <p className="page-desc">
            Only expiring players who appear in web/public/data/2025-2026_Stats.csv with an ACE value are shown. Re-sign sets their salary to
            that ACE contract. Complete every decision here to unlock the draft.
          </p>
        </div>
        <div className="row">
          <span className="step-pill">Step 2 of 3</span>
          <button className={`btn ${allDecided ? "btn-primary" : ""}`} onClick={onGoDraft} disabled={!allDecided} type="button">
            Continue to draft
          </button>
        </div>
      </header>

      <div className="layout-split">
        <div className="layout-split-main">
          <div className="card" style={{ marginBottom: "1rem" }}>
            <div className="row" style={{ justifyContent: "space-between", width: "100%", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
              <div>
                <div className="muted" style={{ fontSize: "0.6875rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Cap space
                </div>
                <div style={{ fontWeight: 650, fontSize: "1.25rem", marginTop: "0.2rem", letterSpacing: "-0.02em" }}>{money(capSpace)}</div>
                <div className="muted" style={{ fontSize: "0.75rem", marginTop: "0.35rem" }}>
                  Cap {money(team.salaryCap)} − roster payroll (see breakdown)
                </div>
              </div>
              <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                <button type="button" className="btn" onClick={() => setRosterModalOpen(true)}>
                  View current roster
                </button>
                <div className="muted" style={{ fontSize: "0.875rem", textAlign: "right" }}>
                  Decisions remaining: <span className="text-strong">{remaining}</span>
                </div>
              </div>
            </div>
          </div>

          <p className="muted" style={{ margin: "0 0 0.65rem", fontSize: "0.8125rem" }}>
            Expiring contracts (ACE from stats file)
          </p>
          {expiringContracts.length === 0 ? (
            <div className="card">
              <p style={{ margin: 0, fontWeight: 600 }}>No qualifying free agents</p>
              <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.875rem", lineHeight: 1.5 }}>
                None of this team&apos;s expiring players matched a row in 2025-2026_Stats.csv with a valid ACE column. Add them to the stats
                file or adjust names to match the roster, then reload.
              </p>
            </div>
          ) : (
            <div className="grid-30 grid-fa">
              {expiringContracts.map((c) => (
                <PlayerCard key={c.playerId} contract={c} decision={decisions[c.playerId]} onDecide={(playerId, d) => decideSalary(playerId, d)} />
              ))}
            </div>
          )}
        </div>

        <aside className="layout-sidebar">
          <ScoutAIPrompt phase="free-agency" />
        </aside>
      </div>

      <CurrentRosterModal
        open={rosterModalOpen}
        onClose={() => setRosterModalOpen(false)}
        teamName={team.name}
        salaryCap={team.salaryCap}
        roster={roster}
      />
    </div>
  );
}
