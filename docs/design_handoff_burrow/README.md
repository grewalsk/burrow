# Handoff: Burrow frontend

## Overview

Burrow is a workspace for a founder doing growth — an AI-native growth team that surfaces market signals, scores leads, and drafts outreach. The UI is a stripped-down Slack/Linear hybrid: a top counter strip, a left channel rail with five channels, and a main pane that shows one thing at a time. The centerpiece is a Lead Card modal that explains *why* a lead matters with cited evidence.

This is a hackathon-scale build for projection on a 16:9 screen. Desktop only, no mobile, no responsive below 1100px wide.

## About the design files

The files in this bundle are **design references**, not production code:

- `01-source-brief.md` — the authoritative design brief. **Read this end-to-end before writing any code.** It is opinionated about both what to build and what *not* to build. The anti-pattern list is load-bearing.
- `visual-reference/Burrow design brief.html` — a 16-slide deck rendering the design system in its own visual language. Open it in a browser. Use it to see what the typography, color, spacing, and component composition should *feel* like when applied correctly. It contains real mocks of the signal card, drafts card, briefing card, ask channel, and the lead card modal at full size.

The task is to **recreate these designs in your target codebase's environment** using its established patterns. If you're starting from scratch, the recommended stack is below — but the visual fidelity and the prohibitions in the brief are what matters, not which framework you reach for.

## Fidelity

**High-fidelity.** Exact hex values, typography, and spacing are specified in the brief and reproduced below. Recreate pixel-faithfully. The look and the restraint are the product — Burrow's whole pitch is grounded retrieval and trust, and the UI has to feel trustworthy. The best version of this UI looks boring in the way good tools look boring.

## Recommended stack

If you're greenfield:

- **Next.js (App Router) or Vite + React** — either is fine; Burrow has no SSR or SEO concerns
- **TypeScript** — strictly
- **Tailwind CSS** with the design tokens below pinned in `tailwind.config.ts`, OR vanilla CSS with custom properties. Avoid component libraries that bring their own visual opinions (Material, Chakra, Mantine). If you want a primitives layer, **Radix UI** (unstyled) is fine.
- **Lucide React** for icons (outline only, never filled, 16px or 20px)
- **WebSocket** client for the live counter strip
- **A markdown-aware text renderer** for citations in #ask (e.g. react-markdown)

Do not pull in:
- shadcn/ui defaults without restyling — they'll bring rounded shadows and weights that violate the brief
- Framer Motion for anything other than the few transitions listed below — most "motion libraries" tempt you toward overshoot and spring physics, which are forbidden

## Architecture

Five channels = five routes. The shell is global.

```
/app
  /layout.tsx          — shell: top strip, left rail, outlet for main pane
  /signals/page.tsx    — #signals feed
  /drafts/page.tsx     — #drafts feed (cards with approve/reject)
  /sent/page.tsx       — #sent feed (muted, past-tense)
  /briefing/page.tsx   — briefing prose + earlier list + competitor alerts
  /ask/page.tsx        — chat-shaped channel
  /_components/
    TopStrip.tsx       — 6 live counters
    LeftRail.tsx       — channel list + status footer
    LeadCardModal.tsx  — the centerpiece (Source / Assessment / Evidence / Draft)
    SignalCard.tsx     — used in #signals, #drafts, #sent (variant prop)
    EvidenceRow.tsx    — collapsible retrieval row
    FitPill.tsx        — green/amber/gray score badge
    AgentMonogram.tsx  — 24×24 rounded square, one letter, flat color
```

The Lead Card modal is opened from any signal/draft card and from inline citations in `#ask`. Manage modal state at the layout level (URL search param or top-level store) so a citation click from `#ask` can deep-link to the right modal scrolled to the right retrieval.

## Layout

Three regions, fixed for the entire app. Minimum viewport 1280×800.

