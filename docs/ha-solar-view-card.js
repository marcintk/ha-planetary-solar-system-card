// Orbital elements for comets at J2000 epoch
// Sources: JPL Small-Body Database
const COMETS = [
  {
    name: "Halley",
    semiMajorAxis: 17.834,
    eccentricity: 0.967,
    periodDays: 27510,
    longitudeOfPerihelion: 111.33,
    meanAnomalyJ2000: 38.38,
    color: "#88ccff",
    size: 4,
    tailLength: 40,
  },
];

const SUN = {
  name: "Sun",
  color: "#ffd700",
  size: 16,
};

// Mean longitudes at J2000 epoch (degrees) and orbital periods (days)
// Sources: NASA planetary fact sheets
const PLANETS = [
  {
    name: "Mercury",
    au: 0.39,
    periodDays: 87.97,
    color: "#b0b0b0",
    size: 6,
    meanLongitudeJ2000: 252.25,
  },
  {
    name: "Venus",
    au: 0.72,
    periodDays: 224.7,
    color: "#e8cda0",
    size: 9,
    meanLongitudeJ2000: 181.98,
  },
  {
    name: "Earth",
    au: 1.0,
    periodDays: 365.25,
    color: "#4a90d9",
    size: 10,
    meanLongitudeJ2000: 100.46,
  },
  {
    name: "Mars",
    au: 1.52,
    periodDays: 687.0,
    color: "#c1440e",
    size: 7,
    meanLongitudeJ2000: 355.45,
  },
  {
    name: "Jupiter",
    au: 5.2,
    periodDays: 4332.6,
    color: "#c88b3a",
    size: 21,
    meanLongitudeJ2000: 34.4,
  },
  {
    name: "Saturn",
    au: 9.58,
    periodDays: 10759.2,
    color: "#e0c080",
    size: 25,
    meanLongitudeJ2000: 49.94,
  },
  {
    name: "Uranus",
    au: 19.22,
    periodDays: 30688.5,
    color: "#7ec8e3",
    size: 13,
    meanLongitudeJ2000: 313.23,
  },
  {
    name: "Neptune",
    au: 30.05,
    periodDays: 60182.0,
    color: "#3f54ba",
    size: 13,
    meanLongitudeJ2000: 304.88,
  },
];

const MOON = {
  name: "Moon",
  periodDays: 27.32,
  color: "#cccccc",
  size: 5,
  meanLongitudeJ2000: 218.32,
};

// J2000 epoch: January 1, 2000 12:00 TT
const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);

function daysSinceJ2000(date) {
  return (date.getTime() - J2000) / 86400000;
}

