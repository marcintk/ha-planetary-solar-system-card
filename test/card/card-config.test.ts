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
      galleryMode: "closed",
      gallerySources: ["moon"],
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
        timezone: "Etc/GMT-1",
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
    it("derives a longitude-based fixed-offset timezone", () => {
      // Etc/GMT sign is POSIX-inverted: Etc/GMT+6 is UTC-6.
      expect(
        parseCardConfig({ location: { latitude: 30, longitude: -90 } }).locationOverride
      ).toEqual({ lat: 30, lon: -90, timezone: "Etc/GMT+6" });
      expect(
        parseCardConfig({ location: { latitude: 35, longitude: 139.7 } }).locationOverride
      ).toEqual({ lat: 35, lon: 139.7, timezone: "Etc/GMT-9" });
      expect(
        parseCardConfig({ location: { latitude: 51.5, longitude: -0.1278 } }).locationOverride
      ).toEqual({ lat: 51.5, lon: -0.1278, timezone: "Etc/GMT+0" });
    });
    it("prefers an explicit IANA location.timezone over the longitude estimate", () => {
      expect(
        parseCardConfig({
          location: { latitude: 50.0614, longitude: 19.9366, timezone: "Europe/Warsaw" },
        }).locationOverride
      ).toEqual({ lat: 50.0614, lon: 19.9366, timezone: "Europe/Warsaw" });
    });
    it("falls back to the longitude estimate when location.timezone is unusable", () => {
      // Krakow's longitude estimates to UTC+1 — right in winter, an hour off in summer.
      const derived = { lat: 50.0614, lon: 19.9366, timezone: "Etc/GMT-1" };
      expect(
        parseCardConfig({
          location: { latitude: 50.0614, longitude: 19.9366, timezone: "Not/AZone" },
        }).locationOverride
      ).toEqual(derived);
      expect(
        parseCardConfig({ location: { latitude: 50.0614, longitude: 19.9366, timezone: "" } })
          .locationOverride
      ).toEqual(derived);
      // camelCase is not the key — silently ignored, like any unknown HA card option.
      expect(
        parseCardConfig({
          location: { latitude: 50.0614, longitude: 19.9366, timeZone: "Europe/Warsaw" },
        } as never).locationOverride
      ).toEqual(derived);
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
      expect(parseCardConfig({ gallery: { mode: "open" } }).galleryMode).toBe("open");
      expect(parseCardConfig({ gallery: { mode: "slide" } }).galleryMode).toBe("slide");
    });
    it("falls back to 'closed' for an unrecognised mode", () => {
      expect(parseCardConfig({ gallery: { mode: "bogus" } }).galleryMode).toBe("closed");
    });

    describe("sources", () => {
      it("keeps recognised sources in the order given", () => {
        expect(
          parseCardConfig({ gallery: { sources: ["sun", "moon", "earth"] } }).gallerySources
        ).toEqual(["sun", "moon", "earth"]);
      });
      it("drops unknown entries and de-duplicates, keeping first position", () => {
        expect(
          parseCardConfig({ gallery: { sources: ["moon", "mars", "earth", "moon"] } })
            .gallerySources
        ).toEqual(["moon", "earth"]);
      });
      it("falls back to ['moon'] when nothing valid remains", () => {
        expect(parseCardConfig({ gallery: { sources: ["mars"] } }).gallerySources).toEqual([
          "moon",
        ]);
        expect(parseCardConfig({ gallery: { sources: [] } }).gallerySources).toEqual(["moon"]);
        expect(
          parseCardConfig({ gallery: { sources: "earth" as unknown as string[] } }).gallerySources
        ).toEqual(["moon"]);
      });
    });

    // Pre-#140 configs used a single `mode` string that conflated presentation with source
    // selection. Without this mapping they would fail the mode check and silently fall back
    // to the default, quietly changing what an existing dashboard shows.
    describe("legacy mode strings", () => {
      it.each([
        ["none", "closed", ["moon"]],
        ["earth", "open", ["earth"]],
        ["sun", "open", ["sun"]],
        ["both", "open", ["earth", "sun"]],
        ["slide", "slide", ["earth", "sun"]],
      ])("maps %s to %s with %j", (legacy, mode, sources) => {
        const parsed = parseCardConfig({ gallery: { mode: legacy } });
        expect(parsed.galleryMode).toBe(mode);
        expect(parsed.gallerySources).toEqual(sources);
      });

      it("an explicit sources list wins over a legacy mode's implied sources", () => {
        const parsed = parseCardConfig({ gallery: { mode: "both", sources: ["moon"] } });
        expect(parsed.galleryMode).toBe("open");
        expect(parsed.gallerySources).toEqual(["moon"]);
      });
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
