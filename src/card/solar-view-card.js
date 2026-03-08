import { renderSolarSystem } from "../renderer/index.js";
import { buildCardHtml, buildStatusBarHtml } from "./card-template.js";
import { DEFAULT_ZOOM_LEVEL, MAX_ZOOM, MIN_ZOOM, ViewState } from "./view-state.js";

export class SolarViewCard extends HTMLElement {
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
  }

  connectedCallback() {
    this._render();
    clearInterval(this._autoUpdateTimer);
    this._autoUpdateTimer = setInterval(() => {
      if (
        this._formatDate(this._currentDate).slice(0, 10) ===
        this._formatDate(new Date()).slice(0, 10)
      ) {
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
    if (this._viewState.zoomIn()) this._applyZoom();
  }

  _zoomOut() {
    if (this._viewState.zoomOut()) this._applyZoom();
  }

  _applyZoom() {
    this._updateViewBox();
    const levelDisplay = this.shadowRoot.querySelector(".zoom-level");
    if (levelDisplay) levelDisplay.textContent = this._viewState.zoomLevel;
  }

  _updateViewBox() {
    const svg = this.shadowRoot.querySelector("#solar-view svg");
    if (svg) svg.setAttribute("viewBox", this._viewState.viewBox);
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
    const { svg } = renderSolarSystem(this._currentDate, this._hemisphere, locationData);
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
  }

  getCardSize() {
    return 6;
  }

  static getStubConfig() {
    return { default_zoom: 2 };
  }
}
