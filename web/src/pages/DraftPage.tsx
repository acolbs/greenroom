import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSimulatorStore, selectCurrentUserPick } from "../store/simulatorStore";
import {
  rankProspectsForTeam,
  getSmartRecommendation,
} from "../data/prospectRanking";
import type { RankedProspect, TeamStrength } from "../data/prospectRanking";
import { TEAMS } from "../data/constants";
import type { DraftProspect } from "../types/simulator";
import NavBar from "../components/NavBar";
import PlayerAvatar from "../components/PlayerAvatar";
import ScoutChat from "../components/ScoutChat";

// ── Draft setup screen ─────────────────────────────────────────────────────

function DraftSetup() {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const setUserPickNumbers = useSimulatorStore((s) => s.setUserPickNumbers);
  const startDraftSimulation = useSimulatorStore((s) => s.startDraftSimulation);
  const userPickNumbers = useSimulatorStore((s) => s.userPickNumbers);

  function handleSubmit() {
    setError(null);
    const raw = input
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const nums = raw.map(Number);

    if (nums.some(isNaN)) {
      setError("Enter numbers only, separated by commas.");
      return;
    }

    const err = setUserPickNumbers(nums);
    if (err) { setError(err); return; }
    startDraftSimulation();
  }

  return (
    <div className="draft-setup">
      <h2>Set Up Draft</h2>
      <p className="draft-setup-desc">
        Enter the pick numbers your team owns (e.g. <strong>15, 45, 75</strong>
        ). The draft has 90 total picks across 3 rounds. CPU teams will auto-pick
        all other slots.
      </p>

      <input
        type="text"
        placeholder="e.g. 15, 45, 75"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
      />

      {error && <div className="draft-setup-error">{error}</div>}

      {userPickNumbers.length > 0 && (
        <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
          Your picks: {userPickNumbers.join(", ")}
        </div>
      )}

      <button className="btn btn-primary" onClick={handleSubmit}>
        Start Draft
      </button>
    </div>
  );
}

// ── Prospect row ───────────────────────────────────────────────────────────

type DraftTab = "bigboard" | "needs";

interface ProspectRowProps {
  prospect: RankedProspect;
  isRecommended: boolean;
  isUserTurn: boolean;
  tab: DraftTab;
  onDraft: (id: string) => void;
}

