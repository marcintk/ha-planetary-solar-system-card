/**
 * Extract local hours and minutes for a Date in a given IANA timezone string.
 * Falls back to UTC if the timezone is invalid or unrecognised.
 * @param {Date} date
 * @param {string} timezone - IANA timezone string (e.g. "America/Chicago")
 * @returns {{ hours: number, minutes: number }}
 */
export function getLocalTimeInZone(date, timezone) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const hourPart = parts.find((p) => p.type === "hour");
    const minutePart = parts.find((p) => p.type === "minute");
    let hours = Number(hourPart.value);
    if (hours === 24) hours = 0; // some engines return 24 for midnight
    return { hours, minutes: Number(minutePart.value) };
  } catch {
    return { hours: date.getUTCHours(), minutes: date.getUTCMinutes() };
  }
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
 * localSolarHour uses UTC + longitude offset (1 hour per 15° longitude),
 * which is independent of civil timezone and gives true solar time.
 *
 * @param {number} lat - observer latitude in degrees
 * @param {number} lon - observer longitude in degrees (positive east)
 * @param {Date} date
 * @returns {number} solar altitude in degrees
 */
export function computeSolarElevationDeg(lat, lon, date) {
  // Day of year (1 = Jan 1)
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - startOfYear) / 86400000);

  // Solar declination in radians
  const declRad = (-23.45 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10)) * Math.PI) / 180;

  // Local solar hour: UTC fractional hours + longitude offset (15°/hr)
  const utcHour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const localSolarHour = (((utcHour + lon / 15) % 24) + 24) % 24;

  // Hour angle in radians (positive in afternoon)
  const hourAngleRad = ((localSolarHour - 12) * 15 * Math.PI) / 180;

  const latRad = (lat * Math.PI) / 180;
  const sinAlt =
    Math.sin(latRad) * Math.sin(declRad) +
    Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourAngleRad);

  return (Math.asin(Math.max(-1, Math.min(1, sinAlt))) * 180) / Math.PI;
}

/**
 * Classify a solar elevation angle into a sky mode string.
 * @param {number} elevDeg
 * @returns {string}
 */
export function getSkyMode(elevDeg) {
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
export function computeNextTransitionTime(lat, lon, date) {
  const MS_PER_MIN = 60000;
  const MAX_MINS = 24 * 60;

  const startElev = computeSolarElevationDeg(lat, lon, date);
  const currentMode = getSkyMode(startElev);

  let bracketLoMs = null;
  let bracketHiMs = null;
  let toMode = null;

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

  if (bracketLoMs === null) return null;

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
