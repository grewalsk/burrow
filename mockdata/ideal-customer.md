# Burrow ICP — who we sell to

## In one sentence

A platform engineer at a Series A–B company who is tired of being on
call for their own vector database.

## The shape

- **Team size:** 10–200 engineers total. Below 10, they don't have a
  platform team yet — they'll DIY on Postgres + pgvector and our pitch
  bounces. Above 200, they have a dedicated infra org that wants to
  build, not buy.
- **Vector scale:** > 50M vectors in production. Under that, the free
  tier of Pinecone or self-hosted Qdrant works fine for them.
- **Stack today:** Pinecone (most common), Weaviate, or self-hosted
  Qdrant. Almost never Postgres-with-pgvector — that crowd doesn't
  feel the pain yet.
- **Funding:** Series A through Series B. Pre-seed and seed don't have
  the vector volume. Series C+ has built their own.
- **Industry:** RAG product companies, dev tools, fintech (with caveats
  — see compliance), and search-as-a-feature SaaS.

## The trigger

Something just broke their internal calm:

- **The Pinecone bill crossed $5k/month.** This is the single most
  reliable signal. Once they see four digits monthly, finance asks
  questions and the engineering team has to defend the line.
- **The platform engineer who ran the cluster just left.** Cluster
  ops knowledge walked out the door. The team is one outage from
  panicking.
- **Their RAG product is about to hit production.** They built on a
  prototype-grade setup and now real customer load is two weeks away.
- **An eval regression they can't explain.** Retrieval quality dropped,
  nobody knows why, the on-call rotation is now eight people deep in a
  Slack thread.

## What they say in discovery

- "Honestly, we should have moved off Pinecone six months ago."
- "We don't have anyone who actually owns this cluster anymore."
- "Our re-indexing job has been flaky and nobody wants to touch it."
- "I just want to stop thinking about this."

## What they don't say

- "We need better embeddings." (That's not us.)
- "We need a smarter ranker." (Adjacent, not core.)
- "We want to fine-tune our retrieval." (We do this, but it's not the
  hook — operational pain is.)

## Disqualifiers

- **< 1M vectors.** Free tier territory, no revenue path, will churn.
- **Single-person eng team.** Won't sign annual, won't have budget,
  won't survive switching cost.
- **Regulated industries without SOC2 Type II.** Until we get Type II,
  legal will block us at fintech and healthcare. Devon at Acme is the
  cautionary tale — see lost-deal-acme.md.
- **Companies still pre-product-launch.** They don't yet feel the
  operational pain that converts. They'll sign a $99 dev plan, churn
  in 90 days.
- **Anyone evaluating us against pgvector.** Different problem space,
  different price point. Walk away politely.

## Champion profile

Almost always a Staff or Principal Platform Engineer, late 20s to
mid 30s, has been at the company 1–3 years. Reports to a VP Eng who
trusts them on infra decisions. They have a Slack channel called
`#vector-cluster-ops` or similar and are the only person in it who
knows how the re-indexing pipeline works. They are tired.
