import { describe, expect, it } from "vitest";
import { getMoonSkyAngles } from "../../src/astronomy/parallactic.js";
import { MOON } from "../../src/astronomy/planet-data.js";
import { computeSolarElevationDeg, getSkyMode } from "../../src/astronomy/solar-position.js";
import { ViewingLocation } from "../../src/card/viewing-location.js";
import { renderSolarSystem } from "../../src/renderer/index.js";
import { CENTER } from "../../src/renderer/svg-utils.js";
import type { LocationData } from "../../src/types.js";
import {
  MATRIX,
  RISE_ALTITUDE,
  riseSetDay,
  riseSetIsPlaceholder,
  SITES,
  USNO_RISESET,
} from "../fixtures/observer-matrix.js";
import {
  at,
  CROSSING_TOLERANCE_SEC,
  crossing,
  crossingToleranceSec,
  localRateDegPerMin,
  MINUTE,
  secondsOutsidePrintedMinute,
} from "../helpers/sky.js";

/**
 * The end-to-end "does the horizon the card *draws* agree with where the Sun and Moon actually
 * are" suite. Sites and dates come from the shared matrix (`test/fixtures/observer-matrix.ts`);
 * rise/set ground truth is the US Naval Observatory almanac, `almanac_data` from
 *   https://aa.usno.navy.mil/api/rstt/oneday?date=<day>&coords=<lat>,<lon>&tz=0
 * every time UTC on the UTC day named.
 */

const usnoFail = (site: string) =>
  `no USNO rise/set fixture for ${site} — fetch from ` +
  `aa.usno.navy.mil/api/rstt/oneday?coords=${SITES[site as keyof typeof SITES].lat},` +
  `${SITES[site as keyof typeof SITES].lon}&tz=0`;

/**
 * Where the two bodies sit relative to the horizon line the card actually draws.
 *
 * `renderDayNightSplit` is the only thing in the scene drawn with a "4, 4" dash (orbit rings
 * use "5, 5", season lines "4, 6") and appends exactly two, in order: the horizon line, then
 * the zenith line. The zenith line is the horizon's normal, so a positive dot product against
 * it means the body is on the sky side. The Sun needs no lookup — it is the view's centre.
 */
function drawnHorizon(date: Date, location: LocationData): { sun: boolean; moon: boolean } {
  const { svg, positions } = renderSolarSystem(date, "north", location);
  const dashed = [...svg.querySelectorAll("line")].filter(
    (line) => line.getAttribute("stroke-dasharray") === "4, 4"
  );
  expect(dashed).toHaveLength(2);

  const num = (el: Element, name: string) => Number(el.getAttribute(name));
  const [horizon, zenith] = dashed;
  const onLineX = num(horizon, "x1");
  const onLineY = num(horizon, "y1");
  const skyX = num(zenith, "x2") - num(zenith, "x1");
  const skyY = num(zenith, "y2") - num(zenith, "y1");
  const above = (x: number, y: number) => (x - onLineX) * skyX + (y - onLineY) * skyY > 0;

  const moon = positions.find((p) => p.name === MOON.name);
  return { sun: above(CENTER, CENTER), moon: above(moon.x, moon.y) };
}

function skyFrameAt(date: Date, location: LocationData) {
  const viewing = new ViewingLocation();
  viewing.configure({ lat: location.lat, lon: location.lon, timezone: location.timezone }, null);
  return viewing.skyFrame(date);
}

