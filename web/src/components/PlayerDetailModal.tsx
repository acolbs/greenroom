import { motion, AnimatePresence } from "framer-motion";
import type {
  ExpiringContract,
  DraftProspect,
  RosterPlayer,
  OffensiveArchetype,
  DefensiveRole,
  RosterDeficit,
  ProspectCollegeStats,
} from "../types/simulator";
import { useSimulatorStore, selectPayroll } from "../store/simulatorStore";
import PlayerAvatar from "./PlayerAvatar";

export type ModalSubject = ExpiringContract | DraftProspect | RosterPlayer;

// ── Type guards ────────────────────────────────────────────────────────────

function isProspect(s: ModalSubject): s is DraftProspect {
  return "rank" in s;
}

function isFaPlayer(s: ModalSubject): s is ExpiringContract {
  return "playerId" in s;
}

function isRosterPlayerSubject(s: ModalSubject): s is RosterPlayer {
  return "teamAbbrev" in s;
}

// ── Playstyle descriptions ─────────────────────────────────────────────────

const OFF_DESCRIPTIONS: Record<OffensiveArchetype, string> = {
  "Athletic Finisher":
    "Thrives at the rim using elite athleticism, body control, and instincts to convert above the defense. Doesn't need the ball in his hands — just put him in position and he delivers. Dangerous in transition, relentless in pick-and-roll dive situations, and strong enough to finish through contact.",
  "Low Minute":
    "A rotation piece who provides reliable spot minutes without demanding usage. Efficient within a defined role, rarely forcing the action. The kind of player who keeps the machine running while starters rest.",
  "Movement Shooter":
    "Reads off-ball action at an elite level — using screens, relocating, and firing on the catch without hesitation. Forces defenders to chase him across the entire court, opening driving lanes for teammates and punishing any lapse in coverage.",
  "Off Screen Shooter":
    "A nightmare for opposing coaches to scheme around. Drills pin-down and stagger screens with precision timing, curling or fading based on how the defense plays it. Gets comfortable looks that look impossible on paper.",
  "Post Scorer":
    "A throwback scorer with polished footwork and touch around the basket. Punishes smaller defenders with size and physicality in the post, and reads double-teams to find cutters. Keeps opposing bigs honest and creates mismatches across the floor.",
  "Primary Ball Handler":
    "The engine the offense runs through. Initiates every action — probing defenses in pick-and-roll, attacking downhill off the dribble, and pulling up from mid-range. Capable of creating advantages for himself and breaking down schemes that leave teammates wide open.",
  "Roll + Cut Big":
    "Wins constantly on movement — rolling hard to the basket off hand-offs, cutting back-door when the defense sleeps, and converting in traffic around the rim. Doesn't need isolation touches, just reads the action and finishes with efficiency.",
  "Secondary Ball Handler":
    "Provides meaningful ball handling relief without the pressure of being the primary initiator. Can run the offense in stretches, hit the pull-up mid-range in the two-man game, and keep defenses honest with playmaking at the elbows.",
  "Shot Creator":
    "Generates clean looks out of thin air — separation pull-ups, step-backs, and creative floaters that break down set defenses. The go-to option in late-shot-clock situations when the play breaks down, thriving in isolation and self-creation.",
  "Slasher":
    "Gets to the basket at will. Explosive change of direction and first step make him nearly impossible to contain in straight-line drives and cutting situations. Draws fouls at a high rate and punishes packed-in defenses with finesse finishes and lobs.",
  "Stationary Shooter":
    "A floor spacer who doesn't need to come off screens — he just stations himself beyond the arc and makes defenses pay for sagging. Instant and effortless release keeps closing out defenders off balance, stretching the defense and freeing up the paint.",
  "Stretch Big":
    "Drags opposing bigs out of the paint and into uncomfortable territory. Capable of knocking down threes from the corners and elbows, creating driving lanes for slashing teammates and exploiting bigs who can't keep up on the perimeter.",
  "Versatile Big":
    "Difficult to game-plan against because of a well-rounded offensive arsenal. Can score in the post, step out to the mid-range, facilitate from the high post, and read pick-and-roll action from both handler and screener perspectives.",
};

