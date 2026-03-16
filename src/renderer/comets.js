import { auToRadius, CENTER, createSvgElement } from "./svg-utils.js";

const ORBIT_COLOR = "rgba(255, 255, 255, 0.12)";
const TAIL_COLOR = "rgba(136, 204, 255, 0.5)";

/**
 * Compute the visual ellipse parameters in pixel space for a comet.
 * Returns { aPx, bPx, cPx, ePx, rotationDeg }.
 */
export function computeCometVisualEllipse(comet) {
  const e = comet.eccentricity;
  const a = comet.semiMajorAxis;
  const perihelionPx = auToRadius(a * (1 - e));
  const aphelionPx = auToRadius(a * (1 + e));
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
export function renderCometOrbit(svg, comet) {
  const { aPx, bPx, cPx, rotationDeg } = computeCometVisualEllipse(comet);

  svg.appendChild(
    createSvgElement("ellipse", {
      cx: CENTER,
      cy: CENTER,
      rx: aPx,
      ry: bPx,
      fill: "none",
      stroke: ORBIT_COLOR,
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
export function renderCometBody(svg, x, y, comet, sunX, sunY) {
  // Direction away from the Sun
  const dx = x - sunX;
  const dy = y - sunY;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;

  // Tail end point (away from Sun)
  const tailLen = comet.tailLength || 30;
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
      fill: "#ffffff",
      "font-size": "11",
      "font-family": "sans-serif",
      "text-anchor": "middle",
    })
  ).textContent = comet.name;
}
