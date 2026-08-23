import { COMETS } from "../astronomy/comet-data.js";
import {
  calculateCometPosition,
  calculateMoonPosition,
  calculatePlanetOrbit,
} from "../astronomy/orbital-mechanics.js";
import { EARTH, MOON, MOON_PIXEL_OFFSET, PLANETS, SUN } from "../astronomy/planet-data.js";
import type { Colors, Hemisphere, LocationData, PanZoomState, ViewPosition } from "../types.js";
import {
  ORBIT_COLOR,
  renderBody,
  renderOrbit,
  renderSaturnRings,
  SATURN_RING_OUTER_RADIUS,
} from "./bodies.js";
import { computeCometVisualEllipse, renderCometBody, renderCometOrbit } from "./comets.js";
import { type LabelTarget, renderDynamicLabels } from "./labels.js";
import { calculateObserverAngle, renderDayNightSplit, renderObserverNeedle } from "./observer.js";
import { MARKER_GROUP_ID, renderOffscreenMarkers } from "./offscreen-markers.js";
import { computePlanetVisualEllipse, packOrbitRadii } from "./orbit-packing.js";
import { renderSeasonOverlay } from "./seasons.js";
import {
  auToRadius,
  CENTER,
  createSvgElement,
  DEFAULT_LABEL_COLOR,
  polarFromFocus,
  polarOffset,
  VIEW_SIZE,
} from "./svg-utils.js";

