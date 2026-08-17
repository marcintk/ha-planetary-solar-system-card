import { afterEach, describe, expect, it, vi } from "vitest";
import { imageCache } from "../../src/card/image-cache.js";
import {
  EPIC_BASE_URL,
  fetchLatestEarthImageUrl,
  getCachedImage,
  getPreviousSunSlot,
  getSunImageUrl,
  SDO_BROWSE_BASE_URL,
} from "../../src/card/image-sources.js";

describe("image-sources", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    imageCache.clear();
  });

  describe("getSunImageUrl", () => {
    // now = 2026-08-15T22:42:30Z; minus the 15-min publish buffer = 22:27:30;
    // floored to the last 15-min slot = 22:15:00.
    const NOW = Date.UTC(2026, 7, 15, 22, 42, 30);

    it("computes the SDO browse-archive URL for the last published 15-min slot, buffered for publish latency", () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      const { url, date } = getSunImageUrl();
      expect(url).toBe(`${SDO_BROWSE_BASE_URL}/2026/08/15/20260815_221500_1024_HMIIC.jpg`);
      expect(date.toISOString()).toBe("2026-08-15T22:15:00.000Z");
    });

    it("returns the cached result within the TTL instead of a fresh slot", () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      const first = getSunImageUrl();
      vi.spyOn(Date, "now").mockReturnValue(NOW + 60000);
      const second = getSunImageUrl();
      expect(second).toEqual(first);
    });

    it("recomputes with a fresh slot once the 15-min default TTL has elapsed", () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      const first = getSunImageUrl();
      vi.spyOn(Date, "now").mockReturnValue(NOW + 15 * 60000 + 1);
      const second = getSunImageUrl();
      expect(second).not.toEqual(first);
    });

    it("a shorter maxAgeMs expires the cache sooner", () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      const first = getSunImageUrl();
      // 16 min later, guaranteed to cross into the next published 15-min slot.
      vi.spyOn(Date, "now").mockReturnValue(NOW + 16 * 60000);
      const second = getSunImageUrl(1000);
      expect(second).not.toEqual(first);
    });
  });

  describe("getPreviousSunSlot", () => {
    // Regression for the "reverts to the bad slot and gives up" bug: a computed slot can
    // fail to load if NASA hasn't published it yet, and the card retries via
    // getPreviousSunSlot — but that retry has to update the *shared* cache, or the next
    // background refresh (getSunImageUrl(), on whatever cadence refresh_mins is set to —
    // not 15 minutes) hands the same not-yet-published slot straight back out.
    it("writes the corrected slot into the cache so a later getSunImageUrl() call reuses it", () => {
      const NOW = Date.UTC(2026, 7, 15, 22, 42, 30);
      vi.spyOn(Date, "now").mockReturnValue(NOW);

      const original = getSunImageUrl(); // 22:15:00 (buffered slot)
      const corrected = getPreviousSunSlot(original.date); // steps back to 22:00:00

      // Moments later — well within the 15-min cache TTL — a background refresh
      // (_refreshOpenImage) must see the corrected slot, not the original bad one.
      vi.spyOn(Date, "now").mockReturnValue(NOW + 60000);
      const refreshed = getSunImageUrl();

      expect(refreshed).toEqual(corrected);
      expect(refreshed).not.toEqual(original);
    });
  });

  describe("fetchLatestEarthImageUrl", () => {
    it("builds the archive URL and UTC capture date from the last (most recent) entry", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([{ identifier: "20260810005516" }, { identifier: "20260810234950" }]),
      });
      vi.stubGlobal("fetch", fetchMock);

      const { url, date } = await fetchLatestEarthImageUrl();

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

      const first = await fetchLatestEarthImageUrl();
      const second = await fetchLatestEarthImageUrl();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(second).toEqual(first);
    });

    it("a shorter maxAgeMs expires the cache sooner and calls fetch again", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ identifier: "20260810234950" }]),
      });
      vi.stubGlobal("fetch", fetchMock);

      await fetchLatestEarthImageUrl();
      await fetchLatestEarthImageUrl(0);

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("throws when the response is empty", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })
      );
      await expect(fetchLatestEarthImageUrl()).rejects.toThrow();
    });

    it("throws when the request fails", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
      await expect(fetchLatestEarthImageUrl()).rejects.toThrow();
    });

    it("throws when the response is rate-limited (429), same as any other non-OK status", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));
      await expect(fetchLatestEarthImageUrl()).rejects.toThrow("429");
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

      await expect(fetchLatestEarthImageUrl()).rejects.toThrow("timeout");
    });
  });

  describe("getCachedImage", () => {
    it("returns null when nothing has ever been cached for the source", () => {
      expect(getCachedImage("sun")).toBeNull();
    });

    it("returns the cached sun image while its 15-min slot TTL is still fresh", () => {
      const NOW = Date.UTC(2026, 7, 15, 22, 42, 30);
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      const first = getSunImageUrl();

      vi.spyOn(Date, "now").mockReturnValue(NOW + 60000);
      expect(getCachedImage("sun")).toEqual(first);
    });

    it("returns null once the sun slot's TTL has elapsed", () => {
      const NOW = Date.UTC(2026, 7, 15, 22, 42, 30);
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      getSunImageUrl();

      vi.spyOn(Date, "now").mockReturnValue(NOW + 15 * 60000 + 1);
      expect(getCachedImage("sun")).toBeNull();
    });

    it("returns the cached earth image while its 1-hour TTL is still fresh", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([{ identifier: "20260810234950" }]),
        })
      );
      const first = await fetchLatestEarthImageUrl();
      expect(getCachedImage("earth")).toEqual(first);
    });
  });
});
