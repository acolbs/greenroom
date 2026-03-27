import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, "../top_teams");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".csv"));

function parsePct(s) {
  const n = parseFloat(String(s).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 50;
}

function parseLine(line) {
  const parts = [];
  let cur = "";
  let q = false;
  for (const c of line) {
    if (c === '"') {
      q = !q;
      continue;
    }
    if (c === "," && !q) {
      parts.push(cur);
      cur = "";
    } else cur += c;
  }
  parts.push(cur);
  return parts;
}

const off = {};
const def = {};
let n = 0;

for (const f of files) {
  const lines = fs.readFileSync(path.join(dir, f), "utf8").trim().split(/\r?\n/);
  const header = parseLine(lines[0]);
  const idx = (h) => header.indexOf(h);
  const iO = idx("O%");
  const iD = idx("D%");
  for (let i = 1; i < lines.length; i++) {
    const parts = parseLine(lines[i]);
    const get = (h) => {
      const j = idx(h);
      return j >= 0 ? String(parts[j] ?? "").trim() : "";
    };
    const oRole = get("Offensive Role");
    const dRole = get("Defensive Role");
    if (!oRole && !dRole) continue;
    const w = (parsePct(parts[iO]) + parsePct(parts[iD])) / 200;
    if (oRole) off[oRole] = (off[oRole] ?? 0) + w;
    if (dRole) def[dRole] = (def[dRole] ?? 0) + w;
    n++;
  }
}

function toSlots(m, slots) {
  const entries = Object.entries(m).filter(([, v]) => v > 0);
  const sum = entries.reduce((a, [, v]) => a + v, 0);
  const raw = entries.map(([k, v]) => [k, (v / sum) * slots]);
  const fl = raw.map(([k, v]) => [k, Math.floor(v), v - Math.floor(v)]);
  let rem = slots - fl.reduce((a, [, f]) => a + f, 0);
  fl.sort((a, b) => b[2] - a[2]);
  for (let i = 0; i < rem; i++) fl[i % fl.length][1]++;
  return Object.fromEntries(fl.map(([k, f]) => [k, f]));
}

const SLOTS = 9;
console.log("rows", n);
console.log("OFF", JSON.stringify(toSlots(off, SLOTS)));
console.log("DEF", JSON.stringify(toSlots(def, SLOTS)));
