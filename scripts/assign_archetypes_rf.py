#!/usr/bin/env python3
"""
assign_archetypes_rf.py  v4  — position-split models

Architecture:
  • Three separate XGBoost classifiers per label (OFF + DEF):
      Guard  (pos_bucket G, height < 78")
      Wing   (pos_bucket W, or forward-sized wing)
      Big    (pos_bucket F or C, height > 80")
  • Each group can only be classified into archetypes that actually
    exist for that body type — no more 7-footers getting "Shot Creator"
  • Height-based group override so a listed position can't override physics
  • SMOTE balancing within each group
  • wingspan_ratio (wingspan/height) added as a feature — long vs. short arms
    matters a lot for defensive archetype especially
"""

import pandas as pd
import numpy as np
from xgboost import XGBClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import StratifiedKFold, cross_val_score
from imblearn.over_sampling import SMOTE
import warnings
warnings.filterwarnings("ignore")

DATA = "/sessions/sleepy-modest-hawking/mnt/Greenroom/greenroom/web/public/data"

# ---------------------------------------------------------------------------
# Group definitions — which archetypes are valid per size group
# ---------------------------------------------------------------------------
GUARD_OFF_CLASSES = [
    "Primary Ball Handler", "Secondary Ball Handler", "Shot Creator",
    "Movement Shooter", "Stationary Shooter", "Off Screen Shooter", "Athletic Finisher",
]
WING_OFF_CLASSES = [
    "Shot Creator", "Movement Shooter", "Stationary Shooter",
    "Off Screen Shooter", "Athletic Finisher",
]
BIG_OFF_CLASSES = [
    "Roll + Cut Big", "Stretch Big", "Shot Creator",
    "Athletic Finisher", "Stationary Shooter", "Versatile Big",
]

GUARD_DEF_CLASSES = ["Point of Attack", "Chaser", "Helper", "Wing Stopper"]
WING_DEF_CLASSES  = ["Wing Stopper", "Helper", "Chaser", "Point of Attack"]
BIG_DEF_CLASSES   = ["Mobile Big", "Anchor Big", "Helper", "Wing Stopper"]

# Merge rare classes before splitting
OFF_MERGE = {
    "Post Scorer":     "Roll + Cut Big",   # traditional big → same bucket
    "Slasher":         "Athletic Finisher", # non-shooting attacker
    "Versatile Big":   "Roll + Cut Big",    # merge into bigger class for Guards/Wings
}
# (Versatile Big stays in BIG_OFF_CLASSES — only merged if it ends up in wrong group)
DEF_MERGE = {"Low Activity": None}  # drop entirely

