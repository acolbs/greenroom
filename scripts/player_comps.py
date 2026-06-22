#!/usr/bin/env python3
"""
player_comps.py  v2  — ML-based player comparisons

Pipeline:
  1. Build feature vectors for all labeled NBA players in master.csv
     using the same stat + physical features as the archetype model
  2. Fit PCA on those NBA vectors — learns the most meaningful
     combinations of stats (scoring style, playmaking, defense, size)
  3. Project both NBA players AND prospects into the learned PCA space
  4. KNN search: find the closest NBA neighbors for each prospect
     in the PCA space (not raw stats — the model's learned representation)

This is genuinely ML-based because PCA is trained on NBA outcome data
and learns correlations between stats that actually define player types.
The distance in PCA space reflects stylistic + physical similarity, not
just raw measurement proximity.
"""

import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.neighbors import NearestNeighbors
import warnings
warnings.filterwarnings("ignore")

DATA = "/sessions/sleepy-modest-hawking/mnt/Greenroom/greenroom/web/public/data"

# ---------------------------------------------------------------------------
# Physicals
# ---------------------------------------------------------------------------
NBA_PHYSICALS = {
    "Amen Thompson":(79.0,83.0,215),"Tyrese Maxey":(74.0,77.0,190),
    "Jalen Brunson":(73.0,75.5,190),"Jamal Murray":(76.0,78.5,205),
    "Derrick White":(76.0,78.5,195),"Anthony Edwards":(76.0,79.5,225),
    "Immanuel Quickley":(75.0,78.0,190),"Cade Cunningham":(78.0,80.5,220),
    "Shai Gilgeous-Alexander":(77.5,81.5,195),"James Harden":(77.0,79.0,225),
    "Donovan Mitchell":(73.0,76.5,195),"Payton Pritchard":(73.0,75.0,195),
    "De'Aaron Fox":(75.0,77.0,185),"Darius Garland":(73.5,76.0,185),
    "Trae Young":(72.0,74.5,180),"Tyus Jones":(73.5,76.0,185),
    "Stephen Curry":(74.5,77.0,185),"D'Angelo Russell":(75.5,78.0,195),
    "Jalen Green":(75.0,77.5,185),"Tyler Herro":(76.0,78.5,195),
    "Devin Booker":(77.0,79.5,210),"Mike Conley":(73.0,75.5,185),
    "Chris Paul":(72.0,74.5,175),"Dejounte Murray":(77.0,80.5,190),
    "Luka Dončić":(78.0,80.5,230),"Kyle Lowry":(71.0,74.0,195),
    "Jordan Poole":(75.5,78.0,195),"Ja Morant":(75.0,78.0,185),
    "Scoot Henderson":(74.5,77.0,195),"Brandin Podziemski":(76.0,78.5,195),
    "Jeremiah Fears":(75.0,78.0,175),"Dylan Harper":(77.0,80.5,210),
    "T.J. McConnell":(73.5,76.0,185),"Russell Westbrook":(75.0,78.0,200),
    "VJ Edgecombe":(76.5,79.0,190),"Kris Dunn":(75.5,79.0,205),
    "Rob Dillingham":(73.5,75.5,175),"Collin Sexton":(73.0,75.5,185),
    "Reed Sheppard":(74.75,77.0,185),"Collin Gillespie":(75.0,77.0,190),
    "Jalen Suggs":(76.0,78.5,205),"Jrue Holiday":(76.5,79.5,205),
    "Austin Reaves":(77.0,79.5,195),"Donte DiVincenzo":(76.0,79.0,200),
    "Anfernee Simons":(76.0,78.5,185),"Alex Caruso":(77.0,79.5,190),
    "Coby White":(75.5,77.5,185),"Keyonte George":(75.0,77.5,185),
    "Anthony Black":(78.0,81.5,205),"Norman Powell":(77.0,80.0,205),
    "Tre Jones":(73.5,76.5,185),"Jose Alvarado":(72.5,75.0,180),
    "Gary Payton II":(74.0,76.5,190),"CJ McCollum":(75.0,77.0,200),
    "Kevin Durant":(81.0,87.0,235),"Mikal Bridges":(78.0,82.5,210),
    "Toumani Camara":(79.0,83.0,215),"Desmond Bane":(77.0,79.5,215),
    "Brandon Ingram":(79.0,83.5,195),"Jaylen Brown":(78.0,82.5,220),
    "Trey Murphy III":(79.5,84.0,205),"Jalen Johnson":(79.0,83.0,215),
    "Scottie Barnes":(79.5,84.5,225),"Cooper Flagg":(80.0,84.0,215),
    "Royce O'Neale":(77.0,80.5,220),"OG Anunoby":(79.0,83.5,220),
    "Kawhi Leonard":(79.0,84.5,225),"Pascal Siakam":(79.0,82.5,220),
    "Paul George":(80.0,83.5,220),"Deni Avdija":(80.5,84.0,220),
    "Michael Porter Jr.":(81.5,86.0,210),"Franz Wagner":(80.5,84.5,220),
    "Andrew Wiggins":(78.0,83.5,200),"Jimmy Butler":(79.0,82.5,230),
    "Duncan Robinson":(79.0,82.0,210),"Klay Thompson":(78.0,81.5,215),
    "RJ Barrett":(78.0,82.0,215),"De'Andre Hunter":(79.0,83.5,225),
    "Cameron Johnson":(80.5,84.0,210),"Saddiq Bey":(78.0,82.0,215),
    "Miles Bridges":(78.0,82.0,225),"Naji Marshall":(79.0,82.5,215),
    "Aaron Nesmith":(78.0,82.0,215),"Derrick Jones Jr.":(79.5,84.0,205),
    "Matas Buzelis":(80.5,84.0,205),"Kyle Anderson":(80.5,85.0,225),
    "Caleb Martin":(77.0,81.0,220),"Dorian Finney-Smith":(79.5,83.5,215),
    "Herbert Jones":(79.5,84.0,210),"Bennedict Mathurin":(78.5,83.0,215),
    "Dyson Daniels":(78.0,82.5,200),"Bilal Coulibaly":(79.0,84.0,195),
    "Jake LaRavia":(80.0,84.0,215),"Ryan Dunn":(79.5,84.0,200),
    "Ausar Thompson":(79.0,84.0,210),"Dalton Knecht":(79.0,82.5,210),
    "Patrick Williams":(79.5,83.5,215),"Jonathan Isaac":(81.0,85.5,210),
    "Tari Eason":(79.5,84.5,220),"Jabari Smith Jr.":(81.0,84.5,220),
    "Julius Randle":(79.0,82.0,250),"Paolo Banchero":(81.0,84.5,250),
    "Giannis Antetokounmpo":(82.5,88.5,243),"Evan Mobley":(82.5,88.0,215),
    # Guards / wings missing from original dict
    "Shaedon Sharpe":        (77.5, 81.5, 196),
    "Jalen Williams":        (75.5, 78.5, 194),
    "Kevin Porter Jr.":      (77.0, 80.5, 195),
    "Brandon Williams":      (75.0, 79.0, 192),
    "Dillon Brooks":         (78.0, 81.5, 215),
    "Marvin Bagley III":     (82.0, 84.0, 234),
    "Bradley Beal":          (75.25,79.5, 207),
    "Ty Jerome":             (76.5, 80.0, 195),
    "Caris LeVert":          (78.75,81.0, 195),
    "Alperen Sengun":        (82.25,86.0, 264),
    # Zion's real measurements — 284 lbs, 6'5.75" no shoes
    "Zion Williamson":       (77.75,84.5, 284),
    "Draymond Green":(78.0,81.5,235),"Aaron Gordon":(79.5,84.0,235),
    "Jarred Vanderbilt":(80.0,85.0,215),"Lauri Markkanen":(84.0,87.0,240),
    "Rudy Gobert":(85.0,90.0,258),"Karl-Anthony Towns":(83.0,87.5,265),
    "Nikola Jokić":(82.5,86.5,284),"Bam Adebayo":(80.0,84.5,255),
    "Joel Embiid":(83.5,87.5,280),"Nikola Vučević":(82.0,85.5,260),
    "Nic Claxton":(82.5,89.5,215),"Naz Reid":(81.0,85.0,255),
    "Myles Turner":(82.0,87.0,250),"Wendell Carter Jr.":(82.0,85.5,265),
    "Jarrett Allen":(82.0,87.5,243),"Donovan Clingan":(84.0,88.5,250),
    "Brook Lopez":(83.5,87.0,282),"Al Horford":(81.0,85.5,245),
    "Daniel Gafford":(82.0,88.0,234),"Ivica Zubac":(85.0,88.5,240),
    "Isaiah Hartenstein":(83.0,88.0,243),"Mark Williams":(84.0,89.5,240),
    "Alex Sarr":(83.0,88.5,210),"Kristaps Porziņģis":(85.0,89.5,240),
    "Jaxson Hayes":(83.0,87.0,220),"Clint Capela":(82.0,88.0,255),
    "Jakob Poeltl":(83.0,87.5,258),"Jonas Valančiūnas":(83.0,87.5,265),
    "Mitchell Robinson":(83.0,89.5,240),"Kel'el Ware":(84.0,88.5,240),
    "Derik Queen":(81.0,85.5,245),"Jusuf Nurkić":(83.0,86.5,290),
    "Onyeka Okongwu":(80.0,84.5,245),"Maxime Raynaud":(85.5,89.5,240),
    "Zach Edey":(87.0,92.0,285),"Walker Kessler":(84.0,91.0,230),
    "Anthony Davis":(82.0,87.0,253),"Jaren Jackson Jr.":(82.5,87.5,245),
    "Andre Drummond":(82.0,87.5,280),"Trayce Jackson-Davis":(81.0,84.5,240),
    "Ryan Kalkbrenner":(84.5,90.0,250),"Luke Kornet":(85.0,89.5,240),
    "Isaiah Jackson":(82.5,88.5,215),"Paul Reed":(81.0,86.0,220),
    "Johni Broome":(82.0,86.5,240),"Hunter Dickinson":(83.5,87.5,260),
    "Jalen Smith":(82.0,87.0,235),"Yves Missi":(83.0,89.0,230),
    "Mo Bamba":(83.0,94.0,225),"Khaman Maluach":(84.5,90.0,235),
    "Adem Bona":(82.0,87.5,235),"Jonathan Mogbo":(81.0,85.5,225),
}

