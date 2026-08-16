import { describe, expect, it } from "vitest";
import { SolarView } from "../../src/card/solar-view.js";
import { ZoomController } from "../../src/card/zoom-controller.js";

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

  it("sets the svg viewBox from the zoom controller", () => {
    const { view, zoom, container } = mountedView();
    const svg = container.querySelector("svg") as SVGSVGElement;
    svg.setAttribute("viewBox", "0 0 1 1");
    view.applyViewState();
    expect(svg.getAttribute("viewBox")).toBe(zoom.viewBox);
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
