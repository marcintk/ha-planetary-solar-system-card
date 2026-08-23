import { describe, expect, it } from "vitest";
import { calculatePlanetPosition } from "../../src/astronomy/orbital-mechanics.js";
import { PLANETS } from "../../src/astronomy/planet-data.js";
import {
  computeSolarElevationDeg,
  computeZenithAngleFromSun,
} from "../../src/astronomy/solar-position.js";
import {
  CONE_ASTRONOMICAL,
  CONE_CIVIL,
  CONE_DAY,
  CONE_NAUTICAL,
  CONE_NIGHT,
  calculateObserverAngle,
  calculateSolarElevationDeg,
  computeTwilightBand,
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

  it("CONE_DAY mixes currentColor so it auto-inverts between light and dark theme", () => {
    // A fixed white rgba is invisible on a light card background — mixing currentColor
    // (same trick as NEEDLE_COLOR/ORBIT_COLOR) makes it dark-on-light, light-on-dark.
    expect(CONE_DAY).toContain("currentColor");
  });

  it("cone colors darken from civil to night", () => {
    // Twilight/night zones each carry their own hue mixed with currentColor for legibility
    // on both themes; the underlying hue's RGB sum should still fall monotonically across
    // the elevation bands as the sky gets darker.
    const rgbSum = (c) => {
      const [, r, g, b] = c.match(/rgb\((\d+), (\d+), (\d+)\)/).map(Number);
      return r + g + b;
    };
    expect(rgbSum(CONE_CIVIL)).toBeGreaterThan(rgbSum(CONE_NAUTICAL));
    expect(rgbSum(CONE_NAUTICAL)).toBeGreaterThan(rgbSum(CONE_ASTRONOMICAL));
    expect(rgbSum(CONE_ASTRONOMICAL)).toBeGreaterThan(rgbSum(CONE_NIGHT));
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

  it("eclipticViewDirection=1 mirrors tip Y around earthY compared to eclipticViewDirection=-1", () => {
    const earthY = 400;
    const angle = Math.PI / 4;
    const size = 20;

    const svgNormal = createSvg();
    renderObserverNeedle(svgNormal, 400, earthY, angle, size, -1);
    const lineNormal = svgNormal.querySelector("line");

    const svgFlipped = createSvg();
    renderObserverNeedle(svgFlipped, 400, earthY, angle, size, 1);
    const lineFlipped = svgFlipped.querySelector("line");

    const y1 = Number(lineNormal.getAttribute("y2"));
    const y2 = Number(lineFlipped.getAttribute("y2"));
    expect(y1 + y2).toBeCloseTo(2 * earthY, 5);
    expect(lineNormal.getAttribute("x2")).toBe(lineFlipped.getAttribute("x2"));
  });
});

describe("renderDayNightSplit flip_view", () => {
  it("eclipticViewDirection=1 mirrors anchor Y around CENTER compared to eclipticViewDirection=-1", () => {
    const date = new Date("2025-06-15T06:00:00Z");

    const svgNormal = createSvg();
    renderDayNightSplit(svgNormal, 200, date, null, -1);
    const pathNormal = svgNormal.querySelector("clipPath path");

    const svgFlipped = createSvg();
    renderDayNightSplit(svgFlipped, 200, date, null, 1);
    const pathFlipped = svgFlipped.querySelector("clipPath path");

    // Anchor Y is the first pair of numbers in the path "M anchorX anchorY ..."
    const anchorYNormal = Number(pathNormal.getAttribute("d").match(/[-\d.]+/g)[1]);
    const anchorYFlipped = Number(pathFlipped.getAttribute("d").match(/[-\d.]+/g)[1]);
    expect(anchorYNormal + anchorYFlipped).toBeCloseTo(2 * CENTER, 1);
  });
});

describe("renderDayNightSplit cone bisector geometry", () => {
  // Extract cone bisector angle from the rendered SVG clip path.
  // Path format: "M anchorX anchorY L leftX leftY A D D 0 flag 1 rightX rightY Z"
  // Number indices: [0]=anchorX [1]=anchorY [2]=leftX [3]=leftY [9]=rightX [10]=rightY
  //
  // General approach: normalize both edge vectors and sum them — the sum points toward
  // the bisector for any halfAngle ≠ 90°. When halfAngle = 90° the edges are exactly
  // antiparallel (sum ≈ 0), so fall back to leftAngleMath − π/2 (exact algebraic form).
  function coneBisectorAngle(svg: SVGElement): number {
    const path = svg.querySelector("clipPath path");
    const coords = path
      .getAttribute("d")
      .match(/-?[\d.]+/g)
      .map(Number);
    const anchorX = coords[0];
    const anchorY = coords[1];
    const leftX = coords[2];
    const leftY = coords[3];
    const rightX = coords[9];
    const rightY = coords[10];
    // SVG y is inverted (eclipticViewDirection = -1), flip back to math coords
    const lx = leftX - anchorX;
    const ly = -(leftY - anchorY);
    const rx = rightX - anchorX;
    const ry = -(rightY - anchorY);
    const ll = Math.sqrt(lx * lx + ly * ly);
    const rl = Math.sqrt(rx * rx + ry * ry);
    const sx = lx / ll + rx / rl;
    const sy = ly / ll + ry / rl;
    // Antiparallel fallback for halfAngle = 90° (daytime / full-night cones)
    if (Math.sqrt(sx * sx + sy * sy) < 0.01) {
      return Math.atan2(ly, lx) - Math.PI / 2;
    }
    return Math.atan2(sy, sx);
  }

  const earth = PLANETS.find((p) => p.name === "Earth");

  it("raw 2D angle at 55°N July 19:00 UTC places observer 105° past Sun (night side)", () => {
    // Prove the pre-fix angle is wrong: timezone-based observerAngle is > 90° from sunDir.
    // Uses explicit timezone so the result is deterministic regardless of locale.
    const date = new Date("2025-07-15T19:00:00Z");
    const earthAngle = calculatePlanetPosition(earth, date);
    const sunDir = earthAngle + Math.PI;
    const observerAngle2D = calculateObserverAngle(earthAngle, date, "Europe/London", 0);
    const diffFromSun = Math.abs(
      Math.atan2(Math.sin(observerAngle2D - sunDir), Math.cos(observerAngle2D - sunDir))
    );
    expect(diffFromSun).toBeGreaterThan(Math.PI / 2);
  });

  it("with lat/lon at 55°N July 19:00 UTC, rendered cone bisector is on daytime side", () => {
    // Spherical elevation ≈ +8.5°. The corrected displayObserverAngle is < 90° from sunDir,
    // so the cone must open toward the lit half-space.
    const date = new Date("2025-07-15T19:00:00Z");
    const locationData = { lat: 55, lon: 0, timezone: "Europe/London" };
    const earthAngle = calculatePlanetPosition(earth, date);
    const sunDir = earthAngle + Math.PI;

    const svg = createSvg();
    renderDayNightSplit(svg, 200, date, locationData);

    const bisector = coneBisectorAngle(svg);
    const diffFromSun = Math.abs(
      Math.atan2(Math.sin(bisector - sunDir), Math.cos(bisector - sunDir))
    );
    expect(diffFromSun).toBeLessThan(Math.PI / 2);
  });

  it("cone bisector extraction is consistent with direct azimuth-based angle", () => {
    // End-to-end check: bisector read from SVG should match the angle the fix computes.
    const date = new Date("2025-07-15T19:00:00Z");
    const locationData = { lat: 55, lon: 0, timezone: "Europe/London" };
    const earthAngle = calculatePlanetPosition(earth, date);
    const expectedBisector =
      earthAngle + Math.PI + computeZenithAngleFromSun(locationData.lat, locationData.lon, date);

    const svg = createSvg();
    renderDayNightSplit(svg, 200, date, locationData);

    const bisector = coneBisectorAngle(svg);
    expect(angleDiff(bisector, expectedBisector)).toBeLessThan(0.05); // within ~3°
  });

  it("south view (eclipticViewDirection=1) sweeps the arc through the bisector, not the opposite/major arc", () => {
    // Mirroring the scene reverses screen chirality, so the sweep flag that traces the
    // wedge through the bisector for north (-1) traces the complementary arc for south (1)
    // unless the sweep flag itself is flipped too. Regression for that bug: assert the
    // rendered sweep-flag digit in the path's "A" command differs between the two views.
    const date = new Date("2025-07-15T19:00:00Z");
    const locationData = { lat: 55, lon: 0, timezone: "Europe/London" };

    const svgNorth = createSvg();
    renderDayNightSplit(svgNorth, 200, date, locationData, -1);
    const svgSouth = createSvg();
    renderDayNightSplit(svgSouth, 200, date, locationData, 1);

    const sweepFlagOf = (svg: SVGElement) =>
      svg
        .querySelector("clipPath path")
        .getAttribute("d")
        .match(/A [\d.]+ [\d.]+ 0 (\d) (\d)/)[2];

    expect(sweepFlagOf(svgNorth)).toBe("1");
    expect(sweepFlagOf(svgSouth)).toBe("0");
  });
});

describe("renderDayNightSplit twilight cone/line edges drift from the Sun", () => {
  // Extract the near-Sun cone edge angle from the rendered SVG clip path.
  // Path format: "M anchorX anchorY L leftX leftY A D D 0 flag 1 rightX rightY Z"
  function coneEdgeAngles(svg: SVGElement): { left: number; right: number } {
    const path = svg.querySelector("clipPath path");
    const coords = path
      .getAttribute("d")
      .match(/-?[\d.]+/g)
      .map(Number);
    const anchorX = coords[0];
    const anchorY = coords[1];
    const leftX = coords[2];
    const leftY = coords[3];
    const rightX = coords[9];
    const rightY = coords[10];
    // SVG y is inverted (eclipticViewDirection = -1), flip back to math coords
    return {
      left: Math.atan2(-(leftY - anchorY), leftX - anchorX),
      right: Math.atan2(-(rightY - anchorY), rightX - anchorX),
    };
  }

  const earth = PLANETS.find((p) => p.name === "Earth");

  // Scan forward minute-by-minute from `start` and return the first dusk (descending)
  // crossing time of each twilight boundary (-6, -12, -18), or null if not found within
  // the window. Mirrors the bracket-scan approach already used by computeNextTransitionTime.
  function findDuskCrossings(
    lat: number,
    lon: number,
    start: Date,
    windowHours = 36
  ): Record<-6 | -12 | -18, Date | null> {
    const targets = [-6, -12, -18] as const;
    const result: Record<-6 | -12 | -18, Date | null> = { "-6": null, "-12": null, "-18": null };
    let prevElev = computeSolarElevationDeg(lat, lon, start);
    for (let m = 1; m <= windowHours * 60; m++) {
      const t = new Date(start.getTime() + m * 60000);
      const elev = computeSolarElevationDeg(lat, lon, t);
      for (const target of targets) {
        if (result[target] === null && prevElev > target && elev <= target) {
          // Use the prior minute: still inside the band (elevationDeg > target), matching
          // the renderer's own >= target convention for band membership.
          result[target] = new Date(t.getTime() - 60000);
        }
      }
      prevElev = elev;
    }
    return result;
  }

  // Angular gap (degrees) between the true Sun direction and the nearer edge of the
  // rendered twilight cone, for a given observer location/time.
  function nearSunEdgeDiffDeg(lat: number, lon: number, date: Date): number {
    const earthAngle = calculatePlanetPosition(earth, date);
    const sunDir = earthAngle + Math.PI;

    const svg = createSvg();
    renderDayNightSplit(svg, 200, date, { lat, lon });

    const { left, right } = coneEdgeAngles(svg);
    const nearSunDiff = Math.min(angleDiff(left, sunDir), angleDiff(right, sunDir));
    return (nearSunDiff * 180) / Math.PI;
  }

  // Locations spanning both hemispheres, low/mid/high latitude — the projection error
  // scales with latitude and season, so a single-location test could get lucky.
  const locations = [
    { name: "Denton, TX (mid-lat, N)", lat: 33.2148, lon: -97.1331 },
    { name: "London, UK (mid-lat, N)", lat: 51.5074, lon: -0.1278 },
    { name: "Sydney, AU (mid-lat, S)", lat: -33.8688, lon: 151.2093 },
    { name: "Reykjavik, IS (high-lat, N)", lat: 64.1466, lon: -21.9426 },
    { name: "Quito, EC (equator)", lat: -0.1807, lon: -78.4678 },
  ];
  // Two seasons per location so the check isn't tied to one time of year.
  const seasonStarts = [new Date("2026-01-01T00:00:00Z"), new Date("2026-07-01T00:00:00Z")];

  for (const loc of locations) {
    for (const seasonStart of seasonStarts) {
      const crossings = findDuskCrossings(loc.lat, loc.lon, seasonStart);
      for (const target of [-6, -12, -18] as const) {
        const crossingDate = crossings[target];
        if (crossingDate === null) continue; // polar day/night at this location/season
        it(`${loc.name} @ ${crossingDate.toISOString()} (${target}° twilight boundary): cone edge should point at the Sun`, () => {
          const diffDeg = nearSunEdgeDiffDeg(loc.lat, loc.lon, crossingDate);
          // If the cone/twilight-line geometry were correct, the boundary edge nearest the
          // Sun would coincide with the Sun's true direction (~0°). It doesn't: the cone
          // half-angle (90 - elevationDeg) is built from the true, unprojected 3D zenith
          // angle, while the cone's axis (displayObserverAngle) is built from
          // computeZenithAngleFromSun's ecliptic-plane *projection* of that same angle. The
          // two only agree exactly at solar noon/midnight.
          expect(diffDeg).toBeLessThan(1);
        });
      }
    }
  }
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

  it("returns minimum length when discriminant is negative (ray misses circle entirely)", () => {
    // Ray from far above, moving horizontally — never intersects the small circle below.
    const d = rayCircleDistance(0, 1000, 1, 0, CENTER, CENTER, 10);
    expect(d).toBe(20); // default minLen
  });
});

describe("renderDayNightSplit horizon and zenith lines", () => {
  const CLIP_R = MAX_RADIUS + 30;

  it("renders two dashed lines (horizon + zenith)", () => {
    const svg = document.createElementNS(SVG_NS, "svg");
    renderDayNightSplit(svg, 200, new Date("2025-06-15T12:00:00Z"), null);

    const lines = svg.querySelectorAll('line[stroke-dasharray="4, 4"]');
    expect(lines.length).toBe(2);
  });

  it("horizon line arms terminate at clip circle edge + 8px margin", () => {
    const svg = document.createElementNS(SVG_NS, "svg");
    renderDayNightSplit(svg, 200, new Date("2025-06-15T12:00:00Z"), null);

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
    renderDayNightSplit(svg, 200, new Date("2025-06-15T12:00:00Z"), null);

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

  it("zenith line starts at the anchor point (no nadir arm)", () => {
    const svg = document.createElementNS(SVG_NS, "svg");
    renderDayNightSplit(svg, 200, new Date("2025-06-15T12:00:00Z"), null);

    const lines = svg.querySelectorAll('line[stroke-dasharray="4, 4"]');
    const zenith = lines[1];

    const x1 = Number(zenith.getAttribute("x1"));
    const y1 = Number(zenith.getAttribute("y1"));
    const x2 = Number(zenith.getAttribute("x2"));
    const y2 = Number(zenith.getAttribute("y2"));

    // One endpoint (x1,y1) should be near Earth's orbital position (the anchor)
    // while the other (x2,y2) extends outward to the clip circle
    const dist1 = Math.sqrt((x1 - CENTER) ** 2 + (y1 - CENTER) ** 2);
    const dist2 = Math.sqrt((x2 - CENTER) ** 2 + (y2 - CENTER) ** 2);

    // Anchor is near Earth's orbit (~200px radius + small body offset)
    expect(dist1).toBeLessThan(CLIP_R - 50);
    // Zenith endpoint should reach the clip circle edge
    expect(dist2).toBeGreaterThan(CLIP_R - 5);
  });

  it("both lines use same stroke style", () => {
    const svg = document.createElementNS(SVG_NS, "svg");
    renderDayNightSplit(svg, 200, new Date("2025-06-15T12:00:00Z"), null);

    const lines = svg.querySelectorAll('line[stroke-dasharray="4, 4"]');
    for (const line of lines) {
      expect(line.getAttribute("style")).toBe(
        "stroke: color-mix(in srgb, currentColor 30%, transparent)"
      );
      expect(line.getAttribute("stroke-width")).toBe("1");
    }
  });
});

describe("computeZenithAngleFromSun", () => {
  const earth = PLANETS.find((p) => p.name === "Earth");

  it("at local solar noon (equator), zenith points almost exactly at the Sun", () => {
    const date = new Date("2025-03-20T12:00:00Z"); // equinox, equator, lon=0 → local noon
    const angle = computeZenithAngleFromSun(0, 0, date);
    expect(Math.abs(angle)).toBeLessThan(0.02);
  });

  it("at local solar midnight (equator), zenith points almost exactly away from the Sun", () => {
    const date = new Date("2025-03-20T00:00:00Z");
    const angle = computeZenithAngleFromSun(0, 0, date);
    expect(angleDiff(angle, Math.PI)).toBeLessThan(0.02);
  });

  it("with lat/lon at high latitude summer, angle stays within 90° of Sun (day), unlike raw 2D angle", () => {
    // July at 55°N, 19:00 UTC: 2D model says night (~105° from Sun), spherical says day (+9.4°)
    const date = new Date("2025-07-15T19:00:00Z");
    const earthAngle = calculatePlanetPosition(earth, date);
    const sunDir = earthAngle + Math.PI;
    const observerAngle2D = calculateObserverAngle(earthAngle, date, "Europe/London", 0);
    const diff2D = Math.abs(
      Math.atan2(Math.sin(observerAngle2D - sunDir), Math.cos(observerAngle2D - sunDir))
    );

    const angle = computeZenithAngleFromSun(55, 0, date);
    expect(Math.abs(angle)).toBeLessThan(Math.PI / 2); // agrees with positive elevation: day side

    const corrected = earthAngle + Math.PI + angle;
    const diffCorrected = Math.abs(
      Math.atan2(Math.sin(corrected - sunDir), Math.cos(corrected - sunDir))
    );
    expect(diffCorrected).toBeLessThan(diff2D);
  });

  it("without lat/lon, renderDayNightSplit horizon is perpendicular to observerAngle (no correction)", () => {
    // When locationData is null, no correction → same as before
    const svg = document.createElementNS(SVG_NS, "svg");
    const date = new Date("2025-07-15T19:00:00Z");
    renderDayNightSplit(svg, 200, date, null);
    // Just verifies no crash and still renders 2 dashed lines
    const lines = svg.querySelectorAll('line[stroke-dasharray="4, 4"]');
    expect(lines.length).toBe(2);
  });

  it("stays continuous across midnight — no large jump between consecutive 1-min samples", () => {
    // Regression test for #78: the old inversion (magnitude from accurate elevation, sign
    // reattached from the approximate 2D model) flipped sign at the atan2 ±π branch
    // (astronomical midnight) while magnitude stayed the same, producing a jump of
    // ~2*(π/2 - elevRad) — largest when elevation is deep negative (night). Projecting the
    // true 3D zenith vector is continuous through that point by construction, since magnitude
    // and direction now come from the same self-consistent physical model.
    const lat = 40;
    const lon = -97;
    const start = new Date("2025-01-15T00:00:00Z"); // window crosses local midnight

    let prevAngle: number | null = null;
    let maxJumpDeg = 0;

    for (let m = 0; m < 24 * 60; m += 1) {
      const date = new Date(start.getTime() + m * 60000);
      const angle = computeZenithAngleFromSun(lat, lon, date);

      if (prevAngle !== null) {
        const jumpDeg = (angleDiff(angle, prevAngle) * 180) / Math.PI;
        maxJumpDeg = Math.max(maxJumpDeg, jumpDeg);
      }
      prevAngle = angle;
    }

    // Real azimuthal rate peaks near culmination (measured ~0.43°/min at this lat/season),
    // well below the ~0.25°/min naive average but nowhere near the old bug's 122° jump.
    expect(maxJumpDeg).toBeLessThan(2);
  });
});

describe("computeTwilightBand", () => {
  it("day elevation gets CONE_DAY and a 90° half-angle", () => {
    expect(computeTwilightBand(10, null, {})).toEqual({ color: CONE_DAY, halfAngle: 90 });
  });

  it("civil twilight (0 to -6) gets CONE_CIVIL", () => {
    expect(computeTwilightBand(-3, null, {}).color).toBe(CONE_CIVIL);
  });

  it("nautical twilight (-6 to -12) gets CONE_NAUTICAL", () => {
    expect(computeTwilightBand(-9, null, {}).color).toBe(CONE_NAUTICAL);
  });

  it("astronomical twilight (-12 to -18) gets CONE_ASTRONOMICAL", () => {
    expect(computeTwilightBand(-15, null, {}).color).toBe(CONE_ASTRONOMICAL);
  });

  it("below -18 gets CONE_NIGHT and a 90° half-angle", () => {
    expect(computeTwilightBand(-20, null, {})).toEqual({ color: CONE_NIGHT, halfAngle: 90 });
  });

  it("colors overrides take precedence over the CONE_* defaults", () => {
    const band = computeTwilightBand(10, null, { cone_day: "red" });
    expect(band.color).toBe("red");
  });

  it("half-angle during twilight uses the projected zenith magnitude when available", () => {
    const band = computeTwilightBand(-9, Math.PI / 3, {});
    expect(band.halfAngle).toBeCloseTo(60, 5);
  });

  it("half-angle during twilight falls back to 90 - elevationDeg without a projected zenith", () => {
    const band = computeTwilightBand(-9, null, {});
    expect(band.halfAngle).toBeCloseTo(99, 5);
  });
});