POS_AVG_PHYSICALS = {
    "G":(74.5,77.5,190),"W":(78.5,82.0,215),
    "F":(80.5,84.5,230),"C":(83.5,88.0,252),
}
POS_MAP = {"PG":"G","SG":"G","SF":"W","PF":"F","C":"C",
           "G":"G","G-F":"W","F-G":"W","F":"F","F-C":"F","C-F":"C"}

def pos_bucket(p):
    if pd.isna(p): return "W"
    s = str(p).upper().split("/")[0].strip()
    return POS_MAP.get(s,"W")

def get_phys(name, pb):
    if name in NBA_PHYSICALS: return NBA_PHYSICALS[name]
    return POS_AVG_PHYSICALS.get(pb,(78,81,210))

# ---------------------------------------------------------------------------
# Prospect combine physicals (2026 NBA Draft Combine, May 2026)
# ---------------------------------------------------------------------------
def to_in(s):
    if pd.isna(s) or s == "": return np.nan
    s = str(s).strip()
    if "-" in s:
        p = s.split("-"); return int(p[0])*12 + float(p[1])
    return float(s)

PROSPECT_COMBINE = {
    "AJ Dybantsa":       (to_in("6-8.5"),  to_in("7-0.25"), 217,   to_in("8-10")),
    "Darryn Peterson":   (to_in("6-4.5"),  to_in("6-9.75"), 199,   to_in("8-7")),
    "Cameron Boozer":    (to_in("6-8.25"), to_in("7-1.5"),  253,   to_in("9-0")),
    "Caleb Wilson":      (to_in("6-8.5"),  to_in("7-1"),    215,   to_in("8-11")),
    "Kingston Flemings": (to_in("6-4.75"), to_in("6-8"),    192,   to_in("8-5")),
    "Jayden Quaintance": (to_in("6-7.75"), to_in("7-1"),    222,   to_in("8-10")),
    "Aday Mara":         (to_in("7-3"),    to_in("7-6"),    250,   to_in("9-9")),
    "Rueben Chinyelu":   (to_in("6-9"),    to_in("7-7.5"),  238,   to_in("9-2")),
    "Nate Ament":        (to_in("6-6.5"),  to_in("6-10"),   200,   to_in("8-8")),
    "Keaton Wagler":     (to_in("6-6"),    to_in("6-8"),    195,   to_in("8-7")),
    "Mikel Brown Jr.":   (to_in("6-3"),    to_in("6-5"),    175,   to_in("8-1")),
    "Brayden Burries":   (to_in("6-3.5"),  to_in("6-6"),    185,   to_in("8-3")),
    "Labaron Philon":    (to_in("6-2.75"), to_in("6-6.25"), 174.6, to_in("8-3.5")),
    "Yaxel Lendeborg":   (to_in("6-8.5"),  to_in("7-4"),    234.6, to_in("9-0.5")),
    "Thomas Haugh":      (to_in("6-7"),    to_in("6-10"),   215,   to_in("8-9")),
    "Koa Peat":          (to_in("6-8"),    to_in("7-1"),    225,   to_in("8-11")),
    "Tounde Yessoufou":  (to_in("6-5"),    to_in("6-9"),    195,   to_in("8-6")),
    "Bennett Stirtz":    (to_in("6-3"),    to_in("6-5"),    185,   to_in("8-1")),
    "Tyler Tanner":      (to_in("6-2"),    to_in("6-4"),    175,   to_in("7-11")),
    "Joshua Jefferson":  (to_in("6-7.5"),  to_in("7-2"),    205,   to_in("8-11")),
    "Morez Johnson Jr.": (to_in("6-8.5"),  to_in("7-3"),    230,   to_in("9-1")),
    "Dailyn Swain":      (to_in("6-5.5"),  to_in("6-8"),    195,   to_in("8-6")),
    "Isaiah Evans":      (to_in("6-5.5"),  to_in("6-9"),    195,   to_in("8-7")),
    "Ebuka Okorie":      (to_in("6-5"),    to_in("6-8"),    190,   to_in("8-5")),
    "Meleek Thomas":     (to_in("6-4.5"),  to_in("6-7"),    185,   to_in("8-4")),
    "Aday Mara":         (to_in("7-3"),    to_in("7-6"),    250,   to_in("9-9")),
    "Henri Veesaar":     (to_in("6-11"),   to_in("7-4"),    235,   to_in("9-2")),
    "Alijah Arenas":     (to_in("6-4.5"),  to_in("6-7"),    185,   to_in("8-4")),
    "Flory Bidunga":     (to_in("6-8.5"),  to_in("7-3"),    230,   to_in("9-1")),
    "Zuby Ejiofor":      (to_in("6-7.5"),  to_in("7-1"),    225,   to_in("8-11")),
    "Alex Karaban":      (to_in("6-7.5"),  to_in("7-0"),    215,   to_in("8-10")),
    "Braden Smith":      (to_in("6-1"),    to_in("6-4"),    175,   to_in("8-0")),
    "Motiejus Krivas":   (to_in("6-11"),   to_in("7-5"),    245,   to_in("9-4")),
    "Tarris Reed Jr.":   (to_in("6-8.5"),  to_in("7-2"),    250,   to_in("9-1")),
    "JT Toppin":         (to_in("6-7.5"),  to_in("7-0"),    210,   to_in("8-10")),
    "Alex Condon":       (to_in("6-11.25"),to_in("7-0.75"), 221.8, to_in("8-11.5")),
    "Zvonimir Ivisic":   (to_in("7-0.5"),  to_in("7-5"),    245,   to_in("9-4")),
    "Tomislav Ivisic":   (to_in("6-10"),   to_in("7-4"),    245,   to_in("9-2")),
    "Milos Uzan":        (to_in("6-3.25"), to_in("6-5.25"), 186.4, to_in("8-1.5")),
    "Tahaad Pettiford":  (to_in("6-0.25"), to_in("6-5.5"),  168.8, to_in("8-0")),
    "Dillon Mitchell":   (to_in("6-7"),    to_in("7-1"),    210,   to_in("8-10")),
    "Miles Byrd":        (to_in("6-4.75"), to_in("6-10"),   181.8, to_in("8-6.5")),
    "Darius Acuff":      (to_in("6-2.5"),  to_in("6-5"),    188,   to_in("8-2")),
}

