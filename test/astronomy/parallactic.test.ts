import { describe, expect, it } from "vitest";
import { getMoonSkyAngles } from "../../src/astronomy/parallactic.js";

const DENTON = { lat: 33.2148, lon: -97.1331 };
const SYDNEY = { lat: -33.87, lon: 151.21 };

describe("getMoonSkyAngles", () => {
  // One moon pass over Denton, 20–21 Aug 2026. The parallactic angle sweeps from negative at
  // moonrise, through ~0 at transit, to positive at moonset — the rotation that today's
  // two-state hemisphere flip approximates with 0° or 180°.
  const PASS: [string, string, number, number][] = [
    // label, utc, q, altitude
    ["moonrise", "2026-08-20T20:00:00Z", -52.17, 0.19],
    ["transit", "2026-08-21T00:50:00Z", -0.665, 29.98],
    ["moonset", "2026-08-21T05:45:00Z", 52.087, -0.13],
  ];

  it.each(PASS)("computes q and altitude at %s", (_label, utc, q, alt) => {
    const angles = getMoonSkyAngles(new Date(utc), DENTON.lat, DENTON.lon);
    expect(angles.parallacticDeg).toBeCloseTo(q, 1);
    expect(angles.altitudeDeg).toBeCloseTo(alt, 1);
  });

  it("sweeps through zero at transit and reverses sign either side", () => {
    const [rise, transit, set] = PASS.map(
      ([, utc]) => getMoonSkyAngles(new Date(utc), DENTON.lat, DENTON.lon).parallacticDeg
    );
    expect(rise).toBeLessThan(0);
    expect(Math.abs(transit)).toBeLessThan(1);
    expect(set).toBeGreaterThan(0);
    expect(set - rise).toBeGreaterThan(100);
  });

  // The whole reason the hemisphere flip can be deleted: a southern observer's q lands far
  // from a northern one's at the same instant, with no latitude branch anywhere.
  it("inverts for a southern observer without a hemisphere branch", () => {
    const utc = new Date("2026-08-21T06:00:00Z");
    const north = getMoonSkyAngles(utc, DENTON.lat, DENTON.lon);
    const south = getMoonSkyAngles(utc, SYDNEY.lat, SYDNEY.lon);
    expect(south.parallacticDeg).toBeCloseTo(-111.1, 0);
    expect(south.altitudeDeg).toBeCloseTo(57.2, 0);
    // Opposed by more than a right angle — nothing a 0°/180° flip could stand in for.
    const gap = Math.abs(((south.parallacticDeg - north.parallacticDeg + 540) % 360) - 180);
    expect(gap).toBeGreaterThan(90);
  });

  it("reports the Moon below the horizon when it is", () => {
    // Denton local noon — the Moon is on the far side of the planet.
    const { altitudeDeg } = getMoonSkyAngles(
      new Date("2026-08-21T17:00:00Z"),
      DENTON.lat,
      DENTON.lon
    );
    expect(altitudeDeg).toBeLessThan(0);
  });

  it("keeps q in (-180, 180] and altitude in [-90, 90]", () => {
    for (let h = 0; h < 24 * 40; h++) {
      const { parallacticDeg, altitudeDeg } = getMoonSkyAngles(
        new Date(Date.UTC(2026, 0, 1) + h * 3600000),
        DENTON.lat,
        DENTON.lon
      );
      expect(parallacticDeg).toBeGreaterThan(-180.0001);
      expect(parallacticDeg).toBeLessThanOrEqual(180);
      expect(Math.abs(altitudeDeg)).toBeLessThanOrEqual(90);
    }
  });
});
