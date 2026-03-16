import { describe, expect, it } from "vitest";
import { COMETS } from "../../src/astronomy/comet-data.js";
import { calculateCometPosition } from "../../src/astronomy/orbital-mechanics.js";
import { renderCometBody, renderCometOrbit } from "../../src/renderer/comets.js";
import { renderSolarSystem } from "../../src/renderer/index.js";
import { auToRadius, CENTER, SVG_NS } from "../../src/renderer/svg-utils.js";

function createSvg() {
  return document.createElementNS(SVG_NS, "svg");
}

describe("renderCometOrbit", () => {
  const halley = COMETS.find((c) => c.name === "Halley");

  it("appends a path element to the SVG", () => {
    const svg = createSvg();
    renderCometOrbit(svg, halley);

    const path = svg.querySelector("path");
    expect(path).not.toBeNull();
    expect(svg.querySelector("ellipse")).toBeNull();
  });

  it("path has a d attribute starting with M (moveto)", () => {
    const svg = createSvg();
    renderCometOrbit(svg, halley);

    const path = svg.querySelector("path");
    expect(path.getAttribute("d")).toMatch(/^M /);
  });

  it("path has dashed stroke styling", () => {
    const svg = createSvg();
    renderCometOrbit(svg, halley);

    const path = svg.querySelector("path");
    expect(path.getAttribute("stroke-dasharray")).toBe("4, 8");
    expect(path.getAttribute("stroke-width")).toBe("1");
  });

  it("path has no fill", () => {
    const svg = createSvg();
    renderCometOrbit(svg, halley);

    const path = svg.querySelector("path");
    expect(path.getAttribute("fill")).toBe("none");
  });

  it("path contains many line segments (L commands)", () => {
    const svg = createSvg();
    renderCometOrbit(svg, halley);

    const d = svg.querySelector("path").getAttribute("d");
    const lineSegments = (d.match(/L /g) || []).length;
    // 120 steps → 120 L commands (plus 1 M command)
    expect(lineSegments).toBe(120);
  });

  it("path forms a closed-ish loop (first and last points are near each other)", () => {
    const svg = createSvg();
    renderCometOrbit(svg, halley);

    const d = svg.querySelector("path").getAttribute("d");
    const coords = d.match(/[-\d.]+/g).map(Number);
    // First point (after M)
    const firstX = coords[0];
    const firstY = coords[1];
    // Last point
    const lastX = coords[coords.length - 2];
    const lastY = coords[coords.length - 1];
    const dist = Math.sqrt((lastX - firstX) ** 2 + (lastY - firstY) ** 2);
    expect(dist).toBeLessThan(5); // nearly closed loop
  });

  it("comet body position lies on or near the orbit path", () => {
    const date = new Date("2026-03-15");
    const { angle, radius } = calculateCometPosition(halley, date);
    const pixelR = auToRadius(radius);
    const bodyX = CENTER + pixelR * Math.cos(angle);
    const bodyY = CENTER - pixelR * Math.sin(angle);

    const svg = createSvg();
    renderCometOrbit(svg, halley);

    const d = svg.querySelector("path").getAttribute("d");
    const coords = d.match(/[-\d.]+/g).map(Number);

    // Find the closest point on the path to the body position
    let minDist = Infinity;
    for (let i = 0; i < coords.length - 1; i += 2) {
      const px = coords[i];
      const py = coords[i + 1];
      const dist = Math.sqrt((px - bodyX) ** 2 + (py - bodyY) ** 2);
      if (dist < minDist) minDist = dist;
    }
    // Body should be within a few pixels of the orbit path
    expect(minDist).toBeLessThan(15);
  });

  it("works for all comets without error", () => {
    for (const comet of COMETS) {
      const svg = createSvg();
      renderCometOrbit(svg, comet);
      expect(svg.querySelector("path")).not.toBeNull();
    }
  });
});

