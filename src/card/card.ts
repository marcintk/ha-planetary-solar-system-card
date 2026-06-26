import { html, LitElement } from "lit";
import { renderSolarSystem } from "../renderer/index.js";
import { MARKER_GROUP_ID, renderOffscreenMarkers } from "../renderer/offscreen-markers.js";
import type {
  CardConfig,
  Colors,
  HASSConfig,
  Hemisphere,
  LocationData,
  ViewPosition,
  ZoomLevel,
} from "../types.js";
import { cardStyles } from "./card-styles.js";
import { buildStatusBar } from "./card-template.js";
import { DEFAULT_ZOOM_LEVEL, MAX_ZOOM, MIN_ZOOM, ViewState } from "./card-view-state.js";
import { ZoomAnimator } from "./zoom-animator.js";

const DEFAULT_COLORS: Colors = {
  background: "#090909",
  orbit: "rgba(255, 255, 255, 0.12)",
  label: "#ffffff",
};

export class SolarViewCard extends LitElement {
  static styles = cardStyles;

  private _currentDate: Date;
  private _isLiveMode: boolean;
  private _viewState: ViewState | null;
  private _zoomAnimator: ZoomAnimator | null;
  private _defaultZoomLevel: ZoomLevel;
  private _hemisphere: Hemisphere;
  private _lat: number | null;
  private _lon: number | null;
  private _timezone: string | null;
  private _locationName: string | null;
  private _autoUpdateTimer: number | null;
  private _colors: Colors;
  private _refreshMs: number;
  private _periodicZoomChange: boolean;
  private _periodicZoomMax: number;
  private _zoomAnimate: boolean;
  private _eclipticView: boolean;
  private _positions: ViewPosition[];
  private _onVisibilityChange: (() => void) | null;
  _config: CardConfig | undefined;

  constructor() {
    super();
    this._currentDate = new Date();
    this._isLiveMode = true;
    this._viewState = null;
    this._zoomAnimator = null;
    this._defaultZoomLevel = DEFAULT_ZOOM_LEVEL;
    this._hemisphere = "north";
    this._lat = null;
    this._lon = null;
    this._timezone = null;
    this._locationName = null;
    this._autoUpdateTimer = null;
    this._colors = { ...DEFAULT_COLORS };
    this._refreshMs = 60000;
    this._periodicZoomChange = false;
    this._periodicZoomMax = MAX_ZOOM;
    this._zoomAnimate = false;
    this._eclipticView = false;
    this._positions = [];
    this._onVisibilityChange = null;
  }

  // ---------------------------------------------------------------------------
  // Proxy getters
  // ---------------------------------------------------------------------------
  get _isDragging(): boolean {
    return this._viewState?.isDragging ?? false;
  }
  get _locationData(): LocationData | null {
    return this._lat != null && this._lon != null
      ? { lat: this._lat, lon: this._lon, timezone: this._timezone ?? "UTC" }
      : null;
  }
  get _viewCenterX(): number | null {
    return this._viewState?.centerX ?? null;
  }
  get _viewCenterY(): number | null {
    return this._viewState?.centerY ?? null;
  }
  get _zoomLevel(): ZoomLevel | null {
    return this._viewState?.zoomLevel ?? null;
  }

