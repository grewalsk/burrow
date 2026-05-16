// Real cr_agent: fetches site content via Jina Reader, extracts structured
// fields with Gemini Flash. Used by /api/research to pre-populate Frame 3.

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

export type PriceTier = { name: string; price: string; note: string };
export type Story = { name: string; detail: string; src: string };
export type Doc = {
  one_liner: string;
  description: string;
  icp: string;
  pricing: PriceTier[];
  features: string[];
  competitors: string[];
  stories: Story[];
};

export type ResearchResult = {
  doc: Doc;
  pages_crawled: number;
  pages_read: number;
  paths_fetched: string[];
  source: "gemini" | "fallback";
  fallback_reason?: string;
  cached?: boolean;
};

const JINA_BASE = "https://r.jina.ai/";
const JINA_TIMEOUT_MS = 10_000;
const GEMINI_TIMEOUT_MS = 15_000;
const PAGE_CHAR_CAP = 15_000;       // up from 6_000 — keeps full pricing tables and richer hero content
const TOTAL_CHAR_CAP = 60_000;      // up from 30_000 — Gemini 2.0 Flash has 1M-token context
const MAX_DISCOVERED_PATHS = 6;     // pages to crawl after homepage (so ≤ 7 fetches total)
const CACHE_TTL_MS = 10 * 60_000;   // 10-minute in-memory cache, keyed by normalized URL

// Module-level cache. Resets on dev server restart (acceptable for hackathon).
const cache = new Map<string, { result: ResearchResult; expiresAt: number }>();

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/+$/, "");
  return `https://${trimmed}`.replace(/\/+$/, "");
}

async function fetchJinaPage(fullUrl: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JINA_TIMEOUT_MS);
  try {
    const res = await fetch(`${JINA_BASE}${fullUrl}`, {
      headers: { Accept: "text/plain", "X-Return-Format": "markdown" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.length > 100 ? text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---- Link discovery -------------------------------------------------------
// Pull all internal links out of the homepage markdown, drop noise paths,
// rank by likely relevance (pricing/features/about > blog/docs/legal),
// return the top N for parallel fetch.

const HIGH_SIGNAL_KEYWORDS = [
  /\bpricing\b/, /\bplans?\b/, /\bcost\b/,
  /\babout\b/, /\bcompany\b/, /\bteam\b/, /\bstory\b/, /\bmanifesto\b/, /\bmission\b/,
  /\bproduct\b/, /\bfeatures?\b/, /\bcapabilities\b/, /\bplatform\b/, /\bsolutions?\b/,
  /\bcustomers?\b/, /\bcase[-_]stud(?:y|ies)\b/, /\bstories\b/, /\btestimonials?\b/,
  /\bhow[-_]it[-_]works\b/, /\buse[-_]cases?\b/,
];

const NOISE_KEYWORDS = [
  /\bblog\b/, /\bdocs?\b/, /\bdocumentation\b/, /\bapi[-_]ref(?:erence)?\b/,
  /\blogin\b/, /\bsign[-_]?(?:in|up)\b/, /\bregister\b/,
  /\bcareers?\b/, /\bjobs?\b/, /\bhiring\b/,
  /\blegal\b/, /\bprivacy\b/, /\bterms\b/, /\bcookies?\b/,
  /\bsupport\b/, /\bhelp\b/, /\bcontact\b/,
  /\bpress\b/, /\bnewsroom\b/, /\bchangelog\b/, /\brelease[-_]notes\b/,
  /\bcommunity\b/, /\bdownload\b/, /\bstatus\b/, /\bsecurity\b/,
];

function extractInternalPaths(markdown: string, baseUrl: string): string[] {
  const linkRegex = /\[[^\]]*\]\(([^)\s]+)/g;
  const base = (() => {
    try { return new URL(baseUrl); } catch { return null; }
  })();
  if (!base) return [];

  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(markdown)) !== null) {
    const href = m[1];
    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.host !== base.host) continue;
      let path = resolved.pathname.replace(/\/+$/, "") || "/";
      if (path === "/") continue;
      // Skip non-page assets
      if (/\.(pdf|zip|png|jpe?g|svg|gif|webp|mp4|css|js|xml|ico|json)$/i.test(path)) continue;
      // Skip deep paths (likely individual blog posts / docs articles)
      if (path.split("/").filter(Boolean).length > 3) continue;
      seen.add(path);
    } catch {
      // ignore malformed hrefs
    }
  }
  return [...seen];
}

