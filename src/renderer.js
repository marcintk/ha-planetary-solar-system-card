import {
  SUN,
  PLANETS,
  MOON,
  calculatePlanetPosition,
  calculateMoonPosition,
} from "./planet-data.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const VIEW_SIZE = 800;
const CENTER = VIEW_SIZE / 2;
const ORBIT_COLOR = "rgba(255, 255, 255, 0.12)";
const LABEL_COLOR = "rgba(255, 255, 255, 0.5)";
const DAY_OVERLAY = "rgba(255, 255, 255, 0.04)";
const NEEDLE_LENGTH = 15;
const NEEDLE_COLOR = "rgba(255, 255, 255, 0.7)";

// Log-scale orbit radii so inner planets aren't squished
// Maps AU → pixel radius from center, leaving margin for labels
const MIN_RADIUS = 40;
const MAX_RADIUS = 360;

function auToRadius(au) {
  const minAU = PLANETS[0].au;
  const maxAU = PLANETS[PLANETS.length - 1].au;
  const logMin = Math.log(minAU);
  const logMax = Math.log(maxAU);
  const t = (Math.log(au) - logMin) / (logMax - logMin);
  return MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);
}

function createSvgElement(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  return el;
}

const DIAGONAL_ANGLE = (315 * Math.PI) / 180; // top-right diagonal

function renderOrbit(svg, radius, auLabel) {
  svg.appendChild(
    createSvgElement("circle", {
      cx: CENTER,
      cy: CENTER,
      r: radius,
      fill: "none",
      stroke: ORBIT_COLOR,
      "stroke-width": 1,
      "stroke-dasharray": "5, 5",
    })
  );

  // AU label along the top-right diagonal (315 degrees)
  const labelX = CENTER + (radius + 8) * Math.cos(DIAGONAL_ANGLE);
  const labelY = CENTER - (radius + 8) * Math.sin(DIAGONAL_ANGLE);
  svg.appendChild(
    createSvgElement("text", {
      x: labelX,
      y: labelY,
      fill: LABEL_COLOR,
      "font-size": "9",
      "font-family": "sans-serif",
      "text-anchor": "start",
      transform: `rotate(-45, ${labelX}, ${labelY})`,
    })
  ).textContent = `${auLabel} AU`;
}

function renderBody(svg, x, y, body, showLabel = true) {
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
        fill: "#ffffff",
        "font-size": "11",
        "font-family": "sans-serif",
        "text-anchor": "middle",
      })
    ).textContent = body.name;
  }
}

function renderSaturnRings(svg, x, y, body) {
  const hex = body.color;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  svg.appendChild(
    createSvgElement("ellipse", {
      cx: x,
      cy: y,
      rx: Math.round(body.size * 1.4),
      ry: Math.round(body.size * 0.5),
      fill: "none",
      stroke: `rgba(${r}, ${g}, ${b}, 0.6)`,
      "stroke-width": 6,
    })
  );
}

/**
 * Compute the observer's zenith direction in the ecliptic plane.
 * Combines Earth's orbital angle with Earth's rotation based on local time.
 * At midnight the observer faces away from the Sun; at noon they face toward the Sun.
 * The returned angle points toward the visible sky (observer's zenith).
 * @param {number} earthOrbitalAngle - Earth's orbital position (radians)
 * @param {Date} date - date/time used to extract local hours/minutes
 * @returns {number} observer angle in radians
 */
export function calculateObserverAngle(earthOrbitalAngle, date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const localTimeAngle = ((hours + minutes / 60) / 24) * 2 * Math.PI;
  return earthOrbitalAngle + localTimeAngle;
}

