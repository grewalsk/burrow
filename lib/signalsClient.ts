// signalsClient — orchestrates HogAI deep-research for outreach signals:
//   - reads workspace company info from ZE
//   - builds a company-aware prompt
//   - parses HogAI's response into our internal Signal shape
//   - stores signals in the existing brain-<sessionId> collection
//   - preserves enriched_* fields on re-fetch (enrichment-safe upsert)

import crypto from "node:crypto";
import {
  addTextDocument,
  getDocumentContent,
  listDocuments,
  type Metadata,
} from "./zeroentropyClient";
import { startDeepResearch } from "./hogClient";

// ---- Types --------------------------------------------------------------

export type Platform = "X" | "Reddit" | "LinkedIn";
export type OutreachMode = "email" | "reply";

export type ParsedSignal = {
  signal_id: string;
  platform: Platform;
  author_handle: string;
  author_profile_url: string;
  post_url: string;
  post_text: string;
  pain_point: string;
  why_relevant: string;
  outreach_mode: OutreachMode;
  fetched_at: number;
  enriched: boolean;
};

type WorkspaceCompanyInfo = {
  brand_text: string;
  icp: string;
  competitors: string[];
  has_any_data: boolean;
};

// ---- Read workspace info from ZE ---------------------------------------

export async function loadWorkspaceCompanyInfo(collectionName: string): Promise<WorkspaceCompanyInfo> {
  // Pull each doc type. brand_guide is a mashed string (one_liner + description
  // + features + pricing), icp is its own text, competitor_intel are one doc
  // per competitor with metadata.competitor_name.
  const [brandDocs, icpDocs, competitorDocs] = await Promise.all([
    listDocuments({ collectionName, filter: { "metadata.doc_type": "brand_guide" }, limit: 5 }),
    listDocuments({ collectionName, filter: { "metadata.doc_type": "icp" }, limit: 5 }),
    listDocuments({ collectionName, filter: { "metadata.doc_type": "competitor_intel" }, limit: 20 }),
  ]);

  const brand_text = brandDocs.length > 0
    ? (await getDocumentContent(collectionName, brandDocs[0].path)) ?? ""
    : "";

  const icp = icpDocs.length > 0
    ? (await getDocumentContent(collectionName, icpDocs[0].path)) ?? ""
    : "";

  const competitors = competitorDocs
    .map((d) => String(d.metadata.competitor_name ?? "").trim())
    .filter(Boolean);

  return {
    brand_text,
    icp,
    competitors,
    has_any_data: Boolean(brand_text || icp || competitors.length),
  };
}

// ---- Prompt + schema ---------------------------------------------------

// IMPORTANT: do NOT add URL fields here that HogAI didn't directly scrape.
// HogAI rejects (with "URL fields not bound to fetched sources") any URL
// field where the value wasn't part of a fetched source. post_url is fine
// (they scraped the post). author_profile_url is NOT fine — they never
// fetch the profile page directly. We construct profile URLs locally from
// (platform, author_handle) in parseHogSignals.
export const SIGNALS_RESULT_SCHEMA = {
  type: "object",
  properties: {
    signals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          platform: { type: "string" },
          author_handle: { type: "string" },
          post_url: { type: "string" },
          post_text: { type: "string" },
          pain_point: { type: "string" },
          why_relevant: { type: "string" },
        },
        required: ["platform", "author_handle", "post_url", "post_text"],
      },
    },
  },
  required: ["signals"],
} as const;

