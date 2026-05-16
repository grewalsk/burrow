# Initech — closed Q3

**Contract:** 3-year, $180k ARR, 200M vectors
**Champion:** Maya Chen, VP Engineering
**Cycle:** 6 weeks, demo to signed
**Stack they came from:** Pinecone Enterprise

## What they bought

Burrow Team plan, with a custom add-on for their on-prem eval cluster.
The deciding moment was the live demo on their own corpus — we ran
their hand-labeled relevance set through our auto-scorer and matched
within 2% of their internal ground truth.

## Why we won

1. **Their Pinecone bill had crossed $9k/month.** We came in 30% under,
   even before they consolidated their dev cluster.
2. **Migration tool.** Their estimate to move was 12 weeks of platform
   engineering time. Our import script cut that to 6 weeks of part-time
   work for one engineer.
3. **Champion alignment.** Maya had been pushing for a managed solution
   internally since Q1. We arrived right when her CFO asked for a budget
   line item.

## What Maya said on the kickoff call

> "We were ready to live with the Pinecone bill — switching cost felt
> larger than the savings. The migration tool was the unlock. It made
> the move feel safe, and then the price became a bonus instead of the
> reason."

## Repeatable patterns

- 14-person eng team, $5M Series A, Pinecone bill > $5k/mo. Same profile
  as Acme (lost) and Pied Piper (won) — three data points now, this is
  our ICP center of mass.
- Always demo on customer's own corpus. Synthetic benchmarks consistently
  underperform vs. seeing their own relevance set scored correctly.
- Surface the migration tool in call 2, not call 4. We left it too late
  with Acme and they signed with Pinecone before they saw it.

## Open follow-ups

- Maya offered to do a customer story / case study after they hit 90
  days in production. Reach out around Jan 15.
- They want a quarterly business review cadence; first one scheduled
  Q4 week 11.
