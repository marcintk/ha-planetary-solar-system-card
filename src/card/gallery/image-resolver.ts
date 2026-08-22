import type { ImageSource } from "../card-template.js";
import type { DebugAccumulator, DebugRowId } from "./debug.js";
import { DEBUG_ROW_KEYS } from "./debug.js";
import type { SourceResolver } from "./source-resolver.js";
import { DscovrEarthResolver } from "./source-resolver-dscovr-earth.js";
import { SdoSunResolver } from "./source-resolver-sdo-sun.js";
import { SvsMoonResolver } from "./source-resolver-svs-moon.js";
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
  }

  hydrate(sources: readonly ImageSource[]): Partial<Record<ImageSource, SourcedImage>> {
    const images: Partial<Record<ImageSource, SourcedImage>> = {};
    for (const source of sources) {
      const cached = this._resolvers[source].hydrate();
      if (cached) images[source] = cached;
    }
    return images;
  }

  // Resolves every requested source concurrently, skipping any still mid-fetch from a
  // previous call (that source keeps serving whatever's cached until the in-flight one
  // settles, rather than stacking a second overlapping request) and any whose own cache is
  // still current (nothing to learn by asking again before its TTL/publish window is up —
  // sun's 15-min slot, earth's hourly EPIC poll, etc., each via that resolver's own
  // isFresh()). Returns settled results only for the sources actually attempted this call, so
  // the caller can tell "not requested" (skipped) apart from "requested and failed".
  async resolveAll(
    sources: readonly ImageSource[],
    debug: Record<DebugRowId, DebugAccumulator>
  ): Promise<{ source: ImageSource; result: PromiseSettledResult<SourcedImage> }[]> {
    const pending = sources.filter(
      (source) => !this._inFlight[source] && !this._resolvers[source].isFresh()
    );
    for (const source of pending) {
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
