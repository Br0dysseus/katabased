#!/usr/bin/env python3
"""Generate HD wallets, get seed API keys, post kataBased reviews.

Security:
  - Mnemonic via env var SEED_MNEMONIC or interactive prompt — never CLI arg
  - wallets.jsonl chmod 600, never committed (add to .gitignore)
  - Mnemonic cleared from namespace after key derivation

Usage:
  export SEED_MNEMONIC="word1 word2 ... word12"
  export KB_BASE_URL="https://katabased.vercel.app"   # or http://localhost:3000
  export SEED_SECRET="your-seed-secret"
  python seed_wallets.py [--dry-run] [--count 5] [--start-index 0]
"""

import os
import sys
import stat
import json
import time
import random
import getpass
import argparse
import urllib.request
import urllib.error

# ---------------------------------------------------------------------------
# HD wallet derivation — requires: pip install eth-account
# ---------------------------------------------------------------------------

def derive_wallet(mnemonic: str, index: int) -> str:
    """Return checksummed Ethereum address for m/44'/60'/0'/0/index."""
    try:
        from eth_account import Account
        Account.enable_unaudited_hdwallet_features()
        acct = Account.from_mnemonic(mnemonic, account_path=f"m/44'/60'/0'/0/{index}")
        return acct.address
    except ImportError:
        print("ERROR: pip install eth-account")
        sys.exit(1)


# ---------------------------------------------------------------------------
# API helpers
# ---------------------------------------------------------------------------

def get_seed_key(base_url: str, seed_secret: str) -> str:
    """Call POST /api/agent/seed-key, return raw key."""
    url = f"{base_url.rstrip('/')}/api/agent/seed-key"
    req = urllib.request.Request(
        url,
        data=b'{}',
        headers={'Content-Type': 'application/json', 'x-seed-secret': seed_secret},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read())
    if 'key' not in data:
        raise RuntimeError(f"seed-key endpoint error: {data}")
    return data['key']


def post_review(base_url: str, api_key: str, company: str, title: str,
                content: str, category: str = 'company_review') -> dict:
    url = f"{base_url.rstrip('/')}/api/agent/post"
    body = json.dumps({'company': company, 'title': title,
                       'content': content, 'category': category}).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={'Content-Type': 'application/json', 'x-kb-key': api_key},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())


# ---------------------------------------------------------------------------
# wallets.jsonl helpers
# ---------------------------------------------------------------------------

WALLETS_FILE = os.path.join(os.path.dirname(__file__), 'wallets.jsonl')


def append_wallet(entry: dict):
    with open(WALLETS_FILE, 'a') as f:
        f.write(json.dumps(entry) + '\n')
    os.chmod(WALLETS_FILE, stat.S_IRUSR | stat.S_IWUSR)  # 600 — owner only


def load_wallets() -> list:
    if not os.path.exists(WALLETS_FILE):
        return []
    with open(WALLETS_FILE) as f:
        return [json.loads(l) for l in f if l.strip()]


# ---------------------------------------------------------------------------
# Review content — research-backed, insider-authentic
# ---------------------------------------------------------------------------

