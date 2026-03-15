import { CENTER, createSvgElement, MAX_RADIUS, VIEW_SIZE } from "./svg-utils.js";

const SEASON_LINE_COLOR = "rgba(255, 255, 255, 0.25)";
const SEASON_LABEL_COLOR = "rgba(255, 255, 255, 0.5)";
const SEASON_FONT_SIZE = 20;

export function renderSeasonOverlay(svg, hemisphere) {
  // Dotted dividing lines through the Sun
  svg.appendChild(
    createSvgElement("line", {
      x1: 0,
      y1: CENTER,
      x2: VIEW_SIZE,
      y2: CENTER,
      stroke: SEASON_LINE_COLOR,
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
      stroke: SEASON_LINE_COLOR,
      "stroke-width": 1,
      "stroke-dasharray": "4, 6",
    })
  );

  // Season labels curved along Neptune's orbit
  // Quadrant mapping (Northern Hemisphere):
  //   bottom-left = Spring, bottom-right = Summer,
  //   top-right = Autumn, top-left = Winter
  const northSeasons = [
    { name: "Winter", startAngle: 90, endAngle: 180 }, // top-left
    { name: "Autumn", startAngle: 0, endAngle: 90 }, // top-right
    { name: "Summer", startAngle: 270, endAngle: 360 }, // bottom-right
    { name: "Spring", startAngle: 180, endAngle: 270 }, // bottom-left
  ];

  const southSeasons = [
    { name: "Summer", startAngle: 90, endAngle: 180 },
    { name: "Spring", startAngle: 0, endAngle: 90 },
    { name: "Winter", startAngle: 270, endAngle: 360 },
    { name: "Autumn", startAngle: 180, endAngle: 270 },
  ];

  const seasons = hemisphere === "south" ? southSeasons : northSeasons;
  const labelRadius = MAX_RADIUS + 20;

  const defs =
    svg.querySelector("defs") || svg.insertBefore(createSvgElement("defs", {}), svg.firstChild);

  seasons.forEach((season, i) => {
    const pathId = `season-arc-${i}`;

    const startRad = (season.startAngle * Math.PI) / 180;
    const endRad = (season.endAngle * Math.PI) / 180;

    // Top-half arcs (0–90° and 90–180°) render text upside-down because the
    // default arc sweeps right-to-left in SVG space. Reverse them so textPath
    // flows left-to-right for readable labels.
    const isTopHalf = season.startAngle >= 0 && season.endAngle <= 180 && season.startAngle < 180;
    // Use a smaller radius for top-half labels so they appear visually
    // at the same distance from Neptune's orbit as bottom-half labels
    const arcRadius = isTopHalf ? labelRadius - 12 : labelRadius;

    const x1 = CENTER + arcRadius * Math.cos(startRad);
    const y1 = CENTER - arcRadius * Math.sin(startRad);
    const x2 = CENTER + arcRadius * Math.cos(endRad);
    const y2 = CENTER - arcRadius * Math.sin(endRad);

    const arcPath = createSvgElement("path", {
      id: pathId,
      d: isTopHalf
        ? `M ${x2} ${y2} A ${arcRadius} ${arcRadius} 0 0 1 ${x1} ${y1}`
        : `M ${x1} ${y1} A ${arcRadius} ${arcRadius} 0 0 0 ${x2} ${y2}`,
      fill: "none",
    });
    defs.appendChild(arcPath);

    const text = createSvgElement("text", {
      fill: SEASON_LABEL_COLOR,
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

const SEASON_BY_MONTH_NORTH = [
  "Winter", // Jan
  "Winter", // Feb
  "Spring", // Mar
  "Spring", // Apr
  "Spring", // May
  "Summer", // Jun
  "Summer", // Jul
  "Summer", // Aug
  "Autumn", // Sep
  "Autumn", // Oct
  "Autumn", // Nov
  "Winter", // Dec
];

const OPPOSITE_SEASON = {
  Spring: "Autumn",
  Summer: "Winter",
  Autumn: "Spring",
  Winter: "Summer",
};

export function getCurrentSeason(date, hemisphere) {
  const month = date.getMonth();
  const season = SEASON_BY_MONTH_NORTH[month];
  return hemisphere === "south" ? OPPOSITE_SEASON[season] : season;
}

const VIEWPORT_SEASON_GROUP_ID = "viewport-season-label";
const VIEWPORT_SEASON_FONT_SIZE = 14;

export function renderViewportSeasonLabel(date, hemisphere, viewState) {
  const group = createSvgElement("g", { id: VIEWPORT_SEASON_GROUP_ID });

  if (!viewState || viewState.zoomLevel < 2) return group;

  const season = getCurrentSeason(date, hemisphere);
  const w = viewState.width;
  const h = viewState.height;
  const right = viewState.centerX + w / 2;
  const top = viewState.centerY - h / 2;

  const text = createSvgElement("text", {
    fill: SEASON_LABEL_COLOR,
    "font-size": VIEWPORT_SEASON_FONT_SIZE,
    "font-family": "sans-serif",
    "text-anchor": "end",
    x: right - 15,
    y: top + 25,
  });
  text.textContent = season;
  group.appendChild(text);

  return group;
}

export { VIEWPORT_SEASON_GROUP_ID };
