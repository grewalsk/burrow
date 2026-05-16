/**
 * Mock draft generator — template-based personalization that uses REAL ZE
 * retrieval for grounding. This is the seam where a free HuggingFace model
 * would slot in (per spec); we keep it deterministic for demo stability.
 *
 * The "AI" is the ZE retrieval that picks which brand/won-deal/icp doc to
 * cite. The template is just sentence-stitching.
 */

import { topDocuments } from "./zeroentropyClient";

type SignalInfo = {
  signal_id: string;
  source: string;
  handle: string;
  context?: string;
  body: string;
  contact_name: string;
  contact_company?: string;
};

export type GeneratedDraft = {
  subject: string;
  body: string;
  evidence: string[];   // labels of docs the draft is grounded in
};

function firstName(full: string): string {
  return (full.split(" ")[0] ?? full).trim();
}

function shortQuote(body: string): string {
  const trimmed = body.replace(/\s+/g, " ").trim();
  if (trimmed.length <= 140) return trimmed;
  const cut = trimmed.slice(0, 140);
  return cut.slice(0, cut.lastIndexOf(" ")) + "…";
}

function subjectFor(signalBody: string): string {
  const text = signalBody.toLowerCase();
  if (/pinecone|hosted vector|managed vector/.test(text)) {
    return "On the Pinecone math";
  }
  if (/soc2|compliance|fintech/.test(text)) {
    return "Compliance question — quick note";
  }
  if (/migrate|migration|moving off|switching/.test(text)) {
    return "Migration playbook — saw your post";
  }
  if (/re-indexing|reindex|cluster ops|on-call/.test(text)) {
    return "On the cluster-ops side of this";
  }
  if (/bill|cost|price|spend/.test(text)) {
    return "On the bill, briefly";
  }
  return "Saw your post — one quick thought";
}

export async function generateDraft(params: {
  collectionName: string;
  signal: SignalInfo;
}): Promise<GeneratedDraft> {
  // Pull 3 most-relevant grounding docs from the founder's brain.
  const grounded = await topDocuments({
    collectionName: params.collectionName,
    query: params.signal.body,
    k: 3,
    filter: {
      "metadata.doc_type": { $in: ["brand_guide", "won_deal", "icp", "case_study"] },
    },
  });

  const wonDeal = grounded.find((d) => d.metadata.doc_type === "won_deal");
  const caseStudy = grounded.find((d) => d.metadata.doc_type === "case_study");
  const brandGuide = grounded.find((d) => d.metadata.doc_type === "brand_guide");

  const evidence = grounded.map((d) =>
    String(d.metadata.story_name ?? d.metadata.filename ?? d.metadata.doc_type),
  );

  const first = firstName(params.signal.contact_name);
  const quote = shortQuote(params.signal.body);
  const sourceLabel = params.signal.source === "HACKER NEWS" ? "your HN post" : `your ${params.signal.source.toLowerCase()} post`;

  // Compose a short, brand-voice email. Bridge: signal → one win → light CTA.
  const lines: string[] = [];
  lines.push(`${first},`);
  lines.push("");
  lines.push(`Saw ${sourceLabel}: "${quote}"`);
  lines.push("");

  if (wonDeal) {
    const story = String(wonDeal.metadata.story_name ?? wonDeal.metadata.filename ?? "a team we worked with");
    lines.push(
      `We worked with ${story} on close to the same problem — they came in 30% under their previous bill after a six-week ramp, no on-call rotation for the cluster.`,
    );
  } else if (caseStudy) {
    const story = String(caseStudy.metadata.story_name ?? caseStudy.metadata.filename ?? "another customer");
    lines.push(
      `We had ${story} hit the same wall recently. Migration ended up being faster than they expected, and the bill stopped surprising finance.`,
    );
  } else {
    lines.push(
      "We've seen this pattern a few times — usually the trigger isn't the bill, it's the on-call cost. The math flips fast.",
    );
  }

  lines.push("");
  lines.push("If a 15-minute look at the numbers would be useful, I can pull a side-by-side from one of our recent migrations. No deck, no demo — just the numbers.");
  lines.push("");
  lines.push("— Burrow team");

  const body = lines.join("\n");
  const subject = subjectFor(params.signal.body);

  if (brandGuide) {
    evidence.push(`brand_voice (${String(brandGuide.metadata.filename ?? "")})`);
  }

  return { subject, body, evidence };
}
