# kataBased — Design Audit
**Auditor:** Moggleangelo  
**Date:** 2026-04-14  
**Files reviewed:** `app/page.tsx`, `app/dashboard/page.tsx`, `app/globals.css`, `components/TunnelBackground.tsx`, `components/TunnelLayer.tsx`

---

## Overall Verdict

The bones are correct and the concept is genuinely strong. The tunnel background is the single best visual decision in the entire codebase — a procedurally generated cave with animated descent is exactly the right metaphor for a platform called κατάβασις. But the surface layer on top of it reads like a developer built a design system in isolation, then applied it everywhere indiscriminately. The result is **typographic monoculture**: every font size clusters between 10–14px, every color is an rgba opacity variant of Aegean blue, and every interactive element uses the same 2px border-radius + `1px solid rgba(107,159,212,x)` pattern. Nothing has visual weight. Nothing leads the eye. The platform looks like a terminal emulator that wants to be something more dangerous, but doesn't know how. The voice is right. The visual execution is not yet at the same level. This is fixable in a focused sprint — no architectural changes needed, only intentional hierarchy decisions.

---

## Section-by-Section Breakdown

---

### 1. Landing Page — `app/page.tsx`

**What's working:**
- The κβ logotype in Cormorant Garamond italic is distinctive and correct. Serif italic against the dark background has genuine character.
- The `BEFORE_YOU_DESCEND` block with the left accent border is a good pattern — compact, structured, thematically appropriate.
- The preview feed cards with terracotta entity labels establish the product quickly.
- Scroll-reactive `βάθος: Xm` depth meter is an excellent ambient detail.

**What's killing it:**

**Font size floor is too low.** The global base font-size in `globals.css` is set to `11px`. Combined with landing copy at `13px` and section text at `fontSize: 13`, the entire page whispers. Users scan, not read — and at 11–13px JetBrains Mono (which renders narrower than typical body fonts), nothing has presence. The tagline "Surface is managed. Depths are not." deserves to land. At 13px it doesn't.

Fix: Raise base to 14px in globals. Bump tagline to 17–18px, weight 500. Raise `BEFORE_YOU_DESCEND` body lines from 11px to 13px. Small tokens (labels, timestamps) can stay at 11–12px — contrast with a larger floor matters more than uniform density.

**The connect CTA is invisible.** A 52×52px button in the vertical center of a full-viewport hero is the primary conversion action for the entire platform. It has `border: 1px solid rgba(74,222,128,0.25)` and `background: rgba(74,222,128,0.05)`. That is visually indistinguishable from background texture. There is no affordance that this is a button. No label. No clear shape. Fitts's Law: the target is fine-sized; the problem is zero visual weight. By Hick's Law the choice is simple (one action) — but the Von Restorff effect is completely absent. Nothing marks this as the important element.

Fix: The button needs a visible fill state at rest, not just on hover. `background: rgba(74,222,128,0.12)` with `border: 1px solid rgba(74,222,128,0.45)`. Add a text label below or alongside: `[ DESCEND ]` in mono, 13px, letter-spacing 0.2em. The connect-state label text above (`// CONNECT_WALLET_TO_ENTER`) is already doing label duty but is set at 55% opacity — raise to 75% opacity.

**The hero vertical rhythm is incoherent.** Going top to bottom: logo → subtitle → 1px divider → tagline → info block → CTA → preview feed. Each element has a different `marginBottom` (8px, 36px, 36px, 14px, 28px, 14px). The spacing isn't bad individually — each value has local logic — but the aggregate reads as random. The 1px divider between subtitle and tagline adds nothing: it separates two elements that should connect, and it's at 12% opacity anyway so it's invisible.

Fix: Remove the 180px hairline divider. Collapse the subtitle (κατάβασις — the descent) directly above the tagline with 8px gap. The tagline follows immediately. The info block follows with 32px gap. This creates two dense clusters (identity/brand, then information) with one meaningful gap between them — matching the Law of Proximity.

