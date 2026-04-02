import { motion, AnimatePresence } from "framer-motion";
import type { ExpiringContract, DraftProspect } from "../types/simulator";
import PlayerAvatar from "./PlayerAvatar";

export type ModalSubject = ExpiringContract | DraftProspect;

function isFaPlayer(s: ModalSubject): s is ExpiringContract {
  return "stats" in s;
}

interface Props {
  subject: ModalSubject | null;
  onClose: () => void;
  teamId: string | null;
}

function fmt(n: number): string {
  return "$" + (n / 1_000_000).toFixed(1) + "M";
}

function StatBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color?: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="pmodal-stat-bar">
      <div className="pmodal-stat-bar__header">
        <span className="pmodal-stat-bar__label">{label}</span>
        <span className="pmodal-stat-bar__val">{value.toFixed(1)}</span>
      </div>
      <div className="pmodal-stat-bar__track">
        <motion.div
          className="pmodal-stat-bar__fill"
          style={{ background: color ?? "var(--color-accent)" }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.18 }}
        />
      </div>
    </div>
  );
}

function GradeBar({ grade }: { grade: number }) {
  const pct = Math.min(100, Math.max(0, ((grade - 55) / (98 - 55)) * 100));
  return (
    <div className="pmodal-grade-wrap">
      <span className="pmodal-grade-val">{grade}</span>
      <div className="pmodal-grade-bar-wrap">
        <div className="pmodal-grade-bar-label">Scout Grade</div>
        <div className="pmodal-grade-bar-track">
          <motion.div
            className="pmodal-grade-bar-fill"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.18 }}
          />
        </div>
      </div>
    </div>
  );
}

