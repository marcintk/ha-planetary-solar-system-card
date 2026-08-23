import type { Comet, CometPosition, Planet } from "../types.js";
import { getMoonEquatorial } from "./moon-position.js";

// J2000 epoch: January 1, 2000 12:00 TT
const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);

function daysSinceJ2000(date: Date): number {
  return (date.getTime() - J2000) / 86400000;
}

function degreesToRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Solve a Keplerian elliptical orbit for a given date.
 * meanAnomalyJ2000Deg is the mean anomaly (not mean longitude) at J2000.
 */
function solveEllipticalOrbit(
  meanAnomalyJ2000Deg: number,
  periodDays: number,
  eccentricity: number,
  semiMajorAxis: number,
  longitudeOfPerihelionDeg: number,
  date: Date
): CometPosition {
  const days = daysSinceJ2000(date);
  const meanMotion = (2 * Math.PI) / periodDays;
  const M0 = degreesToRadians(meanAnomalyJ2000Deg);
  let M = M0 + meanMotion * days;
  M = ((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  const E = solveKeplerEquation(M, eccentricity);
  const e = eccentricity;
  const trueAnomaly =
    2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const radius = semiMajorAxis * (1 - e * Math.cos(E));
  const angle = trueAnomaly + degreesToRadians(longitudeOfPerihelionDeg);
  const normalizedAngle = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  return { angle: normalizedAngle, radius, trueAnomaly };
}

/**
 * Calculate a planet's full orbital state (angle, radius in AU, true anomaly)
 * for a given date, using a Keplerian elliptical orbit model.
 */
export function calculatePlanetOrbit(planet: Planet, date: Date): CometPosition {
  // meanLongitudeJ2000 is longitude (measured from a fixed reference
  // direction), not anomaly (measured from perihelion) — convert.
  const meanAnomalyJ2000 = planet.meanLongitudeJ2000 - planet.longitudeOfPerihelion;
  return solveEllipticalOrbit(
    meanAnomalyJ2000,
    planet.periodDays,
    planet.eccentricity,
    planet.au,
    planet.longitudeOfPerihelion,
    date
  );
}

/**
 * Calculate a planet's angular position (radians) for a given date.
 * Uses a Keplerian elliptical orbit model.
 */
export function calculatePlanetPosition(planet: Planet, date: Date): number {
  return calculatePlanetOrbit(planet, date).angle;
}

/**
 * The Moon's geocentric ecliptic longitude for a given date, radians in [0, 2π) — an absolute
 * angle in the same frame as `calculatePlanetPosition`, not one relative to Earth.
 *
 * Borrowed from moon-position.ts rather than modelled here. The uniform circular version this
 * replaced (218.32° + 2π/27.32 d) ran 13° off by 2026: ~8.7° of periodic terms it had no rows
 * for (equation of centre 6.29°, evection 1.27°, variation 0.66°) plus ~7.8° of drift, because
 * 27.32 is a truncation of 27.321661 and a 6e-5 rate error compounds. The card renders that
 * marker against a horizon line, so the error showed up as the Moon sitting on the wrong side
 * of it for ~80 minutes around every moonrise and moonset, disagreeing with the "No Moon Sky"
 * tile — which was already reading the accurate series (#166).
 */
export function calculateMoonPosition(date: Date): number {
  return degreesToRadians(getMoonEquatorial(date).eclipticLonDeg);
}

/**
 * Solve Kepler's equation M = E - e*sin(E) for eccentric anomaly E.
 * Uses Newton-Raphson iteration.
 */
export function solveKeplerEquation(M: number, e: number): number {
  let E = M;
  for (let i = 0; i < 10; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
  }
  return E;
}

/**
 * Calculate a comet's position (angle and radius) for a given date.
 * Uses full elliptical orbit model with Kepler's equation.
 * Returns { angle (radians), radius (AU), trueAnomaly (radians) }.
 */
export function calculateCometPosition(comet: Comet, date: Date): CometPosition {
  return solveEllipticalOrbit(
    comet.meanAnomalyJ2000,
    comet.periodDays,
    comet.eccentricity,
    comet.semiMajorAxis,
    comet.longitudeOfPerihelion,
    date
  );
}
