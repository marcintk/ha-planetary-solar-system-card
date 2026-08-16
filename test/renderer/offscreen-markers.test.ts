import { describe, expect, it } from "vitest";
import { renderSolarSystem } from "../../src/renderer/index.js";
import { MARKER_GROUP_ID, renderOffscreenMarkers } from "../../src/renderer/offscreen-markers.js";

// Minimal viewState mock
function makeViewState(zoomLevel, centerX = 400, centerY = 400, size = null) {
  const sizes = { 1: 800, 2: 640, 3: 480, 4: 320 };
  const s = size ?? sizes[zoomLevel];
  return { centerX, centerY, width: s, height: s, zoomLevel };
}

describe("renderSolarSystem positions", () => {
  it("returns a positions array with 9 entries each having name, x, y, and color", () => {
    const date = new Date("2025-06-15");
    const { positions } = renderSolarSystem(date);
    // 8 planets + Moon + comets (currently 1 = Halley)
    expect(positions).toHaveLength(10);
    for (const p of positions) {
      expect(p).toHaveProperty("name");
      expect(p).toHaveProperty("x");
      expect(p).toHaveProperty("y");
      expect(p).toHaveProperty("color");
      expect(typeof p.name).toBe("string");
      expect(typeof p.x).toBe("number");
      expect(typeof p.y).toBe("number");
      expect(typeof p.color).toBe("string");
    }
  });
});

describe("renderOffscreenMarkers", () => {
  it("returns empty group at zoom level 1 with default pan", () => {
    const date = new Date("2025-06-15");
    const { positions } = renderSolarSystem(date);
    const vs = makeViewState(1);
    const group = renderOffscreenMarkers(positions, vs);
    expect(group.tagName).toBe("g");
    expect(group.children.length).toBe(0);
  });

  it("returns markers for outer planets at zoom level 4", () => {
    const date = new Date("2025-06-15");
    const { positions } = renderSolarSystem(date);
    const vs = makeViewState(4);
    const group = renderOffscreenMarkers(positions, vs);
    // At zoom 4 (320x320 centered on 400,400), outer planets should be off-screen
    expect(group.children.length).toBeGreaterThan(0);
    // Each marker has a polygon + text pair
    const polygons = group.querySelectorAll("polygon");
    const texts = group.querySelectorAll("text");
    expect(polygons.length).toBeGreaterThan(0);
    expect(texts.length).toBe(polygons.length);
  });

  it("marker triangle uses the planet color", () => {
    const positions = [{ name: "TestPlanet", x: 0, y: 0, color: "#ff0000" }];
    const vs = makeViewState(4);
    const group = renderOffscreenMarkers(positions, vs);
    const polygon = group.querySelector("polygon");
    expect(polygon).not.toBeNull();
    expect(polygon.getAttribute("fill")).toBe("#ff0000");
  });

  it("no marker for a planet inside the viewport", () => {
    const positions = [{ name: "Center", x: 400, y: 400, color: "#00ff00" }];
    const vs = makeViewState(1);
    const group = renderOffscreenMarkers(positions, vs);
    expect(group.children.length).toBe(0);
  });

  it("no marker for Moon when offscreen is false", () => {
    const positions = [{ name: "Moon", x: 0, y: 0, color: "#cccccc", offscreen: false }];
    const vs = makeViewState(4);
    const group = renderOffscreenMarkers(positions, vs);
    expect(group.children.length).toBe(0);
  });

  it("places marker when edge intersection falls back to center (degenerate viewport)", () => {
    // A 1×1 viewport means the inset box (margin=10) degenerates, causing
    // edgeIntersection to return the fallback { x: cx, y: cy } (POSITIVE_INFINITY path).
    const vs = makeViewState(1, 400, 400, 1); // 1×1 viewport, center at 400,400
    const positions = [{ name: "Far", x: 0, y: 0, color: "#ff0000" }];
    const group = renderOffscreenMarkers(positions, vs);
    // A marker is still created (polygon + text) even via the fallback path
    expect(group.querySelector("polygon")).not.toBeNull();
  });

  it("places marker for a planet directly above center (dx = 0)", () => {
    // x equals centerX → dx=0, exercises the `if (dx !== 0)` false branch
    const vs = makeViewState(4); // center (400,400)
    const positions = [{ name: "Above", x: 400, y: -100, color: "#aaaaaa" }];
    const group = renderOffscreenMarkers(positions, vs);
    expect(group.querySelector("polygon")).not.toBeNull();
  });

  it("label uses end text-anchor for a planet to the right of center", () => {
    // Planet at (900, 400) is to the right of center (400,400), so the label
    // x position > midX → text-anchor should be "end".
    const vs = makeViewState(4); // center=400, viewport 320×320
    const positions = [{ name: "RightPlanet", x: 900, y: 400, color: "#0000ff" }];
    const group = renderOffscreenMarkers(positions, vs);
    const label = group.querySelector("text");
    expect(label).not.toBeNull();
    expect(label.getAttribute("text-anchor")).toBe("end");
  });
});

describe("renderSolarSystem().updateMarkers", () => {
  it("appends a marker group to the returned svg for the given pan/zoom", () => {
    const { svg, updateMarkers } = renderSolarSystem(new Date("2025-06-15"));
    expect(svg.getElementById(MARKER_GROUP_ID)).toBeNull();
    updateMarkers(makeViewState(4));
    expect(svg.getElementById(MARKER_GROUP_ID)).not.toBeNull();
  });

  it("replaces the marker group on each call rather than accumulating", () => {
    const { svg, updateMarkers } = renderSolarSystem(new Date("2025-06-15"));
    updateMarkers(makeViewState(4));
    const first = svg.getElementById(MARKER_GROUP_ID);
    updateMarkers(makeViewState(4));
    const second = svg.getElementById(MARKER_GROUP_ID);
    expect(svg.querySelectorAll(`#${MARKER_GROUP_ID}`).length).toBe(1);
    expect(second).not.toBe(first);
  });

  it("reflects a narrower viewport with more offscreen markers on the next call", () => {
    const { svg, updateMarkers } = renderSolarSystem(new Date("2025-06-15"));
    updateMarkers(makeViewState(1));
    const wideCount = svg.getElementById(MARKER_GROUP_ID).children.length;
    updateMarkers(makeViewState(4));
    const narrowCount = svg.getElementById(MARKER_GROUP_ID).children.length;
    expect(narrowCount).toBeGreaterThan(wideCount);
  });
});
