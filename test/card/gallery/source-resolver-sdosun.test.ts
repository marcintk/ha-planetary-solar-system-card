import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyDebugAccumulator } from "../../../src/card/gallery/debug.js";
import {
  getSunImageUrl,
  SDO_BROWSE_BASE_URL,
  SdoSunResolver,
  SUN_CACHE_TTL_MS,
} from "../../../src/card/gallery/source-resolver-sdosun.js";
import { UrlCache } from "../../../src/card/gallery/url-cache.js";

// Same pattern as gallery-controller.test.ts's stubImagePreload: recover()'s retry loop goes
// through a real off-DOM `new Image()` decode, so a failing-then-succeeding sequence needs
// stubbing to exercise the fallback without a real network call.
function stubImageDecode(...results: boolean[]) {
  let calls = 0;
  vi.stubGlobal(
    "Image",
    class {
      src = "";
      decode() {
        const succeeds = results.length ? results[Math.min(calls, results.length - 1)] : true;
        calls++;
        return succeeds ? Promise.resolve() : Promise.reject(new Error("decode failed"));
      }
    }
  );
}

describe("source-resolver-sdosun", () => {
  // Each test gets its own UrlCache — SdoSunResolver/getSunImageUrl accept one explicitly, so
  // nothing here shares state with the module-level default (which production relies on for
  // remount survival, but tests don't need).
  let cache: UrlCache;

  beforeEach(() => {
    cache = new UrlCache();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("getSunImageUrl", () => {
    // now = 2026-08-15T22:42:30Z; minus the 15-min publish buffer = 22:27:30;
    // floored to the last 15-min slot = 22:15:00.
    const NOW = Date.UTC(2026, 7, 15, 22, 42, 30);

    it("computes the SDO browse-archive URL for the last published 15-min slot, buffered for publish latency", () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      const { url, date } = getSunImageUrl(SUN_CACHE_TTL_MS, cache);
      expect(url).toBe(`${SDO_BROWSE_BASE_URL}/2026/08/15/20260815_221500_1024_HMIIC.jpg`);
      expect(date.toISOString()).toBe("2026-08-15T22:15:00.000Z");
    });

    it("returns the cached result within the TTL instead of a fresh slot", () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      const first = getSunImageUrl(SUN_CACHE_TTL_MS, cache);
      vi.spyOn(Date, "now").mockReturnValue(NOW + 60000);
      const second = getSunImageUrl(SUN_CACHE_TTL_MS, cache);
      expect(second).toEqual(first);
    });

    it("recomputes with a fresh slot once the 15-min default TTL has elapsed", () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      const first = getSunImageUrl(SUN_CACHE_TTL_MS, cache);
      vi.spyOn(Date, "now").mockReturnValue(NOW + 15 * 60000 + 1);
      const second = getSunImageUrl(SUN_CACHE_TTL_MS, cache);
      expect(second).not.toEqual(first);
    });

    it("a shorter maxAgeMs expires the cache sooner", () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      const first = getSunImageUrl(SUN_CACHE_TTL_MS, cache);
      // 16 min later, guaranteed to cross into the next published 15-min slot.
      vi.spyOn(Date, "now").mockReturnValue(NOW + 16 * 60000);
      const second = getSunImageUrl(1000, cache);
      expect(second).not.toEqual(first);
    });
  });

  describe("SdoSunResolver.recover", () => {
    // Regression for the "reverts to the bad slot and gives up" bug: a computed slot can
    // fail to load if NASA hasn't published it yet, and the resolver retries one slot back —
    // but that retry has to update the *shared* cache, or the next background refresh
    // (getSunImageUrl(), on whatever cadence refresh_mins is set to — not 15 minutes) hands
    // the same not-yet-published slot straight back out.
    it("commits the corrected slot to the cache so a later getSunImageUrl() call reuses it", async () => {
      const NOW = Date.UTC(2026, 7, 15, 22, 42, 30);
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      stubImageDecode(false, true); // primary slot 404s, one-step-back fallback loads

      const debug = emptyDebugAccumulator();
      const original = await new SdoSunResolver(cache).resolve(debug, debug);
      expect(original.date.toISOString()).toBe("2026-08-15T22:00:00.000Z"); // stepped back once

      // Moments later — well within the 15-min cache TTL — a background refresh must see the
      // corrected slot, not the original 22:15:00 guess that 404s.
      vi.spyOn(Date, "now").mockReturnValue(NOW + 60000);
      const refreshed = getSunImageUrl(SUN_CACHE_TTL_MS, cache);
      expect(refreshed).toEqual(original);
    });

    it("never commits a failed intermediate guess to the cache", async () => {
      const NOW = Date.UTC(2026, 7, 15, 22, 42, 30);
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      stubImageDecode(false, false, true); // two failed guesses before the fallback that loads

      const debug = emptyDebugAccumulator();
      await new SdoSunResolver(cache).resolve(debug, debug);

      // If a failed attempt had ever written to the cache, this read (issued mid-retry in a
      // real concurrent tick) would have seen one of the two not-yet-published guesses.
      expect(cache.get("sun", SUN_CACHE_TTL_MS)?.date.toISOString()).toBe(
        "2026-08-15T21:45:00.000Z"
      );
    });
  });

  describe("resolve() cooldown/backoff", () => {
    it("a source in cooldown returns the last known-good image without touching the network", async () => {
      const NOW = Date.UTC(2026, 7, 15, 22, 42, 30);
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      stubImageDecode(true);

      const debug = emptyDebugAccumulator();
      const good = await new SdoSunResolver(cache).resolve(debug, debug);
      cache.recordFailure("sun"); // simulate a subsequent tick's failure putting it in cooldown

      const imageCtor = vi.fn();
      vi.stubGlobal(
        "Image",
        class {
          src = "";
          constructor() {
            imageCtor();
          }
          decode() {
            return Promise.resolve();
          }
        }
      );

      const served = await new SdoSunResolver(cache).resolve(debug, debug);
      expect(served).toEqual(good);
      expect(imageCtor).not.toHaveBeenCalled();
    });

    it("a source in cooldown with no prior success throws instead of returning nothing", async () => {
      const NOW = Date.UTC(2026, 7, 15, 22, 42, 30);
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      cache.recordFailure("sun");

      const debug = emptyDebugAccumulator();
      await expect(new SdoSunResolver(cache).resolve(debug, debug)).rejects.toThrow("cooldown");
    });

    it("a successful resolve once the cooldown expires clears it", async () => {
      const NOW = Date.UTC(2026, 7, 15, 22, 42, 30);
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      cache.recordFailure("sun");
      cache.recordFailure("sun"); // 2nd failure doubles the backoff to 2 minutes
      expect(cache.inCooldown("sun")).toBe(true);

      vi.spyOn(Date, "now").mockReturnValue(NOW + 2 * 60000 + 1);
      stubImageDecode(true);
      const debug = emptyDebugAccumulator();
      await new SdoSunResolver(cache).resolve(debug, debug);

      expect(cache.inCooldown("sun")).toBe(false);
    });

    it("exhausting recover()'s retries records a failure that opens a cooldown", async () => {
      const NOW = Date.UTC(2026, 7, 15, 22, 42, 30);
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      stubImageDecode(false, false, false, false); // primary + all SUN_MAX_RETRIES fallbacks fail

      const debug = emptyDebugAccumulator();
      await expect(new SdoSunResolver(cache).resolve(debug, debug)).rejects.toThrow();
      expect(cache.inCooldown("sun")).toBe(true);
    });
  });

  describe("cache isolation", () => {
    it("two resolvers given their own UrlCache never see each other's state", () => {
      const NOW = Date.UTC(2026, 7, 15, 22, 42, 30);
      vi.spyOn(Date, "now").mockReturnValue(NOW);

      const cacheA = new UrlCache();
      const cacheB = new UrlCache();
      const first = getSunImageUrl(SUN_CACHE_TTL_MS, cacheA);
      cacheB.set("sun", { url: "https://example.com/other.jpg", date: new Date(NOW) });

      expect(getSunImageUrl(SUN_CACHE_TTL_MS, cacheA)).toEqual(first);
      expect(cacheB.get("sun", SUN_CACHE_TTL_MS)?.url).toBe("https://example.com/other.jpg");
    });
  });

  describe("SdoSunResolver.hydrate", () => {
    it("returns undefined when nothing has ever been cached", () => {
      expect(new SdoSunResolver(cache).hydrate()).toBeUndefined();
    });

    it("returns the cached sun image while its 15-min slot TTL is still fresh", () => {
      const NOW = Date.UTC(2026, 7, 15, 22, 42, 30);
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      const first = getSunImageUrl(SUN_CACHE_TTL_MS, cache);

      vi.spyOn(Date, "now").mockReturnValue(NOW + 60000);
      expect(new SdoSunResolver(cache).hydrate()).toEqual(first);
    });

    it("returns undefined once the sun slot's TTL has elapsed", () => {
      const NOW = Date.UTC(2026, 7, 15, 22, 42, 30);
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      getSunImageUrl(SUN_CACHE_TTL_MS, cache);

      vi.spyOn(Date, "now").mockReturnValue(NOW + 15 * 60000 + 1);
      expect(new SdoSunResolver(cache).hydrate()).toBeUndefined();
    });
  });
});
