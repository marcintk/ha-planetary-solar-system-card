import { describe, expect, it } from "vitest";
import { COMETS } from "../../src/astronomy/comet-data.js";

describe("comet-data constants", () => {
  it("exports a non-empty COMETS array", () => {
    expect(Array.isArray(COMETS)).toBe(true);
    expect(COMETS.length).toBeGreaterThan(0);
  });

  it("each comet has all required orbital fields", () => {
    const requiredFields = [
      "name",
      "semiMajorAxis",
      "eccentricity",
      "periodDays",
      "longitudeOfPerihelion",
      "meanAnomalyJ2000",
      "color",
      "size",
    ];
    for (const comet of COMETS) {
      for (const field of requiredFields) {
        expect(comet).toHaveProperty(field);
      }
    }
  });

  it("Halley's comet is present with correct orbital elements", () => {
    const halley = COMETS.find((c) => c.name === "Halley");
    expect(halley).toBeDefined();
    expect(halley.semiMajorAxis).toBeCloseTo(17.834, 2);
    expect(halley.eccentricity).toBeCloseTo(0.967, 3);
    expect(halley.periodDays).toBe(27510);
    expect(halley.longitudeOfPerihelion).toBeCloseTo(111.33, 1);
    expect(halley.meanAnomalyJ2000).toBeCloseTo(38.38, 1);
  });

  it("all comets have eccentricity between 0 and 1 (bound orbit)", () => {
    for (const comet of COMETS) {
      expect(comet.eccentricity).toBeGreaterThanOrEqual(0);
      expect(comet.eccentricity).toBeLessThan(1);
    }
  });

  it("all comets have positive semiMajorAxis and periodDays", () => {
    for (const comet of COMETS) {
      expect(comet.semiMajorAxis).toBeGreaterThan(0);
      expect(comet.periodDays).toBeGreaterThan(0);
    }
  });

  it("all comets have a color string and positive size", () => {
    for (const comet of COMETS) {
      expect(typeof comet.color).toBe("string");
      expect(comet.color.length).toBeGreaterThan(0);
      expect(comet.size).toBeGreaterThan(0);
    }
  });

  it("Halley has a tailLength property", () => {
    const halley = COMETS.find((c) => c.name === "Halley");
    expect(halley.tailLength).toBeGreaterThan(0);
  });
});
