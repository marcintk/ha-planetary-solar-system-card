import { describe, expect, it } from "vitest";
import { renderSolarSystem } from "../../src/renderer/index.js";
import { renderDynamicLabels } from "../../src/renderer/labels.js";

function textAt(svg, index = 0) {
  return svg.querySelectorAll("text")[index];
}

function labelPosition(svg, name) {
  const label = Array.from(svg.querySelectorAll("text")).find((t) => t.textContent === name);
  return { x: Number(label.getAttribute("x")), y: Number(label.getAttribute("y")) };
}

describe("renderDynamicLabels", () => {
  it("places the label above the body when nothing else is nearby", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const targets = [{ name: "Mercury", x: 100, y: 100, radius: 6 }];

    renderDynamicLabels(svg, targets, [], "#fff");

    const label = textAt(svg);
    expect(Number(label.getAttribute("x"))).toBeCloseTo(100, 5);
    expect(Number(label.getAttribute("y"))).toBeCloseTo(100 - 6 - 3, 5);
  });

  it("places the label above the body when the nearest neighbor is below", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const targets = [{ name: "Jupiter", x: 200, y: 200, radius: 21 }];
    const obstacles = [{ name: "Saturn", x: 200, y: 240, color: "#fff" }]; // below

    renderDynamicLabels(svg, targets, obstacles, "#fff");

    const label = textAt(svg);
    expect(Number(label.getAttribute("y"))).toBeCloseTo(200 - 21 - 3, 5);
  });

  it("flips the label below the body when the nearest neighbor is close and above", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const targets = [{ name: "Jupiter", x: 200, y: 200, radius: 21 }];
    const obstacles = [{ name: "Saturn", x: 200, y: 160, color: "#fff" }]; // above, close

    renderDynamicLabels(svg, targets, obstacles, "#fff");

    const label = textAt(svg);
    expect(Number(label.getAttribute("x"))).toBeCloseTo(200, 5);
    expect(Number(label.getAttribute("y"))).toBeCloseTo(200 + 21 + 3 + 8, 5);
  });

  it("ignores a far-away body above and keeps the default above placement", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const targets = [{ name: "Neptune", x: 400, y: 400, radius: 13 }];
    const obstacles = [{ name: "Uranus", x: 400, y: 100, color: "#fff" }]; // far above

    renderDynamicLabels(svg, targets, obstacles, "#fff");

    const label = textAt(svg);
    expect(Number(label.getAttribute("x"))).toBeCloseTo(400, 5);
    expect(Number(label.getAttribute("y"))).toBeCloseTo(400 - 13 - 3, 5);
  });

  it("skips an obstacle that shares the target's own name", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const targets = [{ name: "Mars", x: 50, y: 50, radius: 7 }];
    const obstacles = [{ name: "Mars", x: 50, y: 20, color: "#fff" }];

    renderDynamicLabels(svg, targets, obstacles, "#fff");

    const label = textAt(svg);
    expect(Number(label.getAttribute("y"))).toBeCloseTo(50 - 7 - 3, 5);
  });
});

describe("Moon/Earth/Venus labels stay apart when close together", () => {
  it("keeps all three label positions pairwise separated near conjunction", () => {
    // 2023-08-16: Moon sits only MOON_PIXEL_OFFSET (22px) from Earth, and
    // Venus is Earth's nearest planetary neighbor - the tightest cluster
    // of labels the renderer produces (#62 follow-up).
    const { svg } = renderSolarSystem(new Date("2023-08-16T00:00:00Z"));

    const moon = labelPosition(svg, "Moon");
    const earth = labelPosition(svg, "Earth");
    const venus = labelPosition(svg, "Venus");
    const MIN_LABEL_SEPARATION = 10;

    expect(Math.hypot(moon.x - earth.x, moon.y - earth.y)).toBeGreaterThan(MIN_LABEL_SEPARATION);
    expect(Math.hypot(moon.x - venus.x, moon.y - venus.y)).toBeGreaterThan(MIN_LABEL_SEPARATION);
    expect(Math.hypot(earth.x - venus.x, earth.y - venus.y)).toBeGreaterThan(MIN_LABEL_SEPARATION);
  });
});