function degreesToRadians(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Calculate a planet's angular position (radians) for a given date.
 * Uses simplified circular orbit model.
 */
function calculatePlanetPosition(planet, date) {
  const days = daysSinceJ2000(date);
  const meanMotion = (2 * Math.PI) / planet.periodDays;
  const angle = degreesToRadians(planet.meanLongitudeJ2000) + meanMotion * days;
  // Normalize to [0, 2π)
  return ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
}

/**
 * Calculate the Moon's angular position relative to Earth for a given date.
 * Returns absolute angle (not relative to Earth).
 */
function calculateMoonPosition(date) {
  const days = daysSinceJ2000(date);
  const meanMotion = (2 * Math.PI) / MOON.periodDays;
  const angle = degreesToRadians(MOON.meanLongitudeJ2000) + meanMotion * days;
  return ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
}

/**
 * Solve Kepler's equation M = E - e*sin(E) for eccentric anomaly E.
 * Uses Newton-Raphson iteration.
 */
function solveKeplerEquation(M, e) {
  let E = M;
  for (let i = 0; i < 10; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
  }
  return E;
}

/**
 * Calculate a comet's position (angle and radius) for a given date.
 * Uses full elliptical orbit model with Kepler's equation.
 * Returns { angle (radians), radius (AU), trueAnomaly (radians) }.
 */
function calculateCometPosition(comet, date) {
  const days = daysSinceJ2000(date);

  // Mean anomaly at date
  const meanMotion = (2 * Math.PI) / comet.periodDays;
  const M0 = degreesToRadians(comet.meanAnomalyJ2000);
  let M = M0 + meanMotion * days;
  M = ((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  // Solve Kepler's equation for eccentric anomaly
  const E = solveKeplerEquation(M, comet.eccentricity);

  // True anomaly from eccentric anomaly
  const e = comet.eccentricity;
  const trueAnomaly =
    2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));

  // Radius from the focus (Sun)
  const radius = comet.semiMajorAxis * (1 - e * Math.cos(E));

  // Angle in the orbital plane (true anomaly + longitude of perihelion)
  const angle = trueAnomaly + degreesToRadians(comet.longitudeOfPerihelion);
  const normalizedAngle = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  return { angle: normalizedAngle, radius, trueAnomaly };
}

const SVG_NS = "http://www.w3.org/2000/svg";
const VIEW_SIZE = 800;
const CENTER = VIEW_SIZE / 2;
const MIN_RADIUS = 40;
const MAX_RADIUS = 360;

// Log-scale orbit radii so inner planets aren't squished.
// Maps AU → pixel radius from center, leaving margin for labels.
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

function expandBounds(bounds, x, y, margin) {
  bounds.minX = Math.min(bounds.minX, x - margin);
  bounds.minY = Math.min(bounds.minY, y - margin);
  bounds.maxX = Math.max(bounds.maxX, x + margin);
  bounds.maxY = Math.max(bounds.maxY, y + margin);
}

const ORBIT_COLOR$1 = "rgba(255, 255, 255, 0.12)";
const LABEL_COLOR$1 = "rgba(255, 255, 255, 0.5)";

function renderOrbit(svg, radius, auLabel) {
  svg.appendChild(
    createSvgElement("circle", {
      cx: CENTER,
      cy: CENTER,
      r: radius,
      fill: "none",
      stroke: ORBIT_COLOR$1,
      "stroke-width": 1,
      "stroke-dasharray": "5, 5",
    })
  );

  // AU labels on the vertical axis — mirrored above and below center
  // Offset right of the season dividing line to avoid overlap
  const offset = 3;
  const horizontalOffset = 3;
  const labelAttrs = {
    fill: LABEL_COLOR$1,
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

function renderSaturnRings(svg, x, y, body, _renderSize) {
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

const ORBIT_COLOR = "rgba(255, 255, 255, 0.12)";
const TAIL_COLOR = "rgba(136, 204, 255, 0.5)";

/**
 * Compute the visual ellipse parameters in pixel space for a comet.
 * Returns { aPx, bPx, cPx, ePx, rotationDeg }.
 */
function computeCometVisualEllipse(comet) {
  const e = comet.eccentricity;
  const a = comet.semiMajorAxis;
  const perihelionPx = auToRadius(a * (1 - e));
  let aphelionPx = auToRadius(a * (1 + e));

  // Exaggerate extension beyond Neptune for visual clarity
  const neptunePx = auToRadius(30.05);
  if (aphelionPx > neptunePx) {
    const excess = aphelionPx - neptunePx;
    aphelionPx = neptunePx + excess * 4;
  }

  const aPx = (perihelionPx + aphelionPx) / 2;
  const cPx = (aphelionPx - perihelionPx) / 2;
  const bPx = Math.sqrt(aPx * aPx - cPx * cPx);
  const ePx = cPx / aPx;
  return { aPx, bPx, cPx, ePx, rotationDeg: comet.longitudeOfPerihelion };
}

/**
 * Render a comet's orbit as an SVG ellipse in pixel space.
 * The ellipse is offset so the Sun (at CENTER) sits at one focus.
 */
function renderCometOrbit(svg, comet) {
  const { aPx, bPx, cPx, rotationDeg } = computeCometVisualEllipse(comet);

  svg.appendChild(
    createSvgElement("ellipse", {
      cx: CENTER,
      cy: CENTER,
      rx: aPx,
      ry: bPx,
      fill: "none",
      stroke: ORBIT_COLOR,
      "stroke-width": 1,
      "stroke-dasharray": "4, 8",
      transform: `rotate(${-rotationDeg}, ${CENTER}, ${CENTER}) translate(${-cPx}, 0)`,
    })
  );
}

/**
 * Render the comet body and its anti-sunward tail.
 * The tail always points directly away from the Sun.
 */
function renderCometBody(svg, x, y, comet, sunX, sunY, dynamicTailLength) {
  // Direction away from the Sun
  const dx = x - sunX;
  const dy = y - sunY;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;

  // Tail end point (away from Sun)
  const tailLen = dynamicTailLength ?? comet.tailLength ?? 30;
  const tx = x + nx * tailLen;
  const ty = y + ny * tailLen;

  // Tail as a semi-transparent line
  svg.appendChild(
    createSvgElement("line", {
      x1: x,
      y1: y,
      x2: tx,
      y2: ty,
      stroke: TAIL_COLOR,
      "stroke-width": 2,
      "stroke-linecap": "round",
      opacity: "0.7",
    })
  );

  // Comet body
  svg.appendChild(
    createSvgElement("circle", {
      cx: x,
      cy: y,
      r: comet.size,
      fill: comet.color,
    })
  );

  // Label
  svg.appendChild(
    createSvgElement("text", {
      x: x,
      y: y - comet.size - 6,
      fill: "#ffffff",
      "font-size": "11",
      "font-family": "sans-serif",
      "text-anchor": "middle",
    })
  ).textContent = comet.name;
}

/**
 * Moon phase calculation using synodic month cycle.
 */

/** Synodic month in days (New Moon to New Moon). */
const SYNODIC_MONTH = 29.53059;

/** Known New Moon epoch: January 6, 2000 18:14 UTC. */
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14, 0);

/** Phase name boundaries — 8 equal segments centered on each phase's ideal value. */
const PHASE_NAMES = [
  "New Moon",
  "Waxing Crescent",
  "First Quarter",
  "Waxing Gibbous",
  "Full Moon",
  "Waning Gibbous",
  "Third Quarter",
  "Waning Crescent",
];

/**
 * Compute the Moon's synodic phase for a given date.
 * @param {Date} date
 * @returns {{ phase: number, phaseName: string, illumination: number }}
 *   - phase: 0–1 where 0 = New Moon, 0.5 = Full Moon
 *   - phaseName: one of 8 discrete phase names
 *   - illumination: 0–1 fraction of visible disc illuminated
 */
function getMoonPhase(date) {
  const daysSinceEpoch = (date.getTime() - NEW_MOON_EPOCH) / 86400000;
  const phase =
    (((daysSinceEpoch % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH) / SYNODIC_MONTH;

  // Map to 8 segments: each segment is 1/8 wide, centered on ideal values 0, 0.125, 0.25, ...
  const segment = Math.floor(((phase + 1 / 16) % 1) * 8);
  const phaseName = PHASE_NAMES[segment];

  // Illumination: 0 at New Moon, 1 at Full Moon, 0.5 at quarters
  const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2;

  return { phase, phaseName, illumination };
}

const INDICATOR_RADIUS = 30;
const INDICATOR_X = 40;
const INDICATOR_Y = 735;
const DISC_COLOR = "#cccccc";
const SHADOW_COLOR = "#1a1a2e";
const LABEL_COLOR = "#aaaaaa";
const LABEL_FONT_SIZE$1 = "14";

/**
 * Render a moon phase indicator (disc + label) and append it to the SVG.
 * @param {SVGElement} svg
 * @param {Date} date
 * @param {string} hemisphere - "north" or "south"
 */
function renderMoonPhaseIndicator(svg, date, hemisphere) {
  const { phase, phaseName, illumination } = getMoonPhase(date);

  const g = createSvgElement("g", { class: "moon-phase-indicator" });

  // Background disc (dark)
  g.appendChild(
    createSvgElement("circle", {
      cx: INDICATOR_X,
      cy: INDICATOR_Y,
      r: INDICATOR_RADIUS,
      fill: SHADOW_COLOR,
    })
  );

  if (illumination > 0.01) {
    // Build illuminated portion using a path.
    // The approach: draw two arcs forming a closed shape.
    // For waxing (phase < 0.5 in north), right side lit.
    // For waning (phase > 0.5 in north), left side lit.
    // Southern hemisphere mirrors the illumination side.
    const r = INDICATOR_RADIUS;
    const top = INDICATOR_Y - r;
    const bottom = INDICATOR_Y + r;

    // Terminator bulge: at illumination 0.5 the terminator is straight (rx=0),
    // below 0.5 it bulges toward shadow, above 0.5 it bulges toward light.
    const fraction = illumination;
    const rx = Math.abs(2 * fraction - 1) * r;
    const bulgeRight = fraction > 0.5;

    // Determine which side is lit
    const isWaxing = phase < 0.5;
    let litOnRight = isWaxing;
    if (hemisphere === "south") litOnRight = !litOnRight;

    // The lit half is drawn as: a semicircular arc on the lit side + an elliptical
    // arc for the terminator.
    // Semicircle: always sweeps from top to bottom on the lit side.
    const semiSweep = litOnRight ? 1 : 0;
    // Terminator ellipse sweep depends on whether bulge goes toward lit side
    let terminatorSweep;
    if (litOnRight) {
      terminatorSweep = bulgeRight ? 1 : 0;
    } else {
      terminatorSweep = bulgeRight ? 0 : 1;
    }

    const d = [
      `M ${INDICATOR_X} ${top}`,
      // Semicircular arc on the lit side
      `A ${r} ${r} 0 0 ${semiSweep} ${INDICATOR_X} ${bottom}`,
      // Terminator arc back to top
      `A ${rx} ${r} 0 0 ${terminatorSweep} ${INDICATOR_X} ${top}`,
      "Z",
    ].join(" ");

    g.appendChild(
      createSvgElement("path", {
        d,
        fill: DISC_COLOR,
      })
    );
  }

  // Phase name label below the disc
  const label = createSvgElement("text", {
    x: INDICATOR_X - INDICATOR_RADIUS,
    y: INDICATOR_Y + INDICATOR_RADIUS + 14,
    fill: LABEL_COLOR,
    "font-size": LABEL_FONT_SIZE$1,
    "font-family": "sans-serif",
    "text-anchor": "start",
  });
  label.textContent = phaseName;
  g.appendChild(label);

  svg.appendChild(g);
}

/**
 * Extract local hours and minutes for a Date in a given IANA timezone string.
 * Falls back to UTC if the timezone is invalid or unrecognised.
 * @param {Date} date
 * @param {string} timezone - IANA timezone string (e.g. "America/Chicago")
 * @returns {{ hours: number, minutes: number }}
 */
function getLocalTimeInZone(date, timezone) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const hourPart = parts.find((p) => p.type === "hour");
    const minutePart = parts.find((p) => p.type === "minute");
    let hours = Number(hourPart.value);
    if (hours === 24) hours = 0; // some engines return 24 for midnight
    return { hours, minutes: Number(minutePart.value) };
  } catch {
    return { hours: date.getUTCHours(), minutes: date.getUTCMinutes() };
  }
}

/**
 * Compute the Sun's true altitude above the observer's horizon using spherical
 * astronomy. Returns degrees in [-90, 90].
 *
 * Formula:
 *   δ  = -23.45° × cos( 2π/365 × (dayOfYear + 10) )   ← solar declination
 *   H  = 15° × (localSolarHour - 12)                    ← hour angle
 *   sin(alt) = sin(lat)×sin(δ) + cos(lat)×cos(δ)×cos(H)
 *
 * localSolarHour uses UTC + longitude offset (1 hour per 15° longitude),
 * which is independent of civil timezone and gives true solar time.
 *
 * @param {number} lat - observer latitude in degrees
 * @param {number} lon - observer longitude in degrees (positive east)
 * @param {Date} date
 * @returns {number} solar altitude in degrees
 */
function computeSolarElevationDeg(lat, lon, date) {
  // Day of year (1 = Jan 1)
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - startOfYear) / 86400000);

  // Solar declination in radians
  const declRad = (-23.45 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10)) * Math.PI) / 180;

  // Local solar hour: UTC fractional hours + longitude offset (15°/hr)
  const utcHour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const localSolarHour = (((utcHour + lon / 15) % 24) + 24) % 24;

  // Hour angle in radians (positive in afternoon)
  const hourAngleRad = ((localSolarHour - 12) * 15 * Math.PI) / 180;

  const latRad = (lat * Math.PI) / 180;
  const sinAlt =
    Math.sin(latRad) * Math.sin(declRad) +
    Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourAngleRad);

  return (Math.asin(Math.max(-1, Math.min(1, sinAlt))) * 180) / Math.PI;
}

