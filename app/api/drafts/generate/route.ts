import { NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  addTextDocument,
  ensureCollection,
  listDocuments,
  updateMetadata,
} from "@/lib/zeroentropyClient";
import { generateDraft } from "@/lib/draftLLM";
import { getSessionId, workspaceCollection } from "@/lib/workspace";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(): Promise<Response> {
  const sessionId = await getSessionId();
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "Session expired" }, { status: 401 });
  }
  const collection = workspaceCollection(sessionId);
  await ensureCollection(collection);

  // Drafts are generated for enriched signals only.
  const targets = await listDocuments({
    collectionName: collection,
    filter: { doc_type: "signal", status: "enriched" },
    limit: 50,
  });

  const created: Array<{ draft_id: string; subject: string; signal_id: string }> = [];
  const errors: string[] = [];

  await Promise.allSettled(
    targets.map(async (d) => {
      try {
      const signal = {
        signal_id: String(d.metadata.signal_id ?? ""),
        source: String(d.metadata.source ?? ""),
        handle: String(d.metadata.handle ?? ""),
        context: d.metadata.context ? String(d.metadata.context) : undefined,
        body: String(d.metadata.body ?? ""),
        contact_name: String(d.metadata.contact_name ?? "there"),
        contact_role: d.metadata.contact_role ? String(d.metadata.contact_role) : undefined,
        contact_company: d.metadata.contact_company ? String(d.metadata.contact_company) : undefined,
      };

      const draft = await generateDraft({
        collectionName: collection,
        signal,
      });

      const draftId = crypto
        .createHash("sha256")
        .update(`draft:${signal.signal_id}:${Date.now()}`)
        .digest("hex")
        .slice(0, 16);

      await addTextDocument({
        collectionName: collection,
        documentPath: `draft-${draftId}.txt`,
        text: `Subject: ${draft.subject}\n\n${draft.body}`,
        metadata: {
          doc_type: "draft",
          draft_id: draftId,
          signal_id: signal.signal_id,
          source: signal.source,
          handle: signal.handle,
          subject: draft.subject,
          contact_name: String(d.metadata.contact_name ?? ""),
          contact_email: String(d.metadata.contact_email ?? ""),
          contact_role: String(d.metadata.contact_role ?? ""),
          contact_company: String(d.metadata.contact_company ?? ""),
          evidence: draft.evidence.length > 0 ? draft.evidence.join(" · ") : "(no grounding)",
          generator: draft.source,
          fallback_reason: draft.fallback_reason ?? "",
          created_at: String(Date.now()),
          status: "pending",
          sample: "false",
        },
      });

      await updateMetadata({
        collectionName: collection,
        documentPath: d.path,
        metadata: { ...d.metadata, status: "drafted", draft_id: draftId },
      });

      created.push({ draft_id: draftId, subject: draft.subject, signal_id: signal.signal_id });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${d.path}: ${msg}`);
        console.error("draft generation failed for", d.path, msg);
      }
    }),
  );

  return NextResponse.json({ ok: true, drafts: created, errors });
}
