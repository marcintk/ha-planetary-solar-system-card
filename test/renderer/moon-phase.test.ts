import { describe, expect, it } from "vitest";
import { renderMoonPhaseDisc } from "../../src/renderer/moon-phase.js";

describe("renderMoonPhaseDisc", () => {
  it("returns a self-contained square <svg> that scales to its container", () => {
    const svg = renderMoonPhaseDisc(new Date("2024-01-15"), "north");

    expect(svg.tagName).toBe("svg");
    expect(svg.getAttribute("viewBox")).toBe("0 0 100 100");
    expect(svg.parentNode).toBeNull();
  });

  it("centres the disc in the tile, equal margin on all four sides", () => {
    const svg = renderMoonPhaseDisc(new Date("2024-01-15"), "north");

    const disc = svg.querySelector("circle");
    const cx = Number(disc.getAttribute("cx"));
    const cy = Number(disc.getAttribute("cy"));
    const r = Number(disc.getAttribute("r"));
    expect([cx, cy]).toEqual([50, 50]);
    // left, right, top and bottom margins all equal — no overflow, no drift.
    expect([cx - r, 100 - (cx + r), cy - r, 100 - (cy + r)]).toEqual([
      50 - r,
      50 - r,
      50 - r,
      50 - r,
    ]);
    expect(cx - r).toBeGreaterThan(0);
  });

  // The phase caption is HTML overlaid on the bottom of the tile, measured in Chromium as
  // starting 86.8 units down (72.19px of an 83.19px tile). A centred disc only clears that
  // because it is small enough; grow the radius and the longest names start reading against
  // the lit limb instead of the black backdrop.
  it("keeps the disc clear of the bottom caption band", () => {
    const CAPTION_TOP = 86.8;
    const svg = renderMoonPhaseDisc(new Date("2024-01-25T18:00:00Z"), "north"); // Full Moon
    const disc = svg.querySelector("circle");
    const cy = Number(disc.getAttribute("cy"));
    const r = Number(disc.getAttribute("r"));

    expect(cy + r).toBeLessThanOrEqual(CAPTION_TOP);
    // ...and the lit path, which at Full Moon spans the disc's full height.
    const d = svg.querySelector("path").getAttribute("d");
    const ys = [...d.matchAll(/[ ,](-?\d+(?:\.\d+)?)(?=[ ]|$)/g)].map((m) => Number(m[1]));
    expect(Math.max(...ys)).toBeLessThanOrEqual(CAPTION_TOP);
  });

  it("still fills most of the tile above the caption", () => {
    const svg = renderMoonPhaseDisc(new Date("2024-01-15"), "north");
    const r = Number(svg.querySelector("circle").getAttribute("r"));
    expect(r).toBeGreaterThanOrEqual(34);
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
