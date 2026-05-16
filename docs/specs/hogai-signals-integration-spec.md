# Burrow — HogAI Signals Integration Spec

**Branch:** `feat/hogai-signals`
**Branched from:** `feat/full-build`
**Replaces:** `lib/mockHogAI.ts` consumers in the signals pipeline
**Status:** Spec ready for implementation

---

## TL;DR

Replace the mock signal-fetching pipeline with real HogAI calls. Three routes change:

- `POST /api/signals/fetch` — was synchronous mock; becomes async kick-off returning a `jobId`
- `GET /api/signals/status` — NEW; client polls until HogAI finishes, then we parse + store in ZE
- `POST /api/signals/enrich` — was mock; becomes real HogAI enrichment for ONE signal at a time, on-demand

Signals are stored in the existing `brain-<sessionId>` ZE collection with `doc_type: "signal"`. A different engineer wires up rerank-at-draft-time using those docs.

---

## Constraints + key decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Client-side polling (not server-side blocking) | HogAI deep-research takes ~4 minutes. Vercel max 60s. Server can't hold connection. |
| 2 | Request 5 signals per fetch (not 20) | User explicitly chose 5. Cheaper credits, faster perceived UX. Plenty for demo. |
| 3 | Enrich on-demand only (one signal at a time, when user clicks Draft) | User explicit. Don't burn enrichment credits on signals never used. |
| 4 | Reddit signals = reply-mode only, no enrichment | Reddit usernames rarely yield emails. Auto-route to "Reply on Reddit" path. |
| 5 | LinkedIn/X signals: try enrichment, fall back to reply-mode if no email returned | Best-effort. Always have a path forward. |
| 6 | No rerank in this scope | Another engineer owns it. We just store signals in ZE with rich metadata. |
| 7 | Cache fetches by workspace ID for 24h | User has 42K credits; 1K per fetch. Cache aggressively, refresh on user-triggered "Refresh". |

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│  Signals Dashboard                                                      │
└────────────────────────────────────────────────────────────────────────┘
       │
       │  user clicks "Fetch Signals"
       ▼
POST /api/signals/fetch
       │
       ├─ Read sessionId from burrow_session cookie
       ├─ Check ZE for cached signals (fetched within 24h, doc_type=signal)
       │    → if cached, return those immediately with cached:true
       │
       ├─ Read company info from ZE:
       │    listDocuments({ filter: { doc_type: "brand_guide" } }) → one_liner, description, features
       │    listDocuments({ filter: { doc_type: "icp" } }) → icp
       │    listDocuments({ filter: { doc_type: "competitor_intel" } }) → competitor names
       │
       ├─ Build HogAI prompt (see PROMPT DESIGN below)
       │
       ├─ POST hog/api/deep-research { prompt, schema } → { operationId }
       │
       └─ Return { jobId: operationId, status: "queued" }    (returns in ~1s)
                                                │
                                                ▼
            Client persists jobId in localStorage.burrow.signalsJobId
            Renders "Researching signals… ~3-5 min" with elapsed counter

       │  client polls every 10 seconds
       ▼
GET /api/signals/status?jobId=XXX
       │
       ├─ GET hog/api/operations/{jobId}
       │
       ├─ If result.status in {processing, queued, pending, running}:
       │     return { status: "processing", elapsed_s }
       │
       ├─ If result.status === "succeeded":
       │     ├─ Parse result.data.signals[] (HogAI nests once)
       │     ├─ For each signal:
       │     │      - signal_id = sha256(post_url).slice(0, 16)
       │     │      - addTextDocument({
       │     │           collection: brain-<sessionId>,
       │     │           path: `signal-${signal_id}.txt`,
       │     │           text: post_text,
       │     │           metadata: { doc_type:"signal", platform, author_handle,
       │     │                       author_profile_url, post_url, pain_point,
       │     │                       why_relevant, fetched_at, enriched:"false",
       │     │                       outreach_mode: platform==="Reddit"?"reply":"email",
       │     │                       status:"new", sample:"false" }
       │     │        })
       │     └─ Return { status: "done", signals: [...parsed], cached: false }
       │
       ├─ If result.status === "failed":
       │     return { status: "failed", error: result.error }
       │
       └─ Clear localStorage.burrow.signalsJobId on terminal status

       │
       │  user clicks "Draft email" on a specific signal
       ▼