function ProspectRow({ prospect, isRecommended, isUserTurn, tab, onDraft }: ProspectRowProps) {
  return (
    <div
      className={`draft-card${isRecommended ? " draft-card--recommended" : ""}`}
    >
      <div className="draft-card__photo-wrap">
        <span className="draft-card__rank-badge">#{prospect.rank}</span>
        <PlayerAvatar
          name={prospect.name}
          position={prospect.position}
          size={88}
          headshotPool="prospect"
          school={prospect.school}
        />
      </div>

      <div className="draft-card__name-block">
        <div className="draft-card__name">{prospect.name}</div>
        {isRecommended ? (
          <span className="draft-card__scout-tag">★ Scout</span>
        ) : null}
      </div>
      <div className="draft-card__meta">
        {prospect.school}
        <span className="draft-card__meta-dot"> · </span>
        <span className="draft-card__meta-arch">{prospect.offensiveArchetype}</span>
      </div>

      <div className="draft-card__footer">
        <div className="draft-card__metric">
          <span className="draft-card__metric-label">
            {tab === "bigboard" ? "Scout rank" : "Needs fit"}
          </span>
          <span
            className="draft-card__metric-val"
            style={{
              color:
                tab === "needs" ? "var(--color-accent)" : "var(--color-text-secondary)",
            }}
          >
            {tab === "bigboard" ? prospect.rank : prospect.needsScore}
          </span>
        </div>
        {isUserTurn ? (
          <button type="button" className="btn btn-primary draft-card__draft-btn" onClick={() => onDraft(prospect.id)}>
            Draft
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ── Team strength badge ─────────────────────────────────────────────────────

function TeamStrengthBadge({ ts }: { ts: TeamStrength }) {
  const color =
    ts.label === "Contender"
      ? "var(--color-accent)"
      : ts.label === "Middle"
      ? "#d4a017"
      : "var(--color-danger)";

  return (
    <span
      style={{
        fontSize: "0.65rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color,
        border: `1px solid ${color}`,
        borderRadius: "4px",
        padding: "0.1rem 0.4rem",
      }}
    >
      {ts.label}
    </span>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function DraftPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DraftTab>("bigboard");

  const draftSimActive = useSimulatorStore((s) => s.draftSimActive);
  const draftSimComplete = useSimulatorStore((s) => s.draftSimComplete);
  const draftCurrentPick = useSimulatorStore((s) => s.draftCurrentPick);
  const draftTotalPicks = useSimulatorStore((s) => s.draftTotalPicks);
  const userPickNumbers = useSimulatorStore((s) => s.userPickNumbers);
  const available = useSimulatorStore((s) => s.draftAvailableProspects);
  const draftClass = useSimulatorStore((s) => s.draftClass);
  const history = useSimulatorStore((s) => s.draftHistory);
  const deficits = useSimulatorStore((s) => s.rosterDeficits);
  const teamStrength = useSimulatorStore((s) => s.teamStrength);
  const selectedTeamId = useSimulatorStore((s) => s.selectedTeamId);
  const roster = useSimulatorStore((s) => s.roster);
  const userDraftPick = useSimulatorStore((s) => s.userDraftPick);
  const advanceToPhase = useSimulatorStore((s) => s.advanceToPhase);

  const currentUserPick = useSimulatorStore(selectCurrentUserPick);
  const isUserTurn = currentUserPick !== null;

  // Rank all available prospects
  const ranked = draftSimActive
    ? rankProspectsForTeam(available, deficits, teamStrength)
    : [];

  // Big Board: original CSV scout ranking (rank ascending)
  const bigBoard = [...ranked].sort((a, b) => a.rank - b.rank);

  // Team Needs: our blended needs score (needsScore descending)
  const needsBoard = [...ranked].sort((a, b) => b.needsScore - a.needsScore);

  const displayedProspects =
    activeTab === "bigboard" ? bigBoard : needsBoard;

  const recommendation = draftSimActive
    ? getSmartRecommendation(available, deficits, teamStrength)
    : null;

  function handleDraft(prospectId: string) {
    userDraftPick(prospectId);
  }

  function handleFinish() {
    advanceToPhase("COMPLETE");
    navigate("/roster-summary");
  }

  // Show setup if draft hasn't started
  if (!draftSimActive && !draftSimComplete) {
    return (
      <div className="page">
        <NavBar />
        <div className="page-content">
          <DraftSetup />
        </div>
      </div>
    );
  }

  const round = Math.ceil(draftCurrentPick / 30);
  const pickInRound = ((draftCurrentPick - 1) % 30) + 1;

  return (
    <div className="page">
      <NavBar />

      <div className="page-content">
        {/* Pick indicator */}
        {!draftSimComplete && (
          <div className={`pick-indicator${isUserTurn ? " user-pick" : ""}`}>
            <div>
              <div className="pick-num">{draftCurrentPick}</div>
              <div className="pick-label">
                Round {round}, Pick {pickInRound}
              </div>
            </div>
            <div>
              <div className={`pick-status${isUserTurn ? " yours" : ""}`}>
                {isUserTurn ? "Your pick" : "CPU picking…"}
              </div>
              <div className="pick-label">
                Your picks: {userPickNumbers.join(", ")}
              </div>
            </div>
          </div>
        )}

        {draftSimComplete && (
          <div
            style={{
              padding: "0.75rem 1rem",
              background: "#0a1a0d",
              border: "1px solid var(--color-accent)",
              borderRadius: "8px",
              marginBottom: "1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontWeight: 700, color: "var(--color-accent)" }}>
              Draft complete — {draftTotalPicks} picks made.
            </span>
            <button className="btn btn-primary" onClick={handleFinish}>
              View Roster Summary →
            </button>
          </div>
        )}

        <div className="split-layout">
          {/* ── Left: draft board with tabs ── */}
          <div>
            {/* Tab bar */}
            <div
              style={{
                display: "flex",
                gap: "0",
                marginBottom: "0.75rem",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              {(["bigboard", "needs"] as DraftTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    background: "none",
                    border: "none",
                    borderBottom: activeTab === tab
                      ? "2px solid var(--color-accent)"
                      : "2px solid transparent",
                    color: activeTab === tab
                      ? "var(--color-text)"
                      : "var(--color-text-muted)",
                    cursor: "pointer",
                    fontSize: "0.78rem",
                    fontWeight: activeTab === tab ? 700 : 400,
                    padding: "0.5rem 1rem",
                    marginBottom: "-1px",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  {tab === "bigboard" ? "Big Board" : "Team Needs"}
                </button>
              ))}

              {/* Column label on right */}
              <div
                style={{
                  marginLeft: "auto",
                  fontSize: "0.65rem",
                  color: "var(--color-text-muted)",
                  alignSelf: "center",
                  paddingRight: "0.5rem",
                }}
              >
                {activeTab === "bigboard" ? "SCOUT RANK" : "NEEDS SCORE"}
              </div>
            </div>

            <div className="draft-board">
              {displayedProspects.length === 0 ? (
                <div className="empty-state">No prospects remaining.</div>
              ) : (
                displayedProspects.slice(0, 30).map((p) => (
                  <ProspectRow
                    key={p.id}
                    prospect={p}
                    isRecommended={recommendation?.prospect.id === p.id}
                    isUserTurn={isUserTurn}
                    tab={activeTab}
                    onDraft={handleDraft}
                  />
                ))
              )}
            </div>
          </div>

          {/* ── Right: Scout Chat + history ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Scout Chat AI */}
            {draftSimActive && (
              <ScoutChat
                recommendation={recommendation}
                available={available}
                deficits={deficits}
                teamStrength={teamStrength}
                roster={roster}
              />
            )}
            {/* Draft history */}
            <div
              style={{
                background: "var(--color-surface-raised)",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
                padding: "1rem",
                maxHeight: "400px",
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "var(--color-text-muted)",
                  marginBottom: "0.5rem",
                }}
              >
                Draft History
              </div>
              {history.length === 0 ? (
                <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>
                  No picks yet.
                </div>
              ) : (
                [...history].reverse().map((entry) => {
                  const teamName =
                    TEAMS.find((t) => t.id === entry.pickedBy)?.name ??
                    entry.pickedBy;
                  const isUser = entry.pickedBy === selectedTeamId;
                  const prospect = draftClass.find((p) => p.id === entry.prospectId);

                  return (
                    <div key={entry.pickNumber} className="history-row">
                      <span className="history-pick-num">#{entry.pickNumber}</span>
                      <span className={`history-name${isUser ? " history-user" : ""}`}>
                        {prospect?.name ?? entry.prospectId}
                      </span>
                      <span className="history-team">
                        {isUser ? "You" : teamName}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
