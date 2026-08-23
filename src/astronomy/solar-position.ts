/**
 * Extract local hours and minutes for a Date in a given IANA timezone string.
 * Falls back to UTC if the timezone is invalid or unrecognised.
 * @param {Date} date
 * @param {string} timezone - IANA timezone string (e.g. "America/Chicago")
 * @returns {{ hours: number, minutes: number }}
 */
import type { NextTransition } from "../types.js";
import { greenwichSiderealDeg } from "./moon-position.js";

export function getLocalTimeInZone(
  date: Date,
  timezone: string
): { hours: number; minutes: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const hourPart = parts.find((p) => p.type === "hour");
    const minutePart = parts.find((p) => p.type === "minute");
    let hours = Number(hourPart?.value);
    if (hours === 24) hours = 0; // some engines return 24 for midnight
    return { hours, minutes: Number(minutePart?.value) };
  } catch {
    return { hours: date.getUTCHours(), minutes: date.getUTCMinutes() };
  }
}

/**
 * How far a zone's wall clock runs ahead of UTC at one instant, in milliseconds.
 *
 * Reads the instant back through `Intl` and re-assembles the parts as if they were UTC — the
 * gap between that and the real instant *is* the offset. No timezone database ships in the
 * bundle, and none needs to: Intl already carries the whole thing.
 */
function zoneOffsetMs(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const hours = value("hour");
  return (
    Date.UTC(
      value("year"),
      value("month") - 1,
      value("day"),
      hours === 24 ? 0 : hours, // some engines return 24 for midnight
      value("minute"),
      value("second")
    ) - date.getTime()
  );
}

/**
 * The instant at which a zone's wall clock reads `hour:00` on the local calendar day that
 * `date` falls in. The inverse of getLocalTimeInZone, which reads a local hour *out* of an
 * instant.
 *
 * Everything a "tonight at 22:00" reference needs falls out of this one function: before the
 * hour it is in the future, between the hour and local midnight it is in the recent past, and
 * at local midnight the calendar day advances and it becomes tomorrow's. No hold window or
 * rollover rule has to be written separately.
 *
 * Two offset passes, not one. The zone offset in force when we ask is not always the offset
 * in force at the hour we are asking about — on a DST transition day they differ, and a
 * single pass lands an hour out.
 */
export function getLocalHourInstant(date: Date, timezone: string, hour: number): Date {
  try {
    const offsetNow = zoneOffsetMs(date, timezone);
    const localNow = new Date(date.getTime() + offsetNow);
    const wallClock = Date.UTC(
      localNow.getUTCFullYear(),
      localNow.getUTCMonth(),
      localNow.getUTCDate(),
      hour
    );
    const offsetThen = zoneOffsetMs(new Date(wallClock - offsetNow), timezone);
    return new Date(wallClock - offsetThen);
  } catch {
    const utc = new Date(date);
    utc.setUTCHours(hour, 0, 0, 0);
    return utc;
  }
}

const DEG = Math.PI / 180;

/**
 * The Sun's apparent position, Meeus *Astronomical Algorithms* ch. 25 ("low accuracy"), whose
 * stated bound is 0.01° in longitude — a hundredth of what this replaced.
 *
 * The model here used to be a circle: declination as `-23.45 * cos(2pi/365 * (doy + 10))`, and
 * mean solar time (`utcHour + lon / 15`) used directly as the hour angle. Both errors are the
 * same physical omission from two directions — Earth's orbit is an ellipse, so the Sun neither
 * moves along the ecliptic at a constant rate nor crosses the meridian at clock noon. The gap
 * between the two is the equation of time, ±16 minutes across the year, and dropping it put
 * sunset up to 11 minutes out.
 *
 * The equation of centre `C` below is what carries it: adding it to the mean longitude gives
 * the true longitude, and the difference it makes to right ascension *is* the equation of
 * time. Nothing here needs that number by name — taking the hour angle from real right
 * ascension against sidereal time absorbs it.
 */
