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
import type { SourcedImage } from "./image-sources.js";
import {
  CLICK_CACHE_TTL_MS,
  fetchLatestEarthImageUrl,
  getPreviousSunSlot,
  getSunImageUrl,
} from "./image-sources.js";
import { formatRelativeAge } from "./relative-time.js";
import { ZoomAnimator } from "./zoom-animator.js";

const REPLAY_WINDOW_MS = 6 * 60 * 60 * 1000;
const REPLAY_STEPS = 36;
const REPLAY_STEP_MS = REPLAY_WINDOW_MS / REPLAY_STEPS;
const REPLAY_MAX_DURATION_MS = 5000;
const REPLAY_INTERVAL_MS = Math.floor(REPLAY_MAX_DURATION_MS / REPLAY_STEPS);

type ImagePanelMode = "none" | ImageSource;
export type GalleryMode = "none" | "earth" | "sun" | "both" | "slide";
const GALLERY_MODES: GalleryMode[] = ["none", "earth", "sun", "both", "slide"];
const DEFAULT_GALLERY_INTERVAL_MS = 60000;

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
  private _replayTimer: number | null;
  private _isReplaying: boolean;
  private _colors: Colors;
  private _refreshMs: number;
  private _periodicZoomChange: boolean;
  private _periodicZoomMax: number;
  private _zoomAnimate: boolean;
  private _eclipticView: boolean;
  private _positions: ViewPosition[];
  private _onVisibilityChange: (() => void) | null;
  private _imagePanelMode: ImagePanelMode;
  private _imageUrl: string | null;
  private _imageDate: Date | null;
  private _imageError: string | null;
  private _sunRetried: boolean;
  private _galleryOpen: boolean;
  private _galleryImages: Partial<Record<ImageSource, SourcedImage>>;
  private _gallerySunRetried: boolean;
  private _galleryMode: GalleryMode;
  private _galleryAutoIntervalMs: number;
  private _autoDisplayedSource: ImageSource;
  private _autoSwitchTimer: number | null;
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
    this._replayTimer = null;
    this._isReplaying = false;
    this._colors = {};
    this._refreshMs = 60000;
    this._periodicZoomChange = false;
    this._periodicZoomMax = MAX_ZOOM;
    this._zoomAnimate = false;
    this._eclipticView = false;
    this._positions = [];
    this._onVisibilityChange = null;
    this._imagePanelMode = "none";
    this._imageUrl = null;
    this._imageDate = null;
    this._imageError = null;
    this._sunRetried = false;
    this._galleryOpen = false;
    this._galleryImages = {};
    this._gallerySunRetried = false;
    this._galleryMode = "none";
    this._galleryAutoIntervalMs = DEFAULT_GALLERY_INTERVAL_MS;
    this._autoDisplayedSource = "earth";
    this._autoSwitchTimer = null;
  }

  // ---------------------------------------------------------------------------
  // Proxy getters
  // ---------------------------------------------------------------------------
  get _locationData(): LocationData | null {
    return this._lat != null && this._lon != null
      ? { lat: this._lat, lon: this._lon, timezone: this._timezone ?? "UTC" }
      : null;
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

    this._eclipticView = config.ecliptic_view === "south";

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
      this._refreshGalleryImages();
    }
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
    clearInterval(this._autoSwitchTimer ?? undefined);
    this._autoSwitchTimer = null;
    clearInterval(this._replayTimer ?? undefined);
    this._replayTimer = null;
    if (this._onVisibilityChange) {
      document.removeEventListener("visibilitychange", this._onVisibilityChange);
    }
    this._onVisibilityChange = null;
  }

  render() {
    if (this._lat != null) {
      this._hemisphere = this._lat < 0 ? "south" : "north";
    }

    const statusBar = this._imageError
      ? html`<div class="status-bar">
          <span>${this._imageError}</span>
        </div>`
      : this._imagePanelMode === "none"
        ? buildStatusBar(this._locationData, this._locationName, this._currentDate)
        : buildImageStatusBar(
            this._imagePanelMode,
            this._formatDate(this._imageDate as Date),
            this._imageDate as Date,
            new Date()
          );
    const zoomLevel = this._viewState?.zoomLevel ?? this._defaultZoomLevel;
    /* v8 ignore next */
    const background = this._colors.background ?? "";

    return html`
      <div class="card" style="background: ${background}">
        <div class="solar-view-wrapper">
          ${statusBar}
          <div id="solar-view" class=${this._imagePanelMode === "none" ? "" : "hidden"}></div>
          <img
            id="image-view"
            class="image-view ${this._imagePanelMode === "none" ? "" : "visible"}"
            src=${this._imageUrl ?? ""}
            alt=""
            @click=${this._onImageClick}
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
                        src=${this._galleryImages[source]?.url ?? ""}
                        alt=""
                        @error=${source === "sun" ? this._onSunThumbError : undefined}
                      />
                      <div class="gallery-info">
                        <span class="gallery-label">${GALLERY_SOURCE_LABELS[source]}</span>
                        ${
                          this._galleryImages[source]
                            ? html`<span class="gallery-age"
                                >${formatRelativeAge(this._galleryImages[source]?.date as Date, new Date())}</span
                              >`
                            : nothing
                        }
                      </div>
                    </button>`
                  )}
                </div>`
              : nothing
          }
        </div>
        <div class="nav">
          <span class="btn-group">
            <button data-action="month-back" title="Back 1 month" ?disabled=${this._isReplaying} @click=${this._onNavClick}>⋘</button>
            <button data-action="day-back" title="Back 1 day" ?disabled=${this._isReplaying} @click=${this._onNavClick}>«</button>
            <button data-action="hour-back" title="Back 1 hour" ?disabled=${this._isReplaying} @click=${this._onNavClick}>‹</button>
            <button data-action="today" ?disabled=${this._isReplaying} @click=${this._onNavClick}>Now</button>
            <button data-action="hour-forward" title="Forward 1 hour" ?disabled=${this._isReplaying} @click=${this._onNavClick}>›</button>
            <button data-action="day-forward" title="Forward 1 day" ?disabled=${this._isReplaying} @click=${this._onNavClick}>»</button>
            <button data-action="month-forward" title="Forward 1 month" ?disabled=${this._isReplaying} @click=${this._onNavClick}>⋙</button>
            <button data-action="replay" title="Replay last 6h" @click=${this._onNavClick}>↺</button>
          </span>
          <span class="nav-spacer"></span>
          <span class="date">${this._formatDate(this._currentDate)}</span>
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
      if (this._imagePanelMode !== "none") {
        this._refreshOpenImage();
      } else if (this._galleryOpen) {
        this._refreshGalleryImages();
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
      this._autoDisplayedSource = this._autoDisplayedSource === "earth" ? "sun" : "earth";
      this._render();
    }, this._galleryAutoIntervalMs) as unknown as number;
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

  private _toggleReplay(): void {
    if (this._replayTimer !== null) {
      this._cancelReplay();
    } else {
      this._startReplay();
    }
  }

  private _startReplay(): void {
    const wasLiveMode = this._isLiveMode;
    const endTime = this._currentDate.getTime();
    const startTime = endTime - REPLAY_WINDOW_MS;
    this._isLiveMode = false;
    this._isReplaying = true;
    let step = 0;
    this._currentDate = new Date(startTime);
    this._render();

    this._replayTimer = setInterval(() => {
      step++;
      if (step >= REPLAY_STEPS) {
        this._finishReplay(endTime, wasLiveMode);
        return;
      }
      this._currentDate = new Date(startTime + step * REPLAY_STEP_MS);
      this._render();
    }, REPLAY_INTERVAL_MS) as unknown as number;
  }

  private _finishReplay(endTime: number, resumeLiveMode: boolean): void {
    /* v8 ignore next */
    clearInterval(this._replayTimer ?? undefined);
    this._replayTimer = null;
    this._isReplaying = false;
    this._isLiveMode = resumeLiveMode;
    // If replay started from live mode, land on real "now" (time passed during the
    // animation); otherwise return exactly to the date the user had paused on.
    this._currentDate = resumeLiveMode ? new Date() : new Date(endTime);
    this._render();
  }

  private _cancelReplay(): void {
    /* v8 ignore next */
    clearInterval(this._replayTimer ?? undefined);
    this._replayTimer = null;
    this._isReplaying = false;
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
        this._toggleReplay();
        break;
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
      this._refreshGalleryImages();
    }
  }

  private _onImageClick(): void {
    this._setImagePanel("none");
  }

  // Earth's URL is validated by a real fetch before it's ever assigned, so this only ever
  // fires in practice for sun: its URL is computed (not fetch-checked) from NASA's publish
  // cadence, so it can occasionally 404 if a slot hasn't been published yet. First failure
  // steps back one 15-min slot and retries once; only a second failure shows the banner.
  private _onImageLoadError(): void {
    if (this._imagePanelMode === "none") return;
    if (this._imagePanelMode === "sun" && !this._sunRetried) {
      this._sunRetried = true;
      const { url, date } = getPreviousSunSlot(this._imageDate as Date);
      this._imageUrl = url;
      this._imageDate = date;
      this._render();
      return;
    }
    this._imageError = `${IMAGE_SOURCE_LABELS[this._imagePanelMode]} image unavailable`;
    this._imagePanelMode = "none";
    this._imageUrl = null;
    this._imageDate = null;
    this._render();
  }

  private async _setImagePanel(mode: ImagePanelMode): Promise<void> {
    this._sunRetried = false;
    if (mode === "none") {
      this._imagePanelMode = "none";
      this._imageUrl = null;
      this._imageDate = null;
      this._imageError = null;
      this._render();
      return;
    }
    this._imageError = null;
    try {
      // Opening the full image is a click-triggered fetch: a short cache (CLICK_CACHE_TTL_MS)
      // avoids redownloading from NASA's slow servers if you just looked at this same source
      // moments ago. Once open, _refreshOpenImage takes over on its own (longer) cadence.
      const { url, date } =
        mode === "earth"
          ? await fetchLatestEarthImageUrl(CLICK_CACHE_TTL_MS)
          : getSunImageUrl(CLICK_CACHE_TTL_MS);
      this._imagePanelMode = mode;
      this._imageUrl = url;
      this._imageDate = date;
    } catch {
      this._imagePanelMode = "none";
      this._imageUrl = null;
      this._imageDate = null;
      this._imageError = `${IMAGE_SOURCE_LABELS[mode]} image unavailable`;
    }
    this._render();
  }

  // Keeps the open full-screen image fresh (hourly, same cadence as the gallery strip) on
  // each auto-update tick, for as long as it stays open. Only called while
  // _imagePanelMode !== "none" (see the tick handler). A failed refresh is silently skipped
  // — the panel keeps showing the last good image rather than surfacing a transient
  // background-fetch error.
  private async _refreshOpenImage(): Promise<void> {
    const mode = this._imagePanelMode;
    try {
      const { url, date } = mode === "earth" ? await fetchLatestEarthImageUrl() : getSunImageUrl();
      this._imageUrl = url;
      this._imageDate = date;
      this._render();
    } catch {
      // Keep showing the last good image.
    }
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

  // Fetches gallery thumbnails for the active gallery.mode — called when the gallery is
  // opened, and on each auto-update tick while it stays open and no full image is showing
  // (never while both are closed, to avoid unconditional background polling of NASA's
  // servers for every install regardless of use). Each source is cache-guarded (earth
  // hourly, sun every 15min — matching each source's own publish cadence), so this only
  // hits the network once the relevant cache has expired.
  private async _refreshGalleryImages(): Promise<void> {
    const sources = this._fetchGallerySources;
    if (sources.includes("sun")) this._gallerySunRetried = false;
    const results = await Promise.allSettled(
      sources.map((source) =>
        source === "earth" ? fetchLatestEarthImageUrl() : Promise.resolve(getSunImageUrl())
      )
    );
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        this._galleryImages[sources[i]] = result.value;
      }
    }
    this._render();
  }

  // Mirrors _onImageLoadError's one-step-back retry, for the gallery thumbnail instead of
  // the full-screen view: first failure steps back one 15-min slot; a second failure drops
  // the thumbnail (falls back to the transparent placeholder) rather than retrying forever.
  private _onSunThumbError(): void {
    if (this._gallerySunRetried) {
      delete this._galleryImages.sun;
      this._render();
      return;
    }
    const current = this._galleryImages.sun;
    /* v8 ignore next */
    if (!current) return;
    this._gallerySunRetried = true;
    this._galleryImages.sun = getPreviousSunSlot(current.date);
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
