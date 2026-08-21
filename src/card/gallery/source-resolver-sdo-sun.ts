import type { DebugAccumulator } from "./debug.js";
import { IMAGE_TIMEOUT_MESSAGE, SourceResolver, timedPreload } from "./source-resolver.js";
import type { SourcedImage, UrlCache } from "./url-cache.js";
import { urlCache } from "./url-cache.js";

// SDO publishes HMI Continuum (visible-light sunspot disk) quicklook frames to a dated
// browse archive on a fixed 15-min grid (:00/:15/:30/:45 UTC), named for their real capture
// time — but sdo.gsfc.nasa.gov sends no CORS header, so unlike EPIC's JSON API we can't fetch
// the directory listing from the browser to confirm which slot has actually been published.
// Instead we compute the URL: floor "now minus a publish-latency buffer" to the last 15-min
// slot, and if that frame isn't up yet, search backwards for the newest one that is.
//
// The buffer is 30 minutes because that is what SDO measurably does: a slot goes up 25 min
// after capture (:15/:45) or 30 min (:00/:30), with no jitter across a full sampled day. The
// old 20 asked for frames that could not exist yet and 404'd on half of all refreshes (#148).
//
// The search is bounded by what we already know rather than by a fixed retry count:
//
//   - We have a confirmed frame (the normal case, including after an HA remount, since the
//     module-level cache outlives the element). Everything at or below it is already answered,
//     so the only open question is whether NASA published anything newer. One probe at
//     lastConfirmed + one slot settles it. A miss means the feed has not moved and we hand
//     back what we already had — so a multi-day stall costs two requests per refresh, not a
//     fresh backward walk each time.
//   - That probe hits, so the feed did move. Binary-search between it and the failed guess to
//     land on the newest frame in one tick, rather than creeping forward a slot per refresh
//     and taking eight hours to catch up from an eight-hour stall.
//   - Nothing confirmed yet (a genuinely cold start). Double the reach — one slot, two, four —
//     until something loads, then bisect inside that bracket. Logarithmic, so 30 days of reach
//     costs about a dozen requests where a per-slot walk would cost 2880.
//
// Still deliberately bounded at SUN_MAX_REACH_MS: past a month this is not publish lag, and
// the source should surface as "unavailable" like any other dead feed and hand off to
// Backoff's cooldown rather than hunting for an ever-staler picture.
export const SDO_BROWSE_BASE_URL = "https://sdo.gsfc.nasa.gov/assets/img/browse";
export const SUN_CACHE_TTL_MS = 15 * 60000;
const SUN_PUBLISH_BUFFER_MS = 30 * 60000;
const SUN_MAX_REACH_MS = 30 * 24 * 60 * 60000;

export class SdoSunResolver extends SourceResolver {
  readonly source = "sun" as const;

  protected getCached(): SourcedImage | null {
    return freshCachedSlot(this.cache);
  }

  protected fetchCandidateUrl(): Promise<SourcedImage> {
    return Promise.resolve(getSunImageUrl(this.cache));
  }

  protected async recover(
    err: unknown,
    candidate: SourcedImage,
    debug: DebugAccumulator
  ): Promise<SourcedImage> {
    // A timed-out probe means the host is not answering at all, not that this particular frame
    // is missing. There is no newer frame hiding behind a dead connection, and continuing
    // would queue every remaining probe behind its own 15s bound, so surface it and let
    // Backoff's cooldown decide when to look again.
    if (isTimeout(err)) throw err;

    let lastErr = err;
    let missed = candidate.date.getTime(); // newest slot known not to be published
    let found: SourcedImage | null = null;

    // Returns the slot when it loads, null when it 404s; a timeout aborts the search entirely
    // for the reason above.
    const trySlot = async (slotMs: number): Promise<SourcedImage | null> => {
      debug.retries++;
      const slot = buildSunSlotImage(new Date(slotMs));
      try {
        await timedPreload(slot.url, debug);
        return slot;
      } catch (retryErr) {
        if (isTimeout(retryErr)) throw retryErr;
        lastErr = retryErr;
        return null;
      }
    };

    // `lastConfirmed`, not the TTL entry — getSunImageUrl() writes its guess there before
    // anything has verified it loads, so the TTL entry is exactly the wrong thing to treat as
    // known-good. Backoff only records a success after a real decode.
    const confirmed = this.cache.getStale(this.source);
    if (confirmed) {
      // `next >= missed` covers both "the guess was only one slot ahead" and a backwards
      // clock jump leaving the confirmed frame newer than the guess: either way there is no
      // gap to search, and the frame we already have is the answer.
      const next = confirmed.date.getTime() + SUN_CACHE_TTL_MS;
      found = next < missed ? await trySlot(next) : null;
      if (!found) {
        // Nothing newer than the frame we already hold, so the gap below is known-empty and
        // there is nothing to search. Re-commit it so the TTL entry stops advertising the
        // guess that just 404'd.
        this.cache.set(this.source, confirmed);
        return confirmed;
      }
    } else {
      const origin = missed;
      for (let reach = SUN_CACHE_TTL_MS; ; reach = Math.min(reach * 2, SUN_MAX_REACH_MS)) {
        found = await trySlot(origin - reach);
        if (found) break;
        missed = origin - reach;
        if (reach === SUN_MAX_REACH_MS) break;
      }
      if (!found) throw lastErr;
    }

    // Narrow to the newest slot that loads. Each step halves what is left between a slot known
    // to load and one known not to, so the whole search stays logarithmic in the gap.
    let loaded = found.date.getTime();
    while (missed - loaded > SUN_CACHE_TTL_MS) {
      const mid = floorToSlot(loaded + (missed - loaded) / 2);
      const image = await trySlot(mid);
      if (image) {
        found = image;
        loaded = mid;
      } else {
        missed = mid;
      }
    }

    // Committed once, for the slot that won — an attempt that 404s never touches the shared
    // cache, so a concurrent reader (another refresh() tick racing this search) can never
    // observe a still-unconfirmed guess.
    this.cache.set(this.source, found);
    return found;
  }
}

function isTimeout(err: unknown): boolean {
  return err instanceof Error && err.message === IMAGE_TIMEOUT_MESSAGE;
}

// Anchored to the slot's own timestamp rather than a sliding "time since this call last ran"
// window — a sliding TTL starts counting from whatever wall-clock instant a given card
// instance happened to first populate its cache, so two cards that first asked at different
// moments drift onto two different hold windows that never re-sync (#122). A slot goes stale
// once the next slot's publish window opens, which is a pure function of the slot itself, so
// every card holding it expires at the same wall-clock moment however each one got there.
function freshCachedSlot(cache: UrlCache): SourcedImage | null {
  const entry = cache.getEntry("sun");
  if (!entry) return null;
  const validUntil = entry.image.date.getTime() + SUN_CACHE_TTL_MS + SUN_PUBLISH_BUFFER_MS;
  return Date.now() < validUntil ? entry.image : null;
}

export function getSunImageUrl(cache: UrlCache = urlCache): SourcedImage {
  const cached = freshCachedSlot(cache);
  if (cached) return cached;

  const image = buildSunSlotImage(new Date(floorToSlot(Date.now() - SUN_PUBLISH_BUFFER_MS)));
  cache.set("sun", image);
  return image;
}

function floorToSlot(ms: number): number {
  return Math.floor(ms / SUN_CACHE_TTL_MS) * SUN_CACHE_TTL_MS;
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
