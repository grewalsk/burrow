import { NextResponse } from "next/server";
import {
  ensureCollection,
  listDocuments,
  updateMetadata,
  type Metadata,
} from "@/lib/zeroentropyClient";
import { getSessionId, workspaceCollection } from "@/lib/workspace";
import {
  isHogMockMode,
  startEnrichment,
  pollOperationUntilDone,
  type EnrichmentIdentifier,
} from "@/lib/hogClient";
import { enrichContact, type HogSource } from "@/lib/mockHogAI";

export const runtime = "nodejs";
// Vercel Pro = 60s. Bulk enrichment runs HogAI calls in parallel so this
// should fit even for 5 signals when each individual enrichment is ≤55s.
export const maxDuration = 60;

// Actual HogAI enrichment shape (verified empirically from a succeeded run):
//   {
//     "contact": { "email": ["a@b.com", "..."], "phone": ["+1..."] },
//     "person.name": null, "person.title": null, "person.bio": null,
//     "company.name": null, "company.size": null, ...
//   }
// Note: NO `.data` wrapper. `contact` is nested. Email is ALWAYS an array
// (often with multiple addresses ranked by HogAI's confidence — we pick
// the first). Other fields are flat with DOTTED keys, not nested objects.
function pickFirstString(v: unknown): string {
  if (Array.isArray(v)) {
    const first = v.find((x) => typeof x === "string" && x.trim());
    return typeof first === "string" ? first : "";
  }
  if (typeof v === "string") return v;
  return "";
}

function extractContactFields(result: unknown): {
  name: string;
  email: string;
  role: string;
  company: string;
} {
  const r = (result as Record<string, unknown>) ?? {};
  const contact = (r.contact as { email?: unknown; phone?: unknown }) ?? {};
  return {
    email: pickFirstString(contact.email),
    name: pickFirstString(r["person.name"]),
    role: pickFirstString(r["person.title"]) || pickFirstString(r["person.headline"]),
    company: pickFirstString(r["company.name"]),
  };
}

type EnrichOutcome = {
  signal_id: string;
  mode: "email" | "reply";
  platform: string;
  handle: string;
  post_url: string;
  contact?: { name: string; email: string; role: string; company: string };
  reason?: string;
  cached?: boolean;
};

