import { html, LitElement, nothing } from "lit";
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
import type { ImageSource } from "./card-template.js";
import { buildImageStatusBar, buildStatusBar, GALLERY_SOURCE_LABELS } from "./card-template.js";
import { DEFAULT_ZOOM_LEVEL, MAX_ZOOM, MIN_ZOOM, ViewState } from "./card-view-state.js";
import { DateNav } from "./date-nav.js";
import type { GalleryMode } from "./gallery-controller.js";
import {
  DEFAULT_GALLERY_INTERVAL_MS,
  GALLERY_MODES,
  GalleryController,
} from "./gallery-controller.js";
import { formatRelativeAge } from "./relative-time.js";
import { ZoomAnimator } from "./zoom-animator.js";

export type { GalleryMode };

// Built-in background+text pairs for `theme: "dark" | "light"` — forces every currentColor-
// derived accent (orbit, labels, twilight cones, needle, ...) to a consistent palette
// regardless of the HA theme actually installed. `colors.background` still overrides the
// background half, matching how colors.* already layers on top elsewhere.
const THEME_PALETTES: Record<"dark" | "light", { background: string; color: string }> = {
  dark: { background: "#1c1c1c", color: "#e1e1e1" },
  light: { background: "#ffffff", color: "#212121" },
};

// card-styles.ts leans on these HA custom properties (status-bar/nav backgrounds, borders)
// with a currentColor-based fallback for when HA doesn't define them. But HA always defines
// them — from whichever theme is actually installed — and custom properties pierce the shadow
// boundary, so a forced dark/light `theme:` only overriding :host's plain background/color
// still left every var(--secondary-background-color, ...) etc. resolving to the real (possibly
// mismatched) HA theme's value instead of the intended fallback. Setting each to the CSS-wide
// keyword "initial" makes it the custom property's guaranteed-invalid value, which is exactly
// what makes var()'s fallback kick in.
const THEME_OVERRIDE_VARS = [
  "--ha-card-background",
  "--card-background-color",
  "--primary-background-color",
  "--primary-text-color",
  "--secondary-background-color",
  "--divider-color",
];

// Resolves config.height into an inline style for #solar-view/.image-view. A px value caps
// the height and lets the square SVG/image letterbox-shrink to fit (preserveAspectRatio
// "meet" — nothing crops). A percent reshapes the aspect-ratio itself (e.g. "50%" = half as
// tall as wide) since CSS max-height can't resolve against an auto-height parent.
function resolveHeightStyle(height: CardConfig["height"]): string {
  if (typeof height === "number") {
    return height > 0 ? `max-height: ${height}px` : "";
  }
  if (typeof height === "string") {
    const px = /^(\d+(?:\.\d+)?)px$/.exec(height);
    if (px) return `max-height: ${px[1]}px`;
    const pct = /^(\d+(?:\.\d+)?)%$/.exec(height);
    if (pct) {
      const n = Number(pct[1]);
      return n > 0 ? `aspect-ratio: ${100 / n}` : "";
    }
  }
  return "";
}

// HASS and config.location update independently (hass setter vs. setConfig), so each source
// is kept as one grouped field rather than losing either one to an eager merge — _locationData
// and _locationName below resolve them on read, override winning per-field.
interface HassLocation {
  lat: number | null;
  lon: number | null;
  timezone: string | null;
  name: string | null;
}
interface LocationOverride {
  lat: number;
  lon: number;
}

export class SolarViewCard extends LitElement {
  static styles = cardStyles;

  private _dateNav: DateNav;
  private _viewState: ViewState | null;
  private _zoomAnimator: ZoomAnimator | null;
  private _defaultZoomLevel: ZoomLevel;
  private _hemisphere: Hemisphere;
  private _hassLocation: HassLocation;
  private _locationOverride: LocationOverride | null;
  private _locationNameOverride: string | null;
  private _autoUpdateTimer: number | null;
  private _colors: Colors;
  private _refreshMs: number;
  private _periodicZoomChange: boolean;
  private _periodicZoomMax: number;
  private _zoomAnimate: boolean;
  private _eclipticView: boolean;
  private _theme: "auto" | "dark" | "light";
  private get _themePalette(): { background: string; color: string } | null {
    return this._theme === "auto" ? null : THEME_PALETTES[this._theme];
  }
  private _heightStyle: string;
  private _positions: ViewPosition[];
  private _onVisibilityChange: (() => void) | null;
  private _gallery: GalleryController;
  _config: CardConfig | undefined;

  constructor() {
    super();
    this._dateNav = new DateNav(() => this._render());
    this._viewState = null;
    this._zoomAnimator = null;
    this._defaultZoomLevel = DEFAULT_ZOOM_LEVEL;
    this._hemisphere = "north";
    this._hassLocation = { lat: null, lon: null, timezone: null, name: null };
    this._locationOverride = null;
    this._locationNameOverride = null;
    this._autoUpdateTimer = null;
    this._colors = {};
    this._refreshMs = 60000;
    this._periodicZoomChange = false;
    this._periodicZoomMax = MAX_ZOOM;
    this._zoomAnimate = false;
    this._eclipticView = false;
    this._theme = "auto";
    this._heightStyle = "";
    this._positions = [];
    this._onVisibilityChange = null;
    this._gallery = new GalleryController(() => this._render());
  }

