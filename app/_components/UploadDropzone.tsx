"use client";

import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";

const ACCEPT = ".pdf,.docx,.doc,.md,.txt,.csv";

export function UploadDropzone({
  onFiles,
  disabled,
  disabledLabel = "Upload limit reached",
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  disabledLabel?: string;
}) {
  const [dragActive, setDragActive] = useState(false);
  const [rejected, setRejected] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const flashReject = () => {
    setRejected(true);
    window.setTimeout(() => setRejected(false), 200);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) {
      flashReject();
      return;
    }
    onFiles(files);
  };

  const onPick = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPick();
    }
  };

  const borderStyle = rejected
    ? "1px solid var(--red)"
    : dragActive
      ? "1px solid var(--border-default)"
      : "1px dashed var(--border-default)";

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Upload files. Drag and drop or press Enter to browse."
      aria-describedby="dropzone-hint"
      aria-disabled={disabled}
      onClick={onPick}
      onKeyDown={onKeyDown}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={onDrop}
      style={{
        height: 160,
        padding: "24px",
        border: borderStyle,
        borderRadius: 6,
        background: dragActive ? "var(--bg-surface)" : "transparent",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? "none" : "auto",
        transition: "background-color 100ms ease, border-style 100ms ease, border-color 100ms ease",
        outline: "none",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        style={{ display: "none" }}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) onFiles(files);
          e.target.value = "";
        }}
      />
      <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
        {disabled ? disabledLabel : "Drag files here or click to browse"}
      </span>
      <span id="dropzone-hint" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        PDF, DOCX, MD, TXT, CSV · max 10 MB each
      </span>
    </div>
  );
}
