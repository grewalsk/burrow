import { FitPill } from "./FitPill";

export type Signal = {
  id: string;
  source: "REDDIT" | "HACKER NEWS" | "X";
  handle: string;
  context?: string; // subreddit or anything between handle and time
  timeAgo: string;
  body: string;
  matches?: string;
  fitScore?: number;
  analyzing?: boolean;
};

export function SignalCard({ signal }: { signal: Signal }) {
  return (
    <article className="signal-card">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <MetaRow signal={signal} />
          <p
            className="mt-2 text-text-primary"
            style={{
              fontSize: 15,
              fontWeight: 400,
              lineHeight: 1.55,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {signal.body}
          </p>
          {signal.matches ? (
            <p
              className="mt-2 truncate text-text-secondary"
              style={{ fontSize: 12, fontWeight: 400, lineHeight: 1.3 }}
            >
              <span style={{ color: "var(--text-tertiary)" }}>matches: </span>
              {signal.matches}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center" style={{ minHeight: 24 }}>
          {signal.fitScore !== undefined ? (
            <FitPill score={signal.fitScore} />
          ) : signal.analyzing ? (
            <span
              className="text-text-secondary"
              style={{ fontSize: 12, fontWeight: 400, lineHeight: 1.3 }}
            >
              Analyzing
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function MetaRow({ signal }: { signal: Signal }) {
  return (
    <div className="flex items-center gap-2 text-text-secondary" style={{ fontSize: 12, lineHeight: 1.3 }}>
      <span
        className="text-text-tertiary"
        style={{
          fontFamily: '"JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace',
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {signal.source}
      </span>
      <span className="text-text-primary" style={{ fontWeight: 500 }}>
        {signal.handle}
      </span>
      {signal.context ? (
        <>
          <Sep />
          <span>{signal.context}</span>
        </>
      ) : null}
      <Sep />
      <span>{signal.timeAgo}</span>
    </div>
  );
}

function Sep() {
  return <span style={{ color: "var(--text-tertiary)" }}>·</span>;
}
