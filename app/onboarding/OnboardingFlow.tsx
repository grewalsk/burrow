"use client";

import {
  CSSProperties,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

// ─────────── tokens (mirrors the Burrow design brief) ───────────
const C = {
  bgBase: "#FAFAF8",
  bgSurface: "#F3F2EE",
  bgElevated: "#FFFFFF",
  textPrimary: "#1A1816",
  textSecondary: "#87837B",
  textTertiary: "#B5B1A8",
  borderSubtle: "rgba(26, 24, 22, 0.08)",
  borderDefault: "rgba(26, 24, 22, 0.16)",
  ink: "#16213B",
  green: "#2D7D5F",
  greenBg: "rgba(45, 125, 95, 0.10)",
  amber: "#B08338",
  amberBg: "rgba(176, 131, 56, 0.10)",
  red: "#9C4A3F",
  redBg: "rgba(156, 74, 63, 0.08)",
  grayPill: "rgba(26, 24, 22, 0.06)",
  researcher: "#7A8593",
  font: "Inter, system-ui, sans-serif",
  mono: '"JetBrains Mono", ui-monospace, monospace',
};

type Phase = "landing" | "researching" | "form";

// ─────────── shared atoms ───────────
function Chrome({ phase, onReset }: { phase: Phase; onReset: () => void }) {
  const labels: Record<Phase, string> = {
    landing: "frame 1 — start",
    researching: "frame 2 — researcher running",
    form: "frame 3 — confirm",
  };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "20px 40px",
        position: "sticky",
        top: 0,
        background: C.bgBase,
        zIndex: 5,
        borderBottom: phase === "landing" ? "none" : `1px solid ${C.borderSubtle}`,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          fontSize: 13,
          color: C.textPrimary,
          fontWeight: 500,
        }}
      >
        <span style={{ width: 9, height: 9, background: C.ink, borderRadius: 2 }} />
        Burrow
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
        <span
          style={{
            fontFamily: C.mono,
            fontSize: 11,
            color: C.textTertiary,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {labels[phase]}
        </span>
        <button
          onClick={onReset}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontFamily: C.font,
            fontSize: 12,
            color: C.textSecondary,
            padding: "4px 8px",
          }}
        >
          ↺ restart
        </button>
      </span>
    </div>
  );
}

function Eyebrow({
  children,
  color = C.textTertiary,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.10em",
        textTransform: "uppercase",
        color,
        lineHeight: 1.3,
      }}
    >
      {children}
    </div>
  );
}

function AgentMonogram({
  letter,
  color,
  size = 22,
}: {
  letter: string;
  color: string;
  size?: number;
}) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 5,
        background: color,
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: C.font,
        fontWeight: 500,
        fontSize: size * 0.5,
        letterSpacing: 0,
      }}
    >
      {letter}
    </span>
  );
}

