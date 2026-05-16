"use client";

import { useEffect, useState } from "react";

type Counters = {
  signalsSeen: number;
  highFitLeads: number;
  draftsPending: number;
  approved: number;
  avgTimeToDraftSec: number;
  groundedPct: number;
};

const INITIAL: Counters = {
  signalsSeen: 1247,
  highFitLeads: 12,
  draftsPending: 4,
  approved: 8,
  avgTimeToDraftSec: 47,
  groundedPct: 98,
};

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function TopStrip() {
  const [counters, setCounters] = useState<Counters>(INITIAL);

  useEffect(() => {
    const id = setInterval(() => {
      setCounters((c) => {
        // Quiet ticks: nudge a few values occasionally. Most ticks are no-ops.
        const next: Counters = { ...c };
        if (Math.random() < 0.5) next.signalsSeen = c.signalsSeen + 1;
        if (Math.random() < 0.12) next.highFitLeads = c.highFitLeads + 1;
        if (Math.random() < 0.18) next.draftsPending = Math.max(0, c.draftsPending + (Math.random() < 0.4 ? -1 : 1));
        if (Math.random() < 0.10) next.approved = c.approved + 1;
        if (Math.random() < 0.25) next.avgTimeToDraftSec = Math.max(20, Math.min(90, c.avgTimeToDraftSec + (Math.random() < 0.5 ? -1 : 1)));
        if (Math.random() < 0.08) next.groundedPct = Math.max(90, Math.min(100, c.groundedPct + (Math.random() < 0.5 ? -1 : 1)));
        return next;
      });
    }, 2200);
    return () => clearInterval(id);
  }, []);

  const items: { label: string; value: string }[] = [
    { label: "Signals seen", value: formatNumber(counters.signalsSeen) },
    { label: "High-fit leads", value: formatNumber(counters.highFitLeads) },
    { label: "Drafts pending", value: formatNumber(counters.draftsPending) },
    { label: "Approved", value: formatNumber(counters.approved) },
    { label: "Avg time-to-draft", value: `${counters.avgTimeToDraftSec}s` },
    { label: "Grounded %", value: `${counters.groundedPct}%` },
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
