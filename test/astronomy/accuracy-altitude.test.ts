import { describe, expect, it } from "vitest";
import { getMoonSkyAngles } from "../../src/astronomy/parallactic.js";
import { computeSolarElevationDeg } from "../../src/astronomy/solar-position.js";
import { DATES, isPlaceholder, SITES, USNO_ALTITUDES } from "../fixtures/observer-matrix.js";

/**
 * How far off an altitude is allowed to be, in degrees — the card's own requirement.
 *
 * The tightest thing anything here drives is a twilight band edge (0°, -6°, -12°, -18°), and
 * near the horizon the Sun falls about 0.2°/minute. So 0.1° of altitude is half a minute of
 * clock time on a band transition — under the minute this card ever displays.
 *
 * Expressed in degrees, not a percentage: 1% of a 60° altitude is 0.6° (three minutes of
 * sunset); 1% of a 0.5° altitude is 0.005° (tighter than the ephemeris). The physical error
 * does not scale with the reading, so neither should the bound.
 */
const ALTITUDE_REQUIREMENT_DEG = 0.1;

/**
 * What the two models actually achieve, per body, across every real sample below — separate
 * from the requirement and much tighter, because the two answer different questions. Held at
 * roughly 1.4x the measured worst case (Sun 0.0108°, Moon 0.0222°): enough headroom for
 * floating-point and platform variation, not enough to hide a real degradation. A failure here
 * is a regression report; read it against ALTITUDE_REQUIREMENT_DEG to see whether anything
 * user-visible actually moved.
 *
 * The Moon's is looser for a physical reason: its series is truncated where the remaining Meeus
 * terms stop mattering at a 104px thumbnail's scale, and it is 400x closer, so the same angular
 * slack is far less distance.
 */
const ALTITUDE_PIN_DEG: Record<"Sun" | "Moon", number> = { Sun: 0.015, Moon: 0.03 };

/**
 * Ground truth is `almanac_data.hc` from the USNO celestial-navigation service — geocentric
 * computed altitude (centre of body, no refraction / semidiameter / topocentric parallax),
 * exactly what both functions under test return. Sites and dates come from the shared matrix;
 * rows the fixture still marks PLACEHOLDER fail loudly here until someone fetches them.
 */
describe("Sun and Moon altitude against the USNO almanac", () => {
  it.each(USNO_ALTITUDES)("$site $date $utc $body", ({ site, date, utc, body, altitudeDeg }) => {
    const { lat, lon } = SITES[site];

    if (isPlaceholder(altitudeDeg)) {
      expect.fail(
        `no celnav altitude for ${site}/${date} ${utc} ${body} — fetch hc from ` +
          `aa.usno.navy.mil/api/celnav?date=${DATES[date]}&time=${utc}:00&coords=${lat},${lon}`
      );
    }

    const when = new Date(`${DATES[date]}T${utc}:00Z`);
    const ours =
      body === "Sun"
        ? computeSolarElevationDeg(lat, lon, when)
        : getMoonSkyAngles(when, lat, lon).altitudeDeg;

    const error = Math.abs(ours - altitudeDeg);
    expect(error, "card requirement").toBeLessThanOrEqual(ALTITUDE_REQUIREMENT_DEG);
    expect(error, "accuracy pin").toBeLessThanOrEqual(ALTITUDE_PIN_DEG[body]);
  });
});
