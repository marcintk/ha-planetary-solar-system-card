import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SolarViewCard } from "../../src/card/card.js";
import { clearImageCache, EPIC_BASE_URL, getSunImageUrl } from "../../src/card/image-sources.js";

beforeAll(() => {
  if (!customElements.get("ha-planetary-solar-system-card-test")) {
    customElements.define("ha-planetary-solar-system-card-test", SolarViewCard);
  }
});

// Any mounted card with gallery.mode != "none" now fetches in the background from
// connectedCallback, even in describes that never stub fetch. Left unstubbed, that's a real
// network call — works in CI (real internet) but not locally, and a slow one can resolve
// after its own test ends and pollute image-sources.ts's module-level cache for a later
// test. Default fetch to a safe rejection for every test; individual tests override it with
// their own vi.stubGlobal("fetch", ...) when they want specific behavior.
//
// Every image path (initial open, gallery thumbnail, background refresh) now preloads a
// candidate off-DOM (resolveDisplayImage) before it's ever assigned to a visible <img>, via
// `new Image()`. Left unstubbed, that never resolves in jsdom (no real network), hanging
// every await. Default it to succeed on the next microtask for every test; pass one boolean
// per attempt to control retries (e.g. stubImagePreload(false, true) — first attempt fails,
// the sun retry succeeds); the last value repeats for any further attempt.
function stubImagePreload(...results) {
  let calls = 0;
  vi.stubGlobal(
    "Image",
    class {
      src = "";
      decode() {
        const succeeds = results.length ? results[Math.min(calls, results.length - 1)] : true;
        calls++;
        return succeeds ? Promise.resolve() : Promise.reject(new Error("decode failed"));
      }
    }
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fetch not stubbed for this test")));
  stubImagePreload();
});
afterEach(() => {
  vi.unstubAllGlobals();
  clearImageCache();
});

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

  function createAndMount(config) {
    const card = document.createElement("ha-planetary-solar-system-card-test");
    if (config) card.setConfig(config);
    document.body.appendChild(card);
    return card;
  }

  function clickButton(card, action) {
    const btn = card.shadowRoot.querySelector(`button[data-action="${action}"]`);
    btn.click();
  }

  function getSvgViewBox(card) {
    const svg = card.shadowRoot.querySelector("#solar-view svg");
    return svg.getAttribute("viewBox");
  }

  function parseViewBox(card) {
    const parts = getSvgViewBox(card).split(" ").map(Number);
    return { minX: parts[0], minY: parts[1], width: parts[2], height: parts[3] };
  }

  describe("auto-fit viewBox", () => {
    it("sets a viewBox on the SVG on first render", () => {
      const card = createAndMount();
      const vb = getSvgViewBox(card);
      expect(vb).toBeTruthy();
      const parts = vb.split(" ").map(Number);
      expect(parts).toHaveLength(4);
      // Width and height should be equal (square)
      expect(parts[2]).toBeCloseTo(parts[3], 1);
      card.remove();
    });

    it("viewBox is square even if bounds are not", () => {
      const card = createAndMount();
      const { width, height } = parseViewBox(card);
      expect(width).toBeCloseTo(height, 1);
      card.remove();
    });

    it("uses default zoom level 1 viewBox of 800x800", () => {
      const card = createAndMount();
      const { width, height } = parseViewBox(card);
      expect(width).toBe(800);
      expect(height).toBe(800);
      card.remove();
    });
  });

  describe("zoom controls (discrete levels)", () => {
    it("zoom in steps to next level", () => {
      const card = createAndMount();
      // Default is level 1 (800)
      expect(card._zoomLevel).toBe(1);
      clickButton(card, "zoom-in");
      expect(card._zoomLevel).toBe(2);
      const { width } = parseViewBox(card);
      expect(width).toBe(640);
      card.remove();
    });

    it("zoom out steps to previous level", () => {
      const card = createAndMount();
      // Default is level 1, zoom in first then zoom out
      clickButton(card, "zoom-in");
      expect(card._zoomLevel).toBe(2);
      clickButton(card, "zoom-out");
      expect(card._zoomLevel).toBe(1);
      const { width } = parseViewBox(card);
      expect(width).toBe(800);
      card.remove();
    });

    it("zoom in is clamped at level 4 (viewBox 320)", () => {
      const card = createAndMount();
      for (let i = 0; i < 20; i++) clickButton(card, "zoom-in");
      expect(card._zoomLevel).toBe(4);
      const { width, height } = parseViewBox(card);
      expect(width).toBe(320);
      expect(height).toBe(320);
      card.remove();
    });

    it("zoom out is clamped at level 1 (viewBox 800)", () => {
      const card = createAndMount();
      for (let i = 0; i < 20; i++) clickButton(card, "zoom-out");
      expect(card._zoomLevel).toBe(1);
      const { width } = parseViewBox(card);
      expect(width).toBe(800);
      card.remove();
    });

    it("zoom in then zoom out returns to same level", () => {
      const card = createAndMount();
      const before = parseViewBox(card);
      clickButton(card, "zoom-in");
      clickButton(card, "zoom-out");
      const after = parseViewBox(card);
      expect(after.width).toBe(before.width);
      card.remove();
    });

    it("zoom level display shows current level between buttons", () => {
      const card = createAndMount();
      const levelSpan = card.shadowRoot.querySelector(".zoom-level");
      expect(levelSpan).toBeTruthy();
      expect(levelSpan.textContent).toBe("1");
      clickButton(card, "zoom-in");
      expect(levelSpan.textContent).toBe("2");
      card.remove();
    });

    it("nav row buttons are in correct order", () => {
      const card = createAndMount({ gallery: { mode: "both" } });
      const buttons = card.shadowRoot.querySelectorAll(".nav button");
      const actions = Array.from(buttons).map((el) => el.dataset.action);
      expect(actions).toEqual([
        "month-back",
        "day-back",
        "hour-back",
        "today",
        "hour-forward",
        "day-forward",
        "month-forward",
        "replay",
        "zoom-out",
        "zoom-in",
        "gallery",
      ]);
      card.remove();
    });

    it("nav buttons are grouped in a .btn-group container", () => {
      const card = createAndMount({ gallery: { mode: "both" } });
      const btnGroups = card.shadowRoot.querySelectorAll(".btn-group");
      expect(btnGroups.length).toBe(3);
      // First group: nav buttons
      const navGroup = btnGroups[0];
      const navButtons = navGroup.querySelectorAll("button");
      expect(navButtons.length).toBe(8);
      expect(navButtons[0].dataset.action).toBe("month-back");
      expect(navButtons[7].dataset.action).toBe("replay");
      // Second group: zoom buttons
      const zoomGroup = btnGroups[1];
      const zoomButtons = zoomGroup.querySelectorAll("button");
      expect(zoomButtons.length).toBe(2);
      expect(zoomButtons[0].dataset.action).toBe("zoom-out");
      expect(zoomButtons[1].dataset.action).toBe("zoom-in");
      const levelSpan = zoomGroup.querySelector(".zoom-level");
      expect(levelSpan).toBeTruthy();
      // Third group: gallery button
      const imageGroup = btnGroups[2];
      const imageButtons = imageGroup.querySelectorAll("button");
      expect(imageButtons.length).toBe(1);
      expect(imageButtons[0].dataset.action).toBe("gallery");
      card.remove();
    });

    it("replay button is visible by default", () => {
      const card = createAndMount();
      expect(card.shadowRoot.querySelector('button[data-action="replay"]')).not.toBeNull();
      card.remove();
    });

    it("nav has minimal margin-top (2px or less)", () => {
      const card = createAndMount();
      const styleEl = card.shadowRoot.querySelector("style");
      const match = styleEl.textContent.match(/\.nav\s*\{[^}]*margin-top:\s*(\d+)px/);
      expect(match).not.toBeNull();
      expect(Number(match[1])).toBeLessThanOrEqual(2);
      card.remove();
    });

    it("overflow wrapper exists and style declares overflow hidden", () => {
      const card = createAndMount();
      const wrapper = card.shadowRoot.querySelector(".solar-view-wrapper");
      expect(wrapper).toBeTruthy();
      const styleEl = card.shadowRoot.querySelector("style");
      expect(styleEl.textContent).toContain(".solar-view-wrapper");
      expect(styleEl.textContent).toContain("overflow: hidden");
      card.remove();
    });
  });

  describe("version display", () => {
    it("hides version by default", () => {
      const card = createAndMount();
      expect(card.shadowRoot.querySelector(".card-version")).toBeNull();
      card.remove();
    });

    it("shows version when show_version is true", () => {
      const card = createAndMount();
      card.hass = { config: { latitude: 51.5, longitude: -0.1 } };
      card.setConfig({ show_version: true });
      card._render();
      const el = card.shadowRoot.querySelector(".card-version");
      expect(el).toBeTruthy();
      expect(el.textContent).toMatch(/^v/);
      card.remove();
    });

    it("hides version when show_version is false", () => {
      const card = createAndMount();
      card.setConfig({ show_version: false });
      card._render();
      expect(card.shadowRoot.querySelector(".card-version")).toBeNull();
      card.remove();
    });
  });

  describe("day navigation", () => {
    it("day-back rewinds by 1 day", () => {
      const card = createAndMount();
      card._currentDate = new Date("2026-03-15T12:00:00");
      card._render();
      clickButton(card, "day-back");
      expect(card._currentDate.getDate()).toBe(14);
      card.remove();
    });
  });

  describe("hour navigation", () => {
    it("hour-forward advances by 1 hour", () => {
      const card = createAndMount();
      card._currentDate = new Date("2026-03-15T14:00:00");
      card._render();
      clickButton(card, "hour-forward");
      expect(card._currentDate.getHours()).toBe(15);
      expect(card._currentDate.getDate()).toBe(15);
      card.remove();
    });

    it("hour-back rewinds by 1 hour", () => {
      const card = createAndMount();
      card._currentDate = new Date("2026-03-15T14:00:00");
      card._render();
      clickButton(card, "hour-back");
      expect(card._currentDate.getHours()).toBe(13);
      expect(card._currentDate.getDate()).toBe(15);
      card.remove();
    });

    it("hour-forward crosses day boundary", () => {
      const card = createAndMount();
      card._currentDate = new Date("2026-03-15T23:00:00");
      card._render();
      clickButton(card, "hour-forward");
      expect(card._currentDate.getHours()).toBe(0);
      expect(card._currentDate.getDate()).toBe(16);
      card.remove();
    });

    it("hour-back crosses day boundary backward", () => {
      const card = createAndMount();
      card._currentDate = new Date("2026-03-15T00:00:00");
      card._render();
      clickButton(card, "hour-back");
      expect(card._currentDate.getHours()).toBe(23);
      expect(card._currentDate.getDate()).toBe(14);
      card.remove();
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
      expect(card._lat).toBe(51.5);
      expect(card._lon).toBe(-0.1);
      expect(card._timezone).toBe("Europe/London");
      expect(card._locationName).toBe("London");
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
      expect(card._lat).toBe(51.5);
      card.hass = { config: {} };
      expect(card._lat).toBeNull();
      expect(card._lon).toBeNull();
      expect(card._timezone).toBeNull();
      expect(card._locationName).toBeNull();
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
      expect(card._effectiveLat).toBe(-34.9);
      expect(card._effectiveLon).toBe(-56.2);
      expect(card._hemisphere).toBe("south");
      expect(card._effectiveLocationName).toBe("Montevideo");
      card.remove();
    });

    it("config.location with only latitude set is ignored, falls back to HA", () => {
      const card = createAndMount();
      card.hass = { config: { latitude: 51.5, longitude: -0.1 } };
      card.setConfig({ location: { latitude: -34.9 } });
      card._render();
      expect(card._effectiveLat).toBe(51.5);
      expect(card._effectiveLon).toBe(-0.1);
      expect(card._hemisphere).toBe("north");
      card.remove();
    });

    it("config.location with out-of-range latitude is ignored, falls back to HA", () => {
      const card = createAndMount();
      card.hass = { config: { latitude: 51.5, longitude: -0.1 } };
      card.setConfig({ location: { latitude: 200, longitude: -56.2 } });
      card._render();
      expect(card._effectiveLat).toBe(51.5);
      expect(card._effectiveLon).toBe(-0.1);
      card.remove();
    });

    it("config.location with out-of-range longitude is ignored, falls back to HA", () => {
      const card = createAndMount();
      card.hass = { config: { latitude: 51.5, longitude: -0.1 } };
      card.setConfig({ location: { latitude: -34.9, longitude: -200 } });
      card._render();
      expect(card._effectiveLat).toBe(51.5);
      expect(card._effectiveLon).toBe(-0.1);
      card.remove();
    });

    it("no config.location falls back to HA lat/lon/name", () => {
      const card = createAndMount();
      card.hass = { config: { latitude: 51.5, longitude: -0.1, location_name: "London" } };
      card.setConfig({});
      expect(card._effectiveLat).toBe(51.5);
      expect(card._effectiveLon).toBe(-0.1);
      expect(card._effectiveLocationName).toBe("London");
      card.remove();
    });
  });

  describe("month-back navigation", () => {
    it("month-back rewinds by one month", () => {
      const card = createAndMount();
      card._currentDate = new Date("2026-03-15T12:00:00");
      card._render();
      clickButton(card, "month-back");
      expect(card._currentDate.getMonth()).toBe(1); // February (0-indexed)
      expect(card._currentDate.getFullYear()).toBe(2026);
      card.remove();
    });

    it("month-back crosses year boundary", () => {
      const card = createAndMount();
      card._currentDate = new Date("2026-01-15T12:00:00");
      card._render();
      clickButton(card, "month-back");
      expect(card._currentDate.getMonth()).toBe(11); // December
      expect(card._currentDate.getFullYear()).toBe(2025);
      card.remove();
    });
  });

  describe("button labels", () => {
    it("time navigation buttons use Unicode single-character symbols", () => {
      const card = createAndMount();
      const labels = {
        "month-back": "\u22D8",
        "day-back": "\u226A",
        "hour-back": "<",
        "hour-forward": ">",
        "day-forward": "\u226B",
        "month-forward": "\u22D9",
      };
      for (const [action, expected] of Object.entries(labels)) {
        const btn = card.shadowRoot.querySelector(`button[data-action="${action}"]`);
        expect(btn.textContent).toBe(expected);
      }
      card.remove();
    });
  });

  describe("replay 6h", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    const timeNavActions = [
      "month-back",
      "day-back",
      "hour-back",
      "today",
      "hour-forward",
      "day-forward",
      "month-forward",
    ];

    it("replay button uses a circular arrow glyph", () => {
      const card = createAndMount();
      const btn = card.shadowRoot.querySelector('button[data-action="replay"]');
      expect(btn.textContent).toBe("↺");
      card.remove();
    });

    it("clicking replay jumps to 6h before now and exits live mode", () => {
      vi.useFakeTimers({ now: new Date("2026-02-15T12:00:00Z") });
      const card = createAndMount();
      clickButton(card, "replay");
      expect(card._currentDate.toISOString()).toBe(new Date("2026-02-15T06:00:00Z").toISOString());
      expect(card._isLiveMode).toBe(false);
      card.remove();
    });

    it("steps forward in 10-minute increments", () => {
      vi.useFakeTimers({ now: new Date("2026-02-15T12:00:00Z") });
      const card = createAndMount();
      clickButton(card, "replay");
      vi.advanceTimersByTime(138); // one interval tick
      expect(card._currentDate.toISOString()).toBe(new Date("2026-02-15T06:10:00Z").toISOString());
      card.remove();
    });

    it("disables time-navigation buttons while replaying, re-enables when done", () => {
      vi.useFakeTimers({ now: new Date("2026-02-15T12:00:00Z") });
      const card = createAndMount();
      clickButton(card, "replay");
      for (const action of timeNavActions) {
        const btn = card.shadowRoot.querySelector(`button[data-action="${action}"]`);
        expect(btn.disabled).toBe(true);
      }
      expect(card.shadowRoot.querySelector('button[data-action="zoom-in"]').disabled).toBe(false);
      expect(card.shadowRoot.querySelector('button[data-action="replay"]').disabled).toBe(false);

      vi.advanceTimersByTime(138 * 36);
      for (const action of timeNavActions) {
        const btn = card.shadowRoot.querySelector(`button[data-action="${action}"]`);
        expect(btn.disabled).toBe(false);
      }
      card.remove();
    });

    it("completes within 15 seconds of wall-clock time, resumes live mode, and returns to the pre-replay date", () => {
      const now = new Date("2026-02-15T12:00:00Z");
      vi.useFakeTimers({ now });
      const card = createAndMount();
      clickButton(card, "replay");
      vi.advanceTimersByTime(15000); // upper bound on real time this may take
      expect(card._isReplaying).toBe(false);
      expect(card._isLiveMode).toBe(true);
      // Live mode resumes, but the displayed date lands back on where the user
      // was before replay started, not on real "now".
      expect(card._currentDate.toISOString()).toBe(now.toISOString());
      card.remove();
    });

    it("replays the 6h ending at the currently displayed date, not real now", () => {
      // Real "now" is Feb 15, but the user has navigated to a past date and paused there.
      vi.useFakeTimers({ now: new Date("2026-02-15T12:00:00Z") });
      const card = createAndMount();
      card._currentDate = new Date("2026-01-01T06:00:00Z");
      card._isLiveMode = false;
      card._render();

      clickButton(card, "replay");
      expect(card._currentDate.toISOString()).toBe(new Date("2026-01-01T00:00:00Z").toISOString());

      vi.advanceTimersByTime(138 * 36);
      // Lands back exactly on the pre-replay date, not real now, and stays paused.
      expect(card._currentDate.toISOString()).toBe(new Date("2026-01-01T06:00:00Z").toISOString());
      expect(card._isLiveMode).toBe(false);
      card.remove();
    });

    it("clicking replay again cancels it mid-flight", () => {
      vi.useFakeTimers({ now: new Date("2026-02-15T12:00:00Z") });
      const card = createAndMount();
      clickButton(card, "replay");
      vi.advanceTimersByTime(138 * 10);
      const midDate = card._currentDate.toISOString();
      clickButton(card, "replay"); // second click cancels
      expect(card._isReplaying).toBe(false);
      vi.advanceTimersByTime(138 * 26);
      expect(card._currentDate.toISOString()).toBe(midDate);
      card.remove();
    });

    it("cleans up the replay timer on disconnect", () => {
      vi.useFakeTimers({ now: new Date("2026-02-15T12:00:00Z") });
      const card = createAndMount();
      clickButton(card, "replay");
      expect(card._replayTimer).not.toBeNull();
      card.remove();
      expect(card._replayTimer).toBeNull();
    });
  });

  describe("view state persistence and reset", () => {
    it("zoom persists across day navigation", () => {
      const card = createAndMount();
      clickButton(card, "zoom-in");
      clickButton(card, "zoom-in");
      const zoomed = parseViewBox(card);
      clickButton(card, "day-forward");
      const after = parseViewBox(card);
      expect(after.width).toBe(zoomed.width);
      expect(after.height).toBe(zoomed.height);
      card.remove();
    });

    it("zoom persists across month navigation", () => {
      const card = createAndMount();
      clickButton(card, "zoom-in");
      const zoomed = parseViewBox(card);
      clickButton(card, "month-forward");
      const after = parseViewBox(card);
      expect(after.width).toBe(zoomed.width);
      card.remove();
    });

    it("Today button preserves zoom and view width", () => {
      const card = createAndMount();
      clickButton(card, "zoom-in");
      clickButton(card, "zoom-in");
      const zoomed = parseViewBox(card);
      clickButton(card, "today");
      const after = parseViewBox(card);
      expect(after.width).toBe(zoomed.width);
      expect(card._zoomLevel).toBe(3);
      card.remove();
    });

    it("Today button recenters the sun after panning", () => {
      const card = createAndMount();
      const centered = parseViewBox(card);
      card._viewState.centerX += 150;
      card._viewState.centerY -= 75;
      clickButton(card, "today");
      const after = parseViewBox(card);
      expect(after.minX).toBe(centered.minX);
      expect(after.minY).toBe(centered.minY);
      card.remove();
    });
  });

  describe("default_zoom configuration", () => {
    it("setConfig with default_zoom sets the default zoom level", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ default_zoom: 4 });
      document.body.appendChild(card);
      expect(card._zoomLevel).toBe(4);
      const { width } = parseViewBox(card);
      expect(width).toBe(320);
      card.remove();
    });

    it("setConfig without default_zoom defaults to level 1", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({});
      document.body.appendChild(card);
      expect(card._zoomLevel).toBe(1);
      const { width } = parseViewBox(card);
      expect(width).toBe(800);
      card.remove();
    });

    it("Today button preserves zoom level even with configured default", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ default_zoom: 2 });
      document.body.appendChild(card);
      clickButton(card, "zoom-in");
      clickButton(card, "zoom-in");
      expect(card._zoomLevel).toBe(4);
      clickButton(card, "today");
      expect(card._zoomLevel).toBe(4);
      const { width } = parseViewBox(card);
      expect(width).toBe(320);
      card.remove();
    });
  });

  describe("refresh_mins configuration", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("defaults to 60000ms when refresh_mins is not set", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({});
      expect(card._refreshMs).toBe(60000);
    });

    it("uses configured refresh_mins value", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ refresh_mins: 5 });
      expect(card._refreshMs).toBe(300000);
    });

    it("clamps refresh_mins below 0.1 to default", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ refresh_mins: 0.05 });
      expect(card._refreshMs).toBe(60000);
    });

    it("ignores non-numeric refresh_mins", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ refresh_mins: "abc" });
      expect(card._refreshMs).toBe(60000);
    });

    it("timer uses configured interval", () => {
      vi.useFakeTimers({ now: new Date("2026-02-15T10:00:00") });
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ refresh_mins: 2 });
      card._currentDate = new Date("2026-02-15T10:00:00");
      document.body.appendChild(card);
      const dateBefore = card._formatDate(card._currentDate);
      // At 60s nothing should have changed yet (interval is 120s)
      vi.advanceTimersByTime(60000);
      expect(card._formatDate(card._currentDate)).toBe(dateBefore);
      // At 120s the timer should fire
      vi.advanceTimersByTime(60000);
      expect(card._formatDate(card._currentDate)).toContain("26-02-15");
      card.remove();
    });

    it("recreates timer on setConfig when already connected", () => {
      vi.useFakeTimers();
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ refresh_mins: 1 });
      document.body.appendChild(card);
      const firstTimer = card._autoUpdateTimer;
      card.setConfig({ refresh_mins: 2 });
      expect(card._autoUpdateTimer).not.toBe(firstTimer);
      card.remove();
    });
  });

  describe("periodic_zoom_change configuration", () => {
    it("defaults to false when not set", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({});
      expect(card._periodicZoomChange).toBe(false);
    });

    it("is true when configured as true", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ periodic_zoom_change: true });
      expect(card._periodicZoomChange).toBe(true);
    });
  });

  describe("periodic zoom cycling", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("does not change zoom when periodic_zoom_change is false", () => {
      vi.useFakeTimers();
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ periodic_zoom_change: false });
      document.body.appendChild(card);
      expect(card._zoomLevel).toBe(1);
      vi.advanceTimersByTime(60000);
      expect(card._zoomLevel).toBe(1);
      card.remove();
    });

    it("advances zoom by one level per tick", () => {
      vi.useFakeTimers();
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ periodic_zoom_change: true });
      document.body.appendChild(card);
      expect(card._zoomLevel).toBe(1);
      vi.advanceTimersByTime(60000);
      expect(card._zoomLevel).toBe(2);
      vi.advanceTimersByTime(60000);
      expect(card._zoomLevel).toBe(3);
      card.remove();
    });

    it("wraps from MAX_ZOOM back to level 1", () => {
      vi.useFakeTimers();
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ periodic_zoom_change: true, default_zoom: 4 });
      document.body.appendChild(card);
      expect(card._zoomLevel).toBe(4);
      vi.advanceTimersByTime(60000);
      expect(card._zoomLevel).toBe(1);
      card.remove();
    });

    it("updates zoom level display on auto-cycle", () => {
      vi.useFakeTimers();
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ periodic_zoom_change: true });
      document.body.appendChild(card);
      expect(card.shadowRoot.querySelector(".zoom-level").textContent).toBe("1");
      vi.advanceTimersByTime(60000);
      // Re-query after timer fires because _render() may rebuild the DOM
      expect(card.shadowRoot.querySelector(".zoom-level").textContent).toBe("2");
      card.remove();
    });

    it("manual zoom-in continues cycle from user level", () => {
      vi.useFakeTimers();
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ periodic_zoom_change: true });
      document.body.appendChild(card);
      // Manually zoom in to level 2
      clickButton(card, "zoom-in");
      expect(card._zoomLevel).toBe(2);
      // Next tick should go to 3
      vi.advanceTimersByTime(60000);
      expect(card._zoomLevel).toBe(3);
      card.remove();
    });

    it("Now button does not interrupt auto-cycle", () => {
      vi.useFakeTimers();
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ periodic_zoom_change: true });
      document.body.appendChild(card);
      vi.advanceTimersByTime(60000);
      expect(card._zoomLevel).toBe(2);
      clickButton(card, "today");
      expect(card._zoomLevel).toBe(2);
      vi.advanceTimersByTime(60000);
      expect(card._zoomLevel).toBe(3);
      card.remove();
    });
  });

  describe("periodic_zoom_max configuration", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("wraps at configured max level instead of MAX_ZOOM", () => {
      vi.useFakeTimers();
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ periodic_zoom_change: true, periodic_zoom_max: 3 });
      document.body.appendChild(card);
      expect(card._zoomLevel).toBe(1);
      vi.advanceTimersByTime(60000);
      expect(card._zoomLevel).toBe(2);
      vi.advanceTimersByTime(60000);
      expect(card._zoomLevel).toBe(3);
      vi.advanceTimersByTime(60000);
      expect(card._zoomLevel).toBe(1);
      card.remove();
    });

    it("defaults to MAX_ZOOM (4) when periodic_zoom_max is not set", () => {
      vi.useFakeTimers();
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ periodic_zoom_change: true });
      document.body.appendChild(card);
      vi.advanceTimersByTime(60000);
      vi.advanceTimersByTime(60000);
      vi.advanceTimersByTime(60000);
      expect(card._zoomLevel).toBe(4);
      vi.advanceTimersByTime(60000);
      expect(card._zoomLevel).toBe(1);
      card.remove();
    });

    it("defaults to MAX_ZOOM for invalid periodic_zoom_max values", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ periodic_zoom_max: "abc" });
      expect(card._periodicZoomMax).toBe(4);
      card.setConfig({ periodic_zoom_max: 2.5 });
      expect(card._periodicZoomMax).toBe(4);
      card.setConfig({ periodic_zoom_max: 1 });
      expect(card._periodicZoomMax).toBe(4);
      card.setConfig({ periodic_zoom_max: 5 });
      expect(card._periodicZoomMax).toBe(4);
    });

    it("has no effect when periodic_zoom_change is false", () => {
      vi.useFakeTimers();
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ periodic_zoom_change: false, periodic_zoom_max: 3 });
      document.body.appendChild(card);
      expect(card._zoomLevel).toBe(1);
      vi.advanceTimersByTime(60000);
      expect(card._zoomLevel).toBe(1);
      card.remove();
    });
  });

  describe("date and time display", () => {
    it("displays date with time in HH:MM format", () => {
      const card = createAndMount();
      const dateSpan = card.shadowRoot.querySelector(".date");
      const text = dateSpan.textContent;
      // Should match YY-MM-DD HH:MM pattern
      expect(text).toMatch(/^\d{2}-\d{2}-\d{2} \d{2}:\d{2}$/);
      card.remove();
    });

    it("_formatDate includes hours and minutes", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      const date = new Date("2026-02-15T21:05:00");
      expect(card._formatDate(date)).toBe("26-02-15 21:05");
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
    it("_updateViewBox is a no-op when shadow DOM has no SVG", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      expect(() => card._updateViewBox()).not.toThrow();
    });

    it("_applyZoom is safe when shadow DOM has no .zoom-level element", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      expect(() => card._applyZoom(800, 800)).not.toThrow();
    });

    it("_updateOffscreenMarkers skips appending when _positions is null", () => {
      const card = createAndMount();
      card._positions = null;
      expect(() => card._updateOffscreenMarkers()).not.toThrow();
      card.remove();
    });

    it("_advanceZoom is a no-op when _viewState is null", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      expect(() => card._advanceZoom()).not.toThrow();
    });

    it("_zoomIn is a no-op when _viewState is null", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      expect(() => card._zoomIn()).not.toThrow();
    });

    it("_zoomOut is a no-op when _viewState is null", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      expect(() => card._zoomOut()).not.toThrow();
    });

    it("disconnectedCallback is safe before connectedCallback", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      expect(() => card.disconnectedCallback()).not.toThrow();
    });

    it("_updateViewBox skips setAttribute when #solar-view has no SVG child", () => {
      const card = createAndMount();
      card.shadowRoot.querySelector("#solar-view").innerHTML = "";
      expect(() => card._updateViewBox()).not.toThrow();
      card.remove();
    });
  });

  describe("southern hemisphere", () => {
    it("sets hemisphere to south when lat is negative", () => {
      const card = createAndMount();
      card._lat = -33.9; // Sydney
      card._lon = 151.2;
      card._render();
      expect(card._hemisphere).toBe("south");
      card.remove();
    });
  });

  describe("pointer events when not dragging", () => {
    it("pointermove before pointerdown is a no-op", () => {
      const card = createAndMount();
      const svg = card.shadowRoot.querySelector("#solar-view svg");
      const centerBefore = card._viewState.centerX;
      svg.dispatchEvent(new PointerEvent("pointermove", { clientX: 300, clientY: 300 }));
      expect(card._viewState.centerX).toBe(centerBefore);
      card.remove();
    });

    it("pointerup before pointerdown is a no-op", () => {
      const card = createAndMount();
      const svg = card.shadowRoot.querySelector("#solar-view svg");
      svg.releasePointerCapture = () => {};
      // Should not throw and dragging flag stays false
      svg.dispatchEvent(new PointerEvent("pointerup", { clientX: 300, clientY: 300 }));
      expect(card._viewState.isDragging).toBe(false);
      card.remove();
    });
  });

  describe("drag-to-pan", () => {
    it("SVG has grab cursor style", () => {
      const card = createAndMount();
      const styleEl = card.shadowRoot.querySelector("style");
      expect(styleEl.textContent).toContain("cursor: grab");
      card.remove();
    });

    it("SVG has user-select none and touch-action none", () => {
      const card = createAndMount();
      const styleEl = card.shadowRoot.querySelector("style");
      expect(styleEl.textContent).toContain("user-select: none");
      expect(styleEl.textContent).toContain("touch-action: none");
      card.remove();
    });

    it("pointer events are wired up on the SVG", () => {
      const card = createAndMount();
      const svg = card.shadowRoot.querySelector("#solar-view svg");
      // Simulate pointerdown — should start drag
      const downEvent = new PointerEvent("pointerdown", {
        clientX: 100,
        clientY: 100,
        pointerId: 1,
      });
      svg.setPointerCapture = () => {};
      svg.releasePointerCapture = () => {};
      svg.dispatchEvent(downEvent);
      expect(card._viewState.isDragging).toBe(true);

      // Simulate pointerup — should end drag
      const upEvent = new PointerEvent("pointerup", {
        clientX: 150,
        clientY: 150,
        pointerId: 1,
      });
      svg.dispatchEvent(upEvent);
      expect(card._viewState.isDragging).toBe(false);
      card.remove();
    });

    it("dragging updates viewBox center position", () => {
      const card = createAndMount();
      const svg = card.shadowRoot.querySelector("#solar-view svg");
      svg.setPointerCapture = () => {};
      svg.releasePointerCapture = () => {};
      // Mock getBoundingClientRect
      svg.getBoundingClientRect = () => ({ width: 400, height: 400, x: 0, y: 0, top: 0, left: 0 });

      const centerBefore = { x: card._viewState.centerX, y: card._viewState.centerY };

      svg.dispatchEvent(
        new PointerEvent("pointerdown", { clientX: 200, clientY: 200, pointerId: 1 })
      );
      svg.dispatchEvent(
        new PointerEvent("pointermove", { clientX: 250, clientY: 200, pointerId: 1 })
      );

      // Dragging right should decrease centerX (content moves right)
      expect(card._viewState.centerX).toBeLessThan(centerBefore.x);

      svg.dispatchEvent(
        new PointerEvent("pointerup", { clientX: 250, clientY: 200, pointerId: 1 })
      );
      card.remove();
    });
  });

  describe("auto-update timer", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("starts a timer on connectedCallback", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      expect(card._autoUpdateTimer).toBeNull();
      document.body.appendChild(card);
      expect(card._autoUpdateTimer).not.toBeNull();
      card.remove();
    });

    it("clears timer on disconnectedCallback", () => {
      const card = createAndMount();
      expect(card._autoUpdateTimer).not.toBeNull();
      card.remove();
      expect(card._autoUpdateTimer).toBeNull();
    });

    it("clears existing timer before creating new one on reconnect", () => {
      vi.useFakeTimers();
      const card = document.createElement("ha-planetary-solar-system-card-test");
      document.body.appendChild(card);
      const firstTimer = card._autoUpdateTimer;
      card.remove();
      document.body.appendChild(card);
      const secondTimer = card._autoUpdateTimer;
      expect(secondTimer).not.toBeNull();
      expect(secondTimer).not.toBe(firstTimer);
      card.remove();
    });

    it("re-renders after 60s when showing today", () => {
      vi.useFakeTimers({ now: new Date("2026-02-15T10:00:00") });
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card._currentDate = new Date("2026-02-15T10:00:00");
      document.body.appendChild(card);
      vi.advanceTimersByTime(60000);
      // Date should have been updated to "now" (still Feb 15)
      expect(card._formatDate(card._currentDate)).toContain("26-02-15");
      card.remove();
    });

    it("syncs to current time on visibilitychange when in live mode", () => {
      vi.useFakeTimers({ now: new Date("2026-02-15T10:00:00") });
      const card = document.createElement("ha-planetary-solar-system-card-test");
      document.body.appendChild(card);
      // Simulate time passing while tab was hidden (timer throttled)
      vi.setSystemTime(new Date("2026-02-15T10:45:00"));
      // Card still shows stale time — timer never fired
      expect(card._formatDate(card._currentDate)).toContain("10:00");
      // Tab becomes visible
      Object.defineProperty(document, "hidden", { value: false, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
      // Card should now show current time
      expect(card._formatDate(card._currentDate)).toContain("10:45");
      card.remove();
    });

    it("does not sync on visibilitychange when user has navigated away", () => {
      vi.useFakeTimers({ now: new Date("2026-02-15T10:00:00") });
      const card = document.createElement("ha-planetary-solar-system-card-test");
      document.body.appendChild(card);
      card._navigate(-45 * 86400000); // user went to a past date
      vi.setSystemTime(new Date("2026-02-15T10:45:00"));
      Object.defineProperty(document, "hidden", { value: false, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
      // Should still show the navigated-to date
      expect(card._formatDate(card._currentDate)).not.toContain("26-02-15");
      card.remove();
    });

    it("removes visibilitychange listener on disconnectedCallback", () => {
      const card = createAndMount();
      expect(card._onVisibilityChange).not.toBeNull();
      card.remove();
      expect(card._onVisibilityChange).toBeNull();
    });

    it("does not re-render when user has navigated to a different date", () => {
      vi.useFakeTimers({ now: new Date("2026-02-15T10:00:00") });
      const card = document.createElement("ha-planetary-solar-system-card-test");
      document.body.appendChild(card);
      // Navigate backwards 45 days via the proper navigation path, which sets _isLiveMode=false
      card._navigate(-45 * 86400000);
      vi.advanceTimersByTime(60000);
      // Should still show the navigated-to date, not auto-advance to today
      expect(card._formatDate(card._currentDate)).not.toContain("26-02-15");
      card.remove();
    });
  });

  describe("status bar layout", () => {
    // London at midday: sun is up, next transition (sunset) exists within 24h
    function createCardWithLocation(
      lat = 51.5,
      lon = -0.1,
      date = new Date("2026-03-05T12:00:00Z")
    ) {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card._lat = lat;
      card._lon = lon;
      card._timezone = "Europe/London";
      card._locationName = "London";
      card._currentDate = date;
      document.body.appendChild(card);
      return card;
    }

    it("renders two child spans when location and next transition are available", () => {
      const card = createCardWithLocation();
      const bar = card.shadowRoot.querySelector(".status-bar");
      const spans = bar.querySelectorAll("span");
      expect(spans).toHaveLength(2);
      card.remove();
    });

    it("left span contains location name, mode, and elevation", () => {
      const card = createCardWithLocation();
      const bar = card.shadowRoot.querySelector(".status-bar");
      const leftSpan = bar.querySelector("span:first-child");
      expect(leftSpan.textContent).toMatch(/London \| .+ \(-?\d+°\)/);
      card.remove();
    });

    it("right span contains Next: <mode-name> (<HH:MM>)", () => {
      const card = createCardWithLocation();
      const bar = card.shadowRoot.querySelector(".status-bar");
      const spans = bar.querySelectorAll("span");
      expect(spans[1].textContent).toMatch(/^Next: .+ \(\d{2}:\d{2}\)$/);
      card.remove();
    });

    it("only one span rendered when no transition found within 24h (polar night)", () => {
      // 89°N in deep winter: sun stays at ~-22° all day, no threshold crossing
      const card = createCardWithLocation(89, 0, new Date("2026-12-21T12:00:00Z"));
      const bar = card.shadowRoot.querySelector(".status-bar");
      const spans = bar.querySelectorAll("span");
      expect(spans).toHaveLength(1);
      card.remove();
    });
  });

  describe("zoom_animate configuration", () => {
    it("defaults to true when not set", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({});
      expect(card._zoomAnimate).toBe(true);
    });

    it("is false when configured as false", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ zoom_animate: false });
      expect(card._zoomAnimate).toBe(false);
    });

    it("zoom is instant when zoom_animate is false", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ zoom_animate: false });
      document.body.appendChild(card);
      clickButton(card, "zoom-in");
      const { width } = parseViewBox(card);
      expect(width).toBe(640);
      card.remove();
    });

    it("zoom level display updates immediately even with animation enabled", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ zoom_animate: true });
      document.body.appendChild(card);
      clickButton(card, "zoom-in");
      expect(card.shadowRoot.querySelector(".zoom-level").textContent).toBe("2");
      card.remove();
    });

    it("initial render does not animate even when zoom_animate is true", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ zoom_animate: true, default_zoom: 3 });
      document.body.appendChild(card);
      const { width } = parseViewBox(card);
      expect(width).toBe(480);
      card.remove();
    });

    it("setConfig re-render applies zoom instantly without animation", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ zoom_animate: true, default_zoom: 1 });
      document.body.appendChild(card);
      expect(parseViewBox(card).width).toBe(800);
      // Reconfigure with new default zoom — should re-render instantly
      card._viewState = null; // force fresh ViewState on next render
      card.setConfig({ zoom_animate: true, default_zoom: 3 });
      card._render();
      expect(parseViewBox(card).width).toBe(480);
      card.remove();
    });
  });

  describe("animated zoom with periodic auto-cycle", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("auto-cycle updates zoom level display with animation enabled", () => {
      vi.useFakeTimers();
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ periodic_zoom_change: true, zoom_animate: true });
      document.body.appendChild(card);
      expect(card.shadowRoot.querySelector(".zoom-level").textContent).toBe("1");
      vi.advanceTimersByTime(60000);
      // Zoom level display should update immediately to target
      expect(card.shadowRoot.querySelector(".zoom-level").textContent).toBe("2");
      card.remove();
    });
  });

  describe("gallery", () => {
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

    // gallery.mode: "both" by default in this suite — mode-specific behavior is covered
    // separately below, everything else here tests the gallery feature itself. Any mode
    // other than "none" auto-opens the strip on connect, so most tests here don't need to
    // click the gallery button to open it — only to close/reopen it.
    function createAndMount(config) {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ gallery: { mode: "both" }, ...config });
      document.body.appendChild(card);
      return card;
    }

    function stubEarthFetch(identifier = "20260810234950") {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ identifier }]),
      });
      vi.stubGlobal("fetch", fetchMock);
      return fetchMock;
    }

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    });

    it("gallery button is hidden by default (no config)", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      document.body.appendChild(card);
      expect(card.shadowRoot.querySelector('button[data-action="gallery"]')).toBeNull();
      card.remove();
    });

    it("gallery button is hidden when gallery.mode: none", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ gallery: { mode: "none" } });
      document.body.appendChild(card);
      expect(card.shadowRoot.querySelector('button[data-action="gallery"]')).toBeNull();
      card.remove();
    });

    it("gallery button shows and strip is open by default when gallery.mode: both", () => {
      const card = createAndMount();
      expect(card.shadowRoot.querySelector('button[data-action="gallery"]')).toBeTruthy();
      expect(
        card.shadowRoot.querySelector('button[data-action="gallery"]').classList.contains("active")
      ).toBe(true);
      expect(card.shadowRoot.querySelector(".gallery")).toBeTruthy();
      card.remove();
    });

    it("shows 2 thumbnails (EARTH, SUN) as soon as the card connects", async () => {
      stubEarthFetch();
      const card = createAndMount();
      await flush();
      const thumbs = card.shadowRoot.querySelectorAll(".gallery-thumb");
      expect(thumbs.length).toBe(2);
      expect(Array.from(thumbs).map((t) => t.dataset.source)).toEqual(["earth", "sun"]);
      const labels = Array.from(thumbs).map((t) => t.querySelector(".gallery-label").textContent);
      expect(labels).toEqual(["DSCOVR/E", "SDO/S"]);

      // Each candidate is preloaded off-DOM before it's ever assigned to the thumbnail, so
      // by the time the fetch/preload chain settles the age is already known — no separate
      // on-<img> "load" event needed.
      const ages = Array.from(thumbs).map((t) => t.querySelector(".gallery-age").textContent);
      for (const age of ages) {
        expect(age).toMatch(/^(\d+[mh] ago|just now)$/);
      }
      card.remove();
    });

    it("a sun thumbnail preload failure retries the previous 15-min slot once", async () => {
      stubImagePreload(false, true);
      const card = createAndMount();
      await flush();

      // Retried once, on an earlier slot — thumbnail shows the fallback.
      const sunImg = card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"] img');
      expect(sunImg.getAttribute("src")).not.toBe("");
      // Retried slot is one 15-min step earlier than a fresh (un-retried) lookup would give
      // — clear the cache first so this recomputes the primary slot instead of reading back
      // the retried one the card just cached.
      clearImageCache();
      const primarySlot = getSunImageUrl().date.getTime();
      expect(card._galleryImages.sun.date.getTime()).toBe(primarySlot - 15 * 60000);
      card.remove();
    });

    it("drops the sun thumbnail if both the candidate and its retry fail to preload", async () => {
      stubImagePreload(false, false);
      const card = createAndMount();
      await flush();

      const sunImg = card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"] img');
      expect(sunImg.getAttribute("src")).toBeNull();
      expect(
        card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"] .gallery-age').textContent
      ).toBe("loading…");
      card.remove();
    });

    it("fetches all thumbnails as soon as the card connects", async () => {
      const fetchMock = stubEarthFetch();
      const card = createAndMount();
      await flush();
      expect(fetchMock).toHaveBeenCalled();
      const thumbs = card.shadowRoot.querySelectorAll(".gallery-thumb img");
      for (const img of thumbs) {
        expect(img.src).not.toBe("");
      }
      card.remove();
    });

    it("clicking the gallery button closes the strip; clicking again reopens it", async () => {
      const card = createAndMount();
      await flush();
      expect(card.shadowRoot.querySelector(".gallery")).toBeTruthy();
      clickButton(card, "gallery");
      await flush();
      expect(card.shadowRoot.querySelector(".gallery")).toBeNull();
      expect(
        card.shadowRoot.querySelector('button[data-action="gallery"]').classList.contains("active")
      ).toBe(false);
      clickButton(card, "gallery");
      await flush();
      expect(card.shadowRoot.querySelector(".gallery")).toBeTruthy();
      expect(
        card.shadowRoot.querySelector('button[data-action="gallery"]').classList.contains("active")
      ).toBe(true);
      card.remove();
    });

    it("clicking a thumbnail shows the full image and hides the strip and solar view", async () => {
      const card = createAndMount();
      await flush();
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
      await flush();
      expect(card._imagePanelMode).toBe("sun");
      expect(card.shadowRoot.querySelector(".status-bar").textContent).toContain("SUN · SDO HMI");
      const img = card.shadowRoot.querySelector("#image-view");
      expect(img.classList.contains("visible")).toBe(true);
      expect(card.shadowRoot.querySelector(".gallery")).toBeNull();
      expect(card.shadowRoot.querySelector("#solar-view").classList.contains("hidden")).toBe(true);
      card.remove();
    });

    it("full-screen status bar shows the already-loaded image instantly — no fetch, no loading step", async () => {
      const card = createAndMount();
      await flush(); // background fetch already resolved and cached the sun thumbnail
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
      // Pure view switch, synchronous — no async gap at all.
      expect(card.shadowRoot.querySelector(".status-bar").textContent).toContain("captured");
      expect(card.shadowRoot.querySelector(".status-bar").textContent).not.toContain("loading…");
      card.remove();
    });

    it("full-screen status bar shows 'loading…' if opened before the background fetch has landed", () => {
      const card = createAndMount();
      // Click immediately — the mount's own background fetch is still in flight.
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
      expect(card.shadowRoot.querySelector(".status-bar").textContent).toContain("loading…");
      card.remove();
    });

    it("opens on the retried slot when the primary sun candidate fails to preload", async () => {
      stubImagePreload(false, true);
      const card = createAndMount();
      // The background fetch retries once and lands before the click — clicking then just
      // displays what it already resolved.
      await flush();
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();

      expect(card._imagePanelMode).toBe("sun");
      clearImageCache();
      const primarySlot = getSunImageUrl().date.getTime();
      expect(card._imageDate.getTime()).toBe(primarySlot - 15 * 60000);
      card.remove();
    });

    it("falls back to the unavailable banner when both the sun candidate and its retry fail to preload", async () => {
      stubImagePreload(false, false);
      const card = createAndMount();
      // The background fetch fails outright, so the sun thumbnail never populates —
      // clicking it falls into the "not known yet" path, which retries and fails again.
      await flush();
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
      await flush();

      expect(card._imagePanelMode).toBe("none");
      expect(card.shadowRoot.querySelector(".status-bar").textContent).toContain(
        "SDO HMI Continuum image unavailable"
      );
      card.remove();
    });

    it("a background refresh does not replace the shown image if the new candidate fails to preload", async () => {
      stubImagePreload(true);
      vi.useFakeTimers();
      const card = createAndMount({ refresh_mins: 1 });
      await vi.advanceTimersByTimeAsync(0);
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
      await vi.advanceTimersByTimeAsync(0);
      const firstSrc = card.shadowRoot.querySelector("#image-view").src;

      // Cross the 15-min slot boundary so the next refresh computes a genuinely different
      // candidate URL, then make the preload probe fail for it.
      stubImagePreload(false);
      await vi.advanceTimersByTimeAsync(16 * 60000);

      expect(card.shadowRoot.querySelector("#image-view").src).toBe(firstSrc);
      expect(card._imagePanelMode).toBe("sun");
      expect(card._imageError).toBeNull();
      card.remove();
      vi.useRealTimers();
    });

    it("a background refresh replaces the shown image once the new candidate is confirmed to preload", async () => {
      stubImagePreload(true);
      vi.useFakeTimers();
      const card = createAndMount({ refresh_mins: 1 });
      await vi.advanceTimersByTimeAsync(0);
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
      await vi.advanceTimersByTimeAsync(0);
      const firstSrc = card.shadowRoot.querySelector("#image-view").src;

      await vi.advanceTimersByTimeAsync(16 * 60000);

      expect(card.shadowRoot.querySelector("#image-view").src).not.toBe(firstSrc);
      expect(card._imagePanelMode).toBe("sun");
      card.remove();
      vi.useRealTimers();
    });

    it("an image load error while no panel is open is a no-op", async () => {
      const card = createAndMount();
      await flush();
      card.shadowRoot.querySelector("#image-view").dispatchEvent(new Event("error"));
      await flush();
      expect(card._imagePanelMode).toBe("none");
      expect(card._imageError).toBeNull();
      card.remove();
    });

    // resolveDisplayImage already confirmed this exact URL loads once, but the real <img>
    // still fires its own load/error events once mounted in the DOM — an unrelated later
    // failure (e.g. the browser's cache evicting the entry) has no retry left to fall back
    // on, unlike the preload-time retry covered elsewhere.
    it("an unexpected error on the already-resolved full image shows the unavailable banner", async () => {
      const card = createAndMount();
      await flush();
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
      await flush();
      expect(card._imagePanelMode).toBe("sun");

      card.shadowRoot.querySelector("#image-view").dispatchEvent(new Event("error"));
      await flush();
      expect(card._imagePanelMode).toBe("none");
      expect(card.shadowRoot.querySelector(".status-bar").textContent).toContain(
        "SDO HMI Continuum image unavailable"
      );
      card.remove();
    });

    it("the full image's own load event is harmless once already preloaded", async () => {
      const card = createAndMount();
      await flush();
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
      await flush();

      card.shadowRoot.querySelector("#image-view").dispatchEvent(new Event("load"));
      await flush();
      expect(card.shadowRoot.querySelector(".status-bar").textContent).toContain("captured");
      card.remove();
    });

    it("an unexpected error on an already-resolved sun thumbnail drops it", async () => {
      const card = createAndMount();
      await flush();

      const sunImg = card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"] img');
      sunImg.dispatchEvent(new Event("error"));
      await flush();
      expect(
        card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"] img').getAttribute("src")
      ).toBeNull();
      card.remove();
    });

    it("switching to earth while the sun preload is still resolving discards the stale sun result", async () => {
      const card = createAndMount();
      await flush();
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
      // Don't await — switch away before the sun candidate's preload settles.
      card.shadowRoot.querySelector("#image-view").click(); // back to gallery ("none")
      await flush();

      expect(card._imagePanelMode).toBe("none");
      card.remove();
    });

    it("an earth candidate that fails to preload shows the unavailable banner with no retry", async () => {
      stubEarthFetch();
      stubImagePreload(false);
      const card = createAndMount();
      await flush();
      card.shadowRoot.querySelector('.gallery-thumb[data-source="earth"]').click();
      await flush();

      expect(card._imagePanelMode).toBe("none");
      expect(card.shadowRoot.querySelector(".status-bar").textContent).toContain(
        "DSCOVR Earth image unavailable"
      );
      card.remove();
    });

    it("clicking the full image restores the solar view and the strip reappears", async () => {
      const card = createAndMount();
      await flush();
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
      await flush();
      card.shadowRoot.querySelector("#image-view").click();
      await flush();
      expect(card._imagePanelMode).toBe("none");
      expect(card.shadowRoot.querySelector(".gallery")).toBeTruthy();
      card.remove();
    });

    it("clicking the gallery button while a full image is shown closes both", async () => {
      const card = createAndMount();
      await flush();
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
      await flush();
      clickButton(card, "gallery");
      await flush();
      expect(card._imagePanelMode).toBe("none");
      expect(card.shadowRoot.querySelector(".gallery")).toBeNull();
      card.remove();
    });

    it("clicking a sun thumbnail again reuses the already-loaded image within the 15-min cache", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-12T12:00:00Z"));
      const card = createAndMount();
      await vi.advanceTimersByTimeAsync(0);

      const clickSun = () =>
        card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();

      clickSun();
      await vi.advanceTimersByTimeAsync(0);
      const firstSrc = card.shadowRoot.querySelector("#image-view").src;

      card.shadowRoot.querySelector("#image-view").click(); // back to gallery
      await vi.advanceTimersByTimeAsync(0);
      vi.setSystemTime(new Date("2026-08-12T12:00:30Z")); // 30s later, well within the 15-min cache
      clickSun();
      await vi.advanceTimersByTimeAsync(0);
      const secondSrc = card.shadowRoot.querySelector("#image-view").src;

      // A click is a pure view switch — it never fetches on its own, just shows whatever
      // the background timer already resolved, so re-opening shows the same image.
      expect(secondSrc).toBe(firstSrc);
      card.remove();
    });

    it("auto-update ticks refresh the open full image every 15 minutes while it stays open", async () => {
      stubImagePreload(true);
      vi.useFakeTimers();
      const card = createAndMount({ refresh_mins: 16 });
      await vi.advanceTimersByTimeAsync(0);
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
      await vi.advanceTimersByTimeAsync(0);
      const firstSrc = card.shadowRoot.querySelector("#image-view").src;

      // A single tick timed just past the 15-min TTL.
      await vi.advanceTimersByTimeAsync(16 * 60000);
      const secondSrc = card.shadowRoot.querySelector("#image-view").src;

      expect(secondSrc).not.toBe(firstSrc);
      card.remove();
      vi.useRealTimers();
    });

    it("auto-update ticks also refresh the open earth full image hourly", async () => {
      vi.useFakeTimers();
      const fetchMock = stubEarthFetch();
      const card = createAndMount({ refresh_mins: 61 });
      await vi.advanceTimersByTimeAsync(0);
      card.shadowRoot.querySelector('.gallery-thumb[data-source="earth"]').click();
      await vi.advanceTimersByTimeAsync(0);
      const callsAfterOpen = fetchMock.mock.calls.length;

      await vi.advanceTimersByTimeAsync(61 * 60000);
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterOpen);

      card.remove();
      vi.useRealTimers();
    });

    it("does not refresh the open full image before the 15-minute TTL elapses", async () => {
      vi.useFakeTimers();
      const card = createAndMount({ refresh_mins: 10 });
      await vi.advanceTimersByTimeAsync(0);
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
      await vi.advanceTimersByTimeAsync(0);
      const firstSrc = card.shadowRoot.querySelector("#image-view").src;

      await vi.advanceTimersByTimeAsync(10 * 60000); // one tick, still within the 15-min TTL
      const secondSrc = card.shadowRoot.querySelector("#image-view").src;

      expect(secondSrc).toBe(firstSrc);
      card.remove();
      vi.useRealTimers();
    });

    it("clicking the earth thumbnail fetches the latest EPIC image and shows it", async () => {
      stubEarthFetch();
      const card = createAndMount();
      await flush();
      card.shadowRoot.querySelector('.gallery-thumb[data-source="earth"]').click();
      await flush();
      const img = card.shadowRoot.querySelector("#image-view");
      expect(img.classList.contains("visible")).toBe(true);
      expect(img.src).toBe(
        `${EPIC_BASE_URL}/archive/natural/2026/08/10/jpg/epic_1b_20260810234950.jpg`
      );
      expect(card.shadowRoot.querySelector(".status-bar").textContent).toContain("EARTH · DSCOVR");
      card.remove();
    });

    it("falls back to the solar view with a visible error when the earth image fetch fails", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
      const card = createAndMount();
      await flush();
      card.shadowRoot.querySelector('.gallery-thumb[data-source="earth"]').click();
      await flush();
      const img = card.shadowRoot.querySelector("#image-view");
      expect(img.classList.contains("visible")).toBe(false);
      expect(card._imagePanelMode).toBe("none");
      expect(card.shadowRoot.querySelector(".status-bar").textContent).toContain(
        "DSCOVR Earth image unavailable"
      );
      card.remove();
    });

    it("clears the error banner when the gallery is reopened", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
      const card = createAndMount();
      card.hass = { config: { latitude: 41.8781, longitude: -87.6298 } };
      await flush();
      card.shadowRoot.querySelector('.gallery-thumb[data-source="earth"]').click();
      await flush();
      expect(card.shadowRoot.querySelector(".status-bar").textContent).toContain("unavailable");
      clickButton(card, "gallery"); // close
      clickButton(card, "gallery"); // reopen
      expect(card.shadowRoot.querySelector(".status-bar").textContent).not.toContain("unavailable");
      card.remove();
    });

    it("falls back to the solar view with a visible error when the earth image response is empty", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })
      );
      const card = createAndMount();
      await flush();
      card.shadowRoot.querySelector('.gallery-thumb[data-source="earth"]').click();
      await flush();
      const img = card.shadowRoot.querySelector("#image-view");
      expect(img.classList.contains("visible")).toBe(false);
      expect(card._imagePanelMode).toBe("none");
      expect(card.shadowRoot.querySelector(".status-bar").textContent).toContain(
        "DSCOVR Earth image unavailable"
      );
      card.remove();
    });

    it("falls back to the solar view with a visible error when the earth image load hangs past the timeout", async () => {
      vi.useFakeTimers();
      stubEarthFetch();
      vi.stubGlobal(
        "Image",
        class {
          src = "";
          decode() {
            return new Promise(() => {}); // never settles — simulates a hung image load
          }
        }
      );
      // gallery.mode: "earth" keeps this isolated to earth's own timeout — "both" would
      // also hang sun's preload (same stubbed Image), which retries once and so needs a
      // second 15s wait before the shared Promise.allSettled in _refreshImageSources
      // settles, unrelated to what this test is checking.
      const card = createAndMount({ gallery: { mode: "earth" } });
      await vi.advanceTimersByTimeAsync(0);
      card.shadowRoot.querySelector('.gallery-thumb[data-source="earth"]').click();
      await vi.advanceTimersByTimeAsync(15000); // FETCH_TIMEOUT_MS in image-sources.ts
      const img = card.shadowRoot.querySelector("#image-view");
      expect(img.classList.contains("visible")).toBe(false);
      expect(card._imagePanelMode).toBe("none");
      expect(card.shadowRoot.querySelector(".status-bar").textContent).toContain(
        "DSCOVR Earth image unavailable"
      );
      card.remove();
      vi.useRealTimers();
    });

    it("falls back to the unavailable banner when the sun image load hangs on both the primary and retry attempts", async () => {
      vi.useFakeTimers();
      vi.stubGlobal(
        "Image",
        class {
          src = "";
          decode() {
            return new Promise(() => {}); // never settles on either attempt
          }
        }
      );
      const card = createAndMount({ gallery: { mode: "sun" } });
      await vi.advanceTimersByTimeAsync(0);
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
      // Primary attempt times out, then the one retry (getPreviousSunSlot) also hangs and
      // times out — two sequential 15s bounds before the banner surfaces.
      await vi.advanceTimersByTimeAsync(30000);
      const img = card.shadowRoot.querySelector("#image-view");
      expect(img.classList.contains("visible")).toBe(false);
      expect(card._imagePanelMode).toBe("none");
      expect(card.shadowRoot.querySelector(".status-bar").textContent).toContain(
        "SDO HMI Continuum image unavailable"
      );
      card.remove();
      vi.useRealTimers();
    });

    it("auto-update ticks refresh gallery thumbnails while the gallery stays open", async () => {
      vi.useFakeTimers();
      const fetchMock = stubEarthFetch();
      // A single tick timed just past the 1-hour cache TTL, rather than 1-min ticks
      // advanced 61x over — many overlapping fetch/render cycles under fake timers
      // leave dangling promises that can resolve after the test tears down.
      const card = createAndMount({ refresh_mins: 61 });
      await vi.advanceTimersByTimeAsync(0);
      const callsAfterOpen = fetchMock.mock.calls.length;

      await vi.advanceTimersByTimeAsync(61 * 60000);
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterOpen);

      card.remove();
      vi.useRealTimers();
    });

    it("auto-update ticks do not fetch gallery thumbnails once the gallery is manually closed", async () => {
      vi.useFakeTimers();
      const fetchMock = stubEarthFetch();
      const card = createAndMount({ refresh_mins: 1 });
      await vi.advanceTimersByTimeAsync(0);
      fetchMock.mockClear();
      clickButton(card, "gallery"); // close
      await vi.advanceTimersByTimeAsync(6 * 60000);
      expect(fetchMock).not.toHaveBeenCalled();

      card.remove();
      vi.useRealTimers();
    });

    it("skips a failed source's thumbnail but still populates the others", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
      const card = createAndMount();
      await flush();
      const sunThumb = card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"] img');
      const earthThumb = card.shadowRoot.querySelector('.gallery-thumb[data-source="earth"] img');
      expect(sunThumb.getAttribute("src")).not.toBe("");
      expect(earthThumb.getAttribute("src")).toBeNull(); // earth fetch failed, thumbnail stays empty
      card.remove();
    });

    it("gallery.mode: earth shows only the earth thumbnail and fetches only earth", async () => {
      const fetchMock = stubEarthFetch();
      const card = createAndMount({ gallery: { mode: "earth" } });
      await flush();
      const thumbs = card.shadowRoot.querySelectorAll(".gallery-thumb");
      expect(Array.from(thumbs).map((t) => t.dataset.source)).toEqual(["earth"]);
      expect(fetchMock).toHaveBeenCalled();
      card.remove();
    });

    it("gallery.mode: sun shows only the sun thumbnail and never calls fetch", async () => {
      const fetchMock = stubEarthFetch();
      const card = createAndMount({ gallery: { mode: "sun" } });
      await flush();
      const thumbs = card.shadowRoot.querySelectorAll(".gallery-thumb");
      expect(Array.from(thumbs).map((t) => t.dataset.source)).toEqual(["sun"]);
      expect(fetchMock).not.toHaveBeenCalled();
      card.remove();
    });

    it("gallery strip refreshes the sun thumbnail every 15 minutes, not 1 hour", async () => {
      vi.useFakeTimers();
      const card = createAndMount({ gallery: { mode: "sun" }, refresh_mins: 16 });
      await vi.advanceTimersByTimeAsync(0);
      const firstSrc = card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"] img').src;

      await vi.advanceTimersByTimeAsync(16 * 60000);
      const secondSrc = card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"] img').src;

      expect(secondSrc).not.toBe(firstSrc);
      card.remove();
      vi.useRealTimers();
    });

    it("gallery.mode: slide shows one thumbnail, fetches both sources, and flips on its own interval", async () => {
      vi.useFakeTimers();
      const fetchMock = stubEarthFetch();
      const card = createAndMount({ gallery: { mode: "slide", slide_interval_secs: 120 } });
      await vi.advanceTimersByTimeAsync(0);

      expect(fetchMock).toHaveBeenCalled(); // both sources fetched in the background
      let thumbs = card.shadowRoot.querySelectorAll(".gallery-thumb");
      expect(thumbs.length).toBe(1);
      expect(thumbs[0].dataset.source).toBe("earth");

      await vi.advanceTimersByTimeAsync(120 * 1000);
      thumbs = card.shadowRoot.querySelectorAll(".gallery-thumb");
      expect(thumbs.length).toBe(1);
      expect(thumbs[0].dataset.source).toBe("sun");

      card.remove();
      vi.useRealTimers();
    });

    it("gallery.mode: slide keeps showing the previous source until the next image finishes decoding", async () => {
      vi.useFakeTimers();
      stubEarthFetch();
      let holding = false;
      let resolveDecode: () => void;
      vi.stubGlobal(
        "Image",
        class {
          src = "";
          decode() {
            if (holding) {
              return new Promise((resolve) => {
                resolveDecode = resolve;
              });
            }
            return Promise.resolve();
          }
        }
      );

      const card = createAndMount({ gallery: { mode: "slide", slide_interval_secs: 30 } });
      await vi.advanceTimersByTimeAsync(0);
      expect(card.shadowRoot.querySelector(".gallery-thumb").dataset.source).toBe("earth");

      holding = true;
      await vi.advanceTimersByTimeAsync(30 * 1000);
      // Next image's decode() is still pending — label and thumbnail stay on the old source.
      expect(card.shadowRoot.querySelector(".gallery-thumb").dataset.source).toBe("earth");
      expect(card.shadowRoot.querySelector(".gallery-label").textContent).toBe("DSCOVR/E");

      resolveDecode();
      await vi.advanceTimersByTimeAsync(0);
      expect(card.shadowRoot.querySelector(".gallery-thumb").dataset.source).toBe("sun");
      expect(card.shadowRoot.querySelector(".gallery-label").textContent).toBe("SDO/S");

      card.remove();
      vi.useRealTimers();
    });

    it("reconfiguring the slide interval while slide mode stays active restarts the timer", async () => {
      vi.useFakeTimers();
      const card = createAndMount({ gallery: { mode: "slide", slide_interval_secs: 120 } });
      await vi.advanceTimersByTimeAsync(0);

      card.setConfig({ gallery: { mode: "slide", slide_interval_secs: 180 } });
      await vi.advanceTimersByTimeAsync(120 * 1000); // past the old interval, before the new one
      expect(card.shadowRoot.querySelector(".gallery-thumb").dataset.source).toBe("earth");

      await vi.advanceTimersByTimeAsync(60000); // now past the new 3-min interval
      expect(card.shadowRoot.querySelector(".gallery-thumb").dataset.source).toBe("sun");

      await vi.advanceTimersByTimeAsync(180 * 1000); // flips back
      expect(card.shadowRoot.querySelector(".gallery-thumb").dataset.source).toBe("earth");

      card.remove();
      vi.useRealTimers();
    });

    it("gallery.mode: none never shows the gallery button and never fetches", async () => {
      vi.useFakeTimers();
      const fetchMock = stubEarthFetch();
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ gallery: { mode: "none" }, refresh_mins: 1 });
      document.body.appendChild(card);
      await vi.advanceTimersByTimeAsync(6 * 60000);
      expect(card.shadowRoot.querySelector('button[data-action="gallery"]')).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
      card.remove();
      vi.useRealTimers();
    });
  });
});
