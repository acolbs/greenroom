import { useNavigate } from "react-router-dom";
import { useSimulatorStore, selectPayroll } from "../store/simulatorStore";
import type { ExpiringContract, FreeAgencyDecision } from "../types/simulator";
import NavBar from "../components/NavBar";
import CapBar from "../components/CapBar";
import PlayerAvatar from "../components/PlayerAvatar";

function fmt(n: number): string {
  return "$" + (n / 1_000_000).toFixed(1) + "M";
}

interface ContractCardProps {
  contract: ExpiringContract;
  decision: FreeAgencyDecision | undefined;
  onDecide: (d: FreeAgencyDecision) => void;
  teamId: string | null;
}

function ContractCard({ contract, decision, onDecide, teamId }: ContractCardProps) {
  const isClub = contract.optionType === "Club";
  const decided = decision !== undefined;

  const bpmColor =
    contract.stats.bpm >= 3
      ? "var(--color-accent)"
      : contract.stats.bpm < 0
      ? "var(--color-danger)"
      : "var(--color-text-muted)";

  return (
    <div className={`fa-card${decided ? " fa-card--decided" : ""}`}>
      <div className="fa-card__hero">
        <div className="fa-card__avatar">
          <PlayerAvatar
            name={contract.name}
            position={contract.position}
            size={96}
            headshotPool={contract.playerId.startsWith("draft-") ? "prospect" : "nba"}
            teamId={teamId}
          />
        </div>
        <div className="fa-card__identity">
          <div className="fa-card__title-block">
            <div className="fa-card__name-row">
              <span className="fa-card__name">{contract.name}</span>
              <span className="card-pos">{contract.position}</span>
            </div>
            <div className="fa-card__badges">
              {isClub && <span className="badge badge-club-opt">Club Option</span>}
              {contract.optionType === "Player" && contract.playerOptedOut && (
                <span className="badge badge-opted-out">Opted Out</span>
              )}
            </div>
            <div className="fa-card__sub">
              Age {contract.age} · <span className="fa-card__arch">{contract.offensiveArchetype}</span>
              {" · "}
              {contract.defensiveRole}
            </div>
          </div>
          <div className="fa-card__salary">
            <div className="fa-card__salary-label">{isClub ? "Option" : "Market"}</div>
            <div className="fa-card__salary-main">
              {isClub && contract.optionSalary ? fmt(contract.optionSalary) : fmt(contract.estimatedMarketSalary)}
            </div>
            <div className="fa-card__salary-sub">{fmt(contract.currentSalary)} current</div>
          </div>
        </div>
      </div>

      <div className="fa-card__stats" role="group" aria-label="Season stats">
        <div className="fa-card__stat">
          <span className="fa-card__stat-val">{contract.stats.pts.toFixed(1)}</span>
          <span className="fa-card__stat-lbl">PTS</span>
        </div>
        <div className="fa-card__stat">
          <span className="fa-card__stat-val">{contract.stats.trb.toFixed(1)}</span>
          <span className="fa-card__stat-lbl">REB</span>
        </div>
        <div className="fa-card__stat">
          <span className="fa-card__stat-val">{contract.stats.ast.toFixed(1)}</span>
          <span className="fa-card__stat-lbl">AST</span>
        </div>
        <div className="fa-card__stat">
          <span className="fa-card__stat-val" style={{ color: bpmColor }}>
            {contract.stats.bpm >= 0 ? "+" : ""}
            {contract.stats.bpm.toFixed(1)}
          </span>
          <span className="fa-card__stat-lbl">BPM</span>
        </div>
        <div className="fa-card__stat">
          <span className="fa-card__stat-val">{(contract.stats.tsPct * 100).toFixed(1)}</span>
          <span className="fa-card__stat-lbl">TS%</span>
        </div>
      </div>

      {decided ? (
        <div
          className={`fa-card__decision${decision === "RE_SIGN" || decision === "PICK_UP_OPTION" ? " fa-card__decision--yes" : ""}`}
        >
          <span>{decision === "RE_SIGN" || decision === "PICK_UP_OPTION" ? "✓" : "✗"}</span>
          <span>
            {decision === "RE_SIGN" && "Re-signed"}
            {decision === "LET_WALK" && "Let walk"}
            {decision === "PICK_UP_OPTION" && "Option picked up"}
            {decision === "DECLINE_OPTION" && "Option declined"}
          </span>
        </div>
      ) : (
        <div className="fa-card__actions">
          {isClub ? (
            <>
              <button type="button" className="btn btn-primary fa-card__action-btn" onClick={() => onDecide("PICK_UP_OPTION")}>
                Pick Up · {contract.optionSalary ? fmt(contract.optionSalary) : "—"}
              </button>
              <button type="button" className="btn btn-danger fa-card__action-btn" onClick={() => onDecide("DECLINE_OPTION")}>
                Decline Option
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-primary fa-card__action-btn" onClick={() => onDecide("RE_SIGN")}>
                Re-Sign · {fmt(contract.estimatedMarketSalary)}
              </button>
              <button type="button" className="btn btn-secondary fa-card__action-btn" onClick={() => onDecide("LET_WALK")}>
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
  const selectedTeamId = useSimulatorStore((s) => s.selectedTeamId);

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
                    teamId={selectedTeamId}
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
                    teamId={selectedTeamId}
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
                    <PlayerAvatar
                      name={p.name}
                      position={p.position}
                      size={40}
                      headshotPool={p.id.startsWith("draft-") ? "prospect" : "nba"}
                      teamId={p.teamAbbrev || selectedTeamId}
                    />
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
