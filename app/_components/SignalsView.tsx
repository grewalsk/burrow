"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChannelHeader } from "./ChannelHeader";
import { SignalCard, type Signal } from "./SignalCard";

type ApiSignal = {
  id: string;
  source: "REDDIT" | "HACKER NEWS" | "X" | "LINKEDIN";
  handle: string;
  context?: string;
  timeAgo: string;
  body: string;
  fitScore?: number;
  matches?: string;
  status: string;
  contact_name?: string;
};

type FlowStep = "idle" | "fetching" | "ranking" | "enriching" | "drafting" | "done";

export function SignalsView() {
  const router = useRouter();
  const [signals, setSignals] = useState<ApiSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [flow, setFlow] = useState<FlowStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/signals", { cache: "no-store", credentials: "same-origin" });
      const j = await r.json();
      if (j.ok) setSignals(j.signals ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load signals");
    } finally {
      setLoading(false);
    }
  }, []);

  // Polls /api/signals/status for an in-flight HogAI job. Returns true when
  // terminal (done/failed) so callers can stop polling. Updates elapsed sec
  // and signal list on success.
  const pollJobOnce = useCallback(
    async (jobId: string): Promise<"processing" | "done" | "failed"> => {
      try {
        const r = await fetch(`/api/signals/status?jobId=${encodeURIComponent(jobId)}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        const j = await r.json();
        if (j.status === "done") {
          // ZE indexing has a brief delay after store; give it a beat then list.
          setTimeout(load, 1500);
          return "done";
        }
        if (j.status === "failed" || j.ok === false) {
          const reason = j.error ?? j.hog_status ?? "HogAI operation failed";
          setError(`Fetch failed: ${reason}`);
          return "failed";
        }
        if (typeof j.elapsed_s === "number") setElapsedSec(j.elapsed_s);
        return "processing";
      } catch (e) {
        setError(e instanceof Error ? e.message : "Status poll failed");
        return "failed";
      }
    },
    [load],
  );

  const startPolling = useCallback(
    (jobId: string) => {
      window.localStorage.setItem("burrow.signalsJobId", jobId);
      let active = true;
      const tick = async () => {
        if (!active) return;
        const status = await pollJobOnce(jobId);
        if (status !== "processing") {
          active = false;
          window.localStorage.removeItem("burrow.signalsJobId");
          setFlow("idle");
          setElapsedSec(0);
          return;
        }
        window.setTimeout(tick, 10_000);
      };
      tick();
      return () => {
        active = false;
      };
    },
    [pollJobOnce],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Resume polling on mount if there's an in-flight jobId from a previous tab
  // load (page refresh, navigated away and back, etc.). HogAI retains the
  // operation result so the server-side proxy can still grab it.
  useEffect(() => {
    const inFlight = window.localStorage.getItem("burrow.signalsJobId");
    if (inFlight && inFlight !== "mock") {
      setFlow("fetching");
      startPolling(inFlight);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFetch = async () => {
    setFlow("fetching");
    setError(null);
    setElapsedSec(0);
    try {
      const r = await fetch("/api/signals/fetch", { method: "POST", credentials: "same-origin" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error ?? "fetch failed");

      // Two paths converge here:
      //   - status="done" (mock mode OR 24h cache hit): signals already in ZE
      //   - status="queued" (real HogAI): jobId points to in-flight operation
      if (j.status === "done") {
        setTimeout(load, 600);
        setFlow("idle");
        return;
      }
      if (j.status === "queued" && j.jobId) {
        startPolling(j.jobId);
        return;
      }
      // Unknown status — log and reset
      setError(`Unexpected fetch response: ${JSON.stringify(j).slice(0, 120)}`);
      setFlow("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fetch failed");
      setFlow("idle");
    }
  };

  const [stageDetail, setStageDetail] = useState<string>("");

  const onGenerateOutreach = async () => {
    setFlow("ranking");
    setError(null);
    setStageDetail("");
    try {
      setStageDetail("Scoring all signals against your ICP with ZeroEntropy's zerank-1-small cross-encoder. Picking the top 5 fits.");
      let r = await fetch("/api/signals/rank", { method: "POST" });
      let j = await r.json();
      if (!j.ok) throw new Error(j.error ?? "rank failed");
      const rankedCount = Array.isArray(j.candidates) ? j.candidates.length : 5;

      setFlow("enriching");
      setStageDetail(`Looking up contact info for ${rankedCount} ranked signals via HogAI enrichment. Reddit signals route to reply mode automatically. This takes 30-55 seconds.`);
      r = await fetch("/api/signals/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      j = await r.json();
      if (!j.ok) throw new Error(j.error ?? "enrich failed");
      const enrichedTotal = Array.isArray(j.enriched) ? j.enriched.length : rankedCount;
      const emailCount = Array.isArray(j.enriched)
        ? j.enriched.filter((e: { mode: string }) => e.mode === "email").length
        : 0;
      const replyCount = enrichedTotal - emailCount;

      setFlow("drafting");
      setStageDetail(`Writing ${enrichedTotal} drafts with Gemma 4 31B grounded in your win stories from ZeroEntropy (${emailCount} email, ${replyCount} reply).`);
      r = await fetch("/api/drafts/generate", { method: "POST" });
      j = await r.json();
      if (!j.ok) throw new Error(j.error ?? "draft failed");
      const draftsCount = Array.isArray(j.drafts) ? j.drafts.length : enrichedTotal;
      const errorCount = Array.isArray(j.errors) ? j.errors.length : 0;

      setFlow("done");
      // Keep the success panel visible for 3 seconds so the user knows the
      // full flow completed before we navigate away.
      setStageDetail(
        errorCount > 0
          ? `Done — created ${draftsCount} draft${draftsCount === 1 ? "" : "s"}, ${errorCount} error${errorCount === 1 ? "" : "s"}. Opening #drafts in 3 seconds…`
          : `Done — created ${draftsCount} draft${draftsCount === 1 ? "" : "s"} with Gemma. Opening #drafts in 3 seconds…`,
      );
      window.setTimeout(() => router.push("/drafts"), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Outreach generation failed");
      setStageDetail("");
      setFlow("idle");
    }
  };

  const renderSignals: Signal[] = signals.map((s) => ({
    id: s.id,
    source: s.source === "LINKEDIN" ? "X" : s.source, // SignalCard doesn't know LINKEDIN yet
    handle: s.handle,
    context: s.context,
    timeAgo: s.timeAgo,
    body: s.body,
    matches: s.matches ?? (s.contact_name ? `enriched · ${s.contact_name}` : undefined),
    fitScore: s.fitScore,
    analyzing: s.status === "new" && !s.fitScore,
  }));

  const flowLabel: Record<FlowStep, string> = {
    idle: "Generate outreach →",
    fetching: "",
    ranking: "Ranking…",
    enriching: "Enriching contacts…",
    drafting: "Drafting…",
    done: "Done",
  };

  const empty = !loading && signals.length === 0;

  return (
    <div className="px-8 py-8">
      <div className="flex items-center justify-between">
        <ChannelHeader
          name="#signals"
          description="Reverse-chronological feed of what Scout pulled. Click any card to open its lead card."
        />
        <div className="flex shrink-0 items-center gap-3">
          <button
            onClick={onFetch}
            disabled={flow !== "idle"}
            style={{
              background: "transparent",
              color: "var(--text-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 500,
              padding: "0 12px",
              height: 32,
              cursor: flow !== "idle" ? "not-allowed" : "pointer",
              opacity: flow !== "idle" ? 0.5 : 1,
            }}
          >
            {flow === "fetching"
              ? elapsedSec > 0
                ? `Researching… ${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, "0")} (≈4 min total)`
                : "Researching…"
              : "Fetch signals →"}
          </button>
          {signals.length > 0 && (
            <button
              onClick={onGenerateOutreach}
              disabled={flow !== "idle"}
              style={{
                background: "var(--ink)",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 500,
                padding: "0 14px",
                height: 32,
                cursor: flow !== "idle" ? "not-allowed" : "pointer",
                opacity: flow !== "idle" ? 0.5 : 1,
              }}
            >
              {flowLabel[flow] || "Generate outreach →"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-4 text-text-secondary" style={{ fontSize: 12 }}>
          {error}
        </p>
      )}

      {(flow === "ranking" || flow === "enriching" || flow === "drafting" || flow === "done") && (
        <div
          className="mt-4 flex flex-col gap-1 rounded border border-border-subtle bg-bg-surface px-4 py-3"
          style={{ borderRadius: 4 }}
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-block animate-pulse rounded-full"
              style={{
                width: 6,
                height: 6,
                background: flow === "done" ? "var(--green, #2D7D5F)" : "var(--ink)",
              }}
            />
            <span
              className="text-text-primary"
              style={{ fontSize: 13, fontWeight: 500 }}
            >
              {flow === "ranking" && "Step 1 of 3 — Ranking signals"}
              {flow === "enriching" && "Step 2 of 3 — Enriching contacts"}
              {flow === "drafting" && "Step 3 of 3 — Drafting outreach"}
              {flow === "done" && "Done — opening drafts"}
            </span>
          </div>
          {stageDetail && (
            <p
              className="text-text-secondary"
              style={{ fontSize: 12, lineHeight: 1.55, marginLeft: 14 }}
            >
              {stageDetail}
            </p>
          )}
        </div>
      )}

      {loading ? (
        <p className="mt-16 text-center text-text-secondary" style={{ fontSize: 13 }}>
          Loading signals…
        </p>
      ) : empty ? (
        <div className="mt-16 flex flex-col items-center gap-3">
          <p className="text-text-secondary" style={{ fontSize: 14 }}>
            {flow === "fetching" ? "Scout is researching your social corpus…" : "No signals yet."}
          </p>
          <p className="text-text-tertiary" style={{ fontSize: 12 }}>
            {flow === "fetching"
              ? "HogAI deep-research takes about 4 minutes. Safe to leave this tab — we'll pick up where we left off."
              : "Click \"Fetch signals →\" to pull from Scout."}
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {renderSignals.map((s) => (
            <SignalCard key={s.id} signal={s} />
          ))}
        </div>
      )}
    </div>
  );
}
