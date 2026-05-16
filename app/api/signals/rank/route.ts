import { NextResponse } from "next/server";
import {
  topDocuments,
  updateMetadata,
  ensureCollection,
} from "@/lib/zeroentropyClient";
import { getSessionId, workspaceCollection } from "@/lib/workspace";

export const runtime = "nodejs";
export const maxDuration = 60;

const TOP_N = 5;

export async function POST(): Promise<Response> {
  const sessionId = await getSessionId();
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "Session expired" }, { status: 401 });
  }
  const collection = workspaceCollection(sessionId);
  await ensureCollection(collection);

  // Build the ranking query from the founder's own brand context.
  // We use brand_guide + icp text as the relevance vector for "which signals look like
  // people who match our ICP and brand". Done with ZE retrieval — no LLM, just embeddings.
  const brandDocs = await topDocuments({
    collectionName: collection,
    query: "ideal customer brand voice past wins ICP fit competitor pain",
    k: 6,
    filter: {
      "metadata.doc_type": { $in: ["brand_guide", "icp", "won_deal"] },
    },
  });

  // If no brand context yet, fall back to a generic founder-tone query so we still rank.
  const queryText =
    brandDocs.length > 0
      ? brandDocs
          .map((d) => String(d.metadata.filename ?? d.metadata.story_name ?? ""))
          .join(" ") +
        " managed retrieval Pinecone alternatives founder switching cost"
      : "managed retrieval Pinecone alternatives founder switching cost SOC2 ICP fit";

  const ranked = await topDocuments({
    collectionName: collection,
    query: queryText,
    k: TOP_N,
    filter: { "metadata.doc_type": "signal" },
  });

  // Tag the top N with fit_score + status=ranked. Other signals keep status=new.
  await Promise.allSettled(
    ranked.map((d) =>
      updateMetadata({
        collectionName: collection,
        documentPath: d.path,
        metadata: {
          ...d.metadata,
          status: "ranked",
          fit_score: d.score.toFixed(2),
        },
      }),
    ),
  );

  return NextResponse.json({
    ok: true,
    ranked: ranked.map((d) => ({
      path: d.path,
      signal_id: String(d.metadata.signal_id ?? ""),
      score: d.score,
    })),
    using_brand_context: brandDocs.length > 0,
  });
}
