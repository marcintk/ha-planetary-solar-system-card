import { describe, expect, it } from "vitest";
import { renderSolarSystem } from "../../src/renderer/index.js";
import { renderOffscreenMarkers } from "../../src/renderer/offscreen-markers.js";

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
    expect(positions).toHaveLength(9);
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
});