export default function PlayerDetailModal({ subject, onClose, teamId }: Props) {
  const isProspect = subject ? !isFaPlayer(subject) : false;
  const isFA = subject ? isFaPlayer(subject) : false;

  return (
    <AnimatePresence>
      {subject && (
        <>
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />
          <motion.div
            className="player-modal"
            initial={{ opacity: 0, scale: 0.88, y: 32 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 16 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`${subject.name} details`}
          >
            <button
              className="player-modal__close"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>

            <div className="player-modal__layout">
              {/* ── LEFT: avatar + identity ── */}
              <div className="player-modal__left">
                <div className="player-modal__avatar-wrap">
                  <PlayerAvatar
                    name={subject.name}
                    position={subject.position}
                    size={160}
                    headshotPool={isProspect ? "prospect" : "nba"}
                    teamId={isFA ? teamId : null}
                    school={isProspect ? (subject as DraftProspect).school : null}
                  />
                </div>

                <div className="player-modal__name">{subject.name}</div>

                <div className="player-modal__meta-row">
                  <span className="card-pos">{subject.position}</span>
                  {isFA && (
                    <span className="player-modal__age">
                      Age {(subject as ExpiringContract).age}
                    </span>
                  )}
                </div>

                <div className="player-modal__arch">{subject.offensiveArchetype}</div>
                <div className="player-modal__def">{subject.defensiveRole}</div>

                {isProspect && (
                  <>
                    <div
                      className="player-modal__school"
                      style={{ marginTop: "0.5rem" }}
                    >
                      {(subject as DraftProspect).school}
                    </div>
                    <div className="player-modal__rank-large">
                      #{(subject as DraftProspect).rank}
                    </div>
                    <div className="player-modal__rank-label">Scout Rank</div>
                  </>
                )}
              </div>

              {/* ── RIGHT: stats / info ── */}
              <div className="player-modal__right">
                {isFA ? (
                  <FaPlayerRight
                    contract={subject as ExpiringContract}
                  />
                ) : (
                  <ProspectRight prospect={subject as DraftProspect} />
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function FaPlayerRight({ contract }: { contract: ExpiringContract }) {
  const isClub = contract.optionType === "Club";
  const bpmColor =
    contract.stats.bpm >= 3
      ? "var(--color-accent)"
      : contract.stats.bpm < 0
      ? "var(--color-danger)"
      : "var(--color-text-muted)";
  const bpmSign = contract.stats.bpm >= 0 ? "+" : "";

  return (
    <>
      <div className="player-modal__section-label">Season Stats</div>
      <div className="player-modal__stats">
        <StatBar label="Points Per Game" value={contract.stats.pts} max={38} />
        <StatBar label="Rebounds Per Game" value={contract.stats.trb} max={16} />
        <StatBar label="Assists Per Game" value={contract.stats.ast} max={12} />
        <StatBar
          label="True Shooting %"
          value={contract.stats.tsPct * 100}
          max={75}
          color="var(--color-info)"
        />
      </div>

      <div className="player-modal__chips">
        <div className="pmodal-chip">
          <span className="pmodal-chip__label">BPM</span>
          <span className="pmodal-chip__val" style={{ color: bpmColor }}>
            {bpmSign}{contract.stats.bpm.toFixed(1)}
          </span>
        </div>
        <div className="pmodal-chip">
          <span className="pmodal-chip__label">TS%</span>
          <span className="pmodal-chip__val">
            {(contract.stats.tsPct * 100).toFixed(1)}
          </span>
        </div>
        <div className="pmodal-chip">
          <span className="pmodal-chip__label">PTS</span>
          <span className="pmodal-chip__val">{contract.stats.pts.toFixed(1)}</span>
        </div>
        <div className="pmodal-chip">
          <span className="pmodal-chip__label">REB</span>
          <span className="pmodal-chip__val">{contract.stats.trb.toFixed(1)}</span>
        </div>
        <div className="pmodal-chip">
          <span className="pmodal-chip__label">AST</span>
          <span className="pmodal-chip__val">{contract.stats.ast.toFixed(1)}</span>
        </div>
      </div>

      <div className="player-modal__divider" />

      <div className="player-modal__section-label">
        {isClub ? "Club Option" : "Free Agency"}
      </div>
      <div className="player-modal__contract">
        <div className="pmodal-contract-item">
          <span className="pmodal-contract-item__label">Current</span>
          <span className="pmodal-contract-item__val">
            {fmt(contract.currentSalary)}
          </span>
        </div>
        {isClub && contract.optionSalary ? (
          <div className="pmodal-contract-item">
            <span className="pmodal-contract-item__label">Option</span>
            <span className="pmodal-contract-item__val pmodal-contract-item__val--accent">
              {fmt(contract.optionSalary)}
            </span>
          </div>
        ) : (
          <div className="pmodal-contract-item">
            <span className="pmodal-contract-item__label">Est. Market</span>
            <span className="pmodal-contract-item__val pmodal-contract-item__val--accent">
              {fmt(contract.estimatedMarketSalary)}
            </span>
          </div>
        )}
      </div>
      {contract.isSalaryEstimate && (
        <p className="player-modal__salary-note">Market estimate · may vary</p>
      )}
    </>
  );
}

function ProspectRight({ prospect }: { prospect: DraftProspect }) {
  return (
    <>
      <div className="player-modal__section-label">Scout Report</div>
      <GradeBar grade={prospect.grade} />

      {prospect.notes ? (
        <p className="player-modal__notes" style={{ marginBottom: "1.25rem" }}>
          {prospect.notes}
        </p>
      ) : (
        <div className="player-modal__no-stats" style={{ marginBottom: "1.25rem" }}>
          No scout notes on file
        </div>
      )}

      <div className="player-modal__divider" />

      <div className="player-modal__section-label">Season Stats</div>
      <div className="player-modal__no-stats">
        College stats not yet available — check back after import
      </div>

      <div className="player-modal__divider" />

      <div className="player-modal__section-label">Projected Contract</div>
      <div className="player-modal__contract">
        <div className="pmodal-contract-item">
          <span className="pmodal-contract-item__label">Rookie Salary</span>
          <span className="pmodal-contract-item__val pmodal-contract-item__val--accent">
            {fmt(prospect.projectedSalary)}
          </span>
        </div>
      </div>
    </>
  );
}