function PrimaryBtn({
  children,
  onClick,
  disabled,
  style,
  type,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
  type?: "button" | "submit";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      type={type ?? "button"}
      style={{
        fontFamily: C.font,
        fontSize: 14,
        fontWeight: 500,
        padding: "12px 22px",
        borderRadius: 6,
        lineHeight: 1,
        background: disabled ? C.bgSurface : C.ink,
        color: disabled ? C.textTertiary : "#fff",
        border: "none",
        cursor: disabled ? "default" : "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function GhostBtn({
  children,
  onClick,
  style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: C.font,
        fontSize: 14,
        fontWeight: 500,
        padding: "11px 20px",
        borderRadius: 6,
        lineHeight: 1,
        background: "transparent",
        color: C.textPrimary,
        border: `1px solid ${C.borderDefault}`,
        cursor: "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// =============================================================
// FRAME 1 — Landing
// =============================================================
function Landing({
  url,
  setUrl,
  onSubmit,
}: {
  url: string;
  setUrl: (v: string) => void;
  onSubmit: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (e?: FormEvent | KeyboardEvent) => {
    e?.preventDefault?.();
    if (url.trim()) onSubmit();
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 48px 100px",
      }}
    >
      <div style={{ width: 680, display: "flex", flexDirection: "column", gap: 26 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["#6C9690", "#8576A4", "#B47D75", "#B7976A", "#8A8884"].map((c, i) => (
            <span key={i} style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
          ))}
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: 76,
            fontWeight: 500,
            letterSpacing: "-0.03em",
            lineHeight: 0.98,
            color: C.textPrimary,
          }}
        >
          Burrow
        </h1>

        <p
          style={{
            margin: 0,
            fontSize: 22,
            color: C.textSecondary,
            lineHeight: 1.45,
            maxWidth: 560,
            fontWeight: 400,
          }}
        >
          Tell us your company. The Researcher reads your site and builds a brain. You confirm what it learned.
        </p>

        <form
          onSubmit={submit}
          style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: 68,
              border: `1px solid ${C.borderDefault}`,
              borderRadius: 8,
              background: C.bgElevated,
              padding: "0 6px 0 22px",
              gap: 14,
            }}
          >
            <span style={{ fontFamily: C.mono, fontSize: 14, color: C.textTertiary }}>https://</span>
            <input
              ref={inputRef}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit(e);
              }}
              placeholder="your-company.com"
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                fontFamily: C.mono,
                fontSize: 19,
                color: C.textPrimary,
                background: "transparent",
              }}
            />
            <PrimaryBtn type="submit" style={{ height: 52, padding: "0 24px" }}>
              Submit →
            </PrimaryBtn>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 12,
              color: C.textTertiary,
              padding: "0 4px",
            }}
          >
            <span>One crawl. About thirty seconds.</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <AgentMonogram letter="R" color={C.researcher} size={16} />
              Researcher will visit pages publicly
            </span>
          </div>
        </form>

        <div
          style={{
            marginTop: 56,
            paddingTop: 28,
            borderTop: `1px solid ${C.borderSubtle}`,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 28,
          }}
        >
          <Step n="01" t="Read the site" s="Discover every linked page, pick the ones with real signal." />
          <Step n="02" t="Confirm what we learned" s="One form, pre-filled. Edit anything that's off." />
          <Step n="03" t="Burrow goes live" s="Drafts and briefings start arriving in the channels." />
        </div>
      </div>
    </div>
  );
}

function Step({ n, t, s }: { n: string; t: string; s: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontFamily: C.mono, fontSize: 11, color: C.textTertiary, letterSpacing: "0.06em" }}>{n}</span>
      <span style={{ fontSize: 15, fontWeight: 500, color: C.textPrimary, lineHeight: 1.35 }}>{t}</span>
      <span style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.55 }}>{s}</span>
    </div>
  );
}

// =============================================================
// FRAME 2 — Researcher (cr_agent)
// =============================================================

const DISCOVERED = [
  "/",
  "/about",
  "/about/team",
  "/about/careers",
  "/pricing",
  "/pricing/enterprise",
  "/features",
  "/features/retrieval",
  "/features/scoring",
  "/features/indexing",
  "/customers",
  "/customers/initech",
  "/customers/acme",
  "/customers/piedpiper",
  "/blog",
  "/blog/announcing",
  "/blog/migration",
  "/docs",
  "/docs/api",
  "/privacy",
  "/terms",
  "/contact",
];

type Pick = { keep: boolean; why: string };

const PICKS: Record<string, Pick> = {
  "/": { keep: true, why: "tagline + hero" },
  "/about": { keep: true, why: "mission, what you sell" },
  "/about/team": { keep: false, why: "staff bios, low signal" },
  "/about/careers": { keep: false, why: "jobs, not product" },
  "/pricing": { keep: true, why: "plans + price points" },
  "/pricing/enterprise": { keep: true, why: "enterprise tier detail" },
  "/features": { keep: true, why: "capability list" },
  "/features/retrieval": { keep: false, why: "subset, covered by /features" },
  "/features/scoring": { keep: false, why: "subset, covered by /features" },
  "/features/indexing": { keep: false, why: "subset, covered by /features" },
  "/customers": { keep: true, why: "logos, case study index" },
  "/customers/initech": { keep: true, why: "success story" },
  "/customers/acme": { keep: true, why: "success story" },
  "/customers/piedpiper": { keep: true, why: "success story" },
  "/blog": { keep: false, why: "noisy, not authoritative" },
  "/blog/announcing": { keep: false, why: "launch post, dated" },
  "/blog/migration": { keep: false, why: "tutorial, low signal" },
  "/docs": { keep: false, why: "developer reference" },
  "/docs/api": { keep: false, why: "developer reference" },
  "/privacy": { keep: false, why: "legal boilerplate" },
  "/terms": { keep: false, why: "legal boilerplate" },
  "/contact": { keep: false, why: "form, no extractable data" },
};

