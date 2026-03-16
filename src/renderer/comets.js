import { solveKeplerEquation } from "../astronomy/orbital-mechanics.js";
import { auToRadius, CENTER, createSvgElement } from "./svg-utils.js";

const ORBIT_COLOR = "rgba(255, 255, 255, 0.12)";
const TAIL_COLOR = "rgba(136, 204, 255, 0.5)";

/**
 * Render a comet's orbit by sampling points around the full orbit
 * and connecting them with an SVG path. Uses log-scaled auToRadius
 * so the path matches actual body positions.
 */
export function renderCometOrbit(svg, comet) {
  const e = comet.eccentricity;
  const a = comet.semiMajorAxis;
  const longPeriRad = (comet.longitudeOfPerihelion * Math.PI) / 180;
  const steps = 120;
  const parts = [];

  for (let i = 0; i <= steps; i++) {
    const M = (i / steps) * 2 * Math.PI;
    const E = solveKeplerEquation(M, e);
    const trueAnomaly =
      2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    const radius = a * (1 - e * Math.cos(E));
    const angle = trueAnomaly + longPeriRad;
    const pixelR = auToRadius(radius);
    const x = CENTER + pixelR * Math.cos(angle);
    const y = CENTER - pixelR * Math.sin(angle);
    parts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }

  svg.appendChild(
    createSvgElement("path", {
      d: parts.join(" "),
      fill: "none",
      stroke: ORBIT_COLOR,
      "stroke-width": 1,
      "stroke-dasharray": "4, 8",
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
