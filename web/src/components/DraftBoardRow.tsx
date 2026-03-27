import React from "react";
import type { DraftProspect } from "../types/simulator";

type Props = {
  prospect: DraftProspect;
  index?: number;
  recommended?: boolean;
  onDraft: (prospectId: string) => void;
  disabled?: boolean;
};

const formatRank = (n: number) => `#${n}`;

export default function DraftBoardRow({ prospect, index, recommended, onDraft, disabled }: Props) {
  const off = prospect.csvOffensiveArchetype.trim();
  const def = prospect.csvDefensiveRole.trim();
  const hasCsvArchetypes = Boolean(off || def);

  return (
    <div
      className={`card draft-board-row${disabled ? " draft-board-row-disabled" : ""}`}
      style={{ display: "flex", gap: "1rem" }}
    >
      <div style={{ minWidth: "6.5rem", flexShrink: 0 }}>
        <div className="muted" style={{ fontSize: "0.6875rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Overall
        </div>
        <div style={{ fontWeight: 650, fontSize: "1.125rem", letterSpacing: "-0.02em", marginTop: "0.15rem" }}>{formatRank(prospect.overallRank)}</div>
        {typeof index === "number" ? (
          <div className="muted" style={{ fontSize: "0.75rem", marginTop: "0.35rem" }}>
            Board #{index + 1}
          </div>
        ) : null}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 650, fontSize: "1rem", letterSpacing: "-0.02em" }}>{prospect.name}</div>
        <div className="muted" style={{ fontSize: "0.8125rem", marginTop: "0.25rem" }}>
          {prospect.school} · {prospect.position}
        </div>
        {hasCsvArchetypes ? (
          <>
            <div className="muted" style={{ fontSize: "0.6875rem", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: "0.45rem" }}>
              Offense / Defense
            </div>
            <div style={{ fontSize: "0.8125rem", marginTop: "0.2rem", lineHeight: 1.45 }}>
              <span className="text-strong">{off || "—"}</span>
              <span className="muted"> / </span>
              <span className="text-strong">{def || "—"}</span>
            </div>
          </>
        ) : (
          <div className="muted" style={{ fontSize: "0.8125rem", marginTop: "0.35rem" }}>
            Simulator role: <span className="pill pill-accent">{prospect.projectedArchetype}</span>
          </div>
        )}
      </div>

      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div className="muted" style={{ fontSize: "0.6875rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Grade
        </div>
        <div style={{ fontWeight: 650, fontSize: "1.125rem", marginTop: "0.15rem" }}>{prospect.grade}</div>
        {prospect.fitNotes ? (
          <div className="muted" style={{ fontSize: "0.75rem", marginTop: "0.35rem", maxWidth: "12rem", marginLeft: "auto", lineHeight: 1.4 }}>
            {prospect.fitNotes}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "flex-end", flexShrink: 0 }}>
        {recommended ? <span className="pill pill-accent">Scout pick</span> : null}
        <button className={`btn ${recommended ? "btn-primary" : ""}`} onClick={() => onDraft(prospect.id)} disabled={disabled} type="button">
          Draft
        </button>
      </div>
    </div>
  );
}