const SELECTED = DISCOVERED.filter((p) => PICKS[p]?.keep);

const FACTS: Record<string, string[]> = {
  "/": ['Tagline: "Managed retrieval for serious teams."', 'Primary CTA: "Start a brain"'],
  "/about": ["Founded 2023, NYC + remote", "ICP: teams of 10–200 with > 50M vectors"],
  "/pricing": [
    "Free — up to 1M vectors",
    "Team — $499/mo, up to 50M vectors",
    "Enterprise — custom",
  ],
  "/pricing/enterprise": ["SLA, SOC2, dedicated cluster", "> 200M vectors, contract pricing"],
  "/features": [
    "Managed retrieval",
    "Auto-scoring of incoming signals",
    "Continuous re-indexing",
    "Eval dashboards",
  ],
  "/customers": ["14 logos shown", "Categories: dev tools, fintech, RAG apps"],
  "/customers/initech": ["200M vectors, 14-person team", "Migration from Pinecone, 6-week ramp"],
  "/customers/acme": ["80M vectors, fintech use case", "Cited 40% cost reduction"],
  "/customers/piedpiper": ["Compression-focused use case", '"Replaced our internal cluster"'],
};

type Sub = "discover" | "select" | "read" | "done";
type ReadStatus = "queued" | "reading" | "done";

