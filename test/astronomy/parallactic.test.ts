import { describe, expect, it } from "vitest";
import { getMoonSkyAngles } from "../../src/astronomy/parallactic.js";
import { SITES } from "../fixtures/observer-matrix.js";

// Accuracy against a published Moon pass lives in `accuracy-ephemeris.test.ts`. This file holds
// the module's design guarantees: no hemisphere branch, and output stays in range everywhere.

const DENTON = SITES.Denton;

describe("getMoonSkyAngles", () => {
  // Pinned regression scenario (deliberately off the shared matrix): a southern observer's q
  // lands far from a northern one's at the same instant, with no latitude branch anywhere —
  // the whole reason the hemisphere flip can be deleted. Sydney keeps its hand-computed values.
  it("inverts for a southern observer without a hemisphere branch", () => {
    const SYDNEY = { lat: -33.87, lon: 151.21 };
    const utc = new Date("2026-08-21T06:00:00Z");
    const north = getMoonSkyAngles(utc, DENTON.lat, DENTON.lon);
    const south = getMoonSkyAngles(utc, SYDNEY.lat, SYDNEY.lon);
    expect(south.parallacticDeg).toBeCloseTo(-111.1, 0);
    expect(south.altitudeDeg).toBeCloseTo(57.2, 0);
    const gap = Math.abs(((south.parallacticDeg - north.parallacticDeg + 540) % 360) - 180);
    expect(gap).toBeGreaterThan(90);
  });

  it.each(Object.keys(SITES) as (keyof typeof SITES)[])(
    "%s: keeps q in (-180, 180] and altitude in [-90, 90] over a 40-day walk",
    (site) => {
      const { lat, lon } = SITES[site];
      let sawAbove = false;
      let sawBelow = false;
      for (let h = 0; h < 24 * 40; h++) {
        const { parallacticDeg, altitudeDeg } = getMoonSkyAngles(
          new Date(Date.UTC(2026, 0, 1) + h * 3600000),
          lat,
          lon
        );
        expect(parallacticDeg).toBeGreaterThan(-180.0001);
        expect(parallacticDeg).toBeLessThanOrEqual(180);
        expect(Math.abs(altitudeDeg)).toBeLessThanOrEqual(90);
        sawAbove ||= altitudeDeg > 0;
        sawBelow ||= altitudeDeg < 0;
      }
      // Every site on Earth sees the Moon rise and set within 40 days.
      expect(sawAbove && sawBelow).toBe(true);
    }
  );
});
