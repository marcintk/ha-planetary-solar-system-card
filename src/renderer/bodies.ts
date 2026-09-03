import type { CelestialBody, CometVisualEllipse, ShadeOptions } from "../types.js";
import type { EclipticViewDirection } from "./svg-utils.js";
import {
  BODY_LABEL_ATTRS,
  CENTER,
  createSvgElement,
  DEFAULT_LABEL_COLOR,
  type OrbitTransformComponents,
  orbitTransformComponents,
  radiusFromAU,
  terminatorShadowPath,
  VIEW_SIZE,
} from "./svg-utils.js";

export const ORBIT_COLOR = "color-mix(in srgb, currentColor 12%, transparent)";
// Outer ring circle (r=23, stroke-width=2) -> visible edge at 24px, wider than Saturn's shrunk body.
export const SATURN_RING_OUTER_RADIUS = 24;

const SHADOW_FILL = "#05070c";
const SHADOW_OPACITY = 0.55;
const TERMINATOR_BOW = 0.22;
// The night-side darkening: a dark shade of the body's own hue, matching the `display: 3d`
// sprite's ambient floor so 2d and 3d dark sides read the same. `SHADE_MIX` % of the colour,
// the rest black; near-opaque. Falls back to the flat #05070c wash when no colour is given.
const SHADE_MIX = 28;
const SHADE_OPACITY = 0.92;
const shadeFill = (color?: string): Record<string, string | number> =>
  color
    ? { fill: `color-mix(in srgb, ${color} ${SHADE_MIX}%, black)`, "fill-opacity": SHADE_OPACITY }
    : { fill: SHADOW_FILL, "fill-opacity": SHADOW_OPACITY };

export const HALO_VIEW_FRACTION = 0.33;

// Pre-rendered 128px Lambert sphere for `display: 3d`, generated once (scripts/gen-sphere-sprites.mjs) and
// inlined so the renderer needs no <canvas> at runtime. Viewer-lit + high ambient: pure volume, no
// obvious direction. Grayscale+alpha; a per-colour feColorMatrix tints it.
const SPRITE_SOFT =
  "data:image/png;base64,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";

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
  stop("0%", "#ffd479", "0.35");
  stop("54%", "#ffcf6b", "0.1");
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
 * The `display: 3d` ball look: the pre-rendered `SPRITE_SOFT` Lambert sphere (viewer-weighted
 * light + high ambient: pure volume, no obvious direction), blitted as an `<image>` and tinted
 * to the body's hue by a per-colour `<feColorMatrix>` (multiply). The day/night split is layered
 * on top by a separate `renderBodyShadow` call, the same overlay the flat-circle path gets.
 * Raster, so it softens somewhat when the card is zoomed in — the accepted trade for a real
 * shaded sphere.
 */