```
┌─────────────────────────────────────────────────────────────────┐
│  Top strip — live counters (56px tall, full width)              │
├──────────────┬──────────────────────────────────────────────────┤
│  Left rail   │                                                  │
│  220px wide  │              Main pane                           │
│              │                                                  │
└──────────────┴──────────────────────────────────────────────────┘
```

Page margin around the main pane: 32px. The channel header inside the main pane is 24px tall, sentence case, 15px medium weight, with a one-line description in 12px secondary text below.

Below 1100px wide, render: *"Burrow needs a wider window."* in 14px secondary text, centered. Do not try to be responsive.

## Design tokens

### Colors (light mode)

| Token | Hex | Role |
|---|---|---|
| `--bg-base` | `#FAFAF8` | Page background. Warm off-white. |
| `--bg-surface` | `#F3F2EE` | Cards, selected channel fill, briefing card fill |
| `--bg-elevated` | `#FFFFFF` | Modal, dropdowns |
| `--text-primary` | `#1A1816` | Body text. Never pure black. |
| `--text-secondary` | `#87837B` | Labels, metadata, captions |
| `--text-tertiary` | `#B5B1A8` | Disabled, hints, placeholder |
| `--border-subtle` | `rgba(26, 24, 22, 0.08)` | Dividers, card borders |
| `--border-default` | `rgba(26, 24, 22, 0.16)` | Input borders, button outlines |
| `--ink` | `#16213B` | Primary buttons, selected channel highlight, cursor |
| `--green` | `#2D7D5F` | Fit score ≥ 0.8 only, and live-status dot |
| `--green-bg` | `rgba(45, 125, 95, 0.10)` | Fit pill background |
| `--amber` | `#B08338` | Fit score 0.6–0.8 only |
| `--amber-bg` | `rgba(176, 131, 56, 0.10)` | Fit pill background |
| `--red` | (TBD by you) | Reject button hover, validation errors only |

### Colors (dark mode — mandatory)

| Token | Hex |
|---|---|
| `--bg-base` | `#0F0E0D` (warm dark gray, not pure black) |
| `--bg-surface` | `#1A1916` |
| `--bg-elevated` | `#23211D` |
| `--text-primary` | `#F0EEE8` |
| `--text-secondary` | `#9A958A` |
| `--text-tertiary` | `#6A655C` |
| `--border-subtle` | `rgba(240, 238, 232, 0.10)` |
| `--border-default` | `rgba(240, 238, 232, 0.18)` |

Test every screen in both modes. Use a `data-theme="dark"` attribute on `<html>` or `prefers-color-scheme`.

### Agent colors (desaturated, ~30% saturation)

| Agent | Letter | Hex |
|---|---|---|
| Scout | S | `#6C9690` (muted teal) |
| Analyst | A | `#8576A4` (muted purple) |
| Writer | W | `#B47D75` (muted coral) |
| Watcher | Wa | `#B7976A` (muted amber) |
| Chief | C | `#8A8884` (muted gray) |

Render as 24×24 rounded squares (8px radius), white letter, weight 500, 11px.

### Typography

**One typeface for everything: Inter.** Two weights only — `400` regular and `500` medium. **No 700, no 600, no 300, no 900.** Heavy weights read as marketing site, not as tool.

Acceptable upgrade: GT America, Söhne, or ABC Diatype if you have licenses. Inter is fine.

