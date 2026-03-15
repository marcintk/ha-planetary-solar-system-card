import { describe, expect, it } from "vitest";
import { calculatePlanetPosition } from "../../src/astronomy/orbital-mechanics.js";
import { PLANETS } from "../../src/astronomy/planet-data.js";
import {
  CONE_ASTRONOMICAL,
  CONE_CIVIL,
  CONE_DAY,
  CONE_NAUTICAL,
  CONE_NIGHT,
  calculateObserverAngle,
  calculateSolarElevationDeg,
  rayCircleDistance,
  renderDayNightSplit,
  renderObserverNeedle,
} from "../../src/renderer/observer.js";
import { CENTER, MAX_RADIUS, SVG_NS } from "../../src/renderer/svg-utils.js";

function createSvg() {
  return document.createElementNS(SVG_NS, "svg");
}

// Normalize an angle to [0, 2π)
const norm = (a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
const angleDiff = (a, b) => {
  const d = Math.abs(norm(a) - norm(b));
  return Math.min(d, 2 * Math.PI - d);
};

describe("calculateObserverAngle", () => {
  it("at midnight observer faces away from Sun", () => {
    const earthAngle = 1.5;
    const date = new Date("2026-02-14T00:00:00");
    const angle = calculateObserverAngle(earthAngle, date);
    expect(angleDiff(angle, earthAngle)).toBeLessThan(0.001);
  });

  it("at noon observer faces toward Sun", () => {
    const earthAngle = 1.5;
    const date = new Date("2026-02-14T12:00:00");
    const angle = calculateObserverAngle(earthAngle, date);
    expect(angleDiff(angle, earthAngle + Math.PI)).toBeLessThan(0.001);
  });

  it("at 6AM observer is 90° from midnight", () => {
    const earthAngle = 1.5;
    const date = new Date("2026-02-14T06:00:00");
    const angle = calculateObserverAngle(earthAngle, date);
    expect(angleDiff(angle, earthAngle + Math.PI / 2)).toBeLessThan(0.001);
  });

  it("observer angles 12 hours apart are ~180° apart", () => {
    const earth = PLANETS.find((p) => p.name === "Earth");
    const date7am = new Date("2026-02-14T07:00:00");
    const date7pm = new Date("2026-02-14T19:00:00");
    const earthAngle = calculatePlanetPosition(earth, date7am);
    const obs7am = calculateObserverAngle(earthAngle, date7am);
    const obs7pm = calculateObserverAngle(earthAngle, date7pm);
    expect(angleDiff(obs7am, obs7pm)).toBeCloseTo(Math.PI, 3);
  });

  it("uses provided IANA timezone to compute local noon angle", () => {
    // 18:00 UTC in America/Chicago (CST, UTC-6) = 12:00 local noon
    // At noon: localTimeAngle = (12/24)*2π = π  →  result = earthAngle + π
    const earthAngle = 0;
    const date = new Date("2026-01-15T18:00:00Z");
    const angle = calculateObserverAngle(earthAngle, date, "America/Chicago");
    expect(angleDiff(angle, Math.PI)).toBeLessThan(0.001);
  });
});

describe("calculateSolarElevationDeg", () => {
  it("returns ~90° when observer faces directly toward the Sun (local noon)", () => {
    const earthAngle = 1.0;
    const observerAngle = earthAngle + Math.PI;
    expect(calculateSolarElevationDeg(observerAngle, earthAngle)).toBeCloseTo(90, 1);
  });

  it("returns ~-90° when observer faces directly away from the Sun (local midnight)", () => {
    const earthAngle = 1.0;
    const observerAngle = earthAngle;
    expect(calculateSolarElevationDeg(observerAngle, earthAngle)).toBeCloseTo(-90, 1);
  });

  it("returns ~0° when observer is perpendicular to Sun direction (horizon crossing)", () => {
    const earthAngle = 1.0;
    const observerAngle = earthAngle + Math.PI / 2;
    expect(calculateSolarElevationDeg(observerAngle, earthAngle)).toBeCloseTo(0, 1);
  });

  it("handles 2π wrap-around correctly", () => {
    const wrappedEarth = 0.1;
    const wrappedObserver = wrappedEarth + Math.PI + 2 * Math.PI;
    expect(calculateSolarElevationDeg(wrappedObserver, wrappedEarth)).toBeCloseTo(90, 1);
  });

  it("returns negative value when Sun is 30° below horizon", () => {
    const earthAngle = 1.0;
    const observerAngle = earthAngle + Math.PI / 3;
    expect(calculateSolarElevationDeg(observerAngle, earthAngle)).toBeCloseTo(-30, 1);
  });
});

describe("cone color constants", () => {
  it("exports five distinct cone colors", () => {
    const colors = new Set([CONE_DAY, CONE_CIVIL, CONE_NAUTICAL, CONE_ASTRONOMICAL, CONE_NIGHT]);
    expect(colors.size).toBe(5);
  });

  it("CONE_DAY is brightest (highest alpha)", () => {
    const extractAlpha = (c) => Number(c.match(/[\d.]+(?=\))/)[0]);
    expect(extractAlpha(CONE_DAY)).toBeGreaterThan(extractAlpha(CONE_CIVIL));
    expect(extractAlpha(CONE_CIVIL)).toBeGreaterThan(extractAlpha(CONE_NAUTICAL));
    expect(extractAlpha(CONE_NAUTICAL)).toBeGreaterThan(extractAlpha(CONE_ASTRONOMICAL));
    expect(extractAlpha(CONE_ASTRONOMICAL)).toBeGreaterThan(extractAlpha(CONE_NIGHT));
  });
});