function scorePath(path: string): number {
  const lower = path.toLowerCase();
  for (const re of NOISE_KEYWORDS) if (re.test(lower)) return -1;
  let score = 0;
  for (const re of HIGH_SIGNAL_KEYWORDS) if (re.test(lower)) score += 10;
  // Prefer shorter, top-level paths over nested ones
  score -= (path.split("/").filter(Boolean).length - 1) * 2;
  return score;
}

function pickRelevantPaths(allPaths: string[], max: number): string[] {
  return allPaths
    .map((p) => ({ path: p, score: scorePath(p) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.path);
}

// Fallback if homepage link extraction returns nothing useful.
const FALLBACK_SUBPATHS = ["/about", "/pricing", "/features", "/customers", "/product"];

export async function crawlSite(baseUrl: string): Promise<{
  markdown: string;
  pages_crawled: number;
  pages_read: number;
  paths_fetched: string[];
}> {
  const normalized = normalizeUrl(baseUrl);

  // Pass 1: homepage
  const homepage = await fetchJinaPage(normalized);

  // Pass 2: discovered paths (or fallback list)
  const discovered = homepage ? pickRelevantPaths(extractInternalPaths(homepage, normalized), MAX_DISCOVERED_PATHS) : [];
  const pathsToFetch = discovered.length > 0 ? discovered : FALLBACK_SUBPATHS;

  const subResults = await Promise.all(pathsToFetch.map((p) => fetchJinaPage(`${normalized}${p}`)));

  const allFetches: Array<{ path: string; markdown: string | null }> = [
    { path: "/", markdown: homepage },
    ...pathsToFetch.map((p, i) => ({ path: p, markdown: subResults[i] })),
  ];

  const successful = allFetches.filter((f) => f.markdown !== null);

  // Combine, with running total cap
  let total = 0;
  const chunks: string[] = [];
  for (const f of successful) {
    const slice = (f.markdown as string).slice(0, PAGE_CHAR_CAP);
    if (total + slice.length > TOTAL_CHAR_CAP) {
      chunks.push(`\n\n---\n# Source: ${normalized}${f.path}\n\n${slice.slice(0, TOTAL_CHAR_CAP - total)}`);
      break;
    }
    chunks.push(`\n\n---\n# Source: ${normalized}${f.path}\n\n${slice}`);
    total += slice.length;
  }

  return {
    markdown: chunks.join("\n"),
    pages_crawled: allFetches.length,
    pages_read: successful.length,
    paths_fetched: successful.map((f) => f.path),
  };
}

// ---- Gemini extraction ---------------------------------------------------

const DOC_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    one_liner: { type: SchemaType.STRING },
    description: { type: SchemaType.STRING },
    icp: { type: SchemaType.STRING },
    pricing: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          price: { type: SchemaType.STRING },
          note: { type: SchemaType.STRING },
        },
        required: ["name", "price", "note"],
      },
    },
    features: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    competitors: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    stories: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          detail: { type: SchemaType.STRING },
          src: { type: SchemaType.STRING },
        },
        required: ["name", "detail", "src"],
      },
    },
  },
  required: ["one_liner", "description", "icp", "pricing", "features", "competitors", "stories"],
} as const;

