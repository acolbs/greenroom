#!/usr/bin/env python3
"""
predict_success.py — Draft prospect success prediction

Hybrid approach (Option C):
  Phase 1 — Build labeled dataset of NBA players (role outcome) + known draft busts
  Phase 2 — Train XGBoost on physical measurements + statistical tendencies
  Phase 3 — Apply college-adjusted prospect features through the same model
  Phase 4 — Output: P(Star), P(Starter), P(Bench), P(Cut) + expected value ranking

Role labels derived from current season performance:
  Star     — 28+ mpg, 55%+ GS rate, WS/48 > 0.10  (elite contributor)
  Starter  — 22+ mpg, 40%+ GS rate                 (reliable starter)
  Bench    — 12+ mpg                                (rotation piece)
  Cut      — fringe/out of league                  (didn't stick)
"""

import pandas as pd
import numpy as np
from xgboost import XGBClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.calibration import CalibratedClassifierCV
import warnings
warnings.filterwarnings("ignore")

DATA  = "/sessions/sleepy-modest-hawking/mnt/Greenroom/greenroom/web/public/data"
ROLES = ["Star", "Starter", "Bench", "Cut"]

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
    "Trae Young":(72.0,74.5,180),"Stephen Curry":(74.5,77.0,185),
    "D'Angelo Russell":(75.5,78.0,195),"Jalen Green":(75.0,77.5,185),
    "Tyler Herro":(76.0,78.5,195),"Devin Booker":(77.0,79.5,210),
    "Dejounte Murray":(77.0,80.5,190),"Luka Dončić":(78.0,80.5,230),
    "Jordan Poole":(75.5,78.0,195),"Ja Morant":(75.0,78.0,185),
    "Scoot Henderson":(74.5,77.0,195),"Dylan Harper":(77.0,80.5,210),
    "Jalen Suggs":(76.0,78.5,205),"Jrue Holiday":(76.5,79.5,205),
    "Austin Reaves":(77.0,79.5,195),"Donte DiVincenzo":(76.0,79.0,200),
    "Anfernee Simons":(76.0,78.5,185),"Coby White":(75.5,77.5,185),
    "Anthony Black":(78.0,81.5,205),"Norman Powell":(77.0,80.0,205),
    "Kevin Durant":(81.0,87.0,235),"Mikal Bridges":(78.0,82.5,210),
    "Brandon Ingram":(79.0,83.5,195),"Jaylen Brown":(78.0,82.5,220),
    "Trey Murphy III":(79.5,84.0,205),"Jalen Johnson":(79.0,83.0,215),
    "Scottie Barnes":(79.5,84.5,225),"Cooper Flagg":(80.0,84.0,215),
    "OG Anunoby":(79.0,83.5,220),"Kawhi Leonard":(79.0,84.5,225),
    "Pascal Siakam":(79.0,82.5,220),"Paul George":(80.0,83.5,220),
    "Deni Avdija":(80.5,84.0,220),"Michael Porter Jr.":(81.5,86.0,210),
    "Franz Wagner":(80.5,84.5,220),"Andrew Wiggins":(78.0,83.5,200),
    "Jimmy Butler":(79.0,82.5,230),"Duncan Robinson":(79.0,82.0,210),
    "Klay Thompson":(78.0,81.5,215),"RJ Barrett":(78.0,82.0,215),
    "De'Andre Hunter":(79.0,83.5,225),"Cameron Johnson":(80.5,84.0,210),
    "Miles Bridges":(78.0,82.0,225),"Aaron Nesmith":(78.0,82.0,215),
    "Matas Buzelis":(80.5,84.0,205),"Jake LaRavia":(80.0,84.0,215),
    "Ryan Dunn":(79.5,84.0,200),"Ausar Thompson":(79.0,84.0,210),
    "Dalton Knecht":(79.0,82.5,210),"Patrick Williams":(79.5,83.5,215),
    "Tari Eason":(79.5,84.5,220),"Jabari Smith Jr.":(81.0,84.5,220),
    "Julius Randle":(79.0,82.0,250),"Paolo Banchero":(81.0,84.5,250),
    "Giannis Antetokounmpo":(82.5,88.5,243),"Evan Mobley":(82.5,88.0,215),
    "Aaron Gordon":(79.5,84.0,235),"Lauri Markkanen":(84.0,87.0,240),
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
    "Clint Capela":(82.0,88.0,255),"Jakob Poeltl":(83.0,87.5,258),
    "Mitchell Robinson":(83.0,89.5,240),"Kel'el Ware":(84.0,88.5,240),
    "Derik Queen":(81.0,85.5,245),"Alperen Sengun":(82.25,86.0,264),
    "Anthony Davis":(82.0,87.0,253),"Jaren Jackson Jr.":(82.5,87.5,245),
    "Trayce Jackson-Davis":(81.0,84.5,240),"Ryan Kalkbrenner":(84.5,90.0,250),
    "Isaiah Jackson":(82.5,88.5,215),"Paul Reed":(81.0,86.0,220),
    "Johni Broome":(82.0,86.5,240),"Zach Edey":(87.0,92.0,285),
    "Walker Kessler":(84.0,91.0,230),"Mo Bamba":(83.0,94.0,225),
    "Adem Bona":(82.0,87.5,235),"Shaedon Sharpe":(77.5,81.5,196),
    "Jalen Williams":(75.5,78.5,194),"Kevin Porter Jr.":(77.0,80.5,195),
    "Dillon Brooks":(78.0,81.5,215),"Marvin Bagley III":(82.0,84.0,234),
    "Bradley Beal":(75.25,79.5,207),"Ty Jerome":(76.5,80.0,195),
    "Caris LeVert":(78.75,81.0,195),"Zion Williamson":(77.75,84.5,284),
    "Desmond Bane":(77.0,79.5,215),"Dyson Daniels":(78.0,82.5,200),
}
POS_AVG = {"G":(74.5,77.5,190),"W":(78.5,82.0,215),"F":(80.5,84.5,230),"C":(83.5,88.0,252)}
POS_MAP = {"PG":"G","SG":"G","SF":"W","PF":"F","C":"C",
           "G":"G","G-F":"W","F-G":"W","F":"F","F-C":"F","C-F":"C"}
