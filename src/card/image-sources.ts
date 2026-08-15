export const EPIC_BASE_URL = "https://epic.gsfc.nasa.gov";
// Three cadences, from most to least frequent background traffic:
// - CLICK: opening a thumbnail is an explicit request for the freshest shot, but still
//   respects a short TTL — otherwise a rapid re-click re-downloads for no new content.
// - FULL_PANEL: while the full-screen image stays open, it keeps itself fresh on its own.
// - GALLERY: the thumbnail strip's background ticks, much slower to avoid hammering NASA's
//   (slow, ~1-2s per image) servers for a view that's just idling in the background.
export const CLICK_CACHE_TTL_MS = 120000;
export const FULL_PANEL_CACHE_TTL_MS = 900000;
const GALLERY_CACHE_TTL_MS = 3600000;

// SDO's fixed-filename "latest" HMI Continuum (visible-light sunspot disk) JPG.
// sdo.gsfc.nasa.gov sends no CORS header, so unlike EPIC we can't fetch a directory
// listing to resolve a real per-image timestamp from the browser — this URL always
// serves the newest frame under the same name, cache-busted via a query param, and
// dated to when we last checked rather than when it was captured.
export const SUN_IMAGE_URL = "https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_HMIIC.jpg";

export interface SourcedImage {
  url: string;
  date: Date;
}

const cache = new Map<string, { image: SourcedImage; fetchedAt: number }>();

export function clearImageCache(): void {
  cache.clear();
}

export function getSunImageUrl(maxAgeMs = GALLERY_CACHE_TTL_MS): SourcedImage {
  const now = Date.now();
  const cached = cache.get("sun");
  if (cached && now - cached.fetchedAt < maxAgeMs) return cached.image;
  const image = { url: `${SUN_IMAGE_URL}?t=${now}`, date: new Date(now) };
  cache.set("sun", { image, fetchedAt: now });
  return image;
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
