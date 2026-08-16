import type { CelestialBody, CometVisualEllipse } from "../types.js";
import {
  BODY_LABEL_ATTRS,
  CENTER,
  createSvgElement,
  DEFAULT_LABEL_COLOR,
  type OrbitTransformComponents,
  orbitTransformComponents,
  radiusFromAU,
} from "./svg-utils.js";

export const ORBIT_COLOR = "color-mix(in srgb, currentColor 12%, transparent)";
// Outer ring circle (r=23, stroke-width=2) -> visible edge at 24px, wider than Saturn's shrunk body.
export const SATURN_RING_OUTER_RADIUS = 24;

/**
 * Where the drawn orbit ellipse crosses the vertical line x=CENTER (the
 * season-divider axis the AU labels sit next to). The Sun's focus is always
 * inside the ellipse, so this line crosses it at exactly two points —
 * computed from the *same* transform components used to draw the ellipse,
 * so the labels can never drift off the ring the way a fixed
 * CENTER±semi-major-axis placement does once the ellipse is rotated (#94).
 * Returns [top, bottom] sorted by y.
 */
function verticalAxisIntersections(
  rx: number,
  ry: number,
  { a, b, c, d, e, f }: OrbitTransformComponents
): [{ x: number; y: number }, { x: number; y: number }] {
  const A = a * rx;
  const B = c * ry;
  const radius = Math.hypot(A, B);
  const phi = Math.atan2(B, A);
  const cosVal = Math.max(-1, Math.min(1, (CENTER - e) / radius));
  const delta = Math.acos(cosVal);

  const points = [phi + delta, phi - delta].map((t) => {
    const localX = rx * Math.cos(t);
    const localY = ry * Math.sin(t);
    return { x: a * localX + c * localY + e, y: b * localX + d * localY + f };
  });
  return points[0].y <= points[1].y ? [points[0], points[1]] : [points[1], points[0]];
}

export function renderOrbit(
  svg: SVGElement,
  ellipse: CometVisualEllipse,
  eclipticViewDirection: number
): void {
  const orbitColor = ORBIT_COLOR;
  const { aPx, bPx, cPx, rotationDeg } = ellipse;
  const components = orbitTransformComponents(cPx, rotationDeg, eclipticViewDirection);
  const { a, b, c, d, e, f } = components;

  svg.appendChild(
    createSvgElement("ellipse", {
      cx: 0,
      cy: 0,
      rx: aPx,
      ry: bPx,
      fill: "none",
      style: `stroke: ${orbitColor}`,
      "stroke-width": 1,
      "stroke-dasharray": "5, 5",
      transform: `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`,
    })
  );

  // AU labels next to where the ring crosses the vertical axis — offset
  // right of the season dividing line to avoid overlap.
  const LABEL_OFFSET = 3;
  const labelAttrs = {
    style: `fill: ${orbitColor}`,
    "font-size": "9",
    "font-family": "sans-serif",
    "text-anchor": "start",
  };
  const [topPoint, bottomPoint] = verticalAxisIntersections(aPx, bPx, components);
  // The Sun's focus always maps to exactly (CENTER, CENTER) under this
  // transform (a rigid rotation/reflection), so each label point's own
  // distance from the Sun is just its distance from CENTER — no need to
  // work back through local ellipse coordinates.
  const auAt = (point: { x: number; y: number }) =>
    radiusFromAU(Math.hypot(point.x - CENTER, point.y - CENTER));

  // Top label
  svg.appendChild(
    createSvgElement("text", {
      x: topPoint.x + LABEL_OFFSET,
      y: topPoint.y - LABEL_OFFSET,
      ...labelAttrs,
    })
  ).textContent = `${auAt(topPoint).toFixed(1)} AU`;

  // Bottom label
  svg.appendChild(
    createSvgElement("text", {
      x: bottomPoint.x + LABEL_OFFSET,
      y: bottomPoint.y + LABEL_OFFSET + 6,
      ...labelAttrs,
    })
  ).textContent = `${auAt(bottomPoint).toFixed(1)} AU`;
}

export function renderBody(
  svg: SVGElement,
  x: number,
  y: number,
  body: CelestialBody,
  showLabel = true
): void {
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
        style: `fill: ${DEFAULT_LABEL_COLOR}`,
        ...BODY_LABEL_ATTRS,
      })
    ).textContent = body.name;
  }
}

export function renderSaturnRings(
  svg: SVGElement,
  x: number,
  y: number,
  body: CelestialBody
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
