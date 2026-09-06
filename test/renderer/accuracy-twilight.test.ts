import { describe, expect, it } from "vitest";
import { calculatePlanetPosition } from "../../src/astronomy/orbital-mechanics.js";
import { PLANETS } from "../../src/astronomy/planet-data.js";
import { computeSolarElevationDeg } from "../../src/astronomy/solar-position.js";
import {
  calculateObserverAngle,
  calculateSolarElevationDeg,
  renderDayNightSplit,
} from "../../src/renderer/observer.js";
import { SVG_NS } from "../../src/renderer/svg-utils.js";
import { DATES, MATRIX, SITES, TWILIGHT_THRESHOLDS } from "../fixtures/observer-matrix.js";
import { findThresholdCrossings } from "../helpers/sky.js";

/**
 * Twilight / day-night geometry across the shared site × date matrix.
 *
 * Rise/set is pinned hard against the USNO almanac in `accuracy-horizon.test.ts`; this suite
 * owns the *shape* of the day: elevation sweep, peak at local solar noon, the −6/−12/−18°
 * twilight bands in order, day-length by season, and the twilight-cone geometry the renderer
 * builds from the solar elevation.
 *
 * Where a site/date has no crossing of a boundary (polar day or night at Trondheim / Ushuaia
 * near a solstice) the check returns early, mirroring the guard already used in
 * `observer.test.ts`.
 */

const elevation = (lat: number, lon: number, date: Date) =>
  computeSolarElevationDeg(lat, lon, date);

/** Local solar noon, in UTC hours, from longitude alone (good to the equation of time). */
const solarNoonUtcHours = (lon: number) => 12 - lon / 15;

describe("solar elevation shape through a full day", () => {
  it.each(MATRIX)("sweeps and peaks near local solar noon at $site on $date", ({ site, date }) => {
    const { lat, lon } = SITES[site];
    const day = new Date(`${DATES[date]}T00:00:00Z`);

    let minElev = 90;
    let maxElev = -90;
    let peakElev = -90;
    let peakMinute = 0;
    for (let m = 0; m <= 24 * 60; m++) {
      const elev = computeSolarElevationDeg(lat, lon, new Date(day.getTime() + m * 60000));
      minElev = Math.min(minElev, elev);
      maxElev = Math.max(maxElev, elev);
      if (elev > peakElev) {
        peakElev = elev;
        peakMinute = m;
      }
    }

    // Always a real diurnal swing, and always inside the valid range.
    expect(maxElev).toBeLessThanOrEqual(90);
    expect(minElev).toBeGreaterThanOrEqual(-90);
    expect(maxElev - minElev).toBeGreaterThan(10);

    // The peak sits at local solar noon regardless of latitude or season — within an hour, to
    // absorb the equation of time and the 1-minute scan step.
    const peakHourUtc = ((peakMinute / 60) % 24) + 24;
    const noonUtc = (solarNoonUtcHours(lon) % 24) + 24;
    expect(Math.abs(peakHourUtc - noonUtc)).toBeLessThan(1);
  });
});

describe("twilight boundary crossings — 0° to −18°", () => {
  for (const threshold of TWILIGHT_THRESHOLDS) {
    const label =
      threshold === 0
        ? "Sunrise/Sunset (0°)"
        : threshold === -6
          ? "Civil twilight (−6°)"
          : threshold === -12
            ? "Nautical twilight (−12°)"
            : "Astronomical twilight (−18°)";

    it.each(MATRIX)(
      `${label}: dawn precedes noon precedes dusk at $site on $date`,
      ({ site, date }) => {
        const { lat, lon } = SITES[site];
        const { dawn, dusk } = findThresholdCrossings(lat, lon, DATES[date], threshold, elevation);
        if (!dawn || !dusk) return; // polar day/night, or the Sun never reaches this depth

        expect(dawn.getTime()).toBeLessThan(dusk.getTime());
        const solarNoonMs = new Date(
          new Date(`${DATES[date]}T00:00:00Z`).getTime() + solarNoonUtcHours(lon) * 3600000
        ).getTime();
        expect(dawn.getTime()).toBeLessThan(solarNoonMs);
        expect(dusk.getTime()).toBeGreaterThan(solarNoonMs);
      }
    );
  }
});

describe("twilight boundaries are ordered by depth", () => {
  it.each(MATRIX)(
    "astronomical → nautical → civil → sunrise, and mirrored at dusk at $site on $date",
    ({ site, date }) => {
      const { lat, lon } = SITES[site];
      const crossings = TWILIGHT_THRESHOLDS.map((t) =>
        findThresholdCrossings(lat, lon, DATES[date], t, elevation)
      );
      if (crossings.some((c) => !c.dawn || !c.dusk)) return; // some band has no crossing here

      // TWILIGHT_THRESHOLDS is [0, -6, -12, -18] — index 3 is the deepest.
      const dawn = crossings.map((c) => (c.dawn as Date).getTime());
      expect(dawn[3]).toBeLessThan(dawn[2]);
      expect(dawn[2]).toBeLessThan(dawn[1]);
      expect(dawn[1]).toBeLessThan(dawn[0]);

      const dusk = crossings.map((c) => (c.dusk as Date).getTime());
      expect(dusk[0]).toBeLessThan(dusk[1]);
      expect(dusk[1]).toBeLessThan(dusk[2]);
      expect(dusk[2]).toBeLessThan(dusk[3]);
    }
  );
});

