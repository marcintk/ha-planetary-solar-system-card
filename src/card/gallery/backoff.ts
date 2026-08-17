import type { SourcedImage } from "./url-cache.js";

// Cooldown after repeated fetch failures, so a sustained NASA outage/rate-limit doesn't
// retry at full TTL cadence forever. Doubles per consecutive failure up to MAX_BACKOFF_MS;
// a server-supplied Retry-After (EPIC 429s only — SDO's <img> loads expose no HTTP status)
// acts as a floor over the computed value, never shortens it.
const BASE_BACKOFF_MS = 60000;
const MAX_BACKOFF_MS = 6 * 3600000;

// Per-source cooldown/backoff state, keyed the same as UrlCache (one instance owned by it).
// Split out from UrlCache's TTL-cache/decode-identity concerns since this answers a different
// question — not "is our candidate still fresh" but "should we even attempt the network right
// now" — with its own clock (failure count) rather than piggybacking on entry age.
export class Backoff {
  private failures = new Map<string, number>();
  private cooldowns = new Map<string, number>();
  // Separate from UrlCache's TTL entries: sun's candidate URL is written there
  // optimistically, before its preload/decode confirms it actually loads (see
  // getSunImageUrl in source-resolver-sdosun.ts) — so that cache can hold a
  // still-unconfirmed, possibly-bad guess. `lastConfirmed` is only ever written via
  // recordSuccess() after a real decode success, so it's safe to serve during a cooldown.
  private lastConfirmed = new Map<string, SourcedImage>();

  inCooldown(key: string): boolean {
    return Date.now() < (this.cooldowns.get(key) ?? 0);
  }

  // Ignores TTL age entirely — for serving the last confirmed-good image during a cooldown,
  // where the alternative is no image at all rather than a slightly stale one.
  getStale(key: string): SourcedImage | null {
    return this.lastConfirmed.get(key) ?? null;
  }

  recordFailure(key: string, retryAfterMs?: number): void {
    const failures = (this.failures.get(key) ?? 0) + 1;
    this.failures.set(key, failures);
    const backoffMs = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (failures - 1));
    this.cooldowns.set(key, Date.now() + Math.max(backoffMs, retryAfterMs ?? 0));
  }

  recordSuccess(key: string, image: SourcedImage): void {
    this.failures.delete(key);
    this.cooldowns.delete(key);
    this.lastConfirmed.set(key, image);
  }

  clear(): void {
    this.failures.clear();
    this.cooldowns.clear();
    this.lastConfirmed.clear();
  }
}
