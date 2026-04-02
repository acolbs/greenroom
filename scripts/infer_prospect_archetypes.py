#!/usr/bin/env python3
"""
Infer draft prospect Offensive Archetype, Defensive Role, and numeric Scout Grade
using NBA players in master.csv as labeled reference (k-NN in a stat space).

College lines come from prospect_stats.csv (Sports-Reference). Prospects without
sr_found / empty games still get grades from board rank + positional defaults.

Height is not in the CSVs; position + per-minute rates + shooting profile proxy
for NBA-style role. Re-run after updating master.csv or prospect_stats.csv:

  python scripts/infer_prospect_archetypes.py

Paths are relative to repo root (parent of scripts/).
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import StandardScaler

REPO_ROOT = Path(__file__).resolve().parent.parent
MASTER = REPO_ROOT / "web" / "public" / "data" / "master.csv"
PROSPECT_STATS = REPO_ROOT / "web" / "public" / "data" / "prospect_stats.csv"
BIG_BOARD_IN = REPO_ROOT / "web" / "public" / "data" / "big_board.csv"
BIG_BOARD_OUT = REPO_ROOT / "web" / "public" / "data" / "big_board.csv"

VALID_OFF = {
    "Athletic Finisher",
    "Low Minute",
    "Movement Shooter",
    "Off Screen Shooter",
    "Post Scorer",
    "Primary Ball Handler",
    "Roll + Cut Big",
    "Secondary Ball Handler",
    "Shot Creator",
    "Slasher",
    "Stationary Shooter",
    "Stretch Big",
    "Versatile Big",
}
VALID_DEF = {
    "Anchor Big",
    "Chaser",
    "Helper",
    "Low Activity",
    "Mobile Big",
    "Point of Attack",
    "Wing Stopper",
}


def _pos_group_nba(pos_raw: str) -> tuple[float, float, float]:
    """One-hot-ish: guard, wing, big (first listed position)."""
    if not isinstance(pos_raw, str) or not pos_raw.strip():
        return 0.0, 1.0, 0.0
    p = pos_raw.strip().split("/")[0].strip().upper()
    if p in ("PG", "SG"):
        return 1.0, 0.0, 0.0
    if p == "SF":
        return 0.0, 1.0, 0.0
    if p in ("PF", "C"):
        return 0.0, 0.0, 1.0
    return 0.0, 1.0, 0.0


def _pos_group_sr(pos_raw: str | float) -> tuple[float, float, float]:
    if pos_raw is None or (isinstance(pos_raw, float) and np.isnan(pos_raw)):
        return 0.0, 1.0, 0.0
    s = str(pos_raw).strip().upper()
    if s == "G":
        return 1.0, 0.0, 0.0
    if s == "F":
        return 0.0, 1.0, 0.0
    if s == "C":
        return 0.0, 0.0, 1.0
    return 0.0, 1.0, 0.0


def nba_feature_row(row: pd.Series) -> np.ndarray | None:
    try:
        g = float(row["G"])
        mp_total = float(row["MP"])
        if g < 10 or mp_total <= 0:
            return None
        mpg = mp_total / g
        if mpg < 12:
            return None
        scale = 36.0 / mpg
        pts = float(row["PTS"])
        ast = float(row["AST"])
        trb = float(row["TRB"])
        stl = float(row["STL"])
        blk = float(row["BLK"])
        tov = float(row["TOV"])
        fga = float(row["FGA"])
        fta = float(row["FTA"])
        fg3a = float(row["3PA"])
    except (ValueError, KeyError, TypeError):
        return None

    if fga <= 0:
        fga = 1e-6
    pts36 = pts * scale
    ast36 = ast * scale
    trb36 = trb * scale
    stl36 = stl * scale
    blk36 = blk * scale
    tov36 = tov * scale
    three_rate = fg3a / fga
    ftr = fta / fga
    ts = float(row["TS%"]) if pd.notna(row["TS%"]) else 0.55
    per = float(row["PER"]) if pd.notna(row["PER"]) else 15.0
    trb_pct = float(row["TRB%"]) if pd.notna(row["TRB%"]) else 10.0
    ast_pct = float(row["AST%"]) if pd.notna(row["AST%"]) else 15.0
    stl_pct = float(row["STL%"]) if pd.notna(row["STL%"]) else 1.5
    blk_pct = float(row["BLK%"]) if pd.notna(row["BLK%"]) else 1.5
    usg = float(row["USG%"]) if pd.notna(row["USG%"]) else 20.0
    bpm = float(row["BPM"]) if pd.notna(row["BPM"]) else 0.0
    ast_tov = ast / (tov + 0.8) if tov > 0 else ast

    g0, g1, g2 = _pos_group_nba(str(row.get("Pos", "")))
    return np.array(
        [
            g0,
            g1,
            g2,
            pts36,
            ast36,
            trb36,
            stl36,
            blk36,
            tov36,
            three_rate,
            ftr,
            ts,
            per,
            trb_pct,
            ast_pct,
            stl_pct,
            blk_pct,
            usg,
            bpm,
            ast_tov,
        ],
        dtype=np.float64,
    )


def prospect_feature_row(row: pd.Series, board_pos: str) -> np.ndarray:
    """Map college line + big-board position into same space as NBA (impute rates)."""
    g0, g1, g2 = _pos_group_nba(board_pos)
    sr_pos = row.get("pos")
    if sr_pos is not None and str(sr_pos).strip():
        g0, g1, g2 = _pos_group_sr(sr_pos)

    def f(name: str, default: float = 0.0) -> float:
        v = row.get(name)
        if v is None or (isinstance(v, float) and np.isnan(v)) or str(v).strip() == "":
            return default
        try:
            x = float(str(v).replace(",", ""))
            return x if np.isfinite(x) else default
        except ValueError:
            return default

    mpg = f("mp_per_g", 0.0)
    if mpg <= 0:
        mpg = 30.0
    scale = 36.0 / mpg

    pts = f("pts_per_g")
    ast = f("ast_per_g")
    trb = f("trb_per_g")
    stl = f("stl_per_g")
    blk = f("blk_per_g")
    tov = f("tov_per_g")
    fga = f("fga_per_g")
    fta = f("fta_per_g")
    fg3a = f("fg3_per_g")
    if fga <= 0:
        fga = 1e-6

    pts36 = pts * scale
    ast36 = ast * scale
    trb36 = trb * scale
    stl36 = stl * scale
    blk36 = blk * scale
    tov36 = tov * scale
    three_rate = fg3a / fga
    ftr = fta / fga
    ts_raw = f("ts_pct", 0.55)
    if ts_raw > 1.0:
        ts_raw = ts_raw / 100.0
    ts = ts_raw if ts_raw > 0.2 else 0.55

    # Impute advanced-style rates from box (rough college proxies)
    per = 11.0 + 0.45 * pts36 + 0.35 * ast36 + 0.12 * trb36 + 8.0 * (ts - 0.5)
    trb_pct = min(28.0, 6.0 + 1.1 * trb36)
    ast_pct = min(45.0, 4.0 + 2.8 * ast36 + 2.0 * g0)
    stl_pct = min(4.5, 0.5 + 0.35 * stl36)
    blk_pct = min(8.0, 0.4 + 0.55 * blk36)
    usg = min(38.0, 18.0 + 0.55 * fga * scale)
    bpm = -2.0 + 0.08 * per + 0.02 * ast_pct - 0.03 * tov36
    ast_tov = ast / (tov + 0.8) if tov > 0 else ast

    return np.array(
        [
            g0,
            g1,
            g2,
            pts36,
            ast36,
            trb36,
            stl36,
            blk36,
            tov36,
            three_rate,
            ftr,
            ts,
            per,
            trb_pct,
            ast_pct,
            stl_pct,
            blk_pct,
            usg,
            bpm,
            ast_tov,
        ],
        dtype=np.float64,
    )


def prospect_feature_pos_only(board_pos: str) -> np.ndarray:
    """Neutral stat line for k-NN when no college stats (median-ish)."""
    g0, g1, g2 = _pos_group_nba(board_pos)
    return np.array(
        [
            g0,
            g1,
            g2,
            14.0,
            3.0,
            5.5,
            1.0,
            0.6,
            2.2,
            0.38,
            0.28,
            0.56,
            15.0,
            11.0,
            18.0,
            1.8,
            2.0,
            22.0,
            0.0,
            2.0,
        ],
        dtype=np.float64,
    )


def load_nba_training(df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    xs: list[np.ndarray] = []
    y_off: list[str] = []
    y_def: list[str] = []
    for _, row in df.iterrows():
        oa = str(row.get("Offensive Archetype", "")).strip()
        dr = str(row.get("Defensive Role", "")).strip()
        if oa not in VALID_OFF or dr not in VALID_DEF:
            continue
        if oa == "Low Minute":
            continue
        vec = nba_feature_row(row)
        if vec is None:
            continue
        xs.append(vec)
        y_off.append(oa)
        y_def.append(dr)
    return np.stack(xs), np.array(y_off), np.array(y_def)


def grade_from_stats_and_rank(
    rank: int,
    n_board: int,
    feat: np.ndarray,
    cohort_matrix: np.ndarray,
) -> int:
    """Numeric scout grade 60–95 from production vs cohort + board rank."""
    rank_prior = 94.0 - (rank - 1) * 29.0 / max(1, (n_board - 1))

    if cohort_matrix.shape[0] < 5:
        return int(round(np.clip(rank_prior, 60, 95)))

    sub = cohort_matrix[:, 3:]
    x = feat[3:]
    mu = np.nanmean(sub, axis=0)
    sig = np.nanstd(sub, axis=0)
    sig = np.where(sig < 1e-6, 1.0, sig)
    z = (x - mu) / sig
    weights = np.array(
        [1.0, 0.85, 0.55, 0.5, 0.45, -0.35, 0.25, 0.2, 0.9, 0.35, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.25],
        dtype=np.float64,
    )
    w = weights[: len(z)]
    prod_z = float(np.dot(z[: len(w)], w) / (np.sum(np.abs(w)) + 1e-9))
    stat_adj = 6.0 * np.tanh(prod_z)
    g = 0.55 * rank_prior + 0.45 * (66.0 + stat_adj + (n_board - rank) * 0.18)
    return int(round(np.clip(g, 60, 95)))


def main() -> int:
    if not MASTER.exists():
        print("Missing", MASTER, file=sys.stderr)
        return 1

    nba = pd.read_csv(MASTER)
    X, y_off, y_def = load_nba_training(nba)
    if len(X) < 40:
        print("Too few NBA training rows:", len(X), file=sys.stderr)
        return 1

    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)
    k = min(21, max(5, int(np.sqrt(len(X)))))
    clf_off = KNeighborsClassifier(n_neighbors=k, weights="distance")
    clf_def = KNeighborsClassifier(n_neighbors=k, weights="distance")
    clf_off.fit(Xs, y_off)
    clf_def.fit(Xs, y_def)

    ps = pd.read_csv(PROSPECT_STATS)
    # Merged file has board "Pos" (PG/SF/…) and SR "pos" (G/F/C)
    stats_by_rank: dict[int, pd.Series] = {}
    for _, row in ps.iterrows():
        try:
            r = int(float(row["Rank"]))
        except (ValueError, TypeError):
            continue
        stats_by_rank[r] = row

    board_rows: list[dict[str, str]] = []
    with BIG_BOARD_IN.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        if not fieldnames:
            print("Empty big_board", file=sys.stderr)
            return 1
        for row in reader:
            board_rows.append(dict(row))

    # New schema
    out_fields = [
        "Rank",
        "Name",
        "School",
        "Pos",
        "Year",
        "Grade",
        "Offensive Archetype",
        "Defensive Role",
        "Notes",
    ]

    n_board = len(board_rows)
    # Build cohort matrix for grading (prospects with sr_found)
    cohort_feats: list[np.ndarray] = []
    for br in board_rows:
        try:
            r = int(float(br.get("Rank", "0")))
        except (ValueError, TypeError):
            continue
        if r not in stats_by_rank:
            continue
        srow = stats_by_rank[r]
        if str(srow.get("sr_found", "")).strip() != "1":
            continue
        fp = prospect_feature_row(srow, str(br.get("Pos", "")))
        cohort_feats.append(fp)
    cohort_X = np.stack(cohort_feats) if cohort_feats else np.zeros((0, 19))

    updated: list[dict[str, str]] = []
    for br in board_rows:
        try:
            rank = int(float(br.get("Rank", "0")))
        except (ValueError, TypeError):
            continue
        name = br.get("Name", "").strip()
        school = br.get("School", "").strip()
        pos = br.get("Pos", "").strip()
        # Old file: class year lived in "Grade" column
        year = br.get("Year", "").strip() or br.get("Grade", "").strip()
        notes = br.get("Notes", "").strip()

        has_stats = rank in stats_by_rank and str(stats_by_rank[rank].get("sr_found", "")).strip() == "1"
        old_oa = str(br.get("Offensive Archetype", "")).strip()
        old_dr = str(br.get("Defensive Role", "")).strip()

        if has_stats:
            feat = prospect_feature_row(stats_by_rank[rank], pos)
        else:
            feat = prospect_feature_pos_only(pos)

        x = scaler.transform(feat.reshape(1, -1))
        if has_stats:
            po = clf_off.predict(x)[0]
            pd_ = clf_def.predict(x)[0]
        else:
            # No college line: keep human scout archetypes from the board
            po = old_oa if old_oa in VALID_OFF else clf_off.predict(x)[0]
            pd_ = old_dr if old_dr in VALID_DEF else clf_def.predict(x)[0]
        if po not in VALID_OFF:
            po = "Shot Creator"
        if pd_ not in VALID_DEF:
            pd_ = "Helper"

        if has_stats and cohort_X.shape[0] >= 3:
            grade = grade_from_stats_and_rank(rank, n_board, feat, cohort_X)
        else:
            grade = int(round(np.clip(93.0 - (rank - 1) * 28.0 / max(1, n_board - 1), 60, 95)))

        updated.append(
            {
                "Rank": str(rank),
                "Name": name,
                "School": school,
                "Pos": pos,
                "Year": year,
                "Grade": str(grade),
                "Offensive Archetype": po,
                "Defensive Role": pd_,
                "Notes": notes,
            }
        )

    updated.sort(key=lambda r: int(r["Rank"]))
    with BIG_BOARD_OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=out_fields, lineterminator="\n")
        w.writeheader()
        w.writerows(updated)

    print(f"Wrote {len(updated)} rows to {BIG_BOARD_OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
