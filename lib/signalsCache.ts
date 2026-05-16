// In-memory cache for HogAI signals jobs, keyed by sessionId.
// Tracks in-flight job IDs and completed results so we don't double-burn
// credits on concurrent fetches and can short-circuit recent fetches.
// Dies on dev server restart — ZE is the persistent store.

import type { ParsedSignal } from "./signalsClient";

export type CachedFetch = {
  jobId: string;
  startedAt: number;
  completedAt?: number;
  signals?: ParsedSignal[];
};

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const fetchCache = new Map<string, CachedFetch>();

export function getCachedFetch(sessionId: string): CachedFetch | undefined {
  return fetchCache.get(sessionId);
}

export function setCachedFetch(sessionId: string, entry: CachedFetch): void {
  fetchCache.set(sessionId, entry);
}

export function isCacheFresh(entry: CachedFetch): boolean {
  return Boolean(entry.completedAt && Date.now() - entry.completedAt < CACHE_TTL_MS);
}
