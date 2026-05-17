# Burrow

Software has never been cheaper to build. A founder with Claude Code and a weekend can ship a real product. But distribution hasn't gotten cheaper, and now we have a strange new bottleneck: we can produce far more software than the public can evaluate. Good products die unheard while mediocre ones win on outreach. Existing "AI outreach" tools make this worse, shipping templated slop at industrial scale.

**Burrow is a fully AI-native growth team.** Paste your URL. A researcher agent reads your site, confirms your product, customers, and voice, then ingests private docs (past wins, lost deals, brand guide) as your "brain." Burrow then hunts public signals where someone is openly complaining about a problem you solve, ranks them against your actual ICP, and drafts five personalized emails citing the specific past win that mirrors each prospect's situation.

Under the hood, **TheHog** powers prospect discovery and deep research, surfacing buying signals and enriching candidates with real web intelligence. **ZeroEntropy's zerank reranker** sits on top of retrieval over your private corpus, so the customer story that actually mirrors each prospect surfaces first, in your voice, with one concrete ask.

---

## Setup

### 1. Install

```bash
git clone https://github.com/grewalsk/burrow.git
cd burrow
npm install
```

Requires Node.js ≥ 20.9.

### 2. Configure `.env.local`

Create `.env.local` in the project root with the following keys:

```bash
# ZeroEntropy — vector store for the company brain (won deals, ICP, brand guide, signals)
# Get a key at https://app.zeroentropy.dev/api-keys
ZEROENTROPY_API_KEY=ze_...

# Google AI Studio — Gemma 4 31B (cr_agent extraction + outreach draft generation)
# Free key, no credit card: https://aistudio.google.com/apikey
GOOGLE_GENAI_API_KEY=AIza...
# Optional model override; default is gemma-4-31b-it (free, unlimited daily, 15 RPM).
# Set to gemini-2.5-flash if you have paid Gemini access and want stronger reasoning.
# GEMINI_MODEL=gemma-4-31b-it

# TheHog — signals discovery (deep research) + contact enrichment
# Sign up at https://platform.thehog.ai
THEHOG_ACCESS_KEY=ak_...
THEHOG_SECRET_KEY=sk_...
THEHOG_BASE_URL=https://developer.thehog.ai
```

`.env.example` in the repo has the same template with comments.

### 3. Run

```bash
npm run dev          # http://localhost:3000
# or pick a different port:
./node_modules/.bin/next dev -p 3001
```

---

## Demo flow

1. Open `http://localhost:3000/onboarding` (clear `localStorage.burrow.onboarded` if you land on `/signals` instead).
2. **Frame 1** — enter your company URL.
3. **Frame 2** — researcher agent runs Jina Reader + Gemma 4 31B on your homepage and key subpages to extract your one-liner, ICP, features, pricing, competitors, and customer stories.
4. **Frame 3** — review and edit the extracted fields.
5. **Frame 3.5** — optionally upload past wins, lost deals, brand guide, ICP docs. Skip to use a sample corpus for the demo.
6. **`/signals` dashboard** — click "Fetch signals →" to kick off HogAI deep research against your ICP (~4 minutes, ~1000 credits). Returns 5 real social posts where someone is expressing a pain point you solve.
7. Click **"Generate outreach →"** to:
   - Rank signals with ZeroEntropy's `zerank-1-small` cross-encoder against your ICP + brand
   - Enrich the top candidates via TheHog (LinkedIn → email lookup, Reddit/X → reply mode)
   - Draft 5 personalized emails with Gemma 4 31B grounded in your win stories
8. **`/drafts` page** — see the generated outreach, ready to send.

---

## Architecture

- **Next.js 15 App Router** + TypeScript
- **ZeroEntropy** — Vector store; `zerank-1-small` cross-encoder for prospect reranking
- **TheHog** — `/api/deep-research` for signals; `/api/enrichments` for contact lookup
- **Google AI Studio** — Gemma 4 31B for cr_agent extraction and draft generation
- **Jina Reader** (`r.jina.ai`) — free web scraping for cr_agent

Session model: `burrow_session` cookie is rotated on each new onboarding so every URL = a fresh ZE collection (`brain-<sessionId>`). Drop the cookie, start over.

See `docs/specs/` for the full architecture and design specs.
