import React from "react";
import { Link } from "react-router-dom";

export default function WelcomePage() {
  return (
    <div className="welcome-page">
      <div className="welcome-bg" aria-hidden />
      <div className="welcome-content">
        <p className="welcome-eyebrow">Front office simulator</p>
        <h1 className="welcome-title">Greenroom</h1>
        <p className="welcome-lede">
          Model the offseason like a GM: set your team, work expiring contracts against the cap, then draft from the big board with
          fit scoring tied to real contender rosters.
        </p>
        <div className="welcome-actions">
          <Link to="/select-team" className="btn btn-lg btn-primary">
            Start simulation
          </Link>
          <Link to="/select-team" className="btn btn-lg btn-ghost">
            Skip intro
          </Link>
        </div>
      </div>
      <footer className="welcome-footer">CSV-backed rosters and contracts · Professional dark UI</footer>
    </div>
  );
}
