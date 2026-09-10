import { describe, expect, it } from "vitest";
import { PLANETS } from "../../src/astronomy/planet-data.js";
import { ORBIT_LABEL_AU } from "../../src/renderer/orbit-labels.js";

// Structural contract for the ORBIT_LABEL_AU table. The physical-accuracy
// checks (each distance vs. the real orbit, and the #239 regression) live in
// test/renderer/accuracy-orbit-distance.test.ts.
describe("ORBIT_LABEL_AU", () => {
  it("has exactly one entry per planet", () => {
    expect(Object.keys(ORBIT_LABEL_AU).sort()).toEqual(PLANETS.map((p) => p.name).sort());
  });

  it.each(PLANETS.map((p) => [p.name] as const))(
    "%s's entry is positive and ordered (minAU <= maxAU)",
    (name) => {
      const { minAU, maxAU } = ORBIT_LABEL_AU[name];
      expect(minAU).toBeGreaterThan(0);
      expect(maxAU).toBeGreaterThan(0);
      expect(minAU).toBeLessThanOrEqual(maxAU);
    }
  );
});
