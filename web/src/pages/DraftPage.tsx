import { useMemo, useState } from "react";
import { useSmoothNavigate } from "../hooks/useSmoothNavigate";
import { useSimulatorStore, selectCurrentUserPick, teamForPick, setCpuPickDelay } from "../store/simulatorStore";
import { rankProspectsForTeam, FIT_WEIGHT, type RankedProspect } from "../data/prospectRanking";
import { TEAMS, DRAFT_ORDER_2026 } from "../data/constants";
import type { DraftProspect, Position, RosterDeficit, TeamStrengthLabel } from "../types/simulator";
import AppHeader from "../components/AppHeader";
import PlayerAvatar from "../components/PlayerAvatar";
import PlayerDetailModal from "../components/PlayerDetailModal";
import TeamLogo from "../components/TeamLogo";
import StageBadge from "../components/StageBadge";
import ScoreCell from "../components/ScoreCell";
import { blueprintById, blueprintLabel } from "../lib/teamAnalysis";
import { roleLabel } from "../lib/format";

type Sort = "recommended" | "bigboard";
const POSITIONS: (Position | "ALL")[] = ["ALL", "PG", "SG", "SF", "PF", "C"];
const BOARD_LIMIT = 30;
const SPEEDS = [
  { label: "Normal", ms: 600 },
  { label: "Fast", ms: 120 },
];

/** Fit at or above this means the pick is about filling a blueprint role. */
const FIT_PICK = 40;

function matchedNeed(p: DraftProspect, needs: RosterDeficit[]): RosterDeficit | null {
  return (
    needs.find((n) => n.offensiveArchetype === p.offensiveArchetype && n.defensiveRole === p.defensiveRole) ??
    needs.find((n) => n.offensiveArchetype === p.offensiveArchetype || n.defensiveRole === p.defensiveRole) ??
    null
  );
}

function whyTag(p: RankedProspect) {
  return p.fitScore >= FIT_PICK ? <span className="tag tag--fit">Fit</span> : <span className="tag tag--bpa">Best available</span>;
}

/** One sentence on why this prospect is the pick for this team. */
function explain(p: RankedProspect, label: TeamStrengthLabel, needs: RosterDeficit[], bestTalent: RankedProspect): string {
  const need = matchedNeed(p, needs);
  const exact = need && need.offensiveArchetype === p.offensiveArchetype && need.defensiveRole === p.defensiveRole;
  const fitPart = need
    ? exact
      ? `fills your ${roleLabel(need)} need exactly`
      : `partly fills your ${roleLabel(need)} need`
    : "doesn't fill a blueprint need";

  if (p.id === bestTalent.id) {
    return `Highest talent left on the board (${p.valueScore}), and he ${fitPart}.`;
  }
  if (label === "Contender") {
    return `As a contender you weight fit ${Math.round(FIT_WEIGHT.Contender * 100)}%. He ${fitPart}, which outweighs the ${
      bestTalent.valueScore - p.valueScore
    }-point talent gap to ${bestTalent.name}.`;
  }
  return `He ${fitPart}, and his talent (${p.valueScore}) is close enough to ${bestTalent.name} (${bestTalent.valueScore}) to take the fit.`;
}

/** Blueprint needs grouped by role, e.g. two Anchor Bigs → one chip "×2". */
function groupNeeds(needs: RosterDeficit[]): { role: RosterDeficit; count: number }[] {
  const out = new Map<string, { role: RosterDeficit; count: number }>();
  for (const n of needs) {
    const k = roleLabel(n);
    const hit = out.get(k);
    if (hit) hit.count++;
    else out.set(k, { role: n, count: 1 });
  }
  return [...out.values()];
}

