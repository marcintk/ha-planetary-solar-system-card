import type { DebugAccumulator } from "./debug.js";
import { IMAGE_TIMEOUT_MESSAGE, SourceResolver, timedPreload } from "./source-resolver.js";
import type { SourcedImage, UrlCache } from "./url-cache.js";
import { urlCache } from "./url-cache.js";

// SDO publishes HMI Continuum (visible-light sunspot disk) quicklook frames to a dated
// browse archive on a fixed 15-min grid (:00/:15/:30/:45 UTC), named for their real capture
// time — but sdo.gsfc.nasa.gov sends no CORS header, so unlike EPIC's JSON API we can't fetch
// the directory listing from the browser to confirm which slot has actually been published.
// Instead we compute the URL: floor "now minus a publish-latency buffer" to the last 15-min
// slot.
//
// That buffer is *learned* rather than fixed (#148). A fixed one has to be wrong in one
// direction or the other: too short and every refresh burns a 404 on a frame NASA hasn't
// written yet; too long and a healthy card shows an older Sun than it could. The learned
// buffer walks toward whatever the feed is actually doing:
//
//   - floor 30 min — measured publish lag is 25 min (:15/:45 slots) or 30 (:00/:30), with no
//     jitter at all, so nothing below 30 is ever worth probing. At the floor a healthy
//     refresh costs exactly one request and never retries.
//   - one slot shorter, each refresh — an elevated buffer probes 15 min newer than it learned,
//     so it decays back toward the floor as NASA catches up. recover() restores the previous
//     value when that probe 404s, at the cost of one wasted request per tick *while elevated
//     only* — a healthy card at the floor never pays it.
//   - doubling, on failure — 30/60/120/240. Four requests reach back four hours, which covers
//     an observed full-pipeline stall (2026-08-21: nothing published for over two hours) that
//     no fixed buffer and no linear walk-back of sane length would have survived.
//   - ceiling 240 min — still deliberately bounded, not an unbounded backward search: a real
//     multi-hour NASA outage should surface as "unavailable" like any other failed source and
//     hand off to Backoff's cooldown, not burn an ever-growing chain of 404s hunting for an
//     increasingly stale picture.
//
// The learned value is not stored anywhere: it's read back out of the cache entry the last
// commit left behind (`fetchedAt - slot.date`, floored to the grid). That means it is shared
// by every card on the page, survives HA remounting the card element, and resets exactly when
// the cache does — with no second piece of state to keep in sync with the first.
export const SDO_BROWSE_BASE_URL = "https://sdo.gsfc.nasa.gov/assets/img/browse";
export const SUN_CACHE_TTL_MS = 15 * 60000;
const SUN_BUFFER_FLOOR_MS = 30 * 60000;
// 30 days. A stall lasting longer than that is not a stall, and the browse archive is
// organised by day, so a month is the widest window still worth a bounded search. The search
// is logarithmic, so widening the ceiling from 4 hours to 30 days cost 7 extra requests in the
// worst case, not 170x more (#148 follow-up, measured against the 2026-08-21 outage).
const SUN_BUFFER_CEIL_MS = 30 * 24 * 60 * 60000;

export class SdoSunResolver extends SourceResolver {
  readonly source = "sun" as const;

  protected getCached(): SourcedImage | null {
    return freshCachedSlot(this.cache);
  }

  protected fetchCandidateUrl(): Promise<SourcedImage> {
    return Promise.resolve(getSunImageUrl(this.cache));
  }

