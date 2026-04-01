import { useNavigate } from "react-router-dom";
import { useSimulatorStore, selectPayroll } from "../store/simulatorStore";
import type { ExpiringContract, FreeAgencyDecision } from "../types/simulator";
import NavBar from "../components/NavBar";
import CapBar from "../components/CapBar";

function fmt(n: number): string {
  return "$" + (n / 1_000_000).toFixed(1) + "M";
}

// ── Expiring contract card ─────────────────────────────────────────────────

interface ContractCardProps {
  contract: ExpiringContract;
  decision: FreeAgencyDecision | undefined;
  onDecide: (decision: FreeAgencyDecision) => void;
}

function ContractCard({ contract, decision, onDecide }: ContractCardProps) {
  const isClubOption = contract.optionType === "Club";
  const isPlayerOption = contract.optionType === "Player";
  const decided = decision !== undefined;

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span className="card-name">{contract.name}</span>
            <span className="card-pos">{contract.position}</span>
            {isClubOption && <span className="badge badge-club-opt">Club Option</span>}
            {isPlayerOption && contract.playerOptedOut && (
              <span className="badge badge-opted-out">Opted Out</span>
            )}
          </div>
        </div>
      </div>

      <div className="card-archetypes">
        <span className="arch-off">{contract.offensiveArchetype}</span>
        {" · "}
        {contract.defensiveRole}
      </div>

      <div className="card-salaries">
        <div>
          <div className="label">2025-26 salary</div>
          <div className="value">{fmt(contract.currentSalary)}</div>
        </div>
        {isClubOption && contract.optionSalary && (
          <div>
            <div className="label">Option salary</div>
            <div className="value">{fmt(contract.optionSalary)}</div>
          </div>
        )}
        <div>
          <div className="label">Est. market value</div>
          <div className={`value${contract.isSalaryEstimate ? "" : " highlight"}`}>
            {fmt(contract.estimatedMarketSalary)}
            {contract.isSalaryEstimate && (
              <span style={{ fontSize: "0.65rem", color: "var(--color-text-muted)", marginLeft: "0.25rem" }}>
                ~est
              </span>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "1.25rem",
          fontSize: "0.75rem",
          color: "var(--color-text-muted)",
          marginBottom: "0.625rem",
          flexWrap: "wrap",
        }}
      >
        <span>{contract.stats.pts.toFixed(1)} pts</span>
        <span>{contract.stats.trb.toFixed(1)} reb</span>
        <span>{contract.stats.ast.toFixed(1)} ast</span>
        <span
          style={{
            color:
              contract.stats.bpm >= 3
                ? "var(--color-accent)"
                : contract.stats.bpm < 0
                ? "var(--color-danger)"
                : "var(--color-text-muted)",
          }}
        >
          {contract.stats.bpm >= 0 ? "+" : ""}
          {contract.stats.bpm.toFixed(1)} BPM
        </span>
        <span>{(contract.stats.tsPct * 100).toFixed(1)}% TS</span>
      </div>

      {decided ? (
        <div className="card-decided">
          {decision === "RE_SIGN" && "✓ Re-signed"}
          {decision === "LET_WALK" && "✗ Let walk"}
          {decision === "PICK_UP_OPTION" && "✓ Option picked up"}
          {decision === "DECLINE_OPTION" && "✗ Option declined"}
        </div>
      ) : (
        <div className="card-actions">
          {isClubOption ? (
            <>
              <button
                className="btn btn-primary"
                onClick={() => onDecide("PICK_UP_OPTION")}
              >
                Pick Up Option
              </button>
              <button
                className="btn btn-danger"
                onClick={() => onDecide("DECLINE_OPTION")}
              >
                Decline Option
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn-primary"
                onClick={() => onDecide("RE_SIGN")}
              >
                Re-Sign {fmt(contract.estimatedMarketSalary)}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => onDecide("LET_WALK")}
              >
                Let Walk
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function FreeAgencyPage() {
  const navigate = useNavigate();

  const roster = useSimulatorStore((s) => s.roster);
  const expiring = useSimulatorStore((s) => s.expiringContracts);
  const decisions = useSimulatorStore((s) => s.decisions);
  const makeFreeAgencyDecision = useSimulatorStore((s) => s.makeFreeAgencyDecision);
  const advanceToPhase = useSimulatorStore((s) => s.advanceToPhase);
  const payroll = useSimulatorStore(selectPayroll);

  function handleDecide(playerId: string, decision: FreeAgencyDecision) {
    makeFreeAgencyDecision(playerId, decision);
  }

  function handleAdvanceToDraft() {
    advanceToPhase("DRAFT");
    navigate("/draft");
  }

  // Separate club options (user must decide) from plain UFAs / opted-out player options
  const clubOptions = expiring.filter((c) => c.optionType === "Club");
  const freeAgents = expiring.filter((c) => c.optionType !== "Club");

  const pendingClub = clubOptions.filter((c) => decisions[c.playerId] === undefined);
  const pendingUfa = freeAgents.filter((c) => decisions[c.playerId] === undefined);

  return (
    <div className="page">
      <NavBar />

      <div className="page-content">
        <div className="split-layout">

          {/* ── Left: free agents ── */}
          <div>
            {/* Club options first — these require a decision */}
            {clubOptions.length > 0 && (
              <div style={{ marginBottom: "1.5rem" }}>
                <div className="section-header">
                  <span className="section-title">Club Options</span>
                  <span className="section-count">
                    ({pendingClub.length} pending)
                  </span>
                </div>
                {clubOptions.map((c) => (
                  <ContractCard
                    key={c.playerId}
                    contract={c}
                    decision={decisions[c.playerId]}
                    onDecide={(d) => handleDecide(c.playerId, d)}
                  />
                ))}
              </div>
            )}

            {/* Unrestricted free agents */}
            <div>
              <div className="section-header">
                <span className="section-title">Free Agents</span>
                <span className="section-count">
                  ({freeAgents.length} total · {pendingUfa.length} pending)
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
                    onDecide={(d) => handleDecide(c.playerId, d)}
                  />
                ))
              )}
            </div>

            <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end" }}>
              <button
                className="btn btn-primary btn-lg"
                onClick={handleAdvanceToDraft}
              >
                Advance to Draft →
              </button>
            </div>
          </div>

          {/* ── Right: roster + cap ── */}
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
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="roster-row-name">{p.name}</div>
                      <div className="roster-row-arch">
                        {p.offensiveArchetype} · {p.defensiveRole}
                      </div>
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