const EXTRACTION_PROMPT = `You are extracting structured company facts from website content to fill a form.

# THE FIELDS

- **one_liner**: a single-sentence tagline (10–15 words). Punchy, founder-voice, no marketing fluff.
  ✅ "The fastest deployment platform for frontend teams."
  ❌ "Vercel is a comprehensive cloud platform empowering developers with modern web development solutions."

- **description**: 2–3 sentences. What the product does, who it serves, what's the unique twist. Founder-voice, not marketing-voice.
  ✅ "Vercel hosts and ships frontend apps with zero config. Used by teams from indie hackers to Fortune 500. Built around Next.js, with edge functions, preview deploys, and analytics baked in."
  ❌ "Vercel is the leading platform for modern web development, providing developers with a comprehensive suite of tools to build, deploy, and scale their applications with unprecedented ease and performance."

- **icp**: 1–2 sentences on who buys this and why. Role + company size + pain point. Infer from /about, /customers, or homepage messaging.
  ✅ "Frontend engineers at startups and product teams of 5–100. Tired of managing CI/CD, ops, and infra for simple web apps."

- **pricing**: array of tiers. Each has name (e.g. "Free", "Pro", "Enterprise"), price (e.g. "$0", "$20/mo per user", "custom"), and a short note (one line of what's included). If pricing isn't public, return [].

- **features**: 3–7 key capabilities. Short noun phrases, not sentences.
  ✅ ["Edge functions", "Preview deploys", "Analytics dashboard"]
  ❌ ["Our platform offers cutting-edge edge functions...", "..."]

- **competitors**: 0–5 direct competitors the site mentions or clearly positions against. Don't guess broadly — if the site doesn't reference competitors, return [].

- **stories**: customer success stories. Each has name (customer), detail (1–2 sentence summary of the win), src (URL path if known, e.g. "/customers/initech"). Empty array is fine.

# IGNORE THIS NOISE

Treat these as irrelevant to extraction even if they appear in the content:
- Navigation menus, footer link lists, "Skip to content" links
- Cookie banners, GDPR notices, privacy popups, "Accept all cookies"
- Login / sign-up / register CTAs, contact form labels
- Newsletter signup boxes, social media link lists ("Follow us on X")
- Generic legal boilerplate ("Terms of service", "Privacy policy")

# RULES

- Don't hallucinate. If a field can't be determined from the content, return "" for strings or [] for arrays. Empty is better than wrong.
- Don't quote marketing copy verbatim. Rewrite into founder-voice.
- Use the source URL paths (the "# Source:" lines) to attribute stories.

# WEBSITE CONTENT
`;

// Robust JSON extractor — handles models that wrap output in markdown fences,
// prepend reasoning prose, or echo the schema description back as part of
// their reasoning (Gemma does all three). Strategy: find every balanced
// top-level { ... } block, try to parse each, and return the LARGEST one
// that parses successfully. Returning the largest correctly skips a tiny
// schema-text echo like `{"name": string}` in favor of the real response.
export function extractJsonObject(text: string): unknown {
  // Try direct parse first — Gemini with responseSchema returns clean JSON.
  try { return JSON.parse(text); } catch { /* fall through */ }

  // Strip ```json ... ``` or ``` ... ``` fences.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try { return JSON.parse(fenced[1]); } catch { /* fall through */ }
  }

  const candidates: string[] = [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let startIdx = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") {
      if (depth === 0) startIdx = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && startIdx !== -1) {
        candidates.push(text.slice(startIdx, i + 1));
        startIdx = -1;
      } else if (depth < 0) {
        depth = 0;
        startIdx = -1;
      }
    }
  }

  if (candidates.length === 0) throw new Error("no JSON object found in response");

  // Try the largest candidates first — the real response is bigger than any
  // schema-text echo or example fragment.
  candidates.sort((a, b) => b.length - a.length);
  let lastErr: unknown = null;
  for (const c of candidates) {
    try { return JSON.parse(c); } catch (e) { lastErr = e; }
  }
  throw new Error(`no balanced JSON candidate parsed (${candidates.length} tried): ${lastErr}`);
}

// Compact human-readable description of the expected JSON shape, embedded in
// the prompt for models (Gemma) that don't support responseSchema.
const SCHEMA_AS_TEXT = `{
  "one_liner": string,
  "description": string,
  "icp": string,
  "pricing": [{ "name": string, "price": string, "note": string }],
  "features": [string],
  "competitors": [string],
  "stories": [{ "name": string, "detail": string, "src": string }]
}`;

