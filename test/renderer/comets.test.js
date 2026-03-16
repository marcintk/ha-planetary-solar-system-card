import { describe, expect, it } from "vitest";
import { COMETS } from "../../src/astronomy/comet-data.js";
import { renderCometBody, renderCometOrbit } from "../../src/renderer/comets.js";
import { renderSolarSystem } from "../../src/renderer/index.js";
import { CENTER, SVG_NS } from "../../src/renderer/svg-utils.js";

function createSvg() {
  return document.createElementNS(SVG_NS, "svg");
}

describe("renderCometOrbit", () => {
  const halley = COMETS.find((c) => c.name === "Halley");

  it("appends an ellipse element to the SVG", () => {
    const svg = createSvg();
    renderCometOrbit(svg, halley);

    const ellipse = svg.querySelector("ellipse");
    expect(ellipse).not.toBeNull();
  });

  it("ellipse is centered at CENTER", () => {
    const svg = createSvg();
    renderCometOrbit(svg, halley);

    const ellipse = svg.querySelector("ellipse");
    expect(ellipse.getAttribute("cx")).toBe(String(CENTER));
    expect(ellipse.getAttribute("cy")).toBe(String(CENTER));
  });

  it("ellipse has dashed stroke", () => {
    const svg = createSvg();
    renderCometOrbit(svg, halley);

    const ellipse = svg.querySelector("ellipse");
    expect(ellipse.getAttribute("stroke-dasharray")).toBe("4, 8");
    expect(ellipse.getAttribute("stroke-width")).toBe("1");
  });

  it("ellipse has no fill", () => {
    const svg = createSvg();
    renderCometOrbit(svg, halley);

    const ellipse = svg.querySelector("ellipse");
    expect(ellipse.getAttribute("fill")).toBe("none");
  });

  it("ellipse has rotation transform matching longitude of perihelion", () => {
    const svg = createSvg();
    renderCometOrbit(svg, halley);

    const ellipse = svg.querySelector("ellipse");
    const transform = ellipse.getAttribute("transform");
    expect(transform).toContain(`rotate(${halley.longitudeOfPerihelion}`);
    expect(transform).toContain(`${CENTER}, ${CENTER}`);
  });

  it("ellipse transform includes a translation offset (focus shift)", () => {
    const svg = createSvg();
    renderCometOrbit(svg, halley);

    const ellipse = svg.querySelector("ellipse");
    const transform = ellipse.getAttribute("transform");
    expect(transform).toContain("translate(");
  });

  it("ellipse ry < rx (semi-minor < semi-major for eccentric orbit)", () => {
    const svg = createSvg();
    renderCometOrbit(svg, halley);

    const ellipse = svg.querySelector("ellipse");
    const rx = Number(ellipse.getAttribute("rx"));
    const ry = Number(ellipse.getAttribute("ry"));
    expect(ry).toBeLessThan(rx);
    expect(rx).toBeGreaterThan(0);
    expect(ry).toBeGreaterThan(0);
  });

  it("works for all comets without error", () => {
    for (const comet of COMETS) {
      const svg = createSvg();
      renderCometOrbit(svg, comet);
      expect(svg.querySelector("ellipse")).not.toBeNull();
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

  it("SVG contains comet orbit ellipses", () => {
    const { svg } = renderSolarSystem(new Date("2026-03-15"));
    const ellipses = svg.querySelectorAll('ellipse[stroke-dasharray="4, 8"]');
    expect(ellipses.length).toBe(COMETS.length);
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
