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

  constructor(viewState: ViewState, onFrame: () => void) {
    this._viewState = viewState;
    this._onFrame = onFrame;
    this._animationId = null;
  }

  get isAnimating(): boolean {
    return this._animationId !== null;
  }

  animateTo(targetLevel: ZoomLevel, fromWidth: number, onComplete?: () => void): void {
    this.cancel();

    const startWidth = fromWidth;
    const targetWidth = ZOOM_LEVELS[targetLevel];
    let startTime: number | null = null;

    const step = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const t = Math.min(elapsed / ZOOM_ANIMATE_DURATION_MS, 1);
      const eased = easeInOutCubic(t);

      const w = startWidth + (targetWidth - startWidth) * eased;

      this._viewState.setViewport(w);
      this._onFrame();

      if (t < 1) {
        this._animationId = requestAnimationFrame(step);
      } else {
        this._viewState.setZoomLevel(targetLevel);
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
