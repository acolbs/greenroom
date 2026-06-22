#!/usr/bin/env python3
"""
prospect_data.py — shared data + feature helpers for the Greenroom ML pipeline.

Single source of truth for what used to be copy-pasted (and silently drifting)
across assign_archetypes_rf.py, player_comps.py and predict_success.py:

  • DATA path resolution (relative to the repo; override with $GREENROOM_DATA)
  • position maps + buckets
  • physical measurements (NBA players + 2026 draft prospects)
  • college -> NBA rate estimation + engineered features
  • college -> NBA tendency adjustment factors

Pipeline file contract (no script ever overwrites its own input):
  Sources (hand-authored / scraped, read-only to the model scripts):
    big_board_base.csv         scout big board: Rank, Name, School, Pos, Year,
                               Grade, Offensive Archetype, Defensive Role, Notes
    prospect_stats_base.csv    big-board fields + scraped college per-game stats
    master.csv                 labeled NBA players (training data)
  Model outputs (one file per model, never an input to another model):
    prospect_archetype_ml.csv  assign_archetypes_rf.py
    prospect_comps.csv         player_comps.py
    prospect_success.csv       predict_success.py
  Composed artifacts (built by compose_big_board.py, read by the web app):
    big_board.csv              = big_board_base.csv + ML archetypes
    prospect_stats.csv         = prospect_stats_base.csv + ML archetypes
"""

import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd

# Pipeline scripts print status glyphs (✓ → ═); force UTF-8 so they don't crash
# on Windows' default cp1252 console.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
_REPO = Path(__file__).resolve().parents[1]
DATA = Path(os.environ.get("GREENROOM_DATA", _REPO / "web" / "public" / "data"))


def data_path(name: str) -> str:
    return str(DATA / name)


# ---------------------------------------------------------------------------
# Positions
# ---------------------------------------------------------------------------
POS_MAP = {"PG": "G", "SG": "G", "SF": "W", "PF": "F", "C": "C",
           "G": "G", "G-F": "W", "F-G": "W", "F": "F", "F-C": "F", "C-F": "C"}
POS_RANK = {"PG": 1, "SG": 2, "SF": 3, "PF": 4, "C": 5}

# Position-average fallback physicals (height_no_shoes_in, wingspan_in, weight_lbs)
POS_AVG_PHYSICALS = {
    "G": (74.5, 77.5, 190), "W": (78.5, 82.0, 215),
    "F": (80.5, 84.5, 230), "C": (83.5, 88.0, 252),
}


# ---------------------------------------------------------------------------
# Canonical archetype taxonomy — mirror of web/src/data/archetypes.ts.
# The model emits a deliberate SUBSET (see the merges in assign_archetypes_rf.py:
# Post Scorer -> Roll + Cut Big, Slasher -> Athletic Finisher; "Low Minute" and
# "Low Activity" are never predicted). Keep these in sync with the TS registry.
# ---------------------------------------------------------------------------
OFFENSIVE_ARCHETYPES = [
    "Primary Ball Handler", "Secondary Ball Handler", "Shot Creator",
    "Movement Shooter", "Stationary Shooter", "Off Screen Shooter",
    "Athletic Finisher", "Slasher", "Roll + Cut Big", "Stretch Big",
    "Versatile Big", "Post Scorer", "Low Minute",
]
DEFENSIVE_ROLES = [
    "Point of Attack", "Wing Stopper", "Chaser", "Helper",
    "Mobile Big", "Anchor Big", "Low Activity",
]


def pos_bucket(p) -> str:
    if pd.isna(p):
        return "W"
    s = str(p).upper().split("/")[0].strip()
    return POS_MAP.get(s, "W")


def primary_pos_rank(pos_str) -> int:
    """For dual-position players (SF/PF) use the LARGER position rank, so a
    listed SF/PF can match C comps and a PG/SG can match SF comps."""
    if pd.isna(pos_str):
        return 3
    parts = [p.strip() for p in str(pos_str).upper().replace("-", "/").split("/")]
    ranks = [POS_RANK.get(p, 3) for p in parts if p in POS_RANK]
    return max(ranks) if ranks else 3


