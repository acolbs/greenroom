#!/usr/bin/env python3
"""
predict_success.py — Draft prospect success prediction

Hybrid approach:
  Phase 1 — Build labeled dataset of NBA players (role outcome) + known busts
  Phase 2 — Train XGBoost on physical measurements + statistical tendencies
  Phase 3 — Apply college-adjusted prospect features through the same model
  Phase 4 — Output P(Star/Starter/Bench/Cut) + EV ranking, blended with a
            draft-position prior

Role labels derived from current-season performance:
  Star     — 28+ mpg, 55%+ GS rate, WS/48 > 0.10
  Starter  — 22+ mpg, 40%+ GS rate
  Bench    — 12+ mpg
  Cut      — fringe / out of league

Shared data/physicals/feature math live in prospect_data.py.

  reads   master.csv, big_board_base.csv, prospect_stats_base.csv
  writes  prospect_success.csv
"""

import numpy as np
import pandas as pd
from xgboost import XGBClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.calibration import CalibratedClassifierCV
import warnings

from prospect_data import (
    data_path, pos_bucket, primary_pos_rank,
    get_nba_phys, get_prospect_phys, COLLEGE_ADJ,
    TEAM_POSS_40, TEAM_FGM_40, TEAM_TRB_40, OPP_2PA_40, OPP_POSS_40,
)

warnings.filterwarnings("ignore")
ROLES = ["Star", "Starter", "Bench", "Cut"]

# ---------------------------------------------------------------------------
# Known draft busts — drafted 2018-2023, didn't stick. Manually specified
# features: (ht_no_shoes, ws, wt, 3PAr, FTr, AST%, TRB%, BLK%, STL%, USG%, TOV%, pos_rank, role)
# ---------------------------------------------------------------------------
CUT_PLAYERS = [
    ("Bol Bol",           85.0, 91.0, 208, 0.30, 0.30, 5.0, 12.0, 4.0, 0.8, 14.0, 12.0, 4, "Cut"),
    ("Mfiondu Kabengele", 82.0, 85.0, 245, 0.15, 0.45, 5.0, 12.0, 3.0, 0.9, 18.0, 13.0, 4, "Cut"),
    ("Carsen Edwards",    72.0, 74.5, 180, 0.52, 0.22, 15.0, 2.5, 0.2, 1.2, 22.0, 12.0, 1, "Cut"),
    ("Jordan Bone",       73.0, 75.0, 175, 0.38, 0.25, 22.0, 3.0, 0.3, 1.5, 16.0, 14.0, 1, "Cut"),
    ("Talen Horton-Tucker", 76.0, 80.0, 230, 0.28, 0.38, 14.0, 5.0, 0.8, 1.3, 18.0, 13.0, 2, "Bench"),
    ("Louis King",        80.0, 82.5, 210, 0.38, 0.35, 8.0, 6.0, 0.7, 1.1, 16.0, 11.0, 3, "Cut"),
    ("Killian Tillie",    83.0, 87.0, 210, 0.35, 0.30, 6.0, 10.0, 2.5, 0.8, 13.0, 10.0, 4, "Cut"),
    ("Jalen Lecque",      73.0, 76.5, 175, 0.30, 0.42, 20.0, 3.5, 0.4, 1.6, 20.0, 16.0, 1, "Cut"),
    ("Tremont Waters",    70.0, 72.0, 170, 0.38, 0.25, 35.0, 3.0, 0.2, 1.5, 18.0, 17.0, 1, "Cut"),
    ("Kennedy Chandler",  74.5, 77.5, 175, 0.28, 0.35, 22.0, 4.0, 0.5, 1.8, 17.0, 15.0, 1, "Cut"),
    ("Malachi Flynn",     73.0, 76.0, 175, 0.40, 0.22, 25.0, 3.5, 0.3, 1.4, 18.0, 14.0, 1, "Cut"),
    ("Darius Days",       78.0, 80.5, 225, 0.40, 0.35, 8.0, 9.0, 1.2, 1.1, 16.0, 11.0, 3, "Cut"),
    ("Yoeli Childs",      81.0, 83.5, 240, 0.12, 0.48, 7.0, 15.0, 2.2, 0.9, 18.0, 12.0, 4, "Cut"),
    ("Isaiah Todd",       82.0, 85.5, 215, 0.22, 0.42, 6.5, 11.0, 2.5, 0.9, 16.0, 11.0, 4, "Cut"),
    ("Chris Duarte",      76.5, 80.0, 196, 0.44, 0.22, 10.0, 5.5, 0.6, 1.2, 15.0, 10.0, 2, "Bench"),
    ("Cassius Winston",   71.0, 73.0, 175, 0.38, 0.18, 30.0, 2.5, 0.2, 1.0, 18.0, 15.0, 1, "Cut"),
    ("Xavier Tillman Sr.", 80.5, 83.5, 245, 0.12, 0.40, 12.0, 14.0, 2.8, 1.0, 14.0, 11.0, 4, "Bench"),
    ("Nate Hinton",       76.0, 80.5, 195, 0.25, 0.35, 14.0, 6.0, 0.8, 1.4, 14.0, 12.0, 2, "Cut"),
    ("Aaron Wiggins",     77.25, 80.0, 197, 0.42, 0.22, 10.0, 5.0, 0.6, 1.1, 13.0, 10.0, 2, "Bench"),
    ("Moussa Diabate",    82.0, 87.5, 215, 0.05, 0.55, 5.0, 15.0, 3.5, 0.9, 14.0, 11.0, 4, "Cut"),
    ("Bryce McGowens",    78.0, 82.5, 185, 0.38, 0.32, 12.0, 4.5, 0.6, 1.2, 16.0, 12.0, 3, "Bench"),
    ("Wendell Moore Jr.", 77.0, 80.5, 205, 0.32, 0.30, 14.0, 4.5, 0.7, 1.1, 15.0, 11.0, 2, "Bench"),
    ("Tyrese Martin",     78.0, 82.0, 195, 0.38, 0.28, 10.0, 5.5, 0.8, 1.3, 14.0, 11.0, 3, "Bench"),
    ("Admiral Schofield", 77.0, 81.0, 228, 0.40, 0.30, 7.0, 5.5, 0.6, 0.9, 13.0, 10.0, 3, "Cut"),
    ("Joel Ayayi",        77.5, 82.0, 197, 0.30, 0.30, 15.0, 5.5, 0.8, 1.1, 14.0, 12.0, 2, "Cut"),
    ("Charlie Brown Jr.", 79.0, 84.5, 190, 0.40, 0.28, 7.5, 6.5, 1.0, 1.2, 14.0, 11.0, 3, "Cut"),
    ("Dakota Mathias",    76.0, 78.5, 200, 0.52, 0.18, 8.0, 3.5, 0.4, 0.8, 12.0, 9.0, 2, "Cut"),
]

