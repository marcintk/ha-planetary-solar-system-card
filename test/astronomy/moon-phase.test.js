import { describe, expect, it } from "vitest";
import { getMoonPhase } from "../../src/astronomy/moon-phase.js";

describe("getMoonPhase", () => {
  it("returns phase near 0 for a known New Moon date", () => {
    // 2024-01-11 was a New Moon
    const result = getMoonPhase(new Date("2024-01-11T12:00:00Z"));
    expect(result.phase).toBeLessThan(0.05);
    expect(result.phaseName).toBe("New Moon");
    expect(result.illumination).toBeLessThan(0.05);
  });

  it("returns phase near 0.5 for a known Full Moon date", () => {
    // 2024-01-25 was a Full Moon
    const result = getMoonPhase(new Date("2024-01-25T18:00:00Z"));
    expect(result.phase).toBeCloseTo(0.5, 1);
    expect(result.phaseName).toBe("Full Moon");
    expect(result.illumination).toBeGreaterThan(0.95);
  });

  it("returns First Quarter for a known First Quarter date", () => {
    // 2024-01-18 was First Quarter
    const result = getMoonPhase(new Date("2024-01-18T03:00:00Z"));
    expect(result.phase).toBeCloseTo(0.25, 1);
    expect(result.phaseName).toBe("First Quarter");
  });

  it("returns Third Quarter for a known Third Quarter date", () => {
    // 2024-02-02 was Third Quarter (actually Last Quarter)
    const result = getMoonPhase(new Date("2024-02-02T12:00:00Z"));
    expect(result.phase).toBeCloseTo(0.75, 1);
    expect(result.phaseName).toBe("Third Quarter");
  });

  it("wraps phase correctly across synodic months", () => {
    const d1 = new Date("2024-03-10T12:00:00Z");
    const d2 = new Date(d1.getTime() + 29.53059 * 86400000);
    const r1 = getMoonPhase(d1);
    const r2 = getMoonPhase(d2);
    expect(r1.phase).toBeCloseTo(r2.phase, 1);
  });

  it("returns all eight phase names across one synodic month", () => {
    const start = new Date("2024-01-11T12:00:00Z"); // New Moon
    const names = new Set();
    for (let i = 0; i < 8; i++) {
      const date = new Date(start.getTime() + i * (29.53059 / 8) * 86400000);
      names.add(getMoonPhase(date).phaseName);
    }
    expect(names.size).toBe(8);
  });

  it("illumination is symmetric at First and Third Quarter", () => {
    const fq = getMoonPhase(new Date("2024-01-18T03:00:00Z"));
    const tq = getMoonPhase(new Date("2024-02-02T12:00:00Z"));
    expect(Math.abs(fq.illumination - tq.illumination)).toBeLessThan(0.1);
  });

  it("illumination at quarter is near 0.5", () => {
    const result = getMoonPhase(new Date("2024-01-18T03:00:00Z"));
    expect(Math.abs(result.illumination - 0.5)).toBeLessThan(0.1);
  });

  it("phase is always between 0 and 1", () => {
    const dates = [new Date("2020-01-01"), new Date("2024-06-15"), new Date("2030-12-31")];
    for (const date of dates) {
      const result = getMoonPhase(date);
      expect(result.phase).toBeGreaterThanOrEqual(0);
      expect(result.phase).toBeLessThan(1);
    }
  });
});