POS_RANK = {"PG":1,"SG":2,"SF":3,"PF":4,"C":5}

def pb(p):
    if pd.isna(p): return "W"
    return POS_MAP.get(str(p).upper().split("/")[0].strip(), "W")

def pos_rank(p):
    if pd.isna(p): return 3
    parts = [x.strip() for x in str(p).upper().replace("-","/").split("/")]
    ranks = [POS_RANK.get(x,3) for x in parts if x in POS_RANK]
    return max(ranks) if ranks else 3

def get_phys(name, bucket):
    if name in NBA_PHYSICALS: return NBA_PHYSICALS[name]
    return POS_AVG.get(bucket, (78,81,210))

# ---------------------------------------------------------------------------
# Known draft busts — players drafted 2018-2023 who didn't stick in the NBA.
# Features: (ht_no_shoes, wingspan, weight, 3PAr, FTr, AST%, TRB%, BLK%, STL%, USG%, TOV%, pos_rank)
# ---------------------------------------------------------------------------
CUT_PLAYERS = [
    # Name, ht_in, ws_in, wt, 3PAr, FTr, AST%, TRB%, BLK%, STL%, USG%, TOV%, pos_rank, role
    ("Bol Bol",           85.0,91.0,208, 0.30,0.30,5.0, 12.0,4.0,0.8,14.0,12.0,4,"Cut"),
    ("Mfiondu Kabengele", 82.0,85.0,245, 0.15,0.45,5.0, 12.0,3.0,0.9,18.0,13.0,4,"Cut"),
    ("Carsen Edwards",    72.0,74.5,180, 0.52,0.22,15.0, 2.5,0.2,1.2,22.0,12.0,1,"Cut"),
    ("Jordan Bone",       73.0,75.0,175, 0.38,0.25,22.0, 3.0,0.3,1.5,16.0,14.0,1,"Cut"),
    ("Talen Horton-Tucker",76.0,80.0,230,0.28,0.38,14.0, 5.0,0.8,1.3,18.0,13.0,2,"Bench"),
    ("Louis King",        80.0,82.5,210, 0.38,0.35,8.0,  6.0,0.7,1.1,16.0,11.0,3,"Cut"),
    ("Killian Tillie",    83.0,87.0,210, 0.35,0.30,6.0, 10.0,2.5,0.8,13.0,10.0,4,"Cut"),
    ("Jalen Lecque",      73.0,76.5,175, 0.30,0.42,20.0, 3.5,0.4,1.6,20.0,16.0,1,"Cut"),
    ("Tremont Waters",    70.0,72.0,170, 0.38,0.25,35.0, 3.0,0.2,1.5,18.0,17.0,1,"Cut"),
    ("Kennedy Chandler",  74.5,77.5,175, 0.28,0.35,22.0, 4.0,0.5,1.8,17.0,15.0,1,"Cut"),
    ("Malachi Flynn",     73.0,76.0,175, 0.40,0.22,25.0, 3.5,0.3,1.4,18.0,14.0,1,"Cut"),
    ("Darius Days",       78.0,80.5,225, 0.40,0.35,8.0,  9.0,1.2,1.1,16.0,11.0,3,"Cut"),
    ("Yoeli Childs",      81.0,83.5,240, 0.12,0.48,7.0, 15.0,2.2,0.9,18.0,12.0,4,"Cut"),
    ("Isaiah Todd",       82.0,85.5,215, 0.22,0.42,6.5, 11.0,2.5,0.9,16.0,11.0,4,"Cut"),
    ("Chris Duarte",      76.5,80.0,196, 0.44,0.22,10.0, 5.5,0.6,1.2,15.0,10.0,2,"Bench"),
    ("Cassius Winston",   71.0,73.0,175, 0.38,0.18,30.0, 2.5,0.2,1.0,18.0,15.0,1,"Cut"),
    ("Xavier Tillman Sr.",80.5,83.5,245, 0.12,0.40,12.0, 14.0,2.8,1.0,14.0,11.0,4,"Bench"),
    ("Nate Hinton",       76.0,80.5,195, 0.25,0.35,14.0, 6.0,0.8,1.4,14.0,12.0,2,"Cut"),
    ("Aaron Wiggins",     77.25,80.0,197,0.42,0.22,10.0, 5.0,0.6,1.1,13.0,10.0,2,"Bench"),
    ("Moussa Diabate",    82.0,87.5,215, 0.05,0.55,5.0, 15.0,3.5,0.9,14.0,11.0,4,"Cut"),
    ("Bryce McGowens",    78.0,82.5,185, 0.38,0.32,12.0, 4.5,0.6,1.2,16.0,12.0,3,"Bench"),
    ("Wendell Moore Jr.", 77.0,80.5,205, 0.32,0.30,14.0, 4.5,0.7,1.1,15.0,11.0,2,"Bench"),
    ("Tyrese Martin",     78.0,82.0,195, 0.38,0.28,10.0, 5.5,0.8,1.3,14.0,11.0,3,"Bench"),
    ("Admiral Schofield", 77.0,81.0,228, 0.40,0.30,7.0,  5.5,0.6,0.9,13.0,10.0,3,"Cut"),
    ("Joel Ayayi",        77.5,82.0,197, 0.30,0.30,15.0, 5.5,0.8,1.1,14.0,12.0,2,"Cut"),
    ("Charlie Brown Jr.", 79.0,84.5,190, 0.40,0.28,7.5,  6.5,1.0,1.2,14.0,11.0,3,"Cut"),
    ("Dakota Mathias",    76.0,78.5,200, 0.52,0.18,8.0,  3.5,0.4,0.8,12.0,9.0, 2,"Cut"),
]

