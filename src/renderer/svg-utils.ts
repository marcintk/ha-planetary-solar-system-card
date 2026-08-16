import { PLANETS } from "../astronomy/planet-data.js";

export const SVG_NS = "http://www.w3.org/2000/svg";
export const DEFAULT_LABEL_COLOR = "currentColor";
export const VIEW_SIZE = 800;
export const CENTER = VIEW_SIZE / 2;
export const MIN_RADIUS = 40;
export const MAX_RADIUS = 360;

export const BODY_LABEL_ATTRS: Record<string, string | number> = {
  "font-size": "11",
  "font-family": "sans-serif",
  "text-anchor": "middle",
};

// Log-scale orbit radii so inner planets aren't squished.
// Maps AU → pixel radius from center, leaving margin for labels.
const _logMinAU = Math.log(PLANETS[0].au);
const _logMaxAU = Math.log(PLANETS[PLANETS.length - 1].au);

export function auToRadius(au: number): number {
  const t = (Math.log(au) - _logMinAU) / (_logMaxAU - _logMinAU);
  return MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);
}

/** Inverse of auToRadius: pixel distance from the Sun -> AU. */
export function radiusFromAU(radius: number): number {
  const t = (radius - MIN_RADIUS) / (MAX_RADIUS - MIN_RADIUS);
  return Math.exp(_logMinAU + t * (_logMaxAU - _logMinAU));
}

export interface OrbitTransformComponents {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

/**
 * The 2x2-plus-translation SVG matrix components for an orbit ellipse
 * (rx=aPx, ry=bPx, drawn at cx=0, cy=0) so the Sun sits at one focus and the
 * ring exactly matches the marker's polar-from-focus formula: x = C + r·cosθ,
 * y = C + eclipticViewDirection·r·sinθ. That formula is a *reflection*
 * whenever eclipticViewDirection = -1 (determinant -1), not a rotation — a
 * plain rotate()/translate() (determinant +1) only agrees with it at
 * perihelion and aphelion, leaving the marker visibly off the drawn ring
 * everywhere else (#94). This is derived directly from that same formula so
 * the two can never disagree. Exposed as components (not just the `matrix()`
 * string) so other geometry — e.g. AU-label placement — can be computed from
 * the exact same transform instead of a separate approximation.
 */
export function orbitTransformComponents(
  cPx: number,
  rotationDeg: number,
  eclipticViewDirection: number
): OrbitTransformComponents {
  const rotation = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    a: cos,
    b: eclipticViewDirection * sin,
    c: -sin,
    d: eclipticViewDirection * cos,
    e: CENTER - cPx * cos,
    f: CENTER - eclipticViewDirection * cPx * sin,
  };
}

export function orbitTransformMatrix(
  cPx: number,
  rotationDeg: number,
  eclipticViewDirection: number
): string {
  const { a, b, c, d, e, f } = orbitTransformComponents(cPx, rotationDeg, eclipticViewDirection);
  return `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`;
}

export function createSvgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v));
  }
  return el as SVGElementTagNameMap[K];
}
