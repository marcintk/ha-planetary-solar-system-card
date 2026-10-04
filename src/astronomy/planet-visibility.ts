import type { CometPosition, Planet } from "../types.js";
import { greenwichSiderealDeg } from "./moon-position.js";
import { calculatePlanetOrbit } from "./orbital-mechanics.js";
import { EARTH, PLANETS } from "./planet-data.js";
import { ASTRONOMICAL_NIGHT_DEG, computeSolarElevationDeg } from "./solar-position.js";

const DEG = Math.PI / 180;
const OBLIQUITY_RAD = 23.439291 * DEG;
const MIN_ALTITUDE_DEG = 10;
const STEP_MS = 15 * 60000;
const MAX_STEPS = (36 * 60) / 15;

/**
 * A planet's geometric altitude in degrees (no refraction), from its geocentric position in the
 * ecliptic plane (planet minus Earth) rotated by the obliquity into RA/Dec.
 */
function planetAltitudeDeg(
  planet: Planet,
  earth: CometPosition,
  lat: number,
  lon: number,
  date: Date
): number {
  const p = calculatePlanetOrbit(planet, date);
  const x = p.radius * Math.cos(p.angle) - earth.radius * Math.cos(earth.angle);
  const y = p.radius * Math.sin(p.angle) - earth.radius * Math.sin(earth.angle);

  const yEq = y * Math.cos(OBLIQUITY_RAD);
  const zEq = y * Math.sin(OBLIQUITY_RAD);
  const raDeg = Math.atan2(yEq, x) / DEG;
  const decRad = Math.atan2(zEq, Math.hypot(x, yEq));

  const hourAngleRad = (greenwichSiderealDeg(date) + lon - raDeg) * DEG;
  const latRad = lat * DEG;
  const sinAlt =
    Math.sin(latRad) * Math.sin(decRad) +
    Math.cos(latRad) * Math.cos(decRad) * Math.cos(hourAngleRad);
  return Math.asin(Math.max(-1, Math.min(1, sinAlt))) / DEG;
}

function isNight(lat: number, lon: number, ms: number): boolean {
  return computeSolarElevationDeg(lat, lon, new Date(ms)) < ASTRONOMICAL_NIGHT_DEG;
}

/**
 * Instants of the astronomical night that contains `date`, or of the next one when it is not dark
 * yet: the whole night, from dusk to dawn, so a late-night view still counts planets that set
 * earlier. Empty when there is no night in the scanned span.
 */
function nightSamples(lat: number, lon: number, date: Date): Date[] {
  const start = date.getTime();
  const samples: Date[] = [];
  // Already dark: walk back to dusk first, so the whole night is covered.
  if (isNight(lat, lon, start)) {
    for (let i = 1; i <= MAX_STEPS && isNight(lat, lon, start - i * STEP_MS); i++) {
      samples.push(new Date(start - i * STEP_MS));
    }
    samples.reverse();
  }
  for (let i = 0; i <= MAX_STEPS; i++) {
    const t = new Date(start + i * STEP_MS);
    if (isNight(lat, lon, t.getTime())) samples.push(t);
    else if (samples.length > 0) break;
  }
  return samples;
}

/** Refines the end of night by bisecting between the last night sample and the next step. */
function nightEnd(lat: number, lon: number, lastNight: Date): Date {
  let lo = lastNight.getTime();
  let hi = lo + STEP_MS;
  for (let i = 0; i < 10; i++) {
    const mid = (lo + hi) / 2;
    if (isNight(lat, lon, mid)) lo = mid;
    else hi = mid;
  }
  return new Date(lo);
}

/**
 * Names of the planets (never Earth) that rise above 10 degrees at some point during the coming
 * astronomical night, plus the span of instants the result covers: from the start of that night
 * (or `date` when it is not dark yet) until its end (or the end of the scanned span when there is no
 * night in it). Geometric and approximate: the planet model is 2D, so ecliptic latitude is ignored.
 */
export function getTonightsPlanets(
  lat: number,
  lon: number,
  date: Date
): { planets: string[]; validFrom: Date; validUntil: Date } {
  const samples = nightSamples(lat, lon, date);
  const earthAt = samples.map((t) => calculatePlanetOrbit(EARTH, t));
  const planets = PLANETS.filter(
    (planet) =>
      planet !== EARTH &&
      samples.some((t, i) => planetAltitudeDeg(planet, earthAt[i], lat, lon, t) > MIN_ALTITUDE_DEG)
  ).map((planet) => planet.name);
  const validUntil =
    samples.length > 0
      ? nightEnd(lat, lon, samples[samples.length - 1])
      : new Date(date.getTime() + MAX_STEPS * STEP_MS);
  const validFrom = samples.length > 0 && samples[0].getTime() < date.getTime() ? samples[0] : date;
  return { planets, validFrom, validUntil };
}
