import type { ImageSource } from "./card-template.js";
import type { DebugAccumulator } from "./debug.js";
import type { SourcedImage } from "./image-cache.js";

// Bounds a hung network request — without it, a stalled fetch or image load has no
// app-level ceiling and blocks that gallery source indefinitely (only the browser's own
// network stack would eventually give up, if ever). Shared by the EPIC JSON fetch
// (source-resolver-dscovrearth.ts) and the image-decode preload below, so both NASA hosts are
// bounded the same way.
export const FETCH_TIMEOUT_MS = 15000;

// One resolver instance per NASA source, each owning that source's own cache TTL, decode-gate
// state, and candidate-fetch quirks (see source-resolver-dscovrearth.ts / source-resolver-sdosun.ts).
// resolve() is the shared protocol (cache check, decode gate, preload, counters); getCached(),
// fetchCandidate(), and recover() are the only per-source hooks — a new source plugs in by
// extending this and providing those three, without touching the shared protocol.
export abstract class SourceResolver {
  abstract readonly source: ImageSource;
  private _decodedUrl: string | undefined;

  protected abstract getCached(): SourcedImage | null;
  protected abstract fetchCandidate(debug: DebugAccumulator): Promise<SourcedImage>;

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

  // Recovers this source's still-fresh cache, seeding decode-gate state to match — called
  // once at construction (e.g. after HA remounts the card element) so the first tick after a
  // remount doesn't decode a URL the cache already confirmed current.
  hydrate(): SourcedImage | undefined {
    const cached = this.getCached();
    if (cached) this._decodedUrl = cached.url;
    return cached ?? undefined;
  }

  async resolve(debug: DebugAccumulator): Promise<SourcedImage> {
    // Checked before any fetch is attempted, so `cacheHits` climbs on every tick that's
    // served straight from cache — the direct answer to "is this source's TTL actually
    // skipping the network" that `ticks` vs. `attempts` alone only implies.
    const cached = this.getCached();
    if (cached) debug.cacheHits++;
    const candidate = cached ?? (await this.fetchCandidate(debug));
    // URL identity is already the cache — skip re-decoding an image already confirmed to
    // load, and count it as a redundant-avoided fetch (bytes that would've been re-fetched
    // and re-decoded for nothing).
    if (candidate.url === this._decodedUrl) {
      debug.redundant++;
      return candidate;
    }
    try {
      await timedPreload(candidate.url, debug);
      this._decodedUrl = candidate.url;
      return candidate;
    } catch (err) {
      const recovered = await this.recover(err, candidate, debug);
      this._decodedUrl = recovered.url;
      return recovered;
    }
  }
}

// Confirms a candidate image URL actually loads AND decodes before anything commits to
// displaying it — so a failed or not-yet-published candidate never touches a visible <img>.
// decode() (not the load event) is what actually guarantees this: load only means the bytes
// downloaded, not that the browser has rasterized them yet — assigning to a live <img> right
// after load can still stumble onto the broken-image glyph for a frame while it decodes.
// Off-DOM: doesn't reuse the real <img> element, so a failed probe can never flash onto it.
function preloadImage(url: string): Promise<void> {
  const probe = new Image();
  probe.src = url;
  return Promise.race([
    probe.decode(),
    new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new Error("Image load timed out")), FETCH_TIMEOUT_MS);
    }),
  ]);
}

// Shared by both the image-byte preload and (for earth) the EPIC JSON lookup that precedes
// it — from the debug overlay's point of view, both are "an attempt at a real network call",
// so they share one set of counters rather than needing their own column each.
export async function timedAttempt<T>(op: () => Promise<T>, debug: DebugAccumulator): Promise<T> {
  debug.attempts++;
  debug.lastAttemptAt = Date.now();
  const start = performance.now();
  try {
    const result = await op();
    debug.network++;
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
