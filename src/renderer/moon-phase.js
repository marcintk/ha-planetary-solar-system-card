import { getMoonPhase } from "../astronomy/moon-phase.js";
import { createSvgElement } from "./svg-utils.js";

const INDICATOR_RADIUS = 30;
const INDICATOR_X = 40;
const INDICATOR_Y = 735;
const DISC_COLOR = "#cccccc";
const SHADOW_COLOR = "#1a1a2e";
const LABEL_COLOR = "#aaaaaa";
const LABEL_FONT_SIZE = "14";

/**
 * Render a moon phase indicator (disc + label) and append it to the SVG.
 * @param {SVGElement} svg
 * @param {Date} date
 * @param {string} hemisphere - "north" or "south"
 */
export function renderMoonPhaseIndicator(svg, date, hemisphere) {
  const { phase, phaseName, illumination } = getMoonPhase(date);

  const g = createSvgElement("g", { class: "moon-phase-indicator" });

  // Background disc (dark)
  g.appendChild(
    createSvgElement("circle", {
      cx: INDICATOR_X,
      cy: INDICATOR_Y,
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
    const top = INDICATOR_Y - r;
    const bottom = INDICATOR_Y + r;

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
    let terminatorSweep;
    if (litOnRight) {
      terminatorSweep = bulgeRight ? 1 : 0;
    } else {
      terminatorSweep = bulgeRight ? 0 : 1;
    }

    const d = [
      `M ${INDICATOR_X} ${top}`,
      // Semicircular arc on the lit side
      `A ${r} ${r} 0 0 ${semiSweep} ${INDICATOR_X} ${bottom}`,
      // Terminator arc back to top
      `A ${rx} ${r} 0 0 ${terminatorSweep} ${INDICATOR_X} ${top}`,
      "Z",
    ].join(" ");

    g.appendChild(
      createSvgElement("path", {
        d,
        fill: DISC_COLOR,
      })
    );
  }

  // Phase name label below the disc
  const label = createSvgElement("text", {
    x: INDICATOR_X - INDICATOR_RADIUS,
    y: INDICATOR_Y + INDICATOR_RADIUS + 14,
    fill: LABEL_COLOR,
    "font-size": LABEL_FONT_SIZE,
    "font-family": "sans-serif",
    "text-anchor": "start",
  });
  label.textContent = phaseName;
  g.appendChild(label);

  svg.appendChild(g);
}
