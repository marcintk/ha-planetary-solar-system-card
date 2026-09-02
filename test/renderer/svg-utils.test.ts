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
  polarOffset,
  SVG_NS,
  sunwardHalfDiscPaths,
  terminatorShadowPath,
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

describe("polarOffset", () => {
  it("walks the given distance along the angle, from the given point", () => {
    expect(polarOffset(100, 200, 10, 0, -1)).toEqual({ x: 110, y: 200 });
  });

  // Screen y grows downward, so the north view negates the sine to put "up the page" at
  // positive angles. The south view is the same scene mirrored, and only y moves.
  it("mirrors only y when the direction flips", () => {
    const north = polarOffset(100, 200, 10, Math.PI / 4, -1);
    const south = polarOffset(100, 200, 10, Math.PI / 4, 1);
    expect(south.x).toBeCloseTo(north.x, 12);
    expect(south.y - 200).toBeCloseTo(-(north.y - 200), 12);
  });

  // A circular orbit puts the radius at aPx for every anomaly, so the composition can be
  // asserted without restating the ellipse formula the test would then be checking against
  // itself.
  it("is what polarFromFocus offsets from CENTER with", () => {
    const angle = 2.3;
    expect(polarFromFocus(120, 0, 1.1, angle, -1)).toEqual(
      polarOffset(CENTER, CENTER, 120, angle, -1)
    );
  });

  // The unit vector rayCircleDistance is handed carries the same mirror as the endpoint it
  // helps produce (see armEnd in observer.ts) — one primitive answers both.
  it("gives the unit direction when distance is 1 from the origin", () => {
    const angle = 0.7;
    expect(polarOffset(0, 0, 1, angle, -1)).toEqual({
      x: Math.cos(angle),
      y: -Math.sin(angle),
    });
  });
});

