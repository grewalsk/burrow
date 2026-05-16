"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UploadDropzone } from "@/app/_components/UploadDropzone";
import { UploadFileList } from "@/app/_components/UploadFileList";
import { MinimalCorpusTracker, type PillState } from "@/app/_components/MinimalCorpusTracker";
import type { UploadFile } from "@/app/_components/UploadFileRow";
import {
  DOC_TYPE_LABELS,
  MVC_DOC_TYPES,
  isDocType,
  type DocType,
} from "@/lib/docTypes";

const ACCEPTED_EXTS = new Set(["pdf", "docx", "doc", "md", "txt", "csv"]);
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_BATCH_BYTES = 50 * 1024 * 1024;
const MAX_BATCH_FILES = 20;
const CONCURRENT_UPLOADS = 3;

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function getExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

function ensureSessionCookie(): void {
  if (typeof document === "undefined") return;
  const has = document.cookie.split(";").some((c) => c.trim().startsWith("burrow_session="));
  if (has) return;
  const id = uuid();
  const maxAge = 60 * 60 * 24 * 30;
  document.cookie = `burrow_session=${id}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

type UploadResponse =
  | { status: "done"; docType?: DocType | null }
  | { status: "timeout"; docType?: DocType | null }
  | { status: "error"; message?: string };

function uploadOne(
  file: UploadFile,
  onProgress: (pct: number) => void,
): Promise<UploadResponse> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
    };
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText) as UploadResponse;
        if (xhr.status === 504) {
          resolve({ status: "timeout" });
          return;
        }
        resolve(body);
      } catch {
        if (xhr.status === 504) resolve({ status: "timeout" });
        else resolve({ status: "error", message: `HTTP ${xhr.status}` });
      }
    };
    xhr.onerror = () => resolve({ status: "error", message: "Network error" });
    xhr.ontimeout = () => resolve({ status: "timeout" });
    const form = new FormData();
    form.append("file", file.file, file.file.name);
    if (file.docType) form.append("doc_type", file.docType);
    xhr.send(form);
  });
}

export function UploadFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const contextDashboard = params.get("context") === "dashboard";

  const [files, setFiles] = useState<UploadFile[]>([]);
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const rejectTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    ensureSessionCookie();
  }, []);

  const totalBytes = useMemo(() => files.reduce((s, f) => s + f.file.size, 0), [files]);
  const limitReached =
    totalBytes >= MAX_BATCH_BYTES || files.length >= MAX_BATCH_FILES;

  const indexedDocTypes = useMemo(() => {
    const set = new Set<DocType>();
    files.forEach((f) => {
      if (f.status === "done" && f.docType) set.add(f.docType);
    });
    return set;
  }, [files]);

  const queuedDocTypes = useMemo(() => {
    const set = new Set<DocType>();
    files.forEach((f) => {
      if (f.status !== "done" && f.docType) set.add(f.docType);
    });
    return set;
  }, [files]);

  const pillState = useMemo(() => {
    const map: Record<DocType, PillState> = {} as Record<DocType, PillState>;
    MVC_DOC_TYPES.forEach((dt) => {
      if (indexedDocTypes.has(dt)) map[dt] = "indexed";
      else if (queuedDocTypes.has(dt)) map[dt] = "queued";
      else map[dt] = "empty";
    });
    return map;
  }, [indexedDocTypes, queuedDocTypes]);

  const completedCount = files.filter((f) => f.status === "done" || f.status === "error").length;
  const aggregateProgress = files.length > 0 ? (completedCount / files.length) * 100 : 0;

  const showRejection = useCallback((message: string) => {
    setRejectionMessage(message);
    if (rejectTimeoutRef.current) window.clearTimeout(rejectTimeoutRef.current);
    rejectTimeoutRef.current = window.setTimeout(() => setRejectionMessage(null), 4000);
  }, []);

  const addFiles = useCallback(
    (incoming: File[]) => {
      const next: UploadFile[] = [];
      const rejections: string[] = [];
      let runningBytes = totalBytes;
      let runningFiles = files.length;

      for (const f of incoming) {
        const ext = getExt(f.name);
        if (!ACCEPTED_EXTS.has(ext)) {
          rejections.push(`${f.name} — format not supported`);
          continue;
        }
        if (f.size > MAX_FILE_BYTES) {
          rejections.push(`${f.name} — over 10 MB limit`);
          continue;
        }
        if (runningBytes + f.size > MAX_BATCH_BYTES || runningFiles + 1 > MAX_BATCH_FILES) {
          rejections.push(`${f.name} — batch limit reached`);
          continue;
        }
        runningBytes += f.size;
        runningFiles += 1;
        next.push({
          id: uuid(),
          file: f,
          docType: null,
          status: "idle",
          progress: 0,
        });
      }

      if (next.length > 0) setFiles((prev) => [...prev, ...next]);
      if (rejections.length > 0) showRejection(rejections.join(" · "));
    },
    [files.length, totalBytes, showRejection],
  );

  const setDocType = (id: string, docType: DocType) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, docType } : f)));
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const updateFile = useCallback((id: string, patch: Partial<UploadFile>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const processOne = useCallback(
    async (id: string) => {
      const target = files.find((f) => f.id === id);
      if (!target) return;
      updateFile(id, { status: "uploading", progress: 0, error: undefined });
      const res = await uploadOne(target, (pct) => updateFile(id, { progress: pct }));
      if (res.status === "done") {
        const finalDocType =
          target.docType ?? (res.docType && isDocType(res.docType) ? res.docType : null);
        updateFile(id, { status: "done", progress: 100, docType: finalDocType });
        try {
          if (typeof window !== "undefined") {
            window.localStorage.setItem("burrow.brainSeeded", "1");
          }
        } catch {
          // ignore
        }
      } else if (res.status === "timeout") {
        updateFile(id, {
          status: "error",
          error: "Still indexing… ",
        });
      } else {
        updateFile(id, { status: "error", error: res.message ?? "Failed" });
      }
    },
    [files, updateFile],
  );

  const processQueueRef = useRef<{ ids: string[]; inFlight: number; resolver: (() => void) | null }>({
    ids: [],
    inFlight: 0,
    resolver: null,
  });

  const processAll = useCallback(async () => {
    const toRun = files.filter((f) => f.status === "idle" || f.status === "error").map((f) => f.id);
    if (toRun.length === 0) {
      setAllDone(true);
      return;
    }
    setIsProcessing(true);

    const queue = [...toRun];
    let inFlight = 0;
    await new Promise<void>((resolve) => {
      const tick = () => {
        while (inFlight < CONCURRENT_UPLOADS && queue.length > 0) {
          const id = queue.shift()!;
          inFlight += 1;
          processOne(id).finally(() => {
            inFlight -= 1;
            if (queue.length === 0 && inFlight === 0) resolve();
            else tick();
          });
        }
      };
      tick();
    });

    setIsProcessing(false);
    setAllDone(true);
  }, [files, processOne]);

  void processQueueRef;

  const skip = () => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("burrow.onboarded", "1");
      }
    } catch {
      // ignore
    }
    if (contextDashboard) router.push("/briefing");
    else router.push("/signals");
  };

  const continueToDashboard = () => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("burrow.onboarded", "1");
      }
    } catch {
      // ignore
    }
    if (contextDashboard) router.push("/briefing");
    else router.push("/signals");
  };

  const anyMissingDocType =
    files.length > 0 && files.some((f) => !f.docType && f.status !== "done");
  const allErrored = files.length > 0 && files.every((f) => f.status === "error");

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 22 }}>
      <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: "var(--text-primary)" }}>
            Seed your brain
          </h1>
          <button
            onClick={skip}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text-secondary)",
              padding: "4px 8px",
            }}
          >
            Skip →
          </button>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          Upload past wins, losses, brand voice, and ICP so Burrow can cite real evidence when
          scoring leads.
        </p>
      </header>

      <UploadDropzone onFiles={addFiles} disabled={limitReached} />

      {rejectionMessage && (
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{rejectionMessage}</span>
      )}

      {isProcessing && files.length > 0 && (
        <div
          role="progressbar"
          aria-valuenow={completedCount}
          aria-valuemax={files.length}
          aria-label="Uploading files"
          style={{ height: 1, background: "var(--border-subtle)" }}
        >
          <div
            style={{
              width: `${aggregateProgress}%`,
              height: 1,
              background: "var(--ink)",
              transition: "width 200ms ease",
            }}
          />
        </div>
      )}

      <UploadFileList
        items={files}
        onChangeDocType={setDocType}
        onRemove={removeFile}
        onRetry={(id) => processOne(id)}
      />

      <MinimalCorpusTracker state={pillState} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          paddingTop: 4,
        }}
      >
        <button
          onClick={skip}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-secondary)",
            padding: "0 4px",
            height: 32,
          }}
        >
          Skip for now →
        </button>
        {files.length > 0 && (
          <button
            onClick={allDone ? continueToDashboard : processAll}
            disabled={isProcessing}
            aria-label={
              allDone
                ? "Continue to dashboard"
                : "Process uploaded files and continue to dashboard"
            }
            style={{
              background: "var(--ink)",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 500,
              height: 32,
              padding: "0 14px",
              cursor: isProcessing ? "not-allowed" : "pointer",
              opacity: isProcessing ? 0.5 : 1,
              pointerEvents: isProcessing ? "none" : "auto",
            }}
          >
            {isProcessing
              ? "Indexing…"
              : allDone
                ? "Continue →"
                : "Process and continue →"}
          </button>
        )}
      </div>

      {anyMissingDocType && !isProcessing && (
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          Select a type for each file.
        </span>
      )}
      {allErrored && (
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          All files failed. Retry each file or skip.
        </span>
      )}

      <CoverageHint pillState={pillState} />
    </div>
  );
}

function CoverageHint({ pillState }: { pillState: Record<DocType, PillState> }) {
  const missing = MVC_DOC_TYPES.filter((dt) => pillState[dt] !== "indexed");
  if (missing.length === 0 || missing.length === MVC_DOC_TYPES.length) return null;
  return (
    <span style={{ fontSize: 11, color: "var(--text-tertiary)", letterSpacing: "0.02em" }}>
      Still missing: {missing.map((dt) => DOC_TYPE_LABELS[dt]).join(" · ")}
    </span>
  );
}
