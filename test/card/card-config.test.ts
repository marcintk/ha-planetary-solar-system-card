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
      galleryMode: "show",
      galleryPosition: "overlay",
      galleryShape: "square",
      gallerySources: ["mymoon"],
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
    it("accepts 'slide' and 'off'", () => {
      expect(parseCardConfig({ gallery: { mode: "slide" } }).galleryMode).toBe("slide");
      expect(parseCardConfig({ gallery: { mode: "off" } }).galleryMode).toBe("off");
    });
    it("falls back to 'show' for an unrecognised mode — including no mode at all", () => {
      expect(parseCardConfig({ gallery: { mode: "bogus" } }).galleryMode).toBe("show");
      expect(parseCardConfig({}).galleryMode).toBe("show");
      expect(parseCardConfig({ gallery: {} }).galleryMode).toBe("show");
    });

    describe("position", () => {
      it("puts the strip below the solar view when asked", () => {
        expect(parseCardConfig({ gallery: { position: "below" } }).galleryPosition).toBe("below");
      });
      it("overlays by default and for anything unrecognised", () => {
        expect(parseCardConfig({}).galleryPosition).toBe("overlay");
        expect(parseCardConfig({ gallery: { position: "bogus" } }).galleryPosition).toBe("overlay");
      });
    });

    describe("shape", () => {
      it("crops to the body when asked for circle", () => {
        expect(parseCardConfig({ gallery: { shape: "circle" } }).galleryShape).toBe("circle");
      });
      it("shows the published frame by default and for anything unrecognised", () => {
        expect(parseCardConfig({}).galleryShape).toBe("square");
        expect(parseCardConfig({ gallery: { shape: "round" } }).galleryShape).toBe("square");
      });
    });

    // Each source is its own boolean now, not a position in a list — mymoon defaults on,
    // the three NASA photographs default off, and render order is always fixed
    // (mymoon, moon, earth, sun) regardless of which keys the config sets or their order.
    describe("sources", () => {
      it("defaults to mymoon only", () => {
        expect(parseCardConfig({}).gallerySources).toEqual(["mymoon"]);
        expect(parseCardConfig({ gallery: {} }).gallerySources).toEqual(["mymoon"]);
      });

      it("enables exactly the sources set true, in fixed render order", () => {
        expect(
          parseCardConfig({ gallery: { mymoon: false, sun: true, earth: true } }).gallerySources
        ).toEqual(["earth", "sun"]);
        expect(parseCardConfig({ gallery: { mymoon: false, moon: true } }).gallerySources).toEqual([
          "moon",
        ]);
      });

      it("enables all four when every flag is set true", () => {
        expect(
          parseCardConfig({
            gallery: { mymoon: true, moon: true, earth: true, sun: true },
          }).gallerySources
        ).toEqual(["mymoon", "moon", "earth", "sun"]);
      });

      it("can disable every tile, leaving an empty strip", () => {
        expect(parseCardConfig({ gallery: { mymoon: false } }).gallerySources).toEqual([]);
      });
    });

    // The pre-#140 names picked sources as well as presentation; #140's "closed" is this
    // version's "off". Individual source selection is gone from `mode` entirely now — every
    // legacy value that isn't an off-alias or "slide" just becomes the new default, "show".
    describe("legacy mode strings", () => {
      it.each([
        ["none", "off"],
        ["closed", "off"],
        ["earth", "show"],
        ["sun", "show"],
        ["both", "show"],
        ["open", "show"],
      ])("maps %s to %s", (legacy, mode) => {
        expect(parseCardConfig({ gallery: { mode: legacy } }).galleryMode).toBe(mode);
      });

      it("leaves slide alone — it means the same thing it always did", () => {
        expect(parseCardConfig({ gallery: { mode: "slide" } }).galleryMode).toBe("slide");
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