# ---------------------------------------------------------------------------
# Physicals — exact measurements (height no-shoes in", wingspan in", weight lbs)
# ---------------------------------------------------------------------------
PROSPECT_PHYSICALS = {
    "Darryn Peterson":   (77.5, 80.0, 195), "AJ Dybantsa":        (79.5, 84.5, 195),
    "Caleb Wilson":      (80.5, 86.0, 205), "Kingston Flemings":  (76.75,79.0, 190),
    "Keaton Wagler":     (78.0, 80.0, 195), "Mikel Brown Jr.":    (75.0, 77.0, 175),
    "Nate Ament":        (78.0, 82.0, 200), "Brayden Burries":    (75.5, 78.0, 185),
    "Labaron Philon":    (74.75,77.0, 175), "Yaxel Lendeborg":    (79.5, 86.0, 230),
    "Hannes Steinbach":  (79.0, 84.0, 220), "Braylon Mullins":    (75.5, 78.0, 185),
    "Thomas Haugh":      (79.0, 82.0, 215), "Koa Peat":           (80.0, 85.0, 225),
    "Chris Cenac Jr.":   (79.5, 85.0, 220), "Tounde Yessoufou":   (77.0, 81.0, 195),
    "Jayden Quaintance": (79.5, 85.0, 220), "Bennett Stirtz":     (75.0, 77.0, 185),
    "Tyler Tanner":      (74.0, 76.0, 175), "Joshua Jefferson":   (79.5, 86.0, 205),
    "Morez Johnson Jr.": (80.5, 87.0, 230), "Dailyn Swain":       (77.5, 80.0, 195),
    "Isaiah Evans":      (77.5, 81.0, 195), "Ebuka Okorie":       (77.0, 80.0, 190),
    "Meleek Thomas":     (76.5, 79.0, 185), "Aday Mara":          (86.0, 91.0, 245),
    "Henri Veesaar":     (83.0, 88.0, 235), "Alijah Arenas":      (76.5, 79.0, 185),
    "Flory Bidunga":     (80.5, 87.0, 230), "Zuby Ejiofor":       (79.5, 85.0, 225),
    "Alex Karaban":      (79.5, 84.0, 215), "Braden Smith":       (73.0, 76.0, 175),
    "Motiejus Krivas":   (83.0, 89.0, 245), "Juke Harris":        (77.0, 80.0, 195),
    "Richie Saunders":   (78.5, 84.0, 205), "Tarris Reed Jr.":    (80.5, 86.0, 250),
    "JT Toppin":         (79.5, 84.0, 210), "Alex Condon":        (82.5, 87.0, 240),
    "Ryan Conwell":      (76.0, 78.5, 185), "Jaden Bradley":      (75.5, 78.0, 175),
    "Pryce Sandfort":    (78.5, 81.0, 205), "Rueben Chinyelu":    (81.0, 88.0, 240),
    "Milan Momcilovic":  (78.5, 81.0, 200), "Bruce Thornton":     (73.5, 76.0, 185),
    "Emanuel Sharp":     (76.5, 79.0, 190), "Paul McNeil Jr.":    (77.5, 81.0, 195),
    "Otega Oweh":        (76.5, 80.0, 195), "Tamin Lipsey":       (74.0, 77.0, 185),
    "Trevon Brazile":    (80.5, 86.0, 225), "Baba Miller":        (79.5, 86.0, 220),
    "Keyshawn Hall":     (78.0, 82.0, 205), "Miles Byrd":         (77.5, 81.0, 195),
    "Zvonimir Ivisic":   (84.5, 89.0, 245), "Milos Uzan":         (74.0, 76.0, 175),
    "Darrion Williams":  (78.5, 82.0, 200), "Tomislav Ivisic":    (82.0, 88.0, 245),
    "Dillon Mitchell":   (79.0, 85.0, 210), "Andrej Stojakovic":  (78.5, 81.0, 195),
    "Tahaad Pettiford":  (72.5, 76.0, 175), "Kylan Boswell":      (73.5, 76.0, 175),
    "Coen Carr":         (77.5, 81.0, 200), "Tucker DeVries":     (78.0, 80.0, 200),
    "KJ Lewis":          (78.0, 81.0, 200), "Malik Reneau":       (79.5, 84.0, 220),
    "Solo Ball":         (76.0, 78.0, 185),
}
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
    "Nick Richards":(83.0,87.5,257),"Kelly Olynyk":(83.0,86.5,238),
    "Adem Bona":(82.0,87.5,235),"Jonathan Mogbo":(81.0,85.5,225),
    "Asa Newell":(82.0,86.5,220),"Zach Collins":(84.0,87.5,250),
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

def get_phys(name, lookup, pb):
    if name in lookup: return lookup[name]
    return POS_AVG_PHYSICALS.get(pb,(78,81,210))

def size_group(height_in, pb):
    """Assign to Guard/Wing/Big based on height (primary) + position (tiebreak)."""
    if height_in >= 82 or pb == "C":   return "Big"
    if height_in >= 80 or pb == "F":   return "Big"
    if height_in >= 77.5 or pb == "W": return "Wing"
    return "Guard"

# ---------------------------------------------------------------------------
# Feature design — only keep what the importance analysis showed matters.
# Drop: eFG% (redundant with FG%+3P%), raw STL/BLK/TRB counts (rate stats cover it)
# Add 5 engineered features that directly separate similar archetypes.
# ---------------------------------------------------------------------------
#
# Engineered feature rationale:
#   playmaker_index  = AST% / USG%  → pass-first (high) vs scorer (low)
#   three_vs_free    = 3PAr / (3PAr+FTr+0.01) → pure shooter (→1) vs rim attacker (→0)
#   floor_spacer     = 3PAr × 3P%   → quality of floor spacing threat
#   rim_attack       = FTr × (1-3PAr) → frequency of attacking rim over shooting
#   wingspan_delta   = wingspan_in - height_in → extra reach (key for def archetypes)
#
# Raw counting stats kept: PTS, AST (volume matters, not just rate)
# Rate stats kept: TS%, 3PAr, FTr, FG%, 3P%, FT%, TOV%, USG%, AST%, TRB%, BLK%, STL%
# ---------------------------------------------------------------------------

