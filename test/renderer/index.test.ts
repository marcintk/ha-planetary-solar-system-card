import { describe, expect, it } from "vitest";
import {
  calculatePlanetOrbit,
  calculatePlanetPosition,
} from "../../src/astronomy/orbital-mechanics.js";
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
import { computePlanetVisualEllipse, packOrbitRadii } from "../../src/renderer/orbit-packing.js";
import { auToRadius, radiusFromAU, CENTER as SVG_CENTER } from "../../src/renderer/svg-utils.js";

function renderInto(container, date) {
  const { svg } = renderSolarSystem(date);
  container.appendChild(svg);
  return svg;
}

// Body position, tolerant of the two renderings bodies.ts produces: a plain
// <circle> for a body at CENTER (the Sun), or a lit half-disc <path> for an
// off-center body. For the path, the body centre is the midpoint of the two
// diameter endpoints in "M x1 y1 A r r 0 0 sweep x2 y2 Z".
function bodyPos(svg, hex) {
  const circle = svg.querySelector(`circle[fill="${hex}"]`);
  if (circle) {
    return { cx: Number(circle.getAttribute("cx")), cy: Number(circle.getAttribute("cy")) };
  }
  const path = svg.querySelector(`path[fill="${hex}"]`);
  const nums = path
    .getAttribute("d")
    .match(/-?\d+(\.\d+)?/g)
    .map(Number);
  // nums = [x1, y1, r, r, 0, 0, sweep, x2, y2]
  return { cx: (nums[0] + nums[7]) / 2, cy: (nums[1] + nums[8]) / 2 };
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

  it("renders 8 orbit ellipses", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    // Orbits are dashed ellipses with stroke and no fill
    const orbitEllipses = svg.querySelectorAll('ellipse[fill="none"][stroke-dasharray="5, 5"]');
    expect(orbitEllipses.length).toBe(8);
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

  it("renders planet and Moon labels", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    const texts = Array.from(svg.querySelectorAll("text")).map((t) => t.textContent);
    expect(texts).toContain("Earth");
    expect(texts).toContain("Mars");
    expect(texts).toContain("Neptune");
    expect(texts).toContain("Moon");
  });

  it("renders AU distance labels on vertical axis in top/bottom pairs", () => {
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

    // Labels are appended in PLANETS order, top then bottom per planet —
    // each pair should straddle CENTER=400 (the ring is drawn with the
    // Sun's focus, always inside the ellipse, so it always crosses the
    // vertical axis both above and below center).
    for (let i = 0; i < auLabels.length; i += 2) {
      const topY = Number(auLabels[i].getAttribute("y"));
      const bottomY = Number(auLabels[i + 1].getAttribute("y"));
      expect(topY).toBeLessThan(400);
      expect(bottomY).toBeGreaterThan(400);
    }
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

  it("colors.cone_* overrides the cone fill for each twilight band", () => {
    const overrides = {
      cone_day: "#111111",
      cone_twilight_civil: "#222222",
      cone_twilight_nautical: "#333333",
      cone_twilight_astronomical: "#444444",
      cone_night: "#555555",
    };
    const cases: [Date, string][] = [
      [new Date("2026-02-14T06:00:00"), overrides.cone_day],
      [new Date("2026-02-14T05:45:00"), overrides.cone_twilight_civil],
      [new Date("2026-02-14T05:24:00"), overrides.cone_twilight_nautical],
      [new Date("2026-02-14T05:00:00"), overrides.cone_twilight_astronomical],
      [new Date("2026-02-14T00:00:00"), overrides.cone_night],
    ];
    for (const [date, expectedFill] of cases) {
      const { svg } = renderSolarSystem(date, "north", null, overrides);
      const cone = svg.querySelector('circle[clip-path="url(#sky-clip)"]');
      expect(cone.getAttribute("fill")).toBe(expectedFill);
    }
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
      const horizonLine = svg.querySelector('line[stroke-dasharray="4, 4"]');
      expect(horizonLine).not.toBeNull();
      expect(horizonLine.getAttribute("style")).toBe(
        "stroke: color-mix(in srgb, currentColor 30%, transparent)"
      );
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

    // Daytime always renders a full 90 half-angle (a flat half-plane), so
    // averaging the left/right edge points collapses to the anchor itself
    // (cos(90 degrees) ~ 0) - numerically degenerate, sign is float noise.
    // Check the wedge edges directly instead: each should sit exactly
    // 90 degrees from observerAngle (eclipticViewDirection flips Y, see
    // renderVisibilityCone in observer.ts).
    const normalizeAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const leftAngle = Math.atan2(-(leftY - anchorY), leftX - anchorX);
    const rightAngle = Math.atan2(-(rightY - anchorY), rightX - anchorX);
    expect(normalizeAngle(leftAngle - observerAngle)).toBeCloseTo(Math.PI / 2, 5);
    expect(normalizeAngle(rightAngle - observerAngle)).toBeCloseTo(-Math.PI / 2, 5);
  });

  it("renders Saturn with dual concentric rings", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    // Saturn's rings are two stroke-only circles with Saturn's ring color (no dasharray)
    const ringCircles = svg.querySelectorAll('circle[stroke="#e0c080"][opacity="0.6"]');
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

    // Ellipses belong to planet/comet orbits only (no Saturn ring ellipses)
    const planetOrbitEllipses = svg.querySelectorAll('ellipse[stroke-dasharray="5, 5"]');
    const cometEllipses = svg.querySelectorAll('ellipse[stroke-dasharray="4, 8"]');
    expect(svg.querySelectorAll("ellipse").length).toBe(
      planetOrbitEllipses.length + cometEllipses.length
    );

    // Saturn's body should be rendered at half its data size (13px). Off-center,
    // so it's a lit half-disc <path> whose arc carries radii "13 13".
    const saturnBody = svg.querySelector('path[fill="#e0c080"]');
    expect(saturnBody).not.toBeNull();
    expect(saturnBody.getAttribute("d")).toContain("A 13 13");
  });

  it("Saturn label renders above (after) both rings in SVG DOM order", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    const allElements = Array.from(svg.children);

    // Find Saturn's ring circles by ring color
    const rings = svg.querySelectorAll('circle[stroke="#e0c080"][opacity="0.6"]');
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
    const { cx, cy } = bodyPos(svg, "#e0c080");

    const rings = svg.querySelectorAll('circle[stroke="#e0c080"][opacity="0.6"]');
    expect(rings.length).toBe(2);

    for (const ring of rings) {
      expect(Number(ring.getAttribute("cx"))).toBeCloseTo(cx, 6);
      expect(Number(ring.getAttribute("cy"))).toBeCloseTo(cy, 6);
    }
  });

  it("no other planets have ring elements", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    // Only Saturn should have ring-colored circles
    const ringCircles = svg.querySelectorAll('circle[stroke="#e0c080"][opacity="0.6"]');
    expect(ringCircles.length).toBe(2); // Only Saturn's dual rings
    // Ellipses are planet/comet orbits only
    const planetOrbitEllipses2 = svg.querySelectorAll('ellipse[stroke-dasharray="5, 5"]');
    const cometEllipses2 = svg.querySelectorAll('ellipse[stroke-dasharray="4, 8"]');
    expect(svg.querySelectorAll("ellipse").length).toBe(
      planetOrbitEllipses2.length + cometEllipses2.length
    );
  });

  it("renders Moon orbit as a dotted circle centered on Earth", () => {
    const container = document.createElement("div");
    const date = new Date("2026-02-14");
    renderInto(container, date);

    const svg = container.querySelector("svg");
    // Moon orbit: dashed circle drawn with the same stroke weight and dash pattern as
    // every other orbit (bodies.ts renderOrbit), so it does not read as a fainter ring.
    const moonOrbit = svg.querySelector('circle[stroke-dasharray="5, 5"]');
    expect(moonOrbit).not.toBeNull();
    expect(moonOrbit.getAttribute("r")).toBe("22");
    expect(moonOrbit.getAttribute("stroke-width")).toBe("1");
    expect(moonOrbit.getAttribute("style")).toContain("color-mix(in srgb, currentColor 12%");
    expect(moonOrbit.getAttribute("fill")).toBe("none");

    // Should be centered at Earth's position
    const earthCx = Number(moonOrbit.getAttribute("cx"));
    const earthCy = Number(moonOrbit.getAttribute("cy"));

    // Earth body should be at the same position
    const earthBody = bodyPos(svg, "#4a90d9");
    expect(earthCx).toBeCloseTo(earthBody.cx, 0);
    expect(earthCy).toBeCloseTo(earthBody.cy, 0);
  });

  it("Moon orbit circle appears before Moon body in SVG order", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14"));

    const svg = container.querySelector("svg");
    const allElements = Array.from(svg.children);

    // Moon orbit: the dashed circle, sharing the standard "5, 5" orbit pattern
    const moonOrbit = svg.querySelector('circle[stroke-dasharray="5, 5"]');
    expect(moonOrbit).not.toBeNull();

    // Moon body: grey half-disc (#cccccc is the lit path's fill; off-center body)
    const moonBody = svg.querySelector('path[fill="#cccccc"]');
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

    // Earth (blue) should be at different positions
    const earth1 = bodyPos(c1.querySelector("svg"), "#4a90d9");
    const earth2 = bodyPos(c2.querySelector("svg"), "#4a90d9");
    expect(earth1.cx).not.toBe(earth2.cx);
  });

  it("renders observer needle on Earth", () => {
    const container = document.createElement("div");
    renderInto(container, new Date("2026-02-14T15:00:00"));

    const svg = container.querySelector("svg");
    const needle = svg.querySelector('line[stroke-width="2"][style*="color-mix"]');
    expect(needle).not.toBeNull();
    expect(needle.getAttribute("stroke-width")).toBe("2");
  });

  it("observer needle points in observer angle direction with length equal to Earth body radius", () => {
    const earth = PLANETS.find((p) => p.name === "Earth");
    const date = new Date("2026-02-14T06:00:00");
    const container = document.createElement("div");
    renderInto(container, date);

    const svg = container.querySelector("svg");
    const needle = svg.querySelector('line[stroke-width="2"][style*="color-mix"]');
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
    const dots = Array.from(svg.querySelectorAll("circle[r='2']")).filter((el) =>
      el.getAttribute("style")?.includes("color-mix")
    );
    expect(dots.length).toBe(1);
    expect(dots[0].getAttribute("r")).toBe("2");
  });

  // Moved to the gallery strip in #140 — the orbiting moon marker stays, the phase disc
  // does not, so the solar view never draws the moon twice.
  it("does not render a moon phase indicator", () => {
    const { svg } = renderSolarSystem(new Date("2024-01-15T12:00:00Z"), "north", null, {}, false);
    expect(svg.querySelector("g.moon-phase-indicator")).toBeNull();
  });
});

