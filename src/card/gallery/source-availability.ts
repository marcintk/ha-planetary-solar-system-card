import type { ImageResolver } from "./image-resolver.js";
import type { ImageSource } from "./sources.js";
import type { SourcedImage } from "./url-cache.js";

const UNAVAILABLE_AFTER_FAILURES = 1;

export class SourceAvailability {
  private _wasNothingDrawable = false;

  constructor(
    private readonly _resolver: Pick<ImageResolver, "failureCount" | "isPermanentlyUnavailable">,
    private readonly _getImages: () => Partial<Record<ImageSource, SourcedImage>>
  ) {}

  isUnavailable(source: ImageSource): boolean {
    return (
      !this._getImages()[source] &&
      (this._resolver.isPermanentlyUnavailable(source) ||
        this._resolver.failureCount(source) >= UNAVAILABLE_AFTER_FAILURES)
    );
  }

  nothingDrawable(sources: ImageSource[]): boolean {
    return sources.every((source) => this.isUnavailable(source));
  }

  recoveredFromNothingDrawable(sources: ImageSource[]): boolean {
    const nothingDrawable = this.nothingDrawable(sources);
    const recovered = this._wasNothingDrawable && !nothingDrawable;
    this._wasNothingDrawable = nothingDrawable;
    return recovered;
  }

  reset(sources: ImageSource[]): void {
    this._wasNothingDrawable = this.nothingDrawable(sources);
  }
}