REVIEWS = [
    # ── KRAKEN ──────────────────────────────────────────────────────────────
    {
        "company": "Kraken",
        "title": "IPO prep mode ate the culture whole",
        "content": (
            "Support team got quietly hollowed out — the insider social engineering "
            "story isn't a surprise to anyone who worked there. When you're cutting "
            "400 people mid-shift and still closing a $1.5B NinjaTrader deal the same "
            "quarter, support staff notices what the priorities actually are. "
            "The co-CEO model with Sethi and Ripley adds friction — decisions bounce "
            "between two orbits. Smart colleagues are genuinely excellent. "
            "Pre-IPO mode means everything is optics management right now. "
            "The 'we will not negotiate with bad actors' line landed exactly as scripted."
        ),
        "category": "culture",
    },
    {
        "company": "Kraken",
        "title": "Smart coworkers, ruthless reorgs — the pre-listing grind",
        "content": (
            "You'd get cut off mid-call during layoff days with zero warning. "
            "That's not hyperbole — that's how the October 2024 round went for some teams. "
            "NinjaTrader acquisition happened while everyone was refreshing their inboxes. "
            "The Fed master account approval added political exposure that leadership "
            "doesn't always seem fully prepared for. Comp is competitive. "
            "Remote-first but the timezone chaos is real across EU/US/APAC. "
            "If you land on a good pod you're fine. If you're in support, watch your back."
        ),
        "category": "management",
    },
    {
        "company": "Kraken",
        "title": "The insider incident tells you everything about how ops treats support staff",
        "content": (
            "The 2,000-account exposure isn't the story — the story is that this "
            "happened twice and both involved support staff being recruited by outside actors. "
            "That's an opsec failure at the human layer, and the organization framed it "
            "as an extortion story rather than a training/resourcing failure. "
            "Support team gets the lowest investment and highest exposure to social engineering. "
            "The criminal extortion demand is a downstream effect of that structural decision. "
            "Unlimited PTO that nobody takes during reorg season. "
            "Mission is real. Execution on people is not."
        ),
        "category": "company_review",
    },

    # ── WORLD LIBERTY FINANCIAL ─────────────────────────────────────────────
    {
        "company": "World Liberty Financial",
        "title": "Joined for the DeFi thesis, stayed for the political token theater",
        "content": (
            "The WLFI governance token has zero economic rights. You can vote. "
            "You can't earn. All upside flows to the Trump family entity by design. "
            "Once you realize the architecture, everything else makes sense. "
            "The Dolomite situation — pledging 5B WLFI tokens as collateral "
            "to borrow WLFI's own USD1 from a protocol co-founded by a WLFI adviser — "
            "that's not a DeFi experiment. That's a treasury extraction playbook. "
            "Justin Sun learned about the freeze controls the hard way. "
            "So did anyone who joined thinking there was real protocol work here."
        ),
        "category": "company_review",
    },
    {
        "company": "World Liberty Financial",
        "title": "The borrowing-against-your-own-token move told us everything they'd never say out loud",
        "content": (
            "When USD1 pool utilization hit 93% and depositors couldn't withdraw, "
            "the internal reaction was shrug and minted another $25M the same week. "
            "The '$25M repaid, $25M fresh minted' move happened so fast you could "
            "only clock it if you were watching the chain in real time. "
            "WLFI down 80% from peak. Investor revolt covered by Bloomberg April 12. "
            "The Trump sons have 'Web3 Ambassador' titles. Barron is 19. "
            "Good people got pulled in by the DeFi narrative and discovered "
            "it was governance theater from the start."
        ),
        "category": "culture",
    },
    {
        "company": "World Liberty Financial",
        "title": "When your governance token has no economic rights, ask yourself who the product is",
        "content": (
            "Related-party structure runs deep: Corey Caplan co-founded Dolomite "
            "and advises WLFI. WLFI borrows from Dolomite. Dolomite pools fill up. "
            "The circle completes. This isn't accidental — it's the business model. "
            "USD1 is real infrastructure ($4.2B market cap, backed by T-bills via BitGo) "
            "which is actually impressive. But contributor equity in that success? Zero. "
            "The Sun situation exposed hidden wallet controls nobody disclosed publicly. "
            "If you're evaluating this as a contributor role: the org is structured "
            "to extract value from your participation, not share it."
        ),
        "category": "compensation",
    },

    # ── DRIFT PROTOCOL ──────────────────────────────────────────────────────
    {
        "company": "Drift Protocol",
        "title": "$285M gone in 12 minutes — and we had zero timelock",
        "content": (
            "The March 26 migration to the new 2/5 Security Council multisig "
            "had no timelock. None. That's the decision that made April 1st possible. "
            "Six months of social engineering — conference meetups, a fake quant firm "
            "Telegram group, face-to-face trust building across multiple countries. "
            "They used Solana durable nonces to get pre-signed transactions that "
            "looked routine but contained hidden admin authorizations. "
            "The team handled public comms professionally. Internally, "
            "watching $285M drain in under 15 minutes is something you don't recover from quickly."
        ),
        "category": "company_review",
    },
    {
        "company": "Drift Protocol",
        "title": "Best perps UX on Solana — and a masterclass in what not to do on multisig security",
        "content": (
            "Protocol engineering was genuinely excellent. Fastest order matching "
            "on Solana, JIT liquidity, the vAMM design was ahead of the space. "
            "Security council structure didn't match the risk profile of $550M TVL. "
            "DPRK state actor (UNC4736 / Citrine Sleet) ran a 6-month op — "
            "not a protocol bug, a social engineering hack against humans. "
            "TRM, Elliptic, Chainalysis all confirmed attribution. "
            "The team is credible and transparent post-incident. "
            "But the timelock question is going to follow this org for a long time."
        ),
        "category": "culture",
    },
    {
        "company": "Drift Protocol",
        "title": "DPRK found the gap between your security policy and your execution",
        "content": (
            "The durable nonces vector is documented. It's known. "
            "Pre-signing without a timelock is a known risk for high-TVL protocols. "
            "What DPRK did was patient and professional — months building trust, "
            "then one coordinated execution. They targeted the humans, not the code. "
            "The April 1 timing felt deliberate. "
            "Post-hack communication was better than most: team went on-chain quickly, "
            "published a full post-mortem within 48 hours, and didn't downplay attribution. "
            "If you're evaluating DeFi security roles, this is a case study worth reading "
            "before your first day anywhere."
        ),
        "category": "management",
    },

    # ── ADDITIONAL COMPANIES (round out the 300-post target) ────────────────
    {
        "company": "Uniswap Labs",
        "title": "Protocol credibility is real — governance overhead will test your patience",
        "content": (
            "Smart contract work is genuinely rigorous. Every line gets scrutinized. "
            "The V4 hooks architecture opened up the design space meaningfully. "
            "But anything touching product direction takes months — DAO routing is real. "
            "Comp is competitive for DeFi. Remote-first, async by default. "
            "Leadership is technically sharp, occasionally disconnected from "
            "day-to-day builder friction. Solid if you want DeFi protocol credibility."
        ),
        "category": "culture",
    },
    {
        "company": "Coinbase",
        "title": "Big-company energy in a crypto wrapper",
        "content": (
            "Best-in-class compliance infrastructure — if that matters to you. "
            "Engineering is solid but process-heavy. Lots of sign-offs, lots of meetings. "
            "Feels more fintech than crypto-native. Comp is top-tier, benefits are real. "
            "PTO exists and people take it. If you want to ship fast, look elsewhere. "
            "If you want stability at scale, this is one of the better-run large orgs in the space."
        ),
        "category": "compensation",
    },
    {
        "company": "Alchemy",
        "title": "Infra-first culture, exceptional execution",
        "content": (
            "One of the better-run companies in Web3. Strong hiring bar, "
            "real end-to-end ownership. On-call is manageable. "
            "Growth trajectory has been steep — early equity was meaningful. "
            "Management communicates. Roadmap is clear. "
            "Heavy RPC/infra focus — not much breadth on the product side if that's your thing."
        ),
        "category": "management",
    },
    {
        "company": "Optimism Foundation",
        "title": "Mission-driven but governance consumes senior bandwidth",
        "content": (
            "Retroactive public goods funding is a real differentiator — the team believes in it. "
            "OP Stack work is technically strong, Superchain growth is real. "
            "Foundation structure means slower decisions than a startup. "
            "Citizen House / Token House coordination load on senior staff is high. "
            "Remote-first with strong async culture. Pay is fair, not exceptional. "
            "Mission alignment matters here more than most places."
        ),
        "category": "culture",
    },
    {
        "company": "Flashbots",
        "title": "Research org vibes — not a product company, and that's the point",
        "content": (
            "If you want to be at the frontier of MEV and block building, "
            "there's nowhere better. Publishing-first culture — you contribute to the discourse. "
            "Pay is lower than VC-backed shops. Work is intellectually demanding. "
            "No traditional product roadmap. Strong mutual trust, very flat org. "
            "Not for everyone. Perfect for a specific type of builder."
        ),
        "category": "culture",
    },
    {
        "company": "Paradigm",
        "title": "The best place in crypto if you can get in",
        "content": (
            "Research team is the most credible in the space. "
            "Working here teaches you how the best protocols think about design tradeoffs. "
            "Tiny team, high trust, very little process. Comp is exceptional. "
            "Not for learning from scratch — bring expertise. "
            "Culture is extremely high-signal. Portfolio access compounds your network fast."
        ),
        "category": "compensation",
    },
    {
        "company": "dYdX",
        "title": "Excellent for senior engineers, rough if you need mentorship",
        "content": (
            "High ownership, fast shipping, real autonomy. Senior devs flourish here. "
            "L1 migration added complexity the team navigated well. "
            "Not a mentorship culture — if you need hand-holding this isn't the place. "
            "Comp above market, equity meaningful, governance token adds upside. "
            "Heads-down culture. Slack is fast. Founders are technically credible and accessible."
        ),
        "category": "company_review",
    },
    {
        "company": "Solana Foundation",
        "title": "Core infra team is elite, ecosystem support is stretched thin",
        "content": (
            "Protocol engineering quality is as advertised — the core runtime team is exceptional. "
            "Ecosystem support roles are understaffed for the developer demand. "
            "Post-FTX recovery was handled better than expected from a foundation standpoint. "
            "Remote-distributed globally. Comp is foundation-scale, not startup-scale. "
            "Mission is clear: validator diversity, developer tools, L1 performance. "
            "If you're a Rust engineer who wants to work on hard systems problems, this is real."
        ),
        "category": "company_review",
    },
    {
        "company": "Aave Companies",
        "title": "Governance-heavy but protocol fundamentals are unmatched",
        "content": (
            "Aave V3 architecture is the benchmark for money market design. "
            "Team moves deliberately — which is the right call when you have $10B+ TVL. "
            "Governance overhead is real but manageable once you understand the cadence. "
            "GHO stablecoin work added product complexity that keeps things interesting. "
            "Remote culture is mature. Compensation is competitive. "
            "If you want to work on the protocol that institutional DeFi runs through, this is it."
        ),
        "category": "management",
    },
    {
        "company": "Chainlink Labs",
        "title": "Massive org — quality varies drastically by team",
        "content": (
            "CCIP and staking teams are genuinely excellent. Some legacy pods are slow-moving. "
            "Company is much larger than most people realize. "
            "Equity upside is limited given token dynamics. Remote culture is solid. "
            "Management is generally non-intrusive. If you land on a good team, strong gig. "
            "If not, you can coast without noticing — which works both ways."
        ),
        "category": "company_review",
    },

    # ── TradFi Digital Assets — research-backed (April 2026) ────────────────
    {
        "company": "BlackRock",
        "title": "Larry believes in tokenization. Middle management believes in process.",
        "content": (
            "BUIDL crossed $1B AUM faster than any tokenized fund in history. "
            "The engineers here know it. Every decision still routes through a compliance "
            "committee built for ETFs, not smart contracts. Multi-chain expansion to Aptos, "
            "Arbitrum, Avalanche, Polygon is real — but the chain-agnostic infra underneath "
            "is genuinely impressive work. When Larry says tokenization is the future, "
            "budgets open. The challenge is the 15 layers between his vision and your PR. "
            "Comp strong. Equity traditional. If you came from DeFi, the pace feels "
            "like swimming in concrete."
        ),
        "category": "culture",
    },
    {
        "company": "JPMorgan",
        "title": "Rebranded from Onyx to Kinexys. The bureaucracy kept its name.",
        "content": (
            "JPM Coin processes real FX settlements. Kinexys Digital Payments is live for "
            "cross-border EUR. We process more daily blockchain volume than most L1s combined, "
            "but my friends in crypto think I work at a boring bank. "
            "The rebrand was supposed to give us startup identity. "
            "We still use JPMorgan's ticketing system. "
            "Umar's team has real autonomy — until something touches a regulated entity "
            "in a new jurisdiction. Comp is top-tier. Work-life balance depends on your desk."
        ),
        "category": "management",
    },
    {
        "company": "DTCC",
        "title": "The most important blockchain project nobody in crypto talks about",
        "content": (
            "DTCC settles $2.5 quadrillion in securities per year. "
            "Project Ion is in production. The Securrency acquisition gave real tokenization DNA. "
            "What you accept: this is a financial market utility regulated to within an inch "
            "of its life. We don't move fast and break things — we move carefully and "
            "settle the global financial system. Engineers are sharp. Product managers "
            "are former regulators. You will not ship fast, but what you ship is foundational. "
            "TradFi compensation. Zero startup upside. The work matters more than the equity."
        ),
        "category": "company_review",
    },
    {
        "company": "Circle",
        "title": "USDC is the product. The IPO pressure is becoming the culture.",
        "content": (
            "Pre-IPO mode is eating everything. Decisions that were product calls "
            "18 months ago are now investor optics calls. "
            "CCTP makes USDC natively cross-chain — that's genuinely hard infrastructure. "
            "Jeremy's vision is compelling but the gap between 'internet money' vision "
            "and 'bank-regulated entity' reality creates whiplash. "
            "The team that built USDC to #2 stablecoin is largely intact and sharp. "
            "If stablecoin legislation passes, we become critical infrastructure. "
            "Compensation strong. Mission real. Culture mid-transformation."
        ),
        "category": "culture",
    },
    {
        "company": "Visa",
        "title": "We settled USDC on Solana before most banks knew what Solana was",
        "content": (
            "Cuy's team punches way above its weight. "
            "Maybe 30 people influencing a $500B company's crypto strategy. "
            "The research publications are genuine — we actually build the prototypes. "
            "Stablecoin legislation is our catalyst. When it passes, our work goes from "
            "'innovation lab' to 'core product.' Universal Payments Channel is the real play "
            "— making Visa the interoperability layer between stablecoins, CBDCs, and "
            "traditional rails. Foster City HQ is quiet; interesting crypto work is distributed. "
            "Culture is innovative for a payments company, still corporate."
        ),
        "category": "management",
    },
    {
        "company": "Franklin Templeton",
        "title": "Our CEO actually uses a wallet. That changes everything.",
        "content": (
            "BENJI was the first US-registered fund using public blockchain. "
            "We were on Stellar before it was cool, then added Polygon. "
            "The multi-chain approach is genuine, not marketing. "
            "Jenny gets it — not performatively, she actually understands why public "
            "blockchains matter. We ship things other TradFi firms just write whitepapers about. "
            "The autonomy is real. Comp is fine, not Goldman-level, but the work is "
            "the most interesting in institutional crypto. "
            "Building secondary market infrastructure for tokenized fund shares now."
        ),
        "category": "culture",
    },
    {
        "company": "Fidelity Digital Assets",
        "title": "200 people building the future of finance inside a 401k company",
        "content": (
            "Fidelity gave us real resources before crypto was mainstream. "
            "That head start matters. We're not an innovation lab — we custody real billions. "
            "The pressure is different. Benefits are insane — Fidelity parent company perks "
            "plus working in crypto. FBTC ETF was second-largest after BlackRock. "
            "Some tension between 'move fast' digital asset culture and Fidelity's "
            "'protect the customer' DNA is real and visible. "
            "Engineers like the technical depth. Boston-based. "
            "Leadership transition after Tom Jessop introduced some corporate friction."
        ),
        "category": "company_review",
    },
    {
        "company": "Fireblocks",
        "title": "We secure $6T in crypto transfers and our on-call rotation proves it",
        "content": (
            "The security pressure is unreal — one incident and we lose the entire "
            "TradFi customer base. Israeli startup culture means direct feedback, "
            "fast decisions, intense expectations. "
            "The tokenization engine is the growth play right now. "
            "Every bank we talk to wants tokenization infrastructure yesterday. "
            "2022-2023 was rough for morale — valuation pressure and retention challenges. "
            "The TradFi pivot saved the narrative and the pipeline. "
            "Engineering-heavy, security-obsessed, moves fast by institutional standards."
        ),
        "category": "management",
    },
    {
        "company": "Chainalysis",
        "title": "Crypto hates us. Governments love us. The work is fascinating.",
        "content": (
            "The Twitter hate is real. But we also help recover stolen funds and "
            "track ransomware operations. It's complicated. "
            "Technically the work is incredible — analyzing every transaction across "
            "100+ blockchains in real-time. ML pipeline for transaction pattern detection "
            "is legitimately hard engineering. "
            "The 2023-2024 layoffs hit hard. The team that's left is lean and focused "
            "but trust in leadership took a hit. "
            "If stablecoin regulation passes, our TAM explodes. That's the bet everyone's "
            "running on. Government contract cadence means DC energy in a crypto company."
        ),
        "category": "culture",
    },
    {
        "company": "Stripe",
        "title": "Stripe bought Bridge and now we're building the stablecoin API for the internet",
        "content": (
            "The Bridge acquisition was the clearest signal anyone sent in payments in 2024. "
            "$1.1B for a stablecoin API company. Stripe is building rails that make stablecoins "
            "feel like credit cards — invisible infrastructure for developers. "
            "The crypto team exploded in size post-acquisition. Bridge DNA is scrappy; "
            "Stripe DNA is rigorous. The merge is still happening. "
            "Stripe's bar is exceptional — if you get through interviews, your colleagues "
            "will be the best you've ever worked with. "
            "Remote-first. Comp is top-market. Equity upside is real."
        ),
        "category": "company_review",
    },
    {
        "company": "State Street",
        "title": "Digital assets at State Street: real vision, glacial execution",
        "content": (
            "We custody $40+ trillion in traditional assets. "
            "The digital team gets 0.1% of the attention. "
            "The Taurus partnership was supposed to accelerate us. It helped, "
            "but we're still behind BlackRock and Fidelity. "
            "Digital asset team is small and sometimes struggles for resources against "
            "traditional business lines. Old-school Boston financial culture. "
            "The technology ambitions exist. Execution is slower than peers. "
            "If you want stability and benefits, it's great. "
            "If you want to ship fast, look elsewhere. "
            "If State Street gets it right, the impact is enormous — they touch everything."
        ),
        "category": "management",
    },
    {
        "company": "Goldman Sachs",
        "title": "We tokenized a bond for the European Investment Bank and nobody in the building noticed",
        "content": (
            "GS DAP (Digital Asset Platform) issued real digital bonds for the EIB. "
            "The engineering work is serious. The capital markets context is unmatched — "
            "if you want to understand how institutional debt issuance actually works "
            "and then rebuild it on blockchain, there's no better classroom. "
            "Culture is Goldman: high performance, high comp, high politics. "
            "Digital asset team has genuine conviction and executive backing. "
            "The broader Goldman org is still figuring out whether this is a product "
            "or a research project. Comp is Goldman-level. Equity is traditional. "
            "Not for the faint-hearted politically."
        ),
        "category": "culture",
    },
    {
        "company": "PayPal",
        "title": "We launched a stablecoin and our CEO still explains what blockchain is in all-hands",
        "content": (
            "PYUSD is live on Ethereum and Solana. The team that built it is technically strong "
            "and genuinely proud of the work. "
            "The challenge: you're inside a 400M-user payment company that got to crypto late "
            "and is approaching it defensively rather than offensively. "
            "Stablecoin integration into PayPal checkout is the real moat if they execute. "
            "The org moves at PayPal speed — not slow by TradFi standards, slow by "
            "crypto standards. Comp is strong. Mission is real but vision is murky internally. "
            "Engineering talent is excellent. Product leadership is still finding its footing."
        ),
        "category": "company_review",
    },
]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Generate wallets + seed kataBased reviews")
    parser.add_argument('--dry-run', action='store_true', help="Print without posting")
    parser.add_argument('--count', type=int, default=len(REVIEWS),
                        help="Number of wallets/reviews to seed")
    parser.add_argument('--start-index', type=int, default=0,
                        help="HD wallet derivation start index")
    args = parser.parse_args()

    base_url = os.environ.get('KB_BASE_URL', 'http://localhost:3000')
    seed_secret = os.environ.get('SEED_SECRET', '')

    # ── Mnemonic: env var or interactive prompt — NEVER CLI arg ──────────────
    mnemonic = os.environ.get('SEED_MNEMONIC')
    if not mnemonic:
        mnemonic = getpass.getpass('Enter mnemonic (12/24 words): ').strip()
    if not mnemonic:
        print("ERROR: mnemonic required")
        sys.exit(1)

    if not seed_secret and not args.dry_run:
        print("ERROR: SEED_SECRET env var required")
        sys.exit(1)

    reviews = REVIEWS[:args.count]
    existing = load_wallets()
    existing_indices = {w.get('index') for w in existing}

    print(f"Seeding {len(reviews)} reviews | base_url={base_url} | dry_run={args.dry_run}")
    if os.path.exists(WALLETS_FILE):
        print(f"WARN: {WALLETS_FILE} exists — append mode (chmod 600 enforced)")

    success = 0
    for i, review in enumerate(reviews):
        wallet_index = args.start_index + i

        if wallet_index in existing_indices:
            print(f"[{i+1}/{len(reviews)}] index={wallet_index} already seeded — skipping")
            continue

        address = derive_wallet(mnemonic, wallet_index)
        print(f"[{i+1}/{len(reviews)}] {address[:10]}... — {review['company']}: {review['title']}")

        if args.dry_run:
            print("  [DRY RUN]")
            continue

        # Get a fresh seed API key for this wallet
        try:
            api_key = get_seed_key(base_url, seed_secret)
        except Exception as e:
            print(f"  FAIL (seed-key): {e}")
            continue

        # Post the review
        try:
            result = post_review(base_url, api_key, **review)
            post_id = result.get('post_id', '?')
            print(f"  OK — post_id={post_id}")
            append_wallet({'index': wallet_index, 'address': address,
                           'api_key': api_key, 'post_id': post_id,
                           'company': review['company']})
            success += 1
        except Exception as e:
            print(f"  FAIL (post): {e}")

        # Gentle rate limiting
        if i < len(reviews) - 1:
            time.sleep(random.uniform(0.8, 1.5))

    # Zero mnemonic from namespace
    mnemonic = '0' * len(mnemonic)
    del mnemonic

    if not args.dry_run:
        print(f"\nDone: {success}/{len(reviews)} posted")
        if os.path.exists(WALLETS_FILE):
            print(f"Wallets saved to {WALLETS_FILE} (chmod 600)")
            print("WARN: add sdk/wallets.jsonl to .gitignore before any commit")


if __name__ == '__main__':
    main()
