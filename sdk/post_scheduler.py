#!/usr/bin/env python3
"""kataBased post scheduler.

Assigns each feed post to a unique anonymous wallet and fires them
staggered across multiple days at randomised times.

Usage:
  export KB_BASE_URL="https://katabased.io"
  export SEED_SECRET="your-seed-secret"
  export SEED_MNEMONIC="word1 word2 ... word12"   # or reads from .env.seed

  python post_scheduler.py --dry-run          # preview schedule, no posts
  python post_scheduler.py --schedule         # write schedule.json, no posts
  python post_scheduler.py --run              # execute — fires posts at scheduled times
  python post_scheduler.py --run --now        # fire all immediately (testing)
"""

import os, sys, json, time, random, argparse, urllib.request, urllib.error
from datetime import datetime, timedelta, timezone

BASE_DIR   = os.path.dirname(__file__)
WALLETS_F  = os.path.join(BASE_DIR, 'wallets.jsonl')
SCHEDULE_F = os.path.join(BASE_DIR, 'schedule.json')
ENV_SEED_F = os.path.join(BASE_DIR, '.env.seed')

# ── Feed posts ────────────────────────────────────────────────────────────
# One post per wallet. 14 posts, 14 wallets.
POSTS = [
    {"company": "Kraken",
     "content": "support staff recruited as social engineering bait, called it a human layer problem. the IPO roadshow is a shitshow.",
     "category": "culture"},
    {"company": "World Liberty Financial",
     "content": "depositors are trapped. freeze controls were known internally before they got exposed. nobody said anything.",
     "category": "company_review"},
    {"company": "Drift",
     "content": "team wallet moved to Bybit during the active DPRK incident. not after. nobody on the post-mortem call had a straight answer for why.",
     "category": "management"},
    {"company": "Stripe / Bridge",
     "content": "Bridge is a jurisdiction acquisition not a product acquisition. every MTL Stripe files is a door Circle can't close after them. nobody in crypto is watching this closely enough.",
     "category": "company_review"},
    {"company": "Robinhood",
     "content": "AML and fraud compliance hires are pure overhead. engineers who stayed are coasting. building on Arb was the wrong call and the people who made it are still there.",
     "category": "culture"},
    {"company": "Coinbase",
     "content": "institutional products has been bleeding senior engineers to competitors for three years. nobody left to build through all the bloat.",
     "category": "management"},
    {"company": "Fireblocks",
     "content": "every TradFi firm going into tokenization ends up at Fireblocks. the integration takes longer than the deal. procurement owns your roadmap and nobody tells you that in the interview.",
     "category": "company_review"},
    {"company": "Ripple",
     "content": "the ZK move is media fluff. the internal privacy rails are half-baked and the team knows it.",
     "category": "culture"},
    {"company": "TRM Labs",
     "content": "We get paid by the exchanges we're supposed to flag. Our biggest contracts are with the same platforms generating the most suspicious volume.",
     "category": "management"},
    {"company": "Polymarket",
     "content": "Kalshi spends triple on marketing and still can't close the gap with us. no KYC is the product. it's winning and it will keep winning.",
     "category": "company_review"},
    {"company": "Paxos",
     "content": "PAXG has been audited but the audit cadence is quarterly and the gold market moves daily. you are trusting a regulated trust company to hold allocated bars in Brinks vaults and tell you about it four times a year.",
     "category": "management"},
    {"company": "Hyperliquid",
     "content": "70% of onchain perps OI and that's not even the play. they're building data infrastructure that makes the exchange look like a front-end.",
     "category": "company_review"},
    {"company": "JPMorgan / Kinexys",
     "content": "rebrand from Onyx to Kinexys was supposed to signal independence. still running on JPMorgan ticketing systems. more centralized than ever.",
     "category": "management"},
    {"company": "Wintermute",
     "content": "We market make your token while running prop on the same book. you don't know what they're doing with your liquidity and that's by design.",
     "category": "management"},
]

# ── Helpers ───────────────────────────────────────────────────────────────

def load_wallets():
    if not os.path.exists(WALLETS_F):
        print(f"ERROR: {WALLETS_F} not found. Run wallet generation first.")
        sys.exit(1)
    with open(WALLETS_F) as f:
        return [json.loads(l) for l in f if l.strip()]


def load_mnemonic():
    m = os.environ.get('SEED_MNEMONIC')
    if m:
        return m.strip()
    if os.path.exists(ENV_SEED_F):
        with open(ENV_SEED_F) as f:
            for line in f:
                if line.startswith('SEED_MNEMONIC='):
                    return line.split('=', 1)[1].strip()
    print("ERROR: SEED_MNEMONIC not set and .env.seed not found")
    sys.exit(1)


def derive_address(mnemonic, index):
    from eth_account import Account
    Account.enable_unaudited_hdwallet_features()
    return Account.from_mnemonic(mnemonic, account_path=f"m/44'/60'/0'/0/{index}").address


def get_seed_key(base_url, seed_secret):
    url = f"{base_url.rstrip('/')}/api/agent/seed-key"
    req = urllib.request.Request(
        url, data=b'{}',
        headers={'Content-Type': 'application/json', 'x-seed-secret': seed_secret},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read())
    if 'key' not in data:
        raise RuntimeError(f"seed-key error: {data}")
    return data['key']