**The ABOUT and OPSEC sections have near-zero contrast.** Body text opacity: `0.38`, `0.28`, `0.32`. Against `#04050C`, that's roughly a 2:1 contrast ratio. WCAG AA requires 4.5:1 for normal text. These sections are completely unreadable. A user who actually descends to read the opsec content cannot read it.

Fix: Minimum 0.55 opacity for all paragraph text. Bump opsec tier descriptions to 0.65. Reserve 0.28–0.35 for decorative/ambient metadata only.

---

### 2. Navigation — `app/dashboard/page.tsx`

**What's working:**
- Sticky nav with backdrop blur is correct.
- The bracket notation for tab labels `[FEED_LOG]` `[ENTITIES]` feels native to the aesthetic.
- Wallet address truncated with pulsing dot indicator is solid.

**What's killing it:**

**Nav height is 46px — too compressed for what it contains.** The nav holds logo + session meta + coordinates + 5 tabs + 2 dropdown buttons. At 46px this entire cluster is cramped. More critically, the session meta (`KATABASED // v0.1 // ANON_MODE`) and the coordinate label (`37.9°N · 23.7°E`) are both ambient decoration — they appear in the nav, in the landing page header, in the sidebar, and in the fixed bottom corner. Four instances of the same information. By the Law of Similarity, repeating identical elements reduces their signal to noise.

Fix: Remove coordinates from the nav entirely (they already exist as fixed bottom-right). Remove the `KATABASED // v0.1 // ANON_MODE` text from the nav — the κβ logo already identifies the app. Nav height can stay at 46px but the freed space makes remaining items breathe. The logo + version string is redundant; the logo alone is sufficient by Jakob's Law.

**Tab active state is too subtle.** Active tab: `border: 1px solid rgba(107,159,212,0.35)`, `background: rgba(107,159,212,0.12)`. Inactive: same border but transparent. The difference between these states is 35% opacity on a hairline border and a near-invisible background tint. On an OLED screen at medium brightness this collapses completely.

Fix: Active tab should have `background: rgba(107,159,212,0.18)`, `color: rgba(218,228,248,0.9)` (currently at 0.88 — fine), and the bracket glyphs should be in terracotta: `[` in terra, `]` in terra, label in high-brightness blue. A small 2px bottom border in terracotta on the active tab is an even simpler, higher-contrast signal.

**No mobile layout.** The nav wraps into chaos on viewports under 900px. The 5-tab cluster + two dropdowns can't fit. There's a partial media query on the landing page (`@media (max-width: 600px)`) but the dashboard has nothing. Per the layout principles checklist, mobile-first is baseline. Currently the app is de facto desktop-only.

---

### 3. Feed Cards — `app/dashboard/page.tsx` (`FeedPage`)

**What's working:**
- Left-border signal differentiation (low/med/high opacity) is a strong systematic pattern — it's subtle but scales well.
- The 2px confirm/dispute ratio bar at card bottom is elegant. Low-noise, data-dense.
- Entity badge (terracotta, 1px border) breaks up the monotone text.
- `◆ HIGH_SIGNAL` / `◈ MED_SIGNAL` labels with color-coded text create clear hierarchy at a glance.

**What's killing it:**

**All body text is the same size and same opacity.** Card title (`fontSize: 16, fontWeight: 600`) and card body (`fontSize: 14, fontWeight: 400`) differ by only 2px. The opacity values are `rgba(240,245,255,1.0)` for title and `rgba(210,222,242,0.82)` for body — close enough that the hierarchy barely registers. Per the training: hierarchy signals rank as size > weight > color > spacing. Currently weight is doing light lifting and size is doing almost none.

Fix: Title to 18px, weight 600, tracking -0.02em. Body stays 13px but lineHeight to 1.75. The 5px font-size delta creates actual hierarchy. The meta row (author/entity/time) stays at 11–12px — now you have three distinct tiers.

