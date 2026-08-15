import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearImageCache,
  EPIC_BASE_URL,
  fetchLatestEarthImageUrl,
  getSunImageUrl,
  SUN_IMAGE_URL,
} from "../../src/card/image-sources.js";

describe("image-sources", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearImageCache();
  });

  describe("getSunImageUrl", () => {
    it("returns the fixed SDO HMI Continuum URL with a cache-busting param, and the current date", () => {
      vi.spyOn(Date, "now").mockReturnValue(1700000000000);
      const { url, date } = getSunImageUrl();
      expect(url).toBe(`${SUN_IMAGE_URL}?t=1700000000000`);
      expect(date.getTime()).toBe(1700000000000);
    });

    it("returns the cached result within the TTL instead of a fresh timestamp", () => {
      vi.spyOn(Date, "now").mockReturnValue(1700000000000);
      const first = getSunImageUrl();
      vi.spyOn(Date, "now").mockReturnValue(1700000000000 + 60000);
      const second = getSunImageUrl();
      expect(second).toEqual(first);
    });

    it("refetches with a new timestamp once the 1-hour TTL has elapsed", () => {
      vi.spyOn(Date, "now").mockReturnValue(1700000000000);
      const first = getSunImageUrl();
      vi.spyOn(Date, "now").mockReturnValue(1700000000000 + 3600001);
      const second = getSunImageUrl();
      expect(second).not.toEqual(first);
    });

    it("a shorter maxAgeMs expires the cache sooner", () => {
      vi.spyOn(Date, "now").mockReturnValue(1700000000000);
      const first = getSunImageUrl();
      vi.spyOn(Date, "now").mockReturnValue(1700000000000 + 60000);
      const second = getSunImageUrl(1000);
      expect(second).not.toEqual(first);
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

      expect(fetchMock).toHaveBeenCalledWith(`${EPIC_BASE_URL}/api/natural`);
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
  });
});
