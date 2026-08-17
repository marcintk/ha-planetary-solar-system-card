import type { ImageSource } from "./card-template.js";
import { GALLERY_SOURCES, IMAGE_SOURCE_LABELS } from "./card-template.js";
import type { DebugAccumulator, SourceDebugStats } from "./debug.js";
import { emptyDebugAccumulator, toDebugStats } from "./debug.js";
import type { SourcedImage } from "./image-cache.js";
import { ImageResolver, redecode } from "./image-resolver.js";

export type ImagePanelMode = "none" | ImageSource;
export type GalleryMode = "none" | "earth" | "sun" | "both" | "slide";
export const GALLERY_MODES: GalleryMode[] = ["none", "earth", "sun", "both", "slide"];
export const DEFAULT_GALLERY_INTERVAL_MS = 60000;

// Render-ready shape for card.ts's template — raw data only (dates, urls, booleans), no
// formatting, so formatRelativeAge/date-formatting stays in card.ts alongside its other
// display logic. Collapses the branching card.ts's render() otherwise reconstructs from the
// individual getters below (which stay, and remain this module's own test seam).
export interface GalleryViewModel {
  error: string | null;
  panelSource: ImagePanelMode;
  imageUrl: string | null;
  imageDate: Date | null;
  imageLoaded: boolean;
  showStrip: boolean;
  thumbnails: { source: ImageSource; url: string | null; date: Date | null }[];
  navButtonVisible: boolean;
  navButtonActive: boolean;
  debugStats: Record<ImageSource, SourceDebugStats>;
  debugStartedAt: number;
}

/**
 * Owns the gallery strip and full-screen image panel: which sources are fetched, which one
 * is displayed, and the retry protocol against each source's own cache. Previously this was
 * 11 fields spread across card.ts, plus the fetch/preload retry logic split between card.ts's
 * ImageResolver and each source module's cache mutation (#94) — one place now owns both
 * the state and the protocol. onChange fires whenever card.ts needs to re-render (same
 * callback pattern as DateNavigation/ZoomAnimator).
 */
export class GalleryController {
  private _panelMode: ImagePanelMode;
  private _imageUrl: string | null;
  private _imageDate: Date | null;
  private _imageLoaded: boolean;
  private _error: string | null;
  private _open: boolean;
  private _images: Partial<Record<ImageSource, SourcedImage>>;
  private _mode: GalleryMode;
  private _autoIntervalMs: number;
  private _autoDisplayedSource: ImageSource;
  private _autoSwitchTimer: number | null;
  private _onChange: () => void;
  private _debug: Record<ImageSource, DebugAccumulator>;
  private _debugStartedAt: number;
  private _resolver: ImageResolver;

  constructor(onChange: () => void) {
    this._panelMode = "none";
    this._imageUrl = null;
    this._imageDate = null;
    this._imageLoaded = false;
    this._error = null;
    this._open = false;
    this._mode = "none";
    this._autoIntervalMs = DEFAULT_GALLERY_INTERVAL_MS;
    this._autoDisplayedSource = "earth";
    this._autoSwitchTimer = null;
    this._onChange = onChange;
    this._debug = { earth: emptyDebugAccumulator(), sun: emptyDebugAccumulator() };
    this._debugStartedAt = Date.now();
    this._resolver = new ImageResolver();
    // Recovers each source's still-fresh cache into this instance's own known-URL
    // state — without this, a remount (this._images always starts empty) would otherwise
    // force a redundant preload of bytes the module cache already confirmed are current.
    this._images = this._resolver.hydrate(GALLERY_SOURCES);
  }

  get panelMode(): ImagePanelMode {
    return this._panelMode;
  }
  get imageUrl(): string | null {
    return this._imageUrl;
  }
  get imageDate(): Date | null {
    return this._imageDate;
  }
  get imageLoaded(): boolean {
    return this._imageLoaded;
  }
  get error(): string | null {
    return this._error;
  }
  get isOpen(): boolean {
    return this._open;
  }
  get mode(): GalleryMode {
    return this._mode;
  }
  get images(): Partial<Record<ImageSource, SourcedImage>> {
    return this._images;
  }
  get debugStats(): Record<ImageSource, SourceDebugStats> {
    return { earth: toDebugStats(this._debug.earth), sun: toDebugStats(this._debug.sun) };
  }