# ---------------------------------------------------------------------------
# Feature columns
# ---------------------------------------------------------------------------
STAT_COLS = ["3PAr", "FTr", "AST%", "TRB%", "BLK%", "STL%", "USG%", "TOV%"]


def engineered(v):
    v["three_vs_free"] = v["3PAr"] / max(v["3PAr"] + v["FTr"], 0.01)
    v["playmaker_idx"] = np.clip(v["AST%"] / max(v["USG%"], 0.1), 0, 4)
    v["rim_attack"]    = v["FTr"] * (1 - v["3PAr"])
    v["def_type"]      = v["BLK%"] / max(v["BLK%"] + v["STL%"], 0.01)
    v["ws_delta"]      = v.get("ws_in", 82) - v.get("ht_in", 78)
    v["ws_ratio"]      = v.get("ws_in", 82) / max(v.get("ht_in", 78), 1)
    return v


ALL_FEAT = STAT_COLS + ["three_vs_free", "playmaker_idx", "rim_attack", "def_type",
                        "ht_in", "ws_in", "weight", "ws_delta", "ws_ratio", "pos_rank"]

# ---------------------------------------------------------------------------
# 1. Build NBA training data from master.csv
# ---------------------------------------------------------------------------
master = pd.read_csv(data_path("master.csv"), low_memory=False)
master = master[master["Offensive Archetype"].notna()].copy()


def mpg(r):
    g = pd.to_numeric(r["G"], errors="coerce") or 1
    return pd.to_numeric(r["MP"], errors="coerce") / g


def gsp(r):
    g = pd.to_numeric(r["G"], errors="coerce") or 1
    return pd.to_numeric(r["GS"], errors="coerce") / g


def role_label(r):
    m = mpg(r); gs = gsp(r)
    w48 = pd.to_numeric(r.get("WS/48", 0), errors="coerce") or 0
    if m >= 28 and gs >= 0.55 and w48 >= 0.10: return "Star"
    if m >= 22 and gs >= 0.40:                 return "Starter"
    if m >= 12:                                return "Bench"
    return "Cut"


nba_rows = []
for _, row in master.iterrows():
    bucket = pos_bucket(row["Pos"])
    ht, ws, wt = get_nba_phys(str(row["Player"]), bucket)
    v = {c: float(row[c] if pd.notna(row.get(c)) else 0) for c in STAT_COLS}
    v.update({"ht_in": ht, "ws_in": ws, "weight": wt,
              "pos_rank": primary_pos_rank(row["Pos"])})
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
    v = {"3PAr": tpar, "FTr": ftr, "AST%": ast, "TRB%": trb, "BLK%": blk,
         "STL%": stl, "USG%": usg, "TOV%": tov,
         "ht_in": ht, "ws_in": ws, "weight": wt, "pos_rank": pr}
    v = engineered(v)
    v["role"] = role
    cut_rows.append(v)

