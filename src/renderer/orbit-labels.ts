import { PLANETS } from "../astronomy/planet-data.js";
import { verticalAxisIntersections } from "./bodies.js";
import { auToRadius, ellipseFromApsides, orbitTransformComponents } from "./svg-utils.js";

/**
 * Per-planet `{ minAU, maxAU }` for the two AU labels on its orbit ring, keyed
 * by `planet.name`.
 *
 * These values are static: they depend only on the planet data (`au`,
 * `eccentricity`, `longitudeOfPerihelion`) plus the fixed pixel-scale
 * constants, so they are computed once here at import. The pixel scale is used
 * only to shape the natural (un-packed) ellipse for the vertical-axis crossing
 * solve — never to produce the label number. The label number is the true
 * heliocentric distance `au * (1 - e·cos E)` at each crossing's eccentric
 * anomaly, so the orbit-packing push-out that shifts the drawn ring can no
 * longer leak into the printed AU (#239).
 */
export const ORBIT_LABEL_AU: Record<string, { minAU: number; maxAU: number }> = Object.fromEntries(
  PLANETS.map((planet) => {
    const { au, eccentricity: e, longitudeOfPerihelion } = planet;
    const { aPx, bPx, cPx } = ellipseFromApsides(
      auToRadius(au * (1 - e)),
      auToRadius(au * (1 + e))
    );
    // The crossing eccentric anomalies don't depend on the ±1 view
    // direction, so a fixed -1 is fine here.
    const components = orbitTransformComponents(cPx, longitudeOfPerihelion, -1);
    const [p1, p2] = verticalAxisIntersections(aPx, bPx, components);
    // `eccentricAnomaly` is the eccentric anomaly of the *log-scale pixel*
    // ellipse at the axis crossing, not the physical orbit's — `auToRadius` is
    // logarithmic, so the two differ slightly. At the data's largest
    // eccentricity (Mercury, e≈0.21) the gap is far below the 0.1-AU print
    // precision; larger orbits are near-circular and closer still.
    const d1 = au * (1 - e * Math.cos(p1.eccentricAnomaly));
    const d2 = au * (1 - e * Math.cos(p2.eccentricAnomaly));
    return [planet.name, { minAU: Math.min(d1, d2), maxAU: Math.max(d1, d2) }];
  })
);
