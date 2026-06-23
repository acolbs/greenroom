# Sub-project A — Archetypes + Talent Score

**Date:** 2026-06-23
**Status:** Approved (design), implementation in progress
**Part of:** Logic revamp (A→B/C→D→E). This is the foundation; later sub-projects
(need detection, fit+quality scoring, pick realism, Scout AI) depend on it.

## Problem

The current draft/fit logic (`blueprintScore.ts`, `championshipFormula.ts`) ranks
players **purely by archetype match** — there is no player-talent term anywhere.
Consequence: a mediocre player whose archetype exactly fits an open slot outranks
a clearly better player whose archetype only partially fits. This is the "Curry
shows yellow / a worse-fitting guard gets recommended over him" bug.

The fix requires a first-class **Talent Score** as an input to fit. This sub-project
produces that number (and confirms authoritative archetype labels). It does **not**
change any ranking yet — wiring talent into fit is sub-project C. Keeping it
isolated makes it independently verifiable.

## Deliverable 1 — Authoritative archetype labels (Ringer import)

The Ringer's per-player offensive/defensive role labels can't be scraped (JS-rendered),
so the user imports them manually.

- New file `web/public/data/ringer_roles.csv`, columns: `Name, Offensive Archetype,
  Defensive Role`. User-filled from The Ringer expand panels.
- Precedence at load time: **ringer_roles.csv → big_board.csv → ML (prospect_archetype_ml.csv)**.
  One clear source of truth, with fallbacks where the user hasn't entered a row.
- Vocabulary mapping: if The Ringer's wording differs from the project's 6 offensive /
  6 defensive labels, a small map normalizes it. Built once the first batch is pasted
  (we don't know their exact vocabulary yet).
- Build aid: generate a **pre-filled template** (all current prospects with their
  existing labels) so the user only edits where The Ringer disagrees.

Taxonomy (project canonical):
- Offensive: Primary Ball Handler, Secondary Ball Handler, Shot Creator,
  Movement Shooter, Stationary Shooter, Roll + Cut Big.
- Defensive: Point of Attack, Wing Stopper, Helper, Chaser, Anchor Big, Mobile Big.

## Deliverable 2 — Unified Talent Score

A `talentScore` (0–100) and `talentTier` attached to every prospect and every NBA
player. Normalized by **percentile within its own pool** (prospects vs prospects,
pros vs pros) so a prospect's 80 is never falsely equated with a pro's 80.

- **Prospect talent:** `0.7 × pct(EV) + 0.3 × pct(Grade)`
  - EV from `prospect_success.csv` (already a projection of NBA success).
  - Grade from `big_board.csv` (scout consensus).
  - Fallbacks: grade-only (no EV) → rank-derived (no grade).
- **NBA talent:** `0.5 × pct(BPM) + 0.3 × pct(VORP) + 0.2 × pct(WS)`
  - From `PlayerStats` (parsed from `master.csv`). BPM is per-possession impact —
    why Curry lands ~99.
  - Fallback: PER, then PTS+TS%, if advanced metrics missing.
- **Tier (display):** Star ≥85 / Starter ≥65 / Rotation ≥40 / Depth <40.

`pct(x)` = percentile rank of x within the relevant pool (robust to outliers).

## Architecture

- New module `web/src/lib/talentScore.ts` — pure functions, no UI coupling:
  - `percentileRank(value: number, population: number[]): number` (0–100, midrank).
  - `prospectTalentScores(prospects): Map<id, number>` — builds EV/grade pools,
    returns blended percentile per prospect with fallbacks.
  - `nbaTalentScores(players): Map<id, number>` — same for BPM/VORP/WS.
  - `talentTier(score: number): TalentTier`.
- New fields:
  - `DraftProspect.talentScore: number`, `DraftProspect.talentTier: TalentTier`.
  - NBA player type(s) (`RosterPlayer`, free-agent type): `talentScore`, `talentTier`.
- Wiring in `simulatorStore.ts`: after prospects/players are assembled, compute the
  score maps once and attach. Single pass, no per-render cost.

## Data flow

```
prospect_success.csv (EV) + big_board.csv (Grade)  -> prospectTalentScores() -> talentScore/tier on DraftProspect
master.csv (BPM / VORP / WS)                        -> nbaTalentScores()      -> talentScore/tier on NBA player
ringer_roles.csv (new, user-filled)                 -> archetype precedence resolver -> off/def labels
```

## Edge cases

- Missing EV → grade-only; missing grade → rank percentile; both missing → 50 (neutral).
- Missing BPM/VORP/WS → PER → PTS+TS%; none → 50 (neutral).
- Empty pool → 50 for all (no information).
- ringer_roles.csv absent or partial → fall back per row; never crash.

## Testing / verification

No test runner is configured in `web/` today. The core math (`percentileRank`, blend,
tier thresholds) is pure and will be verified with a throwaway Node check against known
inputs (e.g. a top-EV prospect → ~100, Curry's BPM → ~99 tier Star), plus live
inspection in the running app. Introducing a full test framework is out of scope for A.

## Out of scope (later sub-projects)

- Using talent in fit/recommendation ranking (C).
- Need detection vs a target title team (B).
- Pick realism (D). Note: the Ringer pick order imported here also feeds D.
- Scout AI explanations (E).
