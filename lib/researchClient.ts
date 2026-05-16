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
  source: "gemini" | "fallback";
  fallback_reason?: string;
};

const JINA_BASE = "https://r.jina.ai/";
const JINA_TIMEOUT_MS = 8_000;
const GEMINI_TIMEOUT_MS = 12_000;
const SUBPATHS = ["", "/about", "/pricing", "/features", "/customers", "/product"];

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/$/, "");
  return `https://${trimmed}`.replace(/\/$/, "");
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

export async function crawlSite(baseUrl: string): Promise<{ markdown: string; pages_crawled: number; pages_read: number }> {
  const normalized = normalizeUrl(baseUrl);
  const candidates = SUBPATHS.map((p) => `${normalized}${p}`);
  const results = await Promise.all(candidates.map(fetchJinaPage));

  const pages_crawled = candidates.length;
  const pages_read = results.filter((r) => r !== null).length;

  const combined = results
    .map((md, i) => (md ? `\n\n---\n# Source: ${candidates[i]}\n\n${md.slice(0, 6_000)}` : null))
    .filter(Boolean)
    .join("\n");

  return { markdown: combined, pages_crawled, pages_read };
}

const DOC_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    one_liner: { type: SchemaType.STRING, description: "Single-sentence tagline describing what the company does." },
    description: { type: SchemaType.STRING, description: "2-3 sentence longer description of the product." },
    icp: { type: SchemaType.STRING, description: "Ideal customer profile: role, company size, pain points." },
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

const EXTRACTION_PROMPT = `You are extracting structured company facts from website content.

Return JSON matching this exact shape. If a field can't be determined from the content, use a thoughtful empty default ("" for strings, [] for arrays) rather than making things up.

- one_liner: the single-sentence tagline that best describes what the company does (often the homepage hero text)
- description: 2-3 sentence longer description of the product / service
- icp: who they sell to (role, company size, pain points, triggers). Infer from /about, /customers, or homepage messaging.
- pricing: array of tiers, each with name (e.g. "Free", "Pro"), price (e.g. "$0", "$49/mo", "custom"), and note (1 short line on what's included)
- features: array of 3-8 key capability names
- competitors: array of competitors the site mentions or strongly implies (often inferred from positioning language). If unclear, return an empty array.
- stories: array of customer success stories. Each with name (customer name), detail (1-2 sentence summary), src (the URL path the story came from, like "/customers/initech")

WEBSITE CONTENT:
`;

export async function extractWithGemini(markdown: string): Promise<Doc> {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_GENAI_API_KEY not set");

  const genai = new GoogleGenerativeAI(apiKey);
  const model = genai.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      responseSchema: DOC_SCHEMA as any,
      temperature: 0.2,
    },
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const result = await model.generateContent(`${EXTRACTION_PROMPT}\n${markdown.slice(0, 30_000)}`);
    const text = result.response.text();
    const parsed = JSON.parse(text) as Doc;
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

export function fallbackDoc(url: string, markdown: string): Doc {
  // When Gemini isn't available or fails, return a doc shaped like the real
  // thing but with a minimal description carved from the raw markdown so the
  // user has something to edit instead of an empty form.
  const stripped = markdown
    .replace(/^---[\s\S]*?---/gm, "")
    .replace(/^#.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 320);

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

export async function research(url: string): Promise<ResearchResult> {
  const { markdown, pages_crawled, pages_read } = await crawlSite(url);

  if (!markdown || pages_read === 0) {
    return {
      doc: fallbackDoc(url, ""),
      pages_crawled,
      pages_read,
      source: "fallback",
      fallback_reason: "no_pages_fetched",
    };
  }

  if (!process.env.GOOGLE_GENAI_API_KEY) {
    return {
      doc: fallbackDoc(url, markdown),
      pages_crawled,
      pages_read,
      source: "fallback",
      fallback_reason: "no_api_key",
    };
  }

  try {
    const doc = await extractWithGemini(markdown);
    return { doc, pages_crawled, pages_read, source: "gemini" };
  } catch (e) {
    return {
      doc: fallbackDoc(url, markdown),
      pages_crawled,
      pages_read,
      source: "fallback",
      fallback_reason: e instanceof Error ? e.message.slice(0, 120) : "extraction_failed",
    };
  }
}
