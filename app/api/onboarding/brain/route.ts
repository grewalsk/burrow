import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { addDocument, ensureCollection } from "@/lib/zeroentropyClient";
import type { DocType } from "@/lib/docTypes";

export const runtime = "nodejs";
export const maxDuration = 60;

type Story = { name?: string; description?: string; source?: string };

type BrainPayload = {
  url?: string;
  one_liner?: string;
  description?: string;
  icp?: string;
  pricing?: string;
  features?: string[];
  competitors?: string[];
  stories?: Story[];
};

function workspaceCollection(workspaceId: string): string {
  return `brain-${workspaceId}`;
}

async function ingestText(params: {
  collection: string;
  filename: string;
  docType: DocType;
  text: string;
  extras?: Record<string, string | string[]>;
}): Promise<void> {
  const b64 = Buffer.from(params.text, "utf8").toString("base64");
  const docId = `${crypto.createHash("sha256").update(`${params.filename}:${b64}`).digest("hex")}.txt`;
  await addDocument({
    collectionName: params.collection,
    documentPath: docId,
    base64Data: b64,
    metadata: {
      doc_type: params.docType,
      filename: params.filename,
      uploaded_at: String(Date.now()),
      sample: "false",
      source: "cr_agent",
      ...(params.extras ?? {}),
    },
  });
}

export async function POST(req: Request): Promise<Response> {
  const jar = await cookies();
  const sessionId = jar.get("burrow_session")?.value;
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "Session expired" }, { status: 401 });
  }

  let body: BrainPayload;
  try {
    body = (await req.json()) as BrainPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const collection = workspaceCollection(sessionId);

  try {
    await ensureCollection(collection);

    const brandParts: string[] = [];
    if (body.url) brandParts.push(`Website: ${body.url}`);
    if (body.one_liner) brandParts.push(body.one_liner);
    if (body.description) brandParts.push(body.description);
    if (body.features?.length) brandParts.push(`Features: ${body.features.join(", ")}`);
    if (body.pricing) brandParts.push(`Pricing: ${body.pricing}`);
    if (brandParts.length) {
      await ingestText({
        collection,
        filename: "auto-company-profile",
        docType: "brand_guide",
        text: brandParts.join("\n\n"),
        extras: body.url ? { company_url: body.url, is_cr_agent: "true" } : { is_cr_agent: "true" },
      });
    }

    if (body.icp) {
      await ingestText({
        collection,
        filename: "auto-icp",
        docType: "icp",
        text: body.icp,
      });
    }

    if (body.competitors?.length) {
      await Promise.all(
        body.competitors.map((name, i) =>
          ingestText({
            collection,
            filename: `auto-competitor-${i}-${name}`,
            docType: "competitor_intel",
            text: name,
            extras: { competitor_name: name },
          }),
        ),
      );
    }

    if (body.stories?.length) {
      await Promise.all(
        body.stories.map((s) =>
          ingestText({
            collection,
            filename: `auto-story-${s.name ?? "unnamed"}`,
            docType: "case_study",
            text: `${s.name ?? ""}: ${s.description ?? ""}`,
            extras: { story_name: s.name ?? "" },
          }),
        ),
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "ingest failed";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