  // Sources rendered as thumbnails right now.
  get displaySources(): ImageSource[] {
    return this._mode === "slide" ? [this._autoDisplayedSource] : this._fetchSources;
  }

  viewModel(): GalleryViewModel {
    return {
      error: this._error,
      panelSource: this._panelMode,
      imageUrl: this._imageUrl,
      imageDate: this._imageDate,
      imageLoaded: this._imageLoaded,
      showStrip: this._open && this._panelMode === "none",
      thumbnails: this.displaySources.map((source) => ({
        source,
        url: this._images[source]?.url ?? null,
        date: this._images[source]?.date ?? null,
      })),
      navButtonVisible: this._mode !== "none",
      navButtonActive: this._open,
      debugStats: this.debugStats,
      debugStartedAt: this._debugStartedAt,
    };
  }

  // Sources this gallery.mode needs fetched in the background — "slide" still fetches both
  // even though only one is displayed at a time, so flipping the displayed source never
  // shows a stale/missing thumbnail.
  private get _fetchSources(): ImageSource[] {
    switch (this._mode) {
      case "both":
      case "slide":
        return GALLERY_SOURCES;
      case "earth":
      case "sun":
        return [this._mode];
      /* v8 ignore next 2 */
      default:
        return [];
    }
  }

  // Applies config.gallery: mode + auto-switch interval, and whether the strip starts open
  // (matches setConfig's previous behavior of resetting _galleryOpen from mode every call).
  // Restarts the auto-switch timer if one is already running, same as the old
  // `if (this._autoSwitchTimer != null) this._startAutoSwitchTimer()` in setConfig.
  configure(mode: GalleryMode, autoIntervalMs: number): void {
    this._mode = mode;
    this._autoIntervalMs = autoIntervalMs;
    this._open = mode !== "none";
    if (this._autoSwitchTimer != null) {
      this._startAutoSwitchTimer();
    }
  }

  start(): void {
    this._startAutoSwitchTimer();
    if (this._open) {
      void this.refresh();
    }
  }

  stop(): void {
    /* v8 ignore next */
    clearInterval(this._autoSwitchTimer ?? undefined);
    this._autoSwitchTimer = null;
  }

  // Auto-update tick: keeps the strip/panel fresh only while something is showing (avoids
  // unconditional background polling of NASA's servers for every install regardless of use).
  tick(): void {
    if (this._open) {
      void this.refresh();
    }
  }

  toggle(): void {
    this._open = !this._open;
    if (!this._open) {
      this.closePanel();
    } else {
      this._error = null;
      this._onChange();
      void this.refresh();
    }
  }

  // A click is a pure view switch, nothing more: no fetch, no preload, no async gap. Every
  // source's image is already kept current in the background by the auto-update timer
  // (refresh, cadence = refresh_mins) for as long as the gallery strip or a panel stays open,
  // so opening one just displays whatever that timer already confirmed — instant when it
  // landed, "loading…" only for the narrow window before the very first background fetch for
  // a source completes (already in flight from start()/configure() — this only nudges it
  // rather than waiting for the next tick).
  openPanel(mode: ImageSource): void {
    this._panelMode = mode;
    this._error = null;
    const known = this._images[mode];
    if (known) {
      this._applyImage(known.url, known.date);
      this._imageLoaded = true;
    } else {
      this._imageUrl = null;
      this._imageDate = null;
      this._imageLoaded = false;
      void this.refresh();
    }
    this._onChange();
  }

  closePanel(): void {
    this._panelMode = "none";
    this._imageUrl = null;
    this._imageDate = null;
    this._error = null;
    this._onChange();
  }

  onImageLoad(): void {
    this._imageLoaded = true;
    this._onChange();
  }

