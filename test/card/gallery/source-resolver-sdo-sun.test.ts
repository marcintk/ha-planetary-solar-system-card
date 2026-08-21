import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyDebugAccumulator } from "../../../src/card/gallery/debug.js";
import { FETCH_TIMEOUT_MS } from "../../../src/card/gallery/source-resolver.js";
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

// Models the real browse archive rather than a fixed pass/fail sequence: a slot loads if and
// only if NASA had actually published it. Needed for the stall fixture below, where "which
// URLs exist" is the whole point and the resolver's request order is what's under test.
function stubArchivePublishedUpTo(newestSlotIso: string) {
  const newest = Date.parse(newestSlotIso);
  const state = { calls: 0, requested: [] as string[] };
  vi.stubGlobal(
    "Image",
    class {
      src = "";
      decode() {
        state.calls++;
        state.requested.push(this.src);
        const match = /\/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})_/.exec(this.src);
        if (!match) return Promise.reject(new Error("unparseable slot URL"));
        const [, y, mo, d, h, mi, sec] = match.map(Number);
        const slot = Date.UTC(y, mo - 1, d, h, mi, sec);
        return slot <= newest ? Promise.resolve() : Promise.reject(new Error("404"));
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
    it("hands back the confirmed frame instead of the guess that just 404'd", async () => {
      const NOW = Date.UTC(2026, 7, 15, 22, 42, 30);
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      stubArchivePublishedUpTo("2026-08-15T21:45:00.000Z"); // the 22:00 primary guess is not up yet

      const debug = emptyDebugAccumulator();
      const resolver = new SdoSunResolver(cache);
      const original = await resolver.resolve(debug, debug);
      expect(original.date.toISOString()).toBe("2026-08-15T21:45:00.000Z"); // the newest that exists

      // A later tick recomputes a newer guess that still 404s. It must not surface as a
      // failure or restart a backward walk — the confirmed frame is handed straight back.
      vi.spyOn(Date, "now").mockReturnValue(NOW + 30 * 60000);
      const refreshed = await resolver.resolve(debug, debug);
      expect(refreshed).toEqual(original);
    });

    it("never commits a failed intermediate guess to the cache", async () => {
      const NOW = Date.UTC(2026, 7, 15, 22, 42, 30);
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      stubArchivePublishedUpTo("2026-08-15T20:30:00.000Z"); // several guesses miss before one loads

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

    it("brackets a multi-hour outage by doubling, then narrows to the newest frame", async () => {
      // Newest frame 147 min old. Doubling brackets it between 120 (miss) and 240 (hit);
      // bisecting 180/150/135 inside that bracket lands on the frame itself. Doubling alone
      // would have stopped at 240 and shown a two-hour-older Sun than necessary.
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      const archive = stubArchivePublishedUpTo("2026-08-15T20:15:00.000Z");
      const debug = emptyDebugAccumulator();
      const image = await new SdoSunResolver(cache).resolve(debug, debug);
      expect(image.date.toISOString()).toBe("2026-08-15T20:15:00.000Z");
      expect(archive.calls).toBe(7); // 30, 60, 120, 240, then 180, 150, 135
      expect(debug.retries).toBe(6);
    });

    it("aborts the search when a probe stops answering, rather than walking to the ceiling", async () => {
      // A 404 says "this frame is missing" and is worth another probe; a timeout says the host
      // is not answering, and there is no newer frame hiding behind a dead connection. Without
      // this the 30-day ceiling would queue a dozen 15s waits before the tile gave up.
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
      let calls = 0;
      vi.stubGlobal(
        "Image",
        class {
          src = "";
          decode() {
            calls++;
            return calls === 1 ? Promise.reject(new Error("404")) : new Promise<never>(() => {});
          }
        }
      );

      const debug = emptyDebugAccumulator();
      const resolving = new SdoSunResolver(cache).resolve(debug, debug);
      const settled = expect(resolving).rejects.toThrow("Image load timed out");
      await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS + 1);
      await settled;

      expect(calls).toBe(2); // the primary miss and the hang — the search stops there
      vi.useRealTimers();
    });

    it("costs two requests per refresh while the feed stays stalled", async () => {
      // The point of anchoring to the last confirmed frame. Without it every tick re-ran the
      // whole backward search — measured at ~8 requests a tick against the 2026-08-21 stall.
      const stalled = stubArchivePublishedUpTo("2026-08-21T12:30:00.000Z");
      const resolver = new SdoSunResolver(cache);
      const debug = emptyDebugAccumulator();

      let now = Date.parse("2026-08-21T20:37:00.000Z");
      vi.spyOn(Date, "now").mockReturnValue(now);
      await resolver.resolve(debug, debug);
      const afterColdStart = stalled.calls;

      for (let tick = 0; tick < 8; tick++) {
        now += 15 * 60000;
        vi.spyOn(Date, "now").mockReturnValue(now);
        const image = await resolver.resolve(debug, debug);
        expect(image.date.toISOString()).toBe("2026-08-21T12:30:00.000Z");
      }

      // One probe for the fresh guess, one for the slot just past the confirmed frame.
      expect(stalled.calls - afterColdStart).toBe(16);
    });

    it("catches up to the newest frame in one refresh once the feed recovers", async () => {
      // Creeping forward one slot per tick would take eight hours to recover from an
      // eight-hour stall; bisecting between the confirmed frame and the fresh guess lands on
      // the newest frame immediately.
      const resolver = new SdoSunResolver(cache);
      const debug = emptyDebugAccumulator();

      vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-08-21T20:37:00.000Z"));
      stubArchivePublishedUpTo("2026-08-21T12:30:00.000Z");
      await resolver.resolve(debug, debug);

      // The pipeline restarts and backfills as far as 19:00 — still short of the 20:15 the
      // fresh guess asks for, so the search runs and has a 30-slot gap to cross.
      vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-08-21T20:52:00.000Z"));
      const recovered = stubArchivePublishedUpTo("2026-08-21T19:00:00.000Z");
      const image = await resolver.resolve(debug, debug);

      expect(image.date.toISOString()).toBe("2026-08-21T19:00:00.000Z");
      expect(recovered.calls).toBe(7); // the guess, one past the confirmed frame, then 5 to bisect
    });

    it("skips the search entirely when the guess is only one slot past the confirmed frame", async () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      const archive = stubArchivePublishedUpTo("2026-08-15T21:45:00.000Z");
      const resolver = new SdoSunResolver(cache);
      const debug = emptyDebugAccumulator();
      await resolver.resolve(debug, debug); // confirms 21:45

      // Just past the 22:30 cache hold, the fresh guess is 22:00 — exactly 21:45 plus one
      // slot. It 404s, and there is no gap left between it and the confirmed frame, so
      // nothing more is worth asking.
      vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-08-15T22:32:00.000Z"));
      const before = archive.calls;
      const image = await resolver.resolve(debug, debug);

      expect(image.date.toISOString()).toBe("2026-08-15T21:45:00.000Z");
      expect(archive.calls - before).toBe(1);
    });

    it("gives up at the 30-day ceiling instead of walking back forever", async () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      const archive = stubArchivePublishedUpTo("2026-06-15T00:00:00.000Z"); // nothing within a month
      const debug = emptyDebugAccumulator();
      await expect(new SdoSunResolver(cache).resolve(debug, debug)).rejects.toThrow("404");
      // Doubling means a month of reach costs 14 requests, not the 2880 a per-slot walk would.
      expect(archive.calls).toBe(14);
    });
  });

  // Captured live from sdo.gsfc.nasa.gov on 2026-08-21 at 20:37 UTC, while SDO's browse
  // pipeline was stalled (the same outage #148 reported that morning, still running eight
  // hours later). Verified against the real archive at that instant:
  //
  //   2026/08/20/  96 of 96 slots present — a normal day
  //   2026/08/21/  51 of 96 slots present, newest 12:30:00, published 13:00:05 (a clean +30)
  //   20260821_123000_1024_HMIIC.jpg  ->  HTTP 200
  //   20260821_163000, _183000, _193000, _200000  ->  HTTP 404
  //
  // So the newest frame in existence was 487 minutes old, and the card must reach that far
  // back or show an empty tile to anyone whose card starts cold during the stall.
  describe("2026-08-21 SDO stall", () => {
    const NOW = Date.parse("2026-08-21T20:37:00.000Z");
    const NEWEST_PUBLISHED = "2026-08-21T12:30:00.000Z";

    it("finds the newest frame that actually exists, 487 minutes back", async () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      stubArchivePublishedUpTo(NEWEST_PUBLISHED);

      const debug = emptyDebugAccumulator();
      const image = await new SdoSunResolver(cache).resolve(debug, debug);

      expect(image.date.toISOString()).toBe(NEWEST_PUBLISHED);
    });

    it("crosses the UTC day boundary correctly when reaching back that far", async () => {
      // A frame this old can sit in the previous day's directory, and the path is built from
      // the slot's own date — so a deep reach must not keep asking today's folder.
      vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-08-22T02:00:00.000Z"));
      stubArchivePublishedUpTo(NEWEST_PUBLISHED);

      const debug = emptyDebugAccumulator();
      const image = await new SdoSunResolver(cache).resolve(debug, debug);

      expect(image.date.toISOString()).toBe(NEWEST_PUBLISHED);
      expect(image.url).toContain("/2026/08/21/20260821_123000_");
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