describe("rise and set against the USNO almanac", () => {
  // The Moon is the accurate one: the Meeus ch.47 series in moon-position.ts lands inside a
  // minute at every site and season, at a normal crossing angle. That is the number the mymoon
  // tile depends on. Trondheim and Ushuaia add crossings shallow enough that the flat bound no
  // longer applies (see GRAZING_RATE_DEG_PER_MIN in helpers/sky.ts) — crossingToleranceSec
  // covers both cases with the same assertion, capped at MAX_CROSSING_TOLERANCE_SEC either way.
  it.each(MATRIX)("puts the Moon on the printed minute at $site on $date", ({ site, date }) => {
    const rs = USNO_RISESET[site][date];
    if (riseSetIsPlaceholder(rs)) expect.fail(usnoFail(site));
    const { lat, lon } = SITES[site];
    const day = riseSetDay(site, date);
    const altitudeAt = (d: Date) => getMoonSkyAngles(d, lat, lon).altitudeDeg;

    for (const [event, direction] of [
      ["moonRise", "rise"],
      ["moonSet", "set"],
    ] as const) {
      const ours = crossing(altitudeAt, day, RISE_ALTITUDE.moon, direction);
      expect(ours, `no ${direction} found`).not.toBeNull();
      const rate = localRateDegPerMin(altitudeAt, ours as Date);
      expect(secondsOutsidePrintedMinute(ours as Date, at(day, rs[event]))).toBeLessThanOrEqual(
        crossingToleranceSec(rate)
      );
    }
  });

  // The Sun held to the same bound as the Moon. This assertion used to allow twelve minutes,
  // fitted to the circular model's own error rather than to anything — which meant it could
  // catch a regression but never the inaccuracy already sitting there. It allowed the
  // 11-minute sunset error to pass for as long as it existed.
  it.each(MATRIX)("puts the Sun on the printed minute at $site on $date", ({ site, date }) => {
    const rs = USNO_RISESET[site][date];
    if (riseSetIsPlaceholder(rs)) expect.fail(usnoFail(site));
    const { lat, lon } = SITES[site];
    const day = riseSetDay(site, date);
    const altitudeAt = (d: Date) => computeSolarElevationDeg(lat, lon, d);

    for (const [event, direction] of [
      ["sunRise", "rise"],
      ["sunSet", "set"],
    ] as const) {
      const ours = crossing(altitudeAt, day, RISE_ALTITUDE.sun, direction);
      expect(ours, `no ${direction} found`).not.toBeNull();
      expect(secondsOutsidePrintedMinute(ours as Date, at(day, rs[event]))).toBeLessThanOrEqual(
        CROSSING_TOLERANCE_SEC
      );
    }
  });
});

describe("the sky mode flips at the almanac's sunset", () => {
  // What the status bar shows as "Next: Civil Twilight", checked against the time an almanac
  // prints for sunset. These have to be the same moment: civil twilight *begins* at sunset.
  //
  // The Day edge used to sit at a flat 0deg, which ran ~5 minutes early and is not an event
  // anyone can observe — the Sun's centre reaching the geometric horizon still leaves the whole
  // disc above it. Two minutes either side of the almanac time is well outside the ~1 minute
  // the model is accurate to, and well inside the 5 minutes the old threshold was out by.
  const MARGIN = 2 * MINUTE;

  it.each(MATRIX)(
    "calls it Day before sunset and twilight after at $site on $date",
    ({ site, date }) => {
      const rs = USNO_RISESET[site][date];
      if (riseSetIsPlaceholder(rs)) expect.fail(usnoFail(site));
      const { lat, lon } = SITES[site];
      const sunset = at(riseSetDay(site, date), rs.sunSet).getTime();

      const modeAt = (t: number) => getSkyMode(computeSolarElevationDeg(lat, lon, new Date(t)));
      expect(modeAt(sunset - MARGIN), "before sunset").toBe("Day");
      expect(modeAt(sunset + MARGIN), "after sunset").toBe("Civil Twilight");
    }
  );
});

describe("the mymoon tile against the USNO almanac", () => {
  // Sampled half an hour either side of each almanac event rather than on it: the tile only
  // needs to be right about which side of the horizon the Moon is on, and its image refreshes
  // hourly anyway, so the minute it flips is not what is being pinned here. Half an hour is
  // thirty times the error the rise/set suite above measures.
  const HALF_HOUR = 30 * MINUTE;

  it.each(MATRIX)("shows the Moon around its rise and set at $site on $date", ({ site, date }) => {
    const rs = USNO_RISESET[site][date];
    if (riseSetIsPlaceholder(rs)) expect.fail(usnoFail(site));
    const location = SITES[site];
    const day = riseSetDay(site, date);
    const expectations: [string, Date, boolean][] = [
      ["before moonrise", new Date(at(day, rs.moonRise).getTime() - HALF_HOUR), false],
      ["after moonrise", new Date(at(day, rs.moonRise).getTime() + HALF_HOUR), true],
      ["before moonset", new Date(at(day, rs.moonSet).getTime() - HALF_HOUR), true],
      ["after moonset", new Date(at(day, rs.moonSet).getTime() + HALF_HOUR), false],
    ];

    for (const [label, when, inSky] of expectations) {
      expect(skyFrameAt(when, location).belowHorizon, label).toBe(!inSky);
    }
  });
});