# ---------------------------------------------------------------------------
# Feature engineering (shared with archetype model)
# ---------------------------------------------------------------------------
TEAM_POSS_40=65.0; TEAM_FGM_40=27.0; TEAM_TRB_40=38.0
OPP_2PA_40=35.0;   OPP_POSS_40=65.0

# ---------------------------------------------------------------------------
# Tendency-only feature set — captures HOW someone plays, not HOW MUCH.
# Raw counting stats (PTS, AST) and pure efficiency (TS%, FG%, FT%) removed.
# These change dramatically college→NBA. Tendencies are much more stable.
#
# What each feature tells you:
#   3PAr         = are you a perimeter player or interior player?
#   FTr          = do you attack the rim aggressively?
#   AST%         = do you create for teammates (facilitator) or yourself?
#   BLK%         = do you protect the paint defensively?
#   STL%         = are you active and disruptive on the perimeter?
#   TRB%         = are you a natural rebounder regardless of position?
#   USG%         = does the team's offense run through you?
#   TOV%         = how much ball-handling pressure do you absorb?
#   3P%          = when you shoot 3s, are you a real threat?
#   three_vs_free    = composite: pure perimeter scorer vs. paint attacker
#   playmaker_index  = pass-first vs. isolation scorer
#   floor_spacer     = floor-spacing quality (3PAr × 3P%)
#   rim_attack       = rim-attacking frequency composite
#   defensive_type   = rim protector (→1) vs. perimeter defender (→0)
# ---------------------------------------------------------------------------
STYLE_WEIGHTS = {
    # Shot selection tendencies (most stable college→NBA)
    "3PAr":            4.0,
    "FTr":             3.5,
    "three_vs_free":   4.5,   # biggest style separator — perimeter vs paint
    "floor_spacer":    3.0,
    "rim_attack":      3.0,
    "3P%":             2.0,   # shooting quality (not volume)

    # Playmaking tendency
    "AST%":            3.5,
    "playmaker_index": 4.0,   # pass-first vs iso-scorer
    "USG%":            1.5,   # role weight (lower — volume-dependent)
    "TOV%":            1.5,

    # Defensive tendency
    "BLK%":            4.0,   # rim protection — critical big separator
    "STL%":            2.5,
    "TRB%":            2.5,
    "defensive_type":  3.5,   # paint vs perimeter defender profile
}