  // ---------------------------------------------------------------------------
  // Proxy getters
  // ---------------------------------------------------------------------------
  get _locationData(): LocationData | null {
    const lat = this._locationOverride?.lat ?? this._hassLocation.lat;
    const lon = this._locationOverride?.lon ?? this._hassLocation.lon;
    return lat != null && lon != null
      ? { lat, lon, timezone: this._hassLocation.timezone ?? "UTC" }
      : null;
  }
  get _effectiveLocationName(): string | null {
    return this._locationNameOverride ?? this._hassLocation.name;
  }
  get _zoomLevel(): ZoomLevel | null {
    return this._viewState?.zoomLevel ?? null;
  }

  set hass(hass: HASSConfig) {
    const next: HassLocation = {
      lat: hass.config?.latitude ?? null,
      lon: hass.config?.longitude ?? null,
      timezone: hass.config?.time_zone || null,
      name: hass.config?.location_name || null,
    };
    const prev = this._hassLocation;
    if (
      next.lat !== prev.lat ||
      next.lon !== prev.lon ||
      next.timezone !== prev.timezone ||
      next.name !== prev.name
    ) {
      this._hassLocation = next;
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

    this._colors = config.colors ?? {};
    this._theme = config.theme === "dark" || config.theme === "light" ? config.theme : "auto";

    this._eclipticView = config.ecliptic_view === "south";

    const overrideLat = config.location?.latitude;
    const overrideLon = config.location?.longitude;
    const hasOverride =
      typeof overrideLat === "number" &&
      typeof overrideLon === "number" &&
      overrideLat >= -90 &&
      overrideLat <= 90 &&
      overrideLon >= -180 &&
      overrideLon <= 180;
    this._locationOverride = hasOverride ? { lat: overrideLat, lon: overrideLon } : null;
    this._locationNameOverride = config.location?.name || null;
    this._heightStyle = resolveHeightStyle(config.height);

    const galleryMode = GALLERY_MODES.includes(config.gallery?.mode as GalleryMode)
      ? (config.gallery?.mode as GalleryMode)
      : "none";
    const rawInterval = Number(config.gallery?.slide_interval_secs);
    const galleryAutoIntervalMs =
      Number.isFinite(rawInterval) && rawInterval >= 0.1
        ? rawInterval * 1000
        : DEFAULT_GALLERY_INTERVAL_MS;
    this._gallery.configure(galleryMode, galleryAutoIntervalMs);

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
    this._gallery.start();
    this._onVisibilityChange = () => {
      if (!document.hidden) this._dateNav.tick();
    };
    document.addEventListener("visibilitychange", this._onVisibilityChange);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._autoUpdateTimer ?? undefined);
    this._autoUpdateTimer = null;
    this._gallery.stop();
    this._dateNav.stop();
    if (this._onVisibilityChange) {
      document.removeEventListener("visibilitychange", this._onVisibilityChange);
    }
    this._onVisibilityChange = null;
  }

