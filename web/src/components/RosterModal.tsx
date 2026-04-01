import { useSimulatorStore } from "../store/simulatorStore";
import type { Position, RosterPlayer } from "../types/simulator";

const POSITION_ORDER: Position[] = ["PG", "SG", "SF", "PF", "C"];

function fmt(n: number): string {
  return "$" + (n / 1_000_000).toFixed(1) + "M";
}

interface Props {
  onClose: () => void;
}

export default function RosterModal({ onClose }: Props) {
  const roster = useSimulatorStore((s) => s.roster);

  const byPosition: Record<Position, RosterPlayer[]> = {
    PG: [], SG: [], SF: [], PF: [], C: [],
  };

  for (const p of roster) {
    const pos = p.position as Position;
    if (byPosition[pos]) byPosition[pos].push(p);
  }

  // Sort each group by salary desc
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
              {roster.length} players · by position
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
                  {players.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.625rem",
                        padding: "0.5rem 0",
                        borderBottom: "1px solid var(--color-border-subtle)",
                      }}
                    >
                      {/* Pos chip */}
                      <span className="card-pos" style={{ flexShrink: 0 }}>{p.position}</span>

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
                          {String(p.id).startsWith("draft-") && (
                            <span className="badge badge-rookie" style={{ marginLeft: "0.4rem" }}>
                              Rookie
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--color-text-muted)", marginTop: "0.1rem" }}>
                          <span style={{ color: "var(--color-accent)" }}>{p.offensiveArchetype}</span>
                          {" · "}
                          {p.defensiveRole}
                        </div>
                      </div>

                      {/* Salary */}
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
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
                        {!String(p.id).startsWith("draft-") && (
                          <div style={{ fontSize: "0.62rem", color: "var(--color-text-muted)" }}>
                            Age {p.age}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