STYLE_COLS = list(STYLE_WEIGHTS.keys())

def nba_stats_to_vec(row):
    # Only pull tendency stats — no raw PTS/AST counting
    cols = ["3PAr","FTr","3P%","TOV%","USG%","AST%","TRB%","BLK%","STL%"]
    v = {c: float(row[c] if pd.notna(row.get(c)) else 0) for c in cols}
    _add_engineered(v)
    return {k: v[k] * STYLE_WEIGHTS.get(k, 1.0) for k in STYLE_COLS}

# ---------------------------------------------------------------------------
# College → NBA translation factors
# College stats are inflated vs NBA: easier competition, weaker defenses,
# star players dominate their team more. Apply these before comparing.
# Shot selection rates (3PAr, FTr) are kept as-is — tendencies transfer.
# ---------------------------------------------------------------------------
COLLEGE_ADJ = {
    # Tendency stats — lighter adjustments since these are more stable
    "3PAr":  1.00,  # shot selection transfers directly
    "FTr":   0.95,  # rim aggression drops slightly (NBA defenders better)
    "AST%":  0.85,  # playmaking harder to do in NBA
    "TRB%":  0.82,  # NBA players contest harder
    "BLK%":  0.78,  # NBA finishers are much harder to block
    "STL%":  0.82,
    "3P%":   0.88,  # 3P% regresses at NBA level
    "TOV%":  1.05,  # pressure increases
    "USG%":  0.87,  # usage redistributes in NBA
}

