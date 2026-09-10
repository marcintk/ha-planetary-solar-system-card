import { describe, expect, it } from "vitest";
import { PLANETS } from "../../src/astronomy/planet-data.js";
import { renderSolarSystem } from "../../src/renderer/index.js";
import { ORBIT_LABEL_AU } from "../../src/renderer/orbit-labels.js";

/**
 * Orbit-ring AU labels vs. real heliocentric distances.
 *
 * Each planet ring shows two "x.x AU" labels, next to where the ring crosses
 * the vertical season axis. The printed value must be the true heliocentric
 * distance `au·(1 − e·cos E)` at that crossing — carried from the orbital
 * elements in planet-data.ts, never reconstructed from the drawn ring's pixel
 * radius, which is pushed outward by the anti-crowding pack and inflated Earth
 * to 1.5 AU and Mars to ~3.0 AU before #239.
 *
 * EXPECTED_AU is `au·(1 − e·cos E)` at each ring's two axis crossings, from the
 * real elements + the fixed MIN/MAX_RADIUS scale. Static — regenerate only when
 * planet-data or the scale constants change.
 */
const EXPECTED_AU: Record<string, { minAU: number; maxAU: number }> = {
  Mercury: { minAU: 0.31063, maxAU: 0.4658 },
  Venus: { minAU: 0.71634, maxAU: 0.72364 },
  Earth: { minAU: 0.98371, maxAU: 1.01628 },
  Mars: { minAU: 1.45662, maxAU: 1.57168 },
  Jupiter: { minAU: 5.13215, maxAU: 5.26055 },
  Saturn: { minAU: 9.04868, maxAU: 10.11129 },
  Uranus: { minAU: 19.0712, maxAU: 19.35068 },
  Neptune: { minAU: 29.85882, maxAU: 30.24068 },
};

const planetByName = (name: string) => {
  const planet = PLANETS.find((p) => p.name === name);
  if (!planet) throw new Error(`no planet named ${name}`);
  return planet;
};

describe("orbit AU label accuracy", () => {
  it.each(PLANETS.map((p) => [p.name] as const))(
    "%s: label distance matches the physical value and lies within [perihelion, aphelion]",
    (name) => {
      const planet = planetByName(name);
      const { minAU, maxAU } = ORBIT_LABEL_AU[name];
      const expected = EXPECTED_AU[name];
      expect(expected).toBeDefined();

      // Locked to the expected physical distance, per planet.
      expect(minAU).toBeCloseTo(expected.minAU, 3);
      expect(maxAU).toBeCloseTo(expected.maxAU, 3);

      // Both readings sit inside the planet's real orbital-distance range.
      const perihelion = planet.au * (1 - planet.eccentricity);
      const aphelion = planet.au * (1 + planet.eccentricity);
      expect(minAU).toBeGreaterThanOrEqual(perihelion - 1e-9);
      expect(maxAU).toBeLessThanOrEqual(aphelion + 1e-9);
    }
  );

  it("the rendered SVG prints those distances (1 decimal, in range) for every planet", () => {
    const { svg } = renderSolarSystem(new Date("2026-02-14"), "north", null, {}, false);
    const labels = Array.from(svg.querySelectorAll('text[font-size="9"]'));
    expect(labels.length).toBe(PLANETS.length * 2);

    PLANETS.forEach((planet, i) => {
      const shown = [labels[i * 2], labels[i * 2 + 1]].map((l) =>
        Number.parseFloat(l.textContent ?? "")
      );

      const perihelion = planet.au * (1 - planet.eccentricity) - 0.05;
      const aphelion = planet.au * (1 + planet.eccentricity) + 0.05;
      for (const value of shown) {
        expect(value).toBeGreaterThanOrEqual(perihelion);
        expect(value).toBeLessThanOrEqual(aphelion);
      }

      // The two printed numbers are the precomputed pair, rounded to 1 dp.
      const { minAU, maxAU } = ORBIT_LABEL_AU[planet.name];
      expect(shown.slice().sort((a, b) => a - b)).toEqual([
        Number(minAU.toFixed(1)),
        Number(maxAU.toFixed(1)),
      ]);
    });
  });

  it("regression (#239): the anti-crowding pixel push-out no longer leaks into the AU value", () => {
    // The bug printed ~1.5 AU for Earth and ~3.0 AU for Mars — both well past
    // their true aphelion (Earth 1.017, Mars 1.662).
    expect(ORBIT_LABEL_AU.Earth.maxAU).toBeLessThan(1.1);
    expect(ORBIT_LABEL_AU.Mars.maxAU).toBeLessThan(1.7);
  });
});
