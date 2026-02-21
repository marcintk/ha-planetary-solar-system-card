import { describe, it, expect } from "vitest";
import { renderSolarSystem, calculateObserverAngle } from "../src/renderer.js";
import { PLANETS, calculatePlanetPosition } from "../src/planet-data.js";

function renderInto(container, date) {
  const { svg, bounds } = renderSolarSystem(date);
  container.appendChild(svg);
  return { svg, bounds };
}

describe("renderSolarSystem", () => {
  it("creates an SVG element inside the container", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg.getAttribute("viewBox")).toBe("0 0 800 800");
  });

  it("renders 8 orbit circles", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    // Orbits are circles with stroke and no fill
    const orbitCircles = svg.querySelectorAll('circle[fill="none"]');
    expect(orbitCircles.length).toBe(8);
  });

  it("renders Sun at center", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    // Sun is yellow/gold circle at center
    const sunCircle = svg.querySelector('circle[fill="#ffd700"]');
    expect(sunCircle).not.toBeNull();
    expect(sunCircle.getAttribute("cx")).toBe("400");
    expect(sunCircle.getAttribute("cy")).toBe("400");
  });

  it("renders planet labels", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    const texts = Array.from(svg.querySelectorAll("text")).map(
      (t) => t.textContent
    );
    expect(texts).toContain("Earth");
    expect(texts).toContain("Mars");
    expect(texts).toContain("Neptune");
    expect(texts).toContain("Moon");
  });

  it("renders AU distance labels", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    const texts = Array.from(svg.querySelectorAll("text")).map(
      (t) => t.textContent
    );
    expect(texts).toContain("1 AU");
    expect(texts).toContain("5.2 AU");
  });

  it("returns svg element without appending to container", () => {
    const { svg } = renderSolarSystem(new Date("2026-02-14"));
    expect(svg).not.toBeNull();
    expect(svg.tagName).toBe("svg");
  });

  it("renders day/night split with polygon clip path", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    const clipPath = svg.querySelector("clipPath#day-clip");
    expect(clipPath).not.toBeNull();
    const polygon = clipPath.querySelector("polygon");
    expect(polygon).not.toBeNull();
    expect(clipPath.querySelector("rect")).toBeNull();
  });

  it("day overlay covers Sun-facing hemisphere", () => {
    const container = document.createElement("div");
    const date = new Date("2026-02-14");
    renderInto(container, date);

    const svg = container.querySelector("svg");
    const polygon = svg.querySelector("clipPath#day-clip polygon");
    const points = polygon.getAttribute("points");
    expect(points).toBeTruthy();

    // Parse polygon points and verify they form a valid polygon
    const coords = points.split(" ").map((p) => {
      const [x, y] = p.split(",").map(Number);
      return { x, y };
    });
    expect(coords.length).toBe(4);
  });

  it("day overlay position changes with different dates", () => {
    const c1 = document.createElement("div");
    const c2 = document.createElement("div");
    renderInto(c1, new Date("2024-01-01"));
    renderInto(c2, new Date("2024-07-01"));

    const polygon1 = c1.querySelector("clipPath#day-clip polygon");
    const polygon2 = c2.querySelector("clipPath#day-clip polygon");
    expect(polygon1.getAttribute("points")).not.toBe(
      polygon2.getAttribute("points")
    );
  });

  it("day overlay covers observer's visible sky based on local time", () => {
    const earth = PLANETS.find((p) => p.name === "Earth");

    // Use noon — observer faces toward the Sun
    const container = document.createElement("div");
    const date = new Date("2026-02-14T12:00:00");
    renderInto(container, date);

    const earthAngle = calculatePlanetPosition(earth, date);
    const observerAngle = calculateObserverAngle(earthAngle, date);
    const polygon = container.querySelector("clipPath#day-clip polygon");
    const points = polygon.getAttribute("points");
    const coords = points.split(" ").map((p) => {
      const [x, y] = p.split(",").map(Number);
      return { x, y };
    });

    // Centroid of the polygon should be in the observer's viewing direction
    const centroidX = coords.reduce((s, c) => s + c.x, 0) / coords.length;
    const centroidY = coords.reduce((s, c) => s + c.y, 0) / coords.length;

    // Observer direction from Earth's position
    const obsDirX = Math.cos(observerAngle);
    const obsDirY = -Math.sin(observerAngle);

    // Centroid offset from center should be in the observer's direction
    const offsetX = centroidX - 400;
    const offsetY = centroidY - 400;
    const dot = offsetX * obsDirX + offsetY * obsDirY;
    expect(dot).toBeGreaterThan(0);
  });

  it("renders Saturn with ring ellipse", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    // Saturn's ring is a stroke-only ellipse near Saturn's body
    const ellipses = svg.querySelectorAll("ellipse");
    expect(ellipses.length).toBe(1);

    const ring = ellipses[0];
    expect(ring.getAttribute("fill")).toBe("none");
    expect(ring.getAttribute("stroke")).toBe("rgba(224, 192, 128, 0.6)"); // Saturn #e0c080 with alpha
    expect(ring.getAttribute("stroke-width")).toBe("6");
    expect(ring.getAttribute("rx")).toBe("28"); // 20 * 1.4
    expect(ring.getAttribute("ry")).toBe("10"); // 20 * 0.5
  });

  it("Saturn ring is centered on Saturn body", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    // TODO(human): Write the assertion that verifies the ring ellipse
    // is centered at the same position as Saturn's body circle.
    // Hint: Saturn's color is "#e0c080" — find its circle, then compare
    // cx/cy with the ellipse's cx/cy.
  });

  it("no other planets have ring elements", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    // Only one ellipse should exist (Saturn's ring)
    const ellipses = svg.querySelectorAll("ellipse");
    expect(ellipses.length).toBe(1);
  });

  it("renders different planet positions for different dates", () => {
    const c1 = document.createElement("div");
    const c2 = document.createElement("div");
    renderInto(c1, new Date("2024-01-01"));
    renderInto(c2, new Date("2024-07-01"));

    // Earth circle (blue) should be at different positions
    const earth1 = c1.querySelector('svg circle[fill="#4a90d9"]');
    const earth2 = c2.querySelector('svg circle[fill="#4a90d9"]');
    expect(earth1.getAttribute("cx")).not.toBe(earth2.getAttribute("cx"));
  });

  it("renders observer needle on Earth", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14T15:00:00"));

    const svg = container.querySelector("svg");
    const needle = svg.querySelector('line[stroke="rgba(255, 255, 255, 0.7)"]');
    expect(needle).not.toBeNull();
    expect(needle.getAttribute("stroke-width")).toBe("2");
  });

  it("observer needle points in observer angle direction", () => {
    const earth = PLANETS.find((p) => p.name === "Earth");
    const date = new Date("2026-02-14T06:00:00");
    const container = document.createElement("div");
    renderInto(container, date);

    const svg = container.querySelector("svg");
    const needle = svg.querySelector('line[stroke="rgba(255, 255, 255, 0.7)"]');
    const x1 = Number(needle.getAttribute("x1"));
    const y1 = Number(needle.getAttribute("y1"));
    const x2 = Number(needle.getAttribute("x2"));
    const y2 = Number(needle.getAttribute("y2"));

    // The needle direction should match the observer angle (toward visible sky)
    const earthAngle = calculatePlanetPosition(earth, date);
    const observerAngle = calculateObserverAngle(earthAngle, date);
    const expectedAngle = observerAngle;

    const dx = x2 - x1;
    const dy = -(y2 - y1); // SVG y is flipped
    const actualAngle = Math.atan2(dy, dx);

    // Normalize both angles to [0, 2pi)
    const norm = (a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const diff = Math.abs(norm(actualAngle) - norm(expectedAngle));
    const angleDiff = Math.min(diff, 2 * Math.PI - diff);
    expect(angleDiff).toBeLessThan(0.01);
  });

  it("observer needle has a tip dot", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14T12:00:00"));

    const svg = container.querySelector("svg");
    // Find the small dot at the needle tip (r=2, needle color)
    const dots = svg.querySelectorAll('circle[fill="rgba(255, 255, 255, 0.7)"]');
    expect(dots.length).toBe(1);
    expect(dots[0].getAttribute("r")).toBe("2");
  });
});

