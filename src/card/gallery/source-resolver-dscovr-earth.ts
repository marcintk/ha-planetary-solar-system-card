import type { DebugAccumulator } from "./debug-stats.js";
import { FETCH_TIMEOUT_MS, SourceResolver, timedAttempt } from "./source-resolver.js";
import type { SourcedImage, UrlCache } from "./url-cache.js";
import { urlCache } from "./url-cache.js";

export const EPIC_BASE_URL = "https://epic.gsfc.nasa.gov";

// Carries a server-supplied Retry-After (429 responses) so source-resolver.ts's cooldown can
// honor it as a floor over its own computed backoff. EPIC is the only source that can surface
// this — SDO's <img>-based loads expose no HTTP status or headers to the browser at all.
export class EpicApiError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs?: number
  ) {
    super(message);
  }
}

// Retry-After is either delta-seconds ("120") or an HTTP-date ("Wed, 21 Oct 2026 07:28:00
// GMT") — RFC 9110 §10.2.3 allows both forms.
function parseRetryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (!Number.isNaN(seconds)) return seconds * 1000;
  const dateMs = Date.parse(header);
  return Number.isNaN(dateMs) ? undefined : Math.max(0, dateMs - Date.now());
}
// Shared by the gallery thumbnail's background poll, the full-screen view's click-open
// fetch, and its own background refresh once open — so clicking a thumbnail always reuses
// the exact image already loaded rather than computing a slightly newer one and forcing an
// extra network fetch. Hourly: DSCOVR/EPIC publishes natural-color earth images roughly
// hourly, so polling faster buys nothing.
export const EARTH_CACHE_TTL_MS = 3600000;

export class DscovrEarthResolver extends SourceResolver {
  readonly source = "earth" as const;

  protected getCached(): SourcedImage | null {
    return this.cache.get("earth", EARTH_CACHE_TTL_MS);
  }

  protected fetchCandidateUrl(debug: DebugAccumulator): Promise<SourcedImage> {
    return timedAttempt(() => fetchLatestEarthImageUrl(EARTH_CACHE_TTL_MS, this.cache), debug);
  }
}

export async function fetchLatestEarthImageUrl(
  maxAgeMs = EARTH_CACHE_TTL_MS,
  cache: UrlCache = urlCache
): Promise<SourcedImage> {
  const cached = cache.get("earth", maxAgeMs);
  if (cached) return cached;

  const response = await fetch(`${EPIC_BASE_URL}/api/natural`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new EpicApiError(
      `EPIC API request failed: ${response.status}`,
      parseRetryAfterMs(response.headers?.get("retry-after") ?? null)
    );
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
  cache.set("earth", image);
  return image;
}
