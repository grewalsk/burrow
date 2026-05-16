# Burrow — Frame 3.5 Build State

**Branch:** `feat/full-build`
**Base spec:** [`upload-onboarding-spec.md`](./upload-onboarding-spec.md)
**Last verified:** end-to-end against live ZeroEntropy with 13 docs indexed
**Audience:** the next coding agent picking this up

---

## TL;DR

Frame 3.5 (the document upload onboarding step) is built and working end-to-end.
Users can upload files, the files reach the real ZeroEntropy backend, and they
get indexed under a per-session collection. The flow Frame 1 → Frame 2 → Frame
3 → Frame 3.5 → `/signals` is wired. **The retrieval side (querying that corpus
from the dashboard) is not built.** That's the next major chunk of work.

---

## What's running

1. **`/onboarding`** (Frame 1) — type your URL, hit Submit
2. **Frame 2** — Researcher crawl animation (existing, unchanged)
3. **Frame 3** — Confirm form (existing, hooked to new auto-ingest)
4. **`/onboarding/upload`** (Frame 3.5 — new) — file drop, doc-type tagging,
   indexing, coverage tracking, Skip / Continue
5. **`/signals`** and other dashboard surfaces (existing, untouched)

Click "Send to brain" on Frame 3 → app fires a background POST to
`/api/onboarding/brain` (cr_agent auto-ingest) and routes to `/onboarding/upload`
without waiting. On Frame 3.5, every file you process goes through
`/api/upload` and ends up in ZeroEntropy.

---

## Mock vs real

Controlled by `ZERO_ENTROPY_MOCK` in `.env.local`:

- `ZERO_ENTROPY_MOCK=true` — every ZE call short-circuits to an in-memory
  Map (`mockStore` in `lib/zeroentropyClient.ts`). "Indexing" is a 150ms
  setTimeout. Per-process, wiped on dev restart. Good for UI work.
- `ZERO_ENTROPY_MOCK=false` — uses the real ZE SDK with
  `ZEROENTROPY_API_KEY`. As of this writing the key in `.env.local` works
  and there are 13 docs already indexed across 4 collections.

**Important:** changing `.env.local` requires a dev server restart. Next reloads
env vars, but the SDK client is module-cached and won't pick up the change.

---

## File map (new and modified)

```
app/
  api/
    onboarding/
      brain/
        route.ts                  ← NEW: cr_agent auto-ingest (4 doc types)
    upload/
      route.ts                    ← NEW: file upload → ZE add → poll
  onboarding/
    upload/
      page.tsx                    ← NEW: Frame 3.5 page shell + chrome
      UploadFlow.tsx              ← NEW: client orchestrator
    OnboardingFlow.tsx            ← MODIFIED: Frame 3 submit now POSTs
                                    to /api/onboarding/brain + routes to
                                    /onboarding/upload
  _components/
    DocTypeSelector.tsx           ← NEW: Radix Select, onboarding/full variants
    MinimalCorpusTracker.tsx      ← NEW: 4 coverage pills
    UploadDropzone.tsx            ← NEW: drag-drop + click-to-browse
    UploadFileList.tsx            ← NEW: list wrapper
    UploadFileRow.tsx             ← NEW: single row with progress + status

lib/
  classifyDocType.ts              ← NEW: regex rules → DocType | null
  docTypes.ts                     ← NEW: DocType union + labels + MVC list
  sampleCorpus.ts                 ← NEW: 4 sample docs (not yet ingested anywhere)
  zeroentropyClient.ts            ← NEW: ZE SDK wrapper + mock store

mockdata/                          ← NEW: 4 .md files to upload during demos
  brand-voice.md
  ideal-customer.md
  lost-deal-acme.md
  won-deal-initech.md

.env.example                       ← NEW: env documentation
.env.local                         ← NEW (gitignored): contains real ZE key
                                     and ZERO_ENTROPY_MOCK flag
```

---

## API contract (server)

### `POST /api/upload`

**Auth:** requires `burrow_session` cookie (any UUID; client sets one if missing).
Returns 401 if absent.

**Body:** multipart/form-data with:
- `file` — the file blob (.pdf, .docx, .doc, .md, .txt, .csv)
- `doc_type` — optional DocType string; auto-classified if missing

**Server pipeline:**
1. busboy parses multipart (max 10MB per file)
2. Extension check against allowlist
3. Magic-byte MIME check via `file-type` (.pdf needs `%PDF`, .docx needs ZIP sig)
4. Session batch counter (in-memory Map keyed by cookie value, caps at 50MB
   / 20 files per session)
5. If no `doc_type`, run `classifyDocType(filename, firstTokens)` against the
   first 4KB