describe("season overlay", () => {
  it("renders two season dividing lines through the center", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    const seasonLines = svg.querySelectorAll('line[stroke="rgba(255, 255, 255, 0.25)"]');
    expect(seasonLines.length).toBe(2);

    // One horizontal, one vertical
    const horizontal = Array.from(seasonLines).find((l) => l.getAttribute("y1") === "400" && l.getAttribute("y2") === "400");
    const vertical = Array.from(seasonLines).find((l) => l.getAttribute("x1") === "400" && l.getAttribute("x2") === "400");
    expect(horizontal).not.toBeNull();
    expect(vertical).not.toBeNull();
  });

  it("renders four season labels", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    const textPaths = svg.querySelectorAll("textPath");
    expect(textPaths.length).toBe(4);

    const labels = Array.from(textPaths).map((tp) => tp.textContent);
    expect(labels).toContain("Spring");
    expect(labels).toContain("Summer");
    expect(labels).toContain("Autumn");
    expect(labels).toContain("Winter");
  });

  it("uses Northern Hemisphere mapping by default", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    const textPaths = svg.querySelectorAll("textPath");
    const labels = Array.from(textPaths).map((tp) => tp.textContent);
    // Default (north): Winter, Autumn, Summer, Spring order
    expect(labels).toEqual(["Winter", "Autumn", "Summer", "Spring"]);
  });

  it("swaps seasons for Southern Hemisphere", () => {
    const container = document.createElement("div");
    const { svg } = renderSolarSystem(new Date("2026-02-14"), "south");
    container.appendChild(svg);

    const textPaths = svg.querySelectorAll("textPath");
    const labels = Array.from(textPaths).map((tp) => tp.textContent);
    // South: Summer, Spring, Winter, Autumn order
    expect(labels).toEqual(["Summer", "Spring", "Winter", "Autumn"]);
  });

  it("season dividing lines are rendered before orbits (behind them)", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    const allElements = Array.from(svg.children);
    const seasonLine = allElements.find(
      (el) => el.tagName === "line" && el.getAttribute("stroke") === "rgba(255, 255, 255, 0.25)"
    );
    const firstOrbit = allElements.find(
      (el) => el.tagName === "circle" && el.getAttribute("fill") === "none" && el.getAttribute("stroke-dasharray") === "5, 5"
    );
    const seasonIdx = allElements.indexOf(seasonLine);
    const orbitIdx = allElements.indexOf(firstOrbit);
    expect(seasonIdx).toBeLessThan(orbitIdx);
  });
});

