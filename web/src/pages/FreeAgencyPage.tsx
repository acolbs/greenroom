import { motion } from "framer-motion";
import { useSmoothNavigate } from "../hooks/useSmoothNavigate";
import { useSimulatorStore, selectPayroll } from "../store/simulatorStore";
import type { ExpiringContract, FreeAgencyDecision } from "../types/simulator";
import NavBar from "../components/NavBar";
import CapBar from "../components/CapBar";
import PlayerAvatar from "../components/PlayerAvatar";
import { honorReducedMotion } from "../utils/motionPrefs";

const FA_EASE = [0.22, 1, 0.36, 1] as const;

function isKept(d: FreeAgencyDecision): boolean {
  return d === "RE_SIGN" || d === "PICK_UP_OPTION";
}

function fmt(n: number): string {
  return "$" + (n / 1_000_000).toFixed(1) + "M";
}

interface ContractCardProps {
  contract: ExpiringContract;
  decision: FreeAgencyDecision | undefined;
  onDecide: (d: FreeAgencyDecision) => void;
  teamId: string | null;
  motionOk: boolean;
}

function ContractCard({ contract, decision, onDecide, teamId, motionOk }: ContractCardProps) {
  const isClub = contract.optionType === "Club";
  const decided = decision !== undefined;
  const kept = decision !== undefined && isKept(decision);

  const bpmColor =
    contract.stats.bpm >= 3
      ? "var(--color-accent)"
      : contract.stats.bpm < 0
      ? "var(--color-danger)"
      : "var(--color-text-muted)";

  const outcomeClass = decided
    ? kept
      ? " fa-card--outcome-yes"
      : " fa-card--outcome-no"
    : "";

  return (
    <div className={`fa-card${decided ? " fa-card--decided" : ""}${outcomeClass}`}>
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
        <motion.div
          className={`fa-card__decision${kept ? " fa-card__decision--yes" : " fa-card__decision--no"}`}
          initial={motionOk ? { opacity: 0, y: 6 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={
            motionOk
              ? { duration: 0.3, ease: FA_EASE }
              : { duration: 0 }
          }
        >
          <span>{kept ? "✓" : "✗"}</span>
          <span>
            {decision === "RE_SIGN" && "Re-signed"}
            {decision === "LET_WALK" && "Let walk"}
            {decision === "PICK_UP_OPTION" && "Option picked up"}
            {decision === "DECLINE_OPTION" && "Option declined"}
          </span>
        </motion.div>
      ) : (
        <div className="fa-card__actions">
          {isClub ? (
            <>
              <motion.button
                type="button"
                className="btn btn-primary fa-card__action-btn"
                onClick={() => onDecide("PICK_UP_OPTION")}
                whileTap={motionOk ? { scale: 0.97 } : undefined}
                transition={{ type: "spring", stiffness: 480, damping: 28 }}
              >
                Pick Up · {contract.optionSalary ? fmt(contract.optionSalary) : "—"}
              </motion.button>
              <motion.button
                type="button"
                className="btn btn-danger fa-card__action-btn"
                onClick={() => onDecide("DECLINE_OPTION")}
                whileTap={motionOk ? { scale: 0.97 } : undefined}
                transition={{ type: "spring", stiffness: 480, damping: 28 }}
              >
                Decline Option
              </motion.button>
            </>
          ) : (
            <>
              <motion.button
                type="button"
                className="btn btn-primary fa-card__action-btn"
                onClick={() => onDecide("RE_SIGN")}
                whileTap={motionOk ? { scale: 0.97 } : undefined}
                transition={{ type: "spring", stiffness: 480, damping: 28 }}
              >
                Re-Sign · {fmt(contract.estimatedMarketSalary)}
              </motion.button>
              <motion.button
                type="button"
                className="btn btn-secondary fa-card__action-btn"
                onClick={() => onDecide("LET_WALK")}
                whileTap={motionOk ? { scale: 0.97 } : undefined}
                transition={{ type: "spring", stiffness: 480, damping: 28 }}
              >
                Let Walk
              </motion.button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function FreeAgencyPage() {
  const motionOk = !honorReducedMotion();
  const navigate = useSmoothNavigate();
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
          <motion.div
            initial={motionOk ? { opacity: 0, y: 14 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={
              motionOk ? { duration: 0.4, ease: FA_EASE, delay: 0.04 } : { duration: 0 }
            }
          >
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
                    motionOk={motionOk}
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
                    motionOk={motionOk}
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
              <motion.button
                className="btn btn-primary btn-lg"
                style={{ marginLeft: "auto" }}
                onClick={handleAdvanceToDraft}
                whileTap={motionOk ? { scale: 0.98 } : undefined}
                transition={{ type: "spring", stiffness: 450, damping: 26 }}
              >
                Advance to Draft →
              </motion.button>
            </div>
          </motion.div>

          {/* ── Right: cap + roster ── */}
          <motion.div
            className="roster-panel"
            initial={motionOk ? { opacity: 0, y: 10 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={
              motionOk ? { duration: 0.38, ease: FA_EASE, delay: 0.1 } : { duration: 0 }
            }
          >
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
          </motion.div>

        </div>
      </div>
    </div>
  );
}
