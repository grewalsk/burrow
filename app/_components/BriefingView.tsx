"use client";

import { useEffect, useState } from "react";
import { ChannelHeader } from "./ChannelHeader";

type Status = {
  brand_docs: number;
  signals: number;
  ranked_signals: number;
  drafts_pending: number;
  drafts_sent: number;
  grounded_pct: number;
};

export function BriefingView() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/brain/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setStatus(j.status);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="px-8 py-8">
      <ChannelHeader
        name="#briefing"
        description="Chief of Staff's morning summary and competitor moves."
      />
      {loading ? (
        <p className="mt-16 text-center text-text-secondary" style={{ fontSize: 13 }}>
          Loading…
        </p>
      ) : !status || status.brand_docs === 0 ? (
        <div className="mt-10">
          <p
            className="text-text-primary"
            style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.4 }}
          >
            Your brain has no documents yet.
          </p>
          <p className="mt-2 text-text-secondary" style={{ fontSize: 13, lineHeight: 1.5 }}>
            Upload past wins, losses, brand voice, and ICP so Burrow can cite real
            evidence when scoring leads.
          </p>
          <a
            href="/onboarding/upload?context=dashboard"
            style={{
              display: "inline-block",
              marginTop: 14,
              background: "var(--ink)",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 500,
              padding: "8px 14px",
              textDecoration: "none",
            }}
          >
            Upload now →
          </a>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-6">
          <section>
            <h3
              style={{
                fontSize: 11,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.10em",
                color: "var(--text-secondary)",
              }}
            >
              Brain status
            </h3>
            <div
              className="mt-3 grid gap-4"
              style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
            >
              <Stat label="Brand docs" value={status.brand_docs} />
              <Stat label="Signals" value={status.signals} />
              <Stat label="Ranked" value={status.ranked_signals} />
              <Stat
                label="Grounded %"
                value={`${status.grounded_pct}%`}
                emphasis={status.grounded_pct >= 75}
              />
            </div>
          </section>

          <section>
            <h3
              style={{
                fontSize: 11,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.10em",
                color: "var(--text-secondary)",
              }}
            >
              Today
            </h3>
            <ul className="mt-3 flex flex-col gap-2">
              <BriefLine
                done={status.signals > 0}
                primary={`${status.signals} signal${status.signals === 1 ? "" : "s"} collected`}
                secondary={status.signals === 0 ? "Run Fetch signals on #signals." : "From Reddit, HN, X, LinkedIn."}
              />
              <BriefLine
                done={status.ranked_signals > 0}
                primary={`${status.ranked_signals} ranked against your brand`}
                secondary={
                  status.ranked_signals === 0
                    ? "Run Generate outreach to rank."
                    : "Scored using brand_guide + ICP retrieval."
                }
              />
              <BriefLine
                done={status.drafts_pending + status.drafts_sent > 0}
                primary={`${status.drafts_pending} draft${status.drafts_pending === 1 ? "" : "s"} pending`}
                secondary={
                  status.drafts_sent > 0
                    ? `${status.drafts_sent} sent already.`
                    : "Review and approve from #drafts."
                }
              />
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number | string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.10em",
          color: "var(--text-secondary)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 22,
          fontWeight: 500,
          color: emphasis ? "var(--green)" : "var(--text-primary)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function BriefLine({
  done,
  primary,
  secondary,
}: {
  done: boolean;
  primary: string;
  secondary?: string;
}) {
  return (
    <li className="flex items-baseline gap-3">
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: done ? "var(--green)" : "var(--text-tertiary)",
          display: "inline-block",
        }}
      />
      <div className="flex flex-col">
        <span style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>
          {primary}
        </span>
        {secondary && (
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{secondary}</span>
        )}
      </div>
    </li>
  );
}