NBA_STAT_COLS = [
    "TS%","3PAr","FTr","FG%","3P%","FT%",
    "TOV%","USG%","AST%","TRB%","BLK%","STL%",
    "PTS","AST",
]
COLL_DIRECT = [
    "ts_pct","fg3a_per_fga_pct","fta_per_fga_pct","fg_pct",
    "fg3_pct","ft_pct","tov_pct",
]

TEAM_POSS_40=65.0; TEAM_FGM_40=27.0; TEAM_TRB_40=38.0
OPP_2PA_40=35.0;   OPP_POSS_40=65.0

def estimate_college_rates(row):
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
    usg     = (fga + 0.44*fta + tov) * fac / TEAM_POSS_40 * 100
    ast_pct = ast / max(TEAM_FGM_40*(mp/40) - fg, 1) * 100
    trb_pct = trb / (TEAM_TRB_40 * (mp/40)) * 100
    blk_pct = blk / max(OPP_2PA_40*(mp/40), 1) * 100
    stl_pct = stl / max(OPP_POSS_40*(mp/40), 1) * 100
    return {
        "USG%": np.clip(usg, 5, 50),
        "AST%": np.clip(ast_pct, 0, 60),
        "TRB%": np.clip(trb_pct, 0, 35),
        "BLK%": np.clip(blk_pct, 0, 15),
        "STL%": np.clip(stl_pct, 0, 8),
        "AST":  ast, "PTS": float(row.get("pts_per_g",0) or 0),
    }

def add_engineered(d):
    """Add 5 engineered features to a stat dict."""
    usg  = max(d.get("USG%", 15), 0.1)
    ast_ = d.get("AST%", 0)
    thr  = d.get("3PAr", 0)
    ftr  = d.get("FTr",  0)
    p3   = d.get("3P%",  0)
    ws   = d.get("wingspan_in", 82)
    ht   = d.get("height_in",   78)
    d["playmaker_index"] = np.clip(ast_ / usg,          0, 4)
    d["three_vs_free"]   = thr / max(thr + ftr, 0.01)
    d["floor_spacer"]    = thr * p3
    d["rim_attack"]      = ftr * (1 - thr)
    d["wingspan_delta"]  = ws - ht
    return d

def build_X(df, is_nba, phys_lookup):
    rows, groups = [], []
    for _, row in df.iterrows():
        pb   = pos_bucket(row["Pos"])
        name = str(row["Player" if is_nba else "Name"])
        h, ws, wt = get_phys(name, phys_lookup, pb)
        grp  = size_group(h, pb)
        groups.append(grp)

        if is_nba:
            stats = {c: float(row[c] if pd.notna(row[c]) else 0) for c in NBA_STAT_COLS}
            # Add rate stats not in NBA_STAT_COLS (TRB%, BLK%, STL%)
            for c in ["TRB%","BLK%","STL%"]:
                stats[c] = float(row[c] if pd.notna(row[c]) else 0)
        else:
            direct = {nba: float(row[coll] if pd.notna(row[coll]) else 0)
                      for nba, coll in zip(
                          ["TS%","3PAr","FTr","FG%","3P%","FT%","TOV%"],
                          COLL_DIRECT)}
            rates  = estimate_college_rates(row)
            stats  = {**direct, **rates}

        feat = {
            **stats,
            "height_in":   h,
            "wingspan_in": ws,
            "weight_lbs":  wt,
        }
        feat = add_engineered(feat)
        rows.append(feat)

    return pd.DataFrame(rows), groups

# ---------------------------------------------------------------------------
# 1. Load NBA training data
# ---------------------------------------------------------------------------
master = pd.read_csv(f"{DATA}/master.csv", low_memory=False)
master = master[
    master["Offensive Archetype"].notna() &
    master["Defensive Role"].notna() &
    (master["Offensive Archetype"] != "Low Minute") &
    (master["Defensive Role"] != "Low Activity")
].copy().reset_index(drop=True)

# Apply global merges
master["Offensive Archetype"] = master["Offensive Archetype"].replace(
    {"Post Scorer":"Roll + Cut Big","Slasher":"Athletic Finisher"}
)

