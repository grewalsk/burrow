import { NextResponse } from "next/server";
import { addTextDocument, ensureCollection } from "@/lib/zeroentropyClient";
import { fetchSignals } from "@/lib/mockHogAI";
import { getSessionId, workspaceCollection } from "@/lib/workspace";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(): Promise<Response> {
  const sessionId = await getSessionId();
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "Session expired" }, { status: 401 });
  }
  const collection = workspaceCollection(sessionId);
  await ensureCollection(collection);

  const signals = fetchSignals();

  const results = await Promise.allSettled(
    signals.map((s) =>
      addTextDocument({
        collectionName: collection,
        documentPath: `signal-${s.id}.txt`,
        text: s.body,
        metadata: {
          doc_type: "signal",
          signal_id: s.id,
          source: s.source,
          handle: s.handle,
          context: s.context ?? "",
          posted_at: String(s.posted_at),
          url: s.url,
          body: s.body,
          status: "new",
          sample: "false",
        },
      }),
    ),
  );

  const added = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - added;

  return NextResponse.json({ ok: true, requested: signals.length, added, failed });
}