export function buildSignalsPrompt(workspace: WorkspaceCompanyInfo): string {
  const lines: string[] = [];
  lines.push(
    "You are sourcing outreach signals for a sales team. Find recent (last 60 days) social media posts where someone is expressing a pain point that this company solves, or is actively considering switching from a tool in their category.",
    "",
  );

  if (workspace.brand_text) {
    lines.push("OUR COMPANY:", workspace.brand_text, "");
  }

  if (workspace.icp) {
    lines.push("WHO WE SELL TO:", workspace.icp, "");
  }

  if (workspace.competitors.length > 0) {
    lines.push("COMPETITORS WE OFTEN REPLACE:", workspace.competitors.join(", "), "");
  }

  lines.push(
    "LOOK FOR POSTS WHERE SOMEONE:",
    "- Is frustrated with their current tool in our category and considering switching",
    "- Is asking for tool recommendations in our category",
    "- Mentions a specific pain point we solve, using language from WHO WE SELL TO",
    "- Is actively migrating from a competitor we listed",
    "- Is comparing solutions and undecided",
    "",
    "PLATFORMS: LinkedIn, X (Twitter), Reddit. Try to include at least one from each platform if possible.",
    "",
    "QUALITY > QUANTITY. Skip generic posts. Skip news commentary. Find posts where the author would benefit from a personal reply.",
    "",
    "Return 5 signals.",
    "",
    "FOR EACH SIGNAL RETURN:",
    "- platform: exactly one of \"X\", \"Reddit\", \"LinkedIn\"",
    "- author_handle: bare username (e.g. \"thehaydenbunn\" not \"@thehaydenbunn\", \"u/SpecialistAd7913\" → \"SpecialistAd7913\")",
    "- post_url: link to the specific post (must be a real URL you fetched)",
    "- post_text: the actual post text (not summarized)",
    "- pain_point: 1 sentence — what they're frustrated about, in THEIR framing",
    "- why_relevant: 1 sentence — why this is a fit for OUR product specifically",
  );

  return lines.join("\n");
}

// ---- Parse HogAI response ----------------------------------------------

function normalizePlatform(raw: unknown): Platform | null {
  if (typeof raw !== "string") return null;
  const lower = raw.toLowerCase();
  if (lower === "x" || lower === "twitter") return "X";
  if (lower === "reddit") return "Reddit";
  if (lower === "linkedin") return "LinkedIn";
  return null;
}

function shortHash(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
}

// Pulls "r/<subreddit>" out of a reddit post URL for the legacy context field.
function extractRedditContext(postUrl: string): string {
  const m = postUrl.match(/reddit\.com\/r\/([^/]+)/i);
  return m ? `r/${m[1]}` : "";
}

type HogSignalRaw = {
  platform?: unknown;
  author_handle?: unknown;
  post_url?: unknown;
  post_text?: unknown;
  pain_point?: unknown;
  why_relevant?: unknown;
};

// Construct a profile URL from (platform, handle) since HogAI won't emit
// URLs they didn't directly fetch. Best-effort: LinkedIn handle conventions
// vary (vanity vs numeric IDs); use the most common form. Enrichment can
// still take this URL — if it doesn't resolve cleanly, we fall back to
// reply-mode.
function constructProfileUrl(platform: Platform, handle: string): string {
  const clean = handle.replace(/^[@u]\/?|^@/, "").trim();
  if (!clean) return "";
  switch (platform) {
    case "X":
      return `https://x.com/${clean}`;
    case "LinkedIn":
      return `https://linkedin.com/in/${clean}`;
    case "Reddit":
      return `https://reddit.com/user/${clean}`;
  }
}

export function parseHogSignals(operationResult: unknown): ParsedSignal[] {
  // HogAI nests: result.data.signals (the result object from polled operation)
  const rawSignals =
    (operationResult as { data?: { signals?: HogSignalRaw[] } })?.data?.signals ?? [];

  const now = Date.now();
  const parsed: ParsedSignal[] = [];

  for (const raw of rawSignals) {
    const platform = normalizePlatform(raw.platform);
    const post_url = typeof raw.post_url === "string" ? raw.post_url.trim() : "";
    const post_text = typeof raw.post_text === "string" ? raw.post_text.trim() : "";

    // Required fields — skip silently if missing
    if (!platform || !post_url || !post_text) continue;

    const author_handle =
      typeof raw.author_handle === "string" ? raw.author_handle.replace(/^[@u]\/?|^@/, "") : "";

    parsed.push({
      signal_id: shortHash(post_url),
      platform,
      author_handle,
      author_profile_url: constructProfileUrl(platform, author_handle),
      post_url,
      post_text,
      pain_point: typeof raw.pain_point === "string" ? raw.pain_point : "",
      why_relevant: typeof raw.why_relevant === "string" ? raw.why_relevant : "",
      outreach_mode: platform === "Reddit" ? "reply" : "email",
      fetched_at: now,
      enriched: false,
    });
  }

  return parsed;
}

// ---- Store signals in ZE (enrichment-safe upsert) ----------------------

async function findExistingSignal(
  collectionName: string,
  signal_id: string,
): Promise<Metadata | null> {
  const existing = await listDocuments({
    collectionName,
    filter: { "metadata.doc_type": "signal", "metadata.signal_id": signal_id },
    limit: 1,
  });
  return existing[0]?.metadata ?? null;
}

