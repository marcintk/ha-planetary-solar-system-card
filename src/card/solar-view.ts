import { renderSolarSystem } from "../renderer/index.js";
import type { Colors, Hemisphere, LocationData, PanZoomState } from "../types.js";
import type { ZoomController } from "./zoom-controller.js";

/**
 * Owns the #solar-view SVG end to end: mounting a freshly rendered scene, applying pan/zoom
 * state (viewBox + offscreen markers), and driving drag via the given ZoomController. Callers
 * never touch the SVG's DOM shape directly — see the leaked-seam finding this replaces.
 */
export class SolarView {
  private _zoom: ZoomController;
  private _svg: SVGSVGElement | null;
  private _updateMarkers: ((viewState: PanZoomState, aspect?: number) => void) | null;
  private _updateHalo: ((viewState: PanZoomState) => void) | null;

  constructor(zoom: ZoomController) {
    this._zoom = zoom;
    this._svg = null;
    this._updateMarkers = null;
    this._updateHalo = null;
  }

  mount(
    container: HTMLElement,
    date: Date,
    hemisphere: Hemisphere,
    locationData: LocationData | null,
    colors: Colors,
    eclipticView: boolean
  ): void {
    while (container.firstChild) container.removeChild(container.firstChild);
    const { svg, updateMarkers, updateHalo } = renderSolarSystem(
      date,
      hemisphere,
      locationData,
      colors,
      eclipticView
    );
    this._svg = svg;
    this._updateMarkers = updateMarkers;
    this._updateHalo = updateHalo;
    container.appendChild(svg);
    this._bindPointerEvents(svg);
  }

  applyViewState(): void {
    const panZoomState = this._zoom.panZoomState;
    if (!panZoomState) return;
    if (this._svg) this._svg.setAttribute("viewBox", this._zoom.viewBox as string);
    // Markers hug the card's edges, which the square viewBox no longer matches once
    // config.height reshapes the box (#135). Measured here rather than cached: the
    // element is the only thing that knows its rendered aspect.
    const rect = this._svg?.getBoundingClientRect();
    this._updateMarkers?.(panZoomState, rect?.height ? rect.width / rect.height : 1);
    this._updateHalo?.(panZoomState);
  }

  private _bindPointerEvents(svg: SVGSVGElement): void {
    svg.addEventListener("pointerdown", (e) => this._onPointerDown(e));
    svg.addEventListener("pointermove", (e) => this._onPointerMove(e));
    svg.addEventListener("pointerup", (e) => this._onPointerUp(e));
  }

  private _onPointerDown(e: PointerEvent): void {
    const svg = e.currentTarget as SVGSVGElement;
    svg.setPointerCapture(e.pointerId);
    this._zoom.startDrag(e.clientX, e.clientY);
    svg.style.cursor = "grabbing";
  }

  private _onPointerMove(e: PointerEvent): void {
    if (!this._zoom.isDragging) return;
    const svg = e.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    this._zoom.updateDrag(e.clientX, e.clientY, rect);
  }

  private _onPointerUp(e: PointerEvent): void {
    if (!this._zoom.isDragging) return;
    this._zoom.endDrag();
    const svg = e.currentTarget as SVGSVGElement;
    svg.releasePointerCapture(e.pointerId);
    svg.style.cursor = "grab";
  }
}