function Researching({
  url,
  researchReady,
  researchMeta,
  onDone,
}: {
  url: string;
  researchReady: boolean;
  researchMeta: { pages_crawled: number; pages_read: number; source: "gemini" | "fallback" } | null;
  onDone: () => void;
}) {
  const [sub, setSub] = useState<Sub>("discover");
  const [discoveredCount, setDiscoveredCount] = useState(0);
  const [selectIdx, setSelectIdx] = useState(0);
  const [readingMap, setReadingMap] = useState<Record<string, ReadStatus>>({});

  useEffect(() => {
    if (sub !== "discover") return;
    if (discoveredCount >= DISCOVERED.length) {
      const t = setTimeout(() => setSub("select"), 600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setDiscoveredCount((n) => n + 1), 50);
    return () => clearTimeout(t);
  }, [sub, discoveredCount]);

  useEffect(() => {
    if (sub !== "select") return;
    if (selectIdx >= DISCOVERED.length) {
      const t = setTimeout(() => {
        const m: Record<string, ReadStatus> = {};
        SELECTED.forEach((p) => {
          m[p] = "queued";
        });
        setReadingMap(m);
        setSub("read");
      }, 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setSelectIdx((n) => n + 1), 90);
    return () => clearTimeout(t);
  }, [sub, selectIdx]);

  useEffect(() => {
    if (sub !== "read") return;
    const order = SELECTED;
    const nextQueued = order.find((p) => readingMap[p] === "queued");
    const reading = order.find((p) => readingMap[p] === "reading");
    if (!nextQueued && !reading) {
      const t = setTimeout(() => setSub("done"), 400);
      return () => clearTimeout(t);
    }
    if (!reading && nextQueued) {
      const t = setTimeout(() => {
        setReadingMap((m) => ({ ...m, [nextQueued]: "reading" }));
      }, 60);
      return () => clearTimeout(t);
    }
    if (reading) {
      const t = setTimeout(() => {
        setReadingMap((m) => ({ ...m, [reading]: "done" }));
      }, 360);
      return () => clearTimeout(t);
    }
  }, [sub, readingMap]);

  const skip = () => {
    setDiscoveredCount(DISCOVERED.length);
    setSelectIdx(DISCOVERED.length);
    const m: Record<string, ReadStatus> = {};
    SELECTED.forEach((p) => {
      m[p] = "done";
    });
    setReadingMap(m);
    setSub("done");
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: "40px 48px 60px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          maxWidth: 880,
          width: "100%",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 28,
          flex: 1,
          minHeight: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Eyebrow>Researcher reading</Eyebrow>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <AgentMonogram letter="R" color={C.researcher} size={28} />
              <span style={{ fontFamily: C.mono, fontSize: 28, fontWeight: 500, color: C.textPrimary }}>
                {url}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {sub !== "done" && (
              <button
                onClick={skip}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: C.font,
                  fontSize: 13,
                  color: C.textSecondary,
                  textDecoration: "underline",
                  textDecorationColor: C.borderDefault,
                  textUnderlineOffset: 3,
                }}
              >
                Skip animation →
              </button>
            )}
            <PhaseStatusPill sub={sub} />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 18,
            flex: 1,
            minHeight: 0,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 18, minHeight: 0 }}>
            <PhaseCard
              n="01"
              title="Discover pages"
              status={sub === "discover" ? "active" : "done"}
              meta={`${discoveredCount} found`}
            >
              <ScrollList>
                {DISCOVERED.slice(0, discoveredCount).map((p) => (
                  <LogLine key={p}>
                    <span style={{ color: C.textTertiary }}>GET</span> {url}
                    {p}
                  </LogLine>
                ))}
              </ScrollList>
            </PhaseCard>

            <PhaseCard
              n="02"
              title="Select what matters"
              status={sub === "select" ? "active" : sub === "discover" ? "pending" : "done"}
              meta={
                sub === "discover"
                  ? "queued"
                  : `${SELECTED.length} kept · ${DISCOVERED.length - SELECTED.length} dropped`
              }
            >
              {sub === "discover" ? (
                <Pending label="awaiting discovery" />
              ) : (
                <ScrollList>
                  {DISCOVERED.slice(0, selectIdx).map((p) => (
                    <SelectLine key={p} path={p} pick={PICKS[p]} />
                  ))}
                </ScrollList>
              )}
            </PhaseCard>
          </div>

          <PhaseCard
            n="03"
            title="Read and extract"
            status={sub === "read" ? "active" : sub === "done" ? "done" : "pending"}
            meta={
              sub === "done"
                ? `${SELECTED.length} pages · ${Object.values(FACTS).flat().length} facts`
                : sub === "read"
                ? `${Object.values(readingMap).filter((v) => v === "done").length} of ${SELECTED.length}`
                : "queued"
            }
          >
            {sub === "discover" || sub === "select" ? (
              <Pending label="awaiting page selection" />
            ) : (
              <ScrollList>
                {SELECTED.map((p) => (
                  <ReadLine
                    key={p}
                    url={url}
                    path={p}
                    status={readingMap[p] ?? "queued"}
                    facts={FACTS[p] ?? []}
                  />
                ))}
              </ScrollList>
            )}
          </PhaseCard>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 16,
            borderTop: `1px solid ${C.borderSubtle}`,
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: C.textTertiary,
              fontFamily: C.mono,
              letterSpacing: "0.04em",
            }}
          >
            {sub === "done"
              ? researchReady && researchMeta
                ? `researcher idle · ${researchMeta.pages_read}/${researchMeta.pages_crawled} pages read · ${researchMeta.source === "gemini" ? "extracted" : "extraction skipped"}`
                : researchReady
                ? "researcher idle · 21 pages crawled · brain seeded"
                : "extracting facts…"
              : "researcher running…"}
          </span>
          <PrimaryBtn onClick={onDone} disabled={sub !== "done" || !researchReady}>
            Continue to confirm →
          </PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

function PhaseStatusPill({ sub }: { sub: Sub }) {
  const map: Record<Sub, { label: string; color: string; bg: string }> = {
    discover: { label: "discovering", color: C.ink, bg: C.bgSurface },
    select: { label: "selecting", color: C.ink, bg: C.bgSurface },
    read: { label: "reading", color: C.ink, bg: C.bgSurface },
    done: { label: "ready", color: C.green, bg: C.greenBg },
  };
  const m = map[sub];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderRadius: 999,
        background: m.bg,
        color: m.color,
        fontFamily: C.mono,
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: m.color,
          animation: sub === "done" ? "none" : "burrowPulse 1.4s ease-in-out infinite",
        }}
      />
      {m.label}
      <style>{`
        @keyframes burrowPulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.35; }
        }
      `}</style>
    </span>
  );
}