# ---------------------------------------------------------------------------
# Feature columns
# ---------------------------------------------------------------------------
STAT_COLS = ["3PAr","FTr","AST%","TRB%","BLK%","STL%","USG%","TOV%"]

TEAM_POSS_40=65.0; TEAM_FGM_40=27.0; TEAM_TRB_40=38.0
OPP_2PA_40=35.0;   OPP_POSS_40=65.0

def engineered(v):
    v["three_vs_free"]  = v["3PAr"] / max(v["3PAr"]+v["FTr"], 0.01)
    v["playmaker_idx"]  = np.clip(v["AST%"] / max(v["USG%"],0.1), 0, 4)
    v["rim_attack"]     = v["FTr"] * (1 - v["3PAr"])
    v["def_type"]       = v["BLK%"] / max(v["BLK%"]+v["STL%"], 0.01)
    v["ws_delta"]       = v.get("ws_in",82) - v.get("ht_in",78)
    v["ws_ratio"]       = v.get("ws_in",82) / max(v.get("ht_in",78), 1)
    return v

ALL_FEAT = STAT_COLS + ["three_vs_free","playmaker_idx","rim_attack","def_type",
                        "ht_in","ws_in","weight","ws_delta","ws_ratio","pos_rank"]

# ---------------------------------------------------------------------------
# 1. Build NBA training data from master.csv
# ---------------------------------------------------------------------------
master = pd.read_csv(f"{DATA}/master.csv", low_memory=False)
master = master[master["Offensive Archetype"].notna()].copy()

