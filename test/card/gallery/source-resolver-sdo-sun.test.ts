import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyDebugAccumulator } from "../../../src/card/gallery/debug-stats.js";
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
  const state = { calls: 0, probes: [] as { slot: number; ok: boolean }[] };
  vi.stubGlobal(
    "Image",
    class {
      src = "";
      decode() {
        state.calls++;
        const match = /\/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})_/.exec(this.src);
        if (!match) return Promise.reject(new Error("unparseable slot URL"));
        const [, y, mo, d, h, mi, sec] = match.map(Number);
        const slot = Date.UTC(y, mo - 1, d, h, mi, sec);
        const ok = slot <= newest;
        state.probes.push({ slot, ok });
        return ok ? Promise.resolve() : Promise.reject(new Error("404"));
      }
    }
  );
  return state;
}

// This one test reports rather than merely asserts: its probe-by-probe trace is what a human
// reads when tuning the search strategy, so the output is the deliverable, not debug residue.
// Run it with `npx vitest run test/card/gallery/source-resolver-sdo-sun.test.ts -t "optimal
// number of probes" --disableConsoleIntercept` to see it.
// biome-ignore lint/suspicious/noConsole: see above — deliberate, and confined to this helper.
const print = (line: string) => console.log(line);

// The real publish rule rather than a flat cutoff: SDO posts a :15/:45 slot 25 minutes after
// capture and a :00/:30 slot 30 minutes after (measured in #148, zero jitter). Existence is
// therefore a function of the mocked clock, so the same stub serves a whole run of ticks.
function stubArchiveWithRealPublishLag() {
  const state = { calls: 0, probes: [] as { slot: number; ok: boolean }[] };
  vi.stubGlobal(
    "Image",
    class {
      src = "";
      decode() {
        state.calls++;
        const match = /\/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})_/.exec(this.src);
        if (!match) return Promise.reject(new Error("unparseable slot URL"));
        const [, y, mo, d, h, mi, sec] = match.map(Number);
        const slot = Date.UTC(y, mo - 1, d, h, mi, sec);
        const ok = Date.now() >= slot + publishLagMs(slot);
        state.probes.push({ slot, ok });
        return ok ? Promise.resolve() : Promise.reject(new Error("404"));
      }
    }
  );
  return state;
}

function publishLagMs(slot: number): number {
  const minute = new Date(slot).getUTCMinutes();
  return (minute === 0 || minute === 30 ? 30 : 25) * 60000;
}

