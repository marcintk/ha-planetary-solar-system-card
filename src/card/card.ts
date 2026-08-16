import { html, LitElement, nothing } from "lit";
import type {
  CardConfig,
  Colors,
  HASSConfig,
  Hemisphere,
  LocationData,
  ZoomLevel,
} from "../types.js";
import { parseCardConfig } from "./card-config.js";
import { cardStyles } from "./card-styles.js";
import type { ImageSource } from "./card-template.js";
import { buildStatusBarView, formatDate, GALLERY_SOURCE_LABELS } from "./card-template.js";
import { DateNav } from "./date-nav.js";
import type { GalleryMode } from "./gallery-controller.js";
import { GalleryController } from "./gallery-controller.js";
import { formatRelativeAge } from "./relative-time.js";
import { SolarView } from "./solar-view.js";
import { resolveTheme, THEME_OVERRIDE_VARS } from "./theme.js";
import { ZoomController } from "./zoom-controller.js";

export type { GalleryMode };

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
  private _zoom: ZoomController;
  private _hemisphere: Hemisphere;
  private _hassLocation: HassLocation;
  private _locationOverride: LocationOverride | null;
  private _locationNameOverride: string | null;
  private _autoUpdateTimer: number | null;
  private _colors: Colors;
  private _refreshMs: number;
  private _eclipticView: boolean;
  private _theme: "auto" | "dark" | "light";
  private _heightStyle: string;
  private _solarView: SolarView;
  private _onVisibilityChange: (() => void) | null;
  private _gallery: GalleryController;
  _config: CardConfig | undefined;

  constructor() {
    super();
    this._dateNav = new DateNav(() => this._render());
    this._zoom = new ZoomController(
      () => this._render(),
      () => this._solarView.applyViewState()
    );
    this._hemisphere = "north";
    this._hassLocation = { lat: null, lon: null, timezone: null, name: null };
    this._locationOverride = null;
    this._locationNameOverride = null;
    this._autoUpdateTimer = null;
    this._colors = {};
    this._refreshMs = 60000;
    this._eclipticView = false;
    this._theme = "auto";
    this._heightStyle = "";
    this._solarView = new SolarView(this._zoom);
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
    return this._zoom.zoomLevel;
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
    const parsed = parseCardConfig(config);

    this._zoom.configure(
      parsed.zoomLevel,
      parsed.periodicZoomChange,
      parsed.periodicZoomMax,
      parsed.zoomAnimate
    );
    this._refreshMs = parsed.refreshMs;
    this._colors = parsed.colors;
    this._theme = parsed.theme;
    this._eclipticView = parsed.eclipticView;
    this._locationOverride = parsed.locationOverride;
    this._locationNameOverride = parsed.locationNameOverride;
    this._heightStyle = parsed.heightStyle;
    this._gallery.configure(parsed.galleryMode, parsed.galleryIntervalMs);

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

    const gallery = this._gallery.viewModel();
    const statusBar = buildStatusBarView(
      gallery,
      this._locationData,
      this._effectiveLocationName,
      this._dateNav.currentDate
    );
    const zoomLevel = this._zoom.displayZoomLevel;
    const theme = resolveTheme(this._theme, this._colors.background);

    return html`
      <div class="card" style="background: ${theme.background}; color: ${theme.color}">
        <div class="solar-view-wrapper">
          ${statusBar}
          <div
            id="solar-view"
            class=${gallery.panelSource === "none" ? "" : "hidden"}
            style=${this._heightStyle || nothing}
          ></div>
          <img
            id="image-view"
            class="image-view ${gallery.panelSource === "none" ? "" : "visible"}"
            style=${this._heightStyle || nothing}
            src=${gallery.imageUrl ?? nothing}
            alt=""
            @click=${this._onImageClick}
            @load=${this._onImageLoad}
            @error=${this._onImageLoadError}
          />
          ${
            gallery.showStrip
              ? html`<div class="gallery">
                  ${gallery.thumbnails.map(
                    ({ source, url, date }) => html`<button
                      class="gallery-thumb"
                      data-source=${source}
                      title=${`Show ${GALLERY_SOURCE_LABELS[source]}`}
                      @click=${this._onGalleryClick}
                    >
                      <img
                        src=${url ?? nothing}
                        alt=""
                        @error=${source === "sun" ? this._onSunThumbError : undefined}
                      />
                      <div class="gallery-info">
                        <span class="gallery-label">${GALLERY_SOURCE_LABELS[source]}</span>
                        <span class="gallery-age"
                          >${date ? formatRelativeAge(date, new Date()) : "loading…"}</span
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
          <span class="date">${formatDate(this._dateNav.currentDate)}</span>
          <span class="nav-spacer"></span>
          <span class="btn-group">
            <button data-action="zoom-out" title="Zoom out" @click=${this._onNavClick}>&minus;</button>
            <span class="zoom-level">${zoomLevel}</span>
            <button data-action="zoom-in" title="Zoom in" @click=${this._onNavClick}>+</button>
          </span>
          ${
            gallery.navButtonVisible
              ? html`<span class="nav-spacer"></span>
                  <span class="btn-group">
                    <button
                      data-action="gallery"
                      title="Show image gallery"
                      class=${gallery.navButtonActive ? "active" : ""}
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
    this._zoom.ensureInitialized();

    const container = (this.shadowRoot as ShadowRoot).getElementById("solar-view");
    /* v8 ignore next */
    if (container) {
      this._solarView.mount(
        container,
        this._dateNav.currentDate,
        this._hemisphere,
        this._locationData,
        this._colors,
        this._eclipticView
      );
    }

    this._solarView.applyViewState();
    const theme = resolveTheme(this._theme, this._colors.background);
    this.style.background = theme.background;
    this.style.color = theme.color;
    for (const varName of THEME_OVERRIDE_VARS) {
      if (theme.vars[varName] === null) {
        this.style.removeProperty(varName);
      } else {
        this.style.setProperty(varName, theme.vars[varName]);
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
      this._zoom.tick();
      this._gallery.tick();
    }, interval) as unknown as number;
  }

  private _navigate(deltaMs: number): void {
    this._dateNav.navigate(deltaMs);
  }

  private _goToday(): void {
    // Recenter before goLive() so its render picks up the recentered viewState.
    this._zoom.recenter();
    this._dateNav.goLive();
  }

  private _onNavClick(e: Event): void {
    this._handleNavAction((e.currentTarget as HTMLButtonElement).dataset.action);
  }

  private _onGalleryClick(e: Event): void {
    const source = (e.currentTarget as HTMLButtonElement).dataset.source as ImageSource;
    this._gallery.openPanel(source);
  }

  private _handleNavAction(action: string | undefined): void {
    switch (action) {
      case "replay":
        this._dateNav.toggleReplay();
        break;
      case "zoom-out":
        this._zoom.zoomOut();
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
        this._zoom.zoomIn();
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
