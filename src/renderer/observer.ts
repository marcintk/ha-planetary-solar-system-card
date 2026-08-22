import { calculatePlanetPosition } from "../astronomy/orbital-mechanics.js";
import { EARTH } from "../astronomy/planet-data.js";
import {
  computeSolarElevationDeg,
  computeZenithAngleFromSun,
  getLocalTimeInZone,
} from "../astronomy/solar-position.js";
import type { Colors, LocationData } from "../types.js";
import { CENTER, createSvgElement, MAX_RADIUS, polarOffset, VIEW_SIZE } from "./svg-utils.js";

const NEEDLE_COLOR = "color-mix(in srgb, currentColor 70%, transparent)";

// Each band carries its own hue (not just a white/black fade) so it stays visually
// distinct — and readable — against both a light and a dark HA theme background.
// CONE_DAY mixes currentColor rather than a fixed rgba (same trick as NEEDLE_COLOR/
// ORBIT_COLOR below) so it auto-inverts: dark tint on light theme, light tint on dark
// theme — a fixed white was invisible on a light card background.
//
// The twilight/night bands need to keep their own hue (warm → cool → violet → indigo)
// rather than just following currentColor like CONE_DAY — but a fixed rgba tuned to read
// as a distinct tint on a dark background all but disappears on a light one: alpha-blending
// a dark, saturated color into white crushes it down to a barely-there pale gray (little
// hue left to perceive), while the exact same blend into a dark background reads as a
// clear, saturated cast (the hue survives). A small currentColor mix folded into each hue
// before the transparency step fixes this the same self-adapting way CONE_DAY does: on
// light theme currentColor is dark ink, pulling the tint toward black and restoring
// contrast against white; on dark theme currentColor is light, which the outer alpha step
// still keeps subtle enough not to wash out the existing dark-theme look.
export const CONE_DAY = "color-mix(in srgb, currentColor 8%, transparent)"; // Sun above horizon
export const CONE_CIVIL =
  "color-mix(in srgb, color-mix(in srgb, rgb(255, 220, 160) 85%, currentColor 15%) 13%, transparent)"; // Civil twilight:        0° to -6°
export const CONE_NAUTICAL =
  "color-mix(in srgb, color-mix(in srgb, rgb(90, 130, 180) 85%, currentColor 15%) 17%, transparent)"; // Nautical twilight:  -6° to -12°
export const CONE_ASTRONOMICAL =
  "color-mix(in srgb, color-mix(in srgb, rgb(70, 50, 130) 85%, currentColor 15%) 24%, transparent)"; // Astronomical twilight: -12° to -18°
export const CONE_NIGHT =
  "color-mix(in srgb, color-mix(in srgb, rgb(30, 20, 60) 85%, currentColor 15%) 30%, transparent)"; // Sun below -18°

/**
 * Compute the distance from point (ax,ay) along direction (dx,dy) to the
 * intersection with a circle centred at (cx,cy) with radius R.
 * Returns the positive root, or `minLen` if no positive intersection exists.
 */
export function rayCircleDistance(
  ax: number,
  ay: number,
  dx: number,
  dy: number,
  cx: number,
  cy: number,
  R: number,
  minLen = 20
): number {
  const ox = ax - cx;
  const oy = ay - cy;
  const a = dx * dx + dy * dy;
  const b = 2 * (ox * dx + oy * dy);
  const c = ox * ox + oy * oy - R * R;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return minLen;
  const t = (-b + Math.sqrt(disc)) / (2 * a);
  return t > 0 ? t : minLen;
}

export function calculateSolarElevationDeg(observerAngle: number, earthAngle: number): number {
  const dirToSun = earthAngle + Math.PI;
  const diff = Math.atan2(Math.sin(observerAngle - dirToSun), Math.cos(observerAngle - dirToSun));
  return (Math.PI / 2 - Math.abs(diff)) * (180 / Math.PI);
}

/**
 * Compute the observer's zenith direction in the ecliptic plane.
 * Combines Earth's orbital angle with Earth's rotation based on local time.
 * At midnight the observer faces away from the Sun; at noon they face toward the Sun.
 * The returned angle points toward the visible sky (observer's zenith).
 * @param {number} earthOrbitalAngle - Earth's orbital position (radians)
 * @param {Date} date - date/time used to extract local hours/minutes
 * @param {string} [timezone] - optional IANA timezone (e.g. "America/Chicago"); falls back to date.getHours()
 * @param {number} [longitude] - optional observer longitude in degrees; when provided, uses true solar time instead of civil timezone
 * @returns {number} observer angle in radians
 */