def apply_college_adj(v):
    for stat, factor in COLLEGE_ADJ.items():
        if stat in v:
            if isinstance(factor, float) and factor < 0.5:
                v[stat] = v[stat] + factor   # additive adjustment (TS%)
            else:
                v[stat] = v[stat] * factor
    return v

def college_stats_to_vec(row):
    # Tendency stats only — no raw counting stats
    mp  = max(float(row.get("mp_per_g",28) or 28), 10)
    fg  = float(row.get("fg_per_g",0) or 0)
    fga = float(row.get("fga_per_g",0) or 0)
    fta = float(row.get("fta_per_g",0) or 0)
    ast = float(row.get("ast_per_g",0) or 0)
    trb = float(row.get("trb_per_g",0) or 0)
    stl = float(row.get("stl_per_g",0) or 0)
    blk = float(row.get("blk_per_g",0) or 0)
    tov = float(row.get("tov_per_g",0) or 0)
    fac = 40.0 / mp
    v = {
        "3PAr": float(row.get("fg3a_per_fga_pct",0) or 0),
        "FTr":  float(row.get("fta_per_fga_pct",0) or 0),
        "3P%":  float(row.get("fg3_pct",0) or 0),
        "TOV%": float(row.get("tov_pct",0) or 0),
        "USG%": np.clip((fga+0.44*fta+tov)*fac/TEAM_POSS_40*100, 5, 50),
        "AST%": np.clip(ast/max(TEAM_FGM_40*(mp/40)-fg,1)*100, 0, 60),
        "TRB%": np.clip(trb/(TEAM_TRB_40*(mp/40))*100, 0, 35),
        "BLK%": np.clip(blk/max(OPP_2PA_40*(mp/40),1)*100, 0, 15),
        "STL%": np.clip(stl/max(OPP_POSS_40*(mp/40),1)*100, 0, 8),
    }
    apply_college_adj(v)
    _add_engineered(v)
    return {k: v[k] * STYLE_WEIGHTS.get(k, 1.0) for k in STYLE_COLS}

