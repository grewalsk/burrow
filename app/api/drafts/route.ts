import { NextResponse } from "next/server";
import { ensureCollection, listDocuments } from "@/lib/zeroentropyClient";
import { getSessionId, workspaceCollection } from "@/lib/workspace";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const sessionId = await getSessionId();
  if (!sessionId) return NextResponse.json({ ok: false, drafts: [] }, { status: 401 });
  const collection = workspaceCollection(sessionId);
  await ensureCollection(collection);

  const docs = await listDocuments({
    collectionName: collection,
    filter: { "metadata.doc_type": "draft", "metadata.status": "pending" },
    limit: 50,
  });

  const drafts = docs
    .map((d) => ({
      id: String(d.metadata.draft_id ?? d.path),
      path: d.path,
      signal_id: String(d.metadata.signal_id ?? ""),
      source: String(d.metadata.source ?? ""),
      handle: String(d.metadata.handle ?? ""),
      subject: String(d.metadata.subject ?? ""),
      contact_name: String(d.metadata.contact_name ?? ""),
      contact_email: String(d.metadata.contact_email ?? ""),
      contact_role: String(d.metadata.contact_role ?? ""),
      contact_company: String(d.metadata.contact_company ?? ""),
      evidence: typeof d.metadata.evidence === "string" && d.metadata.evidence.length
        ? d.metadata.evidence.split(" · ")
        : Array.isArray(d.metadata.evidence)
          ? (d.metadata.evidence as string[])
          : [],
      created_at: Number(d.metadata.created_at ?? Date.now()),
    }))
    .sort((a, b) => b.created_at - a.created_at);

  return NextResponse.json({ ok: true, drafts });
}