**The broadcast bar ("DROP_A_TRANSMISSION") uses dashed border.** Dashed borders signal "incomplete" or "placeholder" in most design contexts (drag-and-drop targets, form dropzones). This is the primary composition entrypoint for the entire platform. It should not read as empty/provisional.

Fix: Replace `border: 1px dashed rgba(107,159,212,0.2)` with `border: 1px solid rgba(107,159,212,0.22)` plus `borderLeft: 3px solid rgba(107,159,212,0.45)`. On hover the border goes to `rgba(107,159,212,0.5)` and `borderLeftColor` goes to terracotta. Terracotta left border on hover signals "action" — aligning with the terracotta-as-CTA token.

**The confirm/dispute buttons have no visual weight at rest.** `SignalBtn` at rest: `border: 1px solid rgba(190,208,238,0.07)`, `color: rgba(190,208,238,0.2)`. These are invisible against the card background. Users will not discover them without prior knowledge they exist. Per Nielsen Heuristic 6 (Recognition over Recall) — the interaction should be visible without requiring memory of a previous session.

Fix: Rest state should use `border: 1px solid rgba(107,159,212,0.18)` for CONFIRM and `border: 1px solid rgba(212,132,90,0.18)` for DISPUTE. Color values: CONFIRM `rgba(107,159,212,0.45)`, DISPUTE `rgba(212,132,90,0.45)`. This makes them scannable. Active state adds fill + full opacity. The difference between rest and active now reads clearly.

---

### 4. Explore / Entities Page

**What's working:**
- The two-tone sentiment bar (blue positive / terra negative) is the clearest data visualization in the app.
- Hover animation with `paddingLeft` shift from 10px to 14px is a smooth, understated interaction.
- Entity name + transmission count + sentiment percentage laid out in one row works.

**What's killing it:**

**The 8px sentiment bar is too thick relative to the information it carries.** Sentiment is a ratio, not a progress meter. 8px tall makes it feel like a loading bar or a health bar in a game. The 2px version on the feed cards is better — it's data-dense without claiming too much visual space.

Fix: Reduce to 3px height. Increase border-radius to 2px. The visual surface area now matches the information weight of the data.

**The search input has placeholder text as its only label.** `> search entities...` disappears the moment the user types. This is the Failure Modes list item "placeholder text as label." The `>` prefix (terminal-style prompt) is a nice touch but reinforces the terminal-emulator aesthetic in a way that feels cosplay rather than native.

Fix: Add a persistent label above: `// ENTITY_SEARCH` in the standard section-label style (12px, 500, letter-spacing 0.2em, Aegean blue 35% opacity). Keep the `>` placeholder text inside the input but demote it to pure hint copy, not a label.

**MegaIndex component has 1px border at 10% opacity.** The entire MegaIndex block — which is the most data-dense component in the app — reads as ambient texture rather than a distinct data panel. The scan-line overlay inside it (repeating-linear-gradient scan lines at 1.5% opacity) adds zero perceivable texture on most screens.

Fix: Raise MegaIndex border to `rgba(107,159,212,0.18)`. Add a 3px left border in Aegean at 50% opacity as a surface anchor. Remove the scan-line overlay entirely (imperceptible on non-CRT displays, just adds GPU compositing cost).

---

### 5. Composer Modal — `ComposerModal`

**What's working:**
- The `!! error` prefix and left-border error state is consistent.
- Character count turning red near limit is correct feedback.
- `BROADCAST` / `ABORT` button labeling is perfectly on-brand.
- The pulsing `◆` spinner during submit is well-executed.

**What's killing it:**

**Modal padding is 36px uniformly.** This creates a 36px gap between the modal edge and all content — excessively boxy. The form fields are padded `10px 12px` internally. The combined effect is a lot of frame with content packed into the center.