describe("renderObserverNeedle", () => {
  it("appends a line element", () => {
    const svg = createSvg();
    renderObserverNeedle(svg, 400, 400, 0, 10);
    expect(svg.querySelector("line")).not.toBeNull();
  });

  it("needle starts at the Earth body center", () => {
    const svg = createSvg();
    renderObserverNeedle(svg, 350, 450, 0, 10);
    const line = svg.querySelector("line");
    expect(line.getAttribute("x1")).toBe("350");
    expect(line.getAttribute("y1")).toBe("450");
  });

  it("needle length equals earthSize", () => {
    const svg = createSvg();
    const earthSize = 10;
    renderObserverNeedle(svg, 400, 400, 0, earthSize);
    const line = svg.querySelector("line");
    const dx = Number(line.getAttribute("x2")) - Number(line.getAttribute("x1"));
    const dy = Number(line.getAttribute("y2")) - Number(line.getAttribute("y1"));
    expect(Math.sqrt(dx * dx + dy * dy)).toBeCloseTo(earthSize, 5);
  });

  it("needle tip points in the observer angle direction", () => {
    const svg = createSvg();
    const observerAngle = Math.PI / 4; // 45°
    renderObserverNeedle(svg, 400, 400, observerAngle, 20);
    const line = svg.querySelector("line");
    const dx = Number(line.getAttribute("x2")) - Number(line.getAttribute("x1"));
    const dy = Number(line.getAttribute("y2")) - Number(line.getAttribute("y1"));
    const actual = Math.atan2(-dy, dx); // SVG y-axis is inverted
    expect(angleDiff(actual, observerAngle)).toBeLessThan(0.001);
  });

  it("appends a small dot at the needle tip", () => {
    const svg = createSvg();
    renderObserverNeedle(svg, 400, 400, 0, 10);
    const dot = svg.querySelector("circle");
    expect(dot).not.toBeNull();
    expect(dot.getAttribute("r")).toBe("2");
  });

  it("tip dot is positioned at the end of the needle", () => {
    const svg = createSvg();
    renderObserverNeedle(svg, 400, 400, 0, 10); // angle=0 → tip at (410, 400)
    const line = svg.querySelector("line");
    const dot = svg.querySelector("circle");
    expect(dot.getAttribute("cx")).toBe(line.getAttribute("x2"));
    expect(dot.getAttribute("cy")).toBe(line.getAttribute("y2"));
  });
});

