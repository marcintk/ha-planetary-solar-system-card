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
