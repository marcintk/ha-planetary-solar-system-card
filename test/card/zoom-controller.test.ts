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
    zoom.ensureInitialized(); // shouldn't rebuild an already-initialized view
    expect(zoom.zoomLevel).toBe(2);
  });
});

describe("ZoomController.configure after initialization", () => {
  it("applies a changed default_zoom to the live view and notifies once", () => {
    const onChange = vi.fn();
    const zoom = new ZoomController(onChange, () => {});
    zoom.configure(1, false, 4, false);
    zoom.ensureInitialized();
    expect(zoom.zoomLevel).toBe(1);

    zoom.configure(3, false, 4, false);
    expect(zoom.zoomLevel).toBe(3);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("leaves a hand-set zoom alone when default_zoom is unchanged", () => {
    const onChange = vi.fn();
    const zoom = new ZoomController(onChange, () => {});
    zoom.configure(1, false, 4, false);
    zoom.ensureInitialized();
    zoom.zoomIn(); // user zoomed by hand
    onChange.mockClear();

    zoom.configure(1, true, 3, false); // unrelated config edit
    expect(zoom.zoomLevel).toBe(2);
    expect(onChange).not.toHaveBeenCalled();
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

describe("ZoomController manual interaction suspends the periodic cycle", () => {
  it("tick is a no-op after a manual zoom", () => {
    const zoom = new ZoomController(
      () => {},
      () => {}
    );
    zoom.configure(1, true, 4, false);
    zoom.ensureInitialized();

    zoom.zoomIn(); // user zoomed by hand
    expect(zoom.zoomLevel).toBe(2);

    zoom.tick();
    expect(zoom.zoomLevel).toBe(2); // the auto-cycle must not yank it to 3
  });

  it("tick is a no-op after the user drags the view", () => {
    const zoom = new ZoomController(
      () => {},
      () => {}
    );
    zoom.configure(1, true, 4, false);
    zoom.ensureInitialized();

    zoom.startDrag(200, 200);
    zoom.updateDrag(250, 200, { width: 400, height: 400, x: 0, y: 0 } as DOMRect);
    zoom.endDrag();

    zoom.tick();
    expect(zoom.zoomLevel).toBe(1);
  });

  it("a tap that never moves the view leaves the cycle running", () => {
    const zoom = new ZoomController(
      () => {},
      () => {}
    );
    zoom.configure(1, true, 4, false);
    zoom.ensureInitialized();

    zoom.startDrag(200, 200); // pointerdown fires on any tap, planet clicks included
    zoom.endDrag();

    zoom.tick();
    expect(zoom.zoomLevel).toBe(2);
  });

  it("suspendAutoCycle stops the cycle without moving the view", () => {
    const zoom = new ZoomController(
      () => {},
      () => {}
    );
    zoom.configure(1, true, 4, false);
    zoom.ensureInitialized();

    zoom.suspendAutoCycle();
    expect(zoom.zoomLevel).toBe(1);
    zoom.tick();
    expect(zoom.zoomLevel).toBe(1);
  });

  it("resetToDefault restores default_zoom and lets the cycle resume", () => {
    const onChange = vi.fn();
    const zoom = new ZoomController(onChange, () => {});
    zoom.configure(2, true, 4, false);
    zoom.ensureInitialized();

    zoom.zoomIn();
    zoom.zoomIn();
    expect(zoom.zoomLevel).toBe(4);
    onChange.mockClear();

    zoom.resetToDefault();
    expect(zoom.zoomLevel).toBe(2);
    expect(onChange).toHaveBeenCalledTimes(1);

    zoom.tick();
    expect(zoom.zoomLevel).toBe(3); // cycle running again
  });

  it("resetToDefault clears the flag even when zoom is already at the default", () => {
    const onChange = vi.fn();
    const zoom = new ZoomController(onChange, () => {});
    zoom.configure(1, true, 4, false);
    zoom.ensureInitialized();

    zoom.startDrag(200, 200);
    zoom.updateDrag(250, 200, { width: 400, height: 400, x: 0, y: 0 } as DOMRect);
    zoom.endDrag();
    onChange.mockClear();

    zoom.resetToDefault();
    expect(onChange).not.toHaveBeenCalled(); // nothing to move, so nothing to re-render
    zoom.tick();
    expect(zoom.zoomLevel).toBe(2);
  });

  it("resetToDefault is safe before the view initializes", () => {
    const onChange = vi.fn();
    const zoom = new ZoomController(onChange, () => {});
    zoom.configure(2, true, 4, false);
    expect(() => zoom.resetToDefault()).not.toThrow();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("ZoomController.isDefaultView", () => {
  it("is true before the view initializes and after a manual zoom is undone", () => {
    const zoom = new ZoomController(
      () => {},
      () => {}
    );
    zoom.configure(2, false, 4, false);
    expect(zoom.isDefaultView).toBe(true); // nothing has moved yet

    zoom.ensureInitialized();
    expect(zoom.isDefaultView).toBe(true);

    zoom.zoomIn();
    expect(zoom.isDefaultView).toBe(false);

    zoom.resetToDefault();
    expect(zoom.isDefaultView).toBe(true);
  });

  it("panning makes the view non-default until recenter", () => {
    const zoom = new ZoomController(
      () => {},
      () => {}
    );
    zoom.configure(1, false, 4, false);
    zoom.ensureInitialized();

    zoom.startDrag(200, 200);
    zoom.updateDrag(250, 180, { width: 400, height: 400, x: 0, y: 0 } as DOMRect);
    zoom.endDrag();
    expect(zoom.isDefaultView).toBe(false);

    zoom.recenter();
    expect(zoom.isDefaultView).toBe(true);
  });

  it("ending a real drag re-renders once so the nav bar can repaint", () => {
    const onChange = vi.fn();
    const zoom = new ZoomController(onChange, () => {});
    zoom.ensureInitialized();

    zoom.startDrag(200, 200);
    zoom.updateDrag(250, 200, { width: 400, height: 400, x: 0, y: 0 } as DOMRect);
    expect(onChange).not.toHaveBeenCalled(); // per-frame updates stay on the cheap path
    zoom.endDrag();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("ending a drag that never started does not re-render", () => {
    const onChange = vi.fn();
    const zoom = new ZoomController(onChange, () => {});
    zoom.ensureInitialized();
    zoom.endDrag();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("ZoomController.isDefaultView with the auto-cycle running", () => {
  it("stays true while the periodic cycle moves the zoom on its own", () => {
    const zoom = new ZoomController(
      () => {},
      () => {}
    );
    zoom.configure(1, true, 4, false);
    zoom.ensureInitialized();

    zoom.tick();
    expect(zoom.zoomLevel).toBe(2); // the cycle moved the camera
    expect(zoom.isDefaultView).toBe(true); // ...but the user did not
  });

  it("still goes false once the user takes over, cycle or no cycle", () => {
    const zoom = new ZoomController(
      () => {},
      () => {}
    );
    zoom.configure(1, true, 4, false);
    zoom.ensureInitialized();

    zoom.zoomIn();
    expect(zoom.isDefaultView).toBe(false);
  });

  it("goes false when a suspended cycle leaves the zoom off default", () => {
    const zoom = new ZoomController(
      () => {},
      () => {}
    );
    zoom.configure(1, true, 4, false);
    zoom.ensureInitialized();

    zoom.tick();
    zoom.suspendAutoCycle(); // date navigation
    expect(zoom.isDefaultView).toBe(false);
  });
});

// The geometry that used to live in ViewState's own suite. Kept because mutation testing
// showed the controller's behavioural tests don't pin it: dropping the half-width offset from
// viewBox, removing the level clamp, and making the drag scale independent of zoom all left
// the suite green. Coverage stayed at 100% throughout — these assert the arithmetic itself.
describe("ZoomController view geometry", () => {
  function initialized() {
    const zoom = new ZoomController(
      () => {},
      () => {}
    );
    zoom.ensureInitialized();
    return zoom;
  }

  describe("viewBox", () => {
    it("centres the box on the pan centre rather than starting at it", () => {
      // Level 1 is 800 wide on an 800 view, centred at (400, 400).
      expect(initialized().viewBox).toBe("0 0 800 800");
    });

    it("shrinks around the same centre as the zoom level climbs", () => {
      const zoom = initialized();
      zoom.zoomIn(); // level 2 -> 640 wide
      expect(zoom.viewBox).toBe("80 80 640 640");
    });

    it("follows the pan centre after a drag", () => {
      const zoom = initialized();
      zoom.startDrag(0, 0);
      zoom.updateDrag(-100, -50, { width: 800 } as DOMRect);
      // scale is 1 at level 1 on an 800px element, so the centre moves by the raw delta.
      expect(zoom.viewBox).toBe("100 50 800 800");
    });
  });

  describe("zoom ladder", () => {
    it("clamps at the top rung instead of running past it", () => {
      const zoom = initialized();
      for (let i = 0; i < 6; i++) zoom.zoomIn();
      expect(zoom.zoomLevel).toBe(4);
      expect(zoom.panZoomState?.width).toBe(320);
    });

    it("clamps at the bottom rung instead of running past it", () => {
      const zoom = initialized();
      for (let i = 0; i < 6; i++) zoom.zoomOut();
      expect(zoom.zoomLevel).toBe(1);
      expect(zoom.panZoomState?.width).toBe(800);
    });

    // zoomIn/zoomOut guard their own ends, so the clamp inside the level setter is only
    // reachable through configure() — a default_zoom off the ladder. card-config.ts range-checks
    // that too, making this the second of two gates rather than the only one.
    it("pulls a configured level off the ladder back onto it", () => {
      const zoom = initialized();
      zoom.configure(9 as never, false, 4, false);
      expect(zoom.zoomLevel).toBe(4);
      zoom.configure(-3 as never, false, 4, false);
      expect(zoom.zoomLevel).toBe(1);
    });

    it("returns to the same width after zooming in and back out", () => {
      const zoom = initialized();
      const before = zoom.panZoomState?.width;
      zoom.zoomIn();
      zoom.zoomOut();
      expect(zoom.panZoomState?.width).toBe(before);
    });
  });

  describe("drag", () => {
    // The pointer moves in screen pixels; the pan moves in view units. Zoomed in, the view is
    // showing less, so the same finger travel has to move the scene less — scale is the
    // viewBox width over the element's own width, not a constant.
    it("scales pointer travel by how much of the view is on screen", () => {
      const wide = initialized();
      wide.startDrag(0, 0);
      wide.updateDrag(-80, 0, { width: 800 } as DOMRect);
      const atLevel1 = wide.panZoomState?.centerX as number;

      const tight = initialized();
      tight.zoomIn(); // 640 wide in the same 800px element
      tight.startDrag(0, 0);
      tight.updateDrag(-80, 0, { width: 800 } as DOMRect);
      const atLevel2 = tight.panZoomState?.centerX as number;

      expect(atLevel1 - 400).toBeCloseTo(80, 6);
      expect(atLevel2 - 400).toBeCloseTo(80 * (640 / 800), 6);
    });

    it("ignores pointer movement that never started a drag", () => {
      const zoom = initialized();
      zoom.updateDrag(-100, -100, { width: 800 } as DOMRect);
      expect(zoom.panZoomState).toEqual({ centerX: 400, centerY: 400, width: 800 });
    });

    it("stops panning once the drag ends", () => {
      const zoom = initialized();
      zoom.startDrag(0, 0);
      zoom.updateDrag(-40, 0, { width: 800 } as DOMRect);
      zoom.endDrag();
      zoom.updateDrag(-400, 0, { width: 800 } as DOMRect);
      expect(zoom.panZoomState?.centerX).toBe(440);
    });
  });

  describe("panZoomState", () => {
    it("hands out a snapshot the caller cannot pan the view with", () => {
      const zoom = initialized();
      const snapshot = zoom.panZoomState as { centerX: number };
      snapshot.centerX = 999;
      expect(zoom.panZoomState?.centerX).toBe(400);
    });
  });
});
