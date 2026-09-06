import { describe, expect, it } from "vitest";
import { getMoonEquatorial } from "../../src/astronomy/moon-position.js";
import { getMoonSkyAngles } from "../../src/astronomy/parallactic.js";
import {
  DATE_KEYS,
  isPlaceholder,
  MOON_EQUATORIAL,
  MOON_PASS,
  SITES,
} from "../fixtures/observer-matrix.js";

/**
 * The astronomy functions checked against published ephemerides — NASA SVS Dial-a-Moon, Meeus's
 * own worked example, and a hand-verified topocentric Moon pass. The bounds here are about
 * accuracy against an external reference; the modules' own invariants (range wrapping, orbital
 * inclination band, sign behaviour) live in `moon-position.test.ts` / `parallactic.test.ts`.
 */

describe("getMoonEquatorial vs NASA / Meeus", () => {
  // Ground truth from NASA SVS Dial-a-Moon (https://svs.gsfc.nasa.gov/api/dialamoon/<time>),
  // which reports J2000-referred coordinates. This module returns coordinates *of date*,
  // because that is what a local hour angle needs — so the two differ by ~26 years of
  // precession, about 0.4° in right ascension by 2026. The tolerance below is that offset,
  // not model error: after de-precessing, this series agrees with NASA to 0.034° in RA.
  it.each(DATE_KEYS)("within precession's reach of NASA's J2000 position on %s", (dateKey) => {
    const { utc, raDeg, decDeg } = MOON_EQUATORIAL[dateKey];
    if (isPlaceholder(raDeg) || isPlaceholder(decDeg)) {
      expect.fail(
        `no NASA J2000 RA/Dec for ${dateKey} — fetch from ` +
          `svs.gsfc.nasa.gov/api/dialamoon/${utc.slice(0, 16)}`
      );
    }
    const moon = getMoonEquatorial(new Date(utc));
    expect(Math.abs(moon.raDeg - raDeg)).toBeLessThan(0.5);
    expect(Math.abs(moon.decDeg - decDeg)).toBeLessThan(0.2);
  });

  // Regression pin: a silent coefficient typo would still pass the 0.5° check above. These
  // numbers are this series' own output at a fixed instant, recomputed once by hand.
  it("returns coordinates of date", () => {
    const moon = getMoonEquatorial(new Date("2026-08-21T12:00:00Z"));
    expect(moon.raDeg).toBeCloseTo(251.5719, 3);
    expect(moon.decDeg).toBeCloseTo(-27.5167, 3);
  });

  // Meeus, *Astronomical Algorithms*, worked example 47.a: 1992 April 12.0 TD gives
  // λ = 133.162655°. An independent published value, so it catches a coefficient typo the
  // NASA RA/Dec checks could absorb. The gap is the truncated series plus ~59 s of TD-UT for
  // 1992, which the Moon covers in about 0.009°.
  it("matches Meeus's own worked example for ecliptic longitude", () => {
    const { eclipticLonDeg } = getMoonEquatorial(new Date("1992-04-12T00:00:00Z"));
    expect(eclipticLonDeg).toBeCloseTo(133.1627, 1);
  });
});

describe("getMoonSkyAngles vs a published Moon pass", () => {
  // One Moon pass over Denton, 20–21 Aug 2026 (the shared matrix's MOON_PASS table). The
  // parallactic angle sweeps from negative at moonrise, through ~0 at transit, to positive at
  // moonset — the rotation a two-state hemisphere flip approximates with 0° or 180°.
  const denton = MOON_PASS.Denton;
  const { lat, lon } = SITES.Denton;
  const pass = denton
    ? ([
        ["moonrise", denton.moonrise],
        ["transit", denton.transit],
        ["moonset", denton.moonset],
      ] as const)
    : [];

  it.each(pass)("computes q and altitude at %s", (_label, point) => {
    if (isPlaceholder(point.parallacticDeg)) expect.fail("MOON_PASS.Denton not populated");
    const angles = getMoonSkyAngles(new Date(point.utc), lat, lon);
    expect(angles.parallacticDeg).toBeCloseTo(point.parallacticDeg, 1);
    expect(angles.altitudeDeg).toBeCloseTo(point.altitudeDeg, 1);
  });

  it("sweeps through zero at transit and reverses sign either side", () => {
    if (!denton) expect.fail("MOON_PASS.Denton not populated");
    const [rise, transit, set] = [denton.moonrise, denton.transit, denton.moonset].map(
      (p) => getMoonSkyAngles(new Date(p.utc), lat, lon).parallacticDeg
    );
    expect(rise).toBeLessThan(0);
    expect(Math.abs(transit)).toBeLessThan(1);
    expect(set).toBeGreaterThan(0);
    expect(set - rise).toBeGreaterThan(100);
  });
});
