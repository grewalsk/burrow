import { NextResponse } from "next/server";
import {
  ensureCollection,
  listDocuments,
  updateMetadata,
} from "@/lib/zeroentropyClient";
import { getSessionId, workspaceCollection } from "@/lib/workspace";
import {
  isHogMockMode,
  startEnrichment,
  pollOperationUntilDone,
  type EnrichmentPayload,
} from "@/lib/hogClient";
import { enrichContact, type HogSource } from "@/lib/mockHogAI";

export const runtime = "nodejs";
export const maxDuration = 60;

// HogAI's enrichment result shape — fields are best-effort; any may be missing
type HogEnrichmentResult = {
  data?: {
    person?: { name?: string; email?: string; role?: string; title?: string; company?: string };
    contact?: { email?: string; phone?: string };
    company?: { name?: string };
    // some responses flatten these
    name?: string;
    email?: string;
    role?: string;
    title?: string;
  };
};

function extractContactFields(result: unknown): {
  name: string;
  email: string;
  role: string;
  company: string;
} {
  const d = (result as HogEnrichmentResult)?.data ?? {};
  return {
    name: d.person?.name ?? d.name ?? "",
    email: d.contact?.email ?? d.person?.email ?? d.email ?? "",
    role: d.person?.role ?? d.person?.title ?? d.role ?? d.title ?? "",
    company: d.company?.name ?? d.person?.company ?? "",
  };
}