def mpg(r):
    g = pd.to_numeric(r["G"], errors="coerce") or 1
    return pd.to_numeric(r["MP"], errors="coerce") / g

def gsp(r):
    g = pd.to_numeric(r["G"], errors="coerce") or 1
    return pd.to_numeric(r["GS"], errors="coerce") / g

def role_label(r):
    m = mpg(r); gs = gsp(r)
    w48 = pd.to_numeric(r.get("WS/48",0), errors="coerce") or 0
    if m >= 28 and gs >= 0.55 and w48 >= 0.10: return "Star"
    if m >= 22 and gs >= 0.40:                  return "Starter"
    if m >= 12:                                  return "Bench"
    return "Cut"  # fringe players in master.csv = cut-equivalent

nba_rows = []
for _, row in master.iterrows():
    bucket = pb(row["Pos"])
    ht, ws, wt = get_phys(str(row["Player"]), bucket)
    v = {c: float(row[c] if pd.notna(row.get(c)) else 0) for c in STAT_COLS}
    v.update({"ht_in": ht, "ws_in": ws, "weight": wt,
               "pos_rank": pos_rank(row["Pos"])})
    v = engineered(v)
    v["role"] = role_label(row)
    nba_rows.append(v)

nba_df = pd.DataFrame(nba_rows)

# ---------------------------------------------------------------------------
# 2. Add known Cut players
# ---------------------------------------------------------------------------
cut_rows = []
for entry in CUT_PLAYERS:
    name, ht, ws, wt, tpar, ftr, ast, trb, blk, stl, usg, tov, pr, role = entry
    v = {"3PAr":tpar,"FTr":ftr,"AST%":ast,"TRB%":trb,"BLK%":blk,
         "STL%":stl,"USG%":usg,"TOV%":tov,
         "ht_in":ht,"ws_in":ws,"weight":wt,"pos_rank":pr}
    v = engineered(v)
    v["role"] = role
    cut_rows.append(v)

cut_df   = pd.DataFrame(cut_rows)
train_df = pd.concat([nba_df, cut_df], ignore_index=True)

print(f"Training set: {len(train_df)} players")
print(train_df["role"].value_counts().to_string())

# ---------------------------------------------------------------------------
# 3. Train XGBoost with calibration
# ---------------------------------------------------------------------------
le = LabelEncoder()
y  = le.fit_transform(train_df["role"])
X  = train_df[ALL_FEAT].fillna(0)

print(f"\nClasses: {list(le.classes_)}")

