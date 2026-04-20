#!/usr/bin/env python3
"""job_signal_scraper.py — scrape career pages for digital asset hiring signals.

Targets Greenhouse JSON API, Lever JSON API, and direct career pages.
Stores results in job_signals.db (SQLite).
Generates kataBased review content from hiring patterns.

Usage:
    python job_signal_scraper.py                     # full run
    python job_signal_scraper.py --dry-run           # scrape only, no review gen
    python job_signal_scraper.py --company Circle    # single company
    python job_signal_scraper.py --since 7           # only new jobs from last N days
"""

import os
import sys
import json
import time
import sqlite3
import argparse
import textwrap
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "job_signals.db")

# ── Signal keywords ─────────────────────────────────────────────────────────
SIGNAL_KEYWORDS = [
    # Core crypto infra
    "blockchain", "crypto", "digital asset", "tokeniz", "defi", "web3",
    "stablecoin", "smart contract", "custody", "wallet", "on-chain",
    # TradFi digital
    "distributed ledger", "dlt", "digital securities", "tokenized fund",
    # Specific tech
    "solidity", "rust", "solana", "ethereum", "bitcoin", "layer 2",
    # Adjacent signals
    "settlement", "cbdc", "digital payment", "programmable money",
]

# ── Company targets ──────────────────────────────────────────────────────────
# ats: "greenhouse" | "lever" | "workday" | "direct"
TARGETS = [
    # ── Crypto native — Greenhouse (confirmed slugs) ──────────────────────
    {"company": "Coinbase",             "ats": "greenhouse", "slug": "coinbase"},
    {"company": "Fireblocks",           "ats": "greenhouse", "slug": "fireblocks"},
    {"company": "Gemini",               "ats": "greenhouse", "slug": "gemini"},
    {"company": "Ripple",               "ats": "greenhouse", "slug": "ripple"},
    {"company": "ConsenSys",            "ats": "greenhouse", "slug": "consensys"},
    {"company": "a16z crypto",          "ats": "greenhouse", "slug": "a16z"},
    {"company": "Robinhood",            "ats": "greenhouse", "slug": "robinhood"},
    {"company": "Blockchain.com",       "ats": "greenhouse", "slug": "blockchain"},
    # ── TradFi + Big Tech — Greenhouse ────────────────────────────────────
    {"company": "Stripe",               "ats": "greenhouse", "slug": "stripe"},
    # ── Crypto native — Lever (confirmed slugs) ───────────────────────────
    {"company": "1inch",                "ats": "lever",      "slug": "1inch"},
    # ── Job aggregator feeds (no-auth JSON) ───────────────────────────────
    # CryptoJobsList RSS/sitemap — scraped via direct URL
    {"company": "_aggregator_cryptojobslist", "ats": "aggregator",
     "url": "https://cryptojobslist.com/blockchain"},
    # Web3.career
    {"company": "_aggregator_web3career", "ats": "aggregator",
     "url": "https://web3.career"},
    # useWeb3
    {"company": "_aggregator_useweb3", "ats": "aggregator",
     "url": "https://www.useweb3.xyz/jobs"},
    # Direct career pages (Playwright fallback) ───────────────────────────
    {"company": "Kraken",               "ats": "direct",
     "url": "https://jobs.ashbyhq.com/kraken"},
    {"company": "Chainalysis",          "ats": "direct",
     "url": "https://jobs.ashbyhq.com/chainalysis"},
    {"company": "Circle",               "ats": "direct",
     "url": "https://jobs.ashbyhq.com/circle"},
    {"company": "Paxos",                "ats": "direct",
     "url": "https://jobs.ashbyhq.com/paxos"},
    {"company": "Anchorage Digital",    "ats": "direct",
     "url": "https://jobs.ashbyhq.com/anchorage"},
    {"company": "BitGo",                "ats": "direct",
     "url": "https://jobs.ashbyhq.com/bitgo"},
    {"company": "Polymarket",           "ats": "direct",
     "url": "https://jobs.ashbyhq.com/polymarket"},
    {"company": "Intuit",               "ats": "direct",
     "url": "https://jobs.intuit.com/search-jobs?k=blockchain+crypto+digital+asset"},
    {"company": "Oracle",               "ats": "direct",
     "url": "https://careers.oracle.com/jobs/search?keyword=blockchain+digital+asset"},
    {"company": "BlackRock",            "ats": "direct",
     "url": "https://careers.blackrock.com/job-search-results/?keyword=digital+asset"},
    {"company": "JPMorgan",             "ats": "direct",
     "url": "https://careers.jpmorgan.com/us/en/search-jobs?keywords=blockchain+digital+asset"},
    {"company": "Goldman Sachs",        "ats": "direct",
     "url": "https://higher.gs.com/roles?query=digital+asset+blockchain"},
    {"company": "DTCC",                 "ats": "direct",
     "url": "https://careers.dtcc.com/search/?q=blockchain"},
    {"company": "Visa",                 "ats": "direct",
     "url": "https://corporate.visa.com/en/jobs/search/?query=crypto+blockchain"},
    {"company": "Nasdaq",               "ats": "direct",
     "url": "https://careers.nasdaq.com/search/?q=digital+asset+blockchain"},
]

