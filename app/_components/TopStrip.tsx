"use client";

import { useEffect, useState } from "react";

type Status = {
  brand_docs: number;
  signals: number;
  ranked_signals: number;
  drafts_pending: number;
  drafts_sent: number;
  grounded_pct: number;
};

const INITIAL: Status = {
  brand_docs: 0,
  signals: 0,
  ranked_signals: 0,
  drafts_pending: 0,
  drafts_sent: 0,
  grounded_pct: 0,
};

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function TopStrip() {
  const [status, setStatus] = useState<Status>(INITIAL);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch("/api/brain/status", { cache: "no-store" });
        const j = await r.json();
        if (!cancelled && j.ok && j.status) setStatus(j.status as Status);
      } catch {
        // ignore — counters stay at last value
      }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const items: { label: string; value: string }[] = [
    { label: "Brand docs", value: formatNumber(status.brand_docs) },
    { label: "Signals seen", value: formatNumber(status.signals) },
    { label: "Ranked", value: formatNumber(status.ranked_signals) },
    { label: "Drafts pending", value: formatNumber(status.drafts_pending) },
    { label: "Sent", value: formatNumber(status.drafts_sent) },
    { label: "Grounded %", value: `${status.grounded_pct}%` },
  ];

  return (
    <header
      className="flex h-[56px] w-full items-center border-b border-border-subtle bg-bg-base px-8"
      style={{ minHeight: 56 }}
    >
      <div className="flex items-center gap-12">
        {items.map((it) => (
          <CounterCell key={it.label} label={it.label} value={it.value} />
        ))}
      </div>
    </header>
  );
}

function CounterCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-[2px]">
      <span
        className="text-text-secondary"
        style={{
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          lineHeight: 1.3,
        }}
      >
        {label}
      </span>
      <CrossfadeNumber value={value} />
    </div>
  );
}

/**
 * Swaps the displayed string with a 200ms opacity crossfade when `value` changes.
 * Quiet by design — no flash, no pulse, no ticker animation.
 */
function CrossfadeNumber({ value }: { value: string }) {
  const [shown, setShown] = useState(value);
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    if (value === shown) return;
    setOpacity(0);
    const t = window.setTimeout(() => {
      setShown(value);
      setOpacity(1);
    }, 200);
    return () => window.clearTimeout(t);
  }, [value, shown]);

  return (
    <span
      className="text-text-primary tabular-nums"
      style={{
        fontSize: 18,
        fontWeight: 500,
        lineHeight: 1.3,
        opacity,
        transition: "opacity 200ms ease-out",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {shown}
    </span>
  );
}
