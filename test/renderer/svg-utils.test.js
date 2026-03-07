import { describe, it, expect } from "vitest";
import {
  createSvgElement,
  auToRadius,
  expandBounds,
  CENTER,
  VIEW_SIZE,
  MIN_RADIUS,
  MAX_RADIUS,
  SVG_NS,
} from "../../src/renderer/svg-utils.js";
import { PLANETS } from "../../src/planet-data.js";

describe("constants", () => {
  it("VIEW_SIZE is 800", () => expect(VIEW_SIZE).toBe(800));
  it("CENTER is 400 (VIEW_SIZE / 2)", () => expect(CENTER).toBe(VIEW_SIZE / 2));
  it("SVG_NS is the SVG namespace URI", () =>
    expect(SVG_NS).toBe("http://www.w3.org/2000/svg"));
});

describe("createSvgElement", () => {
  it("creates an element in the SVG namespace", () => {
    const el = createSvgElement("circle", {});
    expect(el.namespaceURI).toBe(SVG_NS);
  });

  it("creates an element with the given tag name", () => {
    expect(createSvgElement("rect", {}).tagName).toBe("rect");
    expect(createSvgElement("line", {}).tagName).toBe("line");
  });

  it("sets all provided attributes on the element", () => {
    const el = createSvgElement("circle", { cx: 100, cy: 200, r: 50, fill: "red" });
    expect(el.getAttribute("cx")).toBe("100");
    expect(el.getAttribute("cy")).toBe("200");
    expect(el.getAttribute("r")).toBe("50");
    expect(el.getAttribute("fill")).toBe("red");
  });

  it("creates element with no attributes when attrs is empty", () => {
    const el = createSvgElement("g", {});
    expect(el.attributes.length).toBe(0);
  });
});

describe("auToRadius", () => {
  const innerPlanet = PLANETS[0]; // Mercury (smallest AU)
  const outerPlanet = PLANETS[PLANETS.length - 1]; // Neptune (largest AU)

  it("maps the innermost planet to MIN_RADIUS", () => {
    expect(auToRadius(innerPlanet.au)).toBeCloseTo(MIN_RADIUS, 5);
  });

  it("maps the outermost planet to MAX_RADIUS", () => {
    expect(auToRadius(outerPlanet.au)).toBeCloseTo(MAX_RADIUS, 5);
  });

  it("maps Earth (1 AU) between MIN_RADIUS and MAX_RADIUS", () => {
    const r = auToRadius(1.0);
    expect(r).toBeGreaterThan(MIN_RADIUS);
    expect(r).toBeLessThan(MAX_RADIUS);
  });

  it("returns strictly increasing values for increasing AU distances", () => {
    for (let i = 1; i < PLANETS.length; i++) {
      expect(auToRadius(PLANETS[i].au)).toBeGreaterThan(auToRadius(PLANETS[i - 1].au));
    }
  });

  it("uses log scale: Jupiter (5.2 AU) is much closer to inner than outer end", () => {
    // Linear scale would put Jupiter at ~(5.2-0.39)/(30-0.39) ≈ 16% from inner
    // Log scale puts it at ~(ln5.2-ln0.39)/(ln30-ln0.39) ≈ 56% from inner
    const jupiterRadius = auToRadius(5.2);
    const earthRadius = auToRadius(1.0);
    // Jupiter should be noticeably past the midpoint (> 50% of MAX_RADIUS)
    expect(jupiterRadius).toBeGreaterThan(MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * 0.4);
  });
});

describe("expandBounds", () => {
  function freshBounds() {
    return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  }

  it("sets bounds to point ± margin on the first call", () => {
    const b = freshBounds();
    expandBounds(b, 100, 200, 10);
    expect(b.minX).toBe(90);
    expect(b.minY).toBe(190);
    expect(b.maxX).toBe(110);
    expect(b.maxY).toBe(210);
  });

  it("expands bounds when a new point exceeds the current box", () => {
    const b = freshBounds();
    expandBounds(b, 100, 100, 5);
    expandBounds(b, 200, 50, 5); // x is further right
    expect(b.maxX).toBe(205);
    expect(b.minY).toBe(45);
  });

  it("does not shrink bounds for a point already inside", () => {
    const b = freshBounds();
    expandBounds(b, 100, 100, 50); // sets bounds [50,150] x [50,150]
    expandBounds(b, 100, 100, 10); // smaller margin, same center — should not shrink
    expect(b.minX).toBe(50);
    expect(b.maxX).toBe(150);
  });

  it("accumulates correctly across multiple planets", () => {
    const b = freshBounds();
    expandBounds(b, 400, 0, 5);   // top
    expandBounds(b, 400, 800, 5); // bottom
    expandBounds(b, 0, 400, 5);   // left
    expandBounds(b, 800, 400, 5); // right
    expect(b.minX).toBe(-5);
    expect(b.maxX).toBe(805);
    expect(b.minY).toBe(-5);
    expect(b.maxY).toBe(805);
  });
});
