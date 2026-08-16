export const EPIC_BASE_URL = "https://epic.gsfc.nasa.gov";
// Two cadences:
// - CLICK: opening a thumbnail is an explicit request for the freshest shot, but still
//   respects a short TTL — otherwise a rapid re-click re-downloads for no new content.
// - GALLERY: everything else (the idling thumbnail strip, and the full-screen view once
//   open) ticks in the background. Earth ticks hourly; Sun ticks every 15 min — matching
//   SUN_SLOT_MS below, since polling faster than the source's own publish grid buys nothing.
export const CLICK_CACHE_TTL_MS = 120000;
const GALLERY_CACHE_TTL_MS = 3600000;

// SDO publishes HMI Continuum (visible-light sunspot disk) quicklook frames to a dated
// browse archive on a fixed 15-min grid (:00/:15/:30/:45 UTC), named for their real capture
// time — but sdo.gsfc.nasa.gov sends no CORS header, so unlike EPIC's JSON API we can't fetch
// the directory listing from the browser to confirm which slot has actually been published.
// Instead we compute the URL: floor "now minus a publish-latency buffer" to the last 15-min
// slot. The buffer trades a small amount of freshness for a single request with no listing
// fetch or retry — if NASA's pipeline ever lags past it, the image 404s and the UI falls back
// to the same "unavailable" state as any other failed source.
export const SDO_BROWSE_BASE_URL = "https://sdo.gsfc.nasa.gov/assets/img/browse";
export const SUN_SLOT_MS = 15 * 60000;
const SUN_PUBLISH_BUFFER_MS = 30 * 60000;

export interface SourcedImage {
  url: string;
  date: Date;
}

const cache = new Map<string, { image: SourcedImage; fetchedAt: number }>();

export function clearImageCache(): void {
  cache.clear();
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

export function getSunImageUrl(maxAgeMs = SUN_SLOT_MS): SourcedImage {
  const now = Date.now();
  const cached = cache.get("sun");
  if (cached && now - cached.fetchedAt < maxAgeMs) return cached.image;

  const slotMs = Math.floor((now - SUN_PUBLISH_BUFFER_MS) / SUN_SLOT_MS) * SUN_SLOT_MS;
  const image = buildSunSlotImage(new Date(slotMs));
  cache.set("sun", { image, fetchedAt: now });
  return image;
}

// One-step fallback for when the computed slot 404s (NASA's publish pipeline occasionally
// lags past the buffer) — steps back exactly one 15-min slot and nothing further, so a
// single stale request doesn't turn into an unbounded retry chain.
export function getPreviousSunSlot(currentSlot: Date): SourcedImage {
  return buildSunSlotImage(new Date(currentSlot.getTime() - SUN_SLOT_MS));
}

export async function fetchLatestEarthImageUrl(
  maxAgeMs = GALLERY_CACHE_TTL_MS
): Promise<SourcedImage> {
  const now = Date.now();
  const cached = cache.get("earth");
  if (cached && now - cached.fetchedAt < maxAgeMs) {
    return cached.image;
  }

  const response = await fetch(`${EPIC_BASE_URL}/api/natural`);
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
  cache.set("earth", { image, fetchedAt: now });
  return image;
}