export function renderSolarSystem(
  date: Date,
  hemisphere: Hemisphere = "north",
  locationData: LocationData | null = null,
  colors: Colors = {},
  eclipticView = false
): {
  svg: SVGSVGElement;
  positions: ViewPosition[];
  updateMarkers: (viewState: PanZoomState, aspect?: number) => void;
} {
  const eclipticViewDirection = eclipticView ? 1 : -1;

  const svg = createSvgElement("svg", {
    viewBox: `0 0 ${VIEW_SIZE} ${VIEW_SIZE}`,
    width: "100%",
    height: "100%",
    style: "background: transparent; display: block;",
  });

  const positions: ViewPosition[] = [];
  const planetLabels: LabelTarget[] = [];

  // Natural log-scale AU->px radii can pack tightly enough that adjacent
  // orbits visually touch at conjunction (e.g. Jupiter/Saturn) or crowd the
  // Moon's orbit against Earth's neighbors (#62). Pack them with a minimum
  // gap up front; every orbit/body position below uses this table instead
  // of calling auToRadius directly.
  const orbitRadii = packOrbitRadii(PLANETS);
  const EARTH_INDEX = PLANETS.indexOf(EARTH);

  // Elliptical (Keplerian) orbit geometry in pixel space, one per planet.
  // packedOffset carries packOrbitRadii's anti-crowding push-out into the
  // ellipse so the marker (drawn from the same ellipse) never drifts off
  // the ring (#94).
  const planetEllipses = PLANETS.map((planet, i) => {
    const packedOffset = orbitRadii[i] - auToRadius(planet.au);
    return computePlanetVisualEllipse(planet, packedOffset);
  });

  // Day/night split (rendered first, behind everything)
  const earthRadius = orbitRadii[EARTH_INDEX];
  renderDayNightSplit(svg, earthRadius, date, locationData, eclipticViewDirection, colors);

  // Season quadrant overlay (after day/night, before orbits)
  renderSeasonOverlay(svg, hemisphere, colors, eclipticViewDirection);

  // Draw orbits (planets then comets, so all orbits are behind bodies)
  planetEllipses.forEach((ellipse) => {
    renderOrbit(svg, ellipse, eclipticViewDirection);
  });
  for (const comet of COMETS) {
    renderCometOrbit(svg, comet, eclipticViewDirection);
  }

  // Sun at center
  renderBody(svg, CENTER, CENTER, SUN, false);

  // Draw planets (labels rendered in a separate dynamic-placement pass below,
  // once every body's position is known)
  let earthX = CENTER;
  let earthY = CENTER;
  let earthAngle = 0;

  PLANETS.forEach((planet, i) => {
    const { angle, trueAnomaly } = calculatePlanetOrbit(planet, date);
    const { aPx, ePx } = planetEllipses[i];
    const { x, y } = polarFromFocus(aPx, ePx, trueAnomaly, angle, eclipticViewDirection);
    if (planet.name === EARTH.name) {
      earthX = x;
      earthY = y;
      earthAngle = angle;
    }
    positions.push({ name: planet.name, x, y, color: planet.color });
    if (planet.name === "Saturn") {
      // Shrink Saturn's body to make room for top-down circular ring
      const saturnRenderSize = Math.round(planet.size / 2);
      const saturnOverride = { ...planet, size: saturnRenderSize };
      renderBody(svg, x, y, saturnOverride, false);
      renderSaturnRings(svg, x, y, planet);
      planetLabels.push({ name: planet.name, x, y, radius: SATURN_RING_OUTER_RADIUS });
    } else {
      renderBody(svg, x, y, planet, false);
      planetLabels.push({ name: planet.name, x, y, radius: planet.size });
    }
  });

  // Draw comets using visual ellipse for pixel positioning
  for (const comet of COMETS) {
    const { angle, radius, trueAnomaly } = calculateCometPosition(comet, date);
    const { aPx, ePx } = computeCometVisualEllipse(comet);
    const { x: cx, y: cy } = polarFromFocus(aPx, ePx, trueAnomaly, angle, eclipticViewDirection);
    // Tail scales inversely with distance from Sun
    const perihelion = comet.semiMajorAxis * (1 - comet.eccentricity);
    const tailScale = Math.min(1, perihelion / radius);
    const dynamicTail = comet.tailLength * tailScale;
    renderCometBody(svg, cx, cy, comet, CENTER, CENTER, dynamicTail);
    positions.push({ name: comet.name, x: cx, y: cy, color: comet.color });
  }

  // Draw Moon near Earth (earthX/earthY/earthAngle set in the planet loop above)

  // Earth's orbit-packing bubble (see orbit-packing.ts) already reserves
  // room for the Moon's full circle on both sides, so it never needs
  // clamping into Venus's or Mars's orbit (#62).
  const moonAngle = calculateMoonPosition(date);
  const { x: moonX, y: moonY } = polarOffset(
    earthX,
    earthY,
    MOON_PIXEL_OFFSET,
    moonAngle,
    eclipticViewDirection
  );

  positions.push({ name: MOON.name, x: moonX, y: moonY, color: MOON.color });
  planetLabels.push({ name: MOON.name, x: moonX, y: moonY, radius: MOON.size });

  // Moon orbit (dashed circle centered on Earth). Same stroke weight and dash pattern as
  // every other orbit (renderOrbit in bodies.ts) — at half a pixel it read as a fainter ring
  // than its neighbours even though the colour was already identical.
  svg.appendChild(
    createSvgElement("circle", {
      cx: earthX,
      cy: earthY,
      r: MOON_PIXEL_OFFSET,
      fill: "none",
      style: `stroke: ${ORBIT_COLOR}`,
      "stroke-width": 1,
      "stroke-dasharray": "5, 5",
    })
  );

  renderBody(svg, moonX, moonY, MOON, false);

  // Planet + Moon labels, placed once every body's final position is known
  // so each label can steer away from its nearest neighbor instead of
  // always sitting above the body (#62 follow-up). The Sun isn't in
  // `positions` (it's never a click/offscreen target), but inner planets
  // like Mercury still need their label to route away from it.
  const labelObstacles: ViewPosition[] = [
    ...positions,
    { name: SUN.name, x: CENTER, y: CENTER, color: SUN.color },
  ];
  renderDynamicLabels(svg, planetLabels, labelObstacles, DEFAULT_LABEL_COLOR);

  // Observer needle on Earth (tip at surface)
  const observerAngle = calculateObserverAngle(
    earthAngle,
    date,
    locationData?.timezone,
    locationData?.lon
  );
  renderObserverNeedle(svg, earthX, earthY, observerAngle, EARTH.size, eclipticViewDirection);

  // Re-derives which bodies' markers belong offscreen from this render's positions and the
  // caller's current pan/zoom — cheap enough to call on every drag/zoom tick without rebuilding
  // the rest of the SVG. Owns the marker group's DOM lifecycle (replace-by-id) so callers never
  // need to know MARKER_GROUP_ID or reach into the SVG themselves.
  function updateMarkers(viewState: PanZoomState, aspect?: number): void {
    const old = svg.getElementById(MARKER_GROUP_ID);
    if (old) old.remove();
    svg.appendChild(renderOffscreenMarkers(positions, viewState, aspect));
  }

  // `positions` feeds updateMarkers above, and is returned so tests can measure real
  // separation between bodies at conjunction (test/renderer/collision.test.ts, #62) from the
  // same numbers the scene was drawn with, rather than reading coordinates back out of the
  // SVG. No src/ caller reads it.
  return { svg, positions, updateMarkers };
}
