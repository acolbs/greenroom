/**
 * Copies prospect + NBA PNGs into web/public/headshots and regenerates
 * web/src/data/headshotIndex.json (normalized-name → public path).
 *
 * Run from repo root: node scripts/sync-headshots.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** e.g. Chris_Cenac_Jr. → "Chris Cenac Jr." → normalized key */
function fileStemToLookupKey(stem) {
  return normalizeName(stem.split("_").join(" "));
}

function buildMap(sourceDir, publicPrefix) {
  const map = Object.create(null);
  if (!fs.existsSync(sourceDir)) {
    console.warn(`Missing folder (skip): ${sourceDir}`);
    return map;
  }
  const files = fs.readdirSync(sourceDir);
  for (const f of files) {
    if (!f.toLowerCase().endsWith(".png")) continue;
    const stem = f.slice(0, -4);
    const key = fileStemToLookupKey(stem);
    if (!key) continue;
    if (map[key]) {
      console.warn(`Duplicate headshot key "${key}" (${map[key]} vs ${f}) — keeping first`);
      continue;
    }
    map[key] = `${publicPrefix}/${f}`;
  }
  return map;
}

const prospectSrc = path.join(ROOT, "prospect_headshots");
const nbaSrc = path.join(ROOT, "nba_headshots");
const prospectDest = path.join(ROOT, "web", "public", "headshots", "prospects");
const nbaDest = path.join(ROOT, "web", "public", "headshots", "nba");

fs.mkdirSync(prospectDest, { recursive: true });
fs.mkdirSync(nbaDest, { recursive: true });

if (fs.existsSync(prospectSrc)) {
  fs.cpSync(prospectSrc, prospectDest, { recursive: true });
  console.log(`Copied prospects → ${path.relative(ROOT, prospectDest)}`);
} else {
  console.warn(`No ${prospectSrc}`);
}

if (fs.existsSync(nbaSrc)) {
  fs.cpSync(nbaSrc, nbaDest, { recursive: true });
  console.log(`Copied NBA → ${path.relative(ROOT, nbaDest)}`);
} else {
  console.warn(`No ${nbaSrc}`);
}

const index = {
  nba: buildMap(nbaDest, "headshots/nba"),
  prospects: buildMap(prospectDest, "headshots/prospects"),
};

const outPath = path.join(ROOT, "web", "src", "data", "headshotIndex.json");
fs.writeFileSync(outPath, JSON.stringify(index, null, 0) + "\n", "utf8");
console.log(
  `Wrote ${outPath} (nba: ${Object.keys(index.nba).length}, prospects: ${Object.keys(index.prospects).length})`
);
