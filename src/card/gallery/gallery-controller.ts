import type { SourceDebugStats } from "./debug-stats.js";
import { ImageResolver } from "./image-resolver.js";
import type { DebugRowId, ImageSource } from "./sources.js";
import { IMAGE_SOURCES, SOURCES } from "./sources.js";
import type { SourcedImage } from "./url-cache.js";

export type ImagePanelMode = "none" | ImageSource;

// How the strip presents itself — purely presentation now, unrelated to which sources are
// enabled (that's each gallery.<source> boolean, resolved in card-config.ts). "show" is a
// static strip, "slide" rotates one tile at a time through the enabled sources, "off" hides it.
export type GalleryMode = "off" | "slide" | "show";
export const DEFAULT_GALLERY_INTERVAL_MS = 60000;

// Where the strip sits. "overlay" floats it over the bottom of the solar view, which costs no
// card height but covers the outer orbits; "below" makes it a sibling of the view, growing the
// card by the strip's own height instead.
export type GalleryPosition = "overlay" | "below";

// How each thumbnail is framed. "square" — the default — shows the frame as its source
// publishes it, black margin and all; "circle" crops to the body itself so the card shows
// through around it.
export type GalleryShape = "circle" | "square";

// The enabled set before setConfig's first call resolves gallery.<source> against each
// source's own default (see card-config.ts) — mymoon only, so a card mounted with no config
// at all still shows something rather than an empty strip.
export const DEFAULT_GALLERY_SOURCES: ImageSource[] = ["mymoon"];

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
  debugStats: Record<DebugRowId, SourceDebugStats>;
  debugStartedAt: number;
}

// The full-screen panel's own state: which source (if any) it's showing, the image it has
// settled on, and any error banner. Pulled out of GalleryController because every invariant
// here is local to "what does the panel show" — closing always clears the same four fields
// together, applying an image always clears `loaded` first — and a caller (GalleryController)
// never needs to touch these one at a time.
class PanelState {
  mode: ImagePanelMode = "none";
  url: string | null = null;
  date: Date | null = null;
  loaded = false;
  error: string | null = null;

  // Every caller preloads (via ImageResolver.resolve()) before this runs, so the pixels are
  // already sitting in the browser's cache — `loaded` is set true right after, letting the
  // visible <img> paint from that cache instead of a live fetch.
  applyImage(url: string, date: Date): void {
    this.loaded = false;
    this.url = url;
    this.date = date;
  }

  close(): void {
    this.mode = "none";
    this.url = null;
    this.date = null;
    this.error = null;
  }

  // Callers only ever invoke this once they've confirmed the failing source is the one
  // currently shown, so it always closes — there is no "fail a source that isn't open" case.
  fail(message: string): void {
    this.error = message;
    this.mode = "none";
    this.url = null;
    this.date = null;
  }
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
  private _panel: PanelState;
  private _open: boolean;
  private _images: Partial<Record<ImageSource, SourcedImage>>;
  private _mode: GalleryMode;
  private _autoIntervalMs: number;
  private _slideIndex: number;
  private _autoSwitchTimer: number | null;
  private _onChange: () => void;
  private _debugStartedAt: number;
  private _resolver: ImageResolver;
  private _sources: ImageSource[];

  // resolver defaults to a real, network-backed ImageResolver for production callers — tests
  // that only exercise panel/strip/slide state can pass a fake instead (matching the pattern
  // SourceResolver already uses for its own `cache` constructor param) and skip stubbing
  // global Image/fetch entirely.
  constructor(onChange: () => void, resolver: ImageResolver = new ImageResolver()) {
    this._panel = new PanelState();
    this._open = false;
    this._mode = "off";
    this._sources = DEFAULT_GALLERY_SOURCES;
    this._autoIntervalMs = DEFAULT_GALLERY_INTERVAL_MS;
    this._slideIndex = 0;
    this._autoSwitchTimer = null;
    this._onChange = onChange;
    this._debugStartedAt = Date.now();
    this._resolver = resolver;
    // Recovers each source's still-fresh cache into this instance's own known-URL
    // state — without this, a remount (this._images always starts empty) would otherwise
    // force a redundant preload of bytes the module cache already confirmed are current.
    this._images = this._resolver.hydrate(IMAGE_SOURCES);
  }