/**
 * Classify a solar elevation angle into a sky mode string.
 * @param {number} elevDeg
 * @returns {string}
 */
function getSkyMode(elevDeg) {
  if (elevDeg >= 0) return "Day";
  if (elevDeg >= -6) return "Civil Twilight";
  if (elevDeg >= -12) return "Nautical Twilight";
  if (elevDeg >= -18) return "Astronomical Twilight";
  return "Night";
}

/**
 * Find the next sky-mode boundary crossing after `date`.
 * Uses a minute-by-minute forward scan (up to 24 hours) followed by
 * binary-search refinement within the detected bracket.
 *
 * @param {number} lat - observer latitude in degrees
 * @param {number} lon - observer longitude in degrees
 * @param {Date} date - start time
 * @returns {{ time: Date, toMode: string } | null}
 */
function computeNextTransitionTime(lat, lon, date) {
  const MS_PER_MIN = 60000;
  const MAX_MINS = 24 * 60;

  const startElev = computeSolarElevationDeg(lat, lon, date);
  const currentMode = getSkyMode(startElev);

  let bracketLoMs = null;
  let bracketHiMs = null;
  let toMode = null;

  // Minute-by-minute scan
  for (let m = 1; m <= MAX_MINS; m++) {
    const t = date.getTime() + m * MS_PER_MIN;
    const elev = computeSolarElevationDeg(lat, lon, new Date(t));
    const mode = getSkyMode(elev);
    if (mode !== currentMode) {
      bracketLoMs = t - MS_PER_MIN;
      bracketHiMs = t;
      toMode = mode;
      break;
    }
  }

  if (bracketLoMs === null) return null;

  // Binary-search refinement within the bracket
  for (let i = 0; i < 10; i++) {
    const midMs = Math.floor((bracketLoMs + bracketHiMs) / 2);
    const midMode = getSkyMode(computeSolarElevationDeg(lat, lon, new Date(midMs)));
    if (midMode === currentMode) {
      bracketLoMs = midMs;
    } else {
      bracketHiMs = midMs;
    }
  }

  return { time: new Date(bracketHiMs), toMode };
}

