// The counters the gallery fetch protocol keeps, and the snapshot the overlay renders from.
// Nothing here draws anything — see card/debug-view.ts for that half.
//
// Cumulative, since the card was mounted — not a rolling window. Lets debug:true answer "is
// this source's own cache actually saving anything" at a glance: `gets` vs. network calls
// equal means every refresh is hitting the network regardless of cache state. `cacheHits` is the
// direct answer to that question — it counts every refresh SourceResolver.resolve() served straight
// from that source's own cache, checked before any fetch is even attempted, so it should
// climb steadily while `fetches` stays flat between a source's real TTL windows. `backoffs`
// counts a refresh served entirely from Backoff's last-confirmed image, without even checking
// this source's own TTL cache — the source is sitting out a backoff window from prior failures.
// `expired`
// counts a resolved candidate whose URL turned out identical to the image already displayed,
// found only after the TTL cache had already expired and forced a real fetchCandidateUrl()
// call that ended up confirming nothing changed (for earth this still cost one real EPIC API
// request; for sun it's free, since its candidate URL is pure math) — the far more common case
// (cache still fresh AND URL unchanged) needs no counter of its own, since `cacheHits` already
// answers that question. `fetches` vs. `failures` separates "tried" from "failed", since a
// failed preload (sun's retry path) previously vanished from the count entirely instead of
// showing up as a real network cost. `retries` counts how often sun's primary guess missed and
// fell back to a widened publish buffer — steady state should sit at zero, since the buffer
// (source-resolver-sdo-sun.ts) learns the feed's real lag; a rising rate means it is spending
// its ticks probing rather than resting at the floor. `lastAttemptAt` is the raw timestamp of the most
// recent preload attempt, formatted at render time.
// Field order matches the overlay's column order (buildDebugOverlay in card/debug-view.ts).
export interface SourceDebugStats {
  gets: number;
  cacheHits: number;
  backoffs: number;
  expired: number;
  fetches: number;
  failures: number;
  retries: number;
  elapsed: number | null;
  lastAttemptAt: number | null;
}

export interface DebugAccumulator {
  gets: number;
  cacheHits: number;
  backoffs: number;
  expired: number;
  fetches: number;
  failures: number;
  retries: number;
  fetchMsTotal: number;
  lastAttemptAt: number | null;
}

export function emptyDebugAccumulator(): DebugAccumulator {
  return {
    gets: 0,
    cacheHits: 0,
    backoffs: 0,
    expired: 0,
    fetches: 0,
    failures: 0,
    retries: 0,
    fetchMsTotal: 0,
    lastAttemptAt: null,
  };
}

export function toDebugStats(acc: DebugAccumulator): SourceDebugStats {
  // Successful fetches = fetches - failures (timedAttempt only ever bumps one or the other),
  // derived here rather than tracked as its own accumulator field since this average is its
  // only consumer.
  const succeeded = acc.fetches - acc.failures;
  return {
    gets: acc.gets,
    cacheHits: acc.cacheHits,
    backoffs: acc.backoffs,
    expired: acc.expired,
    fetches: acc.fetches,
    failures: acc.failures,
    retries: acc.retries,
    elapsed: succeeded > 0 ? acc.fetchMsTotal / succeeded : null,
    lastAttemptAt: acc.lastAttemptAt,
  };
}
