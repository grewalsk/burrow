# Burrow — Document Upload Onboarding Spec

<!-- /autoplan restore point: /Users/kaushikmedamanuri/.gstack/projects/grewalsk-burrow/spec-onboarding-upload-flow-autoplan-restore-20260516-115025.md -->

**Branch:** spec/onboarding-upload-flow
**Status:** Draft — under /autoplan review
**Base:** docs/design_handoff_burrow/01-source-brief.md + docs/specs/burrow_flow.md

---

## Problem

The Lead Card modal's Evidence region cites retrievals like `won_deal · Initech`, `brand_guide · ICP definition`, and `lost_deal · Acme`. These citations are what make Burrow's pitch land — they prove the drafts are grounded, not hallucinated.

The cr_agent (Frame 2) already seeds the Brain from the public website: after crawling, the status bar reads "researcher idle · 21 pages crawled · brain seeded." This gives the Brain public-facing facts — what the company does, pricing, features, competitor mentions, and customer success stories from the website.

But the most valuable retrieval evidence is *private* — email threads from closed deals, call transcripts, internal win/loss notes, brand voice guides that live in docs not on the website. The website crawl cannot reach these. The Lead Card Evidence region's most compelling citations (`won_deal · Initech`, `lost_deal · Acme`) come from this private layer.

Document upload during onboarding (Frame 3.5) fills the private layer. It supplements the cr_agent's public-web seeding with the founder's own history.

---

## What This Spec Covers

Frame 3.5 — the document upload step inserted between the current Frame 3 (company info form confirmation) and the main dashboard.

Scope:
- The upload UI as a new onboarding phase
- Document taxonomy (doc_types, labels, descriptions for each type)
- File type support and size limits
- Upload + processing pipeline (client → server action → ZeroEntropy)
- In-progress and error states
- Skip/defer flow
- Post-upload dashboard reflection
- The "seed your brain" re-entry path from within the dashboard

Not in scope:
- Bulk re-upload / corpus management (post-MVP)
- Audio/video transcription (MP3/MP4) — deferred to post-MVP
- URL import (paste a link, we scrape it) — deferred
- Sharing a corpus across team members — deferred

---

## Document Taxonomy

Each uploaded document is assigned a `doc_type` at upload time. This maps directly to what ZeroEntropy returns in the Evidence region of the Lead Card modal.

| doc_type | Label in UI | Description shown to founder | Priority |
|---|---|---|---|
| `won_deal` | Past win | A deal you closed — call notes, email thread, or summary | P1 |
| `lost_deal` | Past loss | A deal you lost — what happened, why | P1 |
| `brand_guide` | Brand voice | How you write: tone, phrases to use/avoid, example copy | P1 |
| `icp` | Ideal customer | Who you're selling to: role, company size, pain, triggers | P1 |
| `competitor_intel` | Competitor | One competitor per doc — what they offer, where they lose | P2 |
| `call_transcript` | Call transcript | A text transcript of a sales or discovery call | P2 |
| `case_study` | Case study | A published or internal success story | P2 |
| `pricing_objection` | Pricing objection | How you handle price pushback | P3 |
| `faq` | FAQ / common objections | Objections you hear regularly and how you answer them | P3 |

**Minimum viable corpus (MVC):** At least one doc from each P1 type (`won_deal`, `lost_deal`, `brand_guide`, `icp`). The UI guides toward this but does not require it to proceed.

---

## File Type Support

Accepted: `.pdf`, `.docx`, `.doc`, `.md`, `.txt`, `.csv`

Not accepted: `.mp3`, `.mp4`, `.jpg`, `.png`, `.xlsx` (show a quiet "Format not supported" inline message)

Size limit: 10 MB per file. 50 MB per session upload batch. 20 files max per session.

---

## Frame 3.5 — Upload UI

### Entry point

After the founder submits the company info form (Frame 3), the Brain agent receives the structured data and stores it in ZeroEntropy. On success, instead of redirecting to `/signals`, the app routes to `/onboarding/upload`.

The top-of-page chrome (the sticky header showing "frame 3 — confirm") updates to "frame 3.5 — seed your brain".

### Layout

Full-page layout matching the existing onboarding chrome (sticky header, centered content area, max-width 680px). No left rail. No top strip. This is pre-dashboard.

**Vertical order (corrected from initial spec — dropzone first, tracker is feedback below):**

```
┌─────────────────────────────────────────────────────┐
│ ■ Burrow    [frame 3.5 — seed your brain]  [reset]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Seed your brain                       [Skip →]    │
│  12px secondary: "Upload past wins, losses,         │
│  brand voice, and ICP so Burrow can cite            │
│  real evidence when scoring leads."                 │
│                                                     │
│  ┌─ Drop files here ───────────────────────────┐   │
│  │  [160px tall, 24px vertical padding]        │   │
│  │                                             │   │
│  │  Drag files here or click to browse        │   │
│  │  PDF, DOCX, MD, TXT, CSV · max 10 MB each  │   │
│  │                                             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [1px aggregate progress bar — appears on Process] │
│                                                     │
│  [Uploaded file list — see below]                  │
│                                                     │
│  ┌─ Coverage ──────────────────────────────────┐   │
│  │  [pill] Past win  [pill] Past loss           │   │
│  │  [pill] Brand voice  [pill] Ideal customer   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [Skip for now →]        [Process and continue →]  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Component breakdown

#### `<UploadDropzone>`
- Outer: a `1px dashed rgba(26, 24, 22, 0.16)` bordered region, 6px radius, **160px tall**, `24px` top/bottom padding, centered content
- `role="button"` with `aria-label="Upload files. Drag and drop or press Enter to browse."`, `tabIndex={0}`
- On `Enter` / `Space` keypress: opens native file picker (same as click)
- **Default state:** "Drag files here or click to browse" (14px, `--text-secondary`, weight 400) + "PDF, DOCX, MD, TXT, CSV · max 10 MB each" (12px, `--text-tertiary`, weight 400)
- **Drag-active state:** fill changes to `--bg-surface` (`#F3F2EE` light / `#1A1916` dark), border becomes solid `rgba(26, 24, 22, 0.16)`, 100ms transition on `background-color` and `border-style` only
- **Dark mode drag-active:** fill `--bg-elevated` (`#23211D`) for sufficient contrast against `--bg-base` (`#0F0E0D`)
- **Drop rejection (unsupported format or too large):** on drop, dropzone border flashes `--red` for 200ms (via CSS class toggle), then returns to default. Inline message appears below the dropzone (not inside).
- **Batch limit reached (50 MB or 20 files):** dropzone becomes visually disabled — 60% opacity, `cursor: not-allowed`, `pointer-events: none`. Text changes to "Upload limit reached" (14px, `--text-secondary`).
- On drop / file select with valid files: passes file list to parent; dropzone returns to default state immediately
- **No animation inside the dropzone.** No pulsing border. No spinning upload icon. Static.

