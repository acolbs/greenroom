#!/usr/bin/env python3
"""
assign_archetypes_rf.py  v5  — position-split archetype models

Architecture:
  • Three separate XGBoost classifiers per label (OFF + DEF):
      Guard  (pos_bucket G, height < 78")
      Wing   (pos_bucket W, or forward-sized wing)
      Big    (pos_bucket F or C, height > 80")
  • Each group can only be classified into archetypes that actually
    exist for that body type — no more 7-footers getting "Shot Creator"
  • Height-based group override so a listed position can't override physics
  • SMOTE balancing within each group
  • wingspan_delta (wingspan - height) added as a feature

I/O (see prospect_data.py for the full pipeline contract):
  reads   master.csv, big_board_base.csv, prospect_stats_base.csv
  writes  prospect_archetype_ml.csv   (model output only — never its inputs)
"""

import numpy as np
import pandas as pd
from xgboost import XGBClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import StratifiedKFold, cross_val_score
from imblearn.over_sampling import SMOTE
import warnings

from prospect_data import (
    DATA, data_path, pos_bucket,
    get_nba_phys, get_prospect_phys, get_prospect_reach,
    estimate_college_rates,
    OFFENSIVE_ARCHETYPES, DEFENSIVE_ROLES,
)

warnings.filterwarnings("ignore")

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

# Every class the model can emit must exist in the canonical taxonomy.
_off_classes = set(GUARD_OFF_CLASSES) | set(WING_OFF_CLASSES) | set(BIG_OFF_CLASSES)
_def_classes = set(GUARD_DEF_CLASSES) | set(WING_DEF_CLASSES) | set(BIG_DEF_CLASSES)
assert _off_classes <= set(OFFENSIVE_ARCHETYPES), \
    f"unknown OFF archetype(s): {_off_classes - set(OFFENSIVE_ARCHETYPES)}"
assert _def_classes <= set(DEFENSIVE_ROLES), \
    f"unknown DEF role(s): {_def_classes - set(DEFENSIVE_ROLES)}"


def size_group(height_in, pb):
    """Assign to Guard/Wing/Big based on height (primary) + position (tiebreak)."""
    if height_in >= 82 or pb == "C":   return "Big"
    if height_in >= 80 or pb == "F":   return "Big"
    if height_in >= 77.5 or pb == "W": return "Wing"
    return "Guard"


# ---------------------------------------------------------------------------
# Feature design
# ---------------------------------------------------------------------------
NBA_STAT_COLS = [
    "TS%", "3PAr", "FTr", "FG%", "3P%", "FT%",
    "TOV%", "USG%", "AST%", "TRB%", "BLK%", "STL%",
    "PTS", "AST",
]
COLL_DIRECT = [
    "ts_pct", "fg3a_per_fga_pct", "fta_per_fga_pct", "fg_pct",
    "fg3_pct", "ft_pct", "tov_pct",
]


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


def build_X(df, is_nba):
    rows, groups = [], []
    for _, row in df.iterrows():
        pb   = pos_bucket(row["Pos"])
        name = str(row["Player" if is_nba else "Name"])
        h, ws, wt = get_nba_phys(name, pb) if is_nba else get_prospect_phys(name, pb)
        grp  = size_group(h, pb)
        groups.append(grp)

        if is_nba:
            stats = {c: float(row[c] if pd.notna(row[c]) else 0) for c in NBA_STAT_COLS}
            for c in ["TRB%", "BLK%", "STL%"]:
                stats[c] = float(row[c] if pd.notna(row[c]) else 0)
        else:
            direct = {nba: float(row[coll] if pd.notna(row[coll]) else 0)
                      for nba, coll in zip(
                          ["TS%", "3PAr", "FTr", "FG%", "3P%", "FT%", "TOV%"],
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
master = pd.read_csv(data_path("master.csv"), low_memory=False)
master = master[
    master["Offensive Archetype"].notna() &
    master["Defensive Role"].notna() &
    (master["Offensive Archetype"] != "Low Minute") &
    (master["Defensive Role"] != "Low Activity")
].copy().reset_index(drop=True)

# Apply global merges
master["Offensive Archetype"] = master["Offensive Archetype"].replace(
    {"Post Scorer": "Roll + Cut Big", "Slasher": "Athletic Finisher"}
)

nba_X_all, nba_groups = build_X(master, True)
FEAT_COLS = list(nba_X_all.columns)

print(f"NBA samples: {len(master)}")

# ---------------------------------------------------------------------------
# 2. Train per-group models
# ---------------------------------------------------------------------------
GROUP_OFF = {"Guard": GUARD_OFF_CLASSES, "Wing": WING_OFF_CLASSES, "Big": BIG_OFF_CLASSES}
GROUP_DEF = {"Guard": GUARD_DEF_CLASSES, "Wing": WING_DEF_CLASSES, "Big": BIG_DEF_CLASSES}

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

for grp in ["Guard", "Wing", "Big"]:
    mask = [g == grp for g in nba_groups]
    sub  = master[mask].copy().reset_index(drop=True)
    X_g  = nba_X_all[mask].reset_index(drop=True)

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

total = len(master)
wa_off = sum(cv_results[g][0] * sum(1 for x in nba_groups if x == g) / total
             for g in ["Guard", "Wing", "Big"] if not np.isnan(cv_results[g][0]))
wa_def = sum(cv_results[g][1] * sum(1 for x in nba_groups if x == g) / total
             for g in ["Guard", "Wing", "Big"] if not np.isnan(cv_results[g][1]))
print(f"\nWeighted CV avg  →  OFF: {wa_off:.1%}   DEF: {wa_def:.1%}")

# ---------------------------------------------------------------------------
# 3. Load + prepare prospects (from the read-only base files)
# ---------------------------------------------------------------------------
prospects = pd.read_csv(data_path("prospect_stats_base.csv"), low_memory=False)
has_stats = prospects[prospects["sr_found"] == 1].copy().reset_index(drop=True)

p_X_all, p_groups = build_X(has_stats, False)
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
    name = row["Name"]
    rank = row["Rank"]
    grp  = p_groups[i]
    x    = p_X_all.iloc[[i]]

    h = get_prospect_phys(name, pos_bucket(row["Pos"]))[0]
    hstr = f"{int(h//12)}'{int(h%12)}\""

    off_prob = models_off[grp].predict_proba(x)[0]
    off_idx  = np.argmax(off_prob)
    ml_off   = le_offs[grp].classes_[off_idx]
    oconf    = off_prob[off_idx]

    def_prob = models_def[grp].predict_proba(x)[0]
    def_idx  = np.argmax(def_prob)
    ml_def   = le_defs[grp].classes_[def_idx]
    dconf    = def_prob[def_idx]

    print(f"  #{rank:<4} {name:<24} {hstr:<5} {grp:<7} "
          f"{ml_off} ({oconf:.0%})  |  {ml_def} ({dconf:.0%})")
    results.append({
        "Rank": rank, "Name": name,
        "Size Group": grp,
        "ML Offensive Archetype": ml_off, "ML Off Confidence": round(float(oconf), 3),
        "ML Defensive Role": ml_def,      "ML Def Confidence": round(float(dconf), 3),
    })

# ---------------------------------------------------------------------------
# 5. Save model output only — compose_big_board.py merges this into the app CSVs
# ---------------------------------------------------------------------------
out = data_path("prospect_archetype_ml.csv")
pd.DataFrame(results).to_csv(out, index=False, lineterminator="\n")
print(f"\n✓ Wrote {out}")
print("Run compose_big_board.py to merge archetypes into big_board.csv + prospect_stats.csv")