function PhaseCard({
  n,
  title,
  status,
  meta,
  children,
}: {
  n: string;
  title: string;
  status: "active" | "done" | "pending";
  meta?: string;
  children: React.ReactNode;
}) {
  const isActive = status === "active";
  const isDone = status === "done";
  const isPending = status === "pending";
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        border: `1px solid ${isActive ? C.borderDefault : C.borderSubtle}`,
        background: isPending ? "transparent" : C.bgElevated,
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        opacity: isPending ? 0.6 : 1,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 18px",
          borderBottom: `1px solid ${C.borderSubtle}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              fontFamily: C.mono,
              fontSize: 11,
              color: C.textTertiary,
              letterSpacing: "0.06em",
            }}
          >
            {n}
          </span>
          <span style={{ fontSize: 15, fontWeight: 500, color: C.textPrimary }}>{title}</span>
          {isActive && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "2px 8px",
                borderRadius: 999,
                background: C.bgSurface,
                color: C.textSecondary,
                fontFamily: C.mono,
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: "0.04em",
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.ink }} />
              running
            </span>
          )}
          {isDone && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "2px 8px",
                borderRadius: 999,
                background: C.greenBg,
                color: C.green,
                fontFamily: C.mono,
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: "0.04em",
              }}
            >
              ✓ done
            </span>
          )}
        </span>
        {meta && (
          <span style={{ fontFamily: C.mono, fontSize: 11, color: C.textTertiary }}>{meta}</span>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", position: "relative" }}>
        {children}
      </div>
    </div>
  );
}

function ScrollList({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  });
  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        inset: 0,
        overflowY: "auto",
        padding: "12px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      {children}
    </div>
  );
}

function LogLine({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: C.mono, fontSize: 12, color: C.textPrimary, lineHeight: 1.6 }}>
      {children}
    </div>
  );
}

function Pending({ label }: { label: string }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: C.textTertiary,
        fontSize: 12,
        fontFamily: C.mono,
        letterSpacing: "0.04em",
      }}
    >
      {label}
    </div>
  );
}

function SelectLine({ path, pick }: { path: string; pick?: Pick }) {
  const keep = pick?.keep;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "14px 1fr auto",
        gap: 10,
        alignItems: "center",
        padding: "3px 0",
        fontFamily: C.mono,
        fontSize: 12,
        color: keep ? C.textPrimary : C.textTertiary,
      }}
    >
      <span style={{ color: keep ? C.green : C.textTertiary }}>{keep ? "✓" : "×"}</span>
      <span
        style={{
          textDecoration: keep ? "none" : "line-through",
          textDecorationColor: C.borderDefault,
        }}
      >
        {path}
      </span>
      <span style={{ color: keep ? C.textSecondary : C.textTertiary, fontSize: 11 }}>
        {pick?.why}
      </span>
    </div>
  );
}

function ReadLine({
  url,
  path,
  status,
  facts,
}: {
  url: string;
  path: string;
  status: ReadStatus;
  facts: string[];
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "8px 0",
        borderTop: `1px solid ${C.borderSubtle}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: C.mono, fontSize: 12, color: C.textPrimary }}>
          {url}
          <span style={{ color: C.textSecondary }}>{path}</span>
        </span>
        <StatusBadge status={status} />
      </div>
      {status === "done" && (
        <ul
          style={{
            margin: 0,
            padding: "2px 0 4px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {facts.map((f, i) => (
            <li
              key={i}
              style={{
                fontSize: 12,
                color: C.textSecondary,
                lineHeight: 1.5,
                listStyle: "square",
              }}
            >
              {f}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ReadStatus }) {
  const map: Record<ReadStatus, { label: string; color: string; bg: string }> = {
    queued: { label: "queued", color: C.textTertiary, bg: "transparent" },
    reading: { label: "reading", color: C.ink, bg: C.bgSurface },
    done: { label: "done", color: C.green, bg: C.greenBg },
  };
  const m = map[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 8px",
        borderRadius: 999,
        background: m.bg,
        color: m.color,
        fontFamily: C.mono,
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: "0.04em",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: m.color,
          animation: status === "reading" ? "burrowPulse 1.2s ease-in-out infinite" : "none",
        }}
      />
      {m.label}
    </span>
  );
}

