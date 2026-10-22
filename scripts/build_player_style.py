"""Builds web/src/data/playerStyle.json: the play-style fingerprints behind
player comps and blueprint matching.

How it works (plain terms):

1. Features. 20 numbers describe how a player plays: usage, playmaking,
   turnovers, efficiency, impact (BPM), rebounding, steals, blocks, free
   throw rate, shot diet (rim / 3-10 ft / mid-range / three, average shot
   distance, corner threes, dunks), how often his makes are assisted, and
   his on-court position mix from play-by-play data.
2. Season-relative. Each feature becomes a z-score against that season's
   league (players with 500+ minutes), so a 2022 three-point rate is judged
   against 2022 shooters, not 2026 ones.
3. Small samples. Each z-score is shrunk toward league average by
   minutes / (minutes + 300), so 200 noisy minutes can't make a comp.
4. Distance. Weighted Euclidean distance between two fingerprints. The
   weights were tuned so that a player's next season is found as his own
   closest match as often as possible (trained on 2021-24 season pairs,
   checked on 2024-26 pairs). The script prints that check every run.
5. Percent match. 100% = as alike as a typical player is to himself one
   season later (median distance over every 1,000-minute player); 0% = no
   more alike than two random NBA players (median random-pair distance).
   The scale is linear in between and clipped to 0-100%.

Source: Basketball-Reference season tables, as mirrored at
github.com/sumitrodatta/bball-reference-datasets. Trimmed copies live in
scripts/data/bref/ so the build runs offline.

Run:
  python3 scripts/build_player_style.py                 # rebuild from scripts/data/bref
  python3 scripts/build_player_style.py --refresh DIR   # re-trim from the full dataset in DIR
  python3 scripts/build_player_style.py --tune          # re-tune weights (prints them)
"""

import argparse
import csv
import json
import math
import os
import random
import re
import unicodedata
from collections import defaultdict

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA = os.path.join(ROOT, "scripts", "data", "bref")
OUT = os.path.join(ROOT, "web", "src", "data", "playerStyle.json")
BLUEPRINTS = os.path.join(ROOT, "web", "src", "data", "blueprintTeams.json")

FIRST_SEASON = 2021
CURRENT_SEASON = 2026
POOL_MIN_MP = 500  # league baseline and comp candidates
TEST_MIN_MP = 1000  # players used in the same-player check
SHRINK_MP = 300

SOURCES = {
    "advanced": ("Advanced.csv", ["g", "mp", "usg_percent", "ast_percent", "tov_percent", "ts_percent", "bpm",
                                  "orb_percent", "drb_percent", "stl_percent", "blk_percent", "f_tr", "x3p_ar"]),
    "shooting": ("Player Shooting.csv", ["avg_dist_fga", "percent_fga_from_x0_3_range", "percent_fga_from_x3_10_range",
                                         "percent_fga_from_x10_16_range", "percent_fga_from_x16_3p_range",
                                         "percent_assisted_x2p_fg", "percent_assisted_x3p_fg",
                                         "percent_dunks_of_fga", "percent_corner_3s_of_3pa"]),
    "pbp": ("Player Play By Play.csv", ["pg_percent", "sg_percent", "sf_percent", "pf_percent", "c_percent"]),
}
KEY_COLS = ["season", "lg", "player", "player_id", "team", "pos"]

# Tuned with --tune (coordinate search on mean reciprocal rank, weights capped
# at 3 so no single stat dominates). Higher = matters more for "plays like".
WEIGHTS = {
    "usg": 1.5, "ast": 1.0, "tov": 1.0, "ts": 0.5, "bpm": 0.5,
    "orb": 1.5, "drb": 3.0, "stl": 0.5, "blk": 1.5, "ftr": 1.5,
    "dist": 0.56, "rim": 1.5, "short": 1.0, "mid": 1.5, "three": 0.75,
    "ast2": 1.0, "ast3": 0.5, "dunk": 3.0, "corner": 1.0, "pos": 3.0,
}
FEATURES = list(WEIGHTS)


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def norm_name(n):
    n = unicodedata.normalize("NFD", n).encode("ascii", "ignore").decode().lower()
    n = re.sub(r"[^a-z ]", "", n)
    n = re.sub(r"\b(jr|sr|ii|iii|iv)\b", "", n)
    return re.sub(r"\s+", " ", n).strip()


ALIAS = {"cam johnson": "cameron johnson"}
BREF_TEAM = {"PHX": "PHO", "BKN": "BRK", "CHA": "CHO"}


