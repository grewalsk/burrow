import { NextResponse } from "next/server";
import { ensureCollection, listDocuments } from "@/lib/zeroentropyClient";
import { getSessionId, workspaceCollection } from "@/lib/workspace";

export const runtime = "nodejs";

const BRAND_TYPES = [
  "brand_guide",
  "icp",
  "won_deal",
  "lost_deal",
  "competitor_intel",
  "call_transcript",
  "case_study",
  "pricing_objection",
  "faq",
];

export async function GET(): Promise<Response> {
  const sessionId = await getSessionId();
  if (!sessionId)
    return NextResponse.json({ ok: false, status: null }, { status: 401 });

  const collection = workspaceCollection(sessionId);
  await ensureCollection(collection);

  const [brand, signals, ranked, draftsPending, draftsSent] = await Promise.all([
    listDocuments({
      collectionName: collection,
      filter: { doc_type: { $in: BRAND_TYPES } },
      limit: 200,
    }),
    listDocuments({
      collectionName: collection,
      filter: { doc_type: "signal" },
      limit: 200,
    }),
    listDocuments({
      collectionName: collection,
      filter: {
        doc_type: "signal",
        status: { $in: ["ranked", "enriched", "drafted"] },
      },
      limit: 200,
    }),
    listDocuments({
      collectionName: collection,
      filter: { doc_type: "draft", status: "pending" },
      limit: 200,
    }),
    listDocuments({
      collectionName: collection,
      filter: { doc_type: "draft", status: "sent" },
      limit: 200,
    }),
  ]);

  const brand_docs = brand.length;
  const grounded_pct =
    brand_docs === 0 ? 0 : Math.min(100, Math.round((brand_docs / Math.max(brand_docs, 4)) * 99));

  return NextResponse.json({
    ok: true,
    status: {
      brand_docs,
      signals: signals.length,
      ranked_signals: ranked.length,
      drafts_pending: draftsPending.length,
      drafts_sent: draftsSent.length,
      grounded_pct,
    },
  });
}
