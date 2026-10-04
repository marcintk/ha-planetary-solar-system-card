import { describe, expect, it, vi } from "vitest";
import { createVisiblePlanetsCache } from "../../src/card/visible-planets-cache.js";

describe("createVisiblePlanetsCache", () => {
  it("memoises until validUntil, and recomputes on rollover, earlier date, or location change", () => {
    const compute = vi.fn(() => ({
      planets: ["Jupiter"],
      validUntil: new Date("2026-10-04T04:00:00Z"),
    }));
    const get = createVisiblePlanetsCache(compute);
    const lat = 52.0;
    const lon = 21.0;

    expect(get(lat, lon, new Date("2026-10-03T20:00:00Z"))).toEqual(["Jupiter"]);
    expect(compute).toHaveBeenCalledTimes(1);

    get(lat, lon, new Date("2026-10-03T21:30:00Z"));
    expect(compute).toHaveBeenCalledTimes(1);

    get(lat, lon, new Date("2026-10-04T04:00:00Z"));
    expect(compute).toHaveBeenCalledTimes(1);

    get(lat, lon, new Date("2026-10-04T04:01:00Z"));
    expect(compute).toHaveBeenCalledTimes(2);

    // Earlier than the date the cache entry was computed for -> recompute.
    get(lat, lon, new Date("2026-10-03T22:00:00Z"));
    expect(compute).toHaveBeenCalledTimes(3);

    // Same 0.1 degree rounding -> reuse.
    get(lat + 0.02, lon, new Date("2026-10-03T23:00:00Z"));
    expect(compute).toHaveBeenCalledTimes(3);

    // Different rounded location -> recompute.
    get(lat + 0.5, lon, new Date("2026-10-03T23:00:00Z"));
    expect(compute).toHaveBeenCalledTimes(4);
  });
});
