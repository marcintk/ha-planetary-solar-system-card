import { MOON } from "./planet-data.js";

// J2000 epoch: January 1, 2000 12:00 TT
const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);

function daysSinceJ2000(date) {
  return (date.getTime() - J2000) / 86400000;
}

function degreesToRadians(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Calculate a planet's angular position (radians) for a given date.
 * Uses simplified circular orbit model.
 */
export function calculatePlanetPosition(planet, date) {
  const days = daysSinceJ2000(date);
  const meanMotion = (2 * Math.PI) / planet.periodDays;
  const angle = degreesToRadians(planet.meanLongitudeJ2000) + meanMotion * days;
  // Normalize to [0, 2π)
  return ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
}

/**
 * Calculate the Moon's angular position relative to Earth for a given date.
 * Returns absolute angle (not relative to Earth).
 */
export function calculateMoonPosition(date) {
  const days = daysSinceJ2000(date);
  const meanMotion = (2 * Math.PI) / MOON.periodDays;
  const angle = degreesToRadians(MOON.meanLongitudeJ2000) + meanMotion * days;
  return ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
}

/**
 * Solve Kepler's equation M = E - e*sin(E) for eccentric anomaly E.
 * Uses Newton-Raphson iteration.
 */
export function solveKeplerEquation(M, e) {
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
 * Returns { angle (radians), radius (AU) }.
 */
export function calculateCometPosition(comet, date) {
  const days = daysSinceJ2000(date);

  // Mean anomaly at date
  const meanMotion = (2 * Math.PI) / comet.periodDays;
  const M0 = degreesToRadians(comet.meanAnomalyJ2000);
  let M = M0 + meanMotion * days;
  M = ((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  // Solve Kepler's equation for eccentric anomaly
  const E = solveKeplerEquation(M, comet.eccentricity);

  // True anomaly from eccentric anomaly
  const e = comet.eccentricity;
  const trueAnomaly =
    2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));

  // Radius from the focus (Sun)
  const radius = comet.semiMajorAxis * (1 - e * Math.cos(E));

  // Angle in the orbital plane (true anomaly + longitude of perihelion)
  const angle = trueAnomaly + degreesToRadians(comet.longitudeOfPerihelion);
  const normalizedAngle = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  return { angle: normalizedAngle, radius };
}
