# Burrow — Implementation Guide for a Coding Agent

Read this in full before writing a single line of code. This document, the system architecture diagram (`burrow-complete-flow-with-upload.svg`), and the frontend design brief (`burrow-frontend-design.md`) are the three artifacts you need to one-shot the build.

This guide covers the two external APIs the system depends on — **ZeroEntropy** and **TheHog** — and the wiring around them: when each is called, what the request/response shape is, how to handle async operations, and where the gotchas live.

---

## Table of contents

1. [What you're building, in one paragraph](#what-youre-building-in-one-paragraph)
2. [Stack decisions](#stack-decisions)
3. [Project layout](#project-layout)
4. [Database schema](#database-schema)
5. [ZeroEntropy — the retrieval brain](#zeroentropy--the-retrieval-brain)
6. [TheHog — the signals + enrichment senses](#thehog--the-signals--enrichment-senses)
7. [Claude — the judgment and drafting layer](#claude--the-judgment-and-drafting-layer)
8. [End-to-end wiring per frame](#end-to-end-wiring-per-frame)
9. [Environment variables (full list)](#environment-variables-full-list)
10. [Failure modes and demo-day mitigations](#failure-modes-and-demo-day-mitigations)
11. [Build order — what to do in what sequence](#build-order--what-to-do-in-what-sequence)

---

## What you're building, in one paragraph

Burrow is an AI-native growth workspace. A founder pastes their company URL on a landing page; a research agent crawls the site, fills a form, and seeds the brain. The founder optionally uploads private docs (won deals, lost deals, brand guide, ICP) in Frame 3.5. Then they land in a Slack-style workspace with five channels. They click "Fetch signals" to pull buying-intent leads from TheHog. They click "Find outreach" to rank those leads against their company profile using ZeroEntropy's reranker. The top 5 get enriched (contact info + rich profile via TheHog), drafted (Claude Haiku, grounded in retrieved voice + proven copy), and shown in `#drafts`. The founder approves; the email sends; the card moves to `#sent`. The entire pitch is *grounded retrieval* — every claim Burrow makes points to a specific document or signal in the brain.

---

## Stack decisions

Make these now and don't revisit:

- **Frontend:** Next.js 14+ App Router, TypeScript, Tailwind CSS. No state management library — `useState` and `useReducer` are enough.
- **Backend:** Next.js API routes (App Router) running on `runtime = 'nodejs'`. No separate FastAPI service. (The original spec said FastAPI but Next.js routes ship faster at hackathon scale.)
- **Database:** Supabase Postgres. Hosted free tier. **You do not need pgvector** because ZeroEntropy owns the chunked-content retrieval layer. Postgres holds workspace metadata, signals, leads, drafts, agent events, and the retrievals audit log.
- **Realtime:** Supabase Realtime subscribed to the `agent_events` table. Postgres `INSERT` → frontend re-renders. This replaces the WebSocket layer from the original spec and is significantly less code.
- **Auth:** Supabase Auth with magic links. One session, one workspace. No teams.
- **Email send:** Resend.com. One-line API call. Free tier is plenty.
- **LLM:** Anthropic Claude SDK. `claude-haiku-4-5` for drafting (cheap, fast). `claude-sonnet-4-5` for the Analyst's judgment step (better reasoning, worth the cost for the most important call).
- **Document extraction:** Let ZeroEntropy handle PDF/DOCX parsing via `content.type = "auto"`. You only need to read raw bytes and base64-encode them.

You do not need: Redis, message queues, Docker, microservices, a separate worker process, Zustand/Redux, a custom WebSocket server, pgvector, pdf-parse, or mammoth.

---

## Project layout

```
/app
  /(onboarding)
    page.tsx                    Frame 1: landing
    /research/page.tsx          Frame 2: cr_agent status
    /confirm/page.tsx           Frame 3: company form
    /upload/page.tsx            Frame 3.5: document upload
  /(workspace)
    /signals/page.tsx           Frame 5+: main channels
    /drafts/page.tsx
    /sent/page.tsx
    /briefing/page.tsx
    /ask/page.tsx
  /api
    /research/route.ts          Frame 2: cr_agent crawler (uses Hog deep-research)
    /onboarding/brain/route.ts  Frame 3: seed brain from form into ZE
    /upload/route.ts            Frame 3.5: doc upload pipeline
    /signals/fetch/route.ts     Frame 6: hit Hog people/search
    /outreach/rank/route.ts     Frame 8+9: ZE rerank
    /outreach/enrich/route.ts   Frame 10: Hog enrichments (async + poll)
    /outreach/draft/route.ts    Frame 11: Claude draft
    /outreach/send/route.ts     Frame 12: Resend email
/lib
  zeroentropy.ts                ZE SDK client + helpers
  thehog.ts                     Hog API client + helpers (auth + polling)
  claude.ts                     Anthropic SDK wrapper
  supabase.ts                   server + client instances
  classifyDocType.ts            keyword/regex rules for upload pipeline
/components
  ...                           UI components per design brief
/sql
  001_init.sql                  schema migration
```

---

## Database schema

One SQL file, run once on the Supabase Postgres. No pgvector required.

```sql
-- /sql/001_init.sql

CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  company_url text NOT NULL,
  one_liner text,
  description text,
  icp text,
  pricing text,
  features jsonb,                -- array of strings
  competitors jsonb,             -- array of strings
  success_stories jsonb,         -- array of {name, description, source}
  ze_collection_name text UNIQUE NOT NULL,  -- equals workspace id as string
  brain_seeded boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  source text NOT NULL,          -- 'reddit' | 'x' | 'linkedin' | 'hn'
  external_id text,              -- Hog's internal id
  url text,
  author_handle text,
  author_identifier jsonb,       -- {linkedin_url, x_username, reddit_username, etc.}
  content text NOT NULL,
  raw_payload jsonb,             -- everything Hog returned
  fetched_at timestamptz DEFAULT now()
);

CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  signal_id uuid REFERENCES signals(id) ON DELETE CASCADE,
  fit_score float NOT NULL,
  fit_reason text NOT NULL,
  suggested_play text NOT NULL,
  retrieval_id uuid,             -- FK added below after retrievals table
  enrichment jsonb,              -- entire Hog /api/enrichments response payload
  contact_email text,
  contact_name text,
  contact_company text,
  enrichment_status text DEFAULT 'pending', -- 'pending' | 'done' | 'failed'
  hog_enrichment_operation_id text,         -- for polling
  created_at timestamptz DEFAULT now()
);

CREATE TABLE drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  channel text NOT NULL,         -- 'email' | 'public_reply' | 'dm'
  subject text,
  body text NOT NULL,
  voice_retrieval_id uuid,
  proven_retrieval_id uuid,
  status text DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected' | 'sent'
  sent_message_id text,          -- Resend's message id
  created_at timestamptz DEFAULT now(),
  decided_at timestamptz
);

CREATE TABLE retrievals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  agent text NOT NULL,           -- 'analyst' | 'writer' | 'rerank'
  query text NOT NULL,
  ze_filter jsonb NOT NULL,
  ze_results jsonb NOT NULL,
  latency_ms int NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE leads ADD CONSTRAINT leads_retrieval_fk
  FOREIGN KEY (retrieval_id) REFERENCES retrievals(id);
ALTER TABLE drafts ADD CONSTRAINT drafts_voice_retrieval_fk
  FOREIGN KEY (voice_retrieval_id) REFERENCES retrievals(id);
ALTER TABLE drafts ADD CONSTRAINT drafts_proven_retrieval_fk
  FOREIGN KEY (proven_retrieval_id) REFERENCES retrievals(id);

CREATE TABLE agent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  agent text NOT NULL,           -- 'scout' | 'analyst' | 'writer' | 'chief'
  kind text NOT NULL,            -- 'signal_seen' | 'lead_created' | 'draft_created' | 'draft_approved' | 'briefing'
  payload jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX agent_events_ws_idx ON agent_events(workspace_id, created_at DESC);
CREATE INDEX signals_ws_idx ON signals(workspace_id, fetched_at DESC);
CREATE INDEX leads_ws_idx ON leads(workspace_id, created_at DESC);
CREATE INDEX drafts_status_idx ON drafts(workspace_id, status, created_at DESC);
```

Enable Supabase Realtime on `agent_events`, `leads`, and `drafts` so the UI can subscribe.

---

## ZeroEntropy — the retrieval brain

### The mental model

ZeroEntropy is a managed retrieval service. You give it documents grouped into a **collection**; it parses, chunks, embeds, and indexes them. You query the collection with natural language and get back ranked results. **It owns the retrieval layer entirely** — you don't need pgvector, you don't write chunkers, you don't manage embeddings.

> **Architecture note:** This supersedes the v2 architecture doc's "Vault has its own `chunks` table." The Vault still holds entities-like rows (`signals`, `leads`, `drafts`, `retrievals`), but the actual chunked **content** lives inside ZeroEntropy collections, not in Postgres. This is simpler. Do it this way.

### Setup

```bash
npm install zeroentropy
```

```bash
# .env.local
ZEROENTROPY_API_KEY=ze_...
```

```typescript
// /lib/zeroentropy.ts
import { ZeroEntropy } from "zeroentropy";

export const ze = new ZeroEntropy({
  apiKey: process.env.ZEROENTROPY_API_KEY!,
});

export async function ensureCollection(workspaceId: string) {
  try {
    await ze.collections.add({ collection_name: workspaceId });
  } catch (err: any) {
    // 409 means it already exists
    if (err.status !== 409) throw err;
  }
}
```

Call `ensureCollection(workspaceId)` once when a workspace is created.

### Adding documents

Three content shapes matter for Burrow.

**Plain text** — for cr_agent extracted content, form fields, signals, uploaded `.md`/`.txt`/`.csv`:

```typescript
await ze.documents.add({
  collection_name: workspaceId,
  path: `won_deal/initech-${Date.now()}`,  // any unique string within the collection
  content: { type: "text", text: extractedString },
  metadata: {
    doc_type: "won_deal",       // CRITICAL — used for filtering on every query
    source: "upload",            // or "cr_agent", "form", "signal"
    title: "Initech win notes",
    uploaded_at: new Date().toISOString(),
  },
});
```

**PDF / DOCX** — for uploaded files in Frame 3.5. Use `type: "auto"` and base64-encode:

```typescript
import { readFileSync } from "fs";

const buffer = readFileSync(filePath);
const b64 = buffer.toString("base64");

await ze.documents.add({
  collection_name: workspaceId,
  path: `lost_deal/acme-${Date.now()}`,
  content: { type: "auto", base64_data: b64 },
  metadata: { doc_type: "lost_deal", source: "upload" },
});
```

**ZeroEntropy parses PDFs and DOCX server-side via OCR.** Do not install pdf-parse or mammoth — the upload route just reads the file buffer, base64-encodes it, and hands it to ZE.

**Multi-page text** — rare; only if you've already paginated content yourself:

```typescript
content: { type: "text-pages", pages: [page1Text, page2Text, ...] }
```

### Metadata schema — the contract between ZE and the rest of the system

Every document must carry these fields. The Analyst's filters depend on them:

```typescript
type BurrowDocMetadata = {
  doc_type:
    | "brand_guide"        // company voice + ICP definition
    | "icp"                // separate ICP doc if uploaded
    | "won_deal"           // closed-won deal notes
    | "lost_deal"          // closed-lost deal notes
    | "competitor_intel"   // one per competitor
    | "case_study"
    | "call_transcript"
    | "pricing_objection"
    | "faq"
    | "signal";            // ingested social signals
  source: "cr_agent" | "form" | "upload" | "signal" | "sample";
  title: string;
  uploaded_at: string;
  sample?: "true" | "false";
  signal_id?: string;       // when doc_type === "signal", link back to signals.id
};
```

**ZeroEntropy stores metadata as `Dict[str, str | List[str]]`.** Cast everything to string before sending. Booleans become `"true"` / `"false"`, numbers become strings.

### Querying — `top_snippets` is the workhorse

`queries.top_snippets()` returns sub-document text spans with scores and source paths. This is what powers the Lead Card evidence view.

```typescript
const result = await ze.queries.top_snippets({
  collection_name: workspaceId,
  query: "14-person team hit by Pinecone pricing considering self-hosted Qdrant",
  k: 5,
  filter: { doc_type: { $eq: "won_deal" } },
  precise_responses: true,
});

// result.results = [{
//   path: "won_deal/initech-...",
//   start_index: 432,
//   end_index: 871,
//   page_span: [1, 1],
//   content: "...the actual snippet text...",
//   score: 0.89
// }, ...]
```

Filters support Mongo-style operators: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`.

### The three Analyst retrievals (the heart of the product)

When a new signal needs scoring, run three filtered queries in parallel:

```typescript
async function analyzeSignal(workspaceId: string, signalContent: string) {
  const startedAt = Date.now();

  const [wonDeals, lostDeals, brandGuide] = await Promise.all([
    ze.queries.top_snippets({
      collection_name: workspaceId,
      query: signalContent,
      k: 5,
      filter: { doc_type: { $eq: "won_deal" }, sample: { $ne: "true" } },
      precise_responses: true,
    }),
    ze.queries.top_snippets({
      collection_name: workspaceId,
      query: signalContent,
      k: 5,
      filter: { doc_type: { $eq: "lost_deal" }, sample: { $ne: "true" } },
      precise_responses: true,
    }),
    ze.queries.top_snippets({
      collection_name: workspaceId,
      query: signalContent,
      k: 3,
      filter: { doc_type: { $in: ["brand_guide", "icp"] } },
      precise_responses: true,
    }),
  ]);

  // Save the winning retrieval to Postgres so the Lead Card can cite it
  const retrieval = await saveRetrieval(
    workspaceId,
    "analyst",
    signalContent,
    { doc_type: "won_deal" },
    wonDeals.results,
    Date.now() - startedAt
  );

  return { wonDeals, lostDeals, brandGuide, retrievalId: retrieval.id };
}
```

The three result sets get composed into a Claude prompt that returns `{fit_score, fit_reason, suggested_play}`. See the Claude section.

### Reranker calls (Frame 9 — ranking signals against the company profile)

When you have a list of candidate strings already (the signals fetched from Hog in Frame 6), use `models.rerank` directly. No collection needed:

```typescript
const ranked = await ze.models.rerank({
  model: "zerank-2",
  query: `${workspace.one_liner}. Our ICP: ${workspace.icp}`,
  documents: signals.map(s => s.content),
  top_n: 5,
});

// ranked.results = [{ index: 7, relevance_score: 0.91 }, ...]
// Use `index` to map back to the original signal in your array.
```

**The threshold rule for Frame 9:** filter `ranked.results` by `relevance_score >= 0.5` before returning. If the filtered list is empty, return zero results to the UI. **Do not pad to five with low-quality matches.** This is what the spec means by "we don't want to show any if none fit outreach compatibility." It's also what differentiates Burrow from generic lead-gen tools — showing nothing when nothing fits is a feature.

### Indexing is asynchronous

After `documents.add()` returns, the document is not immediately queryable. ZE has to parse, chunk, and embed it. There are two ways to handle this:

**Production-correct:** poll `ze.documents.get_info({ path, collection_name })` for `index_status === "indexed"`.

```typescript
async function waitForIndex(workspaceId: string, path: string, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const info = await ze.documents.get_info({
      collection_name: workspaceId,
      path,
    });
    if (info.document.index_status === "indexed") return true;
    if (info.document.index_status.endsWith("_failed")) throw new Error("Index failed");
    await sleep(1000);
  }
  throw new Error("Index timeout");
}
```

**Hackathon-pragmatic:** sleep 2-3 seconds and assume it's done. Acceptable for the cr_agent seed and the upload pipeline. For signals (which are tiny strings) indexing is nearly instant.

Do the production-correct version for the upload pipeline (Frame 3.5) because the founder is watching the UI and the row says "Indexing…". Do the pragmatic version for signal ingestion (Frame 7) because they're small and the latency budget is tight.

### Saving the retrievals audit trail

Every ZE call that the Analyst or Writer makes should write to the `retrievals` table:

```typescript
async function saveRetrieval(
  workspaceId: string,
  agent: "analyst" | "writer" | "rerank",
  query: string,
  filter: object,
  results: any[],
  latencyMs: number
) {
  const { data } = await supabase
    .from("retrievals")
    .insert({
      workspace_id: workspaceId,
      agent,
      query,
      ze_filter: filter,
      ze_results: results,
      latency_ms: latencyMs,
    })
    .select()
    .single();
  return data!;
}
```

This is the load-bearing trust mechanism. Without it, the Lead Card's "Show evidence" view has nothing to show.

### ZeroEntropy gotchas

- **Indexing is async.** Doc added ≠ doc queryable. Poll or sleep.
- **Metadata is `string | list[string]`.** Cast booleans and numbers to strings.
- **`path` must be unique within a collection.** Always include a timestamp or hash in the path.
- **`ConflictError` (409)** fires when adding a collection or document path that exists. Wrap collection creation in try/catch.
- **`precise_responses: true`** gives tighter snippet spans, useful for the evidence view. Use it.

---

## TheHog — the signals + enrichment senses

### Base URL and auth

```
https://developer.thehog.ai
```

Two custom headers on every request — **not** a bearer token:

```
X-Access-Key: ak_...
X-Secret-Key: sk_...
```

Get the values from `platform.thehog.ai/credentials`.

```bash
# .env.local
THEHOG_ACCESS_KEY=ak_...
THEHOG_SECRET_KEY=sk_...
THEHOG_BASE_URL=https://developer.thehog.ai
```

```typescript
// /lib/thehog.ts
const HOG_BASE = process.env.THEHOG_BASE_URL!;
const HOG_AK = process.env.THEHOG_ACCESS_KEY!;
const HOG_SK = process.env.THEHOG_SECRET_KEY!;

async function hogFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${HOG_BASE}${path}`, {
    ...init,
    headers: {
      "X-Access-Key": HOG_AK,
      "X-Secret-Key": HOG_SK,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Hog ${res.status} on ${path}: ${body}`);
  }
  return res.json();
}
```

### The five Hog endpoints Burrow uses

The Hog console exposes these. All are tagged "Beta" — expect quirks.

| Endpoint | Method | Purpose in Burrow | Sync or async? |
|---|---|---|---|
| `/api/v1/people/search` | POST | **Frame 6** — find signal-shaped leads by natural-language query | Sync |
| `/api/v1/companies/search` | POST | **Frame 6 alt** — find target companies by query + signal filters | Sync |
| `/api/enrichments` | POST | **Frame 10** — kick off a contact enrichment operation | Async (returns operation id) |
| `/api/enrichments/:id` | GET | **Frame 10** — poll for enrichment result | Sync (the poll) |
| `/api/deep-research` | POST | **Frame 2** — alternative cr_agent backend with structured JSON output | Async |
| `/api/operations/:id` | GET | Generic operation polling | Sync (the poll) |

### Endpoint: `POST /api/v1/people/search` — Frame 6 (the signal source)

This is what Scout calls when the founder clicks "Fetch signals." It takes a natural-language query and returns matching people with their signals.

```typescript
async function fetchSignalsFromHog(workspace: Workspace) {
  // Build a natural-language query from the workspace's ICP.
  // The Hog API is built around NL queries, not structured filters.
  const query = buildIcpQuery(workspace);
  // e.g. "VP Engineering at 10-50 person AI startups complaining about vector DB costs"

  return hogFetch("/api/v1/people/search", {
    method: "POST",
    body: JSON.stringify({
      query,
      limit: 25,
      includeContacts: true,   // include contact info inline (when available)
      includeSignals: true,    // include the underlying intent signals
    }),
  });
}
```

The response is paginated; for the hackathon, one call returning 25 is plenty.

**Response shape (inferred from the examples; verify in the console after first call):**

```typescript
type PeopleSearchResponse = {
  people: Array<{
    id: string;
    name?: string;
    title?: string;
    linkedin_url?: string;
    company?: {
      name?: string;
      domain?: string;
    };
    contacts?: {
      email?: string;
      phone?: string;
    };
    signals?: Array<{
      type: string;              // e.g. "pricing_complaint", "hiring", "tool_evaluation"
      source: string;            // "reddit" | "x" | "linkedin" | "hn"
      url?: string;
      content: string;           // the actual post/comment text
      captured_at?: string;
    }>;
  }>;
  total?: number;
  cursor?: string;               // for pagination
};
```

**Important:** the "signal" is the *post* surfaced under the person, not the person themselves. In Burrow's mental model:
- A `signal` row gets created for each `person.signals[i]` (one signal = one piece of intent-bearing content).
- The person's contact info (`person.contacts.email`, etc.) goes onto the eventual `lead` row.
- The `signals.author_identifier` JSONB stores everything needed to re-enrich later: `{ linkedin_url, person_id, ... }`.

**Companies search** (`/api/v1/companies/search`) is the same pattern but for companies. Useful for the founder's `#ask` channel ("find me hiring SaaS companies in Austin"), but not required for the core flow.

### Endpoint: `POST /api/enrichments` — Frame 10 (the rich contact lookup)

This is the **deep enrichment** call. It returns far more than email. The `fields` array is how you tell Hog what to fetch.

#### Critical context for this endpoint (read carefully)

> The user-provided minimal example shows `"fields": ["contact.email", "contact.phone"]`. **That's just a starter.** Burrow needs everything Hog can return about the person, because the Writer uses the full profile to ground the draft. Email alone produces generic outreach. Request the kitchen sink. Store it as JSONB on the `leads` row. Reference it again when drafting and when the founder asks about the lead in `#ask`.

#### Request

```typescript
async function startEnrichment(person: { linkedin_url?: string; /* etc */ }) {
  const res = await hogFetch("/api/enrichments", {
    method: "POST",
    body: JSON.stringify({
      identifier: {
        // Pass whichever identifier is most stable for this person.
        // Prefer linkedin_url > person_id > company_domain.
        linkedin_url: person.linkedin_url,
      },
      fields: [
        // Person basics
        "person.name",
        "person.title",
        "person.headline",
        "person.location",
        "person.bio",
        "person.seniority",
        "person.years_of_experience",
        // Contact
        "contact.email",
        "contact.phone",
        "contact.linkedin_url",
        "contact.x_url",
        "contact.github_url",
        // Company
        "company.name",
        "company.domain",
        "company.size",
        "company.industry",
        "company.funding_stage",
        "company.funding_total",
        "company.tech_stack",
        "company.founded_year",
        "company.description",
        // Activity / signals
        "activity.recent_posts",
        "activity.recent_comments",
        "activity.engagement_topics",
        "activity.hiring_signals",
        "activity.product_mentions",
      ],
    }),
  });
  // Response: { operation_id: "op_..." }
  return res.operation_id as string;
}
```

> **Field names above are illustrative.** Burrow's intent is "give me everything you can about this person, especially their company and recent activity." If the console exposes additional fields like `person.education`, `company.recent_news`, or `activity.last_seen`, **add them.** The principle is "request more than you think you need; you'll use it for personalization."

#### Polling for the result

`/api/enrichments` is async. It returns an `operation_id`. You then GET the enrichment by id until status is terminal:

```typescript
async function pollEnrichment(operationId: string, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await hogFetch(`/api/enrichments/${operationId}`);
    // Expected: { status: "pending" | "running" | "done" | "failed", result?: {...}, error?: "..." }
    if (res.status === "done") return res.result;
    if (res.status === "failed") throw new Error(res.error ?? "enrichment failed");
    await sleep(2000);
  }
  throw new Error("enrichment timeout");
}
```

You can also poll via the generic `/api/operations/:id` endpoint — the shape should be the same. Pick one and stick with it.

#### Storing the enrichment

The enrichment payload is rich. Store the whole thing:

```typescript
await supabase
  .from("leads")
  .update({
    enrichment: enrichmentResult,           // entire JSONB
    contact_email: enrichmentResult.contact?.email,
    contact_name: enrichmentResult.person?.name,
    contact_company: enrichmentResult.company?.name,
    enrichment_status: "done",
  })
  .eq("id", leadId);
```

The Writer pulls from `lead.enrichment` when drafting (Frame 11). The `#ask` channel also reads from it when the founder asks about a specific lead.

#### Handling enrichment failures

Hog won't always find a person's email. If `enrichment.contact?.email` is null after a successful operation:

- **Do not fabricate an email.** Mark the lead `enrichment_status = 'partial'`.
- Either skip drafting this lead (silently replace with the next-ranked signal from the top 5), or draft a public-reply variant (a Reddit comment, an X reply) instead of an email. The `suggested_play` from the Analyst tells you which path the founder wanted.

### Endpoint: `POST /api/deep-research` — Frame 2 (optional alternative cr_agent backend)

The original spec has Burrow run its own crawler to read company URLs. Hog's `deep-research` endpoint can do this for you with structured output — you give it URLs and a JSON schema, and it fills the schema.

```typescript
async function runDeepResearch(companyUrl: string) {
  const res = await hogFetch("/api/deep-research", {
    method: "POST",
    body: JSON.stringify({
      prompt: "Extract the company's value proposition, pricing model, product features, target customers, named customer success stories, and named competitors. Be specific. Quote where possible.",
      urls: [companyUrl],
      schema: {
        type: "object",
        properties: {
          one_liner: { type: "string" },
          description: { type: "string" },
          icp: { type: "string", description: "Ideal customer profile - role, company size, pain, triggers" },
          pricing: { type: "string" },
          features: { type: "array", items: { type: "string" } },
          competitors: { type: "array", items: { type: "string" } },
          success_stories: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                source: { type: "string" },
              },
              required: ["name", "description"],
            },
          },
        },
        required: ["one_liner", "description", "icp"],
      },
    }),
  });
  // res = { operation_id: "op_..." }
  return res.operation_id as string;
}
```

Then poll via `/api/operations/:id`:

```typescript
async function pollOperation(operationId: string, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await hogFetch(`/api/operations/${operationId}`);
    if (res.status === "done") return res.result;
    if (res.status === "failed") throw new Error(res.error ?? "operation failed");
    await sleep(3000);
  }
  throw new Error("operation timeout");
}
```

**Recommendation:** use `deep-research` for Frame 2. It replaces the cr_agent crawler entirely — Hog's research is more reliable than rolling your own, and the structured-schema output drops cleanly into the form Frame 3 displays. The founder confirms/edits and submits.

### Sleep helper

You'll need this for both ZE indexing waits and Hog operation polling:

```typescript
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
```

### TheHog gotchas

- **The auth is two custom headers, not a bearer token.** `X-Access-Key` and `X-Secret-Key`. Easy to typo.
- **Credits are real and limited.** Check `platform.thehog.ai/usage` and the Credits counter before demo day. Each enrichment burns a credit. Cache aggressively.
- **`/api/enrichments` and `/api/deep-research` are async.** They return an `operation_id`; you poll for the result. Do not block a Next.js API route waiting on a 60-second poll — either return the operation_id to the client and let the client poll, or use a Supabase Edge Function for the long-running poll.
- **For the demo, blocking polls inside the API route are fine** since the founder is actively waiting. Just keep the timeouts tight (60s for enrichment, 120s for deep-research).
- **Cache enrichment by `(workspace_id, linkedin_url)`.** If you've enriched a person in the last 24h, return the cached row instead of re-burning credits.
- **Identifier mapping matters.** Prefer `linkedin_url` > `x_user_id` > `reddit_username`. If a signal only has a Reddit username, you may not get a usable email. That's fine — fall back to public_reply.
- **All endpoints are Beta-tagged.** Shapes may change. Log full responses to a debug log during development.

---

## Claude — the judgment and drafting layer

### Setup

```bash
npm install @anthropic-ai/sdk
```

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
```

```typescript
// /lib/claude.ts
import Anthropic from "@anthropic-ai/sdk";

export const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});
```

### The Analyst prompt (Sonnet)

```typescript
async function scoreSignal(
  signalContent: string,
  wonSnippets: Snippet[],
  lostSnippets: Snippet[],
  brandSnippets: Snippet[]
) {
  const prompt = `You are an analyst scoring a buying-intent signal against our company's history.

# The signal we just saw
${signalContent}

# Closed-won deals that look similar (with similarity scores)
${wonSnippets.map((s, i) => `[W${i+1}] (${s.score.toFixed(2)}) ${s.content}`).join("\n\n") || "(none)"}

# Closed-lost deals that look similar
${lostSnippets.map((s, i) => `[L${i+1}] (${s.score.toFixed(2)}) ${s.content}`).join("\n\n") || "(none)"}

# Our ICP definition
${brandSnippets.map(s => s.content).join("\n\n")}

# Task
Return a JSON object with these exact keys:
- "fit_score": float 0.0 to 1.0
- "fit_reason": one sentence. Must reference a specific won-deal or lost-deal pattern by name from the evidence above. If neither matches well, say so.
- "suggested_play": one of "dm" | "public_reply" | "wait"

Output ONLY the JSON. No preamble, no markdown fence.`;

  const response = await claude.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return JSON.parse(text.trim());
}
```

### The Writer prompt (Haiku)

```typescript
async function draftMessage(
  signal: Signal,
  enrichment: any,
  voiceSnippets: Snippet[],
  provenSnippets: Snippet[],
  workspace: Workspace
) {
  const recipient = enrichment.person?.name ?? "there";
  const recipientTitle = enrichment.person?.title ?? "";
  const recipientCompany = enrichment.company?.name ?? "";

  const prompt = `Write a short outreach email.

# Recipient
- Name: ${recipient}
- Title: ${recipientTitle}
- Company: ${recipientCompany}
- Bio: ${enrichment.person?.bio ?? "(unknown)"}
- Recent activity: ${(enrichment.activity?.recent_posts ?? []).slice(0,2).map((p:any)=>p.content ?? p).join(" | ")}

# What they posted (this is what we're responding to)
${signal.content}

# Our company
${workspace.one_liner}

# Our voice (from the brand guide)
${voiceSnippets.map(s => s.content).join("\n\n")}

# A message that worked on someone like them
${provenSnippets[0]?.content ?? "(none on file)"}

# Rules
- 3-5 sentences. No more.
- Lead with shared technical pain, not the product.
- Acknowledge a specific detail from their post or recent activity.
- Mention our company only as a footnote, never as a pitch.
- No emojis. No "Hope you're doing well." No "I came across your post."
- Write in our voice, not generic SaaS voice.

# Output
Return a JSON object with these exact keys:
- "subject": short, lowercase, no marketing words
- "body": the email body, plain text, no signature

Output ONLY the JSON.`;

  const response = await claude.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return JSON.parse(text.trim());
}
```

---

## End-to-end wiring per frame

This section maps every frame from the diagram to the actual API calls. Use it as your implementation checklist.

### Frame 1 — Landing
Static page. User pastes URL. POST to `/api/research` with the URL → redirect to `/research?op=<op_id>`.

### Frame 2 — cr_agent research
`/api/research/route.ts`:
1. Call `runDeepResearch(companyUrl)` → get `operation_id`.
2. Return `{ operation_id }` to the client.
3. Client page polls `/api/research/status?id=<op_id>` which proxies `GET /api/operations/:id`.
4. When `status === "done"`, redirect to `/confirm` with the extracted profile.

### Frame 3 — Confirmation form
Form pre-populated with the deep-research output. User edits and submits.
On submit, POST to `/api/onboarding/brain` with the full structured profile.

`/api/onboarding/brain/route.ts`:
1. Create or fetch the workspace row.
2. `ensureCollection(workspaceId)`.
3. For each derivable doc, call `ze.documents.add`:
   - One `brand_guide` doc combining `one_liner + description + features + pricing`.
   - One `icp` doc with the ICP text.
   - One `competitor_intel` doc per competitor.
   - One `case_study` doc per success story.
4. Mark workspace `brain_seeded = true`.
5. Return `{ ok: true }` → client redirects to `/onboarding/upload`.

### Frame 3.5 — Document upload
See the existing onboarding upload spec — that document is the source of truth for this frame.

Key wiring: each uploaded file goes to `/api/upload`, which:
1. Reads file buffer, base64-encodes it.
2. Calls `classifyDocType(filename)` for the doc_type if user didn't pick one.
3. Calls `ze.documents.add` with `content.type = "auto"`.
4. Optionally polls `documents.get_info` for `indexed`.
5. Returns `{ status: "done" }`.

### Frame 5 — Workspace
Server-renders the workspace shell. Client subscribes to Supabase Realtime channels for `agent_events`, `leads`, `drafts` (filtered by workspace_id).

### Frame 6 — Fetch signals
User clicks "Fetch signals" → POST to `/api/signals/fetch`:
1. Call `hogFetch("/api/v1/people/search", { query: workspace.icp_query, limit: 25, includeContacts: true, includeSignals: true })`.
2. For each `person.signals[i]`, insert a `signals` row.
3. For each signal, also `ze.documents.add` with `doc_type: "signal"` (so they're queryable in the brain later).
4. Insert an `agent_events` row of kind `signal_seen` for each.
5. Return `{ count }`. UI receives the realtime events and renders cards.

### Frame 7 — Brain stores signals
This happens inside Frame 6's handler (step 3 above). No separate step.

### Frame 8 — User clicks "Find outreach"
POST to `/api/outreach/rank`.

### Frame 9 — ZeroEntropy rerank
`/api/outreach/rank/route.ts`:
1. Fetch all signals for this workspace not yet associated with a lead.
2. Call `ze.models.rerank` with the workspace one-liner+ICP as query, signal contents as documents, `top_n: 5`.
3. Filter results by `relevance_score >= 0.5`.
4. **If empty:** insert one `agent_events` row of kind `briefing` with payload `{ text: "No signals matched outreach criteria. Try again in a few hours." }` and return.
5. For each surviving result:
   - Run the Analyst (`scoreSignal`) against the signal content.
   - Insert a `lead` row with `fit_score`, `fit_reason`, `suggested_play`, and `retrieval_id`.
   - Insert an `agent_events` row of kind `lead_created`.
6. Return `{ leads: [...] }`.

### Frame 10 — Hog enrichment
For each new lead, the rank route also kicks off enrichment. Two patterns:

**Pattern A (blocking, simpler):** inside the rank route, after inserting each lead, also call `startEnrichment` + `pollEnrichment` synchronously. Update the lead row with the result. This is fine because there are only 5 leads max and total time is ~30-60 seconds.

**Pattern B (non-blocking, smoother demo):** after inserting the lead with `enrichment_status: 'pending'`, fire off the enrichment in the background (don't await it) and immediately return to the client. The lead card shows "Enriching contact…" until the enrichment row updates and Realtime pushes the update.

Use Pattern B for a smoother demo. The Frame 9 → Frame 11 transition feels instant.

```typescript
// Inside /api/outreach/rank, after inserting the lead:
(async () => {
  try {
    const opId = await startEnrichment({ linkedin_url: signal.author_identifier.linkedin_url });
    await supabase.from("leads").update({ hog_enrichment_operation_id: opId }).eq("id", lead.id);
    const result = await pollEnrichment(opId);
    await supabase.from("leads").update({
      enrichment: result,
      contact_email: result.contact?.email,
      contact_name: result.person?.name,
      contact_company: result.company?.name,
      enrichment_status: "done",
    }).eq("id", lead.id);
    // Now kick off the Writer
    await draftForLead(lead.id);
  } catch (err) {
    await supabase.from("leads").update({ enrichment_status: "failed" }).eq("id", lead.id);
  }
})();
```

### Frame 11 — Draft message
Called when enrichment completes (above). `draftForLead(leadId)`:
1. Fetch the lead, signal, and enrichment.
2. Run two ZE queries: voice (`brand_guide`) and proven copy (`won_deal`), each reranked top-3.
3. Save both retrievals.
4. Call `draftMessage(signal, enrichment, voiceSnippets, provenSnippets, workspace)`.
5. Insert a `drafts` row with `status: 'pending'` and both retrieval IDs.
6. Insert an `agent_events` row of kind `draft_created`.

### Frame 12 — Approve + send
User clicks Approve in `#drafts` → POST to `/api/outreach/send` with the draft id.

`/api/outreach/send/route.ts`:
1. Fetch the draft + lead.
2. Validate `lead.contact_email` is present (not null, not empty). If missing, return 400 — never send to a fabricated address.
3. Call Resend:
   ```typescript
   const resend = new Resend(process.env.RESEND_API_KEY);
   const { data } = await resend.emails.send({
     from: workspace.from_email,
     to: lead.contact_email,
     subject: draft.subject,
     text: draft.body,
   });
   ```
4. Update draft: `status: 'sent'`, `sent_message_id: data.id`, `decided_at: now()`.
5. Insert an `agent_events` row of kind `draft_approved`.

UI moves the card from `#drafts` to `#sent`.

---

## Environment variables (full list)

Create `/.env.local` and `/.env.example` with all of these:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# ZeroEntropy
ZEROENTROPY_API_KEY=ze_...

# TheHog (note: two keys, both required)
THEHOG_BASE_URL=https://developer.thehog.ai
THEHOG_ACCESS_KEY=ak_...
THEHOG_SECRET_KEY=sk_...

# Resend (email send)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=onboarding@yourdomain.com
```

---

## Failure modes and demo-day mitigations

| Failure | Mitigation |
|---|---|
| ZeroEntropy indexing slow during demo | Pre-seed the demo workspace's corpus 30+ minutes before. Don't rely on live ingestion. |
| ZeroEntropy returns no good matches | Make sure the seed corpus has clear winners. Hand-craft the won_deal docs so they're obviously the right answer for at least one signal you know will appear. |
| TheHog people/search returns no signals | Have a fallback ICP query that you know returns hits ("VP engineering AI startup"). Have a "Mock signals" toggle in dev settings that injects pre-canned signals if the live call returns empty. |
| TheHog enrichment slow or fails | Cache aggressively. For the demo lead, pre-enrich and save the result so the live call is just a re-fetch from cache. |
| Out of Hog credits mid-demo | Check the credits counter before demo. Top up if low. Mock mode toggle available as last resort. |
| Resend email fails | The card still moves to `#sent` visually; the actual send failure is invisible to the audience. Log it for post-demo follow-up. |
| Claude rate-limit hit | Almost impossible at hackathon scale, but cache the Analyst output by signal hash. |
| ZE collection name collision across runs | Add a timestamp or random suffix when creating the demo workspace. |

**The single biggest demo risk:** ZE returns garbage because the seed corpus is thin. The fix is to invest in the seed corpus. Five extremely high-quality won_deal docs beat fifty mediocre ones. Hand-write them. Reference real product details from the demo company so the matches are unambiguous.

---

## Build order — what to do in what sequence

Hackathon hours are precious. Build in this order. Do not skip steps.

1. **Hour 0–1: Verify all four API keys work.** Hit each service with a hello-world call. ZE: `collections.add`. Hog: `/api/v1/people/search` with a wide query. Anthropic: a one-message Haiku call. Resend: send an email to yourself. Don't write any product code until all four calls return 200.

2. **Hour 1–2: Database + auth.** Supabase project. Run `001_init.sql`. Magic-link auth working. Workspace row creation working.

3. **Hour 2–5: Onboarding (Frames 1, 2, 3).** Landing page, deep-research call, polling page, confirmation form. End state: a workspace row exists with all fields populated, and `ze_collection_name` is set.

4. **Hour 5–7: Brain seeding (end of Frame 3).** The `/api/onboarding/brain` route that ingests the form data into ZE. Verify by running a `top_snippets` query and seeing results.

5. **Hour 7–10: Workspace shell (Frame 5).** Channels, top strip, left rail. No real data yet — render stubs. Subscribe to Supabase Realtime even if nothing's writing yet.

6. **Hour 10–13: Frame 6 + 7.** Fetch signals route. Hog people/search call. Insert signals to Postgres + ZE. Render signal cards in `#signals` via Realtime.

7. **Hour 13–17: Frames 8 + 9 + 10 + 11.** Rank route. Analyst call. Background enrichment. Writer call. Drafts appear in `#drafts`. **This is the demo-critical block.** Spend disproportionate time here.

8. **Hour 17–19: Lead Card modal + evidence view.** This is the trust mechanism. Reads from `retrievals` table. Make it look like the design brief specifies.

9. **Hour 19–22: Frame 12 + #sent.** Resend integration. Approve flow. Send animation. `#sent` channel rendering.

10. **Hour 22–24: Frame 3.5 (upload).** This frame is valuable but not demo-critical. The seed corpus from the brain step already grounds everything. Skip if behind schedule.

11. **Hour 24–28: Polish.** Run the demo end-to-end three times. Fix anything that broke. Pre-seed the demo workspace. Take screenshots.

12. **Hour 28–30: Buffer.** Don't fill this. Use it for the thing you didn't anticipate.

---

## One final thing

The whole product is about *grounded retrieval*. Every decision Burrow makes — every fit score, every draft sentence — must trace back to a row in the `retrievals` table that the founder can click into and read. If you implement everything in this guide but forget to save retrievals, the product has no pitch. If you implement nothing else but save retrievals correctly, the demo can still land.

Save the retrievals. Cite the evidence. Make the Lead Card modal beautiful. Everything else is decoration.