#### `<UploadFileList>`
- Vertical list of `<UploadFileRow>` entries (one per file)
- Appears below the dropzone immediately on file select
- New files added at the bottom of the list

#### `<UploadFileRow>`
- 44px tall, 16px horizontal padding, 1px bottom border `--border-subtle`
- Left: file icon (Lucide `file-text`, 16px, `--text-tertiary`) + filename (14px `--text-primary`, truncated with ellipsis at 200px) + file size (12px `--text-tertiary`)
- Right: `<DocTypeSelector>` + remove button (Lucide `x`, 16px, `--text-tertiary`)
- States: idle → uploading → processing → done | error

**Processing state progression:**
1. **Idle** — just added, not yet submitted. DocTypeSelector shows "Select type" placeholder.
2. **Uploading** — 1px progress bar under the row (full width, `--ink` fill, animates left→right based on actual upload progress via XHR/fetch with `onprogress`)
3. **Processing** — upload complete, server is extracting + embedding. Shows "Indexing…" in 12px `--text-secondary` on the right in place of the remove button.
4. **Done** — "Indexed" in 12px `--text-secondary`, check icon (Lucide `check`, 16px, `--green`) on right. No animation beyond the text swap.
5. **Error** — "Failed" in 12px `--red`, with a retry link "retry" (13px `--ink`) next to it.

#### `<DocTypeSelector>`
- **Component: Radix UI `<Select>` (unstyled primitive, not native `<select>`)** — required for cross-browser styling control
- Trigger: 28px tall, 13px weight 500, `background: #FFFFFF` (`--bg-elevated`), `border: 1px solid rgba(26, 24, 22, 0.16)` (`--border-default`), 4px radius, `padding: 0 8px`
- Placeholder: "Select type" (12px, `--text-tertiary` = `#B5B1A8`)
- **In onboarding (Frame 3.5): shows only 4 MVC doc_types** — `won_deal` (Past win), `lost_deal` (Past loss), `brand_guide` (Brand voice), `icp` (Ideal customer). No P2/P3 types during onboarding.
- **In re-entry from dashboard:** shows all 9 doc_types, P2/P3 separated by a 1px `--border-subtle` Radix separator
- Selected state: label text in 13px `--text-primary` weight 500
- **Auto-classification (default):** server pre-classifies based on filename + first 200 tokens; selector shows the pre-filled value. User can change. If auto-classification returns `null` (uncertain), selector shows placeholder.
- Focus: `outline: 2px solid --ink, outline-offset: 2px`
- **The selector is not required before submit.** The "Process and continue" button shows an inline note below the action row: "Select a type for each file." (12px `--text-secondary`) if any row has null `docType`. The button is not disabled — the note is informational.