export function calculateObserverAngle(
  earthOrbitalAngle: number,
  date: Date,
  timezone?: string,
  longitude?: number
): number {
  let fractionalHours: number;
  if (longitude != null) {
    // True solar time: UTC hours + longitude offset (15° per hour)
    const utcHour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    fractionalHours = (((utcHour + longitude / 15) % 24) + 24) % 24;
  } else if (timezone) {
    const { hours, minutes } = getLocalTimeInZone(date, timezone);
    fractionalHours = hours + minutes / 60;
  } else {
    fractionalHours = date.getHours() + date.getMinutes() / 60;
  }
  const localTimeAngle = (fractionalHours / 24) * 2 * Math.PI;
  return earthOrbitalAngle + localTimeAngle;
}

// Elevation/zenith angle -> which twilight band the visibility cone should show, and how wide
// it should be. Pure so the band boundaries and half-angle geometry are testable without a
// DOM — renderDayNightSplit only calls this and hands the result to renderVisibilityCone.
export function computeTwilightBand(
  elevationDeg: number,
  zenithAngleFromSun: number | null,
  colors: Colors
): { color: string; halfAngle: number } {
  let color: string;
  if (elevationDeg >= 0) color = colors.cone_day ?? CONE_DAY;
  else if (elevationDeg >= -6) color = colors.cone_twilight_civil ?? CONE_CIVIL;
  else if (elevationDeg >= -12) color = colors.cone_twilight_nautical ?? CONE_NAUTICAL;
  else if (elevationDeg >= -18) color = colors.cone_twilight_astronomical ?? CONE_ASTRONOMICAL;
  else color = colors.cone_night ?? CONE_NIGHT;

  // Twilight half-angle must expand in the SAME frame as displayObserverAngle (the cone's
  // axis), or the two disagree away from solar noon/midnight. zenithAngleFromSun is an
  // ecliptic-PLANE PROJECTION of the true 3D zenith angle — so reuse that same projected
  // magnitude here instead of the true unprojected (90 - elevationDeg), which was silently
  // assumed to be interchangeable with it. Using the mismatched true-angle magnitude on a
  // projected axis is exactly what pushed the -6/-12/-18 cone edges away from the Sun's
  // actual direction after sunset (worst at mid latitudes).
  const halfAngle =
    elevationDeg >= 0 || elevationDeg < -18
      ? 90
      : zenithAngleFromSun != null
        ? (Math.abs(zenithAngleFromSun) * 180) / Math.PI
        : 90 - elevationDeg;

  return { color, halfAngle };
}

