import type { DebugAccumulator } from "./debug.js";
import type { SourcedImage } from "./image-cache.js";
import { imageCache } from "./image-cache.js";
import { SourceResolver, timedPreload } from "./source-resolver.js";

// SDO publishes HMI Continuum (visible-light sunspot disk) quicklook frames to a dated
// browse archive on a fixed 15-min grid (:00/:15/:30/:45 UTC), named for their real capture
// time — but sdo.gsfc.nasa.gov sends no CORS header, so unlike EPIC's JSON API we can't fetch
// the directory listing from the browser to confirm which slot has actually been published.
// Instead we compute the URL: floor "now minus a publish-latency buffer" to the last 15-min
// slot. One buffer's worth of margin (one slot) covers the typical case; the resolver retries
// once, a further slot back, if that guess 404s — so the buffer only needs to cover the
// common case, not the worst case, before falling back to the same "unavailable" state as any
// other failed source.
export const SDO_BROWSE_BASE_URL = "https://sdo.gsfc.nasa.gov/assets/img/browse";
export const SUN_CACHE_TTL_MS = 15 * 60000;
const SUN_PUBLISH_BUFFER_MS = 15 * 60000;

export class SdoSunResolver extends SourceResolver {
  readonly source = "sun" as const;

  protected getCached(): SourcedImage | null {
    return imageCache.get("sun", SUN_CACHE_TTL_MS);
  }

  protected fetchCandidate(): Promise<SourcedImage> {
    return Promise.resolve(getSunImageUrl());
  }

  protected async recover(
    _err: unknown,
    candidate: SourcedImage,
    debug: DebugAccumulator
  ): Promise<SourcedImage> {
    debug.retries++;
    const fallback = getPreviousSunSlot(candidate.date);
    await timedPreload(fallback.url, debug);
    return fallback;
  }
}

export function getSunImageUrl(maxAgeMs = SUN_CACHE_TTL_MS): SourcedImage {
  const cached = imageCache.get("sun", maxAgeMs);
  if (cached) return cached;

  const now = Date.now();
  const slotMs = Math.floor((now - SUN_PUBLISH_BUFFER_MS) / SUN_CACHE_TTL_MS) * SUN_CACHE_TTL_MS;
  const image = buildSunSlotImage(new Date(slotMs));
  imageCache.set("sun", image);
  return image;
}

// One-step fallback for when the computed slot 404s (NASA's publish pipeline occasionally
// lags past the buffer) — steps back exactly one 15-min slot and nothing further, so a
// single stale request doesn't turn into an unbounded retry chain. Writes the corrected
// slot back into the shared cache: without this, the cache still held the original
// not-yet-published slot, so the next getSunImageUrl() call (the periodic background
// refresh, on whatever cadence refresh_mins is set to — not necessarily 15 minutes) would
// hand that same bad slot straight back out, reverting the already-corrected image and
// failing again with no retry left (#94 follow-up).
export function getPreviousSunSlot(currentSlot: Date): SourcedImage {
  const image = buildSunSlotImage(new Date(currentSlot.getTime() - SUN_CACHE_TTL_MS));
  imageCache.set("sun", image);
  return image;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function buildSunSlotImage(slot: Date): SourcedImage {
  const year = slot.getUTCFullYear();
  const month = pad(slot.getUTCMonth() + 1);
  const day = pad(slot.getUTCDate());
  const hhmmss = `${pad(slot.getUTCHours())}${pad(slot.getUTCMinutes())}00`;
  return {
    url: `${SDO_BROWSE_BASE_URL}/${year}/${month}/${day}/${year}${month}${day}_${hhmmss}_1024_HMIIC.jpg`,
    date: slot,
  };
}