// Per-signal enrichment — writes metadata to ZE and returns the outcome.
// Used by both single-signal mode (signal_id in body) and bulk mode (all
// ranked signals).
async function enrichOneSignal(
  collection: string,
  doc: { path: string; metadata: Metadata },
): Promise<EnrichOutcome> {
  const meta = doc.metadata;
  const signal_id = String(meta.signal_id ?? "");
  const platform = String(meta.platform ?? "");
  const handle = String(meta.author_handle ?? "");
  const profileUrl = String(meta.author_profile_url ?? "");
  const postUrl = String(meta.post_url ?? "");

  // Already enriched — return cached metadata, no HogAI call.
  // EXCEPT: if a LinkedIn signal was previously cached into reply-mode
  // with no email, that means enrichment failed last time (often due to
  // a payload-shape bug). Retry it on the next pass so a fixed enrichment
  // path can actually succeed without forcing a fresh 1000-credit fetch.
  const hadFailedLinkedIn =
    platform === "LinkedIn" &&
    meta.outreach_mode === "reply" &&
    !String(meta.enriched_email ?? "").trim();
  if (meta.enriched === "true" && !hadFailedLinkedIn) {
    return {
      signal_id,
      mode: (String(meta.outreach_mode ?? "email") as "email" | "reply"),
      platform,
      handle,
      post_url: postUrl,
      contact: {
        name: String(meta.enriched_name ?? ""),
        email: String(meta.enriched_email ?? ""),
        role: String(meta.enriched_role ?? ""),
        company: String(meta.enriched_company ?? ""),
      },
      cached: true,
    };
  }

  // Mock mode
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
        contact_name: contact.name,
        contact_email: contact.email,
        contact_role: contact.role,
        contact_company: contact.company ?? "",
        contact_linkedin: contact.linkedin ?? "",
      },
    });
    return {
      signal_id,
      mode: "email",
      platform,
      handle,
      post_url: postUrl,
      contact: {
        name: contact.name,
        email: contact.email,
        role: contact.role,
        company: contact.company ?? "",
      },
    };
  }

  // Reddit AND X → reply-mode. HogAI's enrichment endpoint only accepts
  // linkedin_url / person_id / company_domain (per the implementation guide).
  // Neither Reddit usernames nor X handles map to those identifiers cleanly,
  // so for those platforms we skip enrichment and route to a platform reply.
  if (platform === "Reddit" || platform === "X") {
    await updateMetadata({
      collectionName: collection,
      documentPath: doc.path,
      metadata: {
        ...meta,
        enriched: "true",
        outreach_mode: "reply",
        status: "enriched",
        contact_name: String(meta.contact_name ?? meta.enriched_name ?? handle),
        contact_email: "",
        contact_role: String(meta.contact_role ?? meta.enriched_role ?? ""),
        contact_company: String(meta.contact_company ?? meta.enriched_company ?? ""),
      },
    });
    return {
      signal_id,
      mode: "reply",
      platform,
      handle,
      post_url: postUrl,
      reason: platform === "Reddit" ? "reddit_no_enrichment" : "x_no_enrichment_identifier",
    };
  }

  // LinkedIn → real HogAI enrichment, fall back to reply on miss
  const identifier: EnrichmentIdentifier = {
    linkedin_url: profileUrl || `https://linkedin.com/in/${handle}`,
  };

  const startRes = await startEnrichment(identifier);
  if (startRes.error || !startRes.body) {
    console.error(`[enrich] HogAI start failed for signal_id=${signal_id} (linkedin_url=${identifier.linkedin_url}):`, startRes.error, JSON.stringify(startRes.body).slice(0, 500));
    await updateMetadata({
      collectionName: collection,
      documentPath: doc.path,
      metadata: {
        ...meta,
        enriched: "true",
        outreach_mode: "reply",
        status: "enriched",
        contact_name: String(meta.contact_name ?? meta.enriched_name ?? handle),
        contact_email: "",
        contact_role: String(meta.contact_role ?? meta.enriched_role ?? ""),
        contact_company: String(meta.contact_company ?? meta.enriched_company ?? ""),
      },
    });
    return {
      signal_id,
      mode: "reply",
      platform,
      handle,
      post_url: postUrl,
      reason: startRes.error ?? "enrichment_start_failed",
    };
  }

  const opRes = await pollOperationUntilDone<unknown>(startRes.body.operationId, {
    timeoutMs: 55_000,
    intervalMs: 2_500,
  });

  if (opRes.error || !opRes.body || opRes.body.status !== "succeeded") {
    await updateMetadata({
      collectionName: collection,
      documentPath: doc.path,
      metadata: {
        ...meta,
        enriched: "true",
        outreach_mode: "reply",
        status: "enriched",
        contact_name: String(meta.contact_name ?? meta.enriched_name ?? handle),
        contact_email: "",
        contact_role: String(meta.contact_role ?? meta.enriched_role ?? ""),
        contact_company: String(meta.contact_company ?? meta.enriched_company ?? ""),
      },
    });
    return { signal_id, mode: "reply", platform, handle, post_url: postUrl, reason: opRes.error ?? "enrichment_failed" };
  }

  const contact = extractContactFields(opRes.body.result);
  console.log(
    `[enrich] signal_id=${signal_id} platform=${platform} handle=${handle} → extracted email=${contact.email || "(none)"} name=${contact.name || "(none)"}`,
  );

  // No email returned → still mark enriched but reply-mode
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
        contact_name: contact.name || handle,
        contact_email: "",
        contact_role: contact.role,
        contact_company: contact.company,
      },
    });
    return { signal_id, mode: "reply", platform, handle, post_url: postUrl, contact, reason: "no_email_found" };
  }

  // Email found → email mode
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
      contact_name: contact.name || handle,
      contact_email: contact.email,
      contact_role: contact.role,
      contact_company: contact.company,
    },
  });
  return { signal_id, mode: "email", platform, handle, post_url: postUrl, contact };
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
    // empty body is fine — bulk mode
  }

  const collection = workspaceCollection(sessionId);
  await ensureCollection(collection);

  // ---- Single-signal mode: enrich the one requested signal ----
  if (body.signal_id) {
    const matches = await listDocuments({
      collectionName: collection,
      filter: { "metadata.doc_type": "signal", "metadata.signal_id": body.signal_id },
      limit: 1,
    });
    if (matches.length === 0) {
      return NextResponse.json({ ok: false, error: "signal not found" }, { status: 404 });
    }
    const outcome = await enrichOneSignal(collection, matches[0]);
    return NextResponse.json({ ok: true, ...outcome });
  }

  // ---- Bulk mode: enrich all signals marked as "ranked" by /api/signals/rank ----
  const ranked = await listDocuments({
    collectionName: collection,
    filter: { "metadata.doc_type": "signal", "metadata.status": "ranked" },
    limit: 25,
  });

  if (ranked.length === 0) {
    return NextResponse.json({
      ok: false,
      error: "No ranked signals to enrich. Run /api/signals/rank first.",
      enriched: [],
    });
  }

  // Run all enrichments in parallel so total time ≈ slowest single enrichment.
  const results = await Promise.allSettled(
    ranked.map((doc) => enrichOneSignal(collection, doc)),
  );

  const enriched: EnrichOutcome[] = [];
  const failed: Array<{ signal_id: string; error: string }> = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      enriched.push(r.value);
    } else {
      failed.push({
        signal_id: String(ranked[i].metadata.signal_id ?? ranked[i].path),
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  }

  console.log(
    `[enrich] bulk: ${enriched.length}/${ranked.length} enriched, ` +
      `${enriched.filter((e) => e.mode === "email").length} email, ` +
      `${enriched.filter((e) => e.mode === "reply").length} reply, ` +
      `${failed.length} failed`,
  );

  return NextResponse.json({
    ok: true,
    bulk: true,
    requested: ranked.length,
    enriched,
    failed,
  });
}
