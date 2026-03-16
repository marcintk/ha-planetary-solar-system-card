import { describe, expect, it } from "vitest";
import {
  calculateCometPosition,
  calculateMoonPosition,
  calculatePlanetPosition,
  solveKeplerEquation,
} from "../../src/astronomy/orbital-mechanics.js";
import { COMETS } from "../../src/astronomy/comet-data.js";
import { MOON, PLANETS } from "../../src/astronomy/planet-data.js";

describe("calculatePlanetPosition", () => {
  const earth = PLANETS.find((p) => p.name === "Earth");

  it("returns a value between 0 and 2π", () => {
    const angle = calculatePlanetPosition(earth, new Date("2024-06-15"));
    expect(angle).toBeGreaterThanOrEqual(0);
    expect(angle).toBeLessThan(2 * Math.PI);
  });

  it("returns different positions for different dates", () => {
    const a1 = calculatePlanetPosition(earth, new Date("2024-01-01"));
    const a2 = calculatePlanetPosition(earth, new Date("2024-07-01"));
    expect(a1).not.toBeCloseTo(a2, 1);
  });

  it("returns similar position after one full orbit", () => {
    const d1 = new Date("2024-01-01");
    const d2 = new Date(d1.getTime() + earth.periodDays * 86400000);
    const a1 = calculatePlanetPosition(earth, d1);
    const a2 = calculatePlanetPosition(earth, d2);
    expect(a1).toBeCloseTo(a2, 1);
  });

  it("works for all planets without error", () => {
    const date = new Date("2026-02-14");
    for (const planet of PLANETS) {
      const angle = calculatePlanetPosition(planet, date);
      expect(angle).toBeGreaterThanOrEqual(0);
      expect(angle).toBeLessThan(2 * Math.PI);
    }
  });

  it("returns 0–2π for outer planets (slow movers)", () => {
    const neptune = PLANETS.find((p) => p.name === "Neptune");
    const angle = calculatePlanetPosition(neptune, new Date("2026-02-14"));
    expect(angle).toBeGreaterThanOrEqual(0);
    expect(angle).toBeLessThan(2 * Math.PI);
  });
});

describe("calculateMoonPosition", () => {
  it("returns a value between 0 and 2π", () => {
    const angle = calculateMoonPosition(new Date("2024-06-15"));
    expect(angle).toBeGreaterThanOrEqual(0);
    expect(angle).toBeLessThan(2 * Math.PI);
  });

  it("returns similar position after one lunar month", () => {
    const d1 = new Date("2024-01-01");
    const d2 = new Date(d1.getTime() + MOON.periodDays * 86400000);
    const a1 = calculateMoonPosition(d1);
    const a2 = calculateMoonPosition(d2);
    expect(a1).toBeCloseTo(a2, 1);
  });

  it("returns different positions for dates 2 weeks apart", () => {
    const a1 = calculateMoonPosition(new Date("2024-01-01"));
    const a2 = calculateMoonPosition(new Date("2024-01-15"));
    expect(a1).not.toBeCloseTo(a2, 1);
  });
});