describe("day length tracks the season", () => {
  const dayLength = (site: keyof typeof SITES, date: keyof typeof DATES) => {
    const { lat, lon } = SITES[site];
    const { dawn, dusk } = findThresholdCrossings(lat, lon, DATES[date], 0, elevation);
    return dawn && dusk ? dusk.getTime() - dawn.getTime() : null;
  };

  it.each(Object.keys(SITES) as (keyof typeof SITES)[])(
    "%s: the hemisphere's summer solstice is its longest day, winter its shortest",
    (site) => {
      const equinox = dayLength(site, "equinox");
      const june = dayLength(site, "juneSolstice");
      const december = dayLength(site, "decSolstice");
      if (equinox === null || june === null || december === null) return; // polar solstice

      const northern = SITES[site].lat >= 0;
      const summer = northern ? june : december;
      const winter = northern ? december : june;
      expect(summer).toBeGreaterThan(equinox);
      expect(winter).toBeLessThan(equinox);
    }
  );
});

describe("twilight-cone half-angle formula", () => {
  // halfAngle = elevationDeg >= 0 || elevationDeg < -18 ? 90 : 90 - elevationDeg
  // At exactly -18° the branch is astronomical twilight (not night), so halfAngle = 108°.
  const computeHalfAngle = (elevationDeg: number) =>
    elevationDeg >= 0 || elevationDeg < -18 ? 90 : 90 - elevationDeg;

  it("is 90° above the horizon (day) and below −18° (night)", () => {
    expect(computeHalfAngle(10)).toBe(90);
    expect(computeHalfAngle(0)).toBe(90);
    expect(computeHalfAngle(-19)).toBe(90);
    expect(computeHalfAngle(-30)).toBe(90);
  });

  it("opens from 90° to 108° across the twilight bands", () => {
    for (let deg = -1; deg >= -18; deg--) {
      expect(computeHalfAngle(deg)).toBe(90 - deg);
    }
    expect(computeHalfAngle(-6)).toBe(96);
    expect(computeHalfAngle(-12)).toBe(102);
    expect(computeHalfAngle(-18)).toBe(108);
  });
});

describe("twilight cone relative to the Earth–Sun line", () => {
  // calculateObserverAngle uses civil timezone, not true solar time; longitude is passed to
  // close most of that gap. These checks track the residual across the whole matrix.
  const earth = PLANETS.find((p) => p.name === "Earth");

  it.each(MATRIX)(
    "at solar noon the observer angle points at the Sun at $site on $date",
    ({ site, date }) => {
      const { lon, timezone } = SITES[site];
      const noon = new Date(
        new Date(`${DATES[date]}T00:00:00Z`).getTime() + solarNoonUtcHours(lon) * 3600000
      );
      const earthAngle = calculatePlanetPosition(earth, noon);
      const obsAngle = calculateObserverAngle(earthAngle, noon, timezone, lon);
      const sunDir = earthAngle + Math.PI;
      const diffDeg =
        Math.abs(Math.atan2(Math.sin(obsAngle - sunDir), Math.cos(obsAngle - sunDir))) *
        (180 / Math.PI);
      expect(diffDeg).toBeLessThan(1);
    }
  );

  it.each(MATRIX)(
    "during civil twilight the cone reaches past the Sun at $site on $date",
    ({ site, date }) => {
      const { lat, lon } = SITES[site];
      const day = new Date(`${DATES[date]}T00:00:00Z`);
      let twilightTime: Date | null = null;
      for (let m = 0; m <= 24 * 60; m++) {
        const t = new Date(day.getTime() + m * 60000);
        const elev = computeSolarElevationDeg(lat, lon, t);
        if (elev >= -4 && elev <= -2) {
          twilightTime = t;
          break;
        }
      }
      if (!twilightTime) return; // never in the −2°…−4° slice at this site/date

      const halfAngle = 90 - computeSolarElevationDeg(lat, lon, twilightTime);
      expect(halfAngle).toBeGreaterThan(90);
      expect(halfAngle).toBeLessThan(96);
    }
  );
});

