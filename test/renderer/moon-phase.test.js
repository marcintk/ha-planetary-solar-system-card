import { describe, expect, it } from "vitest";
import { renderMoonPhaseIndicator } from "../../src/renderer/moon-phase.js";
import { SVG_NS } from "../../src/renderer/svg-utils.js";

function createSvg() {
  return document.createElementNS(SVG_NS, "svg");
}

describe("renderMoonPhaseIndicator", () => {
  it("appends a <g> group with class moon-phase-indicator", () => {
    const svg = createSvg();
    renderMoonPhaseIndicator(svg, new Date("2024-01-15"), "north");

    const g = svg.querySelector("g.moon-phase-indicator");
    expect(g).not.toBeNull();
  });

  it("group contains a circle (moon disc)", () => {
    const svg = createSvg();
    renderMoonPhaseIndicator(svg, new Date("2024-01-15"), "north");

    const g = svg.querySelector("g.moon-phase-indicator");
    expect(g.querySelector("circle")).not.toBeNull();
  });

  it("group contains a text element with a phase name", () => {
    const svg = createSvg();
    renderMoonPhaseIndicator(svg, new Date("2024-01-15"), "north");

    const g = svg.querySelector("g.moon-phase-indicator");
    const text = g.querySelector("text");
    expect(text).not.toBeNull();
    expect(text.textContent.length).toBeGreaterThan(0);
  });

  it("renders Full Moon with an illuminated path", () => {
    const svg = createSvg();
    // 2024-01-25 is a Full Moon
    renderMoonPhaseIndicator(svg, new Date("2024-01-25T18:00:00Z"), "north");

    const g = svg.querySelector("g.moon-phase-indicator");
    const path = g.querySelector("path");
    expect(path).not.toBeNull();
    expect(g.querySelector("text").textContent).toBe("Full Moon");
  });

  it("renders New Moon with no illumination path", () => {
    const svg = createSvg();
    // 2024-01-11 is a New Moon
    renderMoonPhaseIndicator(svg, new Date("2024-01-11T12:00:00Z"), "north");

    const g = svg.querySelector("g.moon-phase-indicator");
    // New Moon has illumination < 0.01, so no path should be drawn
    const path = g.querySelector("path");
    expect(path).toBeNull();
    expect(g.querySelector("text").textContent).toBe("New Moon");
  });

  it("northern hemisphere waxing crescent has semicircle sweeping right", () => {
    const svg = createSvg();
    // ~4 days after New Moon = Waxing Crescent
    renderMoonPhaseIndicator(svg, new Date("2024-01-15T12:00:00Z"), "north");

    const g = svg.querySelector("g.moon-phase-indicator");
    const path = g.querySelector("path");
    expect(path).not.toBeNull();
    // The semicircle arc sweep flag should be 1 (right side lit)
    const d = path.getAttribute("d");
    // First arc: A r r 0 0 <sweep> ... — sweep=1 means clockwise = right side
    const arcMatch = d.match(/A (\d+) (\d+) 0 0 (\d)/);
    expect(arcMatch).not.toBeNull();
    expect(arcMatch[3]).toBe("1");
  });

  it("southern hemisphere waxing crescent has semicircle sweeping left", () => {
    const svg = createSvg();
    renderMoonPhaseIndicator(svg, new Date("2024-01-15T12:00:00Z"), "south");

    const g = svg.querySelector("g.moon-phase-indicator");
    const path = g.querySelector("path");
    expect(path).not.toBeNull();
    const d = path.getAttribute("d");
    const arcMatch = d.match(/A (\d+) (\d+) 0 0 (\d)/);
    expect(arcMatch).not.toBeNull();
    // sweep=0 means counter-clockwise = left side lit
    expect(arcMatch[3]).toBe("0");
  });

  it("text label uses start text-anchor", () => {
    const svg = createSvg();
    renderMoonPhaseIndicator(svg, new Date("2024-06-15"), "north");

    const text = svg.querySelector("g.moon-phase-indicator text");
    expect(text.getAttribute("text-anchor")).toBe("start");
  });
});
