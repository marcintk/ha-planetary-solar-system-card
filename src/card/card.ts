import type { TemplateResult } from "lit";
import { html, LitElement, nothing } from "lit";
import type { CardConfig, Colors, HASSConfig } from "../types.js";
import { parseCardConfig } from "./card-config.js";
import { cardStyles } from "./card-styles.js";
import { buildGalleryCaption, buildStatusBarView, discStyle } from "./card-template.js";
import { DateNavigation } from "./date-navigation.js";
import { buildDebugOverlay } from "./debug-view.js";
import type { GalleryMode, GalleryPosition, GalleryShape } from "./gallery/gallery-controller.js";
import { GalleryController } from "./gallery/gallery-controller.js";
import { fullSizeMoonUrl } from "./gallery/source-resolver-svs-moon.js";
import type { ImageSource } from "./gallery/sources.js";
import { SOURCES } from "./gallery/sources.js";
import { formatDate, formatRelativeWhen } from "./relative-time.js";
import { SolarView } from "./solar-view.js";
import { resolveTheme, THEME_OVERRIDE_VARS } from "./theme.js";
import type { SkyFrame } from "./viewing-location.js";
import { ViewingLocation } from "./viewing-location.js";
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

/**
 * What the sky tile shows in place of the Moon while the Moon is below the horizon — in the
 * thumbnail and in the full-screen panel, from one builder so the two can't drift apart.
 *
 * Only the panel's copy takes a handler: the thumbnail's sits inside a <button> that already
 * closes over its own click, while the panel's stands in for the image that used to be the
 * way back out, and has to carry that click itself.
 */
function noMoonSky(onClick?: (e: Event) => void): TemplateResult {
  // Broken across two lines rather than left to wrap: the thumbnail is 104 px and its copy is
  // sized in cqw, so where the break lands would otherwise change with the card's width.
  return html`<div class="no-sky" @click=${onClick}>No Moon<br />Sky</div>`;
}

export class SolarViewCard extends LitElement {
  static styles = cardStyles;