describe("sunwardHalfDiscPaths", () => {
  // Pull every number out of a path "d" string, in order. For our half-discs the
  // shape is "M sx sy A rx ry x-axis-rotation large-arc-flag sweep-flag ex ey Z",
  // so numbers are [sx, sy, rx, ry, xrot, largeArc, sweep, ex, ey].
  function nums(d: string): number[] {
    return (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  }
  function startPoint(d: string): { x: number; y: number } {
    const n = nums(d);
    return { x: n[0], y: n[1] };
  }
  function endPoint(d: string): { x: number; y: number } {
    const n = nums(d);
    return { x: n[n.length - 2], y: n[n.length - 1] };
  }
  function sweepFlag(d: string): number {
    return nums(d)[6];
  }
  function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  // Independent reconstruction of a semicircular arc's midpoint from its chord
  // endpoints, its center, and the SVG sweep flag. Verified against SVG's
  // "positive angle = visually clockwise" rule: for start S, end E, chord
  // direction d = unit(E - S), sweep=1 puts the bulge at center + r*(dy, -dx),
  // sweep=0 at center + r*(-dy, dx).
  function arcMidpoint(d: string, cx: number, cy: number, r: number): { x: number; y: number } {
    const s = startPoint(d);
    const e = endPoint(d);
    const len = Math.hypot(e.x - s.x, e.y - s.y);
    const dx = (e.x - s.x) / len;
    const dy = (e.y - s.y) / len;
    const [nx, ny] = sweepFlag(d) === 1 ? [dy, -dx] : [-dy, dx];
    return { x: cx + r * nx, y: cy + r * ny };
  }

  it("returns null when (x, y) coincides with an explicit lightFrom", () => {
    expect(sunwardHalfDiscPaths(123, 456, 10, { x: 123, y: 456 })).toBe(null);
  });

  it("returns null for the default lightFrom (CENTER) when the body is at CENTER", () => {
    expect(sunwardHalfDiscPaths(CENTER, CENTER, 12)).toBe(null);
  });

  it("returns two d strings that start with M, carry an 'r r' arc, and end with Z", () => {
    const result = sunwardHalfDiscPaths(300, 250, 10);
    expect(result).not.toBeNull();
    const { litD, darkD } = result as { litD: string; darkD: string };
    for (const d of [litD, darkD]) {
      expect(d.startsWith("M")).toBe(true);
      expect(d).toContain("A 10 10");
      expect(d.trim().endsWith("Z")).toBe(true);
    }
  });

  it("splits along the diameter perpendicular to the body->light vector, with shared endpoints at distance r", () => {
    const x = 300;
    const y = 250;
    const r = 10;
    const light = { x: CENTER, y: CENTER };
    const result = sunwardHalfDiscPaths(x, y, r);
    const { litD, darkD } = result as { litD: string; darkD: string };

    // Independent geometry: the split is perpendicular to the body->light
    // direction, so the diameter ends sit at phi +/- 90 degrees.
    const phi = Math.atan2(light.y - y, light.x - x);
    const p1 = {
      x: x + r * Math.cos(phi + Math.PI / 2),
      y: y + r * Math.sin(phi + Math.PI / 2),
    };
    const p2 = {
      x: x + r * Math.cos(phi - Math.PI / 2),
      y: y + r * Math.sin(phi - Math.PI / 2),
    };

    for (const d of [litD, darkD]) {
      const s = startPoint(d);
      const e = endPoint(d);
      expect(dist(s, { x, y })).toBeCloseTo(r, 6);
      expect(dist(e, { x, y })).toBeCloseTo(r, 6);
      const onDiameter =
        (dist(s, p1) < 1e-6 && dist(e, p2) < 1e-6) || (dist(s, p2) < 1e-6 && dist(e, p1) < 1e-6);
      expect(onDiameter).toBe(true);
    }

    const litEnds = [startPoint(litD), endPoint(litD)];
    const darkEnds = [startPoint(darkD), endPoint(darkD)];
    const sameEndpoints =
      (dist(litEnds[0], darkEnds[0]) < 1e-6 && dist(litEnds[1], darkEnds[1]) < 1e-6) ||
      (dist(litEnds[0], darkEnds[1]) < 1e-6 && dist(litEnds[1], darkEnds[0]) < 1e-6);
    expect(sameEndpoints).toBe(true);
  });

  it("litD bulges toward the light and darkD away; the two halves sweep opposite ways", () => {
    const x = 300;
    const y = 250;
    const r = 10;
    const light = { x: CENTER, y: CENTER };
    const result = sunwardHalfDiscPaths(x, y, r);
    const { litD, darkD } = result as { litD: string; darkD: string };

    expect(sweepFlag(litD)).not.toBe(sweepFlag(darkD));

    const litMid = arcMidpoint(litD, x, y, r);
    const darkMid = arcMidpoint(darkD, x, y, r);
    expect(dist(litMid, light)).toBeLessThan(dist(darkMid, light));

    // The lit arc's midpoint is the circle point pointing straight at the light.
    const phi = Math.atan2(light.y - y, light.x - x);
    expect(litMid.x).toBeCloseTo(x + r * Math.cos(phi), 6);
    expect(litMid.y).toBeCloseTo(y + r * Math.sin(phi), 6);
  });
});

describe("terminatorShadowPath", () => {
  function nums(s: string): number[] {
    return (s.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  }
  // Split "M ... A ... A ... Z" into its command chunks (coords carry no letters).
  function commands(d: string): string[] {
    return d.match(/[MAZ][^MAZ]*/g) ?? [];
  }
  function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  const x = 300;
  const y = 250;
  const r = 10;
  const bow = 0.22;
  const light = { x: CENTER, y: CENTER };

  it("draws the anti-sunward region: M..Z, a full-radius semicircle plus a terminator arc bowed into the dark side", () => {
    expect(terminatorShadowPath(CENTER, CENTER, 12, 0.22)).toBe(null);

    const d = terminatorShadowPath(x, y, r, bow);
    expect(d).not.toBeNull();
    const path = (d as string).trim();

    expect(path.startsWith("M")).toBe(true);
    expect(path.endsWith("Z")).toBe(true);

    const cmds = commands(path);
    const arcs = cmds.filter((c) => c.startsWith("A"));
    expect(arcs.length).toBe(2);

    // The two "poles": the M start point, and the endpoint of the first arc.
    const startNums = nums(cmds[0]);
    const start = { x: startNums[0], y: startNums[1] };
    const arc0Nums = nums(arcs[0]);
    const pole2 = {
      x: arc0Nums[arc0Nums.length - 2],
      y: arc0Nums[arc0Nums.length - 1],
    };

    // Independent geometry: poles are the phi +/- 90 degree points on the disc.
    const phi = Math.atan2(light.y - y, light.x - x);
    const pPlus = {
      x: x + r * Math.cos(phi + Math.PI / 2),
      y: y + r * Math.sin(phi + Math.PI / 2),
    };
    const pMinus = {
      x: x + r * Math.cos(phi - Math.PI / 2),
      y: y + r * Math.sin(phi - Math.PI / 2),
    };
    expect(dist(start, { x, y })).toBeCloseTo(r, 6);
    expect(dist(pole2, { x, y })).toBeCloseTo(r, 6);
    const matched =
      (dist(start, pPlus) < 1e-6 && dist(pole2, pMinus) < 1e-6) ||
      (dist(start, pMinus) < 1e-6 && dist(pole2, pPlus) < 1e-6);
    expect(matched).toBe(true);

    // The pole chord is perpendicular to the body->light direction.
    const chord = { x: pole2.x - start.x, y: pole2.y - start.y };
    const toLight = { x: light.x - x, y: light.y - y };
    expect(chord.x * toLight.x + chord.y * toLight.y).toBeCloseTo(0, 6);

    // First arc: a full-radius semicircle "A r r 0 0 1 ...".
    expect(arc0Nums[0]).toBeCloseTo(r, 6);
    expect(arc0Nums[1]).toBeCloseTo(r, 6);
    expect(arc0Nums[2]).toBe(0); // x-axis-rotation
    expect(arc0Nums[3]).toBe(0); // large-arc-flag
    expect(arc0Nums[4]).toBe(1); // sweep-flag

    // Second arc (the terminator): x-radius bow*r, y-radius r.
    const arc1Nums = nums(arcs[1]);
    expect(arc1Nums[0]).toBeCloseTo(bow * r, 6);
    expect(arc1Nums[1]).toBeCloseTo(r, 6);

    // The terminator arc bows away from the light. It renders from pole2 (where the
    // first arc ended) back to the M start point, so reconstruct its midpoint from
    // that chord direction, the ellipse cross-axis (bow*r), and the SVG sweep flag
    // (same "positive angle = visually clockwise" rule the sunwardHalfDiscPaths tests use).
    const sweep = arc1Nums[4];
    const len = dist(start, pole2);
    const dx = (start.x - pole2.x) / len;
    const dy = (start.y - pole2.y) / len;
    const [nx, ny] = sweep === 1 ? [dy, -dx] : [-dy, dx];
    const termMid = { x: x + bow * r * nx, y: y + bow * r * ny };

    // Offset ~bow*r from the pole-diameter midpoint (x, y), on the far side from the light.
    expect(dist(termMid, { x, y })).toBeCloseTo(bow * r, 6);
    expect(dist(termMid, light)).toBeGreaterThan(dist({ x, y }, light));
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
