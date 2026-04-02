import { motion, AnimatePresence } from "framer-motion";
import type { ExpiringContract, DraftProspect, OffensiveArchetype, DefensiveRole } from "../types/simulator";
import PlayerAvatar from "./PlayerAvatar";

export type ModalSubject = ExpiringContract | DraftProspect;

function isFaPlayer(s: ModalSubject): s is ExpiringContract {
  return "stats" in s;
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

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return "$" + (n / 1_000_000).toFixed(1) + "M";
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

// ── Main modal ─────────────────────────────────────────────────────────────

interface Props {
  subject: ModalSubject | null;
  onClose: () => void;
  teamId: string | null;
}

export default function PlayerDetailModal({ subject, onClose, teamId }: Props) {
  const isProspect = subject ? !isFaPlayer(subject) : false;
  const isFA = subject ? isFaPlayer(subject) : false;

  return (
    <AnimatePresence>
      {subject && (
        <>
          {/* Backdrop */}
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />

          {/* Centering wrapper — keeps modal centered without CSS transform conflict */}
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
              <button
                className="player-modal__close"
                onClick={onClose}
                aria-label="Close"
              >
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
                      headshotPool={isProspect ? "prospect" : "nba"}
                      teamId={isFA ? teamId : null}
                      school={isProspect ? (subject as DraftProspect).school : null}
                    />
                  </div>

                  <div className="player-modal__name">{subject.name}</div>

                  <div className="player-modal__meta-row">
                    <span className="card-pos">{subject.position}</span>
                    {isFA && (
                      <span className="player-modal__age">
                        Age {(subject as ExpiringContract).age}
                      </span>
                    )}
                  </div>

                  <div className="player-modal__arch">{subject.offensiveArchetype}</div>
                  <div className="player-modal__def">{subject.defensiveRole}</div>

                  {isProspect && (
                    <>
                      <div className="player-modal__school" style={{ marginTop: "0.5rem" }}>
                        {(subject as DraftProspect).school}
                      </div>
                      <div className="player-modal__rank-large">
                        #{(subject as DraftProspect).rank}
                      </div>
                      <div className="player-modal__rank-label">Scout Rank</div>
                    </>
                  )}
                </div>

                {/* ── RIGHT ── */}
                <div className="player-modal__right">
                  {/* Playstyle description */}
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

                  {isFA ? (
                    <FaPlayerRight contract={subject as ExpiringContract} />
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
  const isClub = contract.optionType === "Club";
  const bpmColor =
    contract.stats.bpm >= 3
      ? "var(--color-accent)"
      : contract.stats.bpm < 0
      ? "var(--color-danger)"
      : "var(--color-text-muted)";
  const bpmSign = contract.stats.bpm >= 0 ? "+" : "";

  return (
    <>
      <div className="player-modal__section-label">Season Statistics</div>
      <div className="player-modal__stats">
        <StatBar label="Points Per Game" value={contract.stats.pts} max={38} delay={0.1} />
        <StatBar label="Rebounds Per Game" value={contract.stats.trb} max={16} delay={0.17} />
        <StatBar label="Assists Per Game" value={contract.stats.ast} max={12} delay={0.24} />
        <StatBar
          label="True Shooting %"
          value={contract.stats.tsPct * 100}
          max={75}
          color="var(--color-info)"
          delay={0.31}
        />
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

      <div className="player-modal__section-label">
        {isClub ? "Club Option" : "Free Agency"}
      </div>
      <div className="player-modal__contract">
        <div className="pmodal-contract-item">
          <span className="pmodal-contract-item__label">Current</span>
          <span className="pmodal-contract-item__val">
            {fmt(contract.currentSalary)}
          </span>
        </div>
        {isClub && contract.optionSalary ? (
          <div className="pmodal-contract-item">
            <span className="pmodal-contract-item__label">Option</span>
            <span className="pmodal-contract-item__val pmodal-contract-item__val--accent">
              {fmt(contract.optionSalary)}
            </span>
          </div>
        ) : (
          <div className="pmodal-contract-item">
            <span className="pmodal-contract-item__label">Est. Market</span>
            <span className="pmodal-contract-item__val pmodal-contract-item__val--accent">
              {fmt(contract.estimatedMarketSalary)}
            </span>
          </div>
        )}
      </div>
      {contract.isSalaryEstimate && (
        <p className="player-modal__salary-note">Market estimate · may vary</p>
      )}
    </>
  );
}

// ── Prospect right panel ───────────────────────────────────────────────────

function ProspectRight({ prospect }: { prospect: DraftProspect }) {
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

      <div className="player-modal__section-label">Season Stats</div>
      <div className="player-modal__no-stats">
        College statistics not yet available
      </div>

      <div className="player-modal__divider" />

      <div className="player-modal__section-label">Projected Contract</div>
      <div className="player-modal__contract">
        <div className="pmodal-contract-item">
          <span className="pmodal-contract-item__label">Rookie Salary</span>
          <span className="pmodal-contract-item__val pmodal-contract-item__val--accent">
            {fmt(prospect.projectedSalary)}
          </span>
        </div>
      </div>
    </>
  );
}
