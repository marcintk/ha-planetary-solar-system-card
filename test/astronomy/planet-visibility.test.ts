import { describe, expect, it } from "vitest";
import { PLANETS } from "../../src/astronomy/planet-data.js";
import { getTonightsPlanets } from "../../src/astronomy/planet-visibility.js";
import {
  ASTRONOMICAL_NIGHT_DEG,
  computeSolarElevationDeg,
} from "../../src/astronomy/solar-position.js";

describe("getTonightsPlanets planets", () => {
  it("includes Jupiter and excludes Earth for Krakow on 2026-10-03 evening", () => {
    // JPL Horizons: Jupiter elevation 18° at 02:00Z, 37° at 04:00Z, 52° at 06:00Z on 2026-10-04
    const result = getTonightsPlanets(50.0647, 19.945, new Date("2026-10-03T20:00:00Z")).planets;
    expect(result).toContain("Jupiter");
    expect(result).not.toContain("Earth");
  });
});

describe("getTonightsPlanets", () => {
  it("returns tonight's planets with validUntil at the end of astronomical night", () => {
    const lat = 50.0647;
    const lon = 19.945;
    const date = new Date("2026-10-03T20:00:00Z");
    const { planets, validUntil } = getTonightsPlanets(lat, lon, date);
    expect(planets).toContain("Jupiter");
    expect(validUntil.getTime()).toBeGreaterThan(date.getTime());
    expect(validUntil.getTime()).toBeLessThan(date.getTime() + 14 * 3600 * 1000);
    expect(
      Math.abs(computeSolarElevationDeg(lat, lon, validUntil) - ASTRONOMICAL_NIGHT_DEG)
    ).toBeLessThan(1.5);
  });
});

describe("getTonightsPlanets edge cases", () => {
  it("returns no planets and a 36 h validity during polar day", () => {
    const date = new Date("2026-06-21T12:00:00Z");
    const { planets, validUntil } = getTonightsPlanets(78, 15, date);
    expect(planets).toEqual([]);
    expect(validUntil.getTime()).toBe(date.getTime() + 36 * 3600 * 1000);
  });

  it("looks ahead to the coming night when called during the day", () => {
    const date = new Date("2026-10-03T10:00:00Z");
    const { planets, validUntil } = getTonightsPlanets(50.0647, 19.945, date);
    expect(planets).toContain("Jupiter");
    expect(validUntil.getTime()).toBeGreaterThan(new Date("2026-10-03T20:00:00Z").getTime());
  });

  const sites = [
    { name: "Krakow", lat: 50.0647, lon: 19.945 },
    { name: "Quito", lat: -0.1807, lon: -78.4678 },
    { name: "Ushuaia", lat: -54.8019, lon: -68.303 },
  ];
  const dates = ["2026-10-03T20:00:00Z", "2026-12-21T20:00:00Z"];
  for (const site of sites) {
    for (const iso of dates) {
      it(`never lists Earth and keeps PLANETS order (${site.name}, ${iso})`, () => {
        const result = getTonightsPlanets(site.lat, site.lon, new Date(iso)).planets;
        expect(result).not.toContain("Earth");
        const order = PLANETS.map((p) => p.name);
        const indices = result.map((n) => order.indexOf(n));
        expect(indices.every((i) => i >= 0)).toBe(true);
        expect(indices).toEqual([...indices].sort((a, b) => a - b));
      });
    }
  }
});
