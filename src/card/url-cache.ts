export interface SourcedImage {
  url: string;
  date: Date;
}

interface CacheEntry {
  image: SourcedImage;
  fetchedAt: number;
}

// Generic TTL cache keyed by gallery source (one entry per key, overwrite-on-set — no
// eviction beyond that). Owns only the freshness mechanism; each source's own resolver module
// (source-resolver-dscovrearth.ts, source-resolver-sdosun.ts) owns what a stale entry means for its NASA
// feed (when to refetch, what TTL it gets).
//
// Also owns decode identity per key: which URL that source last confirmed loads. TTL freshness
// and decode identity answer different questions (is our candidate lookup still current vs.
// have we already paid the decode cost for this exact URL) and don't share a clock — a TTL can
// expire while the recomputed candidate is still the same URL we've already decoded. Both live
// here, not split into a second field on the caller, since both are "what do we already know
// about this source's state" and a caller needing one usually needs the other in the same call.
export class UrlCache {
  private entries = new Map<string, CacheEntry>();
  private decoded = new Map<string, string>();

  get(key: string, maxAgeMs: number): SourcedImage | null {
    const entry = this.entries.get(key);
    return entry != null && Date.now() - entry.fetchedAt < maxAgeMs ? entry.image : null;
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

  clear(): void {
    this.entries.clear();
    this.decoded.clear();
  }
}

export const urlCache = new UrlCache();
