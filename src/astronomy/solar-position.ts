/**
 * Extract local hours and minutes for a Date in a given IANA timezone string.
 * Falls back to UTC if the timezone is invalid or unrecognised.
 * @param {Date} date
 * @param {string} timezone - IANA timezone string (e.g. "America/Chicago")
 * @returns {{ hours: number, minutes: number }}
 */
import type { NextTransition } from "../types.js";

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

const OBLIQUITY_DEG = 23.45;
const OBLIQUITY_RAD = (OBLIQUITY_DEG * Math.PI) / 180;

/**
 * Day-of-year and local solar hour angle shared by computeSolarElevationDeg and
 * computeZenithAngleFromSun. localSolarHour uses UTC + longitude offset (1 hour per
 * 15° longitude), independent of civil timezone — true solar time.
 */
function computeSolarTimeParams(
  lon: number,
  date: Date
): { dayOfYear: number; hourAngleRad: number } {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - startOfYear) / 86400000);

  const utcHour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const localSolarHour = (((utcHour + lon / 15) % 24) + 24) % 24;
  const hourAngleRad = ((localSolarHour - 12) * 15 * Math.PI) / 180;

  return { dayOfYear, hourAngleRad };
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
  const { dayOfYear, hourAngleRad } = computeSolarTimeParams(lon, date);

  // Solar declination in radians
  const declRad =
    (-OBLIQUITY_DEG * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10)) * Math.PI) / 180;

  const latRad = (lat * Math.PI) / 180;
  const sinAlt =
    Math.sin(latRad) * Math.sin(declRad) +
    Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourAngleRad);

  return (Math.asin(Math.max(-1, Math.min(1, sinAlt))) * 180) / Math.PI;
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
  const { dayOfYear, hourAngleRad } = computeSolarTimeParams(lon, date);

  // Ecliptic longitude of the Sun, calendar-approximate, phase-matched to the declination
  // formula above (theta=0 -> winter solstice, theta=π -> summer solstice).
  const theta = ((2 * Math.PI) / 365) * (dayOfYear + 10);
  const lambdaSun = theta - Math.PI / 2;
  const raSun = Math.atan2(Math.cos(OBLIQUITY_RAD) * Math.sin(lambdaSun), Math.cos(lambdaSun));

  const latRad = (lat * Math.PI) / 180;

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
 * Classify a solar elevation angle into a sky mode string.
 * @param {number} elevDeg
 * @returns {string}
 */
export function getSkyMode(elevDeg: number): string {
  if (elevDeg >= 0) return "Day";
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
