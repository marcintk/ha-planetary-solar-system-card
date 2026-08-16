import type { Comet, CometPosition, Planet } from "../types.js";
import { MOON } from "./planet-data.js";

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
 * Calculate the Moon's angular position relative to Earth for a given date.
 * Returns absolute angle (not relative to Earth).
 */
export function calculateMoonPosition(date: Date): number {
  const days = daysSinceJ2000(date);
  const meanMotion = (2 * Math.PI) / MOON.periodDays;
  const angle = degreesToRadians(MOON.meanLongitudeJ2000) + meanMotion * days;
  return ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
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
