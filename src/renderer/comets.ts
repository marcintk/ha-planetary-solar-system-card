import type { Colors, Comet, CometVisualEllipse } from "../types.js";
import { ORBIT_COLOR } from "./bodies.js";
import {
  auToRadius,
  BODY_LABEL_ATTRS,
  CENTER,
  createSvgElement,
  DEFAULT_LABEL_COLOR,
} from "./svg-utils.js";

const TAIL_COLOR = "rgba(136, 204, 255, 0.5)";

/**
 * Compute the visual ellipse parameters in pixel space for a comet.
 * Returns { aPx, bPx, cPx, ePx, rotationDeg }.
 */
export function computeCometVisualEllipse(comet: Comet): CometVisualEllipse {
  const e = comet.eccentricity;
  const a = comet.semiMajorAxis;
  const perihelionPx = auToRadius(a * (1 - e));
  let aphelionPx = auToRadius(a * (1 + e));

  // Exaggerate extension beyond Neptune for visual clarity
  const neptunePx = auToRadius(30.05);
  if (aphelionPx > neptunePx) {
    const excess = aphelionPx - neptunePx;
    aphelionPx = neptunePx + excess * 4;
  }

  const aPx = (perihelionPx + aphelionPx) / 2;
  const cPx = (aphelionPx - perihelionPx) / 2;
  const bPx = Math.sqrt(aPx * aPx - cPx * cPx);
  const ePx = cPx / aPx;
  return { aPx, bPx, cPx, ePx, rotationDeg: comet.longitudeOfPerihelion };
}

/**
 * Render a comet's orbit as an SVG ellipse in pixel space.
 * The ellipse is offset so the Sun (at CENTER) sits at one focus.
 */
export function renderCometOrbit(svg: SVGElement, comet: Comet, colors: Colors = {}): void {
  const orbitColor = colors.orbit ?? ORBIT_COLOR;
  const { aPx, bPx, cPx, rotationDeg } = computeCometVisualEllipse(comet);

  svg.appendChild(
    createSvgElement("ellipse", {
      cx: CENTER,
      cy: CENTER,
      rx: aPx,
      ry: bPx,
      fill: "none",
      style: `stroke: ${orbitColor}`,
      "stroke-width": 1,
      "stroke-dasharray": "4, 8",
      transform: `rotate(${-rotationDeg}, ${CENTER}, ${CENTER}) translate(${-cPx}, 0)`,
    })
  );
}

/**
 * Render the comet body and its anti-sunward tail.
 * The tail always points directly away from the Sun.
 */
export function renderCometBody(
  svg: SVGElement,
  x: number,
  y: number,
  comet: Comet,
  sunX: number,
  sunY: number,
  dynamicTailLength?: number,
  colors: Colors = {}
): void {
  const labelColor = colors.label ?? DEFAULT_LABEL_COLOR;
  // Direction away from the Sun
  const dx = x - sunX;
  const dy = y - sunY;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;

  // Tail end point (away from Sun)
  const tailLen = dynamicTailLength ?? comet.tailLength;
  const tx = x + nx * tailLen;
  const ty = y + ny * tailLen;

  // Tail as a semi-transparent line
  svg.appendChild(
    createSvgElement("line", {
      x1: x,
      y1: y,
      x2: tx,
      y2: ty,
      stroke: TAIL_COLOR,
      "stroke-width": 2,
      "stroke-linecap": "round",
      opacity: "0.7",
    })
  );

  // Comet body
  svg.appendChild(
    createSvgElement("circle", {
      cx: x,
      cy: y,
      r: comet.size,
      fill: comet.color,
    })
  );

  // Label
  svg.appendChild(
    createSvgElement("text", {
      x: x,
      y: y - comet.size - 6,
      style: `fill: ${labelColor}`,
      ...BODY_LABEL_ATTRS,
    })
  ).textContent = comet.name;
}
