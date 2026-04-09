import { useMemo } from "react";
import { useSmoothNavigate } from "../hooks/useSmoothNavigate";
import { useSimulatorStore, selectPayroll } from "../store/simulatorStore";
import { CHAMPIONSHIP_FORMULA, computeFormulFitScore } from "../data/championshipFormula";
import { findClosestBlueprint, rankAllBlueprints, mapRosterToBlueprint } from "../data/blueprintScore";
import { buildReportCard } from "../data/reportCard";
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
  const navigate = useSmoothNavigate();

  const roster = useSimulatorStore((s) => s.roster);
  const deficits = useSimulatorStore((s) => s.rosterDeficits);
  const selectedTeamId = useSimulatorStore((s) => s.selectedTeamId);
  const payroll = useSimulatorStore(selectPayroll);
  const reset = useSimulatorStore((s) => s.reset);

  const team = TEAMS.find((t) => t.id === selectedTeamId);
  const fitScore = computeFormulFitScore(roster);
  const fitPct = Math.round(fitScore * 100);
  const closestBlueprint = useMemo(() => findClosestBlueprint(roster), [roster]);
  const blueprintRankings = useMemo(() => rankAllBlueprints(roster), [roster]);
  const reportCard = useMemo(() => buildReportCard(roster, payroll, deficits), [roster, payroll, deficits]);
  const playerMappings = useMemo(
    () => closestBlueprint ? mapRosterToBlueprint(roster, closestBlueprint.blueprintId) : [],
    [roster, closestBlueprint]
  );

  function handleReset() {
    reset();
    navigate("/");
  }

  return (
    <div className="page">
      <NavBar />

      <div className="page-content">
        {/* ── Report Card header ── */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div className="report-card">
            {/* Overall grade */}
            <div className="report-card__overall">
              <div
                className="report-card__grade"
                style={{
                  color:
                    reportCard.overall.grade === "A" || reportCard.overall.grade === "B"
                      ? "var(--color-accent)"
                      : reportCard.overall.grade === "C"
                      ? "var(--color-warning)"
                      : "var(--color-danger)",
                }}
              >
                {reportCard.overall.grade}
              </div>
              <div className="report-card__overall-info">
                <div className="report-card__overall-label">Offseason Grade</div>
                <div className="report-card__overall-sub">{reportCard.overall.label} · {reportCard.overall.score}/100</div>
                {team && (
                  <div className="report-card__team-name">
                    {team.city} {team.name} · {roster.length} players
                  </div>
                )}
              </div>
              <div style={{ marginLeft: "auto" }}>
                <button className="btn btn-secondary" onClick={handleReset}>
                  Start Over
                </button>
              </div>
            </div>

            {/* 4 axis rows */}
            <div className="report-card__axes">
              {reportCard.axes.map((ax) => {
                const gradeColor =
                  ax.grade === "A" || ax.grade === "B"
                    ? "var(--color-accent)"
                    : ax.grade === "C"
                    ? "var(--color-warning)"
                    : "var(--color-danger)";
                return (
                  <div key={ax.name} className="report-card__axis-row">
                    <span className="report-card__axis-name">{ax.name}</span>
                    <span className="report-card__axis-grade" style={{ color: gradeColor, borderColor: gradeColor + "55" }}>
                      {ax.grade}
                    </span>
                    <div className="report-card__axis-bar-wrap">
                      <div
                        className="report-card__axis-bar"
                        style={{
                          width: `${ax.score}%`,
                          background: gradeColor,
                        }}
                      />
                    </div>
                    <span className="report-card__axis-note">{ax.note}</span>
                  </div>
                );
              })}
            </div>
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

            {/* ── Blueprint DNA panel ── */}
            {closestBlueprint && (
              <div className="blueprint-panel">
                <div className="blueprint-panel__header">
                  <span className="blueprint-panel__label">Blueprint DNA</span>
                  <span className="blueprint-panel__badge">AI Analysis</span>
                </div>

                {/* Closest match */}
                <div className="blueprint-panel__match">
                  <div className="blueprint-panel__match-score"
                    style={{
                      color: closestBlueprint.score >= 70
                        ? "var(--color-accent)"
                        : closestBlueprint.score >= 45
                        ? "var(--color-warning)"
                        : "var(--color-text-muted)",
                    }}
                  >
                    {closestBlueprint.score}%
                  </div>
                  <div className="blueprint-panel__match-info">
                    <div className="blueprint-panel__match-team">{closestBlueprint.team}</div>
                    <div className="blueprint-panel__match-season">
                      {closestBlueprint.season} · {closestBlueprint.result}
                    </div>
                  </div>
                </div>

                <p className="blueprint-panel__identity">
                  "{closestBlueprint.identitySentence}"
                </p>

                {/* Matched slots */}
                {closestBlueprint.matchedSlotLabels.length > 0 && (
                  <div className="blueprint-panel__slots">
                    <div className="blueprint-panel__slots-label">Shared construction DNA</div>
                    {closestBlueprint.matchedSlotLabels.map((label, i) => (
                      <span key={i} className="blueprint-panel__slot-chip">{label}</span>
                    ))}
                  </div>
                )}

                {/* Citation */}
                {closestBlueprint.citationPrinciple && (
                  <div className="blueprint-panel__citation">
                    <span className="blueprint-panel__citation-icon">💡</span>
                    <span>{closestBlueprint.citationPrinciple}</span>
                  </div>
                )}

                {/* ── Roster vs Blueprint player mapping ── */}
                {playerMappings.filter(m => m.matchType !== "none").length > 0 && (
                  <div className="blueprint-panel__player-map">
                    <div className="blueprint-panel__slots-label" style={{ marginBottom: "0.5rem" }}>
                      Your players vs {closestBlueprint.team}
                    </div>
                    {playerMappings
                      .filter(m => m.matchType !== "none")
                      .sort((a, b) => b.matchStrength - a.matchStrength)
                      .map((m, i) => {
                        const isExact = m.matchType === "exact";
                        const color = isExact
                          ? "var(--color-accent)"
                          : m.matchStrength >= 0.3
                          ? "var(--color-warning)"
                          : "var(--color-text-muted)";
                        const label = isExact ? "✓ Exact" : m.matchType === "partial-off" ? "~ Off. match" : "~ Def. match";
                        return (
                          <div key={i} className="blueprint-panel__player-row">
                            <span className="blueprint-panel__player-name">{m.playerName}</span>
                            <span className="blueprint-panel__player-slot">{m.slotLabel}</span>
                            <span className="blueprint-panel__player-match" style={{ color }}>{label}</span>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* All rankings */}
                {blueprintRankings.length > 1 && (
                  <div className="blueprint-panel__rankings">
                    <div className="blueprint-panel__slots-label" style={{ marginBottom: "0.4rem" }}>
                      All blueprint comparisons
                    </div>
                    {blueprintRankings.map((bp, i) => (
                      <div key={i} className="blueprint-panel__rank-row">
                        <span className="blueprint-panel__rank-team">{bp.team} <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>{bp.season}</span></span>
                        <div className="blueprint-panel__rank-bar-wrap">
                          <div
                            className="blueprint-panel__rank-bar"
                            style={{
                              width: `${bp.score}%`,
                              background: i === 0
                                ? "var(--color-accent)"
                                : "var(--color-border)",
                            }}
                          />
                        </div>
                        <span className="blueprint-panel__rank-pct"
                          style={{ color: i === 0 ? "var(--color-accent)" : "var(--color-text-muted)" }}
                        >
                          {bp.score}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
