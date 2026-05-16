# Acme — lost Q2

**Outcome:** Lost to incumbent (Pinecone), 4-call cycle, no signature
**Champion:** Devon Park, Staff Eng
**Decision-blocker:** Procurement / legal (SOC2 Type II requirement)

## Timeline

- **Week 1:** Outbound from us, Devon replied same day. Strong fit on
  paper — 80M vectors, fintech, recent Pinecone bill shock.
- **Week 2:** Demo call. Devon was sold. Said "I want to bring my CTO
  next time, this is a no-brainer."
- **Week 3:** CTO joined call 2. Asked about compliance posture. We
  said SOC2 Type I in hand, Type II audit underway. CTO went quiet.
- **Week 4:** Devon emailed: "Legal is blocking on Type II. Can you
  share a timeline?" We said Q1 next year. They asked if we could
  fast-track. We couldn't.
- **Week 5:** Devon: "We're going to renew Pinecone for one more year
  and revisit. Sorry — this isn't a product issue."

## Why we lost

Not a product issue. Not a pricing issue. Legal could not approve a
Series A vendor without Type II for anything touching customer PII,
which their vector workload did. Devon was the right champion but he
ran into a wall he couldn't move.

## What we should have done differently

1. **Surface compliance posture in call 1, not call 2.** For any fintech
   ICP, lead with where we are in the SOC2 process. Don't let a CTO
   discover it on call 2 and lose trust.
2. **Have a Type II timeline ready, written down, signed off internally.**
   "Q1" is a vibe. "March 14, audit firm: Schellman, scope: production
   + dev environments" is an answer.
3. **Identify the compliance gate in qualification.** Add to discovery:
   "Does your security team have a written list of required certifications?
   What's the minimum bar?"

## Salvage path

Devon kept the door open. He asked us to email him in January when
the audit is closer. Don't drop this one — they're our exact ICP
otherwise. Set a calendar nudge for Jan 5.

## What to write into the brain

Lost-reason: **compliance gap**, not product, pricing, or fit. Tag for
"fintech + late-stage Series A" pattern — this is the second time we've
hit this specific wall. If we see a third, we have a category, not a
fluke, and Type II becomes urgent rather than scheduled.
