import type { DebugAccumulator, SourceDebugStats } from "./debug-stats.js";
import { emptyDebugAccumulator, toDebugStats } from "./debug-stats.js";
import type { SourceResolver } from "./source-resolver.js";
import { DscovrEarthResolver } from "./source-resolver-dscovr-earth.js";
import { SdoSunResolver } from "./source-resolver-sdo-sun.js";
import { SvsMoonResolver } from "./source-resolver-svs-moon.js";
import type { DebugRowId, ImageSource } from "./sources.js";
import { DEBUG_ROWS, SOURCES } from "./sources.js";
import type { SourcedImage } from "./url-cache.js";

// The single gateway to a resolved sun/earth image — dispatches to the per-source resolver
// (source-resolver-dscovr-earth.ts / source-resolver-sdo-sun.ts) that owns that source's own TTL, decode-gate
// state, and fetch/retry quirks. One instance per GalleryController, so its state matches that
// controller's own lifecycle (remounts get a fresh instance). Adding a new source means adding
// a SourceResolver subclass and an entry in `_resolvers` — GalleryController's call sites don't
// change.
export class ImageResolver {
  private readonly _resolvers: Record<ImageSource, SourceResolver>;
  private readonly _inFlight: Partial<Record<ImageSource, boolean>> = {};
  // Owned here rather than by the caller: this is the one place that knows which resolver
  // writes into which row (SOURCES[source].debugRow), so it's also the natural owner of the
  // counters those writes produce — a caller only ever wants the derived view (debugStats()),
  // never the raw accumulators.
  private readonly _debug: Record<DebugRowId, DebugAccumulator>;

  // Both moon resolvers ask for the current instant and land on the same NASA frame; they
  // differ only in which cache key they own, and card.ts rotates mymoon's copy to the
  // observer's own sky.
  constructor() {
    const now = () => new Date();
    this._resolvers = {
      mymoon: new SvsMoonResolver("mymoon", now),
      moon: new SvsMoonResolver("moon", now),
      earth: new DscovrEarthResolver(),
      sun: new SdoSunResolver(),
    };
    this._debug = Object.fromEntries(
      DEBUG_ROWS.map((row) => [row, emptyDebugAccumulator()])
    ) as Record<DebugRowId, DebugAccumulator>;
  }

  debugStats(): Record<DebugRowId, SourceDebugStats> {
    return Object.fromEntries(
      DEBUG_ROWS.map((row) => [row, toDebugStats(this._debug[row])])
    ) as Record<DebugRowId, SourceDebugStats>;
  }

  hydrate(sources: readonly ImageSource[]): Partial<Record<ImageSource, SourcedImage>> {
    const images: Partial<Record<ImageSource, SourcedImage>> = {};
    for (const source of sources) {
      const cached = this._resolvers[source].hydrate();
      if (cached) images[source] = cached;
    }
    return images;
  }

  // Resolves every requested source concurrently, skipping only a source still mid-fetch from
  // a previous call (that source keeps serving whatever's cached until the in-flight one
  // settles, rather than stacking a second overlapping request). Every other source hits
  // resolve() on every call, even one still well within its own TTL — that's deliberate: `gets`
  // is meant to answer "how many ticks has this source seen", not "how many ticks needed a
  // fetch" (that's what `cacheHits`/`fetches` are for). A cache-fresh source still resolves
  // cheaply — resolve()'s own cache-hit phase returns without a network call. Returns settled
  // results only for the sources actually attempted this call, so the caller can tell "not
  // requested" (skipped, still in flight) apart from "requested and failed".
  async resolveAll(
    sources: readonly ImageSource[]
  ): Promise<{ source: ImageSource; result: PromiseSettledResult<SourcedImage> }[]> {
    const pending = sources.filter((source) => !this._inFlight[source]);
    for (const source of pending) {
      this._inFlight[source] = true;
    }
    const settled = await Promise.allSettled(
      pending.map((source) => {
        const { url, img } = SOURCES[source].debugRow;
        return this._resolvers[source].resolve(this._debug[url], this._debug[img]);
      })
    );
    return pending.map((source, i) => {
      this._inFlight[source] = false;
      return { source, result: settled[i] };
    });
  }
}