# ---------------------------------------------------------------------------
# Physicals — NBA players (height no-shoes in", wingspan in", weight lbs)
# Union of the measurements that were previously duplicated per-script.
# ---------------------------------------------------------------------------
NBA_PHYSICALS = {
    "Amen Thompson": (79.0, 83.0, 215), "Tyrese Maxey": (74.0, 77.0, 190),
    "Jalen Brunson": (73.0, 75.5, 190), "Jamal Murray": (76.0, 78.5, 205),
    "Derrick White": (76.0, 78.5, 195), "Anthony Edwards": (76.0, 79.5, 225),
    "Immanuel Quickley": (75.0, 78.0, 190), "Cade Cunningham": (78.0, 80.5, 220),
    "Shai Gilgeous-Alexander": (77.5, 81.5, 195), "James Harden": (77.0, 79.0, 225),
    "Donovan Mitchell": (73.0, 76.5, 195), "Payton Pritchard": (73.0, 75.0, 195),
    "De'Aaron Fox": (75.0, 77.0, 185), "Darius Garland": (73.5, 76.0, 185),
    "Trae Young": (72.0, 74.5, 180), "Tyus Jones": (73.5, 76.0, 185),
    "Stephen Curry": (74.5, 77.0, 185), "D'Angelo Russell": (75.5, 78.0, 195),
    "Jalen Green": (75.0, 77.5, 185), "Tyler Herro": (76.0, 78.5, 195),
    "Devin Booker": (77.0, 79.5, 210), "Mike Conley": (73.0, 75.5, 185),
    "Chris Paul": (72.0, 74.5, 175), "Dejounte Murray": (77.0, 80.5, 190),
    "Luka Dončić": (78.0, 80.5, 230), "Kyle Lowry": (71.0, 74.0, 195),
    "Jordan Poole": (75.5, 78.0, 195), "Ja Morant": (75.0, 78.0, 185),
    "Scoot Henderson": (74.5, 77.0, 195), "Brandin Podziemski": (76.0, 78.5, 195),
    "Jeremiah Fears": (75.0, 78.0, 175), "Dylan Harper": (77.0, 80.5, 210),
    "T.J. McConnell": (73.5, 76.0, 185), "Russell Westbrook": (75.0, 78.0, 200),
    "VJ Edgecombe": (76.5, 79.0, 190), "Kris Dunn": (75.5, 79.0, 205),
    "Rob Dillingham": (73.5, 75.5, 175), "Collin Sexton": (73.0, 75.5, 185),
    "Reed Sheppard": (74.75, 77.0, 185), "Collin Gillespie": (75.0, 77.0, 190),
    "Jalen Suggs": (76.0, 78.5, 205), "Jrue Holiday": (76.5, 79.5, 205),
    "Austin Reaves": (77.0, 79.5, 195), "Donte DiVincenzo": (76.0, 79.0, 200),
    "Anfernee Simons": (76.0, 78.5, 185), "Alex Caruso": (77.0, 79.5, 190),
    "Coby White": (75.5, 77.5, 185), "Keyonte George": (75.0, 77.5, 185),
    "Anthony Black": (78.0, 81.5, 205), "Norman Powell": (77.0, 80.0, 205),
    "Tre Jones": (73.5, 76.5, 185), "Jose Alvarado": (72.5, 75.0, 180),
    "Gary Payton II": (74.0, 76.5, 190), "CJ McCollum": (75.0, 77.0, 200),
    "Kevin Durant": (81.0, 87.0, 235), "Mikal Bridges": (78.0, 82.5, 210),
    "Toumani Camara": (79.0, 83.0, 215), "Desmond Bane": (77.0, 79.5, 215),
    "Brandon Ingram": (79.0, 83.5, 195), "Jaylen Brown": (78.0, 82.5, 220),
    "Trey Murphy III": (79.5, 84.0, 205), "Jalen Johnson": (79.0, 83.0, 215),
    "Scottie Barnes": (79.5, 84.5, 225), "Cooper Flagg": (80.0, 84.0, 215),
    "Royce O'Neale": (77.0, 80.5, 220), "OG Anunoby": (79.0, 83.5, 220),
    "Kawhi Leonard": (79.0, 84.5, 225), "Pascal Siakam": (79.0, 82.5, 220),
    "Paul George": (80.0, 83.5, 220), "Deni Avdija": (80.5, 84.0, 220),
    "Michael Porter Jr.": (81.5, 86.0, 210), "Franz Wagner": (80.5, 84.5, 220),
    "Andrew Wiggins": (78.0, 83.5, 200), "Jimmy Butler": (79.0, 82.5, 230),
    "Duncan Robinson": (79.0, 82.0, 210), "Klay Thompson": (78.0, 81.5, 215),
    "RJ Barrett": (78.0, 82.0, 215), "De'Andre Hunter": (79.0, 83.5, 225),
    "Cameron Johnson": (80.5, 84.0, 210), "Saddiq Bey": (78.0, 82.0, 215),
    "Miles Bridges": (78.0, 82.0, 225), "Naji Marshall": (79.0, 82.5, 215),
    "Aaron Nesmith": (78.0, 82.0, 215), "Derrick Jones Jr.": (79.5, 84.0, 205),
    "Matas Buzelis": (80.5, 84.0, 205), "Kyle Anderson": (80.5, 85.0, 225),
    "Caleb Martin": (77.0, 81.0, 220), "Dorian Finney-Smith": (79.5, 83.5, 215),
    "Herbert Jones": (79.5, 84.0, 210), "Bennedict Mathurin": (78.5, 83.0, 215),
    "Dyson Daniels": (78.0, 82.5, 200), "Bilal Coulibaly": (79.0, 84.0, 195),
    "Jake LaRavia": (80.0, 84.0, 215), "Ryan Dunn": (79.5, 84.0, 200),
    "Ausar Thompson": (79.0, 84.0, 210), "Dalton Knecht": (79.0, 82.5, 210),
    "Patrick Williams": (79.5, 83.5, 215), "Jonathan Isaac": (81.0, 85.5, 210),
    "Tari Eason": (79.5, 84.5, 220), "Jabari Smith Jr.": (81.0, 84.5, 220),
    "Julius Randle": (79.0, 82.0, 250), "Paolo Banchero": (81.0, 84.5, 250),
    "Giannis Antetokounmpo": (82.5, 88.5, 243), "Evan Mobley": (82.5, 88.0, 215),
    "Draymond Green": (78.0, 81.5, 235), "Aaron Gordon": (79.5, 84.0, 235),
    "Jarred Vanderbilt": (80.0, 85.0, 215), "Lauri Markkanen": (84.0, 87.0, 240),
    "Rudy Gobert": (85.0, 90.0, 258), "Karl-Anthony Towns": (83.0, 87.5, 265),
    "Nikola Jokić": (82.5, 86.5, 284), "Bam Adebayo": (80.0, 84.5, 255),
    "Joel Embiid": (83.5, 87.5, 280), "Nikola Vučević": (82.0, 85.5, 260),
    "Nic Claxton": (82.5, 89.5, 215), "Naz Reid": (81.0, 85.0, 255),
    "Myles Turner": (82.0, 87.0, 250), "Wendell Carter Jr.": (82.0, 85.5, 265),
    "Jarrett Allen": (82.0, 87.5, 243), "Donovan Clingan": (84.0, 88.5, 250),
    "Brook Lopez": (83.5, 87.0, 282), "Al Horford": (81.0, 85.5, 245),
    "Daniel Gafford": (82.0, 88.0, 234), "Ivica Zubac": (85.0, 88.5, 240),
    "Isaiah Hartenstein": (83.0, 88.0, 243), "Mark Williams": (84.0, 89.5, 240),
    "Alex Sarr": (83.0, 88.5, 210), "Kristaps Porziņģis": (85.0, 89.5, 240),
    "Jaxson Hayes": (83.0, 87.0, 220), "Clint Capela": (82.0, 88.0, 255),
    "Jakob Poeltl": (83.0, 87.5, 258), "Jonas Valančiūnas": (83.0, 87.5, 265),
    "Mitchell Robinson": (83.0, 89.5, 240), "Kel'el Ware": (84.0, 88.5, 240),
    "Derik Queen": (81.0, 85.5, 245), "Jusuf Nurkić": (83.0, 86.5, 290),
    "Onyeka Okongwu": (80.0, 84.5, 245), "Maxime Raynaud": (85.5, 89.5, 240),
    "Zach Edey": (87.0, 92.0, 285), "Walker Kessler": (84.0, 91.0, 230),
    "Anthony Davis": (82.0, 87.0, 253), "Jaren Jackson Jr.": (82.5, 87.5, 245),
    "Andre Drummond": (82.0, 87.5, 280), "Trayce Jackson-Davis": (81.0, 84.5, 240),
    "Ryan Kalkbrenner": (84.5, 90.0, 250), "Luke Kornet": (85.0, 89.5, 240),
    "Isaiah Jackson": (82.5, 88.5, 215), "Paul Reed": (81.0, 86.0, 220),
    "Johni Broome": (82.0, 86.5, 240), "Hunter Dickinson": (83.5, 87.5, 260),
    "Jalen Smith": (82.0, 87.0, 235), "Yves Missi": (83.0, 89.0, 230),
    "Mo Bamba": (83.0, 94.0, 225), "Khaman Maluach": (84.5, 90.0, 235),
    "Nick Richards": (83.0, 87.5, 257), "Kelly Olynyk": (83.0, 86.5, 238),
    "Adem Bona": (82.0, 87.5, 235), "Jonathan Mogbo": (81.0, 85.5, 225),
    "Asa Newell": (82.0, 86.5, 220), "Zach Collins": (84.0, 87.5, 250),
    # ── previously only in player_comps / predict_success ──
    "Shaedon Sharpe": (77.5, 81.5, 196), "Jalen Williams": (75.5, 78.5, 194),
    "Kevin Porter Jr.": (77.0, 80.5, 195), "Brandon Williams": (75.0, 79.0, 192),
    "Dillon Brooks": (78.0, 81.5, 215), "Marvin Bagley III": (82.0, 84.0, 234),
    "Bradley Beal": (75.25, 79.5, 207), "Ty Jerome": (76.5, 80.0, 195),
    "Caris LeVert": (78.75, 81.0, 195), "Alperen Sengun": (82.25, 86.0, 264),
    "Zion Williamson": (77.75, 84.5, 284),
}