Monospace (for citations in #ask, evidence document paths): **JetBrains Mono** or **IBM Plex Mono**.

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap');
```

### Type scale

| Size | Weight | Use |
|---|---|---|
| 11px | 500, uppercase, letter-spacing 0.05em | Region labels (SOURCE, EVIDENCE) only |
| 12px | 400 | Metadata, captions, secondary text |
| 13px | 500 | Button labels, dense UI labels |
| 14px | 400 | Channel names, table-like text |
| 15px | 400 | Body text in cards and messages |
| 16px | 400 | Body in briefing card and modal draft block |
| 18px | 500 | Top strip primary numbers |
| 22px | 500 | Section headers inside modal, briefing date |
| 28px | 500 | Page-level title (briefing "Today" date — used once) |

### Line height

- **1.3** — UI labels, button text, single-line metadata
- **1.55** — body in cards
- **1.7** — Evidence snippets, briefing prose (reading-density)

### Case

Sentence case everywhere. Region labels in the modal (SOURCE, ASSESSMENT, EVIDENCE, DRAFT) are the only uppercase strings in the app. No Title Case on buttons, channels, or anywhere else.

### Spacing scale

Fixed increments. Pick from these — do not free-hand pixel values.

```
4, 8, 12, 16, 24, 32, 48, 64
```

Card padding: 16. Section padding inside the modal: 24. Page margin around the main pane: 32. Between sections in #briefing: 48. Vertical gap between cards in a feed: 12.

### Border radius

- 4px — buttons, badges
- 6px — cards, channel rows (when selected)
- 8px — modal, briefing card
- 999px — fit pills

### Shadows

Almost none. The modal can have a hairline lift: `box-shadow: 0 1px 0 rgba(0,0,0,0.02)`. **No `box-shadow` blur > 12px anywhere in the app.** No `filter: drop-shadow` for "magic" effects.

## Screens

### 1. The top strip

Full-width horizontal bar, 56px tall. Six counter groups left-aligned, evenly spaced.

Each counter group:
- Label above: 11px, uppercase, letter-spacing 0.08em, `--text-secondary`, weight 500
- Number below: 18px, weight 500, `--text-primary`

The six counters (in order):
1. `Signals seen` — total signal count, lifetime
2. `High-fit leads` — count of leads with fit_score ≥ 0.8
3. `Drafts pending` — count of unapproved drafts
4. `Approved` — count of drafts approved today
5. `Avg time-to-draft` — p50, in seconds, e.g. "47s"
6. `Grounded %` — % of recent drafts whose retrievals all scored above threshold

Updates arrive via WebSocket. **The update is quiet:** the number changes, that's it. No flash, no pulse, no ticker animation. If you must animate, a 200ms opacity crossfade between old and new value.

1px bottom border (`--border-subtle`) separates the strip from the main area. **No background color difference between the strip and the rest of the app.** The bar reads as a header, not as chrome.

### 2. The left rail

220px wide. 1px right border (`--border-subtle`).

Five channel rows, vertically stacked:

```
#signals    [12]
#drafts     [4]
#sent
#briefing   [1]
#ask
```

Each row:
- 36px tall, 12px horizontal padding
- Label: 14px regular weight
- Unread badge on the right: 11px, weight 500, `--text-secondary`, on a `--gray-pill` background (`rgba(26,24,22,0.06)`), 999px radius, 3px×10px padding. Hide badge when count is 0.

Selected row: `--bg-surface` fill, 6px radius. **No left-border accent. No bold weight.** Just the fill.

Below the channel list: a 1px divider, then a "Settings" link in 13px, `--text-tertiary` (placeholder — no settings page).

At the bottom of the rail: a status indicator.
- 6px dot — `--green` if Scout's cron is active, `--text-tertiary` if paused
- Word "Live" or "Paused" in 11px `--text-secondary`

### 3. #signals — signal card

Reverse-chronological feed. Card height varies 60–120px. Vertical gap 12px between cards. Card padding 16px. Background `--bg-base`, border `1px solid --border-subtle`, 6px radius.

**Anatomy (top to bottom):**

- **Top row** — source icon (Reddit, X, HN — outline at 14px, never the brand's colored logo at large size), author handle in 12px weight 500, "·" separator in `--text-tertiary`, time ago in 12px `--text-secondary` ("4m ago"), and the fit score badge far right (if scored)
- **Middle** — 2-3 lines of signal content. 15px weight 400, line-height 1.55. Truncate with ellipsis after 3 lines.
- **Bottom row** (only if scored) — "matches: Initech win" in 12px `--text-secondary`. One line, ellipsis if longer. **No "View details" button.** The whole card is clickable; it opens the Lead Card modal.

**Fit score badge** (`<FitPill>`):
- 24px tall, ~64px wide, 999px radius, weight 500
- Content: 6px dot in current color + the score (e.g. `0.84`) in JetBrains Mono
- 0.8+ : `--green-bg` fill, `--green` text
- 0.6–0.8 : `--amber-bg` fill, `--amber` text
- < 0.6 : `--gray-pill` fill, `--text-secondary` text

**Analyzing state**: when a signal arrives before the Analyst scores it, render "Analyzing" in 12px `--text-secondary` on the right side of the card where the badge will eventually appear. When the score arrives, replace the text with the badge via a 200ms opacity crossfade.

**Scoring update animation**: when the badge first appears, slide it in from the right side of the card with 250ms ease. **Do not re-shuffle the feed.**

### 4. #drafts — draft card

Same outer pattern as a signal card. The author/time row references the **original signal**, not the draft, so the founder remembers what this is replying to.

Inside the card:
- A quoted block showing the draft message — 2-line preview, 2px left border in `--border-default`, indented 12px
- Below: two right-aligned buttons, 32px tall, 13px weight 500 text:
  - **Reject** (secondary): `--bg-elevated`, border `1px solid --border-default`, `--text-primary` text. Hover: `--red` text and border.
  - **Approve, send** (primary): `--ink` background, white text, no border

When approved: the card animates out (slide right + fade, 300ms ease-in-out) and appears at the top of `#sent`. **Then it stops.** No celebration toast.

### 5. #sent

Same cards as drafts but no action buttons. The Approve/Reject row is replaced with a single 12px `--text-secondary` line: `sent · 2m ago` or `approved · 8:32 AM`. Cards in `#sent` render at 90% opacity instead of 100%. Past tense in copy.

### 6. #briefing

Two regions stacked.

**Top: the morning briefing.** One large card, full width of the main pane.
- Background: `--bg-surface`
- 8px radius, 36-40px padding
- Inside, top to bottom:
  - "Today" label — 11px uppercase letter-spaced, `--text-secondary`
  - The date — 28px weight 500 ("Thursday, August 14")
  - 3-5 sentences of summary prose — 16px weight 400, line-height 1.7. **No bullet points. Just paragraphs.** Chief of Staff's voice.

**Below: "Earlier" header**, then a reverse-chronological list of past briefings. Each collapsed to a single line: date + 12-word summary. Click to expand to the same card pattern.

**Competitor alerts (Watcher's output)** land here as small inline cards between briefings. They look visually identical to signal cards but with a small `competitor move` pill at the top in `--gray-pill` / `--text-secondary`. Use an `alert-triangle` icon in `--text-secondary` (gray, not red).

### 7. #ask

The only chat-shaped channel. Layout is **inverted** from the other channels: the input sits at the bottom (sticky), and the conversation flows upward.

- **Founder messages** — right-aligned, on `--bg-surface`, 6px radius, 12px padding, 15px text
- **Chief of Staff messages** — left-aligned, **no fill** (just sits on `--bg-base`), 15px text, signed below in 11px `--text-secondary`: `— Chief of Staff`

**Inline citations**: a small superscript number (¹, ², ³) at the end of the supporting sentence, in `--text-secondary`, raised. Click a citation → open the Lead Card modal scrolled to the matching evidence row.

**Streaming is allowed here** — text appears word-by-word as Claude generates. A 2px × 18px cursor in `--ink` at the end while streaming. **No bouncing dots. No "thinking..." text.**

Input bar at the bottom:
- 1px top divider
- 14px placeholder "Ask Chief of Staff…"
- Enter to send. Shift+Enter for newline.

### 8. The Lead Card modal — the centerpiece

**This is the most important UI in Burrow.** The whole pitch lives or dies on whether this feels like a trustworthy document or like a chatbot output.

**Behavior:**
- Opens when the user clicks any card in `#signals` / `#drafts`, or any citation in `#ask`
- Slides up from the bottom of the viewport, 200ms ease-out
- Page behind dims to 40% black overlay
- Width: 720px, centered. Max height: 80vh.
- If content overflows, the modal's **inner** region scrolls — the modal itself stays fixed
- Close: X icon top-right (20px), ESC key, or click the dim overlay

**Layout** — vertical stack, four regions divided by 1px `--border-subtle` dividers:

#### Region 1: SOURCE
- Region label: `SOURCE` (11px uppercase letter-spaced 0.05em, `--text-secondary`, weight 500)
- Source line in JetBrains Mono 14px `--text-secondary`: `REDDIT · u/infra_will · r/LocalLLaMA · 4m ago`
- The quoted post — 16px line-height 1.55, smart quotes
- `View original →` link — 13px weight 500, `--ink`

#### Region 2: ASSESSMENT
- Region label: `ASSESSMENT`
- One mono line: `fit 0.84 · public reply`
- 2-3 sentences explaining the match in 15-16px body text, line-height 1.55

#### Region 3: EVIDENCE
**This is the region that closes the trust gap. Treat it as a document, not a UI element.**

- Region label: `EVIDENCE`
- Helper line: `3 retrievals · click any to expand` (12px `--text-secondary`)
- Each retrieval is a **collapsible row** (`<EvidenceRow>`):

**Collapsed**:
```
▸  won_deal · Initech                              0.89
```
- 14px chevron in `--text-tertiary` (rotates 90° on expand, 200ms ease-out)
- doc_type in `--text-primary` (e.g. `won_deal`), page slug in `--text-secondary` after a `·`
- Relevance score on the right, JetBrains Mono, color matches fit thresholds (green/amber/gray)
- Whole row clickable

**Expanded**:
- Smooth expand animation (200ms, ease-out on height + opacity)
- The **actual retrieved snippet** — the literal chunk the retriever returned. Body text 18px weight 400, **line-height 1.7**, slightly indented, inside a `--bg-surface` block with 22px padding and 6px radius
- Footer line (JetBrains Mono 13px `--text-secondary`): `from /won_deals/initech.md · indexed 2 days ago · rank 1 of 5`
- `Re-run this query →` link in 13px `--ink` weight 500

Multiple rows can be expanded at once.

#### Region 4: DRAFT
- Region label: `DRAFT`
- The draft text in a quoted block — 16px line-height 1.65, **2px left border in `--ink`** (not `--border-default` — this is the founder's voice being grounded in the founder's brand)
- Below: `Grounded in: brand_guide voice (0.81), Initech proven message (0.79). Show evidence →` (12px `--text-secondary`, with link in `--ink`)
- Action row, right-aligned: Reject (ghost) + Approve, send (primary)

#### Footer affordance
Below the action row: a small secondary-text link `What changed since this was scored?` Click → re-runs Analyst's retrieval against the current brain state and shows a diff. This makes the data flywheel visible.

## Interactions and motion

**Allowed:**
- Fade in on initial render (150ms ease-out)
- Modal slide-in from below (200ms ease-out)
- Cards sliding out of `#drafts` when approved (300ms ease-in-out)
- Counter updates: 200ms opacity crossfade
- Card hover: background color transition over 100ms
- Chevron rotation on evidence expand (200ms ease-out)
- Evidence row expand: height + opacity (200ms ease-out)
- Streaming text in `#ask` only

**Not allowed:**
- Bouncing, springs, overshoot
- Anything longer than 400ms
- Anything that loops, pulses, or shimmers
- Skeleton screens with shimmer

**Loading**: a 1px progress bar at the top of the affected region. That's it.

**Empty states**: small centered single line in 14px `--text-secondary`. No illustration, no CTA.

| Channel | Empty message |
|---|---|
| #signals | "No signals yet. Scout runs every 30s." |
| #drafts | "Nothing pending." |
| #sent | "Nothing sent yet." |
| #briefing | "Your first briefing posts tomorrow morning." |
| #ask | "Ask Chief of Staff anything about your pipeline." |

## Icons

Use **Lucide React** (or Tabler Outline). Outline only, never filled. 16px or 20px, never larger. `color: currentColor` — let the parent decide.

Map:
- channel/feed → `hash`
- inbox → `inbox`
- send → `send`
- briefing/sun → `sun` (only inline at 14px on the briefing date)
- ask → `message-circle`
- close → `x`
- chevron → `chevron-down` (rotate via transform)
- check → `check`
- external link → `arrow-up-right` (small)
- competitor alert → `alert-triangle` (gray, not red)

## Copy tone

- Sentence case, never Title Case
- Active voice
- Direct, not chatty: "4 drafts pending" not "You have 4 drafts pending right now!"
- Past tense for completed states: "approved 8:32 AM" not "✓ Approved!"
- No exclamation points
- Errors are stated, not apologized for: "Couldn't reach TheHog. Retrying." — not "Oops!"
- Agents state, they don't narrate. No "Let me…" or "I'll…"

## Prohibitions (from the brief — these are the most-violated)

1. **No gradients.** Solid fills only. Anywhere.
2. **No sparkle emoji ✨ 🪄 🤖 🧠 💫.** Not in copy, not in icons, not anywhere.
3. **No "Powered by AI" badges.** The product is obviously AI-driven; saying so is bragging.
4. **No glowing borders, neon outlines, pulsing rings.** No `box-shadow` blur > 12px. No filter drop-shadow for magic effects.
5. **No robot avatars or cartoon faces for agents.** Use the monogram square.
6. **No three-bouncing-dot "thinking" animation.** Use a 1px progress bar or a static "Working" label.
7. **No typewriter streaming for non-chat content.** Streaming is only allowed in #ask.
8. **No glassmorphism, blur layers, frosted backgrounds.** Flat opaque surfaces only.
9. **No confetti, success particle animations, "Nice!" toasts.** Quiet status change only.
10. **No emoji in agent or system copy.** Reserved for user-typed content.
11. **No more than two font weights on screen.** 400 and 500.
12. **No all-caps button labels or section headers.** (Region labels in the modal are the only allowed uppercase.)

If you catch yourself adding a flourish to make a screen feel "more designed," delete a different element instead.

## State management

Per-channel local state for feeds is fine. The cross-cutting state you need globally:

- `selectedChannel: 'signals' | 'drafts' | 'sent' | 'briefing' | 'ask'`
- `leadCardModal: { open: boolean; signalId?: string; scrollToEvidenceId?: string }`
- `theme: 'light' | 'dark'`
- `liveCounters: { signalsSeen, highFitLeads, draftsPending, approved, avgTimeToDraft, groundedPct }` — fed by WebSocket

Zustand or a tiny context is plenty. No Redux.

## What "done" looks like

1. A judge can look at the screen for five seconds and not be able to tell whether this is a finished product or a hackathon demo.
2. No screenshot of any screen would feel out of place in a Linear changelog post.
3. The Lead Card modal renders well enough to make a screenshot of it the hero image of the pitch.
4. Dark mode works on every screen.
5. Nothing pulses, glows, gradients, or sparkles.
6. The Evidence section is comfortably readable without zooming.

## Files in this bundle

- `README.md` — this file
- `01-source-brief.md` — the authoritative design brief. Read this end-to-end.
- `visual-reference/Burrow design brief.html` — 16-slide deck with rendered mocks of the signal card, drafts card, briefing card, ask channel, full lead card modal, color palette, type scale, and agent monograms. Open in a browser to see the design system applied in its own language. Arrow keys to navigate.
- `visual-reference/deck-stage.js` — runtime for the deck (required by the HTML)
