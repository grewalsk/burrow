import { NextResponse } from "next/server";
import {
  ensureCollection,
  getDocumentContent,
  listDocuments,
  rerank,
  updateMetadata,
} from "@/lib/zeroentropyClient";
import { getSessionId, workspaceCollection } from "@/lib/workspace";

export const runtime = "nodejs";
export const maxDuration = 60;

const TOP_N = 5;
const RERANK_MODEL = process.env.ZE_RERANK_MODEL ?? "zerank-1-small";

// Build the rerank query from the founder's own ICP / brand docs. Falls back
// to a generic ICP-shaped sentence if nothing is uploaded yet.
async function buildICPQuery(collection: string): Promise<string> {
  // Try ICP first — it's the most direct fit signal. Then brand_guide (the
  // cr_agent profile usually contains the ICP paragraph too).
  const icpDocs = await listDocuments({
    collectionName: collection,
    filter: { doc_type: { $in: ["icp", "brand_guide"] } },
    limit: 4,
  });

  const parts: string[] = [];
  for (const d of icpDocs.slice(0, 3)) {
    try {
      const content = await getDocumentContent(collection, d.path);
      if (content) parts.push(content.slice(0, 1_500));
    } catch {
      // skip
    }
  }
  if (parts.length === 0) {
    return "A potential customer publicly describing a problem this company solves. Founder-level or platform-engineer voice, concrete pain, no marketing fluff.";
  }
  return parts.join("\n\n");
}

export async function POST(): Promise<Response> {
  const sessionId = await getSessionId();
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "Session expired" }, { status: 401 });
  }
  const collection = workspaceCollection(sessionId);
  await ensureCollection(collection);

  // 1. Pull every signal in this workspace.
  const signals = await listDocuments({
    collectionName: collection,
    filter: { doc_type: "signal" },
    limit: 200,
  });
  if (signals.length === 0) {
    return NextResponse.json({
      ok: true,
      ranked: [],
      candidates: [],
      reason: "No signals to rank. Call /api/signals/fetch first.",
    });
  }

  // 2. Build the ICP-style query from the founder's brand context.
  const query = await buildICPQuery(collection);
  const usingBrandContext = query.length > 200 && !query.startsWith("A potential customer");

  // 3. Build the document list. Each signal's body is what we rerank.
  const documents = signals.map((s) => String(s.metadata.body ?? ""));

  // 4. ZE rerank — single API call, scores every signal against the query
  //    with the zerank cross-encoder. No embedding-based pre-filter — rerank
  //    handles the full 25-doc list directly.
  const scored = await rerank({
    query,
    documents,
    topN: TOP_N,
    model: RERANK_MODEL,
  });

  // 5. Persist top-N as ranked in ZE so the next steps (enrich / draft) see them.
  const top = scored.map((r) => ({ signal: signals[r.index], score: r.score }));
  await Promise.allSettled(
    top.map(({ signal, score }) =>
      updateMetadata({
        collectionName: collection,
        documentPath: signal.path,
        metadata: {
          ...signal.metadata,
          status: "ranked",
          fit_score: score.toFixed(3),
          ranker: RERANK_MODEL,
        },
      }),
    ),
  );

  // 6. Return the candidates ready for outreach (signal body + handle + score).
  const candidates = top.map(({ signal, score }) => ({
    signal_id: String(signal.metadata.signal_id ?? ""),
    path: signal.path,
    source: String(signal.metadata.source ?? ""),
    handle: String(signal.metadata.handle ?? ""),
    context: signal.metadata.context ? String(signal.metadata.context) : "",
    body: String(signal.metadata.body ?? ""),
    url: String(signal.metadata.url ?? ""),
    score,
  }));

  return NextResponse.json({
    ok: true,
    model: RERANK_MODEL,
    using_brand_context: usingBrandContext,
    total_signals: signals.length,
    candidates,
  });
}
