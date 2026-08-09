import { describe, expect, it } from "vitest";
import { PLANETS } from "../../src/astronomy/planet-data.js";
import { SATURN_RING_OUTER_RADIUS } from "../../src/renderer/bodies.js";
import { packOrbitRadii } from "../../src/renderer/orbit-packing.js";

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
