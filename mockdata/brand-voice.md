# Burrow — brand voice

We write like engineers who have shipped, not marketers.
Every line should pass the "would a senior platform engineer roll
their eyes at this" test. If yes, rewrite.

## Use

- **Concrete numbers.** "200M vectors", "6-week ramp", "$499/mo".
  Not: "massive scale", "rapid onboarding", "competitive pricing".
- **Verb-first sentences.** "Burrow indexes your corpus."
  Not: "We provide indexing solutions."
- **Operational language.** "re-indexing", "cutover", "cluster ops".
  Not: "innovative AI-powered retrieval".
- **Plain words for unusual ideas.** If a concept needs jargon, write
  it once in jargon and once in plain English so a non-specialist
  founder reading the homepage understands the value.

## Avoid

- **AI marketing slop.** "revolutionary", "game-changing", "next-gen",
  "AI-powered", "intelligent", "smart". Cut all of them.
- **Solution-speak.** "Solutions", "leverage", "unlock value", "drive
  outcomes", "empower teams". Each is a tell that the writer didn't
  have anything concrete to say.
- **Vague claims.** "Industry-leading performance" means nothing.
  "67ms p99 retrieval latency on 200M vectors" means something.
- **Hyphenated qualifiers stacked together.** "Best-in-class, enterprise-grade,
  cloud-native infrastructure" is a red flag in any copy.

## Voice examples

**Bad:** Burrow's revolutionary AI-powered platform empowers
engineering teams to unlock the full potential of their vector data
with industry-leading performance.

**Good:** Burrow manages your vector cluster so your platform team
doesn't have to. Same retrieval quality as Pinecone, 30% less, no
on-call rotation.

**Bad:** Our cutting-edge solution leverages state-of-the-art
algorithms to deliver seamless integration.

**Good:** Import script reads from Pinecone, Weaviate, or Qdrant.
Typical migration: one engineer, two weeks, no downtime.

## Tone by surface

- **Homepage / pricing:** confident, specific, no hedging.
- **Docs:** dry, complete, second-person. "You run the import, Burrow
  re-indexes in the background."
- **Sales email:** short. Three sentences. No exclamation marks.
- **Outage post-mortem:** first person plural, blameless, dated,
  numbered. "We saw elevated latency on the EU cluster starting at 14:02 UTC."
- **Marketing post on Hacker News:** assume the audience is hostile
  and informed. Lead with the technical claim, then the business one.

## Words we own

- **Burrow** — the product. Never "the Burrow platform" or "Burrow's
  solution." Just Burrow.
- **The brain** — the founder's indexed corpus. Always definite article.
  "Your brain", "the brain", "seed the brain". Not "your brain instance".
- **Signals** — incoming leads that the Analyst scores. Not "leads",
  not "prospects", not "opportunities".
- **The Researcher / The Analyst / The Brain** — the three agents.
  Always capitalized, always with "the".
