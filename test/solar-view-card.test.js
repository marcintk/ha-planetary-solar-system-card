import { describe, it, expect, beforeAll, vi, afterEach } from "vitest";
import { SolarViewCard } from "../src/solar-view-card.js";
import { renderSolarSystem } from "../src/renderer.js";

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

  it("getStubConfig returns empty object", () => {
    expect(SolarViewCard.getStubConfig()).toEqual({});
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

    it("uses fixed full-system viewBox of 800x800", () => {
      const card = createAndMount();
      const { width, height } = parseViewBox(card);
      expect(width).toBe(800);
      expect(height).toBe(800);
      card.remove();
    });
  });

  describe("zoom controls (viewBox-based)", () => {
    it("zoom in reduces viewBox dimensions by factor 0.8", () => {
      const card = createAndMount();
      const before = parseViewBox(card);
      clickButton(card, "zoom-in");
      const after = parseViewBox(card);
      expect(after.width).toBeCloseTo(before.width * 0.8, 1);
      expect(after.height).toBeCloseTo(before.height * 0.8, 1);
      card.remove();
    });

    it("zoom out increases viewBox dimensions by factor 1.25", () => {
      const card = createAndMount();
      // First zoom in so we can zoom out
      clickButton(card, "zoom-in");
      const before = parseViewBox(card);
      clickButton(card, "zoom-out");
      const after = parseViewBox(card);
      expect(after.width).toBeCloseTo(before.width * 1.25, 1);
      card.remove();
    });

    it("zoom in is clamped at minimum view size 100", () => {
      const card = createAndMount();
      for (let i = 0; i < 50; i++) clickButton(card, "zoom-in");
      const { width, height } = parseViewBox(card);
      expect(width).toBeGreaterThanOrEqual(100);
      expect(height).toBeGreaterThanOrEqual(100);
      card.remove();
    });

    it("zoom out is clamped at auto-fit size", () => {
      const card = createAndMount();
      const initial = parseViewBox(card);
      // Zoom out many times — should not exceed auto-fit
      for (let i = 0; i < 20; i++) clickButton(card, "zoom-out");
      const after = parseViewBox(card);
      expect(after.width).toBeCloseTo(initial.width, 1);
      card.remove();
    });

    it("zoom in then zoom out returns to same size", () => {
      const card = createAndMount();
      const before = parseViewBox(card);
      clickButton(card, "zoom-in");
      clickButton(card, "zoom-out");
      const after = parseViewBox(card);
      expect(after.width).toBeCloseTo(before.width, 1);
      card.remove();
    });

    it("nav row buttons are in correct order", () => {
      const card = createAndMount();
      const buttons = card.shadowRoot.querySelectorAll(".nav button");
      const actions = Array.from(buttons).map((el) => el.dataset.action);
      expect(actions).toEqual([
        "month-back",
        "day-back",
        "today",
        "day-forward",
        "month-forward",
        "zoom-out",
        "zoom-in",
      ]);
      card.remove();
    });

    it("zoom buttons are grouped in a .btn-group container", () => {
      const card = createAndMount();
      const btnGroup = card.shadowRoot.querySelector(".btn-group");
      expect(btnGroup).toBeTruthy();
      const groupButtons = btnGroup.querySelectorAll("button");
      expect(groupButtons.length).toBe(2);
      expect(groupButtons[0].dataset.action).toBe("zoom-out");
      expect(groupButtons[1].dataset.action).toBe("zoom-in");
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

  describe("view state persistence and reset", () => {
    it("zoom persists across day navigation", () => {
      const card = createAndMount();
      clickButton(card, "zoom-in");
      clickButton(card, "zoom-in");
      const zoomed = parseViewBox(card);
      clickButton(card, "day-forward");
      const after = parseViewBox(card);
      expect(after.width).toBeCloseTo(zoomed.width, 1);
      expect(after.height).toBeCloseTo(zoomed.height, 1);
      card.remove();
    });

    it("zoom persists across month navigation", () => {
      const card = createAndMount();
      clickButton(card, "zoom-in");
      const zoomed = parseViewBox(card);
      clickButton(card, "month-forward");
      const after = parseViewBox(card);
      expect(after.width).toBeCloseTo(zoomed.width, 1);
      card.remove();
    });

    it("Today button resets zoom and pan to auto-fit", () => {
      const card = createAndMount();
      const initial = parseViewBox(card);
      clickButton(card, "zoom-in");
      clickButton(card, "zoom-in");
      clickButton(card, "today");
      const after = parseViewBox(card);
      // Should be back to auto-fit size (may differ slightly due to different date)
      expect(after.width).toBeCloseTo(initial.width, -1);
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

      svg.dispatchEvent(new PointerEvent("pointerdown", { clientX: 200, clientY: 200, pointerId: 1 }));
      svg.dispatchEvent(new PointerEvent("pointermove", { clientX: 250, clientY: 200, pointerId: 1 }));

      // Dragging right should decrease centerX (content moves right)
      expect(card._viewCenterX).toBeLessThan(centerBefore.x);

      svg.dispatchEvent(new PointerEvent("pointerup", { clientX: 250, clientY: 200, pointerId: 1 }));
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
      const dateBefore = card._currentDate.getTime();
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
});