#### `<MinimalCorpusTracker>`
- A small horizontal row of 4 pill indicators (renamed from "Minimum viable corpus" in the layout — label: "Coverage" in 11px uppercase `--text-secondary` above the row, per the brief's region label convention)
- Sits **below the file list**, above the action row
- Four pills: Past win, Past loss, Brand voice, Ideal customer
- Each pill: 24px tall, `fit-content` width, `min-width: 80px`, 999px radius, `horizontal padding: 10px 12px`
- `aria-label` on each pill: e.g. `aria-label="Past win: not yet uploaded"` (updated on state change)
- **Default state (not added):** `background: rgba(26, 24, 22, 0.06)`, `color: #87837B` (`--text-secondary`), weight 400, 12px. Border: none.
- **File added but not yet indexed:** `border: 1px solid rgba(26, 24, 22, 0.16)` (`--border-default`), background unchanged, text unchanged
- **Indexed successfully:** `background: rgba(45, 125, 95, 0.10)` (`--green-bg`), `color: #2D7D5F` (`--green`), Lucide `check` at 16px appears to the **left** of the label text (not replacing it — additive). Total content: `[check icon] [label]` in flex row, gap 6px.
- Transition on `background-color`, `color`, `border-color` only: 100ms ease
- Pill width must accommodate the longest label "Ideal customer" — verify at 80px min-width. If it overflows, truncate with ellipsis at 120px max-width.

#### Action row (bottom)

**Aggregate progress bar (appears during processing, above file list):**
- A single 1px `--ink` (`#16213B` light / `--text-primary` `#F0EEE8` dark) horizontal bar, full width of the content area, tracking total files completed / total files. Appears when "Process and continue" is clicked. Disappears when all files complete. No shimmer, no animation on the bar itself — just `width` transition driven by actual progress.

**Buttons:**
- "Skip for now →" (ghost: no background, no border, `--text-secondary` color, 13px weight 500, 32px tall) — left side of action row
- "Process and continue →" (primary: `background: #16213B` (`--ink`), `color: #FFFFFF`, 13px weight 500, 32px tall, 4px radius) — right side
- `aria-label="Process uploaded files and continue to dashboard"` on primary

**Processing state (after click):**
- Primary button text: "Indexing…" — **static text, NO animated ellipsis, no looping dots** (brief explicitly bans looping animations)
- Primary button: `opacity: 0.5`, `pointer-events: none`, `cursor: not-allowed`
- "Skip for now →" remains visible and clickable during processing (founder can abort)

**After all files complete:**
- Primary button: "Continue →", re-enabled (opacity 1.0, pointer-events auto)

**If no files added:**
- "Process and continue →" button: absent. Only "Skip for now →" shown.

**Inline validation note (if doc_type unassigned):**
- Single line below action row: "Select a type for each file." (12px, `--text-secondary`). No icon, no red color — just informational.

### Missing states (complete spec)

| State | Trigger | UI response |
|---|---|---|
| Batch size limit reached | Cumulative uploads reach 50 MB or 20 files | Dropzone: 60% opacity, `cursor: not-allowed`, text "Upload limit reached". No inline message, the dropzone itself communicates. |
| All files in error state | Every file row shows "Failed" | Primary button remains visible but shows inline note: "All files failed. Retry each file or skip." No disabled state — the retry links are the actions. |
| Mid-upload page refresh | Browser refreshes with `uploading` status rows in localStorage | On mount: any row with `status: uploading` resets to `status: idle`. Rows with `status: processing` or `done` are restored from localStorage. |
| Polling timeout | `status` poll returns no `done` / `error` after 30 seconds (15 polls) | Row transitions to error state: "Timed out · retry". Retry re-triggers the full extraction + ingest. |
| Sample corpus reflection | Founder skipped, arrives at upload from dashboard with sample corpus loaded | MVC tracker shows all 4 pills with `background: rgba(26, 24, 22, 0.06)` (gray, not green). Sample data does NOT make pills green. Pills reflect only founder-uploaded and indexed documents. |
| Zero-file state | Page loads with no files added | "Process and continue" is absent. "Skip for now →" is the sole CTA. |

### Accessibility spec

- **Dropzone:** `role="button"`, `tabIndex={0}`, `aria-label="Upload files. Drag and drop or press Enter to browse."`, `aria-describedby="dropzone-hint"` (the format hint text)
- **UploadFileRow:** `role="listitem"` within a `role="list"` container. Remove button: `aria-label="Remove [filename]"`. Focus moves to the next row or the dropzone when a row is removed.
- **DocTypeSelector (Radix):** standard Radix Select accessibility (built-in — no extra work needed)
- **MVC pills:** `role="status"`, `aria-live="polite"`, `aria-label="[doc_type label]: [not uploaded / uploading / indexed]"` — updated on state change
- **Progress bar:** `role="progressbar"`, `aria-valuenow={completedCount}`, `aria-valuemax={totalCount}`, `aria-label="Uploading files"`
- **Contrast note:** `--text-tertiary` (`#B5B1A8` on `#FAFAF8`) = ~2.5:1 — fails WCAG AA for small text (4.5:1 required). It is used for the dropzone format hint (12px). This is a brief-level issue accepted as a known limitation for placeholder/hint text. **Do not use `--text-tertiary` for any required-reading text** in the upload flow; use `--text-secondary` (`#87837B` on `#FAFAF8` = ~4.4:1 — borderline AA pass) instead.

### Minimum viable corpus guidance

At the top of the page, a quiet status row shows whether the 4 P1 doc_types have been covered. This is informational, not a blocker. The founder can skip with 0 files or proceed with 1 file.

Copy: "Seed your brain" as the page title (not a heading — 22px weight 500, `--text-primary`). Below: 12px `--text-secondary`: "Upload past wins, losses, brand voice, and ICP so Burrow can cite real evidence when scoring leads."

No illustration. No robot. No "✨ AI will learn from your docs!" copy.

### Skip flow

Two skip points:
1. **"Skip for now →"** on the upload page — routes directly to `/signals` with `localStorage.burrow.onboarded = "1"`. Does not set `localStorage.burrow.brainSeeded`.
2. **Onboarding complete without upload** — same result.

When the founder arrives at the dashboard without uploading:
- The `#briefing` channel shows a quiet prompt at the bottom of the channel (not a modal, not a toast): a single card reading "Your brain has no documents yet. [Upload now →]" in `--bg-surface`, 16px padding, standard card styling. This is the re-entry point.
- The "Grounded %" top strip counter shows "0%" in `--text-secondary` rather than `--text-primary` — a subtle signal without an alert state.

### Re-entry from dashboard

Clicking "Upload now →" in `#briefing` routes to `/onboarding/upload` with `?context=dashboard` query param. The page renders the same upload UI but with slightly different chrome: the sticky header shows the main dashboard header instead of the onboarding chrome. The left rail and top strip are visible.

After completing the upload from within the dashboard, the user returns to `#briefing`.

---

## Processing Pipeline

### Architecture diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  /app/onboarding/upload/page.tsx                                    │
│      └── UploadFlow.tsx                                             │
│           ├── <OnboardingChrome> ← EXTRACT from OnboardingFlow.tsx  │
│           ├── <UploadDropzone>                                      │
│           ├── 1px aggregate progress bar                            │
│           ├── <UploadFileList>                                      │
│           │     └── <UploadFileRow> × N                             │
│           │           ├── <DocTypeSelector> (Radix Select)          │
│           │           └── 1px per-file upload progress bar          │
│           └── <MinimalCorpusTracker>                                │
│                                                                     │
│  /app/api/upload/route.ts  (POST — server-side blocking pipeline)    │
│      auth check → MIME validate → base64 encode                     │
│      → ze.documents.add() → poll get_info until indexed             │
│      → return { status: "done" } or { status: "timeout" }           │
│                                                                     │
│  /app/api/onboarding/brain/route.ts  (POST — cr_agent auto-ingest)  │
│      receives cr_agent form data → ingests brand_guide +            │
│      competitor_intel docs into ZeroEntropy                         │
│                                                                     │
│  /lib/classifyDocType.ts — keyword/regex → DocType | null          │
│  /lib/sampleCorpus.ts    — pre-chunked sample docs (metadata.sample: "true") │
│  /lib/zeroentropyClient.ts — SDK wrapper (import { ZeroEntropy })   │
└─────────────────────────────────────────────────────────────────────┘
```

**Key architectural decision:** ZeroEntropy indexing is async — `ze.documents.add()` enqueues the document; the SDK returns before indexing is complete. The POST handler bridges this by polling `ze.documents.get_info()` server-side until `index_status === "indexed"`, with a 45-second cap. If the cap is exceeded, the route returns `{ status: "timeout" }` and the client shows a "Still indexing…" state. This keeps the frontend simple (no client-side status polling) while correctly handling ZE's async model. **No job store needed** — the server-side poll is stateless and completes within the single HTTP response.

### Client-side

1. User drops or selects files; auto-classification pre-fills `DocTypeSelector` for each
2. User reviews/overrides doc_types, clicks "Process and continue"
3. For each file (in parallel, capped at 3 concurrent uploads): POST to `/api/upload` with `FormData` containing file + `doc_type`
4. Upload progress tracked via XHR `onprogress` — drives the 1px per-file progress bar
5. On server response `{ status: "done" }`: row transitions to "Indexed" state.
   On server response `{ status: "timeout" }`: row shows "Still indexing… · retry" (ZE indexing exceeded 45s cap).
6. On server response `{ status: "error", message }`: row shows "Failed · retry"
7. `MinimalCorpusTracker` updates after each row resolves to "done"
8. Aggregate progress bar width = `completedFiles / totalFiles`

### Next.js App Router compatibility notes

```ts
// app/api/upload/route.ts — required header
export const runtime = 'nodejs';  // required for busboy
// Do NOT add `export const config = { api: { bodyParser: false } }` — that is Pages Router syntax only
```

```bash
# npm install (pin file-type to v18 — v19+ is ESM-only, incompatible with CJS Next.js)
npm install zeroentropy file-type@18 busboy
npm install --save-dev @types/busboy
```

**Vercel tier requirement:** The 45s server-side polling cap requires **Vercel pro tier** (60s serverless function timeout). Hobby tier kills at 10s — the route 504s before the cap is reached. Set `maxDuration = 60` in `next.config.mjs` or Vercel project settings. Client-side: treat any 504 response as `{ status: "timeout" }` to avoid unhandled rejection.

**Use `busboy` for multipart parsing** (not `formidable` — formidable requires Node.js `IncomingMessage`, not the Web `Request` object used by App Router). Pattern:

```ts
import busboy from 'busboy';
import { Readable } from 'stream';

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';
  const bb = busboy({ headers: { 'content-type': contentType } });
  // pipe request body into busboy, collect file buffer
}
```

### Server-side (`/api/upload`)

```
Route: POST /api/upload
Runtime: nodejs (see next.config.mjs note above)
```

1. **Auth check** — verify session cookie/token. Return 401 if missing.
2. Parse multipart FormData using `busboy` (see App Router pattern above)
3. **MIME validation** — read first 8 bytes of the file buffer, check magic bytes against allowlist:
   - PDF: `%PDF` (`25 50 44 46`)
   - DOCX/ZIP: `PK` (`50 4B 03 04`)
   - TXT/MD/CSV: no magic bytes — validate by extension only (acceptable risk for text files)
   - Reject if extension claims PDF/DOCX but magic bytes don't match → 400 "Format not supported"
   - Use npm package `file-type` for this check.
4. **Size validation** — reject if file > 10 MB → 400 "Over 10 MB limit"
5. **Session batch enforcement** — check session-scoped counter (use `headers().get('x-session-id')` or auth token as key, stored in a module-level Map): reject if session total > 50 MB or > 20 files → 400 "Upload limit reached"
6. **Auto-classify** (if `doc_type` not provided or `null`): call `classifyDocType(filename, firstTokens)` — see below
7. **Base64 encode** the file buffer: `const b64 = buffer.toString('base64')`
8. **Ingest document** via ZeroEntropy SDK — no local text extraction or chunking; ZE handles this server-side:
   ```ts
   import { ZeroEntropy } from 'zeroentropy';
   const ze = new ZeroEntropy({ apiKey: process.env.ZEROENTROPY_API_KEY });

   const docId = sha256(b64);  // deterministic doc_id — idempotent on retry

   await ze.documents.add({
     collection_name: `brain-${workspaceId}`,
     document_path: docId,
     content: { type: 'auto', base64_data: b64 },
     metadata: {
       doc_type,
       filename,
       uploaded_at: String(Date.now()),
       sample: 'false',  // metadata values must be string | string[]
     },
   });
   ```
   - `document_path` acts as the upsert key — same `docId` on retry replaces rather than duplicates
   - `content.type: "auto"` — ZeroEntropy parses PDFs, DOCX, MD, TXT, CSV server-side. No local extraction needed.
9. **Poll for indexed status** — ZE indexing is async; poll until ready or timeout:
   ```ts
   const START = Date.now();
   const TIMEOUT_MS = 45_000;
   const POLL_INTERVAL_MS = 1_000;

   while (Date.now() - START < TIMEOUT_MS) {
     const info = await ze.documents.get_info({
       collection_name: `brain-${workspaceId}`,
       document_path: docId,
     });
     if (info.index_status === 'indexed') break;
     await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
   }

   const final = await ze.documents.get_info({ collection_name: `brain-${workspaceId}`, document_path: docId });
   if (final.index_status !== 'indexed') {
     return Response.json({ status: 'timeout' }, { status: 202 });
   }
   ```
10. On indexed → return `{ status: "done" }`
11. On SDK error after internal retry → return `{ status: "error", message: "Indexing failed" }`

**Performance note:** With up to 5 concurrent uploads, you may have 5 simultaneous server-side polling loops. For a hackathon demo with small documents this is acceptable; at scale, move to client-side polling (post-MVP).

### cr_agent auto-ingest (`/api/onboarding/brain`)

This is the implementation of what Frame 2 already promises ("brain seeded" in the status bar). Called from `ConfirmForm.onSubmit` in `OnboardingFlow.tsx` **before** `router.push('/onboarding/upload')`. The form data (Burrow2) is already structured — the route just formats and ingests it.

```
Route: POST /api/onboarding/brain
Body: { one_liner, description, icp, pricing, features: string[], competitors: string[], stories: Array<{name, description, source}> }
```

1. Auth check (same as upload)
2. **brand_guide doc**: combine `one_liner + "\n\n" + description + "\n\nFeatures: " + features.join(", ") + "\n\nPricing: " + pricing` into a single text block. Ingest: `{ doc_type: "brand_guide", filename: "auto-company-profile", sample: false }`
3. **icp doc**: ingest `icp` text as `{ doc_type: "icp", filename: "auto-icp", sample: false }`
4. **competitor_intel docs**: for each competitor in `competitors[]`, ingest as `{ doc_type: "competitor_intel", filename: "auto-competitor-${i}", sample: false }`
5. **case_study docs**: for each story in `stories[]` (Initech, Acme, Pied Piper etc.), ingest `"${story.name}: ${story.description}"` as `{ doc_type: "case_study", filename: "auto-story-${story.name}", sample: false }` — **these are the most valuable public retrievals** since they map directly to the "matches: Initech win" pattern shown in the dashboard signals
6. On success: respond `{ ok: true }` → client navigates to `/onboarding/upload`
7. On failure: respond `{ ok: false }` — **do not block navigation**. The upload step still proceeds; the founder can upload manually.

### `classifyDocType.ts` — keyword/regex rules

```ts
const RULES: Array<{ pattern: RegExp; docType: DocType }> = [
  { pattern: /win|won|closed.won|close.*note|deal.*clos/i, docType: 'won_deal' },
  { pattern: /loss|lost|churn|didn.t.*win|we.*lost|not.*selected/i, docType: 'lost_deal' },
  { pattern: /brand.*guide|voice|tone|messaging|how.*we.*write|copy.*guide/i, docType: 'brand_guide' },
  { pattern: /icp|ideal.*customer|target.*persona|who.*we.*sell/i, docType: 'icp' },
  { pattern: /competitor|vs\.|versus|compared.*to|alternative/i, docType: 'competitor_intel' },
  { pattern: /transcript|call.*notes|meeting.*notes|recorded/i, docType: 'call_transcript' },
  { pattern: /case.*study|success.*story|customer.*story/i, docType: 'case_study' },
];

