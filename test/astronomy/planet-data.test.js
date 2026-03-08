import { describe, expect, it } from "vitest";
import { MOON, PLANETS, SUN } from "../../src/astronomy/planet-data.js";

describe("planet-data constants", () => {
  it("exports 8 planets", () => {
    expect(PLANETS).toHaveLength(8);
  });

  it("planets are ordered by AU distance", () => {
    for (let i = 1; i < PLANETS.length; i++) {
      expect(PLANETS[i].au).toBeGreaterThan(PLANETS[i - 1].au);
    }
  });

  it("each planet has required fields", () => {
    for (const planet of PLANETS) {
      expect(planet).toHaveProperty("name");
      expect(planet).toHaveProperty("au");
      expect(planet).toHaveProperty("periodDays");
      expect(planet).toHaveProperty("color");
      expect(planet).toHaveProperty("size");
      expect(planet).toHaveProperty("meanLongitudeJ2000");
    }
  });

  it("Earth has AU of 1.0", () => {
    const earth = PLANETS.find((p) => p.name === "Earth");
    expect(earth.au).toBe(1.0);
  });

  it("MOON has required fields", () => {
    expect(MOON.periodDays).toBeCloseTo(27.32, 1);
    expect(MOON.auFromEarth).toBeDefined();
  });

  it("SUN has color and size", () => {
    expect(SUN.color).toBeDefined();
    expect(SUN.size).toBeGreaterThan(0);
  });
});
