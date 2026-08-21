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
// Returns the live attempt counter, so a test can assert how many real probes a refresh cost
// — the buffer's whole point is spending fewer of them.
function stubImageDecode(...results: boolean[]) {
  const state = { calls: 0 };
  vi.stubGlobal(
    "Image",
    class {
      src = "";
      decode() {
        const succeeds = results.length ? results[Math.min(state.calls, results.length - 1)] : true;
        state.calls++;
        return succeeds ? Promise.resolve() : Promise.reject(new Error("decode failed"));
      }
    }
  );
  return state;
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
    // now = 2026-08-15T22:42:30Z; minus the 30-min floor publish buffer = 22:12:30;
    // floored to the last 15-min slot = 22:00:00.
    const NOW = Date.UTC(2026, 7, 15, 22, 42, 30);

    it("computes the SDO browse-archive URL for the last published 15-min slot, buffered for publish latency", () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      const { url, date } = getSunImageUrl(cache);
      expect(url).toBe(`${SDO_BROWSE_BASE_URL}/2026/08/15/20260815_220000_1024_HMIIC.jpg`);
      expect(date.toISOString()).toBe("2026-08-15T22:00:00.000Z");
    });

    it("returns the cached result while the slot's own buffer window is still open", () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      const first = getSunImageUrl(cache);
      // first.date = 22:00:00; valid until 22:00 + 15m TTL + 30m learned buffer = 22:45:00.
      vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-08-15T22:44:59.999Z"));
      const second = getSunImageUrl(cache);
      expect(second).toEqual(first);
    });

    it("recomputes with a fresh slot once the slot's own buffer window has closed", () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      const first = getSunImageUrl(cache);
      vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-08-15T22:45:00.001Z"));
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

      // A's 1-minute lag floors below the 30-min buffer floor and clamps up to it; B's
      // 33-minute lag floors to exactly 30. Both therefore hold the same slot until
      // slot + 15m TTL + 30m buffer = 22:45:00, regardless of when each cache was populated.
      vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 7, 15, 22, 44, 59));
      expect(getSunImageUrl(cacheA)).toEqual(slot);
      expect(getSunImageUrl(cacheB)).toEqual(slot);

      vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-08-15T22:45:00.001Z"));
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
      stubImageDecode(false, true); // primary slot 404s, first widened buffer loads

      const debug = emptyDebugAccumulator();
      const original = await new SdoSunResolver(cache).resolve(debug, debug);
      expect(original.date.toISOString()).toBe("2026-08-15T21:30:00.000Z"); // buffer doubled to 60m

      // Moments later — well within the 15-min cache TTL — a background refresh must see the
      // corrected slot, not the original 22:00:00 guess that 404s.
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
        "2026-08-15T20:30:00.000Z"
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

  describe("adaptive publish buffer", () => {
    const NOW = Date.UTC(2026, 7, 15, 22, 42, 30);

    it("never asks for a slot NASA could not yet have published, at any minute of the day", () => {
      // The regression the old fixed 20-min buffer failed: SDO publishes a slot 25 min after
      // its capture time at the earliest (:15/:45 slots; :00/:30 take 30), so a guess younger
      // than 25 minutes is a guaranteed 404. Swept across a whole day because the failure was
      // slot-phase-dependent — it hit exactly half the minutes, which a single fixed `now`
      // has even odds of missing.
      const dayStart = Date.UTC(2026, 7, 15, 0, 0, 0);
      for (let minute = 0; minute < 1440; minute++) {
        const now = dayStart + minute * 60000;
        vi.spyOn(Date, "now").mockReturnValue(now);
        const { date } = getSunImageUrl(new UrlCache());
        expect(now - date.getTime()).toBeGreaterThanOrEqual(25 * 60000);
      }
    });

    it("resolves a slot the moment its 30-min floor buffer elapses, not a slot later", () => {
      const slot = Date.UTC(2026, 7, 15, 22, 15, 0);
      vi.spyOn(Date, "now").mockReturnValue(slot + 30 * 60000);
      expect(getSunImageUrl(new UrlCache()).date.toISOString()).toBe("2026-08-15T22:15:00.000Z");
      vi.spyOn(Date, "now").mockReturnValue(slot + 30 * 60000 - 1);
      expect(getSunImageUrl(new UrlCache()).date.toISOString()).toBe("2026-08-15T22:00:00.000Z");
    });

    it("costs exactly one request and no retries while the buffer sits at its floor", async () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      const decode = stubImageDecode(true);
      const debug = emptyDebugAccumulator();
      await new SdoSunResolver(cache).resolve(debug, debug);
      expect(decode.calls).toBe(1);
      expect(debug.retries).toBe(0);
    });

    it("doubles the buffer to reach back through a multi-hour outage on a cold start", async () => {
      // 2026-08-21 as a fixture: SDO's browse pipeline stalled and its newest frame was 138
      // minutes old. 30/60/120 all 404; 240 lands on a slot that exists.
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      stubImageDecode(false, false, false, true);
      const debug = emptyDebugAccumulator();
      const image = await new SdoSunResolver(cache).resolve(debug, debug);
      expect(image.date.toISOString()).toBe("2026-08-15T18:30:00.000Z"); // NOW - 240 min, floored
      expect(debug.retries).toBe(3);
    });

    it("gives up at the 240-min ceiling instead of walking back forever", async () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      const decode = stubImageDecode(false);
      const debug = emptyDebugAccumulator();
      await expect(new SdoSunResolver(cache).resolve(debug, debug)).rejects.toThrow(
        "decode failed"
      );
      expect(decode.calls).toBe(4); // 30, 60, 120, 240 — then unavailable, same as any dead source
    });

    it("shrinks the learned buffer by one slot per successful refresh", async () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      stubImageDecode(false, true);
      const debug = emptyDebugAccumulator();
      const recovered = await new SdoSunResolver(cache).resolve(debug, debug);
      expect(recovered.date.toISOString()).toBe("2026-08-15T21:30:00.000Z"); // learned buffer 60

      // Entry valid until 21:30 + 15m TTL + 60m buffer = 22:45. The next refresh probes one
      // slot shorter than what it learned — 45 min, not 60.
      vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-08-15T22:45:00.001Z"));
      expect(getSunImageUrl(cache).date.toISOString()).toBe("2026-08-15T22:00:00.000Z");

      // ...and having succeeded at 45, the one after that probes 30 — back at the floor,
      // where it stops shrinking.
      vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-08-15T23:00:00.001Z"));
      expect(getSunImageUrl(cache).date.toISOString()).toBe("2026-08-15T22:30:00.000Z");
    });

    it("restores the learned buffer when the shorter probe 404s", async () => {
      vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 7, 15, 22, 30, 0));
      // A prior commit whose lag was 60 minutes — that is the learned buffer.
      cache.set("sun", {
        url: "https://example.com/prior.jpg",
        date: new Date(Date.UTC(2026, 7, 15, 21, 30, 0)),
      });

      vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-08-15T22:45:00.001Z"));
      stubImageDecode(false, true); // the 45-min probe 404s, the restored 60 loads
      const debug = emptyDebugAccumulator();
      const image = await new SdoSunResolver(cache).resolve(debug, debug);

      expect(image.date.toISOString()).toBe("2026-08-15T21:45:00.000Z"); // NOW - 60 min, floored
      expect(debug.retries).toBe(1); // one wasted probe, not a fresh walk back from the floor
    });

    it("clamps an ancient cached lag to the 240-min ceiling", () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      cache.set("sun", {
        url: "https://example.com/ancient.jpg",
        date: new Date(NOW - 10 * 3600000),
      });
      // Without the clamp the next probe would be 585 min back; with it, 225 (240 minus the
      // one-slot probe-down), floored to the grid.
      expect(getSunImageUrl(cache).date.toISOString()).toBe("2026-08-15T18:45:00.000Z");
    });

    it("at the ceiling, restoring the buffer is the whole ladder — it is not probed twice", async () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      cache.set("sun", {
        url: "https://example.com/ancient.jpg",
        date: new Date(NOW - 10 * 3600000),
      });
      const decode = stubImageDecode(false);
      const debug = emptyDebugAccumulator();

      await expect(new SdoSunResolver(cache).resolve(debug, debug)).rejects.toThrow(
        "decode failed"
      );
      // 225 (the probe) then 240 (the restore, which is already the ceiling) — the doubling
      // rungs are all past the ceiling, and the ceiling itself is not appended a second time.
      expect(decode.calls).toBe(2);
    });
  });

  describe("SdoSunResolver.hydrate", () => {
    it("returns undefined when nothing has ever been cached", () => {
      expect(new SdoSunResolver(cache).hydrate()).toBeUndefined();
    });

    it("returns the cached sun image while its slot's buffer window is still open", () => {
      const NOW = Date.UTC(2026, 7, 15, 22, 42, 30);
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      const first = getSunImageUrl(cache); // slot = 22:00:00, valid until 22:45:00

      vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-08-15T22:44:59.999Z"));
      expect(new SdoSunResolver(cache).hydrate()).toEqual(first);
    });

    it("returns undefined once the sun slot's buffer window has closed", () => {
      const NOW = Date.UTC(2026, 7, 15, 22, 42, 30);
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      getSunImageUrl(cache); // slot = 22:00:00, valid until 22:45:00

      vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-08-15T22:45:00.001Z"));
      expect(new SdoSunResolver(cache).hydrate()).toBeUndefined();
    });
  });
});
