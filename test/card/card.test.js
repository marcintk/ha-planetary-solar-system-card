import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { SolarViewCard } from "../../src/card/card.js";
import { renderSolarSystem } from "../../src/renderer/index.js";

beforeAll(() => {
  if (!customElements.get("ha-solar-view-card-test")) {
    customElements.define("ha-solar-view-card-test", SolarViewCard);
  }
});

describe("SolarViewCard", () => {
  it("should be a class", () => {
    expect(typeof SolarViewCard).toBe("function");
  });

  it("setConfig stores config", () => {
    const card = document.createElement("ha-solar-view-card-test");
    card.setConfig({ title: "test" });
    expect(card._config).toEqual({ title: "test" });
  });

  it("getCardSize returns 6", () => {
    const card = document.createElement("ha-solar-view-card-test");
    expect(card.getCardSize()).toBe(6);
  });

  it("getStubConfig returns default config with all options", () => {
    expect(SolarViewCard.getStubConfig()).toEqual({
      default_zoom: 2,
      periodic_zoom_change: false,
      periodic_zoom_max: 4,
      refresh_mins: 1,
      zoom_animate: true,
    });
  });

  function createAndMount() {
    const card = document.createElement("ha-solar-view-card-test");
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

  describe("renderSolarSystem returns { svg, bounds }", () => {
    it("returns an object with svg and bounds", () => {
      const result = renderSolarSystem(new Date(2025, 0, 1));
      expect(result).toHaveProperty("svg");
      expect(result).toHaveProperty("bounds");
      expect(result.svg.tagName).toBe("svg");
    });

    it("bounds has minX, minY, maxX, maxY as finite numbers", () => {
      const { bounds } = renderSolarSystem(new Date(2025, 0, 1));
      expect(bounds.minX).toBeLessThan(bounds.maxX);
      expect(bounds.minY).toBeLessThan(bounds.maxY);
      expect(Number.isFinite(bounds.minX)).toBe(true);
      expect(Number.isFinite(bounds.maxY)).toBe(true);
    });

    it("bounds encompasses Sun at center (400, 400)", () => {
      const { bounds } = renderSolarSystem(new Date(2025, 0, 1));
      expect(bounds.minX).toBeLessThan(400);
      expect(bounds.maxX).toBeGreaterThan(400);
      expect(bounds.minY).toBeLessThan(400);
      expect(bounds.maxY).toBeGreaterThan(400);
    });
  });

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
      const card = createAndMount();
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
        "zoom-out",
        "zoom-in",
      ]);
      card.remove();
    });

    it("nav buttons are grouped in a .btn-group container", () => {
      const card = createAndMount();
      const btnGroups = card.shadowRoot.querySelectorAll(".btn-group");
      expect(btnGroups.length).toBe(2);
      // First group: nav buttons
      const navGroup = btnGroups[0];
      const navButtons = navGroup.querySelectorAll("button");
      expect(navButtons.length).toBe(7);
      expect(navButtons[0].dataset.action).toBe("month-back");
      expect(navButtons[6].dataset.action).toBe("month-forward");
      // Second group: zoom buttons
      const zoomGroup = btnGroups[1];
      const zoomButtons = zoomGroup.querySelectorAll("button");
      expect(zoomButtons.length).toBe(2);
      expect(zoomButtons[0].dataset.action).toBe("zoom-out");
      expect(zoomButtons[1].dataset.action).toBe("zoom-in");
      const levelSpan = zoomGroup.querySelector(".zoom-level");
      expect(levelSpan).toBeTruthy();
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
        "day-back": "\u00AB",
        "hour-back": "\u2039",
        "hour-forward": "\u203A",
        "day-forward": "\u00BB",
        "month-forward": "\u22D9",
      };
      for (const [action, expected] of Object.entries(labels)) {
        const btn = card.shadowRoot.querySelector(`button[data-action="${action}"]`);
        expect(btn.textContent).toBe(expected);
      }
      card.remove();
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
  });

  describe("default_zoom configuration", () => {
    it("setConfig with default_zoom sets the default zoom level", () => {
      const card = document.createElement("ha-solar-view-card-test");
      card.setConfig({ default_zoom: 4 });
      document.body.appendChild(card);
      expect(card._zoomLevel).toBe(4);
      const { width } = parseViewBox(card);
      expect(width).toBe(320);
      card.remove();
    });

    it("setConfig without default_zoom defaults to level 1", () => {
      const card = document.createElement("ha-solar-view-card-test");
      card.setConfig({});
      document.body.appendChild(card);
      expect(card._zoomLevel).toBe(1);
      const { width } = parseViewBox(card);
      expect(width).toBe(800);
      card.remove();
    });

    it("Today button preserves zoom level even with configured default", () => {
      const card = document.createElement("ha-solar-view-card-test");
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
      const card = document.createElement("ha-solar-view-card-test");
      card.setConfig({});
      expect(card._refreshMs).toBe(60000);
    });

    it("uses configured refresh_mins value", () => {
      const card = document.createElement("ha-solar-view-card-test");
      card.setConfig({ refresh_mins: 5 });
      expect(card._refreshMs).toBe(300000);
    });

    it("clamps refresh_mins below 0.1 to default", () => {
      const card = document.createElement("ha-solar-view-card-test");
      card.setConfig({ refresh_mins: 0.05 });
      expect(card._refreshMs).toBe(60000);
    });

    it("ignores non-numeric refresh_mins", () => {
      const card = document.createElement("ha-solar-view-card-test");
      card.setConfig({ refresh_mins: "abc" });
      expect(card._refreshMs).toBe(60000);
    });

    it("timer uses configured interval", () => {
      vi.useFakeTimers({ now: new Date("2026-02-15T10:00:00") });
      const card = document.createElement("ha-solar-view-card-test");
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
      const card = document.createElement("ha-solar-view-card-test");
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
      const card = document.createElement("ha-solar-view-card-test");
      card.setConfig({});
      expect(card._periodicZoomChange).toBe(false);
    });

    it("is true when configured as true", () => {
      const card = document.createElement("ha-solar-view-card-test");
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
      const card = document.createElement("ha-solar-view-card-test");
      card.setConfig({ periodic_zoom_change: false });
      document.body.appendChild(card);
      expect(card._zoomLevel).toBe(1);
      vi.advanceTimersByTime(60000);
      expect(card._zoomLevel).toBe(1);
      card.remove();
    });

    it("advances zoom by one level per tick", () => {
      vi.useFakeTimers();
      const card = document.createElement("ha-solar-view-card-test");
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
      const card = document.createElement("ha-solar-view-card-test");
      card.setConfig({ periodic_zoom_change: true, default_zoom: 4 });
      document.body.appendChild(card);
      expect(card._zoomLevel).toBe(4);
      vi.advanceTimersByTime(60000);
      expect(card._zoomLevel).toBe(1);
      card.remove();
    });

    it("updates zoom level display on auto-cycle", () => {
      vi.useFakeTimers();
      const card = document.createElement("ha-solar-view-card-test");
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
      const card = document.createElement("ha-solar-view-card-test");
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
      const card = document.createElement("ha-solar-view-card-test");
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
      const card = document.createElement("ha-solar-view-card-test");
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
      const card = document.createElement("ha-solar-view-card-test");
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
      const card = document.createElement("ha-solar-view-card-test");
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
      const card = document.createElement("ha-solar-view-card-test");
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
      const card = document.createElement("ha-solar-view-card-test");
      const date = new Date("2026-02-15T21:05:00");
      expect(card._formatDate(date)).toBe("26-02-15 21:05");
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
      expect(card._isDragging).toBe(true);

      // Simulate pointerup — should end drag
      const upEvent = new PointerEvent("pointerup", {
        clientX: 150,
        clientY: 150,
        pointerId: 1,
      });
      svg.dispatchEvent(upEvent);
      expect(card._isDragging).toBe(false);
      card.remove();
    });

    it("dragging updates viewBox center position", () => {
      const card = createAndMount();
      const svg = card.shadowRoot.querySelector("#solar-view svg");
      svg.setPointerCapture = () => {};
      svg.releasePointerCapture = () => {};
      // Mock getBoundingClientRect
      svg.getBoundingClientRect = () => ({ width: 400, height: 400, x: 0, y: 0, top: 0, left: 0 });

      const centerBefore = { x: card._viewCenterX, y: card._viewCenterY };

      svg.dispatchEvent(
        new PointerEvent("pointerdown", { clientX: 200, clientY: 200, pointerId: 1 })
      );
      svg.dispatchEvent(
        new PointerEvent("pointermove", { clientX: 250, clientY: 200, pointerId: 1 })
      );

      // Dragging right should decrease centerX (content moves right)
      expect(card._viewCenterX).toBeLessThan(centerBefore.x);

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
      const card = document.createElement("ha-solar-view-card-test");
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
      const card = document.createElement("ha-solar-view-card-test");
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
      const card = document.createElement("ha-solar-view-card-test");
      card._currentDate = new Date("2026-02-15T10:00:00");
      document.body.appendChild(card);
      vi.advanceTimersByTime(60000);
      // Date should have been updated to "now" (still Feb 15)
      expect(card._formatDate(card._currentDate)).toContain("26-02-15");
      card.remove();
    });

    it("does not re-render when showing a different date", () => {
      vi.useFakeTimers({ now: new Date("2026-02-15T10:00:00") });
      const card = document.createElement("ha-solar-view-card-test");
      document.body.appendChild(card);
      // Navigate to a past date
      card._currentDate = new Date("2026-01-01T10:00:00");
      card._render();
      vi.advanceTimersByTime(60000);
      // Should still show the past date
      expect(card._formatDate(card._currentDate)).toContain("26-01-01");
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
      const card = document.createElement("ha-solar-view-card-test");
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
      const card = document.createElement("ha-solar-view-card-test");
      card.setConfig({});
      expect(card._zoomAnimate).toBe(true);
    });

    it("is false when configured as false", () => {
      const card = document.createElement("ha-solar-view-card-test");
      card.setConfig({ zoom_animate: false });
      expect(card._zoomAnimate).toBe(false);
    });

    it("zoom is instant when zoom_animate is false", () => {
      const card = document.createElement("ha-solar-view-card-test");
      card.setConfig({ zoom_animate: false });
      document.body.appendChild(card);
      clickButton(card, "zoom-in");
      const { width } = parseViewBox(card);
      expect(width).toBe(640);
      card.remove();
    });

    it("zoom level display updates immediately even with animation enabled", () => {
      const card = document.createElement("ha-solar-view-card-test");
      card.setConfig({ zoom_animate: true });
      document.body.appendChild(card);
      clickButton(card, "zoom-in");
      expect(card.shadowRoot.querySelector(".zoom-level").textContent).toBe("2");
      card.remove();
    });

    it("initial render does not animate even when zoom_animate is true", () => {
      const card = document.createElement("ha-solar-view-card-test");
      card.setConfig({ zoom_animate: true, default_zoom: 3 });
      document.body.appendChild(card);
      const { width } = parseViewBox(card);
      expect(width).toBe(480);
      card.remove();
    });

    it("setConfig re-render applies zoom instantly without animation", () => {
      const card = document.createElement("ha-solar-view-card-test");
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
      const card = document.createElement("ha-solar-view-card-test");
      card.setConfig({ periodic_zoom_change: true, zoom_animate: true });
      document.body.appendChild(card);
      expect(card.shadowRoot.querySelector(".zoom-level").textContent).toBe("1");
      vi.advanceTimersByTime(60000);
      // Zoom level display should update immediately to target
      expect(card.shadowRoot.querySelector(".zoom-level").textContent).toBe("2");
      card.remove();
    });
  });
});