export async function POST(req: Request): Promise<Response> {
  const sessionId = await getSessionId();
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "Session expired" }, { status: 401 });
  }

  let body: { signal_id?: string } = {};
  try {
    body = (await req.json()) as { signal_id?: string };
  } catch {
    // body optional
  }

  if (!body.signal_id) {
    return NextResponse.json({ ok: false, error: "signal_id required" }, { status: 400 });
  }

  const collection = workspaceCollection(sessionId);
  await ensureCollection(collection);

  // Look up the signal in ZE
  const matches = await listDocuments({
    collectionName: collection,
    filter: { "metadata.doc_type": "signal", "metadata.signal_id": body.signal_id },
    limit: 1,
  });

  if (matches.length === 0) {
    return NextResponse.json({ ok: false, error: "signal not found" }, { status: 404 });
  }

  const doc = matches[0];
  const meta = doc.metadata;
  const platform = String(meta.platform ?? "");
  const handle = String(meta.author_handle ?? "");
  const profileUrl = String(meta.author_profile_url ?? "");
  const postUrl = String(meta.post_url ?? "");

  // Already enriched — return cached
  if (meta.enriched === "true") {
    return NextResponse.json({
      ok: true,
      mode: String(meta.outreach_mode ?? "email"),
      contact: {
        name: String(meta.enriched_name ?? ""),
        email: String(meta.enriched_email ?? ""),
        role: String(meta.enriched_role ?? ""),
        company: String(meta.enriched_company ?? ""),
      },
      platform,
      handle,
      post_url: postUrl,
      cached: true,
    });
  }

  // ---- Mock mode: keep old behavior ----
  if (isHogMockMode()) {
    const mockSource: HogSource =
      platform === "X" ? "X" : platform === "Reddit" ? "REDDIT" : platform === "LinkedIn" ? "LINKEDIN" : "X";
    const contact = enrichContact({ source: mockSource, handle });
    await updateMetadata({
      collectionName: collection,
      documentPath: doc.path,
      metadata: {
        ...meta,
        enriched: "true",
        outreach_mode: "email",
        enriched_name: contact.name,
        enriched_email: contact.email,
        enriched_role: contact.role,
        enriched_company: contact.company ?? "",
        status: "enriched",
        // Legacy aliases for downstream consumers
        contact_name: contact.name,
        contact_email: contact.email,
        contact_role: contact.role,
        contact_company: contact.company ?? "",
        contact_linkedin: contact.linkedin ?? "",
      },
    });
    return NextResponse.json({
      ok: true,
      mode: "email",
      contact: { name: contact.name, email: contact.email, role: contact.role, company: contact.company ?? "" },
      platform,
      handle,
      post_url: postUrl,
      mock: true,
    });
  }

  // ---- Reddit: no enrichment, always reply-mode ----
  if (platform === "Reddit") {
    await updateMetadata({
      collectionName: collection,
      documentPath: doc.path,
      metadata: {
        ...meta,
        enriched: "true",
        outreach_mode: "reply",
        status: "enriched",
        // Legacy aliases — keep contact_* in sync even on reply-only path so
        // draftLLM doesn't crash on missing fields.
        contact_name: String(meta.contact_name ?? meta.enriched_name ?? handle),
        contact_email: "",
        contact_role: String(meta.contact_role ?? meta.enriched_role ?? ""),
        contact_company: String(meta.contact_company ?? meta.enriched_company ?? ""),
      },
    });
    return NextResponse.json({
      ok: true,
      mode: "reply",
      platform: "Reddit",
      handle,
      post_url: postUrl,
      reason: "reddit_no_enrichment",
    });
  }

  // ---- X / LinkedIn: try real HogAI enrichment, fall back to reply-mode if no email ----

  const payload: EnrichmentPayload =
    platform === "LinkedIn"
      ? { linkedinUrl: profileUrl || `https://linkedin.com/in/${handle}` }
      : { xUserId: handle };

  const startRes = await startEnrichment(payload);
  if (startRes.error || !startRes.body) {
    // Surface auth/rate issues to the client; downgrade to reply on hard failure
    return NextResponse.json(
      { ok: false, error: startRes.error ?? "enrichment start failed" },
      { status: 502 },
    );
  }

  const opRes = await pollOperationUntilDone<unknown>(startRes.body.operationId, {
    timeoutMs: 90_000,
    intervalMs: 2_500,
  });

  if (opRes.error || !opRes.body || opRes.body.status !== "succeeded") {
    // Enrichment failed — fall back to reply mode
    await updateMetadata({
      collectionName: collection,
      documentPath: doc.path,
      metadata: {
        ...meta,
        enriched: "true",
        outreach_mode: "reply",
        status: "enriched",
        // Legacy aliases — keep contact_* in sync even on reply-only path so
        // draftLLM doesn't crash on missing fields.
        contact_name: String(meta.contact_name ?? meta.enriched_name ?? handle),
        contact_email: "",
        contact_role: String(meta.contact_role ?? meta.enriched_role ?? ""),
        contact_company: String(meta.contact_company ?? meta.enriched_company ?? ""),
      },
    });
    return NextResponse.json({
      ok: true,
      mode: "reply",
      platform,
      handle,
      post_url: postUrl,
      reason: opRes.error ?? "enrichment_failed",
    });
  }

  const contact = extractContactFields(opRes.body.result);

  // No email found → fall back to reply mode
  if (!contact.email) {
    await updateMetadata({
      collectionName: collection,
      documentPath: doc.path,
      metadata: {
        ...meta,
        enriched: "true",
        outreach_mode: "reply",
        enriched_name: contact.name,
        enriched_role: contact.role,
        enriched_company: contact.company,
        status: "enriched",
        // Legacy aliases for downstream consumers
        contact_name: contact.name || handle,
        contact_email: "",
        contact_role: contact.role,
        contact_company: contact.company,
      },
    });
    return NextResponse.json({
      ok: true,
      mode: "reply",
      platform,
      handle,
      post_url: postUrl,
      contact,
      reason: "no_email_found",
    });
  }

  // Got an email — write enriched metadata, return email mode
  await updateMetadata({
    collectionName: collection,
    documentPath: doc.path,
    metadata: {
      ...meta,
      enriched: "true",
      outreach_mode: "email",
      enriched_name: contact.name,
      enriched_email: contact.email,
      enriched_role: contact.role,
      enriched_company: contact.company,
      status: "enriched",
      // Legacy aliases for downstream consumers (draftLLM reads these)
      contact_name: contact.name || handle,
      contact_email: contact.email,
      contact_role: contact.role,
      contact_company: contact.company,
    },
  });

  return NextResponse.json({
    ok: true,
    mode: "email",
    contact,
    platform,
    handle,
    post_url: postUrl,
  });
}
