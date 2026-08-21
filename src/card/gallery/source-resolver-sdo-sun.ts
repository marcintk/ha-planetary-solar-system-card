import type { DebugAccumulator } from "./debug.js";
import { SourceResolver, timedPreload } from "./source-resolver.js";
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
const SUN_BUFFER_CEIL_MS = 240 * 60000;

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
    const now = Date.now();
    let lastErr = err;
    // Derived from the candidate rather than read back off the cache: getSunImageUrl() has
    // already overwritten the entry with this still-unconfirmed guess, so the cache no longer
    // remembers what the buffer was before the probe.
    for (const buffer of widerBuffers(bufferBehind(candidate.date, now))) {
      debug.retries++;
      const slot = buildSunSlotImage(new Date(floorToSlot(now - buffer)));
      try {
        await timedPreload(slot.url, debug);
        // Committed only for the slot that actually loaded — an attempt that 404s never
        // touches the shared cache, so a concurrent reader (another refresh() tick racing
        // this retry loop) can never observe a still-unconfirmed guess between attempts.
        // This commit is also what teaches the next refresh its new buffer.
        this.cache.set("sun", slot);
        return slot;
      } catch (retryErr) {
        lastErr = retryErr;
      }
    }
    throw lastErr;
  }
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

// The escalation ladder tried after a probe fails: restore what was learned (only meaningful
// if we actually probed shorter than it), then double until the ceiling, which is always the
// final rung. recover()'s loop length is exactly this array's length, so the bound lives in
// one place rather than in a separate retry count that has to agree with it.
function widerBuffers(probeMs: number): number[] {
  const ladder: number[] = [];
  if (probeMs > SUN_BUFFER_FLOOR_MS) ladder.push(probeMs + SUN_CACHE_TTL_MS);
  for (let buffer = probeMs * 2; buffer < SUN_BUFFER_CEIL_MS; buffer *= 2) ladder.push(buffer);
  if (ladder[ladder.length - 1] !== SUN_BUFFER_CEIL_MS) ladder.push(SUN_BUFFER_CEIL_MS);
  return ladder;
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
