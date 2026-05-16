# Burrow — Frontend Design Brief

A design spec for a Claude design-style agent. Build the UI for Burrow: an AI-native growth team that surfaces market signals, scores leads, and drafts outreach.

This doc tells you *what to design* and, more importantly, *what not to design*. Read it end to end before opening Figma or writing any code.

---

## The one-paragraph version

Burrow is a workspace for a founder doing growth. It looks like a stripped-down Linear or a quieter Slack. Five channels down the left. A live counter strip at the top. A main pane that's mostly one thing at a time. Click a signal, get a modal that explains *why* this lead matters with real citations. The whole thing should feel like a calm professional tool, not a dashboard, not a chatbot, not a hype site. The user should feel like they're reading a clean inbox, not playing a game.

---

## The taste north star

If you've used these products and they felt good, you're in the right zone:

- **Linear** — type, density, the way nothing shouts
- **Stripe Dashboard** — restraint, generous spacing, the feeling that someone cared
- **Vercel Dashboard** — flat, monochrome-leaning, no decoration that isn't load-bearing
- **Things 3** — calm, quiet, paper-like

If you've used these and they felt bad, you're in the wrong zone:

- **Anything called an "AI Agent Platform" on Product Hunt** — purple gradients, glowing chips, badges that pulse, sparkle icons, agent avatars with anime hair
- **Salesforce / HubSpot** — every pixel has a feature, nothing breathes
- **A generic CRM landing page from 2024** — hero blob gradient, "✨ AI-powered" everywhere

The whole brief that follows is in service of the first list and against the second.

---

## What screams AI slop (do not do any of this)

A short prohibited list. If you find yourself reaching for one of these, you're solving the wrong problem.

1. **Purple-to-blue gradients on buttons, cards, headers, anywhere.** No gradients at all. Solid fills only.
2. **The sparkle emoji ✨ or any of: 🪄 🤖 🧠 💫.** Not in copy, not in icons, not in agent avatars.
3. **"Powered by AI" or "AI-generated" badges.** The product is obviously AI-driven; saying it is bragging. Show, don't tell.
4. **Glowing borders, neon outlines, pulsing rings around active elements.** No CSS `box-shadow` with blur > 12px. No `filter: drop-shadow` for "magic" effects.
5. **Robot avatars or cartoon faces for the agents.** The agents are not characters. They are roles. Use a one-letter monogram on a flat colored square, like Linear's project icons.
6. **"Thinking..." dot animations with three bouncing dots.** Use a single thin progress bar (1px tall) or a static "Working" label with a small spinner. No dot trios.
7. **Typewriter text streams for non-chat content.** Streaming text is fine in chat (`#ask`). Streaming text in dashboards and cards is performative.
8. **Glassmorphism, frosted backgrounds, blur layers.** Flat, opaque surfaces only.
9. **Confetti, success animations with particles, "Nice!" toasts after every action.** Acknowledge actions with a quiet status change, not a celebration.
10. **Stock illustrations of robots/brains/networks of nodes.** No vector art people in pastel colors. No abstract "neural mesh" backgrounds. The interface is the illustration.
11. **All-caps button labels, all-caps section headers.** Sentence case everywhere.
12. **Emoji in agent messages or system copy.** Reserved for user-typed content if they want it.
13. **More than two font weights on screen at once.** 400 and 500. No 600, no 700, no 800. Bold reads as shouting against a calm system.
14. **Animated mesh-gradient backgrounds.** No animated anything in the background. The background is a single neutral color.
15. **Buttons named "Magic" or "Ask Burrow Anything" with a special glow.** A button is a button. Label it with the verb.

If you catch yourself thinking "this needs a little more pop," delete something instead.

---

## Layout

Three regions, fixed for the entire app.

```
┌─────────────────────────────────────────────────────────────────┐
│  Top strip — live counters (56px tall, full width)              │
├──────────────┬──────────────────────────────────────────────────┤
│              │                                                  │
│  Left rail   │              Main pane                           │
│  220px wide  │              (everything else)                   │
│              │                                                  │
│  - channels  │  - channel feed                                  │
│  - settings  │  - or lead card modal (centered, dims rail)      │
│  - footer    │  - or ask-bar layout (channel + input at bottom) │
│              │                                                  │
└──────────────┴──────────────────────────────────────────────────┘
```

