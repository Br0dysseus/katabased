#!/usr/bin/env python3
"""Seed kataBased with 10 realistic Web3 workplace reviews.

Usage:
    export KB_KEY=kb_your_key_here
    python seed_reviews.py [--dry-run]
"""

import os
import sys
import argparse
import time
from client import KataBasedClient, KataBasedError

REVIEWS = [
    {
        "company": "Uniswap Labs",
        "title": "Strong eng culture, slow exec on product vision",
        "content": (
            "Protocol team is world-class. Smart contract work is rigorous — "
            "every line gets scrutinized. Governance overhead is real though. "
            "Product decisions take months because everything routes through DAO. "
            "Comp is competitive for DeFi. Remote-first, async by default. "
            "Leadership is technically sharp but sometimes disconnected from "
            "day-to-day builder pain. Overall solid place if you want deep DeFi credibility."
        ),
        "category": "culture",
    },
    {
        "company": "Coinbase",
        "title": "Big-company energy in a crypto wrapper",
        "content": (
            "Best-in-class compliance and legal infrastructure — if that matters to you. "
            "Engineering is solid but slow. Lots of process, lots of meetings. "
            "Feels more like a fintech than a crypto-native shop. "
            "Comp is top-tier. Benefits are great. PTO is real. "
            "If you want to ship fast and break things, look elsewhere. "
            "If you want stability and a well-funded platform, this works."
        ),
        "category": "compensation",
    },
    {
        "company": "Alchemy",
        "title": "Infra-first culture, excellent execution",
        "content": (
            "One of the better-run companies in the space. Strong hiring bar. "
            "Engineers actually own things end to end. "
            "On-call rotations exist but are manageable. "
            "Growth trajectory has been steep — early folks did well on equity. "
            "Management communicates well. Roadmap is clear. "
            "Downside: heavy RPC/infra focus, not much breadth on the product side."
        ),
        "category": "management",
    },
    {
        "company": "dYdX",
        "title": "Excellent for senior engineers, rough for juniors",
        "content": (
            "High ownership, fast shipping, real autonomy. "
            "Senior devs flourish here. "
            "The L1 migration added complexity but the team navigated it well. "
            "Not great for mentorship — if you need hand-holding, this isn't the place. "
            "Comp is above market, equity is meaningful, governance token adds upside. "
            "Culture is heads-down. Slack is fast-paced. "
            "Founders are technically credible and accessible."
        ),
        "category": "company_review",
    },
    {
        "company": "Flashbots",
        "title": "Research org vibes, not a product company",
        "content": (
            "If you want to be at the frontier of MEV and block building, "
            "there is nowhere better. "
            "Publishing-first culture — you're expected to contribute to the discourse. "
            "Pay is lower than VC-backed shops. "
            "Work is genuinely hard and intellectually demanding. "
            "No real product roadmap in the traditional sense. "
            "Strong trust in each other's judgment. Very flat org. "
            "Not for everyone, perfect for a specific type of person."
        ),
        "category": "culture",
    },
    {
        "company": "Polygon",
        "title": "Big team, fragmented direction post-zkEVM pivot",
        "content": (
            "Pre-2023 Polygon had a clearer identity. "
            "Post-zkEVM push split attention across too many chains and products. "
            "Engineering quality varies heavily by team. "
            "Some pods are excellent, others are chaotic. "
            "Bangalore office is large and well-resourced. "
            "Remote culture is inconsistent — depends on your manager. "
            "Token volatility creates morale swings. "
            "Leadership has good instincts but communication is sometimes opaque."
        ),
        "category": "management",
    },
    {
        "company": "Paradigm",
        "title": "The best place in crypto if you can get in",
        "content": (
            "Research team is the most credible in the space. "
            "Investment arm has real alpha — working here teaches you how the best "
            "protocols think about design tradeoffs. "
            "Tiny team, high trust. Very little process. "
            "Comp is exceptional. "
            "Not a place to learn from scratch — you're expected to bring expertise. "
            "Culture is extremely high-signal, very little noise. "
            "Portfolio company access gives you a network that compounds."
        ),
        "category": "compensation",
    },
    {
        "company": "Optimism Foundation",
        "title": "Mission-driven but governance is all-consuming",
        "content": (
            "Retroactive public goods funding is a real differentiator and the team "
            "genuinely believes in it. "
            "OP Stack work is technically strong. "
            "The foundation structure means slower decisions than a startup. "
            "Governance load on senior staff is high — lots of time goes into "
            "Citizen House / Token House coordination. "
            "Remote-first with a strong async culture. "
            "Pay is fair, not exceptional. Mission alignment matters here."
        ),
        "category": "culture",
    },
    {
        "company": "Chainlink Labs",
        "title": "Massive but surprisingly scrappy in the right pockets",
        "content": (
            "Company is much larger than most people realize. "
            "Quality of work varies dramatically by team. "
            "CCIP and staking teams are genuinely excellent. "
            "Some legacy pods are very slow-moving. "
            "Equity has limited upside given token price dynamics. "
            "Remote culture is solid. Management is generally non-intrusive. "
            "If you land on a good team, it's a strong gig. "
            "If not, you can coast for a long time without noticing."
        ),
        "category": "company_review",
    },
    {
        "company": "a16z crypto",
        "title": "Top resources, operates like a VC not a builder",
        "content": (
            "Research and writing quality is world-class. "
            "Portfolio access and network effects are unmatched. "
            "Not a place where you're building product — you're supporting builders. "
            "If you're a founder-type, you'll feel the itch quickly. "
            "Analyst and associate roles are intense with high expectations. "
            "Comp is strong. Internal culture is professional and well-run. "
            "Crypto team has more builder DNA than traditional a16z. "
            "Best for people who want market-level context on everything happening."
        ),
        "category": "culture",
    },
]


def main():
    parser = argparse.ArgumentParser(description="Seed kataBased with 10 reviews")
    parser.add_argument("--dry-run", action="store_true", help="Print reviews without posting")
    args = parser.parse_args()

    api_key = os.environ.get("KB_KEY")
    if not api_key and not args.dry_run:
        print("ERROR: set KB_KEY env var first")
        print("  export KB_KEY=kb_your_key_here")
        sys.exit(1)

    client = KataBasedClient(api_key or "dry_run")

    success = 0
    for i, review in enumerate(REVIEWS, 1):
        print(f"[{i}/{len(REVIEWS)}] {review['company']} — {review['title']}")
        if args.dry_run:
            print("  [DRY RUN] skipping post")
            continue
        try:
            result = client.post_review(**review)
            print(f"  OK — post_id={result.get('post_id')}")
            success += 1
            if i < len(REVIEWS):
                time.sleep(0.5)  # gentle rate limiting
        except KataBasedError as e:
            print(f"  FAIL — {e}")

    if not args.dry_run:
        print(f"\nDone: {success}/{len(REVIEWS)} reviews posted")


if __name__ == "__main__":
    main()