def _add_engineered(v):
    v["playmaker_index"] = np.clip(v["AST%"] / max(v["USG%"], 0.1), 0, 4)
    v["three_vs_free"]   = v["3PAr"] / max(v["3PAr"] + v["FTr"], 0.01)
    v["floor_spacer"]    = v["3PAr"] * v["3P%"]
    v["rim_attack"]      = v["FTr"] * (1 - v["3PAr"])
    # defensive_type: 1.0 = pure rim protector (high BLK%, low STL%)
    #                 0.0 = pure perimeter defender (high STL%, low BLK%)
    v["defensive_type"]  = v["BLK%"] / max(v["BLK%"] + v["STL%"], 0.01)

# ---------------------------------------------------------------------------
# 1. Build NBA player feature matrix (style only — physicals stored separately)
# ---------------------------------------------------------------------------
master = pd.read_csv(f"{DATA}/master.csv", low_memory=False)
master = master[
    master["Offensive Archetype"].notna() &
    master["Defensive Role"].notna() &
    (master["Offensive Archetype"] != "Low Minute") &
    (master["Defensive Role"] != "Low Activity")
].copy().reset_index(drop=True)

nba_rows = []
nba_phys = []   # store physicals separately — used for filtering only
for _, row in master.iterrows():
    pb = pos_bucket(row["Pos"])
    ht, ws, wt = get_phys(str(row["Player"]), pb)
    nba_rows.append(nba_stats_to_vec(row))
    nba_phys.append({"ht": ht, "ws": ws, "wt": wt})

nba_X    = pd.DataFrame(nba_rows).fillna(0)
nba_phys = pd.DataFrame(nba_phys)
FEAT_COLS = list(nba_X.columns)

# Store NBA position on the 1-5 scale for adjacency filtering
POS_RANK = {"PG":1,"SG":2,"SF":3,"PF":4,"C":5}
def primary_pos_rank(pos_str):
    """For dual-position players (SF/PF), use the LARGER position rank.
    This ensures Wilson (SF/PF → PF=4) can match C comps (5), and
    guards listed PG/SG get SG=2 so they can match SF comps."""
    if pd.isna(pos_str): return 3
    parts = [p.strip() for p in str(pos_str).upper().replace("-","/").split("/")]
    ranks = [POS_RANK.get(p, 3) for p in parts if p in POS_RANK]
    return max(ranks) if ranks else 3

nba_pos_rank = np.array([primary_pos_rank(r["Pos"]) for _, r in master.iterrows()])
print(f"NBA players: {len(nba_X)} | Style features: {len(FEAT_COLS)}")

# ---------------------------------------------------------------------------
# 2. Fit StandardScaler + PCA on NBA players
# ---------------------------------------------------------------------------
scaler = StandardScaler()
nba_scaled = scaler.fit_transform(nba_X)

pca = PCA(n_components=0.90, random_state=42)  # keep 90% of variance
nba_pca = pca.fit_transform(nba_scaled)
n_comp = pca.n_components_
var_explained = pca.explained_variance_ratio_.cumsum()[-1]
print(f"PCA: {n_comp} components explain {var_explained:.1%} of variance")

# ---------------------------------------------------------------------------
# 3. Build prospect feature matrix
# ---------------------------------------------------------------------------
prospects = pd.read_csv(f"{DATA}/prospect_stats.csv", low_memory=False)
big_board  = pd.read_csv(f"{DATA}/big_board.csv")
has_stats  = prospects[prospects["sr_found"]==1].copy().reset_index(drop=True)

pros_rows = []
pros_phys = []
pros_pos_rank = []
for _, row in has_stats.iterrows():
    name = str(row["Name"])
    pb   = pos_bucket(row["Pos"])
    if name in PROSPECT_COMBINE:
        ht, ws, wt, _ = PROSPECT_COMBINE[name]
    else:
        ht, ws, wt = POS_AVG_PHYSICALS.get(pb, (78,81,210))
    pros_rows.append(college_stats_to_vec(row))
    pros_phys.append({"ht": ht, "ws": ws, "wt": wt})
    pros_pos_rank.append(primary_pos_rank(row["Pos"]))

pros_X        = pd.DataFrame(pros_rows, columns=FEAT_COLS).fillna(0)
pros_phys     = pd.DataFrame(pros_phys)
pros_pos_rank = np.array(pros_pos_rank)

