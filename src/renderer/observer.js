import { calculatePlanetPosition } from "../astronomy/orbital-mechanics.js";
import { PLANETS } from "../astronomy/planet-data.js";
import { computeSolarElevationDeg, getLocalTimeInZone } from "../astronomy/solar-position.js";
import { CENTER, createSvgElement, MAX_RADIUS, VIEW_SIZE } from "./svg-utils.js";

const NEEDLE_COLOR = "rgba(255, 255, 255, 0.7)";

export const CONE_DAY = "rgba(255, 255, 255, 0.1)"; // Sun above horizon
export const CONE_CIVIL = "rgba(255, 220, 160, 0.08)"; // Civil twilight:        0° to -6°
export const CONE_NAUTICAL = "rgba(160, 190, 255, 0.06)"; // Nautical twilight:   -6° to -12°
export const CONE_ASTRONOMICAL = "rgba(80, 100, 200, 0.04)"; // Astronomical twilight: -12° to -18°
export const CONE_NIGHT = "rgba(255, 255, 255, 0.01)"; // Sun below -18°

/**
 * Compute the Sun's elevation angle in degrees from the observer's horizon.
 * Positive = Sun above horizon (day), negative = Sun below horizon (night).
 * Uses atan2 to correctly handle 2π wrap-around.
 * @param {number} observerAngle - observer zenith direction (radians)
 * @param {number} earthAngle - Earth's orbital angle from Sun (radians)
 * @returns {number} solar elevation in degrees, range [-90, 90]
 */

/**
 * Compute the distance from point (ax,ay) along direction (dx,dy) to the
 * intersection with a circle centred at (cx,cy) with radius R.
 * Returns the positive root, or `minLen` if no positive intersection exists.
 */
export function rayCircleDistance(ax, ay, dx, dy, cx, cy, R, minLen = 20) {
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

export function calculateSolarElevationDeg(observerAngle, earthAngle) {
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
export function calculateObserverAngle(earthOrbitalAngle, date, timezone, longitude) {
  let fractionalHours;
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

function renderVisibilityCone(
  svg,
  anchorX,
  anchorY,
  observerAngle,
  halfAngleDeg,
  clipId,
  fillColor
) {
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

export function renderDayNightSplit(svg, earthRadius, date, earthBodySize, locationData) {
  const earth = PLANETS.find((p) => p.name === "Earth");
  const earthAngle = calculatePlanetPosition(earth, date);
  const observerAngle = calculateObserverAngle(
    earthAngle,
    date,
    locationData?.timezone,
    locationData?.lon
  );

  const earthDirX = Math.cos(earthAngle);
  const earthDirY = Math.sin(earthAngle);
  const obsDirX = Math.cos(observerAngle);
  const obsDirY = Math.sin(observerAngle);

  // Anchor point at Earth's surface
  const earthOrbitalX = CENTER + earthRadius * earthDirX;
  const earthOrbitalY = CENTER - earthRadius * earthDirY;
  const anchorX = earthOrbitalX + earthBodySize * obsDirX;
  const anchorY = earthOrbitalY - earthBodySize * obsDirY;

  // Filled cone — colour determined by which twilight phase the solar elevation falls in.
  // Half-angle = 90° − elevationDeg expands the cone below the horizon during twilight.
  // When real location data is available, use spherical astronomy; otherwise fall back to
  // the orbital approximation so the card works without a hass object (tests, previews).
  const elevationDeg =
    locationData && locationData.lat != null
      ? computeSolarElevationDeg(locationData.lat, locationData.lon, date)
      : calculateSolarElevationDeg(observerAngle, earthAngle);
  let coneColor;
  if (elevationDeg >= 0) coneColor = CONE_DAY;
  else if (elevationDeg >= -6) coneColor = CONE_CIVIL;
  else if (elevationDeg >= -12) coneColor = CONE_NAUTICAL;
  else if (elevationDeg >= -18) coneColor = CONE_ASTRONOMICAL;
  else coneColor = CONE_NIGHT;
  const halfAngle = elevationDeg >= 0 || elevationDeg < -18 ? 90 : 90 - elevationDeg;
  renderVisibilityCone(svg, anchorX, anchorY, observerAngle, halfAngle, "sky-clip", coneColor);

  // Shared constants for horizon and zenith lines
  const CLIP_R = MAX_RADIUS + 30;
  const EXTRA = 8;
  const lineStyle = {
    stroke: "rgba(255, 255, 255, 0.3)",
    "stroke-width": 1,
    "stroke-dasharray": "4, 4",
  };

  // Horizon line — each arm extends to the cone clip circle edge + margin
  const leftAngle = observerAngle + Math.PI / 2;
  const rightAngle = observerAngle - Math.PI / 2;
  const leftD =
    rayCircleDistance(
      anchorX,
      anchorY,
      Math.cos(leftAngle),
      -Math.sin(leftAngle),
      CENTER,
      CENTER,
      CLIP_R
    ) + EXTRA;
  const rightD =
    rayCircleDistance(
      anchorX,
      anchorY,
      Math.cos(rightAngle),
      -Math.sin(rightAngle),
      CENTER,
      CENTER,
      CLIP_R
    ) + EXTRA;
  svg.appendChild(
    createSvgElement("line", {
      ...lineStyle,
      x1: anchorX + leftD * Math.cos(leftAngle),
      y1: anchorY - leftD * Math.sin(leftAngle),
      x2: anchorX + rightD * Math.cos(rightAngle),
      y2: anchorY - rightD * Math.sin(rightAngle),
    })
  );

  // Zenith line — from anchor skyward only (no nadir segment)
  const zenithD =
    rayCircleDistance(
      anchorX,
      anchorY,
      Math.cos(observerAngle),
      -Math.sin(observerAngle),
      CENTER,
      CENTER,
      CLIP_R
    ) + EXTRA;
  svg.appendChild(
    createSvgElement("line", {
      ...lineStyle,
      x1: anchorX,
      y1: anchorY,
      x2: anchorX + zenithD * Math.cos(observerAngle),
      y2: anchorY - zenithD * Math.sin(observerAngle),
    })
  );
}

export function renderObserverNeedle(svg, earthX, earthY, observerAngle, earthSize) {
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
