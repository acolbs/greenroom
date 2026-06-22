// ---------------------------------------------------------------------------
// Archetype registry — the single source of truth for player archetypes.
//
// The canonical OFF/DEF lists below drive EVERYTHING archetype-related:
//   • the OffensiveArchetype / DefensiveRole union types (derived, not hand-written)
//   • the CSV parser's accepted set        (csvUtils.ts)
//   • the talent-value multipliers          (prospectRanking.ts)
//   • the playstyle descriptions            (PlayerDetailModal.tsx)
//   • the short display labels              (BlueprintSlotTracker.tsx)
//
// Because the value/description/label tables are full `Record<Union, …>` maps,
// adding an archetype here without giving it a value, description, and label is
// a COMPILE error — drift can't silently creep back in.
//
// The Python model (scripts/) emits a deliberate SUBSET of these (it merges
// Post Scorer → Roll + Cut Big and Slasher → Athletic Finisher, and never
// predicts "Low Minute"); see scripts/prospect_data.py.
// ---------------------------------------------------------------------------

export const OFFENSIVE_ARCHETYPES = [
  "Primary Ball Handler",
  "Secondary Ball Handler",
  "Shot Creator",
  "Movement Shooter",
  "Stationary Shooter",
  "Off Screen Shooter",
  "Athletic Finisher",
  "Slasher",
  "Roll + Cut Big",
  "Stretch Big",
  "Versatile Big",
  "Post Scorer",
  "Low Minute",
] as const;

export const DEFENSIVE_ROLES = [
  "Point of Attack",
  "Wing Stopper",
  "Chaser",
  "Helper",
  "Mobile Big",
  "Anchor Big",
  "Low Activity",
] as const;

export type OffensiveArchetype = (typeof OFFENSIVE_ARCHETYPES)[number];
export type DefensiveRole = (typeof DEFENSIVE_ROLES)[number];

export const OFFENSIVE_ARCHETYPE_SET: ReadonlySet<string> = new Set(OFFENSIVE_ARCHETYPES);
export const DEFENSIVE_ROLE_SET: ReadonlySet<string> = new Set(DEFENSIVE_ROLES);

// ---------------------------------------------------------------------------
// Talent-value multipliers (relative scarcity / impact of the archetype).
// ---------------------------------------------------------------------------
export const OFFENSIVE_VALUE: Record<OffensiveArchetype, number> = {
  "Primary Ball Handler": 1.12,
  "Shot Creator": 1.1,
  "Movement Shooter": 1.05,
  "Stationary Shooter": 1.03,
  "Secondary Ball Handler": 1.02,
  "Slasher": 0.98,
  "Athletic Finisher": 0.95,
  "Roll + Cut Big": 0.95,
  "Stretch Big": 0.93,
  "Off Screen Shooter": 0.92,
  "Versatile Big": 0.9,
  "Post Scorer": 0.85,
  "Low Minute": 0.7,
};

export const DEFENSIVE_VALUE: Record<DefensiveRole, number> = {
  "Point of Attack": 1.1,
  "Wing Stopper": 1.08,
  "Anchor Big": 1.03,
  "Mobile Big": 1.01,
  "Helper": 0.98,
  "Chaser": 0.95,
  "Low Activity": 0.8,
};

// ---------------------------------------------------------------------------
// Short display labels (kept terse so dense rows don't overflow).
// ---------------------------------------------------------------------------
export const OFF_SHORT_LABEL: Record<OffensiveArchetype, string> = {
  "Primary Ball Handler": "Ball Handler",
  "Secondary Ball Handler": "2nd Handler",
  "Shot Creator": "Shot Creator",
  "Movement Shooter": "Movement Shooter",
  "Stationary Shooter": "Spot-Up Shooter",
  "Off Screen Shooter": "Off-Screen",
  "Athletic Finisher": "Finisher",
  "Slasher": "Slasher",
  "Roll + Cut Big": "Roll/Cut Big",
  "Stretch Big": "Stretch Big",
  "Versatile Big": "Versatile Big",
  "Post Scorer": "Post Scorer",
  "Low Minute": "Low Minute",
};

export const DEF_SHORT_LABEL: Record<DefensiveRole, string> = {
  "Point of Attack": "POA Defender",
  "Wing Stopper": "Wing Stopper",
  "Chaser": "Chaser",
  "Helper": "Helper",
  "Mobile Big": "Mobile Big",
  "Anchor Big": "Anchor",
  "Low Activity": "Low Activity",
};

