import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZoomAnimator } from "../../src/card/zoom-animator.js";

// The animator is a tween over one number now: no view state, no zoom levels, nothing to set
// up but a pair of spies. Everything below drives it with the two widths ZOOM_LEVELS actually
// uses either side of a single rung (800 -> 640) so the numbers stay recognisable.
describe("ZoomAnimator", () => {
  let rafCallbacks: { id: number; cb: (ts: number) => void }[];
  let rafId: number;

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

  it("is not animating until asked", () => {
    expect(new ZoomAnimator().isAnimating).toBe(false);
  });

  it("animateTo starts animating", () => {
    const animator = new ZoomAnimator();
    animator.animateTo(800, 640, () => {});
    expect(animator.isAnimating).toBe(true);
  });

  it("reports a width on every frame", () => {
    const animator = new ZoomAnimator();
    const onStep = vi.fn();
    animator.animateTo(800, 640, onStep);

    flushFrame(0);
    expect(onStep).toHaveBeenCalled();
  });

  it("eases between the two widths rather than jumping", () => {
    const animator = new ZoomAnimator();
    const widths: number[] = [];
    animator.animateTo(800, 640, (w) => widths.push(w));

    flushFrame(0);
    flushFrame(1000); // halfway through the 2000ms duration
    const mid = widths.at(-1);
    expect(mid).toBeGreaterThan(640);
    expect(mid).toBeLessThan(800);
  });

  it("lands exactly on the target and stops", () => {
    const animator = new ZoomAnimator();
    const widths: number[] = [];
    const onComplete = vi.fn();
    animator.animateTo(800, 640, (w) => widths.push(w), onComplete);

    flushFrame(0);
    flushFrame(2000);

    expect(widths.at(-1)).toBe(640);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(animator.isAnimating).toBe(false);
  });

  it("runs onComplete after the final step, not before it", () => {
    const animator = new ZoomAnimator();
    const order: string[] = [];
    animator.animateTo(
      800,
      640,
      () => order.push("step"),
      () => order.push("complete")
    );

    flushFrame(0);
    flushFrame(2000);
    expect(order.at(-2)).toBe("step");
    expect(order.at(-1)).toBe("complete");
  });

  it("cancel stops it and drops the pending frame", () => {
    const animator = new ZoomAnimator();
    animator.animateTo(800, 640, () => {});
    expect(animator.isAnimating).toBe(true);

    animator.cancel();
    expect(animator.isAnimating).toBe(false);
    expect(rafCallbacks).toHaveLength(0);
  });

  // A second zoom part-way through the first has to pick up from where the view actually is,
  // not from the rung it was heading for — otherwise the scene jumps backwards before easing on.
  it("a new animateTo interrupts the old one and never fires its completion", () => {
    const animator = new ZoomAnimator();
    const widths: number[] = [];
    const firstComplete = vi.fn();
    animator.animateTo(800, 640, (w) => widths.push(w), firstComplete);

    flushFrame(0);
    flushFrame(1000);
    const interruptedAt = widths.at(-1) as number;

    animator.animateTo(interruptedAt, 480, (w) => widths.push(w));
    flushFrame(2000);
    flushFrame(3000);

    const resumed = widths.at(-1) as number;
    expect(resumed).toBeLessThan(interruptedAt);
    expect(resumed).toBeGreaterThan(480);
    expect(firstComplete).not.toHaveBeenCalled();
  });

  it("completes with no onComplete supplied", () => {
    const animator = new ZoomAnimator();
    animator.animateTo(800, 640, () => {});
    flushFrame(0);
    flushFrame(2000);
    expect(animator.isAnimating).toBe(false);
  });
});
