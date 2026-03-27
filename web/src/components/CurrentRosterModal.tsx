import React, { useEffect, useMemo, useRef } from "react";
import type { RosterPlayer } from "../types/simulator";
import { capSpaceFromPayroll, totalRosterPayroll } from "../data/capSpace";
import "./currentRosterModal.css";

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

type Props = {
  open: boolean;
  onClose: () => void;
  teamName: string;
  salaryCap: number;
  roster: RosterPlayer[];
};

export default function CurrentRosterModal({ open, onClose, teamName, salaryCap, roster }: Props) {
  const sorted = useMemo(
    () => [...roster].sort((a, b) => b.currentSalary - a.currentSalary || a.name.localeCompare(b.name)),
    [roster]
  );
  const payroll = totalRosterPayroll(roster);
  const space = capSpaceFromPayroll(salaryCap, roster);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div className="roster-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="roster-modal card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="roster-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="roster-modal-head">
          <h2 id="roster-modal-title" className="roster-modal-title">
            Current roster · {teamName}
          </h2>
          <button type="button" className="btn roster-modal-close" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        <p className="muted roster-modal-sub">
          {sorted.length} player{sorted.length === 1 ? "" : "s"} · Payroll {money(payroll)} vs. cap {money(salaryCap)} · Room{" "}
          <span className="text-strong">{money(space)}</span>
        </p>
        <div className="roster-modal-table-wrap">
          <table className="roster-modal-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Pos</th>
                <th className="roster-modal-num">2025-26 salary</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="muted">{p.position}</td>
                  <td className="roster-modal-num">{money(p.currentSalary)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
