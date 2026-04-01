import { useNavigate } from "react-router-dom";
import { useSimulatorStore, selectPayroll } from "../store/simulatorStore";
import { CHAMPIONSHIP_FORMULA, computeFormulFitScore } from "../data/championshipFormula";
import { TEAMS } from "../data/constants";
import NavBar from "../components/NavBar";
import CapBar from "../components/CapBar";

function fmt(n: number): string {
  return "$" + (n / 1_000_000).toFixed(1) + "M";
}

function countForSlot(
  roster: ReturnType<typeof useSimulatorStore.getState>["roster"],
  oa: string,
  dr: string
): number {
  return roster.filter(
    (p) => p.offensiveArchetype === oa && p.defensiveRole === dr
  ).length;
}

export default function RosterSummaryPage() {
  const navigate = useNavigate();

  const roster = useSimulatorStore((s) => s.roster);
  const deficits = useSimulatorStore((s) => s.rosterDeficits);
  const selectedTeamId = useSimulatorStore((s) => s.selectedTeamId);
  const payroll = useSimulatorStore(selectPayroll);
  const reset = useSimulatorStore((s) => s.reset);

  const team = TEAMS.find((t) => t.id === selectedTeamId);
  const fitScore = computeFormulFitScore(roster);
  const fitPct = Math.round(fitScore * 100);

  function handleReset() {
    reset();
    navigate("/");
  }

  return (
    <div className="page">
      <NavBar />

      <div className="page-content">
        <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "flex-end", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <div className="summary-fit-label">Championship Formula Fit</div>
            <div
              className="summary-fit-score"
              style={{
                color:
                  fitPct >= 70
                    ? "var(--color-accent)"
                    : fitPct >= 45
                    ? "var(--color-warning)"
                    : "var(--color-danger)",
              }}
            >
              {fitPct}%
            </div>
          </div>

          {team && (
            <div style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
              {team.city} {team.name} · {roster.length} players
            </div>
          )}

          <div style={{ marginLeft: "auto" }}>
            <button className="btn btn-secondary" onClick={handleReset}>
              Start Over
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 360px",
            gap: "1.5rem",
            alignItems: "start",
          }}
        >
          {/* ── Left: roster table ── */}
          <div>
            <div style={{ marginBottom: "1.5rem" }}>
              <CapBar payroll={payroll} />
            </div>

            <div className="section-header">
              <span className="section-title">Final Roster</span>
              <span className="section-count">({roster.length} players)</span>
            </div>

            <table className="summary-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Pos</th>
                  <th>Offensive Archetype</th>
                  <th>Defensive Role</th>
                  <th style={{ textAlign: "right" }}>Salary</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500 }}>
                      {p.name}
                      {String(p.id).startsWith("draft-") && (
                        <span
                          className="badge badge-rookie"
                          style={{ marginLeft: "0.4rem" }}
                        >
                          Rookie
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="card-pos">{p.position}</span>
                    </td>
                    <td style={{ color: "var(--color-accent)", fontSize: "0.78rem" }}>
                      {p.offensiveArchetype}
                    </td>
                    <td style={{ color: "var(--color-text-muted)", fontSize: "0.78rem" }}>
                      {p.defensiveRole}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: 600,
                      }}
                    >
                      {fmt(p.currentSalary)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Right: formula analysis ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Formula slots */}
            <div
              style={{
                background: "var(--color-surface-raised)",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
                padding: "1rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "var(--color-text-muted)",
                  marginBottom: "0.75rem",
                }}
              >
                Championship Formula
              </div>

              <div className="formula-grid">
                {CHAMPIONSHIP_FORMULA.slots.map((slot, i) => {
                  const current = countForSlot(
                    roster,
                    slot.offensiveArchetype,
                    slot.defensiveRole
                  );
                  const met = current >= slot.target;

                  return (
                    <div key={i} className="formula-row">
                      <span className="formula-icon">
                        {met ? (
                          <span style={{ color: "var(--color-accent)" }}>✓</span>
                        ) : (
                          <span style={{ color: "var(--color-danger)" }}>✗</span>
                        )}
                      </span>
                      <span className={`formula-archetypes${met ? " met" : ""}`}>
                        {slot.offensiveArchetype}
                        <span style={{ color: "var(--color-border)", margin: "0 0.25rem" }}>/</span>
                        {slot.defensiveRole}
                        <span
                          style={{
                            display: "block",
                            fontSize: "0.65rem",
                            color: "var(--color-text-muted)",
                            marginTop: "0.05rem",
                          }}
                        >
                          {(slot.weight * 100).toFixed(0)}% weight
                        </span>
                      </span>
                      <span className={`formula-progress${met ? " met" : " unmet"}`}>
                        {current}/{slot.target}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Deficits summary */}
            {deficits.length === 0 ? (
              <div
                style={{
                  background: "#0a1a0d",
                  border: "1px solid var(--color-accent)",
                  borderRadius: "8px",
                  padding: "1rem",
                  textAlign: "center",
                  color: "var(--color-accent)",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                }}
              >
                All formula slots filled. Championship ready.
              </div>
            ) : (
              <div
                style={{
                  background: "var(--color-surface-raised)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                  padding: "1rem",
                }}
              >
                <div
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "var(--color-text-muted)",
                    marginBottom: "0.625rem",
                  }}
                >
                  Remaining Deficits ({deficits.length})
                </div>
                {deficits.map((d, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      fontSize: "0.78rem",
                      padding: "0.375rem 0",
                      borderBottom:
                        i < deficits.length - 1
                          ? "1px solid var(--color-border)"
                          : "none",
                    }}
                  >
                    <div>
                      <div>
                        {d.offensiveArchetype} / {d.defensiveRole}
                      </div>
                      <div
                        style={{
                          fontSize: "0.68rem",
                          color: "var(--color-text-muted)",
                        }}
                      >
                        {(d.weight * 100).toFixed(0)}% weighted slot
                      </div>
                    </div>
                    <span
                      style={{
                        color: "var(--color-danger)",
                        fontWeight: 700,
                        fontSize: "0.85rem",
                      }}
                    >
                      -{d.gap}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