describe("renderSolarSystem ecliptic_view", () => {
  const DATE = new Date("2026-06-01");
  const CENTER = 400;

  function getEarthPosition(eclipticView) {
    const { positions } = renderSolarSystem(DATE, "north", null, {}, eclipticView);
    return positions.find((p) => p.name === "Earth");
  }

  it("planet Y-coordinates mirror around CENTER when flipped", () => {
    const normal = getEarthPosition(false);
    const flipped = getEarthPosition(true);
    expect(normal.x).toBeCloseTo(flipped.x, 3);
    expect(normal.y + flipped.y).toBeCloseTo(2 * CENTER, 3);
  });

  it("default (eclipticView=false) places planet at CENTER - radius*sin(angle)", () => {
    const earth = PLANETS.find((p) => p.name === "Earth");
    const earthIndex = PLANETS.indexOf(earth);
    const { angle, trueAnomaly } = calculatePlanetOrbit(earth, DATE);
    const packedOffset = packOrbitRadii(PLANETS)[earthIndex] - auToRadius(earth.au);
    const { aPx, ePx } = computePlanetVisualEllipse(earth, packedOffset);
    const radius = (aPx * (1 - ePx * ePx)) / (1 + ePx * Math.cos(trueAnomaly));
    const { positions } = renderSolarSystem(DATE, "north", null, {}, false);
    const pos = positions.find((p) => p.name === "Earth");
    expect(pos.y).toBeCloseTo(CENTER - radius * Math.sin(angle), 5);
  });

  it("flipped view produces a different Y for a planet not on the equator", () => {
    const normal = getEarthPosition(false);
    const flipped = getEarthPosition(true);
    // Only equal if sin(angle) == 0 (planet on X-axis), extremely unlikely
    if (Math.abs(normal.y - CENTER) > 0.5) {
      expect(normal.y).not.toBeCloseTo(flipped.y, 1);
    }
  });
});

