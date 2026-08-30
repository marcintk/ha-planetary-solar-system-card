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
      expect(planet).toHaveProperty("eccentricity");
      expect(planet).toHaveProperty("longitudeOfPerihelion");
    }
  });

  it("eccentricities are within [0, 1)", () => {
    for (const planet of PLANETS) {
      expect(planet.eccentricity).toBeGreaterThanOrEqual(0);
      expect(planet.eccentricity).toBeLessThan(1);
    }
  });

  it("Earth has AU of 1.0", () => {
    const earth = PLANETS.find((p) => p.name === "Earth");
    expect(earth.au).toBe(1.0);
  });

  it("MOON carries only what the renderer draws with", () => {
    // Its position comes from the Meeus series in moon-position.ts, so it has no orbital
    // elements of its own to get stale.
    expect(Object.keys(MOON).sort()).toEqual(["color", "name", "size"]);
  });

  it("SUN has color and size", () => {
    expect(SUN.color).toBeDefined();
    expect(SUN.size).toBeGreaterThan(0);
  });

  it("planet and Moon colours match the approved #199 palette", () => {
    const colorByName = Object.fromEntries(PLANETS.map((p) => [p.name, p.color]));
    expect(colorByName.Mercury).toBe("#a9a29b");
    expect(colorByName.Venus).toBe("#e6ca97");
    expect(colorByName.Earth).toBe("#3f7fc4");
    expect(colorByName.Mars).toBe("#c04a1f");
    expect(colorByName.Jupiter).toBe("#cf9b5f");
    expect(colorByName.Saturn).toBe("#e2c58c");
    expect(colorByName.Uranus).toBe("#9ad3df");
    expect(colorByName.Neptune).toBe("#3a53b0");
    expect(MOON.color).toBe("#c8c6c0");
    expect(SUN.color).toBe("#ffd700");
  });
});