  // refresh() already confirms a candidate loads (with a retry for sun) before it's ever
  // assigned to the visible <img>, so this only ever fires for a genuinely unexpected
  // failure after the fact (e.g. the browser evicting its cache between preload and paint) —
  // no retry left to try, just surface the error banner.
  onImageLoadError(): void {
    if (this._panelMode === "none") return;
    this._error = `${IMAGE_SOURCE_LABELS[this._panelMode]} image unavailable`;
    this._panelMode = "none";
    this._imageUrl = null;
    this._imageDate = null;
    this._onChange();
  }

  // refresh() already retried once before this URL was ever assigned to the thumbnail, so a
  // real error here means no retry is left — drop the thumbnail (falls back to the
  // transparent placeholder) rather than retrying forever.
  onSunThumbError(): void {
    delete this._images.sun;
    this._onChange();
  }

  // Flips which source is shown in the "slide" gallery strip. Only relevant while mode is
  // "slide" — otherwise cleared so no interval runs unnecessarily.
  private _startAutoSwitchTimer(): void {
    /* v8 ignore next */
    clearInterval(this._autoSwitchTimer ?? undefined);
    if (this._mode !== "slide") {
      this._autoSwitchTimer = null;
      return;
    }
    this._autoSwitchTimer = setInterval(() => {
      void this._advanceSlide();
    }, this._autoIntervalMs) as unknown as number;
  }

  // Re-decodes the next slide's image off-DOM before flipping the displayed source, so the
  // label and the thumbnail <img> switch together — otherwise the label re-renders instantly
  // while the reused <img> still shows the previous bitmap for a frame until it decodes.
  private async _advanceSlide(): Promise<void> {
    const next = this._autoDisplayedSource === "earth" ? "sun" : "earth";
    const known = this._images[next];
    if (known) {
      try {
        // Deliberately unconditional, not routed through the resolver's URL-identity gate:
        // this decode is a DOM-sync step (holds the label/thumbnail on the old source until
        // the new one finishes decoding, so the reused <img> never flashes a stale bitmap),
        // not a re-fetch — `known.url` was already resolved and confirmed by refresh()'s
        // gated resolve() call, so this never reaches NASA again, only the browser's own
        // (already-warm) image cache.
        await redecode(known.url, this._debug[next]);
      } catch {
        // Already-validated URL failing a re-decode is transient; show it anyway rather
        // than getting stuck on the previous source forever.
      }
    }
    this._autoDisplayedSource = next;
    this._onChange();
  }

  // Every caller preloads (via ImageResolver.resolve()) before calling this, so the pixels are
  // already sitting in the browser's cache — _imageLoaded is set true right after, letting
  // the visible <img> paint from that cache instead of a live fetch.
  private _applyImage(url: string, date: Date): void {
    this._imageLoaded = false;
    this._imageUrl = url;
    this._imageDate = date;
  }

  // Fetches every source this mode needs — called on open (start/configure), on click for a
  // source that isn't known yet (openPanel), and on each auto-update tick while the strip or
  // a panel stays open. Each source is cache-guarded (earth hourly, sun every 15min —
  // matching each source's own publish cadence), so this only hits the network once the
  // relevant cache has expired. This is the single place _images is written, so it's also
  // the single place that keeps an open full-screen panel in sync with the same source. The
  // fetch/dedupe/retry mechanics live in ImageResolver — this only applies its settled
  // results to view state (which image is shown, which error banner, when to re-render).
  private async refresh(): Promise<void> {
    const results = await this._resolver.resolveAll(this._fetchSources, this._debug);
    for (const { source, result } of results) {
      if (result.status === "fulfilled") {
        this._images[source] = result.value;
        if (this._panelMode === source) {
          this._applyImage(result.value.url, result.value.date);
          this._imageLoaded = true;
        }
      } else if (this._panelMode === source && !this._images[source]) {
        // The open panel is waiting on this exact source's first-ever fetch and it just
        // failed — nothing to fall back to, so surface the error instead of "loading…"
        // forever. A source that already has a known image just keeps showing it (matches
        // the old behavior: never swap to something that might not load).
        this._panelMode = "none";
        this._error = `${IMAGE_SOURCE_LABELS[source]} image unavailable`;
      }
    }
    this._onChange();
  }
}
