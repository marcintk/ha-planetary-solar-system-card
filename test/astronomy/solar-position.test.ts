import { afterEach, describe, expect, it, vi } from "vitest";
import {
  computeNextTransitionTime,
  computeSolarElevationDeg,
  getLocalHourInstant,
  getLocalTimeInZone,
  getSkyMode,
} from "../../src/astronomy/solar-position.js";

describe("getLocalTimeInZone", () => {
  it("returns correct local time for a UTC date in America/Chicago (CST = UTC-6)", () => {
    // 2026-01-15 18:00 UTC → 2026-01-15 12:00 CST (UTC-6, standard time)
    const date = new Date("2026-01-15T18:00:00Z");
    const { hours, minutes } = getLocalTimeInZone(date, "America/Chicago");
    expect(hours).toBe(12);
    expect(minutes).toBe(0);
  });

  it("returns correct minutes", () => {
    // 2026-01-15 18:45 UTC → 2026-01-15 12:45 CST
    const date = new Date("2026-01-15T18:45:00Z");
    const { hours, minutes } = getLocalTimeInZone(date, "America/Chicago");
    expect(hours).toBe(12);
    expect(minutes).toBe(45);
  });

  it("differs from date.getUTCHours() when timezone is not UTC", () => {
    const date = new Date("2026-01-15T18:00:00Z");
    const { hours } = getLocalTimeInZone(date, "America/Chicago");
    expect(hours).not.toBe(date.getUTCHours()); // 12 !== 18
  });

  it("falls back to UTC on an invalid timezone string", () => {
    const date = new Date("2026-01-15T18:00:00Z");
    const { hours, minutes } = getLocalTimeInZone(date, "Not/A/Valid/Timezone");
    expect(hours).toBe(date.getUTCHours());
    expect(minutes).toBe(date.getUTCMinutes());
  });

  it("normalises hour value 24 to 0 (engine-quirk branch)", () => {
    // Some JS engines return '24' instead of '0' for midnight. This mocks that
    // behaviour to cover the `if (hours === 24) hours = 0` guard branch.
    vi.spyOn(Intl.DateTimeFormat.prototype, "formatToParts").mockReturnValueOnce([
      { type: "hour", value: "24" },
      { type: "minute", value: "00" },
    ]);
    const { hours } = getLocalTimeInZone(new Date("2026-03-20T00:00:00Z"), "UTC");
    expect(hours).toBe(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});

describe("computeSolarElevationDeg", () => {
  // Equator, prime meridian, near-equinox (March 20, 2026)
  // Declination ≈ 0°, so elevation at solar noon ≈ 90°

  it("returns near 90° at UTC solar noon at equator on equinox (lat=0, lon=0)", () => {
    const date = new Date("2026-03-20T12:00:00Z");
    const elev = computeSolarElevationDeg(0, 0, date);
    expect(elev).toBeGreaterThan(85);
  });

  it("returns near -90° at UTC midnight at equator on equinox (lat=0, lon=0)", () => {
    const date = new Date("2026-03-20T00:00:00Z");
    const elev = computeSolarElevationDeg(0, 0, date);
    expect(elev).toBeLessThan(-85);
  });

  it("returns near 0° at UTC 06:00 at equator on equinox (sunrise)", () => {
    const date = new Date("2026-03-20T06:00:00Z");
    const elev = computeSolarElevationDeg(0, 0, date);
    expect(Math.abs(elev)).toBeLessThan(2);
  });

  it("returns near 0° at UTC 18:00 at equator on equinox (sunset)", () => {
    const date = new Date("2026-03-20T18:00:00Z");
    const elev = computeSolarElevationDeg(0, 0, date);
    expect(Math.abs(elev)).toBeLessThan(2);
  });

  it("returns positive elevation during daytime at mid-latitude location", () => {
    // Dallas, TX: lat=32.8, lon=-96.8 at local solar noon (~18:27 UTC in winter)
    const date = new Date("2026-01-15T18:27:00Z");
    const elev = computeSolarElevationDeg(32.8, -96.8, date);
    expect(elev).toBeGreaterThan(30);
  });

  it("returns negative elevation at local midnight", () => {
    // Local midnight at lon=0: UTC midnight
    const date = new Date("2026-03-20T00:00:00Z");
    const elev = computeSolarElevationDeg(51.5, 0, date); // London
    expect(elev).toBeLessThan(-15);
  });

  it("returns a value in the range [-90, 90]", () => {
    for (let h = 0; h < 24; h++) {
      const date = new Date(`2026-03-20T${String(h).padStart(2, "0")}:00:00Z`);
      const elev = computeSolarElevationDeg(45, 90, date);
      expect(elev).toBeGreaterThanOrEqual(-90);
      expect(elev).toBeLessThanOrEqual(90);
    }
  });
});

describe("getSkyMode", () => {
  it("returns Day for elevation >= 0", () => {
    expect(getSkyMode(0)).toBe("Day");
    expect(getSkyMode(45)).toBe("Day");
  });

  it("returns Civil Twilight for -6 to 0 (exclusive)", () => {
    expect(getSkyMode(-1)).toBe("Civil Twilight");
    expect(getSkyMode(-5.9)).toBe("Civil Twilight");
  });

  it("returns Nautical Twilight for -12 (inclusive) to just below -6", () => {
    // -6 is the upper boundary of Civil Twilight (≥ -6 → Civil), so -6.001 → Nautical
    expect(getSkyMode(-6.001)).toBe("Nautical Twilight");
    expect(getSkyMode(-11.9)).toBe("Nautical Twilight");
    // -12 is the upper boundary of Nautical (≥ -12 → Nautical)
    expect(getSkyMode(-12)).toBe("Nautical Twilight");
  });

  it("returns Astronomical Twilight for -18 (inclusive) to just below -12", () => {
    expect(getSkyMode(-12.001)).toBe("Astronomical Twilight");
    expect(getSkyMode(-17.9)).toBe("Astronomical Twilight");
    // -18 is the upper boundary of Astronomical (≥ -18 → Astronomical)
    expect(getSkyMode(-18)).toBe("Astronomical Twilight");
  });

  it("returns Night for elevation strictly below -18", () => {
    expect(getSkyMode(-18.001)).toBe("Night");
    expect(getSkyMode(-90)).toBe("Night");
  });
});

describe("computeNextTransitionTime", () => {
  it("returns a Date and toMode string when starting in full night at equator (equinox)", () => {
    // Equator, lon=0, UTC midnight → full night → next transition is Astronomical Twilight start
    const date = new Date("2026-03-20T00:00:00Z");
    const result = computeNextTransitionTime(0, 0, date);
    expect(result).not.toBeNull();
    expect(result.time).toBeInstanceOf(Date);
    expect(typeof result.toMode).toBe("string");
    expect(result.toMode).toBe("Astronomical Twilight");
  });

  it("returned transition time is within the next 24 hours", () => {
    const date = new Date("2026-03-20T00:00:00Z");
    const result = computeNextTransitionTime(0, 0, date);
    expect(result).not.toBeNull();
    expect(result.time.getTime()).toBeGreaterThan(date.getTime());
    expect(result.time.getTime()).toBeLessThan(date.getTime() + 24 * 60 * 60 * 1000);
  });

  it("transition time has sub-minute precision (refined beyond 1-minute bracket)", () => {
    const date = new Date("2026-03-20T00:00:00Z");
    const result = computeNextTransitionTime(0, 0, date);
    expect(result).not.toBeNull();
    // If only minute-level precision, seconds would always be 0; binary search gives < 60s error
    // Just verify the time is a valid timestamp (not exactly on the minute)
    // We verify the time is refined by checking elevation is near threshold
    const elevAtTransition = computeSolarElevationDeg(0, 0, result.time);
    // The transition is to Astronomical Twilight (boundary at -18°)
    expect(Math.abs(elevAtTransition + 18)).toBeLessThan(0.05);
  });

  it("returns null for polar day scenario (lat=89.9 on summer solstice)", () => {
    // North Pole in summer — Sun never sets, no mode change in 24h
    const date = new Date("2026-06-21T00:00:00Z");
    const result = computeNextTransitionTime(89.9, 0, date);
    expect(result).toBeNull();
  });

  it("finds Day transition when starting in Civil Twilight", () => {
    // Equator on equinox near sunrise: start at ~05:57 UTC (civil twilight, -6° < elev < 0°)
    // Elevation at 05:45 UTC (equator, lon=0, equinox) ≈ -3.75°
    const date = new Date("2026-03-20T05:45:00Z");
    const result = computeNextTransitionTime(0, 0, date);
    expect(result).not.toBeNull();
    expect(result.toMode).toBe("Day");
  });
});

describe("getLocalHourInstant", () => {
  const CHICAGO = "America/Chicago";

  it("finds 22:00 on the local calendar day containing the given instant", () => {
    // 2026-08-21 15:00 UTC is 10:00 CDT the same day; 22:00 CDT is 03:00 UTC on the 22nd.
    const result = getLocalHourInstant(new Date("2026-08-21T15:00:00Z"), CHICAGO, 22);
    expect(result.toISOString()).toBe("2026-08-22T03:00:00.000Z");
  });

  it("stays on the local day even when UTC has already rolled over", () => {
    // 2026-08-22 02:00 UTC is still 21:00 CDT on the 21st, so 22:00 is an hour away.
    const result = getLocalHourInstant(new Date("2026-08-22T02:00:00Z"), CHICAGO, 22);
    expect(result.toISOString()).toBe("2026-08-22T03:00:00.000Z");
  });

  it("rolls to the next local day once local midnight passes", () => {
    // 2026-08-22 05:30 UTC is 00:30 CDT on the 22nd — the reference jumps a day forward.
    const result = getLocalHourInstant(new Date("2026-08-22T05:30:00Z"), CHICAGO, 22);
    expect(result.toISOString()).toBe("2026-08-23T03:00:00.000Z");
  });

  // Two passes over the zone offset exist for exactly these days: the offset at the instant
  // we are asking *from* is not always the offset at the instant we are asking *for*.
  it("uses the daylight offset in force at the target hour, not at the query time", () => {
    // 2026-03-08 is the US spring-forward. At 08:00 UTC the zone is still CST (UTC-6),
    // but by 22:00 local it is CDT (UTC-5), so the answer is 03:00 UTC not 04:00.
    const result = getLocalHourInstant(new Date("2026-03-08T08:00:00Z"), CHICAGO, 22);
    expect(result.toISOString()).toBe("2026-03-09T03:00:00.000Z");
  });

  it("uses the standard offset after the autumn transition", () => {
    // 2026-11-01 is the US fall-back: 22:00 CST (UTC-6) is 04:00 UTC on the 2nd.
    const result = getLocalHourInstant(new Date("2026-11-01T18:00:00Z"), CHICAGO, 22);
    expect(result.toISOString()).toBe("2026-11-02T04:00:00.000Z");
  });

  it("falls back to UTC for an unknown timezone", () => {
    const result = getLocalHourInstant(new Date("2026-08-21T15:00:00Z"), "Not/AZone", 22);
    expect(result.toISOString()).toBe("2026-08-21T22:00:00.000Z");
  });

  it("normalises hour value 24 to 0 (engine-quirk branch)", () => {
    // Same engine quirk getLocalTimeInZone guards against: some engines report midnight as
    // '24'. Left unnormalised it would roll the offset a day out.
    // Only the first offset pass is mocked; the second reads the real UTC formatter, so the
    // assertion still exercises the two-pass path rather than the quirk twice over.
    vi.spyOn(Intl.DateTimeFormat.prototype, "formatToParts").mockReturnValueOnce([
      { type: "year", value: "2026" },
      { type: "month", value: "08" },
      { type: "day", value: "21" },
      { type: "hour", value: "24" },
      { type: "minute", value: "00" },
      { type: "second", value: "00" },
    ]);
    const result = getLocalHourInstant(new Date("2026-08-21T00:00:00Z"), "UTC", 22);
    expect(result.toISOString()).toBe("2026-08-21T22:00:00.000Z");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("handles the fixed-offset zones a location override produces", () => {
    // Etc/GMT+6 is UTC-6 (POSIX sign inversion) — what offsetZoneFromLongitude yields.
    const result = getLocalHourInstant(new Date("2026-08-21T15:00:00Z"), "Etc/GMT+6", 22);
    expect(result.toISOString()).toBe("2026-08-22T04:00:00.000Z");
  });
});