# ---------------------------------------------------------------------------
# Physicals — 2026 draft prospects. Reconciled single source: 2026 NBA Draft
# Combine measurements (height no-shoes in", wingspan in", weight lbs,
# standing reach in" | None). Combine values are authoritative; names without
# combine data fall back to prior estimates with reach = None.
# ---------------------------------------------------------------------------
PROSPECT_PHYSICALS = {
    "AJ Dybantsa":       (80.5, 84.25, 217, 108.0),
    "Darryn Peterson":   (76.5, 81.75, 199, 103.0),
    "Cameron Boozer":    (80.25, 85.5, 253, 108.0),
    "Caleb Wilson":      (80.5, 85.0, 215, 107.0),
    "Kingston Flemings": (76.75, 80.0, 192, 101.0),
    "Jayden Quaintance": (79.75, 85.0, 222, 106.0),
    "Aday Mara":         (87.0, 90.0, 250, 117.0),
    "Rueben Chinyelu":   (81.0, 91.5, 238, 110.0),
    "Nate Ament":        (78.5, 82.0, 200, 104.0),
    "Keaton Wagler":     (78.0, 80.0, 195, 103.0),
    "Mikel Brown Jr.":   (75.0, 77.0, 175, 97.0),
    "Brayden Burries":   (75.5, 78.0, 185, 99.0),
    "Labaron Philon":    (74.75, 78.25, 174.6, 99.5),
    "Yaxel Lendeborg":   (80.5, 88.0, 234.6, 108.5),
    "Thomas Haugh":      (79.0, 82.0, 215, 105.0),
    "Koa Peat":          (80.0, 85.0, 225, 107.0),
    "Tounde Yessoufou":  (77.0, 81.0, 195, 102.0),
    "Bennett Stirtz":    (75.0, 77.0, 185, 97.0),
    "Tyler Tanner":      (74.0, 76.0, 175, 95.0),
    "Joshua Jefferson":  (79.5, 86.0, 205, 107.0),
    "Morez Johnson Jr.": (80.5, 87.0, 230, 109.0),
    "Dailyn Swain":      (77.5, 80.0, 195, 102.0),
    "Isaiah Evans":      (77.5, 81.0, 195, 103.0),
    "Ebuka Okorie":      (77.0, 80.0, 190, 101.0),
    "Meleek Thomas":     (76.5, 79.0, 185, 100.0),
    "Henri Veesaar":     (83.0, 88.0, 235, 110.0),
    "Alijah Arenas":     (76.5, 79.0, 185, 100.0),
    "Flory Bidunga":     (80.5, 87.0, 230, 109.0),
    "Zuby Ejiofor":      (79.5, 85.0, 225, 107.0),
    "Alex Karaban":      (79.5, 84.0, 215, 106.0),
    "Braden Smith":      (73.0, 76.0, 175, 96.0),
    "Motiejus Krivas":   (83.0, 89.0, 245, 112.0),
    "Tarris Reed Jr.":   (80.5, 86.0, 250, 109.0),
    "JT Toppin":         (79.5, 84.0, 210, 106.0),
    "Alex Condon":       (83.25, 84.75, 221.8, 107.5),
    "Zvonimir Ivisic":   (84.5, 89.0, 245, 112.0),
    "Tomislav Ivisic":   (82.0, 88.0, 245, 110.0),
    "Milos Uzan":        (75.25, 77.25, 186.4, 97.5),
    "Tahaad Pettiford":  (72.25, 77.5, 168.8, 96.0),
    "Dillon Mitchell":   (79.0, 85.0, 210, 106.0),
    "Andrej Stojakovic": (78.5, 81.0, 195, 103.0),
    "Kylan Boswell":     (73.5, 76.0, 175, 96.0),
    "Coen Carr":         (77.5, 81.0, 200, 102.0),
    "Tucker DeVries":    (78.0, 80.0, 200, 103.0),
    "KJ Lewis":          (78.0, 81.0, 200, 104.0),
    "Malik Reneau":      (79.5, 84.0, 220, 106.0),
    "Darius Acuff":      (74.5, 77.0, 188, 98.0),
    # ── names without 2026 combine data (prior estimates, reach unknown) ──
    "Keyshawn Hall":     (78.0, 82.0, 205, None),
    "Miles Byrd":        (76.75, 82.0, 181.8, 102.5),
    "Otega Oweh":        (76.5, 80.0, 195, None),
    "Tamin Lipsey":      (74.0, 77.0, 185, None),
    "Trevon Brazile":    (80.5, 86.0, 225, None),
    "Baba Miller":       (79.5, 86.0, 220, None),
    "Darrion Williams":  (78.5, 82.0, 200, None),
    "Juke Harris":       (77.0, 80.0, 195, None),
    "Richie Saunders":   (78.5, 84.0, 205, None),
    "Ryan Conwell":      (76.0, 78.5, 185, None),
    "Jaden Bradley":     (75.5, 78.0, 175, None),
    "Pryce Sandfort":    (78.5, 81.0, 205, None),
    "Milan Momcilovic":  (78.5, 81.0, 200, None),
    "Bruce Thornton":    (73.5, 76.0, 185, None),
    "Emanuel Sharp":     (76.5, 79.0, 190, None),
    "Paul McNeil Jr.":   (77.5, 81.0, 195, None),
    "Solo Ball":         (76.0, 78.0, 185, None),
}


