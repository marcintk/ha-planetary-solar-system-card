import { describe, expect, it } from "vitest";
import { getMoonSkyAngles } from "../../src/astronomy/parallactic.js";
import { computeSolarElevationDeg } from "../../src/astronomy/solar-position.js";

const SITES: Record<string, [lat: number, lon: number]> = {
  Denton: [33.2148, -97.1331],
  Montevideo: [-34.9011, -56.1645],
  Kraków: [50.0647, 19.945],
};

/**
 * How far off an altitude is allowed to be, in degrees.
 *
 * Set from what the card needs, not from what the code currently manages. The tightest thing
 * anything here drives is a twilight band edge (0°, -6°, -12°, -18°), and near the horizon the
 * Sun falls about 0.2°/minute. So 0.1° of altitude is half a minute of clock time on a band
 * transition — under the minute this card ever displays, with room to spare.
 *
 * Expressed in degrees rather than as a percentage on purpose: a percentage of altitude is
 * meaningless where it matters most. 1% of a 60° altitude is 0.6°, three minutes of sunset;
 * 1% of a 0.5° altitude is 0.005°, tighter than the ephemeris. The physical error does not
 * scale with the reading, so neither should the bound.
 */
const ALTITUDE_TOLERANCE_DEG = 0.1;

/**
 * Ground truth from the US Naval Observatory's celestial-navigation service:
 *
 *   https://aa.usno.navy.mil/api/celnav?date=<day>&time=<hh:mm:ss>&coords=<lat>,<lon>
 *
 * `almanac_data.hc` there is the geocentric computed altitude — centre of body, no refraction,
 * no semidiameter, no topocentric parallax — which is exactly what both functions under test
 * return. (The `altitude_corrections` the API reports alongside are what you would *add* to
 * reach an observed sextant altitude; applying them here would introduce the error, not remove
 * it. The Moon's parallax alone is 0.81°, eight times this tolerance.)
 *
 * Three sites, three dates, every four hours of UTC: altitudes run from -7° to +80°, both
 * hemispheres, both solstices and an equinox.
 */
type Sample = [site: keyof typeof SITES, utc: string, body: "Sun" | "Moon", altitudeDeg: number];

