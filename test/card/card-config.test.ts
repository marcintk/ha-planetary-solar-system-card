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
      galleryMode: "off",
      galleryPosition: "overlay",
      galleryShape: "square",
      gallerySources: ["mymoon", "moon", "earth", "sun"],
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
    it("falls back to 'off' for an unrecognised mode", () => {
      expect(parseCardConfig({ gallery: { mode: "bogus" } }).galleryMode).toBe("off");
    });
    it("accepts 'off'", () => {
      expect(parseCardConfig({ gallery: { mode: "off" } }).galleryMode).toBe("off");
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

    describe("sources", () => {
      it("keeps recognised sources in the order given — order is the layout", () => {
        expect(
          parseCardConfig({ gallery: { sources: ["sun", "earth", "mymoon"] } }).gallerySources
        ).toEqual(["sun", "earth", "mymoon"]);
      });

      it("drops unknown entries and de-duplicates, keeping first position", () => {
        expect(
          parseCardConfig({
            gallery: { sources: ["moon", "hubble-mars", "sun", "moon"] },
          }).gallerySources
        ).toEqual(["moon", "sun"]);
      });

      it("falls back to the fetched sources when nothing valid remains", () => {
        const fetched = ["mymoon", "moon", "earth", "sun"];
        expect(parseCardConfig({ gallery: { sources: ["hubble-mars"] } }).gallerySources).toEqual(
          fetched
        );
        expect(parseCardConfig({ gallery: { sources: [] } }).gallerySources).toEqual(fetched);
        expect(
          parseCardConfig({ gallery: { sources: "moon" as unknown as string[] } }).gallerySources
        ).toEqual(fetched);
      });

      // Source names gained their instrument in this version. A #140 dashboard should keep
      // showing the same bodies rather than silently reverting to the default set.
      it("maps the pre-instrument names onto their sources", () => {
        expect(
          parseCardConfig({ gallery: { sources: ["moon", "earth", "sun"] } }).gallerySources
        ).toEqual(["moon", "earth", "sun"]);
      });

      it("de-duplicates across the old and new spelling of one source", () => {
        expect(parseCardConfig({ gallery: { sources: ["moon", "moon"] } }).gallerySources).toEqual([
          "moon",
        ]);
      });
    });

    // Two older generations of `mode` values. The pre-#140 names picked sources as well as
    // presentation; #140's "closed" is this version's "off". Without this mapping they would
    // fail the mode check and silently fall back to the default.
    describe("legacy mode strings", () => {
      it.each([
        ["none", "off"],
        ["closed", "off"],
        ["earth", "open"],
        ["sun", "open"],
        ["both", "open"],
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
