import type { DebugAccumulator } from "./debug.js";
import { SourceResolver, timedPreload } from "./source-resolver.js";
import type { SourcedImage } from "./url-cache.js";
import { urlCache } from "./url-cache.js";

// SDO publishes HMI Continuum (visible-light sunspot disk) quicklook frames to a dated
// browse archive on a fixed 15-min grid (:00/:15/:30/:45 UTC), named for their real capture
// time — but sdo.gsfc.nasa.gov sends no CORS header, so unlike EPIC's JSON API we can't fetch
// the directory listing from the browser to confirm which slot has actually been published.
// Instead we compute the URL: floor "now minus a publish-latency buffer" to the last 15-min
// slot. One buffer's worth of margin (one slot) covers the typical case; the resolver retries
// up to SUN_MAX_RETRIES further slots back if that guess 404s — covering up to
// SUN_PUBLISH_BUFFER_MS + SUN_MAX_RETRIES * SUN_CACHE_TTL_MS of real publish lag — before
// falling back to the same "unavailable" state as any other failed source. Deliberately
// bounded, not unbounded backward search: a real multi-hour NASA outage should surface as
// "unavailable" like any other failed source, not burn an ever-growing chain of 404s hunting
// for an increasingly stale picture.
export const SDO_BROWSE_BASE_URL = "https://sdo.gsfc.nasa.gov/assets/img/browse";
export const SUN_CACHE_TTL_MS = 15 * 60000;
const SUN_PUBLISH_BUFFER_MS = 20 * 60000;
const SUN_MAX_RETRIES = 3;

export class SdoSunResolver extends SourceResolver {
  readonly source = "sun" as const;

  protected getCached(): SourcedImage | null {
    return urlCache.get("sun", SUN_CACHE_TTL_MS);
  }

  protected fetchCandidateUrl(): Promise<SourcedImage> {
    return Promise.resolve(getSunImageUrl());
  }

  protected async recover(
    err: unknown,
    candidate: SourcedImage,
    debug: DebugAccumulator
  ): Promise<SourcedImage> {
    let slot = candidate;
    let lastErr = err;
    for (let attempt = 0; attempt < SUN_MAX_RETRIES; attempt++) {
      debug.retries++;
      slot = previousSunSlot(slot.date);
      try {
        await timedPreload(slot.url, debug);
        // Committed only for the slot that actually loaded — an attempt that 404s never
        // touches the shared cache, so a concurrent reader (another refresh() tick racing
        // this retry loop) can never observe a still-unconfirmed guess between attempts.
        urlCache.set("sun", slot);
        return slot;
      } catch (retryErr) {
        lastErr = retryErr;
      }
    }
    throw lastErr;
  }
}

export function getSunImageUrl(maxAgeMs = SUN_CACHE_TTL_MS): SourcedImage {
  const cached = urlCache.get("sun", maxAgeMs);
  if (cached) return cached;

  const now = Date.now();
  const slotMs = Math.floor((now - SUN_PUBLISH_BUFFER_MS) / SUN_CACHE_TTL_MS) * SUN_CACHE_TTL_MS;
  const image = buildSunSlotImage(new Date(slotMs));
  urlCache.set("sun", image);
  return image;
}

// One-step fallback for when a slot 404s (NASA's publish pipeline occasionally lags past the
// buffer) — steps back exactly one 15-min slot per call; recover()'s loop bounds how many
// times it's called (SUN_MAX_RETRIES), so this stays a fixed step rather than growing its own
// unbounded chain. Pure — recover() commits the winning slot to the shared cache itself, once,
// so the next getSunImageUrl() call (the periodic background refresh, on whatever cadence
// refresh_mins is set to — not necessarily 15 minutes) reuses the corrected slot rather than
// reverting to the original not-yet-published one (#94 follow-up), and no failed intermediate
// guess is ever visible to a concurrent reader of the cache.
function previousSunSlot(currentSlot: Date): SourcedImage {
  return buildSunSlotImage(new Date(currentSlot.getTime() - SUN_CACHE_TTL_MS));
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