export async function extractWithGemini(markdown: string): Promise<Doc> {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_GENAI_API_KEY not set");

  // Default to Gemma 4 31B IT — open-source, unlimited daily quota, just
  // 15 RPM cap. Free-tier Gemini models cap at 20 requests/day per project
  // (verified Nov 2026), which is the trap that bit us earlier. Override
  // via env GEMINI_MODEL if you have paid Gemini access and want stronger
  // structured-output reliability (try gemini-2.5-flash).
  const modelName = process.env.GEMINI_MODEL || "gemma-4-31b-it";
  const isGemma = modelName.toLowerCase().startsWith("gemma");

  const genai = new GoogleGenerativeAI(apiKey);
  const model = genai.getGenerativeModel({
    model: modelName,
    // Gemma ignores responseSchema/responseMimeType and returns prose mixed
    // with JSON — so we skip both and rely on prompt-based JSON instruction
    // plus the robust extractor. Gemini honors the schema natively.
    generationConfig: isGemma
      ? { temperature: 0.2 }
      : {
          responseMimeType: "application/json",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          responseSchema: DOC_SCHEMA as any,
          temperature: 0.2,
        },
  });

  // For Gemma, prepend an explicit "respond with ONLY JSON matching this
  // shape" instruction. For Gemini, the responseSchema enforces this already.
  const fullPrompt = isGemma
    ? `${EXTRACTION_PROMPT}\n\nRespond with ONLY a single JSON object matching this shape (no markdown, no prose, no code fences):\n${SCHEMA_AS_TEXT}\n\nWEBSITE CONTENT:\n${markdown.slice(0, TOTAL_CHAR_CAP)}`
    : `${EXTRACTION_PROMPT}\n${markdown.slice(0, TOTAL_CHAR_CAP)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const result = await model.generateContent(fullPrompt);
    const text = result.response.text();
    try {
      return extractJsonObject(text) as Doc;
    } catch (parseErr) {
      // Log the raw response so we can see what shape the model returned.
      // Truncate to keep the log readable.
      console.error(`[research] JSON parse failed for model=${modelName}. Raw response (first 1500 chars):`);
      console.error(text.slice(0, 1500));
      throw parseErr;
    }
  } finally {
    clearTimeout(timer);
  }
}

// ---- Fallback ------------------------------------------------------------

export function fallbackDoc(url: string, markdown: string): Doc {
  const stripped = markdown
    .replace(/^---[\s\S]*?---/gm, "")
    .replace(/^#.*$/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // strip markdown link syntax, keep text
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);

  return {
    one_liner: `Company at ${url}`,
    description: stripped || "Could not auto-extract a description. Fill in what your company does here.",
    icp: "",
    pricing: [],
    features: [],
    competitors: [],
    stories: [],
  };
}

// ---- Orchestrator (with cache + rate-limit-aware fallback) --------------

function classifyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/429|quota|rate[-_ ]?limit|too many requests/i.test(msg)) return "rate_limited";
  if (/abort|timeout|deadline/i.test(msg)) return "gemini_timeout";
  if (/401|403|api[-_ ]?key|unauthor/i.test(msg)) return "auth_failed";
  if (/json|parse/i.test(msg)) return "parse_failed";
  return msg.slice(0, 120) || "extraction_failed";
}

export async function research(url: string): Promise<ResearchResult> {
  const normalized = normalizeUrl(url);

  // Cache check — skip the whole pipeline for repeat lookups
  const now = Date.now();
  const cached = cache.get(normalized);
  if (cached && cached.expiresAt > now) {
    return { ...cached.result, cached: true };
  }

  const crawl = await crawlSite(normalized);

  let result: ResearchResult;

  if (!crawl.markdown || crawl.pages_read === 0) {
    result = {
      doc: fallbackDoc(normalized, ""),
      pages_crawled: crawl.pages_crawled,
      pages_read: crawl.pages_read,
      paths_fetched: crawl.paths_fetched,
      source: "fallback",
      fallback_reason: "no_pages_fetched",
    };
  } else if (!process.env.GOOGLE_GENAI_API_KEY) {
    result = {
      doc: fallbackDoc(normalized, crawl.markdown),
      pages_crawled: crawl.pages_crawled,
      pages_read: crawl.pages_read,
      paths_fetched: crawl.paths_fetched,
      source: "fallback",
      fallback_reason: "no_api_key",
    };
  } else {
    try {
      const doc = await extractWithGemini(crawl.markdown);
      result = {
        doc,
        pages_crawled: crawl.pages_crawled,
        pages_read: crawl.pages_read,
        paths_fetched: crawl.paths_fetched,
        source: "gemini",
      };
    } catch (e) {
      // Log the actual error message server-side so we can see WHY Gemini failed.
      // The classifyError() string in fallback_reason is intentionally short for
      // the client; the full error goes here for the dev console.
      console.error("[research] Gemini extraction failed for", normalized, ":");
      console.error(e);
      result = {
        doc: fallbackDoc(normalized, crawl.markdown),
        pages_crawled: crawl.pages_crawled,
        pages_read: crawl.pages_read,
        paths_fetched: crawl.paths_fetched,
        source: "fallback",
        fallback_reason: classifyError(e),
      };
    }
  }

  // Cache successful Gemini extractions for 10 min. Don't cache failures —
  // a rate-limit window or transient timeout shouldn't poison the cache.
  if (result.source === "gemini") {
    cache.set(normalized, { result, expiresAt: now + CACHE_TTL_MS });
  }

  return result;
}
