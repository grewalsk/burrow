"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type ChannelSlug = "signals" | "drafts" | "sent" | "briefing" | "ask";

type Channel = {
  slug: ChannelSlug;
  label: string;
  unread?: number;
};

type BrainStatus = {
  brand_docs: number;
  signals: number;
  ranked_signals: number;
  drafts_pending: number;
  drafts_sent: number;
  grounded_pct: number;
};

// Channel order is stable; counts come from /api/brain/status (same source
// of truth as the TopStrip counters so the two are always consistent).
const CHANNEL_ORDER: ChannelSlug[] = ["signals", "drafts", "sent", "briefing", "ask"];
const CHANNEL_LABEL: Record<ChannelSlug, string> = {
  signals: "#signals",
  drafts: "#drafts",
  sent: "#sent",
  briefing: "#briefing",
  ask: "#ask",
};

function unreadFor(slug: ChannelSlug, status: BrainStatus | null): number | undefined {
  if (!status) return undefined;
  switch (slug) {
    case "signals":
      return status.signals;
    case "drafts":
      return status.drafts_pending;
    case "sent":
      return status.drafts_sent;
    case "briefing":
    case "ask":
      return undefined; // no per-item count for overview / placeholder
  }
}

export function LeftRail() {
  const pathname = usePathname();
  const [status, setStatus] = useState<BrainStatus | null>(null);
  const live = true; // placeholder for Scout cron status

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch("/api/brain/status", { cache: "no-store" });
        const j = await r.json();
        if (!cancelled && j.ok && j.status) setStatus(j.status as BrainStatus);
      } catch {
        // keep last known state on transient error
      }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const channels: Channel[] = CHANNEL_ORDER.map((slug) => ({
    slug,
    label: CHANNEL_LABEL[slug],
    unread: unreadFor(slug, status),
  }));

  return (
    <aside
      className="flex shrink-0 flex-col border-r border-border-subtle bg-bg-base"
      style={{ width: 220 }}
    >
      <nav className="flex flex-col gap-[2px] p-3 pt-4">
        {channels.map((ch) => {
          const href = `/${ch.slug}`;
          const selected =
            pathname === href || (pathname === "/" && ch.slug === "signals");
          return <ChannelRow key={ch.slug} channel={ch} href={href} selected={selected} />;
        })}
      </nav>

      <div className="mx-3 my-3 h-px bg-border-subtle" />

      <div className="px-3">
        <Link
          href="#"
          className="block py-2 text-text-tertiary transition-colors hover:text-text-secondary"
          style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}
        >
          Settings
        </Link>
      </div>

      <div className="mt-auto px-4 pb-4 pt-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-block rounded-full"
            style={{
              width: 6,
              height: 6,
              background: live ? "var(--green)" : "var(--text-tertiary)",
            }}
          />
          <span
            className="text-text-secondary"
            style={{ fontSize: 11, lineHeight: 1.3, fontWeight: 400 }}
          >
            {live ? "Live" : "Paused"}
          </span>
        </div>
      </div>
    </aside>
  );
}

function ChannelRow({
  channel,
  href,
  selected,
}: {
  channel: Channel;
  href: string;
  selected: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-card transition-colors"
      style={{
        height: 36,
        paddingLeft: 12,
        paddingRight: 12,
        background: selected ? "var(--bg-surface)" : "transparent",
      }}
      data-selected={selected}
    >
      <span
        className="text-text-primary"
        style={{ fontSize: 14, fontWeight: 400, lineHeight: 1.3 }}
      >
        {channel.label}
      </span>
      {channel.unread && channel.unread > 0 ? (
        <span
          className="text-text-secondary tabular-nums"
          style={{
            fontSize: 11,
            fontWeight: 500,
            background: "var(--gray-pill)",
            borderRadius: 999,
            padding: "3px 10px",
            lineHeight: 1.2,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {channel.unread}
        </span>
      ) : null}
    </Link>
  );
}