# ── Review templates — per hiring signal pattern ─────────────────────────────
REVIEW_TEMPLATES = {
    "tokenization_push": {
        "title": "{company} is betting everything on tokenization — here's what that looks like from inside",
        "content": (
            "The hiring tells the story before the press release does. "
            "Tokenization engineers, digital securities architects, on-chain fund managers — "
            "the org is building, not piloting. "
            "Culture is split between the 'this changes everything' team and the "
            "'let's not break compliance' layer above them. "
            "If you're a blockchain engineer, the work is real. "
            "If you need to ship fast, the institutional overhead will test your patience. "
            "Equity is traditional. Mission is genuine. "
            "Show up knowing the legacy systems you're replacing took 40 years to build."
        ),
        "category": "company_review",
    },
    "stablecoin_infra": {
        "title": "{company} is building stablecoin rails that most people won't realize are blockchain",
        "content": (
            "The job postings are the tell: stablecoin engineers, CCTP architects, "
            "programmable money product managers. "
            "This team isn't doing research — they're shipping infrastructure that moves real money. "
            "Culture is mission-driven but the regulatory layer is constant. "
            "Every product decision has a compliance review attached. "
            "Engineers with crypto-native backgrounds find the pace frustrating for the first six months, "
            "then realize the institutional constraints are the actual engineering challenge. "
            "Comp competitive. Remote-flexible. Stablecoin legislation is the tailwind everyone's waiting for."
        ),
        "category": "culture",
    },
    "custody_build": {
        "title": "{company} custody team is one of the most technically demanding jobs in the space",
        "content": (
            "MPC cryptography, HSM integration, threshold signatures, multi-party key ceremonies — "
            "if you're hiring for this, you're building serious custody infrastructure. "
            "{company} is doing exactly that. "
            "The security culture is exceptional and exhausting in equal measure. "
            "Every design decision runs through an adversarial review. "
            "On-call is real. The stakes are institutional billions. "
            "If you want the hardest custody engineering problems in crypto, this is the room. "
            "Compensation reflects the responsibility. Culture is security-obsessed by design."
        ),
        "category": "management",
    },
    "defi_protocol": {
        "title": "{company} hiring signal: they're serious about the next protocol version",
        "content": (
            "When a DeFi protocol starts hiring smart contract engineers and mechanism design researchers "
            "at the same time, V-next is being built. "
            "{company} is doing exactly that. "
            "Culture is research-heavy — you're expected to have opinions and defend them. "
            "Governance adds overhead but the team takes it seriously. "
            "Comp is competitive for DeFi. Remote-first. "
            "If you want to work on protocol primitives that actually get used, "
            "the hiring cadence suggests the interesting work is live."
        ),
        "category": "culture",
    },
    "compliance_tools": {
        "title": "{company} is building the compliance layer for the next era of crypto",
        "content": (
            "Blockchain data scientists, on-chain analytics engineers, AML/compliance architects — "
            "the hiring pattern at {company} is clear. "
            "This is infrastructure work at the intersection of crypto and regulation. "
            "The engineering is technically interesting. The mission is politically complicated. "
            "Culture is analytical, process-oriented, DC-influenced. "
            "If you can hold the tension between 'crypto native' and 'regulatory tooling,' "
            "the work is uniquely important. "
            "Government contract cadence. Strong comp. "
            "The stablecoin legislation tailwind means this team's TAM is about to expand."
        ),
        "category": "company_review",
    },
    "general_digital_assets": {
        "title": "{company} digital assets team: what the job postings tell you that the press releases don't",
        "content": (
            "Hiring volume and role distribution tell you more than any announcement. "
            "{company} is building real digital asset infrastructure — not a research lab, "
            "not a pilot program. "
            "Engineers who've worked here describe the institutional context as both the "
            "biggest asset and the biggest friction. "
            "The resources are exceptional. The approval chains are real. "
            "If you want to work on blockchain infrastructure at institutional scale, "
            "this team is credible. "
            "Comp is strong. Culture varies by sub-team. "
            "The mission matters more here than the token upside."
        ),
        "category": "company_review",
    },
}