  render() {
    const lat = this._locationData?.lat;
    if (lat != null) {
      this._hemisphere = lat < 0 ? "south" : "north";
    }

    const statusBar = this._gallery.error
      ? html`<div class="status-bar">
          <span>${this._gallery.error}</span>
        </div>`
      : this._gallery.panelMode === "none"
        ? buildStatusBar(this._locationData, this._effectiveLocationName, this._dateNav.currentDate)
        : buildImageStatusBar(
            this._gallery.panelMode,
            this._gallery.imageDate ? this._formatDate(this._gallery.imageDate) : "",
            this._gallery.imageDate ?? new Date(),
            new Date(),
            this._gallery.imageLoaded
          );
    const zoomLevel = this._viewState?.zoomLevel ?? this._defaultZoomLevel;
    /* v8 ignore next */
    const background = this._colors.background ?? this._themePalette?.background ?? "";
    const color = this._themePalette?.color ?? "";

    return html`
      <div class="card" style="background: ${background}; color: ${color}">
        <div class="solar-view-wrapper">
          ${statusBar}
          <div
            id="solar-view"
            class=${this._gallery.panelMode === "none" ? "" : "hidden"}
            style=${this._heightStyle || nothing}
          ></div>
          <img
            id="image-view"
            class="image-view ${this._gallery.panelMode === "none" ? "" : "visible"}"
            style=${this._heightStyle || nothing}
            src=${this._gallery.imageUrl ?? nothing}
            alt=""
            @click=${this._onImageClick}
            @load=${this._onImageLoad}
            @error=${this._onImageLoadError}
          />
          ${
            this._gallery.isOpen && this._gallery.panelMode === "none"
              ? html`<div class="gallery">
                  ${this._gallery.displaySources.map(
                    (source) => html`<button
                      class="gallery-thumb"
                      data-source=${source}
                      title=${`Show ${GALLERY_SOURCE_LABELS[source]}`}
                      @click=${this._onGalleryClick}
                    >
                      <img
                        src=${this._gallery.images[source]?.url ?? nothing}
                        alt=""
                        @error=${source === "sun" ? this._onSunThumbError : undefined}
                      />
                      <div class="gallery-info">
                        <span class="gallery-label">${GALLERY_SOURCE_LABELS[source]}</span>
                        <span class="gallery-age"
                          >${
                            this._gallery.images[source]
                              ? formatRelativeAge(
                                  this._gallery.images[source]?.date as Date,
                                  new Date()
                                )
                              : "loading…"
                          }</span
                        >
                      </div>
                    </button>`
                  )}
                </div>`
              : nothing
          }
        </div>
        <div class="nav">
          <span class="btn-group">
            <button data-action="month-back" title="Back 1 month" ?disabled=${this._dateNav.isReplaying} @click=${this._onNavClick}>⋘</button>
            <button data-action="day-back" title="Back 1 day" ?disabled=${this._dateNav.isReplaying} @click=${this._onNavClick}>≪</button>
            <button data-action="hour-back" title="Back 1 hour" ?disabled=${this._dateNav.isReplaying} @click=${this._onNavClick}>&lt;</button>
            <button data-action="today" ?disabled=${this._dateNav.isReplaying} @click=${this._onNavClick}>Now</button>
            <button data-action="hour-forward" title="Forward 1 hour" ?disabled=${this._dateNav.isReplaying} @click=${this._onNavClick}>&gt;</button>
            <button data-action="day-forward" title="Forward 1 day" ?disabled=${this._dateNav.isReplaying} @click=${this._onNavClick}>≫</button>
            <button data-action="month-forward" title="Forward 1 month" ?disabled=${this._dateNav.isReplaying} @click=${this._onNavClick}>⋙</button>
            <button data-action="replay" title="Replay last 6h" @click=${this._onNavClick}>↺</button>
          </span>
          <span class="nav-spacer"></span>
          <span class="date">${this._formatDate(this._dateNav.currentDate)}</span>
          <span class="nav-spacer"></span>
          <span class="btn-group">
            <button data-action="zoom-out" title="Zoom out" @click=${this._onNavClick}>&minus;</button>
            <span class="zoom-level">${zoomLevel}</span>
            <button data-action="zoom-in" title="Zoom in" @click=${this._onNavClick}>+</button>
          </span>
          ${
            this._gallery.mode !== "none"
              ? html`<span class="nav-spacer"></span>
                  <span class="btn-group">
                    <button
                      data-action="gallery"
                      title="Show image gallery"
                      class=${this._gallery.isOpen ? "active" : ""}
                      @click=${this._onNavClick}
                    >
                      <span class="icon">☷</span>
                    </button>
                  </span>`
              : nothing
          }
          ${this._config?.show_version ? html`<span class="card-version">v${__CARD_VERSION__}</span>` : nothing}
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
        this._dateNav.currentDate,
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
    this.style.background = this._colors.background ?? this._themePalette?.background ?? "";
    this.style.color = this._themePalette?.color ?? "";
    for (const varName of THEME_OVERRIDE_VARS) {
      if (this._themePalette) {
        this.style.setProperty(varName, "initial");
      } else {
        this.style.removeProperty(varName);
      }
    }
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
      this._dateNav.tick();
      if (this._periodicZoomChange) {
        this._advanceZoom();
      }
      this._gallery.tick();
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
    this._dateNav.navigate(deltaMs);
  }

  private _goToday(): void {
    // Recenter before goLive() so its render picks up the recentered viewState.
    this._viewState?.recenter();
    this._dateNav.goLive();
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

  private _onGalleryClick(e: Event): void {
    const source = (e.currentTarget as HTMLButtonElement).dataset.source as ImageSource;
    this._gallery.openPanel(source);
  }

  private _bindSvgEvents(svg: SVGSVGElement): void {
    svg.addEventListener("pointerdown", (e) => this._onPointerDown(e));
    svg.addEventListener("pointermove", (e) => this._onPointerMove(e));
    svg.addEventListener("pointerup", (e) => this._onPointerUp(e));
  }

  private _handleNavAction(action: string | undefined): void {
    switch (action) {
      case "replay":
        this._dateNav.toggleReplay();
        break;
      case "zoom-out":
        this._zoomOut();
        break;
      case "month-back":
        this._dateNav.navigateMonths(-1);
        break;
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
      case "month-forward":
        this._dateNav.navigateMonths(1);
        break;
      case "zoom-in":
        this._zoomIn();
        break;
      case "gallery":
        this._gallery.toggle();
        break;
    }
  }

  private _onImageClick(): void {
    this._gallery.closePanel();
  }

  private _onImageLoadError(): void {
    this._gallery.onImageLoadError();
  }

  private _onImageLoad(): void {
    this._gallery.onImageLoad();
  }

  private _onSunThumbError(): void {
    this._gallery.onSunThumbError();
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
      colors: {},
      gallery: { mode: "both" },
    };
  }
}
