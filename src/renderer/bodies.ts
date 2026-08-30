import type { CelestialBody, CometVisualEllipse } from "../types.js";
import type { EclipticViewDirection } from "./svg-utils.js";
import {
  BODY_LABEL_ATTRS,
  CENTER,
  createSvgElement,
  DEFAULT_LABEL_COLOR,
  type OrbitTransformComponents,
  orbitTransformComponents,
  radiusFromAU,
  sunwardHalfDiscPaths,
  VIEW_SIZE,
} from "./svg-utils.js";

export const ORBIT_COLOR = "color-mix(in srgb, currentColor 12%, transparent)";
// Outer ring circle (r=23, stroke-width=2) -> visible edge at 24px, wider than Saturn's shrunk body.
export const SATURN_RING_OUTER_RADIUS = 24;

const SHADOW_FILL = "#05070c";
const SHADOW_OPACITY = 0.45;

export const HALO_VIEW_FRACTION = 0.7;

/**
 * A soft radial glow behind the Sun — one translucent gradient circle, no filter.
 * Call before drawing the Sun body so it paints underneath. The radius here is the
 * zoom-1 default (VIEW_SIZE * HALO_VIEW_FRACTION); updateHalo rescales it as the view zooms.
 */
export function renderSunHalo(svg: SVGElement): void {
  const defs =
    svg.querySelector("defs") || svg.insertBefore(createSvgElement("defs", {}), svg.firstChild);
  const grad = createSvgElement("radialGradient", { id: "sun-halo" });
  const stop = (offset: string, color: string, opacity: string) =>
    grad.appendChild(
      createSvgElement("stop", { offset, "stop-color": color, "stop-opacity": opacity })
    );
  stop("0%", "#ffd479", "0.5");
  stop("55%", "#ffcf6b", "0.14");
  stop("100%", "#ffcf6b", "0");
  defs.appendChild(grad);
  svg.appendChild(
    createSvgElement("circle", {
      id: "sun-halo-glow",
      cx: CENTER,
      cy: CENTER,
      r: VIEW_SIZE * HALO_VIEW_FRACTION,
      fill: "url(#sun-halo)",
    })
  );
}

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
  eclipticViewDirection: EclipticViewDirection
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

/**
 * Wash the anti-sunward half of a body dark — one translucent overlay on top of the plain
 * disc the caller already drew. phi comes from the screen-space vector to the Sun at CENTER,
 * so no eclipticViewDirection (the split is not an orbital angle — CLAUDE.md, #94).
 *
 * With `reach > coreR` (Saturn) the shadow instead spans body + rings + gap: a translucent
 * disc of radius `reach` clipped to a rotated rect band reaching from the body centre out to
 * `reach` on the anti-sunward side.
 */
export function renderBodyShadow(
  svg: SVGElement,
  x: number,
  y: number,
  coreR: number,
  reach = coreR
): void {
  const halves = sunwardHalfDiscPaths(x, y, coreR);
  if (halves === null) return; // body at CENTER (the Sun) — no shadow
  if (reach === coreR) {
    svg.appendChild(
      createSvgElement("path", {
        d: halves.darkD,
        fill: SHADOW_FILL,
        "fill-opacity": SHADOW_OPACITY,
      })
    );
    return;
  }
  // reach > coreR (Saturn): a clipped band across body + rings + gap
  const phiDeg = (Math.atan2(y - CENTER, x - CENTER) * 180) / Math.PI;
  const defs =
    svg.querySelector("defs") || svg.insertBefore(createSvgElement("defs", {}), svg.firstChild);
  const clip = createSvgElement("clipPath", { id: "saturn-shadow" });
  clip.appendChild(
    createSvgElement("rect", {
      x: 0,
      y: -coreR,
      width: reach,
      height: 2 * coreR,
      transform: `translate(${x} ${y}) rotate(${phiDeg})`,
    })
  );
  defs.appendChild(clip);
  svg.appendChild(
    createSvgElement("circle", {
      cx: x,
      cy: y,
      r: reach,
      fill: SHADOW_FILL,
      "fill-opacity": SHADOW_OPACITY,
      "clip-path": "url(#saturn-shadow)",
    })
  );
}

export function renderBody(
  svg: SVGElement,
  x: number,
  y: number,
  body: CelestialBody,
  showLabel = true
): void {
  svg.appendChild(createSvgElement("circle", { cx: x, cy: y, r: body.size, fill: body.color }));
  renderBodyShadow(svg, x, y, body.size);

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

/**
 * Draw Saturn: the plain body disc, the two lit ring circles, and the anti-sunward
 * shadow band that spans body + rings + gap (via renderBodyShadow with reach set to
 * the outer ring radius).
 */
export function renderSaturn(svg: SVGElement, x: number, y: number, body: CelestialBody): void {
  const coreR = Math.round(body.size / 2);
  svg.appendChild(createSvgElement("circle", { cx: x, cy: y, r: coreR, fill: body.color }));

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

  renderBodyShadow(svg, x, y, coreR, SATURN_RING_OUTER_RADIUS);
}
