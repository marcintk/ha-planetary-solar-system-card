import type { DebugAccumulator } from "./debug-stats.js";
import type { ImageSource } from "./sources.js";
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

  // The key every `this.cache.*()` call below is keyed by — `source` for every resolver except
  // SvsMoonResolver's mymoon instance, which overrides this to share moon's entry (see its own
  // comment): same URL every tick now that both ask for the same instant, so sharing the key
  // means whichever of the two resolves first in a given tick, the other's getCached()/
  // isDecoded() see it immediately instead of independently re-fetching and re-decoding
  // identical bytes.
  protected get cacheKey(): string {
    return this.source;
  }

  // Required hook #1. Answers "do we already have a still-valid candidate?" without touching
  // the network — null means "go compute one". Each source picks its own definition of valid:
  // sun anchors to its 15-min slot's own timestamp, earth is a plain elapsed-time TTL, moon is
  // URL-string identity with no clock at all. May return a URL nothing has confirmed decodes
  // yet (see fetchCandidateUrl's own contract below) — resolve() re-checks that separately via
  // isDecoded() before ever trusting this as a finished answer.
  protected abstract getCached(): SourcedImage | null;

  // Required hook #2. Called only when getCached() returned null — computes this tick's best
  // guess at the current image and, conventionally, writes it to `this.cache` optimistically
  // (before anything has proven it loads), the same pattern sun and moon both use. Wrap any
  // real network call in `timedAttempt`/`timedPreload` from this module so it's counted the
  // same way the shared preload step below is; a pure-math guess (sun, moon) needs no such
  // wrapping and costs no `fetches` counter.
  protected abstract fetchCandidateUrl(debug: DebugAccumulator): Promise<SourcedImage>;

  // Optional hook. Called with the preload/decode error, the candidate that failed, and the
  // image-side debug accumulator, only after a real decode attempt has failed. Return a
  // replacement SourcedImage to recover the tick (it gets committed exactly like a normal
  // success); rethrow (the default, below) to give up — the caller's outer catch takes it from
  // there and arms backoff. Earth and moon never override this: their engine-default rethrow
  // is this exact function, unmodified. Only sun overrides it, walking backward through 15-min
  // slots (source-resolver-sdo-sun.ts) — the only source where an older candidate is ever a
  // better guess than giving up.
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
    return this.cache.getStale(this.cacheKey) ?? undefined;
  }

  // Two accumulators, not one: `urlDebug` covers finding out what the candidate URL even is
  // (cache check + fetchCandidateUrl()); `imgDebug` covers actually loading it (preload/decode
  // + retry). Earth's caller passes two distinct DebugAccumulators (its URL lookup is a real
  // EPIC API call, separate from the image byte fetch); sun's caller passes the same one
  // twice, since its candidate URL is pure math with nothing to separate out.
  //
  // Owns `gets` itself (bumped unconditionally below) rather than leaving it to the
  // caller — every call here is one refresh attempt for this source, so the counter and the
  // attempt it counts live in the same place instead of two files staying in sync by
  // convention (ImageResolver used to bump this before ever calling resolve()).
  async resolve(urlDebug: DebugAccumulator, imgDebug: DebugAccumulator): Promise<SourcedImage> {
    urlDebug.gets++;
    // Checked — and left — outside the try/catch below on purpose: cooldown itself is not a
    // failure to record (Backoff already recorded the failures that armed it), so this must
    // never reach the catch's own recordFailure() call.
    const stale = this.checkCooldown(urlDebug);
    if (stale) return stale;
    try {
      const { image: candidate, fromCache } = await this.resolveCandidate(urlDebug);
      // URL identity is already the cache — skip re-decoding an image already confirmed to
      // load (bytes that would've been re-fetched and re-decoded for nothing). `expired` counts
      // only the case where the TTL cache had just expired and a real fetchCandidateUrl() call
      // confirmed nothing changed — the cache-still-fresh case needs no counter of its own,
      // `cacheHits` already answers that question.
      if (this.cache.isDecoded(this.cacheKey, candidate.url)) {
        if (!fromCache) urlDebug.expired++;
        return this.commit(candidate);
      }
      // sun's imgDebug is the same object as urlDebug (see the accumulator comment above), so
      // it's already been bumped by the unconditional gets++ above — only earth's
      // split-off img row needs its own count of "an image refresh was actually needed" here.
      if (imgDebug !== urlDebug) imgDebug.gets++;
      return await this.fetchAndDecode(candidate, imgDebug);
    } catch (err) {
      this.cache.recordFailure(this.cacheKey, retryAfterMsFrom(err));
      throw err;
    }
  }

  // Phase 1: is this source sitting out a backoff window from prior failures? A source that
  // just failed repeatedly skips the network entirely (see UrlCache.recordFailure) — serving
  // the last known-good image instead of hammering NASA every tick during an outage or
  // rate-limit. Returns the stale image to short-circuit resolve() entirely, or null to
  // continue on to the cache/fetch phases below.
  private checkCooldown(debug: DebugAccumulator): SourcedImage | null {
    if (!this.cache.inCooldown(this.cacheKey)) return null;
    debug.backoffs++;
    const stale = this.cache.getStale(this.cacheKey);
    if (stale) return stale;
    throw new Error(`${this.source} is in cooldown after repeated failures`);
  }

  // Phase 2: this source's own getCached()/fetchCandidateUrl() hooks, wrapped with the one
  // counter (`cacheHits`) and the fromCache flag every source shares regardless of what those
  // hooks actually do. Checked before any fetch is attempted, so `cacheHits` climbs on every
  // refresh that's served straight from cache — the direct answer to "is this source's TTL
  // actually skipping the network" that `refreshes` vs. `fetches` alone only implies.
  private async resolveCandidate(
    debug: DebugAccumulator
  ): Promise<{ image: SourcedImage; fromCache: boolean }> {
    const cached = this.getCached();
    if (cached) debug.cacheHits++;
    const image = cached ?? (await this.fetchCandidateUrl(debug));
    return { image, fromCache: cached != null };
  }

  // Phase 3: the real network cost every source pays the same way — preload, decode, and on
  // failure the recover() hook (default: rethrow; only sun overrides it). Both outcomes commit
  // through the same phase 4 below, so a recovered image is indistinguishable from a normal
  // success by the time it's cached.
  private async fetchAndDecode(
    candidate: SourcedImage,
    imgDebug: DebugAccumulator
  ): Promise<SourcedImage> {
    try {
      await timedPreload(candidate.url, imgDebug);
      return this.commit(candidate);
    } catch (err) {
      const recovered = await this.recover(err, candidate, imgDebug);
      return this.commit(recovered);
    }
  }

  // Phase 4: the one place every successful path ends, dup or freshly decoded — confirms this
  // exact URL decodes (markDecoded) and tells Backoff this is the new stale-fallback
  // (recordSuccess), clearing any cooldown. Reached from the dup check above, hits the same
  // markDecoded() write it already implies — cheap and idempotent, not a second decode.
  private commit(image: SourcedImage): SourcedImage {
    this.cache.markDecoded(this.cacheKey, image.url);
    this.cache.recordSuccess(this.cacheKey, image);
    return image;
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
