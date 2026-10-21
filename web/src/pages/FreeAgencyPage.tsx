import { useState } from "react";
import { useSmoothNavigate } from "../hooks/useSmoothNavigate";
import { useSimulatorStore, selectPayroll } from "../store/simulatorStore";
import type { ExpiringContract, FreeAgencyDecision, RosterDeficit } from "../types/simulator";
import { SALARY_CAP, LUXURY_TAX, FIRST_APRON, SECOND_APRON } from "../data/constants";
import AppHeader from "../components/AppHeader";
import PlayerAvatar from "../components/PlayerAvatar";
import PlayerDetailModal, { type ModalSubject } from "../components/PlayerDetailModal";
import { blueprintById, blueprintLabel } from "../lib/teamAnalysis";
import { fmtMoney, roleLabel } from "../lib/format";

const DECISION_LABEL: Record<FreeAgencyDecision, string> = {
  RE_SIGN: "Re-signed",
  LET_WALK: "Let walk",
  PICK_UP_OPTION: "Option picked up",
  DECLINE_OPTION: "Option declined",
};

/** "exact" when the player's role pair is a blueprint need, "partial" when one side matches. */
function needMatch(c: ExpiringContract, needs: RosterDeficit[]): "exact" | "partial" | null {
  let partial = false;
  for (const n of needs) {
    const off = n.offensiveArchetype === c.offensiveArchetype;
    const def = n.defensiveRole === c.defensiveRole;
    if (off && def) return "exact";
    if (off || def) partial = true;
  }
  return partial ? "partial" : null;
}

function ContractRow({
  c,
  decision,
  needs,
  teamId,
  onDecide,
  onUndo,
  onOpen,
}: {
  c: ExpiringContract;
  decision: FreeAgencyDecision | undefined;
  needs: RosterDeficit[];
  teamId: string | null;
  onDecide: (d: FreeAgencyDecision) => void;
  onUndo: () => void;
  onOpen: () => void;
}) {
  const isClub = c.optionType === "Club";
  const price = isClub && c.optionSalary ? c.optionSalary : c.estimatedMarketSalary;
  const fit = needMatch(c, needs);

  return (
    <div className={`fa-row${decision ? " is-decided" : ""}`}>
      <button type="button" onClick={onOpen} style={{ background: "none", border: 0, padding: 0 }} aria-label={`Open ${c.name}`}>
        <PlayerAvatar name={c.name} position={c.position} size={42} teamId={teamId} />
      </button>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={onOpen} className="cell-player__name" style={{ background: "none", border: 0, padding: 0, fontSize: "0.95rem" }}>
            {c.name}
          </button>
          {isClub && <span className="tag">Team option</span>}
          {c.playerOptedOut && <span className="tag">Opted out</span>}
          {fit === "exact" && <span className="tag tag--fit">Fills a need</span>}
          {fit === "partial" && <span className="tag">Partial fit</span>}
        </div>
        <div className="cell-player__sub">
          {c.position} · Age {c.age} · {roleLabel(c)}
        </div>
        <div className="cell-player__sub num">
          {c.stats.pts.toFixed(1)} pts · {c.stats.trb.toFixed(1)} reb · {c.stats.ast.toFixed(1)} ast · BPM {c.stats.bpm >= 0 ? "+" : ""}
          {c.stats.bpm.toFixed(1)}
        </div>
      </div>
      <div className="fa-row__money">
        <div className="num">{fmtMoney(price)}</div>
        <div className="footnote">{isClub ? "option" : c.isSalaryEstimate ? "est. ask" : "market value"}</div>
      </div>
      <div className="fa-row__actions">
        {decision ? (
          <>
            <span className="footnote" style={{ alignSelf: "center" }}>{DECISION_LABEL[decision]}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onUndo}>Undo</button>
          </>
        ) : isClub ? (
          <>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onDecide("PICK_UP_OPTION")}>Pick up</button>
            <button type="button" className="btn btn-sm" onClick={() => onDecide("DECLINE_OPTION")}>Decline</button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onDecide("RE_SIGN")}>Re-sign</button>
            <button type="button" className="btn btn-sm" onClick={() => onDecide("LET_WALK")}>Let walk</button>
          </>
        )}
      </div>
    </div>
  );
}