describe("solveKeplerEquation", () => {
  it("returns E=0 when M=0 for any eccentricity", () => {
    expect(solveKeplerEquation(0, 0)).toBeCloseTo(0, 10);
    expect(solveKeplerEquation(0, 0.5)).toBeCloseTo(0, 10);
    expect(solveKeplerEquation(0, 0.967)).toBeCloseTo(0, 10);
  });

  it("converges for circular orbit (e=0): E should equal M", () => {
    const testValues = [0.5, 1.0, Math.PI, 2 * Math.PI - 0.1];
    for (const M of testValues) {
      expect(solveKeplerEquation(M, 0)).toBeCloseTo(M, 8);
    }
  });

  it("converges for moderate eccentricity (e=0.5)", () => {
    const M = 1.0;
    const E = solveKeplerEquation(M, 0.5);
    // Verify Kepler's equation: M = E - e*sin(E)
    const reconstructedM = E - 0.5 * Math.sin(E);
    expect(reconstructedM).toBeCloseTo(M, 8);
  });

  it("converges for high eccentricity (e=0.967, like Halley)", () => {
    const M = 1.0;
    const E = solveKeplerEquation(M, 0.967);
    const reconstructedM = E - 0.967 * Math.sin(E);
    expect(reconstructedM).toBeCloseTo(M, 6);
  });

  it("satisfies Kepler's equation for various M values at high eccentricity", () => {
    const e = 0.967;
    const testMs = [0.1, 0.5, 1.0, 2.0, Math.PI, 5.0];
    for (const M of testMs) {
      const E = solveKeplerEquation(M, e);
      const reconstructedM = E - e * Math.sin(E);
      expect(reconstructedM).toBeCloseTo(M, 5);
    }
  });

  it("is antisymmetric: solveKepler(-M, e) = -solveKepler(M, e)", () => {
    const M = 1.5;
    const e = 0.5;
    const Epos = solveKeplerEquation(M, e);
    const Eneg = solveKeplerEquation(-M, e);
    expect(Eneg).toBeCloseTo(-Epos, 8);
  });
});

describe("calculateCometPosition", () => {
  const halley = COMETS.find((c) => c.name === "Halley");

  it("returns an object with angle, radius, and trueAnomaly", () => {
    const result = calculateCometPosition(halley, new Date("2024-06-15"));
    expect(result).toHaveProperty("angle");
    expect(result).toHaveProperty("radius");
    expect(result).toHaveProperty("trueAnomaly");
  });

  it("returns angle between 0 and 2π", () => {
    const { angle } = calculateCometPosition(halley, new Date("2024-06-15"));
    expect(angle).toBeGreaterThanOrEqual(0);
    expect(angle).toBeLessThan(2 * Math.PI);
  });

  it("returns radius within orbital bounds [a*(1-e), a*(1+e)]", () => {
    const dates = [
      new Date("2020-01-01"),
      new Date("2024-06-15"),
      new Date("2026-03-15"),
    ];
    const perihelion = halley.semiMajorAxis * (1 - halley.eccentricity);
    const aphelion = halley.semiMajorAxis * (1 + halley.eccentricity);

    for (const date of dates) {
      const { radius } = calculateCometPosition(halley, date);
      expect(radius).toBeGreaterThanOrEqual(perihelion - 0.01);
      expect(radius).toBeLessThanOrEqual(aphelion + 0.01);
    }
  });

  it("trueAnomaly is a finite number", () => {
    const { trueAnomaly } = calculateCometPosition(halley, new Date("2024-06-15"));
    expect(Number.isFinite(trueAnomaly)).toBe(true);
  });

  it("returns consistent results for the same date", () => {
    const date = new Date("2024-06-15");
    const r1 = calculateCometPosition(halley, date);
    const r2 = calculateCometPosition(halley, date);
    expect(r1.angle).toBe(r2.angle);
    expect(r1.radius).toBe(r2.radius);
    expect(r1.trueAnomaly).toBe(r2.trueAnomaly);
  });

  it("returns different positions for different dates", () => {
    const r1 = calculateCometPosition(halley, new Date("2024-01-01"));
    const r2 = calculateCometPosition(halley, new Date("2024-07-01"));
    const different = r1.angle !== r2.angle || r1.radius !== r2.radius;
    expect(different).toBe(true);
  });

  it("returns similar position after one full orbital period", () => {
    const d1 = new Date("2024-01-01");
    const d2 = new Date(d1.getTime() + halley.periodDays * 86400000);
    const r1 = calculateCometPosition(halley, d1);
    const r2 = calculateCometPosition(halley, d2);
    expect(r1.angle).toBeCloseTo(r2.angle, 1);
    expect(r1.radius).toBeCloseTo(r2.radius, 1);
  });

  it("works for all comets without error", () => {
    const date = new Date("2026-03-15");
    for (const comet of COMETS) {
      const result = calculateCometPosition(comet, date);
      expect(result.angle).toBeGreaterThanOrEqual(0);
      expect(result.angle).toBeLessThan(2 * Math.PI);
      expect(result.radius).toBeGreaterThan(0);
    }
  });
});
