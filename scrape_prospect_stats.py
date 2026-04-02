"""
Scrape per-game and advanced stats from Sports Reference CBB
for every prospect in big_board.csv.

Output: prospect_stats.csv

Usage:
    pip install requests beautifulsoup4
    python scrape_prospect_stats.py

Sports Reference asks for at least 3 seconds between requests.
"""

import csv
import time
import re
import unicodedata
from pathlib import Path

import requests
from bs4 import BeautifulSoup, Comment

# ── Config ─────────────────────────────────────────────────────────────────

BIG_BOARD  = Path(__file__).parent / "big_board.csv"
OUTPUT     = Path(__file__).parent / "prospect_stats.csv"
DELAY      = 4        # seconds between requests
TARGET_SEASON = "2025-26"

BASE_URL   = "https://www.sports-reference.com"
SEARCH_URL = BASE_URL + "/cbb/search/search.fcgi?search={}"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

# ── Output columns (matching actual SR CBB column names) ───────────────────

PG_COLS = [
    "year_id", "team_name_abbr", "conf_abbr", "class", "pos",
    "games", "games_started", "mp_per_g",
    "fg_per_g", "fga_per_g", "fg_pct",
    "fg3_per_g", "fg3a_per_g", "fg3_pct",
    "fg2_per_g", "fg2a_per_g", "fg2_pct",
    "efg_pct",
    "ft_per_g", "fta_per_g", "ft_pct",
    "trb_per_g", "ast_per_g", "stl_per_g",
    "blk_per_g", "tov_per_g", "pf_per_g", "pts_per_g",
]

ADV_COLS = [
    "ts_pct", "fg3a_per_fga_pct", "fta_per_fga_pct", "tov_pct",
]

OUTPUT_COLS = (
    ["Rank", "Name", "School", "Pos", "Grade",
     "Offensive Archetype", "Defensive Role", "Notes",
     "sr_url", "sr_found"]
    + PG_COLS + ADV_COLS
)

# ── HTTP helper ────────────────────────────────────────────────────────────

def fetch(url: str, retries: int = 2) -> requests.Response | None:
    for attempt in range(retries + 1):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15, allow_redirects=True)
            if resp.status_code == 429:
                wait = 30 * (attempt + 1)
                print(f"    Rate limited -- waiting {wait}s ...")
                time.sleep(wait)
                continue
            if resp.status_code != 200:
                print(f"    HTTP {resp.status_code}")
                return None
            return resp
        except requests.RequestException as e:
            print(f"    Request error: {e}")
            time.sleep(5)
    return None

# ── Name helpers ───────────────────────────────────────────────────────────

def normalize_str(s: str) -> str:
    """Lowercase, strip accents, remove non-alpha."""
    nfd = unicodedata.normalize("NFD", s)
    ascii_s = "".join(c for c in nfd if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z]", "", ascii_s.lower())


def name_tokens(name: str) -> list[str]:
    """Return meaningful tokens from a name."""
    # Strip suffixes
    cleaned = re.sub(r"\s+(Jr\.?|Sr\.?|II|III|IV)$", "", name, flags=re.IGNORECASE).strip()
    return [normalize_str(t) for t in cleaned.split() if len(t) > 1]


def names_match(search_name: str, candidate: str) -> bool:
    """True if >=2 name tokens from search appear in candidate."""
    tokens = name_tokens(search_name)
    cand = normalize_str(candidate)
    hits = sum(1 for t in tokens if t in cand)
    return hits >= min(2, len(tokens))


def search_variants(name: str) -> list[str]:
    """Search queries to try, most specific first."""
    variants = [name]
    # ASCII version (handles accents like López -> Lopez)
    ascii_name = "".join(
        c for c in unicodedata.normalize("NFD", name)
        if unicodedata.category(c) != "Mn"
    )
    if ascii_name != name:
        variants.append(ascii_name)
    # Strip Jr./II/etc.
    for v in list(variants):
        stripped = re.sub(r"\s+(Jr\.?|Sr\.?|II|III|IV)$", "", v, flags=re.IGNORECASE).strip()
        if stripped not in variants:
            variants.append(stripped)
    return variants

# ── Table parsing ──────────────────────────────────────────────────────────

def find_table(soup: BeautifulSoup, table_id: str):
    """Find table by id in HTML and inside HTML comments (SR lazy-loads)."""
    table = soup.find("table", {"id": table_id})
    if table:
        return table
    for comment in soup.find_all(string=lambda t: isinstance(t, Comment)):
        if table_id in comment:
            cs = BeautifulSoup(comment, "html.parser")
            table = cs.find("table", {"id": table_id})
            if table:
                return table
    return None


def get_season_row(table, season: str) -> dict:
    """Extract the row for a specific season (year_id). Falls back to most recent."""
    if table is None:
        return {}
    tbody = table.find("tbody")
    if not tbody:
        return {}

    rows = [
        r for r in tbody.find_all("tr")
        if "thead" not in (r.get("class") or [])
    ]

    def row_to_dict(row):
        return {
            cell.get("data-stat"): cell.get_text(strip=True)
            for cell in row.find_all(["th", "td"])
            if cell.get("data-stat")
        }

    # Try exact season match first
    for row in rows:
        d = row_to_dict(row)
        if d.get("year_id") == season:
            return d

    # Fall back to most recent non-Career row
    for row in reversed(rows):
        d = row_to_dict(row)
        year = d.get("year_id", "")
        if year and year.lower() != "career" and year != "":
            return d

    return {}