// Parses transform="matrix(a, b, c, d, e, f)" and reports whether a marker
// point lies on the drawn ellipse (rx, ry, local center 0,0).
function markerLiesOnDrawnEllipse(
  transform: string,
  rx: number,
  ry: number,
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
  const value = (localX / rx) ** 2 + (localY / ry) ** 2;
  return Math.abs(value - 1) < 1e-9;
}

describe("renderSolarSystem — planet markers stay on their drawn orbit ellipse (#94)", () => {
  const dates = [
    new Date("2024-01-01"),
    new Date("2024-04-15"),
    new Date("2025-09-01"),
    new Date("2026-02-14"),
  ];

  it.each([
    ["north (ecliptic_view: north / default)", false],
    ["south (ecliptic_view: south)", true],
  ])("every planet marker lies exactly on its drawn orbit ellipse — %s", (_label, eclipticView) => {
    for (const date of dates) {
      const { svg, positions } = renderSolarSystem(date, "north", null, {}, eclipticView);
      const orbitEllipses = Array.from(
        svg.querySelectorAll('ellipse[fill="none"][stroke-dasharray="5, 5"]')
      );
      expect(orbitEllipses.length).toBe(PLANETS.length);

      for (const planet of PLANETS) {
        // renderSolarSystem draws orbit ellipses in PLANETS order, so match
        // each planet to its ellipse by index rather than duplicating the
        // renderer's ellipse math here.
        const ellipseEl = orbitEllipses[PLANETS.indexOf(planet)];
        const rx = Number(ellipseEl.getAttribute("rx"));
        const ry = Number(ellipseEl.getAttribute("ry"));
        const transform = ellipseEl.getAttribute("transform");
        const pos = positions.find((p) => p.name === planet.name);
        expect(markerLiesOnDrawnEllipse(transform, rx, ry, pos.x, pos.y)).toBe(true);
      }
    }
  });
});

