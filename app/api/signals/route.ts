import { NextResponse } from "next/server";
import { ensureCollection, listDocuments } from "@/lib/zeroentropyClient";
import { getSessionId, workspaceCollection } from "@/lib/workspace";

export const runtime = "nodejs";

function timeAgo(posted_at: number): string {
  const ms = Date.now() - posted_at;
  if (ms < 60_000) return `${Math.max(1, Math.floor(ms / 1000))}s ago`;
  if (ms < 60 * 60_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 24 * 60 * 60_000) return `${Math.floor(ms / (60 * 60_000))}h ago`;
  return `${Math.floor(ms / (24 * 60 * 60_000))}d ago`;
}

export async function GET(): Promise<Response> {
  const sessionId = await getSessionId();
  if (!sessionId) return NextResponse.json({ ok: false, signals: [] }, { status: 401 });
  const collection = workspaceCollection(sessionId);
  await ensureCollection(collection);

  const docs = await listDocuments({
    collectionName: collection,
    filter: { "metadata.doc_type": "signal" },
    limit: 50,
  });

  const signals = docs
    .map((d) => {
      const posted_at = Number(d.metadata.posted_at ?? Date.now());
      const fitRaw = d.metadata.fit_score;
      const fit_score = fitRaw !== undefined ? Number(fitRaw) : undefined;
      return {
        id: String(d.metadata.signal_id ?? d.path),
        path: d.path,
        source: String(d.metadata.source ?? "X"),
        handle: String(d.metadata.handle ?? ""),
        context: d.metadata.context ? String(d.metadata.context) : undefined,
        timeAgo: timeAgo(posted_at),
        posted_at,
        body: String(d.metadata.body ?? ""),
        url: String(d.metadata.url ?? ""),
        status: String(d.metadata.status ?? "new"),
        fitScore: fit_score,
        matches: d.metadata.matches ? String(d.metadata.matches) : undefined,
        contact_name: d.metadata.contact_name ? String(d.metadata.contact_name) : undefined,
        contact_email: d.metadata.contact_email ? String(d.metadata.contact_email) : undefined,
      };
    })
    .sort((a, b) => b.posted_at - a.posted_at);

  return NextResponse.json({ ok: true, signals });
}
