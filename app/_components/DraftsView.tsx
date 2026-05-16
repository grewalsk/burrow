"use client";

import { useCallback, useEffect, useState } from "react";
import { ChannelHeader } from "./ChannelHeader";

type Draft = {
  id: string;
  signal_id: string;
  source: string;
  handle: string;
  subject: string;
  contact_name: string;
  contact_email: string;
  contact_role: string;
  contact_company: string;
  evidence: string[];
  created_at: number;
};

export function DraftsView() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/drafts", { cache: "no-store" });
      const j = await r.json();
      if (j.ok) setDrafts(j.drafts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load drafts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSend = async (draftId: string) => {
    setSending((s) => ({ ...s, [draftId]: true }));
    try {
      const r = await fetch("/api/drafts/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft_id: draftId }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error ?? "send failed");
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending((s) => ({ ...s, [draftId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="px-8 py-8">
        <ChannelHeader name="#drafts" description="Replies waiting on your approval." />
        <p className="mt-16 text-center text-text-secondary" style={{ fontSize: 13 }}>
          Loading drafts…
        </p>
      </div>
    );
  }

  return (
    <div className="px-8 py-8">
      <ChannelHeader name="#drafts" description="Replies waiting on your approval." />
      {error && (
        <p className="mt-4 text-text-secondary" style={{ fontSize: 12 }}>
          {error}
        </p>
      )}
      {drafts.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-3">
          <p className="text-text-secondary" style={{ fontSize: 14 }}>
            Nothing pending.
          </p>
          <p className="text-text-tertiary" style={{ fontSize: 12 }}>
            Drafts appear here after you click "Generate outreach" on #signals.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {drafts.map((d) => (
            <DraftCard key={d.id} draft={d} sending={!!sending[d.id]} onSend={() => onSend(d.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function DraftCard({
  draft,
  sending,
  onSend,
}: {
  draft: Draft;
  sending: boolean;
  onSend: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [bodyPreview, setBodyPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!open || bodyPreview !== null) return;
    // Lazy-load full body via a content fetch from ZE only when user opens.
    // For now we reconstruct from the metadata-stored teaser; full body lives
    // in ZE as document content.
    fetch(`/api/drafts/preview?path=${encodeURIComponent(draft.id)}`)
      .then((r) => r.json())
      .then((j) => setBodyPreview(j.body ?? ""))
      .catch(() => setBodyPreview(""));
  }, [open, bodyPreview, draft.id]);

  return (
    <article
      className="signal-card"
      style={{
        background: "var(--bg-elevated)",
        borderColor: "var(--border-subtle)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div
            className="flex items-center gap-2 text-text-secondary"
            style={{ fontSize: 12, lineHeight: 1.3 }}
          >
            <span
              className="text-text-tertiary"
              style={{
                fontFamily:
                  '"JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace',
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {draft.source}
            </span>
            <span style={{ color: "var(--text-tertiary)" }}>·</span>
            <span className="text-text-primary" style={{ fontWeight: 500 }}>
              {draft.contact_name}
            </span>
            <span style={{ color: "var(--text-tertiary)" }}>·</span>
            <span>{draft.contact_role || draft.contact_email}</span>
          </div>
          <p
            className="mt-2 text-text-primary"
            style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.4 }}
          >
            {draft.subject}
          </p>
          <p
            className="mt-1 text-text-secondary"
            style={{ fontSize: 12, lineHeight: 1.4 }}
          >
            To: {draft.contact_email}
          </p>
          {draft.evidence.length > 0 && (
            <p
              className="mt-2 truncate text-text-secondary"
              style={{ fontSize: 12, lineHeight: 1.3 }}
            >
              <span style={{ color: "var(--text-tertiary)" }}>grounded in: </span>
              {draft.evidence.slice(0, 3).join(" · ")}
            </p>
          )}

          {open && (
            <pre
              className="mt-3 whitespace-pre-wrap"
              style={{
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 13,
                color: "var(--text-primary)",
                lineHeight: 1.55,
                background: "var(--bg-surface)",
                padding: 12,
                borderRadius: 4,
                border: "1px solid var(--border-subtle)",
              }}
            >
              {bodyPreview === null ? "Loading body…" : bodyPreview}
            </pre>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <button
            onClick={onSend}
            disabled={sending}
            style={{
              background: "var(--ink)",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 500,
              padding: "0 12px",
              height: 28,
              cursor: sending ? "not-allowed" : "pointer",
              opacity: sending ? 0.5 : 1,
            }}
          >
            {sending ? "Sending…" : "Send →"}
          </button>
          <button
            onClick={() => setOpen((o) => !o)}
            style={{
              background: "transparent",
              color: "var(--text-secondary)",
              border: "none",
              fontSize: 12,
              fontWeight: 500,
              padding: 0,
              cursor: "pointer",
            }}
          >
            {open ? "Hide body" : "Preview"}
          </button>
        </div>
      </div>
    </article>
  );
}
