import { describe, expect, it } from "vitest";
import { SolarViewCard } from "../../src/card/card.js";
import { createAndMount, setupCardTest } from "./helpers.js";

setupCardTest();

// What's left once the view, navigation, gallery, status bar, and the two automatic behaviours
// have their own files: config parsing, appearance (height/theme), the hass setter and location
// resolution, and the lifecycle null guards.
describe("SolarViewCard", () => {
  it("should be a class", () => {
    expect(typeof SolarViewCard).toBe("function");
  });

  it("setConfig stores config", () => {
    const card = document.createElement("ha-planetary-solar-system-card-test");
    card.setConfig({ title: "test" });
    expect(card._config).toEqual({ title: "test" });
  });

  it("ecliptic_view defaults to false when not set", () => {
    const card = document.createElement("ha-planetary-solar-system-card-test");
    card.setConfig({});
    expect(card._eclipticView).toBe(false);
  });

  it("ecliptic_view is true when config.ecliptic_view is 'south'", () => {
    const card = document.createElement("ha-planetary-solar-system-card-test");
    card.setConfig({ ecliptic_view: "south" });
    expect(card._eclipticView).toBe(true);
  });

  it("ecliptic_view is false when config.ecliptic_view is 'north'", () => {
    const card = document.createElement("ha-planetary-solar-system-card-test");
    card.setConfig({ ecliptic_view: "north" });
    expect(card._eclipticView).toBe(false);
  });

  it("ecliptic_view ignores unrecognised values", () => {
    const card = document.createElement("ha-planetary-solar-system-card-test");
    card.setConfig({ ecliptic_view: true });
    expect(card._eclipticView).toBe(false);
  });

  it("height defaults to no max-height (auto) when not set", () => {
    const card = document.createElement("ha-planetary-solar-system-card-test");
    card.setConfig({});
    document.body.appendChild(card);
    expect(card.shadowRoot.querySelector("#solar-view").style.maxHeight).toBe("");
    card.remove();
  });

  it("height: 'auto' produces no max-height", () => {
    const card = document.createElement("ha-planetary-solar-system-card-test");
    card.setConfig({ height: "auto" });
    document.body.appendChild(card);
    expect(card.shadowRoot.querySelector("#solar-view").style.maxHeight).toBe("");
    card.remove();
  });

  it("height: 400 caps #solar-view and .image-view at 400px", () => {
    const card = document.createElement("ha-planetary-solar-system-card-test");
    card.setConfig({ height: 400 });
    document.body.appendChild(card);
    expect(card.shadowRoot.querySelector("#solar-view").style.maxHeight).toBe("400px");
    expect(card.shadowRoot.querySelector(".image-view").style.maxHeight).toBe("400px");
    card.remove();
  });

  it("height: '300px' caps #solar-view and .image-view at 300px", () => {
    const card = document.createElement("ha-planetary-solar-system-card-test");
    card.setConfig({ height: "300px" });
    document.body.appendChild(card);
    expect(card.shadowRoot.querySelector("#solar-view").style.maxHeight).toBe("300px");
    expect(card.shadowRoot.querySelector(".image-view").style.maxHeight).toBe("300px");
    card.remove();
  });

  it("height: '50%' reshapes the aspect-ratio instead of capping height", () => {
    const card = document.createElement("ha-planetary-solar-system-card-test");
    card.setConfig({ height: "50%" });
    document.body.appendChild(card);
    expect(card.shadowRoot.querySelector("#solar-view").style.aspectRatio).toBe("2 / 1");
    expect(card.shadowRoot.querySelector(".image-view").style.aspectRatio).toBe("2 / 1");
    expect(card.shadowRoot.querySelector("#solar-view").style.maxHeight).toBe("");
    card.remove();
  });

  it("height: '0%' ignores a zero percentage and falls back to auto", () => {
    const card = document.createElement("ha-planetary-solar-system-card-test");
    card.setConfig({ height: "0%" });
    document.body.appendChild(card);
    expect(card.shadowRoot.querySelector("#solar-view").style.aspectRatio).toBe("");
    expect(card.shadowRoot.querySelector("#solar-view").style.maxHeight).toBe("");
    card.remove();
  });

  it("height ignores invalid values and falls back to auto", () => {
    const card = document.createElement("ha-planetary-solar-system-card-test");
    card.setConfig({ height: -10 });
    document.body.appendChild(card);
    expect(card.shadowRoot.querySelector("#solar-view").style.maxHeight).toBe("");
    card.remove();
  });

  it("theme defaults to auto (no forced background/color)", () => {
    const card = document.createElement("ha-planetary-solar-system-card-test");
    card.setConfig({});
    document.body.appendChild(card);
    const cardEl = card.shadowRoot.querySelector(".card");
    expect(cardEl.style.background).toBe("");
    expect(cardEl.style.color).toBe("");
    card.remove();
  });

  it("theme: 'dark' forces a dark background/text pair regardless of the host theme", () => {
    const card = document.createElement("ha-planetary-solar-system-card-test");
    card.setConfig({ theme: "dark" });
    document.body.appendChild(card);
    const cardEl = card.shadowRoot.querySelector(".card");
    expect(cardEl.style.background).toBe("rgb(28, 28, 28)");
    expect(cardEl.style.color).toBe("rgb(225, 225, 225)");
    card.remove();
  });

  it("theme: 'light' forces a light background/text pair regardless of the host theme", () => {
    const card = document.createElement("ha-planetary-solar-system-card-test");
    card.setConfig({ theme: "light" });
    document.body.appendChild(card);
    const cardEl = card.shadowRoot.querySelector(".card");
    expect(cardEl.style.background).toBe("rgb(255, 255, 255)");
    expect(cardEl.style.color).toBe("rgb(33, 33, 33)");
    card.remove();
  });

  it("colors.background still overrides the forced theme's background", () => {
    const card = document.createElement("ha-planetary-solar-system-card-test");
    card.setConfig({ theme: "dark", colors: { background: "#ff00ff" } });
    document.body.appendChild(card);
    const cardEl = card.shadowRoot.querySelector(".card");
    expect(cardEl.style.background).toBe("rgb(255, 0, 255)");
    expect(cardEl.style.color).toBe("rgb(225, 225, 225)");
    card.remove();
  });

  it("theme: 'dark' resets HA theme custom properties (status-bar/nav backgrounds, borders) to 'initial' so they don't leak the host HA theme's colors", () => {
    // These vars are consumed by card-styles.ts (.status-bar/.nav background, borders) with a
    // currentColor fallback. "initial" is the guaranteed-invalid value for a custom property,
    // which is what makes var()'s fallback apply.
    const card = document.createElement("ha-planetary-solar-system-card-test");
    card.setConfig({ theme: "dark" });
    document.body.appendChild(card);
    expect(card.style.getPropertyValue("--secondary-background-color")).toBe("initial");
    expect(card.style.getPropertyValue("--divider-color")).toBe("initial");
    expect(card.style.getPropertyValue("--primary-text-color")).toBe("initial");
    card.remove();
  });

  it("theme: 'auto' leaves HA theme custom properties untouched", () => {
    const card = document.createElement("ha-planetary-solar-system-card-test");
    card.setConfig({});
    document.body.appendChild(card);
    expect(card.style.getPropertyValue("--secondary-background-color")).toBe("");
    card.remove();
  });

  it("theme ignores unrecognised values and falls back to auto", () => {
    const card = document.createElement("ha-planetary-solar-system-card-test");
    card.setConfig({ theme: "purple" });
    document.body.appendChild(card);
    const cardEl = card.shadowRoot.querySelector(".card");
    expect(cardEl.style.background).toBe("");
    expect(cardEl.style.color).toBe("");
    card.remove();
  });

  it("getCardSize returns 6", () => {
    const card = document.createElement("ha-planetary-solar-system-card-test");
    expect(card.getCardSize()).toBe(6);
  });

  it("getStubConfig returns default config with all options", () => {
    expect(SolarViewCard.getStubConfig()).toEqual({
      default_zoom: 2,
      periodic_zoom_change: false,
      periodic_zoom_max: 4,
      refresh_mins: 1,
      zoom_animate: true,
      colors: {},
      gallery: { mode: "both" },
    });
  });

  describe("hass setter", () => {
    it("set hass updates location fields and re-renders", () => {
      const card = createAndMount();
      card.hass = {
        config: {
          latitude: 51.5,
          longitude: -0.1,
          time_zone: "Europe/London",
          location_name: "London",
        },
      };
      expect(card._hassLocation).toEqual({
        lat: 51.5,
        lon: -0.1,
        timezone: "Europe/London",
        name: "London",
      });
      const bar = card.shadowRoot.querySelector(".status-bar");
      expect(bar).not.toBeNull();
      card.remove();
    });

    it("set hass does not re-render when location has not changed", () => {
      const card = createAndMount();
      const hassObj = {
        config: {
          latitude: 40,
          longitude: -74,
          time_zone: "America/New_York",
          location_name: "NY",
        },
      };
      card.hass = hassObj;
      const htmlAfterFirst = card.shadowRoot.innerHTML;
      card.hass = hassObj;
      // innerHTML should be identical — no re-render occurred
      expect(card.shadowRoot.innerHTML).toBe(htmlAfterFirst);
      card.remove();
    });

    it("set hass with null config fields clears location", () => {
      const card = createAndMount();
      card.hass = {
        config: {
          latitude: 51.5,
          longitude: -0.1,
          time_zone: "Europe/London",
          location_name: "London",
        },
      };
      expect(card._hassLocation.lat).toBe(51.5);
      card.hass = { config: {} };
      expect(card._hassLocation).toEqual({ lat: null, lon: null, timezone: null, name: null });
      card.remove();
    });
  });

  describe("location override", () => {
    it("config.location overrides HA lat/lon/hemisphere and status-bar name", () => {
      const card = createAndMount();
      card.hass = {
        config: {
          latitude: 51.5,
          longitude: -0.1,
          time_zone: "Europe/London",
          location_name: "London",
        },
      };
      card.setConfig({ location: { latitude: -34.9, longitude: -56.2, name: "Montevideo" } });
      card._render();
      expect(card._locationData?.lat).toBe(-34.9);
      expect(card._locationData?.lon).toBe(-56.2);
      expect(card._hemisphere).toBe("south");
      expect(card._effectiveLocationName).toBe("Montevideo");
      card.remove();
    });

    it("config.location with only latitude set is ignored, falls back to HA", () => {
      const card = createAndMount();
      card.hass = { config: { latitude: 51.5, longitude: -0.1 } };
      card.setConfig({ location: { latitude: -34.9 } });
      card._render();
      expect(card._locationData?.lat).toBe(51.5);
      expect(card._locationData?.lon).toBe(-0.1);
      expect(card._hemisphere).toBe("north");
      card.remove();
    });

    it("config.location with out-of-range latitude is ignored, falls back to HA", () => {
      const card = createAndMount();
      card.hass = { config: { latitude: 51.5, longitude: -0.1 } };
      card.setConfig({ location: { latitude: 200, longitude: -56.2 } });
      card._render();
      expect(card._locationData?.lat).toBe(51.5);
      expect(card._locationData?.lon).toBe(-0.1);
      card.remove();
    });

    it("config.location with out-of-range longitude is ignored, falls back to HA", () => {
      const card = createAndMount();
      card.hass = { config: { latitude: 51.5, longitude: -0.1 } };
      card.setConfig({ location: { latitude: -34.9, longitude: -200 } });
      card._render();
      expect(card._locationData?.lat).toBe(51.5);
      expect(card._locationData?.lon).toBe(-0.1);
      card.remove();
    });

    it("config.location override switches timezone to a longitude-derived offset zone", () => {
      const card = createAndMount();
      card.hass = { config: { latitude: 41.9, longitude: -87.6, time_zone: "America/Chicago" } };
      card.setConfig({ location: { latitude: 51.5, longitude: -0.1278, name: "London" } });
      card._render();
      expect(card._locationData?.timezone).toBe("Etc/GMT+0");
      expect(card._locationData?.zoneOverride).toBe(true);
      card.remove();
    });

    it("no config.location keeps HA's timezone", () => {
      const card = createAndMount();
      card.hass = { config: { latitude: 41.9, longitude: -87.6, time_zone: "America/Chicago" } };
      card.setConfig({});
      card._render();
      expect(card._locationData?.timezone).toBe("America/Chicago");
      expect(card._locationData?.zoneOverride).toBe(false);
      card.remove();
    });

    it("no config.location falls back to HA lat/lon/name", () => {
      const card = createAndMount();
      card.hass = { config: { latitude: 51.5, longitude: -0.1, location_name: "London" } };
      card.setConfig({});
      expect(card._locationData?.lat).toBe(51.5);
      expect(card._locationData?.lon).toBe(-0.1);
      expect(card._effectiveLocationName).toBe("London");
      card.remove();
    });
  });

  describe("proxy getters before first render", () => {
    it("return safe defaults when _viewState is null", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      // Card created but never mounted — _viewState is null
      expect(card._zoomLevel).toBeNull();
    });
  });

  describe("internal method null guards", () => {
    it("_zoom.advancePeriodic is a no-op before the view is initialized", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      expect(() => card._zoom.advancePeriodic()).not.toThrow();
    });

    it("_zoom.zoomIn is a no-op before the view is initialized", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      expect(() => card._zoom.zoomIn()).not.toThrow();
    });

    it("_zoom.zoomOut is a no-op before the view is initialized", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      expect(() => card._zoom.zoomOut()).not.toThrow();
    });

    it("disconnectedCallback is safe before connectedCallback", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      expect(() => card.disconnectedCallback()).not.toThrow();
    });
  });

  describe("southern hemisphere", () => {
    it("sets hemisphere to south when lat is negative", () => {
      const card = createAndMount();
      card._hassLocation = { lat: -33.9, lon: 151.2, timezone: null, name: null }; // Sydney
      card._render();
      expect(card._hemisphere).toBe("south");
      card.remove();
    });
  });
});
