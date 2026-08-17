import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPreviousSunSlot,
  getSunImageUrl,
  SDO_BROWSE_BASE_URL,
  SdoSunResolver,
} from "../../src/card/source-resolver-sdosun.js";
import { urlCache } from "../../src/card/url-cache.js";

describe("source-resolver-sdosun", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    urlCache.clear();
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

  describe("SdoSunResolver.hydrate", () => {
    it("returns undefined when nothing has ever been cached", () => {
      expect(new SdoSunResolver().hydrate()).toBeUndefined();
    });

    it("returns the cached sun image while its 15-min slot TTL is still fresh", () => {
      const NOW = Date.UTC(2026, 7, 15, 22, 42, 30);
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      const first = getSunImageUrl();

      vi.spyOn(Date, "now").mockReturnValue(NOW + 60000);
      expect(new SdoSunResolver().hydrate()).toEqual(first);
    });

    it("returns undefined once the sun slot's TTL has elapsed", () => {
      const NOW = Date.UTC(2026, 7, 15, 22, 42, 30);
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      getSunImageUrl();

      vi.spyOn(Date, "now").mockReturnValue(NOW + 15 * 60000 + 1);
      expect(new SdoSunResolver().hydrate()).toBeUndefined();
    });
  });
});
