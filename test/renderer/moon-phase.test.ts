import { describe, expect, it } from "vitest";
import { renderMoonPhaseDisc } from "../../src/renderer/moon-phase.js";

describe("renderMoonPhaseDisc", () => {
  it("returns a self-contained square <svg> that scales to its container", () => {
    const svg = renderMoonPhaseDisc(new Date("2024-01-15"), "north");

    expect(svg.tagName).toBe("svg");
    expect(svg.getAttribute("viewBox")).toBe("0 0 100 100");
    expect(svg.parentNode).toBeNull();
  });

  it("centres the disc in the viewBox with no overflow", () => {
    const svg = renderMoonPhaseDisc(new Date("2024-01-15"), "north");

    const disc = svg.querySelector("circle");
    const cx = Number(disc.getAttribute("cx"));
    const cy = Number(disc.getAttribute("cy"));
    const r = Number(disc.getAttribute("r"));
    expect(cx).toBe(50);
    expect(cy).toBe(50);
    expect(cx - r).toBeGreaterThanOrEqual(0);
    expect(cy + r).toBeLessThanOrEqual(100);
  });

  // The phase name is rendered as HTML in the gallery tile, so it must not also be baked
  // into the SVG — that would double it up and re-introduce the 800x800-viewBox layout
  // assumptions the disc no longer has.
  it("draws no text label", () => {
    const svg = renderMoonPhaseDisc(new Date("2024-01-15"), "north");
    expect(svg.querySelector("text")).toBeNull();
  });

  it("renders Full Moon with an illuminated path", () => {
    // 2024-01-25 is a Full Moon
    const svg = renderMoonPhaseDisc(new Date("2024-01-25T18:00:00Z"), "north");
    expect(svg.querySelector("path")).not.toBeNull();
  });

  it("renders New Moon with no illumination path", () => {
    // 2024-01-11 is a New Moon: illumination < 0.01, so no lit path at all
    const svg = renderMoonPhaseDisc(new Date("2024-01-11T12:00:00Z"), "north");
    expect(svg.querySelector("path")).toBeNull();
  });

  it("northern hemisphere waxing crescent has semicircle sweeping right", () => {
    // ~4 days after New Moon = Waxing Crescent
    const svg = renderMoonPhaseDisc(new Date("2024-01-15T12:00:00Z"), "north");

    const d = svg.querySelector("path").getAttribute("d");
    // First arc: A r r 0 0 <sweep> ... — sweep=1 means clockwise = right side lit
    const arcMatch = d.match(/A (\d+) (\d+) 0 0 (\d)/);
    expect(arcMatch).not.toBeNull();
    expect(arcMatch[3]).toBe("1");
  });

  it("southern hemisphere waxing crescent has semicircle sweeping left", () => {
    const svg = renderMoonPhaseDisc(new Date("2024-01-15T12:00:00Z"), "south");

    const d = svg.querySelector("path").getAttribute("d");
    const arcMatch = d.match(/A (\d+) (\d+) 0 0 (\d)/);
    expect(arcMatch).not.toBeNull();
    // sweep=0 means counter-clockwise = left side lit
    expect(arcMatch[3]).toBe("0");
  });
});
