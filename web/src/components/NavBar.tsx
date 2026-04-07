import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useSmoothNavigate } from "../hooks/useSmoothNavigate";
import { useSimulatorStore } from "../store/simulatorStore";
import { TEAMS } from "../data/constants";
import type { SimulatorPhase } from "../types/simulator";
import RosterModal from "./RosterModal";
import TeamLogo from "./TeamLogo";

function fmt(n: number): string {
  const abs = Math.abs(n);
  return (n < 0 ? "-$" : "$") + (abs / 1_000_000).toFixed(1) + "M";
}

const PHASE_ROUTES: Partial<Record<SimulatorPhase, string>> = {
  FREE_AGENCY: "/free-agency",
  DRAFT: "/draft",
  COMPLETE: "/roster-summary",
};

const PHASE_LABELS: Record<SimulatorPhase, string> = {
  SELECT_TEAM: "Select Team",
  FREE_AGENCY: "Free Agency",
  DRAFT: "Draft",
  COMPLETE: "Summary",
};

export default function NavBar() {
  const navigate = useSmoothNavigate();
  const location = useLocation();
  const [rosterOpen, setRosterOpen] = useState(false);

  const selectedTeamId = useSimulatorStore((s) => s.selectedTeamId);
  const phase = useSimulatorStore((s) => s.phase);
  const capSpace = useSimulatorStore((s) => s.capSpace);
  const roster = useSimulatorStore((s) => s.roster);

  const team = TEAMS.find((t) => t.id === selectedTeamId);
  const overCap = capSpace < 0;

  // Phases the user can navigate back to (already unlocked)
  const UNLOCKED: SimulatorPhase[] = ["FREE_AGENCY", "DRAFT", "COMPLETE"];
  const phaseOrder: SimulatorPhase[] = ["SELECT_TEAM", "FREE_AGENCY", "DRAFT", "COMPLETE"];
  const currentPhaseIndex = phaseOrder.indexOf(phase);

  function NavItem({
    label,
    route,
    active,
    enabled,
  }: {
    label: string;
    route: string;
    active: boolean;
    enabled: boolean;
  }) {
    return (
      <button
        onClick={() => enabled && navigate(route)}
        disabled={!enabled}
        style={{
          background: "none",
          border: "none",
          padding: "0.2rem 0.5rem",
          borderRadius: "5px",
          cursor: enabled ? "pointer" : "default",
          fontFamily: "var(--font-display)",
          fontSize: "0.78rem",
          fontWeight: active ? 700 : 500,
          color: active
            ? "var(--color-text)"
            : enabled
            ? "var(--color-text-muted)"
            : "var(--color-border)",
          letterSpacing: "0.01em",
          borderBottom: active ? "2px solid var(--color-accent)" : "2px solid transparent",
        }}
        onMouseEnter={(e) => {
          if (enabled && !active) e.currentTarget.style.color = "var(--color-text-secondary)";
        }}
        onMouseLeave={(e) => {
          if (enabled && !active) e.currentTarget.style.color = "var(--color-text-muted)";
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <>
      <nav className="navbar">
        {/* Logo → home */}
        <button
          className="navbar-logo"
          onClick={() => navigate("/")}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginRight: "0.5rem" }}
        >
          Greenroom
        </button>

        <span className="navbar-sep">/</span>

        {/* Team → select-team (only if team not yet locked in) */}
        {team ? (
          <button
            onClick={() => navigate("/select-team")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontFamily: "var(--font-display)",
              fontSize: "0.82rem",
              fontWeight: 600,
              color: "var(--color-text-secondary)",
              padding: "0 0.25rem",
            }}
          >
            <TeamLogo teamId={team.id} size={22} />
            {team.city} {team.name}
          </button>
        ) : (
          <span className="navbar-team">Select Team</span>
        )}

        {/* Phase nav pills */}
        {selectedTeamId && (
          <>
            <span className="navbar-sep">/</span>
            <div style={{ display: "flex", alignItems: "center" }}>
              {(["FREE_AGENCY", "DRAFT", "COMPLETE"] as SimulatorPhase[]).map((p, i, arr) => {
                const phaseIdx = phaseOrder.indexOf(p);
                const isUnlocked = phaseIdx <= currentPhaseIndex;
                const route = PHASE_ROUTES[p]!;
                const isActive = location.pathname === route;
                return (
                  <NavItem
                    key={p}
                    label={PHASE_LABELS[p]}
                    route={route}
                    active={isActive}
                    enabled={isUnlocked}
                  />
                );
              })}
            </div>
          </>
        )}

        {/* Right side */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "1rem" }}>
          {selectedTeamId && roster.length > 0 && (
            <button
              onClick={() => setRosterOpen(true)}
              style={{
                background: "var(--color-surface-raised)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-secondary)",
                borderRadius: "6px",
                padding: "0.28rem 0.75rem",
                cursor: "pointer",
                fontSize: "0.72rem",
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                letterSpacing: "0.03em",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.7 }}>
                <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
                <path d="M2 14c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Roster · {roster.length}
            </button>
          )}

          {selectedTeamId && (
            <div className="navbar-cap">
              <span className="navbar-cap-label">Cap space</span>
              <span className={`navbar-cap-value${overCap ? " over-cap" : ""}`}>
                {fmt(capSpace)}
              </span>
            </div>
          )}
        </div>
      </nav>

      {rosterOpen && <RosterModal onClose={() => setRosterOpen(false)} />}
    </>
  );
}
