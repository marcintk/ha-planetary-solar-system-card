import { VIEW_SIZE } from "../renderer/svg-utils.js";
import type { PanZoomState, ZoomLevel } from "../types.js";
import { ZoomAnimator } from "./zoom-animator.js";
import { DEFAULT_ZOOM_LEVEL, MAX_ZOOM, MIN_ZOOM, ZOOM_LEVELS } from "./zoom-levels.js";

/**
 * Owns pan/zoom: the discrete zoom ladder, the pan centre, drag math, and the periodic
 * auto-cycle. card.ts keeps the DOM-touching half (querying #solar-view svg, setting the
 * viewBox attribute, triggering offscreen-marker updates) since that's shared with Lit's
 * render lifecycle — this controller only ever hands back plain state and fires callbacks.
 *
 * Two callbacks, matching the two different costs: onChange requests a full Lit re-render
 * (zoom level changed — nav bar text/buttons need it), onViewBoxChange is cheap and fires on
 * every drag/animation frame (only the SVG viewBox + offscreen markers need updating).
 *
 * Nothing moves before ensureInitialized(): a card that has been constructed but never
 * rendered reports no zoom level and no pan state, so setConfig can't stomp a view that
 * doesn't exist yet and applyViewState() has nothing to apply.
 */
export class ZoomController {
  private _initialized: boolean;
  private _centerX: number;
  private _centerY: number;
  private _zoomLevel: ZoomLevel;
  // The width actually on screen. Equals ZOOM_LEVELS[_zoomLevel] at rest; the animator walks
  // it between rungs, which is why it is tracked apart from the level itself.
  private _size: number;
  private _isDragging: boolean;
  private _dragStartX: number;
  private _dragStartY: number;
  private _dragStartCenterX: number;
  private _dragStartCenterY: number;
  private _animator: ZoomAnimator;
  private _defaultZoomLevel: ZoomLevel;
  private _periodicZoomChange: boolean;
  private _periodicZoomMax: number;
  private _animate: boolean;
  private _userInteracted: boolean;
  private _onChange: () => void;
  private _onViewBoxChange: () => void;

  constructor(onChange: () => void, onViewBoxChange: () => void) {
    this._initialized = false;
    this._centerX = VIEW_SIZE / 2;
    this._centerY = VIEW_SIZE / 2;
    this._zoomLevel = DEFAULT_ZOOM_LEVEL;
    this._size = ZOOM_LEVELS[DEFAULT_ZOOM_LEVEL];
    this._isDragging = false;
    this._dragStartX = 0;
    this._dragStartY = 0;
    this._dragStartCenterX = 0;
    this._dragStartCenterY = 0;
    this._animator = new ZoomAnimator();
    this._defaultZoomLevel = DEFAULT_ZOOM_LEVEL;
    this._periodicZoomChange = false;
    this._periodicZoomMax = MAX_ZOOM;
    this._animate = false;
    this._userInteracted = false;
    this._onChange = onChange;
    this._onViewBoxChange = onViewBoxChange;
  }

  get zoomLevel(): ZoomLevel | null {
    return this._initialized ? this._zoomLevel : null;
  }
  // Falls back to the configured default before the view initializes on first render.
  get displayZoomLevel(): ZoomLevel {
    return this._initialized ? this._zoomLevel : this._defaultZoomLevel;
  }
  // A snapshot, not the controller itself: the renderer reads this every drag frame to place
  // offscreen markers, and has no business reaching the rest of the controller through it.
  get panZoomState(): PanZoomState | null {
    return this._initialized
      ? { centerX: this._centerX, centerY: this._centerY, width: this._size }
      : null;
  }
  get viewBox(): string | null {
    if (!this._initialized) return null;
    return `${this._centerX - this._size / 2} ${this._centerY - this._size / 2} ${this._size} ${this._size}`;
  }
  get isDragging(): boolean {
    return this._isDragging;
  }
  /**
   * Whether the view still sits where Home would put it. Drives the "Now" button's highlight.
   * True before the view initializes — nothing has moved yet. Date liveness is DateNavigation's
   * half of the same question, checked alongside this at the call site.
   */
  get isDefaultView(): boolean {
    if (!this._initialized) return true;
    if (this._centerX !== VIEW_SIZE / 2 || this._centerY !== VIEW_SIZE / 2) return false;
    // The auto-cycle owns the zoom while it runs: it walking off default_zoom is the default
    // view doing its thing, not the user leaving it, so Home has nothing to offer yet.
    if (this._periodicZoomChange && !this._userInteracted) return true;
    return this._zoomLevel === this._defaultZoomLevel;
  }
  get periodicZoomChange(): boolean {
    return this._periodicZoomChange;
  }
  get periodicZoomMax(): number {
    return this._periodicZoomMax;
  }
  get animate(): boolean {
    return this._animate;
  }

