import { describe, expect, it } from "vitest";
import { SolarView } from "../../src/card/solar-view.js";
import { ZoomController } from "../../src/card/zoom-controller.js";
import { HALO_VIEW_FRACTION } from "../../src/renderer/bodies.js";
import { MARKER_GROUP_ID } from "../../src/renderer/offscreen-markers.js";

function mountedView(): { view: SolarView; zoom: ZoomController; container: HTMLElement } {
  const zoom = new ZoomController(
    () => {},
    () => {}
  );
  zoom.configure(2, false, 4, false);
  zoom.ensureInitialized();
  const view = new SolarView(zoom);
  const container = document.createElement("div");
  view.mount(container, new Date("2026-08-16T12:00:00Z"), "north", null, {}, false);
  return { view, zoom, container };
}

describe("SolarView.mount", () => {
  it("appends a single svg to the container", () => {
    const { container } = mountedView();
    expect(container.children.length).toBe(1);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("clears any previous content before mounting again", () => {
    const { view, container } = mountedView();
    view.mount(container, new Date("2026-08-17T12:00:00Z"), "north", null, {}, false);
    expect(container.children.length).toBe(1);
  });

  it("forwards shade options to the renderer — both off drops the halo and all body shading", () => {
    const zoom = new ZoomController(
      () => {},
      () => {}
    );
    zoom.configure(2, false, 4, false);
    zoom.ensureInitialized();
    const view = new SolarView(zoom);
    const container = document.createElement("div");
    view.mount(container, new Date("2026-08-16T12:00:00Z"), "north", null, {}, false, {
      sphere: false,
      dayNight: false,
    });

    const svg = container.querySelector("svg") as SVGSVGElement;
    expect(svg.querySelector("#sun-halo-glow")).toBeNull();
    expect(svg.querySelector('defs filter[id^="tint-"]')).toBeNull();
    expect(svg.querySelector('path[fill="#05070c"]')).toBeNull();
  });

  it("defaults shade to both-on (3d sprite + day/night) when the arg is omitted", () => {
    const { container } = mountedView();
    const svg = container.querySelector("svg") as SVGSVGElement;
    expect(svg.querySelector("#sun-halo-glow")).not.toBeNull();
    expect(svg.querySelector('defs filter[id^="tint-"]')).not.toBeNull();
    // day/night on: sprites are rotated toward the Sun + Saturn has its clipped band
    expect(svg.querySelector('image[transform^="rotate("]')).not.toBeNull();
    expect(svg.querySelector('circle[clip-path="url(#saturn-shadow)"]')).not.toBeNull();
  });
});

describe("SolarView.applyViewState", () => {
  it("is a no-op when nothing has been mounted", () => {
    const zoom = new ZoomController(
      () => {},
      () => {}
    );
    const view = new SolarView(zoom);
    expect(() => view.applyViewState()).not.toThrow();
  });

  it("skips the svg write when the zoom view initializes before mount() runs", () => {
    const zoom = new ZoomController(
      () => {},
      () => {}
    );
    zoom.configure(2, false, 4, false);
    zoom.ensureInitialized();
    const view = new SolarView(zoom);
    expect(() => view.applyViewState()).not.toThrow();
  });

  it("widens the marker rect to the card's aspect ratio (#135)", () => {
    // A 2:1 card letterboxes the square viewBox, so a body in the side band is
    // on screen and must lose its marker; markers move out to the card edges.
    const { view, container } = mountedView();
    const svg = container.querySelector("svg") as SVGSVGElement;
    const rectFor = (w: number, h: number) => () =>
      ({ width: w, height: h, x: 0, y: 0, top: 0, left: 0 }) as DOMRect;

    svg.getBoundingClientRect = rectFor(400, 400);
    view.applyViewState();
    const square = svg.getElementById(MARKER_GROUP_ID).children.length;

    svg.getBoundingClientRect = rectFor(800, 400);
    view.applyViewState();
    const wide = svg.getElementById(MARKER_GROUP_ID).children.length;

    expect(square).toBeGreaterThan(0);
    expect(wide).toBeLessThan(square);
  });

  it("falls back to square when the element has not been laid out yet", () => {
    // jsdom and HA's first paint both measure 0x0; width/height would be NaN.
    const { view, container } = mountedView();
    const svg = container.querySelector("svg") as SVGSVGElement;
    svg.getBoundingClientRect = () =>
      ({ width: 0, height: 0, x: 0, y: 0, top: 0, left: 0 }) as DOMRect;
    view.applyViewState();
    const points = svg.getElementById(MARKER_GROUP_ID).querySelector("polygon");
    expect(points?.getAttribute("points")).not.toContain("NaN");
  });

  it("sets the svg viewBox from the zoom controller", () => {
    const { view, zoom, container } = mountedView();
    const svg = container.querySelector("svg") as SVGSVGElement;
    svg.setAttribute("viewBox", "0 0 1 1");
    view.applyViewState();
    expect(svg.getAttribute("viewBox")).toBe(zoom.viewBox);
  });

  it("resizes the Sun halo to the zoom width (#199 slice 4)", () => {
    const { view, zoom, container } = mountedView();
    const svg = container.querySelector("svg") as SVGSVGElement;
    const haloR = () => Number(svg.querySelector("#sun-halo-glow")?.getAttribute("r"));

    view.applyViewState();
    expect(haloR()).toBeCloseTo((zoom.panZoomState?.width as number) * HALO_VIEW_FRACTION, 6);

    // Step in one zoom rung: level 2 (width 640) -> level 3 (width 480).
    zoom.zoomIn();
    view.applyViewState();
    expect(haloR()).toBeCloseTo((zoom.panZoomState?.width as number) * HALO_VIEW_FRACTION, 6);
  });
});

describe("SolarView pointer drag", () => {
  it("pointermove before pointerdown is a no-op", () => {
    const { zoom, container } = mountedView();
    const svg = container.querySelector("svg") as SVGSVGElement;
    const centerBefore = zoom.panZoomState?.centerX;
    svg.dispatchEvent(new PointerEvent("pointermove", { clientX: 300, clientY: 300 }));
    expect(zoom.panZoomState?.centerX).toBe(centerBefore);
  });

  it("pointerup before pointerdown is a no-op", () => {
    const { zoom, container } = mountedView();
    const svg = container.querySelector("svg") as SVGSVGElement;
    svg.releasePointerCapture = () => {};
    svg.dispatchEvent(new PointerEvent("pointerup", { clientX: 300, clientY: 300 }));
    expect(zoom.isDragging).toBe(false);
  });

  it("pointerdown starts a drag, sets capture and grabbing cursor", () => {
    const { zoom, container } = mountedView();
    const svg = container.querySelector("svg") as SVGSVGElement;
    svg.setPointerCapture = () => {};
    svg.releasePointerCapture = () => {};
    svg.dispatchEvent(
      new PointerEvent("pointerdown", { clientX: 100, clientY: 100, pointerId: 1 })
    );
    expect(zoom.isDragging).toBe(true);
    expect(svg.style.cursor).toBe("grabbing");
  });

  it("pointermove while dragging updates pan center, pointerup ends drag and resets cursor", () => {
    const { zoom, container } = mountedView();
    const svg = container.querySelector("svg") as SVGSVGElement;
    svg.setPointerCapture = () => {};
    svg.releasePointerCapture = () => {};
    svg.getBoundingClientRect = () =>
      ({ width: 400, height: 400, x: 0, y: 0, top: 0, left: 0 }) as DOMRect;

    const centerBefore = zoom.panZoomState?.centerX;
    svg.dispatchEvent(
      new PointerEvent("pointerdown", { clientX: 200, clientY: 200, pointerId: 1 })
    );
    svg.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 250, clientY: 200, pointerId: 1 })
    );
    expect(zoom.panZoomState?.centerX).toBeLessThan(centerBefore as number);

    svg.dispatchEvent(new PointerEvent("pointerup", { clientX: 250, clientY: 200, pointerId: 1 }));
    expect(zoom.isDragging).toBe(false);
    expect(svg.style.cursor).toBe("grab");
  });
});