nba_X_all, nba_groups = build_X(master, True, NBA_PHYSICALS)
FEAT_COLS = list(nba_X_all.columns)

print(f"NBA samples: {len(master)}")
real = sum(1 for _,r in master.iterrows() if str(r["Player"]) in NBA_PHYSICALS)
print(f"NBA physicals: {real} real / {len(master)-real} pos-avg")

# ---------------------------------------------------------------------------
# 2. Train per-group models
# ---------------------------------------------------------------------------
GROUP_OFF = {"Guard": GUARD_OFF_CLASSES, "Wing": WING_OFF_CLASSES, "Big": BIG_OFF_CLASSES}
GROUP_DEF = {"Guard": GUARD_DEF_CLASSES, "Wing": WING_DEF_CLASSES, "Big": BIG_DEF_CLASSES}

# Per-group XGBoost params — Wing is small (58 players), needs heavier regularization
XGB_PARAMS = {
    "Guard": dict(n_estimators=400, max_depth=5,  learning_rate=0.05,
                  subsample=0.8, colsample_bytree=0.8, min_child_weight=2,
                  eval_metric="mlogloss", random_state=42, verbosity=0),
    "Wing":  dict(n_estimators=300, max_depth=3,  learning_rate=0.05,
                  subsample=0.7, colsample_bytree=0.7, min_child_weight=4,
                  gamma=1.0, reg_lambda=2.0,
                  eval_metric="mlogloss", random_state=42, verbosity=0),
    "Big":   dict(n_estimators=400, max_depth=5,  learning_rate=0.05,
                  subsample=0.8, colsample_bytree=0.8, min_child_weight=2,
                  eval_metric="mlogloss", random_state=42, verbosity=0),
}

models_off = {}; le_offs = {}
models_def = {}; le_defs = {}
cv_results  = {}

for grp in ["Guard","Wing","Big"]:
    mask = [g == grp for g in nba_groups]
    sub  = master[mask].copy().reset_index(drop=True)
    X_g  = nba_X_all[mask].reset_index(drop=True)

    # Filter to allowed OFF classes for this group — drop players with other archetypes
    allowed_off = set(GROUP_OFF[grp])
    allowed_def = set(GROUP_DEF[grp])
    off_mask = sub["Offensive Archetype"].isin(allowed_off)
    def_mask = sub["Defensive Role"].isin(allowed_def)

    sub_off = sub[off_mask].reset_index(drop=True)
    X_off   = X_g[off_mask].reset_index(drop=True)
    sub_def = sub[def_mask].reset_index(drop=True)
    X_def   = X_g[def_mask].reset_index(drop=True)

    le_o = LabelEncoder(); le_d = LabelEncoder()
    y_o  = le_o.fit_transform(sub_off["Offensive Archetype"])
    y_d  = le_d.fit_transform(sub_def["Defensive Role"])

    # SMOTE — only if ≥2 classes with ≥2 samples
    min_o = min(np.bincount(y_o)) if len(np.unique(y_o)) > 1 else 99
    min_d = min(np.bincount(y_d)) if len(np.unique(y_d)) > 1 else 99
    if min_o >= 2 and len(np.unique(y_o)) > 1:
        k = min(5, min_o - 1)
        X_off_r, y_off_r = SMOTE(random_state=42, k_neighbors=k).fit_resample(X_off, y_o)
    else:
        X_off_r, y_off_r = X_off, y_o
    if min_d >= 2 and len(np.unique(y_d)) > 1:
        k = min(5, min_d - 1)
        X_def_r, y_def_r = SMOTE(random_state=42, k_neighbors=k).fit_resample(X_def, y_d)
    else:
        X_def_r, y_def_r = X_def, y_d

    clf_o = XGBClassifier(**XGB_PARAMS[grp], num_class=len(le_o.classes_))
    clf_d = XGBClassifier(**XGB_PARAMS[grp], num_class=len(le_d.classes_))
    clf_o.fit(X_off_r, y_off_r)
    clf_d.fit(X_def_r, y_def_r)

    # CV on original (non-resampled)
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    if len(np.unique(y_o)) > 1 and len(sub_off) >= 10:
        cv_o = cross_val_score(clf_o, X_off, y_o, cv=skf).mean()
    else:
        cv_o = float("nan")
    if len(np.unique(y_d)) > 1 and len(sub_def) >= 10:
        cv_d = cross_val_score(clf_d, X_def, y_d, cv=skf).mean()
    else:
        cv_d = float("nan")

    models_off[grp] = clf_o; le_offs[grp] = le_o
    models_def[grp] = clf_d; le_defs[grp] = le_d
    cv_results[grp] = (cv_o, cv_d)

    print(f"\n{grp:6} ({len(sub_off)} OFF / {len(sub_def)} DEF):")
    print(f"  OFF classes : {list(le_o.classes_)}")
    print(f"  DEF classes : {list(le_d.classes_)}")
    print(f"  CV accuracy : OFF {cv_o:.1%}  DEF {cv_d:.1%}")