describe("the visibility cone and the horizon line share one apex", () => {
  // They are the same boundary, so they have to be drawn from the same point. The cone used to
  // open from Earth's *surface* while the lines pivoted on its centre, which left the cone's
  // own 90° edge running parallel to the horizon line a body radius away — two lines where the
  // picture only means one. Pure geometry, so the placeholder sites run here too.
  it.each(MATRIX)(
    "puts the cone's apex on the horizon line at $site on $date",
    ({ site, date }) => {
      const location = SITES[site];
      const day = riseSetDay(site, date);
      for (let hour = 0; hour < 24; hour++) {
        const date_ = at(day, "00:00");
        date_.setUTCHours(hour);
        const { svg } = renderSolarSystem(date_, "north", location);

        const apex = svg
          .querySelector("clipPath path")
          .getAttribute("d")
          .match(/^M (\S+) (\S+)/)
          .slice(1)
          .map(Number);
        const horizon = [...svg.querySelectorAll("line")].find(
          (line) => line.getAttribute("stroke-dasharray") === "4, 4"
        );
        const num = (name: string) => Number(horizon.getAttribute(name));

        const dx = num("x2") - num("x1");
        const dy = num("y2") - num("y1");
        const offset =
          Math.abs(dx * (num("y1") - apex[1]) - dy * (num("x1") - apex[0])) / Math.hypot(dx, dy);
        expect(offset, date_.toISOString()).toBeLessThan(1e-9);
      }
    }
  );
});

describe("the needle is square to the horizon", () => {
  // The needle marks the observer on Earth, and everything drawn around it — twilight cone,
  // horizon line, zenith line — is built on the observer's true zenith. So it has to be the
  // same direction, and perpendicularity has to be structural rather than coincidental.
  //
  // It used to be drawn from a clock angle instead: Earth's orbital angle plus the fraction of
  // the day elapsed, sweeping 15°/hour evenly. The zenith's projection into the ecliptic plane
  // does not sweep evenly — it traces an ellipse offset from the origin by
  // sin(lat)·sin(obliquity) — so the two ran up to 33° apart at Kraków (#167).
  it.each(MATRIX)("keeps the needle normal to the horizon at $site on $date", ({ site, date }) => {
    const location = SITES[site];
    const day = riseSetDay(site, date);
    for (let hour = 0; hour < 24; hour++) {
      const date_ = at(day, "00:00");
      date_.setUTCHours(hour);
      const { svg } = renderSolarSystem(date_, "north", location);

      const num = (el: Element, name: string) => Number(el.getAttribute(name));
      const dashed = [...svg.querySelectorAll("line")].filter(
        (line) => line.getAttribute("stroke-dasharray") === "4, 4"
      );
      const horizon = dashed[0];
      // The needle is the only line stroked at 70% currentColor — the comet tail is also
      // round-capped, so linecap alone would pick that up instead.
      const needle = [...svg.querySelectorAll("line")].find((line) =>
        (line.getAttribute("style") ?? "").includes("currentColor 70%")
      );

      const hx = num(horizon, "x2") - num(horizon, "x1");
      const hy = num(horizon, "y2") - num(horizon, "y1");
      const nx = num(needle, "x2") - num(needle, "x1");
      const ny = num(needle, "y2") - num(needle, "y1");

      const cosAngle = (hx * nx + hy * ny) / (Math.hypot(hx, hy) * Math.hypot(nx, ny));
      const offBy = Math.abs(90 - (Math.acos(Math.min(1, Math.max(-1, cosAngle))) * 180) / Math.PI);
      expect(offBy, date_.toISOString()).toBeLessThan(1e-6);
    }
  });
});

