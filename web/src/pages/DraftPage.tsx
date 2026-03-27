import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { DraftProspect } from "../types/simulator";
import { useSimulatorStore } from "../store/simulatorStore";
import DraftBoard, { type DraftBoardViewMode } from "../components/DraftBoard";
import ScoutAssistant from "../components/ScoutAssistant";
import DraftSetupModal from "../components/DraftSetupModal";
import CurrentRosterModal from "../components/CurrentRosterModal";
import { TEAMS } from "../data/mockData";
import {
  CHAMPIONSHIP_FORMULA,
  calculateRosterGaps,
  sortProspectsByChampionshipFit,
  tallyCurrentRoster
} from "../data/rosterAnalysis";

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function DraftPage() {
  const navigate = useNavigate();
  const selectedTeamId = useSimulatorStore((s) => s.selectedTeamId);
  const roster = useSimulatorStore((s) => s.roster);
  const draftClass = useSimulatorStore((s) => s.draftClass);
  const reloadDraftBoardFromCsv = useSimulatorStore((s) => s.reloadDraftBoardFromCsv);
  const startDraftSimulation = useSimulatorStore((s) => s.startDraftSimulation);
  const userDraftAtCurrentPick = useSimulatorStore((s) => s.userDraftAtCurrentPick);
  const resetLiveDraftSession = useSimulatorStore((s) => s.resetLiveDraftSession);
  const stopDraftCpuTimer = useSimulatorStore((s) => s.stopDraftCpuTimer);

  const draftSimulationActive = useSimulatorStore((s) => s.draftSimulationActive);
  const draftSimulationComplete = useSimulatorStore((s) => s.draftSimulationComplete);
  const draftTotalPicks = useSimulatorStore((s) => s.draftTotalPicks);
  const draftCurrentPick = useSimulatorStore((s) => s.draftCurrentPick);
  const draftUserPickSlots = useSimulatorStore((s) => s.draftUserPickSlots);
  const draftAvailableProspects = useSimulatorStore((s) => s.draftAvailableProspects);
  const draftHistory = useSimulatorStore((s) => s.draftHistory);
  const draftSetupError = useSimulatorStore((s) => s.draftSetupError);
  const capSpace = useSimulatorStore((s) => s.capSpace);

  const team = TEAMS.find((t) => t.id === selectedTeamId);
  const [viewMode, setViewMode] = useState<DraftBoardViewMode>("teamFit");
  const [rosterModalOpen, setRosterModalOpen] = useState(false);

  useEffect(() => {
    if (!selectedTeamId) return;
    void reloadDraftBoardFromCsv();
  }, [selectedTeamId, reloadDraftBoardFromCsv]);

  useEffect(() => {
    return () => {
      stopDraftCpuTimer();
    };
  }, [stopDraftCpuTimer]);

  const availableProspects: DraftProspect[] = draftSimulationActive ? draftAvailableProspects : [];

  const championshipGaps = useMemo(
    () => calculateRosterGaps(tallyCurrentRoster(roster), CHAMPIONSHIP_FORMULA),
    [roster]
  );

  const recommendedIds = useMemo(() => {
    const sorted = sortProspectsByChampionshipFit(availableProspects, championshipGaps);
    return new Set(sorted.slice(0, 3).map((p) => p.id));
  }, [availableProspects, championshipGaps]);

  const userOnClock =
    draftSimulationActive &&
    !draftSimulationComplete &&
    draftUserPickSlots.includes(draftCurrentPick);

  const interactionLocked = draftSimulationActive && !draftSimulationComplete && !userOnClock;

  const liveStatusLine = useMemo(() => {
    if (!draftSimulationActive) return null;
    if (draftSimulationComplete) {
      return `Draft complete — ${draftHistory.length} selection${draftHistory.length === 1 ? "" : "s"}.`;
    }
    return `Pick ${draftCurrentPick} of ${draftTotalPicks}${
      userOnClock ? " — You're on the clock" : " — League selecting (best overall rank)"
    }`;
  }, [
    draftCurrentPick,
    draftHistory.length,
    draftSimulationActive,
    draftSimulationComplete,
    draftTotalPicks,
    userOnClock
  ]);

  const onDraft = (prospectId: string) => {
    userDraftAtCurrentPick(prospectId);
  };

  if (!selectedTeamId || !team) {
    return (
      <div className="container">
        <div className="card">
          <div className="page-title" style={{ fontSize: "1.125rem" }}>
            No team selected
          </div>
          <p className="muted" style={{ marginTop: "0.5rem" }}>
            Select a team from the workflow to open the draft board.
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

  return (
    <div className="container">
      {!draftSimulationActive ? (
        <DraftSetupModal
          onStart={(raw) => {
            startDraftSimulation(raw);
          }}
          error={draftSetupError}
        />
      ) : null}

      <header className="page-header">
        <div>
          <h1 className="page-title">{team.name}</h1>
          <p className="page-desc">
            Phase 4 live draft: CPU teams take the best overall rank between your picks. Scout explains recommendations using CHAMPIONSHIP_FORMULA targets and tie-breaks.
          </p>
        </div>
        <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
          <span className="step-pill">Step 3 of 3</span>
          <button type="button" className="btn" onClick={() => setRosterModalOpen(true)}>
            View current roster
          </button>
          <button className="btn" type="button" onClick={() => navigate("/free-agency")}>
            Back to free agency
          </button>
        </div>
      </header>

      <div className="layout-split">
        <div className="layout-split-main">
          <div className="card" style={{ padding: "1.125rem 1.25rem" }}>
            <DraftBoard
              roster={roster}
              prospects={availableProspects}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onDraft={onDraft}
              recommendedIds={recommendedIds}
              interactionLocked={interactionLocked}
              liveStatusLine={liveStatusLine}
            />
            {draftSimulationComplete ? (
              <div style={{ marginTop: "1rem" }}>
                <button type="button" className="btn btn-primary" onClick={() => resetLiveDraftSession()}>
                  New draft setup
                </button>
                <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.8125rem" }}>
                  Clears this session’s picks from your roster and re-opens pick entry.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="layout-sidebar">
          <div className="card">
            <div className="muted" style={{ fontSize: "0.6875rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Cap space
            </div>
            <div style={{ fontWeight: 650, fontSize: "1.125rem", marginTop: "0.25rem" }}>{money(capSpace)}</div>
          </div>

          <ScoutAssistant gaps={championshipGaps} prospects={availableProspects} />

          <div className="card" style={{ marginTop: "1rem" }}>
            <div style={{ fontWeight: 650, letterSpacing: "-0.02em" }}>Draft log</div>
            <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.8125rem" }}>
              {draftSimulationActive ? `${draftHistory.length} picks recorded` : "Start the draft to see picks."}
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                marginTop: "0.85rem",
                maxHeight: "14rem",
                overflowY: "auto"
              }}
            >
              {draftHistory
                .slice(-12)
                .reverse()
                .map((e) => (
                  <div key={`${e.pickNumber}-${e.prospectId}`} className="row" style={{ justifyContent: "space-between", width: "100%" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{e.prospectName}</div>
                      <div className="muted" style={{ fontSize: "0.72rem", marginTop: "0.12rem" }}>
                        {e.pickedBy === "user" ? "Your pick" : "League"}
                      </div>
                    </div>
                    <span className={`pill ${e.pickedBy === "user" ? "pill-accent" : ""}`}>#{e.pickNumber}</span>
                  </div>
                ))}
            </div>
          </div>

          <div className="card" style={{ marginTop: "1rem" }}>
            <div style={{ fontWeight: 650, letterSpacing: "-0.02em" }}>Your roster picks</div>
            <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.8125rem" }}>
              Players added to your team this sim.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginTop: "0.85rem" }}>
              {draftHistory
                .filter((e) => e.pickedBy === "user")
                .map((e) => {
                  const pl = roster.find((r) => r.id === `draft-${e.prospectId}`);
                  if (!pl) return null;
                  return (
                    <div key={e.prospectId} className="row" style={{ justifyContent: "space-between", width: "100%" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>{pl.name}</div>
                        <div className="muted" style={{ fontSize: "0.75rem", marginTop: "0.15rem" }}>
                          {pl.csvOffensiveArchetype.trim() || pl.csvDefensiveRole.trim()
                            ? `${pl.csvOffensiveArchetype.trim() || "—"} / ${pl.csvDefensiveRole.trim() || "—"}`
                            : `${pl.position} · ${pl.archetype}`}
                        </div>
                      </div>
                      <span className="pill pill-accent">#{e.pickNumber}</span>
                    </div>
                  );
                })}
            </div>
          </div>
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
