import type { ImageSource } from "./card-template.js";
import type { SourcedImage } from "./image-cache.js";
import { imageCache } from "./image-cache.js";

export type { SourcedImage } from "./image-cache.js";

export const EPIC_BASE_URL = "https://epic.gsfc.nasa.gov";
// One cache TTL per source, shared by the gallery thumbnail's background poll, the
// full-screen view's click-open fetch, and its own background refresh once open — so
// clicking a thumbnail always reuses the exact image already loaded rather than computing
// a slightly newer slot and forcing an extra network fetch. Earth: hourly. Sun: every
// 15 min, matching SUN_CACHE_TTL_MS below (polling faster than its own publish grid buys nothing).
const EARTH_CACHE_TTL_MS = 3600000;

// Bounds a hung network request — without it, a stalled fetch or image load has no
// app-level ceiling and blocks that gallery source indefinitely (only the browser's own
// network stack would eventually give up, if ever). Shared by the EPIC JSON fetch here and
// the image-decode preload in card.ts, so both NASA hosts are bounded the same way.
export const FETCH_TIMEOUT_MS = 15000;

// SDO publishes HMI Continuum (visible-light sunspot disk) quicklook frames to a dated
// browse archive on a fixed 15-min grid (:00/:15/:30/:45 UTC), named for their real capture
// time — but sdo.gsfc.nasa.gov sends no CORS header, so unlike EPIC's JSON API we can't fetch
// the directory listing from the browser to confirm which slot has actually been published.
// Instead we compute the URL: floor "now minus a publish-latency buffer" to the last 15-min
// slot. One buffer's worth of margin (one slot) covers the typical case; both the gallery
// thumbnail and full-screen view retry once, a further slot back, if that guess 404s — so
// the buffer only needs to cover the common case, not the worst case, before falling back to
// the same "unavailable" state as any other failed source.
export const SDO_BROWSE_BASE_URL = "https://sdo.gsfc.nasa.gov/assets/img/browse";
export const SUN_CACHE_TTL_MS = 15 * 60000;
const SUN_PUBLISH_BUFFER_MS = 15 * 60000;

// Lets a freshly-constructed GalleryController (e.g. after HA remounts the card element)
// recover the still-fresh URL this module already cached, instead of starting with no known
// URL — without this, the URL-identity gate in gallery-controller.ts's resolveDisplayImage
// always misses on the first tick after a remount (knownUrl undefined never equals a real
// URL), forcing a redundant preload/decode of bytes this cache already confirmed are current.
export function getCachedImage(source: ImageSource): SourcedImage | null {
  const maxAgeMs = source === "earth" ? EARTH_CACHE_TTL_MS : SUN_CACHE_TTL_MS;
  return imageCache.get(source, maxAgeMs);
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

export async function fetchLatestEarthImageUrl(
  maxAgeMs = EARTH_CACHE_TTL_MS
): Promise<SourcedImage> {
  const cached = imageCache.get("earth", maxAgeMs);
  if (cached) return cached;

  const response = await fetch(`${EPIC_BASE_URL}/api/natural`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`EPIC API request failed: ${response.status}`);
  }
  const images = (await response.json()) as Array<{ identifier: string }>;
  const latest = images[images.length - 1];
  if (!latest) {
    throw new Error("EPIC API returned no images");
  }
  const { identifier } = latest;
  const year = identifier.slice(0, 4);
  const month = identifier.slice(4, 6);
  const day = identifier.slice(6, 8);
  const hour = identifier.slice(8, 10);
  const minute = identifier.slice(10, 12);
  const second = identifier.slice(12, 14);
  const image = {
    url: `${EPIC_BASE_URL}/archive/natural/${year}/${month}/${day}/jpg/epic_1b_${identifier}.jpg`,
    date: new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second)
      )
    ),
  };
  imageCache.set("earth", image);
  return image;
}
