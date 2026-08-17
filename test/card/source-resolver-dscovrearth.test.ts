import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DscovrEarthResolver,
  EPIC_BASE_URL,
  fetchLatestEarthImageUrl,
} from "../../src/card/source-resolver-dscovrearth.js";
import { urlCache } from "../../src/card/url-cache.js";

describe("source-resolver-dscovrearth", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    urlCache.clear();
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

  describe("DscovrEarthResolver.hydrate", () => {
    it("returns undefined when nothing has ever been cached", () => {
      expect(new DscovrEarthResolver().hydrate()).toBeUndefined();
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
      expect(new DscovrEarthResolver().hydrate()).toEqual(first);
    });
  });
});
