import React from "react";
import type { ExpiringContract, FreeAgencyDecision } from "../types/simulator";
import SalaryDecisionToggle from "./SalaryDecisionToggle";

type Props = {
  contract: ExpiringContract;
  decision?: FreeAgencyDecision;
  onDecide: (playerId: string, decision: FreeAgencyDecision) => void;
};

const formatMoney = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function PlayerCard({ contract, decision, onDecide }: Props) {
  const off = contract.csvOffensiveArchetype.trim() || "—";
  const def = contract.csvDefensiveRole.trim() || "—";

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      <div className="row" style={{ justifyContent: "space-between", width: "100%", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 650, letterSpacing: "-0.02em" }}>{contract.name}</div>
          <div className="muted" style={{ fontSize: "0.6875rem", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: "0.45rem" }}>
            Offense / Defense
          </div>
          <div style={{ fontSize: "0.8125rem", marginTop: "0.2rem", lineHeight: 1.45 }}>
            <span className="text-strong">{off}</span>
            <span className="muted"> / </span>
            <span className="text-strong">{def}</span>
          </div>
          <div className="muted" style={{ fontSize: "0.75rem", marginTop: "0.35rem" }}>
            {contract.position}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="muted" style={{ fontSize: "0.6875rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            ACE contract
          </div>
          <div style={{ fontWeight: 650, marginTop: "0.2rem", letterSpacing: "-0.02em" }}>{formatMoney(contract.estimatedMarketSalary)}</div>
        </div>
      </div>

      <div className="row" style={{ gap: "0.4rem" }}>
        <span className="pill">{contract.stats.pointsPerGame.toFixed(1)} PPG</span>
        <span className="pill">{contract.stats.reboundsPerGame.toFixed(1)} RPG</span>
        <span className="pill">{contract.stats.assistsPerGame.toFixed(1)} APG</span>
        <span className="pill">{(contract.stats.fgPct * 100).toFixed(0)}% FG</span>
      </div>

      <SalaryDecisionToggle value={decision} onChoose={(d) => onDecide(contract.playerId, d)} />
    </div>
  );
}