describe("spherical vs orbital solar elevation", () => {
  const earth = PLANETS.find((p) => p.name === "Earth");

  it.each(MATRIX)(
    "agree on day/night sign at solar noon and midnight at $site on $date",
    ({ site, date }) => {
      const { lat, lon, timezone } = SITES[site];
      const base = new Date(`${DATES[date]}T00:00:00Z`).getTime();
      for (const [offsetH, wantDay] of [
        [solarNoonUtcHours(lon), true],
        [solarNoonUtcHours(lon) + 12, false],
      ] as const) {
        const when = new Date(base + offsetH * 3600000);
        const spherical = computeSolarElevationDeg(lat, lon, when);
        const earthAngle = calculatePlanetPosition(earth, when);
        const obsAngle = calculateObserverAngle(earthAngle, when, timezone, lon);
        const orbital = calculateSolarElevationDeg(obsAngle, earthAngle);
        // Near the equator "noon" can still be within a few degrees of 0 at a solstice, so only
        // assert the sign when the Sun is clearly up or down.
        if (Math.abs(spherical) > 5) {
          expect(Math.sign(spherical) === (wantDay ? 1 : -1)).toBe(true);
          expect(Math.sign(orbital) === (wantDay ? 1 : -1)).toBe(true);
        }
      }
    }
  );

  it.each(Object.keys(SITES) as (keyof typeof SITES)[])(
    "%s: spherical noon elevation on the equinox is ~90 − |lat|, orbital ignores latitude",
    (site) => {
      const { lat, lon, timezone } = SITES[site];
      const noon = new Date(
        new Date(`${DATES.equinox}T00:00:00Z`).getTime() + solarNoonUtcHours(lon) * 3600000
      );
      const spherical = computeSolarElevationDeg(lat, lon, noon);
      expect(Math.abs(spherical - (90 - Math.abs(lat)))).toBeLessThan(2);

      const earthAngle = calculatePlanetPosition(earth, noon);
      const obsAngle = calculateObserverAngle(earthAngle, noon, timezone, lon);
      const orbital = calculateSolarElevationDeg(obsAngle, earthAngle);
      expect(orbital).toBeGreaterThan(85);
      // The gap between the two is essentially the observer's latitude.
      expect(Math.abs(Math.abs(orbital - spherical) - Math.abs(lat))).toBeLessThan(5);
    }
  );
});

describe("the rendered twilight cone edge points at the Sun at each boundary crossing", () => {
  // The cone half-angle (90 − elevationDeg) is built from the true 3D zenith angle, while the
  // cone axis (displayObserverAngle) is the ecliptic-plane *projection* of that same angle.
  // The two coincide near the horizon, so at the instant the Sun crosses a twilight boundary
  // the near-Sun edge of the drawn cone must land on the Sun's true direction. (Away from the
  // horizon they diverge — the noon case is characterised in accuracy-horizon.test.ts.)
  //
  // Moved here from observer.test.ts: it renders the scene and checks a physical angle across
  // the whole matrix, so it belongs with the other accuracy suites, not the observer units.
  const earth = PLANETS.find((p) => p.name === "Earth");

  const angleDiff = (a: number, b: number) => {
    const n = (x: number) => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const d = Math.abs(n(a) - n(b));
    return Math.min(d, 2 * Math.PI - d);
  };

  // Clip-path format: "M ax ay L lx ly A D D 0 flag 1 rx ry Z" — indices 0,1 anchor; 2,3 left
  // edge; 9,10 right edge. SVG y is inverted (eclipticViewDirection = -1), flip it back.
  const coneEdgeAngles = (svg: SVGElement) => {
    const c = svg
      .querySelector("clipPath path")
      .getAttribute("d")
      .match(/-?[\d.]+/g)
      .map(Number);
    return {
      left: Math.atan2(-(c[3] - c[1]), c[2] - c[0]),
      right: Math.atan2(-(c[10] - c[1]), c[9] - c[0]),
    };
  };

  it.each(MATRIX)("cone edge is within 1° of the Sun at $site on $date", ({ site, date }) => {
    const { lat, lon } = SITES[site];
    for (const target of [-6, -12, -18] as const) {
      const { dusk } = findThresholdCrossings(lat, lon, DATES[date], target, elevation);
      if (!dusk) continue; // polar day/night, or the Sun never reaches this depth

      // Sample the minute *inside* the band (elevationDeg > target): that is where the cone's
      // half-angle is 90 − elevationDeg and its near-Sun edge is the boundary line. One minute
      // past the crossing the band flips (e.g. below −18° the cone snaps to a flat 90° night
      // half-plane) and the "edge" is no longer the twilight line.
      const inBand = new Date(dusk.getTime() - 60_000);
      const sunDir = calculatePlanetPosition(earth, inBand) + Math.PI;
      const svg = document.createElementNS(SVG_NS, "svg");
      renderDayNightSplit(svg, 200, inBand, { lat, lon });

      const { left, right } = coneEdgeAngles(svg);
      const diffDeg = (Math.min(angleDiff(left, sunDir), angleDiff(right, sunDir)) * 180) / Math.PI;
      expect(diffDeg, `${target}° @ ${inBand.toISOString()}`).toBeLessThan(1);
    }
  });
});
