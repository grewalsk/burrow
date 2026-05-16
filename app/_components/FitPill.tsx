type Tone = "green" | "amber" | "gray";

function toneFor(score: number): Tone {
  if (score >= 0.8) return "green";
  if (score >= 0.6) return "amber";
  return "gray";
}

const TONE_STYLES: Record<Tone, { background: string; color: string }> = {
  green: { background: "var(--green-bg)", color: "var(--green)" },
  amber: { background: "var(--amber-bg)", color: "var(--amber)" },
  gray: { background: "var(--gray-pill)", color: "var(--text-secondary)" },
};

export function FitPill({ score }: { score: number }) {
  const tone = toneFor(score);
  const styles = TONE_STYLES[tone];
  return (
    <span
      className="inline-flex items-center"
      style={{
        height: 24,
        minWidth: 64,
        gap: 6,
        padding: "0 10px",
        borderRadius: 999,
        background: styles.background,
        color: styles.color,
        fontFamily: '"JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace',
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: "currentColor",
          flexShrink: 0,
        }}
      />
      {score.toFixed(2)}
    </span>
  );
}