function NeedChips({ needs, small }: { needs: RosterDeficit[]; small?: boolean }) {
  if (needs.length === 0) return <span className="muted" style={{ fontSize: "0.88rem" }}>No open roles. You're drafting on talent.</span>;
  return (
    <>
      {groupNeeds(needs).map(({ role, count }) => (
        <span key={roleLabel(role)} className="need" style={small ? { fontSize: "0.78rem" } : undefined}>
          <b>{role.offensiveArchetype}</b>
          <span className="muted">/ {role.defensiveRole}</span>
          {count > 1 && <span className="num accent">×{count}</span>}
        </span>
      ))}
    </>
  );
}

// ── Setup ──────────────────────────────────────────────────────────────────

function DraftSetup() {
  const setUserPickNumbers = useSimulatorStore((s) => s.setUserPickNumbers);
  const startDraftSimulation = useSimulatorStore((s) => s.startDraftSimulation);
  const teamId = useSimulatorStore((s) => s.selectedTeamId);
  const strength = useSimulatorStore((s) => s.teamStrength);
  const targetId = useSimulatorStore((s) => s.targetBlueprintId);
  const needs = useSimulatorStore((s) => s.rosterDeficits);

  const team = TEAMS.find((t) => t.id === teamId);
  const target = targetId ? blueprintById(targetId) : undefined;
  const picks = useMemo(
    () => DRAFT_ORDER_2026.flatMap((id, i) => (id === teamId ? [i + 1] : [])),
    [teamId]
  );

  function start(ms: number) {
    setCpuPickDelay(ms);
    setUserPickNumbers(picks);
    startDraftSimulation();
  }

  return (
    <div className="grid grid-2" style={{ alignItems: "start" }}>
      <div className="card">
        <div className="eyebrow">Your picks in the real 2026 order</div>
        <div className="display h2" style={{ marginTop: "0.6rem" }}>
          {picks.length > 0 ? picks.map((p) => `#${p}`).join("  ") : "No picks"}
        </div>
        <p className="muted" style={{ marginTop: "0.75rem", fontSize: "0.9rem" }}>
          {picks.length > 0
            ? `${team?.name ?? "You"} pick ${picks.length === 1 ? "once" : `${picks.length} times`}. The other 29 teams take the best player left on the big board.`
            : `${team?.name ?? "Your team"} traded away both picks, so you'll watch all 60 play out.`}
        </p>
        <div style={{ display: "flex", gap: "0.6rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
          {SPEEDS.map((s, i) => (
            <button key={s.label} type="button" className={`btn ${i === 0 ? "btn-primary" : ""} btn-lg`} onClick={() => start(s.ms)}>
              {i === 0 ? "Start the draft" : "Start, fast CPU picks"}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="eyebrow">How you're drafting</div>
        <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
          <StageBadge label={strength.label} />
          <span className="num muted" style={{ fontSize: "0.85rem" }}>
            {Math.round(FIT_WEIGHT[strength.label] * 100)}% fit · {100 - Math.round(FIT_WEIGHT[strength.label] * 100)}% talent
          </span>
        </div>
        <p className="muted" style={{ marginTop: "0.75rem", fontSize: "0.9rem" }}>
          Fit means a prospect's role matches one the {target ? blueprintLabel(target) : "blueprint"} had and you don't.
        </p>
        <div className="needs" style={{ marginTop: "0.9rem" }}>
          <NeedChips needs={needs} />
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function DraftPage() {
  const navigate = useSmoothNavigate();
  const [sort, setSort] = useState<Sort>("recommended");
  const [pos, setPos] = useState<Position | "ALL">("ALL");
  const [detail, setDetail] = useState<DraftProspect | null>(null);

  const active = useSimulatorStore((s) => s.draftSimActive);
  const complete = useSimulatorStore((s) => s.draftSimComplete);
  const currentPick = useSimulatorStore((s) => s.draftCurrentPick);
  const totalPicks = useSimulatorStore((s) => s.draftTotalPicks);
  const userPicks = useSimulatorStore((s) => s.userPickNumbers);
  const available = useSimulatorStore((s) => s.draftAvailableProspects);
  const draftClass = useSimulatorStore((s) => s.draftClass);
  const history = useSimulatorStore((s) => s.draftHistory);
  const needs = useSimulatorStore((s) => s.rosterDeficits);
  const strength = useSimulatorStore((s) => s.teamStrength);
  const teamId = useSimulatorStore((s) => s.selectedTeamId);
  const userDraftPick = useSimulatorStore((s) => s.userDraftPick);
  const advanceToPhase = useSimulatorStore((s) => s.advanceToPhase);
  const phase = useSimulatorStore((s) => s.phase);
  const userPick = useSimulatorStore(selectCurrentUserPick);
  const userTurn = userPick !== null;

  const ranked = useMemo(() => rankProspectsForTeam(available, needs, strength), [available, needs, strength]);
  const byScore = useMemo(() => [...ranked].sort((a, b) => b.needsScore - a.needsScore), [ranked]);
  const byTalent = useMemo(() => [...ranked].sort((a, b) => b.valueScore - a.valueScore), [ranked]);
  const rec = byScore[0];

  const board = (sort === "recommended" ? byScore : [...ranked].sort((a, b) => a.rank - b.rank))
    .filter((p) => pos === "ALL" || p.position === pos)
    .slice(0, BOARD_LIMIT);

  const prospectById = useMemo(() => new Map(draftClass.map((p) => [p.id, p])), [draftClass]);
  const myPicks = history.filter((h) => h.pickedBy === teamId);
  const nextUserPick = userPicks.find((p) => p >= currentPick);
  const clockTeam = TEAMS.find((t) => t.id === (userTurn ? teamId : teamForPick(currentPick)));

  function finish() {
    if (phase === "DRAFT") advanceToPhase("COMPLETE");
    navigate("/results");
  }

  const started = active || complete;

  return (
    <div className="page">
      <PlayerDetailModal subject={detail} onClose={() => setDetail(null)} teamId={teamId} />
      <AppHeader />
      <main className="wrap">
        <div className="page-head">
          <div>
            <div className="eyebrow">Step 4 · 2026 NBA Draft</div>
            <h1 className="display h1" style={{ marginTop: "0.5rem" }}>The draft</h1>
            <p className="lede">
              Every prospect gets a talent score and a fit score. Your stage decides how they're mixed:{" "}
              <span className="num">{Math.round(FIT_WEIGHT[strength.label] * 100)}%</span> fit as a{" "}
              <StageBadge label={strength.label} />.
            </p>
          </div>
        </div>

        {!started ? (
          <DraftSetup />
        ) : (
          <div className="draft-layout">
            <section className="card card--flush">
              <div className="board-tools">
                <div className="segmented" role="group" aria-label="Sort board">
                  <button type="button" aria-pressed={sort === "recommended"} onClick={() => setSort("recommended")}>For your team</button>
                  <button type="button" aria-pressed={sort === "bigboard"} onClick={() => setSort("bigboard")}>Big board</button>
                </div>
                <label className="footnote" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  Position
                  <select className="select" value={pos} onChange={(e) => setPos(e.target.value as Position | "ALL")}>
                    {POSITIONS.map((p) => <option key={p} value={p}>{p === "ALL" ? "All" : p}</option>)}
                  </select>
                </label>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Prospect</th>
                      <th className="r hide-sm">Talent</th>
                      <th className="r hide-sm">Fit</th>
                      <th className="r">Score</th>
                      <th className="hide-sm">Why</th>
                      <th aria-label="Draft" />
                    </tr>
                  </thead>
                  <tbody>
                    {board.map((p) => (
                      <tr key={p.id} className="is-clickable" onClick={() => setDetail(p)}>
                        <td className="num muted">{p.rank}</td>
                        <td>
                          <div className="cell-player">
                            <PlayerAvatar name={p.name} position={p.position} size={32} headshotPool="prospect" school={p.school} />
                            <div style={{ minWidth: 0 }}>
                              <div className="cell-player__name">{p.name}</div>
                              <div className="cell-player__sub">{p.position} · {p.school}</div>
                              <div className="cell-player__sub">{roleLabel(p)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="r hide-sm"><ScoreCell value={p.valueScore} /></td>
                        <td className="r hide-sm"><ScoreCell value={p.fitScore} /></td>
                        <td className="r"><ScoreCell value={p.needsScore} accent /></td>
                        <td className="hide-sm">{whyTag(p)}</td>
                        <td className="r">
                          {userTurn && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                userDraftPick(p.id);
                              }}
                            >
                              Draft
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="footnote" style={{ padding: "0.75rem 1rem" }}>
                Score = talent × {100 - Math.round(FIT_WEIGHT[strength.label] * 100)}% + fit × {Math.round(FIT_WEIGHT[strength.label] * 100)}%, with fit
                scaled by talent so a low-talent fit can't jump a much better player. Showing the top {BOARD_LIMIT}.
              </p>
            </section>

            <aside className="sticky-side">
              {complete ? (
                <div className="card clock is-user">
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div className="eyebrow">Draft complete</div>
                    <div className="clock__team" style={{ marginTop: "0.3rem" }}>
                      {myPicks.length > 0 ? `You made ${myPicks.length} pick${myPicks.length > 1 ? "s" : ""}.` : "All 60 picks are in."}
                    </div>
                    <button type="button" className="btn btn-primary" style={{ marginTop: "0.9rem", width: "100%" }} onClick={finish}>
                      See results vs the real draft
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`card clock${userTurn ? " is-user" : ""}`}>
                  {clockTeam && <TeamLogo teamId={clockTeam.id} size={36} />}
                  <div>
                    <div className="clock__pick">
                      Pick {currentPick} of {totalPicks} · Round {currentPick <= 30 ? 1 : 2}
                    </div>
                    <div className="clock__team">{userTurn ? "You're on the clock" : `${clockTeam?.name ?? "CPU"} on the clock`}</div>
                  </div>
                  <span className="footnote num">{nextUserPick && !userTurn ? `You: #${nextUserPick}` : ""}</span>
                </div>
              )}

              {rec && !complete && (
                <div className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                    <span className="eyebrow">{userTurn ? "Recommended pick" : "Your board's top player"}</span>
                    {whyTag(rec)}
                  </div>
                  <div className="rec__name">{rec.name}</div>
                  <div className="cell-player__sub">{rec.position} · {rec.school} · {roleLabel(rec)}</div>
                  <p className="rec__why">{explain(rec, strength.label, needs, byTalent[0])}</p>
                  <div className="rec__split">
                    <div><small>Talent</small><span className="num">{rec.valueScore}</span></div>
                    <div><small>Fit</small><span className="num">{rec.fitScore}</span></div>
                    <div><small>Score</small><span className="num accent">{rec.needsScore}</span></div>
                  </div>
                  {userTurn && (
                    <button type="button" className="btn btn-primary" style={{ marginTop: "0.9rem", width: "100%" }} onClick={() => userDraftPick(rec.id)}>
                      Draft {rec.name}
                    </button>
                  )}
                </div>
              )}

              <div className="card">
                <div className="eyebrow">Open blueprint roles</div>
                <div className="needs" style={{ marginTop: "0.6rem" }}>
                  <NeedChips needs={needs} small />
                </div>
              </div>

              <div className="card">
                <div className="eyebrow">Pick log</div>
                <div className="log" style={{ marginTop: "0.5rem" }}>
                  {history.length === 0 && <p className="muted" style={{ fontSize: "0.85rem" }}>No picks yet.</p>}
                  {[...history].reverse().map((h) => {
                    const p = prospectById.get(h.prospectId);
                    const mine = h.pickedBy === teamId;
                    return (
                      <div key={h.pickNumber} className={`log__row${mine ? " is-user" : ""}`}>
                        <span className="num muted">#{h.pickNumber}</span>
                        <TeamLogo teamId={h.pickedBy} size={22} />
                        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p?.name ?? "Unknown"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
