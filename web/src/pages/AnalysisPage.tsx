import { useState } from "react";
import { useSmoothNavigate } from "../hooks/useSmoothNavigate";
import { useSimulatorStore } from "../store/simulatorStore";
import { TEAMS } from "../data/constants";
import type { TeamStrengthLabel } from "../types/simulator";
import AppHeader from "../components/AppHeader";
import StageBadge from "../components/StageBadge";
import StageMeter from "../components/StageMeter";
import BlueprintOverlay from "../components/BlueprintOverlay";
import PlayerAvatar from "../components/PlayerAvatar";
import TeamLogo from "../components/TeamLogo";
import { STAGE_PLAN, blueprintLabel, blueprintNeeds } from "../lib/teamAnalysis";
import { roleLabel } from "../lib/format";

const STAGES: TeamStrengthLabel[] = ["Contender", "Middle", "Rebuilding"];
const SHORT_LIST = 5;

export default function AnalysisPage() {
  const navigate = useSmoothNavigate();
  const teamId = useSimulatorStore((s) => s.selectedTeamId);
  const stage = useSimulatorStore((s) => s.stage);
  const override = useSimulatorStore((s) => s.stageOverride);
  const setStageOverride = useSimulatorStore((s) => s.setStageOverride);
  const ranking = useSimulatorStore((s) => s.blueprintRanking);
  const targetId = useSimulatorStore((s) => s.targetBlueprintId);
  const setTargetBlueprint = useSimulatorStore((s) => s.setTargetBlueprint);
  const comps = useSimulatorStore((s) => s.comps);
  const seasonRoster = useSimulatorStore((s) => s.seasonRoster);
  const phase = useSimulatorStore((s) => s.phase);
  const advanceToPhase = useSimulatorStore((s) => s.advanceToPhase);

  const [showAll, setShowAll] = useState(false);

  const team = TEAMS.find((t) => t.id === teamId);
  if (!team || !stage) return null;

  const label = override ?? stage.label;
  const target = ranking.find((r) => r.blueprint.id === targetId) ?? ranking[0];
  const best = ranking[0];
  const needs = target ? blueprintNeeds(seasonRoster, target.blueprint) : [];
  const list = showAll ? ranking : ranking.slice(0, SHORT_LIST);
  const leadComp = comps[0];

  function next() {
    if (phase === "ANALYSIS") advanceToPhase("FREE_AGENCY");
    navigate("/free-agency");
  }

  return (
    <div className="page">
      <AppHeader />
      <main className="wrap">
        {/* ── Verdict ─────────────────────────────────────────────────── */}
        <section className="verdict">
          <div>
            <div className="verdict__title">
              <TeamLogo teamId={team.id} size={44} />
              <div>
                <div className="eyebrow">Scouting report · 2025-26 roster</div>
                <h1 className="h3" style={{ marginTop: "0.2rem" }}>{team.city} {team.name}</h1>
              </div>
            </div>
            <div className={`verdict__stage stage--${label}`}>{label}</div>
            <p className="verdict__plan">{STAGE_PLAN[label]}</p>

            <div className="override">
              <span className="eyebrow">Treat as</span>
              <div className="segmented" role="group" aria-label="Override stage">
                <button type="button" aria-pressed={override === null} onClick={() => setStageOverride(null)}>
                  Auto
                </button>
                {STAGES.map((s) => (
                  <button key={s} type="button" aria-pressed={override === s} onClick={() => setStageOverride(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            {override && override !== stage.label && (
              <p className="footnote" style={{ marginTop: "0.6rem" }}>
                The numbers say {stage.label}. You're drafting as a {override}.
              </p>
            )}
          </div>

          <div className="card">
            <div className="eyebrow">Stage score</div>
            <StageMeter score={stage.score} label={stage.label} />
            <div className="factors">
              {stage.components.map((c) => (
                <div key={c.key} className="factor">
                  <div className="factor__label">
                    {c.label}
                    <small>{c.display}</small>
                  </div>
                  <div className="factor__bar"><div className="factor__fill" style={{ width: `${c.points}%` }} /></div>
                  <div className="factor__pts">
                    <b>{c.points}</b> × {Math.round(c.weight * 100)}% = {Math.round(c.points * c.weight)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Comps ───────────────────────────────────────────────────── */}
        <section className="section">
          <div className="section-head">
            <div>
              <div className="eyebrow">Player comps</div>
              <h2 className="display h2">
                {leadComp ? `${leadComp.player.name} plays like ${leadComp.comp.name}` : "Who your stars play like"}
              </h2>
            </div>
          </div>
          <div className="grid grid-3">
            {comps.map((c) => (
              <div key={c.player.id} className="card">
                <div className="comp">
                  <PlayerAvatar name={c.player.name} position={c.player.position} teamId={team.id} size={44} />
                  <div style={{ minWidth: 0 }}>
                    <div className="comp__name">{c.player.name}</div>
                    <div className="comp__role">{c.player.position} · {roleLabel(c.player)}</div>
                  </div>
                </div>
                <div className="comp__match">
                  <div style={{ minWidth: 0 }}>
                    <div className="comp__arrow">plays like</div>
                    <div className="comp__name">{c.comp.name}</div>
                    <div className="comp__role">
                      {blueprintLabel(c.blueprint)} · {c.comp.position} · {roleLabel(c.comp)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="num" style={{ fontWeight: 600 }}>{Math.round(c.similarity * 100)}%</div>
                    {c.blueprint.champion && <span className="tag tag--champ">Champion</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="footnote" style={{ marginTop: "0.75rem" }}>
            Match = 75% play style (usage, playmaking, shot profile, rebounding, defense and efficiency from that season's stats), 15% role, 10% position.
          </p>
        </section>

        {/* ── Blueprint ───────────────────────────────────────────────── */}
        <section className="section">
          <div className="section-head">
            <div>
              <div className="eyebrow">Blueprint</div>
              <h2 className="display h2">
                {best ? `Built most like the ${blueprintLabel(best.blueprint)}` : "Blueprints"}
              </h2>
            </div>
            <p className="muted" style={{ maxWidth: "46ch", fontSize: "0.88rem" }}>
              Pick the team you want to copy. Its roles you don't fill become your draft and free agency targets.
            </p>
          </div>

          <div className="bp-layout">
            <div className="bp-list">
              {list.map((r) => (
                <button
                  key={r.blueprint.id}
                  type="button"
                  className="bp-option"
                  aria-pressed={r.blueprint.id === target?.blueprint.id}
                  onClick={() => setTargetBlueprint(r.blueprint.id)}
                >
                  <span className="bp-option__name">{blueprintLabel(r.blueprint)}</span>
                  <span className="bp-option__score">{r.score}</span>
                  <span className="bp-option__meta">
                    {r.blueprint.champion ? <span className="tag tag--champ">Champion</span> : r.blueprint.result}
                  </span>
                </button>
              ))}
              {ranking.length > SHORT_LIST && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? "Show top 5" : `Show all ${ranking.length}`}
                </button>
              )}
            </div>

            {target && <BlueprintOverlay match={target} teamName={team.name} />}
          </div>

          {target && (
            <div className="card" style={{ marginTop: "1rem" }}>
              <div className="section-head" style={{ marginBottom: "0.75rem" }}>
                <div className="eyebrow">Roles to add to match the {blueprintLabel(target.blueprint)}</div>
                <span className="footnote">Before free agency, from the 2025-26 roster</span>
              </div>
              {needs.length === 0 ? (
                <p className="muted">Every role is covered. Draft for talent and depth.</p>
              ) : (
                <div className="needs">
                  {needs.map((n, i) => (
                    <span key={`${n.offensiveArchetype}-${n.defensiveRole}-${i}`} className="need">
                      <b>{n.offensiveArchetype}</b>
                      <span className="muted">/ {n.defensiveRole}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <div className="bottom-bar">
          <span className="muted" style={{ fontSize: "0.88rem" }}>
            Drafting as a <StageBadge label={label} />
            {target ? ` toward the ${blueprintLabel(target.blueprint)}` : ""}
          </span>
          <button type="button" className="btn btn-primary btn-lg" onClick={next}>
            Next: free agency
          </button>
        </div>
      </main>
    </div>
  );
}
