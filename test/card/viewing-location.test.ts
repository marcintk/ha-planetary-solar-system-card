import { describe, expect, it } from "vitest";
import {
  moonExtinctionTint,
  skyBackgroundForElevation,
  ViewingLocation,
} from "../../src/card/viewing-location.js";

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
        extinction: "rgba(0, 0, 0, 0)",
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
      expect(location.skyFrame(new Date("2026-12-21T00:00:00Z")).background).toBe("#06050a");
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
      expect(skyBackgroundForElevation(-30)).toBe("#06050a");
    });

    // #177: mix-blend-mode: color takes hue/saturation from the tint layer and no-ops on an
    // achromatic (R === G === B) top layer, so a pure-black night anchor silently disabled the
    // night tint. The plateau color below -18deg must carry some hue to actually blend.
    it("keeps the night plateau chromatic so mix-blend-mode: color can still tint it", () => {
      const night = skyBackgroundForElevation(-30);
      const r = Number.parseInt(night.slice(1, 3), 16);
      const g = Number.parseInt(night.slice(3, 5), 16);
      const b = Number.parseInt(night.slice(5, 7), 16);
      expect(new Set([r, g, b]).size).toBeGreaterThan(1);
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

  // #178: real moonlight reddens/dims near the horizon from crossing more atmosphere
  // (extinction) — the tint's *hue* is driven by the Moon's own altitude, not the Sun's, so it's
  // a second overlay rather than a replacement for skyBackgroundForElevation. But its visible
  // *strength* isn't fully independent of the Sun: a bright sky washes the same tint out
  // (contrast fade, tested below), so a night-sky sunElevDeg is used here to isolate the
  // altitude-only behavior these tests are about.
  const NIGHT_SUN_DEG = -20;
  const strengthOf = (rgba: string) => Number.parseFloat(rgba.split(",")[3]);

  describe("moonExtinctionTint", () => {
    it("has no strength at the zenith", () => {
      expect(moonExtinctionTint(90, NIGHT_SUN_DEG)).toBe("rgba(255, 102, 26, 0.00)");
    });

    it("is at full strength right at the horizon, against a night sky", () => {
      expect(moonExtinctionTint(0, NIGHT_SUN_DEG)).toBe("rgba(255, 102, 26, 1.00)");
    });

    it("weakens monotonically as altitude climbs, steeply near the horizon", () => {
      const low = moonExtinctionTint(2, NIGHT_SUN_DEG);
      const mid = moonExtinctionTint(10, NIGHT_SUN_DEG);
      const high = moonExtinctionTint(30, NIGHT_SUN_DEG);
      expect(strengthOf(low)).toBeGreaterThan(strengthOf(mid));
      expect(strengthOf(mid)).toBeGreaterThan(strengthOf(high));
      // A well-up Moon reads as essentially white: negligible strength by 30deg.
      expect(strengthOf(high)).toBeLessThan(0.1);
    });

    it("stays essentially white for a Moon at typical viewing altitude", () => {
      // #178 originally shipped a curve that gave a real, well-up 22deg Moon roughly half
      // strength — visibly red when real observers report it reading white. This is the
      // regression test for that: a well-up Moon must stay close to colorless.
      expect(strengthOf(moonExtinctionTint(22, NIGHT_SUN_DEG))).toBeLessThan(0.05);
    });

    it("clamps rather than going negative below the horizon", () => {
      expect(moonExtinctionTint(-10, NIGHT_SUN_DEG)).toBe("rgba(255, 102, 26, 1.00)");
    });

    // Contrast fade: the same low Moon reads weaker against a brighter sky, because the sky's
    // own scattered light veils the tint (simultaneous contrast) rather than the Moon's true
    // color actually changing.
    it("fades a low Moon's tint toward zero as the sky brightens", () => {
      const night = strengthOf(moonExtinctionTint(2, NIGHT_SUN_DEG));
      const civilTwilight = strengthOf(moonExtinctionTint(2, -6));
      const day = strengthOf(moonExtinctionTint(2, 10));
      expect(night).toBeGreaterThan(civilTwilight);
      expect(civilTwilight).toBeGreaterThan(day);
      expect(day).toBe(0);
    });

    it("leaves the tint untouched at true night regardless of exact sun angle", () => {
      // Below the -18deg anchor the sky wash is already a flat plateau, so the fade must be too.
      expect(moonExtinctionTint(2, -19)).toBe(moonExtinctionTint(2, -25));
    });
  });
});
