import type {
  Archetype,
  DraftProspect,
  ExpiringContract,
  PlayerStats,
  RosterPlayer,
  Team
} from "../types/simulator";

/** Simulator salary cap (next-season style ceiling for the UI). */
export const SIMULATOR_SALARY_CAP = 165_000_000;

const archetypes: Archetype[] = [
  "PG Playmaker",
  "SG Shooter",
  "Wing Stopper",
  "Rim Protector",
  "Stretch Big",
  "Bench Spark",
  "Two-Way Wing"
];

const mkStats = (points: number, rebounds: number, assists: number, fgPct: number): PlayerStats => ({
  pointsPerGame: points,
  reboundsPerGame: rebounds,
  assistsPerGame: assists,
  fgPct
});

export const TEAMS: Team[] = [
  { id: "ATL", name: "Atlanta Hawks", primaryColor: "#E03A3E", secondaryColor: "#8A2BE2", salaryCap: SIMULATOR_SALARY_CAP },
  { id: "BOS", name: "Boston Celtics", primaryColor: "#007A33", secondaryColor: "#BA9653", salaryCap: SIMULATOR_SALARY_CAP },
  { id: "BKN", name: "Brooklyn Nets", primaryColor: "#000000", secondaryColor: "#FFFFFF", salaryCap: SIMULATOR_SALARY_CAP },
  { id: "CHI", name: "Chicago Bulls", primaryColor: "#CE1141", secondaryColor: "#0B0B0B", salaryCap: SIMULATOR_SALARY_CAP },
  { id: "CLE", name: "Cleveland Cavaliers", primaryColor: "#6F263D", secondaryColor: "#FFB81C", salaryCap: SIMULATOR_SALARY_CAP },
  { id: "DAL", name: "Dallas Mavericks", primaryColor: "#00538C", secondaryColor: "#B8C4CA", salaryCap: SIMULATOR_SALARY_CAP },
  { id: "DEN", name: "Denver Nuggets", primaryColor: "#0E2240", secondaryColor: "#FFB300", salaryCap: SIMULATOR_SALARY_CAP },
  { id: "DET", name: "Detroit Pistons", primaryColor: "#C8102E", secondaryColor: "#1D428A", salaryCap: SIMULATOR_SALARY_CAP },
  { id: "GSW", name: "Golden State Warriors", primaryColor: "#1D428A", secondaryColor: "#FFC72C", salaryCap: SIMULATOR_SALARY_CAP },
  { id: "HOU", name: "Houston Rockets", primaryColor: "#CE1141", secondaryColor: "#C4CED4", salaryCap: SIMULATOR_SALARY_CAP },
  { id: "IND", name: "Indiana Pacers", primaryColor: "#FDBB30", secondaryColor: "#002D62", salaryCap: SIMULATOR_SALARY_CAP },
  { id: "LAC", name: "LA Clippers", primaryColor: "#C8102E", secondaryColor: "#1D428A", salaryCap: SIMULATOR_SALARY_CAP },
  { id: "LAL", name: "Los Angeles Lakers", primaryColor: "#552583", secondaryColor: "#FDB927", salaryCap: SIMULATOR_SALARY_CAP },
  { id: "MEM", name: "Memphis Grizzlies", primaryColor: "#5D76A9", secondaryColor: "#E9573D", salaryCap: SIMULATOR_SALARY_CAP },
  { id: "MIA", name: "Miami Heat", primaryColor: "#98002E", secondaryColor: "#F9A01B", salaryCap: SIMULATOR_SALARY_CAP },
  { id: "MIL", name: "Milwaukee Bucks", primaryColor: "#00471B", secondaryColor: "#EEE1C6", salaryCap: SIMULATOR_SALARY_CAP },
  { id: "MIN", name: "Minnesota Timberwolves", primaryColor: "#0C2340", secondaryColor: "#77A639", salaryCap: SIMULATOR_SALARY_CAP },
  { id: "NOP", name: "New Orleans Pelicans", primaryColor: "#0C2340", secondaryColor: "#C8102E", salaryCap: SIMULATOR_SALARY_CAP },
  { id: "NYK", name: "New York Knicks", primaryColor: "#006BB6", secondaryColor: "#F58426", salaryCap: SIMULATOR_SALARY_CAP },
  { id: "OKC", name: "Oklahoma City Thunder", primaryColor: "#007AC1", secondaryColor: "#EF3B24", salaryCap: SIMULATOR_SALARY_CAP },
  { id: "ORL", name: "Orlando Magic", primaryColor: "#0077C8", secondaryColor: "#C8102E", salaryCap: SIMULATOR_SALARY_CAP },
  { id: "PHI", name: "Philadelphia 76ers", primaryColor: "#006BB6", secondaryColor: "#ED174C", salaryCap: SIMULATOR_SALARY_CAP },
  { id: "PHX", name: "Phoenix Suns", primaryColor: "#1D1160", secondaryColor: "#E56020", salaryCap: SIMULATOR_SALARY_CAP },
  { id: "POR", name: "Portland Trail Blazers", primaryColor: "#E03A3E", secondaryColor: "#000000", salaryCap: SIMULATOR_SALARY_CAP },
  { id: "SAC", name: "Sacramento Kings", primaryColor: "#5A2D82", secondaryColor: "#C8102E", salaryCap: SIMULATOR_SALARY_CAP },
  { id: "SAS", name: "San Antonio Spurs", primaryColor: "#C4CED4", secondaryColor: "#000000", salaryCap: SIMULATOR_SALARY_CAP },
  { id: "TOR", name: "Toronto Raptors", primaryColor: "#CE1141", secondaryColor: "#F5F5F5", salaryCap: SIMULATOR_SALARY_CAP },
  { id: "UTA", name: "Utah Jazz", primaryColor: "#002B5B", secondaryColor: "#F9A01B", salaryCap: SIMULATOR_SALARY_CAP },
  { id: "WAS", name: "Washington Wizards", primaryColor: "#002B5B", secondaryColor: "#E31837", salaryCap: SIMULATOR_SALARY_CAP },
  { id: "CHA", name: "Charlotte Hornets", primaryColor: "#00788C", secondaryColor: "#1D428A", salaryCap: SIMULATOR_SALARY_CAP }
];