const USNO_ALTITUDES: Sample[] = [
  ["Denton", "2026-03-20T00:00:00Z", "Sun", 7.410036],
  ["Denton", "2026-03-20T00:00:00Z", "Moon", 20.05394],
  ["Denton", "2026-03-20T12:00:00Z", "Sun", -7.538953],
  ["Denton", "2026-03-20T16:00:00Z", "Sun", 40.583609],
  ["Denton", "2026-03-20T16:00:00Z", "Moon", 33.610369],
  ["Denton", "2026-03-20T20:00:00Z", "Sun", 51.41746],
  ["Denton", "2026-03-20T20:00:00Z", "Moon", 69.383229],
  ["Denton", "2026-06-21T00:00:00Z", "Sun", 18.594595],
  ["Denton", "2026-06-21T00:00:00Z", "Moon", 59.766456],
  ["Denton", "2026-06-21T04:00:00Z", "Moon", 24.953286],
  ["Denton", "2026-06-21T12:00:00Z", "Sun", 6.691745],
  ["Denton", "2026-06-21T16:00:00Z", "Sun", 55.696645],
  ["Denton", "2026-06-21T20:00:00Z", "Sun", 68.061421],
  ["Denton", "2026-06-21T20:00:00Z", "Moon", 18.965891],
  ["Denton", "2026-12-21T00:00:00Z", "Sun", -7.457506],
  ["Denton", "2026-12-21T00:00:00Z", "Moon", 44.725169],
  ["Denton", "2026-12-21T04:00:00Z", "Moon", 77.033025],
  ["Denton", "2026-12-21T08:00:00Z", "Moon", 32.180452],
  ["Denton", "2026-12-21T16:00:00Z", "Sun", 23.441045],
  ["Denton", "2026-12-21T20:00:00Z", "Sun", 29.148178],
  ["Montevideo", "2026-03-20T12:00:00Z", "Sun", 25.770928],
  ["Montevideo", "2026-03-20T12:00:00Z", "Moon", 6.590283],
  ["Montevideo", "2026-03-20T16:00:00Z", "Sun", 55.029037],
  ["Montevideo", "2026-03-20T16:00:00Z", "Moon", 41.046877],
  ["Montevideo", "2026-03-20T20:00:00Z", "Sun", 22.591563],
  ["Montevideo", "2026-03-20T20:00:00Z", "Moon", 28.204048],
  ["Montevideo", "2026-06-21T00:00:00Z", "Moon", 33.909388],
  ["Montevideo", "2026-06-21T12:00:00Z", "Sun", 10.744776],
  ["Montevideo", "2026-06-21T16:00:00Z", "Sun", 31.573671],
  ["Montevideo", "2026-06-21T16:00:00Z", "Moon", 6.278126],
  ["Montevideo", "2026-06-21T20:00:00Z", "Sun", 6.303288],
  ["Montevideo", "2026-06-21T20:00:00Z", "Moon", 49.824643],
  ["Montevideo", "2026-12-21T00:00:00Z", "Sun", -11.383769],
  ["Montevideo", "2026-12-21T00:00:00Z", "Moon", 32.915597],
  ["Montevideo", "2026-12-21T04:00:00Z", "Moon", 16.396461],
  ["Montevideo", "2026-12-21T08:00:00Z", "Sun", -5.640329],
  ["Montevideo", "2026-12-21T12:00:00Z", "Sun", 40.678989],
  ["Montevideo", "2026-12-21T16:00:00Z", "Sun", 77.94117],
  ["Montevideo", "2026-12-21T20:00:00Z", "Sun", 33.652492],
  ["Kraków", "2026-03-20T04:00:00Z", "Sun", -7.768046],
  ["Kraków", "2026-03-20T08:00:00Z", "Sun", 28.431054],
  ["Kraków", "2026-03-20T08:00:00Z", "Moon", 28.594278],
  ["Kraków", "2026-03-20T12:00:00Z", "Sun", 37.560459],
  ["Kraków", "2026-03-20T12:00:00Z", "Moon", 50.409626],
  ["Kraków", "2026-03-20T16:00:00Z", "Sun", 7.623453],
  ["Kraków", "2026-03-20T16:00:00Z", "Moon", 28.003995],
  ["Kraków", "2026-06-21T04:00:00Z", "Sun", 11.405118],
  ["Kraków", "2026-06-21T08:00:00Z", "Sun", 48.836279],
  ["Kraków", "2026-06-21T12:00:00Z", "Sun", 59.338475],
  ["Kraków", "2026-06-21T12:00:00Z", "Moon", 15.679471],
  ["Kraków", "2026-06-21T16:00:00Z", "Sun", 24.361925],
  ["Kraków", "2026-06-21T16:00:00Z", "Moon", 38.627779],
  ["Kraków", "2026-06-21T20:00:00Z", "Sun", -8.203469],
  ["Kraków", "2026-06-21T20:00:00Z", "Moon", 21.973887],
  ["Kraków", "2026-12-21T00:00:00Z", "Moon", 30.816477],
  ["Kraków", "2026-12-21T04:00:00Z", "Moon", -2.854234],
  ["Kraków", "2026-12-21T08:00:00Z", "Sun", 8.578368],
  ["Kraków", "2026-12-21T12:00:00Z", "Sun", 14.296938],
  ["Kraków", "2026-12-21T12:00:00Z", "Moon", 0.856948],
  ["Kraków", "2026-12-21T16:00:00Z", "Sun", -11.937239],
  ["Kraków", "2026-12-21T16:00:00Z", "Moon", 35.977882],
  ["Kraków", "2026-12-21T20:00:00Z", "Moon", 64.444688],
];

describe("Sun and Moon altitude against the USNO almanac", () => {
  it.each(USNO_ALTITUDES)("%s %s: %s", (site, utc, body, expected) => {
    const [lat, lon] = SITES[site];
    const date = new Date(utc);
    const ours =
      body === "Sun"
        ? computeSolarElevationDeg(lat, lon, date)
        : getMoonSkyAngles(date, lat, lon).altitudeDeg;

    expect(Math.abs(ours - expected)).toBeLessThanOrEqual(ALTITUDE_TOLERANCE_DEG);
  });
});