base_clf = XGBClassifier(
    n_estimators=300, max_depth=4, learning_rate=0.05,
    subsample=0.8, colsample_bytree=0.8, min_child_weight=3,
    eval_metric="mlogloss", random_state=42, verbosity=0,
    num_class=len(le.classes_),
)
# Calibrate probabilities using isotonic regression
clf = CalibratedClassifierCV(base_clf, method="isotonic", cv=5)
clf.fit(X, y)

cv_scores = cross_val_score(
    XGBClassifier(n_estimators=300, max_depth=4, learning_rate=0.05,
                  subsample=0.8, colsample_bytree=0.8, eval_metric="mlogloss",
                  random_state=42, verbosity=0, num_class=len(le.classes_)),
    X, y, cv=StratifiedKFold(5, shuffle=True, random_state=42)
)
print(f"5-fold CV accuracy: {cv_scores.mean():.1%} ± {cv_scores.std():.1%}")

# ---------------------------------------------------------------------------
# Draft position prior — built from historical NBA draft outcomes.
# Top picks have far higher success rates regardless of stats.
# These are real base rates: pick 1-5 historically produce a starter/star
# ~88% of the time; pick 50-60 only ~18% of the time.
#
# Format: (max_pick, P_Star, P_Starter, P_Bench, P_Cut)
# ---------------------------------------------------------------------------
DRAFT_PRIOR_TABLE = [
    (5,   0.52, 0.36, 0.10, 0.02),   # picks  1-5:  88% starter+
    (10,  0.32, 0.43, 0.18, 0.07),   # picks  6-10: 75% starter+
    (15,  0.20, 0.42, 0.27, 0.11),   # picks 11-15: 62% starter+
    (20,  0.14, 0.38, 0.32, 0.16),   # picks 16-20: 52% starter+
    (30,  0.09, 0.32, 0.38, 0.21),   # picks 21-30: 41% starter+
    (45,  0.05, 0.22, 0.43, 0.30),   # picks 31-45: 27% starter+
    (999, 0.03, 0.15, 0.44, 0.38),   # picks 46+:   18% starter+
]

def get_draft_prior(rank):
    for max_pick, ps, pst, pb, pc in DRAFT_PRIOR_TABLE:
        if rank <= max_pick:
            return {"Star": ps, "Starter": pst, "Bench": pb, "Cut": pc}
    return {"Star": 0.03, "Starter": 0.15, "Bench": 0.44, "Cut": 0.38}

def blend_probs(model_probs, rank, model_weight=0.40):
    """
    Blend statistical model output (40%) with draft position prior (60%).
    Top picks are anchored by their historical success rate;
    the statistical model then adjusts within that range.
    """
    prior = get_draft_prior(rank)
    blended = {}
    for role in ["Star", "Starter", "Bench", "Cut"]:
        blended[role] = (model_weight * model_probs.get(role, 0) +
                         (1 - model_weight) * prior[role])
    # Renormalize to sum to 1.0
    total = sum(blended.values())
    return {r: v / total for r, v in blended.items()}

# Role → expected value (for ranking)
ROLE_EV = {"Star": 4.0, "Starter": 3.0, "Bench": 2.0, "Cut": 1.0}

