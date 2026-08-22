import type { TemplateResult } from "lit";
import { html, LitElement, nothing } from "lit";
import { getMoonPhase } from "../astronomy/moon-phase.js";
import { getMoonSkyAngles } from "../astronomy/parallactic.js";
import { getLocalHourInstant } from "../astronomy/solar-position.js";
import { renderMoonPhaseDisc } from "../renderer/moon-phase.js";
import type { CardConfig, Colors, HASSConfig, Hemisphere, LocationData } from "../types.js";
import { parseCardConfig } from "./card-config.js";
import { cardStyles } from "./card-styles.js";
import type { GallerySource, ImageSource } from "./card-template.js";
import {
  buildGalleryCaption,
  buildMoonTitle,
  buildStatusBarView,
  discStyle,
  formatDate,
  GALLERY_SOURCE_LABELS,
} from "./card-template.js";
import { DateNavigation } from "./date-navigation.js";
import { buildDebugOverlay } from "./gallery/debug.js";
import type {
  GalleryMode,
  GalleryPosition,
  GalleryShape,
  ImagePanelMode,
} from "./gallery/gallery-controller.js";
import { GalleryController } from "./gallery/gallery-controller.js";
import { fullSizeMoonUrl, SKY_REFERENCE_HOUR } from "./gallery/source-resolver-svs-moon.js";
import { formatRelativeWhen } from "./relative-time.js";
import { SolarView } from "./solar-view.js";
import { resolveTheme, THEME_OVERRIDE_VARS } from "./theme.js";
import { ZoomController } from "./zoom-controller.js";

export type { GalleryMode };

// Nav actions that pause the periodic zoom auto-cycle until Home. Zoom and drag flag themselves
// inside ZoomController; these are the ones it can't see. Deliberately absent: "today" (the way
// back), "replay" (a time animation, not a camera move), "gallery" (a different panel).
const SUSPENDS_AUTO_ZOOM = new Set([
  "hour-back",
  "hour-forward",
  "day-back",
  "day-forward",
  "month-back",
  "month-forward",
]);

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
  timezone: string;
}

export class SolarViewCard extends LitElement {
  static styles = cardStyles;

