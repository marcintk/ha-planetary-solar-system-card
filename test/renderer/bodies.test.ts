import { describe, expect, it } from "vitest";
import { PLANETS, SUN } from "../../src/astronomy/planet-data.js";
import {
  ORBIT_COLOR,
  renderBody,
  renderOrbit,
  renderSaturnRings,
} from "../../src/renderer/bodies.js";
import { CENTER, radiusFromAU, SVG_NS } from "../../src/renderer/svg-utils.js";
import type { CometVisualEllipse } from "../../src/types.js";

function createSvg() {
  return document.createElementNS(SVG_NS, "svg");
}

// Circular ellipse (aPx=bPx, no perihelion/aphelion offset) for tests that
// only care about the AU-label/color plumbing, not the ellipse shape.
function circleEllipse(radius: number): CometVisualEllipse {
  return { aPx: radius, bPx: radius, cPx: 0, ePx: 0, rotationDeg: 0 };
}

// Parses transform="matrix(a, b, c, d, e, f)" and reports whether a marker
// point lies on the drawn ellipse (rx=aPx, ry=bPx, local center 0,0).
function markerLiesOnEllipse(
  transform: string,
  ellipse: CometVisualEllipse,
  markerX: number,
  markerY: number
): boolean {
  const [a, b, c, d, e, f] = transform
    .replace(/matrix\(|\)/g, "")
    .split(",")
    .map(Number);
  const det = a * d - b * c;
  // Invert the 2x2 linear part and undo the translation to get back to the
  // ellipse's local (untransformed) coordinates.
  const px = markerX - e;
  const py = markerY - f;
  const localX = (d * px - c * py) / det;
  const localY = (-b * px + a * py) / det;
  const value = (localX / ellipse.aPx) ** 2 + (localY / ellipse.bPx) ** 2;
  return Math.abs(value - 1) < 1e-9;
}

