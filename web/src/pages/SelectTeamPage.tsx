import { useSmoothNavigate } from "../hooks/useSmoothNavigate";
import { TEAMS } from "../data/constants";
import { useSimulatorStore } from "../store/simulatorStore";
import NavBar from "../components/NavBar";
import TeamLogo from "../components/TeamLogo";

export default function SelectTeamPage() {
  const navigate = useSmoothNavigate();
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
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.6rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            marginBottom: "0.35rem",
          }}>
            Choose Your Franchise
          </h1>
          <p style={{ fontSize: "0.83rem", color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            You'll manage free agency and the draft for the 2026–27 season.
          </p>
        </div>

        {error && <div className="error-msg" style={{ marginBottom: "1.25rem" }}>{error}</div>}

        {loading ? (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
            padding: "5rem 0",
          }}>
            <span style={{ fontSize: "0.83rem", color: "var(--color-text-muted)" }}>
              Loading roster data…
            </span>
          </div>
        ) : (
          <>
            {[
              { label: "Eastern Conference", teams: east },
              { label: "Western Conference", teams: west },
            ].map(({ label, teams }) => (
              <div key={label} style={{ marginBottom: "2.5rem" }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  marginBottom: "1rem",
                }}>
                  <span style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                    color: "var(--color-text-muted)",
                  }}>
                    {label}
                  </span>
                  <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
                </div>

                <div className="team-grid">
                  {teams.map((team) => (
                    <button
                      key={team.id}
                      className="team-card"
                      onClick={() => handleSelect(team.id)}
                    >
                      <TeamLogo teamId={team.id} size={48} style={{ marginBottom: "0.625rem" }} />
                      <div className="team-card-city">{team.city}</div>
                      <div className="team-card-name">{team.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
