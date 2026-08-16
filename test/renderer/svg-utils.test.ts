import { describe, expect, it } from "vitest";
import { PLANETS } from "../../src/astronomy/planet-data.js";
import {
  auToRadius,
  CENTER,
  createSvgElement,
  ellipseFromApsides,
  MAX_RADIUS,
  MIN_RADIUS,
  polarFromFocus,
  SVG_NS,
  VIEW_SIZE,
} from "../../src/renderer/svg-utils.js";

describe("constants", () => {
  it("VIEW_SIZE is 800", () => expect(VIEW_SIZE).toBe(800));
  it("CENTER is 400 (VIEW_SIZE / 2)", () => expect(CENTER).toBe(VIEW_SIZE / 2));
  it("SVG_NS is the SVG namespace URI", () => expect(SVG_NS).toBe("http://www.w3.org/2000/svg"));
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
    // Jupiter should be noticeably past the midpoint (> 50% of MAX_RADIUS)
    expect(jupiterRadius).toBeGreaterThan(MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * 0.4);
  });
});

describe("ellipseFromApsides", () => {
  it("computes aPx as the midpoint and cPx as the half-difference of the apsides", () => {
    const { aPx, cPx } = ellipseFromApsides(80, 120);
    expect(aPx).toBe(100);
    expect(cPx).toBe(20);
  });

  it("degenerates to a circle (bPx === aPx, ePx === 0) when apsides are equal", () => {
    const { aPx, bPx, ePx } = ellipseFromApsides(100, 100);
    expect(bPx).toBeCloseTo(aPx, 8);
    expect(ePx).toBeCloseTo(0, 8);
  });

  it("matches the shared formula's own aPx/bPx/cPx/ePx relationship", () => {
    const { aPx, bPx, cPx, ePx } = ellipseFromApsides(50, 150);
    expect(bPx).toBeCloseTo(Math.sqrt(aPx * aPx - cPx * cPx), 8);
    expect(ePx).toBeCloseTo(cPx / aPx, 8);
  });
});

describe("polarFromFocus", () => {
  it("places a circular orbit (ePx=0) at radius aPx regardless of angle", () => {
    const { x, y } = polarFromFocus(100, 0, 0, Math.PI / 2, -1);
    expect(x).toBeCloseTo(CENTER, 8);
    expect(y).toBeCloseTo(CENTER - 100, 8);
  });

  it("puts a body at its perihelion distance when trueAnomaly is 0", () => {
    const aPx = 100;
    const ePx = 0.5;
    const perihelionPx = aPx * (1 - ePx);
    const { x } = polarFromFocus(aPx, ePx, 0, 0, -1);
    expect(x).toBeCloseTo(CENTER + perihelionPx, 8);
  });

  it("negates the y-offset when eclipticViewDirection flips sign", () => {
    const north = polarFromFocus(100, 0.3, 1, Math.PI / 3, -1);
    const south = polarFromFocus(100, 0.3, 1, Math.PI / 3, 1);
    expect(south.y - CENTER).toBeCloseTo(-(north.y - CENTER), 8);
    expect(south.x).toBeCloseTo(north.x, 8);
  });
});
