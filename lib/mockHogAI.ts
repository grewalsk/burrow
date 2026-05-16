/**
 * Mock HogAI — drop-in replacement for the real HogAI API while we're rate-limited.
 * Two surfaces:
 *   - fetchSignals(): returns a fresh batch of realistic outreach signals
 *   - enrichContact(handle, source): returns mock contact info
 * Both are stable per (handle, source) pair so re-running is deterministic.
 */

import crypto from "node:crypto";

export type HogSource = "REDDIT" | "HACKER NEWS" | "X" | "LINKEDIN";

export type HogSignal = {
  id: string;          // deterministic uuid per source+handle+body hash
  source: HogSource;
  handle: string;
  context?: string;    // subreddit / show HN tag / etc.
  posted_at: number;   // ms
  body: string;
  url: string;
};

export type HogContact = {
  name: string;
  email: string;
  role: string;
  company?: string;
  linkedin?: string;
  confidence: number;  // 0..1, mock
};

const NOW = () => Date.now();
const MIN = 60_000;
const HOUR = 60 * MIN;

const SEED_POOL: Array<Omit<HogSignal, "id" | "posted_at" | "url"> & { ageMin: number }> = [
  {
    source: "REDDIT",
    handle: "u/infra_will",
    context: "r/LocalLLaMA",
    body: "Anyone else getting destroyed by Pinecone pricing? We're 14 people, ~200M vectors, just got our bill and I'm seriously considering moving to Qdrant. What am I missing?",
    ageMin: 4,
  },
  {
    source: "X",
    handle: "@ratchet_ai",
    body: "feels like every founder I talk to this week is quietly migrating off the same three vendors. not gonna name names but you know who you are.",
    ageMin: 2,
  },
  {
    source: "HACKER NEWS",
    handle: "throwaway42",
    body: "Show HN: We hit the limit on our hosted vector DB and had to rebuild our retrieval layer in a weekend. Here's what we learned about cold-start costs and re-indexing.",
    ageMin: 13,
  },
  {
    source: "REDDIT",
    handle: "u/ml_engineer",
    context: "r/MachineLearning",
    body: "How are people handling the trade-off between hosted convenience and self-hosted cost at scale? We're past the break-even point on our managed vector store and it's not subtle anymore.",
    ageMin: 22,
  },
  {
    source: "X",
    handle: "@founderboard",
    body: "Quietly stunned at the bill from our \"managed\" vector DB this month. We barely doubled our index. Anyone have honest numbers on what self-hosting Qdrant or Weaviate looks like at 100M+ vectors?",
    ageMin: 31,
  },
  {
    source: "HACKER NEWS",
    handle: "siberian_dev",
    body: "Ask HN: Is anyone running production retrieval workloads on a single-node Qdrant in 2026, or has it become impossible without sharding? Looking for honest scale stories before we commit.",
    ageMin: 47,
  },
  {
    source: "REDDIT",
    handle: "u/aiops_anon",
    context: "r/devops",
    body: "Migrated off Pinecone last quarter. The first month of self-hosted was rough — backups, snapshots, a long weekend with PagerDuty — but our infra cost dropped 70% and queries got faster. Worth it for us.",
    ageMin: 70,
  },
  {
    source: "LINKEDIN",
    handle: "Maya Chen",
    context: "Director of Platform, Initech",
    body: "Three months in on our managed retrieval migration and the time savings are showing up in real places — our platform engineers finally have time to fix the eval pipeline they've been complaining about for a year.",
    ageMin: 85,
  },
  {
    source: "X",
    handle: "@vector_skeptic",
    body: "Hot take: most teams paying $20k/mo for a hosted vector DB could halve that bill by reading their own access logs and tuning their chunk sizes. Almost no one does it.",
    ageMin: 95,
  },
  {
    source: "REDDIT",
    handle: "u/staff_eng_42",
    context: "r/dataengineering",
    body: "Our re-indexing job has been flaky for two months and the person who built it left. I think we have to pay someone to come look at it because nobody internal wants to touch the cluster.",
    ageMin: 110,
  },
  {
    source: "LINKEDIN",
    handle: "Devon Park",
    context: "Staff Engineer, Acme Financial",
    body: "Vendor evaluation season. We're looking at three managed retrieval providers and the bar this time is SOC2 Type II — not negotiable for our fintech compliance team. If anyone has Type II audit timelines they can share, would appreciate it.",
    ageMin: 125,
  },
  {
    source: "HACKER NEWS",
    handle: "rag_at_scale",
    body: "Ask HN: When does it stop making sense to use a hosted vector DB? We're at 80M vectors, RAG product, Series B. Bill just crossed $7k/mo and finance is asking pointed questions.",
    ageMin: 145,
  },
  {
    source: "REDDIT",
    handle: "u/platform_lead",
    context: "r/devops",
    body: "Hot take: the moment your hosted-vector bill crosses your platform engineer's salary, the build-vs-buy math flips. We're not there yet but it's not far.",
    ageMin: 160,
  },
  {
    source: "X",
    handle: "@elena_builds",
    body: "Re-indexing 200M vectors at 3am because the chunking strategy changed and I'm questioning every career decision that led me here.",
    ageMin: 175,
  },
  {
    source: "LINKEDIN",
    handle: "Anika Rao",
    context: "Founder/CTO, PiedPiper RAG",
    body: "We replaced our internal vector cluster after a year of trying to keep it alive. Net result: no on-call rotation for retrieval and the engineering team has stopped flinching when Slack notifies them.",
    ageMin: 195,
  },
  {
    source: "REDDIT",
    handle: "u/just_another_eng",
    context: "r/LocalLLaMA",
    body: "Pinecone vs self-hosted Qdrant for ~50M vectors at a small startup — what should we actually look at? Bill is starting to hurt and the migration tools I'm seeing don't all feel mature.",
    ageMin: 220,
  },
  {
    source: "HACKER NEWS",
    handle: "rag_skeptic",
    body: "I keep seeing folks claim 'our retrieval costs went down 70% after self-hosting'. I want to see the actual numbers, with eng hours included. Without those, the comparison is dishonest.",
    ageMin: 240,
  },
  {
    source: "X",
    handle: "@platform_kate",
    body: "PSA: if your vector DB vendor's pricing page says 'starting at $X', the real bill at 100M vectors is 4-6x that. Ask for production-scale quotes before you start chunking.",
    ageMin: 260,
  },
  {
    source: "LINKEDIN",
    handle: "Marcus Liu",
    context: "Eng Manager, fintech (stealth)",
    body: "Sourcing recommendations: managed retrieval for a regulated industry. Need SOC2 Type II, data residency controls, and dedicated cluster. Open to introductions.",
    ageMin: 280,
  },
  {
    source: "REDDIT",
    handle: "u/yet_another_lead",
    context: "r/MachineLearning",
    body: "Our RAG product is hitting production traffic and our prototype-grade Pinecone setup is starting to wobble. Looking for actually-used solutions for going from 'demo works' to '99.9% retrieval latency'.",
    ageMin: 310,
  },
  {
    source: "X",
    handle: "@dario_eng",
    body: "Our re-indexing job took 14 hours last weekend. Our previous one took 3. Nobody can explain why and nobody has time to dig in. This is the actual cost of 'managed' vector DBs nobody talks about.",
    ageMin: 330,
  },
  {
    source: "HACKER NEWS",
    handle: "tired_cto",
    body: "Show HN: I wrote a small tool that estimates the true cost of self-hosting vs managed vector DBs at different scales. Spoiler: it's not the cluster cost that gets you, it's the on-call hours.",
    ageMin: 360,
  },
  {
    source: "REDDIT",
    handle: "u/migration_diaries",
    context: "r/MachineLearning",
    body: "Week 4 of our Pinecone → Qdrant migration. Honestly the import tool from the new vendor saved us from cancelling the project. If yours is wobbly, demand to see their migration story first.",
    ageMin: 410,
  },
  {
    source: "LINKEDIN",
    handle: "Priya Shah",
    context: "VP Eng, Bay Area SaaS",
    body: "Looking for a managed retrieval vendor that doesn't try to sell us 'enterprise AI search'. We just want to outsource the cluster ops. Anyone have a recommendation that isn't trying to be everything?",
    ageMin: 440,
  },
  {
    source: "X",
    handle: "@infra_irl",
    body: "Burn rate finally caught up with our vector DB choice. Switching providers in week 3 of a 12-week sprint is the kind of decision that aged me five years.",
    ageMin: 480,
  },
];

