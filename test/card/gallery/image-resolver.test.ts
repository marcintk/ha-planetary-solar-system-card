import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImageResolver } from "../../../src/card/gallery/image-resolver.js";
import { IMAGE_SOURCES } from "../../../src/card/gallery/sources.js";
import { urlCache } from "../../../src/card/gallery/url-cache.js";

function stubImagePreload() {
  vi.stubGlobal(
    "Image",
    class {
      src = "";
      decode() {
        return Promise.resolve();
      }
    }
  );
}

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ identifier: "20260810234950", image: "epic_1b" }]),
    })
  );
}

describe("ImageResolver", () => {
  beforeEach(() => {
    urlCache.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-11T00:00:00Z"));
    stubImagePreload();
    stubFetch();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    urlCache.clear();
  });

  it("debugStats starts at zero for every row", () => {
    const stats = new ImageResolver().debugStats();

    for (const row of Object.values(stats)) {
      expect(row.fetches).toBe(0);
    }
  });

  it("hydrate returns nothing when no source is cached", () => {
    expect(new ImageResolver().hydrate(IMAGE_SOURCES)).toEqual({});
  });

  it("resolveAll resolves each source and hydrate then returns them", async () => {
    const resolver = new ImageResolver();

    const results = await resolver.resolveAll(["sun", "moon"]);

    expect(results.map((r) => [r.source, r.result.status])).toEqual([
      ["sun", "fulfilled"],
      ["moon", "fulfilled"],
    ]);
    const hydrated = resolver.hydrate(IMAGE_SOURCES);
    expect(Object.keys(hydrated).sort()).toEqual(["moon", "mymoon", "sun"]);
    expect(resolver.debugStats().sun.fetches).toBe(1);
  });

  it("resolveAll skips a source still in flight", async () => {
    const resolver = new ImageResolver();

    const first = resolver.resolveAll(["sun"]);
    const second = await resolver.resolveAll(["sun"]);
    await first;

    expect(second).toEqual([]);
    expect(resolver.debugStats().sun.fetches).toBe(1);
  });

  it("resolveAll can resolve a source again once the earlier call settled", async () => {
    const resolver = new ImageResolver();

    await resolver.resolveAll(["sun"]);
    const again = await resolver.resolveAll(["sun"]);

    expect(again).toHaveLength(1);
  });

  describe("failure and availability delegation", () => {
    it("failureCount starts at zero and recordFailure raises it for sun", () => {
      const resolver = new ImageResolver();
      expect(resolver.failureCount("sun")).toBe(0);

      resolver.recordFailure("sun");

      expect(resolver.failureCount("sun")).toBe(1);
      expect(resolver.failureCount("earth")).toBe(0);
    });

    it("a real failed fetch raises failureCount", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
      vi.stubGlobal(
        "Image",
        class {
          src = "";
          decode() {
            return Promise.reject(new Error("decode failed"));
          }
        }
      );
      const resolver = new ImageResolver();

      const [outcome] = await resolver.resolveAll(["sun"]);

      expect(outcome.result.status).toBe("rejected");
      expect(resolver.failureCount("sun")).toBeGreaterThan(0);
    });

    it("mymoon and moon share one failure count", () => {
      const resolver = new ImageResolver();

      resolver.recordFailure("mymoon");
      expect(resolver.failureCount("moon")).toBe(1);
      expect(resolver.failureCount("mymoon")).toBe(1);

      resolver.recordFailure("moon");
      expect(resolver.failureCount("mymoon")).toBe(2);
    });

    it("nothing is permanently unavailable initially", () => {
      const resolver = new ImageResolver();

      for (const source of IMAGE_SOURCES) {
        expect(resolver.isPermanentlyUnavailable(source)).toBe(false);
      }
    });

    it("an unpublished moon year marks the resolved moon permanently unavailable", async () => {
      vi.setSystemTime(new Date("2035-06-01T00:00:00Z"));
      const resolver = new ImageResolver();

      const [outcome] = await resolver.resolveAll(["moon"]);

      expect(outcome.result.status).toBe("rejected");
      expect(resolver.isPermanentlyUnavailable("moon")).toBe(true);
      expect(resolver.isPermanentlyUnavailable("mymoon")).toBe(false);
      expect(resolver.isPermanentlyUnavailable("sun")).toBe(false);
      expect(resolver.failureCount("moon")).toBe(0);
    });

    it.each(["moon", "mymoon"] as const)(
      "%s names itself in the cooldown error when nothing stale is cached",
      async (source) => {
        const resolver = new ImageResolver();
        for (let i = 0; i < 10; i++) resolver.recordFailure(source);

        const [outcome] = await resolver.resolveAll([source]);

        expect(outcome.result.status).toBe("rejected");
        expect((outcome.result as PromiseRejectedResult).reason.message).toBe(
          `${source} is in cooldown after repeated failures`
        );
      }
    );

    it("mymoon resolving an unpublished year is flagged on its own instance", async () => {
      vi.setSystemTime(new Date("2035-06-01T00:00:00Z"));
      const resolver = new ImageResolver();

      await resolver.resolveAll(["mymoon"]);

      expect(resolver.isPermanentlyUnavailable("mymoon")).toBe(true);
      expect(resolver.isPermanentlyUnavailable("sun")).toBe(false);
    });
  });
});
