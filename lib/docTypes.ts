export type DocType =
  | "won_deal"
  | "lost_deal"
  | "brand_guide"
  | "icp"
  | "competitor_intel"
  | "call_transcript"
  | "case_study"
  | "pricing_objection"
  | "faq";

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  won_deal: "Past win",
  lost_deal: "Past loss",
  brand_guide: "Brand voice",
  icp: "Ideal customer",
  competitor_intel: "Competitor",
  call_transcript: "Call transcript",
  case_study: "Case study",
  pricing_objection: "Pricing objection",
  faq: "FAQ / common objections",
};

export const DOC_TYPE_DESCRIPTIONS: Record<DocType, string> = {
  won_deal: "A deal you closed — call notes, email thread, or summary",
  lost_deal: "A deal you lost — what happened, why",
  brand_guide: "How you write: tone, phrases to use/avoid, example copy",
  icp: "Who you're selling to: role, company size, pain, triggers",
  competitor_intel: "One competitor per doc — what they offer, where they lose",
  call_transcript: "A text transcript of a sales or discovery call",
  case_study: "A published or internal success story",
  pricing_objection: "How you handle price pushback",
  faq: "Objections you hear regularly and how you answer them",
};

export const MVC_DOC_TYPES: DocType[] = ["won_deal", "lost_deal", "brand_guide", "icp"];

export const P2_DOC_TYPES: DocType[] = ["competitor_intel", "call_transcript", "case_study"];
export const P3_DOC_TYPES: DocType[] = ["pricing_objection", "faq"];

export function isDocType(value: unknown): value is DocType {
  return typeof value === "string" && value in DOC_TYPE_LABELS;
}
