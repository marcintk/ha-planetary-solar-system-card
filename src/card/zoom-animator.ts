const ZOOM_ANIMATE_DURATION_MS = 2000;

/**
 * Eases one number to another over a fixed duration, one requestAnimationFrame at a time.
 *
 * Deliberately knows nothing about zoom levels or view state — it interpolates a viewBox width
 * and hands each frame back. What a frame *means* (assigning the width, repainting, committing
 * the final level) is ZoomController's, which is the only thing that owns that state. That
 * split is what lets this be tested with two spies and no scene at all.
 */
export class ZoomAnimator {
  private _animationId: number | null;

  constructor() {
    this._animationId = null;
  }

  get isAnimating(): boolean {
    return this._animationId !== null;
  }

  animateTo(
    fromWidth: number,
    toWidth: number,
    onStep: (width: number) => void,
    onComplete?: () => void
  ): void {
    this.cancel();

    let startTime: number | null = null;

    const step = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const t = Math.min(elapsed / ZOOM_ANIMATE_DURATION_MS, 1);

      onStep(fromWidth + (toWidth - fromWidth) * easeInOutCubic(t));

      if (t < 1) {
        this._animationId = requestAnimationFrame(step);
      } else {
        this._animationId = null;
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

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