// Samples the drawn ellipse (rx, ry, local center 0,0, given transform) and
// returns the shortest distance from (x, y) to any point on it.
function distanceToDrawnEllipse(
  transform: string,
  rx: number,
  ry: number,
  x: number,
  y: number
): number {
  const [a, b, c, d, e, f] = transform
    .replace(/matrix\(|\)/g, "")
    .split(",")
    .map(Number);

  let minDist = Infinity;
  const STEPS = 2000;
  for (let i = 0; i < STEPS; i++) {
    const t = (2 * Math.PI * i) / STEPS;
    const localX = rx * Math.cos(t);
    const localY = ry * Math.sin(t);
    const px = a * localX + c * localY + e;
    const py = b * localX + d * localY + f;
    const dist = Math.hypot(px - x, py - y);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

describe("renderSolarSystem — AU labels sit next to the drawn orbit ring (#94)", () => {
  it("every AU label sits within a few pixels of the drawn ellipse", () => {
    const date = new Date("2026-02-14");
    const { svg } = renderSolarSystem(date, "north", null, {}, false);

    const orbitEllipses = Array.from(
      svg.querySelectorAll('ellipse[fill="none"][stroke-dasharray="5, 5"]')
    );
    const auLabels = Array.from(svg.querySelectorAll('text[font-size="9"]'));
    expect(auLabels.length).toBe(PLANETS.length * 2);

    // Labels sit LABEL_OFFSET=3px right of the ring and (top: 3px above,
    // bottom: 3+6px below) for readability, so exact-on-ring isn't the
    // target — max designed offset is the bottom label's diagonal, ~9.5px.
    const LABEL_TOLERANCE_PX = 10;

    PLANETS.forEach((_planet, i) => {
      const ellipseEl = orbitEllipses[i];
      const rx = Number(ellipseEl.getAttribute("rx"));
      const ry = Number(ellipseEl.getAttribute("ry"));
      const transform = ellipseEl.getAttribute("transform");

      const [topLabel, bottomLabel] = auLabels.slice(i * 2, i * 2 + 2);
      for (const label of [topLabel, bottomLabel]) {
        const x = Number(label.getAttribute("x"));
        const y = Number(label.getAttribute("y"));
        const dist = distanceToDrawnEllipse(transform, rx, ry, x, y);
        expect(dist).toBeLessThanOrEqual(LABEL_TOLERANCE_PX);
      }
    });
  });

  // Mercury has by far the largest eccentricity (e≈0.206) and a non-trivial
  // longitudeOfPerihelion (≈77°), so its ring's top/bottom AU labels are the
  // clearest case where the old CENTER±semi-major-axis placement broke
  // (#94) — both showed "0.4 AU" regardless of hemisphere. Pin the fixed
  // behavior down for Mercury specifically, in both ecliptic_view settings.
  it.each([
    ["north (ecliptic_view: north / default)", false],
    ["south (ecliptic_view: south)", true],
  ])(
    "Mercury's top and bottom AU labels are distinct and match the ring — %s",
    (_label, eclipticView) => {
      const mercury = PLANETS.find((p) => p.name === "Mercury");
      const mercuryIndex = PLANETS.indexOf(mercury);
      const { svg } = renderSolarSystem(new Date("2026-02-14"), "north", null, {}, eclipticView);

      const orbitEllipses = Array.from(
        svg.querySelectorAll('ellipse[fill="none"][stroke-dasharray="5, 5"]')
      );
      const auLabels = Array.from(svg.querySelectorAll('text[font-size="9"]'));
      const [topLabel, bottomLabel] = auLabels.slice(mercuryIndex * 2, mercuryIndex * 2 + 2);

      // Distinct values — the bug this test guards against printed the same
      // "0.4 AU" (Mercury's semi-major axis) on both sides.
      expect(topLabel.textContent).not.toBe(bottomLabel.textContent);

      // Both readings fall within Mercury's real perihelion/aphelion range.
      const perihelion = mercury.au * (1 - mercury.eccentricity);
      const aphelion = mercury.au * (1 + mercury.eccentricity);
      for (const label of [topLabel, bottomLabel]) {
        const shownAU = Number.parseFloat(label.textContent);
        expect(shownAU).toBeGreaterThanOrEqual(perihelion - 0.05);
        expect(shownAU).toBeLessThanOrEqual(aphelion + 0.05);
      }

      // Each label's printed value matches the ring's real distance from the
      // Sun at the exact point where the ring crosses the vertical axis — the
      // Sun's focus always maps to exactly (CENTER, CENTER) under the ring's
      // transform, so that crossing point can be solved independently here
      // rather than trusting the renderer's own computation.
      const ellipseEl = orbitEllipses[mercuryIndex];
      const rx = Number(ellipseEl.getAttribute("rx"));
      const ry = Number(ellipseEl.getAttribute("ry"));
      const transform = ellipseEl.getAttribute("transform");
      const [a, b, c, d, e, f] = transform
        .replace(/matrix\(|\)/g, "")
        .split(",")
        .map(Number);
      const A = a * rx;
      const B = c * ry;
      const radius = Math.hypot(A, B);
      const phi = Math.atan2(B, A);
      const delta = Math.acos(Math.max(-1, Math.min(1, (SVG_CENTER - e) / radius)));
      const crossings = [phi + delta, phi - delta].map((t) => {
        const localX = rx * Math.cos(t);
        const localY = ry * Math.sin(t);
        return { x: a * localX + c * localY + e, y: b * localX + d * localY + f };
      });
      const [topCrossing, bottomCrossing] =
        crossings[0].y <= crossings[1].y ? crossings : [crossings[1], crossings[0]];

      const expectedTopAU = radiusFromAU(
        Math.hypot(topCrossing.x - SVG_CENTER, topCrossing.y - SVG_CENTER)
      );
      const expectedBottomAU = radiusFromAU(
        Math.hypot(bottomCrossing.x - SVG_CENTER, bottomCrossing.y - SVG_CENTER)
      );
      // Printed text is rounded to 1 decimal place, so allow that rounding.
      expect(Number.parseFloat(topLabel.textContent)).toBeCloseTo(expectedTopAU, 1);
      expect(Number.parseFloat(bottomLabel.textContent)).toBeCloseTo(expectedBottomAU, 1);
    }
  );
});