  set hass(hass: HASSConfig) {
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

  setConfig(config: CardConfig): void {
    this._config = config;
    this._defaultZoomLevel =
      config.default_zoom == null ||
      config.default_zoom < MIN_ZOOM ||
      config.default_zoom > MAX_ZOOM
        ? DEFAULT_ZOOM_LEVEL
        : (config.default_zoom as ZoomLevel);

    const rawRefresh = Number(config.refresh_mins);
    this._refreshMs = Number.isFinite(rawRefresh) && rawRefresh >= 0.1 ? rawRefresh * 60000 : 60000;

    this._periodicZoomChange = config.periodic_zoom_change === true;
    const rawMax = Number(config.periodic_zoom_max);
    this._periodicZoomMax =
      Number.isInteger(rawMax) && rawMax >= 2 && rawMax <= MAX_ZOOM ? rawMax : MAX_ZOOM;
    this._zoomAnimate = config.zoom_animate !== false;

    this._colors = {
      background: config.colors?.background ?? DEFAULT_COLORS.background,
      orbit: config.colors?.orbit ?? DEFAULT_COLORS.orbit,
      label: config.colors?.label ?? DEFAULT_COLORS.label,
    };

    this._eclipticView = config.ecliptic_view === "south";

    if (this._autoUpdateTimer != null) {
      this._startAutoUpdateTimer();
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    // Force synchronous initial render so the shadow DOM is ready immediately.
    // Lit's default schedules the first paint as a microtask, which would break
    // synchronous tests and delay the first frame in HA.
    this._render();
    this._startAutoUpdateTimer();
    this._onVisibilityChange = () => {
      if (!document.hidden && this._isLiveMode) {
        this._currentDate = new Date();
        this._render();
      }
    };
    document.addEventListener("visibilitychange", this._onVisibilityChange);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._autoUpdateTimer ?? undefined);
    this._autoUpdateTimer = null;
    if (this._onVisibilityChange) {
      document.removeEventListener("visibilitychange", this._onVisibilityChange);
    }
    this._onVisibilityChange = null;
  }

  render() {
    if (this._lat != null) {
      this._hemisphere = this._lat < 0 ? "south" : "north";
    }

    const statusBar = buildStatusBar(this._locationData, this._locationName, this._currentDate);
    const zoomLevel = this._viewState?.zoomLevel ?? this._defaultZoomLevel;
    /* v8 ignore next */
    const background = this._colors.background ?? "";

    return html`
      <div class="card" style="background: ${background}">
        <div class="solar-view-wrapper">
          ${statusBar}
          <div id="solar-view"></div>
        </div>
        <div class="nav">
          <span class="btn-group">
            <button data-action="month-back" @click=${this._onNavClick}>⋘</button>
            <button data-action="day-back" @click=${this._onNavClick}>«</button>
            <button data-action="hour-back" @click=${this._onNavClick}>‹</button>
            <button data-action="today" @click=${this._onNavClick}>Now</button>
            <button data-action="hour-forward" @click=${this._onNavClick}>›</button>
            <button data-action="day-forward" @click=${this._onNavClick}>»</button>
            <button data-action="month-forward" @click=${this._onNavClick}>⋙</button>
          </span>
          <span class="nav-spacer"></span>
          <span class="date">${this._formatDate(this._currentDate)}</span>
          <span class="nav-spacer"></span>
          <span class="btn-group">
            <button data-action="zoom-out" @click=${this._onNavClick}>&minus;</button>
            <span class="zoom-level">${zoomLevel}</span>
            <button data-action="zoom-in" @click=${this._onNavClick}>+</button>
          </span>
          <span class="card-version">v${__CARD_VERSION__}</span>
        </div>
      </div>
    `;
  }

  updated(): void {
    if (!this._viewState) {
      this._viewState = new ViewState(this._defaultZoomLevel);
      this._zoomAnimator = new ZoomAnimator(this._viewState, () => this._updateViewBox());
    }

    const container = (this.shadowRoot as ShadowRoot).getElementById("solar-view");
    /* v8 ignore next */
    if (container) {
      while (container.firstChild) container.removeChild(container.firstChild);
      const { svg, positions } = renderSolarSystem(
        this._currentDate,
        this._hemisphere,
        this._locationData,
        this._colors,
        this._eclipticView
      );
      this._positions = positions;
      container.appendChild(svg);
      this._bindSvgEvents(svg);
    }

    this._updateViewBox();
    /* v8 ignore next */
    this.style.background = this._colors.background ?? "";
  }

  /**
   * Forces a synchronous Lit update. Uses requestUpdate to mark a pending
   * update (required for performUpdate to run), then immediately flushes it.
   * Called directly for state changes that need the DOM in sync (same pattern
   * as the old imperative _render()).
   */
  _render(): void {
    this.requestUpdate();
    this.performUpdate();
  }

  private _startAutoUpdateTimer(): void {
    /* v8 ignore next */
    clearInterval(this._autoUpdateTimer ?? undefined);
    /* v8 ignore next */
    const interval = this._refreshMs;
    this._autoUpdateTimer = setInterval(() => {
      if (this._isLiveMode) {
        this._currentDate = new Date();
        this._render();
      }
      if (this._periodicZoomChange) {
        this._advanceZoom();
      }
    }, interval) as unknown as number;
  }

  private _advanceZoom(): void {
    if (!this._viewState) return;
    const prevWidth = this._viewState.width;
    const next =
      this._viewState.zoomLevel >= this._periodicZoomMax ? MIN_ZOOM : this._viewState.zoomLevel + 1;
    this._viewState.setZoomLevel(next);
    this._applyZoom(prevWidth);
  }

  private _formatDate(date: Date): string {
    const y = String(date.getFullYear()).slice(-2);
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${d} ${hh}:${mm}`;
  }

  private _navigate(deltaMs: number): void {
    this._isLiveMode = false;
    this._currentDate = new Date(this._currentDate.getTime() + deltaMs);
    this._render();
  }

  private _goToday(): void {
    this._isLiveMode = true;
    this._currentDate = new Date();
    this._render();
  }

  private _zoomIn(): void {
    if (!this._viewState) return;
    const prevWidth = this._viewState.width;
    if (this._viewState.zoomIn()) this._applyZoom(prevWidth);
  }

  private _zoomOut(): void {
    if (!this._viewState) return;
    const prevWidth = this._viewState.width;
    if (this._viewState.zoomOut()) this._applyZoom(prevWidth);
  }

  private _applyZoom(fromWidth: number): void {
    if (!this._viewState) return;
    if (this._zoomAnimate && this._zoomAnimator) {
      this._render();
      this._zoomAnimator.animateTo(this._viewState.zoomLevel, fromWidth, () => this._render());
    } else {
      this._render();
    }
  }

  private _updateViewBox(): void {
    if (!this._viewState) return;
    const svg = (this.shadowRoot as ShadowRoot).querySelector(
      "#solar-view svg"
    ) as SVGSVGElement | null;
    if (svg) svg.setAttribute("viewBox", this._viewState.viewBox);
    this._updateOffscreenMarkers();
  }

  private _updateOffscreenMarkers(): void {
    const svg = (this.shadowRoot as ShadowRoot).querySelector(
      "#solar-view svg"
    ) as SVGSVGElement | null;
    if (!svg) return;
    const old = svg.getElementById(MARKER_GROUP_ID);
    if (old) old.remove();
    if (this._positions && this._viewState) {
      svg.appendChild(renderOffscreenMarkers(this._positions, this._viewState));
    }
  }

  private _onPointerDown(e: PointerEvent): void {
    const svg = e.currentTarget as SVGSVGElement;
    svg.setPointerCapture(e.pointerId);
    this._viewState?.startDrag(e.clientX, e.clientY);
    svg.style.cursor = "grabbing";
  }

  private _onPointerMove(e: PointerEvent): void {
    if (!this._viewState?.isDragging) return;
    const svg = e.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    this._viewState.updateDrag(e.clientX, e.clientY, rect);
    this._updateViewBox();
  }

  private _onPointerUp(e: PointerEvent): void {
    if (!this._viewState?.isDragging) return;
    this._viewState.endDrag();
    const svg = e.currentTarget as SVGSVGElement;
    svg.releasePointerCapture(e.pointerId);
    svg.style.cursor = "grab";
  }

  private _onNavClick(e: Event): void {
    this._handleNavAction((e.currentTarget as HTMLButtonElement).dataset.action);
  }

  private _bindSvgEvents(svg: SVGSVGElement): void {
    svg.addEventListener("pointerdown", (e) => this._onPointerDown(e));
    svg.addEventListener("pointermove", (e) => this._onPointerMove(e));
    svg.addEventListener("pointerup", (e) => this._onPointerUp(e));
  }

  private _handleNavAction(action: string | undefined): void {
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

  getCardSize(): number {
    return 6;
  }

  static getStubConfig(): CardConfig {
    return {
      default_zoom: 2,
      periodic_zoom_change: false,
      periodic_zoom_max: 4,
      refresh_mins: 1,
      zoom_animate: true,
      colors: { ...DEFAULT_COLORS },
    };
  }
}
