import { useState } from "react";
import { useSimulatorStore } from "../store/simulatorStore";
import type { Position, RosterPlayer } from "../types/simulator";
import PlayerAvatar from "./PlayerAvatar";

const POSITION_ORDER: Position[] = ["PG", "SG", "SF", "PF", "C"];

function fmt(n: number): string {
  return "$" + (n / 1_000_000).toFixed(1) + "M";
}

interface Props {
  onClose: () => void;
}

export default function RosterModal({ onClose }: Props) {
  const roster = useSimulatorStore((s) => s.roster);
  const selectedTeamId = useSimulatorStore((s) => s.selectedTeamId);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const byPosition: Record<Position, RosterPlayer[]> = {
    PG: [], SG: [], SF: [], PF: [], C: [],
  };

  for (const p of roster) {
    const pos = p.position as Position;
    if (byPosition[pos]) byPosition[pos].push(p);
  }

  for (const pos of POSITION_ORDER) {
    byPosition[pos].sort((a, b) => b.currentSalary - a.currentSalary);
  }

  const POS_LABELS: Record<Position, string> = {
    PG: "Point Guard",
    SG: "Shooting Guard",
    SF: "Small Forward",
    PF: "Power Forward",
    C: "Center",
  };

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          zIndex: 200,
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(480px, 100vw)",
          background: "var(--color-surface)",
          borderLeft: "1px solid var(--color-border)",
          zIndex: 201,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--color-border)",
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1rem",
                fontWeight: 700,
                letterSpacing: "-0.01em",
              }}
            >
              Current Roster
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", marginTop: "0.1rem" }}>
              {roster.length} players · click a player for details
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "var(--color-surface-raised)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-muted)",
              borderRadius: "6px",
              padding: "0.3rem 0.65rem",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontFamily: "var(--font-body)",
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1, padding: "0.75rem 1.25rem 1.5rem" }}>
          {roster.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--color-text-muted)", padding: "3rem 0", fontSize: "0.85rem" }}>
              No players under contract yet.
            </div>
          ) : (
            POSITION_ORDER.map((pos) => {
              const players = byPosition[pos];
              if (players.length === 0) return null;
              return (
                <div key={pos} style={{ marginBottom: "1.25rem" }}>
                  {/* Position group header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "0.5rem",
                      paddingBottom: "0.4rem",
                      borderBottom: "1px solid var(--color-border)",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "0.62rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {POS_LABELS[pos]}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "0.62rem",
                        fontWeight: 700,
                        background: "var(--color-border)",
                        color: "var(--color-text-muted)",
                        padding: "0.1rem 0.4rem",
                        borderRadius: "10px",
                      }}
                    >
                      {players.length}
                    </span>
                  </div>

                  {/* Players */}
                  {players.map((p) => {
                    const isExpanded = expandedId === p.id;
                    const isRookie = String(p.id).startsWith("draft-");
                    const bpmColor =
                      p.stats.bpm >= 3
                        ? "var(--color-accent)"
                        : p.stats.bpm < 0
                        ? "var(--color-danger)"
                        : "var(--color-text-muted)";

                    return (
                      <div key={p.id} className="roster-modal-row">
                        {/* Main row */}
                        <div
                          className="roster-modal-row__main"
                          onClick={() => toggleExpand(p.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === "Enter" && toggleExpand(p.id)}
                        >
                          {/* Avatar */}
                          <PlayerAvatar
                            name={p.name}
                            position={p.position}
                            size={36}
                            headshotPool={isRookie ? "prospect" : "nba"}
                            teamId={p.teamAbbrev || selectedTeamId}
                          />

                          {/* Name + archetype */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontFamily: "var(--font-display)",
                                fontSize: "0.85rem",
                                fontWeight: 600,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {p.name}
                              {isRookie && (
                                <span className="badge badge-rookie" style={{ marginLeft: "0.4rem" }}>
                                  Rookie
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "0.68rem", color: "var(--color-text-muted)", marginTop: "0.1rem" }}>
                              <span style={{ color: "var(--color-accent)" }}>{p.offensiveArchetype}</span>
                            </div>
                          </div>

                          {/* Salary + expand chevron */}
                          <div style={{ textAlign: "right", flexShrink: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <div>
                              <div
                                style={{
                                  fontFamily: "var(--font-display)",
                                  fontSize: "0.82rem",
                                  fontWeight: 700,
                                  color: "var(--color-text-secondary)",
                                }}
                              >
                                {fmt(p.currentSalary)}
                              </div>
                              {!isRookie && (
                                <div style={{ fontSize: "0.62rem", color: "var(--color-text-muted)" }}>
                                  Age {p.age}
                                </div>
                              )}
                            </div>
                            <span
                              style={{
                                fontSize: "0.6rem",
                                color: "var(--color-text-muted)",
                                transition: "transform 0.2s",
                                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                                display: "inline-block",
                              }}
                            >
                              ▾
                            </span>
                          </div>
                        </div>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div className="roster-modal-row__expand">
                            <div className="roster-modal-expand__role">
                              {p.defensiveRole}
                            </div>
                            {!isRookie && (
                              <div className="roster-modal-expand__stats">
                                <div className="roster-modal-expand__stat">
                                  <span className="roster-modal-expand__val">{p.stats.pts.toFixed(1)}</span>
                                  <span className="roster-modal-expand__lbl">PTS</span>
                                </div>
                                <div className="roster-modal-expand__stat">
                                  <span className="roster-modal-expand__val">{p.stats.trb.toFixed(1)}</span>
                                  <span className="roster-modal-expand__lbl">REB</span>
                                </div>
                                <div className="roster-modal-expand__stat">
                                  <span className="roster-modal-expand__val">{p.stats.ast.toFixed(1)}</span>
                                  <span className="roster-modal-expand__lbl">AST</span>
                                </div>
                                <div className="roster-modal-expand__stat">
                                  <span className="roster-modal-expand__val" style={{ color: bpmColor }}>
                                    {p.stats.bpm >= 0 ? "+" : ""}{p.stats.bpm.toFixed(1)}
                                  </span>
                                  <span className="roster-modal-expand__lbl">BPM</span>
                                </div>
                              </div>
                            )}
                            <div className="roster-modal-expand__market">
                              Est. Market: <strong>{fmt(p.estimatedMarketSalary)}</strong>
                              <span style={{ opacity: 0.55, fontSize: "0.6rem", marginLeft: "0.3rem" }}>AI estimate</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
