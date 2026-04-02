import { motion, AnimatePresence } from "framer-motion";
import type { ExpiringContract } from "../types/simulator";
import PlayerAvatar from "./PlayerAvatar";

interface Props {
  contract: ExpiringContract | null;
  onClose: () => void;
  teamId: string | null;
}

function fmt(n: number): string {
  return "$" + (n / 1_000_000).toFixed(1) + "M";
}

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color?: string }) {
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
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        />
      </div>
    </div>
  );
}

function BpmChip({ bpm }: { bpm: number }) {
  const color = bpm >= 3 ? "var(--color-accent)" : bpm < 0 ? "var(--color-danger)" : "var(--color-text-muted)";
  const sign = bpm >= 0 ? "+" : "";
  return (
    <div className="pmodal-chip">
      <span className="pmodal-chip__label">BPM</span>
      <span className="pmodal-chip__val" style={{ color }}>{sign}{bpm.toFixed(1)}</span>
    </div>
  );
}

export default function PlayerDetailModal({ contract, onClose, teamId }: Props) {
  const isProspect = contract?.playerId.startsWith("draft-") ?? false;

  return (
    <AnimatePresence>
      {contract && (
        <>
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className="player-modal"
            initial={{ opacity: 0, scale: 0.9, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 12 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`${contract.name} details`}
          >
            {/* Scan-line accent */}
            <div className="player-modal__scan" />

            {/* Close */}
            <button className="player-modal__close" onClick={onClose} aria-label="Close">✕</button>

            {/* Header */}
            <div className="player-modal__header">
              <PlayerAvatar
                name={contract.name}
                position={contract.position}
                size={104}
                headshotPool={isProspect ? "prospect" : "nba"}
                teamId={teamId}
              />
              <div className="player-modal__identity">
                <div className="player-modal__name">{contract.name}</div>
                <div className="player-modal__meta-row">
                  <span className="card-pos">{contract.position}</span>
                  <span className="player-modal__age">Age {contract.age}</span>
                </div>
                <div className="player-modal__arch">{contract.offensiveArchetype}</div>
                <div className="player-modal__def">{contract.defensiveRole}</div>
              </div>
            </div>

            {/* Divider */}
            <div className="player-modal__divider" />

            {/* Stats */}
            <div className="player-modal__section-label">Season Stats</div>
            <div className="player-modal__stats">
              <StatBar label="PTS" value={contract.stats.pts} max={38} />
              <StatBar label="REB" value={contract.stats.trb} max={15} />
              <StatBar label="AST" value={contract.stats.ast} max={12} />
              <StatBar
                label="TS%"
                value={contract.stats.tsPct * 100}
                max={75}
                color="var(--color-info)"
              />
            </div>
            <div className="player-modal__chips">
              <BpmChip bpm={contract.stats.bpm} />
              <div className="pmodal-chip">
                <span className="pmodal-chip__label">TS%</span>
                <span className="pmodal-chip__val">{(contract.stats.tsPct * 100).toFixed(1)}</span>
              </div>
            </div>

            {/* Divider */}
            <div className="player-modal__divider" />

            {/* Contract */}
            <div className="player-modal__section-label">Contract</div>
            <div className="player-modal__contract">
              <div className="pmodal-contract-item">
                <span className="pmodal-contract-item__label">Current</span>
                <span className="pmodal-contract-item__val">{fmt(contract.currentSalary)}</span>
              </div>
              {contract.optionType === "Club" && contract.optionSalary ? (
                <div className="pmodal-contract-item">
                  <span className="pmodal-contract-item__label">Club Option</span>
                  <span className="pmodal-contract-item__val pmodal-contract-item__val--accent">{fmt(contract.optionSalary)}</span>
                </div>
              ) : (
                <div className="pmodal-contract-item">
                  <span className="pmodal-contract-item__label">Est. Market</span>
                  <span className="pmodal-contract-item__val pmodal-contract-item__val--accent">{fmt(contract.estimatedMarketSalary)}</span>
                </div>
              )}
              {contract.isSalaryEstimate && (
                <div className="player-modal__salary-note">Market estimate · may vary</div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
