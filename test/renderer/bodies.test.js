import { describe, it, expect } from "vitest";
import { renderOrbit, renderBody, renderSaturnRings, ORBIT_COLOR } from "../../src/renderer/bodies.js";
import { SVG_NS, CENTER } from "../../src/renderer/svg-utils.js";
import { PLANETS } from "../../src/planet-data.js";

function createSvg() {
  return document.createElementNS(SVG_NS, "svg");
}

describe("renderOrbit", () => {
  it("appends a dashed circle at the given radius", () => {
    const svg = createSvg();
    renderOrbit(svg, 200, 1.0);

    const orbit = svg.querySelector('circle[stroke-dasharray="5, 5"]');
    expect(orbit).not.toBeNull();
    expect(orbit.getAttribute("r")).toBe("200");
    expect(orbit.getAttribute("cx")).toBe(String(CENTER));
    expect(orbit.getAttribute("cy")).toBe(String(CENTER));
    expect(orbit.getAttribute("fill")).toBe("none");
  });

  it("uses ORBIT_COLOR for the stroke", () => {
    const svg = createSvg();
    renderOrbit(svg, 200, 1.0);

    const orbit = svg.querySelector('circle[stroke-dasharray="5, 5"]');
    expect(orbit.getAttribute("stroke")).toBe(ORBIT_COLOR);
  });

  it("appends two AU text labels (top and bottom)", () => {
    const svg = createSvg();
    renderOrbit(svg, 200, 1.0);

    const labels = Array.from(svg.querySelectorAll("text")).filter(
      (t) => t.textContent === "1.0 AU"
    );
    expect(labels.length).toBe(2);
  });

  it("top AU label is above center and bottom label is below center", () => {
    const svg = createSvg();
    renderOrbit(svg, 200, 1.0);

    const labels = Array.from(svg.querySelectorAll("text")).filter(
      (t) => t.textContent === "1.0 AU"
    );
    const ys = labels.map((t) => Number(t.getAttribute("y")));
    expect(ys.some((y) => y < CENTER)).toBe(true);
    expect(ys.some((y) => y > CENTER)).toBe(true);
  });

  it("AU labels are text-anchor: start and offset right of center", () => {
    const svg = createSvg();
    renderOrbit(svg, 200, 1.0);

    const labels = Array.from(svg.querySelectorAll("text")).filter(
      (t) => t.textContent === "1.0 AU"
    );
    for (const label of labels) {
      expect(label.getAttribute("text-anchor")).toBe("start");
      expect(Number(label.getAttribute("x"))).toBeGreaterThanOrEqual(CENTER);
    }
  });

  it("formats the AU label to one decimal place", () => {
    const svg = createSvg();
    renderOrbit(svg, 100, 5.2);

    const texts = Array.from(svg.querySelectorAll("text")).map((t) => t.textContent);
    expect(texts.filter((t) => t === "5.2 AU").length).toBe(2);
  });
});

describe("renderBody", () => {
  const earth = PLANETS.find((p) => p.name === "Earth");

  it("appends a circle with correct position, radius, and fill", () => {
    const svg = createSvg();
    renderBody(svg, 300, 250, earth, false);

    const circle = svg.querySelector("circle");
    expect(circle).not.toBeNull();
    expect(circle.getAttribute("cx")).toBe("300");
    expect(circle.getAttribute("cy")).toBe("250");
    expect(circle.getAttribute("r")).toBe(String(earth.size));
    expect(circle.getAttribute("fill")).toBe(earth.color);
  });

  it("appends a label text above the circle when showLabel is true", () => {
    const svg = createSvg();
    renderBody(svg, 300, 250, earth, true);

    const label = svg.querySelector("text");
    expect(label).not.toBeNull();
    expect(label.textContent).toBe("Earth");
    // Label y should be above the body (less than circle cy)
    expect(Number(label.getAttribute("y"))).toBeLessThan(250);
  });

  it("does not append a label when showLabel is false", () => {
    const svg = createSvg();
    renderBody(svg, 300, 250, earth, false);
    expect(svg.querySelector("text")).toBeNull();
  });

  it("defaults showLabel to true when omitted", () => {
    const svg = createSvg();
    renderBody(svg, 300, 250, earth);
    expect(svg.querySelector("text")).not.toBeNull();
  });

  it("label is centered on body x position (text-anchor: middle)", () => {
    const svg = createSvg();
    renderBody(svg, 300, 250, earth, true);

    const label = svg.querySelector("text");
    expect(label.getAttribute("text-anchor")).toBe("middle");
    expect(label.getAttribute("x")).toBe("300");
  });
});

describe("renderSaturnRings", () => {
  const saturn = PLANETS.find((p) => p.name === "Saturn");

  it("appends exactly two ring circles", () => {
    const svg = createSvg();
    renderSaturnRings(svg, 200, 300, saturn, saturn.size / 2);
    expect(svg.querySelectorAll("circle").length).toBe(2);
  });

  it("ring circles have fill: none (stroke-only)", () => {
    const svg = createSvg();
    renderSaturnRings(svg, 200, 300, saturn, saturn.size / 2);
    for (const circle of svg.querySelectorAll("circle")) {
      expect(circle.getAttribute("fill")).toBe("none");
    }
  });

  it("ring circles are centered on the given x, y", () => {
    const svg = createSvg();
    renderSaturnRings(svg, 200, 300, saturn, saturn.size / 2);
    for (const circle of svg.querySelectorAll("circle")) {
      expect(circle.getAttribute("cx")).toBe("200");
      expect(circle.getAttribute("cy")).toBe("300");
    }
  });

  it("outer ring has r=23 and stroke-width=2", () => {
    const svg = createSvg();
    renderSaturnRings(svg, 200, 300, saturn, saturn.size / 2);
    const [outer] = svg.querySelectorAll("circle");
    expect(outer.getAttribute("r")).toBe("23");
    expect(outer.getAttribute("stroke-width")).toBe("2");
  });

  it("inner ring has r=18 and stroke-width=6", () => {
    const svg = createSvg();
    renderSaturnRings(svg, 200, 300, saturn, saturn.size / 2);
    const rings = svg.querySelectorAll("circle");
    const inner = rings[1];
    expect(inner.getAttribute("r")).toBe("18");
    expect(inner.getAttribute("stroke-width")).toBe("6");
  });

  it("ring stroke color is derived from Saturn's hex color with 0.6 alpha", () => {
    const svg = createSvg();
    renderSaturnRings(svg, 200, 300, saturn, saturn.size / 2);
    const [outer] = svg.querySelectorAll("circle");
    // Saturn color #e0c080 → rgb(224, 192, 128)
    expect(outer.getAttribute("stroke")).toBe("rgba(224, 192, 128, 0.6)");
  });
});
