import { describe, expect, it } from "vitest";
import { PLANETS } from "../../src/astronomy/planet-data.js";
import { SATURN_RING_OUTER_RADIUS } from "../../src/renderer/bodies.js";
import { renderSolarSystem } from "../../src/renderer/index.js";

describe("Planets never visually overlap at conjunction", () => {
  it("keeps Jupiter and Saturn's ring apart on 2020-09-19 (Great Conjunction)", () => {
    // github.com/marcintk/ha-planetary-solar-system-card/issues/62 (follow-up)
    // Jupiter's marker and Saturn's ring touch exactly (0px gap) on the raw
    // log-scale AU->px radii at this date.
    const date = new Date("2020-09-19T00:00:00Z");
    const { positions } = renderSolarSystem(date);

    const jupiter = positions.find((p) => p.name === "Jupiter");
    const saturn = positions.find((p) => p.name === "Saturn");
    const jupiterPlanet = PLANETS.find((p) => p.name === "Jupiter");

    const dist = Math.hypot(jupiter.x - saturn.x, jupiter.y - saturn.y);
    const minSeparation = jupiterPlanet.size + SATURN_RING_OUTER_RADIUS;

    expect(dist).toBeGreaterThan(minSeparation);
  });
});