def get_nba_phys(name, bucket):
    """Return (height_in, wingspan_in, weight_lbs) for an NBA player."""
    if name in NBA_PHYSICALS:
        return NBA_PHYSICALS[name]
    return POS_AVG_PHYSICALS.get(bucket, (78, 81, 210))


def get_prospect_phys(name, bucket):
    """Return (height_in, wingspan_in, weight_lbs) for a draft prospect."""
    if name in PROSPECT_PHYSICALS:
        h, ws, wt, _reach = PROSPECT_PHYSICALS[name]
        return (h, ws, wt)
    return POS_AVG_PHYSICALS.get(bucket, (78, 81, 210))


def get_prospect_reach(name):
    """Standing reach in inches, or None if unknown."""
    if name in PROSPECT_PHYSICALS:
        return PROSPECT_PHYSICALS[name][3]
    return None


def to_in(s):
    """Parse a feet-dash-inches string ("6-8.5") into inches; passthrough floats."""
    if pd.isna(s) or s == "":
        return np.nan
    s = str(s).strip()
    if "-" in s:
        p = s.split("-")
        return int(p[0]) * 12 + float(p[1])
    return float(s)


# ---------------------------------------------------------------------------
# College -> NBA rate estimation (per-40 normalization against league baselines)
# ---------------------------------------------------------------------------
TEAM_POSS_40 = 65.0
TEAM_FGM_40 = 27.0
TEAM_TRB_40 = 38.0
OPP_2PA_40 = 35.0
OPP_POSS_40 = 65.0