export function renderSphereSprite(
  svg: SVGElement,
  x: number,
  y: number,
  r: number,
  color: string
): void {
  const defs =
    svg.querySelector("defs") || svg.insertBefore(createSvgElement("defs", {}), svg.firstChild);
  const tintId = `tint-${color.replace(/[^a-z0-9]/gi, "")}`;
  if (!defs.querySelector(`#${tintId}`)) {
    const cr = Number.parseInt(color.slice(1, 3), 16) / 255;
    const cg = Number.parseInt(color.slice(3, 5), 16) / 255;
    const cb = Number.parseInt(color.slice(5, 7), 16) / 255;
    const filter = createSvgElement("filter", {
      id: tintId,
      "color-interpolation-filters": "sRGB",
    });
    // Grayscale sprite (R=G=B=v) -> (cr·v, cg·v, cb·v): a straight multiply by the solid hue.
    filter.appendChild(
      createSvgElement("feColorMatrix", {
        type: "matrix",
        values: `${cr} 0 0 0 0  0 ${cg} 0 0 0  0 0 ${cb} 0 0  0 0 0 1 0`,
      })
    );
    defs.appendChild(filter);
  }
  const attrs: Record<string, string | number> = {
    href: SPRITE_SOFT,
    x: x - r,
    y: y - r,
    width: 2 * r,
    height: 2 * r,
    filter: `url(#${tintId})`,
  };
  svg.appendChild(createSvgElement("image", attrs));
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
 * The astronomical day/night overlay (config `shading: true`). For a lone body (reach ===
 * coreR) it washes the anti-sunward region dark — bounded by an elliptical terminator that
 * bows `TERMINATOR_BOW` into the dark side (see terminatorShadowPath), the dark side darker
 * but not black. phi comes from the screen-space vector to the Sun at CENTER, so no
 * eclipticViewDirection (not an orbital angle — CLAUDE.md, #94). No-op at CENTER (the Sun).
 *
 * With `reach > coreR` (Saturn) the core disc gets the same elliptical terminator wash, plus a
 * body-width rect band (height `2 * coreR`) reaching anti-sunward out to `reach` across the
 * rings and the gap — masked to leave the core to the terminator path, so the night side is
 * washed once, not twice. The elliptical wash is independent of `display`: flat 2d discs and 3d
 * sphere sprites get it identically.
 */
export function renderBodyShadow(
  svg: SVGElement,
  x: number,
  y: number,
  coreR: number,
  reach = coreR,
  shadeColor?: string
): void {
  // No-op at CENTER (the Sun): terminatorShadowPath is null exactly there.
  const d = terminatorShadowPath(x, y, coreR, TERMINATOR_BOW);
  if (d === null) return;
  // The elliptical terminator wash over the core disc.
  svg.appendChild(createSvgElement("path", { d, ...shadeFill(shadeColor) }));
  if (reach === coreR) return;
  // reach > coreR (Saturn): plus a body-width band across the rings + gap, clipped to a
  // rotated rect and masked so it stops at the core (the terminator path already covers
  // that, no double wash).
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
  const coreCut = createSvgElement("mask", { id: "saturn-core-cut" });
  coreCut.appendChild(
    createSvgElement("rect", {
      x: x - reach,
      y: y - reach,
      width: 2 * reach,
      height: 2 * reach,
      fill: "#fff",
    })
  );
  coreCut.appendChild(createSvgElement("circle", { cx: x, cy: y, r: coreR, fill: "#000" }));
  defs.appendChild(coreCut);
  // The ring band uses the same in-hue darkening as the core (sprite or 2d wash), so the
  // shadowed rings and shadowed core read as one shadow.
  svg.appendChild(
    createSvgElement("circle", {
      cx: x,
      cy: y,
      r: reach,
      ...shadeFill(shadeColor),
      "clip-path": "url(#saturn-shadow)",
      mask: "url(#saturn-core-cut)",
    })
  );
}

export function renderBody(
  svg: SVGElement,
  x: number,
  y: number,
  body: CelestialBody,
  showLabel = true,
  shade: ShadeOptions = { sphere: true, dayNight: true }
): void {
  const atCenter = x === CENTER && y === CENTER;
  // Draw the body form — 3d Lambert sphere sprite or a flat 2d disc — then, off-centre, layer
  // the shared day/night terminator wash on top: 2d and 3d get the exact same overlay. The
  // Sun (atCenter) stays a flat disc with neither; the halo carries its depth.
  if (shade.sphere && !atCenter) {
    renderSphereSprite(svg, x, y, body.size, body.color);
  } else {
    svg.appendChild(createSvgElement("circle", { cx: x, cy: y, r: body.size, fill: body.color }));
  }
  if (shade.dayNight && !atCenter) {
    renderBodyShadow(svg, x, y, body.size, body.size, body.color);
  }

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
 * Draw Saturn: the core disc (a `display: 3d` sprite per `shade.sphere`, like every other body)
 * and its two lit ring circles, then — per `shade.dayNight` — the day/night. The core takes the
 * elliptical wash in both `display` modes, plus the ring band reaching anti-sunward across the
 * rings.
 */
export function renderSaturn(
  svg: SVGElement,
  x: number,
  y: number,
  body: CelestialBody,
  shade: ShadeOptions = { sphere: true, dayNight: true }
): void {
  const coreR = Math.round(body.size / 2);
  if (shade.sphere) {
    renderSphereSprite(svg, x, y, coreR, body.color);
  } else {
    svg.appendChild(createSvgElement("circle", { cx: x, cy: y, r: coreR, fill: body.color }));
  }

  // Outer ring (r=23, stroke-width=2): outer edge 24px, inner edge 22px
  svg.appendChild(
    createSvgElement("circle", {
      cx: x,
      cy: y,
      r: 23,
      fill: "none",
      stroke: body.color,
      "stroke-width": 2,
      opacity: 0.8,
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
      opacity: 0.8,
    })
  );

  if (shade.dayNight) {
    renderBodyShadow(svg, x, y, coreR, SATURN_RING_OUTER_RADIUS, body.color);
  }
}