export function classifyDocType(filename: string, firstTokens: string): DocType | null {
  const haystack = `${filename} ${firstTokens}`.toLowerCase();
  for (const { pattern, docType } of RULES) {
    if (pattern.test(haystack)) return docType;
  }
  return null; // uncertain — show placeholder, require user selection
}
```

### ZeroEntropy integration

**Package:** `npm install zeroentropy` — use the official SDK, not a custom fetch wrapper.

**Environment variables (add all to `.env.local` and `.env.example`):**

```bash
# .env.example
ZEROENTROPY_API_KEY=your_key_here   # ZeroEntropy API key (single R in "Entropy")
ZERO_ENTROPY_MOCK=false             # set to "true" to use in-memory mock for local dev
```

**`zeroentropyClient.ts` — SDK-based wrapper:**

```ts
import { ZeroEntropy } from 'zeroentropy';

const IS_MOCK = process.env.ZERO_ENTROPY_MOCK === 'true';

// In-memory mock store for local dev and test #4 (upload → retrieval smoke test)
type MockDoc = { path: string; content: string; metadata: Record<string, string | string[]>; indexed: boolean };
const mockStore: MockDoc[] = [];

export function getClient() {
  if (IS_MOCK) return null;
  return new ZeroEntropy({ apiKey: process.env.ZEROENTROPY_API_KEY ?? '' });
}