def classify_signals(jobs: list[dict]) -> str:
    """Classify hiring pattern into a review template key."""
    all_text = " ".join(
        f"{j.get('title','')} {j.get('department','')}".lower()
        for j in jobs
    )
    if sum(1 for kw in ["tokeniz", "tokenized fund", "digital securities"] if kw in all_text) >= 2:
        return "tokenization_push"
    if sum(1 for kw in ["stablecoin", "cctp", "programmable", "usdc"] if kw in all_text) >= 2:
        return "stablecoin_infra"
    if sum(1 for kw in ["custody", "mpc", "hsm", "threshold", "key management"] if kw in all_text) >= 2:
        return "custody_build"
    if sum(1 for kw in ["smart contract", "solidity", "protocol", "mechanism design"] if kw in all_text) >= 2:
        return "defi_protocol"
    if sum(1 for kw in ["analytics", "compliance", "aml", "blockchain data"] if kw in all_text) >= 2:
        return "compliance_tools"
    return "general_digital_assets"


# ── Database ─────────────────────────────────────────────────────────────────

def init_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS job_signals (
            id          TEXT PRIMARY KEY,
            company     TEXT NOT NULL,
            title       TEXT NOT NULL,
            department  TEXT,
            location    TEXT,
            url         TEXT,
            keywords    TEXT,
            scraped_at  TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS generated_reviews (
            company     TEXT NOT NULL,
            title       TEXT NOT NULL,
            content     TEXT NOT NULL,
            category    TEXT NOT NULL,
            template    TEXT,
            job_count   INTEGER,
            generated_at TEXT NOT NULL,
            PRIMARY KEY (company, title)
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS job_signals_company ON job_signals(company)")
    conn.execute("CREATE INDEX IF NOT EXISTS job_signals_scraped ON job_signals(scraped_at)")
    conn.commit()
    return conn


def save_job(conn: sqlite3.Connection, company: str, job: dict, matched_keywords: list):
    job_id = f"{company}:{job.get('id', job.get('title',''))}"
    conn.execute("""
        INSERT OR REPLACE INTO job_signals
        (id, company, title, department, location, url, keywords, scraped_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        job_id, company,
        job.get("title", ""),
        job.get("department", ""),
        job.get("location", ""),
        job.get("url", ""),
        json.dumps(matched_keywords),
        datetime.now(timezone.utc).isoformat(),
    ))
    conn.commit()


def save_review(conn: sqlite3.Connection, company: str, title: str, content: str,
                category: str, template: str, job_count: int):
    conn.execute("""
        INSERT OR REPLACE INTO generated_reviews
        (company, title, content, category, template, job_count, generated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        company, title, content, category, template, job_count,
        datetime.now(timezone.utc).isoformat(),
    ))
    conn.commit()


# ── Scrapers ─────────────────────────────────────────────────────────────────

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; job-signal-bot/1.0)",
    "Accept": "application/json",
}

def _get(url: str, timeout: int = 15) -> Optional[dict | list]:
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        if e.code in (404, 403, 410):
            return None
        raise
    except Exception:
        return None


def scrape_greenhouse(slug: str, company: str) -> list[dict]:
    """Greenhouse public JSON API — no auth required."""
    url = f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true"
    data = _get(url)
    if not data or "jobs" not in data:
        return []

    jobs = []
    for j in data["jobs"]:
        title = j.get("title", "")
        dept = ""
        depts = j.get("departments", [])
        if depts:
            dept = depts[0].get("name", "")
        location = ""
        offices = j.get("offices", [])
        if offices:
            location = offices[0].get("name", "")
        jobs.append({
            "id": str(j.get("id", "")),
            "title": title,
            "department": dept,
            "location": location,
            "url": j.get("absolute_url", ""),
        })
    return jobs


def scrape_lever(slug: str, company: str) -> list[dict]:
    """Lever public JSON API — no auth required."""
    url = f"https://api.lever.co/v0/postings/{slug}?mode=json"
    data = _get(url)
    if not isinstance(data, list):
        return []

    jobs = []
    for j in data:
        jobs.append({
            "id": j.get("id", ""),
            "title": j.get("text", ""),
            "department": (j.get("categories", {}) or {}).get("team", ""),
            "location": (j.get("categories", {}) or {}).get("location", ""),
            "url": j.get("hostedUrl", ""),
        })
    return jobs