# ---------------------------------------------------------------------------
# 4. Project prospects into PCA space
#    Then for each prospect: apply physical filter FIRST, then KNN in style space
#
#    Filters applied before style matching:
#      1. Position adjacency: ±1 step on PG→SG→SF→PF→C scale
#         (PG can comp SG, not SF; SF can comp SG or PF, not PG or C)
#      2. Height:   ±2.5 inches
#      3. Wingspan: ±3.0 inches
#      4. Weight:   ±35 lbs
#    If combined filter leaves < MIN_POOL candidates, relax physical
#    tolerances only (position adjacency is never relaxed).
# ---------------------------------------------------------------------------
POS_TOL      = 1     # max position steps on PG→SG→SF→PF→C scale
HEIGHT_TOL   = 2.5   # inches
WING_TOL     = 3.0   # inches
WEIGHT_PCT   = 0.18  # weight must be within ±18% of prospect's weight
MIN_POOL     = 6     # minimum candidates before relaxing physical tolerances
WEAK_COMP_TH = 65    # below this combined similarity → flag as weak comp
STYLE_WEIGHT = 0.50  # style vs physical balance (0.5 = equal weight)

pros_scaled = scaler.transform(pros_X)
pros_pca    = pca.transform(pros_scaled)

def find_comps(pros_idx, n=5):
    ph     = pros_phys.iloc[pros_idx]
    ps     = pros_pca[pros_idx]
    p_rank = pros_pos_rank[pros_idx]

    # ── 1. Position adjacency — hard filter, never relaxed ──────────────────
    pos_mask = np.abs(nba_pos_rank - p_rank) <= POS_TOL

    # ── 2. Physical range filter — percentage-based weight, relaxed if needed
    wt_tol_pct = WEIGHT_PCT
    phys_extra  = 0.0
    while True:
        mask = (
            pos_mask &
            (np.abs(nba_phys["ht"] - ph["ht"])       <= HEIGHT_TOL + phys_extra) &
            (np.abs(nba_phys["ws"] - ph["ws"])       <= WING_TOL   + phys_extra) &
            (np.abs(nba_phys["wt"] - ph["wt"]) / ph["wt"] <= wt_tol_pct)
        )
        pool_idx = np.where(mask)[0]
        if len(pool_idx) >= MIN_POOL:
            break
        # Relax physical tolerances (never position)
        phys_extra  += 0.75
        wt_tol_pct  += 0.05
        if phys_extra > 6:
            break

    if len(pool_idx) == 0:
        pool_idx = np.where(pos_mask)[0]  # fallback: position only

    # ── 3. Compute physical similarity score (continuous, normalized) ────────
    pool_phys = nba_phys.iloc[pool_idx]
    ht_std    = max(nba_phys["ht"].std(), 0.1)
    ws_std    = max(nba_phys["ws"].std(), 0.1)
    wt_std    = max(nba_phys["wt"].std(), 0.1)
    phys_dist = np.sqrt(
        ((pool_phys["ht"] - ph["ht"]) / ht_std) ** 2 +
        ((pool_phys["ws"] - ph["ws"]) / ws_std) ** 2 +
        ((pool_phys["wt"] - ph["wt"]) / wt_std) ** 2
    ).values
    phys_sim  = np.clip(100 - phys_dist * 20, 0, 100)

    # ── 4. Style similarity score (PCA distance) ────────────────────────────
    pool_pca  = nba_pca[pool_idx]
    style_dist = np.linalg.norm(pool_pca - ps, axis=1)
    style_sim  = np.clip(100 - style_dist * 8, 0, 100)

    # ── 5. Rank by style within the physically-valid pool ───────────────────
    # Frame was the gate — style is the ranking.
    # Physical score is shown for reference but doesn't affect order.
    top_local = np.argsort(-style_sim)[:n]

    results = []
    for local_i in top_local:
        global_i = pool_idx[local_i]
        results.append((global_i,
                        round(float(style_sim[local_i]), 1),   # primary score
                        round(float(style_sim[local_i]), 1),
                        round(float(phys_sim[local_i]),  1)))
    return results

# ---------------------------------------------------------------------------
# 5. Report
# ---------------------------------------------------------------------------
print(f"\n{'='*72}")
print("ML PLAYER COMPS — 2026 NBA DRAFT PROSPECTS")
print(f"PCA space: {n_comp} dimensions trained on {len(nba_X)} NBA players")
print(f"{'='*72}\n")

