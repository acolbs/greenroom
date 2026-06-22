#!/usr/bin/env python3
"""
player_comps.py  v3  — ML-based player comparisons

Pipeline:
  1. Build style feature vectors for all labeled NBA players in master.csv
  2. Fit StandardScaler + PCA on those NBA vectors (learns scoring style,
     playmaking, defense combinations)
  3. Project prospects into the same PCA space
  4. KNN search within a physically-valid pool → closest NBA neighbors

Distance in PCA space reflects stylistic similarity; physical filters gate the
candidate pool first. Shared data/physicals/feature math live in prospect_data.py.

  reads   master.csv, big_board_base.csv, prospect_stats_base.csv
  writes  prospect_comps.csv
"""

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
import warnings

from prospect_data import (
    data_path, pos_bucket, primary_pos_rank,
    get_nba_phys, get_prospect_phys, get_prospect_reach,
    apply_college_adj,
    TEAM_POSS_40, TEAM_FGM_40, TEAM_TRB_40, OPP_2PA_40, OPP_POSS_40,
)

warnings.filterwarnings("ignore")

# ---------------------------------------------------------------------------
# Tendency-only feature set — captures HOW someone plays, not HOW MUCH.
# Raw counting stats and pure efficiency are excluded (they swing wildly
# college→NBA); tendencies are far more stable.
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


def _add_engineered(v):
    v["playmaker_index"] = np.clip(v["AST%"] / max(v["USG%"], 0.1), 0, 4)
    v["three_vs_free"]   = v["3PAr"] / max(v["3PAr"] + v["FTr"], 0.01)
    v["floor_spacer"]    = v["3PAr"] * v["3P%"]
    v["rim_attack"]      = v["FTr"] * (1 - v["3PAr"])
    # defensive_type: 1.0 = pure rim protector, 0.0 = pure perimeter defender
    v["defensive_type"]  = v["BLK%"] / max(v["BLK%"] + v["STL%"], 0.01)


def nba_stats_to_vec(row):
    cols = ["3PAr", "FTr", "3P%", "TOV%", "USG%", "AST%", "TRB%", "BLK%", "STL%"]
    v = {c: float(row[c] if pd.notna(row.get(c)) else 0) for c in cols}
    _add_engineered(v)
    return {k: v[k] * STYLE_WEIGHTS.get(k, 1.0) for k in STYLE_COLS}


def college_stats_to_vec(row):
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
        "3P%":  float(row.get("fg3_pct", 0) or 0),
        "TOV%": float(row.get("tov_pct", 0) or 0),
        "USG%": np.clip((fga + 0.44 * fta + tov) * fac / TEAM_POSS_40 * 100, 5, 50),
        "AST%": np.clip(ast / max(TEAM_FGM_40 * (mp / 40) - fg, 1) * 100, 0, 60),
        "TRB%": np.clip(trb / (TEAM_TRB_40 * (mp / 40)) * 100, 0, 35),
        "BLK%": np.clip(blk / max(OPP_2PA_40 * (mp / 40), 1) * 100, 0, 15),
        "STL%": np.clip(stl / max(OPP_POSS_40 * (mp / 40), 1) * 100, 0, 8),
    }
    apply_college_adj(v)
    _add_engineered(v)
    return {k: v[k] * STYLE_WEIGHTS.get(k, 1.0) for k in STYLE_COLS}


# ---------------------------------------------------------------------------
# 1. Build NBA player feature matrix (style only — physicals stored separately)
# ---------------------------------------------------------------------------
master = pd.read_csv(data_path("master.csv"), low_memory=False)
master = master[
    master["Offensive Archetype"].notna() &
    master["Defensive Role"].notna() &
    (master["Offensive Archetype"] != "Low Minute") &
    (master["Defensive Role"] != "Low Activity")
].copy().reset_index(drop=True)

nba_rows = []
nba_phys = []
for _, row in master.iterrows():
    pb = pos_bucket(row["Pos"])
    ht, ws, wt = get_nba_phys(str(row["Player"]), pb)
    nba_rows.append(nba_stats_to_vec(row))
    nba_phys.append({"ht": ht, "ws": ws, "wt": wt})

nba_X    = pd.DataFrame(nba_rows).fillna(0)
nba_phys = pd.DataFrame(nba_phys)
FEAT_COLS = list(nba_X.columns)

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
# 3. Build prospect feature matrix (from read-only base files)
# ---------------------------------------------------------------------------
prospects = pd.read_csv(data_path("prospect_stats_base.csv"), low_memory=False)
big_board = pd.read_csv(data_path("big_board_base.csv"))
has_stats = prospects[prospects["sr_found"] == 1].copy().reset_index(drop=True)

pros_rows = []
pros_phys = []
pros_pos_rank = []
for _, row in has_stats.iterrows():
    name = str(row["Name"])
    pb   = pos_bucket(row["Pos"])
    ht, ws, wt = get_prospect_phys(name, pb)
    pros_rows.append(college_stats_to_vec(row))
    pros_phys.append({"ht": ht, "ws": ws, "wt": wt})
    pros_pos_rank.append(primary_pos_rank(row["Pos"]))

pros_X        = pd.DataFrame(pros_rows, columns=FEAT_COLS).fillna(0)
pros_phys     = pd.DataFrame(pros_phys)
pros_pos_rank = np.array(pros_pos_rank)

