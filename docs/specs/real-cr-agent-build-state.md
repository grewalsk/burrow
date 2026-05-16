# Burrow — Real cr_agent Build State

**Branch:** `feat/real-cr-agent`
**Branched from:** `feat/full-build`
**Audience:** the next coding agent picking this up

---

## TL;DR

Frame 2 is no longer hardcoded fake data. The `cr_agent` now actually crawls
the user's website (via Jina Reader) and extracts structured company facts
(via Gemini Flash) into the shape Frame 3's `ConfirmForm` expects.

If `GOOGLE_GENAI_API_KEY` is missing or extraction fails, the API falls back
to a minimal doc seeded with raw page content so the user can still edit and
proceed.

The Frame 2 animation is unchanged — it's still ~6s of fake page paths. It
runs in parallel with the real API call and the Continue button is gated on
**both** the animation finishing and the research being ready.

---

## What's running

1. **Frame 1** — user types URL, hits Submit
2. **OnboardingFlow** fires `POST /api/research { url }` and advances phase to
   `researching`
3. **Frame 2** — existing crawl animation plays. Status bar reads
   `"researcher running…"` then `"extracting facts…"` if the API is slower
   than the animation, then `"researcher idle · N/M pages read · extracted"`
   once the API returns
4. **Continue button** is `disabled={sub !== "done" || !researchReady}` — both
   conditions must clear before the user can proceed
5. **Frame 3** — `ConfirmForm` initial state = real `Doc` from the API
   (falls back to `FALLBACK_DOC` if research failed entirely)

---

## File map (new and modified)

```
app/
  api/
    research/
      route.ts                    ← NEW: POST /api/research
  onboarding/
    OnboardingFlow.tsx            ← MODIFIED:
                                    - OnboardingFlow has researchDoc / researchReady state
                                    - startResearch() fires POST /api/research
                                    - Researching gates Continue on researchReady
                                    - ConfirmForm accepts initialDoc prop
                                    - FALLBACK_DOC extracted for when API fails

lib/
  researchClient.ts               ← NEW: crawlSite, extractWithGemini,
                                    fallbackDoc, research orchestrator

.env.example                       ← MODIFIED: added GOOGLE_GENAI_API_KEY block

package.json                       ← MODIFIED: added @google/generative-ai
```

---

## API contract

### `POST /api/research`

**Body (JSON):**
```ts
{ url: string }
```

URL can be bare ("vercel.com") or full ("https://vercel.com/"). The wrapper
normalizes both.

**Server pipeline:**
1. Normalize URL (add `https://` if missing, strip trailing slash)
2. Fetch in parallel via Jina Reader (`r.jina.ai/<url>`):
   - `/`
   - `/about`
   - `/pricing`
   - `/features`
   - `/customers`
   - `/product`
   Each fetch has an 8s timeout. 404s and timeouts are silently dropped.
3. If 0 pages came back → return fallback with `fallback_reason: "no_pages_fetched"`
4. If no `GOOGLE_GENAI_API_KEY` → return fallback seeded with raw markdown,
   `fallback_reason: "no_api_key"`
5. Otherwise: feed combined markdown (capped at 30K chars) to Gemini Flash
   with a structured JSON schema → return extracted `Doc`
6. If Gemini fails (timeout, parse error, quota) → fallback with the error
   message in `fallback_reason`

**Returns:**
```ts
{
  doc: Doc,                          // always present
  pages_crawled: number,             // pages we attempted
  pages_read: number,                // pages that returned non-empty content
  source: "gemini" | "fallback",
  fallback_reason?: string,          // only set when source === "fallback"
}
```

**Runtime:** `nodejs`, `maxDuration = 60`. Typical latency: 5–12s
(Jina: 2–6s in parallel + Gemini: 2–4s). Requires Vercel Pro for prod.

---

## Mock vs real

There's no mock mode. The endpoint always tries the real Jina Reader (it's
free and unauthenticated). What changes is Gemini:

