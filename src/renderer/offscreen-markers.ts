import { MOON } from "../astronomy/planet-data.js";
import type { PanZoomState, ViewPosition } from "../types.js";
import { createSvgElement } from "./svg-utils.js";

const MARKER_SIZE = 8;
const EDGE_MARGIN = 10;
const LABEL_FONT_SIZE = 9;
export const MARKER_GROUP_ID = "offscreen-markers";

/**
 * Compute the intersection of a ray from (cx, cy) to (px, py) with a rectangle
 * inset by `margin`, using the standard ray/box slab exit. Corner-correct by
 * construction: a ray leaving through a corner yields the same `t` on both
 * slabs, so no rounding can reject it.
 *
 * ponytail: no guard for (px, py) === (cx, cy) — the caller skips every body
 * inside the viewport, and the centre is always inside.
 */
function edgeIntersection(
  cx: number,
  cy: number,
  px: number,
  py: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
  margin: number
): { x: number; y: number } {
  const dx = px - cx;
  const dy = py - cy;

  const tx =
    dx === 0 ? Number.POSITIVE_INFINITY : ((dx > 0 ? right - margin : left + margin) - cx) / dx;
  const ty =
    dy === 0 ? Number.POSITIVE_INFINITY : ((dy > 0 ? bottom - margin : top + margin) - cy) / dy;
  const t = Math.min(tx, ty);

  return { x: cx + dx * t, y: cy + dy * t };
}

/**
 * Create a triangle polygon pointing from (ix, iy) toward (px, py).
 */
function createTriangle(
  ix: number,
  iy: number,
  px: number,
  py: number,
  color: string
): SVGPolygonElement {
  const angle = Math.atan2(py - iy, px - ix);
  const h = (MARKER_SIZE * Math.sqrt(3)) / 2;
  // Triangle tip points toward the planet
  const tipX = ix + (Math.cos(angle) * h) / 2;
  const tipY = iy + (Math.sin(angle) * h) / 2;
  const baseAngle1 = angle + Math.PI / 2;
  const baseAngle2 = angle - Math.PI / 2;
  const halfBase = MARKER_SIZE / 2;
  const b1x = ix - (Math.cos(angle) * h) / 2 + Math.cos(baseAngle1) * halfBase;
  const b1y = iy - (Math.sin(angle) * h) / 2 + Math.sin(baseAngle1) * halfBase;
  const b2x = ix - (Math.cos(angle) * h) / 2 + Math.cos(baseAngle2) * halfBase;
  const b2y = iy - (Math.sin(angle) * h) / 2 + Math.sin(baseAngle2) * halfBase;

  const polygon = createSvgElement("polygon", {});
  polygon.setAttribute("points", `${tipX},${tipY} ${b1x},${b1y} ${b2x},${b2y}`);
  polygon.setAttribute("fill", color);
  return polygon;
}

/**
 * Create a text label for a planet name near the marker.
 */
function createLabel(
  ix: number,
  iy: number,
  px: number,
  py: number,
  name: string,
  color: string,
  left: number,
  right: number
): SVGTextElement {
  const text = createSvgElement("text", {});
  text.setAttribute("fill", color);
  text.setAttribute("font-size", String(LABEL_FONT_SIZE));
  text.setAttribute("font-family", "sans-serif");
  text.textContent = name;

  // Position label inward from the marker
  const angle = Math.atan2(py - iy, px - ix);
  const offsetDist = MARKER_SIZE + 2;
  const lx = ix - Math.cos(angle) * offsetDist;
  const ly = iy - Math.sin(angle) * offsetDist;

  // Determine text-anchor based on position relative to viewport center
  const midX = (left + right) / 2;
  if (lx < midX) {
    text.setAttribute("text-anchor", "start");
  } else {
    text.setAttribute("text-anchor", "end");
  }

  text.setAttribute("x", String(lx));
  text.setAttribute("y", String(ly + LABEL_FONT_SIZE / 3));
  return text;
}

/**
 * Render off-screen markers for planets/Moon outside the current viewport.
 *
 * The viewBox is always square, but the card's box is not once `config.height`
 * reshapes it. Under preserveAspectRatio="xMidYMid meet" the square content
 * letterboxes, and the bands are still drawable — the outer <svg> clips to its
 * element box, not to the viewBox. So the marker rect is the *visible* region in
 * viewBox units, which decides both where a marker is drawn and whether a body
 * counts as off-screen at all (#135).
 *
 * @param positions - bodies to consider, in viewBox coordinates
 * @param viewState - pan/zoom state; `width` is the square viewBox extent
 * @param aspect - the card element's width / height. Absent, non-finite or <= 0
 *   (jsdom, and HA's pre-layout first paint, both measure 0x0) falls back to square.
 */
export function renderOffscreenMarkers(
  positions: ViewPosition[],
  viewState: PanZoomState,
  aspect = 1
): SVGGElement {
  const group = createSvgElement("g", { id: MARKER_GROUP_ID });

  const w = viewState.width;
  const ratio = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const halfW = (w / 2) * Math.max(1, ratio);
  const halfH = (w / 2) * Math.max(1, 1 / ratio);
  const left = viewState.centerX - halfW;
  const top = viewState.centerY - halfH;
  const right = viewState.centerX + halfW;
  const bottom = viewState.centerY + halfH;

  for (const pos of positions) {
    // The Moon rides a fixed 22px offset from Earth, so it is offscreen exactly when Earth is
    // and a second marker for it would only ever duplicate Earth's.
    if (pos.name === MOON.name) continue;

    // Skip if inside viewport
    if (pos.x >= left && pos.x <= right && pos.y >= top && pos.y <= bottom) {
      continue;
    }

    const { x: ix, y: iy } = edgeIntersection(
      viewState.centerX,
      viewState.centerY,
      pos.x,
      pos.y,
      left,
      top,
      right,
      bottom,
      EDGE_MARGIN
    );

    const triangle = createTriangle(ix, iy, pos.x, pos.y, pos.color);
    group.appendChild(triangle);

    const label = createLabel(ix, iy, pos.x, pos.y, pos.name, pos.color, left, right);
    group.appendChild(label);
  }

  return group;
}
