import { describe, expect, it } from "vitest";
import { getMoonEquatorial, greenwichSiderealDeg } from "../../src/astronomy/moon-position.js";

// Accuracy against NASA / Meeus lives in `accuracy-ephemeris.test.ts`. This file holds the
// module's own invariants: range wrapping and the physical bounds the series can never exceed.

describe("getMoonEquatorial", () => {
  it("keeps ecliptic longitude in [0, 360)", () => {
    for (let h = 0; h < 720; h++) {
      const { eclipticLonDeg } = getMoonEquatorial(new Date(Date.UTC(2026, 0, 1) + h * 3600000));
      expect(eclipticLonDeg).toBeGreaterThanOrEqual(0);
      expect(eclipticLonDeg).toBeLessThan(360);
    }
  });

  it("keeps right ascension in [0, 360)", () => {
    for (let h = 0; h < 720; h++) {
      const { raDeg } = getMoonEquatorial(new Date(Date.UTC(2026, 0, 1) + h * 3600000));
      expect(raDeg).toBeGreaterThanOrEqual(0);
      expect(raDeg).toBeLessThan(360);
    }
  });

  it("never leaves the ±6° band the lunar orbit is inclined into", () => {
    let max = 0;
    for (let h = 0; h < 24 * 40; h++) {
      const { decDeg } = getMoonEquatorial(new Date(Date.UTC(2026, 0, 1) + h * 3600000));
      max = Math.max(max, Math.abs(decDeg));
    }
    // 23.44° obliquity + 5.15° orbital inclination — the Moon cannot exceed their sum.
    expect(max).toBeLessThan(23.44 + 5.15);
  });
});

describe("greenwichSiderealDeg", () => {
  it("matches the standard value at J2000.0", () => {
    // 2000-01-01T12:00Z: GMST = 280.46061837° by definition of the series' constant term.
    expect(greenwichSiderealDeg(new Date("2000-01-01T12:00:00Z"))).toBeCloseTo(280.4606, 3);
  });

  it("advances one sidereal day (360.9856°) per solar day", () => {
    const a = greenwichSiderealDeg(new Date("2026-08-21T00:00:00Z"));
    const b = greenwichSiderealDeg(new Date("2026-08-22T00:00:00Z"));
    expect(((b - a + 360) % 360) - 0.9856).toBeCloseTo(0, 3);
  });

  it("keeps the angle in [0, 360)", () => {
    for (let h = 0; h < 100; h++) {
      const g = greenwichSiderealDeg(new Date(Date.UTC(2026, 0, 1) + h * 3600000));
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThan(360);
    }
  });
});