export async function ensureCollection(collectionName: string) {
  if (IS_MOCK) return;
  const ze = getClient()!;
  try {
    await ze.collections.add({ collection_name: collectionName });
  } catch (e: unknown) {
    // 409 ConflictError means it already exists — that's fine
    if (!(e instanceof Error && e.message.includes('409'))) throw e;
  }
}

export async function addDocument(params: {
  collectionName: string;
  documentPath: string;
  base64Data: string;
  metadata: Record<string, string | string[]>;
}) {
  if (IS_MOCK) {
    const existing = mockStore.findIndex(d => d.path === params.documentPath);
    const doc: MockDoc = {
      path: params.documentPath,
      content: params.base64Data,
      metadata: params.metadata,
      indexed: false,
    };
    if (existing >= 0) mockStore[existing] = doc;
    else mockStore.push(doc);
    // Simulate async indexing — mark indexed after 100ms
    setTimeout(() => { const d = mockStore.find(d => d.path === params.documentPath); if (d) d.indexed = true; }, 100);
    return;
  }
  const ze = getClient()!;
  await ze.documents.add({
    collection_name: params.collectionName,
    document_path: params.documentPath,
    content: { type: 'auto', base64_data: params.base64Data },
    metadata: params.metadata,
  });
}

export async function getDocumentInfo(collectionName: string, documentPath: string) {
  if (IS_MOCK) {
    const doc = mockStore.find(d => d.path === documentPath);
    return { index_status: doc?.indexed ? 'indexed' : 'pending' };
  }
  const ze = getClient()!;
  return ze.documents.get_info({ collection_name: collectionName, document_path: documentPath });
}

export async function deleteByMetadata(collectionName: string, filter: Record<string, string>) {
  if (IS_MOCK) {
    const before = mockStore.length;
    mockStore.splice(0, mockStore.length,
      ...mockStore.filter(d => !Object.entries(filter).every(([k, v]) => d.metadata[k] === v))
    );
    return { deleted: before - mockStore.length };
  }
  const ze = getClient()!;
  // Delete all documents matching filter — iterate and delete individually
  // (ZE SDK does not have a bulk-delete-by-metadata endpoint in v1)
  const results = await ze.queries.top_documents({
    collection_name: collectionName,
    query: '',
    count: 1000,
  });
  const toDelete = results.documents.filter(doc =>
    Object.entries(filter).every(([k, v]) => doc.metadata?.[k] === v)
  );
  await Promise.all(toDelete.map(doc =>
    ze.documents.delete({ collection_name: collectionName, document_path: doc.document_path })
  ));
  return { deleted: toDelete.length };
}