describe("rayCircleDistance", () => {
  it("returns positive distance when ray intersects circle", () => {
    // Point inside circle, shooting outward
    const d = rayCircleDistance(CENTER, CENTER, 1, 0, CENTER, CENTER, 100);
    expect(d).toBeCloseTo(100, 1);
  });

  it("returns minimum length when no positive intersection", () => {
    // Point far outside circle, shooting away from it
    const d = rayCircleDistance(CENTER + 1000, CENTER, 1, 0, CENTER, CENTER, 100);
    expect(d).toBe(20);
  });

  it("uses custom minimum length", () => {
    const d = rayCircleDistance(CENTER + 1000, CENTER, 1, 0, CENTER, CENTER, 100, 50);
    expect(d).toBe(50);
  });
});

describe("renderDayNightSplit horizon and zenith lines", () => {
  const CLIP_R = MAX_RADIUS + 30;
  const EXTRA = 8;

  it("renders two dashed lines (horizon + zenith)", () => {
    const svg = document.createElementNS(SVG_NS, "svg");
    const earth = PLANETS.find((p) => p.name === "Earth");
    renderDayNightSplit(svg, 200, new Date("2025-06-15T12:00:00Z"), earth.size, null);

    const lines = svg.querySelectorAll('line[stroke-dasharray="4, 4"]');
    expect(lines.length).toBe(2);
  });

  it("horizon line arms terminate at clip circle edge + 8px margin", () => {
    const svg = document.createElementNS(SVG_NS, "svg");
    const earth = PLANETS.find((p) => p.name === "Earth");
    renderDayNightSplit(svg, 200, new Date("2025-06-15T12:00:00Z"), earth.size, null);

    const lines = svg.querySelectorAll('line[stroke-dasharray="4, 4"]');
    const horizon = lines[0];

    const x1 = Number(horizon.getAttribute("x1"));
    const y1 = Number(horizon.getAttribute("y1"));
    const x2 = Number(horizon.getAttribute("x2"));
    const y2 = Number(horizon.getAttribute("y2"));

    // Each endpoint should be approximately CLIP_R + EXTRA from the SVG centre
    const dist1 = Math.sqrt((x1 - CENTER) ** 2 + (y1 - CENTER) ** 2);
    const dist2 = Math.sqrt((x2 - CENTER) ** 2 + (y2 - CENTER) ** 2);
    // Endpoints land near the clip circle edge (within margin tolerance)
    expect(dist1).toBeGreaterThan(CLIP_R - 5);
    expect(dist2).toBeGreaterThan(CLIP_R - 5);
  });

  it("zenith line is perpendicular to the horizon line", () => {
    const svg = document.createElementNS(SVG_NS, "svg");
    const earth = PLANETS.find((p) => p.name === "Earth");
    renderDayNightSplit(svg, 200, new Date("2025-06-15T12:00:00Z"), earth.size, null);

    const lines = svg.querySelectorAll('line[stroke-dasharray="4, 4"]');
    const horizon = lines[0];
    const zenith = lines[1];

    // Compute direction vectors
    const hDx = Number(horizon.getAttribute("x2")) - Number(horizon.getAttribute("x1"));
    const hDy = Number(horizon.getAttribute("y2")) - Number(horizon.getAttribute("y1"));
    const zDx = Number(zenith.getAttribute("x2")) - Number(zenith.getAttribute("x1"));
    const zDy = Number(zenith.getAttribute("y2")) - Number(zenith.getAttribute("y1"));

    // Dot product of perpendicular vectors should be ~0
    const dot = hDx * zDx + hDy * zDy;
    expect(dot).toBeCloseTo(0, 0);
  });

  it("both lines use same stroke style", () => {
    const svg = document.createElementNS(SVG_NS, "svg");
    const earth = PLANETS.find((p) => p.name === "Earth");
    renderDayNightSplit(svg, 200, new Date("2025-06-15T12:00:00Z"), earth.size, null);

    const lines = svg.querySelectorAll('line[stroke-dasharray="4, 4"]');
    for (const line of lines) {
      expect(line.getAttribute("stroke")).toBe("rgba(255, 255, 255, 0.3)");
      expect(line.getAttribute("stroke-width")).toBe("1");
    }
  });
});
