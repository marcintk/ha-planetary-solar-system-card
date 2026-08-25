// The counters the gallery fetch protocol keeps, and the snapshot the overlay renders from.
// Nothing here draws anything — see card/debug-view.ts for that half.
//
// Cumulative, since the card was mounted — not a rolling window. Every field is written through
// exactly one record function below — that function's own comment is the counter's full
// contract (what it means, when it fires, what a healthy value looks like); nothing here
// mutates a field directly. `fetches`/`failures`/`fetchMsTotal`/`lastAttemptAt` are the one
// exception, owned entirely by timedAttempt() further down this file rather than a record*
// function of their own, since that's already a single call site.
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

// Answers "how many ticks has this source seen", not "how many needed a fetch" — that's
// cacheHits/fetches below.
export function recordGet(debug: DebugAccumulator): void {
  debug.gets++;
}

// Direct answer to "is this source's TTL actually skipping the network" — climbs steadily while
// `fetches` stays flat between TTL windows.
export function recordCacheHit(debug: DebugAccumulator): void {
  debug.cacheHits++;
}

// Counts a refresh served entirely from Backoff's last-confirmed image, without even checking
// this source's own TTL cache — the source is sitting out a backoff window from prior failures.
export function recordBackoff(debug: DebugAccumulator): void {
  debug.backoffs++;
}

// Counts a resolved candidate whose URL turned out identical to the image already displayed,
// found only after the TTL cache had already expired and forced a real fetchCandidateUrl() call
// that ended up confirming nothing changed (for earth this still cost one real EPIC API request;
// for sun it's free, since its candidate URL is pure math). The far more common case — cache
// still fresh AND URL unchanged — needs no counter of its own, since cacheHits already answers
// that question.
export function recordExpired(debug: DebugAccumulator): void {
  debug.expired++;
}

// Counts how often sun's primary guess missed and fell back to searching for a published slot
// (source-resolver-sdo-sun.ts). Steady state should sit at zero, since the publish buffer learns
// the feed's real lag; a rising rate means it is spending its ticks probing rather than resting
// at the floor.
export function recordRetry(debug: DebugAccumulator): void {
  debug.retries++;
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
