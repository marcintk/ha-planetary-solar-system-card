import { describe, expect, it, vi } from "vitest";
import { ZoomController } from "../../src/card/zoom-controller.js";

describe("ZoomController before initialization", () => {
  it("reports safe defaults", () => {
    const zoom = new ZoomController(
      () => {},
      () => {}
    );
    expect(zoom.zoomLevel).toBeNull();
    expect(zoom.panZoomState).toBeNull();
    expect(zoom.viewBox).toBeNull();
    expect(zoom.isDragging).toBe(false);
  });

  it("displayZoomLevel falls back to the configured default", () => {
    const zoom = new ZoomController(
      () => {},
      () => {}
    );
    zoom.configure(3, false, 4, false);
    expect(zoom.displayZoomLevel).toBe(3);
  });

  it("zoomIn/zoomOut/advancePeriodic/recenter/startDrag/endDrag are no-ops", () => {
    const onChange = vi.fn();
    const onViewBoxChange = vi.fn();
    const zoom = new ZoomController(onChange, onViewBoxChange);
    expect(() => {
      zoom.zoomIn();
      zoom.zoomOut();
      zoom.advancePeriodic();
      zoom.recenter();
      zoom.startDrag(0, 0);
      zoom.endDrag();
    }).not.toThrow();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("updateDrag is a no-op when never dragging", () => {
    const onViewBoxChange = vi.fn();
    const zoom = new ZoomController(() => {}, onViewBoxChange);
    zoom.updateDrag(10, 10, { width: 400 } as DOMRect);
    expect(onViewBoxChange).not.toHaveBeenCalled();
  });
});

describe("ZoomController.ensureInitialized", () => {
  it("builds the view at the configured default zoom, once", () => {
    const zoom = new ZoomController(
      () => {},
      () => {}
    );
    zoom.configure(2, false, 4, false);
    zoom.ensureInitialized();
    expect(zoom.zoomLevel).toBe(2);
    zoom.configure(4, false, 4, false); // shouldn't rebuild an already-initialized view
    zoom.ensureInitialized();
    expect(zoom.zoomLevel).toBe(2);
  });

  it("reset() forces the next ensureInitialized() to rebuild at the current default", () => {
    const zoom = new ZoomController(
      () => {},
      () => {}
    );
    zoom.configure(1, false, 4, false);
    zoom.ensureInitialized();
    expect(zoom.zoomLevel).toBe(1);
    zoom.configure(3, false, 4, false);
    zoom.reset();
    zoom.ensureInitialized();
    expect(zoom.zoomLevel).toBe(3);
  });
});

describe("ZoomController zoom actions", () => {
  it("zoomIn/zoomOut change level and notify onChange, clamped at the bounds", () => {
    const onChange = vi.fn();
    const zoom = new ZoomController(onChange, () => {});
    zoom.configure(1, false, 4, false);
    zoom.ensureInitialized();

    zoom.zoomIn();
    expect(zoom.zoomLevel).toBe(2);
    expect(onChange).toHaveBeenCalledTimes(1);

    zoom.zoomOut();
    expect(zoom.zoomLevel).toBe(1);
    zoom.zoomOut(); // already at the minimum
    expect(zoom.zoomLevel).toBe(1);
    expect(onChange).toHaveBeenCalledTimes(2); // the no-op zoomOut doesn't notify
  });

  it("advancePeriodic cycles up to periodicZoomMax then wraps to the minimum", () => {
    const zoom = new ZoomController(
      () => {},
      () => {}
    );
    zoom.configure(1, true, 3, false);
    zoom.ensureInitialized();

    zoom.advancePeriodic();
    expect(zoom.zoomLevel).toBe(2);
    zoom.advancePeriodic();
    expect(zoom.zoomLevel).toBe(3);
    zoom.advancePeriodic();
    expect(zoom.zoomLevel).toBe(1);
  });

  it("tick advances only when periodicZoomChange is enabled", () => {
    const zoom = new ZoomController(
      () => {},
      () => {}
    );
    zoom.configure(1, false, 4, false);
    zoom.ensureInitialized();
    zoom.tick();
    expect(zoom.zoomLevel).toBe(1);

    zoom.configure(1, true, 4, false);
    zoom.tick();
    expect(zoom.zoomLevel).toBe(2);
  });

  it("animates via requestAnimationFrame when animate is enabled", () => {
    const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame").mockReturnValue(1);
    const zoom = new ZoomController(
      () => {},
      () => {}
    );
    zoom.configure(1, false, 4, true);
    zoom.ensureInitialized();
    zoom.zoomIn();
    expect(rafSpy).toHaveBeenCalled();
    rafSpy.mockRestore();
  });
});

describe("ZoomController drag lifecycle", () => {
  it("startDrag/updateDrag/endDrag update panZoomState and notify onViewBoxChange", () => {
    const onViewBoxChange = vi.fn();
    const zoom = new ZoomController(() => {}, onViewBoxChange);
    zoom.ensureInitialized();
    const before = { x: zoom.panZoomState?.centerX, y: zoom.panZoomState?.centerY };

    zoom.startDrag(200, 200);
    zoom.updateDrag(250, 200, { width: 400, height: 400, x: 0, y: 0 } as DOMRect);
    expect(onViewBoxChange).toHaveBeenCalledTimes(1);
    expect(zoom.panZoomState?.centerX).not.toBe(before.x);

    zoom.endDrag();
    expect(zoom.isDragging).toBe(false);
  });

  it("recenter resets pan without changing zoom level", () => {
    const zoom = new ZoomController(
      () => {},
      () => {}
    );
    zoom.ensureInitialized();
    zoom.startDrag(0, 0);
    zoom.updateDrag(100, 0, { width: 400, height: 400, x: 0, y: 0 } as DOMRect);
    zoom.endDrag();
    const zoomLevelBefore = zoom.zoomLevel;
    zoom.recenter();
    expect(zoom.zoomLevel).toBe(zoomLevelBefore);
  });
});
