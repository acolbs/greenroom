import { useNavigate } from "react-router-dom";
import { TEAMS } from "../data/constants";
import { useSimulatorStore } from "../store/simulatorStore";
import NavBar from "../components/NavBar";

export default function SelectTeamPage() {
  const navigate = useNavigate();
  const selectTeam = useSimulatorStore((s) => s.selectTeam);
  const loading = useSimulatorStore((s) => s.loading);
  const error = useSimulatorStore((s) => s.error);

  async function handleSelect(teamId: string) {
    await selectTeam(teamId);
    navigate("/free-agency");
  }

  const east = TEAMS.filter((t) => t.conference === "East");
  const west = TEAMS.filter((t) => t.conference === "West");

  return (
    <div className="page">
      <NavBar />

      <div className="page-content">
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "0.35rem" }}>
            Choose Your Team
          </h1>
          <p style={{ fontSize: "0.83rem", color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            You'll manage their free agency decisions and draft picks for the 2026–27 season.
          </p>
        </div>

        {error && <div className="error-msg" style={{ marginBottom: "1rem" }}>{error}</div>}
        {loading && <div className="loading-msg">Loading roster data…</div>}

        {!loading && (
          <>
            <div style={{ marginBottom: "1.25rem" }}>
              <div className="section-header">
                <span className="section-title">Eastern Conference</span>
                <span className="section-count">({east.length} teams)</span>
              </div>
              <div className="team-grid">
                {east.map((team) => (
                  <button
                    key={team.id}
                    className="team-card"
                    onClick={() => handleSelect(team.id)}
                  >
                    <div className="team-card-city">{team.city}</div>
                    <div className="team-card-name">{team.name}</div>
                    <div className="team-card-conf">East · {team.id}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="section-header">
                <span className="section-title">Western Conference</span>
                <span className="section-count">({west.length} teams)</span>
              </div>
              <div className="team-grid">
                {west.map((team) => (
                  <button
                    key={team.id}
                    className="team-card"
                    onClick={() => handleSelect(team.id)}
                  >
                    <div className="team-card-city">{team.city}</div>
                    <div className="team-card-name">{team.name}</div>
                    <div className="team-card-conf">West · {team.id}</div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