function getSunPosition(date: Date): { eclipticLonDeg: number; raDeg: number; decDeg: number } {
  const T = (date.getTime() / 86400000 + 2440587.5 - 2451545) / 36525;

  const meanLongitude = 280.46646 + 36000.76983 * T;
  const meanAnomaly = (357.52911 + 35999.05029 * T) * DEG;
  const equationOfCentre =
    (1.914602 - 0.004817 * T) * Math.sin(meanAnomaly) +
    0.019993 * Math.sin(2 * meanAnomaly) +
    0.000289 * Math.sin(3 * meanAnomaly);

  const trueLongitude = (meanLongitude + equationOfCentre) * DEG;
  const obliquity = (23.439291 - 0.0130042 * T) * DEG;

  return {
    eclipticLonDeg: (((trueLongitude / DEG) % 360) + 360) % 360,
    raDeg: Math.atan2(Math.cos(obliquity) * Math.sin(trueLongitude), Math.cos(trueLongitude)) / DEG,
    decDeg: Math.asin(Math.sin(obliquity) * Math.sin(trueLongitude)) / DEG,
  };
}

/**
 * The Sun's local hour angle in degrees, plus the position it came from.
 *
 * Measured against sidereal time exactly the way `getMoonSkyAngles` measures the Moon's — the
 * two bodies now share one definition of "where is the observer pointing", instead of the Sun
 * having its own clock-based approximation of it.
 */
function solarHourAngle(lon: number, date: Date) {
  const sun = getSunPosition(date);
  return { sun, hourAngleRad: (greenwichSiderealDeg(date) + lon - sun.raDeg) * DEG };
}

/**
 * Compute the Sun's true altitude above the observer's horizon using spherical
 * astronomy. Returns degrees in [-90, 90].
 *
 * Formula:
 *   δ  = -23.45° × cos( 2π/365 × (dayOfYear + 10) )   ← solar declination
 *   H  = 15° × (localSolarHour - 12)                    ← hour angle
 *   sin(alt) = sin(lat)×sin(δ) + cos(lat)×cos(δ)×cos(H)
 *
 * @param {number} lat - observer latitude in degrees
 * @param {number} lon - observer longitude in degrees (positive east)
 * @param {Date} date
 * @returns {number} solar altitude in degrees
 */
export function computeSolarElevationDeg(lat: number, lon: number, date: Date): number {
  const { sun, hourAngleRad } = solarHourAngle(lon, date);

  const latRad = lat * DEG;
  const declRad = sun.decDeg * DEG;
  const sinAlt =
    Math.sin(latRad) * Math.sin(declRad) +
    Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourAngleRad);

  return Math.asin(Math.max(-1, Math.min(1, sinAlt))) / DEG;
}

/**
 * Compute the observer's true zenith direction, projected onto the ecliptic plane and
 * expressed as an angle relative to the Earth→Sun direction (0 = zenith points straight at
 * the Sun, ±π = zenith points straight away).
 *
 * This replaces the earlier approach of inverting the (idealized, tent-shaped) 2D elevation
 * formula and reattaching a sign borrowed from the approximate orbital model — that inversion
 * is two-valued whenever true elevation at 2D-midnight isn't exactly -90°, which is almost
 * always, producing a real jump every night (#78).
 *
 * Instead this builds the observer's zenith as a 3D unit vector in an equatorial frame whose
 * X-axis is defined as the sun's current meridian (so the existing hour-angle is directly
 * usable, no separate sidereal-time calculation needed), rotates it into ecliptic coordinates
 * via the standard obliquity rotation, and reads off the angle of its ecliptic-plane
 * projection relative to the (known, calendar-approximate) ecliptic longitude of the Sun.
 * Because both the magnitude (elevation) and direction (this angle) now come from the same
 * self-consistent physical model, they agree exactly at the noon/midnight boundaries instead
 * of disagreeing there — eliminating the structural discontinuity.
 *
 * ponytail: near the Arctic/Antarctic Circle, right at the moment the sun grazes the horizon
 * at solstice, the projected zenith vector's in-plane component shrinks toward zero and the
 * angle becomes geometrically ill-defined (like a compass at the magnetic pole) — a brief,
 * rare visual glitch there, not a daily one. Add hysteresis (carry the previous frame's angle)
 * if this specific case ever needs smoothing.
 *
 * @param {number} lat - observer latitude in degrees
 * @param {number} lon - observer longitude in degrees (positive east)
 * @param {Date} date
 * @returns {number} angle in radians, (-π, π], relative to the Earth→Sun direction
 */
