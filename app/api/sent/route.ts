import { NextResponse } from "next/server";
import { ensureCollection, listDocuments } from "@/lib/zeroentropyClient";
import { getSessionId, workspaceCollection } from "@/lib/workspace";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const sessionId = await getSessionId();
  if (!sessionId) return NextResponse.json({ ok: false, sent: [] }, { status: 401 });
  const collection = workspaceCollection(sessionId);
  await ensureCollection(collection);

  const docs = await listDocuments({
    collectionName: collection,
    filter: { "metadata.doc_type": "draft", "metadata.status": "sent" },
    limit: 100,
  });

  const sent = docs
    .map((d) => ({
      id: String(d.metadata.draft_id ?? d.path),
      path: d.path,
      signal_id: String(d.metadata.signal_id ?? ""),
      source: String(d.metadata.source ?? ""),
      subject: String(d.metadata.subject ?? ""),
      contact_name: String(d.metadata.contact_name ?? ""),
      contact_email: String(d.metadata.contact_email ?? ""),
      sent_at: Number(d.metadata.sent_at ?? Date.now()),
      message_id: String(d.metadata.message_id ?? ""),
    }))
    .sort((a, b) => b.sent_at - a.sent_at);

  return NextResponse.json({ ok: true, sent });
}
