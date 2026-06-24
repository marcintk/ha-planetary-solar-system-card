import type { ZoomLevel } from "../types.js";
import { type ViewState, ZOOM_LEVELS } from "./card-view-state.js";

const ZOOM_ANIMATE_DURATION_MS = 2000;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export class ZoomAnimator {
  private _viewState: ViewState;
  private _onFrame: () => void;
  private _animationId: number | null;
  private _startWidth: number;
  private _startHeight: number;
  private _targetWidth: number;
  private _targetHeight: number;
  private _targetLevel: ZoomLevel;
  private _startTime: number | null;

  constructor(viewState: ViewState, onFrame: () => void) {
    this._viewState = viewState;
    this._onFrame = onFrame;
    this._animationId = null;
    this._startWidth = 0;
    this._startHeight = 0;
    this._targetWidth = 0;
    this._targetHeight = 0;
    this._targetLevel = 1;
    this._startTime = null;
  }

  get isAnimating(): boolean {
    return this._animationId !== null;
  }

  animateTo(
    targetLevel: ZoomLevel,
    fromWidth: number | null,
    fromHeight: number | null,
    onComplete?: () => void
  ): void {
    this.cancel();

    this._startWidth = fromWidth != null ? fromWidth : this._viewState.width;
    this._startHeight = fromHeight != null ? fromHeight : this._viewState.height;
    this._targetWidth = ZOOM_LEVELS[targetLevel];
    this._targetHeight = ZOOM_LEVELS[targetLevel];
    this._targetLevel = targetLevel;
    this._startTime = null;

    const step = (timestamp: number) => {
      if (this._startTime === null) this._startTime = timestamp;
      const elapsed = timestamp - this._startTime;
      const t = Math.min(elapsed / ZOOM_ANIMATE_DURATION_MS, 1);
      const eased = easeInOutCubic(t);

      const w = this._startWidth + (this._targetWidth - this._startWidth) * eased;
      const h = this._startHeight + (this._targetHeight - this._startHeight) * eased;

      this._viewState.setViewport(w, h);
      this._onFrame();

      if (t < 1) {
        this._animationId = requestAnimationFrame(step);
      } else {
        this._viewState.setZoomLevel(this._targetLevel);
        this._animationId = null;
        this._onFrame();
        onComplete?.();
      }
    };

    this._animationId = requestAnimationFrame(step);
  }

  cancel(): void {
    if (this._animationId !== null) {
      cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }
  }
}