POST /api/signals/enrich { signal_id }
       │
       ├─ Read signal from ZE (filter doc_type=signal, signal_id matches)
       │
       ├─ If platform === "Reddit":
       │     → no enrichment; return { mode: "reply", platform: "Reddit",
       │                                handle, post_url }
       │     → write metadata.outreach_mode = "reply"
       │
       ├─ Otherwise (X, LinkedIn):
       │     ├─ Build enrichment payload:
       │     │      LinkedIn: { linkedinUrl: author_profile_url }
       │     │      X:        { xUserId: author_handle }
       │     │
       │     ├─ POST hog/api/enrichments → { operationId }
       │     │
       │     ├─ Poll hog/api/operations/{id} (block server-side, 60s max — enrichment is faster than deep-research)
       │     │
       │     ├─ If returns email:
       │     │     mode = "email"
       │     │     update ZE metadata: enriched:"true", enriched_email, enriched_name,
       │     │                          enriched_role, enriched_company, outreach_mode:"email"
       │     │
       │     └─ If returns no email (HogAI returns null/missing email field):
       │           mode = "reply"
       │           update ZE metadata: enriched:"true", outreach_mode:"reply"
       │
       └─ Return { mode, contact?, platform, handle, post_url }
                       │
                       ▼
                The existing /api/drafts/generate already accepts a signal +
                contact and uses Gemma. It needs a small tweak to handle
                mode:"reply" differently from mode:"email" (different prompt,
                shorter output, no subject line for replies).
```

---

## Prompt design

```
You are sourcing outreach signals for a sales team. Find recent social media
posts (last 60 days) where someone is expressing a pain point that this
company solves, or actively considering switching from a tool in their
category.

OUR COMPANY:
{{one_liner}}

{{description}}

WHO WE SELL TO:
{{icp}}

WHAT WE OFFER:
{{features.join(", ")}}

COMPETITORS WE OFTEN REPLACE:
{{competitors.join(", ")}}    (skip this section if no competitors known)

LOOK FOR POSTS WHERE SOMEONE:
- Is frustrated with their current tool in our category and considering switching
- Is asking for tool recommendations in our category
- Mentions a specific pain point we solve, using language from WHO WE SELL TO
- Is actively migrating from a competitor we listed
- Is comparing solutions and undecided

PLATFORMS: LinkedIn, X (Twitter), Reddit. Try to include at least one from
each platform if possible.

QUALITY > QUANTITY. Skip generic posts. Skip posts that are just news
commentary. Find posts where the author would benefit from a personal reply.

Return 5 signals.

FOR EACH SIGNAL RETURN:
- platform: exactly one of "X", "Reddit", "LinkedIn"
- author_handle: bare username (e.g. "thehaydenbunn" not "@thehaydenbunn",
  "u/SpecialistAd7913" → "SpecialistAd7913")