const FIRST_NAMES = ["Maya", "Devon", "Priya", "Marcus", "Elena", "Anika", "Liam", "Carl", "Nora", "Ravi", "Yuki", "Sam", "Iris", "Theo", "Jules"];
const LAST_NAMES = ["Chen", "Park", "Shah", "Liu", "Velasquez", "Rao", "Brennan", "Okafor", "Mendel", "Patel", "Sato", "Garcia", "Wallach", "Mori", "Becker"];
const ROLES = ["Staff Platform Engineer", "Director of Engineering", "VP Engineering", "Founding Engineer", "Head of Infra", "Principal SRE", "CTO", "Tech Lead"];
const COMPANIES_BY_DOMAIN: Record<string, string> = {
  initech: "Initech",
  acme: "Acme Financial",
  piedpiper: "Pied Piper",
};

function sha8(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 8);
}

function fakeUrl(source: HogSource, handle: string, id: string): string {
  switch (source) {
    case "REDDIT":
      return `https://reddit.com/r/MachineLearning/comments/${id.slice(0, 6)}`;
    case "HACKER NEWS":
      return `https://news.ycombinator.com/item?id=${parseInt(id.slice(0, 6), 16)}`;
    case "X":
      return `https://x.com/${handle.replace("@", "")}/status/${id.slice(0, 12)}`;
    case "LINKEDIN":
      return `https://www.linkedin.com/posts/${handle.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${id.slice(0, 6)}`;
  }
}

