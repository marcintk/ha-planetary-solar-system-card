import { describe, expect, it } from "vitest";
import { MOON, PLANETS } from "../../src/astronomy/planet-data.js";
import { renderSolarSystem } from "../../src/renderer/index.js";

describe("Moon never visually overlaps another planet marker", () => {
  it("keeps Moon clear of Venus on 2023-08-16 (near Earth-Venus conjunction)", () => {
    // github.com/marcintk/ha-planetary-solar-system-card/issues/62
    // Moon's fixed pixel offset from Earth dips inward past Venus's orbit
    // radius on the log-scale AU->px mapping, so at conjunction the Moon
    // marker renders on top of Venus's marker.
    const date = new Date("2023-08-16T00:00:00Z");
    const { positions } = renderSolarSystem(date);

    const moon = positions.find((p) => p.name === MOON.name);
    const venus = positions.find((p) => p.name === "Venus");
    const venusPlanet = PLANETS.find((p) => p.name === "Venus");

    const dist = Math.hypot(moon.x - venus.x, moon.y - venus.y);
    const minSeparation = MOON.size + venusPlanet.size;

    expect(dist).toBeGreaterThan(minSeparation);
  });
});
