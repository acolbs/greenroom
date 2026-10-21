import { useMemo, useState } from "react";
import { useSmoothNavigate } from "../hooks/useSmoothNavigate";
import { useSimulatorStore, selectPayroll } from "../store/simulatorStore";
import { TEAMS } from "../data/constants";
import { playerMatchKey } from "../data/csvUtils";
import type { ActualDraftPick, DraftProspect } from "../types/simulator";
import AppHeader from "../components/AppHeader";
import BlueprintOverlay from "../components/BlueprintOverlay";
import TeamLogo from "../components/TeamLogo";
import StageBadge from "../components/StageBadge";
import { blueprintById, blueprintLabel, blueprintNeeds, matchBlueprint } from "../lib/teamAnalysis";
import { fmtMoney, roleLabel } from "../lib/format";

function teamName(id: string): string {
  return TEAMS.find((t) => t.id === id)?.name ?? id;
}

function Delta({ before, after, invert }: { before: number; after: number; invert?: boolean }) {
  const d = after - before;
  if (d === 0) return <span className="muted">no change</span>;
  const good = invert ? d < 0 : d > 0;
  return <span className={good ? "delta-up" : "delta-down"}>{d > 0 ? "+" : ""}{d}</span>;
}

export default function ResultsPage() {
  const navigate = useSmoothNavigate();
  const teamId = useSimulatorStore((s) => s.selectedTeamId);
  const roster = useSimulatorStore((s) => s.roster);
  const seasonRoster = useSimulatorStore((s) => s.seasonRoster);
  const targetId = useSimulatorStore((s) => s.targetBlueprintId);
  const strength = useSimulatorStore((s) => s.teamStrength);
  const history = useSimulatorStore((s) => s.draftHistory);
  const draftClass = useSimulatorStore((s) => s.draftClass);
  const actual = useSimulatorStore((s) => s.actualDraft);
  const payroll = useSimulatorStore(selectPayroll);
  const reset = useSimulatorStore((s) => s.reset);

  const [showAll, setShowAll] = useState(false);

  const team = TEAMS.find((t) => t.id === teamId);
  const target = targetId ? blueprintById(targetId) : undefined;

  const before = useMemo(() => (target ? matchBlueprint(seasonRoster, target) : null), [seasonRoster, target]);
  const after = useMemo(() => (target ? matchBlueprint(roster, target) : null), [roster, target]);
  const needsBefore = target ? blueprintNeeds(seasonRoster, target).length : 0;
  const needsAfter = target ? blueprintNeeds(roster, target).length : 0;

  const prospectById = useMemo(() => new Map(draftClass.map((p) => [p.id, p])), [draftClass]);
  const actualByPick = useMemo(() => new Map(actual.map((a) => [a.pick, a])), [actual]);
  const actualByName = useMemo(() => new Map(actual.map((a) => [playerMatchKey(a.player), a])), [actual]);

  const rows = history.map((h) => {
    const sim = prospectById.get(h.prospectId);
    const real = actualByPick.get(h.pickNumber);
    const same = !!sim && !!real && playerMatchKey(sim.name) === playerMatchKey(real.player);
    return { pick: h.pickNumber, teamId: h.pickedBy, sim, real, same };
  });
  const myRows = rows.filter((r) => r.teamId === teamId);
  const exact = rows.filter((r) => r.same).length;
  // Real first-rounders the sim also took in round 1, regardless of slot.
  const simFirst = new Set(rows.filter((r) => r.pick <= 30 && r.sim).map((r) => playerMatchKey(r.sim!.name)));
  const firstOverlap = actual.filter((a) => a.pick <= 30 && simFirst.has(playerMatchKey(a.player))).length;

  function whereWent(p?: DraftProspect): ActualDraftPick | undefined {
    return p ? actualByName.get(playerMatchKey(p.name)) : undefined;
  }

  function startOver() {
    reset();
    navigate("/select-team");
  }

  if (!team) return null;

  return (
    <div className="page">
      <AppHeader />
      <main className="wrap">
        <div className="page-head">
          <div>
            <div className="eyebrow">Step 5 · Results</div>
            <h1 className="display h1" style={{ marginTop: "0.5rem" }}>{team.name} offseason</h1>
            <p className="lede">
              How close you got to the {target ? blueprintLabel(target) : "blueprint"}, and how your draft lines up with what
              really happened in June 2026.
            </p>
          </div>
          <button type="button" className="btn btn-lg" onClick={startOver}>Try another team</button>
        </div>

        <div className="stat-row">
          <div className="card stat">
            <div className="eyebrow">Blueprint match</div>
            <div className="stat__value">{after?.score ?? "–"}</div>
            <div className="stat__note">
              from {before?.score ?? "–"} · {before && after ? <Delta before={before.score} after={after.score} /> : null}
            </div>
          </div>
          <div className="card stat">
            <div className="eyebrow">Open roles</div>
            <div className="stat__value">{needsAfter}</div>
            <div className="stat__note">
              from {needsBefore} · <Delta before={needsBefore} after={needsAfter} invert />
            </div>
          </div>
          <div className="card stat">
            <div className="eyebrow">2026-27 payroll</div>
            <div className="stat__value">{fmtMoney(payroll)}</div>
            <div className="stat__note">{roster.length} players under contract</div>
          </div>
          <div className="card stat">
            <div className="eyebrow">Drafted as</div>
            <div style={{ marginTop: "0.6rem" }}><StageBadge label={strength.label} /></div>
            <div className="stat__note">{myRows.length} pick{myRows.length === 1 ? "" : "s"} made</div>
          </div>
        </div>

        {/* ── Your picks vs reality ─────────────────────────────────────── */}
        <section className="section">
          <div className="section-head">
            <div>
              <div className="eyebrow">Your picks vs the real draft</div>
              <h2 className="display h2">
                {myRows.length === 0
                  ? "You didn't have a pick"
                  : `${myRows.filter((r) => r.same).length} of ${myRows.length} matched the real pick`}
              </h2>
            </div>
          </div>
          {myRows.length > 0 && (
            <div className="card card--flush table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Pick</th>
                    <th>You took</th>
                    <th>Real pick at this slot</th>
                    <th>Where your player really went</th>
                  </tr>
                </thead>
                <tbody>
                  {myRows.map((r) => {
                    const went = whereWent(r.sim);
                    return (
                      <tr key={r.pick} className="is-user">
                        <td className="num">#{r.pick}</td>
                        <td>
                          <div className="cell-player__name">{r.sim?.name ?? "Unknown"}</div>
                          <div className="cell-player__sub">{r.sim ? roleLabel(r.sim) : ""}</div>
                        </td>
                        <td>
                          <div className="cell-player__name">{r.real?.player ?? "–"}</div>
                          <div className="cell-player__sub">{r.real?.school}</div>
                        </td>
                        <td>
                          {r.same ? (
                            <span className="tag tag--champ">Same pick</span>
                          ) : went ? (
                            <span className="num">#{went.pick} · {teamName(went.teamId)}</span>
                          ) : (
                            <span className="muted">Not drafted in 2026</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Whole-draft accuracy ──────────────────────────────────────── */}
        <section className="section">
          <div className="section-head">
            <div>
              <div className="eyebrow">Mock draft vs reality</div>
              <h2 className="display h2">
                {firstOverlap} of 30 real first-rounders went in the sim's first round
              </h2>
            </div>
            <span className="muted" style={{ fontSize: "0.88rem" }}>
              <span className="num">{exact}</span> of {rows.length} picks were the exact player at the exact slot.
            </span>
          </div>
          <div className="card card--flush table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Pick</th>
                  <th>Team</th>
                  <th>Sim pick</th>
                  <th>Real pick</th>
                  <th className="r">Match</th>
                </tr>
              </thead>
              <tbody>
                {(showAll ? rows : rows.slice(0, 14)).map((r) => (
                  <tr key={r.pick} className={r.teamId === teamId ? "is-user" : undefined}>
                    <td className="num muted">#{r.pick}</td>
                    <td>
                      <div className="cell-player">
                        <TeamLogo teamId={r.teamId} size={22} />
                        <span>{teamName(r.teamId)}</span>
                      </div>
                    </td>
                    <td>{r.sim?.name ?? "–"}</td>
                    <td>{r.real?.player ?? "–"}</td>
                    <td className="r">{r.same ? <span className="tag tag--champ">Exact</span> : whereWent(r.sim) ? <span className="footnote num">real #{whereWent(r.sim)!.pick}</span> : <span className="footnote">undrafted</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 14 && (
            <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: "0.6rem" }} onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show fewer" : `Show all ${rows.length} picks`}
            </button>
          )}
          <p className="footnote" style={{ marginTop: "0.6rem" }}>
            CPU teams take the best player left on the big board. Real teams also drafted for need, traded picks on draft
            night, and took a few players who aren't on the board.
          </p>
        </section>

        {/* ── Final blueprint overlay ───────────────────────────────────── */}
        {after && (
          <section className="section">
            <div className="section-head">
              <div>
                <div className="eyebrow">Your 2026-27 roster vs the blueprint</div>
                <h2 className="display h2">Final role match</h2>
              </div>
            </div>
            <BlueprintOverlay match={after} teamName={team.name} />
          </section>
        )}

        <div className="bottom-bar">
          <span className="footnote">Rosters, stats and contracts are from the 2025-26 season.</span>
          <button type="button" className="btn btn-primary btn-lg" onClick={startOver}>Try another team</button>
        </div>
      </main>
    </div>
  );
}
