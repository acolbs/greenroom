// Builds web/src/data/blueprintTeams.json from the 13 contender rosters in
// web/public/data/top_teams/. Run: node scripts/build_blueprints.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Papa from "../web/node_modules/papaparse/papaparse.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "web/public/data/top_teams");

// Season outcome + one-line identity for each roster file.
const META = {
  GSW_2022: { team: "Golden State Warriors", season: "2021-22", champion: true, result: "NBA Champion", identity: "Curry's off-ball gravity in a motion offense, with Draymond Green running a switchable defense." },
  DEN_2023: { team: "Denver Nuggets", season: "2022-23", champion: true, result: "NBA Champion", identity: "Jokić as the offensive hub, a deadly two-man game with Murray, and two-way wings around them." },
  BOS_2024: { team: "Boston Celtics", season: "2023-24", champion: true, result: "NBA Champion", identity: "Five-out spacing with two star wings, a stretch big, and guards who can guard anyone." },
  OKC_2025: { team: "Oklahoma City Thunder", season: "2024-25", champion: true, result: "NBA Champion", identity: "SGA's downhill scoring behind a swarming, turnover-forcing defense and two bigs." },
  DAL_2024: { team: "Dallas Mavericks", season: "2023-24", champion: false, result: "NBA Finals", identity: "Two elite creators (Dončić, Irving) surrounded by lob-catching bigs and corner shooters." },
  MIA_2023: { team: "Miami Heat", season: "2022-23", champion: false, result: "NBA Finals", identity: "Butler-led toughness, Bam Adebayo as the defensive hub, and shooters spread around them." },
  IND_2025: { team: "Indiana Pacers", season: "2024-25", champion: false, result: "NBA Finals", identity: "Haliburton-run pace and ball movement with a stretch big and a deep, balanced rotation." },
  MIN_2024: { team: "Minnesota Timberwolves", season: "2023-24", champion: false, result: "Conference Finals", identity: "Edwards' creation on top of elite size: Gobert anchoring, Towns spacing the floor." },
  NYK_2024: { team: "New York Knicks", season: "2023-24", champion: false, result: "Second Round", identity: "Brunson's isolation scoring backed by tough, rebounding wings and bigs." },
  PHI_2023: { team: "Philadelphia 76ers", season: "2022-23", champion: false, result: "Second Round", identity: "MVP Embiid as a post hub with Harden setting the table." },
  PHX_2022: { team: "Phoenix Suns", season: "2021-22", champion: false, result: "Second Round (64-18)", identity: "Paul and Booker's mid-range two-man game with Ayton as the roll man." },
  MEM_2022: { team: "Memphis Grizzlies", season: "2021-22", champion: false, result: "Second Round (56-26)", identity: "Morant's rim pressure, offensive rebounding, and Jaren Jackson Jr.'s shot blocking." },
  CLE_2025: { team: "Cleveland Cavaliers", season: "2024-25", champion: false, result: "Second Round (64-18)", identity: "A two-guard backcourt (Mitchell, Garland) in front of twin bigs Mobley and Allen." },
};


