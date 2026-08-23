import { describe, expect, it } from "vitest";
import { getMoonSkyAngles } from "../../src/astronomy/parallactic.js";
import { MOON } from "../../src/astronomy/planet-data.js";
import { computeSolarElevationDeg, getSkyMode } from "../../src/astronomy/solar-position.js";
import { ViewingLocation } from "../../src/card/viewing-location.js";
import { renderSolarSystem } from "../../src/renderer/index.js";
import { CENTER } from "../../src/renderer/svg-utils.js";
import type { LocationData } from "../../src/types.js";

/**
 * Three sites, chosen to move the parts of the geometry that a single mid-northern latitude
 * would leave pinned: Denton is the reported case, Montevideo puts the observer in the
 * southern hemisphere (where the parallactic angle lands ~180° away and the seasons invert),
 * and Kraków is far enough north that the day length swings from 8h to 16h across the year.
 */
const SITES: Record<string, LocationData> = {
  Denton: { lat: 33.2148, lon: -97.1331, timezone: "America/Chicago", zoneOverride: false },
  Montevideo: { lat: -34.9011, lon: -56.1645, timezone: "America/Montevideo", zoneOverride: false },
  Kraków: { lat: 50.0647, lon: 19.945, timezone: "Europe/Warsaw", zoneOverride: false },
};

/**
 * Ground truth from the US Naval Observatory's rise/set service, the almanac that consumer
 * sites (timeanddate.com among them) publish downstream of:
 *
 *   https://aa.usno.navy.mil/api/rstt/oneday?date=<day>&coords=<lat>,<lon>&tz=0
 *
 * Every time below is UTC, on the UTC day named — `tz=0` on that endpoint, so a "sunset" of
 * 00:39 is 00:39 UTC that morning, which is the previous evening local. Five days spread
 * across 2026 so both solstices, an equinox and two ordinary dates are covered.
 */
type Fixture = {
  site: keyof typeof SITES;
  day: string;
  sunRise: string;
  sunSet: string;
  moonRise: string;
  moonSet: string;
};

const USNO: Fixture[] = [
  // site, UTC day, sun rise/set, moon rise/set — all UTC
  {
    site: "Denton",
    day: "2026-01-15",
    sunRise: "13:32",
    sunSet: "23:44",
    moonRise: "11:15",
    moonSet: "20:50",
  }, // prettier-ignore
  {
    site: "Denton",
    day: "2026-03-20",
    sunRise: "12:32",
    sunSet: "00:39",
    moonRise: "13:15",
    moonSet: "01:40",
  }, // prettier-ignore
  {
    site: "Denton",
    day: "2026-06-21",
    sunRise: "11:20",
    sunSet: "01:41",
    moonRise: "18:25",
    moonSet: "06:02",
  }, // prettier-ignore
  {
    site: "Denton",
    day: "2026-08-22",
    sunRise: "11:56",
    sunSet: "01:07",
    moonRise: "21:47",
    moonSet: "06:31",
  }, // prettier-ignore
  {
    site: "Denton",
    day: "2026-12-21",
    sunRise: "13:28",
    sunSet: "23:25",
    moonRise: "21:00",
    moonSet: "10:50",
  }, // prettier-ignore
  {
    site: "Montevideo",
    day: "2026-01-15",
    sunRise: "08:47",
    sunSet: "23:01",
    moonRise: "05:32",
    moonSet: "20:57",
  }, // prettier-ignore
  {
    site: "Montevideo",
    day: "2026-03-20",
    sunRise: "09:48",
    sunSet: "21:56",
    moonRise: "11:26",
    moonSet: "22:40",
  }, // prettier-ignore
  {
    site: "Montevideo",
    day: "2026-06-21",
    sunRise: "10:52",
    sunSet: "20:41",
    moonRise: "15:29",
    moonSet: "03:02",
  }, // prettier-ignore
  {
    site: "Montevideo",
    day: "2026-08-22",
    sunRise: "10:17",
    sunSet: "21:19",
    moonRise: "16:03",
    moonSet: "06:37",
  }, // prettier-ignore
  {
    site: "Montevideo",
    day: "2026-12-21",
    sunRise: "08:28",
    sunSet: "22:58",
    moonRise: "20:41",
    moonSet: "05:40",
  }, // prettier-ignore
  {
    site: "Kraków",
    day: "2026-01-15",
    sunRise: "06:33",
    sunSet: "15:06",
    moonRise: "04:26",
    moonSet: "11:27",
  }, // prettier-ignore
  {
    site: "Kraków",
    day: "2026-03-20",
    sunRise: "04:43",
    sunSet: "16:53",
    moonRise: "04:58",
    moonSet: "19:07",
  }, // prettier-ignore
  {
    site: "Kraków",
    day: "2026-06-21",
    sunRise: "02:31",
    sunSet: "18:53",
    moonRise: "10:16",
    moonSet: "22:26",
  }, // prettier-ignore
  {
    site: "Kraków",
    day: "2026-08-22",
    sunRise: "03:40",
    sunSet: "17:45",
    moonRise: "15:03",
    moonSet: "21:59",
  }, // prettier-ignore
  {
    site: "Kraków",
    day: "2026-12-21",
    sunRise: "06:36",
    sunSet: "14:40",
    moonRise: "11:54",
    moonSet: "03:35",
  }, // prettier-ignore
];

