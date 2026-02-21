import { describe, it, expect } from "vitest";
import {
  PLANETS,
  MOON,
  SUN,
  calculatePlanetPosition,
  calculateMoonPosition,
} from "../src/planet-data.js";

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
});
