// J2000 epoch: January 1, 2000 12:00 TT
const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);

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
    size: 25,
    meanLongitudeJ2000: 34.4,
  },
  {
    name: "Saturn",
    au: 9.58,
    periodDays: 10759.2,
    color: "#e0c080",
    size: 20,
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
  const angle =
    degreesToRadians(planet.meanLongitudeJ2000) + meanMotion * days;
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

  // AU label at top of orbit
  svg.appendChild(
    createSvgElement("text", {
      x: CENTER,
      y: CENTER - radius - 4,
      fill: LABEL_COLOR,
      "font-size": "9",
      "font-family": "sans-serif",
      "text-anchor": "middle",
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
function calculateObserverAngle(earthOrbitalAngle, date) {
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

function expandBounds(bounds, x, y, margin) {
  bounds.minX = Math.min(bounds.minX, x - margin);
  bounds.minY = Math.min(bounds.minY, y - margin);
  bounds.maxX = Math.max(bounds.maxX, x + margin);
  bounds.maxY = Math.max(bounds.maxY, y + margin);
}

/**
 * Renders the solar system SVG and returns it with bounding box metadata.
 * @param {Date} date - date to calculate positions for
 * @returns {{ svg: SVGElement, bounds: { minX: number, minY: number, maxX: number, maxY: number } }}
 */
function renderSolarSystem(date) {
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

const ZOOM_IN_FACTOR = 0.8;
const ZOOM_OUT_FACTOR = 1.25;
const MIN_VIEW_SIZE = 100;
const AUTO_FIT_MARGIN = 0.02;

class SolarViewCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._currentDate = new Date();
    // View state (initialized on first render)
    this._viewCenterX = null;
    this._viewCenterY = null;
    this._viewWidth = null;
    this._viewHeight = null;
    this._autoFitSize = null;
    // Auto-update timer
    this._autoUpdateTimer = null;
    // Drag state
    this._isDragging = false;
    this._dragStartX = 0;
    this._dragStartY = 0;
    this._dragStartCenterX = 0;
    this._dragStartCenterY = 0;
  }

  set hass(hass) {
    this._hass = hass;
  }

  setConfig(config) {
    this._config = config;
  }

  connectedCallback() {
    this._render();
    clearInterval(this._autoUpdateTimer);
    this._autoUpdateTimer = setInterval(() => {
      if (this._formatDate(this._currentDate).slice(0, 10) === this._formatDate(new Date()).slice(0, 10)) {
        this._currentDate = new Date();
        this._render();
      }
    }, 60000);
  }

  disconnectedCallback() {
    clearInterval(this._autoUpdateTimer);
    this._autoUpdateTimer = null;
  }

  _formatDate(date) {
    const y = String(date.getFullYear()).slice(-2);
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${d} ${hh}:${mm}`;
  }

  _navigate(deltaDays) {
    this._currentDate = new Date(
      this._currentDate.getTime() + deltaDays * 86400000
    );
    this._render();
  }

  _goToday() {
    this._currentDate = new Date();
    // Reset view state so auto-fit recalculates
    this._viewCenterX = null;
    this._render();
  }

  _calculateAutoFit(bounds) {
    const bw = bounds.maxX - bounds.minX;
    const bh = bounds.maxY - bounds.minY;
    const size = Math.max(bw, bh);
    const marginSize = size * (1 + 2 * AUTO_FIT_MARGIN);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    return { centerX, centerY, viewSize: marginSize };
  }

  _zoomIn() {
    const newWidth = this._viewWidth * ZOOM_IN_FACTOR;
    const newHeight = this._viewHeight * ZOOM_IN_FACTOR;
    this._viewWidth = Math.max(newWidth, MIN_VIEW_SIZE);
    this._viewHeight = Math.max(newHeight, MIN_VIEW_SIZE);
    this._updateViewBox();
  }

  _zoomOut() {
    const newWidth = this._viewWidth * ZOOM_OUT_FACTOR;
    const newHeight = this._viewHeight * ZOOM_OUT_FACTOR;
    this._viewWidth = Math.min(newWidth, this._autoFitSize);
    this._viewHeight = Math.min(newHeight, this._autoFitSize);
    this._updateViewBox();
  }

  _updateViewBox() {
    const svg = this.shadowRoot.querySelector("#solar-view svg");
    if (svg) {
      const minX = this._viewCenterX - this._viewWidth / 2;
      const minY = this._viewCenterY - this._viewHeight / 2;
      svg.setAttribute(
        "viewBox",
        `${minX} ${minY} ${this._viewWidth} ${this._viewHeight}`
      );
    }
  }

  _onPointerDown(e) {
    const svg = e.currentTarget;
    svg.setPointerCapture(e.pointerId);
    this._isDragging = true;
    this._dragStartX = e.clientX;
    this._dragStartY = e.clientY;
    this._dragStartCenterX = this._viewCenterX;
    this._dragStartCenterY = this._viewCenterY;
    svg.style.cursor = "grabbing";
  }

  _onPointerMove(e) {
    if (!this._isDragging) return;
    const svg = e.currentTarget;
    const dx = e.clientX - this._dragStartX;
    const dy = e.clientY - this._dragStartY;
    // Convert screen pixels to SVG coordinates
    const rect = svg.getBoundingClientRect();
    const scaleX = this._viewWidth / rect.width;
    const scaleY = this._viewHeight / rect.height;
    this._viewCenterX = this._dragStartCenterX - dx * scaleX;
    this._viewCenterY = this._dragStartCenterY - dy * scaleY;
    this._updateViewBox();
  }

  _onPointerUp(e) {
    if (!this._isDragging) return;
    this._isDragging = false;
    const svg = e.currentTarget;
    svg.releasePointerCapture(e.pointerId);
    svg.style.cursor = "grab";
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .card {
          background: #1e1e1e;
          border-radius: 12px;
          padding: 16px;
          color: #ffffff;
          font-family: sans-serif;
        }
        .date {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.6);
          margin: 0 8px;
        }
        .solar-view-wrapper {
          overflow: hidden;
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
          margin-top: 12px;
        }
        .nav button {
          background: #2a2a2a;
          color: rgba(255, 255, 255, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          padding: 2px 5px;
          font-size: 10px;
          cursor: pointer;
          font-family: sans-serif;
        }
        .nav button:hover {
          background: #3a3a3a;
        }
        .nav button.today {
          background: #2a2a2a;
        }
        .nav button.today:hover {
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
      </style>
      <div class="card">
        <div class="solar-view-wrapper">
          <div id="solar-view"></div>
        </div>
        <div class="nav">
          <button data-action="month-back">&lt;&lt;</button>
          <button data-action="day-back">&lt;</button>
          <button data-action="today" class="today">Today</button>
          <span class="date">${this._formatDate(this._currentDate)}</span>
          <button data-action="day-forward">&gt;</button>
          <button data-action="month-forward">&gt;&gt;</button>
          <span class="btn-group">
            <button data-action="zoom-out">&minus;</button>
            <button data-action="zoom-in">+</button>
          </span>
        </div>
      </div>
    `;

    const container = this.shadowRoot.getElementById("solar-view");
    const { svg, bounds } = renderSolarSystem(this._currentDate);
    container.appendChild(svg);

    // Initialize or preserve view state
    if (this._viewCenterX === null) {
      const fit = this._calculateAutoFit(bounds);
      this._viewCenterX = fit.centerX;
      this._viewCenterY = fit.centerY;
      this._viewWidth = fit.viewSize;
      this._viewHeight = fit.viewSize;
      this._autoFitSize = fit.viewSize;
    } else {
      // Recalculate auto-fit size for zoom-out clamping (planet positions may have changed)
      const fit = this._calculateAutoFit(bounds);
      this._autoFitSize = fit.viewSize;
    }

    this._updateViewBox();

    // Wire up pointer events for drag-to-pan
    svg.addEventListener("pointerdown", (e) => this._onPointerDown(e));
    svg.addEventListener("pointermove", (e) => this._onPointerMove(e));
    svg.addEventListener("pointerup", (e) => this._onPointerUp(e));

    // Wire up navigation buttons
    this.shadowRoot.querySelectorAll(".nav button").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const action = e.currentTarget.dataset.action;
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
            this._navigate(-1);
            break;
          case "today":
            this._goToday();
            break;
          case "day-forward":
            this._navigate(1);
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
      });
    });
  }

  getCardSize() {
    return 6;
  }

  static getStubConfig() {
    return {};
  }
}

customElements.define("ha-solar-view-card", SolarViewCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "ha-solar-view-card",
  name: "Solar View Card",
  description: "Planetary solar system visualization card",
});