// For test #4: retrieve from mock store
export function mockSearch(collectionName: string) {
  if (!IS_MOCK) throw new Error('mockSearch only available in mock mode');
  return mockStore
    .filter(d => d.indexed)
    .slice(0, 3)
    .map((d, i) => ({ document_path: d.path, metadata: d.metadata, score: 0.9 - i * 0.1 }));
}
```

**Note on metadata types:** All metadata values must be `string | string[]`. Cast booleans: `sample: 'false'` not `sample: false`. Cast numbers: `uploaded_at: String(Date.now())`.

**Note on env var spelling:** `ZEROENTROPY_API_KEY` — one R in "Entropy". The previous spec version had a typo (`ZEROENTRROPY_API_KEY`) — use the correct single-R spelling consistently.

### Sample corpus

`/lib/sampleCorpus.ts` exports an array of pre-chunked documents with `metadata.sample = true`. These are ingested when the founder skips upload.

**Contamination prevention:** The Analyst's ZeroEntropy query includes `filter: { "metadata.sample": false }` when `localStorage.burrow.brainSeeded === "1"` (i.e., when the founder has uploaded real documents). When `brainSeeded` is not set, no filter is applied (all docs, including sample, are retrieved).

**Sample corpus purge:** On first successful real-document ingest, the client sets `localStorage.burrow.brainSeeded = "1"`. The upload route also calls `zeroentropyClient.deleteWhere({ collection: "brain", filter: { "metadata.sample": true } })` to purge sample data. This ensures sample docs never surface in real retrievals after the first real upload.

---

## Error States

| Error | Trigger | UI response |
|---|---|---|
| Format not supported (extension) | File extension not in allowlist | Row does not appear; inline message below dropzone: "filename.exe — format not supported" (12px `--text-secondary`). Auto-clears after 4s. |
| Format not supported (MIME mismatch) | Magic bytes don't match extension | Server returns 400. Row shows "Failed · unsupported format". |
| File too large | File > 10 MB | Inline message: "filename.pdf — over 10 MB limit" |
| Batch limit reached | Session total > 50 MB or 20 files | Dropzone disabled: 60% opacity, "Upload limit reached". Server also enforces: 400 if bypassed. |
| ZeroEntropy ingest rejected | ZE returns 4xx synchronously on `documents.add()` | Row shows "Failed · retry". Retry re-sends same base64 payload (idempotent via `document_path`). |
| ZeroEntropy parse failure | ZE enqueues the doc but cannot parse it (e.g. corrupted PDF, unsupported DOCX variant) — `index_status` never reaches `"indexed"` | **Manifests as timeout** (indistinguishable from slow indexing). Row shows "Still indexing… · retry". Retry will not help. Advise reformatting the file. Post-MVP: check ZE document status for an explicit `"failed"` value and surface a cleaner error. |
| ZeroEntropy indexing timeout | 45s cap exceeded before `index_status === "indexed"` | Server returns `{ status: "timeout" }`. Row shows "Still indexing… · retry". Retry polls again from current state. |
| Vercel 504 (hobby tier timeout) | Route exceeds Vercel's 10s hobby-tier limit before polling completes | Client receives a 504. **Treat 504 as `{ status: "timeout" }` client-side.** Spec requires Vercel pro tier (60s timeout) for the 45s cap to be meaningful. |
| ZeroEntropy unavailable | Ingest call times out or 5xx after SDK internal retry | Row shows "Failed · retry". |
| Auth missing | No session on `/api/upload` | 401 — client shows "Session expired. Refresh the page." |
| No doc_type selected | User clicks Process with null doc_types | Inline note under action row: "Select a type for each file." (12px `--text-secondary`). Button is NOT disabled — this is advisory. |
| cr_agent auto-ingest fails | `/api/onboarding/brain` returns error | Navigation to Frame 3.5 proceeds regardless. Founder can upload brand/competitor docs manually. |
| beforeunload with active uploads | Browser navigates away mid-upload | Show browser's native `beforeunload` prompt: "Upload in progress. Leave anyway?" |

---

## Post-Upload Dashboard Reflection

After successful upload:
1. `localStorage.burrow.brainSeeded = "1"` set client-side
2. `"Grounded %"` counter in TopStrip begins reflecting actual data once the Analyst starts scoring signals (it was 0% before). This happens naturally — no special wiring needed.
3. The `#briefing` "Your brain has no documents yet" prompt disappears (check `brainSeeded` on render).
4. No toast, no celebration. The dashboard just works.

---

## Component File Map

```
/app
  /onboarding
    /upload
      page.tsx             — Frame 3.5 page shell
      UploadFlow.tsx       — orchestrator component
  /_components
    UploadDropzone.tsx     — drag-drop + file picker
    UploadFileList.tsx     — list container
    UploadFileRow.tsx      — single file row with progress + status
    DocTypeSelector.tsx    — doc_type <select>
    MinimalCorpusTracker.tsx — P1 coverage pills
/app/api
  /upload
    route.ts               — POST handler: validate → base64 → ze.documents.add() → poll until indexed → return done/timeout
  /onboarding
    /brain
      route.ts             — POST handler: cr_agent auto-ingest (brand_guide + competitor_intel)

/lib
  classifyDocType.ts       — keyword/regex rules → DocType | null
  sampleCorpus.ts          — pre-built sample docs ingested on skip (metadata.sample: "true")
  zeroentropyClient.ts     — ZE SDK wrapper: addDocument, getDocumentInfo, deleteByMetadata, mockSearch
```

---

## State Management

Local to the upload flow. No global store changes needed.

```ts
type UploadFile = {
  id: string;          // uuid generated client-side
  file: File;
  docType: DocType | null;
  status: 'idle' | 'uploading' | 'processing' | 'done' | 'error';
  progress: number;    // 0–100, for the progress bar
  jobId?: string;
  error?: string;
};
```

`UploadFlow` owns `UploadFile[]` in `useState`. No Zustand for this flow — it's self-contained and doesn't need to share state with the main dashboard.

After completion: `router.push('/signals')` and set `localStorage.burrow.brainSeeded = "1"`.

---

## Open Questions (pre-review)

