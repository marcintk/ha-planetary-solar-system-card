import type { CelestialBody, Colors } from "../types.js";
import { BODY_LABEL_ATTRS, CENTER, createSvgElement, DEFAULT_LABEL_COLOR } from "./svg-utils.js";

export const ORBIT_COLOR = "rgba(255, 255, 255, 0.12)";
const AU_LABEL_COLOR = "rgba(255, 255, 255, 0.5)";

export function renderOrbit(
  svg: SVGElement,
  radius: number,
  auLabel: number,
  colors: Colors = {}
): void {
  const orbitColor = colors.orbit ?? ORBIT_COLOR;

  svg.appendChild(
    createSvgElement("circle", {
      cx: CENTER,
      cy: CENTER,
      r: radius,
      fill: "none",
      stroke: orbitColor,
      "stroke-width": 1,
      "stroke-dasharray": "5, 5",
    })
  );

  // AU labels on the vertical axis — mirrored above and below center
  // Offset right of the season dividing line to avoid overlap
  const offset = 3;
  const horizontalOffset = 3;
  const labelAttrs = {
    fill: AU_LABEL_COLOR,
    "font-size": "9",
    "font-family": "sans-serif",
    "text-anchor": "start",
  };

  // Top label
  svg.appendChild(
    createSvgElement("text", {
      x: CENTER + horizontalOffset,
      y: CENTER - radius - offset,
      ...labelAttrs,
    })
  ).textContent = `${Number(auLabel).toFixed(1)} AU`;

  // Bottom label
  svg.appendChild(
    createSvgElement("text", {
      x: CENTER + horizontalOffset,
      y: CENTER + radius + offset + 6,
      ...labelAttrs,
    })
  ).textContent = `${Number(auLabel).toFixed(1)} AU`;
}

export function renderBody(
  svg: SVGElement,
  x: number,
  y: number,
  body: CelestialBody,
  showLabel = true,
  colors: Colors = {}
): void {
  const labelColor = colors.label ?? DEFAULT_LABEL_COLOR;

  svg.appendChild(
    createSvgElement("circle", {
      cx: x,
      cy: y,
      r: body.size,
      fill: body.color,
    })
  );

  if (showLabel) {
    svg.appendChild(
      createSvgElement("text", {
        x: x,
        y: y - body.size - 6,
        fill: labelColor,
        ...BODY_LABEL_ATTRS,
      })
    ).textContent = body.name;
  }
}

export function renderSaturnRings(
  svg: SVGElement,
  x: number,
  y: number,
  body: CelestialBody,
  _renderSize: number
): void {
  // Outer ring (r=23, stroke-width=2): outer edge 24px, inner edge 22px
  svg.appendChild(
    createSvgElement("circle", {
      cx: x,
      cy: y,
      r: 23,
      fill: "none",
      stroke: body.color,
      "stroke-width": 2,
      opacity: 0.6,
    })
  );

  // Inner ring (r=18, stroke-width=6): outer edge 21px, inner edge 15px
  // 3× thicker than outer ring; gap body(~6.5px) to inner ring(15px) = ~8.5px; inter-ring gap(22-21) = 1px
  svg.appendChild(
    createSvgElement("circle", {
      cx: x,
      cy: y,
      r: 18,
      fill: "none",
      stroke: body.color,
      "stroke-width": 6,
      opacity: 0.6,
    })
  );
}
