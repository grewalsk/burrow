import { NextResponse } from "next/server";
import { ensureCollection } from "@/lib/zeroentropyClient";
import { getSessionId, workspaceCollection } from "@/lib/workspace";
import { getOperation, isTerminalStatus, isHogMockMode } from "@/lib/hogClient";
import { parseHogSignals, storeSignals } from "@/lib/signalsClient";
import { getCachedFetch, setCachedFetch } from "@/lib/signalsCache";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request): Promise<Response> {
  const sessionId = await getSessionId();
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "Session expired" }, { status: 401 });
  }

  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ ok: false, error: "jobId query param required" }, { status: 400 });
  }

  // Mock mode: nothing to poll, the fetch route already stored everything
  if (isHogMockMode() || jobId === "mock") {
    return NextResponse.json({ ok: true, status: "done", jobId, mock: true });
  }

  // If we already cached completed signals for this job, short-circuit
  const cached = getCachedFetch(sessionId);
  if (cached?.jobId === jobId && cached.completedAt && cached.signals) {
    return NextResponse.json({
      ok: true,
      status: "done",
      jobId,
      signals: cached.signals,
      cached: true,
    });
  }

  const opRes = await getOperation<unknown>(jobId);
  if (opRes.error || !opRes.body) {
    return NextResponse.json(
      { ok: false, error: opRes.error ?? "operation lookup failed", status_code: opRes.status },
      { status: 502 },
    );
  }

  const op = opRes.body;

  // Still in progress
  if (!isTerminalStatus(op.status)) {
    const elapsed_s = cached?.startedAt ? Math.floor((Date.now() - cached.startedAt) / 1000) : null;
    return NextResponse.json({
      ok: true,
      status: "processing",
      hog_status: op.status,
      progress: op.progress ?? null,
      elapsed_s,
    });
  }

  // Failed
  if (op.status !== "succeeded") {
    if (cached) setCachedFetch(sessionId, { ...cached, completedAt: Date.now(), signals: [] });
    return NextResponse.json({
      ok: false,
      status: "failed",
      hog_status: op.status,
      error: op.error ?? "HogAI operation failed",
    });
  }

  // Succeeded — parse, store, cache, return
  const signals = parseHogSignals(op.result);
  const collection = workspaceCollection(sessionId);
  await ensureCollection(collection);
  const storeResult = await storeSignals({ collectionName: collection, signals });

  setCachedFetch(sessionId, {
    jobId,
    startedAt: cached?.startedAt ?? Date.now(),
    completedAt: Date.now(),
    signals,
  });

  return NextResponse.json({
    ok: true,
    status: "done",
    jobId,
    signals,
    stored: storeResult.stored,
    failed: storeResult.failed,
  });
}
