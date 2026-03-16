import { describe, expect, it } from "vitest";
import { calculatePlanetPosition } from "../../src/astronomy/orbital-mechanics.js";
import { PLANETS } from "../../src/astronomy/planet-data.js";
import { renderSolarSystem } from "../../src/renderer/index.js";
import {
  CONE_ASTRONOMICAL,
  CONE_CIVIL,
  CONE_DAY,
  CONE_NAUTICAL,
  CONE_NIGHT,
  calculateObserverAngle,
} from "../../src/renderer/observer.js";

function renderInto(container, date) {
  const { svg, bounds } = renderSolarSystem(date);
  container.appendChild(svg);
  return { svg, bounds };
}

// Returns the normalised dot product of the two edge vectors of a cone clip path.
// dot = cos(2 * halfAngle): value of -1 means 180° span; > -1 means wider.
function coneEdgeDot(svg, clipId) {
  const path = svg.querySelector(`clipPath#${clipId} path`);
  if (!path) return null;
  const nums = path
    .getAttribute("d")
    .match(/[-\d.]+/g)
    .map(Number);
  const anchorX = nums[0],
    anchorY = nums[1];
  const leftX = nums[2],
    leftY = nums[3];
  const rightX = nums[9],
    rightY = nums[10];
  const lDX = leftX - anchorX,
    lDY = leftY - anchorY;
  const rDX = rightX - anchorX,
    rDY = rightY - anchorY;
  const lLen = Math.sqrt(lDX * lDX + lDY * lDY);
  const rLen = Math.sqrt(rDX * rDX + rDY * rDY);
  return (lDX * rDX + lDY * rDY) / (lLen * rLen);
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
    const texts = Array.from(svg.querySelectorAll("text")).map((t) => t.textContent);
    expect(texts).toContain("Earth");
    expect(texts).toContain("Mars");
    expect(texts).toContain("Neptune");
    expect(texts).not.toContain("Moon");
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

  it("renders single visibility cone (180°) at Earth's position", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14T12:00:00"));

    const svg = container.querySelector("svg");
    const clip = svg.querySelector("clipPath#sky-clip");
    expect(clip).not.toBeNull();
    expect(svg.querySelector("clipPath#sky-clip-outer")).toBeNull();
    expect(svg.querySelector("clipPath#sky-clip-inner")).toBeNull();

    // Clip path contains a wedge
    const path = clip.querySelector("path");
    expect(path).not.toBeNull();
    expect(path.getAttribute("d")).toMatch(/^M .+ L .+ A .+ Z$/);

    // 90° half-angle → large-arc-flag=1
    expect(path.getAttribute("d")).toMatch(/A \d+ \d+ 0 1 1/);
  });

  it("cone uses day colour when Sun is above horizon", () => {
    const container = document.createElement("div");
    // Noon: observer faces Sun, elevation ≈ +90°
    renderInto(container, new Date("2026-02-14T12:00:00"));

    const svg = container.querySelector("svg");
    const cone = svg.querySelector('circle[clip-path="url(#sky-clip)"]');
    expect(cone).not.toBeNull();
    expect(cone.getAttribute("fill")).toBe(CONE_DAY);
  });

  it("cone uses astronomical colour when Sun is deep in twilight (5 AM, ≈ −15°)", () => {
    const container = document.createElement("div");
    // 5 AM: elevation ≈ -15° — in the astronomical twilight phase
    renderInto(container, new Date("2026-02-14T05:00:00"));

    const svg = container.querySelector("svg");
    const cone = svg.querySelector('circle[clip-path="url(#sky-clip)"]');
    expect(cone).not.toBeNull();
    expect(cone.getAttribute("fill")).toBe(CONE_ASTRONOMICAL);
  });

  it("cone rendered during full night", () => {
    const container = document.createElement("div");
    // Midnight: observer faces away from Sun, elevation ≈ -90°
    renderInto(container, new Date("2026-02-14T00:00:00"));

    const svg = container.querySelector("svg");
    const cone = svg.querySelector('circle[clip-path="url(#sky-clip)"]');
    expect(cone.getAttribute("fill")).toBe(CONE_NIGHT);
  });

  it("twilight cone half-angle expands beyond 90° as Sun descends below horizon", () => {
    const container = document.createElement("div");
    // 5AM: elevation ≈ -15° → half-angle ≈ 105°, cone spans ~210°
    renderInto(container, new Date("2026-02-14T05:00:00"));

    const svg = container.querySelector("svg");
    const dot = coneEdgeDot(svg, "sky-clip");
    expect(dot).not.toBeNull();
    expect(dot).toBeGreaterThan(-0.9); // clearly wider than 180°
  });

  it("day cone half-angle is exactly 90° (180° span)", () => {
    const container = document.createElement("div");
    // Noon: elevation ≈ +90° → half-angle exactly 90°
    renderInto(container, new Date("2026-02-14T12:00:00"));

    const svg = container.querySelector("svg");
    const path = svg.querySelector("clipPath#sky-clip path");
    const nums = path
      .getAttribute("d")
      .match(/[-\d.]+/g)
      .map(Number);
    const anchorX = nums[0],
      anchorY = nums[1];
    const leftX = nums[2],
      leftY = nums[3];
    const rightX = nums[9],
      rightY = nums[10];

    const leftDX = leftX - anchorX,
      leftDY = leftY - anchorY;
    const rightDX = rightX - anchorX,
      rightDY = rightY - anchorY;
    const leftLen = Math.sqrt(leftDX * leftDX + leftDY * leftDY);
    const rightLen = Math.sqrt(rightDX * rightDX + rightDY * rightDY);
    const dot = (leftDX * rightDX + leftDY * rightDY) / (leftLen * rightLen);
    expect(dot).toBeCloseTo(-1, 3); // exactly 180° span
  });

  it("cone uses day colour at exactly 0° elevation (horizon crossing)", () => {
    const container = document.createElement("div");
    // 6AM: observer perpendicular to Sun direction → elevation exactly 0°
    renderInto(container, new Date("2026-02-14T06:00:00"));

    const svg = container.querySelector("svg");
    const cone = svg.querySelector('circle[clip-path="url(#sky-clip)"]');
    expect(cone).not.toBeNull();
    expect(cone.getAttribute("fill")).toBe(CONE_DAY);
  });

  it("cone uses astronomical colour near the -18° twilight/night boundary", () => {
    const container = document.createElement("div");
    // 4:49 AM: elevation ≈ -17.75° — just inside the twilight zone (> -18°), astronomical phase
    renderInto(container, new Date("2026-02-14T04:49:00"));

    const svg = container.querySelector("svg");
    const cone = svg.querySelector('circle[clip-path="url(#sky-clip)"]');
    expect(cone).not.toBeNull();
    expect(cone.getAttribute("fill")).toBe(CONE_ASTRONOMICAL);
  });

  it("civil cone fill — warm colour during civil twilight (0° to -6°)", () => {
    const container = document.createElement("div");
    // 5:45 AM: elevation ≈ -3.75° — civil twilight phase
    renderInto(container, new Date("2026-02-14T05:45:00"));

    const svg = container.querySelector("svg");
    const cone = svg.querySelector('circle[clip-path="url(#sky-clip)"]');
    expect(cone).not.toBeNull();
    expect(cone.getAttribute("fill")).toBe(CONE_CIVIL);
    // Cone wider than 180° (half-angle > 90°) but less than 96°
    const dot = coneEdgeDot(svg, "sky-clip");
    expect(dot).toBeGreaterThan(-1);
    expect(dot).toBeLessThan(Math.cos((192 * Math.PI) / 180));
  });

  it("nautical cone fill — cool colour during nautical twilight (-6° to -12°)", () => {
    const container = document.createElement("div");
    // 5:24 AM: elevation ≈ -9° — nautical twilight phase
    renderInto(container, new Date("2026-02-14T05:24:00"));

    const svg = container.querySelector("svg");
    const cone = svg.querySelector('circle[clip-path="url(#sky-clip)"]');
    expect(cone).not.toBeNull();
    expect(cone.getAttribute("fill")).toBe(CONE_NAUTICAL);
    // Half-angle ≈ 99° → dot ≈ cos(198°) ≈ -0.951
    const dot = coneEdgeDot(svg, "sky-clip");
    expect(dot).toBeCloseTo(Math.cos((198 * Math.PI) / 180), 1);
  });

  it("astronomical cone fill — deep indigo during astronomical twilight (-12° to -18°)", () => {
    const container = document.createElement("div");
    // 5:00 AM: elevation ≈ -15° — astronomical twilight phase
    renderInto(container, new Date("2026-02-14T05:00:00"));

    const svg = container.querySelector("svg");
    const cone = svg.querySelector('circle[clip-path="url(#sky-clip)"]');
    expect(cone).not.toBeNull();
    expect(cone.getAttribute("fill")).toBe(CONE_ASTRONOMICAL);
    // Half-angle ≈ 105° → dot ≈ cos(210°) ≈ -0.866
    const dot = coneEdgeDot(svg, "sky-clip");
    expect(dot).toBeCloseTo(Math.cos((210 * Math.PI) / 180), 1);
  });

  it("only one twilight cone present in SVG per render", () => {
    const container = document.createElement("div");
    // 5:00 AM: elevation ≈ -15° (astronomical phase)
    renderInto(container, new Date("2026-02-14T05:00:00"));

    const svg = container.querySelector("svg");
    const fills = Array.from(svg.querySelectorAll("circle[clip-path]")).map((c) =>
      c.getAttribute("fill")
    );
    expect(fills).toContain(CONE_ASTRONOMICAL);
    expect(fills).not.toContain(CONE_CIVIL);
    expect(fills).not.toContain(CONE_NAUTICAL);
    expect(fills).not.toContain(CONE_DAY);
  });

  it("no twilight cones present during full daytime", () => {
    const container = document.createElement("div");
    // Noon: elevation ≈ +90°
    renderInto(container, new Date("2026-02-14T12:00:00"));

    const svg = container.querySelector("svg");
    const fills = Array.from(svg.querySelectorAll("circle[clip-path]")).map((c) =>
      c.getAttribute("fill")
    );
    expect(fills).not.toContain(CONE_CIVIL);
    expect(fills).not.toContain(CONE_NAUTICAL);
    expect(fills).not.toContain(CONE_ASTRONOMICAL);
  });

  it("no twilight cones present during full night", () => {
    const container = document.createElement("div");
    // Midnight: elevation ≈ -90°
    renderInto(container, new Date("2026-02-14T00:00:00"));

    const svg = container.querySelector("svg");
    const fills = Array.from(svg.querySelectorAll("circle[clip-path]")).map((c) =>
      c.getAttribute("fill")
    );
    expect(fills).not.toContain(CONE_CIVIL);
    expect(fills).not.toContain(CONE_NAUTICAL);
    expect(fills).not.toContain(CONE_ASTRONOMICAL);
  });

  it("renders horizon boundary line for all light conditions", () => {
    const dates = [
      new Date("2026-02-14T12:00:00"), // noon (day)
      new Date("2026-02-14T05:00:00"), // 5 AM (twilight)
      new Date("2026-02-14T00:00:00"), // midnight (night)
    ];

    for (const date of dates) {
      const container = document.createElement("div");
      renderInto(container, date);
      const svg = container.querySelector("svg");
      const horizonLine = svg.querySelector('line[stroke="rgba(255, 255, 255, 0.3)"]');
      expect(horizonLine).not.toBeNull();
      expect(horizonLine.getAttribute("stroke-dasharray")).toBe("4, 4");
    }
  });

  it("day overlay covers observer's visible sky wedge", () => {
    const container = document.createElement("div");
    const date = new Date("2026-02-14T12:00:00");
    renderInto(container, date);

    const svg = container.querySelector("svg");
    const path = svg.querySelector("clipPath#sky-clip path");
    const d = path.getAttribute("d");
    expect(d).toBeTruthy();

    // Path should define a wedge: M (apex) L (left edge) A (arc to right edge) Z
    expect(d).toMatch(/^M .+ L .+ A .+ Z$/);
  });

  it("day overlay position changes with different dates", () => {
    const c1 = document.createElement("div");
    const c2 = document.createElement("div");
    renderInto(c1, new Date("2024-01-01T12:00:00"));
    renderInto(c2, new Date("2024-07-01T12:00:00"));

    const path1 = c1.querySelector("clipPath#sky-clip path");
    const path2 = c2.querySelector("clipPath#sky-clip path");
    expect(path1.getAttribute("d")).not.toBe(path2.getAttribute("d"));
  });

  it("day overlay covers observer's visible sky based on local time", () => {
    const earth = PLANETS.find((p) => p.name === "Earth");

    // Use noon — observer faces toward the Sun
    const container = document.createElement("div");
    const date = new Date("2026-02-14T12:00:00");
    renderInto(container, date);

    const earthAngle = calculatePlanetPosition(earth, date);
    const observerAngle = calculateObserverAngle(earthAngle, date);
    const path = container.querySelector("clipPath#sky-clip path");
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
    expect(outerRing.getAttribute("r")).toBe("23");

    const innerRing = ringCircles[1];
    expect(innerRing.getAttribute("stroke-width")).toBe("6");
    expect(innerRing.getAttribute("r")).toBe("18");

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

    // No ellipses should exist (comet orbits use path, not ellipse)
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
    const saturnBody = svg.querySelector('circle[fill="#e0c080"]');
    expect(saturnBody).not.toBeNull();

    const ringColor = "rgba(224, 192, 128, 0.6)";
    const rings = svg.querySelectorAll(`circle[stroke="${ringColor}"]`);
    expect(rings.length).toBe(2);

    for (const ring of rings) {
      expect(ring.getAttribute("cx")).toBe(saturnBody.getAttribute("cx"));
      expect(ring.getAttribute("cy")).toBe(saturnBody.getAttribute("cy"));
    }
  });

  it("no other planets have ring elements", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    // Only Saturn should have ring-colored circles
    const ringColor = "rgba(224, 192, 128, 0.6)";
    const ringCircles = svg.querySelectorAll(`circle[stroke="${ringColor}"]`);
    expect(ringCircles.length).toBe(2); // Only Saturn's dual rings
    // No ellipses (comet orbits use path elements now)
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

  it("renders moon phase indicator group", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    const indicator = svg.querySelector("g.moon-phase-indicator");
    expect(indicator).not.toBeNull();
    expect(indicator.querySelector("circle")).not.toBeNull();
    expect(indicator.querySelector("text")).not.toBeNull();
    expect(indicator.querySelector("text").textContent.length).toBeGreaterThan(0);
  });
});

describe("renderSolarSystem zoom-level season overlay", () => {
  const date = new Date("2025-06-15");
  const sizes = { 1: 800, 2: 640, 3: 480, 4: 320 };

  function makeViewState(zoomLevel) {
    return {
      centerX: 400,
      centerY: 400,
      width: sizes[zoomLevel],
      height: sizes[zoomLevel],
      zoomLevel,
    };
  }

  it("includes season arc textPath elements at all zoom levels", () => {
    for (const zoom of [1, 2, 3, 4]) {
      const { svg } = renderSolarSystem(date, "north", null, makeViewState(zoom));
      const textPaths = svg.querySelectorAll("textPath");
      expect(textPaths.length).toBe(4);
    }
  });

  it("includes season arc textPath elements when no viewState is provided", () => {
    const { svg } = renderSolarSystem(date, "north", null, null);
    const textPaths = svg.querySelectorAll("textPath");
    expect(textPaths.length).toBe(4);
  });
});