describe("renderOrbit", () => {
  it("appends a dashed ellipse at the given radii", () => {
    const svg = createSvg();
    renderOrbit(svg, circleEllipse(200), -1);

    const orbit = svg.querySelector('ellipse[stroke-dasharray="5, 5"]');
    expect(orbit).not.toBeNull();
    expect(orbit.getAttribute("rx")).toBe("200");
    expect(orbit.getAttribute("ry")).toBe("200");
    expect(orbit.getAttribute("cx")).toBe("0");
    expect(orbit.getAttribute("cy")).toBe("0");
    expect(orbit.getAttribute("fill")).toBe("none");
  });

  it("uses ORBIT_COLOR for the stroke", () => {
    const svg = createSvg();
    renderOrbit(svg, circleEllipse(200), -1);

    const orbit = svg.querySelector('ellipse[stroke-dasharray="5, 5"]');
    expect(orbit.getAttribute("style")).toBe(`stroke: ${ORBIT_COLOR}`);
  });

  it("places a circular ellipse (rotationDeg=0) centered on CENTER via its transform", () => {
    const svg = createSvg();
    renderOrbit(svg, circleEllipse(200), -1);

    const orbit = svg.querySelector('ellipse[stroke-dasharray="5, 5"]');
    expect(orbit.getAttribute("transform")).toBe(`matrix(1, 0, 0, -1, ${CENTER}, ${CENTER})`);
  });

  it.each([-1, 1])(
    "marker positions (from the same polar-focus formula the renderer uses) land exactly on the drawn ellipse, eclipticViewDirection=%i",
    (eclipticViewDirection) => {
      const svg = createSvg();
      const aPx = 220;
      const cPx = 90;
      const bPx = Math.sqrt(aPx * aPx - cPx * cPx);
      const ellipse: CometVisualEllipse = { aPx, bPx, cPx, ePx: cPx / aPx, rotationDeg: 35 };
      renderOrbit(svg, ellipse, eclipticViewDirection);

      const orbit = svg.querySelector('ellipse[stroke-dasharray="5, 5"]');
      const transform = orbit.getAttribute("transform");

      const rotationRad = (ellipse.rotationDeg * Math.PI) / 180;
      for (const trueAnomaly of [0, Math.PI / 4, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
        const angle = trueAnomaly + rotationRad;
        const r =
          (ellipse.aPx * (1 - ellipse.ePx * ellipse.ePx)) /
          (1 + ellipse.ePx * Math.cos(trueAnomaly));
        const markerX = CENTER + r * Math.cos(angle);
        const markerY = CENTER + eclipticViewDirection * r * Math.sin(angle);
        expect(markerLiesOnEllipse(transform, ellipse, markerX, markerY)).toBe(true);
      }
    }
  );

  it("appends two AU text labels (top and bottom) showing the ring's real distance from the Sun", () => {
    const svg = createSvg();
    renderOrbit(svg, circleEllipse(200), -1);

    const expectedText = `${radiusFromAU(200).toFixed(1)} AU`;
    const labels = Array.from(svg.querySelectorAll("text")).filter(
      (t) => t.textContent === expectedText
    );
    expect(labels.length).toBe(2);
  });

  it("top AU label is above center and bottom label is below center", () => {
    const svg = createSvg();
    renderOrbit(svg, circleEllipse(200), -1);

    const labels = Array.from(svg.querySelectorAll("text[font-size='9']"));
    const ys = labels.map((t) => Number(t.getAttribute("y")));
    expect(ys.some((y) => y < CENTER)).toBe(true);
    expect(ys.some((y) => y > CENTER)).toBe(true);
  });

  it("AU labels are text-anchor: start and offset right of center", () => {
    const svg = createSvg();
    renderOrbit(svg, circleEllipse(200), -1);

    const labels = Array.from(svg.querySelectorAll("text[font-size='9']"));
    for (const label of labels) {
      expect(label.getAttribute("text-anchor")).toBe("start");
      expect(Number(label.getAttribute("x"))).toBeGreaterThanOrEqual(CENTER);
    }
  });

  it("formats the AU label to one decimal place", () => {
    const svg = createSvg();
    renderOrbit(svg, circleEllipse(100), -1);

    const expectedText = `${radiusFromAU(100).toFixed(1)} AU`;
    const texts = Array.from(svg.querySelectorAll("text")).map((t) => t.textContent);
    expect(texts.filter((t) => t === expectedText).length).toBe(2);
  });

  it("shows different AU values top vs bottom for an off-axis rotated ellipse", () => {
    const svg = createSvg();
    const aPx = 220;
    const cPx = 90;
    const bPx = Math.sqrt(aPx * aPx - cPx * cPx);
    const ellipse: CometVisualEllipse = { aPx, bPx, cPx, ePx: cPx / aPx, rotationDeg: 35 };
    renderOrbit(svg, ellipse, -1);

    const [topLabel, bottomLabel] = svg.querySelectorAll("text[font-size='9']");
    expect(topLabel.textContent).not.toBe(bottomLabel.textContent);
  });
});

describe("renderBody", () => {
  const earth = PLANETS.find((p) => p.name === "Earth");

  it("appends a dark then a lit half-disc path (and no circle) for an off-center body", () => {
    const svg = createSvg();
    renderBody(svg, 300, 250, earth, false);

    expect(svg.querySelector("circle")).toBeNull();

    const paths = Array.from(svg.querySelectorAll("path"));
    expect(paths.length).toBe(2);

    const [darkPath, litPath] = paths;
    // Dark half is drawn first, lit half last so the lit side paints on top.
    expect(darkPath.getAttribute("fill")).toBe(`color-mix(in srgb, ${earth.color} 35%, black)`);
    expect(litPath.getAttribute("fill")).toBe(earth.color);
    expect(darkPath.getAttribute("d")).not.toBeNull();
    expect(litPath.getAttribute("d")).not.toBeNull();
  });

  it("appends a plain circle (and no path) for a body at CENTER, e.g. the Sun", () => {
    const svg = createSvg();
    renderBody(svg, CENTER, CENTER, SUN, false);

    expect(svg.querySelector("path")).toBeNull();

    const circle = svg.querySelector("circle");
    expect(circle).not.toBeNull();
    expect(circle.getAttribute("cx")).toBe(String(CENTER));
    expect(circle.getAttribute("cy")).toBe(String(CENTER));
    expect(circle.getAttribute("r")).toBe(String(SUN.size));
    expect(circle.getAttribute("fill")).toBe(SUN.color);
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
    renderSaturnRings(svg, 200, 300, saturn);
    expect(svg.querySelectorAll("circle").length).toBe(2);
  });

  it("ring circles have fill: none (stroke-only)", () => {
    const svg = createSvg();
    renderSaturnRings(svg, 200, 300, saturn);
    for (const circle of svg.querySelectorAll("circle")) {
      expect(circle.getAttribute("fill")).toBe("none");
    }
  });

  it("ring circles are centered on the given x, y", () => {
    const svg = createSvg();
    renderSaturnRings(svg, 200, 300, saturn);
    for (const circle of svg.querySelectorAll("circle")) {
      expect(circle.getAttribute("cx")).toBe("200");
      expect(circle.getAttribute("cy")).toBe("300");
    }
  });

  it("outer ring has r=23 and stroke-width=2", () => {
    const svg = createSvg();
    renderSaturnRings(svg, 200, 300, saturn);
    const [outer] = svg.querySelectorAll("circle");
    expect(outer.getAttribute("r")).toBe("23");
    expect(outer.getAttribute("stroke-width")).toBe("2");
  });

  it("inner ring has r=18 and stroke-width=6", () => {
    const svg = createSvg();
    renderSaturnRings(svg, 200, 300, saturn);
    const rings = svg.querySelectorAll("circle");
    const inner = rings[1];
    expect(inner.getAttribute("r")).toBe("18");
    expect(inner.getAttribute("stroke-width")).toBe("6");
  });

  it("ring stroke color matches Saturn's body color with 0.6 opacity", () => {
    const svg = createSvg();
    renderSaturnRings(svg, 200, 300, saturn);
    const [outer] = svg.querySelectorAll("circle");
    expect(outer.getAttribute("stroke")).toBe(saturn.color);
    expect(outer.getAttribute("opacity")).toBe("0.6");
  });
});
