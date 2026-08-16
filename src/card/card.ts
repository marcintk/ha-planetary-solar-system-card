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
import {
  buildImageStatusBar,
  buildStatusBar,
  GALLERY_SOURCE_LABELS,
  GALLERY_SOURCES,
  IMAGE_SOURCE_LABELS,
} from "./card-template.js";
import { DEFAULT_ZOOM_LEVEL, MAX_ZOOM, MIN_ZOOM, ViewState } from "./card-view-state.js";
import { DateNav } from "./date-nav.js";
import type { SourcedImage } from "./image-sources.js";
import {
  FETCH_TIMEOUT_MS,
  fetchLatestEarthImageUrl,
  getPreviousSunSlot,
  getSunImageUrl,
} from "./image-sources.js";
import { formatRelativeAge } from "./relative-time.js";
import { ZoomAnimator } from "./zoom-animator.js";

// Confirms a candidate image URL actually loads AND decodes before anything commits to
// displaying it — so a failed or not-yet-published candidate never touches a visible <img>.
// decode() (not the load event) is what actually guarantees this: load only means the bytes
// downloaded, not that the browser has rasterized them yet — assigning to a live <img> right
// after load can still stumble onto the broken-image glyph for a frame while it decodes.
// Off-DOM: doesn't reuse the real <img> element, so a failed probe can never flash onto it.
// Bounded by FETCH_TIMEOUT_MS (image-sources.ts) — decode() has no built-in timeout, so a
// stalled load against either NASA host would otherwise wait indefinitely.
function preloadImage(url: string): Promise<void> {
  const probe = new Image();
  probe.src = url;
  return Promise.race([
    probe.decode(),
    new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new Error("Image load timed out")), FETCH_TIMEOUT_MS);
    }),
  ]);
}

// Resolves a source to a candidate that's confirmed to actually load, preloading off-DOM
// first. Earth's URL is already confirmed by a real API lookup (see
// fetchLatestEarthImageUrl), so it never needs the retry; sun's URL is only computed from
// NASA's publish cadence and can occasionally 404 if a slot hasn't been published yet — one
// step back, one retry. Used only by _refreshImageSources — every source's image, for both
// the gallery strip and a full-screen panel, is resolved there and nowhere else, so a slow
// or failing candidate is caught before it ever reaches a visible <img>.
async function resolveDisplayImage(mode: ImageSource): Promise<SourcedImage> {
  const candidate = mode === "earth" ? await fetchLatestEarthImageUrl() : getSunImageUrl();
  try {
    await preloadImage(candidate.url);
    return candidate;
  } catch (err) {
    if (mode !== "sun") throw err;
    const fallback = getPreviousSunSlot(candidate.date);
    await preloadImage(fallback.url);
    return fallback;
  }
}

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

type ImagePanelMode = "none" | ImageSource;
export type GalleryMode = "none" | "earth" | "sun" | "both" | "slide";
const GALLERY_MODES: GalleryMode[] = ["none", "earth", "sun", "both", "slide"];
const DEFAULT_GALLERY_INTERVAL_MS = 60000;

export class SolarViewCard extends LitElement {
  static styles = cardStyles;

  private _dateNav: DateNav;
  private _viewState: ViewState | null;
  private _zoomAnimator: ZoomAnimator | null;
  private _defaultZoomLevel: ZoomLevel;
  private _hemisphere: Hemisphere;
  private _lat: number | null;
  private _lon: number | null;
  private _timezone: string | null;
  private _locationName: string | null;
  private _configLat: number | null;
  private _configLon: number | null;
  private _configLocationName: string | null;
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
  private _imagePanelMode: ImagePanelMode;
  private _imageUrl: string | null;
  private _imageDate: Date | null;
  private _imageLoaded: boolean;
  private _imageError: string | null;
  private _galleryOpen: boolean;
  private _galleryImages: Partial<Record<ImageSource, SourcedImage>>;
  private _galleryMode: GalleryMode;
  private _galleryAutoIntervalMs: number;
  private _autoDisplayedSource: ImageSource;
  private _autoSwitchTimer: number | null;
  _config: CardConfig | undefined;