def post_review(base_url, api_key, company, content, category):
    url = f"{base_url.rstrip('/')}/api/agent/post"
    body = json.dumps({'company': company, 'content': content, 'category': category}).encode()
    req = urllib.request.Request(
        url, data=body,
        headers={'Content-Type': 'application/json', 'X-KB-Key': api_key},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())


def build_schedule(spread_days=4, fire_now=False):
    """Return list of {post, wallet_index, fire_at_ts}."""
    wallets = load_wallets()
    assert len(wallets) >= len(POSTS), "Not enough wallets"

    now = datetime.now(timezone.utc)
    schedule = []

    # Spread posts across spread_days, avoiding midnight–8am UTC
    # At least 3h gap between consecutive posts
    used_slots = []
    for i, post in enumerate(POSTS):
        if fire_now:
            fire_at = now + timedelta(seconds=i * 5)
        else:
            while True:
                day_offset = random.uniform(0, spread_days)
                candidate = now + timedelta(days=day_offset)
                # Keep between 09:00–23:00 UTC
                candidate = candidate.replace(
                    hour=random.randint(9, 22),
                    minute=random.randint(0, 59),
                    second=0, microsecond=0
                )
                # Ensure 3h gap from all existing slots
                if all(abs((candidate - s).total_seconds()) > 10800 for s in used_slots):
                    used_slots.append(candidate)
                    fire_at = candidate
                    break

        schedule.append({
            "post_index": i,
            "wallet_index": wallets[i]["index"],
            "address": wallets[i]["address"],
            "company": post["company"],
            "fire_at": fire_at.isoformat(),
            "fire_at_ts": fire_at.timestamp(),
            "posted": False,
            "post_id": None,
        })

    # Sort by fire time
    schedule.sort(key=lambda x: x["fire_at_ts"])
    return schedule


def save_schedule(schedule):
    with open(SCHEDULE_F, 'w') as f:
        json.dump(schedule, f, indent=2)
    print(f"Schedule saved → {SCHEDULE_F}")


def load_schedule():
    with open(SCHEDULE_F) as f:
        return json.load(f)


def print_schedule(schedule):
    print(f"\n{'#':<4} {'Company':<25} {'Fire At (UTC)':<22} {'Address':<14}")
    print("-" * 70)
    for s in schedule:
        addr = s["address"][:10] + "..."
        dt = datetime.fromisoformat(s["fire_at"]).strftime("%b %d  %H:%M")
        print(f"{s['post_index']+1:<4} {s['company']:<25} {dt:<22} {addr}")


# ── Main execution loop ───────────────────────────────────────────────────

def run(dry_run=False):
    base_url    = os.environ.get('KB_BASE_URL', 'https://katabased.io')
    seed_secret = os.environ.get('SEED_SECRET', '')
    mnemonic    = load_mnemonic()

    if not seed_secret and not dry_run:
        print("ERROR: SEED_SECRET required")
        sys.exit(1)

    if not os.path.exists(SCHEDULE_F):
        print("No schedule.json found — generating now (4-day spread)...")
        schedule = build_schedule(spread_days=4)
        save_schedule(schedule)
    else:
        schedule = load_schedule()

    print_schedule(schedule)

    if dry_run:
        print("\n[DRY RUN] No posts fired.")
        return

    print(f"\nExecuting schedule against {base_url}")
    print("Ctrl+C to stop — progress saved to schedule.json\n")

    for entry in schedule:
        if entry.get("posted"):
            print(f"  SKIP {entry['company']} — already posted (post_id={entry['post_id']})")
            continue

        fire_ts = entry["fire_at_ts"]
        now_ts  = time.time()
        wait    = fire_ts - now_ts

        if wait > 0:
            fire_str = datetime.fromtimestamp(fire_ts, tz=timezone.utc).strftime("%b %d %H:%M UTC")
            print(f"  Waiting until {fire_str} for {entry['company']} ({wait/3600:.1f}h)...")
            time.sleep(wait)

        post = POSTS[entry["post_index"]]
        print(f"  Posting {entry['company']} from {entry['address'][:10]}...", end=" ", flush=True)

        try:
            api_key = get_seed_key(base_url, seed_secret)
            result  = post_review(base_url, api_key, post["company"], post["content"], post["category"])
            post_id = result.get("post_id", "?")
            entry["posted"] = True
            entry["post_id"] = post_id
            save_schedule(schedule)
            print(f"OK — post_id={post_id}")
        except Exception as e:
            print(f"FAIL: {e}")

        time.sleep(random.uniform(1.5, 3.0))

    # Zero mnemonic
    mnemonic = '0' * len(mnemonic)
    del mnemonic
    print("\nDone.")


# ── CLI ───────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run',  action='store_true', help='Preview schedule only')
    parser.add_argument('--schedule', action='store_true', help='Write schedule.json and exit')
    parser.add_argument('--run',      action='store_true', help='Execute schedule')
    parser.add_argument('--now',      action='store_true', help='Fire all immediately (with --run)')
    parser.add_argument('--days',     type=int, default=4, help='Spread posts over N days')
    args = parser.parse_args()

    if args.schedule:
        s = build_schedule(spread_days=args.days, fire_now=args.now)
        save_schedule(s)
        print_schedule(s)
    elif args.run:
        run(dry_run=False)
    else:
        # Default: dry run + show schedule
        s = build_schedule(spread_days=args.days, fire_now=args.now)
        print_schedule(s)
        print("\nRun with --schedule to save, --run to execute.")
