import { calculateMoonPosition, calculatePlanetPosition } from "../astronomy/orbital-mechanics.js";
import { MOON, PLANETS, SUN } from "../astronomy/planet-data.js";
import { ORBIT_COLOR, renderBody, renderOrbit, renderSaturnRings } from "./bodies.js";
import { renderMoonPhaseIndicator } from "./moon-phase.js";
import { calculateObserverAngle, renderDayNightSplit, renderObserverNeedle } from "./observer.js";
import { renderSeasonOverlay } from "./seasons.js";
import { auToRadius, CENTER, createSvgElement, expandBounds, VIEW_SIZE } from "./svg-utils.js";

/**
 * Renders the solar system SVG and returns it with bounding box metadata.
 * @param {Date} date - date to calculate positions for
 * @param {string} [hemisphere="north"] - "north" or "south" for season labels
 * @param {{ lat: number, lon: number, timezone: string } | null} [locationData] - observer location from HA config
 * @param {{ zoomLevel: number, width: number, height: number, centerX: number, centerY: number } | null} [viewState] - current view state for zoom-aware rendering
 * @returns {{ svg: SVGElement, bounds: { minX: number, minY: number, maxX: number, maxY: number } }}
 */
export function renderSolarSystem(
  date,
  hemisphere = "north",
  locationData = null,
  viewState = null
) {
  const svg = createSvgElement("svg", {
    viewBox: `0 0 ${VIEW_SIZE} ${VIEW_SIZE}`,
    width: "100%",
    height: "100%",
    style: "background: transparent; display: block;",
  });

  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const positions = [];

  // Day/night split (rendered first, behind everything)
  const earth = PLANETS.find((p) => p.name === "Earth");
  const earthRadius = auToRadius(1.0);
  renderDayNightSplit(svg, earthRadius, date, earth.size, locationData);

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
    positions.push({ name: planet.name, x, y, color: planet.color });
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
  positions.push({ name: MOON.name, x: moonX, y: moonY, color: MOON.color, offscreen: false });

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

  renderBody(svg, moonX, moonY, MOON, false);
  expandBounds(bounds, moonX, moonY, MOON.size + 17);

  // Observer needle on Earth (tip at surface)
  const observerAngle = calculateObserverAngle(
    earthAngle,
    date,
    locationData?.timezone,
    locationData?.lon
  );
  renderObserverNeedle(svg, earthX, earthY, observerAngle, earth.size);

  // Moon phase indicator (rendered last so it appears on top)
  renderMoonPhaseIndicator(svg, date, hemisphere);

  return { svg, bounds, positions };
}