  constructor() {
    super();
    this._dateNav = new DateNav(() => this._render());
    this._viewState = null;
    this._zoomAnimator = null;
    this._defaultZoomLevel = DEFAULT_ZOOM_LEVEL;
    this._hemisphere = "north";
    this._lat = null;
    this._lon = null;
    this._configLat = null;
    this._configLon = null;
    this._configLocationName = null;
    this._timezone = null;
    this._locationName = null;
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
    this._imagePanelMode = "none";
    this._imageUrl = null;
    this._imageDate = null;
    this._imageLoaded = false;
    this._imageError = null;
    this._galleryOpen = false;
    this._galleryImages = {};
    this._galleryMode = "none";
    this._galleryAutoIntervalMs = DEFAULT_GALLERY_INTERVAL_MS;
    this._autoDisplayedSource = "earth";
    this._autoSwitchTimer = null;
  }

  // ---------------------------------------------------------------------------
  // Proxy getters
  // ---------------------------------------------------------------------------
  get _effectiveLat(): number | null {
    return this._configLat ?? this._lat;
  }
  get _effectiveLon(): number | null {
    return this._configLon ?? this._lon;
  }
  get _effectiveLocationName(): string | null {
    return this._configLocationName ?? this._locationName;
  }
  get _locationData(): LocationData | null {
    const lat = this._effectiveLat;
    const lon = this._effectiveLon;
    return lat != null && lon != null ? { lat, lon, timezone: this._timezone ?? "UTC" } : null;
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
    this._configLat = hasOverride ? overrideLat : null;
    this._configLon = hasOverride ? overrideLon : null;
    this._configLocationName = config.location?.name || null;
    this._heightStyle = resolveHeightStyle(config.height);

    this._galleryMode = GALLERY_MODES.includes(config.gallery?.mode as GalleryMode)
      ? (config.gallery?.mode as GalleryMode)
      : "none";
    const rawInterval = Number(config.gallery?.slide_interval_secs);
    this._galleryAutoIntervalMs =
      Number.isFinite(rawInterval) && rawInterval >= 0.1
        ? rawInterval * 1000
        : DEFAULT_GALLERY_INTERVAL_MS;
    this._galleryOpen = this._galleryMode !== "none";

    if (this._autoUpdateTimer != null) {
      this._startAutoUpdateTimer();
    }
    if (this._autoSwitchTimer != null) {
      this._startAutoSwitchTimer();
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    // Force synchronous initial render so the shadow DOM is ready immediately.
    // Lit's default schedules the first paint as a microtask, which would break
    // synchronous tests and delay the first frame in HA.
    this._render();
    this._startAutoUpdateTimer();
    this._startAutoSwitchTimer();
    if (this._galleryOpen) {
      this._refreshImageSources();
    }
    this._onVisibilityChange = () => {
      if (!document.hidden) this._dateNav.tick();
    };
    document.addEventListener("visibilitychange", this._onVisibilityChange);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._autoUpdateTimer ?? undefined);
    this._autoUpdateTimer = null;
    clearInterval(this._autoSwitchTimer ?? undefined);
    this._autoSwitchTimer = null;
    this._dateNav.stop();
    if (this._onVisibilityChange) {
      document.removeEventListener("visibilitychange", this._onVisibilityChange);
    }
    this._onVisibilityChange = null;
  }

