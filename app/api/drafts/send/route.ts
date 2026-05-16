import { NextResponse } from "next/server";
import {
  listDocuments,
  updateMetadata,
  ensureCollection,
} from "@/lib/zeroentropyClient";
import { getSessionId, workspaceCollection } from "@/lib/workspace";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request): Promise<Response> {
  const sessionId = await getSessionId();
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "Session expired" }, { status: 401 });
  }
  const collection = workspaceCollection(sessionId);
  await ensureCollection(collection);

  let body: { draft_id?: string };
  try {
    body = (await req.json()) as { draft_id?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.draft_id) {
    return NextResponse.json({ ok: false, error: "draft_id required" }, { status: 400 });
  }

  const drafts = await listDocuments({
    collectionName: collection,
    filter: { doc_type: "draft", draft_id: body.draft_id },
    limit: 1,
  });
  if (drafts.length === 0) {
    return NextResponse.json({ ok: false, error: "Draft not found" }, { status: 404 });
  }
  const draft = drafts[0];

  // Mock send: just flip status + record sent_at. In real life this would call
  // an SMTP/SES provider. Surface a fake message_id for visual confirmation.
  const messageId = `mock-${Math.random().toString(36).slice(2, 10)}@burrow.local`;
  await updateMetadata({
    collectionName: collection,
    documentPath: draft.path,
    metadata: {
      ...draft.metadata,
      status: "sent",
      sent_at: String(Date.now()),
      message_id: messageId,
    },
  });

  return NextResponse.json({ ok: true, draft_id: body.draft_id, message_id: messageId });
}