export function computeZenithAngleFromSun(lat: number, lon: number, date: Date): number {
  const { sun, hourAngleRad } = solarHourAngle(lon, date);
  const lambdaSun = sun.eclipticLonDeg * DEG;
  const raSun = sun.raDeg * DEG;
  const OBLIQUITY_RAD = 23.439291 * DEG;

  const latRad = lat * DEG;

  // Zenith in an equatorial frame whose X-axis points at the Sun's current meridian.
  const zxCustom = Math.cos(latRad) * Math.cos(hourAngleRad);
  const zyCustom = Math.cos(latRad) * Math.sin(hourAngleRad);
  const zzCustom = Math.sin(latRad);

  // Rotate into the standard equatorial frame (X-axis at the vernal equinox).
  const zxStd = zxCustom * Math.cos(raSun) - zyCustom * Math.sin(raSun);
  const zyStd = zxCustom * Math.sin(raSun) + zyCustom * Math.cos(raSun);

  // Rotate into the ecliptic frame (obliquity rotation about the shared X-axis).
  const zxEcl = zxStd;
  const zyEcl = zyStd * Math.cos(OBLIQUITY_RAD) + zzCustom * Math.sin(OBLIQUITY_RAD);

  const zenithEclipticLon = Math.atan2(zyEcl, zxEcl);
  return Math.atan2(
    Math.sin(zenithEclipticLon - lambdaSun),
    Math.cos(zenithEclipticLon - lambdaSun)
  );
}

/**
 * The Sun's centre altitude at the moment an almanac calls it sunset: refraction lifts the disc
 * 34' before it is geometrically there, and the upper limb clears the horizon a further 16' —
 * the Sun's own radius — ahead of its centre.
 *
 * Day ends here rather than at a flat 0°, because 0° is not an event anyone can see: the Sun's
 * centre reaching the geometric horizon leaves the whole disc still plainly above it. Every
 * published twilight table starts civil twilight at sunset, which is this angle.
 *
 * Only the Day edge is refracted. The -6/-12/-18 boundaries below are defined on the Sun's
 * centre with no correction, so the interval an almanac prints is asymmetric by construction —
 * a refracted start and a geometric end. That is the convention, not an inconsistency here.
 */
export const SUNSET_ELEVATION_DEG = -0.8333;

/**
 * Classify a solar elevation angle into a sky mode string.
 * @param {number} elevDeg
 * @returns {string}
 */
export function getSkyMode(elevDeg: number): string {
  if (elevDeg >= SUNSET_ELEVATION_DEG) return "Day";
  if (elevDeg >= -6) return "Civil Twilight";
  if (elevDeg >= -12) return "Nautical Twilight";
  if (elevDeg >= -18) return "Astronomical Twilight";
  return "Night";
}

/**
 * Find the next sky-mode boundary crossing after `date`.
 * Uses a minute-by-minute forward scan (up to 24 hours) followed by
 * binary-search refinement within the detected bracket.
 *
 * @param {number} lat - observer latitude in degrees
 * @param {number} lon - observer longitude in degrees
 * @param {Date} date - start time
 * @returns {{ time: Date, toMode: string } | null}
 */
export function computeNextTransitionTime(
  lat: number,
  lon: number,
  date: Date
): NextTransition | null {
  const MS_PER_MIN = 60000;
  const MAX_MINS = 24 * 60;

  const startElev = computeSolarElevationDeg(lat, lon, date);
  const currentMode = getSkyMode(startElev);

  let bracketLoMs: number | null = null;
  let bracketHiMs: number | null = null;
  let toMode: string | null = null;

  // Minute-by-minute scan
  for (let m = 1; m <= MAX_MINS; m++) {
    const t = date.getTime() + m * MS_PER_MIN;
    const elev = computeSolarElevationDeg(lat, lon, new Date(t));
    const mode = getSkyMode(elev);
    if (mode !== currentMode) {
      bracketLoMs = t - MS_PER_MIN;
      bracketHiMs = t;
      toMode = mode;
      break;
    }
  }

  if (bracketLoMs === null || bracketHiMs === null || toMode === null) return null;

  // Binary-search refinement within the bracket
  for (let i = 0; i < 10; i++) {
    const midMs = Math.floor((bracketLoMs + bracketHiMs) / 2);
    const midMode = getSkyMode(computeSolarElevationDeg(lat, lon, new Date(midMs)));
    if (midMode === currentMode) {
      bracketLoMs = midMs;
    } else {
      bracketHiMs = midMs;
    }
  }

  return { time: new Date(bracketHiMs), toMode };
}
