import type { DocType } from "./docTypes";

const RULES: Array<{ pattern: RegExp; docType: DocType }> = [
  { pattern: /win|won|closed.?won|close.*note|deal.*clos/i, docType: "won_deal" },
  { pattern: /loss|lost|churn|didn.?t.*win|we.*lost|not.*selected/i, docType: "lost_deal" },
  { pattern: /brand.*guide|voice|tone|messaging|how.*we.*write|copy.*guide/i, docType: "brand_guide" },
  { pattern: /icp|ideal.*customer|target.*persona|who.*we.*sell/i, docType: "icp" },
  { pattern: /competitor|vs\.|versus|compared.*to|alternative/i, docType: "competitor_intel" },
  { pattern: /transcript|call.*notes|meeting.*notes|recorded/i, docType: "call_transcript" },
  { pattern: /case.*study|success.*story|customer.*story/i, docType: "case_study" },
  { pattern: /pricing.*objection|price.*pushback|cost.*objection/i, docType: "pricing_objection" },
  { pattern: /faq|frequently.*asked|common.*objection/i, docType: "faq" },
];

export function classifyDocType(filename: string, firstTokens: string): DocType | null {
  const haystack = `${filename} ${firstTokens}`.toLowerCase();
  for (const { pattern, docType } of RULES) {
    if (pattern.test(haystack)) return docType;
  }
  return null;
}