function renderVisibilityCone(
  svg: SVGElement,
  anchorX: number,
  anchorY: number,
  observerAngle: number,
  halfAngleDeg: number,
  clipId: string,
  fillColor: string,
  eclipticViewDirection = -1
): void {
  const D = VIEW_SIZE;
  const HALF_ANGLE = (halfAngleDeg * Math.PI) / 180;
  /* v8 ignore next */
  const largeArcFlag = halfAngleDeg >= 90 ? 1 : 0;
  // Mirroring the scene (eclipticViewDirection=1, south view) reverses screen chirality,
  // so the sweep direction that passes through the bisector (not the opposite/major arc)
  // flips too. Hardcoding sweep=1 only drew the correct wedge for the north (-1) case.
  const sweepFlag = eclipticViewDirection === -1 ? 1 : 0;

  const left = polarOffset(anchorX, anchorY, D, observerAngle + HALF_ANGLE, eclipticViewDirection);
  const right = polarOffset(anchorX, anchorY, D, observerAngle - HALF_ANGLE, eclipticViewDirection);

  // SVG path: MoveTo apex, LineTo left edge, Arc to right edge, ClosePath
  const pathD = `M ${anchorX} ${anchorY} L ${left.x} ${left.y} A ${D} ${D} 0 ${largeArcFlag} ${sweepFlag} ${right.x} ${right.y} Z`;

  const defs =
    svg.querySelector("defs") || svg.insertBefore(createSvgElement("defs", {}), svg.firstChild);

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

export function renderDayNightSplit(
  svg: SVGElement,
  earthRadius: number,
  date: Date,
  earthBodySize: number,
  locationData: LocationData | null,
  eclipticViewDirection = -1,
  colors: Colors = {}
): void {
  const earthAngle = calculatePlanetPosition(EARTH, date);
  const observerAngle = calculateObserverAngle(
    earthAngle,
    date,
    locationData?.timezone,
    locationData?.lon
  );

  // Anchor point at Earth's surface: out to Earth's orbit, then out again by the body's own
  // radius in the direction the observer faces.
  const earthOrbital = polarOffset(CENTER, CENTER, earthRadius, earthAngle, eclipticViewDirection);
  const { x: anchorX, y: anchorY } = polarOffset(
    earthOrbital.x,
    earthOrbital.y,
    earthBodySize,
    observerAngle,
    eclipticViewDirection
  );

  // Filled cone — colour determined by which twilight phase the solar elevation falls in.
  // Half-angle = 90° − elevationDeg expands the cone below the horizon during twilight.
  // When real location data is available, use spherical astronomy; otherwise fall back to
  // the orbital approximation so the card works without a hass object (tests, previews).
  const elevationDeg =
    locationData && locationData.lat != null
      ? computeSolarElevationDeg(locationData.lat, locationData.lon, date)
      : calculateSolarElevationDeg(observerAngle, earthAngle);

  // When lat/lon is available, derive a display angle from the observer's true zenith
  // direction, projected onto the ecliptic plane. The 2D orbital model assumes 12h
  // day/night; at high latitudes this diverges significantly from true sunrise/sunset.
  // The projection is continuous through both solar noon and midnight by construction,
  // unlike inverting elevation with a sign borrowed from the approximate 2D model (which
  // jumped at midnight — see #78). The needle keeps the time-based observerAngle so it
  // continues showing Earth's rotation.
  const zenithAngleFromSun =
    locationData && locationData.lat != null
      ? computeZenithAngleFromSun(locationData.lat, locationData.lon, date)
      : null;
  const displayObserverAngle =
    zenithAngleFromSun != null ? earthAngle + Math.PI + zenithAngleFromSun : observerAngle;

  const { color: coneColor, halfAngle } = computeTwilightBand(
    elevationDeg,
    zenithAngleFromSun,
    colors
  );
  renderVisibilityCone(
    svg,
    anchorX,
    anchorY,
    displayObserverAngle,
    halfAngle,
    "sky-clip",
    coneColor,
    eclipticViewDirection
  );

  // Shared constants for horizon and zenith lines
  const CLIP_R = MAX_RADIUS + 30;
  const EXTRA = 8;
  const lineStyle = {
    style: "stroke: color-mix(in srgb, currentColor 30%, transparent)",
    "stroke-width": 1,
    "stroke-dasharray": "4, 4",
  };

  // Where an arm cast from the anchor at `angle` meets the cone's clip circle, plus a margin.
  // The unit direction handed to rayCircleDistance carries the same mirror as the endpoint it
  // ends up producing, so both go through polarOffset rather than spelling the sine out twice.
  const armEnd = (angle: number) => {
    const dir = polarOffset(0, 0, 1, angle, eclipticViewDirection);
    const dist = rayCircleDistance(anchorX, anchorY, dir.x, dir.y, CENTER, CENTER, CLIP_R) + EXTRA;
    return polarOffset(anchorX, anchorY, dist, angle, eclipticViewDirection);
  };

  // Horizon line — each arm extends to the cone clip circle edge + margin
  const left = armEnd(displayObserverAngle + Math.PI / 2);
  const right = armEnd(displayObserverAngle - Math.PI / 2);
  svg.appendChild(
    createSvgElement("line", {
      ...lineStyle,
      x1: left.x,
      y1: left.y,
      x2: right.x,
      y2: right.y,
    })
  );

  // Zenith line — from anchor skyward only (no nadir segment)
  const zenith = armEnd(displayObserverAngle);
  svg.appendChild(
    createSvgElement("line", {
      ...lineStyle,
      x1: anchorX,
      y1: anchorY,
      x2: zenith.x,
      y2: zenith.y,
    })
  );
}

export function renderObserverNeedle(
  svg: SVGElement,
  earthX: number,
  earthY: number,
  observerAngle: number,
  earthSize: number,
  eclipticViewDirection = -1
): void {
  const tip = polarOffset(earthX, earthY, earthSize, observerAngle, eclipticViewDirection);

  svg.appendChild(
    createSvgElement("line", {
      x1: earthX,
      y1: earthY,
      x2: tip.x,
      y2: tip.y,
      style: `stroke: ${NEEDLE_COLOR}`,
      "stroke-width": 2,
      "stroke-linecap": "round",
    })
  );

  // Small dot at the tip for directionality
  svg.appendChild(
    createSvgElement("circle", {
      cx: tip.x,
      cy: tip.y,
      r: 2,
      style: `fill: ${NEEDLE_COLOR}`,
    })
  );
}
