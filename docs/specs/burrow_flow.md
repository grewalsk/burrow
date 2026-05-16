# Burrow — Product Flow

## Overview

Burrow is an AI-native outreach platform that researches a company's online presence, identifies signals of outreach opportunity, and drafts personalized emails — all with minimal manual effort.

---

## Frame 1 — Landing Page

The user arrives at the Burrow landing page, which includes a link to the company website and a **Submit** button to begin the onboarding flow.

---

## Frame 2 — Company Research Agent (`cr_agent`)

After the user submits their website URL, it is passed to the **Company Researcher Agent**, which runs three sequential steps:

1. **Discovery** — Crawls the website and scrapes all `href` links to identify every accessible page.
2. **Selection** — Evaluates which pages are most useful for gathering intelligence on:
   - What the company does
   - Pricing
   - Features
   - Reviews / success stories
3. **Extraction** — Visits the selected pages and collects the relevant information.

Once complete, the gathered data is forwarded to the next step in the flow.

---

## Frame 3 — User Review Form

The next page presents the user with a pre-populated form based on what `cr_agent` discovered. Fields include:

- What the company does
- Pricing
- Features
- Success stories
- Competitors
- *(Additional fields as relevant)*

The user can **manually edit** any field they feel is inaccurate or incomplete. Once satisfied, they hit **Submit** to send the data to the Brain.

---

## Frame 4 — The Brain (Initial Structuring)

The **Brain** agent receives the form data, structures it into a clean, standardized format, and stores it in **ZeroEntropy** for retrieval later in the flow.

---

## Frame 5 — Burrow Main Dashboard

The user is brought to the main Burrow interface, which has three sections:

- **Top bar** — Key metrics at a glance
- **Left sidebar** — Slack-style channels (e.g., Drafts, Signals, Sent)
- **Main panel** — Contents of the selected channel (drafts, signals, sent emails, etc.)

---

## Frame 6 — Fetch Signals

A button in the **top-right corner** of the dashboard triggers a call to a tool that queries the **HogAI API**. This returns a set of signals — social posts, comments, tweets, etc. — where there may be outreach opportunities relevant to the user's company.

---

## Frame 7 — Brain Stores Signals

The signals returned from HogAI are passed back to the **Brain**, which formats the data appropriately and stores it in **ZeroEntropy**.

---

## Frame 8 — Generate Outreach Opportunities

The user clicks a separate button to ask Burrow to identify the best outreach opportunities from the signals collected.

---

## Frame 9 — ZeroEntropy Ranking

**ZeroEntropy's ranker** evaluates all stored signals and surfaces the **top 5 outreach opportunities** that make sense to pursue simultaneously.

> If none of the signals meet the threshold for outreach compatibility, no results are shown.

---

## Frame 10 — Contact Enrichment

For each selected signal, the **HogAI enrichment endpoint** is called to look up the contact information of the person who made the post, comment, or tweet.

---

## Frame 11 — Draft Generation

A **free HuggingFace model** drafts a personalized outreach email for each contact, tailored to the signal that triggered their selection. The draft is placed in the **Drafts channel** of the Burrow dashboard.

---

## Frame 12 — Review & Send

The user can browse their drafts in the Drafts channel. When ready, they hit **Send** on a draft, which:

1. Sends the email to the contact
2. Moves the email to the **Sent channel** for reference