  configure(
    defaultZoomLevel: ZoomLevel,
    periodicZoomChange: boolean,
    periodicZoomMax: number,
    animate: boolean
  ): void {
    const defaultChanged = defaultZoomLevel !== this._defaultZoomLevel;
    this._defaultZoomLevel = defaultZoomLevel;
    this._periodicZoomChange = periodicZoomChange;
    this._periodicZoomMax = periodicZoomMax;
    this._animate = animate;
    // ensureInitialized() won't move an already-built view, so a later setConfig (Lovelace
    // editor preview) has to. Only on an actual change, so an unrelated config edit can't
    // stomp a hand-set zoom; instant, not via _apply() — a config jump isn't a zoom gesture.
    if (defaultChanged && this._initialized) {
      this._setZoomLevel(defaultZoomLevel);
      this._onChange();
    }
  }

  ensureInitialized(): void {
    if (this._initialized) return;
    this._initialized = true;
    this._setZoomLevel(this._defaultZoomLevel);
  }

  recenter(): void {
    if (!this._initialized) return;
    this._centerX = VIEW_SIZE / 2;
    this._centerY = VIEW_SIZE / 2;
  }

  /**
   * Marks the view as user-driven, pausing the periodic auto-cycle until Home. Called for
   * gestures that live outside this controller (date navigation) — zoom and drag flag
   * themselves. Replay and the gallery deliberately don't: neither aims the camera.
   */
  suspendAutoCycle(): void {
    this._userInteracted = true;
  }

  /**
   * Home: back to default_zoom and hand the view back to the auto-cycle. Distinct from
   * resetting the pan, which recenter() already owns, and from dropping an in-flight
   * animation — a zoom already at the default has nothing to animate.
   */
  resetToDefault(): void {
    this._userInteracted = false;
    if (!this._initialized || this._zoomLevel === this._defaultZoomLevel) return;
    const fromWidth = this._size;
    this._setZoomLevel(this._defaultZoomLevel);
    this._apply(fromWidth);
  }

  zoomIn(): void {
    this._stepZoom(1);
  }

  zoomOut(): void {
    this._stepZoom(-1);
  }

  // One rung either way. The interaction flag is set even when the ladder has no rung left to
  // take: reaching for the zoom is the user taking the camera over, whether or not it moved.
  private _stepZoom(delta: 1 | -1): void {
    if (!this._initialized) return;
    const fromWidth = this._size;
    this._userInteracted = true;
    const next = this._zoomLevel + delta;
    if (next < MIN_ZOOM || next > MAX_ZOOM) return;
    this._setZoomLevel(next);
    this._apply(fromWidth);
  }

  // Auto-update tick: a refresh is a data update, not a reason to move a camera someone
  // deliberately aimed — so it advances only while the cycle is on and the user hasn't taken over.
  tick(): void {
    if (this._periodicZoomChange && !this._userInteracted) this.advancePeriodic();
  }

  advancePeriodic(): void {
    if (!this._initialized) return;
    const fromWidth = this._size;
    const next = this._zoomLevel >= this._periodicZoomMax ? MIN_ZOOM : this._zoomLevel + 1;
    this._setZoomLevel(next as ZoomLevel);
    this._apply(fromWidth);
  }

  startDrag(clientX: number, clientY: number): void {
    if (!this._initialized) return;
    this._isDragging = true;
    this._dragStartX = clientX;
    this._dragStartY = clientY;
    this._dragStartCenterX = this._centerX;
    this._dragStartCenterY = this._centerY;
  }

  updateDrag(clientX: number, clientY: number, rect: DOMRect): void {
    if (!this._isDragging) return;
    // Flagged here rather than in startDrag: pointerdown fires on every tap of the SVG,
    // planet clicks included. Only a pointer that actually moved the pan counts as taking over.
    this._userInteracted = true;
    const scale = this._size / rect.width;
    this._centerX = this._dragStartCenterX - (clientX - this._dragStartX) * scale;
    this._centerY = this._dragStartCenterY - (clientY - this._dragStartY) * scale;
    this._onViewBoxChange();
  }

  endDrag(): void {
    // Per-frame drag updates take the cheap path (viewBox only), which never repaints the nav
    // bar — so the "Now" highlight would lag a pan until some unrelated later render. One full
    // re-render on pointerup, not per frame, keeps it honest at negligible cost.
    if (!this._isDragging) return;
    this._isDragging = false;
    this._onChange();
  }

  // Commits a rung of the ladder: the level and the width it rests at, clamped to the ladder's
  // ends. The animator overwrites _size per frame on its way here; this is what it settles on.
  private _setZoomLevel(level: number): void {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level)) as ZoomLevel;
    this._zoomLevel = clamped;
    this._size = ZOOM_LEVELS[clamped];
  }

  private _apply(fromWidth: number): void {
    this._onChange();
    if (!this._animate) return;
    const toWidth = this._size;
    this._animator.animateTo(
      fromWidth,
      toWidth,
      (width) => {
        this._size = width;
        this._onViewBoxChange();
      },
      () => {
        this._size = toWidth;
        this._onViewBoxChange();
        this._onChange();
      }
    );
  }
}
