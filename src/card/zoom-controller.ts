import type { PanZoomState, ZoomLevel } from "../types.js";
import { DEFAULT_ZOOM_LEVEL, MAX_ZOOM, MIN_ZOOM, ViewState } from "./card-view-state.js";
import { ZoomAnimator } from "./zoom-animator.js";

/**
 * Owns pan/zoom: the ViewState + ZoomAnimator pair, periodic auto-cycle config, and drag
 * math. card.ts keeps the DOM-touching half (querying #solar-view svg, setting the viewBox
 * attribute, triggering offscreen-marker updates) since that's shared with Lit's render
 * lifecycle — this controller only ever hands back plain state and fires callbacks.
 *
 * Two callbacks, matching the two different costs: onChange requests a full Lit re-render
 * (zoom level changed — nav bar text/buttons need it), onViewBoxChange is cheap and fires on
 * every drag/animation frame (only the SVG viewBox + offscreen markers need updating).
 */
export class ZoomController {
  private _viewState: ViewState | null;
  private _zoomAnimator: ZoomAnimator | null;
  private _defaultZoomLevel: ZoomLevel;
  private _periodicZoomChange: boolean;
  private _periodicZoomMax: number;
  private _animate: boolean;
  private _onChange: () => void;
  private _onViewBoxChange: () => void;

  constructor(onChange: () => void, onViewBoxChange: () => void) {
    this._viewState = null;
    this._zoomAnimator = null;
    this._defaultZoomLevel = DEFAULT_ZOOM_LEVEL;
    this._periodicZoomChange = false;
    this._periodicZoomMax = MAX_ZOOM;
    this._animate = false;
    this._onChange = onChange;
    this._onViewBoxChange = onViewBoxChange;
  }

  get zoomLevel(): ZoomLevel | null {
    return this._viewState?.zoomLevel ?? null;
  }
  // Falls back to the configured default before the view initializes on first render.
  get displayZoomLevel(): ZoomLevel {
    return this._viewState?.zoomLevel ?? this._defaultZoomLevel;
  }
  get panZoomState(): PanZoomState | null {
    return this._viewState;
  }
  get viewBox(): string | null {
    return this._viewState?.viewBox ?? null;
  }
  get isDragging(): boolean {
    return this._viewState?.isDragging ?? false;
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
    if (defaultChanged && this._viewState) {
      this._viewState.setZoomLevel(defaultZoomLevel);
      this._onChange();
    }
  }

  ensureInitialized(): void {
    if (this._viewState) return;
    this._viewState = new ViewState(this._defaultZoomLevel);
    this._zoomAnimator = new ZoomAnimator(this._viewState, () => this._onViewBoxChange());
  }

  recenter(): void {
    this._viewState?.recenter();
  }

  zoomIn(): void {
    const viewState = this._viewState;
    if (!viewState) return;
    const prevWidth = viewState.width;
    if (viewState.zoomIn()) this._apply(viewState, prevWidth);
  }

  zoomOut(): void {
    const viewState = this._viewState;
    if (!viewState) return;
    const prevWidth = viewState.width;
    if (viewState.zoomOut()) this._apply(viewState, prevWidth);
  }

  // Auto-update tick: advances the periodic auto-cycle only while it's enabled.
  tick(): void {
    if (this._periodicZoomChange) this.advancePeriodic();
  }

  advancePeriodic(): void {
    const viewState = this._viewState;
    if (!viewState) return;
    const prevWidth = viewState.width;
    const next = viewState.zoomLevel >= this._periodicZoomMax ? MIN_ZOOM : viewState.zoomLevel + 1;
    viewState.setZoomLevel(next);
    this._apply(viewState, prevWidth);
  }

  startDrag(clientX: number, clientY: number): void {
    this._viewState?.startDrag(clientX, clientY);
  }

  updateDrag(clientX: number, clientY: number, rect: DOMRect): void {
    if (!this._viewState?.isDragging) return;
    this._viewState.updateDrag(clientX, clientY, rect);
    this._onViewBoxChange();
  }

  endDrag(): void {
    this._viewState?.endDrag();
  }

  private _apply(viewState: ViewState, fromWidth: number): void {
    if (this._animate && this._zoomAnimator) {
      this._onChange();
      this._zoomAnimator.animateTo(viewState.zoomLevel, fromWidth, () => this._onChange());
    } else {
      this._onChange();
    }
  }
}
