import type { ZoomLevel } from "../types.js";

export const FULL_SYSTEM_SIZE = 800;
export const DEFAULT_ZOOM_LEVEL: ZoomLevel = 1;
export const MIN_ZOOM: ZoomLevel = 1;
export const MAX_ZOOM: ZoomLevel = 4;

export const ZOOM_LEVELS: Record<ZoomLevel, number> = { 1: 800, 2: 640, 3: 480, 4: 320 };

/**
 * Encapsulates all pan and zoom state for the solar system view.
 * Keeps the SolarViewCard focused on rendering and event wiring.
 */
export class ViewState {
  centerX: number;
  centerY: number;
  zoomLevel: ZoomLevel;
  isDragging: boolean;
  private _size: number;
  private _dragStartX: number;
  private _dragStartY: number;
  private _dragStartCenterX: number;
  private _dragStartCenterY: number;

  constructor(defaultZoomLevel: ZoomLevel = DEFAULT_ZOOM_LEVEL) {
    this.centerX = FULL_SYSTEM_SIZE / 2;
    this.centerY = FULL_SYSTEM_SIZE / 2;
    this.zoomLevel = defaultZoomLevel;
    this._size = ZOOM_LEVELS[defaultZoomLevel];
    this.isDragging = false;
    this._dragStartX = 0;
    this._dragStartY = 0;
    this._dragStartCenterX = 0;
    this._dragStartCenterY = 0;
  }

  // ponytail: viewport is always square (aspect-ratio: 1 in CSS + ZOOM_LEVELS are uniform)
  get width(): number {
    return this._size;
  }
  get height(): number {
    return this._size;
  }

  /** Returns the SVG viewBox string for the current pan/zoom state. */
  get viewBox(): string {
    const minX = this.centerX - this._size / 2;
    const minY = this.centerY - this._size / 2;
    return `${minX} ${minY} ${this._size} ${this._size}`;
  }

  /** Zoom in one discrete level. Returns true if zoom changed. */
  zoomIn(): boolean {
    if (this.zoomLevel >= MAX_ZOOM) return false;
    this.zoomLevel = (this.zoomLevel + 1) as ZoomLevel;
    this._size = ZOOM_LEVELS[this.zoomLevel];
    return true;
  }

  /** Zoom out one discrete level. Returns true if zoom changed. */
  zoomOut(): boolean {
    if (this.zoomLevel <= MIN_ZOOM) return false;
    this.zoomLevel = (this.zoomLevel - 1) as ZoomLevel;
    this._size = ZOOM_LEVELS[this.zoomLevel];
    return true;
  }

  /** Set zoom to a specific level, clamped to [MIN_ZOOM, MAX_ZOOM]. */
  setZoomLevel(level: number): void {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level)) as ZoomLevel;
    this.zoomLevel = clamped;
    this._size = ZOOM_LEVELS[clamped];
  }

  /** Set viewport size directly (for animation frames) without changing zoomLevel. */
  setViewport(size: number, _ignored: number): void {
    this._size = size;
  }

  startDrag(clientX: number, clientY: number): void {
    this.isDragging = true;
    this._dragStartX = clientX;
    this._dragStartY = clientY;
    this._dragStartCenterX = this.centerX;
    this._dragStartCenterY = this.centerY;
  }

  /** Update pan position during a drag. svgRect is the result of getBoundingClientRect(). */
  updateDrag(clientX: number, clientY: number, svgRect: DOMRect): void {
    if (!this.isDragging) return;
    const dx = clientX - this._dragStartX;
    const dy = clientY - this._dragStartY;
    const scale = this._size / svgRect.width;
    this.centerX = this._dragStartCenterX - dx * scale;
    this.centerY = this._dragStartCenterY - dy * scale;
  }

  endDrag(): void {
    this.isDragging = false;
  }
}