const DEF_DESCRIPTIONS: Record<DefensiveRole, string> = {
  "Anchor Big":
    "The defensive backbone of the team — an imposing presence in the paint that alters shots, cleans up boards, and communicates rotations. Other defenders can gamble knowing he's behind them as the last line of protection.",
  "Chaser":
    "A relentless on-ball pressure defender who pursues guards through screens and refuses to give up easy ground. Generates deflections and turnovers by staying chest-to-chest and reading the ball handler's eyes.",
  "Helper":
    "Reads the defense like a chess match — rotating early, taking charges, and filling gaps when teammates get beat. Rarely gambles but is always in the right spot to erase mistakes and protect the rim without fouling.",
  "Low Activity":
    "Provides limited defensive output and is best protected in scheme. The offense is his calling card — teams accept the defensive trade-off knowing he produces on the other end.",
  "Mobile Big":
    "Bridges the gap between interior and perimeter defense. Capable of switching onto guards in pick-and-roll and still contesting at the rim on the next possession. A rare combination that modern offenses struggle to exploit.",
  "Point of Attack":
    "Locks down opposing ball handlers on the perimeter with physical, intelligent defense. Studies opponents' tendencies, forces them to their weak hand, and sets the tone that every possession is a fight.",
  "Wing Stopper":
    "Assigned to the best perimeter scorer on the opposing team — capable of taking away shooters and slashers alike. Combines length, lateral quickness, and defensive IQ to make life miserable for star wings.",
};

// ── Scout's Take logic ─────────────────────────────────────────────────────

type Verdict = "yes" | "lean" | "no" | "muted";

interface ScoutRecommendation {
  verdict: Verdict;
  label: string;
  headline: string;
  reasoning: string;
}

function fmt(n: number): string {
  return "$" + (n / 1_000_000).toFixed(1) + "M";
}

function fillsTeamNeed(contract: ExpiringContract, deficits: RosterDeficit[]): boolean {
  return deficits.some(
    (d) =>
      d.offensiveArchetype === contract.offensiveArchetype ||
      d.defensiveRole === contract.defensiveRole
  );
}

