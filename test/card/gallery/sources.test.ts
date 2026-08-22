import { describe, expect, it } from "vitest";
import { IMAGE_SOURCES, SOURCES } from "../../../src/card/gallery/sources.js";

describe("SOURCES catalog", () => {
  it("lists the sources in the fixed render order", () => {
    expect(IMAGE_SOURCES).toEqual(["mymoon", "moon", "earth", "sun"]);
  });

  it("names each source for the error banner, the tile, and the panel status bar", () => {
    expect(SOURCES.mymoon.label).toBe("NASA SVS Moon");
    expect(SOURCES.moon.label).toBe("NASA SVS Moon");
    expect(SOURCES.earth.label).toBe("DSCOVR Earth");
    expect(SOURCES.sun.label).toBe("SDO HMI Continuum");

    expect(IMAGE_SOURCES.map((s) => SOURCES[s].tile)).toEqual(["MYMOON", "MOON", "EARTH", "SUN"]);
    expect(IMAGE_SOURCES.map((s) => SOURCES[s].body)).toEqual(["MOON", "MOON", "EARTH", "SUN"]);
  });

  it("calls the moon frames renders and the photographs captures", () => {
    expect(SOURCES.mymoon.verb).toBe("rendered");
    expect(SOURCES.moon.verb).toBe("rendered");
    expect(SOURCES.earth.verb).toBe("captured");
    expect(SOURCES.sun.verb).toBe("captured");
    expect(SOURCES.mymoon.instrument).toBe("NASA SVS");
    expect(SOURCES.earth.instrument).toBe("NASA DSCOVR");
    expect(SOURCES.sun.instrument).toBe("NASA SDO HMI");
  });

  it("keeps every on-screen target under a full tile", () => {
    // Earth's target sits *above* its disc on purpose — its loose DSCOVR crop is scaled up to
    // meet the shared size the tighter Moon and Sun frames are scaled down to.
    for (const source of IMAGE_SOURCES) {
      expect(SOURCES[source].target).toBeLessThan(1);
    }
    expect(SOURCES.moon.disc).toBe(0.95);
    expect(SOURCES.earth.disc).toBe(0.82);
    expect(SOURCES.sun.disc).toBe(0.945);
    expect(SOURCES.moon.target).toBe(0.89);
    expect(SOURCES.earth.target).toBe(0.87);
    expect(SOURCES.sun.target).toBe(0.8);
  });

  it("ships mymoon alone as the enabled-by-default source", () => {
    expect(IMAGE_SOURCES.filter((s) => SOURCES[s].onByDefault)).toEqual(["mymoon"]);
  });

  it("marks only the sky tile as needing the observer's own frame", () => {
    expect(IMAGE_SOURCES.filter((s) => SOURCES[s].skyFrame)).toEqual(["mymoon"]);
  });

  it("collapses both moon tiles into one debug row, and splits earth's two network calls", () => {
    expect(SOURCES.mymoon.debugRow).toEqual({ url: "moon", img: "moon" });
    expect(SOURCES.moon.debugRow).toEqual({ url: "moon", img: "moon" });
    expect(SOURCES.sun.debugRow).toEqual({ url: "sun", img: "sun" });
    expect(SOURCES.earth.debugRow).toEqual({ url: "earth-url", img: "earth-img" });
  });
});