# Weighted average accuracy
total = len(master)
wa_off = sum(cv_results[g][0] * sum(1 for x in nba_groups if x==g) / total
             for g in ["Guard","Wing","Big"] if not np.isnan(cv_results[g][0]))
wa_def = sum(cv_results[g][1] * sum(1 for x in nba_groups if x==g) / total
             for g in ["Guard","Wing","Big"] if not np.isnan(cv_results[g][1]))
print(f"\nWeighted CV avg  →  OFF: {wa_off:.1%}   DEF: {wa_def:.1%}")

# ---------------------------------------------------------------------------
# 3. Load + prepare prospects
# ---------------------------------------------------------------------------
prospects = pd.read_csv(f"{DATA}/prospect_stats.csv", low_memory=False)
big_board  = pd.read_csv(f"{DATA}/big_board.csv")
has_stats  = prospects[prospects["sr_found"]==1].copy().reset_index(drop=True)

p_X_all, p_groups = build_X(has_stats, False, PROSPECT_PHYSICALS)
p_X_all = p_X_all[FEAT_COLS]

# ---------------------------------------------------------------------------
# 4. Predict per prospect using appropriate group model
# ---------------------------------------------------------------------------
print(f"\n{'='*82}")
print(f"{'#':<5} {'Name':<24} {'H':<5} {'Group':<7} "
      f"{'Offensive Archetype (conf)':<36} {'Defensive Role (conf)'}")
print(f"{'='*82}")

results = []
for i, row in has_stats.iterrows():
    name  = row["Name"]
    rank  = row["Rank"]
    grp   = p_groups[i]
    x     = p_X_all.iloc[[i]]

    # Height display
    h = PROSPECT_PHYSICALS.get(name, POS_AVG_PHYSICALS.get(pos_bucket(row["Pos"]),(78,81,210)))[0]
    hstr = f"{int(h//12)}'{int(h%12)}\""

    # Offensive prediction
    off_prob = models_off[grp].predict_proba(x)[0]
    off_idx  = np.argmax(off_prob)
    ml_off   = le_offs[grp].classes_[off_idx]
    oconf    = off_prob[off_idx]

    # Defensive prediction
    def_prob = models_def[grp].predict_proba(x)[0]
    def_idx  = np.argmax(def_prob)
    ml_def   = le_defs[grp].classes_[def_idx]
    dconf    = def_prob[def_idx]

    print(f"  #{rank:<4} {name:<24} {hstr:<5} {grp:<7} "
          f"{ml_off} ({oconf:.0%})  |  {ml_def} ({dconf:.0%})")
    results.append({
        "Rank": rank, "Name": name,
        "Size Group": grp,
        "ML Offensive Archetype": ml_off, "ML Off Confidence": round(float(oconf),3),
        "ML Defensive Role": ml_def,      "ML Def Confidence": round(float(dconf),3),
    })

# ---------------------------------------------------------------------------
# 5. Save
# ---------------------------------------------------------------------------
pd.DataFrame(results).to_csv(f"{DATA}/prospect_archetype_ml.csv", index=False)

ml_map = {r["Name"]: r for r in results}
def apply_ml(df):
    for idx, row in df.iterrows():
        if row["Name"] in ml_map:
            r = ml_map[row["Name"]]
            df.at[idx,"Offensive Archetype"] = r["ML Offensive Archetype"]
            df.at[idx,"Defensive Role"]       = r["ML Defensive Role"]
    return df

apply_ml(big_board).to_csv(f"{DATA}/big_board.csv", index=False)
apply_ml(prospects).to_csv(f"{DATA}/prospect_stats.csv", index=False)
print(f"\n✓ Updated big_board.csv + prospect_stats.csv")
print("Done.")