// ---------------------------------------------------------------------------
// Playstyle descriptions (shown in the player detail modal).
// ---------------------------------------------------------------------------
export const OFF_DESCRIPTIONS: Record<OffensiveArchetype, string> = {
  "Primary Ball Handler":
    "The engine the offense runs through. Initiates every action — probing defenses in pick-and-roll, attacking downhill off the dribble, and pulling up from mid-range. Capable of creating advantages for himself and breaking down schemes that leave teammates wide open.",
  "Secondary Ball Handler":
    "Provides meaningful ball handling relief without the pressure of being the primary initiator. Can run the offense in stretches, hit the pull-up mid-range in the two-man game, and keep defenses honest with playmaking at the elbows.",
  "Shot Creator":
    "Generates clean looks out of thin air — separation pull-ups, step-backs, and creative floaters that break down set defenses. The go-to option in late-shot-clock situations when the play breaks down, thriving in isolation and self-creation.",
  "Movement Shooter":
    "Reads off-ball action at an elite level — using screens, relocating, and firing on the catch without hesitation. Forces defenders to chase him across the entire court, opening driving lanes for teammates and punishing any lapse in coverage.",
  "Stationary Shooter":
    "A floor spacer who doesn't need to come off screens — he just stations himself beyond the arc and makes defenses pay for sagging. Instant and effortless release keeps closing out defenders off balance, stretching the defense and freeing up the paint.",
  "Off Screen Shooter":
    "A nightmare for opposing coaches to scheme around. Drills pin-down and stagger screens with precision timing, curling or fading based on how the defense plays it. Gets comfortable looks that look impossible on paper.",
  "Athletic Finisher":
    "Thrives at the rim using elite athleticism, body control, and instincts to convert above the defense. Doesn't need the ball in his hands — just put him in position and he delivers. Dangerous in transition, relentless in pick-and-roll dive situations, and strong enough to finish through contact.",
  "Slasher":
    "Gets to the basket at will. Explosive change of direction and first step make him nearly impossible to contain in straight-line drives and cutting situations. Draws fouls at a high rate and punishes packed-in defenses with finesse finishes and lobs.",
  "Roll + Cut Big":
    "Wins constantly on movement — rolling hard to the basket off hand-offs, cutting back-door when the defense sleeps, and converting in traffic around the rim. Doesn't need isolation touches, just reads the action and finishes with efficiency.",
  "Stretch Big":
    "Drags opposing bigs out of the paint and into uncomfortable territory. Capable of knocking down threes from the corners and elbows, creating driving lanes for slashing teammates and exploiting bigs who can't keep up on the perimeter.",
  "Versatile Big":
    "Difficult to game-plan against because of a well-rounded offensive arsenal. Can score in the post, step out to the mid-range, facilitate from the high post, and read pick-and-roll action from both handler and screener perspectives.",
  "Post Scorer":
    "A throwback scorer with polished footwork and touch around the basket. Punishes smaller defenders with size and physicality in the post, and reads double-teams to find cutters. Keeps opposing bigs honest and creates mismatches across the floor.",
  "Low Minute":
    "A rotation piece who provides reliable spot minutes without demanding usage. Efficient within a defined role, rarely forcing the action. The kind of player who keeps the machine running while starters rest.",
};

export const DEF_DESCRIPTIONS: Record<DefensiveRole, string> = {
  "Point of Attack":
    "Locks down opposing ball handlers on the perimeter with physical, intelligent defense. Studies opponents' tendencies, forces them to their weak hand, and sets the tone that every possession is a fight.",
  "Wing Stopper":
    "Assigned to the best perimeter scorer on the opposing team — capable of taking away shooters and slashers alike. Combines length, lateral quickness, and defensive IQ to make life miserable for star wings.",
  "Chaser":
    "A relentless on-ball pressure defender who pursues guards through screens and refuses to give up easy ground. Generates deflections and turnovers by staying chest-to-chest and reading the ball handler's eyes.",
  "Helper":
    "Reads the defense like a chess match — rotating early, taking charges, and filling gaps when teammates get beat. Rarely gambles but is always in the right spot to erase mistakes and protect the rim without fouling.",
  "Mobile Big":
    "Bridges the gap between interior and perimeter defense. Capable of switching onto guards in pick-and-roll and still contesting at the rim on the next possession. A rare combination that modern offenses struggle to exploit.",
  "Anchor Big":
    "The defensive backbone of the team — an imposing presence in the paint that alters shots, cleans up boards, and communicates rotations. Other defenders can gamble knowing he's behind them as the last line of protection.",
  "Low Activity":
    "Provides limited defensive output and is best protected in scheme. The offense is his calling card — teams accept the defensive trade-off knowing he produces on the other end.",
};