describe("calculateObserverAngle", () => {
  it("at midnight observer faces away from Sun", () => {
    const earthAngle = 1.5; // arbitrary orbital angle
    const date = new Date("2026-02-14T00:00:00");
    const angle = calculateObserverAngle(earthAngle, date);

    // At midnight: observerAngle = earthAngle (away from Sun)
    const expected = earthAngle;
    const norm = (a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const diff = Math.abs(norm(angle) - norm(expected));
    const angleDiff = Math.min(diff, 2 * Math.PI - diff);
    expect(angleDiff).toBeLessThan(0.001);
  });

  it("at noon observer faces toward Sun", () => {
    const earthAngle = 1.5;
    const date = new Date("2026-02-14T12:00:00");
    const angle = calculateObserverAngle(earthAngle, date);

    // At noon: observerAngle = earthAngle + PI (toward Sun)
    const expected = earthAngle + Math.PI;
    const norm = (a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const diff = Math.abs(norm(angle) - norm(expected));
    const angleDiff = Math.min(diff, 2 * Math.PI - diff);
    expect(angleDiff).toBeLessThan(0.001);
  });

  it("at 6AM observer is 90 degrees from midnight", () => {
    const earthAngle = 1.5;
    const date = new Date("2026-02-14T06:00:00");
    const angle = calculateObserverAngle(earthAngle, date);

    // At 6AM: 6/24 * 2PI = PI/2 offset from midnight
    const midnightAngle = earthAngle;
    const expected = midnightAngle + Math.PI / 2;
    const norm = (a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const diff = Math.abs(norm(angle) - norm(expected));
    const angleDiff = Math.min(diff, 2 * Math.PI - diff);
    expect(angleDiff).toBeLessThan(0.001);
  });

  it("midnight and noon overlays are ~180 degrees apart", () => {
    const c1 = document.createElement("div");
    const c2 = document.createElement("div");
    renderInto(c1, new Date("2026-02-14T00:00:00"));
    renderInto(c2, new Date("2026-02-14T12:00:00"));

    const poly1 = c1.querySelector("clipPath#day-clip polygon");
    const poly2 = c2.querySelector("clipPath#day-clip polygon");
    const pts1 = poly1.getAttribute("points");
    const pts2 = poly2.getAttribute("points");

    // Overlays at midnight vs noon should be different (rotated ~180°)
    expect(pts1).not.toBe(pts2);

    // Compute centroids and verify they're on opposite sides
    const parsePts = (pts) =>
      pts.split(" ").map((p) => {
        const [x, y] = p.split(",").map(Number);
        return { x, y };
      });
    const centroid = (coords) => ({
      x: coords.reduce((s, c) => s + c.x, 0) / coords.length,
      y: coords.reduce((s, c) => s + c.y, 0) / coords.length,
    });

    const c1c = centroid(parsePts(pts1));
    const c2c = centroid(parsePts(pts2));

    // Vectors from center (400,400) to each centroid should point in roughly opposite directions
    const v1x = c1c.x - 400;
    const v1y = c1c.y - 400;
    const v2x = c2c.x - 400;
    const v2y = c2c.y - 400;
    const dot = v1x * v2x + v1y * v2y;
    // Dot product of opposite vectors should be negative
    expect(dot).toBeLessThan(0);
  });
});