  get panelMode(): ImagePanelMode {
    return this._panel.mode;
  }
  get imageUrl(): string | null {
    return this._panel.url;
  }
  get imageDate(): Date | null {
    return this._panel.date;
  }
  get imageLoaded(): boolean {
    return this._panel.loaded;
  }
  get error(): string | null {
    return this._panel.error;
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
  get debugStats(): Record<DebugRowId, SourceDebugStats> {
    return this._resolver.debugStats();
  }

  // Sources rendered as thumbnails right now — the configured list verbatim, except in
  // "slide" where only the source the rotation currently sits on is shown.
  get displaySources(): ImageSource[] {
    return this._mode === "slide" ? [this._sources[this._slideIndex]] : this._sources;
  }

  // position defaults to "overlay" (the strip must hide there, since it floats over the
  // full-screen view it would otherwise sit on top of) — "below" is a normal flow sibling of
  // that view instead, so it has no need to hide just because a panel opened.
  viewModel(position: GalleryPosition = "overlay"): GalleryViewModel {
    return {
      error: this._panel.error,
      panelSource: this._panel.mode,
      imageUrl: this._panel.url,
      imageDate: this._panel.date,
      imageLoaded: this._panel.loaded,
      showStrip: this._open && (position === "below" || this._panel.mode === "none"),
      thumbnails: this.displaySources.map((source) => {
        const image = this._images[source];
        return { source, url: image?.url ?? null, date: image?.date ?? null };
      }),
      debugStats: this.debugStats,
      debugStartedAt: this._debugStartedAt,
    };
  }

  // Applies config.gallery: mode + auto-switch interval, and whether the strip starts open (matches setConfig's previous behavior of
  // resetting _galleryOpen from mode every call). Restarts the auto-switch timer if one is
  // already running, same as the old `if (this._autoSwitchTimer != null)
  // this._startAutoSwitchTimer()` in setConfig.
  configure(mode: GalleryMode, sources: ImageSource[], autoIntervalMs: number): void {
    this._mode = mode;
    this._sources = sources;
    this._autoIntervalMs = autoIntervalMs;
    this._open = mode !== "off";
    // A shorter list would otherwise leave the rotation pointing past its end, so
    // displaySources would read undefined until the next tick wrapped it.
    if (this._slideIndex >= sources.length) this._slideIndex = 0;
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
      this._panel.error = null;
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
    // Re-clicking the tile that's already open is the only way to reach this with mode ===
    // panelMode: in "overlay" position the strip is hidden while a panel is open, so its tiles
    // aren't there to re-click; in "below" they stay visible, and clicking the open one again
    // reads as "close it", not "open it again".
    if (this._panel.mode === mode) {
      this.closePanel();
      return;
    }
    this._panel.mode = mode;
    this._panel.error = null;
    const known = this._images[mode];
    if (known) {
      this._panel.applyImage(known.url, known.date);
      this._panel.loaded = true;
    } else {
      this._panel.url = null;
      this._panel.date = null;
      this._panel.loaded = false;
      void this.refresh();
    }
    this._onChange();
  }

  closePanel(): void {
    this._panel.close();
    this._onChange();
  }

  onImageLoad(): void {
    this._panel.loaded = true;
    this._onChange();
  }

  // refresh() already confirms a candidate loads (with a retry for sun) before it's ever
  // assigned to the visible <img>, so this only ever fires for a genuinely unexpected
  // failure after the fact (e.g. the browser evicting its cache between preload and paint) —
  // no retry left to try, just surface the error banner.
  onImageLoadError(): void {
    if (this._panel.mode === "none") return;
    this._panel.fail(`${SOURCES[this._panel.mode].label} image unavailable`);
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
      this._advanceSlide();
    }, this._autoIntervalMs) as unknown as number;
  }

  // Advances the "slide" rotation one step through the strip, wrapping at the end. The reused
  // <img> may show the previous bitmap for a frame while the new one decodes — cosmetic, not
  // worth a pre-decode step.
  private _advanceSlide(): void {
    this._slideIndex = (this._slideIndex + 1) % this._sources.length;
    this._onChange();
  }

  // Fetches every configured source — called on open (start/configure), on click for a
  // source that isn't known yet (openPanel), and on each auto-update tick while the strip or
  // a panel stays open. Each source is cache-guarded (earth hourly, sun every 15min —
  // matching each source's own publish cadence), so this only hits the network once the
  // relevant cache has expired. This is the single place _images is written, so it's also
  // the single place that keeps an open full-screen panel in sync with the same source. The
  // fetch/dedupe/retry mechanics live in ImageResolver — this only applies its settled
  // results to view state (which image is shown, which error banner, when to re-render).
  private async refresh(): Promise<void> {
    const results = await this._resolver.resolveAll(this._sources);
    for (const { source, result } of results) {
      if (result.status === "fulfilled") {
        this._images[source] = result.value;
        if (this._panel.mode === source) {
          this._panel.applyImage(result.value.url, result.value.date);
          this._panel.loaded = true;
        }
      } else if (this._panel.mode === source && !this._images[source]) {
        // The open panel is waiting on this exact source's first-ever fetch and it just
        // failed — nothing to fall back to, so surface the error instead of "loading…"
        // forever. A source that already has a known image just keeps showing it (matches
        // the old behavior: never swap to something that might not load).
        this._panel.fail(`${SOURCES[source].label} image unavailable`);
      }
    }
    this._onChange();
  }
}
