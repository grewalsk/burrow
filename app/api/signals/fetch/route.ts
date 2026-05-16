import { NextResponse } from "next/server";
import { ensureCollection, addTextDocument } from "@/lib/zeroentropyClient";
import { getSessionId, workspaceCollection } from "@/lib/workspace";
import { kickoffSignalsFetch } from "@/lib/signalsClient";
import { isHogMockMode } from "@/lib/hogClient";
import { fetchSignals as mockFetchSignals } from "@/lib/mockHogAI";
import { getCachedFetch, setCachedFetch, isCacheFresh } from "@/lib/signalsCache";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  const sessionId = await getSessionId();
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "Session expired" }, { status: 401 });
  }

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "true";
  const collection = workspaceCollection(sessionId);
  await ensureCollection(collection);

  // ---- Mock path (HOGAI_MOCK=true): synchronous, no polling needed ----
  if (isHogMockMode()) {
    const signals = mockFetchSignals();
    await Promise.allSettled(
      signals.map((s) =>
        addTextDocument({
          collectionName: collection,
          documentPath: `signal-${s.id}.txt`,
          text: s.body,
          metadata: {
            doc_type: "signal",
            signal_id: s.id,
            // New descriptive keys
            platform: s.source === "X" ? "X" : s.source === "REDDIT" ? "Reddit" : s.source === "LINKEDIN" ? "LinkedIn" : "X",
            author_handle: s.handle.replace(/^[@u]\/?/, ""),
            author_profile_url: "",
            post_url: s.url,
            post_text: s.body,
            pain_point: "",
            why_relevant: "",
            fetched_at: String(s.posted_at),
            outreach_mode: s.source === "REDDIT" ? "reply" : "email",
            enriched: "false",
            status: "new",
            sample: "false",
            // Legacy aliases (rank/draft/signals routes consume these)
            source: s.source,
            handle: s.handle.replace(/^[@u]\/?/, ""),
            context: s.context ?? "",
            body: s.body,
            url: s.url,
            posted_at: String(s.posted_at),
          },
        }),
      ),
    );
    return NextResponse.json({ ok: true, mock: true, jobId: "mock", status: "done", count: signals.length });
  }

  // ---- Real path: in-flight protection + cache check + kickoff ----

  const existing = getCachedFetch(sessionId);

  if (existing && !existing.completedAt && !force) {
    return NextResponse.json({
      ok: true,
      jobId: existing.jobId,
      status: "queued",
      already_in_flight: true,
    });
  }

  if (existing && isCacheFresh(existing) && existing.signals && !force) {
    return NextResponse.json({
      ok: true,
      jobId: existing.jobId,
      status: "done",
      cached: true,
      signals: existing.signals,
      cache_age_s: Math.floor((Date.now() - (existing.completedAt ?? 0)) / 1000),
    });
  }

  const result = await kickoffSignalsFetch(collection);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  setCachedFetch(sessionId, { jobId: result.jobId, startedAt: Date.now() });

  return NextResponse.json({
    ok: true,
    jobId: result.jobId,
    status: "queued",
    prompt_preview: result.promptPreview,
  });
}