describe("the drawn horizon line agrees with both bodies", () => {
  const HOURS = 24;

  // The Sun is exact, everywhere, always. It has to be: it sits in the ecliptic plane, and for
  // a body in that plane, testing it against the zenith *projected* into the plane is not an
  // approximation — z·b and z_projected·b are the same number when b has no out-of-plane
  // component. The cone's axis is built from the same solar model the elevation comes from, so
  // the two cannot drift.
  it.each(MATRIX)("keeps the Sun on the correct side at $site on $date", ({ site, date }) => {
    const location = SITES[site];
    const day = riseSetDay(site, date);
    for (let hour = 0; hour < HOURS; hour++) {
      const date_ = at(day, "00:00");
      date_.setUTCHours(hour);
      const up = computeSolarElevationDeg(location.lat, location.lon, date_) > 0;
      expect(drawnHorizon(date_, location).sun, date_.toISOString()).toBe(up);
    }
  });

  // The Moon gets a band. It travels up to 5.1° out of the ecliptic plane, and a top-down view
  // of that plane has nowhere to put the difference — so within a few degrees of the horizon
  // the marker and the true altitude can land on opposite sides. Measured worst case is 4.50°,
  // at Kraków; outside 5° the picture is never wrong.
  //
  // It used to be wrong for about 15% of the day, from two faults at once (#166):
  //
  //   1. the marker came from a mean-longitude-only model (218.32° plus a uniform 2π/27.32 d),
  //      13° adrift by 2026, while the mymoon tile read the full Meeus ch.47 series;
  //   2. the line was pivoted on Earth's *surface*, a body radius off centre — which at this
  //      view's exaggerated scale (10 px Earth, 22 px Moon orbit) is a fake 27° of parallax,
  //      against the 0.95° the real geometry has.
  const IN_PLANE_BAND = 5;

  it.each(MATRIX)("keeps the Moon on the correct side at $site on $date", ({ site, date }) => {
    const location = SITES[site];
    const day = riseSetDay(site, date);
    for (let hour = 0; hour < HOURS; hour++) {
      const date_ = at(day, "00:00");
      date_.setUTCHours(hour);
      const altitude = getMoonSkyAngles(date_, location.lat, location.lon).altitudeDeg;
      if (Math.abs(altitude) < IN_PLANE_BAND) continue;
      expect(drawnHorizon(date_, location).moon, date_.toISOString()).toBe(altitude > 0);
    }
  });
});

describe("the drawn horizon line runs through the Sun at the moment of sunrise and sunset", () => {
  // The clean half of "does the drawing match the astronomy": at the instant the Sun's
  // elevation is 0, its true direction lies in the observer's horizon plane, and the drawn
  // horizon line is the projection of that plane. The Sun is drawn dead centre, so it must sit
  // ON the line. Near the horizon the ecliptic-plane projection is essentially exact, so this
  // holds tightly at every latitude — unlike the *noon* zenith line, which the projection
  // leaves ~atan(tan φ · sin ε) (~15° at Denton) off the Sun by construction. That noon
  // divergence is characterised in observer.test.ts's computeZenithAngleFromSun suite
  // (equator → 0, mean-noon offset = the equation of time) rather than pinned here.
  it.each(MATRIX)(
    "Sun sits on the horizon line at sunrise and sunset at $site on $date",
    ({ site, date }) => {
      const { lat, lon } = SITES[site];
      const day = riseSetDay(site, date);
      const altitudeAt = (d: Date) => computeSolarElevationDeg(lat, lon, d);

      for (const direction of ["rise", "set"] as const) {
        const t = crossing(altitudeAt, day, 0, direction);
        if (t === null) continue; // polar day/night — the Sun never reaches the horizon here
        const { svg } = renderSolarSystem(t, "north", SITES[site]);
        const dashed = [...svg.querySelectorAll("line")].filter(
          (l) => l.getAttribute("stroke-dasharray") === "4, 4"
        );
        const horizon = dashed[0];
        const anchorR = Math.hypot(
          Number(dashed[1].getAttribute("x1")) - CENTER,
          Number(dashed[1].getAttribute("y1")) - CENTER
        );
        const x1 = Number(horizon.getAttribute("x1"));
        const y1 = Number(horizon.getAttribute("y1"));
        const x2 = Number(horizon.getAttribute("x2"));
        const y2 = Number(horizon.getAttribute("y2"));
        // Perpendicular distance from the Sun (scene centre) to the horizon line, as an angle
        // seen from the observer's anchor.
        const d =
          Math.abs((x2 - x1) * (y1 - CENTER) - (x1 - CENTER) * (y2 - y1)) /
          Math.hypot(x2 - x1, y2 - y1);
        const missDeg = (Math.asin(Math.min(1, d / anchorR)) * 180) / Math.PI;
        expect(missDeg, `${direction} ${t.toISOString()}`).toBeLessThan(2);
      }
    }
  );
});