// =============================================================
// FRAME 3 — Form (pre-filled from research, editable)
// =============================================================
type PriceTier = { name: string; price: string; note: string };
type Story = { name: string; detail: string; src: string };
type Doc = {
  one_liner: string;
  description: string;
  icp: string;
  pricing: PriceTier[];
  features: string[];
  competitors: string[];
  stories: Story[];
};

const FALLBACK_DOC: Doc = {
  one_liner: "Managed retrieval for serious teams.",
  description:
    "Initech offers managed retrieval infrastructure for teams that have outgrown single-tenant vector DBs. We handle indexing, scoring, and re-indexing — you keep your data, we keep the cluster running.",
  icp: "Engineering teams of 10–200 with > 50M vectors. Currently on Pinecone, Weaviate, or self-hosted Qdrant. Pain: cluster ops eating engineering time.",
  pricing: [
    { name: "Free", price: "$0", note: "up to 1M vectors" },
    { name: "Team", price: "$499 / mo", note: "up to 50M vectors, shared cluster" },
    { name: "Enterprise", price: "custom", note: "SLA, SOC2, dedicated cluster, > 200M" },
  ],
  features: [
    "Managed retrieval",
    "Auto-scoring of incoming signals",
    "Continuous re-indexing",
    "Eval dashboards",
  ],
  competitors: ["Pinecone", "Weaviate", "Qdrant Cloud", "Turbopuffer"],
  stories: [
    {
      name: "Initech",
      detail: "200M vectors, 14-person team. Migration from Pinecone, 6-week ramp.",
      src: "/customers/initech",
    },
    { name: "Acme", detail: "80M vectors, fintech. Cited 40% cost reduction.", src: "/customers/acme" },
    {
      name: "Pied Piper",
      detail: 'Compression-focused use case. "Replaced our internal cluster."',
      src: "/customers/piedpiper",
    },
  ],
};

