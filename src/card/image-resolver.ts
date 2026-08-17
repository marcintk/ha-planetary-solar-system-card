import type { ImageSource } from "./card-template.js";
import type { DebugAccumulator, DebugRowId } from "./debug.js";
import { DEBUG_ROW_KEYS } from "./debug.js";
import type { SourceResolver } from "./source-resolver.js";
import { DscovrEarthResolver } from "./source-resolver-dscovrearth.js";
import { SdoSunResolver } from "./source-resolver-sdosun.js";
import type { SourcedImage } from "./url-cache.js";

// The single gateway to a resolved sun/earth image — dispatches to the per-source resolver
// (source-resolver-dscovrearth.ts / source-resolver-sdosun.ts) that owns that source's own TTL, decode-gate
// state, and fetch/retry quirks. One instance per GalleryController, so its state matches that
// controller's own lifecycle (remounts get a fresh instance). Adding a new source means adding
// a SourceResolver subclass and an entry in `_resolvers` — GalleryController's call sites don't
// change.
export class ImageResolver {
  private readonly _resolvers: Record<ImageSource, SourceResolver> = {
    earth: new DscovrEarthResolver(),
    sun: new SdoSunResolver(),
  };
  private readonly _inFlight: Partial<Record<ImageSource, boolean>> = {};

  hydrate(sources: readonly ImageSource[]): Partial<Record<ImageSource, SourcedImage>> {
    const images: Partial<Record<ImageSource, SourcedImage>> = {};
    for (const source of sources) {
      const cached = this._resolvers[source].hydrate();
      if (cached) images[source] = cached;
    }
    return images;
  }

  // Resolves every requested source concurrently, skipping any still mid-fetch from a
  // previous call — that source keeps serving whatever's cached until the in-flight one
  // settles, rather than stacking a second overlapping request for the same image. Returns
  // settled results only for the sources actually attempted this call, so the caller can tell
  // "not requested" (skipped, still in flight) apart from "requested and failed".
  async resolveAll(
    sources: readonly ImageSource[],
    debug: Record<DebugRowId, DebugAccumulator>
  ): Promise<{ source: ImageSource; result: PromiseSettledResult<SourcedImage> }[]> {
    const pending = sources.filter((source) => !this._inFlight[source]);
    for (const source of pending) {
      debug[DEBUG_ROW_KEYS[source].url].ticks++;
      this._inFlight[source] = true;
    }
    const settled = await Promise.allSettled(
      pending.map((source) => {
        const { url, img } = DEBUG_ROW_KEYS[source];
        return this._resolvers[source].resolve(debug[url], debug[img]);
      })
    );
    return pending.map((source, i) => {
      this._inFlight[source] = false;
      return { source, result: settled[i] };
    });
  }
}
