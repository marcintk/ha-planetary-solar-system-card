import { COMETS } from "../astronomy/comet-data.js";
import {
  calculateCometPosition,
  calculateMoonPosition,
  calculatePlanetPosition,
} from "../astronomy/orbital-mechanics.js";
import { EARTH, MOON, PLANETS, SUN } from "../astronomy/planet-data.js";
import type { Colors, Hemisphere, LocationData, ViewPosition } from "../types.js";
import { ORBIT_COLOR, renderBody, renderOrbit, renderSaturnRings } from "./bodies.js";
import { computeCometVisualEllipse, renderCometBody, renderCometOrbit } from "./comets.js";
import { renderMoonPhaseIndicator } from "./moon-phase.js";
import { calculateObserverAngle, renderDayNightSplit, renderObserverNeedle } from "./observer.js";
import { renderSeasonOverlay } from "./seasons.js";
import {
  auToRadius,
  BODY_LABEL_ATTRS,
  CENTER,
  createSvgElement,
  DEFAULT_LABEL_COLOR,
  VIEW_SIZE,
} from "./svg-utils.js";

export function renderSolarSystem(
  date: Date,
  hemisphere: Hemisphere = "north",
  locationData: LocationData | null = null,
  colors: Colors = {},
  eclipticView = false
): { svg: SVGSVGElement; positions: ViewPosition[] } {
  const eclipticViewDirection = eclipticView ? 1 : -1;
  const orbitColor = colors.orbit ?? ORBIT_COLOR;
  const labelColor = colors.label ?? DEFAULT_LABEL_COLOR;

  const svg = createSvgElement("svg", {
    viewBox: `0 0 ${VIEW_SIZE} ${VIEW_SIZE}`,
    width: "100%",
    height: "100%",
    style: "background: transparent; display: block;",
  });

  const positions: ViewPosition[] = [];

  // Day/night split (rendered first, behind everything)
  const earthRadius = auToRadius(1.0);
  renderDayNightSplit(svg, earthRadius, date, EARTH.size, locationData, eclipticViewDirection);

  // Season quadrant overlay (after day/night, before orbits)
  renderSeasonOverlay(svg, hemisphere, colors, eclipticViewDirection);

  // Draw orbits (planets then comets, so all orbits are behind bodies)
  for (const planet of PLANETS) {
    const radius = auToRadius(planet.au);
    renderOrbit(svg, radius, planet.au, colors);
  }
  for (const comet of COMETS) {
    renderCometOrbit(svg, comet, colors);
  }

  // Sun at center
  renderBody(svg, CENTER, CENTER, SUN, false, colors);

  // Draw planets
  for (const planet of PLANETS) {
    const angle = calculatePlanetPosition(planet, date);
    const radius = auToRadius(planet.au);
    const x = CENTER + radius * Math.cos(angle);
    const y = CENTER + eclipticViewDirection * radius * Math.sin(angle);
    positions.push({ name: planet.name, x, y, color: planet.color });
    if (planet.name === "Saturn") {
      // Shrink Saturn's body to make room for top-down circular ring
      const saturnRenderSize = Math.round(planet.size / 2);
      const saturnOverride = { ...planet, size: saturnRenderSize };
      renderBody(svg, x, y, saturnOverride, false, colors);
      renderSaturnRings(svg, x, y, planet);
      // Draw label after rings so it paints on top
      svg.appendChild(
        createSvgElement("text", {
          x: x,
          y: y - saturnRenderSize - 16,
          style: `fill: ${labelColor}`,
          ...BODY_LABEL_ATTRS,
        })
      ).textContent = planet.name;
    } else {
      renderBody(svg, x, y, planet, true, colors);
    }
  }

  // Draw comets using visual ellipse for pixel positioning
  for (const comet of COMETS) {
    const { angle, radius, trueAnomaly } = calculateCometPosition(comet, date);
    const { aPx, ePx } = computeCometVisualEllipse(comet);
    const rPx = (aPx * (1 - ePx * ePx)) / (1 + ePx * Math.cos(trueAnomaly));
    const cx = CENTER + rPx * Math.cos(angle);
    const cy = CENTER + eclipticViewDirection * rPx * Math.sin(angle);
    // Tail scales inversely with distance from Sun
    const perihelion = comet.semiMajorAxis * (1 - comet.eccentricity);
    const tailScale = Math.min(1, perihelion / radius);
    const dynamicTail = comet.tailLength * tailScale;
    renderCometBody(svg, cx, cy, comet, CENTER, CENTER, dynamicTail, colors);
    positions.push({ name: comet.name, x: cx, y: cy, color: comet.color });
  }

  // Draw Moon near Earth
  const earthAngle = calculatePlanetPosition(EARTH, date);
  const earthPixelRadius = auToRadius(EARTH.au);
  const earthX = CENTER + earthPixelRadius * Math.cos(earthAngle);
  const earthY = CENTER + eclipticViewDirection * earthPixelRadius * Math.sin(earthAngle);

  const moonAngle = calculateMoonPosition(date);
  const moonPixelOffset = 22; // pixels from Earth
  const moonX = earthX + moonPixelOffset * Math.cos(moonAngle);
  const moonY = earthY + eclipticViewDirection * moonPixelOffset * Math.sin(moonAngle);
  positions.push({ name: MOON.name, x: moonX, y: moonY, color: MOON.color, offscreen: false });

  // Moon orbit (dotted circle centered on Earth)
  svg.appendChild(
    createSvgElement("circle", {
      cx: earthX,
      cy: earthY,
      r: moonPixelOffset,
      fill: "none",
      style: `stroke: ${orbitColor}`,
      "stroke-width": 0.5,
      "stroke-dasharray": "2, 3",
    })
  );

  renderBody(svg, moonX, moonY, MOON, false, colors);

  // Observer needle on Earth (tip at surface)
  const observerAngle = calculateObserverAngle(
    earthAngle,
    date,
    locationData?.timezone,
    locationData?.lon
  );
  renderObserverNeedle(svg, earthX, earthY, observerAngle, EARTH.size, eclipticViewDirection);

  // Moon phase indicator (rendered last so it appears on top)
  renderMoonPhaseIndicator(svg, date, hemisphere);

  return { svg, positions };
}