def estimate_college_rates(row):
    """Estimate advanced rate stats (USG%, AST%, TRB%, BLK%, STL%) from a
    college per-game line. Mirrors the NBA advanced columns the model trains on."""
    mp = max(float(row.get("mp_per_g", 28) or 28), 10)
    fg = float(row.get("fg_per_g", 0) or 0)
    fga = float(row.get("fga_per_g", 0) or 0)
    fta = float(row.get("fta_per_g", 0) or 0)
    ast = float(row.get("ast_per_g", 0) or 0)
    trb = float(row.get("trb_per_g", 0) or 0)
    stl = float(row.get("stl_per_g", 0) or 0)
    blk = float(row.get("blk_per_g", 0) or 0)
    tov = float(row.get("tov_per_g", 0) or 0)
    fac = 40.0 / mp
    usg = (fga + 0.44 * fta + tov) * fac / TEAM_POSS_40 * 100
    ast_pct = ast / max(TEAM_FGM_40 * (mp / 40) - fg, 1) * 100
    trb_pct = trb / (TEAM_TRB_40 * (mp / 40)) * 100
    blk_pct = blk / max(OPP_2PA_40 * (mp / 40), 1) * 100
    stl_pct = stl / max(OPP_POSS_40 * (mp / 40), 1) * 100
    return {
        "USG%": np.clip(usg, 5, 50),
        "AST%": np.clip(ast_pct, 0, 60),
        "TRB%": np.clip(trb_pct, 0, 35),
        "BLK%": np.clip(blk_pct, 0, 15),
        "STL%": np.clip(stl_pct, 0, 8),
        "AST": ast, "PTS": float(row.get("pts_per_g", 0) or 0),
    }


# ---------------------------------------------------------------------------
# College -> NBA tendency adjustments. College stats inflate vs the NBA;
# shot-selection rates transfer ~directly, production rates regress.
# (3P% factor is ignored by consumers that don't use 3P% as a feature.)
# ---------------------------------------------------------------------------
COLLEGE_ADJ = {
    "3PAr": 1.00,  # shot selection transfers directly
    "FTr":  0.95,  # rim aggression drops slightly
    "AST%": 0.85,  # playmaking harder in NBA
    "TRB%": 0.82,
    "BLK%": 0.78,
    "STL%": 0.82,
    "3P%":  0.88,  # 3P% regresses at NBA level
    "TOV%": 1.05,  # pressure increases
    "USG%": 0.87,  # usage redistributes
}


def apply_college_adj(v):
    for stat, factor in COLLEGE_ADJ.items():
        if stat in v:
            v[stat] = v[stat] * factor
    return v
