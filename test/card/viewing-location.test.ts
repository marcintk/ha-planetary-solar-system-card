import { describe, expect, it } from "vitest";
import { skyBackgroundForElevation, ViewingLocation } from "../../src/card/viewing-location.js";

const LONDON = {
  config: { latitude: 51.5, longitude: -0.1, time_zone: "Europe/London", location_name: "London" },
};

describe("ViewingLocation", () => {
  describe("update", () => {
    it("reports a change the first time HA supplies a location", () => {
      const location = new ViewingLocation();
      expect(location.update(LONDON)).toBe(true);
      expect(location.data).toEqual({
        lat: 51.5,
        lon: -0.1,
        timezone: "Europe/London",
        zoneOverride: false,
      });
    });

    it("reports no change when the same location arrives again", () => {
      const location = new ViewingLocation();
      location.update(LONDON);
      expect(location.update(LONDON)).toBe(false);
    });

    it("reports a change when any one field moves", () => {
      const location = new ViewingLocation();
      location.update(LONDON);
      expect(
        location.update({ config: { ...LONDON.config, location_name: "Greater London" } })
      ).toBe(true);
      expect(location.name).toBe("Greater London");
    });

    it("treats a hass object with no config as no location at all", () => {
      const location = new ViewingLocation();
      expect(location.update({})).toBe(false);
      expect(location.data).toBeNull();
      expect(location.name).toBeNull();
    });
  });

  describe("configure", () => {
    it("lets a configured location win per field, and flags the overridden zone", () => {
      const location = new ViewingLocation();
      location.update(LONDON);
      location.configure({ lat: -34.9, lon: -56.2, timezone: "America/Montevideo" }, "Montevideo");
      expect(location.data).toEqual({
        lat: -34.9,
        lon: -56.2,
        timezone: "America/Montevideo",
        zoneOverride: true,
      });
      expect(location.name).toBe("Montevideo");
    });

    it("keeps HA's own name when the override names no location", () => {
      const location = new ViewingLocation();
      location.update(LONDON);
      location.configure({ lat: -34.9, lon: -56.2, timezone: "America/Montevideo" }, null);
      expect(location.name).toBe("London");
    });

    it("falls back to UTC when neither HA nor the override names a zone", () => {
      const location = new ViewingLocation();
      location.update({ config: { latitude: 10, longitude: 20 } });
      expect(location.data?.timezone).toBe("UTC");
      expect(location.data?.zoneOverride).toBe(false);
    });
  });

  describe("hemisphere", () => {
    it("reads north above the equator and south below it", () => {
      const location = new ViewingLocation();
      expect(location.hemisphere).toBe("north");
      location.update(LONDON);
      expect(location.hemisphere).toBe("north");
      location.update({ config: { latitude: -33.9, longitude: 151.2 } });
      expect(location.hemisphere).toBe("south");
    });

    it("follows the configured override, not HA's own latitude", () => {
      const location = new ViewingLocation();
      location.update(LONDON);
      location.configure({ lat: -34.9, lon: -56.2, timezone: "America/Montevideo" }, null);
      expect(location.hemisphere).toBe("south");
    });
  });

  describe("skyFrame", () => {
    // Geocentric and unlit is the honest frame to show when there is no observer to rotate or
    // light for — not a rotation of zero that happens to look deliberate.
    it("returns the geocentric frame on black with no location known", () => {
      const location = new ViewingLocation();
      expect(location.skyFrame(new Date("2026-03-05T12:00:00Z"))).toEqual({
        rotation: 0,
        belowHorizon: false,
        background: "#000",
      });
    });

    it("rotates the frame into the observer's own sky", () => {
      const location = new ViewingLocation();
      location.update(LONDON);
      const frame = location.skyFrame(new Date("2026-03-05T22:00:00Z"));
      expect(frame.rotation).not.toBe(0);
      expect(Math.abs(frame.rotation)).toBeLessThanOrEqual(180);
    });

    it("backs a daytime sky with the day wash and a night one with black", () => {
      const location = new ViewingLocation();
      location.update(LONDON);
      expect(location.skyFrame(new Date("2026-06-21T12:00:00Z")).background).toBe("#d0d0d0");
      expect(location.skyFrame(new Date("2026-12-21T00:00:00Z")).background).toBe("#000000");
    });

    it("interpolates continuously across a twilight band rather than snapping", () => {
      // -3deg sits midway inside Civil Twilight (-0.8333 to -6): must land strictly between the
      // Day and Civil Twilight anchors, not equal either one as a hard-cutoff lookup would.
      const mid = skyBackgroundForElevation(-3);
      expect(mid).not.toBe("#d0d0d0");
      expect(mid).not.toBe("#8a6142");
    });

    it("reaches each anchor color exactly at its own boundary elevation", () => {
      expect(skyBackgroundForElevation(10)).toBe("#d0d0d0");
      expect(skyBackgroundForElevation(-6)).toBe("#8a6142");
      expect(skyBackgroundForElevation(-12)).toBe("#3a4a6b");
      expect(skyBackgroundForElevation(-18)).toBe("#2a1f42");
      expect(skyBackgroundForElevation(-30)).toBe("#000000");
    });

    it("reports the Moon below the horizon without treating it as a failure", () => {
      const location = new ViewingLocation();
      location.update(LONDON);
      // Sampled across a full day: at this latitude the Moon is up for part of it and down for
      // the rest, so both states must be reachable.
      const states = Array.from(
        { length: 24 },
        (_, hour) => location.skyFrame(new Date(Date.UTC(2026, 2, 5, hour))).belowHorizon
      );
      expect(states).toContain(true);
      expect(states).toContain(false);
    });
  });
});
