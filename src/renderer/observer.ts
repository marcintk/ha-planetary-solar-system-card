import { calculatePlanetPosition } from "../astronomy/orbital-mechanics.js";
import { EARTH } from "../astronomy/planet-data.js";
import {
  computeSolarElevationDeg,
  computeZenithAngleFromSun,
  getLocalTimeInZone,
} from "../astronomy/solar-position.js";
import type { Colors, LocationData } from "../types.js";
import { CENTER, createSvgElement, MAX_RADIUS, VIEW_SIZE } from "./svg-utils.js";

const NEEDLE_COLOR = "color-mix(in srgb, currentColor 70%, transparent)";

// Each band carries its own hue (not just a white/black fade) so it stays visually
// distinct — and readable — against both a light and a dark HA theme background.
// White-based CONE_DAY still pops on dark theme, fades on light theme by design (daytime
// is the "nothing to see" state); the twilight/night bands below use enough alpha and a
// hue shift (warm → cool → violet → indigo) to stay legible on dark card backgrounds too.
export const CONE_DAY = "rgba(255, 255, 255, 0.10)"; // Sun above horizon
export const CONE_CIVIL = "rgba(255, 220, 160, 0.09)"; // Civil twilight:        0° to -6°
export const CONE_NAUTICAL = "rgba(90, 130, 180, 0.12)"; // Nautical twilight:  -6° to -12°
export const CONE_ASTRONOMICAL = "rgba(70, 50, 130, 0.18)"; // Astronomical twilight: -12° to -18°
export const CONE_NIGHT = "rgba(30, 20, 60, 0.22)"; // Sun below -18°

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

  const leftAngle = observerAngle + HALF_ANGLE;
  const rightAngle = observerAngle - HALF_ANGLE;
  const leftX = anchorX + D * Math.cos(leftAngle);
  const leftY = anchorY + eclipticViewDirection * D * Math.sin(leftAngle);
  const rightX = anchorX + D * Math.cos(rightAngle);
  const rightY = anchorY + eclipticViewDirection * D * Math.sin(rightAngle);

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

  const earthDirX = Math.cos(earthAngle);
  const earthDirY = Math.sin(earthAngle);
  const obsDirX = Math.cos(observerAngle);
  const obsDirY = Math.sin(observerAngle);

  // Anchor point at Earth's surface
  const earthOrbitalX = CENTER + earthRadius * earthDirX;
  const earthOrbitalY = CENTER + eclipticViewDirection * earthRadius * earthDirY;
  const anchorX = earthOrbitalX + earthBodySize * obsDirX;
  const anchorY = earthOrbitalY + eclipticViewDirection * earthBodySize * obsDirY;

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

  let coneColor: string;
  if (elevationDeg >= 0) coneColor = colors.twilight_day ?? CONE_DAY;
  else if (elevationDeg >= -6) coneColor = colors.twilight_civil ?? CONE_CIVIL;
  else if (elevationDeg >= -12) coneColor = colors.twilight_nautical ?? CONE_NAUTICAL;
  else if (elevationDeg >= -18) coneColor = colors.twilight_astronomical ?? CONE_ASTRONOMICAL;
  else coneColor = colors.twilight_night ?? CONE_NIGHT;

  // Twilight half-angle must expand in the SAME frame as displayObserverAngle (the cone's
  // axis), or the two disagree away from solar noon/midnight. displayObserverAngle is built
  // from zenithAngleFromSun, an ecliptic-PLANE PROJECTION of the true 3D zenith angle — so
  // reuse that same projected magnitude here instead of the true unprojected (90 -
  // elevationDeg), which was silently assumed to be interchangeable with it. Using the
  // mismatched true-angle magnitude on a projected axis is exactly what pushed the -6/-12/-18
  // cone edges away from the Sun's actual direction after sunset (worst at mid latitudes).
  const halfAngle =
    elevationDeg >= 0 || elevationDeg < -18
      ? 90
      : zenithAngleFromSun != null
        ? (Math.abs(zenithAngleFromSun) * 180) / Math.PI
        : 90 - elevationDeg;
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

  // Horizon line — each arm extends to the cone clip circle edge + margin
  const leftAngle = displayObserverAngle + Math.PI / 2;
  const rightAngle = displayObserverAngle - Math.PI / 2;
  const leftD =
    rayCircleDistance(
      anchorX,
      anchorY,
      Math.cos(leftAngle),
      eclipticViewDirection * Math.sin(leftAngle),
      CENTER,
      CENTER,
      CLIP_R
    ) + EXTRA;
  const rightD =
    rayCircleDistance(
      anchorX,
      anchorY,
      Math.cos(rightAngle),
      eclipticViewDirection * Math.sin(rightAngle),
      CENTER,
      CENTER,
      CLIP_R
    ) + EXTRA;
  svg.appendChild(
    createSvgElement("line", {
      ...lineStyle,
      x1: anchorX + leftD * Math.cos(leftAngle),
      y1: anchorY + eclipticViewDirection * leftD * Math.sin(leftAngle),
      x2: anchorX + rightD * Math.cos(rightAngle),
      y2: anchorY + eclipticViewDirection * rightD * Math.sin(rightAngle),
    })
  );

  // Zenith line — from anchor skyward only (no nadir segment)
  const zenithD =
    rayCircleDistance(
      anchorX,
      anchorY,
      Math.cos(displayObserverAngle),
      eclipticViewDirection * Math.sin(displayObserverAngle),
      CENTER,
      CENTER,
      CLIP_R
    ) + EXTRA;
  svg.appendChild(
    createSvgElement("line", {
      ...lineStyle,
      x1: anchorX,
      y1: anchorY,
      x2: anchorX + zenithD * Math.cos(displayObserverAngle),
      y2: anchorY + eclipticViewDirection * zenithD * Math.sin(displayObserverAngle),
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
  const tipX = earthX + earthSize * Math.cos(observerAngle);
  const tipY = earthY + eclipticViewDirection * earthSize * Math.sin(observerAngle);

  svg.appendChild(
    createSvgElement("line", {
      x1: earthX,
      y1: earthY,
      x2: tipX,
      y2: tipY,
      style: `stroke: ${NEEDLE_COLOR}`,
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
      style: `fill: ${NEEDLE_COLOR}`,
    })
  );
}