6. Base64-encode the buffer, compute `sha256(b64) + ext` as the ZE path
7. `ensureCollection("brain-" + sessionId)` (409 swallowed)
8. `ze.documents.add({ collection_name, path, content: {type:'auto', base64_data}, metadata })`
9. Poll `ze.documents.getInfo` every 1s, up to 45s, until
   `index_status === 'indexed'` or `'parsing_failed'` / `'indexing_failed'`

**Returns:**
- `{status: "done", docId, docType, filename, mock}` — 200
- `{status: "timeout", ...}` — 202
- `{status: "error", message}` — 400 / 401 / 502

**Runtime:** `nodejs`, `maxDuration = 60`. Requires Vercel Pro for prod.

### `POST /api/onboarding/brain`

**Auth:** same cookie check.

**Body (JSON):**
```ts
{
  one_liner?: string;
  description?: string;
  icp?: string;
  pricing?: string;
  features?: string[];
  competitors?: string[];
  stories?: Array<{ name?: string; description?: string; source?: string }>;
}
```

**Ingests (all as `metadata.source = "cr_agent"`):**
- `brand_guide` doc from one_liner + description + features + pricing
- `icp` doc from the icp field
- One `competitor_intel` doc per competitor
- One `case_study` doc per story

**Returns:** `{ok: true}` or `{ok: false, error}`. Frame 3 calls this
fire-and-forget — failures do not block navigation to Frame 3.5.

---

## Data shapes

### `UploadFile` (client state, `UploadFileRow.tsx`)

```ts
type UploadFile = {
  id: string;              // client uuid
  file: File;
  docType: DocType | null;
  status: 'idle' | 'uploading' | 'processing' | 'done' | 'error';
  progress: number;        // 0-100
  error?: string;
};
```

### `DocType` (`lib/docTypes.ts`)

```ts
type DocType =
  | 'won_deal' | 'lost_deal' | 'brand_guide' | 'icp'    // MVC (4 P1)
  | 'competitor_intel' | 'call_transcript' | 'case_study'   // P2
  | 'pricing_objection' | 'faq';                            // P3
```

`MVC_DOC_TYPES` is the array of the four P1 types. The DocTypeSelector
in onboarding shows only MVC; the "full" variant (built but unused)
shows all nine with a separator.

### Metadata on every ZE document

All values are `string | string[]` (ZE constraint):

```ts
{
  doc_type: DocType | 'uncategorized',
  filename: string,
  uploaded_at: string,      // String(Date.now())
  sample: 'false',          // or 'true' for future sample-corpus path
  source?: 'cr_agent',      // only on auto-ingest docs
  competitor_name?: string, // on competitor_intel docs
  story_name?: string,      // on case_study docs
}
```

---

## ZeroEntropy integration — known quirks

Two real bugs surfaced when we switched from mock to live ZE. Both fixed in
this branch.

### 1. The `overwrite: true` flag is currently disabled

The ZE API returns 400 if you pass `overwrite: true` on `documents.add`. The
spec assumed it worked (for idempotent retries via sha256 path).

**Our fix** (`lib/zeroentropyClient.ts`): we don't pass `overwrite` at all,
and we catch 409 Conflict errors and treat them as success (same hash =
same content = already indexed). If you need to actually replace a doc,
you'd have to `documents.delete` first then add. We don't do that anywhere
yet.

### 2. ZE's `type: "auto"` parser needs a file extension on the path

The spec example used `path: sha256(b64)` — a bare hash. ZE failed to parse
those because it had no extension to infer the format from (`index_status`
hit `parsing_failed`).

**Our fix** (`app/api/upload/route.ts`, `app/api/onboarding/brain/route.ts`):
the `path` now includes the original extension: `${sha256}.md`, `${sha256}.pdf`,
etc. Auto-ingest docs from the brain route get `.txt`.

---

## Session model (heads up — this is a demo shortcut)

There is **no real auth.** The "session" is a cookie called `burrow_session`
holding a UUID. It's set client-side in two places:

1. `OnboardingFlow.tsx` — when Frame 3 form is submitted
2. `UploadFlow.tsx` — on mount, if not already set

That cookie value becomes the workspace ID and is used to construct the
ZE collection name: `brain-<sessionId>`. Different browsers = different
collections = isolated corpora. Clearing cookies starts a fresh corpus.

**For prod:** replace this with the real auth system's user/workspace ID.
Search for `burrow_session` to find every read/write site.

---

## State persistence

- `localStorage.burrow.onboarded = "1"` — set on first Skip/Continue from
  Frame 3.5. The root `/` route reads this and redirects to `/signals` if
  set. To replay the flow, clear localStorage or hit `/onboarding` directly.
- `localStorage.burrow.brainSeeded = "1"` — set on first successful real
  upload (status === 'done'). Read by **no one** yet. Spec says this
  controls sample-corpus filtering on retrieval.

---

## UI states the spec calls for, and where we are on each

