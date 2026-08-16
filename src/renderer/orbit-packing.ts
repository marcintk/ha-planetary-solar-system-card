import { MOON, MOON_PIXEL_OFFSET } from "../astronomy/planet-data.js";
import type { CometVisualEllipse, Planet } from "../types.js";
import { SATURN_RING_OUTER_RADIUS } from "./bodies.js";
import { auToRadius } from "./svg-utils.js";

// ponytail: fixed heuristic margin, revisit if a future body needs a wider gap.
const MIN_GAP = 8;

function effectiveSize(planet: Planet): number {
  if (planet.name === "Saturn") return SATURN_RING_OUTER_RADIUS;
  // Earth's spacing bubble must fit the Moon's full orbit, or the Moon's
  // circle gets clipped by whichever neighbor orbit is nearby (#62).
  if (planet.name === "Earth") return planet.size + MOON_PIXEL_OFFSET + MOON.size;
  return planet.size;
}

/**
 * Log-scale AU->px radii (auToRadius) pack tightly enough that adjacent
 * orbits can visually touch at conjunction (e.g. Jupiter/Saturn, #62).
 * Sweep outward from the Sun, pushing each planet's radius out just enough
 * to keep a minimum gap from its inward neighbor.
 */
export function packOrbitRadii(planets: readonly Planet[]): number[] {
  const radii: number[] = [];
  let prevRadius = Number.NEGATIVE_INFINITY;
  let prevSize = 0;

  for (const planet of planets) {
    const natural = auToRadius(planet.au);
    const size = effectiveSize(planet);
    const minAllowed = prevRadius + prevSize + size + MIN_GAP;
    const radius = Math.max(natural, minAllowed);
    radii.push(radius);
    prevRadius = radius;
    prevSize = size;
  }

  return radii;
}

/**
 * Compute a planet's visual orbit ellipse in pixel space, given the packed
 * radius offset (packedRadius - auToRadius(planet.au)) that packOrbitRadii
 * applied to keep it clear of its neighbors. The offset is added uniformly
 * to perihelion/aphelion so the drawn ellipse and the packed circular radii
 * agree at the semi-major axis, and the marker (positioned from the same
 * ellipse) never drifts off the drawn ring.
 */
export function computePlanetVisualEllipse(
  planet: Planet,
  packedOffset: number
): CometVisualEllipse {
  const { au, eccentricity: e } = planet;
  const perihelionPx = auToRadius(au * (1 - e)) + packedOffset;
  const aphelionPx = auToRadius(au * (1 + e)) + packedOffset;

  const aPx = (perihelionPx + aphelionPx) / 2;
  const cPx = (aphelionPx - perihelionPx) / 2;
  const bPx = Math.sqrt(aPx * aPx - cPx * cPx);
  const ePx = cPx / aPx;
  return { aPx, bPx, cPx, ePx, rotationDeg: planet.longitudeOfPerihelion };
}
