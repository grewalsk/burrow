"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Channel = {
  slug: "signals" | "drafts" | "sent" | "briefing" | "ask";
  label: string;
  unread?: number;
};

const CHANNELS: Channel[] = [
  { slug: "signals", label: "#signals", unread: 12 },
  { slug: "drafts", label: "#drafts", unread: 4 },
  { slug: "sent", label: "#sent" },
  { slug: "briefing", label: "#briefing", unread: 1 },
  { slug: "ask", label: "#ask" },
];

export function LeftRail() {
  const pathname = usePathname();
  const live = true; // placeholder for Scout cron status

  return (
    <aside
      className="flex shrink-0 flex-col border-r border-border-subtle bg-bg-base"
      style={{ width: 220 }}
    >
      <nav className="flex flex-col gap-[2px] p-3 pt-4">
        {CHANNELS.map((ch) => {
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
