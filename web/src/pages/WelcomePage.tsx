import { useSmoothNavigate } from "../hooks/useSmoothNavigate";
import AppHeader from "../components/AppHeader";
import StageBadge from "../components/StageBadge";
import { BLUEPRINT_TEAMS } from "../lib/teamAnalysis";

const STAGE_RULES = [
  { label: "Contender", rule: "Draft for fit. Fill the roles your closest past team had and you don't." },
  { label: "Middle", rule: "Balance both. Take fit when the talent is close, talent when it isn't." },
  { label: "Rebuilding", rule: "Best player available. Talent first, fit can wait." },
] as const;

const champions = BLUEPRINT_TEAMS.filter((b) => b.champion).length;

export default function WelcomePage() {
  const navigate = useSmoothNavigate();

  return (
    <div className="page">
      <AppHeader />
      <main className="wrap">
        <section className="hero">
          <div>
            <div className="eyebrow">2026 NBA offseason · pre-draft rosters</div>
            <h1 className="display hero__title" style={{ marginTop: "1rem" }}>
              Run the 2026 <em>offseason</em>
            </h1>
            <p className="lede">
              Pick a team. Greenroom reads its 2025-26 roster, decides whether it's a contender, in
              the middle, or rebuilding, and finds the past contender its roster is closest to. Then you
              make the free agency and draft calls.
            </p>
            <div className="hero__cta">
              <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate("/select-team")}>
                Choose a team
              </button>
            </div>
          </div>

          <div className="card">
            <div className="eyebrow">How your stage changes the draft</div>
            <div className="rule-list">
              {STAGE_RULES.map((r) => (
                <div key={r.label} className="rule">
                  <span><StageBadge label={r.label} /></span>
                  <span>{r.rule}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="how">
          <div className="how__item">
            <div className="how__n">1 · Scouting report</div>
            <h2 className="h3" style={{ marginTop: "0.5rem" }}>Read the team</h2>
            <p>A stage score from star talent, last season's record and core age, plus who your best players play like.</p>
          </div>
          <div className="how__item">
            <div className="how__n">2 · Blueprint</div>
            <h2 className="h3" style={{ marginTop: "0.5rem" }}>Pick a model</h2>
            <p>
              Your rotation lined up role by role against {BLUEPRINT_TEAMS.length} recent contenders, {champions} of
              them champions. The roles you're missing become your draft targets.
            </p>
          </div>
          <div className="how__item">
            <div className="how__n">3 · Offseason</div>
            <h2 className="h3" style={{ marginTop: "0.5rem" }}>Run it, then check it</h2>
            <p>Re-sign or let players walk, draft in the real 2026 order, and compare your picks with what teams actually did.</p>
          </div>
        </section>

        <footer className="bottom-bar footnote">
          <span>Developed by Anthony Colby &amp; Ali Razfar</span>
          <span>Stats: 2025-26 regular season. Contracts: HoopsHype.</span>
        </footer>
      </main>
    </div>
  );
}
