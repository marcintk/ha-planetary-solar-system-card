import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyDebugAccumulator } from "../../../src/card/gallery/debug.js";
import {
  getSunImageUrl,
  SDO_BROWSE_BASE_URL,
  SdoSunResolver,
  SUN_CACHE_TTL_MS,
} from "../../../src/card/gallery/source-resolver-sdo-sun.js";
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

describe("source-resolver-sdo-sun", () => {
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
      const { url, date } = getSunImageUrl(cache);
      expect(url).toBe(`${SDO_BROWSE_BASE_URL}/2026/08/15/20260815_221500_1024_HMIIC.jpg`);
      expect(date.toISOString()).toBe("2026-08-15T22:15:00.000Z");
    });

    it("returns the cached result while the slot's own buffer window is still open", () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      const first = getSunImageUrl(cache);
      // first.date = 22:15:00; valid until 22:15 + 15m TTL + 20m buffer = 22:50:00.
      vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-08-15T22:49:59.999Z"));
      const second = getSunImageUrl(cache);
      expect(second).toEqual(first);
    });

    it("recomputes with a fresh slot once the slot's own buffer window has closed", () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      const first = getSunImageUrl(cache);
      vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-08-15T22:50:00.001Z"));
      const second = getSunImageUrl(cache);
      expect(second).not.toEqual(first);
    });

    it("expiry depends only on the cached slot's own date, never on when it was fetched", () => {
      // The bug this fixes: the old sliding TTL counted from fetchedAt (whenever a card
      // instance happened to populate its cache), so two cards holding the exact same slot
      // but caching it at different real moments went stale at two different instants and
      // never re-synced. Anchoring expiry to slot.date instead means validity is a pure
      // function of the slot itself, regardless of fetchedAt.
      const slot = {
        url: "https://example.com/slot.jpg",
        date: new Date(Date.UTC(2026, 7, 15, 22, 0, 0)),
      };
      const cacheA = new UrlCache();
      const cacheB = new UrlCache();

      vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 7, 15, 22, 1, 0));
      cacheA.set("sun", slot); // fetchedAt 22:01

      vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 7, 15, 22, 33, 0));
      cacheB.set("sun", slot); // fetchedAt 22:33 — 32 minutes later than A

      // Both hold the same slot until slot + 15m TTL + 20m buffer = 22:35:00, regardless of
      // when each cache was actually populated.
      vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 7, 15, 22, 34, 59));
      expect(getSunImageUrl(cacheA)).toEqual(slot);
      expect(getSunImageUrl(cacheB)).toEqual(slot);

      vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-08-15T22:35:00.001Z"));
      expect(getSunImageUrl(cacheA)).not.toEqual(slot);
      expect(getSunImageUrl(cacheB)).not.toEqual(slot);
      expect(getSunImageUrl(cacheA)).toEqual(getSunImageUrl(cacheB));
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
      const refreshed = getSunImageUrl(cache);
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
      const first = getSunImageUrl(cacheA);
      cacheB.set("sun", { url: "https://example.com/other.jpg", date: new Date(NOW) });

      expect(getSunImageUrl(cacheA)).toEqual(first);
      expect(cacheB.get("sun", SUN_CACHE_TTL_MS)?.url).toBe("https://example.com/other.jpg");
    });
  });

  describe("SdoSunResolver.hydrate", () => {
    it("returns undefined when nothing has ever been cached", () => {
      expect(new SdoSunResolver(cache).hydrate()).toBeUndefined();
    });

    it("returns the cached sun image while its slot's buffer window is still open", () => {
      const NOW = Date.UTC(2026, 7, 15, 22, 42, 30);
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      const first = getSunImageUrl(cache); // slot = 22:15:00, valid until 22:50:00

      vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-08-15T22:49:59.999Z"));
      expect(new SdoSunResolver(cache).hydrate()).toEqual(first);
    });

    it("returns undefined once the sun slot's buffer window has closed", () => {
      const NOW = Date.UTC(2026, 7, 15, 22, 42, 30);
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      getSunImageUrl(cache); // slot = 22:15:00, valid until 22:50:00

      vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-08-15T22:50:00.001Z"));
      expect(new SdoSunResolver(cache).hydrate()).toBeUndefined();
    });
  });
});
