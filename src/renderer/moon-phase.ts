import { getMoonPhase } from "../astronomy/moon-phase.js";
import type { Hemisphere } from "../types.js";
import { createSvgElement, SVG_NS } from "./svg-utils.js";

// User-space size of the disc's own viewBox. Nothing depends on the number in px terms —
// the <svg> scales to whatever the gallery tile gives it — it only fixes the coordinate
// system the circle and terminator arc are drawn in.
const DISC_SIZE = 100;

const CENTER_X = DISC_SIZE / 2;
// Lifted above centre, and small enough, that the disc clears the phase caption overlaid on
// the bottom of the tile — at 48 it ran under the text and the longest names read against
// the lit limb rather than the black backdrop.
const CENTER_Y = 42;
const INDICATOR_RADIUS = 38;
const DISC_COLOR = "#cccccc";
const SHADOW_COLOR = "#1a1a2e";

/**
 * Draw the moon's lit fraction as a standalone, self-contained <svg>.
 *
 * Returns a detached element rather than appending to a caller's SVG (as it did while it
 * lived in the solar view): its one consumer is now the gallery strip, which mounts it into
 * its own tile. The phase name is deliberately absent — the tile renders it as HTML, where
 * it can wrap and scale with the tile instead of being frozen into SVG user units.
 */
export function renderMoonPhaseDisc(date: Date, hemisphere: Hemisphere): SVGSVGElement {
  const { phase, illumination } = getMoonPhase(date);

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${DISC_SIZE} ${DISC_SIZE}`);
  svg.setAttribute("class", "moon-phase-disc");

  // Background disc (dark)
  svg.appendChild(
    createSvgElement("circle", {
      cx: CENTER_X,
      cy: CENTER_Y,
      r: INDICATOR_RADIUS,
      fill: SHADOW_COLOR,
    })
  );

  if (illumination > 0.01) {
    // Build illuminated portion using a path.
    // The approach: draw two arcs forming a closed shape.
    // For waxing (phase < 0.5 in north), right side lit.
    // For waning (phase > 0.5 in north), left side lit.
    // Southern hemisphere mirrors the illumination side.
    const r = INDICATOR_RADIUS;
    const top = CENTER_Y - r;
    const bottom = CENTER_Y + r;

    // Terminator bulge: at illumination 0.5 the terminator is straight (rx=0),
    // below 0.5 it bulges toward shadow, above 0.5 it bulges toward light.
    const fraction = illumination;
    const rx = Math.abs(2 * fraction - 1) * r;
    const bulgeRight = fraction > 0.5;

    // Determine which side is lit
    const isWaxing = phase < 0.5;
    let litOnRight = isWaxing;
    if (hemisphere === "south") litOnRight = !litOnRight;

    // The lit half is drawn as: a semicircular arc on the lit side + an elliptical
    // arc for the terminator.
    // Semicircle: always sweeps from top to bottom on the lit side.
    const semiSweep = litOnRight ? 1 : 0;
    // Terminator ellipse sweep depends on whether bulge goes toward lit side
    let terminatorSweep: number;
    if (litOnRight) {
      terminatorSweep = bulgeRight ? 1 : 0;
    } else {
      terminatorSweep = bulgeRight ? 0 : 1;
    }

    const d = [
      `M ${CENTER_X} ${top}`,
      // Semicircular arc on the lit side
      `A ${r} ${r} 0 0 ${semiSweep} ${CENTER_X} ${bottom}`,
      // Terminator arc back to top
      `A ${rx} ${r} 0 0 ${terminatorSweep} ${CENTER_X} ${top}`,
      "Z",
    ].join(" ");

    svg.appendChild(
      createSvgElement("path", {
        d,
        fill: DISC_COLOR,
      })
    );
  }

  return svg;
}
