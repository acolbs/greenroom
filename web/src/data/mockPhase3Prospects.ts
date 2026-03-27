/**
 * Five sample prospects for local UI testing (e.g. empty big_board.csv).
 * Shape matches `DraftProspect`. Remove or ignore once real CSV data loads.
 */
import type { DraftProspect } from "../types/simulator";

export const MOCK_PHASE3_PROSPECTS: DraftProspect[] = [
  {
    id: "mock-1",
    name: "Jordan Wing",
    school: "Test U",
    position: "SF",
    overallRank: 1,
    grade: 92,
    projectedArchetype: "Wing Stopper",
    csvOffensiveArchetype: "Movement Shooter",
    csvDefensiveRole: "Wing Stopper",
    fitNotes: "",
    archetypeFromCsv: true
  },
  {
    id: "mock-2",
    name: "Casey Creator",
    school: "Sample State",
    position: "SG",
    overallRank: 2,
    grade: 90,
    projectedArchetype: "Two-Way Wing",
    csvOffensiveArchetype: "Shot Creator",
    csvDefensiveRole: "Chaser",
    fitNotes: "",
    archetypeFromCsv: true
  },
  {
    id: "mock-3",
    name: "Pat Playmaker",
    school: "Demo Tech",
    position: "PG",
    overallRank: 3,
    grade: 88,
    projectedArchetype: "PG Playmaker",
    csvOffensiveArchetype: "Primary Ball Handler",
    csvDefensiveRole: "Point of Attack",
    fitNotes: "",
    archetypeFromCsv: true
  },
  {
    id: "mock-4",
    name: "Big Mo",
    school: "Rim College",
    position: "C",
    overallRank: 4,
    grade: 85,
    projectedArchetype: "Rim Protector",
    csvOffensiveArchetype: "Roll + Cut Big",
    csvDefensiveRole: "Anchor Big",
    fitNotes: "",
    archetypeFromCsv: true
  },
  {
    id: "mock-5",
    name: "Sam Stationary",
    school: "Corner U",
    position: "PF",
    overallRank: 5,
    grade: 82,
    projectedArchetype: "Stretch Big",
    csvOffensiveArchetype: "Stationary Shooter",
    csvDefensiveRole: "Helper",
    fitNotes: "",
    archetypeFromCsv: true
  }
];