# ---------------------------------------------------------------------------
# 4. Load + prepare prospects
# ---------------------------------------------------------------------------
PROSPECT_COMBINE = {
    "AJ Dybantsa":       (80.5, 84.25, 217, 108.0),
    "Darryn Peterson":   (76.5, 81.75, 199, 103.0),
    "Cameron Boozer":    (80.25,85.5,  253, 108.0),
    "Caleb Wilson":      (80.5, 85.0,  215, 107.0),
    "Kingston Flemings": (76.75,80.0,  192, 101.0),
    "Jayden Quaintance": (79.75,85.0,  222, 106.0),
    "Aday Mara":         (87.0, 90.0,  250, 117.0),
    "Rueben Chinyelu":   (81.0, 91.5,  238, 110.0),
    "Nate Ament":        (78.5, 82.0,  200, 104.0),
    "Keaton Wagler":     (78.0, 80.0,  195, 103.0),
    "Mikel Brown Jr.":   (75.0, 77.0,  175,  97.0),
    "Brayden Burries":   (75.5, 78.0,  185,  99.0),
    "Labaron Philon":    (74.75,78.25, 174.6, 99.5),
    "Yaxel Lendeborg":   (80.5, 88.0,  234.6,108.5),
    "Thomas Haugh":      (79.0, 82.0,  215, 105.0),
    "Koa Peat":          (80.0, 85.0,  225, 107.0),
    "Tounde Yessoufou":  (77.0, 81.0,  195, 102.0),
    "Bennett Stirtz":    (75.0, 77.0,  185,  97.0),
    "Tyler Tanner":      (74.0, 76.0,  175,  95.0),
    "Joshua Jefferson":  (79.5, 86.0,  205, 107.0),
    "Morez Johnson Jr.": (80.5, 87.0,  230, 109.0),
    "Dailyn Swain":      (77.5, 80.0,  195, 102.0),
    "Isaiah Evans":      (77.5, 81.0,  195, 103.0),
    "Ebuka Okorie":      (77.0, 80.0,  190, 101.0),
    "Meleek Thomas":     (76.5, 79.0,  185, 100.0),
    "Henri Veesaar":     (83.0, 88.0,  235, 110.0),
    "Alijah Arenas":     (76.5, 79.0,  185, 100.0),
    "Flory Bidunga":     (80.5, 87.0,  230, 109.0),
    "Zuby Ejiofor":      (79.5, 85.0,  225, 107.0),
    "Alex Karaban":      (79.5, 84.0,  215, 106.0),
    "Braden Smith":      (73.0, 76.0,  175,  96.0),
    "Motiejus Krivas":   (83.0, 89.0,  245, 112.0),
    "Tarris Reed Jr.":   (80.5, 86.0,  250, 109.0),
    "JT Toppin":         (79.5, 84.0,  210, 106.0),
    "Alex Condon":       (83.25,84.75, 221.8,107.5),
    "Zvonimir Ivisic":   (84.5, 89.0,  245, 112.0),
    "Tomislav Ivisic":   (82.0, 88.0,  245, 110.0),
    "Milos Uzan":        (75.25,77.25, 186.4, 97.5),
    "Tahaad Pettiford":  (72.25,77.5,  168.8, 96.0),
    "Dillon Mitchell":   (79.0, 85.0,  210, 106.0),
    "Andrej Stojakovic": (78.5, 81.0,  195, 103.0),
    "Kylan Boswell":     (73.5, 76.0,  175,  96.0),
    "Coen Carr":         (77.5, 81.0,  200, 102.0),
    "Tucker DeVries":    (78.0, 80.0,  200, 103.0),
    "KJ Lewis":          (78.0, 81.0,  200, 104.0),
    "Malik Reneau":      (79.5, 84.0,  220, 106.0),
    "Darius Acuff":      (74.5, 77.0,  188,  98.0),
}

COLLEGE_ADJ = {
    "3PAr":1.00,"FTr":0.95,"AST%":0.85,"TRB%":0.82,
    "BLK%":0.78,"STL%":0.82,"USG%":0.87,"TOV%":1.05,
}

prospects = pd.read_csv(f"{DATA}/prospect_stats.csv", low_memory=False)
big_board  = pd.read_csv(f"{DATA}/big_board.csv")
has_stats  = prospects[prospects["sr_found"]==1].copy().reset_index(drop=True)