- author_profile_url: full profile URL we can use for enrichment later
  (e.g. https://linkedin.com/in/jane-doe, https://x.com/thehaydenbunn,
   https://reddit.com/user/SpecialistAd7913)
- post_url: link to the specific post
- post_text: the actual post text (not summarized)
- pain_point: 1 sentence — what they're frustrated about, in THEIR framing
- why_relevant: 1 sentence — why this is a fit for OUR product specifically
```

Schema (passed to HogAI as the `schema` parameter):

```ts
{
  type: "object",
  properties: {
    signals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          platform: { type: "string" },
          author_handle: { type: "string" },
          author_profile_url: { type: "string" },
          post_url: { type: "string" },
          post_text: { type: "string" },
          pain_point: { type: "string" },
          why_relevant: { type: "string" },
        },
        required: ["platform", "author_handle", "post_url", "post_text"]
      }
    }
  },
  required: ["signals"]
}
```

---

## ZE storage shape

Stored in the existing `brain-<sessionId>` collection (shared with company docs, distinguished by `doc_type: "signal"`).

```
document_path: `signal-${sha256(post_url).slice(0,16)}.txt`
content:       text/plain — the post_text
metadata: {
  doc_type:           "signal",
  signal_id:          short sha256 of post_url (matches part of path),
  platform:           "X" | "Reddit" | "LinkedIn",
  author_handle:      "thehaydenbunn",
  author_profile_url: "https://x.com/thehaydenbunn",
  post_url:           "https://x.com/thehaydenbunn/status/...",
  post_text:          "...",
  pain_point:         "Frustrated with GHL costs and capability ceiling",
  why_relevant:       "Active CRM evaluation — open to alternatives we replace",
  fetched_at:         String(Date.now()),
  outreach_mode:      "email" | "reply",  // inferred from platform at fetch
  enriched:           "false" | "true",
  enriched_email:     "" (filled on enrichment),
  enriched_name:      "" (filled on enrichment),
  enriched_role:      "",
  enriched_company:   "",
  status:             "new" | "ranked" | "enriched" | "drafted",
  sample:             "false"
}
```

All values are `string` (ZE requirement).

---

## File map

```
lib/
  hogClient.ts             ← NEW: hogFetch helper (auth, JSON, error classify),
                              pollHogOperation (used by enrichment only;
                              status route polls inline so it can return mid-poll)
  signalsClient.ts         ← NEW: buildSignalsPrompt(workspace), parseSignals(result),
                              storeSignals(sessionId, signals[])

app/
  api/
    signals/
      fetch/route.ts       ← REWRITE: company info lookup → build prompt →
                              kick off HogAI → return jobId
      status/route.ts      ← NEW: proxy HogAI operations poll, on done
                              parse + store signals in ZE
      enrich/route.ts      ← REWRITE: one signal at a time, real HogAI call,
                              handle Reddit (skip enrich), handle no-email
                              (fallback to reply mode)

lib/
  types.ts                 ← ADD: ParsedSignal, EnrichmentResult types

.env.example               ← ADD: THEHOG_ACCESS_KEY, THEHOG_SECRET_KEY,
                              THEHOG_BASE_URL