function CapPanel({ payroll }: { payroll: number }) {
  const ceiling = SECOND_APRON * 1.1;
  const at = (v: number) => `${Math.min(100, (v / ceiling) * 100)}%`;
  const over = payroll > SALARY_CAP;
  const status =
    payroll > SECOND_APRON ? "Over the second apron" : payroll > FIRST_APRON ? "Over the first apron" : payroll > LUXURY_TAX ? "Paying luxury tax" : over ? "Over the cap" : "Under the cap";

  return (
    <div className="card">
      <div className="eyebrow">2026-27 payroll</div>
      <div className="num" style={{ fontSize: "1.6rem", fontWeight: 600, marginTop: "0.3rem" }}>{fmtMoney(payroll)}</div>
      <div className="footnote">{status}</div>
      <div className="capbar" aria-hidden="true">
        <div className={`capbar__fill${payroll > LUXURY_TAX ? " is-over" : ""}`} style={{ width: at(payroll) }} />
        {[SALARY_CAP, LUXURY_TAX, FIRST_APRON, SECOND_APRON].map((v) => (
          <span key={v} className="capbar__tick" style={{ left: at(v) }} />
        ))}
      </div>
      <div className="kv"><span>Cap</span><span className="num">{fmtMoney(SALARY_CAP)}</span></div>
      <div className="kv"><span>Luxury tax</span><span className="num">{fmtMoney(LUXURY_TAX)}</span></div>
      <div className="kv"><span>First apron</span><span className="num">{fmtMoney(FIRST_APRON)}</span></div>
      <div className="kv"><span>Second apron</span><span className="num">{fmtMoney(SECOND_APRON)}</span></div>
    </div>
  );
}

export default function FreeAgencyPage() {
  const navigate = useSmoothNavigate();
  const roster = useSimulatorStore((s) => s.roster);
  const expiring = useSimulatorStore((s) => s.expiringContracts);
  const decisions = useSimulatorStore((s) => s.decisions);
  const needs = useSimulatorStore((s) => s.rosterDeficits);
  const targetId = useSimulatorStore((s) => s.targetBlueprintId);
  const makeFreeAgencyDecision = useSimulatorStore((s) => s.makeFreeAgencyDecision);
  const undo = useSimulatorStore((s) => s.undoFreeAgencyDecision);
  const advanceToPhase = useSimulatorStore((s) => s.advanceToPhase);
  const phase = useSimulatorStore((s) => s.phase);
  const payroll = useSimulatorStore(selectPayroll);
  const teamId = useSimulatorStore((s) => s.selectedTeamId);

  const [detail, setDetail] = useState<ModalSubject | null>(null);

  const target = targetId ? blueprintById(targetId) : undefined;
  const pending = expiring.filter((c) => decisions[c.playerId] === undefined).length;
  const options = expiring.filter((c) => c.optionType === "Club");
  const agents = expiring.filter((c) => c.optionType !== "Club");

  function next() {
    // Re-entering the draft resets it, so only advance the phase the first time.
    if (phase === "FREE_AGENCY") advanceToPhase("DRAFT");
    navigate("/draft");
  }

  const rowProps = (c: ExpiringContract) => ({
    c,
    decision: decisions[c.playerId],
    needs,
    teamId,
    onDecide: (d: FreeAgencyDecision) => makeFreeAgencyDecision(c.playerId, d),
    onUndo: () => undo(c.playerId),
    onOpen: () => setDetail(c),
  });

  return (
    <div className="page">
      <PlayerDetailModal subject={detail} onClose={() => setDetail(null)} teamId={teamId} />
      <AppHeader />
      <main className="wrap">
        <div className="page-head">
          <div>
            <div className="eyebrow">Step 3</div>
            <h1 className="display h1" style={{ marginTop: "0.5rem" }}>Free agency</h1>
            <p className="lede">
              Decide who comes back for 2026-27. Players tagged <span className="tag tag--fit">Fills a need</span> match a
              role the {target ? blueprintLabel(target) : "blueprint"} had that you're missing.
            </p>
          </div>
        </div>

        <div className="fa-layout">
          <div style={{ display: "grid", gap: "1.25rem" }}>
            {options.length > 0 && (
              <section className="card card--flush">
                <div className="board-tools"><h2 className="eyebrow">Team options · {options.length}</h2></div>
                {options.map((c) => <ContractRow key={c.playerId} {...rowProps(c)} />)}
              </section>
            )}
            <section className="card card--flush">
              <div className="board-tools"><h2 className="eyebrow">Expiring contracts · {agents.length}</h2></div>
              {agents.length === 0 ? (
                <p className="muted" style={{ padding: "1rem" }}>No expiring contracts on this roster.</p>
              ) : (
                agents.map((c) => <ContractRow key={c.playerId} {...rowProps(c)} />)
              )}
            </section>

            <div className="bottom-bar" style={{ marginTop: "0.5rem" }}>
              <span className="footnote">
                {pending > 0 ? `${pending} undecided. Anyone undecided leaves in free agency.` : "All decisions made."}
              </span>
              <button type="button" className="btn btn-primary btn-lg" onClick={next}>Next: draft</button>
            </div>
          </div>

          <aside className="sticky-side">
            <CapPanel payroll={payroll} />
            <div className="card">
              <div className="eyebrow">Under contract · {roster.length}</div>
              <div style={{ marginTop: "0.6rem" }}>
                {roster.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setDetail(p)}
                    className="kv"
                    style={{ width: "100%", background: "none", border: 0, textAlign: "left" }}
                  >
                    <span style={{ color: "var(--color-text)" }}>{p.name}</span>
                    <span className="num">{fmtMoney(p.currentSalary)}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
