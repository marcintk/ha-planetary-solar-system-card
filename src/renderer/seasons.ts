import type { Colors, Hemisphere } from "../types.js";
import { CENTER, createSvgElement, MAX_RADIUS, VIEW_SIZE } from "./svg-utils.js";

const DEFAULT_SEASON_LINE_COLOR = "rgba(255, 255, 255, 0.25)";
const DEFAULT_SEASON_LABEL_COLOR = "rgba(255, 255, 255, 0.5)";
const SEASON_FONT_SIZE = 20;

export function renderSeasonOverlay(
  svg: SVGElement,
  hemisphere: Hemisphere,
  colors: Colors = {},
  eclipticViewDirection = -1
): void {
  const lineColor = colors.season_line ?? DEFAULT_SEASON_LINE_COLOR;
  const labelColor = colors.season_label ?? DEFAULT_SEASON_LABEL_COLOR;
  const isEcliptic = eclipticViewDirection === 1;

  // Dotted dividing lines through the Sun
  svg.appendChild(
    createSvgElement("line", {
      x1: 0,
      y1: CENTER,
      x2: VIEW_SIZE,
      y2: CENTER,
      stroke: lineColor,
      "stroke-width": 1,
      "stroke-dasharray": "4, 6",
    })
  );
  svg.appendChild(
    createSvgElement("line", {
      x1: CENTER,
      y1: 0,
      x2: CENTER,
      y2: VIEW_SIZE,
      stroke: lineColor,
      "stroke-width": 1,
      "stroke-dasharray": "4, 6",
    })
  );

  // Season labels curved along Neptune's orbit.
  //
  // Arc positions are FIXED (same SVG geometry regardless of view direction).
  // Only the season name assigned to each quadrant changes when ecliptic view
  // is active, because looking from the south pole swaps which seasons appear
  // in the visual top vs. bottom half.
  //
  // Fixed quadrant slots [A=top-left, B=top-right, C=bottom-right, D=bottom-left]:
  //
  //   North normal:   A=Winter  B=Autumn  C=Summer  D=Spring
  //   North ecliptic: A=Spring  B=Summer  C=Autumn  D=Winter
  //   South normal:   A=Summer  B=Spring  C=Winter  D=Autumn
  //   South ecliptic: A=Autumn  B=Winter  C=Spring  D=Summer
  const NAME_SLOTS = {
    north: {
      normal: ["Winter", "Autumn", "Summer", "Spring"],
      ecliptic: ["Spring", "Summer", "Autumn", "Winter"],
    },
    south: {
      normal: ["Summer", "Spring", "Winter", "Autumn"],
      ecliptic: ["Autumn", "Winter", "Spring", "Summer"],
    },
  };

  const [nameA, nameB, nameC, nameD] = NAME_SLOTS[hemisphere][isEcliptic ? "ecliptic" : "normal"];

  // Arc geometry: always uses standard math orientation (y = CENTER - r·sin(θ)).
  // isTopHalf drives two things: arc sweep direction (CW vs CCW) for readable text,
  // and a -12 radius trim that compensates for how SVG renders text above a CW arc
  // (glyphs extend outward) vs above a CCW arc (glyphs extend inward).
  const arcDefs = [
    { name: nameA, startAngle: 90, endAngle: 180, isTopHalf: true }, // A: top-left
    { name: nameB, startAngle: 0, endAngle: 90, isTopHalf: true }, // B: top-right
    { name: nameC, startAngle: 270, endAngle: 360, isTopHalf: false }, // C: bottom-right
    { name: nameD, startAngle: 180, endAngle: 270, isTopHalf: false }, // D: bottom-left
  ];

  const labelRadius = MAX_RADIUS + 20;
  const defs =
    svg.querySelector("defs") || svg.insertBefore(createSvgElement("defs", {}), svg.firstChild);

  arcDefs.forEach((season, i) => {
    const pathId = `season-arc-${i}`;
    const startRad = (season.startAngle * Math.PI) / 180;
    const endRad = (season.endAngle * Math.PI) / 180;

    const arcRadius = season.isTopHalf ? labelRadius - 12 : labelRadius;

    const x1 = CENTER + arcRadius * Math.cos(startRad);
    const y1 = CENTER - arcRadius * Math.sin(startRad);
    const x2 = CENTER + arcRadius * Math.cos(endRad);
    const y2 = CENTER - arcRadius * Math.sin(endRad);

    const arcPath = createSvgElement("path", {
      id: pathId,
      d: season.isTopHalf
        ? `M ${x2} ${y2} A ${arcRadius} ${arcRadius} 0 0 1 ${x1} ${y1}`
        : `M ${x1} ${y1} A ${arcRadius} ${arcRadius} 0 0 0 ${x2} ${y2}`,
      fill: "none",
    });
    defs.appendChild(arcPath);

    const text = createSvgElement("text", {
      fill: labelColor,
      "font-size": SEASON_FONT_SIZE,
      "font-family": "sans-serif",
    });
    const textPath = createSvgElement("textPath", {
      href: `#${pathId}`,
      startOffset: "50%",
      "text-anchor": "middle",
    });
    textPath.textContent = season.name;
    text.appendChild(textPath);
    svg.appendChild(text);
  });
}
