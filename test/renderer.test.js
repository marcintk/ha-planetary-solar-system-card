import { describe, it, expect } from "vitest";
import { renderSolarSystem, calculateObserverAngle } from "../src/renderer.js";
import { PLANETS, calculatePlanetPosition } from "../src/planet-data.js";

function renderInto(container, date) {
  const { svg, bounds } = renderSolarSystem(date);
  container.appendChild(svg);
  return { svg, bounds };
}

describe("renderSolarSystem", () => {
  it("creates an SVG element inside the container", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg.getAttribute("viewBox")).toBe("0 0 800 800");
  });

  it("renders 8 orbit circles", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    // Orbits are dashed circles with stroke and no fill
    const orbitCircles = svg.querySelectorAll('circle[fill="none"][stroke-dasharray="5, 5"]');
    expect(orbitCircles.length).toBe(8);
  });

  it("renders Sun at center", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    // Sun is yellow/gold circle at center
    const sunCircle = svg.querySelector('circle[fill="#ffd700"]');
    expect(sunCircle).not.toBeNull();
    expect(sunCircle.getAttribute("cx")).toBe("400");
    expect(sunCircle.getAttribute("cy")).toBe("400");
  });

  it("renders planet labels", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    const texts = Array.from(svg.querySelectorAll("text")).map(
      (t) => t.textContent
    );
    expect(texts).toContain("Earth");
    expect(texts).toContain("Mars");
    expect(texts).toContain("Neptune");
    expect(texts).toContain("Moon");
  });

  it("renders AU distance labels on vertical axis in mirrored pairs", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    const auLabels = Array.from(svg.querySelectorAll("text")).filter((t) =>
      t.textContent.endsWith(" AU")
    );

    // 8 planets × 2 labels (top + bottom) = 16 AU labels
    expect(auLabels.length).toBe(16);

    // All labels should be offset right of x=400 (vertical season line)
    for (const label of auLabels) {
      expect(Number(label.getAttribute("x"))).toBeGreaterThan(400);
      expect(label.getAttribute("text-anchor")).toBe("start");
      // No rotation transform should be applied
      expect(label.getAttribute("transform")).toBeNull();
    }

    // For each AU value, there should be one label above and one below center
    const earthLabels = auLabels.filter((t) => t.textContent === "1.0 AU");
    expect(earthLabels.length).toBe(2);
    const ys = earthLabels.map((t) => Number(t.getAttribute("y")));
    expect(ys.some((y) => y < 400)).toBe(true); // top
    expect(ys.some((y) => y > 400)).toBe(true); // bottom
  });

  it("returns svg element without appending to container", () => {
    const { svg } = renderSolarSystem(new Date("2026-02-14"));
    expect(svg).not.toBeNull();
    expect(svg.tagName).toBe("svg");
  });

  it("renders dual visibility cones (180° outer + 150° inner)", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    const outerClip = svg.querySelector("clipPath#sky-clip-outer");
    const innerClip = svg.querySelector("clipPath#sky-clip-inner");
    expect(outerClip).not.toBeNull();
    expect(innerClip).not.toBeNull();

    // Both should have path-based wedges
    const outerPath = outerClip.querySelector("path");
    const innerPath = innerClip.querySelector("path");
    expect(outerPath).not.toBeNull();
    expect(innerPath).not.toBeNull();
    expect(outerPath.getAttribute("d")).toMatch(/^M .+ L .+ A .+ Z$/);
    expect(innerPath.getAttribute("d")).toMatch(/^M .+ L .+ A .+ Z$/);

    // 180° cone uses large-arc-flag=1, 150° cone uses large-arc-flag=0
    expect(outerPath.getAttribute("d")).toMatch(/A \d+ \d+ 0 1 1/);
    expect(innerPath.getAttribute("d")).toMatch(/A \d+ \d+ 0 0 1/);
  });

  it("day overlay covers observer's visible sky wedge", () => {
    const container = document.createElement("div");
    const date = new Date("2026-02-14");
    renderInto(container, date);

    const svg = container.querySelector("svg");
    const path = svg.querySelector("clipPath#sky-clip-inner path");
    const d = path.getAttribute("d");
    expect(d).toBeTruthy();

    // Path should define a wedge: M (apex) L (left edge) A (arc to right edge) Z
    expect(d).toMatch(/^M .+ L .+ A .+ Z$/);
  });

  it("day overlay position changes with different dates", () => {
    const c1 = document.createElement("div");
    const c2 = document.createElement("div");
    renderInto(c1, new Date("2024-01-01"));
    renderInto(c2, new Date("2024-07-01"));

    const path1 = c1.querySelector("clipPath#sky-clip-outer path");
    const path2 = c2.querySelector("clipPath#sky-clip-outer path");
    expect(path1.getAttribute("d")).not.toBe(
      path2.getAttribute("d")
    );
  });

  it("day overlay covers observer's visible sky based on local time", () => {
    const earth = PLANETS.find((p) => p.name === "Earth");

    // Use noon — observer faces toward the Sun
    const container = document.createElement("div");
    const date = new Date("2026-02-14T12:00:00");
    renderInto(container, date);

    const earthAngle = calculatePlanetPosition(earth, date);
    const observerAngle = calculateObserverAngle(earthAngle, date);
    const path = container.querySelector("clipPath#sky-clip-inner path");
    const d = path.getAttribute("d");

    // Parse the wedge path: M anchorX anchorY L leftX leftY A D D 0 large-arc sweep rightX rightY Z
    const nums = d.match(/[-\d.]+/g).map(Number);
    const anchorX = nums[0];
    const anchorY = nums[1];
    const leftX = nums[2];
    const leftY = nums[3];
    // Arc params: rx(4) ry(5) x-rot(6) large-arc(7) sweep-flag(8) rightX(9) rightY(10)
    const rightX = nums[9];
    const rightY = nums[10];

    // Midpoint of left and right edges should be in the observer's direction from anchor
    const midX = (leftX + rightX) / 2;
    const midY = (leftY + rightY) / 2;

    // Observer direction
    const obsDirX = Math.cos(observerAngle);
    const obsDirY = -Math.sin(observerAngle);

    // Vector from anchor to midpoint should align with observer direction
    const offsetX = midX - anchorX;
    const offsetY = midY - anchorY;
    const dot = offsetX * obsDirX + offsetY * obsDirY;
    expect(dot).toBeGreaterThan(0);
  });

  it("renders Saturn with dual concentric rings", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    // Saturn's rings are two stroke-only circles with Saturn's ring color (no dasharray)
    const ringColor = "rgba(224, 192, 128, 0.6)";
    const ringCircles = svg.querySelectorAll(`circle[stroke="${ringColor}"]`);
    expect(ringCircles.length).toBe(2);

    const outerRing = ringCircles[0];
    expect(outerRing.getAttribute("stroke-width")).toBe("2");
    expect(outerRing.getAttribute("r")).toBe("19");

    const innerRing = ringCircles[1];
    expect(innerRing.getAttribute("stroke-width")).toBe("2");
    expect(innerRing.getAttribute("r")).toBe("16");

    // Both rings use uniform stroke width
    expect(outerRing.getAttribute("stroke-width")).toBe(innerRing.getAttribute("stroke-width"));

    // Inter-ring gap (outer inner edge - inner outer edge) should be minimal
    const outerInnerEdge = 19 - 2 / 2; // 18px
    const innerOuterEdge = 16 + 2 / 2; // 17px
    const interRingGap = outerInnerEdge - innerOuterEdge;
    expect(interRingGap).toBe(1);

    // Planet-to-ring gap should be ≥ 2× inter-ring gap
    const bodyRadius = 13; // Saturn rendered at half size (26/2)
    const innerInnerEdge = 16 - 2 / 2; // 15px
    const planetToRingGap = innerInnerEdge - bodyRadius;
    expect(planetToRingGap).toBeGreaterThanOrEqual(interRingGap * 2);

    // No ellipses should exist
    expect(svg.querySelectorAll("ellipse").length).toBe(0);

    // Saturn's body should be rendered at half its data size (13px)
    const saturnBody = svg.querySelector('circle[fill="#e0c080"]');
    expect(saturnBody).not.toBeNull();
    expect(saturnBody.getAttribute("r")).toBe("13");
  });

  it("Saturn label renders above (after) both rings in SVG DOM order", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    const allElements = Array.from(svg.children);

    // Find Saturn's ring circles by ring color
    const ringColor = "rgba(224, 192, 128, 0.6)";
    const rings = svg.querySelectorAll(`circle[stroke="${ringColor}"]`);
    expect(rings.length).toBe(2);

    // Find Saturn's label text
    const saturnLabel = allElements.find(
      (el) => el.tagName === "text" && el.textContent === "Saturn"
    );
    expect(saturnLabel).not.toBeNull();

    // Label must come after both rings in DOM order
    const outerRingIdx = allElements.indexOf(rings[0]);
    const innerRingIdx = allElements.indexOf(rings[1]);
    const labelIdx = allElements.indexOf(saturnLabel);
    expect(labelIdx).toBeGreaterThan(outerRingIdx);
    expect(labelIdx).toBeGreaterThan(innerRingIdx);
  });

  it("Saturn ring is centered on Saturn body", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    // TODO(human): Write the assertion that verifies the ring ellipse
    // is centered at the same position as Saturn's body circle.
    // Hint: Saturn's color is "#e0c080" — find its circle, then compare
    // cx/cy with the ellipse's cx/cy.
  });

  it("no other planets have ring elements", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    // Only Saturn should have ring-colored circles
    const ringColor = "rgba(224, 192, 128, 0.6)";
    const ringCircles = svg.querySelectorAll(`circle[stroke="${ringColor}"]`);
    expect(ringCircles.length).toBe(2); // Only Saturn's dual rings
    // No ellipses
    expect(svg.querySelectorAll("ellipse").length).toBe(0);
  });

  it("renders Moon orbit as a dotted circle centered on Earth", () => {
    const container = document.createElement("div");
    const date = new Date("2026-02-14");
    renderInto(container, date);

    const svg = container.querySelector("svg");
    // Moon orbit: dashed circle with finer dash pattern than planet orbits
    const moonOrbit = svg.querySelector('circle[stroke-dasharray="2, 3"]');
    expect(moonOrbit).not.toBeNull();
    expect(moonOrbit.getAttribute("r")).toBe("22");
    expect(moonOrbit.getAttribute("stroke-width")).toBe("0.5");
    expect(moonOrbit.getAttribute("stroke")).toBe("rgba(255, 255, 255, 0.12)");
    expect(moonOrbit.getAttribute("fill")).toBe("none");

    // Should be centered at Earth's position
    const earth = PLANETS.find((p) => p.name === "Earth");
    const earthAngle = calculatePlanetPosition(earth, date);
    const earthCx = Number(moonOrbit.getAttribute("cx"));
    const earthCy = Number(moonOrbit.getAttribute("cy"));

    // Earth body circle should be at the same position
    const earthBody = svg.querySelector('circle[fill="#4a90d9"]');
    expect(earthCx).toBeCloseTo(Number(earthBody.getAttribute("cx")), 0);
    expect(earthCy).toBeCloseTo(Number(earthBody.getAttribute("cy")), 0);
  });

  it("Moon orbit circle appears before Moon body in SVG order", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    const allElements = Array.from(svg.children);

    // Moon orbit: the dashed circle with "2, 3" pattern
    const moonOrbit = svg.querySelector('circle[stroke-dasharray="2, 3"]');
    expect(moonOrbit).not.toBeNull();

    // Moon body: grey circle (#cccccc)
    const moonBody = svg.querySelector('circle[fill="#cccccc"]');
    expect(moonBody).not.toBeNull();

    const orbitIdx = allElements.indexOf(moonOrbit);
    const bodyIdx = allElements.indexOf(moonBody);
    expect(orbitIdx).toBeLessThan(bodyIdx);
  });

  it("renders different planet positions for different dates", () => {
    const c1 = document.createElement("div");
    const c2 = document.createElement("div");
    renderInto(c1, new Date("2024-01-01"));
    renderInto(c2, new Date("2024-07-01"));

    // Earth circle (blue) should be at different positions
    const earth1 = c1.querySelector('svg circle[fill="#4a90d9"]');
    const earth2 = c2.querySelector('svg circle[fill="#4a90d9"]');
    expect(earth1.getAttribute("cx")).not.toBe(earth2.getAttribute("cx"));
  });

  it("renders observer needle on Earth", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14T15:00:00"));

    const svg = container.querySelector("svg");
    const needle = svg.querySelector('line[stroke="rgba(255, 255, 255, 0.7)"]');
    expect(needle).not.toBeNull();
    expect(needle.getAttribute("stroke-width")).toBe("2");
  });

  it("observer needle points in observer angle direction with length equal to Earth body radius", () => {
    const earth = PLANETS.find((p) => p.name === "Earth");
    const date = new Date("2026-02-14T06:00:00");
    const container = document.createElement("div");
    renderInto(container, date);

    const svg = container.querySelector("svg");
    const needle = svg.querySelector('line[stroke="rgba(255, 255, 255, 0.7)"]');
    const x1 = Number(needle.getAttribute("x1"));
    const y1 = Number(needle.getAttribute("y1"));
    const x2 = Number(needle.getAttribute("x2"));
    const y2 = Number(needle.getAttribute("y2"));

    // Needle length should equal Earth's body radius (size = 10)
    const dx = x2 - x1;
    const dy = y2 - y1;
    const needleLength = Math.sqrt(dx * dx + dy * dy);
    expect(needleLength).toBeCloseTo(earth.size, 1);

    // The needle direction should match the observer angle (toward visible sky)
    const earthAngle = calculatePlanetPosition(earth, date);
    const observerAngle = calculateObserverAngle(earthAngle, date);

    const actualAngle = Math.atan2(-dy, dx); // SVG y is flipped
    const norm = (a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const diff = Math.abs(norm(actualAngle) - norm(observerAngle));
    const angleDiff = Math.min(diff, 2 * Math.PI - diff);
    expect(angleDiff).toBeLessThan(0.01);
  });

  it("observer needle has a tip dot", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14T12:00:00"));

    const svg = container.querySelector("svg");
    // Find the small dot at the needle tip (r=2, needle color)
    const dots = svg.querySelectorAll('circle[fill="rgba(255, 255, 255, 0.7)"]');
    expect(dots.length).toBe(1);
    expect(dots[0].getAttribute("r")).toBe("2");
  });
});

