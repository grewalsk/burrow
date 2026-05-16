import type { HogSource } from "./mockHogAI";

export type SignalStatus = "new" | "ranked" | "enriched" | "drafted" | "sent";

export type SignalDoc = {
  id: string;
  path: string;        // ZE path (e.g. "<hash>.signal.json")
  source: HogSource;
  handle: string;
  context?: string;
  posted_at: number;   // ms
  body: string;
  url: string;
  status: SignalStatus;
  fit_score?: number;      // set during ranking
  matches?: string;        // human-readable evidence label
  contact_name?: string;
  contact_email?: string;
  contact_role?: string;
  contact_company?: string;
  contact_linkedin?: string;
  contact_confidence?: number;
};

export type DraftDoc = {
  id: string;
  path: string;
  signal_id: string;
  contact_name: string;
  contact_email: string;
  subject: string;
  body: string;
  evidence: string[];     // doc_type or filename refs used
  created_at: number;
  status: "pending" | "sent";
};

export type SentDoc = DraftDoc & {
  status: "sent";
  sent_at: number;
};

export type BrainStatus = {
  brand_docs: number;
  signals: number;
  ranked_signals: number;
  drafts_pending: number;
  drafts_sent: number;
  grounded_pct: number;
};