  private _dateNav: DateNavigation;
  private _zoom: ZoomController;
  private _hemisphere: Hemisphere;
  private _hassLocation: HassLocation;
  private _locationOverride: LocationOverride | null;
  private _locationNameOverride: string | null;
  private _autoUpdateTimer: number | null;
  private _debugTimer: number | null;
  private _galleryPosition: GalleryPosition;
  private _galleryShape: GalleryShape;
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
    this._dateNav = new DateNavigation(() => this._render());
    this._zoom = new ZoomController(
      () => this._render(),
      () => this._solarView.applyViewState()
    );
    this._hemisphere = "north";
    this._hassLocation = { lat: null, lon: null, timezone: null, name: null };
    this._locationOverride = null;
    this._locationNameOverride = null;
    this._autoUpdateTimer = null;
    this._debugTimer = null;
    this._galleryPosition = "overlay";
    this._galleryShape = "square";
    this._colors = {};
    this._refreshMs = 60000;
    this._eclipticView = false;
    this._theme = "auto";
    this._heightStyle = "";
    this._solarView = new SolarView(this._zoom);
    this._onVisibilityChange = null;
    this._gallery = new GalleryController(
      () => this._render(),
      () => this._locationData?.timezone ?? "UTC"
    );
  }

  // ---------------------------------------------------------------------------
  // Proxy getters
  // ---------------------------------------------------------------------------
  get _locationData(): LocationData | null {
    const override = this._locationOverride;
    const lat = override?.lat ?? this._hassLocation.lat;
    const lon = override?.lon ?? this._hassLocation.lon;
    return lat != null && lon != null
      ? {
          lat,
          lon,
          timezone: override?.timezone ?? this._hassLocation.timezone ?? "UTC",
          zoneOverride: override != null,
        }
      : null;
  }
  get _effectiveLocationName(): string | null {
    return this._locationNameOverride ?? this._hassLocation.name;
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
    this._galleryPosition = parsed.galleryPosition;
    this._galleryShape = parsed.galleryShape;
    this._gallery.configure(parsed.galleryMode, parsed.gallerySources, parsed.galleryIntervalMs);

    if (this._autoUpdateTimer != null) {
      this._startAutoUpdateTimer();
    }
    if (this._debugTimer != null || config.debug) {
      this._startDebugTimer();
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    // Force synchronous initial render so the shadow DOM is ready immediately.
    // Lit's default schedules the first paint as a microtask, which would break
    // synchronous tests and delay the first frame in HA.
    this._render();
    this._startAutoUpdateTimer();
    this._startDebugTimer();
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
    clearInterval(this._debugTimer ?? undefined);
    this._debugTimer = null;
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
          <div class="status-bar-row">
            ${statusBar}
            ${this._config?.debug ? buildDebugOverlay(gallery.debugStats, gallery.debugStartedAt) : nothing}
          </div>
          <div
            id="solar-view"
            class=${gallery.panelSource === "none" ? "" : "hidden"}
            style=${this._heightStyle || nothing}
          ></div>
          <img
            id="image-view"
            class="image-view ${gallery.panelSource === "none" ? "" : "visible"} ${
              gallery.panelSource === "mymoon" ? "sky-rotated" : ""
            }"
            style=${this._panelStyle(gallery.panelSource)}
            src=${gallery.imageUrl ? fullSizeMoonUrl(gallery.imageUrl) : nothing}
            alt=""
            @click=${this._onImageClick}
            @load=${this._onImageLoad}
            @error=${this._onImageLoadError}
          />
          ${
            gallery.showStrip
              ? html`<div class="gallery gallery-${this._galleryPosition}">
                  ${gallery.thumbnails.map(({ source, url, date }) =>
                    this._renderGalleryTile(source, url, date)
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
            <button data-action="today" title="Back to the default view" class=${this._zoom.isDefaultView && this._dateNav.isLiveMode ? "" : "active"} ?disabled=${this._dateNav.isReplaying} @click=${this._onNavClick}>Now</button>
            <button data-action="hour-forward" title="Forward 1 hour" ?disabled=${this._dateNav.isReplaying} @click=${this._onNavClick}>&gt;</button>
            <button data-action="day-forward" title="Forward 1 day" ?disabled=${this._dateNav.isReplaying} @click=${this._onNavClick}>≫</button>
            <button data-action="month-forward" title="Forward 1 month" ?disabled=${this._dateNav.isReplaying} @click=${this._onNavClick}>⋙</button>
            <button data-action="replay" title="Replay last ${this._dateNav.replayLabel}" @click=${this._onNavClick}>↺</button>
          </span>
          <span class="nav-spacer"></span>
          <span class="date">${formatDate(this._dateNav.currentDate)}</span>
          <span class="nav-spacer"></span>
          <span class="btn-group">
            <button data-action="zoom-out" title="Zoom out" @click=${this._onNavClick}>&minus;</button>
            <span class="zoom-level">${zoomLevel}</span>
            <button data-action="zoom-in" title="Zoom in" @click=${this._onNavClick}>+</button>
          </span>
          <span class="nav-spacer"></span>
          <span class="btn-group">
            <button data-action="gallery" title="Show image gallery" @click=${this._onNavClick}>
              <span class="icon">☷</span>
            </button>
          </span>
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
    this._mountMoonDisc();
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
   * One gallery tile. Every source is a fetched NASA image now, so there is one shape rather
   * than a moon branch and an everything-else branch.
   *
   * The sky tile is the only one that differs, and only by two things: it is rotated into the
   * observer's own orientation, and its caption points at 22:00 rather than at the past. Both
   * come from the same hour-angle calculation, so both are computed here in one call.
   */
  private _renderGalleryTile(
    source: GallerySource,
    url: string | null,
    date: Date | null
  ): TemplateResult {
    // The locally drawn disc is the one tile with nothing behind it to fetch: a <div>, not a
    // <button>, because it has no full-screen view and looking clickable would promise
    // something no click can deliver. Its SVG is mounted imperatively in updated().
    if (source === "drawnmoon") {
      return html`<div
        class="gallery-thumb gallery-thumb-moon"
        data-source="drawnmoon"
        title=${buildMoonTitle(this._dateNav.currentDate, this._dateNav.isLiveMode)}
      >
        <div class="moon-disc"></div>
        ${buildGalleryCaption(
          GALLERY_SOURCE_LABELS.drawnmoon,
          getMoonPhase(this._dateNav.currentDate).phaseName
        )}
      </div>`;
    }
    const sky = source === "mymoon" ? this._skyView() : null;
    return html`<button
      class="gallery-thumb"
      data-source=${source}
      title=${`Show ${GALLERY_SOURCE_LABELS[source]}`}
      @click=${this._onGalleryClick}
    >
      <img
        src=${url ?? nothing}
        alt=""
        style=${discStyle(source, this._galleryShape, sky ? sky.rotation : 0)}
        @error=${source === "sun" ? this._onSunThumbError : undefined}
      />
      ${buildGalleryCaption(
        GALLERY_SOURCE_LABELS[source],
        sky ? sky.caption : date ? formatRelativeWhen(date, new Date()) : "loading…"
      )}
    </button>`;
  }

  /**
   * The full-screen image's inline style: the configured height cap, plus the sky tile's own
   * rotation so the panel shows what the thumbnail showed rather than snapping back to the
   * geocentric frame the moment it is opened.
   */
  private _panelStyle(panelSource: ImagePanelMode): string | typeof nothing {
    const parts = [this._heightStyle];
    if (panelSource === "mymoon") {
      parts.push(`transform: rotate(${this._skyView().rotation.toFixed(1)}deg)`);
    }
    return parts.filter(Boolean).join("; ") || nothing;
  }

  /**
   * How the Moon will hang at 22:00 local, and what to say about it.
   *
   * Returns null-safe defaults when no location is known yet: an unrotated frame is the
   * geocentric one, which is the honest thing to show when there is no observer to rotate for.
   *
   * "Below horizon" is not a failure and not a dark Moon — the frame still shows a normally
   * lit gibbous or crescent. It means the Earth is in the way from here, which happens on
   * roughly half of all nights at every latitude, so saying so is the difference between a
   * tile that answers "should I go outside" and one that quietly implies yes.
   */
  private _skyView(): { rotation: number; caption: string } {
    const location = this._locationData;
    const now = new Date();
    const reference = getLocalHourInstant(now, location?.timezone ?? "UTC", SKY_REFERENCE_HOUR);
    const when = formatRelativeWhen(reference, now);
    if (!location) return { rotation: 0, caption: when };

    const { parallacticDeg, altitudeDeg } = getMoonSkyAngles(reference, location.lat, location.lon);
    return {
      rotation: parallacticDeg,
      caption: altitudeDeg > 0 ? when : "below horizon",
    };
  }

  // The moon disc is raw SVG DOM, not a Lit template — same imperative split as #solar-view
  // (see CLAUDE.md): Lit owns an empty container, this repopulates it. Rebuilt wholesale on
  // every update rather than patched, because the terminator geometry changes with the date
  // and the element is a handful of nodes.
  private _mountMoonDisc(): void {
    const container = (this.shadowRoot as ShadowRoot).querySelector(".moon-disc");
    if (!container) return;
    container.replaceChildren(renderMoonPhaseDisc(this._dateNav.currentDate, this._hemisphere));
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
      // dateNav.tick() already no-ops while replaying; the zoom cycle would happily zoom
      // mid-animation. A deferral, not the until-Home suspension — the next tick cycles again.
      if (!this._dateNav.isReplaying) this._zoom.tick();
      this._gallery.tick();
    }, interval) as unknown as number;
  }

  // Ages the debug overlay's "last" column live — without this it only updates on the next
  // real state change (gallery tick, nav click, ...), which can lag minutes behind Date.now().
  private _startDebugTimer(): void {
    clearInterval(this._debugTimer ?? undefined);
    if (!this._config?.debug) {
      this._debugTimer = null;
      return;
    }
    this._debugTimer = setInterval(() => this._render(), 1000) as unknown as number;
  }

  private _goToday(): void {
    // "Home" means one thing: default_zoom + centred pan + live date. Both view resets run
    // before goLive() so its render picks up the restored viewState.
    this._zoom.recenter();
    this._zoom.resetToDefault();
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
    if (action && SUSPENDS_AUTO_ZOOM.has(action)) this._zoom.suspendAutoCycle();
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
        this._dateNav.navigate(-86400000, "day");
        break;
      case "hour-back":
        this._dateNav.navigate(-3600000, "hour");
        break;
      case "today":
        this._goToday();
        break;
      case "hour-forward":
        this._dateNav.navigate(3600000, "hour");
        break;
      case "day-forward":
        this._dateNav.navigate(86400000, "day");
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