export type TeamMock = {
  team: Team;
  roster: RosterPlayer[];
  expiringContracts: ExpiringContract[];
  // Optional: how much each archetype would be valued by default.
  archetypePriority: Partial<Record<Archetype, number>>;
  draftClass: DraftProspect[];
};

const BOS_ROSTER: RosterPlayer[] = [
  {
    id: "p-bos-1",
    name: "Noah North",
    position: "PG",
    archetype: "PG Playmaker",
    csvOffensiveArchetype: "Primary Ball Handler",
    csvDefensiveRole: "Point of Attack",
    stats: mkStats(18.2, 3.1, 8.6, 0.47),
    currentSalary: 15_000_000
  },
  {
    id: "p-bos-2",
    name: "Evan Edge",
    position: "SG",
    archetype: "SG Shooter",
    csvOffensiveArchetype: "Movement Shooter",
    csvDefensiveRole: "Chaser",
    stats: mkStats(14.3, 3.4, 2.1, 0.39),
    currentSalary: 12_000_000
  },
  {
    id: "p-bos-3",
    name: "Marcus Midrange",
    position: "SF",
    archetype: "Wing Stopper",
    csvOffensiveArchetype: "Shot Creator",
    csvDefensiveRole: "Wing Stopper",
    stats: mkStats(10.1, 5.0, 1.4, 0.46),
    currentSalary: 22_000_000
  },
  {
    id: "p-bos-4",
    name: "Riley Rimrunner",
    position: "PF",
    archetype: "Stretch Big",
    csvOffensiveArchetype: "Versatile Big",
    csvDefensiveRole: "Mobile Big",
    stats: mkStats(9.7, 6.2, 1.6, 0.36),
    currentSalary: 8_000_000
  },
  {
    id: "p-bos-5",
    name: "Sam Screen",
    position: "C",
    archetype: "Rim Protector",
    csvOffensiveArchetype: "Roll + Cut Big",
    csvDefensiveRole: "Anchor Big",
    stats: mkStats(12.6, 8.4, 1.2, 0.56),
    currentSalary: 9_000_000
  },
  {
    id: "p-bos-6",
    name: "Ben Blockton",
    position: "C",
    archetype: "Rim Protector",
    csvOffensiveArchetype: "Athletic Finisher",
    csvDefensiveRole: "Rim Protector",
    stats: mkStats(6.5, 7.9, 0.6, 0.52),
    currentSalary: 10_000_000
  },
  {
    id: "p-bos-7",
    name: "Jules Jumper",
    position: "SF",
    archetype: "Two-Way Wing",
    csvOffensiveArchetype: "Movement Shooter",
    csvDefensiveRole: "Point of Attack",
    stats: mkStats(11.8, 4.2, 2.0, 0.43),
    currentSalary: 9_000_000
  },
  {
    id: "p-bos-8",
    name: "KJ Corner",
    position: "SG",
    archetype: "Bench Spark",
    csvOffensiveArchetype: "Stationary Shooter",
    csvDefensiveRole: "Helper",
    stats: mkStats(8.2, 2.3, 1.5, 0.41),
    currentSalary: 11_000_000
  },
  {
    id: "p-bos-9",
    name: "Oscar Outlaw",
    position: "PF",
    archetype: "Stretch Big",
    csvOffensiveArchetype: "Stationary Shooter",
    csvDefensiveRole: "Helper",
    stats: mkStats(7.9, 5.1, 1.1, 0.35),
    currentSalary: 6_000_000
  },
  {
    id: "p-bos-10",
    name: "Gus Glue",
    position: "C",
    archetype: "Bench Spark",
    csvOffensiveArchetype: "Low Activity",
    csvDefensiveRole: "Helper",
    stats: mkStats(5.2, 3.8, 0.9, 0.48),
    currentSalary: 5_000_000
  }
];

