import { createSvgElement } from "./svg-utils.js";

const MARKER_SIZE = 8;
const EDGE_MARGIN = 10;
const LABEL_FONT_SIZE = 9;
const MARKER_GROUP_ID = "offscreen-markers";

/**
 * Compute the intersection of a ray from (cx, cy) to (px, py) with a rectangle.
 * Returns { x, y } on the rectangle edge, inset by margin.
 */
function edgeIntersection(cx, cy, px, py, left, top, right, bottom, margin) {
  const dx = px - cx;
  const dy = py - cy;

  const inLeft = left + margin;
  const inTop = top + margin;
  const inRight = right - margin;
  const inBottom = bottom - margin;

  let tMin = Number.POSITIVE_INFINITY;

  // Check each edge
  if (dx !== 0) {
    const tLeft = (inLeft - cx) / dx;
    if (tLeft > 0 && tLeft < tMin) {
      const yAt = cy + dy * tLeft;
      if (yAt >= inTop && yAt <= inBottom) tMin = tLeft;
    }
    const tRight = (inRight - cx) / dx;
    if (tRight > 0 && tRight < tMin) {
      const yAt = cy + dy * tRight;
      if (yAt >= inTop && yAt <= inBottom) tMin = tRight;
    }
  }
  if (dy !== 0) {
    const tTop = (inTop - cy) / dy;
    if (tTop > 0 && tTop < tMin) {
      const xAt = cx + dx * tTop;
      if (xAt >= inLeft && xAt <= inRight) tMin = tTop;
    }
    const tBottom = (inBottom - cy) / dy;
    if (tBottom > 0 && tBottom < tMin) {
      const xAt = cx + dx * tBottom;
      if (xAt >= inLeft && xAt <= inRight) tMin = tBottom;
    }
  }

  if (tMin === Number.POSITIVE_INFINITY) {
    return { x: cx, y: cy };
  }

  return { x: cx + dx * tMin, y: cy + dy * tMin };
}

/**
 * Create a triangle polygon pointing from (ix, iy) toward (px, py).
 */
function createTriangle(ix, iy, px, py, color) {
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
function createLabel(ix, iy, px, py, name, color, left, right) {
  const text = createSvgElement("text", {});
  text.setAttribute("fill", color);
  text.setAttribute("font-size", LABEL_FONT_SIZE);
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

  text.setAttribute("x", lx);
  text.setAttribute("y", ly + LABEL_FONT_SIZE / 3);
  return text;
}

/**
 * Render off-screen markers for planets/Moon outside the current viewport.
 * @param {Array<{name: string, x: number, y: number, color: string}>} positions
 * @param {object} viewState - ViewState instance with centerX, centerY, width, height
 * @returns {SVGGElement} A <g> group containing all markers
 */
export function renderOffscreenMarkers(positions, viewState) {
  const group = createSvgElement("g", { id: MARKER_GROUP_ID });

  if (!positions || !viewState) return group;

  const w = viewState.width;
  const h = viewState.height;
  const left = viewState.centerX - w / 2;
  const top = viewState.centerY - h / 2;
  const right = left + w;
  const bottom = top + h;

  for (const pos of positions) {
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

export { MARKER_GROUP_ID };