- **`GOOGLE_GENAI_API_KEY` set** → real extraction, `source: "gemini"`
- **`GOOGLE_GENAI_API_KEY` unset** → fallback, `source: "fallback"`,
  `fallback_reason: "no_api_key"`. ConfirmForm still opens, with the
  hardcoded Initech defaults overlayed by a generic `Company at <url>`
  description carved from raw markdown.

To set up Gemini:
1. Generate a free key at https://aistudio.google.com/apikey (Google
   account required, no card)
2. Add `GOOGLE_GENAI_API_KEY=...` to `.env.local`
3. Restart the dev server (`pkill -f "next dev"; npm run dev`)

---

## Why these specific choices

### Why Jina Reader (vs. Firecrawl, Playwright, plain fetch)

- **Free** and unauthenticated for normal volumes
- Returns clean markdown (handles JS rendering server-side)
- Zero deps to install — just `fetch("https://r.jina.ai/<url>")`
- Tolerates 404s gracefully (returns 404 status, we drop and continue)

Tradeoff: rate-limited; can be slow (2–6s per page). For a hackathon demo
with 6 parallel fetches per submit, fine.

### Why Gemini Flash (vs. Claude Haiku, GPT-4o-mini)

- **Free tier**: 1500 requests/day on the free tier — way more than needed
- Structured JSON output mode with schema enforcement
- Comparable extraction quality to Haiku on this task
- Single API key, no credit card required

If quality is lacking for some sites, swap the model name to
`gemini-2.0-flash-thinking` (still free) for harder pages. Same schema, same
contract.

### Why the animation is still fake

The existing animation has a "Skip animation" button that already lets users
bypass it. Making the animation reflect real Jina output would require
streaming the API response, which doubles the implementation surface area
without changing the user-visible outcome (Frame 3 is what they actually
care about). Defer to post-MVP.

---

## Known limitations / next-task list

1. **Animation doesn't reflect real pages.** It still shows fake Initech
   paths. To make it real, the API would need to stream pages-discovered
   events back to the client (Server-Sent Events or chunked response).
2. **No URL validation.** Typing "asdf" tries to fetch `https://asdf` and
   gets 0 pages. Falls back gracefully but a "that doesn't look like a
   URL" hint before submit would be nicer.
3. **Subpath list is fixed.** We hit `/about /pricing /features /customers
   /product`. If a site uses `/company` or `/why-us` or non-English paths,
   we miss them. Could add a "links discovered on homepage" pass first.
4. **Gemini quota** is 1500/day on free tier — if you actually scale this,
   you'll need either a paid tier or to add caching keyed on URL.
5. **No retry on Gemini failure** — falls back immediately. Could add a
   single retry with simpler prompt if structured output fails to parse.
6. **No caching.** Every Submit re-crawls. Add a short-lived cache (by
   normalized URL) if you're testing repeatedly.

---

## How to verify it's actually working

### Smoke test the API directly

```bash
# Without Gemini key (fallback path)
curl -s -X POST http://localhost:3000/api/research \
  -H "Content-Type: application/json" \
  -d '{"url":"vercel.com"}' | jq .

# Look for:
#   "source": "fallback"
#   "fallback_reason": "no_api_key"
#   "pages_read" > 0  (proves Jina worked)
```

### Verify Gemini extraction

After setting `GOOGLE_GENAI_API_KEY`:

```bash
curl -s -X POST http://localhost:3000/api/research \
  -H "Content-Type: application/json" \
  -d '{"url":"vercel.com"}' | jq '.source, .doc.one_liner, .doc.features'

# Look for:
#   "gemini"
#   A real one_liner string about Vercel
#   A non-empty features array
```

### Verify the UI

1. Visit http://localhost:3000/onboarding
2. Type a real company URL (e.g. `linear.app`, `stripe.com`, `vercel.com`)
3. Hit Submit. Frame 2 animation plays.
4. When it finishes, status bar should read either
   `"researcher idle · N/M pages read · extracted"` (Gemini worked) or
   `"... extraction skipped"` (no key, fallback)
5. Continue. Frame 3 fields should be populated with **real** content from
   the company's website, not Initech defaults.
