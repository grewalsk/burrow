"use client";

import { Check } from "lucide-react";
import { DOC_TYPE_LABELS, MVC_DOC_TYPES, type DocType } from "@/lib/docTypes";

export type PillState = "empty" | "queued" | "indexed";

export function MinimalCorpusTracker({ state }: { state: Record<DocType, PillState> }) {
  return (
    <section
      aria-label="Coverage"
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.10em",
          color: "var(--text-secondary)",
        }}
      >
        Coverage
      </span>
      <div role="list" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {MVC_DOC_TYPES.map((dt) => (
          <Pill key={dt} docType={dt} state={state[dt] ?? "empty"} />
        ))}
      </div>
    </section>
  );
}

function Pill({ docType, state }: { docType: DocType; state: PillState }) {
  const label = DOC_TYPE_LABELS[docType];
  const status =
    state === "indexed" ? "indexed" : state === "queued" ? "uploading" : "not yet uploaded";
  const styles = pillStyle(state);
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={`${label}: ${status}`}
      style={{
        height: 24,
        minWidth: 80,
        maxWidth: 160,
        padding: "0 12px",
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        fontWeight: 400,
        ...styles,
        transition: "background-color 100ms ease, color 100ms ease, border-color 100ms ease",
      }}
    >
      {state === "indexed" && <Check size={14} />}
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </span>
  );
}

function pillStyle(state: PillState) {
  if (state === "indexed") {
    return {
      background: "var(--green-bg)",
      color: "var(--green)",
      border: "1px solid transparent",
    };
  }
  if (state === "queued") {
    return {
      background: "var(--gray-pill)",
      color: "var(--text-secondary)",
      border: "1px solid var(--border-default)",
    };
  }
  return {
    background: "var(--gray-pill)",
    color: "var(--text-secondary)",
    border: "1px solid transparent",
  };
}