# ---------------------------------------------------------------------------
# 4. Project prospects into PCA space, then physical filter → KNN in style space
# ---------------------------------------------------------------------------
POS_TOL      = 1     # max position steps on PG→SG→SF→PF→C scale
HEIGHT_TOL   = 2.5   # inches
WING_TOL     = 3.0   # inches
WEIGHT_PCT   = 0.18  # weight within ±18% of prospect's weight
MIN_POOL     = 6     # minimum candidates before relaxing physical tolerances
WEAK_COMP_TH = 65    # below this combined similarity → flag as weak comp

pros_scaled = scaler.transform(pros_X)
pros_pca    = pca.transform(pros_scaled)


def find_comps(pros_idx, n=5):
    ph     = pros_phys.iloc[pros_idx]
    ps     = pros_pca[pros_idx]
    p_rank = pros_pos_rank[pros_idx]

    # 1. Position adjacency — hard filter, never relaxed
    pos_mask = np.abs(nba_pos_rank - p_rank) <= POS_TOL

    # 2. Physical range filter — relaxed if pool too small
    wt_tol_pct = WEIGHT_PCT
    phys_extra = 0.0
    while True:
        mask = (
            pos_mask &
            (np.abs(nba_phys["ht"] - ph["ht"]) <= HEIGHT_TOL + phys_extra) &
            (np.abs(nba_phys["ws"] - ph["ws"]) <= WING_TOL + phys_extra) &
            (np.abs(nba_phys["wt"] - ph["wt"]) / ph["wt"] <= wt_tol_pct)
        )
        pool_idx = np.where(mask)[0]
        if len(pool_idx) >= MIN_POOL:
            break
        phys_extra += 0.75
        wt_tol_pct += 0.05
        if phys_extra > 6:
            break

    if len(pool_idx) == 0:
        pool_idx = np.where(pos_mask)[0]

    # 3. Physical similarity score (continuous, normalized)
    pool_phys = nba_phys.iloc[pool_idx]
    ht_std = max(nba_phys["ht"].std(), 0.1)
    ws_std = max(nba_phys["ws"].std(), 0.1)
    wt_std = max(nba_phys["wt"].std(), 0.1)
    phys_dist = np.sqrt(
        ((pool_phys["ht"] - ph["ht"]) / ht_std) ** 2 +
        ((pool_phys["ws"] - ph["ws"]) / ws_std) ** 2 +
        ((pool_phys["wt"] - ph["wt"]) / wt_std) ** 2
    ).values
    phys_sim = np.clip(100 - phys_dist * 20, 0, 100)

    # 4. Style similarity score (PCA distance)
    pool_pca = nba_pca[pool_idx]
    style_dist = np.linalg.norm(pool_pca - ps, axis=1)
    style_sim = np.clip(100 - style_dist * 8, 0, 100)

    # 5. Rank by style within the physically-valid pool
    top_local = np.argsort(-style_sim)[:n]
    results = []
    for local_i in top_local:
        global_i = pool_idx[local_i]
        results.append((global_i,
                        round(float(style_sim[local_i]), 1),
                        round(float(style_sim[local_i]), 1),
                        round(float(phys_sim[local_i]), 1)))
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
    name = row["Name"]
    rank = row["Rank"]
    bb_row = big_board[big_board["Name"] == name]
    pos = bb_row["Pos"].values[0] if len(bb_row) else row["Pos"]
    ph = pros_phys.iloc[i]
    ht_str = f"{int(ph['ht']//12)}'{ph['ht']%12:.1f}\""

    comp_matches = find_comps(i, n=5)
    comps = []
    for global_j, combined, style_s, phys_s in comp_matches:
        nba_row = master.iloc[global_j]
        nba_ph = nba_phys.iloc[global_j]
        ht_nba = f"{int(nba_ph['ht']//12)}'{nba_ph['ht']%12:.0f}\""
        ws_nba = f"{int(nba_ph['ws']//12)}'{nba_ph['ws']%12:.0f}\""
        wt_nba = int(nba_ph['wt'])
        comps.append({
            "name": nba_row["Player"],
            "pos": nba_row["Pos"],
            "off_arch": nba_row["Offensive Archetype"],
            "def_role": nba_row["Defensive Role"],
            "ht": ht_nba, "ws": ws_nba, "wt": wt_nba,
            "similarity": combined,
            "style_sim": style_s,
            "phys_sim": phys_s,
            "weak": combined < WEAK_COMP_TH,
        })

    results.append({"rank": rank, "name": name, "pos": pos,
                    "ht": ht_str, "wt": int(ph["wt"]), "comps": comps})

    ws_in = ph["ws"]
    ws_str = f"{int(ws_in//12)}'{ws_in%12:.1f}\""
    reach_raw = get_prospect_reach(name)
    reach_str = (f"{int(reach_raw//12)}'{reach_raw%12:.1f}\"" if reach_raw else "—")

    print(f"\n{'━'*62}")
    print(f"  #{rank}  {name}  ({pos})")
    print(f"  {'Height':10} {ht_str}   {'Wingspan':10} {ws_str}   "
          f"{'Weight':8} {int(ph['wt'])} lbs   Reach {reach_str}")
    print(f"{'─'*62}")

    for c in comps[:3]:
        flag = "  ⚠ weak style match" if c["weak"] else ""
        print(f"  {c['name']:<26}  {c['similarity']:.0f}% style match  "
              f"(frame {c['phys_sim']:.0f}%){flag}")

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

out = data_path("prospect_comps.csv")
pd.DataFrame(rows_out).to_csv(out, index=False, lineterminator="\n")
print(f"\n✓ Saved {out}")