function ConfirmForm({
  url,
  initialDoc,
  onSubmit,
}: {
  url: string;
  initialDoc: Doc | null;
  onSubmit: (doc: Doc) => void;
}) {
  const [doc, setDoc] = useState<Doc>(initialDoc ?? FALLBACK_DOC);

  const setField = <K extends keyof Doc>(k: K, v: Doc[K]) =>
    setDoc((d) => ({ ...d, [k]: v }));

  const setPriceItem = (i: number, v: PriceTier) =>
    setDoc((d) => ({ ...d, pricing: d.pricing.map((x, j) => (j === i ? v : x)) }));
  const removePriceItem = (i: number) =>
    setDoc((d) => ({ ...d, pricing: d.pricing.filter((_, j) => j !== i) }));

  const setStoryItem = (i: number, v: Story) =>
    setDoc((d) => ({ ...d, stories: d.stories.map((x, j) => (j === i ? v : x)) }));
  const removeStoryItem = (i: number) =>
    setDoc((d) => ({ ...d, stories: d.stories.filter((_, j) => j !== i) }));

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "40px 48px 100px" }}>
      <div
        style={{
          maxWidth: 820,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 32,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Eyebrow>Confirm what we learned</Eyebrow>
          <h1
            style={{
              margin: 0,
              fontSize: 48,
              fontWeight: 500,
              letterSpacing: "-0.025em",
              lineHeight: 1.05,
            }}
          >
            This is what Burrow knows about you.
          </h1>
          <p style={{ margin: 0, fontSize: 17, color: C.textSecondary, lineHeight: 1.55, maxWidth: 660 }}>
            Researcher pulled these facts from{" "}
            <span style={{ fontFamily: C.mono, color: C.textPrimary }}>{url}</span>. Edit anything that's off.
            When you submit, this becomes the seed for the brain — won-deal patterns, ICP, voice.
          </p>
        </div>

        <Section title="What you do" source="/about + homepage">
          <Field label="One-liner">
            <BurrowInput value={doc.one_liner} onChange={(v) => setField("one_liner", v)} />
          </Field>
          <Field label="Longer description">
            <BurrowTextarea
              value={doc.description}
              onChange={(v) => setField("description", v)}
              rows={3}
            />
          </Field>
        </Section>

        <Section title="Who you sell to" source="/about, inferred from /customers">
          <Field label="ICP — ideal customer profile">
            <BurrowTextarea value={doc.icp} onChange={(v) => setField("icp", v)} rows={3} />
          </Field>
        </Section>

        <Section title="Pricing" source="/pricing + /pricing/enterprise">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {doc.pricing.map((tier, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1.6fr 24px",
                  gap: 10,
                  alignItems: "center",
                  padding: "10px 0",
                  borderTop: i === 0 ? "none" : `1px solid ${C.borderSubtle}`,
                }}
              >
                <BurrowInput
                  value={tier.name}
                  small
                  onChange={(v) => setPriceItem(i, { ...tier, name: v })}
                />
                <BurrowInput
                  value={tier.price}
                  small
                  mono
                  onChange={(v) => setPriceItem(i, { ...tier, price: v })}
                />
                <BurrowInput
                  value={tier.note}
                  small
                  onChange={(v) => setPriceItem(i, { ...tier, note: v })}
                />
                <RemoveBtn onClick={() => removePriceItem(i)} />
              </div>
            ))}
            <AddInlineBtn
              onClick={() =>
                setField("pricing", [...doc.pricing, { name: "", price: "", note: "" }])
              }
            >
              + Add tier
            </AddInlineBtn>
          </div>
        </Section>

        <Section title="Key features" source="/features">
          <ChipEditor
            items={doc.features}
            onChange={(items) => setField("features", items)}
            placeholder="add a feature"
          />
        </Section>

        <Section title="Success stories" source="/customers">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {doc.stories.map((s, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 2fr auto 24px",
                  gap: 10,
                  alignItems: "center",
                  padding: "10px 0",
                  borderTop: i === 0 ? "none" : `1px solid ${C.borderSubtle}`,
                }}
              >
                <BurrowInput
                  value={s.name}
                  small
                  onChange={(v) => setStoryItem(i, { ...s, name: v })}
                />
                <BurrowInput
                  value={s.detail}
                  small
                  onChange={(v) => setStoryItem(i, { ...s, detail: v })}
                />
                <span
                  style={{
                    fontFamily: C.mono,
                    fontSize: 11,
                    color: C.textTertiary,
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.src}
                </span>
                <RemoveBtn onClick={() => removeStoryItem(i)} />
              </div>
            ))}
            <AddInlineBtn
              onClick={() =>
                setField("stories", [...doc.stories, { name: "", detail: "", src: "" }])
              }
            >
              + Add story
            </AddInlineBtn>
          </div>
        </Section>

        <Section title="Competitors" source="inferred from /pricing + /features comparisons">
          <ChipEditor
            items={doc.competitors}
            onChange={(items) => setField("competitors", items)}
            placeholder="add a competitor"
          />
        </Section>

        <div
          style={{
            marginTop: 8,
            paddingTop: 24,
            borderTop: `1px solid ${C.borderSubtle}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 12, color: C.textTertiary }}>
            You can edit any of this later from #settings. Submitting seeds the brain.
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <GhostBtn>Save as draft</GhostBtn>
            <PrimaryBtn onClick={() => onSubmit(doc)}>Send to brain →</PrimaryBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  source,
  children,
}: {
  title: string;
  source: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          paddingBottom: 10,
          borderBottom: `1px solid ${C.borderSubtle}`,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em" }}>{title}</h2>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: C.mono,
            fontSize: 11,
            color: C.researcher,
            letterSpacing: "0.04em",
          }}
        >
          <AgentMonogram letter="R" color={C.researcher} size={14} />
          extracted from <span style={{ color: C.textSecondary }}>{source}</span>
        </span>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary }}>{label}</span>
      {children}
    </div>
  );
}

function BurrowInput({
  value,
  onChange,
  small,
  mono,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  small?: boolean;
  mono?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        boxSizing: "border-box",
        padding: small ? "8px 12px" : "12px 14px",
        border: `1px solid ${C.borderSubtle}`,
        borderRadius: 6,
        background: C.bgElevated,
        outline: "none",
        fontFamily: mono ? C.mono : C.font,
        fontSize: small ? 13 : 15,
        color: C.textPrimary,
        lineHeight: 1.4,
      }}
    />
  );
}

function BurrowTextarea({
  value,
  onChange,
  rows = 2,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        boxSizing: "border-box",
        padding: "12px 14px",
        border: `1px solid ${C.borderSubtle}`,
        borderRadius: 6,
        background: C.bgElevated,
        outline: "none",
        fontFamily: C.font,
        fontSize: 15,
        color: C.textPrimary,
        lineHeight: 1.55,
        resize: "vertical",
      }}
    />
  );
}

function ChipEditor({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft("");
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      {items.map((it, i) => (
        <span
          key={i}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            borderRadius: 4,
            background: C.bgSurface,
            color: C.textPrimary,
            fontFamily: C.font,
            fontSize: 13,
          }}
        >
          {it}
          <button
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: C.textTertiary,
              fontSize: 12,
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        placeholder={placeholder}
        style={{
          flex: 1,
          minWidth: 140,
          padding: "6px 10px",
          border: `1px dashed ${C.borderDefault}`,
          borderRadius: 4,
          background: "transparent",
          outline: "none",
          fontFamily: C.font,
          fontSize: 13,
          color: C.textPrimary,
        }}
      />
    </div>
  );
}

function AddInlineBtn({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        alignSelf: "flex-start",
        marginTop: 4,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontFamily: C.font,
        fontSize: 13,
        color: C.textSecondary,
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

function RemoveBtn({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 24,
        height: 24,
        borderRadius: 4,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        color: C.textTertiary,
        fontFamily: C.font,
        fontSize: 14,
        padding: 0,
      }}
    >
      ×
    </button>
  );
}

// =============================================================
// APP
// =============================================================
export function OnboardingFlow() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("landing");
  const [url, setUrl] = useState("initech.dev");
  const [researchDoc, setResearchDoc] = useState<Doc | null>(null);
  const [researchReady, setResearchReady] = useState(false);
  const [researchMeta, setResearchMeta] = useState<{
    pages_crawled: number;
    pages_read: number;
    source: "gemini" | "fallback";
  } | null>(null);

  const reset = () => {
    setPhase("landing");
    setResearchDoc(null);
    setResearchReady(false);
    setResearchMeta(null);
  };

  const startResearch = (rawUrl: string) => {
    setResearchReady(false);
    setResearchDoc(null);
    setResearchMeta(null);
    fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: rawUrl }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.doc) {
          setResearchDoc(data.doc as Doc);
          setResearchMeta({
            pages_crawled: data.pages_crawled ?? 0,
            pages_read: data.pages_read ?? 0,
            source: data.source ?? "fallback",
          });
        }
      })
      .catch(() => {
        // network/server error — ConfirmForm will use its hardcoded defaults
      })
      .finally(() => {
        setResearchReady(true);
      });
  };

  const handleLandingSubmit = () => {
    startResearch(url);
    setPhase("researching");
  };

  const ensureSessionCookie = () => {
    if (typeof document === "undefined") return;
    const has = document.cookie
      .split(";")
      .some((c) => c.trim().startsWith("burrow_session="));
    if (has) return;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    document.cookie = `burrow_session=${id}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  };

  const finish = (doc: Doc) => {
    ensureSessionCookie();
    const payload = {
      url,
      one_liner: doc.one_liner,
      description: doc.description,
      icp: doc.icp,
      pricing: doc.pricing
        .map((p) => `${p.name} — ${p.price} (${p.note})`)
        .join("; "),
      features: doc.features,
      competitors: doc.competitors,
      stories: doc.stories.map((s) => ({
        name: s.name,
        description: s.detail,
        source: s.src,
      })),
    };
    // Fire-and-forget — auto-ingest failure must not block navigation.
    void fetch("/api/onboarding/brain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    }).catch(() => {
      // swallow — user proceeds to upload regardless
    });
    router.push("/onboarding/upload");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bgBase,
        fontFamily: C.font,
        color: C.textPrimary,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Chrome phase={phase} onReset={reset} />
      {phase === "landing" && (
        <Landing url={url} setUrl={setUrl} onSubmit={handleLandingSubmit} />
      )}
      {phase === "researching" && (
        <Researching
          url={url}
          researchReady={researchReady}
          researchMeta={researchMeta}
          onDone={() => setPhase("form")}
        />
      )}
      {phase === "form" && (
        <ConfirmForm url={url} initialDoc={researchDoc} onSubmit={finish} />
      )}
    </div>
  );
}