describe("season overlay", () => {
  it("renders two season dividing lines through the center", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    const seasonLines = svg.querySelectorAll('line[stroke="rgba(255, 255, 255, 0.25)"]');
    expect(seasonLines.length).toBe(2);

    // One horizontal, one vertical
    const horizontal = Array.from(seasonLines).find((l) => l.getAttribute("y1") === "400" && l.getAttribute("y2") === "400");
    const vertical = Array.from(seasonLines).find((l) => l.getAttribute("x1") === "400" && l.getAttribute("x2") === "400");
    expect(horizontal).not.toBeNull();
    expect(vertical).not.toBeNull();
  });

  it("renders four season labels", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    const textPaths = svg.querySelectorAll("textPath");
    expect(textPaths.length).toBe(4);

    const labels = Array.from(textPaths).map((tp) => tp.textContent);
    expect(labels).toContain("Spring");
    expect(labels).toContain("Summer");
    expect(labels).toContain("Autumn");
    expect(labels).toContain("Winter");
  });

  it("uses Northern Hemisphere mapping by default", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    const textPaths = svg.querySelectorAll("textPath");
    const labels = Array.from(textPaths).map((tp) => tp.textContent);
    // Default (north): Winter, Autumn, Summer, Spring order
    expect(labels).toEqual(["Winter", "Autumn", "Summer", "Spring"]);
  });

  it("swaps seasons for Southern Hemisphere", () => {
    const container = document.createElement("div");
    const { svg } = renderSolarSystem(new Date("2026-02-14"), "south");
    container.appendChild(svg);

    const textPaths = svg.querySelectorAll("textPath");
    const labels = Array.from(textPaths).map((tp) => tp.textContent);
    // South: Summer, Spring, Winter, Autumn order
    expect(labels).toEqual(["Summer", "Spring", "Winter", "Autumn"]);
  });

  it("top-half season labels use reversed arc sweep for left-to-right reading", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    const defs = svg.querySelector("defs");
    // Season arcs: 0=Winter(top-left, 90-180°), 1=Autumn(top-right, 0-90°),
    //              2=Summer(bottom-right, 270-360°), 3=Spring(bottom-left, 180-270°)
    const topArcs = [
      defs.querySelector("#season-arc-0"),
      defs.querySelector("#season-arc-1"),
    ];
    const bottomArcs = [
      defs.querySelector("#season-arc-2"),
      defs.querySelector("#season-arc-3"),
    ];

    // Top-half arcs should use sweep-flag=1 (reversed for readability)
    for (const arc of topArcs) {
      expect(arc.getAttribute("d")).toMatch(/A \d+ \d+ 0 0 1/);
    }
    // Bottom-half arcs should use sweep-flag=0 (original direction)
    for (const arc of bottomArcs) {
      expect(arc.getAttribute("d")).toMatch(/A \d+ \d+ 0 0 0/);
    }
  });

  it("top-half season label arcs use a larger radius than bottom-half arcs (outside Neptune)", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    const defs = svg.querySelector("defs");

    // Top-half arcs: 0=Winter(90-180°), 1=Autumn(0-90°)
    // Bottom-half arcs: 2=Summer(270-360°), 3=Spring(180-270°)
    const topArc = defs.querySelector("#season-arc-0");
    const bottomArc = defs.querySelector("#season-arc-2");

    // Extract radius from arc path "A <rx> <ry> ..."
    const extractRadius = (path) => {
      const match = path.getAttribute("d").match(/A ([\d.]+) ([\d.]+)/);
      return Number(match[1]);
    };

    const topRadius = extractRadius(topArc);
    const bottomRadius = extractRadius(bottomArc);
    expect(topRadius).toBe(368);
    expect(bottomRadius).toBe(380);
    expect(topRadius).toBeLessThan(bottomRadius);
  });

  it("season dividing lines are rendered before orbits (behind them)", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    const allElements = Array.from(svg.children);
    const seasonLine = allElements.find(
      (el) => el.tagName === "line" && el.getAttribute("stroke") === "rgba(255, 255, 255, 0.25)"
    );
    const firstOrbit = allElements.find(
      (el) => el.tagName === "circle" && el.getAttribute("fill") === "none" && el.getAttribute("stroke-dasharray") === "5, 5"
    );
    const seasonIdx = allElements.indexOf(seasonLine);
    const orbitIdx = allElements.indexOf(firstOrbit);
    expect(seasonIdx).toBeLessThan(orbitIdx);
  });
});

