import { describe, expect, it } from "vitest";
import { COMETS } from "../../src/astronomy/comet-data.js";
import { calculateCometPosition } from "../../src/astronomy/orbital-mechanics.js";
import {
  computeCometVisualEllipse,
  renderCometBody,
  renderCometOrbit,
} from "../../src/renderer/comets.js";
import { renderSolarSystem } from "../../src/renderer/index.js";
import { auToRadius, CENTER, orbitTransformMatrix, SVG_NS } from "../../src/renderer/svg-utils.js";

function createSvg() {
  return document.createElementNS(SVG_NS, "svg");
}

describe("computeCometVisualEllipse", () => {
  const halley = COMETS.find((c) => c.name === "Halley");

  it("returns aPx, bPx, cPx, ePx, and rotationDeg", () => {
    const result = computeCometVisualEllipse(halley);
    expect(result).toHaveProperty("aPx");
    expect(result).toHaveProperty("bPx");
    expect(result).toHaveProperty("cPx");
    expect(result).toHaveProperty("ePx");
    expect(result).toHaveProperty("rotationDeg");
  });

  it("bPx < aPx for an eccentric orbit", () => {
    const { aPx, bPx } = computeCometVisualEllipse(halley);
    expect(bPx).toBeLessThan(aPx);
    expect(aPx).toBeGreaterThan(0);
    expect(bPx).toBeGreaterThan(0);
  });

  it("ePx is between 0 and 1", () => {
    const { ePx } = computeCometVisualEllipse(halley);
    expect(ePx).toBeGreaterThan(0);
    expect(ePx).toBeLessThan(1);
  });

  it("rotationDeg matches longitude of perihelion", () => {
    const { rotationDeg } = computeCometVisualEllipse(halley);
    expect(rotationDeg).toBe(halley.longitudeOfPerihelion);
  });

  it("aPx² ≈ bPx² + cPx² (ellipse geometry)", () => {
    const { aPx, bPx, cPx } = computeCometVisualEllipse(halley);
    expect(aPx * aPx).toBeCloseTo(bPx * bPx + cPx * cPx, 5);
  });

  it("aphelion extends visibly beyond Neptune's pixel radius", () => {
    const { aPx, cPx } = computeCometVisualEllipse(halley);
    // Aphelion pixel distance from Sun (focus) = aPx + cPx
    const aphelionPx = aPx + cPx;
    const neptunePx = auToRadius(30.05);
    expect(aphelionPx).toBeGreaterThan(neptunePx);
  });

  it("exaggeration amplifies only the portion beyond Neptune", () => {
    const { aPx, cPx } = computeCometVisualEllipse(halley);
    const aphelionPx = aPx + cPx;
    const neptunePx = auToRadius(30.05);

    // Without exaggeration, the aphelion pixel distance would be auToRadius(a*(1+e))
    const rawAphelionPx = auToRadius(halley.semiMajorAxis * (1 + halley.eccentricity));
    const rawExcess = rawAphelionPx - neptunePx;

    // With 4x exaggeration: exaggerated = neptunePx + rawExcess * 4
    const expectedAphelionPx = neptunePx + rawExcess * 4;
    // The actual aphelion from the visual ellipse should match
    expect(aphelionPx).toBeCloseTo(expectedAphelionPx, 1);
  });

  it("no exaggeration when aphelion is within Neptune's orbit", () => {
    // Create a hypothetical comet with aphelion inside Neptune
    const innerComet = {
      ...halley,
      semiMajorAxis: 5,
      eccentricity: 0.5,
      // aphelion = 5 * 1.5 = 7.5 AU, well within Neptune at 30.05 AU
    };
    const { aPx, cPx } = computeCometVisualEllipse(innerComet);
    const aphelionPx = aPx + cPx;
    const rawAphelionPx = auToRadius(innerComet.semiMajorAxis * (1 + innerComet.eccentricity));
    // Should match exactly — no exaggeration applied
    expect(aphelionPx).toBeCloseTo(rawAphelionPx, 2);
  });

  it("perihelion pixel distance is unchanged by exaggeration", () => {
    const { aPx, cPx } = computeCometVisualEllipse(halley);
    // Perihelion pixel distance from Sun (focus) = aPx - cPx
    const perihelionPx = aPx - cPx;
    const rawPerihelionPx = auToRadius(halley.semiMajorAxis * (1 - halley.eccentricity));
    expect(perihelionPx).toBeCloseTo(rawPerihelionPx, 2);
  });
});

