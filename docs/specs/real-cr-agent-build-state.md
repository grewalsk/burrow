# Burrow — Real cr_agent Build State

**Branch:** `feat/real-cr-agent`
**Branched from:** `feat/full-build`
**Audience:** the next coding agent picking this up

---

## TL;DR

Frame 2's `cr_agent` no longer feeds hardcoded Initech data into Frame 3.
It actually crawls the user's website (via Jina Reader), discovers the most
relevant subpages from the homepage's own links, and extracts structured
company facts (via Gemini Flash) into the shape Frame 3's `ConfirmForm`
expects.

If `GOOGLE_GENAI_API_KEY` is missing or extraction fails, the API falls
back to a minimal doc seeded with raw page content so the user can still
edit and proceed — the flow never blocks on a third-party failure.

The Frame 2 animation is unchanged — it's still ~6s of fake page paths. It
runs in parallel with the real API call and the Continue button is gated on
**both** the animation finishing and the research being ready.

---

## What's running

1. **Frame 1** — user types URL, hits Submit
2. **OnboardingFlow** fires `POST /api/research { url }` in the background
   and advances phase to `researching`
3. **Frame 2** — existing crawl animation plays. Status bar reads
   `"researcher running…"` then `"extracting facts…"` if the API is slower
   than the animation, then `"researcher idle · N/M pages read · extracted"`
   once the API returns
4. **Continue button** is `disabled={sub !== "done" || !researchReady}` — both
   conditions must clear before the user can proceed
5. **Frame 3** — `ConfirmForm` initial state = real `Doc` from the API
   (falls back to `FALLBACK_DOC` only if research failed entirely)

---

## File map (new and modified)

```
app/
  api/
    research/
      route.ts                    ← NEW: POST /api/research
  onboarding/
    OnboardingFlow.tsx            ← MODIFIED:
                                    - researchDoc / researchReady / researchMeta state
                                    - startResearch() fires POST /api/research
                                    - Researching gates Continue on researchReady
                                    - ConfirmForm accepts initialDoc prop
                                    - FALLBACK_DOC extracted for when API fails

lib/
  researchClient.ts               ← NEW: crawlSite (two-pass), extractWithGemini,
                                    fallbackDoc, research orchestrator, classifyError,
                                    in-memory cache

.env.example                       ← MODIFIED: documented GOOGLE_GENAI_API_KEY

package.json                       ← MODIFIED: added @google/generative-ai
```

---

## API contract

### `POST /api/research`

**Body (JSON):**
```ts
{ url: string }
```

URL can be bare (`"vercel.com"`) or full (`"https://vercel.com/"`). The
wrapper normalizes both.

**Server pipeline (`lib/researchClient.ts → research()`):**

1. Normalize URL (add `https://` if missing, strip trailing slash)
2. **Cache check** — module-level `Map<normalizedUrl, { result, expiresAt }>`
   with 10-minute TTL. Returns cached result with `cached: true` if hit.
3. **Pass 1 — fetch homepage** via Jina Reader (`r.jina.ai/<url>`)
   with an 8s timeout.
4. **Discover subpaths** — parse the homepage's markdown links, keep only
   same-host paths, filter out asset URLs (`.pdf`, `.png`, etc.) and
   too-deep paths (>3 segments), then score each by relevance:
   - **Positive keywords**: pricing, plans, about, company, team, story,
     product, features, capabilities, platform, solutions, customers,
     case-studies, testimonials, use-cases, how-it-works
   - **Negative (drop)**: blog, docs, login, signup, register, careers,
     legal, privacy, terms, support, contact, press, changelog, status
   - Top 6 highest-scored paths are picked
5. **Pass 2 — fetch discovered paths in parallel.** If discovery returned
   zero usable paths, fall back to a fixed list (`/about /pricing /features
   /customers /product`). 8s timeout per page.
6. **Combine markdown** — cap each page at 15K chars, total at 60K chars
   (Gemini 2.5 Flash Lite has 1M-token context but more isn't better —
   noise hurts extraction). Each section is labeled with `# Source: <url>`
   for the model to attribute stories.
7. **If 0 pages came back** → return fallback with
   `fallback_reason: "no_pages_fetched"`.