Fix: Modal padding: `28px 32px`. Header section (title + close button): add `paddingBottom: 20px`, then the gradient divider. This matches the 8px grid system from the design tokens. The reduction is subtle but removes the "forms inside a box" feeling.

**Form field labels use `fontSize: 13, letterSpacing: 0.16em`.** These are slightly too large to read as labels (which should recede) and slightly too small to scan as headings (which should lead). They're sitting in a liminal zone with no clear role.

Fix: Reduce to 11px, weight 600, letterSpacing 0.18em, text-transform uppercase. This matches the `SecHead` label pattern already used throughout the dashboard. Consistency here (Law of Similarity) reinforces that these are form field labels — same visual language as section headings, at a smaller scale.

**The "identity: anon · hash: on-chain · payload: encrypted" footer text in the modal is 14px gray and visually competes with the action buttons.** It's positioned between the error state and the button row. Users in the act of submitting don't need this reassurance — they needed it before they opened the composer.

Fix: Move to a `// TRANSMISSION_CONTEXT` header block inside the modal, above the first field. Style it as an ambient note: `fontSize: 11px, color: rgba(107,159,212,0.3), letterSpacing: 0.1em`. Remove from the action footer entirely. This follows progressive disclosure — the privacy context is front-loaded, not cluttering the submit moment.

---

### 6. Sidebar

**What's working:**
- Procedurally generated avatar from username hash is an excellent anonymous-identity pattern. Correct Web3 UX — no uploaded photos, no faces, but still distinctly personal.
- Profile stats in a 2×2 grid (KARMA / POSTS / STREAK / RANK) is clear.
- Live signal pulse with pulsing dot indicator works as ambient status.

**What's killing it:**

**Sidebar width is 220px fixed.** At 1080px max-width container, this leaves 834px for main content after the 26px gap. At actual viewport widths of 1200–1440px (where this layout will live), content area is fine. But the sidebar feels artificially thin — cards inside it at 220px with 14px padding have only 192px of usable text width. `walletDisplay` (`0x1234...5678`) at 14px Mono takes up most of that width in one line.

Fix: Increase sidebar to 240px. Tighten card padding from `padding: 14` to `padding: '12px 14px'`. This widens the usable text area by ~28px without changing the overall column ratio.

**The sidebar coordinate label (`37.9°N · 23.7°E · ΕΛΛΆΔΑ`) appears for the third time** (also in nav, also in fixed bottom-right). Three instances of the same decorative text. By the Law of Similarity, repeated identical elements suggest they're interactive or carry information. They're not — they're ambient. Over-repetition cheapens the effect.

Fix: Remove from sidebar and from the nav. Keep only the fixed bottom-right position, which is the most ambient/unobtrusive placement.

**"COMING_SOON — Prediction markets" teaser card has too-low contrast.** Title `rgba(218,228,248,0.45)`, body `rgba(190,208,238,0.18)`. The body text is at 18% opacity. The teaser card is trying to generate intrigue about an upcoming feature while being effectively invisible. Contradiction.

Fix: Raise body text to `rgba(190,208,238,0.45)`. Add `borderLeft: '3px solid rgba(212,132,90,0.35)'` as a left anchor. This gives the card the same terracotta-accent treatment used elsewhere for "action/upcoming" items.

---

### 7. OPSEC Page

**What's working:**
- The tier card system with T0–T4 progression, threat badges, and step counts is genuinely well-structured. This is the most content-complete section of the app.
- The interactive checklist with checkmark toggle is correct. Completing all items revealing `// CLEARED_TO_POST` is a satisfying micro-moment (Goal-Gradient Effect, Peak-End Rule).
- Left-border tier color coding in the detail view is excellent.
- The `FAILURE_MODES` table is a strong feature unique to this app.

**What's killing it:**

**`START_HERE` badge on T0 card uses `fontSize: 6`.** Six pixels. This is the smallest font size in the entire codebase and it renders as a blurry smear on most screens at non-retina resolution. This badge identifies the entry point for new users — it should be legible.