// Parses transform="matrix(a, b, c, d, e, f)" and reports whether a marker
// point lies on the drawn ellipse (rx=aPx, ry=bPx, local center 0,0).
function markerLiesOnEllipse(
  transform: string,
  aPx: number,
  bPx: number,
  markerX: number,
  markerY: number
): boolean {
  const [a, b, c, d, e, f] = transform
    .replace(/matrix\(|\)/g, "")
    .split(",")
    .map(Number);
  const det = a * d - b * c;
  const px = markerX - e;
  const py = markerY - f;
  const localX = (d * px - c * py) / det;
  const localY = (-b * px + a * py) / det;
  const value = (localX / aPx) ** 2 + (localY / bPx) ** 2;
  return Math.abs(value - 1) < 1e-9;
}

describe("renderCometOrbit", () => {
  const halley = COMETS.find((c) => c.name === "Halley");

  it("appends an ellipse element to the SVG", () => {
    const svg = createSvg();
    renderCometOrbit(svg, halley, -1);

    const ellipse = svg.querySelector("ellipse");
    expect(ellipse).not.toBeNull();
    expect(svg.querySelector("path")).toBeNull();
  });

  it("ellipse is drawn at its own local origin (transform carries it to CENTER)", () => {
    const svg = createSvg();
    renderCometOrbit(svg, halley, -1);

    const ellipse = svg.querySelector("ellipse");
    expect(ellipse.getAttribute("cx")).toBe("0");
    expect(ellipse.getAttribute("cy")).toBe("0");
  });

  it("ellipse rx and ry match computeCometVisualEllipse", () => {
    const svg = createSvg();
    renderCometOrbit(svg, halley, -1);
    const { aPx, bPx } = computeCometVisualEllipse(halley);

    const ellipse = svg.querySelector("ellipse");
    expect(Number(ellipse.getAttribute("rx"))).toBeCloseTo(aPx, 2);
    expect(Number(ellipse.getAttribute("ry"))).toBeCloseTo(bPx, 2);
  });

  it("ellipse has dashed stroke styling", () => {
    const svg = createSvg();
    renderCometOrbit(svg, halley, -1);

    const ellipse = svg.querySelector("ellipse");
    expect(ellipse.getAttribute("stroke-dasharray")).toBe("4, 8");
    expect(ellipse.getAttribute("stroke-width")).toBe("1");
  });

  it("ellipse has no fill", () => {
    const svg = createSvg();
    renderCometOrbit(svg, halley, -1);

    const ellipse = svg.querySelector("ellipse");
    expect(ellipse.getAttribute("fill")).toBe("none");
  });

  it("ellipse transform is a matrix built from the focus shift and rotation", () => {
    const svg = createSvg();
    renderCometOrbit(svg, halley, -1);
    const { cPx, rotationDeg } = computeCometVisualEllipse(halley);

    const ellipse = svg.querySelector("ellipse");
    const transform = ellipse.getAttribute("transform");
    expect(transform).toBe(orbitTransformMatrix(cPx, rotationDeg, -1));
  });

  it.each([-1, 1])(
    "comet body (from the same polar-focus formula the renderer uses) lands exactly on the drawn ellipse, eclipticViewDirection=%i",
    (eclipticViewDirection) => {
      const svg = createSvg();
      renderCometOrbit(svg, halley, eclipticViewDirection);
      const { aPx, bPx, ePx, rotationDeg } = computeCometVisualEllipse(halley);

      const ellipse = svg.querySelector("ellipse");
      const transform = ellipse.getAttribute("transform");

      const rotationRad = (rotationDeg * Math.PI) / 180;
      for (const trueAnomaly of [0, Math.PI / 4, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
        const angle = trueAnomaly + rotationRad;
        const rPx = (aPx * (1 - ePx * ePx)) / (1 + ePx * Math.cos(trueAnomaly));
        const bodyX = CENTER + rPx * Math.cos(angle);
        const bodyY = CENTER + eclipticViewDirection * rPx * Math.sin(angle);
        expect(markerLiesOnEllipse(transform, aPx, bPx, bodyX, bodyY)).toBe(true);
      }
    }
  );

  it("works for all comets without error", () => {
    for (const comet of COMETS) {
      const svg = createSvg();
      renderCometOrbit(svg, comet, -1);
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

  // Half-disc head "d" is "M x1 y1 A r r 0 0 sweep x2 y2 Z", so the numbers are
  // [x1, y1, r, r, xrot, largeArc, sweep, x2, y2].
  function nums(d) {
    return (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  }
  function startPoint(d) {
    const n = nums(d);
    return { x: n[0], y: n[1] };
  }
  function endPoint(d) {
    const n = nums(d);
    return { x: n[n.length - 2], y: n[n.length - 1] };
  }
  // Independent reconstruction of a semicircular arc's midpoint from its chord
  // endpoints, its center, and the SVG sweep flag (same convention verified in
  // svg-utils.test.ts): for start S, end E, chord dir d = unit(E - S), sweep=1
  // bulges toward center + r*(dy, -dx), sweep=0 toward center + r*(-dy, dx).
  function arcMidpoint(d, cx, cy, r) {
    const s = startPoint(d);
    const e = endPoint(d);
    const len = Math.hypot(e.x - s.x, e.y - s.y);
    const ux = (e.x - s.x) / len;
    const uy = (e.y - s.y) / len;
    const [nx, ny] = nums(d)[6] === 1 ? [uy, -ux] : [-uy, ux];
    return { x: cx + r * nx, y: cy + r * ny };
  }
  it("renders the head as a plain circle plus one translucent shadow path, no half-disc pair", () => {
    const svg = createSvg();
    renderCometBody(svg, bodyX, bodyY, halley, sunX, sunY);

    const circle = svg.querySelector("circle");
    expect(circle).not.toBeNull();
    expect(Number(circle.getAttribute("cx"))).toBeCloseTo(bodyX, 6);
    expect(Number(circle.getAttribute("cy"))).toBeCloseTo(bodyY, 6);
    expect(Number(circle.getAttribute("r"))).toBeCloseTo(halley.size, 6);
    expect(circle.getAttribute("fill")).toBe(halley.color);

    const paths = Array.from(svg.querySelectorAll("path"));
    expect(paths.length).toBe(1);

    const [shadow] = paths;
    expect(shadow.getAttribute("fill")).toBe("#05070c");
    const opacity = Number(shadow.getAttribute("fill-opacity"));
    expect(opacity).toBeGreaterThan(0);
    expect(opacity).toBeLessThan(1);
    expect(shadow.getAttribute("d")).toContain(`A ${halley.size} ${halley.size}`);
    // No opaque color-mix tinted half-disc anymore.
    expect(svg.querySelector('path[fill^="color-mix"]')).toBeNull();
  });

  it("comet off to one side of the Sun: the shadow half and the tail both point anti-sunward", () => {
    const svg = createSvg();
    // Comet placed cleanly to the right of the Sun; anti-sunward direction is +x.
    const cometX = sunX + 200;
    const cometY = sunY;
    renderCometBody(svg, cometX, cometY, halley, sunX, sunY);

    const paths = Array.from(svg.querySelectorAll("path"));
    expect(paths.length).toBe(1);
    const shadow = paths[0];
    expect(shadow.getAttribute("fill")).toBe("#05070c");

    const r = halley.size;
    const darkMid = arcMidpoint(shadow.getAttribute("d"), cometX, cometY, r);

    // Shadow half bulges away from the Sun (+x).
    expect(darkMid.x).toBeGreaterThan(cometX);
    // Independent geometry: the anti-sunward point on the head circle is (cometX + r, cometY).
    expect(darkMid.x).toBeCloseTo(cometX + r, 6);
    expect(darkMid.y).toBeCloseTo(cometY, 6);

    // Tail points anti-sunward (+x), same side as the shadow half.
    const line = svg.querySelector("line");
    expect(Number(line.getAttribute("x2"))).toBeGreaterThan(cometX);
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

  it("tail length uses comet tailLength when no dynamic length provided", () => {
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

  it("tail length uses dynamicTailLength when provided", () => {
    const svg = createSvg();
    const dynamicLen = 15;
    renderCometBody(svg, bodyX, bodyY, halley, sunX, sunY, dynamicLen);

    const line = svg.querySelector("line");
    const x2 = Number(line.getAttribute("x2"));
    const y2 = Number(line.getAttribute("y2"));

    const tailDX = x2 - bodyX;
    const tailDY = y2 - bodyY;
    const tailLen = Math.sqrt(tailDX * tailDX + tailDY * tailDY);
    expect(tailLen).toBeCloseTo(dynamicLen, 1);
  });

  it("dynamicTailLength of 0 produces zero-length tail", () => {
    const svg = createSvg();
    renderCometBody(svg, bodyX, bodyY, halley, sunX, sunY, 0);

    const line = svg.querySelector("line");
    const x2 = Number(line.getAttribute("x2"));
    const y2 = Number(line.getAttribute("y2"));

    expect(x2).toBe(bodyX);
    expect(y2).toBe(bodyY);
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

  it("tail renders before the head circle, head before the shadow, shadow before the label (DOM paint order)", () => {
    const svg = createSvg();
    renderCometBody(svg, bodyX, bodyY, halley, sunX, sunY);

    const children = Array.from(svg.children);
    const lineIdx = children.findIndex((el) => el.tagName === "line");
    const circleIdx = children.findIndex((el) => el.tagName === "circle");
    const shadowIdx = children.findIndex((el) => el.tagName === "path");
    const textIdx = children.findIndex((el) => el.tagName === "text");
    expect(lineIdx).toBeGreaterThanOrEqual(0);
    expect(lineIdx).toBeLessThan(circleIdx);
    expect(circleIdx).toBeLessThan(shadowIdx);
    expect(shadowIdx).toBeLessThan(textIdx);
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
    const orbitEllipses = svg.querySelectorAll('ellipse[stroke-dasharray="4, 8"]');
    expect(orbitEllipses.length).toBe(COMETS.length);
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

  it("comet tail length is at most comet.tailLength (capped at perihelion)", () => {
    const { svg } = renderSolarSystem(new Date("2026-03-15"));
    const tailLines = svg.querySelectorAll('line[stroke-linecap="round"]');
    const halley = COMETS.find((c) => c.name === "Halley");

    for (const line of tailLines) {
      const x1 = Number(line.getAttribute("x1"));
      const y1 = Number(line.getAttribute("y1"));
      const x2 = Number(line.getAttribute("x2"));
      const y2 = Number(line.getAttribute("y2"));
      const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      expect(len).toBeLessThanOrEqual(halley.tailLength + 0.1);
    }
  });

  it("tail scales inversely with distance — farther from Sun means shorter tail", () => {
    // Halley is far from the Sun currently (large radius), so tail should be
    // shorter than the max tailLength
    const halley = COMETS.find((c) => c.name === "Halley");
    const { radius } = calculateCometPosition(halley, new Date("2026-03-15"));
    const perihelion = halley.semiMajorAxis * (1 - halley.eccentricity);

    // If comet is beyond perihelion, tail should be scaled down
    if (radius > perihelion * 1.1) {
      const { svg } = renderSolarSystem(new Date("2026-03-15"));
      const tailLines = svg.querySelectorAll('line[stroke-linecap="round"]');
      // At least one tail line should be shorter than max
      let foundShortTail = false;
      for (const line of tailLines) {
        const x1 = Number(line.getAttribute("x1"));
        const y1 = Number(line.getAttribute("y1"));
        const x2 = Number(line.getAttribute("x2"));
        const y2 = Number(line.getAttribute("y2"));
        const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        if (len < halley.tailLength - 0.1) foundShortTail = true;
      }
      expect(foundShortTail).toBe(true);
    }
  });
});