describe("calculateObserverAngle", () => {
  it("at midnight observer faces away from Sun", () => {
    const earthAngle = 1.5; // arbitrary orbital angle
    const date = new Date("2026-02-14T00:00:00");
    const angle = calculateObserverAngle(earthAngle, date);

    // At midnight: observerAngle = earthAngle (away from Sun)
    const expected = earthAngle;
    const norm = (a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const diff = Math.abs(norm(angle) - norm(expected));
    const angleDiff = Math.min(diff, 2 * Math.PI - diff);
    expect(angleDiff).toBeLessThan(0.001);
  });

  it("at noon observer faces toward Sun", () => {
    const earthAngle = 1.5;
    const date = new Date("2026-02-14T12:00:00");
    const angle = calculateObserverAngle(earthAngle, date);

    // At noon: observerAngle = earthAngle + PI (toward Sun)
    const expected = earthAngle + Math.PI;
    const norm = (a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const diff = Math.abs(norm(angle) - norm(expected));
    const angleDiff = Math.min(diff, 2 * Math.PI - diff);
    expect(angleDiff).toBeLessThan(0.001);
  });

  it("at 6AM observer is 90 degrees from midnight", () => {
    const earthAngle = 1.5;
    const date = new Date("2026-02-14T06:00:00");
    const angle = calculateObserverAngle(earthAngle, date);

    // At 6AM: 6/24 * 2PI = PI/2 offset from midnight
    const midnightAngle = earthAngle;
    const expected = midnightAngle + Math.PI / 2;
    const norm = (a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const diff = Math.abs(norm(angle) - norm(expected));
    const angleDiff = Math.min(diff, 2 * Math.PI - diff);
    expect(angleDiff).toBeLessThan(0.001);
  });

  it("midnight and noon overlays are ~180 degrees apart", () => {
    const c1 = document.createElement("div");
    const c2 = document.createElement("div");
    renderInto(c1, new Date("2026-02-14T00:00:00"));
    renderInto(c2, new Date("2026-02-14T12:00:00"));

    const path1 = c1.querySelector("clipPath#sky-clip-outer path");
    const path2 = c2.querySelector("clipPath#sky-clip-outer path");
    const d1 = path1.getAttribute("d");
    const d2 = path2.getAttribute("d");

    // Overlays at midnight vs noon should be different (rotated ~180°)
    expect(d1).not.toBe(d2);

    // Parse anchor and edge points from each wedge path
    const parseWedge = (d) => {
      const nums = d.match(/[-\d.]+/g).map(Number);
      return {
        anchorX: nums[0], anchorY: nums[1],
        leftX: nums[2], leftY: nums[3],
        rightX: nums[9], rightY: nums[10],
      };
    };

    const w1 = parseWedge(d1);
    const w2 = parseWedge(d2);

    // Midpoints of left/right edges as proxy for wedge direction
    const mid1X = (w1.leftX + w1.rightX) / 2 - w1.anchorX;
    const mid1Y = (w1.leftY + w1.rightY) / 2 - w1.anchorY;
    const mid2X = (w2.leftX + w2.rightX) / 2 - w2.anchorX;
    const mid2Y = (w2.leftY + w2.rightY) / 2 - w2.anchorY;

    // Dot product of opposite direction vectors should be negative
    const dot = mid1X * mid2X + mid1Y * mid2Y;
    expect(dot).toBeLessThan(0);
  });
});
