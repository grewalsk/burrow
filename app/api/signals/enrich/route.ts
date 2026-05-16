import { NextResponse } from "next/server";
import {
  listDocuments,
  updateMetadata,
  ensureCollection,
} from "@/lib/zeroentropyClient";
import { enrichContact, type HogSource } from "@/lib/mockHogAI";
import { getSessionId, workspaceCollection } from "@/lib/workspace";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  const sessionId = await getSessionId();
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "Session expired" }, { status: 401 });
  }
  const collection = workspaceCollection(sessionId);
  await ensureCollection(collection);

  // Either enrich a specific signal_id OR all ranked signals (default).
  let body: { signal_id?: string } = {};
  try {
    body = (await req.json()) as { signal_id?: string };
  } catch {
    // empty body is fine
  }

  let targets = await listDocuments({
    collectionName: collection,
    filter: body.signal_id
      ? { "metadata.signal_id": body.signal_id }
      : { "metadata.doc_type": "signal", "metadata.status": "ranked" },
    limit: 10,
  });
  // Only enrich ranked signals if no specific ID was passed
  if (!body.signal_id) {
    targets = targets.filter((d) => d.metadata.status === "ranked");
  }

  const enriched: Array<{ signal_id: string; contact_name: string; contact_email: string }> = [];

  await Promise.allSettled(
    targets.map(async (d) => {
      const contact = enrichContact({
        source: String(d.metadata.source ?? "X") as HogSource,
        handle: String(d.metadata.handle ?? ""),
        context: d.metadata.context ? String(d.metadata.context) : undefined,
      });
      await updateMetadata({
        collectionName: collection,
        documentPath: d.path,
        metadata: {
          ...d.metadata,
          status: "enriched",
          contact_name: contact.name,
          contact_email: contact.email,
          contact_role: contact.role,
          contact_company: contact.company ?? "",
          contact_linkedin: contact.linkedin ?? "",
          contact_confidence: contact.confidence.toFixed(2),
        },
      });
      enriched.push({
        signal_id: String(d.metadata.signal_id ?? ""),
        contact_name: contact.name,
        contact_email: contact.email,
      });
    }),
  );

  return NextResponse.json({ ok: true, enriched });
}
