import { Backoff } from "./backoff.js";

export interface SourcedImage {
  url: string;
  date: Date;
}

export interface CacheEntry {
  image: SourcedImage;
  fetchedAt: number;
}

// Generic TTL cache keyed by gallery source (one entry per key, overwrite-on-set — no
// eviction beyond that). Owns only the freshness mechanism; each source's own resolver module
// (source-resolver-dscovr-earth.ts, source-resolver-sdo-sun.ts) owns what a stale entry means for its NASA
// feed (when to refetch, what TTL it gets).
//
// Also owns decode identity per key: which URL that source last confirmed loads. TTL freshness
// and decode identity answer different questions (is our candidate lookup still current vs.
// have we already paid the decode cost for this exact URL) and don't share a clock — a TTL can
// expire while the recomputed candidate is still the same URL we've already decoded. Both live
// here, not split into a second field on the caller, since both are "what do we already know
// about this source's state" and a caller needing one usually needs the other in the same call.
//
// Delegates cooldown/backoff (inCooldown, getStale, recordFailure, recordSuccess) to Backoff
// (backoff.ts) — a distinct clock (consecutive failures) answering a distinct question ("should
// we even attempt the network"), kept as a separate class rather than more fields here.
export class UrlCache {
  private entries = new Map<string, CacheEntry>();
  private decoded = new Map<string, string>();
  private backoff = new Backoff();
  // Distinct from `entries.fetchedAt`, which an optimistic guess (getSunImageUrl) also
  // writes, at a different moment per card instance — using that as a "when did we last
  // actually check" clock would reintroduce #122's cross-card desync. Only sun's recover()
  // stamps this, and only for its "still nothing newer" outcome (#152).
  private lastChecked = new Map<string, number>();

  get(key: string, maxAgeMs: number): SourcedImage | null {
    const entry = this.entries.get(key);
    return entry != null && Date.now() - entry.fetchedAt < maxAgeMs ? entry.image : null;
  }

  // Raw read exposing the fetch instant alongside the image, bypassing `get`'s TTL filter —
  // sun's resolver needs both to tell a normal in-window commit from an overdue recovery
  // commit apart (see source-resolver-sdo-sun.ts's freshCachedSlot), something a single
  // TTL-filtered read can't distinguish.
  getEntry(key: string): CacheEntry | null {
    return this.entries.get(key) ?? null;
  }

  getStale(key: string): SourcedImage | null {
    return this.backoff.getStale(key);
  }

  set(key: string, image: SourcedImage): void {
    this.entries.set(key, { image, fetchedAt: Date.now() });
  }

  isDecoded(key: string, url: string): boolean {
    return this.decoded.get(key) === url;
  }

  markDecoded(key: string, url: string): void {
    this.decoded.set(key, url);
  }

  inCooldown(key: string): boolean {
    return this.backoff.inCooldown(key);
  }

  recordChecked(key: string): void {
    this.lastChecked.set(key, Date.now());
  }

  getLastCheckedAt(key: string): number | undefined {
    return this.lastChecked.get(key);
  }

  recordFailure(key: string, retryAfterMs?: number): void {
    this.backoff.recordFailure(key, retryAfterMs);
  }

  recordSuccess(key: string, image: SourcedImage): void {
    this.backoff.recordSuccess(key, image);
  }

  clear(): void {
    this.entries.clear();
    this.decoded.clear();
    this.backoff.clear();
    this.lastChecked.clear();
  }
}

export const urlCache = new UrlCache();
