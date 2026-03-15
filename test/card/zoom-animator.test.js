import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ViewState } from "../../src/card/card-view-state.js";
import { ZoomAnimator } from "../../src/card/zoom-animator.js";

describe("ZoomAnimator", () => {
  let rafCallbacks;
  let rafId;

  beforeEach(() => {
    rafCallbacks = [];
    rafId = 0;
    vi.stubGlobal("requestAnimationFrame", (cb) => {
      const id = ++rafId;
      rafCallbacks.push({ id, cb });
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id) => {
      rafCallbacks = rafCallbacks.filter((r) => r.id !== id);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function flushFrame(timestamp) {
    const pending = [...rafCallbacks];
    rafCallbacks = [];
    for (const r of pending) r.cb(timestamp);
  }

  // Helper: simulates what the card does — snapshot width, change zoom, animate from old width
  function simulateZoomTo(vs, animator, targetLevel) {
    const prevWidth = vs.width;
    const prevHeight = vs.height;
    vs.setZoomLevel(targetLevel);
    animator.animateTo(targetLevel, prevWidth, prevHeight);
  }

  it("isAnimating is false initially", () => {
    const vs = new ViewState(1);
    const animator = new ZoomAnimator(vs, () => {});
    expect(animator.isAnimating).toBe(false);
  });

  it("animateTo starts animation", () => {
    const vs = new ViewState(1);
    const animator = new ZoomAnimator(vs, () => {});
    simulateZoomTo(vs, animator, 2);
    expect(animator.isAnimating).toBe(true);
  });

  it("animation calls onFrame on each step", () => {
    const vs = new ViewState(1);
    const onFrame = vi.fn();
    const animator = new ZoomAnimator(vs, onFrame);
    simulateZoomTo(vs, animator, 2);

    flushFrame(0);
    expect(onFrame).toHaveBeenCalled();
  });

  it("animation interpolates width between start and target", () => {
    const vs = new ViewState(1); // width=800
    const animator = new ZoomAnimator(vs, () => {});
    simulateZoomTo(vs, animator, 2); // from 800 to 640

    // First frame at t=0
    flushFrame(0);
    // Mid-animation frame at t=1000 (halfway through 2000ms)
    flushFrame(1000);
    const midWidth = vs.width;
    expect(midWidth).toBeGreaterThan(640);
    expect(midWidth).toBeLessThan(800);
  });

  it("animation completes after 2000ms and snaps to target", () => {
    const vs = new ViewState(1); // width=800
    const animator = new ZoomAnimator(vs, () => {});
    simulateZoomTo(vs, animator, 2); // from 800 to 640

    flushFrame(0);
    flushFrame(2000);

    expect(vs.width).toBe(640);
    expect(vs.height).toBe(640);
    expect(vs.zoomLevel).toBe(2);
    expect(animator.isAnimating).toBe(false);
  });

  it("cancel stops animation", () => {
    const vs = new ViewState(1);
    const animator = new ZoomAnimator(vs, () => {});
    simulateZoomTo(vs, animator, 2);
    expect(animator.isAnimating).toBe(true);

    animator.cancel();
    expect(animator.isAnimating).toBe(false);
    expect(rafCallbacks).toHaveLength(0);
  });

  it("new animateTo interrupts and starts from current position", () => {
    const vs = new ViewState(1); // width=800
    const animator = new ZoomAnimator(vs, () => {});
    simulateZoomTo(vs, animator, 2); // from 800 to 640

    // Advance to midpoint
    flushFrame(0);
    flushFrame(1000);
    const midWidth = vs.width;
    expect(midWidth).toBeGreaterThan(640);
    expect(midWidth).toBeLessThan(800);

    // Now interrupt: animate from current midWidth to level 3 (480)
    const curWidth = vs.width;
    const curHeight = vs.height;
    vs.setZoomLevel(3);
    animator.animateTo(3, curWidth, curHeight);

    // First frame of new animation
    flushFrame(2000);
    flushFrame(3000);
    const newMidWidth = vs.width;
    // Should be between midWidth and 480
    expect(newMidWidth).toBeLessThan(midWidth);
    expect(newMidWidth).toBeGreaterThan(480);
  });

  it("animation preserves centerX and centerY", () => {
    const vs = new ViewState(1);
    vs.centerX = 500;
    vs.centerY = 300;
    const animator = new ZoomAnimator(vs, () => {});
    simulateZoomTo(vs, animator, 3);

    flushFrame(0);
    flushFrame(1000);

    expect(vs.centerX).toBe(500);
    expect(vs.centerY).toBe(300);
  });
});