function renderDayNightSplit(svg, earthRadius, date) {
  const clipId = "day-clip";

  const earth = PLANETS.find((p) => p.name === "Earth");
  const earthAngle = calculatePlanetPosition(earth, date);
  const observerAngle = calculateObserverAngle(earthAngle, date);

  // Build a polygon half-plane covering the observer's visible sky hemisphere
  // Boundary passes through Earth's orbital position, perpendicular to observer direction
  const D = VIEW_SIZE;
  const perpX = Math.cos(observerAngle + Math.PI / 2);
  const perpY = Math.sin(observerAngle + Math.PI / 2);
  const earthDirX = Math.cos(earthAngle);
  const earthDirY = Math.sin(earthAngle);
  const obsDirX = Math.cos(observerAngle);
  const obsDirY = Math.sin(observerAngle);

  // Anchor point at Earth's orbital position (offset from Sun center)
  const anchorX = CENTER + earthRadius * earthDirX;
  const anchorY = CENTER - earthRadius * earthDirY;

  // Four vertices: two on the perpendicular line through Earth, two far out in observer direction
  const points = [
    `${anchorX + D * perpX},${anchorY - D * perpY}`,
    `${anchorX - D * perpX},${anchorY + D * perpY}`,
    `${anchorX - D * perpX + D * obsDirX},${anchorY + D * perpY - D * obsDirY}`,
    `${anchorX + D * perpX + D * obsDirX},${anchorY - D * perpY - D * obsDirY}`,
  ].join(" ");

  const defs = svg.querySelector("defs") || svg.insertBefore(createSvgElement("defs", {}), svg.firstChild);

  const clipPath = createSvgElement("clipPath", { id: clipId });
  clipPath.appendChild(createSvgElement("polygon", { points }));
  defs.appendChild(clipPath);

  svg.appendChild(
    createSvgElement("circle", {
      cx: CENTER,
      cy: CENTER,
      r: MAX_RADIUS + 30,
      fill: DAY_OVERLAY,
      "clip-path": `url(#${clipId})`,
    })
  );
}

function renderObserverNeedle(svg, earthX, earthY, observerAngle) {
  const tipX = earthX + NEEDLE_LENGTH * Math.cos(observerAngle);
  const tipY = earthY - NEEDLE_LENGTH * Math.sin(observerAngle);

  svg.appendChild(
    createSvgElement("line", {
      x1: earthX,
      y1: earthY,
      x2: tipX,
      y2: tipY,
      stroke: NEEDLE_COLOR,
      "stroke-width": 2,
      "stroke-linecap": "round",
    })
  );

  // Small dot at the tip for directionality
  svg.appendChild(
    createSvgElement("circle", {
      cx: tipX,
      cy: tipY,
      r: 2,
      fill: NEEDLE_COLOR,
    })
  );
}

const SEASON_LINE_COLOR = "rgba(255, 255, 255, 0.25)";
const SEASON_LABEL_COLOR = "rgba(255, 255, 255, 0.5)";
const SEASON_FONT_SIZE = 20;