// The best any client could possibly do at this instant, whatever strategy it used.
function newestPublishedAt(now: number): number {
  let slot = Math.floor(now / SUN_CACHE_TTL_MS) * SUN_CACHE_TTL_MS;
  while (now < slot + publishLagMs(slot)) slot -= SUN_CACHE_TTL_MS;
  return slot;
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

    it("treats a network-blocked probe as a miss, not a dead host, even when decode() itself never settles", async () => {
      // ORB (Chrome's opaque-response blocking) blocks a cross-origin error response before it
      // ever reaches decode() — the network layer fails in milliseconds, but decode()'s promise
      // can be left never settling. Without also racing the <img> `error` event, that reads
      // identically to a truly dead host and wrongly aborts the whole search on one blocked
      // slot, even though every other slot would 404 normally and the walk would otherwise
      // succeed.
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
      let calls = 0;
      vi.stubGlobal(
        "Image",
        class {
          src = "";
          onerror: (() => void) | null = null;
          decode() {
            calls++;
            if (calls === 1) return Promise.reject(new Error("404"));
            if (calls === 2) {
              queueMicrotask(() => this.onerror?.());
              return new Promise<never>(() => {});
            }
            return Promise.resolve();
          }
        }
      );

      const debug = emptyDebugAccumulator();
      const resolving = new SdoSunResolver(cache).resolve(debug, debug);
      await vi.advanceTimersByTimeAsync(10);
      const image = await resolving;

      expect(image).toBeDefined();
      expect(calls).toBe(3); // the blocked slot cost one probe, not the whole search
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

    it("holds the confirmed frame for a full TTL after a re-check, so getSunImageUrl() skips the network for the next minute of ticks (#152)", async () => {
      stubArchivePublishedUpTo("2026-08-21T12:30:00.000Z");
      const resolver = new SdoSunResolver(cache);
      const debug = emptyDebugAccumulator();

      let now = Date.parse("2026-08-21T20:37:00.000Z");
      vi.spyOn(Date, "now").mockReturnValue(now);
      await resolver.resolve(debug, debug); // cold start: confirms 12:30, stamps the check
      now += 15 * 60000;
      vi.spyOn(Date, "now").mockReturnValue(now);
      await resolver.resolve(debug, debug); // re-check: still nothing newer, re-stamps

      const stalled = stubArchivePublishedUpTo("2026-08-21T12:30:00.000Z");
      // 1-minute ticks, well inside the freshly stamped 15-min window and long past the
      // slot's own 45-min buffer window — getSunImageUrl() must serve the cache, not probe.
      for (let tick = 0; tick < 5; tick++) {
        now += 60000;
        vi.spyOn(Date, "now").mockReturnValue(now);
        const image = getSunImageUrl(cache);
        expect(image.date.toISOString()).toBe("2026-08-21T12:30:00.000Z");
      }
      expect(stalled.calls).toBe(0);
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
      // The guess at this moment lands exactly on the newest published frame, so the very
      // first resolve() succeeds directly and never touches recover() — the check that
      // stamps lastCheckedAt (#152) — leaving the throttle clear for the second call below.
      vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-08-15T22:15:00.000Z"));
      const archive = stubArchivePublishedUpTo("2026-08-15T21:45:00.000Z");
      const resolver = new SdoSunResolver(cache);
      const debug = emptyDebugAccumulator();
      await resolver.resolve(debug, debug); // confirms 21:45

      // Well past both the 22:30 cache hold and any #152 throttle, the fresh guess is 22:00
      // — exactly 21:45 plus one slot. It 404s, and there is no gap left between it and the
      // confirmed frame, so nothing more is worth asking.
      vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-08-15T22:44:00.000Z"));
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

    // Same theoretical bound as the 487-minute case below (2026-08-21 SDO stall's "optimal
    // number of probes" test), swept across gaps from "inside the publish buffer" up to the
    // 30-day ceiling — so a regression in the search strategy shows up as a budget overrun at
    // whichever gap size it actually affects, not just the one distance that's been measured.
    it.each([
      ["20 minutes", 20],
      ["40 minutes", 40],
      ["3 hours", 3 * 60],
      ["6 hours", 6 * 60],
      ["12 hours", 12 * 60],
      ["15 hours", 15 * 60],
      ["24 hours", 24 * 60],
      ["48 hours", 48 * 60],
      ["30 days", 30 * 24 * 60],
    ] as const)(
      "stays within the optimal probe budget — newest frame %s old",
      async (label, gapMinutes) => {
        vi.spyOn(Date, "now").mockReturnValue(NOW);
        const newestSlot =
          Math.floor((NOW - gapMinutes * 60000) / SUN_CACHE_TTL_MS) * SUN_CACHE_TTL_MS;
        const archive = stubArchivePublishedUpTo(new Date(newestSlot).toISOString());
        const debug = emptyDebugAccumulator();

        const image = await new SdoSunResolver(cache).resolve(debug, debug);

        expect(new Set(archive.probes.map((p) => p.slot)).size).toBe(archive.probes.length); // never asks twice

        // Exponential search: gallop out doubling the reach to bracket the gap, then bisect the
        // bracket. Both halves are ceil(log2(d+1)) probes for a d-slot gap, plus the one initial
        // guess that discovered the gap — see the "optimal number of probes" test above for the
        // full derivation. gapSlots <= 0 means the guess already landed on or past the newest
        // published frame (inside the 30-min publish buffer), so there was nothing to search for
        // and the theoretical floor collapses to that one guess.
        const gapSlots = (archive.probes[0].slot - newestSlot) / SUN_CACHE_TTL_MS;
        const optimal = gapSlots <= 0 ? 1 : 1 + 2 * Math.ceil(Math.log2(gapSlots + 1));
        print(
          `\n${label}: gap ${Math.max(gapSlots, 0)} slots (${(Math.max(gapSlots, 0) * 15) / 60}h), ` +
            `spent ${archive.calls}, optimal ${optimal}`
        );
        expect(archive.calls).toBeLessThanOrEqual(optimal);

        if (gapSlots > 0) {
          expect(image.date.getTime()).toBe(newestSlot); // recover() explicitly targets the newest
        }
      }
    );
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

    // Prints every probe the search spends, and asserts the count against the theoretical
    // optimum rather than against a number someone once observed.
    //
    // Finding the boundary of a published range at an unknown distance d slots is exponential
    // search: gallop out doubling the reach to bracket d, then bisect the bracket. Both halves
    // are ceil(log2(d+1)) probes, so 2*ceil(log2(d+1)) is the optimum, and one more for the
    // fresh guess that discovers the gap exists at all. No strategy does better without
    // knowing d in advance, which is exactly what the missing CORS header denies us.
    it("finds the frame within the optimal number of probes, and reports each one", async () => {
      const archive = stubArchivePublishedUpTo(NEWEST_PUBLISHED);
      const newest = Date.parse(NEWEST_PUBLISHED);
      const resolver = new SdoSunResolver(cache);
      const debug = emptyDebugAccumulator();
      const hhmm = (t: number) => new Date(t).toISOString().slice(11, 16);

      const report = (label: string, now: number, from: number) => {
        const probes = archive.probes.slice(from);
        print(`\n${label} — now ${hhmm(now)} UTC, newest frame on archive ${hhmm(newest)}`);
        for (const [i, { slot, ok }] of probes.entries()) {
          const age = Math.round((now - slot) / 60000);
          const off = Math.round((slot - newest) / 60000);
          const verdict = ok ? "200 exists" : "404 not published";
          const gap = off === 0 ? "on target" : off > 0 ? `${off}m too new` : `${-off}m too old`;
          print(
            `  probe ${String(i + 1).padStart(2)}  ask ${hhmm(slot)}  ` +
              `age ${String(age).padStart(4)}m  ${verdict.padEnd(18)} ${gap}`
          );
        }
        return probes;
      };

      // Cold start, mid-stall: nothing confirmed yet, so the gap has to be discovered.
      let now = Date.parse("2026-08-21T20:37:00.000Z");
      vi.spyOn(Date, "now").mockReturnValue(now);
      const image = await resolver.resolve(debug, debug);
      const cold = report("COLD START", now, 0);

      const gapSlots = (cold[0].slot - newest) / SUN_CACHE_TTL_MS;
      const optimal = 1 + 2 * Math.ceil(Math.log2(gapSlots + 1));
      print(
        `\n  gap ${gapSlots} slots (${(gapSlots * 15) / 60}h)  ` +
          `spent ${cold.length}  optimal ${optimal}`
      );

      expect(image.date.toISOString()).toBe(NEWEST_PUBLISHED); // landed on the newest that exists
      expect(cold.length).toBeLessThanOrEqual(optimal);
      expect(new Set(cold.map((p) => p.slot)).size).toBe(cold.length); // never asks twice

      // Steady state: the stall continues. Each tick must cost the two probes it takes to
      // learn "the guess is still not up" and "nothing newer than what we hold exists" —
      // never a fresh walk back through the gap.
      let steadyTotal = 0;
      for (let tick = 1; tick <= 3; tick++) {
        now += 15 * 60000;
        vi.spyOn(Date, "now").mockReturnValue(now);
        const before = archive.probes.length;
        const held = await resolver.resolve(debug, debug);
        const spent = report(`TICK ${tick}`, now, before);
        steadyTotal += spent.length;
        expect(held.date.toISOString()).toBe(NEWEST_PUBLISHED);
        expect(spent.length).toBe(2);
      }
      print(`\n  3 stalled ticks cost ${steadyTotal} probes total\n`);
      expect(steadyTotal).toBe(6);
    });

    // Continues where the probe-budget test stops: the pipeline restarts and backfills
    // everything it owed, and we ask what it then costs to stay current, and how fresh the
    // frame on screen actually is against the freshest one that physically exists.
    it("catches up when the feed restarts, then holds current for one probe a tick", async () => {
      const hhmm = (t: number) => new Date(t).toISOString().slice(11, 16);
      const resolver = new SdoSunResolver(cache);
      const debug = emptyDebugAccumulator();

      // Stall first, so the resolver enters the recovery holding the 12:30 frame.
      let now = Date.parse("2026-08-21T20:37:00.000Z");
      vi.spyOn(Date, "now").mockReturnValue(now);
      stubArchivePublishedUpTo("2026-08-21T12:30:00.000Z");
      const stalled = await resolver.resolve(debug, debug);
      expect(stalled.date.toISOString()).toBe("2026-08-21T12:30:00.000Z");

      // The pipeline restarts and backfills the whole eight-hour debt.
      const archive = stubArchiveWithRealPublishLag();
      let worstStaleness = 0;

      print("\nRECOVERY AND STEADY STATE — archive now publishing normally");
      print("  tick  now     probes  frame shown  age   best possible  behind");
      for (let tick = 1; tick <= 6; tick++) {
        now += 15 * 60000;
        vi.spyOn(Date, "now").mockReturnValue(now);
        const before = archive.probes.length;
        const image = await resolver.resolve(debug, debug);
        const spent = archive.probes.length - before;

        const best = newestPublishedAt(now);
        const behind = (best - image.date.getTime()) / 60000;
        worstStaleness = Math.max(worstStaleness, behind);
        print(
          `  ${String(tick).padStart(4)}  ${hhmm(now)}   ${String(spent).padStart(5)}  ` +
            `${hhmm(image.date.getTime())}        ${String(
              Math.round((now - image.date.getTime()) / 60000)
            ).padStart(3)}m  ${hhmm(best)} (${String(Math.round((now - best) / 60000)).padStart(
              2
            )}m)      ${behind === 0 ? "current" : `${behind}m`}`
        );

        if (tick === 1) {
          // One tick to cross the whole eight-hour debt, not one slot per tick.
          expect(spent).toBeLessThanOrEqual(11);
          expect(image.date.getTime()).toBe(best);
        } else {
          // Current again: the confirmed frame is one slot behind the fresh guess, so the
          // guess either loads outright or is settled by a single follow-up probe.
          expect(spent).toBeLessThanOrEqual(2);
        }
      }

      // The floor is physics, not strategy: nothing published sooner than 25 minutes after
      // capture can be fetched, and a 30-minute buffer rounds that to the slot grid — so the
      // card can trail the best-possible frame by at most one slot, never more.
      print(`\n  worst staleness against the best any client could do: ${worstStaleness}m\n`);
      expect(worstStaleness).toBeLessThanOrEqual(15);
    });

    // The tick cadence above always lands at the same phase of the slot grid, which hides the
    // one case where a 30-minute buffer is not optimal. Sweep every minute of an hour instead
    // and measure how far behind the physically-freshest frame the card ever sits.
    it("never trails the freshest published frame by more than one slot, at any phase", async () => {
      const archive = stubArchiveWithRealPublishLag();
      const debug = emptyDebugAccumulator();
      const hhmm = (t: number) => new Date(t).toISOString().slice(11, 16);

      const start = Date.parse("2026-08-21T22:00:00.000Z");
      let behindMinutes = 0;
      let bestAge = Number.POSITIVE_INFINITY;
      let worstAge = 0;
      const windows: string[] = [];

      for (let minute = 0; minute < 60; minute++) {
        const now = start + minute * 60000;
        vi.spyOn(Date, "now").mockReturnValue(now);
        const before = archive.probes.length;
        // A fresh cache each minute: this measures the strategy, not the TTL hold.
        const image = await new SdoSunResolver(new UrlCache()).resolve(debug, debug);
        expect(archive.probes.length - before).toBe(1); // always one probe when healthy

        const best = newestPublishedAt(now);
        const behind = (best - image.date.getTime()) / 60000;
        const age = (now - image.date.getTime()) / 60000;
        bestAge = Math.min(bestAge, age);
        worstAge = Math.max(worstAge, age);
        if (behind > 0) {
          behindMinutes++;
          windows.push(`${hhmm(now)} shows ${hhmm(image.date.getTime())}, ${hhmm(best)} was up`);
        }
      }

      print("\nFRESHNESS SWEEP — every minute of 22:00-23:00, one probe each");
      print(`  frame age on screen: ${bestAge}-${worstAge} minutes`);
      print(`  physical floor (SDO publishes at capture +25): 25 minutes`);
      print(`  minutes trailing the freshest frame: ${behindMinutes} of 60`);
      for (const w of windows) print(`    ${w}`);
      print("");

      expect(worstAge).toBeLessThanOrEqual(45); // never worse than the buffer plus one slot
      expect(behindMinutes).toBeLessThanOrEqual(15); // and only inside the publish-lag windows
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

    it("ignores an optimistic guess that was never actually confirmed to decode", () => {
      // getSunImageUrl() writes its guess to the TTL cache before anything has verified it
      // loads (see its own comment). hydrate() must not trust that alone — trusting it here
      // would markDecoded() a URL nothing proved loads, letting every refresh afterward skip
      // the real network check.
      const NOW = Date.UTC(2026, 7, 15, 22, 42, 30);
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      getSunImageUrl(cache); // slot = 22:00:00 — cached, but never decode-confirmed

      expect(new SdoSunResolver(cache).hydrate()).toBeUndefined();
    });

    it("returns the last confirmed image regardless of its TTL window", async () => {
      vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 7, 15, 22, 42, 30));
      stubImageDecode(true);
      const debug = emptyDebugAccumulator();
      const confirmed = await new SdoSunResolver(cache).resolve(debug, debug);

      // Long past the 15-min TTL + 30-min buffer window — hydrate() isn't a freshness check,
      // it only answers "do we know something that actually works".
      vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 7, 16, 4, 0, 0));
      expect(new SdoSunResolver(cache).hydrate()).toEqual(confirmed);
    });
  });
});