def refresh(src_dir):
    os.makedirs(DATA, exist_ok=True)
    for key, (fname, cols) in SOURCES.items():
        with open(os.path.join(src_dir, fname), encoding="utf-8") as f:
            rows = [r for r in csv.DictReader(f) if r["lg"] == "NBA" and int(r["season"]) >= FIRST_SEASON]
        with open(os.path.join(DATA, key + ".csv"), "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=KEY_COLS + cols, extrasaction="ignore")
            w.writeheader()
            w.writerows(rows)
        print(f"Trimmed {fname}: {len(rows)} rows")


def load(key):
    with open(os.path.join(DATA, key + ".csv"), encoding="utf-8") as f:
        return list(csv.DictReader(f))


def season_rows(rows):
    """(season, player_id) -> the season-total row, plus every team row."""
    by = defaultdict(list)
    for r in rows:
        by[(int(r["season"]), r["player_id"])].append(r)
    total = {}
    for k, rs in by.items():
        tot = [r for r in rs if r["team"] == "TOT" or r["team"].endswith("TM")]
        total[k] = tot[0] if tot else rs[0]
    return total, by


def features(a, s, p):
    s = s or {}
    p = p or {}
    mid = [num(s.get("percent_fga_from_x10_16_range")), num(s.get("percent_fga_from_x16_3p_range"))]
    shares = [num(p.get(c + "_percent")) or 0 for c in ("pg", "sg", "sf", "pf", "c")]
    pos = sum((i + 1) * x for i, x in enumerate(shares)) / sum(shares) if sum(shares) > 0 else None
    return {
        "usg": num(a["usg_percent"]), "ast": num(a["ast_percent"]), "tov": num(a["tov_percent"]),
        "ts": num(a["ts_percent"]), "bpm": num(a["bpm"]), "orb": num(a["orb_percent"]),
        "drb": num(a["drb_percent"]), "stl": num(a["stl_percent"]), "blk": num(a["blk_percent"]),
        "ftr": num(a["f_tr"]), "dist": num(s.get("avg_dist_fga")),
        "rim": num(s.get("percent_fga_from_x0_3_range")), "short": num(s.get("percent_fga_from_x3_10_range")),
        "mid": None if None in mid else sum(mid), "three": num(a["x3p_ar"]),
        "ast2": num(s.get("percent_assisted_x2p_fg")), "ast3": num(s.get("percent_assisted_x3p_fg")),
        "dunk": num(s.get("percent_dunks_of_fga")), "corner": num(s.get("percent_corner_3s_of_3pa")),
        "pos": pos,
    }


def build_table():
    adv, adv_by_team = season_rows(load("advanced"))
    sho, sho_by_team = season_rows(load("shooting"))
    pbp, pbp_by_team = season_rows(load("pbp"))
    table = {}
    for k, a in adv.items():
        mp = num(a["mp"])
        if not mp:
            continue
        table[k] = {"name": a["player"], "id": k[1], "mp": mp, "g": num(a["g"]) or 0.0,
                    "raw": features(a, sho.get(k), pbp.get(k))}
    return table, (adv_by_team, sho_by_team, pbp_by_team)


def season_scale(table):
    scale = {}
    for season in sorted({s for s, _ in table}):
        pool = [d for (s, _), d in table.items() if s == season and d["mp"] >= POOL_MIN_MP]
        scale[season] = {}
        for f in FEATURES:
            xs = [d["raw"][f] for d in pool if d["raw"][f] is not None]
            mu = sum(xs) / len(xs)
            sd = math.sqrt(sum((x - mu) ** 2 for x in xs) / len(xs)) or 1.0
            scale[season][f] = (mu, sd)
    return scale


def zvec(raw, mp, sc):
    shrink = mp / (mp + SHRINK_MP)
    return [0.0 if raw[f] is None else (raw[f] - sc[f][0]) / sc[f][1] * shrink for f in FEATURES]


def distance(a, b, w):
    return math.sqrt(sum(wi * (x - y) ** 2 for wi, x, y in zip(w, a, b)) / sum(w))


def same_player_check(Z, table, w, seasons):
    """Rank of a player's next season among every 500+ minute player that season."""
    ranks = []
    for s in seasons:
        cands = [k for k in Z if k[0] == s + 1 and table[k]["mp"] >= POOL_MIN_MP]
        for k in Z:
            nxt = (s + 1, k[1])
            if k[0] != s or table[k]["mp"] < TEST_MIN_MP or nxt not in Z or table[nxt]["mp"] < TEST_MIN_MP:
                continue
            d_self = distance(Z[k], Z[nxt], w)
            ranks.append(1 + sum(1 for c in cands if c != nxt and distance(Z[k], Z[c], w) < d_self))
    ranks.sort()
    n = len(ranks)
    return {"pairs": n, "top1": round(sum(r == 1 for r in ranks) / n, 3),
            "top5": round(sum(r <= 5 for r in ranks) / n, 3), "medianRank": ranks[n // 2],
            "mrr": round(sum(1 / r for r in ranks) / n, 4)}


def tune(Z, table, train):
    w = [1.0] * len(FEATURES)
    best = same_player_check(Z, table, w, train)["mrr"]
    for _ in range(3):
        for i in range(len(FEATURES)):
            for mult in (0, 0.5, 1.5, 2.5):
                w2 = w[:]
                w2[i] = min(3.0, w[i] * mult if w[i] > 0 else (0.5 if mult > 0 else 0))
                if sum(w2) == 0:
                    continue
                score = same_player_check(Z, table, w2, train)["mrr"]
                if score > best + 1e-4:
                    best, w = score, w2
    return dict(zip(FEATURES, [round(x, 2) for x in w]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", metavar="DIR")
    ap.add_argument("--tune", action="store_true")
    args = ap.parse_args()
    if args.refresh:
        refresh(args.refresh)

    table, by_team = build_table()
    scale = season_scale(table)
    Z = {k: zvec(d["raw"], d["mp"], scale[k[0]]) for k, d in table.items()}

    train, test = [2021, 2022, 2023], [2024, 2025]
    if args.tune:
        print("Tuned weights:", tune(Z, table, train))
        return
    w = [WEIGHTS[f] for f in FEATURES]
    old = [1.0 if f in ("usg", "ast", "tov", "ts", "bpm", "orb", "drb", "stl", "blk", "ftr", "three") else 0.0
           for f in FEATURES]
    validation = {
        "test": same_player_check(Z, table, w, test),
        "train": same_player_check(Z, table, w, train),
        "baselineTest": same_player_check(Z, table, old, test),
    }
    print("Same-player check (next season found as own closest match):")
    for k, v in validation.items():
        print(f"  {k:13s} {v}")

    # Anchors for the percent-match scale.
    self_d = sorted(
        distance(Z[k], Z[(k[0] + 1, k[1])], w)
        for k in Z
        if (k[0] + 1, k[1]) in Z and table[k]["mp"] >= TEST_MIN_MP and table[(k[0] + 1, k[1])]["mp"] >= TEST_MIN_MP
    )
    rng = random.Random(7)
    pool = [k for k in Z if table[k]["mp"] >= POOL_MIN_MP]
    dists = []
    while len(dists) < 100000:
        a, b = rng.sample(pool, 2)
        if a[1] != b[1]:
            dists.append(distance(Z[a], Z[b], w))
    dists.sort()
    anchors = {"self": round(self_d[len(self_d) // 2], 4), "random": round(dists[len(dists) // 2], 4)}
    print(f"Anchors: same player a year apart {anchors['self']}, random pair {anchors['random']}")

    current = {k[1]: [round(x, 3) for x in Z[k]] for k in Z if k[0] == CURRENT_SEASON}
    # Minutes per game this season: how big a role each current player has.
    current_mpg = {pid: round(table[(s_, pid)]["mp"] / table[(s_, pid)]["g"], 1)
                   for (s_, pid) in Z if s_ == CURRENT_SEASON and table[(s_, pid)]["g"]}

    # Blueprint players: that season's row for that team (season total as fallback).
    adv_by_team = by_team[0]
    name_index = defaultdict(list)
    for (s, pid), rows in adv_by_team.items():
        name_index[(s, norm_name(rows[0]["player"]))].append(pid)
    blueprint = {}
    with open(BLUEPRINTS, encoding="utf-8") as f:
        teams = json.load(f)
    for bp in teams:
        season = int(bp["id"][4:])
        team = BREF_TEAM.get(bp["abbrev"], bp["abbrev"])
        blueprint[bp["id"]] = {}
        for p in bp["players"]:
            key = norm_name(p["name"])
            ids = name_index.get((season, ALIAS.get(key, key)), [])
            if len(ids) != 1:
                raise SystemExit(f"Can't resolve {p['name']} ({bp['id']}): {ids}")
            pid = ids[0]
            rows = adv_by_team[(season, pid)]
            row = next((r for r in rows if r["team"] == team), None) or next(
                r for r in rows if r["team"] == "TOT" or r["team"].endswith("TM"))
            blueprint[bp["id"]][p["name"]] = {
                # Per-game role with that team, so an injury-shortened season
                # doesn't shrink how big the role was.
                "id": pid, "mpg": round(num(row["mp"]) / num(row["g"]), 1), "bpm": num(row["bpm"]),
                # Style uses the full season (more minutes, same player).
                "z": [round(x, 3) for x in Z[(season, pid)]],
            }

    out = {
        "features": FEATURES,
        "weights": w,
        "anchors": anchors,
        "validation": validation,
        "current": current,
        "currentMpg": current_mpg,
        "blueprint": blueprint,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
        f.write("\n")
    print(f"Wrote {os.path.relpath(OUT, ROOT)}: {len(current)} current players, "
          f"{sum(len(v) for v in blueprint.values())} blueprint players")


if __name__ == "__main__":
    main()
