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

  useEffect(() => {
    load();
  }, [load]);

  const onFetch = async () => {
    setFlow("fetching");
    setError(null);
    try {
      const r = await fetch("/api/signals/fetch", { method: "POST" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error ?? "fetch failed");
      // ZE indexing has a brief delay; give it a beat before re-listing.
      setTimeout(load, 600);
      setFlow("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fetch failed");
      setFlow("idle");
    }
  };

  const onGenerateOutreach = async () => {
    setFlow("ranking");
    setError(null);
    try {
      let r = await fetch("/api/signals/rank", { method: "POST" });
      let j = await r.json();
      if (!j.ok) throw new Error(j.error ?? "rank failed");

      setFlow("enriching");
      r = await fetch("/api/signals/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      j = await r.json();
      if (!j.ok) throw new Error(j.error ?? "enrich failed");

      setFlow("drafting");
      r = await fetch("/api/drafts/generate", { method: "POST" });
      j = await r.json();
      if (!j.ok) throw new Error(j.error ?? "draft failed");

      setFlow("done");
      router.push("/drafts");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Outreach generation failed");
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
            {flow === "fetching" ? "Fetching…" : "Fetch signals →"}
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

      {loading ? (
        <p className="mt-16 text-center text-text-secondary" style={{ fontSize: 13 }}>
          Loading signals…
        </p>
      ) : empty ? (
        <div className="mt-16 flex flex-col items-center gap-3">
          <p className="text-text-secondary" style={{ fontSize: 14 }}>
            No signals yet.
          </p>
          <p className="text-text-tertiary" style={{ fontSize: 12 }}>
            Click "Fetch signals →" to pull from Scout (mock HogAI).
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