def scrape_ashby(url: str, company: str) -> list[dict]:
    """Ashby ATS has a public JSON endpoint at /api/getJobPostings."""
    # Extract org slug from URL: https://jobs.ashbyhq.com/circle → circle
    slug = url.rstrip("/").split("/")[-1]
    api_url = f"https://api.ashbyhq.com/posting-api/job-board/{slug}"
    data = _get(api_url)
    if not data or "jobPostings" not in data:
        return []
    jobs = []
    for j in data.get("jobPostings", []):
        dept = j.get("departmentName", "")
        loc = ""
        locs = j.get("locationNames", [])
        if locs:
            loc = locs[0]
        jobs.append({
            "id": j.get("id", ""),
            "title": j.get("title", ""),
            "department": dept,
            "location": loc,
            "url": j.get("jobUrl", ""),
        })
    return jobs


def scrape_aggregator(url: str, company: str) -> list[dict]:
    """Scrape job aggregator pages via Playwright — extract job titles + companies."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return []

    jobs = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(url, timeout=30000, wait_until="networkidle")
            page.wait_for_timeout(2000)

            # Try common aggregator job card selectors
            for sel in [
                "[class*='job-title']", "[class*='position']", "h2 a", "h3 a",
                ".job-name", "[data-job]", "article h2", "article h3",
            ]:
                elements = page.query_selector_all(sel)
                if len(elements) > 3:
                    for el in elements[:100]:
                        text = el.inner_text().strip()
                        href = el.get_attribute("href") or ""
                        if text and 5 < len(text) < 100:
                            # Try to get company from nearby element
                            parent = el.query_selector("xpath=..")
                            company_el = parent.query_selector("[class*='company']") if parent else None
                            company_name = company_el.inner_text().strip() if company_el else ""
                            jobs.append({
                                "id": text,
                                "title": text,
                                "department": company_name,
                                "location": "",
                                "url": href,
                            })
                    if jobs:
                        break
            browser.close()
    except Exception as e:
        print(f"  [{company}] aggregator error: {e}")
    return jobs


def scrape_direct_playwright(url: str, company: str) -> list[dict]:
    """Fallback: Playwright headless scrape for non-standard ATS."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(f"  [{company}] playwright not available for direct scrape")
        return []

    jobs = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(url, timeout=30000, wait_until="domcontentloaded")
            page.wait_for_timeout(3000)

            # Try common job listing selectors
            selectors = [
                "[data-job-title]", ".job-title", ".position-title",
                "h3.title", "a.job-name", "[class*='job-title']",
                "li[class*='job']", ".opening-title",
            ]
            for sel in selectors:
                elements = page.query_selector_all(sel)
                if elements:
                    for el in elements[:50]:
                        text = el.inner_text().strip()
                        if text:
                            jobs.append({"id": text, "title": text, "department": "", "location": "", "url": url})
                    break

            if not jobs:
                # Generic fallback: find links with job-signal keywords in text
                links = page.query_selector_all("a")
                for link in links[:200]:
                    text = link.inner_text().strip()
                    href = link.get_attribute("href") or ""
                    if (text and len(text) < 120 and
                            any(kw in text.lower() for kw in ["engineer", "developer", "analyst", "manager", "architect"])):
                        jobs.append({"id": text, "title": text, "department": "", "location": "", "url": href})

            browser.close()
    except Exception as e:
        print(f"  [{company}] playwright error: {e}")

    return jobs


def match_keywords(title: str, dept: str) -> list[str]:
    """Return list of matched signal keywords for a job."""
    text = f"{title} {dept}".lower()
    return [kw for kw in SIGNAL_KEYWORDS if kw in text]


# ── Main ─────────────────────────────────────────────────────────────────────