function renderSeasonOverlay(svg, hemisphere) {
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
    { name: "Winter", startAngle: 90, endAngle: 180 },    // top-left
    { name: "Autumn", startAngle: 0, endAngle: 90 },      // top-right
    { name: "Summer", startAngle: 270, endAngle: 360 },   // bottom-right
    { name: "Spring", startAngle: 180, endAngle: 270 },   // bottom-left
  ];

  const southSeasons = [
    { name: "Summer", startAngle: 90, endAngle: 180 },
    { name: "Spring", startAngle: 0, endAngle: 90 },
    { name: "Winter", startAngle: 270, endAngle: 360 },
    { name: "Autumn", startAngle: 180, endAngle: 270 },
  ];

  const seasons = hemisphere === "south" ? southSeasons : northSeasons;
  const labelRadius = MAX_RADIUS + 20;

  const defs = svg.querySelector("defs") || svg.insertBefore(createSvgElement("defs", {}), svg.firstChild);

  seasons.forEach((season, i) => {
    const pathId = `season-arc-${i}`;

    // Create arc path for textPath
    // SVG arcs use clockwise angles from positive x-axis
    // We need to convert our angle convention (counter-clockwise from right)
    // to SVG convention (clockwise from right, y-axis flipped)
    const startRad = (season.startAngle * Math.PI) / 180;
    const endRad = (season.endAngle * Math.PI) / 180;

    // In SVG coordinates (y increases downward), we negate the y component
    const x1 = CENTER + labelRadius * Math.cos(startRad);
    const y1 = CENTER - labelRadius * Math.sin(startRad);
    const x2 = CENTER + labelRadius * Math.cos(endRad);
    const y2 = CENTER - labelRadius * Math.sin(endRad);

    // Arc path from start to end (counter-clockwise in math = clockwise in SVG)
    // sweep-flag=0 for counter-clockwise (shorter arc in SVG coordinates)
    const arcPath = createSvgElement("path", {
      id: pathId,
      d: `M ${x1} ${y1} A ${labelRadius} ${labelRadius} 0 0 0 ${x2} ${y2}`,
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

function expandBounds(bounds, x, y, margin) {
  bounds.minX = Math.min(bounds.minX, x - margin);
  bounds.minY = Math.min(bounds.minY, y - margin);
  bounds.maxX = Math.max(bounds.maxX, x + margin);
  bounds.maxY = Math.max(bounds.maxY, y + margin);
}

/**
 * Renders the solar system SVG and returns it with bounding box metadata.
 * @param {Date} date - date to calculate positions for
 * @param {string} [hemisphere="north"] - "north" or "south" for season labels
 * @returns {{ svg: SVGElement, bounds: { minX: number, minY: number, maxX: number, maxY: number } }}
 */
export function renderSolarSystem(date, hemisphere = "north") {
  const svg = createSvgElement("svg", {
    viewBox: `0 0 ${VIEW_SIZE} ${VIEW_SIZE}`,
    width: "100%",
    height: "100%",
    style: "background: transparent; display: block;",
  });

  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

  // Day/night split (rendered first, behind everything)
  const earthRadius = auToRadius(1.0);
  renderDayNightSplit(svg, earthRadius, date);

  // Season quadrant overlay (after day/night, before orbits)
  renderSeasonOverlay(svg, hemisphere);

  // Draw orbits
  for (const planet of PLANETS) {
    const radius = auToRadius(planet.au);
    renderOrbit(svg, radius, planet.au);
  }

  // Sun at center
  renderBody(svg, CENTER, CENTER, SUN, false);
  expandBounds(bounds, CENTER, CENTER, SUN.size);

  // Draw planets
  for (const planet of PLANETS) {
    const angle = calculatePlanetPosition(planet, date);
    const radius = auToRadius(planet.au);
    const x = CENTER + radius * Math.cos(angle);
    const y = CENTER - radius * Math.sin(angle);
    renderBody(svg, x, y, planet);
    // Account for body size + label height (~17px above body)
    expandBounds(bounds, x, y, planet.size + 17);
    if (planet.name === "Saturn") {
      renderSaturnRings(svg, x, y, planet);
      expandBounds(bounds, x, y, Math.round(planet.size * 1.6));
    }
  }

  // Draw Moon near Earth
  const earth = PLANETS.find((p) => p.name === "Earth");
  const earthAngle = calculatePlanetPosition(earth, date);
  const earthPixelRadius = auToRadius(earth.au);
  const earthX = CENTER + earthPixelRadius * Math.cos(earthAngle);
  const earthY = CENTER - earthPixelRadius * Math.sin(earthAngle);

  const moonAngle = calculateMoonPosition(date);
  const moonPixelOffset = 22; // pixels from Earth
  const moonX = earthX + moonPixelOffset * Math.cos(moonAngle);
  const moonY = earthY - moonPixelOffset * Math.sin(moonAngle);
  renderBody(svg, moonX, moonY, MOON);
  expandBounds(bounds, moonX, moonY, MOON.size + 17);

  // Observer needle on Earth
  const observerAngle = calculateObserverAngle(earthAngle, date);
  renderObserverNeedle(svg, earthX, earthY, observerAngle);

  return { svg, bounds };
}