| State                             | Status     |
|-----------------------------------|------------|
| Default dropzone                  | done       |
| Drag-active dropzone              | done       |
| Drop rejection flash (200ms red)  | done       |
| Batch limit reached (disabled)    | done       |
| File row: idle                    | done       |
| File row: uploading + progress    | done (real XHR onprogress) |
| File row: processing ("Indexing…")| done (no animation) |
| File row: done (green check)      | done       |
| File row: error + retry           | done       |
| MVC pill: empty                   | done       |
| MVC pill: queued (file added)     | done (border-on-gray) |
| MVC pill: indexed (green)         | done       |
| "Coverage" eyebrow                | done       |
| "Still missing: …" hint           | done (extra — not strictly in spec) |
| Aggregate progress bar            | done       |
| Skip / Process / Continue swap    | done       |
| Inline "Select a type for each file." | done   |
| All-files-failed inline note      | done       |
| Mid-upload page refresh recovery  | **not built** (spec calls for localStorage rehydration) |
| Polling timeout → "Still indexing… retry" | done |
| Sample corpus on skip             | **not built** (sampleCorpus.ts exists, not wired) |
| Dashboard re-entry from #briefing | **not built** |
| `?context=dashboard` chrome variant | partial (UploadFlow reads it for routing, but chrome doesn't change) |

---

## What's NOT done — concrete next-task list

1. **Retrieval.** The Analyst's Lead Card "Evidence" region is the whole point
   of the brain. Right now it shows hardcoded sample data. Need to:
   - Add `lib/queryZE.ts` wrapping `ze.queries.topSnippets` or `topDocuments`
   - Wire it into wherever the Evidence cites are rendered
   - Filter by `metadata.sample = "false"` when `localStorage.burrow.brainSeeded === "1"`
2. **`#briefing` re-entry card.** "Your brain has no documents yet.
   [Upload now →]". Routes to `/onboarding/upload?context=dashboard`.
   Disappears when `brainSeeded` is set.
3. **Sample corpus ingest on skip.** `lib/sampleCorpus.ts` has 4 docs
   ready to go. On skip, POST each to `/api/upload` (or a new
   `/api/upload/sample` route) with `metadata.sample = "true"`.
4. **Sample corpus purge on first real upload.** Call
   `deleteByMetadata(collection, { sample: "true" })` — the wrapper exists.
5. **Re-entry chrome variant.** When the page is loaded with
   `?context=dashboard`, show the main dashboard chrome (LeftRail + TopStrip)
   instead of the onboarding chrome.
6. **Real auth.** The session cookie is a placeholder. Replace with whatever
   auth system you adopt.
7. **`/onboarding/brain` failure UX.** Right now Frame 3 submit fires
   and forgets. If you want to surface a "couldn't seed automatically,
   upload your own brand guide" message, you'd need to make the call
   awaitable.
8. **Vercel Pro.** The 45s polling cap exceeds hobby tier's 10s function
   timeout. Set `maxDuration = 60` is already in the route, but the
   account needs to be on Pro for it to take effect in prod.

---

## How to verify ZE is actually being used

Quickest live check, no UI needed:

```bash
curl -s -X POST http://localhost:3000/api/upload \
  -H "Cookie: burrow_session=verify-$(date +%s)" \
  -F "file=@mockdata/won-deal-initech.md" \
  -F "doc_type=won_deal"
```

Look for `"mock":false` in the response. If you see `"mock":true`, the
dev server was started with an inline `ZERO_ENTROPY_MOCK=true` that
overrides `.env.local`. Kill and restart with plain `npm run dev`.

To list collections / docs from outside the app, write a quick probe
script that imports `zeroentropy` from `node_modules/`:

```js
import { ZeroEntropy } from "zeroentropy";
const ze = new ZeroEntropy({ apiKey: process.env.ZEROENTROPY_API_KEY });
console.log(await ze.collections.getList({}));
console.log(await ze.documents.getInfoList({ collection_name: "brain-<id>", limit: 50 }));
```

---

## Common stumbles

- **"Server Action not found" on POST /api/upload** during dev. This is a
  Next.js HMR race during recompiles after an env reload. Just retry —
  the next request hits the recompiled route handler.
- **`/onboarding` returns 500 with ENOENT on `pages/_document.js`.**
  Stale `.next/` cache. Fix: `pkill -f "next dev"; rm -rf .next; npm run dev`.
- **App stays on `/signals` when you want to demo from scratch.**
  Browser has `localStorage.burrow.onboarded = "1"` set. Clear it, or
  visit `/onboarding` directly to bypass the redirect.

---

## Test fixtures

`mockdata/` contains 4 realistic markdown files with filenames designed to
auto-classify correctly via the regex rules:

- `won-deal-initech.md` → `won_deal`
- `lost-deal-acme.md` → `lost_deal`
- `brand-voice.md` → `brand_guide`
- `ideal-customer.md` → `icp`

Drag all four into the dropzone and all four MVC pills should turn green.