Fix: `fontSize: 9px`, `fontWeight: 700`, `letterSpacing: 0.16em`. Still small enough to be secondary, but actually readable.

**Tier detail view progress indicator (`// TIER 1 / 5 — CRITICAL`) is `fontSize: 14, color: rgba(190,208,238,0.22)`.** At 22% opacity this is below WCAG AA for normal text. It's also the primary navigation context when inside a tier detail.

Fix: Raise to `rgba(190,208,238,0.45)`. Not a design-breaking change — it's metadata — but it needs to be scannable, not invisible.

**The tools reference and failure modes sections have inline `flexWrap: 'wrap'` rows.** On a 220px sidebar viewport, the multi-column `display: flex, gap: 10, flexWrap: wrap` rows for tools become stacked single-column with misaligned columns. This isn't critical since the opsec page lives in the main column (not sidebar), but at narrow viewport widths the table structure collapses.

Fix: Convert the tools reference to a vertical list. Remove the multi-column flex layout. Each tool gets a single row: `[TIER] [CATEGORY] TOOL_NAME — description`. This matches the existing visual language of other data tables in the app (leaderboard, failure modes).

---

### 8. Typography System

**The core problem:** Everything is JetBrains Mono, weights 300–600, sizes 10–18px. This is intentional (mono-dominant aesthetic) but the execution is flat. The type scale referenced in the training brief (Display 48px / H1 32px / H2 24px / H3 18px / Body 15px / Label 12px) is not actually implemented anywhere. The largest font-size in the entire app is 76px — the hero κβ logotype — and the next largest is 22px on the landing `κατάβασις — the descent` subtitle. Everything else lives between 10 and 18px.

Without the upper range of the type scale, the visual hierarchy signal comes only from opacity and letter-spacing — which are both being used for 15+ different purposes each (ambient decoration, section labels, body copy, metadata, interactive labels). The signals blur.

**What to do:**

- `SecHead` component: raise from 14px to 13px (it's already uppercase tracking 0.2em — that's sufficient) but it's actually fine. The problem is everything else is also 13px.
- Feed card titles: raise to 18px as noted above.
- About page section headings (`INFORMATION_ASYMMETRY`, `DATA_API`, etc.): these render through `SecHead` at 14px. On a content-heavy page this size is too small. Bump to 16px for content section headings.
- Landing tagline: 13px → 17px.
- Dashboard profile stat values (KARMA, POSTS): 18px → 22px. These are the one place where a number should visually announce itself. Currently they're the same size as the card title text.

---

### 9. Color Usage

**The opacity system is overloaded.** The app uses a single Aegean blue `#6B9FD4` and varies it through rgba opacity across an enormous range: 10%, 12%, 14%, 18%, 22%, 25%, 28%, 30%, 35%, 38%, 40%, 45%, 55%, 60%, 65%, 70%, 75%, 78%, 80%. Each opacity value has a different semantic meaning in context but there is no system — it's improvised per-element. A developer reading the code cannot reason about opacity. A designer cannot audit it.

This violates the semantic token system principle from the training: raw hex values (or in this case, raw rgba values) should not appear directly in components. Define 5 opacity steps:

```
--text-primary:   rgba(218, 228, 248, 0.90)   /* headings, active states */
--text-secondary: rgba(190, 208, 238, 0.65)   /* body copy */
--text-muted:     rgba(190, 208, 238, 0.38)   /* metadata, ambient */
--text-disabled:  rgba(190, 208, 238, 0.22)   /* truly secondary */
--text-ghost:     rgba(190, 208, 238, 0.12)   /* decorative only */
```

Same for Aegean blue:
```
--blue-active:  rgba(107, 159, 212, 0.70)
--blue-medium:  rgba(107, 159, 212, 0.45)
--blue-soft:    rgba(107, 159, 212, 0.22)
--blue-whisper: rgba(107, 159, 212, 0.10)
```

