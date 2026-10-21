import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useSmoothNavigate } from "../hooks/useSmoothNavigate";
import { useSimulatorStore } from "../store/simulatorStore";
import { TEAMS } from "../data/constants";
import type { SimulatorPhase } from "../types/simulator";
import RosterModal from "./RosterModal";
import TeamLogo from "./TeamLogo";
import { fmtMoney } from "../lib/format";

const STEPS: { phase: SimulatorPhase; label: string; route: string }[] = [
  { phase: "SELECT_TEAM", label: "Team", route: "/select-team" },
  { phase: "ANALYSIS", label: "Scouting report", route: "/analysis" },
  { phase: "FREE_AGENCY", label: "Free agency", route: "/free-agency" },
  { phase: "DRAFT", label: "Draft", route: "/draft" },
  { phase: "COMPLETE", label: "Results", route: "/results" },
];

const PHASE_ORDER = STEPS.map((s) => s.phase);

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark"
  );

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("greenroom-theme", next);
    } catch {
      /* storage blocked: theme just won't persist */
    }
    setTheme(next);
  }

  return (
    <button type="button" className="btn btn-ghost btn-sm" onClick={toggle} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}

export default function AppHeader() {
  const navigate = useSmoothNavigate();
  const location = useLocation();
  const [rosterOpen, setRosterOpen] = useState(false);

  const selectedTeamId = useSimulatorStore((s) => s.selectedTeamId);
  const phase = useSimulatorStore((s) => s.phase);
  const capSpace = useSimulatorStore((s) => s.capSpace);
  const rosterSize = useSimulatorStore((s) => s.roster.length);

  const team = TEAMS.find((t) => t.id === selectedTeamId);
  const reached = PHASE_ORDER.indexOf(phase);

  return (
    <>
      <header className="app-header">
        <div className="app-header__row">
          <button type="button" className="brand" onClick={() => navigate("/")}>
            <span className="brand__mark" aria-hidden="true" />
            Greenroom
          </button>

          {team && (
            <button type="button" className="app-header__team" onClick={() => navigate("/select-team")} title="Change team">
              <TeamLogo teamId={team.id} size={22} />
              <span>{team.city} {team.name}</span>
            </button>
          )}

          <div className="app-header__right">
            {team && rosterSize > 0 && (
              <button type="button" className="btn btn-sm" onClick={() => setRosterOpen(true)}>
                Roster <span className="num">{rosterSize}</span>
              </button>
            )}
            {team && (
              <div className="cap-chip">
                <span className="cap-chip__label">Cap space 26-27</span>
                <span className={`cap-chip__value${capSpace < 0 ? " is-over" : ""}`}>{fmtMoney(capSpace)}</span>
              </div>
            )}
            <ThemeToggle />
          </div>
        </div>

        {team && (
          <nav className="steps" aria-label="Offseason steps">
            {STEPS.map((step, i) => {
              const current = location.pathname === step.route;
              const done = i < reached && !current;
              return (
                <button
                  key={step.phase}
                  type="button"
                  className={`step${current ? " is-current" : ""}${done ? " is-done" : ""}`}
                  disabled={i > reached}
                  aria-current={current ? "step" : undefined}
                  onClick={() => navigate(step.route)}
                >
                  <span className="step__n">{i + 1}</span>
                  {step.label}
                </button>
              );
            })}
          </nav>
        )}
      </header>

      {rosterOpen && <RosterModal onClose={() => setRosterOpen(false)} />}
    </>
  );
}
