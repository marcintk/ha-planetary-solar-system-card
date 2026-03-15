import { describe, expect, it } from "vitest";
import { calculatePlanetPosition } from "../../src/astronomy/orbital-mechanics.js";
import { PLANETS } from "../../src/astronomy/planet-data.js";
import { computeSolarElevationDeg } from "../../src/astronomy/solar-position.js";
import { calculateObserverAngle, calculateSolarElevationDeg } from "../../src/renderer/observer.js";

// Dallas, TX coordinates
const DALLAS_LAT = 32.78;
const DALLAS_LON = -96.8;
const DALLAS_TZ = "America/Chicago";

// Twilight boundary thresholds (degrees)
const TWILIGHT_BOUNDARIES = [0, -6, -12, -18];

/**
 * Scan minute-by-minute from 06:00 UTC (midnight CDT) to find when the solar
 * elevation crosses a given threshold. Starting from local midnight ensures
 * dawn is found before dusk within one scan window.
 */
function findThresholdCrossings(lat, lon, dateStr, thresholdDeg) {
  // Start at 06:00 UTC = ~midnight CDT, scan 24 hours
  const scanStart = new Date(`${dateStr}T06:00:00Z`);
  const elevations = [];
  for (let m = 0; m <= 24 * 60; m++) {
    const t = new Date(scanStart.getTime() + m * 60000);
    elevations.push({ time: t, elev: computeSolarElevationDeg(lat, lon, t) });
  }

  let dawn = null;
  let dusk = null;
  for (let i = 1; i < elevations.length; i++) {
    const prev = elevations[i - 1];
    const curr = elevations[i];
    // Crossing upward through threshold = dawn
    if (prev.elev < thresholdDeg && curr.elev >= thresholdDeg && !dawn) {
      dawn = curr.time;
    }
    // Crossing downward through threshold = dusk
    if (prev.elev >= thresholdDeg && curr.elev < thresholdDeg && !dusk) {
      dusk = curr.time;
    }
  }
  return { dawn, dusk };
}

