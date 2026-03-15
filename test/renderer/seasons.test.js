import { describe, expect, it } from "vitest";
import { getCurrentSeason, renderSeasonOverlay } from "../../src/renderer/seasons.js";
import { MAX_RADIUS, SVG_NS } from "../../src/renderer/svg-utils.js";

function createSvg() {
  return document.createElementNS(SVG_NS, "svg");
}

describe("renderSeasonOverlay", () => {
  it("appends two dividing lines through the center", () => {
    const svg = createSvg();
    renderSeasonOverlay(svg, "north");

    const lines = svg.querySelectorAll('line[stroke="rgba(255, 255, 255, 0.25)"]');
    expect(lines.length).toBe(2);
  });

  it("one line is horizontal and one is vertical", () => {
    const svg = createSvg();
    renderSeasonOverlay(svg, "north");

    const lines = Array.from(svg.querySelectorAll('line[stroke="rgba(255, 255, 255, 0.25)"]'));
    const horizontal = lines.find(
      (l) => l.getAttribute("y1") === "400" && l.getAttribute("y2") === "400"
    );
    const vertical = lines.find(
      (l) => l.getAttribute("x1") === "400" && l.getAttribute("x2") === "400"
    );
    expect(horizontal).not.toBeNull();
    expect(vertical).not.toBeNull();
  });

  it("appends exactly four textPath season labels", () => {
    const svg = createSvg();
    renderSeasonOverlay(svg, "north");
    expect(svg.querySelectorAll("textPath").length).toBe(4);
  });

  it("all four canonical season names are present", () => {
    const svg = createSvg();
    renderSeasonOverlay(svg, "north");
    const labels = Array.from(svg.querySelectorAll("textPath")).map((tp) => tp.textContent);
    expect(labels).toContain("Winter");
    expect(labels).toContain("Spring");
    expect(labels).toContain("Summer");
    expect(labels).toContain("Autumn");
  });

  it("Northern Hemisphere: Winter top-left, Autumn top-right, Summer bottom-right, Spring bottom-left", () => {
    const svg = createSvg();
    renderSeasonOverlay(svg, "north");
    const labels = Array.from(svg.querySelectorAll("textPath")).map((tp) => tp.textContent);
    expect(labels).toEqual(["Winter", "Autumn", "Summer", "Spring"]);
  });

  it("Southern Hemisphere swaps seasons appropriately", () => {
    const svg = createSvg();
    renderSeasonOverlay(svg, "south");
    const labels = Array.from(svg.querySelectorAll("textPath")).map((tp) => tp.textContent);
    expect(labels).toEqual(["Summer", "Spring", "Winter", "Autumn"]);
  });

  it("defaults to Northern Hemisphere when hemisphere is not 'south'", () => {
    const svg = createSvg();
    renderSeasonOverlay(svg, "north");
    const labels = Array.from(svg.querySelectorAll("textPath")).map((tp) => tp.textContent);
    expect(labels[0]).toBe("Winter");
  });

  it("creates arc path elements in <defs>", () => {
    const svg = createSvg();
    renderSeasonOverlay(svg, "north");
    const defs = svg.querySelector("defs");
    expect(defs).not.toBeNull();
    expect(defs.querySelectorAll("path").length).toBe(4);
  });

  it("arc paths are identified by season-arc-0 through season-arc-3", () => {
    const svg = createSvg();
    renderSeasonOverlay(svg, "north");
    const defs = svg.querySelector("defs");
    for (let i = 0; i < 4; i++) {
      expect(defs.querySelector(`#season-arc-${i}`)).not.toBeNull();
    }
  });

  it("top-half arcs (i=0,1) use sweep-flag=1 for left-to-right readability", () => {
    const svg = createSvg();
    renderSeasonOverlay(svg, "north");
    const defs = svg.querySelector("defs");
    for (const i of [0, 1]) {
      const path = defs.querySelector(`#season-arc-${i}`);
      expect(path.getAttribute("d")).toMatch(/A \d+ \d+ 0 0 1/);
    }
  });

  it("bottom-half arcs (i=2,3) use sweep-flag=0", () => {
    const svg = createSvg();
    renderSeasonOverlay(svg, "north");
    const defs = svg.querySelector("defs");
    for (const i of [2, 3]) {
      const path = defs.querySelector(`#season-arc-${i}`);
      expect(path.getAttribute("d")).toMatch(/A \d+ \d+ 0 0 0/);
    }
  });

  it("top-half arcs use smaller radius than bottom-half (to compensate visual offset)", () => {
    const svg = createSvg();
    renderSeasonOverlay(svg, "north");
    const defs = svg.querySelector("defs");

    const extractRadius = (path) => {
      const match = path.getAttribute("d").match(/A ([\d.]+) ([\d.]+)/);
      return Number(match[1]);
    };
    const topRadius = extractRadius(defs.querySelector("#season-arc-0"));
    const bottomRadius = extractRadius(defs.querySelector("#season-arc-2"));
    expect(topRadius).toBeLessThan(bottomRadius);
  });
});

describe("renderSeasonOverlay fixed label radius", () => {
  const expectedRadius = MAX_RADIUS + 20;

  function extractRadius(svg) {
    const path = svg.querySelector("defs #season-arc-2");
    const match = path.getAttribute("d").match(/A ([\d.]+) ([\d.]+)/);
    return Number(match[1]);
  }

  it("uses fixed radius MAX_RADIUS + 20", () => {
    const svg = createSvg();
    renderSeasonOverlay(svg, "north");
    expect(extractRadius(svg)).toBe(expectedRadius);
  });

  it("does not accept a viewState parameter", () => {
    expect(renderSeasonOverlay.length).toBe(2);
  });
});

describe("getCurrentSeason", () => {
  it("northern hemisphere returns correct season for each quarter", () => {
    expect(getCurrentSeason(new Date("2025-03-15"), "north")).toBe("Spring");
    expect(getCurrentSeason(new Date("2025-06-15"), "north")).toBe("Summer");
    expect(getCurrentSeason(new Date("2025-09-15"), "north")).toBe("Autumn");
    expect(getCurrentSeason(new Date("2025-12-15"), "north")).toBe("Winter");
  });

  it("southern hemisphere reverses seasons", () => {
    expect(getCurrentSeason(new Date("2025-03-15"), "south")).toBe("Autumn");
    expect(getCurrentSeason(new Date("2025-06-15"), "south")).toBe("Winter");
    expect(getCurrentSeason(new Date("2025-09-15"), "south")).toBe("Spring");
    expect(getCurrentSeason(new Date("2025-12-15"), "south")).toBe("Summer");
  });
});
