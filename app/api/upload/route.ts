import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import busboy from "busboy";
import { Readable } from "node:stream";
import crypto from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import {
  addDocument,
  ensureCollection,
  getDocumentInfo,
  isMockMode,
} from "@/lib/zeroentropyClient";
import { classifyDocType } from "@/lib/classifyDocType";
import { isDocType, type DocType } from "@/lib/docTypes";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_BATCH_BYTES = 50 * 1024 * 1024;
const MAX_BATCH_FILES = 20;
const POLL_INTERVAL_MS = 1_000;
const INDEX_TIMEOUT_MS = 45_000;

const ALLOWED_EXTS = new Set([".pdf", ".docx", ".doc", ".md", ".txt", ".csv"]);
const ALLOWED_MIME_PREFIX = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/zip",
  "text/plain",
  "text/markdown",
  "text/csv",
]);

type BatchState = { bytes: number; files: number };
const batchState = new Map<string, BatchState>();

function batchKey(sessionId: string): string {
  return sessionId;
}

function getExt(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i < 0 ? "" : filename.slice(i).toLowerCase();
}

function workspaceCollection(workspaceId: string): string {
  return `brain-${workspaceId}`;
}

async function parseMultipart(req: Request): Promise<{
  buffer: Buffer;
  filename: string;
  mimeType: string;
  docType: DocType | null;
}> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    throw new HttpError(400, "Expected multipart/form-data");
  }
  if (!req.body) throw new HttpError(400, "Empty request body");

  return new Promise((resolve, reject) => {
    const bb = busboy({
      headers: { "content-type": contentType },
      limits: { files: 1, fileSize: MAX_FILE_BYTES + 1 },
    });
    let chunks: Buffer[] = [];
    let totalBytes = 0;
    let filename = "";
    let mimeType = "";
    let docType: DocType | null = null;
    let truncated = false;
    let fileSeen = false;

    bb.on("file", (_name, stream, info) => {
      fileSeen = true;
      filename = info.filename ?? "upload";
      mimeType = info.mimeType ?? "application/octet-stream";
      stream.on("data", (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_FILE_BYTES) {
          truncated = true;
          stream.resume();
          return;
        }
        chunks.push(chunk);
      });
      stream.on("limit", () => {
        truncated = true;
      });
    });

    bb.on("field", (name, value) => {
      if (name === "doc_type" && value && isDocType(value)) docType = value;
    });

    bb.on("close", () => {
      if (!fileSeen) {
        reject(new HttpError(400, "No file in upload"));
        return;
      }
      if (truncated) {
        reject(new HttpError(400, "Over 10 MB limit"));
        return;
      }
      resolve({ buffer: Buffer.concat(chunks), filename, mimeType, docType });
    });

    bb.on("error", (err) => reject(err));

    Readable.fromWeb(req.body as unknown as import("node:stream/web").ReadableStream)
      .pipe(bb)
      .on("error", reject);
  });
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function checkMagicBytes(buffer: Buffer, ext: string): boolean {
  if (ext === ".txt" || ext === ".md" || ext === ".csv") return true;
  if (buffer.length < 4) return false;
  if (ext === ".pdf") {
    return buffer.slice(0, 4).toString("ascii") === "%PDF";
  }
  if (ext === ".docx" || ext === ".doc") {
    const sig = buffer.slice(0, 4);
    if (sig[0] === 0x50 && sig[1] === 0x4b && sig[2] === 0x03 && sig[3] === 0x04) return true;
    if (sig[0] === 0xd0 && sig[1] === 0xcf && sig[2] === 0x11 && sig[3] === 0xe0) return true;
    return false;
  }
  return false;
}

async function getSessionId(): Promise<string | null> {
  const jar = await cookies();
  const c = jar.get("burrow_session");
  return c?.value ?? null;
}

async function pollIndexed(collection: string, docPath: string): Promise<"done" | "timeout" | "failed"> {
  const start = Date.now();
  while (Date.now() - start < INDEX_TIMEOUT_MS) {
    try {
      const info = await getDocumentInfo(collection, docPath);
      if (info.index_status === "indexed") return "done";
      if (info.index_status === "parsing_failed" || info.index_status === "indexing_failed") {
        return "failed";
      }
    } catch {
      // doc may not yet be queryable; keep polling
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return "timeout";
}

export async function POST(req: Request): Promise<Response> {
  const sessionId = await getSessionId();
  if (!sessionId) {
    return NextResponse.json(
      { status: "error", message: "Session expired" },
      { status: 401 },
    );
  }

  let parsed;
  try {
    parsed = await parseMultipart(req);
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ status: "error", message: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { status: "error", message: "Failed to parse upload" },
      { status: 400 },
    );
  }
  const { buffer, filename, mimeType, docType: providedDocType } = parsed;

  const ext = getExt(filename);
  if (!ALLOWED_EXTS.has(ext)) {
    return NextResponse.json(
      { status: "error", message: "Format not supported" },
      { status: 400 },
    );
  }
  if (buffer.length > MAX_FILE_BYTES) {
    return NextResponse.json(
      { status: "error", message: "Over 10 MB limit" },
      { status: 400 },
    );
  }

  if (!checkMagicBytes(buffer, ext)) {
    return NextResponse.json(
      { status: "error", message: "Format not supported (signature mismatch)" },
      { status: 400 },
    );
  }
  if (ext === ".pdf" || ext === ".docx" || ext === ".doc") {
    const detected = await fileTypeFromBuffer(buffer);
    if (detected && !ALLOWED_MIME_PREFIX.has(detected.mime)) {
      return NextResponse.json(
        { status: "error", message: "Format not supported" },
        { status: 400 },
      );
    }
    void mimeType;
  }

  const key = batchKey(sessionId);
  const state = batchState.get(key) ?? { bytes: 0, files: 0 };
  if (state.bytes + buffer.length > MAX_BATCH_BYTES || state.files + 1 > MAX_BATCH_FILES) {
    return NextResponse.json(
      { status: "error", message: "Upload limit reached" },
      { status: 400 },
    );
  }

  let docType: DocType | null = providedDocType;
  if (!docType) {
    const firstTokens = buffer.slice(0, 4096).toString("utf8").slice(0, 800);
    docType = classifyDocType(filename, firstTokens);
  }

  const b64 = buffer.toString("base64");
  const docId = `${crypto.createHash("sha256").update(b64).digest("hex")}${ext}`;

  const workspaceId = sessionId;
  const collection = workspaceCollection(workspaceId);

  try {
    await ensureCollection(collection);
    await addDocument({
      collectionName: collection,
      documentPath: docId,
      base64Data: b64,
      metadata: {
        doc_type: docType ?? "uncategorized",
        filename,
        uploaded_at: String(Date.now()),
        sample: "false",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingest failed";
    return NextResponse.json({ status: "error", message }, { status: 502 });
  }

  batchState.set(key, { bytes: state.bytes + buffer.length, files: state.files + 1 });

  const result = await pollIndexed(collection, docId);
  if (result === "done") {
    return NextResponse.json({
      status: "done",
      docId,
      docType,
      filename,
      mock: isMockMode(),
    });
  }
  if (result === "failed") {
    return NextResponse.json(
      { status: "error", message: "Indexing failed", docId, filename },
      { status: 502 },
    );
  }
  return NextResponse.json(
    { status: "timeout", docId, docType, filename },
    { status: 202 },
  );
}
