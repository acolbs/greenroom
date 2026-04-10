#!/usr/bin/env python3
"""
validate_prospect_archetypes.py

Trains RF classifiers on NBA player data, then validates & corrects
college prospect archetype labels where model confidence is high
but disagrees with the current assignment.
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
import warnings
warnings.filterwarnings("ignore")

DATA = "/sessions/sleepy-modest-hawking/mnt/Documents/Greenroom/greenroom/web/public/data"

# ---------------------------------------------------------------------------
# 1. Load NBA training data from master.csv
# ---------------------------------------------------------------------------
master = pd.read_csv(f"{DATA}/master.csv", low_memory=False)
# Keep only rows with archetype labels
master = master[master["Offensive Archetype"].notna() & master["Defensive Role"].notna()].copy()

# Normalize position to 5 buckets
POS_MAP = {
    "PG": "G", "SG": "G", "SF": "W", "PF": "F", "C": "C",
    "G": "G", "G-F": "W", "F-G": "W", "F": "F", "F-C": "F", "C-F": "C",
}
master["pos_bucket"] = master["Pos"].map(POS_MAP).fillna("W")

# Features available in master.csv that map reasonably to college stats
NBA_FEATURES = ["USG%", "TS%", "AST%", "TRB%", "BLK%", "STL%", "TOV%"]
# Also use per-game counting stats (normalized later)
NBA_PG = ["PTS", "AST", "TRB", "STL", "BLK"]

# One-hot position
pos_dummies_nba = pd.get_dummies(master["pos_bucket"], prefix="pos")

feature_cols = NBA_FEATURES + NBA_PG
nba_X = master[feature_cols].apply(pd.to_numeric, errors="coerce").fillna(0)
nba_X = pd.concat([nba_X, pos_dummies_nba], axis=1)

off_labels = master["Offensive Archetype"].tolist()
def_labels = master["Defensive Role"].tolist()

# ---------------------------------------------------------------------------
# 2. Load prospect data
# ---------------------------------------------------------------------------
prospects = pd.read_csv(f"{DATA}/prospect_stats.csv", low_memory=False)
big_board = pd.read_csv(f"{DATA}/big_board.csv")

# Only prospects with actual college stats (sr_found=1 and pts_per_g present)
has_stats = prospects[prospects["sr_found"] == 1].copy()

# Merge numeric Grade from big_board (prospect_stats Grade col = class year string)
bb_grades = big_board[["Rank", "Grade"]].rename(columns={"Grade": "NumGrade"})
has_stats = has_stats.merge(bb_grades, on="Rank", how="left")
has_stats["NumGrade"] = pd.to_numeric(has_stats["NumGrade"], errors="coerce").fillna(75)

print(f"NBA training samples: {len(master)}")
print(f"Prospects total: {len(prospects)}, with college stats: {len(has_stats)}")

# ---------------------------------------------------------------------------
# 3. Build prospect feature vectors
# ---------------------------------------------------------------------------
# College stat columns from prospect_stats.csv
# pts_per_g, trb_per_g, ast_per_g, stl_per_g, blk_per_g, tov_per_g, ts_pct
# Usage proxy: fg3a_per_fga_pct, fta_per_fga_pct

# Map prospect positions
def map_prospect_pos(pos_str):
    if pd.isna(pos_str):
        return "W"
    pos_str = str(pos_str).upper()
    if "C" in pos_str:
        return "C"
    if "PF" in pos_str or "F" == pos_str:
        return "F"
    if "SF" in pos_str:
        return "W"
    if "PG" in pos_str:
        return "G"
    if "SG" in pos_str:
        return "G"
    return "W"

has_stats["pos_bucket"] = has_stats["Pos"].apply(map_prospect_pos)

# Scale college stats to approximate NBA equivalents
# Rough scaling: NBA players avg ~28 min, college ~30 min (similar)
# But NBA competition is much higher — suppress counting stats, emphasize rates
SCALE = {
    "pts_per_g":  0.55,  # college pts → ~NBA pts
    "trb_per_g":  0.75,  # rebounds translate better
    "ast_per_g":  0.70,
    "stl_per_g":  0.70,
    "blk_per_g":  0.80,
    "tov_per_g":  0.65,
}

# USG proxy: use tov_pct column if available, else estimate
# AST% proxy: ast_per_g / pts_per_g ratio (crude)
# TS%: use ts_pct directly

def build_prospect_features(row):
    pts   = float(row.get("pts_per_g", 0) or 0) * SCALE["pts_per_g"]
    trb   = float(row.get("trb_per_g", 0) or 0) * SCALE["trb_per_g"]
    ast   = float(row.get("ast_per_g", 0) or 0) * SCALE["ast_per_g"]
    stl   = float(row.get("stl_per_g", 0) or 0) * SCALE["stl_per_g"]
    blk   = float(row.get("blk_per_g", 0) or 0) * SCALE["blk_per_g"]
    tov   = float(row.get("tov_per_g", 0) or 0) * SCALE["tov_per_g"]
    ts    = float(row.get("ts_pct", 0) or 0)
    # Approximate NBA-style percentages
    tov_pct = float(row.get("tov_pct", 0) or 0)
    # Usage: use grade as rough proxy for role importance
    grade = float(row.get("NumGrade", 75) or 75)
    usg   = 15 + (grade - 60) * 0.5   # 60→15%, 95→32.5%
    ast_pct = min(ast / max(pts, 1) * 25, 45)
    trb_pct = min(trb * 3.5, 25)
    blk_pct = min(blk * 5, 10)
    stl_pct = min(stl * 3, 5)
    return [usg, ts * 100, ast_pct, trb_pct, blk_pct, stl_pct, tov_pct,
            pts, ast, trb, stl, blk]

prospect_features = []
for _, row in has_stats.iterrows():
    prospect_features.append(build_prospect_features(row))

pos_buckets_p = has_stats["pos_bucket"].tolist()
all_pos_cats = ["C", "F", "G", "W"]
pos_dummies_p = pd.DataFrame(
    [{f"pos_{c}": (1 if p == c else 0) for c in all_pos_cats} for p in pos_buckets_p]
)

prospect_X = pd.DataFrame(
    prospect_features,
    columns=["USG%", "TS%", "AST%", "TRB%", "BLK%", "STL%", "TOV%",
             "PTS", "AST", "TRB", "STL", "BLK"]
)
prospect_X = pd.concat([prospect_X.reset_index(drop=True),
                         pos_dummies_p.reset_index(drop=True)], axis=1)

# Align columns with NBA training data
for col in nba_X.columns:
    if col not in prospect_X.columns:
        prospect_X[col] = 0
prospect_X = prospect_X[nba_X.columns]

# ---------------------------------------------------------------------------
# 4. Train classifiers
# ---------------------------------------------------------------------------
le_off = LabelEncoder()
le_def = LabelEncoder()
y_off = le_off.fit_transform(off_labels)
y_def = le_def.fit_transform(def_labels)

clf_off = RandomForestClassifier(n_estimators=200, max_depth=8, random_state=42, min_samples_leaf=3)
clf_def = RandomForestClassifier(n_estimators=200, max_depth=8, random_state=42, min_samples_leaf=3)
clf_off.fit(nba_X, y_off)
clf_def.fit(nba_X, y_def)

print(f"\nClassifiers trained. Off classes: {list(le_off.classes_)}")
print(f"Def classes: {list(le_def.classes_)}")

# ---------------------------------------------------------------------------
# 5. Inference on prospects — flag low-confidence current labels
# ---------------------------------------------------------------------------
OFF_CONF_THRESHOLD = 0.35   # if model gives current label < this, consider override
DEF_CONF_THRESHOLD = 0.30
OVERRIDE_MIN_CONF  = 0.50   # model must be at least this sure of its prediction

off_probs = clf_off.predict_proba(prospect_X)
def_probs = clf_def.predict_proba(prospect_X)

overrides = []
warnings_list = []

for i, (_, row) in enumerate(has_stats.iterrows()):
    name = row["Name"]
    rank = row["Rank"]
    current_off = row["Offensive Archetype"]
    current_def = row["Defensive Role"]

    # --- Offensive archetype ---
    if current_off in le_off.classes_:
        curr_off_idx = list(le_off.classes_).index(current_off)
        curr_off_conf = off_probs[i][curr_off_idx]
    else:
        curr_off_conf = 0.0

    pred_off_idx = np.argmax(off_probs[i])
    pred_off = le_off.classes_[pred_off_idx]
    pred_off_conf = off_probs[i][pred_off_idx]

    # --- Defensive role ---
    if current_def in le_def.classes_:
        curr_def_idx = list(le_def.classes_).index(current_def)
        curr_def_conf = def_probs[i][curr_def_idx]
    else:
        curr_def_conf = 0.0

    pred_def_idx = np.argmax(def_probs[i])
    pred_def = le_def.classes_[pred_def_idx]
    pred_def_conf = def_probs[i][pred_def_idx]

    off_changed = False
    def_changed = False
    new_off = current_off
    new_def = current_def

    # Decide on offensive override
    if (pred_off != current_off and
            curr_off_conf < OFF_CONF_THRESHOLD and
            pred_off_conf > OVERRIDE_MIN_CONF):
        new_off = pred_off
        off_changed = True

    # Decide on defensive override
    if (pred_def != current_def and
            curr_def_conf < DEF_CONF_THRESHOLD and
            pred_def_conf > OVERRIDE_MIN_CONF):
        new_def = pred_def
        def_changed = True

    if off_changed or def_changed:
        overrides.append({
            "rank": rank, "name": name,
            "old_off": current_off, "new_off": new_off, "off_changed": off_changed,
            "pred_off_conf": round(pred_off_conf, 2), "curr_off_conf": round(curr_off_conf, 2),
            "old_def": current_def, "new_def": new_def, "def_changed": def_changed,
            "pred_def_conf": round(pred_def_conf, 2), "curr_def_conf": round(curr_def_conf, 2),
        })
    elif curr_off_conf < 0.25 or curr_def_conf < 0.20:
        warnings_list.append({
            "rank": rank, "name": name,
            "current_off": current_off, "off_conf": round(curr_off_conf, 2),
            "current_def": current_def, "def_conf": round(curr_def_conf, 2),
            "model_suggests_off": pred_off, "model_conf_off": round(pred_off_conf, 2),
            "model_suggests_def": pred_def, "model_conf_def": round(pred_def_conf, 2),
        })

# ---------------------------------------------------------------------------
# 6. Print report
# ---------------------------------------------------------------------------
print(f"\n{'='*70}")
print(f"OVERRIDES ({len(overrides)} prospects will be updated):")
print(f"{'='*70}")
for o in overrides:
    print(f"  #{o['rank']} {o['name']}")
    if o["off_changed"]:
        print(f"    OFF: {o['old_off']} → {o['new_off']}  "
              f"(model={o['pred_off_conf']:.0%}, current label only {o['curr_off_conf']:.0%} confident)")
    if o["def_changed"]:
        print(f"    DEF: {o['old_def']} → {o['new_def']}  "
              f"(model={o['pred_def_conf']:.0%}, current label only {o['curr_def_conf']:.0%} confident)")

print(f"\n{'='*70}")
print(f"LOW-CONFIDENCE WARNINGS ({len(warnings_list)} — kept but flagged):")
print(f"{'='*70}")
for w in warnings_list:
    print(f"  #{w['rank']} {w['name']}")
    if w['off_conf'] < 0.25:
        print(f"    OFF: '{w['current_off']}' only {w['off_conf']:.0%} confident "
              f"(model suggests '{w['model_suggests_off']}' at {w['model_conf_off']:.0%})")
    if w['def_conf'] < 0.20:
        print(f"    DEF: '{w['current_def']}' only {w['def_conf']:.0%} confident "
              f"(model suggests '{w['model_suggests_def']}' at {w['model_conf_def']:.0%})")

# ---------------------------------------------------------------------------
# 7. Apply overrides to CSVs
# ---------------------------------------------------------------------------
if overrides:
    override_map = {o["name"]: o for o in overrides}

    # Update prospect_stats.csv
    ps = pd.read_csv(f"{DATA}/prospect_stats.csv")
    for idx, row in ps.iterrows():
        if row["Name"] in override_map:
            o = override_map[row["Name"]]
            if o["off_changed"]:
                ps.at[idx, "Offensive Archetype"] = o["new_off"]
            if o["def_changed"]:
                ps.at[idx, "Defensive Role"] = o["new_def"]
    ps.to_csv(f"{DATA}/prospect_stats.csv", index=False)

    # Update big_board.csv
    bb = pd.read_csv(f"{DATA}/big_board.csv")
    for idx, row in bb.iterrows():
        if row["Name"] in override_map:
            o = override_map[row["Name"]]
            if o["off_changed"]:
                bb.at[idx, "Offensive Archetype"] = o["new_off"]
            if o["def_changed"]:
                bb.at[idx, "Defensive Role"] = o["new_def"]
    bb.to_csv(f"{DATA}/big_board.csv", index=False)

    print(f"\n✓ Updated {len(overrides)} prospect(s) in both CSVs.")
else:
    print(f"\n✓ No overrides needed — all current labels look reasonable.")

print("\nDone.")
