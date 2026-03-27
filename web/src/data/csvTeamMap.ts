/**
 * `master.csv` / `pergame.csv` use some abbreviations that differ from `TEAMS[].id`
 * in the simulator (e.g. Basketball-Reference BRK vs our BKN). Without this map,
 * those teams load almost no players and cap space looks wildly wrong.
 */
const CSV_ABBREV_TO_SIMULATOR_ID: Record<string, string> = {
  BRK: "BKN",
  CHO: "CHA",
  PHO: "PHX"
};

export function simulatorTeamIdFromCsvAbbrev(csvTeam: string): string {
  const key = csvTeam.trim().toUpperCase();
  return CSV_ABBREV_TO_SIMULATOR_ID[key] ?? key;
}