const BOS_EXPIRING: ExpiringContract[] = [
  {
    playerId: "p-bos-3",
    name: "Marcus Midrange",
    position: "SF",
    currentSalary: 22_000_000,
    estimatedMarketSalary: 25_500_000,
    archetype: "Wing Stopper",
    csvOffensiveArchetype: "Shot Creator",
    csvDefensiveRole: "Wing Stopper",
    stats: mkStats(10.1, 5.0, 1.4, 0.46)
  },
  {
    playerId: "p-bos-4",
    name: "Riley Rimrunner",
    position: "PF",
    currentSalary: 8_000_000,
    estimatedMarketSalary: 10_200_000,
    archetype: "Stretch Big",
    csvOffensiveArchetype: "Versatile Big",
    csvDefensiveRole: "Mobile Big",
    stats: mkStats(9.7, 6.2, 1.6, 0.36)
  },
  {
    playerId: "p-bos-5",
    name: "Sam Screen",
    position: "C",
    currentSalary: 9_000_000,
    estimatedMarketSalary: 11_700_000,
    archetype: "Rim Protector",
    csvOffensiveArchetype: "Roll + Cut Big",
    csvDefensiveRole: "Anchor Big",
    stats: mkStats(12.6, 8.4, 1.2, 0.56)
  },
  {
    playerId: "p-bos-1", // expiring playmaker (to show multiple decisions)
    name: "Noah North",
    position: "PG",
    currentSalary: 15_000_000,
    estimatedMarketSalary: 18_900_000,
    archetype: "PG Playmaker",
    csvOffensiveArchetype: "Primary Ball Handler",
    csvDefensiveRole: "Point of Attack",
    stats: mkStats(18.2, 3.1, 8.6, 0.47)
  }
];

const BOS_PRIORITIES: Partial<Record<Archetype, number>> = {
  "Wing Stopper": 3,
  "Stretch Big": 2,
  "Rim Protector": 2,
  "PG Playmaker": 2
};

/** No placeholder prospects — the draft board comes from `big_board.csv` only. */
export const FALLBACK_DRAFT_CLASS: DraftProspect[] = [];

export const MOCK_TEAM_BY_ID: Record<string, TeamMock> = {
  BOS: {
    team: TEAMS.find((t) => t.id === "BOS")!,
    roster: BOS_ROSTER,
    expiringContracts: BOS_EXPIRING,
    archetypePriority: BOS_PRIORITIES,
    draftClass: FALLBACK_DRAFT_CLASS
  }
};

// A tiny helper if you want to add more teams quickly.
export const ALL_ARCHETYPES = archetypes;