1. Should the doc_type selection be required (blocking "Process") or optional (we auto-classify server-side and let user confirm)? Current spec: required.
2. Should we show a doc count in the TopStrip somewhere? Current spec: no — the Grounded % counter already reflects brain quality.
3. Should the `#briefing` re-entry card disappear immediately when the user starts upload (optimistic), or only after files are indexed (accurate)? Current spec: only after indexed (accurate).
4. Should the upload page be accessible at any time (not just during onboarding), or gated to onboarding + re-entry? Current spec: both paths exist.

---

## CEO Review Findings

### What already exists
| Sub-problem | Existing code | Notes |
|---|---|---|
| Onboarding chrome + phases | `app/onboarding/OnboardingFlow.tsx` | Phases landing→research→form already built |
| Design tokens | `app/globals.css` + inline `C` object | Fully established, reuse directly |
| Brain agent storage pattern | `docs/specs/burrow_flow.md` Frame 4 | Pattern exists; ZeroEntropy client is net new |

### NOT in scope (deferred)
- MP3/MP4 audio transcription
- URL import (paste a link, we scrape it)  
- Team corpus sharing
- Corpus management / bulk re-upload UI
- Mock/fallback ZeroEntropy for demo resilience (post-MVP)
- "Paste text directly" alternative to file upload

### Scope expansion added by CEO review
**cr_agent auto-ingest (approved by premise gate D1):** After the company info form (Frame 3) is submitted and the Brain stores it, the Brain agent should additionally auto-ingest the cr_agent's structured output as ZeroEntropy documents:
- The "what the company does" + "features" → `brand_guide` doc
- The "competitors" entries → one `competitor_intel` doc per competitor
- This gives the corpus instant grounding with zero founder effort, before Frame 3.5 even starts.

### Verification requirement
After upload, the spec must be tested end-to-end: upload one `won_deal` doc, fetch one signal, verify the Analyst returns a retrieval from that doc in the Lead Card modal's Evidence region. If the retrieval doesn't appear, the upload pipeline ships but the demo is still hollow.

### Dream state delta
- **After Frame 2 (cr_agent):** Brain seeded with public-web data (brand_guide, icp, competitor_intel, case_study from website). Grounded % is partial — publicly sourced only.
- **After Frame 3.5 (upload):** Brain supplemented with private data (won_deal, lost_deal, call_transcript). Evidence region shows citations from both public and private docs. Grounded % rises to 99% as shown in the dashboard screenshot.
- **12-month ideal:** Every approved draft auto-indexes as a won_deal signal; every rejected draft auto-indexes as a lost_deal signal; corpus grows without manual upload; upload is only needed for historical private data at signup.

---

## Frame 3.5 — Updated Spec (post-CEO review)

### Changes from initial spec
1. **Auto-classify doc_type:** Server infers `doc_type` from filename + first 200 tokens; shows pre-filled selector for override. Manual assignment is override, not default.
2. **Show only 4 MVC doc_types in onboarding:** `won_deal`, `lost_deal`, `brand_guide`, `icp`. P2/P3 types hidden behind "Add more types →" link after initial upload.
3. **No job store, no client-side polling:** The POST handler blocks server-side until ZE indexing completes (or 45s timeout). No `/api/upload/status` endpoint needed. Upload state is tracked locally in React state only.
4. **Skip path with sample corpus fallback:** If founder skips, the system auto-loads a sample corpus from `/lib/sampleCorpus.ts` (fictional but plausible data) so the dashboard never shows 0%. The sample corpus is tagged `metadata.sample = true` and shown with a subtle "(sample)" label in the Evidence region.

---

## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|-----------|-----------|----------|---------|
| 1 | CEO | Add cr_agent auto-ingest | Scope expansion (approved) | P1 (completeness) | cr_agent already extracts brand/competitor data; auto-ingesting is free | Manual-only upload |
| 2 | CEO | Show only 4 MVC doc_types in onboarding | Mechanical | P5 (explicit over clever) | 9 types causes decision fatigue in 3-min demo | Show all 9 upfront |
| 3 | CEO | Auto-classify doc_type from filename + tokens | Taste decision | P5 (simpler) | Manual assignment is the highest friction point and most likely demo failure | Required manual |
| 4 | CEO | Job state in localStorage not server Map | Mechanical | P5 (simpler) | Server restart during hackathon setup kills in-flight uploads | In-memory Map |
| 5 | CEO | Sample corpus fallback on skip | Taste decision | P3 (pragmatic) | 0% Grounded on demo is a dead demo | No fallback |
| 6 | Design | Dropzone first, MVC tracker below | Mechanical | P5 (explicit) | Action precedes feedback; tracker before dropzone creates guilt checklist | Tracker at top |
| 7 | Design | Radix Select instead of native `<select>` | Mechanical | P5 (explicit) | Native `<select>` cannot be styled cross-browser to match design system | Native select |
| 8 | Design | Auto-classify doc_type (pre-fill, user overrides) | Taste decision | P5 (simpler) | Manual-required is highest friction point and most likely demo failure | Required manual |
| 9 | Design | Show only 4 MVC doc_types in onboarding | Mechanical | P3 (pragmatic) | 9 types causes decision fatigue; post-CEO decision confirmed | All 9 upfront |
| 10 | Design | Job state in localStorage | Mechanical | P5 (explicit) | Server restart during hackathon setup kills in-flight uploads | In-memory Map |
| 11 | Design | 6 missing states added to spec | Mechanical | P1 (completeness) | Unspecified states will be guessed by implementer | — |
| 12 | Design | Accessibility spec added | Mechanical | P1 (completeness) | No aria labels = screen reader unusable, keyboard nav broken | — |
| 13 | Design | Dark mode progress bar: `--text-primary` | Mechanical | P1 (completeness) | `--ink` (`#16213B`) is invisible against dark `--bg-base` (`#0F0E0D`) | Keep --ink |
| 14 | Design | Dropzone 160px, 24px vertical padding | Mechanical | P5 (explicit) | 120px is cramped with two lines of text at design spec padding | 120px |
| 15 | Design | Drop rejection: 200ms --red border flash | Mechanical | P5 (explicit) | No spec = engineer guesses (likely nothing or alert toast) | — |
| 16 | Design | "Indexing…" is static text, no animation | Mechanical | P5 (explicit) | Animated ellipsis violates brief's prohibition on looping animations | — |
| 17 | Design | Disabled button: opacity 0.5 + pointer-events none | Mechanical | P5 (explicit) | "80% opacity, not grayed-out" was contradictory | Vague 80% spec |
| 18 | Design | Aggregate 1px progress bar above file list | Mechanical | P5 (simpler) | Multi-file processing needs a total progress signal; single bar is brief-compliant | No aggregate bar |
| 19 | Eng | Server-side blocking poll — no job store, no client-side polling | Mechanical | P5 (simpler) | ZE indexing is async; server polls get_info() with 45s cap, returns done/timeout. Frontend stays simple. | Client-side polling with status endpoint |
| 20 | Eng | MIME magic bytes validation via `file-type` | Mechanical | P1 (completeness) | Extension-only validation allows MIME spoofing attacks | Extension check |
| 21 | Eng | Auth check on both upload routes | Mechanical | P1 (completeness) | Unauthenticated uploads expose ZeroEntropy to abuse | No auth spec |
| 22 | Eng | `runtime = 'nodejs'` + busboy for multipart | Mechanical | P5 (explicit) | formidable requires Node IncomingMessage, incompatible with App Router Web Request | formidable |
| 23 | Eng | sha256(base64) as document_path for idempotent ingest | Mechanical | P5 (explicit) | Same file on retry uses same document_path; ZE upserts rather than duplicates | Random UUID per upload |
| 24 | Eng | Promise.all with p-limit(5) for chunk ingest | Mechanical | P1 (completeness) | Serial N+1 ingest is slow; parallel with cap is safe and fast | Serial loop |
| 25 | Eng | Extract OnboardingChrome to shared component | Mechanical | P5 (explicit) | Private Chrome component will be duplicated without extraction | Duplication |
| 26 | Eng | Session-scoped batch enforcement server-side | Mechanical | P1 (completeness) | Client-only batch limit can be bypassed via direct API POST | Client-only |
| 27 | Eng | classifyDocType keyword/regex rules (not LLM) | Mechanical | P5 (simpler) | LLM call adds latency and cost; regex is deterministic and demo-safe | LLM classify |
| 28 | Eng | jobId ownership validation in status endpoint | Mechanical | P1 (completeness) | UUID jobIds without ownership check are enumerable | No ownership |
| 29 | Eng | sample corpus purge on first real ingest | Mechanical | P5 (explicit) | Sample data mixes with real results unless explicitly purged | Permanent sample |
| 30 | Eng | cr_agent failure non-blocking for navigation | Mechanical | P6 (bias to action) | cr_agent ingest failure should not block the founder from Frame 3.5 | Block on error |
| 31 | DX | zeroentropyClient.ts SDK wrapper added | Mechanical | P1 (completeness) | Concrete stub with mock mode enables test #4 without real ZE account; uses official SDK | Custom fetch stub |
| 32 | DX | App Router multipart: busboy + runtime=nodejs | Mechanical | P5 (explicit) | formidable + Pages Router config silently fails in App Router | formidable |
| 33 | DX | No /api/upload/status route — server-side poll handles it | Mechanical | P5 (explicit) | Client-side polling requires a status endpoint; server-side poll eliminates that need | Status endpoint + client polling |
| 34 | DX | No serverExternalPackages needed (pdf-parse + mammoth removed) | Mechanical | P5 (simpler) | ZE content.type:"auto" handles parsing server-side; no native Node modules to externalize | serverExternalPackages config |
| 35 | DX | Pin file-type@18 (v19+ ESM-only) | Mechanical | P5 (explicit) | v19+ breaks CJS Next.js default config | Latest version |
| 36 | DX | .env.example block added to spec | Mechanical | P1 (completeness) | Env vars scattered in prose; engineer creates inconsistent naming | Prose-only |
| 37 | DX | ZERO_ENTROPY_MOCK=true enables test #4 end-to-end | Mechanical | P1 (completeness) | Without mock mode, critical smoke test requires a real ZE account | No mock |
| 38 | Eng (gap resolution) | Official zeroentropy npm SDK instead of custom fetch client | Mechanical | P1 (completeness) | SDK has correct API contract; custom fetch had unverified endpoint paths and auth headers | Custom zeroentropyClient.ts with raw fetch() |
| 39 | Eng (gap resolution) | ZE content.type:"auto" instead of pdf-parse + mammoth | Mechanical | P5 (simpler) | ZE parses server-side; local extraction adds two native modules, extraction bugs, and webpack config | pdf-parse + mammoth + extractText.ts |
| 40 | Eng (gap resolution) | Server-side blocking poll (45s cap) for async ZE indexing | Mechanical | P5 (simpler) | ZE indexing is async; server polls get_info() until indexed before returning. Frontend stays simple. | Client-side polling with /api/upload/status route |
| 41 | Eng (gap resolution) | ZE parse failure manifests as timeout — documented, not fixed | Mechanical | P3 (pragmatic) | No explicit "failed" status in ZE's v1 API; document the known gap, defer better UX to post-MVP | Surface parse error separately |
| 42 | Eng (gap resolution) | Requires Vercel pro tier (60s timeout); treat 504 as timeout client-side | Mechanical | P1 (completeness) | 45s cap exceeds hobby tier 10s limit; 504 must be handled client-side or it becomes an unhandled rejection | Hobby tier / reduce cap to 8s |

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 3 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**OUTSIDE VOICE:** Claude subagent. Found 2 real issues (ZE parse failure invisible behind timeout; 45s cap requires Vercel pro). Both accepted and applied to spec. One non-issue (SDK edge runtime concern — moot, `runtime = 'nodejs'` already set).

**UNRESOLVED:** 0 decisions left unresolved.

**VERDICT:** ENG CLEARED — all three gaps resolved (D38: official SDK, D39: ZE auto-parse, D40: server-side blocking poll). Two outside-voice findings incorporated (D41, D42). Ready to implement.
