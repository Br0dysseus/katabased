# kataBased — Mark 1 Deployment Guide

## Current State
You have a working Next.js 15 project with:
- Landing page (`app/page.tsx`) — parallax descent, wallet connect
- RainbowKit + Wagmi + Supabase wired up
- User auth via wallet → anonymous username
- Tailwind v4

The v12 dashboard preview is approved as the design system. Here's how to integrate and deploy.

---

## Step 1: Update Existing Files

### `app/layout.tsx`
Replace entirely. Changes: swap Inter for Cormorant Garamond + Outfit + JetBrains Mono via next/font/google. Add CSS variables for the three font families.

### `app/globals.css`  
Replace entirely. Changes: use `@import "tailwindcss"` (Tailwind v4), new CSS vars for --green, --background, --surface, --border. Selection color green. Custom scrollbar. Font utility classes.

### `app/providers.tsx`
One change: swap `accentColor: '#8b5cf6'` → `accentColor: '#166323'` in the RainbowKit darkTheme config. That's it.

### `app/page.tsx` (landing page)
Update the landing page to match the new design language — black/white/green palette, Cormorant Garamond for the κατάβασις text, Outfit for body, remove emojis (🔒⚡🏢), use the κβ logo instead. After wallet connect → redirect to /dashboard.

---

## Step 2: Create New Dashboard

### `app/dashboard/page.tsx`
This is the big one. Take the v12 preview (dashboard-v12.jsx) and convert it:

1. Add `'use client'` at top
2. Import `useAccount`, `useDisconnect` from wagmi
3. Import `useUser` from `@/lib/UserContext`
4. Import `useRouter` from `next/navigation`
5. Replace `MOCK_USER` with real `user` data from `useUser()`
6. Replace mock wallet with real `address` from `useAccount()`
7. Wire disconnect button to `disconnect()` from wagmi
8. Add redirect: if `!isConnected && !loading` → `router.push('/')`
9. Keep all the mock FEED/LEADERS/COS data for now (we'll wire Supabase later)
10. Replace inline Google Fonts `<link>` with next/font (already loaded in layout)
11. Replace inline font-family strings with CSS variable references

The v12 preview file (dashboard-v12.jsx) is your template. The JSX structure stays identical — you're just swapping mock auth for real auth.

---

## Step 3: Environment Variables

Create `.env.local` in your project root (you may already have this):

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

If you don't have a WalletConnect project ID:
1. Go to https://cloud.walletconnect.com
2. Create a project
3. Copy the Project ID

---

## Step 4: Supabase Tables

Make sure your Supabase has these tables:

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key, default gen_random_uuid() |
| wallet_address | text | Unique, not null |
| username | text | Not null |
| karma | integer | Default 0 |
| created_at | timestamptz | Default now() |

### `posts` (for later, but create now)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | FK → users.id |
| title | text | Not null |
| content | text | Not null |
| company_name | text | Nullable |
| upvotes | integer | Default 0 |
| downvotes | integer | Default 0 |
| created_at | timestamptz | Default now() |

### `comments` (for later)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| post_id | uuid | FK → posts.id |
| user_id | uuid | FK → users.id |
| content | text | Not null |
| upvotes | integer | Default 0 |
| downvotes | integer | Default 0 |
| created_at | timestamptz | Default now() |

---

## Step 5: Test Locally

```bash
cd your-project-directory
npm run dev
```

1. Visit http://localhost:3000 — you should see the landing page
2. Connect wallet — should redirect to /dashboard
3. Dashboard loads with your anon username from Supabase
4. Nav tabs work (feed/explore/ranks/about/privacy)
5. Vote buttons toggle
6. Wallet dropdown shows address, disconnect works
7. Username edit works
8. Cave background + watermark visible

---

## Step 6: Deploy to Vercel

```bash
# If not already connected
npm i -g vercel
vercel login

# Deploy
vercel

# Follow prompts:
# - Link to existing project or create new
# - Framework: Next.js (auto-detected)
# - Root directory: ./
```

### Add environment variables in Vercel:
1. Go to your project on vercel.com
2. Settings → Environment Variables
3. Add all three env vars from Step 3
4. Redeploy

### Custom domain (optional):
1. Settings → Domains
2. Add your domain
3. Update DNS records as Vercel instructs

---

## Step 7: Post-Deploy Checklist

- [ ] Landing page loads, descent animation works
- [ ] Wallet connect modal appears
- [ ] After connecting, redirects to /dashboard
- [ ] Username shows in green in nav
- [ ] All 5 nav tabs render content
- [ ] Cave background with crag edges visible
- [ ] κατάβασις watermark visible (vertical, right sidebar)
- [ ] Depth meter shows in bottom-right
- [ ] Disconnect wallet returns to landing
- [ ] Mobile responsive (we'll refine this in Mark 2)

---

## What Comes Next (Mark 2 — Refinement)

After you test the beta and confirm everything works:

1. **Landing page redesign** — match the new κβ aesthetic, kill the emojis, make it feel like entering the cave
2. **Real feed data** — wire FEED to Supabase posts table
3. **Post creation** — keyboard icon opens a compose modal
4. **Voting** — real upvote/downvote persisted to Supabase
5. **Company pages** — click a company → see all posts for it
6. **Leaderboard** — real karma rankings from Supabase
7. **About page** — full content (we'll write together)
8. **Privacy guide** — full content (wallet hygiene, VPN, RAILGUN, burner wallets)
9. **Mobile responsive** — the sidebar collapses properly
10. **Typography polish** — kerning, line heights, spacing details
11. **Animation refinement** — subtle micro-interactions that feel hand-crafted
12. **Dark mode edge cases** — RainbowKit modal styling, input focus states

The goal: when someone opens this, they don't think "AI made this." They think "someone obsessed over every pixel of this."