  // Exponential search: double the buffer until a frame loads (bracketing the gap), then
  // binary-search inside that bracket for the newest frame that actually exists. Doubling
  // alone would find *a* picture but a needlessly old one — during the 2026-08-21 stall it
  // would have shown a 16-hour-old Sun when an 8-hour-old one was on the archive. The bisect
  // costs a handful of extra requests and lands exactly, which also means the learned buffer
  // ends up correct rather than merely sufficient.
  protected async recover(
    err: unknown,
    candidate: SourcedImage,
    debug: DebugAccumulator
  ): Promise<SourcedImage> {
    // A timed-out probe means the host is not answering at all, not that this particular
    // frame is missing. Walking deeper would queue more 15s waits behind a dead connection,
    // so surface it and let Backoff's cooldown decide when to look again.
    if (isTimeout(err)) throw err;

    const now = Date.now();
    let lastErr = err;
    // Returns the slot when it loads and null when it 404s; a timeout aborts the whole search
    // for the reason above.
    const tryBuffer = async (buffer: number): Promise<SourcedImage | null> => {
      debug.retries++;
      const slot = buildSunSlotImage(new Date(floorToSlot(now - buffer)));
      try {
        await timedPreload(slot.url, debug);
        return slot;
      } catch (retryErr) {
        if (isTimeout(retryErr)) throw retryErr;
        lastErr = retryErr;
        return null;
      }
    };

    // Bracket. `missed` is the deepest buffer known to 404; the first rung restores whatever
    // the probe shrank away from, so a card that merely decayed one slot too far pays a single
    // request. Derived from the candidate rather than the cache, because getSunImageUrl() has
    // already overwritten the entry with this still-unconfirmed guess.
    let missed = bufferBehind(candidate.date, now);
    let found: SourcedImage | null = null;
    let foundBuffer = 0;
    for (
      let buffer = missed > SUN_BUFFER_FLOOR_MS ? missed + SUN_CACHE_TTL_MS : missed * 2;
      buffer <= SUN_BUFFER_CEIL_MS;
      buffer = Math.min(buffer * 2, SUN_BUFFER_CEIL_MS)
    ) {
      found = await tryBuffer(buffer);
      if (found) {
        foundBuffer = buffer;
        break;
      }
      if (buffer === SUN_BUFFER_CEIL_MS) break;
      missed = buffer;
    }
    if (!found) throw lastErr;

    // Narrow to the newest slot that loads. Each step halves the remaining bracket, so the
    // whole search stays logarithmic in the size of the gap.
    while (foundBuffer - missed > SUN_CACHE_TTL_MS) {
      const mid = floorToSlot(missed + (foundBuffer - missed) / 2);
      const image = await tryBuffer(mid);
      if (image) {
        found = image;
        foundBuffer = mid;
      } else {
        missed = mid;
      }
    }

    // Committed once, for the slot that won — an attempt that 404s never touches the shared
    // cache, so a concurrent reader (another refresh() tick racing this search) can never
    // observe a still-unconfirmed guess. This commit is also what teaches the next refresh
    // its new buffer.
    this.cache.set("sun", found);
    return found;
  }
}

function isTimeout(err: unknown): boolean {
  return err instanceof Error && err.message === IMAGE_TIMEOUT_MESSAGE;
}

// Anchored to the slot's own timestamp rather than a sliding "time since this call last ran"
// window — a sliding TTL starts counting from whatever wall-clock instant a given card
// instance happened to first populate its cache, so two cards that first asked at different
// moments drift onto two different hold windows that never re-sync (#122). A slot only
// actually goes stale once the *next* slot's publish window opens, and that instant is a pure
// function of the entry itself — so every card holding the same slot expires it at the exact
// same wall-clock moment, regardless of when each one fetched it.
//
// A slot committed by recover() needs no special case here, unlike under the old fixed buffer
// (where an overdue recovery commit landed past its own anchor the moment it was confirmed,
// and expiring it on the spot sent every following tick straight back into the retry loop).
// The learned buffer absorbs that lag by construction: the anchor is built from the very lag
// the commit recorded, so it always lands a full TTL ahead of fetchedAt.
function freshCachedSlot(cache: UrlCache): SourcedImage | null {
  const entry = cache.getEntry("sun");
  if (!entry) return null;
  const validUntil = entry.image.date.getTime() + SUN_CACHE_TTL_MS + learnedBufferMs(cache);
  return Date.now() < validUntil ? entry.image : null;
}

export function getSunImageUrl(cache: UrlCache = urlCache): SourcedImage {
  const cached = freshCachedSlot(cache);
  if (cached) return cached;

  // Read before the set below overwrites the entry this is derived from.
  const image = buildSunSlotImage(new Date(floorToSlot(Date.now() - probeBufferMs(cache))));
  cache.set("sun", image);
  return image;
}

// What the last commit's own lag says the feed's publish latency currently is. Clamped, so a
// cache entry left behind by an exhausted retry chain (or any other oddity) can't push the
// next probe past the ceiling or below the measured floor.
function learnedBufferMs(cache: UrlCache): number {
  const entry = cache.getEntry("sun");
  if (!entry) return SUN_BUFFER_FLOOR_MS;
  const lag = bufferBehind(entry.image.date, entry.fetchedAt);
  return Math.min(Math.max(lag, SUN_BUFFER_FLOOR_MS), SUN_BUFFER_CEIL_MS);
}

// One slot newer than what was learned — the probe that lets an elevated buffer shrink back
// toward the floor as NASA catches up. At the floor there is nothing to shrink, so no probe.
function probeBufferMs(cache: UrlCache): number {
  return Math.max(learnedBufferMs(cache) - SUN_CACHE_TTL_MS, SUN_BUFFER_FLOOR_MS);
}

// Every buffer is a whole number of slots, and a slot is floor(instant - buffer), so flooring
// the gap recovers the exact buffer that produced it rather than a value 0-15 min too large.
function bufferBehind(slot: Date, instant: number): number {
  return floorToSlot(instant - slot.getTime());
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