export async function storeSignals(params: {
  collectionName: string;
  signals: ParsedSignal[];
}): Promise<{ stored: number; failed: number }> {
  let stored = 0;
  let failed = 0;

  for (const s of params.signals) {
    try {
      // Enrichment-safe upsert: if this signal already exists with enrichment
      // data, preserve those fields rather than overwriting them on refetch.
      const existing = await findExistingSignal(params.collectionName, s.signal_id);
      const preserveEnrichment = existing?.enriched === "true";

      // Downstream consumers (rank, drafts/generate, signals GET) were written
      // against the original mockHogAI metadata shape (body / source / handle /
      // url / contact_*). We write BOTH the new descriptive keys AND the legacy
      // aliases so those routes work without modification.
      const metadata: Metadata = {
        doc_type: "signal",
        signal_id: s.signal_id,
        // New descriptive keys
        platform: s.platform,
        author_handle: s.author_handle,
        author_profile_url: s.author_profile_url,
        post_url: s.post_url,
        post_text: s.post_text,
        pain_point: s.pain_point,
        why_relevant: s.why_relevant,
        fetched_at: String(s.fetched_at),
        outreach_mode: preserveEnrichment ? String(existing?.outreach_mode ?? s.outreach_mode) : s.outreach_mode,
        enriched: preserveEnrichment ? "true" : "false",
        enriched_email: preserveEnrichment ? String(existing?.enriched_email ?? "") : "",
        enriched_name: preserveEnrichment ? String(existing?.enriched_name ?? "") : "",
        enriched_role: preserveEnrichment ? String(existing?.enriched_role ?? "") : "",
        enriched_company: preserveEnrichment ? String(existing?.enriched_company ?? "") : "",
        status: preserveEnrichment ? String(existing?.status ?? "enriched") : "new",
        sample: "false",
        // Legacy aliases for back-compat with existing rank/draft/signals routes
        source: s.platform === "X" ? "X" : s.platform === "Reddit" ? "REDDIT" : "LINKEDIN",
        handle: s.author_handle,
        context: s.platform === "Reddit" ? extractRedditContext(s.post_url) : "",
        body: s.post_text,
        url: s.post_url,
        posted_at: String(s.fetched_at),
        contact_name: preserveEnrichment ? String(existing?.enriched_name ?? "") : "",
        contact_email: preserveEnrichment ? String(existing?.enriched_email ?? "") : "",
        contact_role: preserveEnrichment ? String(existing?.enriched_role ?? "") : "",
        contact_company: preserveEnrichment ? String(existing?.enriched_company ?? "") : "",
        contact_linkedin: s.platform === "LinkedIn" ? s.author_profile_url : "",
      };

      await addTextDocument({
        collectionName: params.collectionName,
        documentPath: `signal-${s.signal_id}.txt`,
        text: s.post_text,
        metadata,
      });

      stored++;
    } catch (err) {
      console.error(`[signals] failed to store signal_id=${s.signal_id}:`, err);
      failed++;
    }
  }

  return { stored, failed };
}

// ---- Orchestrator: kick off a HogAI deep-research run ------------------

export async function kickoffSignalsFetch(collectionName: string): Promise<
  | { ok: true; jobId: string; promptPreview: string }
  | { ok: false; error: string; status: number }
> {
  const workspace = await loadWorkspaceCompanyInfo(collectionName);
  if (!workspace.has_any_data) {
    return { ok: false, error: "Complete onboarding first — no company info found", status: 400 };
  }

  const prompt = buildSignalsPrompt(workspace);
  const res = await startDeepResearch({
    prompt,
    schema: SIGNALS_RESULT_SCHEMA as unknown as Record<string, unknown>,
  });

  if (res.error || !res.body) {
    console.error("[signals] HogAI deep-research kickoff failed:", res.error, res.body);
    return { ok: false, error: res.error ?? "HogAI did not return an operationId", status: 502 };
  }

  console.log(`[signals] HogAI deep-research started: jobId=${res.body.operationId} (poll: ${HOG_BASE_FOR_LOG}/api/operations/${res.body.operationId})`);
  return { ok: true, jobId: res.body.operationId, promptPreview: prompt.slice(0, 240) };
}

const HOG_BASE_FOR_LOG = process.env.THEHOG_BASE_URL || "https://developer.thehog.ai";
