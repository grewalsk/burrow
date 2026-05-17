// HogAI (TheHog) API client — thin wrappers around deep-research,
// enrichment, and operation polling. All endpoints use two custom
// headers for auth (X-Access-Key, X-Secret-Key), NOT a bearer token.
//
// HOGAI_MOCK=true short-circuits everything to the existing mockHogAI.
// The mock is kept around because real HogAI runs cost credits and the
// deep-research endpoint takes ~3-5 minutes per call.

const HOG_BASE = process.env.THEHOG_BASE_URL || "https://developer.thehog.ai";
const HOG_AK = process.env.THEHOG_ACCESS_KEY || "";
const HOG_SK = process.env.THEHOG_SECRET_KEY || "";

export function isHogMockMode(): boolean {
  return process.env.HOGAI_MOCK === "true";
}

export function isHogConfigured(): boolean {
  return Boolean(HOG_AK && HOG_SK);
}

export type HogFetchResult<T> = {
  status: number;
  body: T | null;
  error?: string;
};

async function hogFetch<T>(path: string, init: RequestInit = {}): Promise<HogFetchResult<T>> {
  if (!isHogConfigured() && !isHogMockMode()) {
    return { status: 0, body: null, error: "HogAI not configured (missing THEHOG_ACCESS_KEY/SECRET_KEY)" };
  }
  try {
    const res = await fetch(`${HOG_BASE}${path}`, {
      ...init,
      headers: {
        "X-Access-Key": HOG_AK,
        "X-Secret-Key": HOG_SK,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
    const body = (await res.json().catch(() => null)) as T | null;
    if (!res.ok) {
      const errMsg =
        (body as unknown as { error?: string; message?: string })?.error ??
        (body as unknown as { error?: string; message?: string })?.message ??
        `HogAI ${res.status} ${res.statusText}`;
      return { status: res.status, body, error: errMsg };
    }
    return { status: res.status, body };
  } catch (err) {
    return { status: 0, body: null, error: err instanceof Error ? err.message : "network error" };
  }
}

// ---- deep-research ------------------------------------------------------

export type DeepResearchStart = {
  id: string;
  operationId: string;
  status: "queued" | "processing";
  pollUrl: string;
};

export async function startDeepResearch(params: {
  prompt: string;
  schema: Record<string, unknown>;
}): Promise<HogFetchResult<DeepResearchStart>> {
  return hogFetch<DeepResearchStart>("/api/deep-research", {
    method: "POST",
    body: JSON.stringify({ prompt: params.prompt, schema: params.schema }),
  });
}

// ---- enrichments --------------------------------------------------------
//
// Per the implementation guide, HogAI's enrichment endpoint takes the shape:
//   { identifier: { linkedin_url | person_id | company_domain }, fields: [...] }
// Only LinkedIn URL is reliably usable from our signal data — X handles
// don't map cleanly to a Hog identifier, so X signals should not call this.

export type EnrichmentIdentifier = {
  linkedin_url?: string;
  person_id?: string;
  company_domain?: string;
};

// Request the "kitchen sink" of fields — the implementation guide explicitly
// recommends this so the Writer has rich grounding when drafting.
const ENRICHMENT_FIELDS = [
  // Person basics
  "person.name",
  "person.title",
  "person.headline",
  "person.location",
  "person.bio",
  "person.seniority",
  // Contact
  "contact.email",
  "contact.phone",
  "contact.linkedin_url",
  "contact.x_url",
  // Company
  "company.name",
  "company.domain",
  "company.size",
  "company.industry",
  "company.description",
  // Activity / signals
  "activity.recent_posts",
  "activity.engagement_topics",
];

export type EnrichmentStart = {
  id: string;
  operationId: string;
  status: string;
};

export async function startEnrichment(
  identifier: EnrichmentIdentifier,
  opts?: { fields?: string[] },
): Promise<HogFetchResult<EnrichmentStart>> {
  return hogFetch<EnrichmentStart>("/api/enrichments", {
    method: "POST",
    body: JSON.stringify({
      identifier,
      fields: opts?.fields ?? ENRICHMENT_FIELDS,
    }),
  });
}

// ---- operations poll ----------------------------------------------------

// Statuses HogAI uses for in-progress work. Anything else is terminal.
const TERMINAL_WAIT_STATUSES = new Set(["queued", "pending", "processing", "running"]);

export type OperationStatus = "succeeded" | "failed" | string;

export type Operation<TResult = unknown> = {
  id: string;
  status: OperationStatus;
  progress?: number;
  result?: TResult;
  error?: string | null;
};

export async function getOperation<T>(operationId: string): Promise<HogFetchResult<Operation<T>>> {
  return hogFetch<Operation<T>>(`/api/operations/${operationId}`, { method: "GET" });
}

export function isTerminalStatus(status: string): boolean {
  return !TERMINAL_WAIT_STATUSES.has(status);
}

// Server-side blocking poll — used for enrichment (~30-60s typical).
// NOT used for deep-research, which takes too long for any Vercel route.
export async function pollOperationUntilDone<T>(
  operationId: string,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<HogFetchResult<Operation<T>>> {
  const timeoutMs = opts.timeoutMs ?? 90_000;
  const intervalMs = opts.intervalMs ?? 2_500;
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await getOperation<T>(operationId);
    if (res.error || !res.body) return res;
    if (isTerminalStatus(res.body.status)) return res;
    if (Date.now() - start > timeoutMs) {
      return { status: 408, body: res.body, error: "poll timeout" };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
