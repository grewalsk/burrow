import type { DocType } from "./docTypes";

export type SampleDoc = {
  filename: string;
  docType: DocType;
  text: string;
};

export const SAMPLE_CORPUS: SampleDoc[] = [
  {
    filename: "sample-won-initech.md",
    docType: "won_deal",
    text: `# Initech — Won (Q3)

Closed 200M vector contract after 6-week ramp. The deciding moment: their VP Eng
saw our auto-scoring eval dashboard match their hand-labeled set within 2%.

What worked:
- Demoed retrieval on their actual corpus, not a synthetic benchmark
- Pricing came in 30% under Pinecone Enterprise
- Migration tooling cut their estimated cutover from 12 weeks to 6

Quote to reuse: "We were ready to live with Pinecone's bill. The migration tool
was the unlock — it made the move feel safe."`,
  },
  {
    filename: "sample-lost-acme.md",
    docType: "lost_deal",
    text: `# Acme — Lost (Q2)

Lost to incumbent (Pinecone) after 4-call cycle. Reason: procurement risk —
they could not get sign-off on a Series A vendor without SOC2 Type II.

Lessons:
- For fintech ICP, lead with compliance posture, not features
- We have SOC2 Type I; Type II is in flight — surface this earlier
- Their champion wanted us to win but couldn't push past legal`,
  },
  {
    filename: "sample-brand-voice.md",
    docType: "brand_guide",
    text: `# Brand voice

We write like engineers who have shipped, not marketers.

Use:
- Concrete numbers ("200M vectors", "6-week ramp")
- Verb-first sentences ("Burrow indexes…")
- Operational language ("re-indexing", "cutover")

Avoid:
- "Solutions", "leverage", "unlock value"
- AI marketing slop ("revolutionary", "game-changing")
- Vague claims without a number behind them`,
  },
  {
    filename: "sample-icp.md",
    docType: "icp",
    text: `# ICP — Ideal Customer Profile

Engineering teams of 10–200 with > 50M vectors. Currently on Pinecone,
Weaviate, or self-hosted Qdrant. Pain: cluster ops eating engineering time.

Triggers:
- Recent Pinecone bill shock (esp. > $5K/mo)
- A platform engineer just left and nobody else knows the cluster
- Pre-launch RAG product that needs to scale past prototype

Disqualifiers:
- < 1M vectors (free tier, no revenue path)
- Single-person teams (won't sign annual)
- Regulated industries without SOC2 Type II (until we have it)`,
  },
];