8. **If no `GOOGLE_GENAI_API_KEY`** → return fallback seeded with raw
   markdown, `fallback_reason: "no_api_key"`.
9. **Otherwise** — feed combined markdown to Gemini Flash with a structured
   JSON schema and an extraction prompt that includes ✅/❌ examples for
   each field and an explicit ignore-noise list (nav menus, cookie banners,
   signup CTAs, etc.). Return extracted `Doc`.
10. **On Gemini failure**, log full error server-side (`console.error`) and
    return fallback with one of these `fallback_reason` strings:
    `rate_limited`, `gemini_timeout`, `auth_failed`, `parse_failed`, or a
    truncated error message.
11. **Cache successful Gemini extractions only.** Don't cache failures —
    a transient rate-limit window or timeout shouldn't poison the cache.

**Returns:**
```ts
{
  doc: Doc,                          // always present
  pages_crawled: number,             // pages we attempted
  pages_read: number,                // pages that returned non-empty content
  paths_fetched: string[],           // the actual paths we read (useful for debugging)
  source: "gemini" | "fallback",
  fallback_reason?: string,          // only set when source === "fallback"
  cached?: boolean,                  // true if served from cache
}
```

**Runtime:** `nodejs`, `maxDuration = 60`. Typical latency: 5–12s
(Jina: 2–6s for ~7 parallel fetches + Gemini: 2–4s). Requires Vercel Pro
for prod since the function can run >10s.

---

## Model selection — important context

The default model is `gemini-2.5-flash-lite`. **Do not assume any Gemini
2.0 model has free-tier access.** During development we discovered that
`gemini-2.0-flash` and `gemini-2.0-flash-lite` both return:

```
429 Too Many Requests
Quota exceeded for metric: generate_content_free_tier_requests, limit: 0
```

`limit: 0` means "not in your free tier at all" — it's NOT a normal rate
limit. Many newer Google Cloud projects have free-tier quota = 0 for the
2.0 production models. The Gemini docs do not flag this clearly.

The lite variants of 2.5 (`gemini-2.5-flash-lite`) are reliably free-tier
enabled with the largest free quota (15 RPM, 1000/day, 1M TPM). Same
JSON-schema mode, same call shape.

**Override via env:**
```bash
GEMINI_MODEL=gemini-2.5-flash       # better quality, also free-tier OK
GEMINI_MODEL=gemini-flash-latest    # tracks Google's latest stable flash
```

To verify which models YOUR API key has free-tier access to:

```bash
KEY=$(grep GOOGLE_GENAI_API_KEY .env.local | cut -d= -f2)
for M in gemini-2.5-flash-lite gemini-2.5-flash gemini-2.0-flash gemini-flash-latest; do
  R=$(curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/models/${M}:generateContent?key=${KEY}" \
    -H "Content-Type: application/json" \
    -d '{"contents":[{"parts":[{"text":"hi"}]}]}')
  echo "$M: $(echo "$R" | python3 -c "import json,sys; d=json.load(sys.stdin); print('OK' if 'candidates' in d else d.get('error',{}).get('message','?')[:80])")"
done
```

---

## Why these choices

### Why Jina Reader (vs. Firecrawl, Playwright, plain fetch)

- **Free** and unauthenticated for normal volumes
- Returns clean markdown (handles JS rendering server-side via headless Chrome)
- Zero deps to install — just `fetch("https://r.jina.ai/<url>")`
- Tolerates 404s gracefully

Tradeoff: rate-limited; can be slow (2–6s per page). For a hackathon demo
with ~7 parallel fetches per submit, fine.

### Why two-pass discovery (vs. fixed subpath list)

The original implementation hit a fixed list (`/about /pricing /features
/customers /product`). That broke on sites using `/company`, `/plans`,
`/how-it-works`, `/use-cases`, etc. — i.e. most non-cookie-cutter SaaS.
Two-pass discovery extracts real internal links from the homepage
markdown, ranks by relevance, then fetches the top N. The fixed list
is now a fallback only used when homepage fetch fails entirely.

Example: `characterquilt.com` discovers `/how-it-works /use-cases /pricing`
— none of which are in the fallback list.