# ── Player search ──────────────────────────────────────────────────────────

def find_player_url(name: str, school: str) -> str | None:
    """
    Search SR CBB for a player. Uses school to disambiguate same-name players.
    Returns the player page URL or None.
    """
    school_norm = normalize_str(school)

    for query in search_variants(name):
        url = SEARCH_URL.format(requests.utils.quote(query))
        resp = fetch(url)
        if resp is None:
            time.sleep(DELAY)
            continue

        # Redirected to a single player page
        if "/cbb/players/" in resp.url:
            soup = BeautifulSoup(resp.text, "html.parser")
            # Verify name + check they have a 2025-26 row
            title = soup.find("h1")
            title_text = title.get_text(strip=True) if title else ""
            if names_match(name, title_text):
                pg = find_table(soup, "players_per_game")
                row = get_season_row(pg, TARGET_SEASON)
                if row:
                    return resp.url
            # Wrong player or no current season data
            time.sleep(DELAY)
            continue

        # Search results page — pick best match
        soup = BeautifulSoup(resp.text, "html.parser")
        players_div = soup.find("div", id="players")
        if not players_div:
            time.sleep(DELAY)
            continue

        candidates = players_div.find_all("p")
        best_url = None
        for p in candidates:
            a = p.find("a", href=re.compile(r"/cbb/players/"))
            if not a:
                continue
            link_text = a.get_text(strip=True)
            context = p.get_text(strip=True)  # includes school/years
            if not names_match(name, link_text):
                continue
            candidate_url = BASE_URL + a["href"]
            # Prefer the candidate whose context mentions the school
            if school_norm and school_norm in normalize_str(context):
                return candidate_url
            if best_url is None:
                best_url = candidate_url  # take first name match as fallback

        if best_url:
            return best_url

        time.sleep(DELAY)

    return None

# ── Stats fetch ────────────────────────────────────────────────────────────

def get_player_stats(player_url: str) -> dict:
    resp = fetch(player_url)
    if resp is None:
        return {}

    soup = BeautifulSoup(resp.text, "html.parser")

    pg_row  = get_season_row(find_table(soup, "players_per_game"),  TARGET_SEASON)
    adv_row = get_season_row(find_table(soup, "players_advanced"), TARGET_SEASON)

    stats = {}
    for col in PG_COLS:
        stats[col] = pg_row.get(col, "")
    for col in ADV_COLS:
        stats[col] = adv_row.get(col, "")

    return stats

# ── CSV helpers ────────────────────────────────────────────────────────────

def write_csv(rows: list[dict]):
    with open(OUTPUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=OUTPUT_COLS, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)

# ── Main ───────────────────────────────────────────────────────────────────

def main():
    with open(BIG_BOARD, newline="", encoding="utf-8") as f:
        prospects = list(csv.DictReader(f))

    print(f"Loaded {len(prospects)} prospects  |  target season: {TARGET_SEASON}")
    print(f"Output: {OUTPUT.name}\n")

    # Resume from checkpoint
    done_ranks: set[str] = set()
    results: list[dict] = []
    if OUTPUT.exists():
        with open(OUTPUT, newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                results.append(r)
                done_ranks.add(r.get("Rank", "").strip())
        if done_ranks:
            print(f"Resuming -- {len(done_ranks)} players already done.\n")

    for i, prospect in enumerate(prospects, 1):
        name   = prospect["Name"].strip()
        rank   = prospect["Rank"].strip()
        school = prospect["School"].strip()

        if rank in done_ranks:
            print(f"[{i:2}/{len(prospects)}] {rank:>3}. {name} -- skipped")
            continue

        print(f"[{i:2}/{len(prospects)}] {rank:>3}. {name} ({school}) ... ", end="", flush=True)

        row = dict(prospect)

        player_url = find_player_url(name, school)
        time.sleep(DELAY)

        if player_url is None:
            print("NOT FOUND")
            row["sr_url"] = ""
            row["sr_found"] = "0"
            for col in PG_COLS + ADV_COLS:
                row[col] = ""
            results.append(row)
            continue

        short = player_url.split("/")[-1]
        print(f"found: {short}", end="", flush=True)

        stats = get_player_stats(player_url)
        time.sleep(DELAY)

        if stats.get("pts_per_g"):
            print(f"  {stats['pts_per_g']} pts  {stats['trb_per_g']} reb  {stats['ast_per_g']} ast")
        else:
            print("  (no 2025-26 stats found)")

        row["sr_url"]    = player_url
        row["sr_found"]  = "1" if stats.get("pts_per_g") else "0"
        row.update(stats)
        results.append(row)

        if i % 10 == 0:
            write_csv(results)
            print(f"  -- checkpoint saved ({i} players) --")

    write_csv(results)
    found = sum(1 for r in results if r.get("sr_found") == "1")
    print(f"\nDone. {found}/{len(results)} players have 2025-26 stats.")
    print(f"Saved to {OUTPUT}")


if __name__ == "__main__":
    main()