No mobile layout. Desktop only. Minimum viewport 1280×800. Don't bother making it responsive below 1100px wide — show a quiet "Burrow needs a wider window" message instead. We are not pretending to be a SaaS, we're shipping a hackathon demo that will be projected on a 16:9 screen.

### The top strip

A single horizontal bar with six numbers. Left-aligned, evenly spaced. Each is a small group: a 11px secondary label above a 18px primary number. Updates live via WebSocket but the update is *quiet* — the number changes, that's it. No flash. No pulse. No counter animation that tickers up by ones; just replace the value with a 200ms ease on opacity if you must.

The six numbers:

```
SIGNALS SEEN    HIGH-FIT LEADS    DRAFTS PENDING    APPROVED    AVG TIME-TO-DRAFT    GROUNDED %
   1,247             12                4              8              47s                  98%
```

A 1px bottom border separates the strip from the main area. No background color difference. The bar reads as a header, not a chrome element.

### The left rail

Five channels listed vertically. Each row: a 14px label, a small badge with the unread count on the right, 36px tall, 12px horizontal padding. Selected channel has a subtle background fill (the secondary surface color), no left-border accent, no bold. Just the fill.

Below the channels: a thin divider, then a "Settings" link (you don't need a settings page — just a placeholder link that does nothing). At the very bottom of the rail: a tiny status indicator showing whether Scout's cron is running. A 6px dot, green (active) or gray (paused), with the word "Live" or "Paused" next to it in 11px secondary text.

### The main pane

Whatever channel is selected fills this region. No tabs at the top. No breadcrumbs. The channel name lives in a header bar at the top of the pane (24px tall, sentence case, 15px medium weight, with a one-line description in 12px secondary text below).

Underneath the header: the channel content. Typically a vertical feed of cards.

---

## The channels and what lives in each

Five channels. Each one has a different feed shape; pick the one that fits the content, don't homogenize.

### #signals
Reverse-chronological feed of cards. Each card is one signal that Scout pulled from TheHog. Card height varies (60–120px depending on content length). When the Analyst attaches a fit score to a signal, the card updates in place — the fit badge slides in from the right side of the card with a 250ms ease. No re-shuffling of the feed.

**Card anatomy** (read top to bottom):
- Top row: source icon (Reddit, X, HN — outline icons only, never the brand's colored logo at large size; if you must show the brand, render it as the brand color but at 14px max), the author handle in 12px medium, a "·" separator, the time ago in 12px secondary ("4m ago"), and the fit score badge on the far right (if scored).
- Middle: 2-3 lines of the signal content. Standard body weight, 15px, line-height 1.55. Truncate with ellipsis after 3 lines.
- Bottom row (only if scored): "matches: Initech win" in 12px secondary text. One line, ellipsis if longer. No "View details" button — the whole card is clickable.

The fit score badge is the only colored element on the card. It's a small pill (24px tall, ~64px wide) showing the score (0.84) with a single descriptor. Colors:
- 0.8+ : green fill at 10% opacity, green text at 100%
- 0.6–0.8 : amber fill at 10% opacity, amber text at 100%
- < 0.6 : gray fill at 10% opacity, gray text at 100%

No "high fit ⭐" decoration. The number speaks for itself.

### #drafts
Same card pattern as #signals, but each card shows a draft message in a 2-line preview. The author/time row is the *original signal*, not the draft (so the founder remembers what this is replying to). The draft preview sits in a quoted block with a 2px left border in the secondary text color, indented 12px. Below the preview, two buttons: "Approve" (primary) and "Reject" (secondary). Right-aligned, 32px tall, 13px text.

When approved, the card animates *out* of #drafts — slide right + fade — and appears at the top of #sent. Total animation: 300ms. Then it stops. No celebration.

### #sent
Same cards, but no action buttons. The Approve/Reject row is replaced with a single 12px secondary line: "sent · 2m ago" or "approved · 8:32 AM" (the demo doesn't actually post; "sent" is just the state name we're using). Cards in #sent are slightly muted — 90% opacity instead of 100%. Past tense in tone.

### #briefing
This is the one channel that doesn't feel like a feed. It's two things, stacked:

1. **The morning briefing** at the top — a single large card, full width, with a soft surface fill (the secondary background color). Inside: a small "Today" label in 11px secondary, the date, then 3-5 sentences of summary prose. No bullet points. Just paragraphs. This is Chief of Staff's voice.

2. **Below the briefing**: a thin "Earlier" header, then a reverse-chronological list of past briefings, each collapsed to a single line showing the date and a 12-word summary. Click to expand.

Watcher's competitor alerts also land here as small inline cards between briefings. They're visually identical to signal cards in #signals but with a small "competitor move" pill at the top in gray.

### #ask
This is the only chat-shaped channel. The layout is inverted from the others: the input sits at the bottom (sticky), and the conversation flows upward. Messages from the founder are right-aligned, sit on the secondary surface color. Messages from Chief of Staff are left-aligned, on the primary surface color (no fill, just the page background).

Chief of Staff's messages can contain inline citations. A citation looks like a small superscript number (¹) at the end of the sentence it supports, in the secondary text color, slightly raised. Clicking a citation opens the Lead Card modal scrolled to the relevant retrieval.

Streaming is allowed here — text appears word-by-word as Claude generates it. Cursor at the end while streaming. No bouncing dots.

---

## The Lead Card modal — the centerpiece

This is the most important UI in Burrow. The whole pitch lives or dies on whether this modal feels like a trustworthy document or like a chatbot output. Spend disproportionate time here.

### When it opens
The user clicks any card in #signals or #drafts (or a citation in #ask). The modal slides up from the bottom of the viewport, 200ms ease-out. The page behind it dims to 40% black overlay. Modal width: 720px, centered. Max height: 80vh. If content overflows, the modal's *inner* region scrolls; the modal itself is fixed.

A close button (X icon, 20px) sits in the top-right corner of the modal. ESC also closes it. Clicking the dim overlay closes it.

### The modal layout

Vertical stack, divided into clearly labeled regions with thin 1px dividers between them. Each region has a small label header in 11px secondary uppercase letterspacing 0.05em (this is the one place uppercase is allowed, for region labels only).

```
┌──────────────────────────────────────────────────────────┐
│ ┌─ Source ─────────────────────────────────────────── X ┐│
│ │                                                       ││
│ │ Reddit · u/infra_will · r/LocalLLaMA · 4m ago        ││
│ │                                                       ││
│ │ "Anyone else getting destroyed by Pinecone pricing?  ││
│ │  We're 14 people, ~200M vectors, just got our bill   ││
│ │  and I'm seriously considering moving to Qdrant..."  ││
│ │                                                       ││
│ │ View original →                                       ││
│ └───────────────────────────────────────────────────────┘│
│                                                          │
│  ─ Assessment ───────────────────────────────────────    │
│                                                          │
│  Fit score: 0.84 · public reply                          │
│                                                          │
│  Matches Initech pattern (won): same team size band,    │
│  same Pinecone trigger, same 'don't want to babysit     │
│  infra' signal — which is exactly the wedge we used     │
│  to close them.                                          │
│                                                          │
│  ─ Evidence ─────────────────────────────────────────    │
│                                                          │
│  [3 retrievals · click any to expand]                   │
│                                                          │
│  ▸ won_deal · Initech              0.89                  │
│  ▸ lost_deal · Acme                0.71                  │
│  ▸ brand_guide · ICP definition    0.83                  │
│                                                          │
│  ─ Draft ────────────────────────────────────────────    │
│                                                          │
│  ┃ Been there — at 200M vectors the Pinecone bill       │
│  ┃ curve gets brutal. Self-hosted Qdrant is technically │
│  ┃ fine at your scale but the cluster ops realistically │
│  ┃ eat ~1 eng-week/month if no one's done it before.    │
│  ┃ We costed it out for a team your size recently,      │
│  ┃ happy to share the spreadsheet if it's useful.       │
│                                                          │
│  Grounded in: brand_guide voice (0.81), Initech         │
│  proven message (0.79). Show evidence →                  │
│                                                          │
│                              [Reject]  [Approve, send]   │
└──────────────────────────────────────────────────────────┘
```

### The Evidence region (most important)

This is where the product proves it isn't hallucinating. Each retrieval is a collapsible row.

**Collapsed state**: one line. Icon (small, indicating the doc_type), the doc_type label and the page slug, the relevance score on the right. A subtle chevron at the left edge indicates expandability.

**Expanded state**: the row expands downward to reveal:
- The full retrieved snippet (the actual text ZE returned), in body weight, slightly indented, in a quoted block.
- A small footer: "from `/won_deals/initech.md` · indexed 2 days ago · rank 1 of 5"
- A "Re-run this query" link that the founder can click to see if the corpus has changed since the lead was scored.

Multiple rows can be expanded at once. Smooth expand animation (200ms, ease-out on height + opacity).

The Evidence region is what closes the trust gap. Treat it as a document, not a UI element — generous line-height (1.7), longer measure than the rest of the modal, almost like reading a footnote in a well-typeset book.

### The "What changed?" affordance

Tucked at the very bottom of the modal, below the Approve/Reject row, a small secondary-text link: "What changed since this was scored?" Clicking it re-runs the Analyst's retrieval against the current brain state and shows a diff: which docs would rank differently now, whether the fit_score would shift, what's new in the corpus. This is the data flywheel made visible.

---

## Color system

A deliberately small palette. Two ramps + neutral grays + four semantic colors. That's the whole system.

### Neutrals (do 90% of the work)
- `bg-base` — the page background, very subtle warm off-white
- `bg-surface` — cards, the slightly lifted surface
- `bg-elevated` — the modal, the dropdown, the things that sit above
- `text-primary` — body text, ~95% black equivalent (not pure black, never pure black)
- `text-secondary` — labels, metadata, captions (~60% of primary)
- `text-tertiary` — disabled, hints (~40%)
- `border-subtle` — thin dividers, card borders (~10% opacity black)
- `border-default` — input borders, button outlines (~20%)

Use Linear's or Stripe's neutral palette as a reference. Warm-leaning grays, not cold blue-grays.

### The two accent ramps
- **Primary action** — a deep ink-blue or a near-black. Used only for: primary buttons (Approve), selected channel highlight, the cursor in #ask, and 1-2 other moments. **Not a brand blue.** Not Slack blue. Not Facebook blue. Almost-black with a hint of cool. The kind of blue that reads as "ink" not "tech."
- **Accent** — used only for the fit score badges and competitor alert pills. Don't use this anywhere else.

### The four semantic colors (sparingly)
- `green` — used only on the fit score badge when ≥ 0.8, and the live-status dot. That's it.
- `amber` — fit score badge in 0.6–0.8 range. That's it.
- `red` — only on the Reject button hover state and on validation errors. Not on the Reject button by default.
- `blue` — never on its own. Use the primary ramp instead.

### Dark mode
Mandatory. Every color above has a dark mode equivalent. The dark mode background is *not* pure black — it's a very dark warm gray (#0F0E0D or similar). Test every screen in both modes before considering it done.

---

## Typography

One typeface for everything. Two weights. No exceptions.

### The typeface
Inter, or — better — a more characterful sans like **GT America**, **Söhne**, or **ABC Diatype**. If those aren't accessible, Inter is fine. Avoid Roboto and Open Sans (read as cheap). Avoid Geist (read as default-Vercel). System fonts (`-apple-system, BlinkMacSystemFont`) are an acceptable fallback.

For a single monospace use (in #ask citations or any code-like display), use **JetBrains Mono** or **IBM Plex Mono**. Not Courier.

### The scale
A short, opinionated type scale. Memorize it.

- 11px — region labels (uppercase, letterspaced 0.05em, weight 500)
- 12px — metadata, captions, secondary text (weight 400)
- 13px — buttons, dense UI labels (weight 500)
- 14px — channel names, table-like text (weight 400)
- 15px — body text in cards and messages (weight 400)
- 16px — body text in the briefing card and the modal's draft block (weight 400)
- 18px — top strip primary numbers (weight 500)
- 22px — section headers inside the modal, briefing date (weight 500)
- 28px — page-level title (only used on the briefing's "Today" date — used once)

Two weights only. **400 regular, 500 medium.** No bold (700). No light (300). No black (900). This is non-negotiable. Heavy weights read as marketing site, not as tool.

### Line height
- Tight (1.3) — UI labels, button text, single-line metadata
- Comfortable (1.55) — body in cards
- Reading (1.7) — the Evidence snippets and the briefing prose, where the user actually reads

### Case
Sentence case everywhere. Region labels (`SOURCE`, `EVIDENCE`) are the only uppercase. No Title Case on buttons, channels, or anywhere else.

---

## Spacing

A small fixed scale. Pick the increment, don't free-hand pixel values.

- 4, 8, 12, 16, 24, 32, 48, 64

Most spacing is 12 or 16. Card padding: 16. Section padding inside the modal: 24. Page margin around the main pane: 32. Between sections in #briefing: 48.

**Card density**: signals and drafts feed feels like a Linear issue list. Compact but not cramped. ~12px vertical between cards, 16px padding inside each.

**Whitespace is a feature.** If a screen feels too empty, that's correct. If it feels too full, you've over-decorated.

---

## Motion

Tight, useful, almost invisible. The user should not be able to point at any specific animation and remember it.

### Allowed
- Fade in on initial render (150ms, ease-out)
- Slide-in for the modal (200ms, ease-out, from below)
- Cards in #drafts sliding out when approved (300ms, ease-in-out)
- Live counter updates: 200ms opacity fade between old and new value
- Hover state on cards: background color transition over 100ms
- Chevron rotation when expanding an evidence row (200ms, ease-out)
- Streaming text in #ask only

### Not allowed
- Bouncing
- Springs
- Bezier curves with overshoot
- Anything longer than 400ms
- Anything that loops
- Anything that pulses
- "Shimmer" loading states (use a thin progress bar or a static "Loading" instead)

---

## Loading and empty states

### Loading
A 1px progress bar at the top of the affected region. That's it. No skeleton screens with shimmer. No "Loading…" overlay.

For the Analyst's score-computing state on a freshly-arrived signal card, show "Analyzing" in 12px secondary text on the right side of the card where the fit badge will eventually appear. When the score arrives, the text is replaced by the badge with a 200ms crossfade.

### Empty
When a channel has no items, show a small centered message. Not an illustration. Not "🎉 You're all caught up!". Just one line in 14px secondary text:

- #signals empty: "No signals yet. Scout runs every 30s."
- #drafts empty: "Nothing pending."
- #sent empty: "Nothing sent yet."
- #briefing empty: "Your first briefing posts tomorrow morning."
- #ask empty: "Ask Chief of Staff anything about your pipeline."

That's the entire empty state. No illustration. No CTA. No suggested prompts.

---

## Icons

Use **Tabler Outline** or **Lucide**. Outline only, never filled. 16px or 20px, never larger. Set color to inherit; let the parent decide.

The handful of icons you'll need:
- channel/feed
- inbox
- send/paper-airplane
- briefing/sun (only for the morning briefing date, and only as a small inline 14px)
- ask/message-circle
- close X
- chevron-down (for expansion)
- check (for approved state)
- external-link (for "View original")
- alert-triangle (for competitor moves — gray, not red)

No emoji. No custom illustrations. No agent avatars beyond the monogram squares.

---

## Agent identity

The agents are *roles*, not characters. Represent them as 24×24 rounded squares with a single letter and a flat fill color from a five-color sequence (one per agent). The fill is desaturated — think 30% saturation, not 80%.

- Scout — S — muted teal
- Analyst — A — muted purple
- Writer — W — muted coral
- Watcher — Wa — muted amber
- Chief — C — muted gray

That's the entire agent visual identity. They don't have faces. They don't have catchphrases. They don't say "Hi! I'm Scout 👋". Their messages in #ask are signed in 11px secondary text below the message: "— Chief of Staff".

---

## Copy tone

You're not designing copy, but a few rules in case any UI text needs writing:

- Sentence case, never Title Case
- Active voice
- Direct, not chatty: "4 drafts pending" not "You have 4 drafts pending right now!"
- Past tense for completed states: "approved 8:32 AM" not "✓ Approved!"
- No exclamation points
- No "Oops" or "Uh oh" for errors. Just: "Couldn't reach TheHog. Retrying."
- No "Let me…" or "I'll…" from the agents. They state, they don't narrate.

---

## What "done" looks like

The frontend is done when:

1. A judge can look at the screen for five seconds and not be able to tell whether this is a finished product or a hackathon demo.
2. No screenshot of any screen would feel out of place in a Linear changelog post.
3. The Lead Card modal renders well enough to make a screenshot of it the hero image of the pitch.
4. Dark mode works on every screen.
5. Nothing pulses, glows, gradients, or sparkles.
6. The user can read the Evidence section comfortably without zooming.

If you find yourself adding a flourish to make a screen feel "more designed," delete a different element instead. The final design should feel restrained to the point of being slightly austere. That's correct. Burrow's pitch is grounded retrieval and trust; the UI has to *be* trustworthy, which means it has to feel like a tool a serious person uses, not a demo someone built in a weekend.

The best version of this UI looks boring in the way that good tools look boring. Make it boring.