### Why Gemini 2.5 Flash Lite (vs. Haiku, GPT-4o-mini)

- **Free tier available** (verified) — no credit card needed
- Structured JSON output mode with schema enforcement
- Comparable extraction quality to Haiku on this task
- Largest free quota of any Gemini model (1000 req/day)

### Why the animation is still fake

The existing animation has a "Skip animation" button that already lets
users bypass it. Making the animation reflect real Jina output would
require streaming the API response, which doubles the implementation
surface area without changing the user-visible outcome (Frame 3 is what
they actually care about). Defer to post-MVP.

### Why the prompt has explicit ✅/❌ examples

Gemini (like other LLMs) tends to copy marketing language verbatim from
website content if you just say "extract a one-liner." Showing a contrast
between founder-voice and marketing-voice — "The fastest deployment
platform for frontend teams" (good) vs. "Vercel is a comprehensive cloud
platform empowering developers with modern web development solutions"
(bad) — moves the output toward the punchy version.

The prompt also has an explicit IGNORE list: nav menus, footer link
lists, cookie banners, signup CTAs, social media follow boxes. Without
this, Jina's verbose markdown caused the model to surface "Skip to
content" and "Sign up for our newsletter" as features.

---

## Known limitations / next-task list

1. **Animation doesn't reflect real pages.** It still shows fake Initech
   paths. To make it real, the API would need to stream pages-discovered
   events back to the client (SSE or chunked response).
2. **No URL validation.** Typing "asdf" tries to fetch `https://asdf`
   and gets 0 pages. Falls back gracefully but a "that doesn't look like
   a URL" hint before submit would be nicer.
3. **Discovery may miss paths the homepage doesn't link to.** Some sites
   bury `/pricing` behind a CTA that's only in the nav. We get nav links
   from the markdown but not always.
4. **Gemini quota** is 1000/day on free 2.5-flash-lite. If you actually
   scale, you'll need a paid tier or to cache more aggressively.
5. **No retry on Gemini failure** — falls back immediately. Could add a
   single retry with simpler prompt if structured output fails to parse.
6. **Cache is per-process.** Resets on dev server restart. Acceptable
   for hackathon; would need Redis/KV for production.
7. **Stories with no source URL get `src: ""`.** The Doc type requires
   `src` to be a string but ConfirmForm displays empty strings as a blank
   span. Visually fine but not ideal.

---

## How to verify it's actually working

### Smoke test the API directly

```bash
# Real extraction (assuming GOOGLE_GENAI_API_KEY is set)
curl -s -X POST http://localhost:3000/api/research \
  -H "Content-Type: application/json" \
  -d '{"url":"characterquilt.com"}' | jq '
    {source, fallback_reason, paths_fetched,
     one_liner: .doc.one_liner,
     features: .doc.features,
     pricing_tier_count: (.doc.pricing | length)}'

# Look for:
#   "source": "gemini"
#   A real one_liner (not "Company at https://...")
#   features array with 3-7 entries
#   pricing_tier_count > 0 for sites with public pricing
```

### Verify the cache

Run the same curl twice within 10 minutes:

```bash
curl -s -X POST http://localhost:3000/api/research \
  -H "Content-Type: application/json" \
  -d '{"url":"characterquilt.com"}' | jq '.cached'
# First call: null
# Second call (within 10m): true
```

### Debug a failed extraction

If `source === "fallback"` and `fallback_reason !== "no_api_key"`, the
full Gemini error is logged server-side. Read it from the dev server log:

```bash
tail -50 /tmp/burrow-dev.log
```

Look for `[research] Gemini extraction failed for ...` — the full error
object follows, including the HTTP status and Google's quota violation
details.

### Verify the UI end-to-end

1. Visit `http://localhost:3000/onboarding`
2. Type a real company URL (e.g. `linear.app`, `stripe.com`, `characterquilt.com`)
3. Hit Submit. Frame 2 animation plays.
4. When animation finishes, status bar should read
   `"researcher idle · N/M pages read · extracted"`
5. Continue. Frame 3 fields should be populated with **real** content
   from the company's website, not Initech defaults.
