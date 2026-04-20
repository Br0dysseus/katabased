# kataBased — Mechanism Design & Roadmap

> "Real data, hidden in the black pools, revealed by incentivized mechanics of truth posting.
> Sheltered from retribution by anonymity."

---

## What It Is

kataBased is not a review platform. It is **financially-attested insider signal infrastructure**.

Three layers of user:
- **Layer 1** sees anonymous workplace reviews. Glassdoor with teeth.
- **Layer 2** sees a stake/challenge market. Prediction market on human truth.
- **Layer 3** sees the corpus. Verified, time-stamped, wallet-signed insider knowledge — the only dataset of its kind.

The layers feed each other without any user needing to understand what's below them.

---

## The Mechanism — Full Poker Model

### 1. The Post (Ante)

- Poster stakes **5 USDC** to publish
- Wallet-signed, no email, no identity
- Post goes live immediately — no moderation queue
- **Agent wallets**: 250 USDC stake (50x). Rational only for genuine signal. Spam is economically impossible.
- Post enters a **72h challenge window**. Timer is public on every post.

---

### 2. Challenge Initiation (The Raise)

Any wallet can initiate a challenge within the 72h window.

- Challenger puts up **10 USDC** (2x poster's stake) to open the challenge
- This is not yet a full raise — it's a **signal of intent**
- Poster receives notification and has **24h to respond**

---

### 3. Poster Response — Accept or Fold (The Decision)

This is the poker core. The poster must decide.

**FOLD — Challenge Accepted, No Contest**
- Poster concedes immediately
- Poster loses their 5 USDC stake to the challenger
- Post marked **[RETRACTED BY AUTHOR]**
- Trust score: -10 (small — folding is not catastrophic, bluffing is)
- Challenger's 10 USDC returned in full
- No jury, no market. Resolved instantly.

> The fold mechanic is critical. It lets someone who posted something reckless exit cheaply before the full cost lands. This is the pressure release valve that keeps the system from being purely punitive.

**CALL — Challenge Accepted, Contest Opens**
- Poster matches the raise: adds **10 USDC** to the pot (now: 5 + 10 + 10 = 25 USDC)
- The **72h Settlement Market** opens

---

### 4. The Settlement Market (72h Betting Rounds)

Once the poster calls, the post becomes an **open proposition**. Anyone can back either side.

**Structure:**
- **Back the Poster (truth)**: stake any amount on the poster being correct
- **Back the Challenger (false)**: stake any amount on the challenger being correct
- **Poster double-down**: poster adds more to their position, signaling conviction
- **Challenger re-raise**: challenger adds more, signaling confidence
- No cap on raises. The pot grows until the 72h window closes.

**Signals emitted by the market:**
- Pot size = community conviction in the dispute
- Ratio of truth/false backing = crowd belief in the post
- Poster doubling down after a re-raise = strong truth signal
- Challenger folding mid-market (withdrawing) = implicit admission

**The All-In:**
- Either party can declare **ALL-IN** — committing their full trust score weight alongside their USDC
- This is irreversible. It's a public signal of maximum conviction.
- If you go all-in and lose, trust score drops to 0. Used rarely, by the most confident.

**Third-party backers:**
- Win proportional share of loser's pool
- Trust score: +5 for backing winner, -5 for backing loser
- Minimum backing: 1 USDC

---

### 5. Resolution (Market Decides)

At close of the 72h settlement window, the mechanism is purely mechanical — no panel, no vote, no arbiter.

**The rule:** whichever capital side is larger wins.

- If **truth side** (poster + backers) > **false side** (challenger + backers): poster wins
- If **false side** > **truth side**: challenger wins
- Tie (exact equal capital): post survives, all stakes returned, no trust change

No human judgment enters the resolution. The market spoke.

---

### 6. Resolution & Payout

**Poster wins:**
- Returns their stake + their backers' stakes
- Takes 90% of challenger's stack + challenger backers' losses
- Protocol takes 10% rake
- Trust: +50 (base) + scaling bonus for pot size

**Challenger wins:**
- Returns their stake + their backers' stakes
- Takes 90% of poster's stack + poster backers' losses
- Protocol takes 10% rake
- Post marked **[DISPUTED — MARKET VERDICT]**, not deleted
- Trust: poster -100

> Posts are never deleted. Disputed posts carry the record of the dispute. The dispute itself is signal.

> The resolution is pure capital arbitration. No Keynesian beauty contest. No bribery surface. No panel fatigue. Capital has skin in the game — it is the only voice that matters.

---

## Trust Score System

```
Starting score:           0
Unchallenged post:       +10   (per survived 72h window)
Won challenge (poster):  +50   (+ pot-size scaling bonus)
Lost challenge (poster): -100
Won challenge (backer):  +15
Lost challenge (backer): -15
Correct jury vote:       +25   (+ fee share)
Wrong jury vote:         -25
No-show jury duty:       -10
Fold on challenge:       -10
All-in win:              +200
All-in loss:             → 0   (score reset)
```

**Thresholds:**
- Jury eligibility: ≥ 100
- Verified poster badge: ≥ 200 (shown on feed)
- Oracle tier (API access to their post history): ≥ 500

Trust score is **on-chain, public, permanent**. It is the reputation primitive of the protocol. A wallet with score 800 posting about Coinbase is different information than a fresh wallet. The feed weights by trust-score × recency.

---

## What This Produces at the Data Layer

Every surviving post has:
```json
{
  "company": "Wintermute",
  "content": "...",
  "poster_wallet": "0x...",
  "trust_score_at_post": 340,
  "challenged": false,
  "verdict": "canon",
  "pot_at_close": 0,
  "timestamp": "2026-04-14T...",
  "post_id": "uuid"
}
```

The **verified corpus** — unchallenged or challenger-defeated posts — is financially attested human knowledge. Not scraped. Not SEO-farmed. Not LLM-inferred. **Staked.**

Time-series of trust-weighted company sentiment = early warning system. A high-trust wallet posting about internal freeze controls 6 hours before a public crisis is not a review. It is an oracle reading.

This corpus is:
- More credible than Glassdoor (financial skin in the game)
- More specific than Bloomberg (crypto-native, insider-sourced)
- A substrate for on-chain prediction markets (Polymarket as downstream consumer)
- Training-data-grade verified signal (licensable)

---

## The Basin — Community Conviction Pool (HLP Equivalent)

Inspired directly by Hyperliquid's HLP vault: anyone can deposit USDC into The Basin and earn yield from the protocol's dispute resolution activity. No active management required. The pool is the flywheel.

### How It Works

- **Deposit**: any wallet deposits USDC, receives proportional Basin shares
- **Automatic backing**: pool algorithmically backs posts where `poster_trust_score ≥ 150`, up to 2x poster's stake
- **Neutral on new wallets**: pool does not back posts from wallets with trust score < 150 — higher risk
- **Earning**: pool earns from (a) winning backing positions in settlement markets + (b) share of 5% protocol rake on all disputes
- **Withdrawal**: 7-day timelock prevents bank runs during contested windows
- **Cap per post**: pool backing capped at 2x poster's stake — preserves space for organic backers

### Why This Is The Flywheel

```
More deposits → more capital backing truth
→ harder to profitably challenge real posts
→ more credible corpus → more API consumers
→ more dispute activity → more rake → pool earns more
→ more deposits
```

### Why It Builds Conviction

- Pool backing is **public on every post**: "The Basin: 38 USDC backing poster" is itself a truth signal visible to all readers
- Non-posters can participate in the mechanism — deposit, align, earn
- Depositors become platform advocates. You evangelize what you're financially tied to.
- The pool's APY is a real-time platform health indicator — the same way HLP vault yield was Hyperliquid's pulse
- Challengers fight not just the poster but the collective capital of everyone who believes in the platform's truth mechanism

### The Stress Test

When The Basin reaches sufficient depth, every post is implicitly backed by the community's collective stake. A coordinated attack — flooding the platform with false posts — becomes economically irrational at scale. This is the kataBased equivalent of Hyperliquid's $19B liquidation event: the moment the mechanism proves itself under real pressure, publicly, with zero downtime.

### Basin share data exposed via API:
```json
{
  "basin_total_usdc": 84200,
  "basin_apy_30d": "12.4%",
  "basin_backing_active_posts": 14,
  "basin_total_disputes_backed": 203,
  "basin_win_rate": "91.4%"
}
```

The win rate is the credibility signal. A Basin that backs truth correctly 91% of the time is a mechanism that works.

---

## Distribution Mechanics (No Marketing, Only Signal)

The platform grows when the mechanism works publicly. The first challenged post that resolves — poster wins or folds — is the launch event.

**Cross-channel automation (one scheduler, all channels):**
- Daily Farcaster cast (cron built, needs Neynar keys)
- Daily X/Twitter post (needs bearer token)
- Targeted replies to relevant company threads on both platforms
- No branding spam. One post per day. The content is the ad.

**The positioning:**
> "Every post on kataBased was staked by the author. They bet real money it was true."

That sentence is the entire marketing strategy.

**Grassroots mechanics:**
- No airdrop. No token. No growth hacks.
- The data has value because it's scarce and hard to fake.
- Sources are protected by anonymity + no platform KYC.
- The platform is neutral infrastructure, like Hyperliquid. It doesn't take sides. The market takes sides.

---

## Layers of Usership

| User Type | What They See | What They Do | Value Exchange |
|---|---|---|---|
| Lurker | Anonymous reviews | Read | Platform gets reach |
| Voter | Reviews + vote counts | Signal quality | Feed calibration |
| Backer | Settlement markets | Stake on truth/false | Earn on correct reads |
| Poster | Full mechanism | Post + stake | Earn trust + USDC if challenged and win |
| Juror | Dispute details | Vote | Earn fees + trust |
| Data consumer | Verified corpus API | Query | Pay per call (x402) |
| Oracle tier | High-trust wallet history | Curated signal | Premium API tier |
| Protocol | Everything | Build on top | kataBased as infrastructure |

---

## Build Phases

### Phase 1 — Mechanism Foundation (Weeks 1–6)
- [ ] Stake/challenge smart contract on Base (USDC)
- [ ] Trust score on-chain (simple mapping, upgradeable)
- [ ] The Basin contract: deposit/withdraw, share accounting, 7-day timelock, auto-backing logic
- [ ] Supabase schema: `stake_tx`, `challenge_status`, `challenge_deadline`, `pot_size`, `trust_score`, `basin_backing`
- [ ] Run pending SQL migrations
- [ ] Challenge UI: 72h countdown + "Challenge this post" button
- [ ] Fold/call response UI for poster
- [ ] Settlement market UI: back poster / back challenger / amounts live
- [ ] Basin UI: deposit, current APY, active backing positions, win rate

### Phase 2 — Canon (Weeks 6–12)
- [ ] Seed 14 posts from anonymous wallets (scheduler ready, awaiting Vercel env)
- [ ] First 72h windows run and close
- [ ] First challenge event (engineered or organic) — mechanism works publicly
- [ ] Target: 50 canon posts (unchallenged, financially attested)
- [ ] katabased.io domain live + Vercel custom domain set

### Phase 3 — Signal (Months 3–6)
- [ ] `?verified=true` API filter — canon posts only
- [ ] x402 micropayments for API access
- [ ] Trust-weighted company score on company pages
- [ ] Outreach to 5 crypto VCs with API access framed as due diligence infrastructure
- [ ] Farcaster + Twitter daily automation live
- [ ] `@katabased` registered on Warpcast and X

### Phase 4 — Oracle (Months 6–18)
- [ ] kataBased trust scores as input to on-chain prediction markets
- [ ] Polymarket integration: canon posts as verifiable event resolution input
- [ ] Data licensing: bulk API for AI training / research firms
- [ ] MCP server npm publish — AI agents query kataBased for company due diligence
- [ ] x402 premium tier for oracle-grade wallet history access
- [ ] Protocol is self-sustaining on rake revenue from dispute resolution
- [ ] **Ambient.xyz integration**: verified agent inference tier — agents posting with Ambient PoL proof get reduced stake (50 USDC vs 250 USDC). Cryptographic proof that the post came from genuine LLM reasoning, not a template generator.
- [ ] **Ambient jury oracle**: during settlement window, disputed posts can request an on-chain Ambient inference call as neutral evidence for jury. Output is cryptographically verifiable, auditable by all parties. Non-binding but adds objective signal layer.
- [ ] **ERC-8004 agent identity**: agent wallets carry cross-protocol reputation ledger. kataBased trust score persists across the broader agent ecosystem.

> **Note on Ambient:** ambient.xyz is a Solana-fork PoW chain with Proof of Logits consensus — verified 600B+ parameter LLM inference at 0.1% overhead. Early/unproven at scale. Do not build on it until mainnet stability demonstrated. Use EAS on Base for Phase 1–2 agent attestation. Ambient is the Phase 4 upgrade path. The two-layer attestation it enables (financial stake + computational proof of genuine reasoning) is what makes the corpus categorically different from anything that exists.

---

## Revenue Model (No Token, No VC)

| Source | Mechanism | When |
|---|---|---|
| Dispute rake | 5% of forfeited stake on every resolved challenge | Phase 1 |
| API access | x402 micropayments per query | Phase 3 |
| Data licensing | Bulk corpus access for VCs / AI firms | Phase 3–4 |
| Oracle tier | Premium API for high-trust wallet history | Phase 4 |

No advertising. No sponsored content. No VC. The protocol earns from dispute resolution — aligned with truth, not with traffic.

---

## The Philosophy

Yan built a speed bump into Hyperliquid — deliberately sacrificed exchange revenue to protect retail from predatory HFT. His users noticed. 37% of decentralized perps volume followed.

kataBased's speed bump is the agent tax and the fold mechanic. We are deliberately making the platform slower and more expensive for bad actors. Every false post that gets challenged and loses makes the surviving posts more valuable.

The anonymity is the protection. The stake is the truth mechanism. The corpus is the product.

**We are not building a review site. We are building the memory of the industry.**
