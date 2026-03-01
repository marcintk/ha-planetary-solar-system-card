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
const DAY_OVERLAY_OUTER = "rgba(255, 255, 255, 0.03)";  // 180° max sky
const DAY_OVERLAY_INNER = "rgba(200, 220, 255, 0.04)";  // 150° practical
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

  // AU labels on the vertical axis — mirrored above and below center
  // Offset right of the season dividing line to avoid overlap
  const offset = 3;
  const horizontalOffset = 3;
  const labelAttrs = {
    fill: LABEL_COLOR,
    "font-size": "9",
    "font-family": "sans-serif",
    "text-anchor": "start",
  };

  // Top label
  svg.appendChild(
    createSvgElement("text", {
      x: CENTER + horizontalOffset,
      y: CENTER - radius - offset,
      ...labelAttrs,
    })
  ).textContent = `${Number(auLabel).toFixed(1)} AU`;

  // Bottom label
  svg.appendChild(
    createSvgElement("text", {
      x: CENTER + horizontalOffset,
      y: CENTER + radius + offset + 6,
      ...labelAttrs,
    })
  ).textContent = `${Number(auLabel).toFixed(1)} AU`;
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

function renderSaturnRings(svg, x, y, body, renderSize) {
  const hex = body.color;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const ringColor = `rgba(${r}, ${g}, ${b}, 0.6)`;

  // Outer ring (r=23, stroke-width=2): outer edge 24px, inner edge 22px
  svg.appendChild(
    createSvgElement("circle", {
      cx: x,
      cy: y,
      r: 23,
      fill: "none",
      stroke: ringColor,
      "stroke-width": 2,
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
      stroke: ringColor,
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

function renderVisibilityCone(svg, anchorX, anchorY, observerAngle, halfAngleDeg, clipId, fillColor) {
  const D = VIEW_SIZE;
  const HALF_ANGLE = (halfAngleDeg * Math.PI) / 180;
  const largeArcFlag = halfAngleDeg >= 90 ? 1 : 0;

  const leftAngle = observerAngle + HALF_ANGLE;
  const rightAngle = observerAngle - HALF_ANGLE;
  const leftX = anchorX + D * Math.cos(leftAngle);
  const leftY = anchorY - D * Math.sin(leftAngle);
  const rightX = anchorX + D * Math.cos(rightAngle);
  const rightY = anchorY - D * Math.sin(rightAngle);

  // SVG path: MoveTo apex, LineTo left edge, Arc to right edge, ClosePath
  const pathD = `M ${anchorX} ${anchorY} L ${leftX} ${leftY} A ${D} ${D} 0 ${largeArcFlag} 1 ${rightX} ${rightY} Z`;

  const defs = svg.querySelector("defs") || svg.insertBefore(createSvgElement("defs", {}), svg.firstChild);

  const clipPath = createSvgElement("clipPath", { id: clipId });
  clipPath.appendChild(createSvgElement("path", { d: pathD }));
  defs.appendChild(clipPath);

  svg.appendChild(
    createSvgElement("circle", {
      cx: CENTER,
      cy: CENTER,
      r: MAX_RADIUS + 30,
      fill: fillColor,
      "clip-path": `url(#${clipId})`,
    })
  );
}

function renderDayNightSplit(svg, earthRadius, date, earthBodySize) {
  const earth = PLANETS.find((p) => p.name === "Earth");
  const earthAngle = calculatePlanetPosition(earth, date);
  const observerAngle = calculateObserverAngle(earthAngle, date);

  const earthDirX = Math.cos(earthAngle);
  const earthDirY = Math.sin(earthAngle);
  const obsDirX = Math.cos(observerAngle);
  const obsDirY = Math.sin(observerAngle);

  // Anchor point at Earth's surface
  const earthOrbitalX = CENTER + earthRadius * earthDirX;
  const earthOrbitalY = CENTER - earthRadius * earthDirY;
  const anchorX = earthOrbitalX + earthBodySize * obsDirX;
  const anchorY = earthOrbitalY - earthBodySize * obsDirY;

  // 180° hemisphere (maximum sky)
  renderVisibilityCone(svg, anchorX, anchorY, observerAngle, 90, "sky-clip-outer", DAY_OVERLAY_OUTER);
  // 150° practical observation range
  renderVisibilityCone(svg, anchorX, anchorY, observerAngle, 75, "sky-clip-inner", DAY_OVERLAY_INNER);
}

function renderObserverNeedle(svg, earthX, earthY, observerAngle, earthSize) {
  const tipX = earthX + earthSize * Math.cos(observerAngle);
  const tipY = earthY - earthSize * Math.sin(observerAngle);

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
  const earth = PLANETS.find((p) => p.name === "Earth");
  const earthRadius = auToRadius(1.0);
  renderDayNightSplit(svg, earthRadius, date, earth.size);

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
    if (planet.name === "Saturn") {
      // Shrink Saturn's body to make room for top-down circular ring
      const saturnRenderSize = Math.round(planet.size / 2);
      const saturnOverride = { ...planet, size: saturnRenderSize };
      renderBody(svg, x, y, saturnOverride, false);
      expandBounds(bounds, x, y, saturnOverride.size + 20);
      renderSaturnRings(svg, x, y, planet, saturnRenderSize);
      // Draw label after rings so it paints on top
      svg.appendChild(
        createSvgElement("text", {
          x: x,
          y: y - saturnRenderSize - 16,
          fill: "#ffffff",
          "font-size": "11",
          "font-family": "sans-serif",
          "text-anchor": "middle",
        })
      ).textContent = planet.name;
      // Total footprint: ring outer edge = ringRadius + strokeWidth/2 = (planet.size - 2) + 2 = planet.size
      expandBounds(bounds, x, y, planet.size);
    } else {
      renderBody(svg, x, y, planet);
      // Account for body size + label height (~17px above body)
      expandBounds(bounds, x, y, planet.size + 17);
    }
  }

  // Draw Moon near Earth
  const earthAngle = calculatePlanetPosition(earth, date);
  const earthPixelRadius = auToRadius(earth.au);
  const earthX = CENTER + earthPixelRadius * Math.cos(earthAngle);
  const earthY = CENTER - earthPixelRadius * Math.sin(earthAngle);

  const moonAngle = calculateMoonPosition(date);
  const moonPixelOffset = 22; // pixels from Earth
  const moonX = earthX + moonPixelOffset * Math.cos(moonAngle);
  const moonY = earthY - moonPixelOffset * Math.sin(moonAngle);

  // Moon orbit (dotted circle centered on Earth)
  svg.appendChild(
    createSvgElement("circle", {
      cx: earthX,
      cy: earthY,
      r: moonPixelOffset,
      fill: "none",
      stroke: ORBIT_COLOR,
      "stroke-width": 0.5,
      "stroke-dasharray": "2, 3",
    })
  );

  renderBody(svg, moonX, moonY, MOON);
  expandBounds(bounds, moonX, moonY, MOON.size + 17);

  // Observer needle on Earth (tip at surface)
  const observerAngle = calculateObserverAngle(earthAngle, date);
  renderObserverNeedle(svg, earthX, earthY, observerAngle, earth.size);

  return { svg, bounds };
}