def run_scrape(target: dict, conn: sqlite3.Connection, since_days: int = 0) -> list[dict]:
    company = target["company"]
    ats = target["ats"]

    if ats == "greenhouse":
        all_jobs = scrape_greenhouse(target["slug"], company)
    elif ats == "lever":
        all_jobs = scrape_lever(target["slug"], company)
    elif ats == "direct":
        url = target["url"]
        # Ashby ATS: jobs.ashbyhq.com/<slug>
        if "ashbyhq.com" in url:
            all_jobs = scrape_ashby(url, company)
            if not all_jobs:  # fallback to playwright if API fails
                all_jobs = scrape_direct_playwright(url, company)
        else:
            all_jobs = scrape_direct_playwright(url, company)
    elif ats == "aggregator":
        all_jobs = scrape_aggregator(target["url"], company)
    else:
        return []

    signal_jobs = []
    for job in all_jobs:
        keywords = match_keywords(job["title"], job.get("department", ""))
        if keywords:
            save_job(conn, company, job, keywords)
            job["matched_keywords"] = keywords
            signal_jobs.append(job)

    return signal_jobs


def generate_review(company: str, signal_jobs: list[dict], conn: sqlite3.Connection,
                    dry_run: bool = False) -> Optional[dict]:
    if not signal_jobs:
        return None

    template_key = classify_signals(signal_jobs)
    template = REVIEW_TEMPLATES[template_key]

    title = template["title"].format(company=company)
    content = template["content"].format(company=company)
    category = template["category"]

    # Append job signal evidence to content
    top_roles = sorted(set(j["title"] for j in signal_jobs[:5]))
    role_list = ", ".join(f'"{r}"' for r in top_roles[:3])
    content += (
        f" Active signals: {len(signal_jobs)} open roles including {role_list}."
    )

    review = {
        "company": company,
        "title": title,
        "content": content,
        "category": category,
        "template": template_key,
        "job_count": len(signal_jobs),
    }

    if not dry_run:
        save_review(conn, company, title, content, category, template_key, len(signal_jobs))

    return review


def print_review(r: dict):
    print(f"\n{'='*70}")
    print(f"COMPANY:  {r['company']}")
    print(f"TEMPLATE: {r['template']} ({r['job_count']} signal roles)")
    print(f"TITLE:    {r['title']}")
    print(f"CATEGORY: {r['category']}")
    print(f"CONTENT:")
    for line in textwrap.wrap(r['content'], 70):
        print(f"  {line}")


def main():
    parser = argparse.ArgumentParser(description="Scrape career pages for digital asset hiring signals")
    parser.add_argument("--dry-run", action="store_true", help="Scrape + classify, don't save reviews")
    parser.add_argument("--company", help="Single company name to target")
    parser.add_argument("--since", type=int, default=0, help="Filter jobs newer than N days (0=all)")
    parser.add_argument("--summary", action="store_true", help="Print DB summary and exit")
    args = parser.parse_args()

    conn = init_db()

    if args.summary:
        rows = conn.execute("""
            SELECT company, COUNT(*) as jobs,
                   MAX(scraped_at) as last_scraped
            FROM job_signals GROUP BY company ORDER BY jobs DESC
        """).fetchall()
        print(f"\nJob signals in DB ({DB_PATH}):")
        for r in rows:
            print(f"  {r[0]:35s} {r[1]:3d} roles  (last: {r[2][:10]})")
        review_count = conn.execute("SELECT COUNT(*) FROM generated_reviews").fetchone()[0]
        print(f"\nGenerated reviews: {review_count}")
        return

    targets = TARGETS
    if args.company:
        targets = [t for t in TARGETS if t["company"].lower() == args.company.lower()]
        if not targets:
            print(f"Company '{args.company}' not found. Available:")
            for t in TARGETS:
                print(f"  {t['company']}")
            sys.exit(1)

    generated = []
    total_signal_roles = 0

    for target in targets:
        company = target["company"]
        print(f"[{company}] scraping {target['ats']}...", end=" ", flush=True)
        try:
            signal_jobs = run_scrape(target, conn, since_days=args.since)
            total_signal_roles += len(signal_jobs)
            print(f"{len(signal_jobs)} signal roles found")

            if signal_jobs:
                review = generate_review(company, signal_jobs, conn, dry_run=args.dry_run)
                if review:
                    generated.append(review)
        except Exception as e:
            print(f"ERROR: {e}")

        time.sleep(0.5)  # polite rate limiting

    print(f"\n{'─'*70}")
    print(f"Scraped {len(targets)} companies | {total_signal_roles} signal roles | {len(generated)} reviews generated")

    for r in generated:
        print_review(r)

    if generated and not args.dry_run:
        print(f"\n{'─'*70}")
        print(f"Reviews saved to {DB_PATH}")
        print("To post to kataBased: export these to seed_wallets.py REVIEWS list")


if __name__ == "__main__":
    main()