  private _dateNav: DateNavigation;
  private _zoom: ZoomController;
  private _location: ViewingLocation;
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
    this._location = new ViewingLocation();
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
    this._gallery = new GalleryController(() => this._render());
  }

  set hass(hass: HASSConfig) {
    if (this._location.update(hass)) this._render();
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
    this._location.configure(parsed.locationOverride, parsed.locationNameOverride);
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
    // One instant for the whole frame, so a sky tile, its tint and the full-screen panel can't
    // land on three slightly different moments. Computed at most once per render, and only if
    // something actually asks: the moon ephemeris and solar elevation behind it aren't worth
    // running on every tick of a card whose gallery has no sky tile enabled.
    const now = new Date();
    let skyFrame: SkyFrame | null = null;
    const sky = () => (skyFrame ??= this._location.skyFrame(now));

    const gallery = this._gallery.viewModel(this._galleryPosition);
    // The open panel's own sky, or null when the panel is closed or shows a source that has no
    // observer frame — same question _renderGalleryTile asks per tile, asked once for the panel.
    const panelSky =
      gallery.panelSource !== "none" && SOURCES[gallery.panelSource].skyFrame ? sky() : null;
    const statusBar = buildStatusBarView(
      gallery,
      this._location.data,
      this._location.name,
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
          <div
            class="image-view-frame ${gallery.panelSource === "none" ? "" : "visible"}"
            style=${this._panelFrameStyle()}
          >
            ${
              panelSky?.belowHorizon
                ? noMoonSky(this._onImageClick)
                : html`<img
                      id="image-view"
                      class="image-view"
                      style=${this._panelImageStyle(panelSky)}
                      src=${gallery.imageUrl ? fullSizeMoonUrl(gallery.imageUrl) : nothing}
                      alt=""
                      @click=${this._onImageClick}
                      @load=${this._onImageLoad}
                      @error=${this._onImageLoadError}
                    />
                    ${
                      panelSky
                        ? html`<div
                            class="image-view-tint"
                            style=${`background: ${panelSky.extinction}`}
                          ></div>`
                        : nothing
                    }`
            }
          </div>
          ${
            gallery.showStrip
              ? html`<div class="gallery gallery-${this._galleryPosition}">
                  ${gallery.thumbnails.map(({ source, url, date }) =>
                    this._renderGalleryTile(source, url, date, sky, now)
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
        this._location.hemisphere,
        this._location.data,
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
   * One gallery tile. Every source is a fetched NASA image, so there is one shape rather than
   * a moon branch and an everything-else branch.
   *
   * The sky tile is the only one that differs, in two ways: it rotates the same frame `moon`
   * shows into the observer's own orientation, and while the Moon is below the horizon it says
   * so in words — rather than rendering a Moon that isn't there, or leaving a black square that
   * reads as a tile which failed to load. The caption always reads the frame's own age, same as
   * every other tile; the tile stays clickable either way, and the full-screen view carries the
   * same message rather than falling back to the geocentric frame — a view the observer
   * explicitly asked for their own sky is the wrong place to answer with someone else's.
   *
   * The sky's day/twilight/night color washes over the Moon photo itself (a
   * .gallery-thumb-tint layer, mix-blend-mode: color) rather than filling the tile behind it —
   * there's no image to wash it onto below the horizon, so the tile is plain black then, same
   * as every other empty/loading tile, instead of a flat color swatch with nothing on it.
   */
  private _renderGalleryTile(
    source: ImageSource,
    url: string | null,
    date: Date | null,
    skyFrame: () => SkyFrame,
    now: Date
  ): TemplateResult {
    // The catalog says whether this tile wants the observer's frame; ViewingLocation says what
    // that frame is. Every other source shows the geocentric render as published, and never
    // makes the caller compute a frame it has no use for.
    const sky = SOURCES[source].skyFrame ? skyFrame() : null;
    const discStyleValue = discStyle(source, this._galleryShape, sky ? sky.rotation : 0);
    return html`<button
      class="gallery-thumb ${this._galleryShape === "circle" ? "gallery-thumb-circle" : ""}"
      data-source=${source}
      title=${SOURCES[source].tooltip}
      @click=${this._onGalleryClick}
    >
      ${
        sky?.belowHorizon
          ? noMoonSky()
          : html`<img
              src=${url ?? nothing}
              alt=""
              style=${discStyleValue}
              @error=${source === "sun" ? this._onSunThumbError : undefined}
            />
            ${
              sky
                ? html`<div
                    class="gallery-thumb-tint"
                    style=${`${discStyleValue}; background: ${sky.background}`}
                  ></div>
                  <div
                    class="gallery-thumb-tint"
                    style=${`${discStyleValue}; background: ${sky.extinction}`}
                  ></div>`
                : nothing
            }`
      }
      ${buildGalleryCaption(
        SOURCES[source].tile,
        date ? formatRelativeWhen(date, now) : "loading…"
      )}
    </button>`;
  }

  /**
   * The full-screen frame's inline style: just the configured height cap. The frame stays an
   * axis-aligned square and clips to it (overflow: hidden in card-styles.ts), so the panel is
   * square like every other source's, unlike the thumbnail (which always circle-crops, see
   * discStyle()); only the rotated image inside it, not the frame's own shape, follows the
   * observer's orientation. Its own background is plain black (card-styles.ts), same as every
   * other panel — unlike the thumbnail, the day/twilight/night sky wash doesn't extend here: the
   * corners a rotated square swings away from are a much larger share of a full-screen frame than
   * of a 104px tile, and a colored fill across that much of the screen reads as a wash over the
   * view rather than a detail on a photo. The Moon's own altitude-extinction tint (#178,
   * .image-view-tint) is added anyway despite that: it's usually near-zero strength and only
   * strong close to the horizon, so it doesn't carry the same "wash over the whole view" risk.
   */
  private _panelFrameStyle(): string | typeof nothing {
    return this._heightStyle || nothing;
  }

  /**
   * The full-screen image's own inline style: just the sky tile's rotation, so the panel shows
   * what the thumbnail showed rather than snapping back to the geocentric frame the moment it
   * is opened. Every other source needs no style of its own here.
   */
  private _panelImageStyle(panelSky: SkyFrame | null): string | typeof nothing {
    if (!panelSky) return nothing;
    return `transform: rotate(${panelSky.rotation.toFixed(1)}deg)`;
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
