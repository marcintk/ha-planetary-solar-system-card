import { describe, expect, it } from "vitest";
import { getMoonEquatorial, greenwichSiderealDeg } from "../../src/astronomy/moon-position.js";

describe("getMoonEquatorial", () => {
  // Ground truth from NASA SVS Dial-a-Moon (https://svs.gsfc.nasa.gov/api/dialamoon/<time>),
  // which reports J2000-referred coordinates. This module returns coordinates *of date*,
  // because that is what a local hour angle needs — so the two differ by ~26 years of
  // precession, about 0.4° in right ascension by 2026. The tolerance below is that offset,
  // not model error: after de-precessing, this series agrees with NASA to 0.034° in RA.
  const NASA: [string, number, number][] = [
    // utc, j2000_ra (degrees, = j2000_ra hours × 15), j2000_dec
    ["2026-08-21T12:00:00Z", 251.187, -27.4818],
    ["2026-01-05T03:00:00Z", 130.761, 21.0071],
    ["2026-12-30T18:00:00Z", 185.9985, -6.7218],
  ];

  it.each(NASA)(
    "puts the Moon within precession's reach of NASA's J2000 position at %s",
    (utc, ra, dec) => {
      const moon = getMoonEquatorial(new Date(utc));
      expect(Math.abs(moon.raDeg - ra)).toBeLessThan(0.5);
      expect(Math.abs(moon.decDeg - dec)).toBeLessThan(0.2);
    }
  );

  // Regression pins: recomputing these by hand is expensive, and a silent coefficient typo
  // would otherwise still pass the 0.5° check above.
  it("returns coordinates of date", () => {
    const moon = getMoonEquatorial(new Date("2026-08-21T12:00:00Z"));
    expect(moon.raDeg).toBeCloseTo(251.5719, 3);
    expect(moon.decDeg).toBeCloseTo(-27.5167, 3);
  });

  // Meeus, *Astronomical Algorithms*, worked example 47.a: 1992 April 12.0 TD gives
  // λ = 133.162655°. An independent published value, so it catches a coefficient typo the
  // NASA RA/Dec checks above could absorb. The gap is the truncated series plus ~59 s of
  // TD-UT for 1992, which the Moon covers in about 0.009°.
  it("matches Meeus's own worked example for ecliptic longitude", () => {
    const { eclipticLonDeg } = getMoonEquatorial(new Date("1992-04-12T00:00:00Z"));
    expect(eclipticLonDeg).toBeCloseTo(133.1627, 1);
  });

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
