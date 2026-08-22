import type { ImageSource } from "../card-template.js";
import type { DebugAccumulator } from "./debug.js";
import type { SourcedImage, UrlCache } from "./url-cache.js";
import { urlCache } from "./url-cache.js";

// Bounds a hung network request — without it, a stalled fetch or image load has no
// app-level ceiling and blocks that gallery source indefinitely (only the browser's own
// network stack would eventually give up, if ever). Shared by the EPIC JSON fetch
// (source-resolver-dscovr-earth.ts) and the image-decode preload below, so both NASA hosts are
// bounded the same way.
export const FETCH_TIMEOUT_MS = 15000;

// Exported so a resolver can tell "this frame is missing" (a 404 from decode) apart from
// "the host is not answering" (this timeout). sun's recover() walks back through hundreds of
// candidate slots, and that walk is only worth doing against a host that is actually replying.
export const IMAGE_TIMEOUT_MESSAGE = "Image load timed out";

// Distinct from IMAGE_TIMEOUT_MESSAGE on purpose — isTimeout() in sun's recover() only aborts
// the search for the timeout case (host not answering at all); a blocked/failed load that the
// browser reports promptly is a miss like any 404, and the search should keep walking.
export const IMAGE_LOAD_ERROR_MESSAGE = "Image failed to load";

// One resolver instance per NASA source, each owning that source's own cache TTL, decode-gate
// state, and candidate-fetch quirks (see source-resolver-dscovr-earth.ts / source-resolver-sdo-sun.ts).
// resolve() is the shared protocol (cache check, decode gate, preload, counters); getCached(),
// fetchCandidateUrl(), and recover() are the only per-source hooks — a new source plugs in by
// extending this and providing those three, without touching the shared protocol.
export abstract class SourceResolver {
  abstract readonly source: ImageSource;

  // Defaults to the shared module-level cache so production (and any test that doesn't care
  // about isolation) behaves exactly as before — HA remounting the card element rebuilds this
  // resolver, but the module-level cache survives, which is what lets hydrate() below recover
  // a still-fresh image instead of starting cold. Pass an explicit UrlCache only when a test
  // needs its state isolated from every other test in the same file.
  constructor(protected readonly cache: UrlCache = urlCache) {}

  protected abstract getCached(): SourcedImage | null;
  protected abstract fetchCandidateUrl(debug: DebugAccumulator): Promise<SourcedImage>;

  // Lets a caller skip calling resolve() at all while this source's own cache is still
  // current — image-resolver.ts's resolveAll() uses this the same way it already skips a
  // source still mid-fetch, so a tick that has nothing new to do leaves no trace (no debug
  // counters move, no resolve() call happens) instead of running the whole cache-check
  // protocol just to immediately return the same cached image.
  //
  // Deliberately checks isDecoded() too, not just getCached() alone: getCached() can be
  // non-null for a URL a resolver wrote optimistically before anything confirmed it loads
  // (see getSunImageUrl() / fetchLatestEarthImageUrl()'s own comments). Skipping on that
  // alone would mean a failed fetch "poisons" every following tick into silently doing
  // nothing instead of retrying — this mirrors exactly what resolve() itself treats as an
  // instant-success shortcut, so isFresh() is true only when resolve() would be a no-op.
  isFresh(): boolean {
    const cached = this.getCached();
    return cached != null && this.cache.isDecoded(this.source, cached.url);
  }

  // Only sun overrides this: one-step fallback to the previous 15-min slot when the computed
  // one 404s. Earth's URL is already confirmed by a real API lookup, so the default (rethrow)
  // is correct for it.
  protected recover(
    err: unknown,
    _candidate: SourcedImage,
    _debug: DebugAccumulator
  ): Promise<SourcedImage> {
    throw err;
  }

  // Recovers this source's last actually-confirmed image — called once at construction (e.g.
  // after HA remounts the card element) so the first tick after a remount doesn't wait on a
  // fetch for something already known good.
  //
  // Deliberately NOT getCached(): that reads the raw TTL cache, which a resolver can write to
  // optimistically before anything has verified the guess decodes (see getSunImageUrl() in
  // source-resolver-sdo-sun.ts, and fetchLatestEarthImageUrl() in
  // source-resolver-dscovr-earth.ts — both cache their computed URL before the real image
  // bytes are ever fetched). Trusting that here would markDecoded() a URL nothing has proven
  // loads, so every resolve() after remount skips the real network check and the gallery can
  // end up serving a broken image with zero fetches to show for it. getStale() only returns
  // what recordSuccess() set after a real decode, so decoded-map and lastConfirmed can never
  // fall out of sync — no separate markDecoded() call needed here.
  hydrate(): SourcedImage | undefined {
    return this.cache.getStale(this.source) ?? undefined;
  }

