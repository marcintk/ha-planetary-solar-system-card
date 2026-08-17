import type { DebugAccumulator } from "./debug.js";
import type { SourcedImage } from "./image-cache.js";
import { imageCache } from "./image-cache.js";
import { FETCH_TIMEOUT_MS, SourceResolver, timedAttempt } from "./source-resolver.js";

export const EPIC_BASE_URL = "https://epic.gsfc.nasa.gov";
// Shared by the gallery thumbnail's background poll, the full-screen view's click-open
// fetch, and its own background refresh once open — so clicking a thumbnail always reuses
// the exact image already loaded rather than computing a slightly newer one and forcing an
// extra network fetch. Hourly: DSCOVR/EPIC publishes natural-color earth images roughly
// hourly, so polling faster buys nothing.
export const EARTH_CACHE_TTL_MS = 3600000;

export class DscovrEarthResolver extends SourceResolver {
  readonly source = "earth" as const;

  protected getCached(): SourcedImage | null {
    return imageCache.get("earth", EARTH_CACHE_TTL_MS);
  }

  protected fetchCandidate(debug: DebugAccumulator): Promise<SourcedImage> {
    return timedAttempt(fetchLatestEarthImageUrl, debug);
  }
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