lib/mockHogAI.ts           ← KEEP (not deleted) as fallback if HOGAI_MOCK=true
```

Note: not touching `app/api/drafts/generate/route.ts` here. The "reply vs email" branch is the next engineer's problem — but they'll find `metadata.outreach_mode` already populated on the signal when they need it.

---

## Cache strategy

Module-level in-memory cache (per dev server process):

```ts
type CachedFetch = { jobId: string; completedAt?: number; signals?: ParsedSignal[] };
const cache = new Map<string, CachedFetch>(); // key = sessionId
```

Cache lifecycle:
- On `/api/signals/fetch`: if cache entry exists for sessionId AND completedAt within last 24h → return cached signals immediately with `cached: true`
- On `/api/signals/status` success: store the parsed signals in cache + ZE
- User can force refresh by passing `?force=true` to `/api/signals/fetch` (skips cache, kicks off new HogAI run)

Caveat: cache dies on dev restart. Production would use Redis. For hackathon: ZE is the persistent store anyway — even if the cache dies, the signals are still in ZE and can be listed via existing `/api/signals` GET route.

### In-flight fetch protection

If `/api/signals/fetch` is called while a jobId for the same sessionId is already in flight (cache entry exists with no `completedAt`), **return the existing jobId instead of starting a new HogAI run**. Otherwise the user could double-click "Fetch" and burn 2× credits. Response shape: `{ jobId, status: "queued", already_in_flight: true }`.

### Resumable on tab close

If the user closes the tab during the 4-min wait, the jobId persists in `localStorage.burrow.signalsJobId`. On dashboard reload, the client checks for that key and resumes polling `/api/signals/status?jobId=...`. HogAI retains the operation result for some window, so this works without any server-side persistence beyond the in-memory cache.

### Enrichment-safe upsert

ZE `addTextDocument` replaces the document — it does NOT merge metadata. If a signal post is re-fetched in a later HogAI run (same `post_url`, same `document_path`), a naive upsert would WIPE out `enriched_email` and other enrichment fields.

**Fix:** before calling `addTextDocument`, the storage helper checks `listDocuments({ filter: { signal_id: X } })` for an existing record. If it exists with `metadata.enriched === "true"`, copy the `enriched_*` fields into the new metadata before writing. If it doesn't exist or wasn't enriched, write fresh.

---

## Error handling

| Failure | Handling |
|---|---|
| Workspace has no company info (user hasn't completed onboarding) | Return 400 with message "Complete onboarding first" |
| HogAI returns 401/403 | Return 502 to client: "HogAI auth failed — check THEHOG_ACCESS_KEY/SECRET_KEY" |
| HogAI returns 429 | Return 502 to client: "HogAI rate-limited — wait a minute and retry" |
| HogAI deep-research operation fails | Status endpoint returns `{ status: "failed", error: hogError }` |
| HogAI returns 0 signals | Store nothing, return `{ status: "done", signals: [] }`. Dashboard shows empty state with "Try refreshing" |
| Signal post_url is missing or invalid | Skip that signal silently, log to console |
| Enrichment returns no email for X/LinkedIn signal | Fall back to reply mode, return `{ mode: "reply", platform, handle }` |
| ZE addTextDocument fails on one signal | Don't fail the whole batch; log and skip |

---

## Env vars (.env.example additions)

```bash
# HogAI (TheHog) — signals + enrichment
THEHOG_ACCESS_KEY=ak_...
THEHOG_SECRET_KEY=sk_...
THEHOG_BASE_URL=https://developer.thehog.ai

# Set to "true" to use the in-memory mockHogAI (existing behavior).
# When unset or "false", the real HogAI is used for fetch + enrichment.
HOGAI_MOCK=false
```

---

## What this spec does NOT cover (out of scope)

- **Rerank.** Another engineer owns scoring/sorting the 5 signals to surface "top opportunities."
- **Draft generation changes.** `/api/drafts/generate` already exists and uses Gemma. The "reply vs email" prompt switch is a follow-up — for now the next engineer reads `metadata.outreach_mode` and branches.
- **Streaming progress.** No SSE/WebSocket. Client polls every 10s. Simple.
- **Background jobs.** No Supabase Edge Functions, no Vercel cron, no queue. Job state lives in localStorage on the client + ZE for persistence.
- **Persistent cache across server restarts.** In-memory only. ZE is the source of truth.
- **`/api/signals` GET route** (lists current signals) — already exists, not touched.

---

## Verification

After implementation, verify:

1. **Happy path** — fetch with company info present, wait ~4 min, see 5 signals in dashboard with mixed platforms
2. **Cache hit** — fetch twice in a row, second returns `cached: true` in <100ms
3. **Force refresh** — `POST /api/signals/fetch?force=true` skips cache, kicks new HogAI run
4. **Reddit enrichment** — pick a Reddit signal, hit `/api/signals/enrich`, response has `mode: "reply"`, no enrichment API call burned
5. **X/LinkedIn enrichment** — pick an X signal, hit enrich, get email back (mode: "email") OR get mode: "reply" fallback
6. **Empty signals** — if HogAI returns 0, dashboard shows clean empty state, no crash
7. **ZE persistence** — restart dev server, signals still appear in `/api/signals` GET (they're in ZE)
