import { useNavigate } from "react-router-dom";

export default function WelcomePage() {
  const navigate = useNavigate();

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