const NEEDLE_COLOR = "rgba(255, 255, 255, 0.7)";

const CONE_DAY = "rgba(255, 255, 255, 0.1)"; // Sun above horizon
const CONE_CIVIL = "rgba(255, 220, 160, 0.08)"; // Civil twilight:        0° to -6°
const CONE_NAUTICAL = "rgba(160, 190, 255, 0.06)"; // Nautical twilight:   -6° to -12°
const CONE_ASTRONOMICAL = "rgba(80, 100, 200, 0.04)"; // Astronomical twilight: -12° to -18°
const CONE_NIGHT = "rgba(255, 255, 255, 0.01)"; // Sun below -18°

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
function rayCircleDistance(ax, ay, dx, dy, cx, cy, R, minLen = 20) {
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

function calculateSolarElevationDeg(observerAngle, earthAngle) {
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
function calculateObserverAngle(earthOrbitalAngle, date, timezone, longitude) {
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

function renderDayNightSplit(svg, earthRadius, date, earthBodySize, locationData) {
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

/**
 * Renders the solar system SVG and returns it with bounding box metadata.
 * @param {Date} date - date to calculate positions for
 * @param {string} [hemisphere="north"] - "north" or "south" for season labels
 * @param {{ lat: number, lon: number, timezone: string } | null} [locationData] - observer location from HA config
 * @param {{ zoomLevel: number, width: number, height: number, centerX: number, centerY: number } | null} [viewState] - current view state for zoom-aware rendering
 * @returns {{ svg: SVGElement, bounds: { minX: number, minY: number, maxX: number, maxY: number } }}
 */
function renderSolarSystem(
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

  // Draw orbits (planets then comets, so all orbits are behind bodies)
  for (const planet of PLANETS) {
    const radius = auToRadius(planet.au);
    renderOrbit(svg, radius, planet.au);
  }
  for (const comet of COMETS) {
    renderCometOrbit(svg, comet);
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
      renderSaturnRings(svg, x, y, planet);
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

  // Draw comets using visual ellipse for pixel positioning
  for (const comet of COMETS) {
    const { angle, radius, trueAnomaly } = calculateCometPosition(comet, date);
    const { aPx, ePx } = computeCometVisualEllipse(comet);
    const rPx = (aPx * (1 - ePx * ePx)) / (1 + ePx * Math.cos(trueAnomaly));
    const cx = CENTER + rPx * Math.cos(angle);
    const cy = CENTER - rPx * Math.sin(angle);
    // Tail scales inversely with distance from Sun
    const perihelion = comet.semiMajorAxis * (1 - comet.eccentricity);
    const tailScale = Math.min(1, perihelion / radius);
    const dynamicTail = comet.tailLength * tailScale;
    renderCometBody(svg, cx, cy, comet, CENTER, CENTER, dynamicTail);
    positions.push({ name: comet.name, x: cx, y: cy, color: comet.color });
    expandBounds(bounds, cx, cy, comet.size + dynamicTail);
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
      stroke: ORBIT_COLOR$1,
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

const MARKER_SIZE = 8;
const EDGE_MARGIN = 10;
const LABEL_FONT_SIZE = 9;
const MARKER_GROUP_ID = "offscreen-markers";

/**
 * Compute the intersection of a ray from (cx, cy) to (px, py) with a rectangle.
 * Returns { x, y } on the rectangle edge, inset by margin.
 */
function edgeIntersection(cx, cy, px, py, left, top, right, bottom, margin) {
  const dx = px - cx;
  const dy = py - cy;

  const inLeft = left + margin;
  const inTop = top + margin;
  const inRight = right - margin;
  const inBottom = bottom - margin;

  let tMin = Number.POSITIVE_INFINITY;

  // Check each edge
  if (dx !== 0) {
    const tLeft = (inLeft - cx) / dx;
    if (tLeft > 0 && tLeft < tMin) {
      const yAt = cy + dy * tLeft;
      if (yAt >= inTop && yAt <= inBottom) tMin = tLeft;
    }
    const tRight = (inRight - cx) / dx;
    if (tRight > 0 && tRight < tMin) {
      const yAt = cy + dy * tRight;
      if (yAt >= inTop && yAt <= inBottom) tMin = tRight;
    }
  }
  if (dy !== 0) {
    const tTop = (inTop - cy) / dy;
    if (tTop > 0 && tTop < tMin) {
      const xAt = cx + dx * tTop;
      if (xAt >= inLeft && xAt <= inRight) tMin = tTop;
    }
    const tBottom = (inBottom - cy) / dy;
    if (tBottom > 0 && tBottom < tMin) {
      const xAt = cx + dx * tBottom;
      if (xAt >= inLeft && xAt <= inRight) tMin = tBottom;
    }
  }

  if (tMin === Number.POSITIVE_INFINITY) {
    return { x: cx, y: cy };
  }

  return { x: cx + dx * tMin, y: cy + dy * tMin };
}

/**
 * Create a triangle polygon pointing from (ix, iy) toward (px, py).
 */
function createTriangle(ix, iy, px, py, color) {
  const angle = Math.atan2(py - iy, px - ix);
  const h = (MARKER_SIZE * Math.sqrt(3)) / 2;
  // Triangle tip points toward the planet
  const tipX = ix + (Math.cos(angle) * h) / 2;
  const tipY = iy + (Math.sin(angle) * h) / 2;
  const baseAngle1 = angle + Math.PI / 2;
  const baseAngle2 = angle - Math.PI / 2;
  const halfBase = MARKER_SIZE / 2;
  const b1x = ix - (Math.cos(angle) * h) / 2 + Math.cos(baseAngle1) * halfBase;
  const b1y = iy - (Math.sin(angle) * h) / 2 + Math.sin(baseAngle1) * halfBase;
  const b2x = ix - (Math.cos(angle) * h) / 2 + Math.cos(baseAngle2) * halfBase;
  const b2y = iy - (Math.sin(angle) * h) / 2 + Math.sin(baseAngle2) * halfBase;

  const polygon = createSvgElement("polygon", {});
  polygon.setAttribute("points", `${tipX},${tipY} ${b1x},${b1y} ${b2x},${b2y}`);
  polygon.setAttribute("fill", color);
  return polygon;
}

/**
 * Create a text label for a planet name near the marker.
 */
function createLabel(ix, iy, px, py, name, color, left, right) {
  const text = createSvgElement("text", {});
  text.setAttribute("fill", color);
  text.setAttribute("font-size", LABEL_FONT_SIZE);
  text.setAttribute("font-family", "sans-serif");
  text.textContent = name;

  // Position label inward from the marker
  const angle = Math.atan2(py - iy, px - ix);
  const offsetDist = MARKER_SIZE + 2;
  const lx = ix - Math.cos(angle) * offsetDist;
  const ly = iy - Math.sin(angle) * offsetDist;

  // Determine text-anchor based on position relative to viewport center
  const midX = (left + right) / 2;
  if (lx < midX) {
    text.setAttribute("text-anchor", "start");
  } else {
    text.setAttribute("text-anchor", "end");
  }

  text.setAttribute("x", lx);
  text.setAttribute("y", ly + LABEL_FONT_SIZE / 3);
  return text;
}

/**
 * Render off-screen markers for planets/Moon outside the current viewport.
 * @param {Array<{name: string, x: number, y: number, color: string}>} positions
 * @param {object} viewState - ViewState instance with centerX, centerY, width, height
 * @returns {SVGGElement} A <g> group containing all markers
 */
function renderOffscreenMarkers(positions, viewState) {
  const group = createSvgElement("g", { id: MARKER_GROUP_ID });

  if (!positions || !viewState) return group;

  const w = viewState.width;
  const h = viewState.height;
  const left = viewState.centerX - w / 2;
  const top = viewState.centerY - h / 2;
  const right = left + w;
  const bottom = top + h;

  for (const pos of positions) {
    // Skip bodies that opt out of offscreen markers (e.g. Moon)
    if (pos.offscreen === false) continue;

    // Skip if inside viewport
    if (pos.x >= left && pos.x <= right && pos.y >= top && pos.y <= bottom) {
      continue;
    }

    const { x: ix, y: iy } = edgeIntersection(
      viewState.centerX,
      viewState.centerY,
      pos.x,
      pos.y,
      left,
      top,
      right,
      bottom,
      EDGE_MARGIN
    );

    const triangle = createTriangle(ix, iy, pos.x, pos.y, pos.color);
    group.appendChild(triangle);

    const label = createLabel(ix, iy, pos.x, pos.y, pos.name, pos.color, left, right);
    group.appendChild(label);
  }

  return group;
}

const CARD_STYLES = `
  :host {
    display: block;
  }
  .card {
    background: transparent;
    border-radius: 0px;
    padding: 0px;
    color: #ffffff;
    font-family: sans-serif;
  }
  .date {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
    margin: 2px 2px;
  }
  .solar-view-wrapper {
    overflow: hidden;
    position: relative;
  }
  .status-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    background: rgba(42, 42, 42, 0.3);
    font-size: 9px;
    color: rgba(255, 255, 255, 0.85);
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 3px 8px;
    pointer-events: none;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
    font-family: sans-serif;
    z-index: 1;
  }
  .status-bar span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .status-bar span:first-child {
    min-width: 0;
  }
  #solar-view {
    width: 100%;
    aspect-ratio: 1;
  }
  #solar-view svg {
    cursor: grab;
    user-select: none;
    touch-action: none;
  }
  .nav {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 4px;
    margin-top: 2px;
  }
  .nav button {
    background: rgba(42, 42, 42, 0.3);
    color: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    height: 18px;
    line-height: 18px;
    padding: 0 5px;
    min-width: 20px;
    font-size: 10px;
    cursor: pointer;
    font-family: sans-serif;
    box-sizing: border-box;
  }
  .nav button:hover {
    background: #3a3a3a;
  }
  .btn-group {
    display: flex;
    gap: 0;
  }
  .btn-group button {
    border-radius: 0;
  }
  .btn-group button:first-child {
    border-radius: 6px 0 0 6px;
  }
  .btn-group button:last-child {
    border-radius: 0 6px 6px 0;
  }
  .nav-spacer {
    width: 8px;
  }
  .zoom-level {
    background: #2a2a2a;
    color: rgba(255, 255, 255, 0.8);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    height: 18px;
    line-height: 18px;
    padding: 0 4px;
    font-size: 9px;
    font-family: sans-serif;
    display: flex;
    align-items: center;
    box-sizing: border-box;
  }
`;

/**
 * Build the status bar HTML fragment.
 *
 * @param {{ lat: number, lon: number, timezone: string } | null} locationData
 * @param {string | null} locationName
 * @param {Date} currentDate
 * @returns {string} HTML fragment, or empty string when locationData is null
 */
function buildStatusBarHtml(locationData, locationName, currentDate) {
  if (!locationData) return "";

  const elevDeg = computeSolarElevationDeg(locationData.lat, locationData.lon, currentDate);
  const mode = getSkyMode(elevDeg);
  const elevRounded = Math.round(elevDeg);
  const next = computeNextTransitionTime(locationData.lat, locationData.lon, currentDate);
  let rightSpan = "";
  if (next) {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: locationData.timezone || "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    rightSpan = `<span>Next: ${next.toMode} (${formatter.format(next.time)})</span>`;
  }
  const name = locationName || "";
  return `<div class="status-bar"><span>${name} | ${mode} (${elevRounded}°)</span>${rightSpan}</div>`;
}

/**
 * Build the complete shadowRoot.innerHTML string.
 *
 * @param {string} statusBarHtml - result of buildStatusBarHtml()
 * @param {string} formattedDate - pre-formatted date string
 * @param {number} zoomLevel - current zoom level integer
 * @returns {string} complete innerHTML including <style> and card HTML
 */
function buildCardHtml(statusBarHtml, formattedDate, zoomLevel) {
  return `
    <style>${CARD_STYLES}</style>
    <div class="card">
      <div class="solar-view-wrapper">
        ${statusBarHtml}
        <div id="solar-view"></div>
      </div>
      <div class="nav">
        <span class="btn-group">
          <button data-action="month-back">\u22D8</button>
          <button data-action="day-back">\u00AB</button>
          <button data-action="hour-back">\u2039</button>
          <button data-action="today">Now</button>
          <button data-action="hour-forward">\u203A</button>
          <button data-action="day-forward">\u00BB</button>
          <button data-action="month-forward">\u22D9</button>
        </span>
        <span class="nav-spacer"></span>
        <span class="date">${formattedDate}</span>
        <span class="nav-spacer"></span>
        <span class="btn-group">
          <button data-action="zoom-out">&minus;</button>
          <span class="zoom-level">${zoomLevel}</span>
          <button data-action="zoom-in">+</button>
        </span>
      </div>
    </div>
  `;
}

const FULL_SYSTEM_SIZE = 800;
const DEFAULT_ZOOM_LEVEL = 1;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

const ZOOM_LEVELS = { 1: 800, 2: 640, 3: 480, 4: 320 };

/**
 * Encapsulates all pan and zoom state for the solar system view.
 * Keeps the SolarViewCard focused on rendering and event wiring.
 */
class ViewState {
  constructor(defaultZoomLevel = DEFAULT_ZOOM_LEVEL) {
    this.centerX = FULL_SYSTEM_SIZE / 2;
    this.centerY = FULL_SYSTEM_SIZE / 2;
    this.zoomLevel = defaultZoomLevel;
    this._width = ZOOM_LEVELS[defaultZoomLevel];
    this._height = ZOOM_LEVELS[defaultZoomLevel];
    this.isDragging = false;
    this._dragStartX = 0;
    this._dragStartY = 0;
    this._dragStartCenterX = 0;
    this._dragStartCenterY = 0;
  }

  get width() {
    return this._width;
  }
  get height() {
    return this._height;
  }

  /** Returns the SVG viewBox string for the current pan/zoom state. */
  get viewBox() {
    const minX = this.centerX - this._width / 2;
    const minY = this.centerY - this._height / 2;
    return `${minX} ${minY} ${this._width} ${this._height}`;
  }

  /** Zoom in one discrete level. Returns true if zoom changed. */
  zoomIn() {
    if (this.zoomLevel >= MAX_ZOOM) return false;
    this.zoomLevel++;
    this._width = ZOOM_LEVELS[this.zoomLevel];
    this._height = ZOOM_LEVELS[this.zoomLevel];
    return true;
  }

  /** Zoom out one discrete level. Returns true if zoom changed. */
  zoomOut() {
    if (this.zoomLevel <= MIN_ZOOM) return false;
    this.zoomLevel--;
    this._width = ZOOM_LEVELS[this.zoomLevel];
    this._height = ZOOM_LEVELS[this.zoomLevel];
    return true;
  }

  /** Set zoom to a specific level, clamped to [MIN_ZOOM, MAX_ZOOM]. */
  setZoomLevel(level) {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level));
    this.zoomLevel = clamped;
    this._width = ZOOM_LEVELS[clamped];
    this._height = ZOOM_LEVELS[clamped];
  }

  /** Set viewport dimensions directly (for animation frames) without changing zoomLevel. */
  setViewport(width, height) {
    this._width = width;
    this._height = height;
  }

  startDrag(clientX, clientY) {
    this.isDragging = true;
    this._dragStartX = clientX;
    this._dragStartY = clientY;
    this._dragStartCenterX = this.centerX;
    this._dragStartCenterY = this.centerY;
  }

  /** Update pan position during a drag. svgRect is the result of getBoundingClientRect(). */
  updateDrag(clientX, clientY, svgRect) {
    if (!this.isDragging) return;
    const dx = clientX - this._dragStartX;
    const dy = clientY - this._dragStartY;
    const scaleX = this._width / svgRect.width;
    const scaleY = this._height / svgRect.height;
    this.centerX = this._dragStartCenterX - dx * scaleX;
    this.centerY = this._dragStartCenterY - dy * scaleY;
  }

  endDrag() {
    this.isDragging = false;
  }
}

const ZOOM_ANIMATE_DURATION_MS = 2000;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

class ZoomAnimator {
  constructor(viewState, onFrame) {
    this._viewState = viewState;
    this._onFrame = onFrame;
    this._animationId = null;
    this._startWidth = 0;
    this._startHeight = 0;
    this._targetWidth = 0;
    this._targetHeight = 0;
    this._startTime = -1;
  }

  get isAnimating() {
    return this._animationId !== null;
  }

  animateTo(targetLevel, fromWidth, fromHeight) {
    this.cancel();

    this._startWidth = fromWidth != null ? fromWidth : this._viewState.width;
    this._startHeight = fromHeight != null ? fromHeight : this._viewState.height;
    this._targetWidth = ZOOM_LEVELS[targetLevel];
    this._targetHeight = ZOOM_LEVELS[targetLevel];
    this._targetLevel = targetLevel;
    this._startTime = -1;

    const step = (timestamp) => {
      if (this._startTime < 0) this._startTime = timestamp;
      const elapsed = timestamp - this._startTime;
      const t = Math.min(elapsed / ZOOM_ANIMATE_DURATION_MS, 1);
      const eased = easeInOutCubic(t);

      const w = this._startWidth + (this._targetWidth - this._startWidth) * eased;
      const h = this._startHeight + (this._targetHeight - this._startHeight) * eased;

      this._viewState.setViewport(w, h);
      this._onFrame();

      if (t < 1) {
        this._animationId = requestAnimationFrame(step);
      } else {
        this._viewState.setZoomLevel(this._targetLevel);
        this._animationId = null;
        this._onFrame();
      }
    };

    this._animationId = requestAnimationFrame(step);
  }

  cancel() {
    if (this._animationId !== null) {
      cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }
  }
}

class SolarViewCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._currentDate = new Date();
    this._viewState = null; // initialized on first render
    this._defaultZoomLevel = DEFAULT_ZOOM_LEVEL;
    this._hemisphere = "north"; // Hemisphere for season labels (default: north)
    this._lat = null;
    this._lon = null;
    this._timezone = null;
    this._locationName = null;
    this._autoUpdateTimer = null; // Auto-update timer
  }

  // ---------------------------------------------------------------------------
  // Proxy getters — expose ViewState fields at the card level so that tests
  // and external code can read them without knowing about ViewState internals.
  // ---------------------------------------------------------------------------
  get _isDragging() {
    return this._viewState?.isDragging ?? false;
  }
  get _viewCenterX() {
    return this._viewState?.centerX ?? null;
  }
  get _viewCenterY() {
    return this._viewState?.centerY ?? null;
  }
  get _zoomLevel() {
    return this._viewState?.zoomLevel ?? null;
  }

  set hass(hass) {
    this._hass = hass;
    const lat = hass.config?.latitude;
    const lon = hass.config?.longitude;
    const timezone = hass.config?.time_zone;
    const locationName = hass.config?.location_name;
    if (
      lat !== this._lat ||
      lon !== this._lon ||
      timezone !== this._timezone ||
      locationName !== this._locationName
    ) {
      this._lat = lat != null ? lat : null;
      this._lon = lon != null ? lon : null;
      this._timezone = timezone || null;
      this._locationName = locationName || null;
      this._render();
    }
  }

  setConfig(config) {
    this._config = config;
    this._defaultZoomLevel =
      config.default_zoom == null ||
      config.default_zoom < MIN_ZOOM ||
      config.default_zoom > MAX_ZOOM
        ? DEFAULT_ZOOM_LEVEL
        : config.default_zoom;

    const rawRefresh = Number(config.refresh_mins);
    this._refreshMs = Number.isFinite(rawRefresh) && rawRefresh >= 0.1 ? rawRefresh * 60000 : 60000;

    this._periodicZoomChange = config.periodic_zoom_change === true;
    this._zoomAnimate = config.zoom_animate !== false;

    // Recreate timer if already connected
    if (this._autoUpdateTimer != null) {
      this._startAutoUpdateTimer();
    }
  }

  connectedCallback() {
    this._render();
    this._startAutoUpdateTimer();
  }

  disconnectedCallback() {
    clearInterval(this._autoUpdateTimer);
    this._autoUpdateTimer = null;
  }

  _startAutoUpdateTimer() {
    clearInterval(this._autoUpdateTimer);
    const interval = this._refreshMs || 60000;
    this._autoUpdateTimer = setInterval(() => {
      if (
        this._formatDate(this._currentDate).slice(0, 10) ===
        this._formatDate(new Date()).slice(0, 10)
      ) {
        this._currentDate = new Date();
        this._render();
      }
      if (this._periodicZoomChange) {
        this._advanceZoom();
      }
    }, interval);
  }

  _advanceZoom() {
    const prevWidth = this._viewState.width;
    const prevHeight = this._viewState.height;
    const next = this._viewState.zoomLevel >= MAX_ZOOM ? MIN_ZOOM : this._viewState.zoomLevel + 1;
    this._viewState.setZoomLevel(next);
    this._applyZoom(prevWidth, prevHeight);
  }

  _formatDate(date) {
    const y = String(date.getFullYear()).slice(-2);
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${d} ${hh}:${mm}`;
  }

  _navigate(deltaMs) {
    this._currentDate = new Date(this._currentDate.getTime() + deltaMs);
    this._render();
  }

  _goToday() {
    this._currentDate = new Date();
    this._render();
  }

  _zoomIn() {
    const prevWidth = this._viewState.width;
    const prevHeight = this._viewState.height;
    if (this._viewState.zoomIn()) this._applyZoom(prevWidth, prevHeight);
  }

  _zoomOut() {
    const prevWidth = this._viewState.width;
    const prevHeight = this._viewState.height;
    if (this._viewState.zoomOut()) this._applyZoom(prevWidth, prevHeight);
  }

  _applyZoom(fromWidth, fromHeight) {
    if (this._zoomAnimate && this._zoomAnimator && fromWidth != null) {
      this._zoomAnimator.animateTo(this._viewState.zoomLevel, fromWidth, fromHeight);
    } else {
      this._updateViewBox();
    }
    const levelDisplay = this.shadowRoot.querySelector(".zoom-level");
    if (levelDisplay) levelDisplay.textContent = this._viewState.zoomLevel;
  }

  _updateViewBox() {
    const svg = this.shadowRoot.querySelector("#solar-view svg");
    if (svg) svg.setAttribute("viewBox", this._viewState.viewBox);
    this._updateOffscreenMarkers();
  }

  _updateOffscreenMarkers() {
    const svg = this.shadowRoot.querySelector("#solar-view svg");
    if (!svg) return;
    const old = svg.getElementById(MARKER_GROUP_ID);
    if (old) old.remove();
    if (this._positions && this._viewState) {
      svg.appendChild(renderOffscreenMarkers(this._positions, this._viewState));
    }
  }

  _onPointerDown(e) {
    const svg = e.currentTarget;
    svg.setPointerCapture(e.pointerId);
    this._viewState.startDrag(e.clientX, e.clientY);
    svg.style.cursor = "grabbing";
  }

  _onPointerMove(e) {
    if (!this._viewState.isDragging) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    this._viewState.updateDrag(e.clientX, e.clientY, rect);
    this._updateViewBox();
  }

  _onPointerUp(e) {
    if (!this._viewState.isDragging) return;
    this._viewState.endDrag();
    const svg = e.currentTarget;
    svg.releasePointerCapture(e.pointerId);
    svg.style.cursor = "grab";
  }

  _render() {
    // Initialize view state on first render only — preserves zoom/pan across re-renders
    if (!this._viewState) {
      this._viewState = new ViewState(this._defaultZoomLevel);
      this._zoomAnimator = new ZoomAnimator(this._viewState, () => this._updateViewBox());
    }

    // Derive hemisphere from HA location when available
    if (this._lat != null) {
      this._hemisphere = this._lat < 0 ? "south" : "north";
    }

    const locationData =
      this._lat != null ? { lat: this._lat, lon: this._lon, timezone: this._timezone } : null;

    const statusBarHtml = buildStatusBarHtml(locationData, this._locationName, this._currentDate);
    this.shadowRoot.innerHTML = buildCardHtml(
      statusBarHtml,
      this._formatDate(this._currentDate),
      this._viewState.zoomLevel
    );

    const container = this.shadowRoot.getElementById("solar-view");
    const { svg, positions } = renderSolarSystem(
      this._currentDate,
      this._hemisphere,
      locationData,
      this._viewState
    );
    this._positions = positions;
    container.appendChild(svg);

    this._updateViewBox();
    this._bindEvents(svg);
  }

  /** Wire up SVG pointer events and nav button clicks. */
  _bindEvents(svg) {
    svg.addEventListener("pointerdown", (e) => this._onPointerDown(e));
    svg.addEventListener("pointermove", (e) => this._onPointerMove(e));
    svg.addEventListener("pointerup", (e) => this._onPointerUp(e));

    this.shadowRoot.querySelectorAll(".nav button").forEach((btn) => {
      btn.addEventListener("click", (e) => this._handleNavAction(e.currentTarget.dataset.action));
    });
  }

  /** Dispatch a navigation button action. */
  _handleNavAction(action) {
    switch (action) {
      case "zoom-out":
        this._zoomOut();
        break;
      case "month-back": {
        const d = new Date(this._currentDate);
        d.setMonth(d.getMonth() - 1);
        this._currentDate = d;
        this._render();
        break;
      }
      case "day-back":
        this._navigate(-864e5);
        break;
      case "hour-back":
        this._navigate(-36e5);
        break;
      case "today":
        this._goToday();
        break;
      case "hour-forward":
        this._navigate(3600000);
        break;
      case "day-forward":
        this._navigate(86400000);
        break;
      case "month-forward": {
        const d = new Date(this._currentDate);
        d.setMonth(d.getMonth() + 1);
        this._currentDate = d;
        this._render();
        break;
      }
      case "zoom-in":
        this._zoomIn();
        break;
    }
  }

  getCardSize() {
    return 6;
  }

  static getStubConfig() {
    return { default_zoom: 2, periodic_zoom_change: false, refresh_mins: 1, zoom_animate: true };
  }
}

customElements.define("ha-solar-view-card", SolarViewCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "ha-solar-view-card",
  name: "Solar View Card",
  description: "Planetary solar system visualization card",
});