cut_df = pd.DataFrame(cut_rows)
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
# Draft-position prior — historical NBA draft base rates.
# Format: (max_pick, P_Star, P_Starter, P_Bench, P_Cut)
# ---------------------------------------------------------------------------
DRAFT_PRIOR_TABLE = [
    (5,   0.52, 0.36, 0.10, 0.02),
    (10,  0.32, 0.43, 0.18, 0.07),
    (15,  0.20, 0.42, 0.27, 0.11),
    (20,  0.14, 0.38, 0.32, 0.16),
    (30,  0.09, 0.32, 0.38, 0.21),
    (45,  0.05, 0.22, 0.43, 0.30),
    (999, 0.03, 0.15, 0.44, 0.38),
]


def get_draft_prior(rank):
    for max_pick, ps, pst, pbn, pc in DRAFT_PRIOR_TABLE:
        if rank <= max_pick:
            return {"Star": ps, "Starter": pst, "Bench": pbn, "Cut": pc}
    return {"Star": 0.03, "Starter": 0.15, "Bench": 0.44, "Cut": 0.38}


def blend_probs(model_probs, rank, model_weight=0.40):
    """Blend statistical model output (40%) with draft-position prior (60%)."""
    prior = get_draft_prior(rank)
    blended = {}
    for role in ROLES:
        blended[role] = (model_weight * model_probs.get(role, 0) +
                         (1 - model_weight) * prior[role])
    total = sum(blended.values())
    return {r: v / total for r, v in blended.items()}


ROLE_EV = {"Star": 4.0, "Starter": 3.0, "Bench": 2.0, "Cut": 1.0}

# ---------------------------------------------------------------------------
# 4. Load + prepare prospects (from read-only base files)
# ---------------------------------------------------------------------------
prospects = pd.read_csv(data_path("prospect_stats_base.csv"), low_memory=False)
big_board = pd.read_csv(data_path("big_board_base.csv"))
has_stats = prospects[prospects["sr_found"] == 1].copy().reset_index(drop=True)

results = []
for _, row in has_stats.iterrows():
    name = str(row["Name"])
    pos  = row["Pos"]
    ht, ws, wt = get_prospect_phys(name, pos_bucket(pos))

    mp  = max(float(row.get("mp_per_g", 28) or 28), 10)
    fg  = float(row.get("fg_per_g", 0) or 0)
    fga = float(row.get("fga_per_g", 0) or 0)
    fta = float(row.get("fta_per_g", 0) or 0)
    ast = float(row.get("ast_per_g", 0) or 0)
    trb = float(row.get("trb_per_g", 0) or 0)
    stl = float(row.get("stl_per_g", 0) or 0)
    blk = float(row.get("blk_per_g", 0) or 0)
    tov = float(row.get("tov_per_g", 0) or 0)
    fac = 40.0 / mp

    v = {
        "3PAr": float(row.get("fg3a_per_fga_pct", 0) or 0),
        "FTr":  float(row.get("fta_per_fga_pct", 0) or 0),
        "AST%": np.clip(ast / max(TEAM_FGM_40 * (mp / 40) - fg, 1) * 100, 0, 60),
        "TRB%": np.clip(trb / (TEAM_TRB_40 * (mp / 40)) * 100, 0, 35),
        "BLK%": np.clip(blk / max(OPP_2PA_40 * (mp / 40), 1) * 100, 0, 15),
        "STL%": np.clip(stl / max(OPP_POSS_40 * (mp / 40), 1) * 100, 0, 8),
        "USG%": np.clip((fga + 0.44 * fta + tov) * fac / TEAM_POSS_40 * 100, 5, 50),
        "TOV%": float(row.get("tov_pct", 0) or 0),
    }
    for stat, adj in COLLEGE_ADJ.items():
        if stat in v:
            v[stat] *= adj

    v.update({"ht_in": ht, "ws_in": ws, "weight": wt, "pos_rank": primary_pos_rank(pos)})
    v = engineered(v)

    feat_vec = pd.DataFrame([{c: v.get(c, 0) for c in ALL_FEAT}])
    raw_probs = clf.predict_proba(feat_vec)[0]
    raw_map = {le.classes_[i]: float(raw_probs[i]) for i in range(len(le.classes_))}

    bb_rank_val = big_board[big_board["Name"] == name]["Rank"].values
    bb_rank_val = int(bb_rank_val[0]) if len(bb_rank_val) else 50
    prob_map = blend_probs(raw_map, bb_rank_val)

    ev = sum(ROLE_EV[r] * prob_map.get(r, 0) for r in ROLE_EV)

    results.append({
        "Name":    name,
        "Pos":     pos,
        "BB_Rank": bb_rank_val,
        "P_Star":    round(prob_map.get("Star", 0) * 100, 1),
        "P_Starter": round(prob_map.get("Starter", 0) * 100, 1),
        "P_Bench":   round(prob_map.get("Bench", 0) * 100, 1),
        "P_Cut":     round(prob_map.get("Cut", 0) * 100, 1),
        "EV":        round(ev, 3),
    })

results_df = pd.DataFrame(results).sort_values("EV", ascending=False).reset_index(drop=True)
results_df["ML_Rank"] = results_df.index + 1
out = data_path("prospect_success.csv")
results_df.to_csv(out, index=False, lineterminator="\n")

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

print(f"\n✓ Saved {out}")
