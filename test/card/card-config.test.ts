import { describe, expect, it } from "vitest";
import { parseCardConfig } from "../../src/card/card-config.js";

describe("parseCardConfig", () => {
  it("applies all defaults for an empty config", () => {
    const parsed = parseCardConfig({});
    expect(parsed).toEqual({
      zoomLevel: 1,
      refreshMs: 60000,
      periodicZoomChange: false,
      periodicZoomMax: 4,
      zoomAnimate: true,
      colors: {},
      theme: "auto",
      eclipticView: false,
      locationOverride: null,
      locationNameOverride: null,
      heightStyle: "",
      galleryMode: "none",
      galleryIntervalMs: 60000,
    });
  });

  describe("zoomLevel", () => {
    it("uses default_zoom when within range", () => {
      expect(parseCardConfig({ default_zoom: 3 }).zoomLevel).toBe(3);
    });
    it("falls back to default when out of range", () => {
      expect(parseCardConfig({ default_zoom: 0 }).zoomLevel).toBe(1);
      expect(parseCardConfig({ default_zoom: 5 }).zoomLevel).toBe(1);
    });
  });

  describe("refreshMs", () => {
    it("converts refresh_mins to milliseconds", () => {
      expect(parseCardConfig({ refresh_mins: 2 }).refreshMs).toBe(120000);
    });
    it("falls back to 60000 when invalid or too small", () => {
      expect(parseCardConfig({ refresh_mins: 0 }).refreshMs).toBe(60000);
      expect(parseCardConfig({ refresh_mins: Number.NaN }).refreshMs).toBe(60000);
    });
  });

  describe("periodicZoomMax", () => {
    it("uses periodic_zoom_max when a valid integer in range", () => {
      expect(parseCardConfig({ periodic_zoom_max: 3 }).periodicZoomMax).toBe(3);
    });
    it("falls back to MAX_ZOOM when non-integer or out of range", () => {
      expect(parseCardConfig({ periodic_zoom_max: 1.5 }).periodicZoomMax).toBe(4);
      expect(parseCardConfig({ periodic_zoom_max: 1 }).periodicZoomMax).toBe(4);
      expect(parseCardConfig({ periodic_zoom_max: 5 }).periodicZoomMax).toBe(4);
    });
  });

  describe("periodicZoomChange / zoomAnimate", () => {
    it("periodic_zoom_change defaults false, true only when === true", () => {
      expect(
        parseCardConfig({ periodic_zoom_change: "yes" as unknown as boolean }).periodicZoomChange
      ).toBe(false);
      expect(parseCardConfig({ periodic_zoom_change: true }).periodicZoomChange).toBe(true);
    });
    it("zoom_animate defaults true, false only when === false", () => {
      expect(parseCardConfig({ zoom_animate: false }).zoomAnimate).toBe(false);
      expect(parseCardConfig({}).zoomAnimate).toBe(true);
    });
  });

  describe("theme", () => {
    it("passes through dark/light, falls back to auto", () => {
      expect(parseCardConfig({ theme: "dark" }).theme).toBe("dark");
      expect(parseCardConfig({ theme: "light" }).theme).toBe("light");
      expect(parseCardConfig({ theme: "purple" as unknown as "dark" }).theme).toBe("auto");
    });
  });

  describe("eclipticView", () => {
    it("true only when ecliptic_view === 'south'", () => {
      expect(parseCardConfig({ ecliptic_view: "south" }).eclipticView).toBe(true);
      expect(parseCardConfig({ ecliptic_view: "north" }).eclipticView).toBe(false);
    });
  });

  describe("locationOverride", () => {
    it("accepts a valid lat/lon pair", () => {
      expect(
        parseCardConfig({ location: { latitude: 10, longitude: 20 } }).locationOverride
      ).toEqual({
        lat: 10,
        lon: 20,
      });
    });
    it("rejects out-of-range or missing values", () => {
      expect(
        parseCardConfig({ location: { latitude: 91, longitude: 20 } }).locationOverride
      ).toBeNull();
      expect(
        parseCardConfig({ location: { latitude: 10, longitude: 181 } }).locationOverride
      ).toBeNull();
      expect(parseCardConfig({ location: { latitude: 10 } }).locationOverride).toBeNull();
    });
    it("parses locationNameOverride independently", () => {
      expect(parseCardConfig({ location: { name: "Home" } }).locationNameOverride).toBe("Home");
    });
  });

  describe("heightStyle", () => {
    it("resolves a px height", () => {
      expect(parseCardConfig({ height: 400 }).heightStyle).toBe("max-height: 400px");
    });
    it("resolves a percent height", () => {
      expect(parseCardConfig({ height: "50%" }).heightStyle).toBe("aspect-ratio: 2");
    });
  });

  describe("gallery", () => {
    it("uses a recognised gallery mode", () => {
      expect(parseCardConfig({ gallery: { mode: "sun" } }).galleryMode).toBe("sun");
    });
    it("falls back to 'none' for an unrecognised mode", () => {
      expect(parseCardConfig({ gallery: { mode: "bogus" } }).galleryMode).toBe("none");
    });
    it("converts slide_interval_secs to milliseconds", () => {
      expect(parseCardConfig({ gallery: { slide_interval_secs: 5 } }).galleryIntervalMs).toBe(5000);
    });
    it("falls back to the default interval when invalid", () => {
      expect(parseCardConfig({ gallery: { slide_interval_secs: 0 } }).galleryIntervalMs).toBe(
        60000
      );
    });
  });
});
