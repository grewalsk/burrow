# Burrow — Deferred Scope

Items deferred during /autoplan review of the document upload spec. Each item has a rationale for deferral.

## Post-MVP (after hackathon)

### Upload & corpus
- **MP3/MP4 audio transcription** — call recordings are a valuable corpus source, but transcription (Whisper API) adds latency and cost. Deferred: scope too wide for hackathon.
- **URL import** — paste a link, Burrow scrapes it and ingests as a doc. Deferred: requires a separate scraping pipeline.
- **Team corpus sharing** — multiple founders sharing a Brain. Deferred: requires auth/org model.
- **Corpus management UI** — browse, delete, re-upload individual docs. Deferred: read path is not needed for hackathon demo.
- **"Paste text directly" alternative to file upload** — useful fallback for founders without clean files. Deferred: low priority for initial flow.
- **Persistent job store (Upstash Redis / Vercel KV)** — the synchronous pipeline eliminates the need for a job store in MVP. Post-MVP: add if ingest becomes async.

### Security
- **Prompt injection sanitization in extracted text** — a document with "Ignore previous instructions" in its body will enter the Brain corpus. For a hackathon this is accepted risk. Post-MVP: strip known injection patterns before chunking.
- **Server-side batch enforcement via persistent store** — the module-level Map for session batch counting is per-process and resets on restart. Post-MVP: move to Redis or KV with session-scoped TTL.

### Demo resilience
- **ZeroEntropy fallback / mock vector store** — `ZERO_ENTROPY_MOCK=true` provides an in-memory mock for dev and testing. For production resilience, add a real fallback (Supabase pgvector or Qdrant). Deferred: not needed for hackathon demo if ZeroEntropy is stable.

## Won't do (explicitly rejected)

- **Auto-classifying by LLM** — keyword/regex rules (classifyDocType.ts) are faster, deterministic, and don't require a model call. LLM classification deferred indefinitely.
- **Animated progress ellipsis** — brief prohibits looping animations. Static "Indexing…" text is the permanent solution.
- **Modal/toast on upload completion** — brief prohibits confetti and "Nice!" toasts. Quiet status change is the permanent UX.
