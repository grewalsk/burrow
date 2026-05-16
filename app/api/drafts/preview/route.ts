import { NextResponse } from "next/server";
import {
  ensureCollection,
  getDocumentContent,
  listDocuments,
} from "@/lib/zeroentropyClient";
import { getSessionId, workspaceCollection } from "@/lib/workspace";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const sessionId = await getSessionId();
  if (!sessionId)
    return NextResponse.json({ ok: false, body: "" }, { status: 401 });
  const collection = workspaceCollection(sessionId);
  await ensureCollection(collection);

  const u = new URL(req.url);
  const draftId = u.searchParams.get("path");
  if (!draftId) {
    return NextResponse.json({ ok: false, body: "" }, { status: 400 });
  }
  const matches = await listDocuments({
    collectionName: collection,
    filter: { doc_type: "draft", draft_id: draftId },
    limit: 1,
  });
  if (matches.length === 0) {
    return NextResponse.json({ ok: false, body: "" }, { status: 404 });
  }
  const content = await getDocumentContent(collection, matches[0].path);
  return NextResponse.json({ ok: true, body: content ?? "" });
}
