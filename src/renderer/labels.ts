import type { ViewPosition } from "../types.js";
import { BODY_LABEL_ATTRS, createSvgElement } from "./svg-utils.js";

// ponytail: fixed heuristic distance for "close enough to reroute a label"; tune if false positives show up.
const NEARBY_THRESHOLD = 80;
const LABEL_GAP = 6;
// Approximate cap-height for BODY_LABEL_ATTRS font-size (11), ~0.73em for
// common sans-serif fonts. Used to measure the gap from the visible top of
// the glyphs, not the SVG baseline, when a label sits below its body.
const CAP_HEIGHT = 8;

export interface LabelTarget {
  name: string;
  x: number;
  y: number;
  radius: number;
}

/**
 * Render one label per target, directly above the body by default. If the
 * nearest other rendered body is close and also above, flip the label below
 * instead so the two don't sit on top of each other (#62 follow-up).
 * Doesn't try to resolve 3+ body pileups - those are rare and left as-is.
 */
export function renderDynamicLabels(
  svg: SVGElement,
  targets: readonly LabelTarget[],
  obstacles: readonly ViewPosition[],
  labelColor: string
): void {
  for (const target of targets) {
    let nearestDist = Number.POSITIVE_INFINITY;
    let nearestDy = 0;

    for (const obstacle of obstacles) {
      if (obstacle.name === target.name) continue;
      const dist = Math.hypot(obstacle.x - target.x, obstacle.y - target.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestDy = obstacle.y - target.y;
      }
    }

    const placeBelow = nearestDist < NEARBY_THRESHOLD && nearestDy < 0;
    const y = placeBelow
      ? target.y + target.radius + LABEL_GAP + CAP_HEIGHT
      : target.y - target.radius - LABEL_GAP;

    svg.appendChild(
      createSvgElement("text", {
        x: target.x,
        y,
        style: `fill: ${labelColor}`,
        ...BODY_LABEL_ATTRS,
      })
    ).textContent = target.name;
  }
}
