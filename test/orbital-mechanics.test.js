import { describe, expect, it } from "vitest";
import { calculateMoonPosition, calculatePlanetPosition } from "../src/orbital-mechanics.js";
import { MOON, PLANETS } from "../src/planet-data.js";

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