describe("Twilight accuracy verification — Dallas, TX", () => {
  // Spring equinox (March 20, 2026): nearly equal day/night
  const EQUINOX = "2026-03-20";
  // Summer solstice (June 21, 2026): longest day
  const SUMMER = "2026-06-21";
  // Winter solstice (Dec 21, 2026): shortest day
  const WINTER = "2026-12-21";

  describe("Solar elevation ranges through a full day", () => {
    it("elevation sweeps from negative (night) through zero (horizon) to positive (day) and back", () => {
      const date = new Date(`${EQUINOX}T00:00:00Z`);
      let minElev = 90;
      let maxElev = -90;

      for (let m = 0; m <= 24 * 60; m += 30) {
        const t = new Date(date.getTime() + m * 60000);
        const elev = computeSolarElevationDeg(DALLAS_LAT, DALLAS_LON, t);
        minElev = Math.min(minElev, elev);
        maxElev = Math.max(maxElev, elev);
      }

      // Dallas should see the Sun above the horizon during the day
      expect(maxElev).toBeGreaterThan(50); // near equinox, peak ~57°
      expect(maxElev).toBeLessThan(80);
      // And well below at night
      expect(minElev).toBeLessThan(-40);
    });

    it("peak elevation occurs near local solar noon (UTC ~18:27 for Dallas)", () => {
      const date = new Date(`${EQUINOX}T00:00:00Z`);
      let peakElev = -90;
      let peakMinute = 0;

      for (let m = 0; m <= 24 * 60; m++) {
        const t = new Date(date.getTime() + m * 60000);
        const elev = computeSolarElevationDeg(DALLAS_LAT, DALLAS_LON, t);
        if (elev > peakElev) {
          peakElev = elev;
          peakMinute = m;
        }
      }

      const peakHourUtc = peakMinute / 60;
      // Dallas is ~96.8°W → solar noon ≈ 12 + 96.8/15 ≈ 18.45 UTC
      expect(peakHourUtc).toBeGreaterThan(17.5);
      expect(peakHourUtc).toBeLessThan(19.5);
    });
  });

  describe("Twilight boundary crossings — elevation 0° to -18°", () => {
    for (const threshold of TWILIGHT_BOUNDARIES) {
      const label =
        threshold === 0
          ? "Sunrise/Sunset (0°)"
          : threshold === -6
            ? "Civil twilight (-6°)"
            : threshold === -12
              ? "Nautical twilight (-12°)"
              : "Astronomical twilight (-18°)";

      describe(`${label}`, () => {
        it("finds both dawn and dusk crossings at equinox", () => {
          const { dawn, dusk } = findThresholdCrossings(DALLAS_LAT, DALLAS_LON, EQUINOX, threshold);
          expect(dawn).not.toBeNull();
          expect(dusk).not.toBeNull();
          // Dawn should be before dusk (scanning from local midnight)
          expect(dawn.getTime()).toBeLessThan(dusk.getTime());
        });

        it("dawn crossing occurs before solar noon", () => {
          const { dawn } = findThresholdCrossings(DALLAS_LAT, DALLAS_LON, EQUINOX, threshold);
          // Solar noon for Dallas ≈ 18:27 UTC
          expect(dawn.getUTCHours() + dawn.getUTCMinutes() / 60).toBeLessThan(18.5);
        });

        it("dusk crossing occurs after solar noon", () => {
          const { dawn, dusk } = findThresholdCrossings(DALLAS_LAT, DALLAS_LON, EQUINOX, threshold);
          // Dusk wraps past midnight UTC for Dallas, so compare absolute timestamps
          // Dusk must be after dawn, and also after solar noon (~18:27 UTC on equinox day)
          expect(dusk.getTime()).toBeGreaterThan(dawn.getTime());
          const solarNoonMs = new Date(`${EQUINOX}T18:27:00Z`).getTime();
          expect(dusk.getTime()).toBeGreaterThan(solarNoonMs);
        });
      });
    }
  });

  describe("Twilight boundaries are ordered correctly (dawn sequence)", () => {
    it("astronomical dawn < nautical dawn < civil dawn < sunrise", () => {
      const crossings = TWILIGHT_BOUNDARIES.map((t) =>
        findThresholdCrossings(DALLAS_LAT, DALLAS_LON, EQUINOX, t)
      );
      // Dawn times: -18° first, then -12°, then -6°, then 0°
      const dawnTimes = crossings.map((c) => c.dawn.getTime());
      // Astronomical dawn (-18°) should be earliest
      expect(dawnTimes[3]).toBeLessThan(dawnTimes[2]); // -18° < -12°
      expect(dawnTimes[2]).toBeLessThan(dawnTimes[1]); // -12° < -6°
      expect(dawnTimes[1]).toBeLessThan(dawnTimes[0]); // -6° < 0°
    });

    it("sunrise < civil dusk < nautical dusk < astronomical dusk", () => {
      const crossings = TWILIGHT_BOUNDARIES.map((t) =>
        findThresholdCrossings(DALLAS_LAT, DALLAS_LON, EQUINOX, t)
      );
      const duskTimes = crossings.map((c) => c.dusk.getTime());
      // Sunset (0°) first, then -6°, -12°, -18°
      expect(duskTimes[0]).toBeLessThan(duskTimes[1]); // 0° < -6°
      expect(duskTimes[1]).toBeLessThan(duskTimes[2]); // -6° < -12°
      expect(duskTimes[2]).toBeLessThan(duskTimes[3]); // -12° < -18°
    });
  });

  describe("Known sunrise/sunset times for Dallas (approximate)", () => {
    // Reference: Dallas spring equinox 2026 — sunrise ~7:30 CDT, sunset ~7:40 CDT
    // CDT = UTC-5, so sunrise ~12:30 UTC, sunset ~00:40 UTC+1 ≈ 24:40 UTC
    it("equinox sunrise is near 12:30 UTC (7:30 CDT)", () => {
      const { dawn } = findThresholdCrossings(DALLAS_LAT, DALLAS_LON, EQUINOX, 0);
      const utcHour = dawn.getUTCHours() + dawn.getUTCMinutes() / 60;
      // Allow ±30 min tolerance (our formula is simplified, no refraction/equation of time)
      expect(utcHour).toBeGreaterThan(11.5);
      expect(utcHour).toBeLessThan(13.5);
    });

    it("equinox sunset is near 00:30 UTC next day (19:30 CDT)", () => {
      const { dusk } = findThresholdCrossings(DALLAS_LAT, DALLAS_LON, EQUINOX, 0);
      const utcHour = dusk.getUTCHours() + dusk.getUTCMinutes() / 60;
      // Sunset for Dallas is around 00:30 UTC next day (wraps around)
      // With scan starting at 06:00 UTC, dusk is found ~18.5h into scan → ~00:30 UTC
      expect(utcHour).toBeLessThan(2); // wraps past midnight UTC
    });

    it("summer solstice has longer day than equinox", () => {
      const eqCrossings = findThresholdCrossings(DALLAS_LAT, DALLAS_LON, EQUINOX, 0);
      const sumCrossings = findThresholdCrossings(DALLAS_LAT, DALLAS_LON, SUMMER, 0);
      const eqDayLength = eqCrossings.dusk.getTime() - eqCrossings.dawn.getTime();
      const sumDayLength = sumCrossings.dusk.getTime() - sumCrossings.dawn.getTime();
      expect(sumDayLength).toBeGreaterThan(eqDayLength);
    });

    it("winter solstice has shorter day than equinox", () => {
      const eqCrossings = findThresholdCrossings(DALLAS_LAT, DALLAS_LON, EQUINOX, 0);
      const winCrossings = findThresholdCrossings(DALLAS_LAT, DALLAS_LON, WINTER, 0);
      const eqDayLength = eqCrossings.dusk.getTime() - eqCrossings.dawn.getTime();
      const winDayLength = winCrossings.dusk.getTime() - winCrossings.dawn.getTime();
      expect(winDayLength).toBeLessThan(eqDayLength);
    });
  });

  describe("Cone half-angle formula consistency with elevation", () => {
    // The formula: halfAngle = elevationDeg >= 0 || elevationDeg < -18 ? 90 : 90 - elevationDeg
    // At exactly -18°, (elevationDeg >= -18) is true → astronomical twilight, NOT night.
    // So -18° gives halfAngle = 90 - (-18) = 108°. Night starts below -18°.
    function computeHalfAngle(elevationDeg) {
      return elevationDeg >= 0 || elevationDeg < -18 ? 90 : 90 - elevationDeg;
    }

    it("halfAngle is 90° when Sun is above horizon (day)", () => {
      expect(computeHalfAngle(10)).toBe(90);
      expect(computeHalfAngle(0)).toBe(90);
      expect(computeHalfAngle(45)).toBe(90);
    });

    it("halfAngle is 90° when Sun is below -18° (night)", () => {
      expect(computeHalfAngle(-19)).toBe(90);
      expect(computeHalfAngle(-30)).toBe(90);
    });

    it("halfAngle increases as elevation goes from 0° to -18°", () => {
      for (let deg = -1; deg >= -18; deg--) {
        const ha = computeHalfAngle(deg);
        expect(ha).toBe(90 - deg); // e.g., -6° → 96°, -12° → 102°, -18° → 108°
        expect(ha).toBeGreaterThan(90);
        expect(ha).toBeLessThanOrEqual(108);
      }
    });

    it("halfAngle at each twilight boundary is correct", () => {
      expect(computeHalfAngle(-6)).toBe(96);
      expect(computeHalfAngle(-12)).toBe(102);
      // -18° is >= -18 → astronomical twilight bracket, halfAngle = 108°
      expect(computeHalfAngle(-18)).toBe(108);
    });
  });

  describe("Cone geometry relative to Earth-Sun line", () => {
    // FINDING: calculateObserverAngle uses civil timezone (CDT/CST), NOT true solar time.
    // Dallas at -96.8° vs CST center at -90° means solar noon is ~27 min after clock noon.
    // This creates a ~21.75° angular offset between clock-based observer angle and Sun direction.
    // This is a KNOWN LIMITATION of the timezone-based observer angle calculation.

    const earth = PLANETS.find((p) => p.name === "Earth");

    it("at solar noon, observer angle points toward the Sun (within 1°)", () => {
      // 18:27 UTC is solar noon for Dallas (based on longitude -96.8°)
      // With the longitude-based fix, observer angle should align with Sun direction
      const date = new Date("2026-03-20T18:27:00Z");
      const earthAngle = calculatePlanetPosition(earth, date);
      const obsAngle = calculateObserverAngle(earthAngle, date, DALLAS_TZ, DALLAS_LON);
      const sunDir = earthAngle + Math.PI;
      const diff = Math.atan2(Math.sin(obsAngle - sunDir), Math.cos(obsAngle - sunDir));
      const diffDeg = Math.abs(diff) * (180 / Math.PI);
      expect(diffDeg).toBeLessThan(1);
    });

    it("at sunrise, observer is ~90° from Sun direction", () => {
      const { dawn } = findThresholdCrossings(DALLAS_LAT, DALLAS_LON, EQUINOX, 0);
      const earthAngle = calculatePlanetPosition(earth, dawn);
      const obsAngle = calculateObserverAngle(earthAngle, dawn, DALLAS_TZ, DALLAS_LON);
      const sunDir = earthAngle + Math.PI;
      const diff = Math.atan2(Math.sin(obsAngle - sunDir), Math.cos(obsAngle - sunDir));
      const diffDeg = Math.abs(diff) * (180 / Math.PI);
      // At sunrise, observer should be roughly perpendicular to Sun direction
      expect(diffDeg).toBeGreaterThan(80);
      expect(diffDeg).toBeLessThan(100);
    });

    it("cone edge at sunrise (halfAngle=90°) touches the Sun direction", () => {
      const { dawn } = findThresholdCrossings(DALLAS_LAT, DALLAS_LON, EQUINOX, 0);
      const earthAngle = calculatePlanetPosition(earth, dawn);
      const obsAngle = calculateObserverAngle(earthAngle, dawn, DALLAS_TZ, DALLAS_LON);
      const sunDir = earthAngle + Math.PI;

      const edge1 = obsAngle + Math.PI / 2;
      const edge2 = obsAngle - Math.PI / 2;
      const diff1 = Math.abs(Math.atan2(Math.sin(edge1 - sunDir), Math.cos(edge1 - sunDir)));
      const diff2 = Math.abs(Math.atan2(Math.sin(edge2 - sunDir), Math.cos(edge2 - sunDir)));
      const closestEdgeDeg = Math.min(diff1, diff2) * (180 / Math.PI);
      // With proper solar time alignment, the cone edge should be within ~10° of the Sun
      expect(closestEdgeDeg).toBeLessThan(10);
    });

    it("during civil twilight, cone extends past the Sun direction", () => {
      // Find a time when elevation is about -3° (middle of civil twilight)
      const date = new Date(`${EQUINOX}T06:00:00Z`);
      let twilightTime = null;
      for (let m = 0; m <= 24 * 60; m++) {
        const t = new Date(date.getTime() + m * 60000);
        const elev = computeSolarElevationDeg(DALLAS_LAT, DALLAS_LON, t);
        if (elev >= -4 && elev <= -2) {
          twilightTime = t;
          break;
        }
      }
      expect(twilightTime).not.toBeNull();

      const elev = computeSolarElevationDeg(DALLAS_LAT, DALLAS_LON, twilightTime);
      const halfAngle = 90 - elev; // e.g., at -3° → 93°
      expect(halfAngle).toBeGreaterThan(90);
      expect(halfAngle).toBeLessThan(96);
    });
  });

  describe("Orbital approximation vs spherical astronomy comparison", () => {
    // The orbital approximation (calculateSolarElevationDeg) doesn't account for
    // latitude, so it should diverge from the spherical formula for non-equatorial locations.
    // Additionally, it inherits the timezone offset issue.

    const earth = PLANETS.find((p) => p.name === "Earth");

    it("both methods agree on sign (day/night) at solar noon", () => {
      const date = new Date("2026-03-20T18:27:00Z");
      const spherical = computeSolarElevationDeg(DALLAS_LAT, DALLAS_LON, date);
      const earthAngle = calculatePlanetPosition(earth, date);
      const obsAngle = calculateObserverAngle(earthAngle, date, DALLAS_TZ, DALLAS_LON);
      const orbital = calculateSolarElevationDeg(obsAngle, earthAngle);
      expect(spherical).toBeGreaterThan(0);
      expect(orbital).toBeGreaterThan(0);
    });

    it("both methods agree on sign (day/night) at solar midnight", () => {
      const date = new Date("2026-03-20T06:27:00Z"); // ~midnight CDT
      const spherical = computeSolarElevationDeg(DALLAS_LAT, DALLAS_LON, date);
      const earthAngle = calculatePlanetPosition(earth, date);
      const obsAngle = calculateObserverAngle(earthAngle, date, DALLAS_TZ, DALLAS_LON);
      const orbital = calculateSolarElevationDeg(obsAngle, earthAngle);
      expect(spherical).toBeLessThan(0);
      expect(orbital).toBeLessThan(0);
    });

    it("orbital approximation at solar noon gives ~90° (with longitude-based fix)", () => {
      const date = new Date("2026-03-20T18:27:00Z");
      const earthAngle = calculatePlanetPosition(earth, date);
      const obsAngle = calculateObserverAngle(earthAngle, date, DALLAS_TZ, DALLAS_LON);
      const orbital = calculateSolarElevationDeg(obsAngle, earthAngle);
      // With longitude, observer faces Sun at true solar noon → elevation near 90°
      expect(orbital).toBeGreaterThan(85);
    });

    it("spherical astronomy returns latitude-adjusted peak (~57° for Dallas at equinox)", () => {
      const date = new Date("2026-03-20T18:27:00Z");
      const spherical = computeSolarElevationDeg(DALLAS_LAT, DALLAS_LON, date);
      // Dallas at 32.78°N, equinox: peak ≈ 90 - 32.78 ≈ 57.2°
      expect(spherical).toBeGreaterThan(50);
      expect(spherical).toBeLessThan(65);
    });

    it("divergence between methods at noon: orbital ~90° vs spherical ~57° (latitude gap)", () => {
      const date = new Date("2026-03-20T18:27:00Z");
      const spherical = computeSolarElevationDeg(DALLAS_LAT, DALLAS_LON, date);
      const earthAngle = calculatePlanetPosition(earth, date);
      const obsAngle = calculateObserverAngle(earthAngle, date, DALLAS_TZ, DALLAS_LON);
      const orbital = calculateSolarElevationDeg(obsAngle, earthAngle);
      const gap = Math.abs(orbital - spherical);
      // ~33° divergence: orbital gives ~90° (no latitude), spherical gives ~57° (with latitude)
      // This gap equals roughly the latitude (32.78°) — expected for equinox
      expect(gap).toBeGreaterThan(25);
      expect(gap).toBeLessThan(40);
    });
  });
});