Currently there are approximately 30 distinct opacity variants of each color. Reducing to 4–5 defined levels would make every component's visual weight immediately legible.

**Pure `#6B9FD4` (full saturation, 100% opacity)** appears on: active tab labels, username in nav, entity badge text in feed, signal button active state, `SecHead` section labels, avatar border. This full-opacity blue is doing too many jobs simultaneously. Per Von Restorff — when the important thing uses the same treatment as six other things, it's no longer important. Reserve full-opacity Aegean for one primary interactive role (active nav item). Use the stepped opacity system everywhere else.

---

### 10. Voice and Tone — Does the Visual Language Match the Brand?

**Partial match.** The concept vocabulary is fully realized: the descent metaphor, the κβ Greek logotype, the terminal-style `//` prefixes, the `ANON_MODE` and `ON-CHAIN` badges, the `◆`/`◈`/`◻` signal iconography. These feel genuinely crypto-native and insider. The writing voice in the About and OPsec sections is excellent — direct, specific, technical without being exclusionary.

Where the visual language diverges from the brand: the execution is too timid. An anonymous whistleblower platform shouldn't whisper. The opacity system creates a UI that recedes when it should press forward. The brand language says "the surface is managed. The depths are not" — but the UI is all surface management. Everything is muted, controlled, thin. The brand promise of something dangerous and uncontrolled is not delivered visually.

The Linear / Vercel reference point is useful here: those products are also dark, mono-font, technically precise. But Linear's font sizes are confident. Their CTA buttons have fills. Their headings are 24px minimum. They don't use opacity to hide — they use it to create depth. kataBased has depth in the tunnel background but flattens everything above it.

**The font pairing is currently under-used.** Cormorant Garamond appears on: the hero κβ logo, the `κατάβασις — the descent` subtitle, the procedurally generated avatar initial. That's it. The serif italic is the most visually arresting type element in the app — it creates genuine contrast against the monospaced system. It's being saved for decorative moments when it should be used for rhetorical weight. Large pull quotes in the About section, entity names in the hero of a company page, the main leaderboard display name — these would benefit from Cormorant at large scale.

---

## Top 10 Highest-Impact Fixes (Ranked by Visual Improvement vs. Effort)

### 1. Raise global base font-size from 11px to 14px and set a minimum 0.55 opacity floor for all body/paragraph text
**Impact: Critical. Effort: 15 minutes.**  
The 11px base + sub-0.5 opacity combination is the single most damaging decision in the codebase. Raises readability across every page simultaneously. Landing ABOUT/OPSEC paragraphs become legible. Body text stops whispering.  
`globals.css`: `font-size: 14px`. Add a `:root` CSS variable `--text-readable: rgba(190,208,238,0.62)` and use it for all paragraph text.

### 2. Feed card title: 13px → 18px, weight 600, tracking -0.02em
**Impact: High. Effort: 10 minutes.**  
Single property change with maximum hierarchy payoff. The feed is the core product surface. Titles need to lead. Currently titles and body text are separated by 2px. 18px vs 13px creates unmistakable F-pattern scan hierarchy.  
In `FeedPage`: `fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em'`.

### 3. Connect button on landing: add visible rest state and text label
**Impact: High. Effort: 20 minutes.**  
Primary conversion action has no visual affordance. Add `background: rgba(74,222,128,0.12)`, `border: 1px solid rgba(74,222,128,0.45)`. Add a text label `[ DESCEND ]` below the icon at 13px, letter-spacing 0.2em, Aegean blue 65% opacity. The button is currently invisible to first-time visitors.

### 4. SignalBtn rest state: raise border and text opacity
**Impact: High. Effort: 10 minutes.**  
CONFIRM/DISPUTE buttons at 7% border opacity and 20% text opacity are invisible. Raise to `border: 1px solid rgba(107,159,212,0.2)` for CONFIRM, `rgba(212,132,90,0.18)` for DISPUTE. Text at 40% opacity. Active state already works — the problem is rest state being imperceptible.

