import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyDebugAccumulator } from "../../../src/card/gallery/debug-stats.js";
import {
  DscovrEarthResolver,
  EPIC_BASE_URL,
  EpicApiError,
  fetchLatestEarthImageUrl,
} from "../../../src/card/gallery/source-resolver-dscovr-earth.js";
import { UrlCache } from "../../../src/card/gallery/url-cache.js";

describe("source-resolver-dscovr-earth", () => {
  // Each test gets its own UrlCache, so nothing here shares state with the module-level
  // default (which production relies on for remount survival, but tests don't need).
  let cache: UrlCache;

  beforeEach(() => {
    cache = new UrlCache();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("fetchLatestEarthImageUrl", () => {
    it("builds the archive URL and UTC capture date from the last (most recent) entry", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([{ identifier: "20260810005516" }, { identifier: "20260810234950" }]),
      });
      vi.stubGlobal("fetch", fetchMock);

      const { url, date } = await fetchLatestEarthImageUrl(undefined, cache);

      expect(fetchMock).toHaveBeenCalledWith(
        `${EPIC_BASE_URL}/api/natural`,
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(url).toBe(
        `${EPIC_BASE_URL}/archive/natural/2026/08/10/jpg/epic_1b_20260810234950.jpg`
      );
      expect(date.toISOString()).toBe("2026-08-10T23:49:50.000Z");
    });

    it("returns the cached result within the TTL without calling fetch again", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ identifier: "20260810234950" }]),
      });
      vi.stubGlobal("fetch", fetchMock);

      const first = await fetchLatestEarthImageUrl(undefined, cache);
      const second = await fetchLatestEarthImageUrl(undefined, cache);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(second).toEqual(first);
    });

    it("a shorter maxAgeMs expires the cache sooner and calls fetch again", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ identifier: "20260810234950" }]),
      });
      vi.stubGlobal("fetch", fetchMock);

      await fetchLatestEarthImageUrl(undefined, cache);
      await fetchLatestEarthImageUrl(0, cache);

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("throws when the response is empty", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })
      );
      await expect(fetchLatestEarthImageUrl(undefined, cache)).rejects.toThrow();
    });

    it("throws an EpicApiError when the request fails, even with no headers object on the response", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
      await expect(fetchLatestEarthImageUrl(undefined, cache)).rejects.toBeInstanceOf(EpicApiError);
    });

    it("throws with no retryAfterMs when rate-limited without a Retry-After header", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 429, headers: { get: () => null } })
      );
      try {
        await fetchLatestEarthImageUrl(undefined, cache);
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(EpicApiError);
        expect((err as EpicApiError).retryAfterMs).toBeUndefined();
      }
    });

    it("carries a delta-seconds Retry-After header as retryAfterMs", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 429, headers: { get: () => "120" } })
      );
      try {
        await fetchLatestEarthImageUrl(undefined, cache);
        expect.unreachable();
      } catch (err) {
        expect((err as EpicApiError).retryAfterMs).toBe(120000);
      }
    });

    it("carries an HTTP-date Retry-After header as retryAfterMs", async () => {
      vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 9, 21, 7, 26, 0));
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 429,
          headers: { get: () => "Wed, 21 Oct 2026 07:28:00 GMT" },
        })
      );
      try {
        await fetchLatestEarthImageUrl(undefined, cache);
        expect.unreachable();
      } catch (err) {
        expect((err as EpicApiError).retryAfterMs).toBe(120000);
      }
    });

    it("an unparseable Retry-After header (neither seconds nor a valid date) yields no retryAfterMs", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 429,
          headers: { get: () => "not-a-valid-retry-after" },
        })
      );
      try {
        await fetchLatestEarthImageUrl(undefined, cache);
        expect.unreachable();
      } catch (err) {
        expect((err as EpicApiError).retryAfterMs).toBeUndefined();
      }
    });

    it("aborts and rejects a request that hangs past the timeout, bounding an otherwise-indefinite stall", async () => {
      // Stubs AbortSignal.timeout to fire immediately instead of waiting out the real
      // FETCH_TIMEOUT_MS bound, so this test verifies the abort wiring without a real sleep.
      vi.spyOn(AbortSignal, "timeout").mockReturnValue(AbortSignal.abort(new Error("timeout")));
      vi.stubGlobal(
        "fetch",
        vi.fn((_url: string, init?: { signal?: AbortSignal }) =>
          init?.signal?.aborted
            ? Promise.reject(init.signal.reason)
            : Promise.reject(new Error("expected an aborted signal"))
        )
      );

      await expect(fetchLatestEarthImageUrl(undefined, cache)).rejects.toThrow("timeout");
    });
  });

  describe("DscovrEarthResolver.resolve cooldown", () => {
    it("a 429 with Retry-After sets a cooldown at least as long as the header value", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 429, headers: { get: () => "7200" } }) // 2 hours
      );
      vi.spyOn(Date, "now").mockReturnValue(0);

      const debug = emptyDebugAccumulator();
      await expect(new DscovrEarthResolver(cache).resolve(debug, debug)).rejects.toThrow();

      vi.spyOn(Date, "now").mockReturnValue(3600000); // 1 hour later, under the 2-hour Retry-After
      expect(cache.inCooldown("earth")).toBe(true);
    });
  });

  describe("DscovrEarthResolver.hydrate", () => {
    it("returns undefined when nothing has ever been cached", () => {
      expect(new DscovrEarthResolver(cache).hydrate()).toBeUndefined();
    });

    it("ignores a looked-up URL that was never actually confirmed to decode", async () => {
      // fetchLatestEarthImageUrl() caches its computed URL as soon as the EPIC API answers,
      // before the image bytes are ever fetched (see its own cache.set() call). hydrate() must
      // not trust that alone, for the same reason sun's hydrate() must not: nothing has proven
      // this URL actually loads.
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([{ identifier: "20260810234950" }]),
        })
      );
      await fetchLatestEarthImageUrl(undefined, cache);
      expect(new DscovrEarthResolver(cache).hydrate()).toBeUndefined();
    });

    it("returns the last confirmed earth image regardless of its TTL window", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([{ identifier: "20260810234950" }]),
        })
      );
      vi.stubGlobal(
        "Image",
        class {
          src = "";
          decode() {
            return Promise.resolve();
          }
        }
      );
      const debug = emptyDebugAccumulator();
      const confirmed = await new DscovrEarthResolver(cache).resolve(debug, debug);

      // Long past the 1-hour TTL — hydrate() isn't a freshness check, it only answers "do we
      // know something that actually works".
      vi.spyOn(Date, "now").mockReturnValue(Date.now() + 6 * 3600000);
      expect(new DscovrEarthResolver(cache).hydrate()).toEqual(confirmed);
    });
  });
});