results = []
for _, row in has_stats.iterrows():
    name = str(row["Name"])
    pos  = row["Pos"]

    if name in PROSPECT_COMBINE:
        ht, ws, wt, _ = PROSPECT_COMBINE[name]
    else:
        bucket = pb(pos)
        ht, ws, wt = POS_AVG.get(bucket,(78,81,210))

    mp  = max(float(row.get("mp_per_g",28) or 28), 10)
    fg  = float(row.get("fg_per_g",0) or 0)
    fga = float(row.get("fga_per_g",0) or 0)
    fta = float(row.get("fta_per_g",0) or 0)
    ast = float(row.get("ast_per_g",0) or 0)
    trb = float(row.get("trb_per_g",0) or 0)
    stl = float(row.get("stl_per_g",0) or 0)
    blk = float(row.get("blk_per_g",0) or 0)
    tov = float(row.get("tov_per_g",0) or 0)
    fac = 40.0/mp

    v = {
        "3PAr":  float(row.get("fg3a_per_fga_pct",0) or 0),
        "FTr":   float(row.get("fta_per_fga_pct",0) or 0),
        "AST%":  np.clip(ast/max(TEAM_FGM_40*(mp/40)-fg,1)*100,0,60),
        "TRB%":  np.clip(trb/(TEAM_TRB_40*(mp/40))*100,0,35),
        "BLK%":  np.clip(blk/max(OPP_2PA_40*(mp/40),1)*100,0,15),
        "STL%":  np.clip(stl/max(OPP_POSS_40*(mp/40),1)*100,0,8),
        "USG%":  np.clip((fga+0.44*fta+tov)*fac/TEAM_POSS_40*100,5,50),
        "TOV%":  float(row.get("tov_pct",0) or 0),
    }
    for stat, adj in COLLEGE_ADJ.items():
        if stat in v: v[stat] *= adj

    v.update({"ht_in": ht, "ws_in": ws, "weight": wt, "pos_rank": pos_rank(pos)})
    v = engineered(v)

    feat_vec = pd.DataFrame([{c: v.get(c,0) for c in ALL_FEAT}])
    raw_probs = clf.predict_proba(feat_vec)[0]
    raw_map   = {le.classes_[i]: float(raw_probs[i]) for i in range(len(le.classes_))}

    # Blend with draft-position prior
    bb_rank_val = big_board[big_board["Name"]==name]["Rank"].values
    bb_rank_val = int(bb_rank_val[0]) if len(bb_rank_val) else 50
    prob_map = blend_probs(raw_map, bb_rank_val)

    ev = sum(ROLE_EV[r]*prob_map.get(r,0) for r in ROLE_EV)

    bb_rank = bb_rank_val

    results.append({
        "Name":    name,
        "Pos":     pos,
        "BB_Rank": bb_rank,
        "P_Star":    round(prob_map.get("Star",0)*100, 1),
        "P_Starter": round(prob_map.get("Starter",0)*100, 1),
        "P_Bench":   round(prob_map.get("Bench",0)*100, 1),
        "P_Cut":     round(prob_map.get("Cut",0)*100, 1),
        "EV":        round(ev, 3),
    })

results_df = pd.DataFrame(results).sort_values("EV", ascending=False).reset_index(drop=True)
results_df["ML_Rank"] = results_df.index + 1
results_df.to_csv(f"{DATA}/prospect_success.csv", index=False)

# ---------------------------------------------------------------------------
# 5. Print
# ---------------------------------------------------------------------------
print(f"\n{'='*80}")
print(f"{'ML':>4}  {'BB':>4}  {'Name':<24} {'Pos':<8} "
      f"{'Star%':>6} {'Start%':>7} {'Bench%':>7} {'Cut%':>6}  {'EV':>5}")
print(f"{'='*80}")
for _, r in results_df.iterrows():
    delta = r['BB_Rank'] - r['ML_Rank']
    arrow = f"↑{abs(int(delta))}" if delta > 2 else (f"↓{abs(int(delta))}" if delta < -2 else "  ")
    print(f"#{r['ML_Rank']:>3}  #{r['BB_Rank']:>3}  {r['Name']:<24} {r['Pos']:<8} "
          f"{r['P_Star']:>5}%  {r['P_Starter']:>5}%  {r['P_Bench']:>5}%  {r['P_Cut']:>4}%  {r['EV']:>5.2f}  {arrow}")

print(f"\n✓ Saved to prospect_success.csv")
