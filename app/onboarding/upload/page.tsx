import { Suspense } from "react";
import { UploadFlow } from "./UploadFlow";

export const dynamic = "force-dynamic";

export default function UploadOnboardingPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--bg-base)",
        color: "var(--text-primary)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Chrome />
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          padding: "48px 24px 100px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 680 }}>
          <Suspense fallback={null}>
            <UploadFlow />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

function Chrome() {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "20px 40px",
        position: "sticky",
        top: 0,
        background: "var(--bg-base)",
        borderBottom: "1px solid var(--border-subtle)",
        zIndex: 5,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          fontSize: 13,
          color: "var(--text-primary)",
          fontWeight: 500,
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            background: "var(--ink)",
            borderRadius: 2,
            display: "inline-block",
          }}
        />
        Burrow
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
        <span
          style={{
            fontFamily:
              '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 11,
            color: "var(--text-tertiary)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          frame 3.5 — seed your brain
        </span>
        <a
          href="/onboarding"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 12,
            color: "var(--text-secondary)",
            padding: "4px 8px",
            textDecoration: "none",
          }}
        >
          ↺ restart
        </a>
      </span>
    </header>
  );
}
