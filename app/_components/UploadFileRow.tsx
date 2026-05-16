"use client";

import { Check, FileText, X } from "lucide-react";
import { DocTypeSelector } from "./DocTypeSelector";
import type { DocType } from "@/lib/docTypes";

export type UploadStatus = "idle" | "uploading" | "processing" | "done" | "error";

export type UploadFile = {
  id: string;
  file: File;
  docType: DocType | null;
  status: UploadStatus;
  progress: number;
  error?: string;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadFileRow({
  item,
  onChangeDocType,
  onRemove,
  onRetry,
  selectorVariant = "onboarding",
}: {
  item: UploadFile;
  onChangeDocType: (docType: DocType) => void;
  onRemove: () => void;
  onRetry: () => void;
  selectorVariant?: "onboarding" | "full";
}) {
  const isBusy = item.status === "uploading" || item.status === "processing";
  const isDone = item.status === "done";
  const isError = item.status === "error";

  return (
    <li
      role="listitem"
      style={{
        position: "relative",
        height: 44,
        padding: "0 16px",
        borderBottom: "1px solid var(--border-subtle)",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto auto",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <FileText size={16} color="var(--text-tertiary)" />
        <span
          style={{
            fontSize: 14,
            color: "var(--text-primary)",
            maxWidth: 280,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.file.name}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
          {formatSize(item.file.size)}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <DocTypeSelector
          value={item.docType}
          onChange={onChangeDocType}
          variant={selectorVariant}
          disabled={isBusy || isDone}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 90, justifyContent: "flex-end" }}>
        {item.status === "idle" && (
          <button
            onClick={onRemove}
            aria-label={`Remove ${item.file.name}`}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-tertiary)",
              padding: 4,
              borderRadius: 4,
              display: "inline-flex",
            }}
          >
            <X size={16} />
          </button>
        )}
        {item.status === "uploading" && (
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Uploading {Math.round(item.progress)}%
          </span>
        )}
        {item.status === "processing" && (
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Indexing…</span>
        )}
        {isDone && (
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}
          >
            <Check size={16} color="var(--green)" />
            Indexed
          </span>
        )}
        {isError && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span style={{ color: "var(--red)" }}>{item.error ?? "Failed"}</span>
            <button
              onClick={onRetry}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--ink)",
                fontSize: 13,
                padding: 0,
                textDecoration: "underline",
              }}
            >
              retry
            </button>
          </span>
        )}
      </div>

      {item.status === "uploading" && (
        <div
          role="progressbar"
          aria-valuenow={item.progress}
          aria-valuemax={100}
          aria-label={`Uploading ${item.file.name}`}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 1,
            background: "transparent",
          }}
        >
          <div
            style={{
              width: `${item.progress}%`,
              height: 1,
              background: "var(--ink)",
              transition: "width 100ms linear",
            }}
          />
        </div>
      )}
    </li>
  );
}