results = []
for i, row in has_stats.iterrows():
    name   = row["Name"]
    rank   = row["Rank"]
    bb_row = big_board[big_board["Name"]==name]
    pos    = bb_row["Pos"].values[0] if len(bb_row) else row["Pos"]
    ph     = pros_phys.iloc[i]
    ht_str = f"{int(ph['ht']//12)}'{ph['ht']%12:.1f}\""

    comp_matches = find_comps(i, n=5)
    comps = []
    for global_j, combined, style_s, phys_s in comp_matches:
        nba_row = master.iloc[global_j]
        nba_ph  = nba_phys.iloc[global_j]
        ht_nba  = f"{int(nba_ph['ht']//12)}'{nba_ph['ht']%12:.0f}\""
        ws_nba  = f"{int(nba_ph['ws']//12)}'{nba_ph['ws']%12:.0f}\""
        wt_nba  = int(nba_ph['wt'])
        comps.append({
            "name":       nba_row["Player"],
            "pos":        nba_row["Pos"],
            "off_arch":   nba_row["Offensive Archetype"],
            "def_role":   nba_row["Defensive Role"],
            "ht":         ht_nba, "ws": ws_nba, "wt": wt_nba,
            "similarity": combined,
            "style_sim":  style_s,
            "phys_sim":   phys_s,
            "weak":       combined < WEAK_COMP_TH,
        })

    results.append({"rank": rank, "name": name, "pos": pos,
                    "ht": ht_str, "wt": int(ph["wt"]), "comps": comps})

    # Print — clean table layout
    ph  = pros_phys.iloc[i]
    ws_in  = ph["ws"]
    ws_str = f"{int(ws_in//12)}'{ws_in%12:.1f}\""
    reach_raw = PROSPECT_COMBINE.get(name, (None,None,None,None))[3]
    reach_str = (f"{int(reach_raw//12)}'{reach_raw%12:.1f}\"" if reach_raw else "—")

    print(f"\n{'━'*62}")
    print(f"  #{rank}  {name}  ({pos})")
    print(f"  {'Height':10} {ht_str}   {'Wingspan':10} {ws_str}   {'Weight':8} {int(ph['wt'])} lbs   Reach {reach_str}")
    print(f"{'─'*62}")

    for c in comps[:3]:
        flag = "  ⚠ weak style match" if c["weak"] else ""
        print(f"  {c['name']:<26}  {c['similarity']:.0f}% style match  (frame {c['phys_sim']:.0f}%){flag}")

        # Side-by-side measurement diffs
        ht_diff  = abs(float(ph['ht']) - float(c['ht'].replace("'","*").replace('"','').split('*')[0])*12
                       - float(c['ht'].replace('"','').split("'")[1]) if "'" in c['ht'] else 0)
        wt_diff  = abs(int(ph['wt']) - c['wt'])

        def parse_ht(s):
            # "6'8" → inches
            parts = s.replace('"','').split("'")
            return int(parts[0])*12 + float(parts[1])

        ht_p   = ph['ht'];   ht_c = parse_ht(c['ht'])
        ws_p   = ph['ws'];   ws_c = parse_ht(c['ws'])
        wt_p   = ph['wt'];   wt_c = c['wt']

        def diff_str(val_p, val_c, unit=""):
            d = val_p - val_c
            arrow = "↑" if d > 0 else ("↓" if d < 0 else "=")
            return f"{arrow}{abs(d):.1f}{unit}" if d != 0 else "="

        in_unit = '"'
        lb_unit = ' lbs'
        print(f"    Ht  {ht_str:>8}  vs  {c['ht']:<8}  ({diff_str(ht_p, ht_c, in_unit)})")
        print(f"    Ws  {ws_str:>8}  vs  {c['ws']:<8}  ({diff_str(ws_p, ws_c, in_unit)})")
        print(f"    Wt  {int(ph['wt']):>5} lbs  vs  {c['wt']:<5} lbs ({diff_str(wt_p, wt_c, lb_unit)})")
        print()

# ---------------------------------------------------------------------------
# Save
# ---------------------------------------------------------------------------
rows_out = []
for r in results:
    for rank, c in enumerate(r["comps"], 1):
        rows_out.append({
            "Rank":       r["rank"],
            "Prospect":   r["name"],
            "Pos":        r["pos"],
            "Comp_Rank":  rank,
            "Comp_Name":  c["name"],
            "Comp_Pos":   c["pos"],
            "Comp_Off":   c["off_arch"],
            "Comp_Def":   c["def_role"],
            "Similarity": c["similarity"],
        })

pd.DataFrame(rows_out).to_csv(f"{DATA}/prospect_comps.csv", index=False)
print(f"✓ Saved prospect_comps.csv")
