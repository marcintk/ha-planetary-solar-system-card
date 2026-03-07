import { describe, it, expect } from "vitest";
import {
  ViewState,
  DEFAULT_ZOOM_LEVEL,
  MIN_ZOOM,
  MAX_ZOOM,
  FULL_SYSTEM_SIZE,
} from "../src/view-state.js";

describe("ViewState constructor", () => {
  it("initializes to center of the full system", () => {
    const vs = new ViewState();
    expect(vs.centerX).toBe(FULL_SYSTEM_SIZE / 2);
    expect(vs.centerY).toBe(FULL_SYSTEM_SIZE / 2);
  });

  it("uses DEFAULT_ZOOM_LEVEL by default", () => {
    const vs = new ViewState();
    expect(vs.zoomLevel).toBe(DEFAULT_ZOOM_LEVEL);
  });

  it("accepts a custom default zoom level", () => {
    const vs = new ViewState(3);
    expect(vs.zoomLevel).toBe(3);
    expect(vs.width).toBe(480);
    expect(vs.height).toBe(480);
  });

  it("starts with isDragging false", () => {
    const vs = new ViewState();
    expect(vs.isDragging).toBe(false);
  });
});

describe("ViewState.viewBox", () => {
  it("returns a space-separated string of four numbers", () => {
    const vs = new ViewState();
    const parts = vs.viewBox.split(" ").map(Number);
    expect(parts).toHaveLength(4);
    expect(parts.every(Number.isFinite)).toBe(true);
  });

  it("at default zoom level 1 viewBox width and height are 800", () => {
    const vs = new ViewState(1);
    const parts = vs.viewBox.split(" ").map(Number);
    const [, , w, h] = parts;
    expect(w).toBe(800);
    expect(h).toBe(800);
  });

  it("viewBox is centered on (400, 400) at zoom level 1", () => {
    const vs = new ViewState(1);
    const [minX, minY, w, h] = vs.viewBox.split(" ").map(Number);
    expect(minX).toBe(0);
    expect(minY).toBe(0);
    expect(w).toBe(800);
    expect(h).toBe(800);
  });

  it("viewBox width shrinks when zooming in", () => {
    const vs = new ViewState(1);
    const widthBefore = Number(vs.viewBox.split(" ")[2]);
    vs.zoomIn();
    const widthAfter = Number(vs.viewBox.split(" ")[2]);
    expect(widthAfter).toBeLessThan(widthBefore);
  });
});

describe("ViewState zoom", () => {
  it("zoomIn increments zoom level and reduces viewport size", () => {
    const vs = new ViewState(1);
    const changed = vs.zoomIn();
    expect(changed).toBe(true);
    expect(vs.zoomLevel).toBe(2);
    expect(vs.width).toBe(640);
    expect(vs.height).toBe(640);
  });

  it("zoomOut decrements zoom level and increases viewport size", () => {
    const vs = new ViewState(2);
    const changed = vs.zoomOut();
    expect(changed).toBe(true);
    expect(vs.zoomLevel).toBe(1);
    expect(vs.width).toBe(800);
    expect(vs.height).toBe(800);
  });

  it("zoomIn returns false and does not exceed MAX_ZOOM", () => {
    const vs = new ViewState(MAX_ZOOM);
    const changed = vs.zoomIn();
    expect(changed).toBe(false);
    expect(vs.zoomLevel).toBe(MAX_ZOOM);
  });

  it("zoomOut returns false and does not go below MIN_ZOOM", () => {
    const vs = new ViewState(MIN_ZOOM);
    const changed = vs.zoomOut();
    expect(changed).toBe(false);
    expect(vs.zoomLevel).toBe(MIN_ZOOM);
  });

  it("zoomIn then zoomOut restores original viewport size", () => {
    const vs = new ViewState(2);
    const widthBefore = vs.width;
    vs.zoomIn();
    vs.zoomOut();
    expect(vs.width).toBe(widthBefore);
  });

  it("repeated zoomIn clamps at MAX_ZOOM (level 4, width 320)", () => {
    const vs = new ViewState(1);
    for (let i = 0; i < 20; i++) vs.zoomIn();
    expect(vs.zoomLevel).toBe(MAX_ZOOM);
    expect(vs.width).toBe(320);
  });
});

describe("ViewState pan (drag)", () => {
  it("startDrag sets isDragging to true", () => {
    const vs = new ViewState();
    vs.startDrag(100, 100);
    expect(vs.isDragging).toBe(true);
  });

  it("endDrag sets isDragging to false", () => {
    const vs = new ViewState();
    vs.startDrag(100, 100);
    vs.endDrag();
    expect(vs.isDragging).toBe(false);
  });

  it("updateDrag shifts centerX proportionally to drag distance", () => {
    const vs = new ViewState(1); // width=800
    vs.startDrag(200, 200);
    const rect = { width: 400, height: 400 }; // 800/400 = scale 2
    vs.updateDrag(250, 200, rect); // dragged 50px right → 50*2=100 units left
    expect(vs.centerX).toBeLessThan(400);
  });

  it("updateDrag shifts centerY proportionally to drag distance", () => {
    const vs = new ViewState(1);
    vs.startDrag(200, 200);
    const rect = { width: 400, height: 400 };
    vs.updateDrag(200, 250, rect); // dragged 50px down → 50*2=100 units up
    expect(vs.centerY).toBeLessThan(400);
  });

  it("updateDrag does nothing when not dragging", () => {
    const vs = new ViewState();
    const centerXBefore = vs.centerX;
    const rect = { width: 400, height: 400 };
    vs.updateDrag(300, 300, rect); // not started yet
    expect(vs.centerX).toBe(centerXBefore);
  });

  it("endDrag after updateDrag stops further updates", () => {
    const vs = new ViewState(1);
    vs.startDrag(200, 200);
    vs.endDrag();
    const rect = { width: 400, height: 400 };
    const centerXAfterEnd = vs.centerX;
    vs.updateDrag(300, 200, rect); // drag after end — should be ignored
    expect(vs.centerX).toBe(centerXAfterEnd);
  });
});