export function fetchSignals(): HogSignal[] {
  const now = NOW();
  return SEED_POOL.map((s) => {
    const id = sha8(`${s.source}:${s.handle}:${s.body}`);
    return {
      id,
      source: s.source,
      handle: s.handle,
      context: s.context,
      posted_at: now - s.ageMin * MIN,
      body: s.body,
      url: fakeUrl(s.source, s.handle, id),
    };
  });
}

function pickFromHash(arr: string[], hash: string, offset: number): string {
  const idx = parseInt(hash.slice(offset, offset + 4), 16) % arr.length;
  return arr[idx];
}

export function enrichContact(signal: { handle: string; context?: string; source: HogSource }): HogContact {
  // Deterministic per (handle, source). LinkedIn handles already look like real names.
  const seedKey = `${signal.source}:${signal.handle}:${signal.context ?? ""}`;
  const hash = crypto.createHash("sha256").update(seedKey).digest("hex");

  let name: string;
  let company: string | undefined;
  let role: string;

  if (signal.source === "LINKEDIN") {
    name = signal.handle;
    const ctx = signal.context ?? "";
    const m = ctx.match(/,?\s*([A-Z][\w& ]+)$/);
    company = m ? m[1].trim() : undefined;
    role = ctx.split(",")[0]?.trim() || pickFromHash(ROLES, hash, 0);
  } else {
    name = `${pickFromHash(FIRST_NAMES, hash, 0)} ${pickFromHash(LAST_NAMES, hash, 4)}`;
    role = pickFromHash(ROLES, hash, 8);
    const dom = Object.keys(COMPANIES_BY_DOMAIN)[parseInt(hash.slice(12, 16), 16) % 3];
    company = COMPANIES_BY_DOMAIN[dom];
  }

  const emailLocal = name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "");
  const emailDomain = company ? `${company.toLowerCase().replace(/[^a-z]+/g, "")}.com` : "example.com";
  const email = `${emailLocal}@${emailDomain}`;
  const linkedin = `https://www.linkedin.com/in/${emailLocal.replace(/\./g, "-")}`;
  const confidence = 0.7 + (parseInt(hash.slice(16, 18), 16) % 30) / 100; // 0.70..0.99

  return { name, email, role, company, linkedin, confidence };
}
