import { useState, useRef, useEffect } from "react";
import { useSmoothNavigate } from "../hooks/useSmoothNavigate";
import { useSimulatorStore, selectCurrentUserPick } from "../store/simulatorStore";
import {
  rankProspectsForTeam,
  getSmartRecommendation,
} from "../data/prospectRanking";
import type { RankedProspect } from "../data/prospectRanking";
import { TEAMS } from "../data/constants";
import type { DraftProspect, Position } from "../types/simulator";
import NavBar from "../components/NavBar";
import PlayerAvatar from "../components/PlayerAvatar";
import ScoutChat from "../components/ScoutChat";
import DraftAdvisorBanner from "../components/DraftAdvisorBanner";
import PlayerDetailModal from "../components/PlayerDetailModal";
import TeamLogo from "../components/TeamLogo";
import Tooltip from "../components/Tooltip";

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
        ). The draft has 60 total picks across 2 rounds. CPU teams will auto-pick
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

// ── Horizontal pick history strip ──────────────────────────────────────────

interface PickStripProps {
  history: { pickNumber: number; prospectId: string; pickedBy: string }[];
  draftClass: DraftProspect[];
  selectedTeamId: string | null;
}

function PickStrip({ history, draftClass, selectedTeamId }: PickStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [history.length]);

  if (history.length === 0) return null;

  return (
    <div className="pick-strip-wrap">
      <div className="pick-strip-label">Pick History</div>
      <div className="pick-strip" ref={scrollRef}>
        {history.map((entry) => {
          const prospect = draftClass.find((p) => p.id === entry.prospectId);
          const isUser = entry.pickedBy === selectedTeamId;
          const team = TEAMS.find((t) => t.id === entry.pickedBy);

          return (
            <div
              key={entry.pickNumber}
              className={`pick-strip__item${isUser ? " pick-strip__item--user" : ""}`}
              title={`#${entry.pickNumber} · ${prospect?.name ?? "Unknown"} · ${isUser ? "You" : team?.name ?? entry.pickedBy}`}
            >
              <span className="pick-strip__num">#{entry.pickNumber}</span>
              <PlayerAvatar
                name={prospect?.name ?? "?"}
                position={prospect?.position ?? "PG"}
                size={40}
                headshotPool="prospect"
                school={prospect?.school}
              />
              {team && (
                <div className="pick-strip__logo">
                  <TeamLogo teamId={team.id} size={16} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Prospect row ───────────────────────────────────────────────────────────

type DraftTab = "bigboard" | "needs";
type GradeFilter = "ALL" | "ELITE" | "HIGH" | "MID" | "DEV";

interface ProspectRowProps {
  prospect: RankedProspect;
  isRecommended: boolean;
  isUserTurn: boolean;
  tab: DraftTab;
  onDraft: (id: string) => void;
  onOpen: (p: DraftProspect) => void;
}

function ProspectRow({
  prospect,
  isRecommended,
  isUserTurn,
  tab,
  onDraft,
  onOpen,
}: ProspectRowProps) {
  return (
    <div
      className={`draft-card${isRecommended ? " draft-card--recommended" : ""}`}
      onClick={() => onOpen(prospect)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpen(prospect)}
      style={{ cursor: "pointer" }}
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
          <Tooltip
            text={
              tab === "bigboard"
                ? "Overall scout ranking — lower number = better prospect (1 = top of class)"
                : "How well this prospect fills your team's biggest positional and archetype gaps. Higher = better fit."
            }
          >
            <span className="draft-card__metric-label">
              {tab === "bigboard" ? "Scout rank" : "Needs fit"}
            </span>
          </Tooltip>
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
          <button
            type="button"
            className="btn btn-primary draft-card__draft-btn"
            onClick={(e) => { e.stopPropagation(); onDraft(prospect.id); }}
          >
            Draft
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ── Filter bar ─────────────────────────────────────────────────────────────

const GRADE_FILTER_LABELS: Record<GradeFilter, string> = {
  ALL: "All Grades",
  ELITE: "Elite 90+",
  HIGH: "High 80s",
  MID: "Mid 70s",
  DEV: "Dev <70",
};

function gradeMatchesFilter(grade: number, filter: GradeFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "ELITE") return grade >= 90;
  if (filter === "HIGH") return grade >= 80 && grade < 90;
  if (filter === "MID") return grade >= 70 && grade < 80;
  if (filter === "DEV") return grade < 70;
  return true;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function DraftPage() {
  const navigate = useSmoothNavigate();
  const [activeTab, setActiveTab] = useState<DraftTab>("bigboard");
  const [detailProspect, setDetailProspect] = useState<DraftProspect | null>(null);
  const [posFilter, setPosFilter] = useState<Position | "ALL">("ALL");
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>("ALL");

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

  // Which CPU team is on the clock right now
  const cpuTeam = !isUserTurn && draftSimActive
    ? TEAMS[(draftCurrentPick - 1) % 30]
    : null;

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

  // Apply filters
  const filteredProspects = displayedProspects.filter((p) => {
    if (posFilter !== "ALL" && p.position !== posFilter) return false;
    if (!gradeMatchesFilter(p.grade, gradeFilter)) return false;
    return true;
  });

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
      <PlayerDetailModal
        subject={detailProspect}
        onClose={() => setDetailProspect(null)}
        teamId={selectedTeamId}
      />
      <NavBar />

      <div className="page-content">

        {/* ── Full-width pick history strip ── */}
        {draftSimActive && (
          <PickStrip
            history={history}
            draftClass={draftClass}
            selectedTeamId={selectedTeamId}
          />
        )}

        {/* ── Scout AI advisor banner ── */}
        {draftSimActive && !draftSimComplete && (
          <DraftAdvisorBanner
            recommendation={recommendation}
            deficits={deficits}
            teamStrength={teamStrength}
            roster={roster}
            isUserTurn={isUserTurn}
            isCpuPicking={!isUserTurn}
          />
        )}

        {/* ── Pick indicator / CPU banner ── */}
        {!draftSimComplete && (
          isUserTurn ? (
            <div className="pick-indicator user-pick">
              <div>
                <div className="pick-num">{draftCurrentPick}</div>
                <div className="pick-label">
                  Round {round}, Pick {pickInRound}
                </div>
              </div>
              <div>
                <div className="pick-status yours">Your pick</div>
                <div className="pick-label">
                  Your picks: {userPickNumbers.join(", ")}
                </div>
              </div>
            </div>
          ) : (
            <div className="cpu-banner">
              {cpuTeam && (
                <div className="cpu-banner__logo">
                  <TeamLogo teamId={cpuTeam.id} size={32} />
                </div>
              )}
              <div className="cpu-banner__info">
                <div className="cpu-banner__team">
                  {cpuTeam ? `${cpuTeam.city} ${cpuTeam.name}` : "CPU"}
                </div>
                <div className="cpu-banner__status">CPU is picking…</div>
              </div>
              <div className="cpu-banner__pick">
                <div className="pick-num" style={{ fontSize: "1.3rem" }}>{draftCurrentPick}</div>
                <div className="pick-label">Round {round}, Pick {pickInRound}</div>
              </div>
              <div style={{ marginLeft: "auto", fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
                Your picks: {userPickNumbers.join(", ")}
              </div>
            </div>
          )
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
          {/* ── Left: draft board with filters + tabs ── */}
          <div>
            {/* Filter bar */}
            {draftSimActive && (
              <div className="filter-bar">
                <div className="filter-group">
                  {(["ALL", "PG", "SG", "SF", "PF", "C"] as const).map((pos) => (
                    <button
                      key={pos}
                      className={`filter-chip${posFilter === pos ? " filter-chip--active" : ""}`}
                      onClick={() => setPosFilter(pos)}
                    >
                      {pos === "ALL" ? "All" : pos}
                    </button>
                  ))}
                </div>
                <div className="filter-group">
                  {(["ALL", "ELITE", "HIGH", "MID", "DEV"] as GradeFilter[]).map((g) => (
                    <button
                      key={g}
                      className={`filter-chip${gradeFilter === g ? " filter-chip--active" : ""}`}
                      onClick={() => setGradeFilter(g)}
                    >
                      {GRADE_FILTER_LABELS[g]}
                    </button>
                  ))}
                </div>
                {(posFilter !== "ALL" || gradeFilter !== "ALL") && (
                  <span style={{ fontSize: "0.68rem", color: "var(--color-text-muted)", alignSelf: "center" }}>
                    {filteredProspects.length} shown
                  </span>
                )}
              </div>
            )}

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
              {filteredProspects.length === 0 ? (
                <div className="empty-state">
                  {displayedProspects.length === 0
                    ? "No prospects remaining."
                    : "No prospects match the current filters."}
                </div>
              ) : (
                filteredProspects.map((p) => (
                  <ProspectRow
                    key={p.id}
                    prospect={p}
                    isRecommended={recommendation?.prospect.id === p.id}
                    isUserTurn={isUserTurn}
                    tab={activeTab}
                    onDraft={handleDraft}
                    onOpen={setDetailProspect}
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
            {/* Draft history (vertical, right panel) */}
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

