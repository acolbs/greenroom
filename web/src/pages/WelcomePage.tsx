import { useSmoothNavigate } from "../hooks/useSmoothNavigate";

const HOW_TO_STEPS = [
  {
    num: 1,
    title: "Pick Your Team",
    desc: "Choose any of the 30 NBA franchises and take control of their offseason.",
  },
  {
    num: 2,
    title: "Handle Contracts",
    desc: "Pick up club options, re-sign free agents, and shape your cap situation.",
  },
  {
    num: 3,
    title: "Run the Draft",
    desc: "Make your picks across 3 rounds (90 total). CPU teams fill all other slots.",
  },
  {
    num: 4,
    title: "See Your Score",
    desc: "Get a championship readiness rating based on the formula used by title contenders.",
  },
];

export default function WelcomePage() {
  const navigate = useSmoothNavigate();

  return (
    <div className="welcome-page">
      <div className="welcome-inner">
        <div className="welcome-eyebrow">NBA Offseason GM Simulator</div>

        <div className="welcome-logo">
          Green<span>room</span>
        </div>

        <p className="welcome-tagline">
          Build your championship roster. Navigate free agency, resolve
          contracts, and run your draft board for the 2026–27 season.
        </p>

        {/* How to play steps */}
        <div className="welcome-steps">
          {HOW_TO_STEPS.map((step) => (
            <div key={step.num} className="welcome-step">
              <div className="welcome-step__num">{step.num}</div>
              <div className="welcome-step__title">{step.title}</div>
              <div className="welcome-step__desc">{step.desc}</div>
            </div>
          ))}
        </div>

        <button
          className="btn btn-primary btn-lg"
          onClick={() => navigate("/select-team")}
        >
          Start Simulator
        </button>

        <div className="welcome-meta">
          <span>2026–27 Season</span>
          <span className="welcome-meta-dot" />
          <span>$165M Salary Cap</span>
          <span className="welcome-meta-dot" />
          <span>30 Teams</span>
        </div>
      </div>

      <footer className="welcome-footer">
        <div className="welcome-credits">
          <span className="welcome-credits-label">Developed by</span>
          <span className="welcome-credits-names">
            Anthony Colby &amp; Ali Razfar
          </span>
        </div>
        <span style={{ fontSize: "0.65rem", opacity: 0.4 }}>
          Greenroom · 2026
        </span>
      </footer>
    </div>
  );
}
