"use client";

import { useEffect, useState } from "react";
import { ChannelHeader } from "./ChannelHeader";

type SentEmail = {
  id: string;
  source: string;
  subject: string;
  contact_name: string;
  contact_email: string;
  sent_at: number;
  message_id: string;
};

function timeAgo(ts: number): string {
  const ms = Date.now() - ts;
  if (ms < 60_000) return `${Math.max(1, Math.floor(ms / 1000))}s ago`;
  if (ms < 60 * 60_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 24 * 60 * 60_000) return `${Math.floor(ms / (60 * 60_000))}h ago`;
  return new Date(ts).toLocaleDateString();
}

export function SentView() {
  const [sent, setSent] = useState<SentEmail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sent", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setSent(j.sent ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="px-8 py-8">
        <ChannelHeader name="#sent" description="Replies you've approved." />
        <p className="mt-16 text-center text-text-secondary" style={{ fontSize: 13 }}>
          Loading…
        </p>
      </div>
    );
  }

  return (
    <div className="px-8 py-8">
      <ChannelHeader name="#sent" description="Replies you've approved." />
      {sent.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-3">
          <p className="text-text-secondary" style={{ fontSize: 14 }}>
            Nothing sent yet.
          </p>
          <p className="text-text-tertiary" style={{ fontSize: 12 }}>
            Approved drafts land here.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {sent.map((s) => (
            <article
              key={s.id}
              className="signal-card"
              style={{ background: "transparent", borderColor: "var(--border-subtle)" }}
            >
              <div className="flex items-center justify-between gap-4">
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
                      {s.source}
                    </span>
                    <span style={{ color: "var(--text-tertiary)" }}>·</span>
                    <span className="text-text-primary" style={{ fontWeight: 500 }}>
                      {s.contact_name}
                    </span>
                    <span style={{ color: "var(--text-tertiary)" }}>·</span>
                    <span>{s.contact_email}</span>
                    <span style={{ color: "var(--text-tertiary)" }}>·</span>
                    <span>{timeAgo(s.sent_at)}</span>
                  </div>
                  <p
                    className="mt-1 truncate text-text-primary"
                    style={{ fontSize: 14, fontWeight: 500 }}
                  >
                    {s.subject}
                  </p>
                </div>
                <span
                  className="text-text-tertiary"
                  style={{
                    fontFamily:
                      '"JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace',
                    fontSize: 10,
                  }}
                >
                  {s.message_id}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
