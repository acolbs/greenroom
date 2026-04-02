import { useNavigate } from "react-router-dom";
import { useSimulatorStore, selectPayroll } from "../store/simulatorStore";
import type { ExpiringContract, FreeAgencyDecision } from "../types/simulator";
import NavBar from "../components/NavBar";
import CapBar from "../components/CapBar";
import PlayerAvatar from "../components/PlayerAvatar";

function fmt(n: number): string {
  return "$" + (n / 1_000_000).toFixed(1) + "M";
}

function StatPill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "0.1rem",
      minWidth: "2.75rem",
    }}>
      <span style={{
        fontFamily: "var(--font-display)",
        fontSize: "0.82rem",
        fontWeight: 700,
        color: accent ? "var(--color-accent)" : "var(--color-text)",
      }}>
        {value}
      </span>
      <span style={{ fontSize: "0.6rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </span>
    </div>
  );
}

interface ContractCardProps {
  contract: ExpiringContract;
  decision: FreeAgencyDecision | undefined;
  onDecide: (d: FreeAgencyDecision) => void;
}

function ContractCard({ contract, decision, onDecide }: ContractCardProps) {
  const isClub = contract.optionType === "Club";
  const decided = decision !== undefined;

  const bpmColor =
    contract.stats.bpm >= 3
      ? "var(--color-accent)"
      : contract.stats.bpm < 0
      ? "var(--color-danger)"
      : "var(--color-text-muted)";

  return (
    <div style={{
      background: decided ? "var(--color-surface)" : "var(--color-surface-raised)",
      border: `1px solid ${decided ? "var(--color-border-subtle)" : "var(--color-border)"}`,
      borderRadius: "12px",
      padding: "1rem",
      marginBottom: "0.5rem",
      opacity: decided ? 0.65 : 1,
      transition: "opacity 0.2s, border-color 0.2s",
    }}>
      {/* Top row: avatar + name + badges + salary */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem", marginBottom: "0.75rem" }}>
        <PlayerAvatar name={contract.name} position={contract.position} size={46} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
            <span style={{
              fontFamily: "var(--font-display)",
              fontSize: "0.95rem",
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}>{contract.name}</span>
            <span className="card-pos">{contract.position}</span>
            {isClub && <span className="badge badge-club-opt">Club Option</span>}
            {contract.optionType === "Player" && contract.playerOptedOut && (
              <span className="badge badge-opted-out">Opted Out</span>
            )}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", marginTop: "0.2rem" }}>
            Age {contract.age} · <span style={{ color: "var(--color-accent)" }}>{contract.offensiveArchetype}</span>
            {" · "}{contract.defensiveRole}
          </div>
        </div>

        {/* Salary stack */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "0.62rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.15rem" }}>
            {isClub ? "Option" : "Market"}
          </div>
          <div style={{
            fontFamily: "var(--font-display)",
            fontSize: "0.95rem",
            fontWeight: 700,
            color: "var(--color-accent)",
          }}>
            {isClub && contract.optionSalary ? fmt(contract.optionSalary) : fmt(contract.estimatedMarketSalary)}
          </div>
          <div style={{ fontSize: "0.68rem", color: "var(--color-text-muted)" }}>
            {fmt(contract.currentSalary)} current
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: "flex",
        gap: "0.25rem",
        padding: "0.5rem 0.625rem",
        background: "var(--color-surface)",
        borderRadius: "8px",
        marginBottom: "0.75rem",
        flexWrap: "wrap",
      }}>
        <StatPill label="PTS" value={contract.stats.pts.toFixed(1)} />
        <div style={{ width: 1, background: "var(--color-border)", margin: "0.1rem 0.25rem" }} />
        <StatPill label="REB" value={contract.stats.trb.toFixed(1)} />
        <div style={{ width: 1, background: "var(--color-border)", margin: "0.1rem 0.25rem" }} />
        <StatPill label="AST" value={contract.stats.ast.toFixed(1)} />
        <div style={{ width: 1, background: "var(--color-border)", margin: "0.1rem 0.25rem" }} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.1rem", minWidth: "2.75rem" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "0.82rem", fontWeight: 700, color: bpmColor }}>
            {contract.stats.bpm >= 0 ? "+" : ""}{contract.stats.bpm.toFixed(1)}
          </span>
          <span style={{ fontSize: "0.6rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>BPM</span>
        </div>
        <div style={{ width: 1, background: "var(--color-border)", margin: "0.1rem 0.25rem" }} />
        <StatPill label="TS%" value={(contract.stats.tsPct * 100).toFixed(1)} />
      </div>

      {/* Decision */}
      {decided ? (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          fontSize: "0.78rem",
          color: decision === "RE_SIGN" || decision === "PICK_UP_OPTION" ? "var(--color-accent)" : "var(--color-text-muted)",
          fontWeight: 600,
        }}>
          <span>{decision === "RE_SIGN" || decision === "PICK_UP_OPTION" ? "✓" : "✗"}</span>
          <span>
            {decision === "RE_SIGN" && "Re-signed"}
            {decision === "LET_WALK" && "Let walk"}
            {decision === "PICK_UP_OPTION" && "Option picked up"}
            {decision === "DECLINE_OPTION" && "Option declined"}
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {isClub ? (
            <>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onDecide("PICK_UP_OPTION")}>
                Pick Up · {contract.optionSalary ? fmt(contract.optionSalary) : "—"}
              </button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => onDecide("DECLINE_OPTION")}>
                Decline Option
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onDecide("RE_SIGN")}>
                Re-Sign · {fmt(contract.estimatedMarketSalary)}
              </button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => onDecide("LET_WALK")}>
                Let Walk
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function FreeAgencyPage() {
  const navigate = useNavigate();
  const roster = useSimulatorStore((s) => s.roster);
  const expiring = useSimulatorStore((s) => s.expiringContracts);
  const decisions = useSimulatorStore((s) => s.decisions);
  const makeFreeAgencyDecision = useSimulatorStore((s) => s.makeFreeAgencyDecision);
  const advanceToPhase = useSimulatorStore((s) => s.advanceToPhase);
  const payroll = useSimulatorStore(selectPayroll);

  const clubOptions = expiring.filter((c) => c.optionType === "Club");
  const freeAgents = expiring.filter((c) => c.optionType !== "Club");
  const pendingCount = expiring.filter((c) => decisions[c.playerId] === undefined).length;

  function handleAdvanceToDraft() {
    advanceToPhase("DRAFT");
    navigate("/draft");
  }

  return (
    <div className="page">
      <NavBar />

      <div className="page-content">
        <div className="split-layout">

          {/* ── Left: decisions ── */}
          <div>
            {clubOptions.length > 0 && (
              <div style={{ marginBottom: "1.75rem" }}>
                <div className="section-header">
                  <span className="section-title">Club Options</span>
                  <span className="section-count">
                    ({clubOptions.filter((c) => !decisions[c.playerId]).length} pending)
                  </span>
                </div>
                {clubOptions.map((c) => (
                  <ContractCard
                    key={c.playerId}
                    contract={c}
                    decision={decisions[c.playerId]}
                    onDecide={(d) => makeFreeAgencyDecision(c.playerId, d)}
                  />
                ))}
              </div>
            )}

            <div>
              <div className="section-header">
                <span className="section-title">Free Agents</span>
                <span className="section-count">
                  ({freeAgents.length} · {freeAgents.filter((c) => !decisions[c.playerId]).length} pending)
                </span>
              </div>
              {freeAgents.length === 0 ? (
                <div className="empty-state">No free agents for this team.</div>
              ) : (
                freeAgents.map((c) => (
                  <ContractCard
                    key={c.playerId}
                    contract={c}
                    decision={decisions[c.playerId]}
                    onDecide={(d) => makeFreeAgencyDecision(c.playerId, d)}
                  />
                ))
              )}
            </div>

            <div style={{ marginTop: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              {pendingCount > 0 && (
                <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                  {pendingCount} decision{pendingCount !== 1 ? "s" : ""} remaining
                </span>
              )}
              <button
                className="btn btn-primary btn-lg"
                style={{ marginLeft: "auto" }}
                onClick={handleAdvanceToDraft}
              >
                Advance to Draft →
              </button>
            </div>
          </div>

          {/* ── Right: cap + roster ── */}
          <div className="roster-panel">
            <CapBar payroll={payroll} />

            <div>
              <div className="section-header">
                <span className="section-title">Under Contract</span>
                <span className="section-count">({roster.length})</span>
              </div>
              {roster.length === 0 ? (
                <div className="empty-state">No committed players yet.</div>
              ) : (
                roster.map((p) => (
                  <div key={p.id} className="roster-row">
                    <PlayerAvatar name={p.name} position={p.position} size={30} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="roster-row-name">{p.name}</div>
                      <div className="roster-row-arch">{p.offensiveArchetype}</div>
                    </div>
                    <span className="card-pos">{p.position}</span>
                    <span className="roster-row-salary">{fmt(p.currentSalary)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
