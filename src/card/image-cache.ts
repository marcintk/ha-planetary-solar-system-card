export interface SourcedImage {
  url: string;
  date: Date;
}

interface CacheEntry {
  image: SourcedImage;
  fetchedAt: number;
}

// Generic TTL cache keyed by gallery source (one entry per key, overwrite-on-set — no
// eviction beyond that). Owns only the freshness mechanism; image-sources.ts owns what a
// stale entry means for a specific NASA feed (when to refetch, what TTL each source gets).
export class ImageCache {
  private entries = new Map<string, CacheEntry>();

  get(key: string, maxAgeMs: number): SourcedImage | null {
    const entry = this.entries.get(key);
    return entry != null && Date.now() - entry.fetchedAt < maxAgeMs ? entry.image : null;
  }

  set(key: string, image: SourcedImage): void {
    this.entries.set(key, { image, fetchedAt: Date.now() });
  }

  clear(): void {
    this.entries.clear();
  }
}

export const imageCache = new ImageCache();
