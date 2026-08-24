import type { DebugAccumulator } from "./debug-stats.js";
import { padLeft } from "./pad.js";
import { findPublishedSlot } from "./slot-search.js";
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

    // `lastConfirmed`, not the TTL entry — getSunImageUrl() writes its guess there before
    // anything has verified it loads, so the TTL entry is exactly the wrong thing to treat as
    // known-good. Backoff only records a success after a real decode.
    const confirmed = this.cache.getStale(this.source);

    // The search strategy itself (reach-doubling cold start, bisection narrowing) lives in
    // slot-search.ts, pure and network-agnostic. This probe is the only place that knows what
    // "does this slot exist" actually costs: one preload+decode, counted, with a timed-out
    // attempt reported as `abort` so the search stops instead of treating a dead host as one
    // more missing slot.
    const probe = async (slotMs: number) => {
      debug.retries++;
      try {
        await timedPreload(buildSunSlotImage(new Date(slotMs)).url, debug);
        return { hit: true };
      } catch (retryErr) {
        return { hit: false, abort: isTimeout(retryErr), error: retryErr };
      }
    };

    const result = await findPublishedSlot({
      confirmedMs: confirmed ? confirmed.date.getTime() : null,
      missedMs: candidate.date.getTime(),
      slotMs: SUN_CACHE_TTL_MS,
      maxReachMs: SUN_MAX_REACH_MS,
      probe,
    });

    // foundMs is only ever null when a confirmed frame was supplied and the one probe past it
    // missed — cold-start exhaustion rethrows lastError inside findPublishedSlot instead of
    // returning here. Nothing newer than the frame we already hold, so the gap below is
    // known-empty and there is nothing to search. Re-commit it so the TTL entry stops
    // advertising the guess that just 404'd, and stamp the check so freshCachedSlot() holds off
    // re-probing for a full TTL instead of retrying on every tick (#152).
    if (result.foundMs == null) {
      this.cache.set(this.source, confirmed as SourcedImage);
      this.cache.recordChecked(this.source);
      return confirmed as SourcedImage;
    }

    // Committed once, for the slot that won — an attempt that 404s never touches the shared
    // cache, so a concurrent reader (another refresh() tick racing this search) can never
    // observe a still-unconfirmed guess. Also the cold-start search's only exit, so it needs
    // its own stamp here too (#152) — without it, a cold start that lands on an old/stalled
    // frame settles with no throttle behind it, and the very next tick re-probes from scratch.
    const found = buildSunSlotImage(new Date(result.foundMs));
    this.cache.set(this.source, found);
    this.cache.recordChecked(this.source);
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
  const slotValidUntil = entry.image.date.getTime() + SUN_CACHE_TTL_MS + SUN_PUBLISH_BUFFER_MS;
  // A stalled feed keeps confirming the same (older) frame forever, so slotValidUntil alone
  // never advances and every tick re-probes NASA (#152: two requests/min for hours, no
  // backoff, since "still nothing newer" is a successful check, not a failure). recover()
  // stamps lastCheckedAt only for that specific outcome — deliberately not entry.fetchedAt,
  // which the optimistic getSunImageUrl() guess also writes, at a different moment per card
  // instance, and which is exactly what #122 already ruled out as an expiry anchor.
  const lastCheckedAt = cache.getLastCheckedAt("sun") ?? 0;
  const recheckValidUntil = lastCheckedAt + SUN_CACHE_TTL_MS;
  return Date.now() < Math.max(slotValidUntil, recheckValidUntil) ? entry.image : null;
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

function buildSunSlotImage(slot: Date): SourcedImage {
  const year = slot.getUTCFullYear();
  const month = padLeft(slot.getUTCMonth() + 1);
  const day = padLeft(slot.getUTCDate());
  const hhmmss = `${padLeft(slot.getUTCHours())}${padLeft(slot.getUTCMinutes())}00`;
  return {
    url: `${SDO_BROWSE_BASE_URL}/${year}/${month}/${day}/${year}${month}${day}_${hhmmss}_1024_HMIIC.jpg`,
    date: slot,
  };
}