// Position and tier (1 = star, 2 = starter, 3 = rotation) for each player,
// so comps compare like with like. Keyed by roster file.
const PROFILE = {
  OKC_2025: { "Shai Gilgeous-Alexander": "PG1", "Jalen Williams": "SF1", "Isaiah Hartenstein": "C2", "Alex Caruso": "SG2", "Cason Wallace": "SG3", "Aaron Wiggins": "SG3", "Luguentz Dort": "SG2", "Chet Holmgren": "C1" },
  BOS_2024: { "Jayson Tatum": "SF1", "Derrick White": "SG2", "Kristaps Porzingis": "C2", "Al Horford": "C2", "Jrue Holiday": "PG2", "Jaylen Brown": "SG1", "Sam Hauser": "SF3", "Payton Pritchard": "PG3" },
  DEN_2023: { "Nikola Jokic": "C1", "Jamal Murray": "PG1", "Michael Porter Jr.": "SF2", "Aaron Gordon": "PF2", "Kentavious Caldwell-Pope": "SG2", "Bruce Brown": "SG3", "Christian Braun": "SG3", "Jeff Green": "PF3" },
  GSW_2022: { "Stephen Curry": "PG1", "Jordan Poole": "SG2", "Kevon Looney": "C3", "Klay Thompson": "SG2", "Andrew Wiggins": "SF2", "Draymond Green": "PF2", "Gary Payton II": "SG3", "Otto Porter Jr.": "SF3" },
  CLE_2025: { "Donovan Mitchell": "SG1", "Darius Garland": "PG2", "Evan Mobley": "PF1", "Jarrett Allen": "C2", "Max Strus": "SF3", "Isaac Okoro": "SF3", "De'Andre Hunter": "SF3", "Ty Jerome": "PG3" },
  IND_2025: { "Tyrese Haliburton": "PG1", "Pascal Siakam": "PF1", "Andrew Nembhard": "PG2", "Myles Turner": "C2", "Aaron Nesmith": "SF3", "Obi Toppin": "PF3", "T.J. McConnell": "PG3", "Bennedict Mathurin": "SG3" },
  DAL_2024: { "Luka Doncic": "PG1", "Kyrie Irving": "PG1", "P.J. Washington": "PF2", "Daniel Gafford": "C2", "Dereck Lively II": "C3", "Derrick Jones Jr.": "SF3", "Josh Green": "SG3", "Dante Exum": "PG3" },
  MIN_2024: { "Rudy Gobert": "C2", "Mike Conley": "PG2", "Anthony Edwards": "SG1", "Karl-Anthony Towns": "C1", "Naz Reid": "PF3", "Kyle Anderson": "PF3", "Nickeil Alexander-Walker": "SG3", "Jaden McDaniels": "SF2" },
  NYK_2024: { "Jalen Brunson": "PG1", "Julius Randle": "PF2", "OG Anunoby": "SF2", "Donte DiVincenzo": "SG2", "Josh Hart": "SF2", "Mitchell Robinson": "C3", "Isaiah Hartenstein": "C3", "Miles McBride": "PG3" },
  MIA_2023: { "Jimmy Butler": "SF1", "Bam Adebayo": "C1", "Tyler Herro": "SG2", "Caleb Martin": "SF3", "Gabe Vincent": "PG3", "Max Strus": "SG3", "Kyle Lowry": "PG3", "Kevin Love": "PF3" },
  PHI_2023: { "Joel Embiid": "C1", "James Harden": "PG1", "Tyrese Maxey": "PG2", "Tobias Harris": "PF2", "P.J. Tucker": "PF3", "De'Anthony Melton": "SG3", "Georges Niang": "PF3", "Paul Reed": "C3" },
  MEM_2022: { "Ja Morant": "PG1", "Desmond Bane": "SG2", "Jaren Jackson Jr.": "PF1", "Dillon Brooks": "SF2", "Steven Adams": "C2", "Tyus Jones": "PG3", "Brandon Clarke": "PF3", "De'Anthony Melton": "SG3" },
  PHX_2022: { "Chris Paul": "PG1", "Devin Booker": "SG1", "Mikal Bridges": "SF2", "Deandre Ayton": "C2", "Jae Crowder": "PF3", "Cam Johnson": "PF3", "Cameron Payne": "PG3", "JaVale McGee": "C3" },
};

const out = [];
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".csv")).sort()) {
  const key = f.match(/\(([A-Z]{3}_\d{4})\)/)?.[1];
  const meta = META[key];
  if (!meta) throw new Error(`No metadata for ${f}`);
  const rows = Papa.parse(fs.readFileSync(path.join(dir, f), "utf8"), { header: true, skipEmptyLines: true }).data;
  const players = rows.map((r) => {
    const name = r.Player.trim();
    const profile = PROFILE[key]?.[name];
    if (!profile) throw new Error(`No position/tier for ${name} (${key})`);
    return {
    name,
    position: profile.slice(0, -1),
    tier: Number(profile.slice(-1)),
    // One file spells the header "Offemsive Role".
    offensiveArchetype: (r["Offensive Role"] ?? r["Offemsive Role"]).trim(),
    defensiveRole: r["Defensive Role"].trim(),
    };
  });
  out.push({ id: key, abbrev: key.slice(0, 3), ...meta, players });
}

// Champions first, then by season (newest first).
out.sort((a, b) => Number(b.champion) - Number(a.champion) || b.season.localeCompare(a.season));
fs.writeFileSync(path.join(root, "web/src/data/blueprintTeams.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${out.length} blueprint teams`);
