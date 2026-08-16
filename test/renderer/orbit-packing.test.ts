import { describe, expect, it } from "vitest";
import { PLANETS } from "../../src/astronomy/planet-data.js";
import { SATURN_RING_OUTER_RADIUS } from "../../src/renderer/bodies.js";
import { computePlanetVisualEllipse, packOrbitRadii } from "../../src/renderer/orbit-packing.js";

describe("packOrbitRadii", () => {
  it("keeps every adjacent planet pair separated by at least their combined visual size", () => {
    const radii = packOrbitRadii(PLANETS);
    const MIN_GAP = 8;

    for (let i = 0; i < PLANETS.length - 1; i++) {
      const a = PLANETS[i];
      const b = PLANETS[i + 1];
      const aSize = a.name === "Saturn" ? SATURN_RING_OUTER_RADIUS : a.size;
      const bSize = b.name === "Saturn" ? SATURN_RING_OUTER_RADIUS : b.size;
      const gap = radii[i + 1] - radii[i];
      expect(gap).toBeGreaterThanOrEqual(aSize + bSize + MIN_GAP);
    }
  });

  it("keeps radii non-decreasing and returns one entry per planet", () => {
    const radii = packOrbitRadii(PLANETS);
    expect(radii).toHaveLength(PLANETS.length);
    for (let i = 1; i < radii.length; i++) {
      expect(radii[i]).toBeGreaterThanOrEqual(radii[i - 1]);
    }
  });

  it("leaves already-spaced planets (e.g. Mercury) at their natural log-scale radius", () => {
    const radii = packOrbitRadii(PLANETS);
    // Mercury is first and has no inward neighbor pushing it out.
    expect(radii[0]).toBeCloseTo(40, 1);
  });
});

describe("computePlanetVisualEllipse", () => {
  const mercury = PLANETS.find((p) => p.name === "Mercury");
  const earth = PLANETS.find((p) => p.name === "Earth");

  it("returns aPx, bPx, cPx, ePx, and rotationDeg", () => {
    const ellipse = computePlanetVisualEllipse(mercury, 0);
    expect(ellipse).toHaveProperty("aPx");
    expect(ellipse).toHaveProperty("bPx");
    expect(ellipse).toHaveProperty("cPx");
    expect(ellipse).toHaveProperty("ePx");
    expect(ellipse.rotationDeg).toBe(mercury.longitudeOfPerihelion);
  });

  it("is visually more eccentric for Mercury than for Earth", () => {
    expect(computePlanetVisualEllipse(mercury, 0).ePx).toBeGreaterThan(
      computePlanetVisualEllipse(earth, 0).ePx
    );
  });

  it("adds packedOffset uniformly to perihelion and aphelion (aPx shifts, cPx unchanged)", () => {
    const base = computePlanetVisualEllipse(mercury, 0);
    const offset = computePlanetVisualEllipse(mercury, 50);
    expect(offset.aPx).toBeCloseTo(base.aPx + 50, 5);
    expect(offset.cPx).toBeCloseTo(base.cPx, 5);
  });

  it("degenerates to a circle (aPx === bPx) for zero eccentricity", () => {
    const circular = { ...earth, eccentricity: 0 };
    const ellipse = computePlanetVisualEllipse(circular, 0);
    expect(ellipse.bPx).toBeCloseTo(ellipse.aPx, 8);
    expect(ellipse.cPx).toBeCloseTo(0, 8);
  });
});