const at = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00Z`);
const MINUTE = 60000;

/**
 * The apparent altitude a body has to reach to count as risen. The almanac does not use the
 * geometric horizon: refraction lifts a body 34' before it is really up, and the Sun is called
 * risen at first limb, half a 32' disc early. The Moon's own 16' semidiameter is all but
 * cancelled by its 57' horizontal parallax, which pushes the other way, so it nets out near
 * the geometric horizon instead.
 */
const RISE_ALTITUDE = { sun: -0.8333, moon: 0.125 };

/** When our own model has the body crossing `altitude`, searched over one UTC day. */
function crossing(
  altitudeAt: (date: Date) => number,
  day: string,
  altitude: number,
  direction: "rise" | "set"
): Date | null {
  const start = at(day, "00:00").getTime();
  let previous = altitudeAt(new Date(start)) - altitude;
  for (let minute = 1; minute <= 1440; minute++) {
    const now = altitudeAt(new Date(start + minute * MINUTE)) - altitude;
    const rose = previous <= 0 && now > 0;
    const set = previous >= 0 && now < 0;
    if (direction === "rise" ? rose : set) return new Date(start + minute * MINUTE);
    previous = now;
  }
  return null;
}

const minutesApart = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) / MINUTE;

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
  // minute at every site and season below. That is the number the mymoon tile depends on.
  it.each(USNO)("puts the Moon within 2 minutes at $site on $day", (fixture) => {
    const { lat, lon } = SITES[fixture.site];
    const altitudeAt = (date: Date) => getMoonSkyAngles(date, lat, lon).altitudeDeg;

    for (const [event, direction] of [
      ["moonRise", "rise"],
      ["moonSet", "set"],
    ] as const) {
      const ours = crossing(altitudeAt, fixture.day, RISE_ALTITUDE.moon, direction);
      expect(ours, `no ${direction} found`).not.toBeNull();
      expect(minutesApart(ours, at(fixture.day, fixture[event]))).toBeLessThanOrEqual(2);
    }
  });

  // Two minutes for the Sun as well. It used to be twelve, and that number was fitted to the
  // circular model's own error rather than to any requirement — which meant it could only ever
  // catch a regression, never the inaccuracy already sitting there. Two minutes is where the
  // requirement lands: the card renders these to the minute, so one minute of model error plus
  // one of rounding is the whole budget.
  it.each(USNO)("puts the Sun within 2 minutes at $site on $day", (fixture) => {
    const { lat, lon } = SITES[fixture.site];
    const altitudeAt = (date: Date) => computeSolarElevationDeg(lat, lon, date);

    for (const [event, direction] of [
      ["sunRise", "rise"],
      ["sunSet", "set"],
    ] as const) {
      const ours = crossing(altitudeAt, fixture.day, RISE_ALTITUDE.sun, direction);
      expect(ours, `no ${direction} found`).not.toBeNull();
      expect(minutesApart(ours, at(fixture.day, fixture[event]))).toBeLessThanOrEqual(2);
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

  it.each(USNO)("calls it Day before sunset and twilight after at $site on $day", (fixture) => {
    const { lat, lon } = SITES[fixture.site];
    const sunset = at(fixture.day, fixture.sunSet).getTime();

    const modeAt = (t: number) => getSkyMode(computeSolarElevationDeg(lat, lon, new Date(t)));
    expect(modeAt(sunset - MARGIN), "before sunset").toBe("Day");
    expect(modeAt(sunset + MARGIN), "after sunset").toBe("Civil Twilight");
  });
});

describe("the mymoon tile against the USNO almanac", () => {
  // Sampled half an hour either side of each almanac event rather than on it: the tile only
  // needs to be right about which side of the horizon the Moon is on, and its image refreshes
  // hourly anyway, so the minute it flips is not what is being pinned here. Half an hour is
  // thirty times the error the rise/set suite above measures.
  const HALF_HOUR = 30 * MINUTE;

  it.each(USNO)("shows the Moon around its rise and set at $site on $day", (fixture) => {
    const location = SITES[fixture.site];
    const expectations: [string, Date, boolean][] = [
      ["before moonrise", new Date(at(fixture.day, fixture.moonRise).getTime() - HALF_HOUR), false],
      ["after moonrise", new Date(at(fixture.day, fixture.moonRise).getTime() + HALF_HOUR), true],
      ["before moonset", new Date(at(fixture.day, fixture.moonSet).getTime() - HALF_HOUR), true],
      ["after moonset", new Date(at(fixture.day, fixture.moonSet).getTime() + HALF_HOUR), false],
    ];

    for (const [label, date, inSky] of expectations) {
      expect(skyFrameAt(date, location).belowHorizon, label).toBe(!inSky);
    }
  });
});

describe("the visibility cone and the horizon line share one apex", () => {
  // They are the same boundary, so they have to be drawn from the same point. The cone used to
  // open from Earth's *surface* while the lines pivoted on its centre, which left the cone's
  // own 90° edge running parallel to the horizon line a body radius away — two lines where the
  // picture only means one.
  it.each(USNO)("puts the cone's apex on the horizon line at $site on $day", (fixture) => {
    const location = SITES[fixture.site];
    for (let hour = 0; hour < 24; hour++) {
      const date = at(fixture.day, "00:00");
      date.setUTCHours(hour);
      const { svg } = renderSolarSystem(date, "north", location);

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

      // Distance from the apex to the infinite line through the horizon's two endpoints.
      const dx = num("x2") - num("x1");
      const dy = num("y2") - num("y1");
      const offset =
        Math.abs(dx * (num("y1") - apex[1]) - dy * (num("x1") - apex[0])) / Math.hypot(dx, dy);
      expect(offset, date.toISOString()).toBeLessThan(1e-9);
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
  it.each(USNO)("keeps the Sun on the correct side at $site on $day", (fixture) => {
    const location = SITES[fixture.site];
    for (let hour = 0; hour < HOURS; hour++) {
      const date = at(fixture.day, "00:00");
      date.setUTCHours(hour);
      const up = computeSolarElevationDeg(location.lat, location.lon, date) > 0;
      expect(drawnHorizon(date, location).sun, date.toISOString()).toBe(up);
    }
  });

  // The Moon gets a band. It travels up to 5.1° out of the ecliptic plane, and a top-down view
  // of that plane has nowhere to put the difference — so within a few degrees of the horizon
  // the marker and the true altitude can land on opposite sides. Measured worst case over
  // these three sites is 4.50°, at Kraków; outside 5° the picture is never wrong.
  //
  // It used to be wrong for about 15% of the day, from two faults at once (#166):
  //
  //   1. the marker came from a mean-longitude-only model (218.32° plus a uniform 2π/27.32 d),
  //      13° adrift by 2026, while the mymoon tile read the full Meeus ch.47 series;
  //   2. the line was pivoted on Earth's *surface*, a body radius off centre — which at this
  //      view's exaggerated scale (10 px Earth, 22 px Moon orbit) is a fake 27° of parallax,
  //      against the 0.95° the real geometry has.
  //
  // Either one alone put the Moon on the wrong side of the line at altitudes far outside this
  // band, so this assertion is what holds them fixed.
  const IN_PLANE_BAND = 5;

  it.each(USNO)("keeps the Moon on the correct side at $site on $day", (fixture) => {
    const location = SITES[fixture.site];
    for (let hour = 0; hour < HOURS; hour++) {
      const date = at(fixture.day, "00:00");
      date.setUTCHours(hour);
      const altitude = getMoonSkyAngles(date, location.lat, location.lon).altitudeDeg;
      if (Math.abs(altitude) < IN_PLANE_BAND) continue;
      expect(drawnHorizon(date, location).moon, date.toISOString()).toBe(altitude > 0);
    }
  });
});