### 5. Remove coordinate label from nav and sidebar — keep only bottom-right fixed position
**Impact: Medium-high. Effort: 5 minutes.**  
Three instances of the same ambient text degrades from atmospheric detail to clutter. Two deletions clean the nav significantly, reduce cognitive noise, and make the remaining bottom-right instance feel intentional rather than copy-pasted.

### 6. Replace broadcast bar dashed border with solid left accent
**Impact: Medium. Effort: 10 minutes.**  
`border-style: dashed` signals incompleteness. The primary composition entrypoint deserves a solid border. Add `borderLeft: '3px solid rgba(107,159,212,0.4)'`. On hover, `borderLeftColor: rgba(212,132,90,0.6)` — terracotta signals action.

### 7. MegaIndex border: 10% → 18% opacity + remove imperceptible scan-line overlay
**Impact: Medium. Effort: 10 minutes.**  
The most data-dense component is visually indistinct from the background. Raising the border opacity makes it register as a panel. Removing the scan-line overlay (4 lines of CSS) eliminates dead GPU compositing work on a 0.015 opacity overlay no eye can see.

### 8. Condense opacity vocabulary to 4 semantic levels per color
**Impact: Medium (visual) / High (maintainability). Effort: 2–4 hours.**  
Define `--text-primary/secondary/muted/disabled/ghost` and `--blue-active/medium/soft/whisper` as CSS custom properties. Apply systematically. This is the longest task but transforms the codebase from "improvised opacity theater" to a legible design system. Every future component becomes easier to author and audit.

### 9. Avatar procedural color: use HSL hue derivation but increase base saturation and lightness
**Impact: Low-medium. Effort: 10 minutes.**  
Current: `hsl(${hue}, 35%, 45%)`. At 35% saturation, most hues resolve to muddy brown-gray. Raise to `hsl(${hue}, 55%, 55%)`. The avatar becomes more distinctly colorful per-user — which is the point of procedural identity generation.

### 10. `START_HERE` badge: raise from 6px to 9px
**Impact: Low (specific) / High (legibility). Effort: 2 minutes.**  
Six-pixel text is not text. This is a quick fix but should not ship as-is. It's the entry point signal for new users on the OPSEC page.

---

## Appendix: Quick Fix Diffs

**globals.css**
```css
html, body {
  font-size: 14px;  /* was 11px */
}
```

**Landing tagline** (`app/page.tsx`)
```jsx
fontSize: 17, fontWeight: 500  /* was 13, 300 */
```

**About/Opsec body copy** (`app/page.tsx`, opacity values)
```jsx
color: 'rgba(190,208,238,0.58)'  /* was 0.38, 0.28, 0.32 — minimum floor */
```

**Feed card title** (`app/dashboard/page.tsx`, ~line 219)
```jsx
fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em'  /* was 16, 600, -0.02em */
```

**Broadcast bar border** (`app/dashboard/page.tsx`, ~line 174)
```jsx
border: '1px solid rgba(107,159,212,0.22)',
borderLeft: '3px solid rgba(107,159,212,0.4)',
borderStyle: 'solid',  /* remove the dashed */
```

**SignalBtn rest state** (`app/dashboard/page.tsx`, ~line 112)
```jsx
border: `1px solid ${confirm ? 'rgba(107,159,212,0.2)' : 'rgba(212,132,90,0.18)'}`,
color: active ? col : confirm ? 'rgba(107,159,212,0.45)' : 'rgba(212,132,90,0.4)',
```

**Sidebar avatar saturation** (`app/dashboard/page.tsx`, ~line 1491)
```jsx
const avatarColor = `hsl(${hue}, 55%, 55%)`;  /* was 35%, 45% */
```
