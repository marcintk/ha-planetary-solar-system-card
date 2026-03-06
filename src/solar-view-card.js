import { renderSolarSystem } from "./renderer.js";
import { buildStatusBarHtml, buildCardHtml } from "./card-template.js";

const FULL_SYSTEM_SIZE = 800;
const ZOOM_LEVELS = {
  1: 800,
  2: 640,
  3: 480,
  4: 320
};
const DEFAULT_ZOOM_LEVEL = 1;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

export class SolarViewCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._currentDate = new Date(); // View state (initialized on first render)
    this._viewCenterX = null;
    this._viewCenterY = null;
    this._viewWidth = null;
    this._viewHeight = null;
    this._zoomLevel = null;
    this._defaultZoomLevel = DEFAULT_ZOOM_LEVEL;
    this._hemisphere = "north"; // Hemisphere for season labels (default: north)
    this._lat = null;
    this._lon = null;
    this._timezone = null;
    this._locationName = null;
    this._autoUpdateTimer = null; // Auto-update timer
    this._isDragging = false; // Drag state
    this._dragStartX = 0;
    this._dragStartY = 0;
    this._dragStartCenterX = 0;
    this._dragStartCenterY = 0;
  }

  set hass(hass) {
    this._hass = hass;
    const lat = hass.config && hass.config.latitude;
    const lon = hass.config && hass.config.longitude;
    const timezone = hass.config && hass.config.time_zone;
    const locationName = hass.config && hass.config.location_name;
    if (lat !== this._lat || lon !== this._lon || timezone !== this._timezone || locationName !== this._locationName) {
      this._lat = lat != null ? lat : null;
      this._lon = lon != null ? lon : null;
      this._timezone = timezone || null;
      this._locationName = locationName || null;
      this._render();
    }
  }

  setConfig(config) {
    this._config = config;
    this._defaultZoomLevel = (config.default_zoom == null || config.default_zoom < MIN_ZOOM || config.default_zoom > MAX_ZOOM) ? DEFAULT_ZOOM_LEVEL : config.default_zoom;
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

  _navigate(deltaMs) {
    this._currentDate = new Date(this._currentDate.getTime() + deltaMs);
    this._render();
  }

  _goToday() {
    this._currentDate = new Date();
    this._render();
  }

  _zoomIn() {
    if (this._zoomLevel >= MAX_ZOOM) return;
    this._zoomLevel++;
    this._applyZoom();
  }

  _zoomOut() {
    if (this._zoomLevel <= MIN_ZOOM) return;
    this._zoomLevel--;
    this._applyZoom();
  }

  _applyZoom() {
    this._viewWidth = ZOOM_LEVELS[this._zoomLevel];
    this._viewHeight = ZOOM_LEVELS[this._zoomLevel];
    this._updateViewBox();
    const levelDisplay = this.shadowRoot.querySelector(".zoom-level");
    if (levelDisplay) levelDisplay.textContent = this._zoomLevel;
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
    // Initialize view state on first render
    if (this._viewCenterX === null) {
      this._viewCenterX = FULL_SYSTEM_SIZE / 2;
      this._viewCenterY = FULL_SYSTEM_SIZE / 2;
      this._zoomLevel = this._defaultZoomLevel;
      this._viewWidth = ZOOM_LEVELS[this._zoomLevel];
      this._viewHeight = ZOOM_LEVELS[this._zoomLevel];
    }

    // Derive hemisphere from HA location when available
    if (this._lat != null) {
      this._hemisphere = this._lat < 0 ? "south" : "north";
    }

    const locationData = (this._lat != null)
      ? { lat: this._lat, lon: this._lon, timezone: this._timezone }
      : null;

    const statusBarHtml = buildStatusBarHtml(locationData, this._locationName, this._currentDate);
    this.shadowRoot.innerHTML = buildCardHtml(statusBarHtml, this._formatDate(this._currentDate), this._zoomLevel);

    const container = this.shadowRoot.getElementById("solar-view");
    const { svg } = renderSolarSystem(this._currentDate, this._hemisphere, locationData);
    container.appendChild(svg);

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
            this._navigate(-86400000);
            break;
          case "hour-back":
            this._navigate(-3600000);
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
      });
    });
  }

  getCardSize() {
    return 6;
  }

  static getStubConfig() {
    return { default_zoom: 2 };
  }
}