  // Two accumulators, not one: `urlDebug` covers finding out what the candidate URL even is
  // (cache check + fetchCandidateUrl()); `imgDebug` covers actually loading it (preload/decode
  // + retry). Earth's caller passes two distinct DebugAccumulators (its URL lookup is a real
  // EPIC API call, separate from the image byte fetch); sun's caller passes the same one
  // twice, since its candidate URL is pure math with nothing to separate out.
  //
  // Owns `refreshes` itself (bumped unconditionally below) rather than leaving it to the
  // caller — every call here is one refresh attempt for this source, so the counter and the
  // attempt it counts live in the same place instead of two files staying in sync by
  // convention (ImageResolver used to bump this before ever calling resolve()).
  async resolve(urlDebug: DebugAccumulator, imgDebug: DebugAccumulator): Promise<SourcedImage> {
    urlDebug.refreshes++;
    // A source that just failed repeatedly skips the network entirely for a backoff window
    // (see UrlCache.recordFailure) — serving the last known-good image instead of hammering
    // NASA every refresh_mins tick during an outage or rate-limit.
    if (this.cache.inCooldown(this.source)) {
      const stale = this.cache.getStale(this.source);
      if (stale) return stale;
      throw new Error(`${this.source} is in cooldown after repeated failures`);
    }
    try {
      // Checked before any fetch is attempted, so `cacheHits` climbs on every refresh that's
      // served straight from cache — the direct answer to "is this source's TTL actually
      // skipping the network" that `refreshes` vs. `fetches` alone only implies.
      const cached = this.getCached();
      if (cached) urlDebug.cacheHits++;
      const candidate = cached ?? (await this.fetchCandidateUrl(urlDebug));
      // URL identity is already the cache — skip re-decoding an image already confirmed to
      // load (bytes that would've been re-fetched and re-decoded for nothing). Only counted
      // when the TTL cache had just expired (`expired`): a real fetchCandidateUrl() call that
      // ended up confirming nothing changed. The cache-still-fresh case needs no counter of its
      // own — `cacheHits` already answers that question.
      if (this.cache.isDecoded(this.source, candidate.url)) {
        if (!cached) urlDebug.expired++;
        this.cache.recordSuccess(this.source, candidate);
        return candidate;
      }
      // sun's imgDebug is the same object as urlDebug (see the accumulator comment above), so
      // it's already been bumped by the unconditional refreshes++ above — only earth's
      // split-off img row needs its own count of "an image refresh was actually needed" here.
      if (imgDebug !== urlDebug) imgDebug.refreshes++;
      try {
        await timedPreload(candidate.url, imgDebug);
        this.cache.markDecoded(this.source, candidate.url);
        this.cache.recordSuccess(this.source, candidate);
        return candidate;
      } catch (err) {
        const recovered = await this.recover(err, candidate, imgDebug);
        this.cache.markDecoded(this.source, recovered.url);
        this.cache.recordSuccess(this.source, recovered);
        return recovered;
      }
    } catch (err) {
      this.cache.recordFailure(this.source, retryAfterMsFrom(err));
      throw err;
    }
  }
}

// Duck-typed rather than an `instanceof EpicApiError` check, so this module doesn't need to
// import a class that only one concrete source (EPIC) ever throws — sun's plain Errors simply
// carry no retryAfterMs and fall through to pure exponential backoff.
function retryAfterMsFrom(err: unknown): number | undefined {
  const value = (err as { retryAfterMs?: unknown } | undefined)?.retryAfterMs;
  return typeof value === "number" ? value : undefined;
}

// Confirms a candidate image URL actually loads AND decodes before anything commits to
// displaying it — so a failed or not-yet-published candidate never touches a visible <img>.
// decode() (not the load event) is what actually guarantees this: load only means the bytes
// downloaded, not that the browser has rasterized them yet — assigning to a live <img> right
// after load can still stumble onto the broken-image glyph for a frame while it decodes.
// Off-DOM: doesn't reuse the real <img> element, so a failed probe can never flash onto it.
//
// Also races the element's own `error` event, not just decode(): a cross-origin response
// blocked before it reaches the image pipeline (e.g. Chrome's ORB, on a 404's text/html body)
// can leave decode() never settling even though the network layer already failed in
// milliseconds. Without this, that single blocked slot is indistinguishable from a genuinely
// dead host and wrongly trips sun's recover() into aborting its whole backward search instead
// of treating it as one more miss.
function preloadImage(url: string): Promise<void> {
  const probe = new Image();
  const blocked = new Promise<never>((_resolve, reject) => {
    probe.onerror = () => reject(new Error(IMAGE_LOAD_ERROR_MESSAGE));
  });
  probe.src = url;
  return Promise.race([
    probe.decode(),
    blocked,
    new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new Error(IMAGE_TIMEOUT_MESSAGE)), FETCH_TIMEOUT_MS);
    }),
  ]);
}

// Shared by both the image-byte preload and (for earth) the EPIC JSON lookup that precedes
// it — from the debug overlay's point of view, both are "an attempt at a real network call",
// so they share one set of counters rather than needing their own column each.
export async function timedAttempt<T>(op: () => Promise<T>, debug: DebugAccumulator): Promise<T> {
  debug.fetches++;
  debug.lastAttemptAt = Date.now();
  const start = performance.now();
  try {
    const result = await op();
    debug.fetchMsTotal += performance.now() - start;
    return result;
  } catch (err) {
    debug.failures++;
    throw err;
  }
}

export function timedPreload(url: string, debug: DebugAccumulator): Promise<void> {
  return timedAttempt(() => preloadImage(url), debug);
}