  render() {
    if (this._effectiveLat != null) {
      this._hemisphere = this._effectiveLat < 0 ? "south" : "north";
    }

    const statusBar = this._imageError
      ? html`<div class="status-bar">
          <span>${this._imageError}</span>
        </div>`
      : this._imagePanelMode === "none"
        ? buildStatusBar(this._locationData, this._effectiveLocationName, this._dateNav.currentDate)
        : buildImageStatusBar(
            this._imagePanelMode,
            this._imageDate ? this._formatDate(this._imageDate) : "",
            this._imageDate ?? new Date(),
            new Date(),
            this._imageLoaded
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
            class=${this._imagePanelMode === "none" ? "" : "hidden"}
            style=${this._heightStyle || nothing}
          ></div>
          <img
            id="image-view"
            class="image-view ${this._imagePanelMode === "none" ? "" : "visible"}"
            style=${this._heightStyle || nothing}
            src=${this._imageUrl ?? nothing}
            alt=""
            @click=${this._onImageClick}
            @load=${this._onImageLoad}
            @error=${this._onImageLoadError}
          />
          ${
            this._galleryOpen && this._imagePanelMode === "none"
              ? html`<div class="gallery">
                  ${this._displayGallerySources.map(
                    (source) => html`<button
                      class="gallery-thumb"
                      data-source=${source}
                      title=${`Show ${GALLERY_SOURCE_LABELS[source]}`}
                      @click=${this._onGalleryClick}
                    >
                      <img
                        src=${this._galleryImages[source]?.url ?? nothing}
                        alt=""
                        @error=${source === "sun" ? this._onSunThumbError : undefined}
                      />
                      <div class="gallery-info">
                        <span class="gallery-label">${GALLERY_SOURCE_LABELS[source]}</span>
                        <span class="gallery-age"
                          >${
                            this._galleryImages[source]
                              ? formatRelativeAge(
                                  this._galleryImages[source]?.date as Date,
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
            this._galleryMode !== "none"
              ? html`<span class="nav-spacer"></span>
                  <span class="btn-group">
                    <button
                      data-action="gallery"
                      title="Show image gallery"
                      class=${this._galleryOpen ? "active" : ""}
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
      // _galleryOpen is always true while a panel is open (only a thumbnail click opens
      // one, and thumbnails only exist while the strip is open), so this one check covers
      // keeping both the strip and an open panel fresh.
      if (this._galleryOpen) {
        this._refreshImageSources();
      }
    }, interval) as unknown as number;
  }

  // Flips which source is shown in the "slide" gallery strip. Only relevant while
  // gallery.mode is "slide" — otherwise cleared so no interval runs unnecessarily.
  private _startAutoSwitchTimer(): void {
    /* v8 ignore next */
    clearInterval(this._autoSwitchTimer ?? undefined);
    if (this._galleryMode !== "slide") {
      this._autoSwitchTimer = null;
      return;
    }
    this._autoSwitchTimer = setInterval(() => {
      void this._advanceSlide();
    }, this._galleryAutoIntervalMs) as unknown as number;
  }

  // Re-decodes the next slide's image off-DOM before flipping the displayed source, so the
  // label and the thumbnail <img> switch together — otherwise the label re-renders instantly
  // while the reused <img> still shows the previous bitmap for a frame until it decodes.
  private async _advanceSlide(): Promise<void> {
    const next = this._autoDisplayedSource === "earth" ? "sun" : "earth";
    const known = this._galleryImages[next];
    if (known) {
      try {
        await preloadImage(known.url);
      } catch {
        // Already-validated URL failing a re-decode is transient; show it anyway rather
        // than getting stuck on the previous source forever.
      }
    }
    this._autoDisplayedSource = next;
    this._render();
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
    this._setImagePanel(source);
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
        this._toggleGallery();
        break;
    }
  }

  private _toggleGallery(): void {
    this._galleryOpen = !this._galleryOpen;
    if (!this._galleryOpen) {
      this._setImagePanel("none");
    } else {
      this._imageError = null;
      this._render();
      this._refreshImageSources();
    }
  }

  private _onImageClick(): void {
    this._setImagePanel("none");
  }

  // resolveDisplayImage already confirms a candidate loads (with a retry for sun) before
  // it's ever assigned to the visible <img>, so this only ever fires for a genuinely
  // unexpected failure after the fact (e.g. the browser evicting its cache between preload
  // and paint) — no retry left to try, just surface the error banner.
  private _onImageLoadError(): void {
    if (this._imagePanelMode === "none") return;
    this._imageError = `${IMAGE_SOURCE_LABELS[this._imagePanelMode]} image unavailable`;
    this._imagePanelMode = "none";
    this._imageUrl = null;
    this._imageDate = null;
    this._render();
  }

  // Every caller preloads (via resolveDisplayImage) before calling this, so the pixels are
  // already sitting in the browser's cache — _imageLoaded is set true right after, letting
  // the visible <img> paint from that cache instead of a live fetch.
  private _applyImage(url: string, date: Date): void {
    this._imageLoaded = false;
    this._imageUrl = url;
    this._imageDate = date;
  }

  private _onImageLoad(): void {
    this._imageLoaded = true;
    this._render();
  }

  // A click is a pure view switch, nothing more: no fetch, no preload, no async gap. Every
  // source's image is already kept current in the background by the auto-update timer
  // (_refreshImageSources, cadence = refresh_mins) for as long as the gallery strip or a
  // panel stays open, so opening one just displays whatever that timer already confirmed —
  // instant when it landed, "loading…" only for the narrow window before the very first
  // background fetch for a source completes (already in flight from
  // connectedCallback/setConfig — this only nudges it rather than waiting for the next tick).
  private _setImagePanel(mode: ImagePanelMode): void {
    if (mode === "none") {
      this._imagePanelMode = "none";
      this._imageUrl = null;
      this._imageDate = null;
      this._imageError = null;
      this._render();
      return;
    }
    this._imagePanelMode = mode;
    this._imageError = null;
    const known = this._galleryImages[mode];
    if (known) {
      this._applyImage(known.url, known.date);
      this._imageLoaded = true;
    } else {
      this._imageUrl = null;
      this._imageDate = null;
      this._imageLoaded = false;
      this._refreshImageSources();
    }
    this._render();
  }

  // Sources this gallery.mode needs fetched in the background — "slide" still fetches both
  // even though only one is displayed at a time, so flipping the displayed source never
  // shows a stale/missing thumbnail.
  private get _fetchGallerySources(): ImageSource[] {
    switch (this._galleryMode) {
      case "both":
      case "slide":
        return GALLERY_SOURCES;
      case "earth":
      case "sun":
        return [this._galleryMode];
      /* v8 ignore next 2 */
      default:
        return [];
    }
  }

  // Sources rendered as thumbnails right now.
  private get _displayGallerySources(): ImageSource[] {
    return this._galleryMode === "slide" ? [this._autoDisplayedSource] : this._fetchGallerySources;
  }

  // Fetches every source this gallery.mode needs — called when the gallery is opened, on
  // click for a source that isn't known yet (see _setImagePanel), and on each auto-update
  // tick while the strip or a panel stays open (never while both are closed, to avoid
  // unconditional background polling of NASA's servers for every install regardless of
  // use). Each source is cache-guarded (earth hourly, sun every 15min — matching each
  // source's own publish cadence), so this only hits the network once the relevant cache
  // has expired. This is the single place _galleryImages is written, so it's also the
  // single place that keeps an open full-screen panel in sync with the same source.
  private async _refreshImageSources(): Promise<void> {
    const sources = this._fetchGallerySources;
    const results = await Promise.allSettled(sources.map((source) => resolveDisplayImage(source)));
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const source = sources[i];
      if (result.status === "fulfilled") {
        // resolveDisplayImage already confirmed this candidate loads before it's ever
        // assigned here, so its presence in _galleryImages is itself the "loaded" state —
        // the <img src> assignment just paints from the browser's own cache.
        this._galleryImages[source] = result.value;
        if (this._imagePanelMode === source) {
          this._applyImage(result.value.url, result.value.date);
          this._imageLoaded = true;
        }
      } else if (this._imagePanelMode === source && !this._galleryImages[source]) {
        // The open panel is waiting on this exact source's first-ever fetch and it just
        // failed — nothing to fall back to, so surface the error instead of "loading…"
        // forever. A source that already has a known image just keeps showing it (matches
        // the old behavior: never swap to something that might not load).
        this._imagePanelMode = "none";
        this._imageError = `${IMAGE_SOURCE_LABELS[source]} image unavailable`;
      }
    }
    this._render();
  }

  // resolveDisplayImage already retried once before this URL was ever assigned to the
  // thumbnail, so a real error here means no retry is left — drop the thumbnail (falls back
  // to the transparent placeholder) rather than retrying forever.
  private _onSunThumbError(): void {
    delete this._galleryImages.sun;
    this._render();
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