function getScoutRecommendation(
  contract: ExpiringContract,
  deficits: RosterDeficit[],
  payroll: number
): ScoutRecommendation {
  const isClub = contract.optionType === "Club";
  const needsPlayer = fillsTeamNeed(contract, deficits);
  const capLine = 165_000_000;
  const taxLine = 201_000_000;
  const overTax = payroll > taxLine;

  if (isClub && contract.optionSalary) {
    const market = contract.estimatedMarketSalary;
    const savings = market - contract.optionSalary;
    const savingsPct = savings / market;
    const savingsStr = fmt(Math.abs(savings));

    if (savingsPct > 0.25) {
      return {
        verdict: "yes",
        label: "Strong Value — Pick Up",
        headline: `${savingsStr} below market`,
        reasoning: `At ${fmt(contract.optionSalary)}, this club option is ${Math.round(savingsPct * 100)}% cheaper than his estimated market value of ${fmt(market)}. That's real cap leverage — you're locking in ${fmt(market)} production at a deep discount. ${needsPlayer ? "He also directly addresses a rotation need, making this a no-brainer." : "Pick it up before he hits open market."}`,
      };
    }
    if (savingsPct > 0.08) {
      return {
        verdict: "lean",
        label: "Good Value — Lean Pick Up",
        headline: `${savingsStr} savings vs market`,
        reasoning: `The option at ${fmt(contract.optionSalary)} comes in ${Math.round(savingsPct * 100)}% below his market estimate of ${fmt(market)}. Solid value — replacing this production at open-market prices would cost meaningfully more. ${needsPlayer ? "He fills a rotation need, which strengthens the case." : "The only reason to decline is if you have a specific free agent target in mind."}`,
      };
    }
    if (savingsPct < -0.10) {
      return {
        verdict: "no",
        label: "Overpay — Consider Declining",
        headline: `${savingsStr} above market`,
        reasoning: `The option at ${fmt(contract.optionSalary)} is ${Math.round(-savingsPct * 100)}% above his estimated market value of ${fmt(market)}. Declining frees up cap space that could go toward better value. ${needsPlayer ? "Despite the positional need, overpaying locks you into a bad deal for next season." : "Unless his locker-room presence is irreplaceable, the cap math doesn't work."}`,
      };
    }
    return {
      verdict: "muted",
      label: "Near Market Rate",
      headline: "No strong value signal",
      reasoning: `The option at ${fmt(contract.optionSalary)} is roughly in line with his market estimate of ${fmt(market)}. This becomes a fit decision, not a value one — ${needsPlayer ? "he does address a rotation deficit, which nudges the needle toward picking it up." : "weigh it against other offseason targets and your cap flexibility."}`,
    };
  }

  const market = contract.estimatedMarketSalary;
  const bpm = contract.stats.bpm;
  const signingPutsOverTax = payroll + market > taxLine;

  if (bpm >= 4 && market < 20_000_000) {
    return {
      verdict: "yes",
      label: "Priority Re-Sign",
      headline: "Elite value — don't let him walk",
      reasoning: `A +${bpm.toFixed(1)} BPM player asking for ${fmt(market)} is rare. High-impact, cost-controlled players don't last on the open market. Make him a priority re-sign before another team steps in. ${needsPlayer ? "He directly fills a rotation need on top of the value." : ""}`,
    };
  }
  if (bpm >= 2 && needsPlayer && !signingPutsOverTax) {
    return {
      verdict: "yes",
      label: "Re-Sign Recommended",
      headline: "Strong fit at fair value",
      reasoning: `A positive BPM and a direct fit with your rotation needs makes this a straightforward decision at ${fmt(market)}. You'd be paying fair market rate for a player who addresses a real gap in the lineup.`,
    };
  }
  if (bpm >= 2 && needsPlayer && signingPutsOverTax) {
    return {
      verdict: "lean",
      label: "Good Player, Cap Risk",
      headline: "Re-signing pushes into tax territory",
      reasoning: `The production warrants re-signing — a +${bpm.toFixed(1)} BPM player who fills a positional need — but at ${fmt(market)} you'd cross into luxury tax territory. If you can absorb the penalty, the fit justifies it; if not, explore tax-friendly alternatives.`,
    };
  }
  if (bpm < -1 && market > 10_000_000) {
    return {
      verdict: "no",
      label: "Let Him Walk",
      reasoning: `A ${bpm.toFixed(1)} BPM at ${fmt(market)} per year is difficult to justify. You'd be committing significant cap space to below-average production — that money is better deployed on a player who actually moves the needle.`,
      headline: "Negative value at this price",
    };
  }
  if (!needsPlayer && bpm < 1) {
    return {
      verdict: "no",
      label: "Not a Priority",
      headline: "Doesn't address a team need",
      reasoning: `The production is modest and he doesn't fill any of your priority rotation gaps. Re-signing is defensible as depth insurance, but don't sacrifice cap flexibility for a player who won't meaningfully upgrade the roster.`,
    };
  }
  if (overTax) {
    return {
      verdict: "muted",
      label: "Already Over Tax",
      headline: "Proceed with caution",
      reasoning: `You're already in luxury tax territory, so every additional dollar amplifies the penalty. If he's essential to your rotation, the cost is worth accepting. If he's depth, the tax math may not add up — look for cheaper alternatives.`,
    };
  }
  return {
    verdict: "muted",
    label: "Situation Dependent",
    headline: "No strong opinion either way",
    reasoning: `The value here is reasonable but not obvious. Re-signing is defensible, but so is exploring alternatives. Weigh his re-sign against your other offseason priorities — if cap space is tight, make sure you're not locking it up for a marginal upgrade.`,
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatBar({
  label,
  value,
  max,
  color,
  delay = 0,
}: {
  label: string;
  value: number;
  max: number;
  color?: string;
  delay?: number;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="pmodal-stat-bar">
      <div className="pmodal-stat-bar__header">
        <span className="pmodal-stat-bar__label">{label}</span>
        <span className="pmodal-stat-bar__val">{value.toFixed(1)}</span>
      </div>
      <div className="pmodal-stat-bar__track">
        <motion.div
          className="pmodal-stat-bar__fill"
          style={{ background: color ?? "var(--color-accent)" }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay }}
        />
      </div>
    </div>
  );
}

function GradeBar({ grade }: { grade: number }) {
  const pct = Math.min(100, Math.max(0, ((grade - 55) / (98 - 55)) * 100));
  return (
    <div className="pmodal-grade-wrap">
      <span className="pmodal-grade-val">{grade}</span>
      <div className="pmodal-grade-bar-wrap">
        <div className="pmodal-grade-bar-label">Scout Grade (55–98)</div>
        <div className="pmodal-grade-bar-track">
          <motion.div
            className="pmodal-grade-bar-fill"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          />
        </div>
      </div>
    </div>
  );
}

/** Prominent market value card used in FA and roster detail views. */
function MarketValueCard({
  value,
  note,
}: {
  value: number;
  note: string;
}) {
  return (
    <div className="market-value-card">
      <div className="market-value-card__label">Est. Market Value</div>
      <div className="market-value-card__val">{fmt(value)}</div>
      <div className="market-value-card__note">{note}</div>
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────

interface Props {
  subject: ModalSubject | null;
  onClose: () => void;
  teamId: string | null;
}

export default function PlayerDetailModal({ subject, onClose, teamId }: Props) {
  const subjectIsProspect = subject ? isProspect(subject) : false;
  const subjectIsFA = subject ? isFaPlayer(subject) : false;
  const subjectIsRoster = subject ? isRosterPlayerSubject(subject) : false;

  const headshotPool = subjectIsProspect
    ? "prospect"
    : subjectIsRoster && (subject as RosterPlayer).id.startsWith("draft-")
    ? "prospect"
    : "nba";

  const avatarTeamId = subjectIsFA
    ? teamId
    : subjectIsRoster
    ? (subject as RosterPlayer).teamAbbrev
    : null;

  return (
    <AnimatePresence>
      {subject && (
        <>
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />
          <div className="player-modal-wrapper">
            <motion.div
              className="player-modal"
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ type: "spring", stiffness: 360, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={`${subject.name} details`}
            >
              {/* Scan line */}
              <div className="player-modal__scan" />

              <button className="player-modal__close" onClick={onClose} aria-label="Close">
                ✕
              </button>

              <div className="player-modal__layout">
                {/* ── LEFT ── */}
                <div className="player-modal__left">
                  <div className="player-modal__avatar-wrap">
                    <PlayerAvatar
                      name={subject.name}
                      position={subject.position}
                      size={160}
                      headshotPool={headshotPool}
                      teamId={avatarTeamId}
                      school={subjectIsProspect ? (subject as DraftProspect).school : null}
                    />
                  </div>
                  <div className="player-modal__name">{subject.name}</div>
                  <div className="player-modal__meta-row">
                    <span className="card-pos">{subject.position}</span>
                    {!subjectIsProspect && (
                      <span className="player-modal__age">
                        Age {(subject as ExpiringContract | RosterPlayer).age}
                      </span>
                    )}
                  </div>
                  <div className="player-modal__arch">{subject.offensiveArchetype}</div>
                  <div className="player-modal__def">{subject.defensiveRole}</div>
                  {subjectIsProspect && (
                    <>
                      <div className="player-modal__school" style={{ marginTop: "0.5rem" }}>
                        {(subject as DraftProspect).school}
                      </div>
                      {(subject as DraftProspect).classYear ? (
                        <div
                          style={{
                            marginTop: "0.25rem",
                            fontSize: "0.78rem",
                            color: "var(--color-text-muted)",
                          }}
                        >
                          {(subject as DraftProspect).classYear}
                        </div>
                      ) : null}
                      <div className="player-modal__rank-large">
                        #{(subject as DraftProspect).rank}
                      </div>
                      <div className="player-modal__rank-label">Scout Rank</div>
                    </>
                  )}
                </div>

                {/* ── RIGHT ── */}
                <div className="player-modal__right">
                  <div className="player-modal__section-label">Offensive Profile</div>
                  <p className="player-modal__playstyle">
                    {OFF_DESCRIPTIONS[subject.offensiveArchetype]}
                  </p>
                  <div className="player-modal__section-label" style={{ marginTop: "1rem" }}>
                    Defensive Profile
                  </div>
                  <p className="player-modal__playstyle" style={{ marginBottom: "1.5rem" }}>
                    {DEF_DESCRIPTIONS[subject.defensiveRole]}
                  </p>

                  <div className="player-modal__divider" />

                  {subjectIsFA ? (
                    <FaPlayerRight contract={subject as ExpiringContract} />
                  ) : subjectIsRoster ? (
                    <RosterPlayerRight player={subject as RosterPlayer} />
                  ) : (
                    <ProspectRight prospect={subject as DraftProspect} />
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── FA player right panel ──────────────────────────────────────────────────

function FaPlayerRight({ contract }: { contract: ExpiringContract }) {
  const deficits = useSimulatorStore((s) => s.rosterDeficits);
  const payroll = useSimulatorStore(selectPayroll);

  const isClub = contract.optionType === "Club";
  const bpmColor =
    contract.stats.bpm >= 3
      ? "var(--color-accent)"
      : contract.stats.bpm < 0
      ? "var(--color-danger)"
      : "var(--color-text-muted)";
  const bpmSign = contract.stats.bpm >= 0 ? "+" : "";

  const take = getScoutRecommendation(contract, deficits, payroll);

  return (
    <>
      <div className="player-modal__section-label">Season Statistics</div>
      <div className="player-modal__stats">
        <StatBar label="Points Per Game"   value={contract.stats.pts}          max={38} delay={0.10} />
        <StatBar label="Rebounds Per Game" value={contract.stats.trb}          max={16} delay={0.17} />
        <StatBar label="Assists Per Game"  value={contract.stats.ast}          max={12} delay={0.24} />
        <StatBar label="True Shooting %"   value={contract.stats.tsPct * 100} max={75} color="var(--color-info)" delay={0.31} />
      </div>

      <div className="player-modal__chips">
        <div className="pmodal-chip">
          <span className="pmodal-chip__label">BPM</span>
          <span className="pmodal-chip__val" style={{ color: bpmColor }}>
            {bpmSign}{contract.stats.bpm.toFixed(1)}
          </span>
        </div>
        <div className="pmodal-chip">
          <span className="pmodal-chip__label">PTS</span>
          <span className="pmodal-chip__val">{contract.stats.pts.toFixed(1)}</span>
        </div>
        <div className="pmodal-chip">
          <span className="pmodal-chip__label">REB</span>
          <span className="pmodal-chip__val">{contract.stats.trb.toFixed(1)}</span>
        </div>
        <div className="pmodal-chip">
          <span className="pmodal-chip__label">AST</span>
          <span className="pmodal-chip__val">{contract.stats.ast.toFixed(1)}</span>
        </div>
        <div className="pmodal-chip">
          <span className="pmodal-chip__label">TS%</span>
          <span className="pmodal-chip__val">{(contract.stats.tsPct * 100).toFixed(1)}</span>
        </div>
      </div>

      <div className="player-modal__divider" />

      {/* Prominent market value */}
      <MarketValueCard
        value={contract.estimatedMarketSalary}
        note="AI estimate · based on production & market trends"
      />

      <div className="player-modal__section-label" style={{ marginTop: "1.25rem" }}>
        {isClub ? "Club Option" : "Free Agency"}
      </div>
      <div className="player-modal__contract">
        <div className="pmodal-contract-item">
          <span className="pmodal-contract-item__label">Current</span>
          <span className="pmodal-contract-item__val">{fmt(contract.currentSalary)}</span>
        </div>
        {isClub && contract.optionSalary ? (
          <div className="pmodal-contract-item">
            <span className="pmodal-contract-item__label">Option Salary</span>
            <span className="pmodal-contract-item__val pmodal-contract-item__val--accent">
              {fmt(contract.optionSalary)}
            </span>
          </div>
        ) : null}
      </div>

      <div className="player-modal__divider" />

      {/* Scout's Take */}
      <div className="player-modal__section-label">Scout's Take</div>
      <div className={`scout-take scout-take--${take.verdict}`}>
        <div className="scout-take__verdict">{take.label}</div>
        <div className="scout-take__headline">{take.headline}</div>
        <p className="scout-take__reasoning">{take.reasoning}</p>
      </div>
    </>
  );
}

// ── Roster player right panel ──────────────────────────────────────────────

function RosterPlayerRight({ player }: { player: RosterPlayer }) {
  const isRookie = player.id.startsWith("draft-");
  const bpmColor =
    player.stats.bpm >= 3
      ? "var(--color-accent)"
      : player.stats.bpm < 0
      ? "var(--color-danger)"
      : "var(--color-text-muted)";
  const bpmSign = player.stats.bpm >= 0 ? "+" : "";

  return (
    <>
      {!isRookie && (
        <>
          <div className="player-modal__section-label">Season Statistics</div>
          <div className="player-modal__stats">
            <StatBar label="Points Per Game"   value={player.stats.pts}          max={38} delay={0.10} />
            <StatBar label="Rebounds Per Game" value={player.stats.trb}          max={16} delay={0.17} />
            <StatBar label="Assists Per Game"  value={player.stats.ast}          max={12} delay={0.24} />
            <StatBar label="True Shooting %"   value={player.stats.tsPct * 100} max={75} color="var(--color-info)" delay={0.31} />
          </div>
          <div className="player-modal__chips">
            <div className="pmodal-chip">
              <span className="pmodal-chip__label">BPM</span>
              <span className="pmodal-chip__val" style={{ color: bpmColor }}>
                {bpmSign}{player.stats.bpm.toFixed(1)}
              </span>
            </div>
            <div className="pmodal-chip">
              <span className="pmodal-chip__label">PTS</span>
              <span className="pmodal-chip__val">{player.stats.pts.toFixed(1)}</span>
            </div>
            <div className="pmodal-chip">
              <span className="pmodal-chip__label">REB</span>
              <span className="pmodal-chip__val">{player.stats.trb.toFixed(1)}</span>
            </div>
            <div className="pmodal-chip">
              <span className="pmodal-chip__label">AST</span>
              <span className="pmodal-chip__val">{player.stats.ast.toFixed(1)}</span>
            </div>
            <div className="pmodal-chip">
              <span className="pmodal-chip__label">TS%</span>
              <span className="pmodal-chip__val">{(player.stats.tsPct * 100).toFixed(1)}</span>
            </div>
          </div>
          <div className="player-modal__divider" />
        </>
      )}

      {/* Prominent market value */}
      <MarketValueCard
        value={player.estimatedMarketSalary}
        note="AI estimate · based on production & market trends"
      />

      <div className="player-modal__section-label" style={{ marginTop: "1.25rem" }}>
        Contract
      </div>
      <div className="player-modal__contract">
        <div className="pmodal-contract-item">
          <span className="pmodal-contract-item__label">
            {isRookie ? "Rookie Salary" : "Current Salary"}
          </span>
          <span className="pmodal-contract-item__val pmodal-contract-item__val--accent">
            {fmt(player.currentSalary)}
          </span>
        </div>
      </div>
    </>
  );
}

// ── Prospect right panel ───────────────────────────────────────────────────

function ProspectCollegeStatsPanel({ s }: { s: ProspectCollegeStats }) {
  const tsDisplay = s.tsPct * 100;
  const metaParts = [
    s.seasonYear && s.seasonYear !== "—" ? s.seasonYear : null,
    s.teamAbbr || null,
    s.confAbbr ? s.confAbbr : null,
    s.games > 0 ? `${s.games} GP` : null,
    s.mpPerGame > 0 ? `${s.mpPerGame.toFixed(1)} MPG` : null,
  ].filter(Boolean);

  return (
    <>
      <div className="player-modal__section-label">Season Statistics</div>
      {metaParts.length > 0 && (
        <p
          className="player-modal__salary-note"
          style={{ marginTop: 0, marginBottom: "0.75rem" }}
        >
          {metaParts.join(" · ")}
          {s.classYear ? ` · ${s.classYear}` : ""}
        </p>
      )}
      <div className="player-modal__stats">
        <StatBar label="Points Per Game" value={s.pts} max={38} delay={0.1} />
        <StatBar label="Rebounds Per Game" value={s.trb} max={16} delay={0.17} />
        <StatBar label="Assists Per Game" value={s.ast} max={12} delay={0.24} />
        <StatBar
          label="True Shooting %"
          value={tsDisplay}
          max={75}
          color="var(--color-info)"
          delay={0.31}
        />
      </div>

      <div className="player-modal__chips">
        <div className="pmodal-chip">
          <span className="pmodal-chip__label">PTS</span>
          <span className="pmodal-chip__val">{s.pts.toFixed(1)}</span>
        </div>
        <div className="pmodal-chip">
          <span className="pmodal-chip__label">REB</span>
          <span className="pmodal-chip__val">{s.trb.toFixed(1)}</span>
        </div>
        <div className="pmodal-chip">
          <span className="pmodal-chip__label">AST</span>
          <span className="pmodal-chip__val">{s.ast.toFixed(1)}</span>
        </div>
        <div className="pmodal-chip">
          <span className="pmodal-chip__label">TS%</span>
          <span className="pmodal-chip__val">{tsDisplay.toFixed(1)}</span>
        </div>
        <div className="pmodal-chip">
          <span className="pmodal-chip__label">STL</span>
          <span className="pmodal-chip__val">{s.stl.toFixed(1)}</span>
        </div>
      </div>
    </>
  );
}

function ProspectRight({ prospect }: { prospect: DraftProspect }) {
  const s = prospect.collegeStats;

  return (
    <>
      <div className="player-modal__section-label">Scout Grade</div>
      <GradeBar grade={prospect.grade} />

      {prospect.notes && (
        <>
          <div className="player-modal__section-label" style={{ marginTop: "1.25rem" }}>
            Scout Notes
          </div>
          <p className="player-modal__playstyle">{prospect.notes}</p>
        </>
      )}

      <div className="player-modal__divider" />

      {s ? (
        <ProspectCollegeStatsPanel s={s} />
      ) : (
        <>
          <div className="player-modal__section-label">Season Statistics</div>
          <div className="player-modal__no-stats">College statistics not yet available</div>
        </>
      )}

      <div className="player-modal__divider" />

      {/* Prominent market value for prospects */}
      <div className="market-value-card market-value-card--prospect">
        <div className="market-value-card__label">Est. Rookie Contract</div>
        <div className="market-value-card__val">{fmt(prospect.projectedSalary)}</div>
        <div className="market-value-card__note">AI estimate · based on scout grade formula</div>
      </div>
    </>
  );
}