describe("renderCometBody", () => {
  const halley = COMETS.find((c) => c.name === "Halley");
  const bodyX = 500;
  const bodyY = 300;
  const sunX = CENTER;
  const sunY = CENTER;

  it("appends a circle for the comet body", () => {
    const svg = createSvg();
    renderCometBody(svg, bodyX, bodyY, halley, sunX, sunY);

    const circle = svg.querySelector("circle");
    expect(circle).not.toBeNull();
    expect(circle.getAttribute("cx")).toBe(String(bodyX));
    expect(circle.getAttribute("cy")).toBe(String(bodyY));
    expect(circle.getAttribute("r")).toBe(String(halley.size));
    expect(circle.getAttribute("fill")).toBe(halley.color);
  });

  it("appends a tail line element", () => {
    const svg = createSvg();
    renderCometBody(svg, bodyX, bodyY, halley, sunX, sunY);

    const line = svg.querySelector("line");
    expect(line).not.toBeNull();
    expect(line.getAttribute("stroke-linecap")).toBe("round");
  });

  it("tail starts at comet position", () => {
    const svg = createSvg();
    renderCometBody(svg, bodyX, bodyY, halley, sunX, sunY);

    const line = svg.querySelector("line");
    expect(Number(line.getAttribute("x1"))).toBe(bodyX);
    expect(Number(line.getAttribute("y1"))).toBe(bodyY);
  });

  it("tail points away from the Sun", () => {
    const svg = createSvg();
    renderCometBody(svg, bodyX, bodyY, halley, sunX, sunY);

    const line = svg.querySelector("line");
    const x1 = Number(line.getAttribute("x1"));
    const y1 = Number(line.getAttribute("y1"));
    const x2 = Number(line.getAttribute("x2"));
    const y2 = Number(line.getAttribute("y2"));

    // Vector from Sun to comet body
    const sunToCometX = bodyX - sunX;
    const sunToCometY = bodyY - sunY;

    // Vector from comet body to tail end
    const tailDX = x2 - x1;
    const tailDY = y2 - y1;

    // Dot product should be positive (tail points away from Sun)
    const dot = sunToCometX * tailDX + sunToCometY * tailDY;
    expect(dot).toBeGreaterThan(0);
  });

  it("tail length matches comet tailLength property", () => {
    const svg = createSvg();
    renderCometBody(svg, bodyX, bodyY, halley, sunX, sunY);

    const line = svg.querySelector("line");
    const x2 = Number(line.getAttribute("x2"));
    const y2 = Number(line.getAttribute("y2"));

    const tailDX = x2 - bodyX;
    const tailDY = y2 - bodyY;
    const tailLen = Math.sqrt(tailDX * tailDX + tailDY * tailDY);
    expect(tailLen).toBeCloseTo(halley.tailLength, 1);
  });

  it("appends a label with the comet name", () => {
    const svg = createSvg();
    renderCometBody(svg, bodyX, bodyY, halley, sunX, sunY);

    const text = svg.querySelector("text");
    expect(text).not.toBeNull();
    expect(text.textContent).toBe("Halley");
    expect(text.getAttribute("text-anchor")).toBe("middle");
  });

  it("label is positioned above the body", () => {
    const svg = createSvg();
    renderCometBody(svg, bodyX, bodyY, halley, sunX, sunY);

    const text = svg.querySelector("text");
    expect(Number(text.getAttribute("y"))).toBeLessThan(bodyY);
  });

  it("tail renders before body in DOM order (body paints on top)", () => {
    const svg = createSvg();
    renderCometBody(svg, bodyX, bodyY, halley, sunX, sunY);

    const children = Array.from(svg.children);
    const lineIdx = children.findIndex((el) => el.tagName === "line");
    const circleIdx = children.findIndex((el) => el.tagName === "circle");
    expect(lineIdx).toBeLessThan(circleIdx);
  });

  it("handles comet at exact Sun position without error", () => {
    const svg = createSvg();
    renderCometBody(svg, CENTER, CENTER, halley, CENTER, CENTER);

    const line = svg.querySelector("line");
    expect(line).not.toBeNull();
    // Tail should still have a length (fallback distance = 1)
    const circle = svg.querySelector("circle");
    expect(circle).not.toBeNull();
  });

  it("uses default tail length when comet has no tailLength", () => {
    const noTailComet = { ...halley, tailLength: undefined };
    delete noTailComet.tailLength;
    const svg = createSvg();
    renderCometBody(svg, bodyX, bodyY, noTailComet, sunX, sunY);

    const line = svg.querySelector("line");
    const x2 = Number(line.getAttribute("x2"));
    const y2 = Number(line.getAttribute("y2"));
    const tailDX = x2 - bodyX;
    const tailDY = y2 - bodyY;
    const tailLen = Math.sqrt(tailDX * tailDX + tailDY * tailDY);
    expect(tailLen).toBeCloseTo(30, 1); // default tailLength
  });
});

describe("comets in renderSolarSystem integration", () => {
  it("positions array includes comet names", () => {
    const { positions } = renderSolarSystem(new Date("2026-03-15"));
    const cometNames = COMETS.map((c) => c.name);
    for (const name of cometNames) {
      const found = positions.find((p) => p.name === name);
      expect(found).toBeDefined();
      expect(found.x).toBeDefined();
      expect(found.y).toBeDefined();
      expect(found.color).toBeDefined();
    }
  });

  it("SVG contains comet orbit paths (not ellipses)", () => {
    const { svg } = renderSolarSystem(new Date("2026-03-15"));
    const orbitPaths = svg.querySelectorAll('path[stroke-dasharray="4, 8"]');
    expect(orbitPaths.length).toBe(COMETS.length);
    expect(svg.querySelectorAll("ellipse").length).toBe(0);
  });

  it("SVG contains comet labels", () => {
    const { svg } = renderSolarSystem(new Date("2026-03-15"));
    const texts = Array.from(svg.querySelectorAll("text")).map((t) => t.textContent);
    for (const comet of COMETS) {
      expect(texts).toContain(comet.name);
    }
  });

  it("SVG contains comet tail lines", () => {
    const { svg } = renderSolarSystem(new Date("2026-03-15"));
    const tailLines = svg.querySelectorAll('line[stroke-linecap="round"]');
    expect(tailLines.length).toBeGreaterThanOrEqual(COMETS.length);
  });

  it("comet positions change with different dates", () => {
    const { positions: p1 } = renderSolarSystem(new Date("2024-01-01"));
    const { positions: p2 } = renderSolarSystem(new Date("2024-07-01"));

    const halley1 = p1.find((p) => p.name === "Halley");
    const halley2 = p2.find((p) => p.name === "Halley");
    const different = halley1.x !== halley2.x || halley1.y !== halley2.y;
    expect(different).toBe(true);
  });
});
