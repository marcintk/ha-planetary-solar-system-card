import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clickButton,
  createAndMount,
  dragView,
  getSvgViewBox,
  parseViewBox,
  setupCardTest,
} from "./helpers.js";

setupCardTest();

// Everything about where the camera points and how it gets there by hand: viewBox fitting,
// discrete zoom levels, drag-to-pan, and the Now button's off-default highlight. The automatic
// zoom cycle that shares this state lives in card.auto-zoom.test.ts.
describe("SolarViewCard view", () => {
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
      expect(card._zoom.zoomLevel).toBe(1);
      clickButton(card, "zoom-in");
      expect(card._zoom.zoomLevel).toBe(2);
      const { width } = parseViewBox(card);
      expect(width).toBe(640);
      card.remove();
    });

    it("zoom out steps to previous level", () => {
      const card = createAndMount();
      // Default is level 1, zoom in first then zoom out
      clickButton(card, "zoom-in");
      expect(card._zoom.zoomLevel).toBe(2);
      clickButton(card, "zoom-out");
      expect(card._zoom.zoomLevel).toBe(1);
      const { width } = parseViewBox(card);
      expect(width).toBe(800);
      card.remove();
    });

    it("zoom in is clamped at level 4 (viewBox 320)", () => {
      const card = createAndMount();
      for (let i = 0; i < 20; i++) clickButton(card, "zoom-in");
      expect(card._zoom.zoomLevel).toBe(4);
      const { width, height } = parseViewBox(card);
      expect(width).toBe(320);
      expect(height).toBe(320);
      card.remove();
    });

    it("zoom out is clamped at level 1 (viewBox 800)", () => {
      const card = createAndMount();
      for (let i = 0; i < 20; i++) clickButton(card, "zoom-out");
      expect(card._zoom.zoomLevel).toBe(1);
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

    it("Today button restores the default zoom and view width", () => {
      const card = createAndMount();
      clickButton(card, "zoom-in");
      clickButton(card, "zoom-in");
      expect(card._zoom.zoomLevel).toBe(3);
      clickButton(card, "today");
      const after = parseViewBox(card);
      expect(card._zoom.zoomLevel).toBe(1);
      expect(after.width).toBe(800);
      card.remove();
    });

    it("Today button recenters the sun after panning", () => {
      const card = createAndMount();
      const centered = parseViewBox(card);
      card._zoom.panZoomState.centerX += 150;
      card._zoom.panZoomState.centerY -= 75;
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
      expect(card._zoom.zoomLevel).toBe(4);
      const { width } = parseViewBox(card);
      expect(width).toBe(320);
      card.remove();
    });

    it("setConfig without default_zoom defaults to level 1", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({});
      document.body.appendChild(card);
      expect(card._zoom.zoomLevel).toBe(1);
      const { width } = parseViewBox(card);
      expect(width).toBe(800);
      card.remove();
    });

    it("Today button restores the configured default zoom", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ default_zoom: 2 });
      document.body.appendChild(card);
      clickButton(card, "zoom-in");
      clickButton(card, "zoom-in");
      expect(card._zoom.zoomLevel).toBe(4);
      clickButton(card, "today");
      expect(card._zoom.zoomLevel).toBe(2);
      const { width } = parseViewBox(card);
      expect(width).toBe(640);
      card.remove();
    });
  });

  describe("Now button highlights when the view is off-default", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    function nowBtn(card) {
      return card.shadowRoot.querySelector('button[data-action="today"]');
    }

    it("is not highlighted on a fresh, live, default view", () => {
      const card = createAndMount();
      expect(nowBtn(card).classList.contains("active")).toBe(false);
      card.remove();
    });

    it("highlights after a manual zoom, clears on Home", () => {
      const card = createAndMount();
      clickButton(card, "zoom-in");
      expect(nowBtn(card).classList.contains("active")).toBe(true);

      clickButton(card, "today");
      expect(nowBtn(card).classList.contains("active")).toBe(false);
      card.remove();
    });

    it("highlights after panning, clears on Home", () => {
      const card = createAndMount();
      dragView(card, 60, -30);
      expect(nowBtn(card).classList.contains("active")).toBe(true);

      clickButton(card, "today");
      expect(nowBtn(card).classList.contains("active")).toBe(false);
      card.remove();
    });

    it("highlights after stepping the date, clears on Home", () => {
      const card = createAndMount();
      clickButton(card, "day-forward");
      expect(nowBtn(card).classList.contains("active")).toBe(true);

      clickButton(card, "today");
      expect(nowBtn(card).classList.contains("active")).toBe(false);
      card.remove();
    });

    it("stays clear while the periodic auto-cycle moves the zoom off default", () => {
      vi.useFakeTimers();
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ periodic_zoom_change: true });
      document.body.appendChild(card);
      expect(nowBtn(card).classList.contains("active")).toBe(false);

      vi.advanceTimersByTime(60000);
      // The cycle drives the zoom itself — nothing for Home to undo, so no highlight.
      expect(nowBtn(card).classList.contains("active")).toBe(false);

      // A real gesture still lights it, cycle or no cycle.
      clickButton(card, "zoom-in");
      expect(nowBtn(card).classList.contains("active")).toBe(true);
      card.remove();
    });
  });

  describe("pointer events when not dragging", () => {
    it("pointermove before pointerdown is a no-op", () => {
      const card = createAndMount();
      const svg = card.shadowRoot.querySelector("#solar-view svg");
      const centerBefore = card._zoom.panZoomState.centerX;
      svg.dispatchEvent(new PointerEvent("pointermove", { clientX: 300, clientY: 300 }));
      expect(card._zoom.panZoomState.centerX).toBe(centerBefore);
      card.remove();
    });

    it("pointerup before pointerdown is a no-op", () => {
      const card = createAndMount();
      const svg = card.shadowRoot.querySelector("#solar-view svg");
      svg.releasePointerCapture = () => {};
      // Should not throw and dragging flag stays false
      svg.dispatchEvent(new PointerEvent("pointerup", { clientX: 300, clientY: 300 }));
      expect(card._zoom.isDragging).toBe(false);
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
      expect(card._zoom.isDragging).toBe(true);

      // Simulate pointerup — should end drag
      const upEvent = new PointerEvent("pointerup", {
        clientX: 150,
        clientY: 150,
        pointerId: 1,
      });
      svg.dispatchEvent(upEvent);
      expect(card._zoom.isDragging).toBe(false);
      card.remove();
    });

    it("dragging updates viewBox center position", () => {
      const card = createAndMount();
      const svg = card.shadowRoot.querySelector("#solar-view svg");
      svg.setPointerCapture = () => {};
      svg.releasePointerCapture = () => {};
      // Mock getBoundingClientRect
      svg.getBoundingClientRect = () => ({ width: 400, height: 400, x: 0, y: 0, top: 0, left: 0 });

      const centerBefore = {
        x: card._zoom.panZoomState.centerX,
        y: card._zoom.panZoomState.centerY,
      };

      svg.dispatchEvent(
        new PointerEvent("pointerdown", { clientX: 200, clientY: 200, pointerId: 1 })
      );
      svg.dispatchEvent(
        new PointerEvent("pointermove", { clientX: 250, clientY: 200, pointerId: 1 })
      );

      // Dragging right should decrease centerX (content moves right)
      expect(card._zoom.panZoomState.centerX).toBeLessThan(centerBefore.x);

      svg.dispatchEvent(
        new PointerEvent("pointerup", { clientX: 250, clientY: 200, pointerId: 1 })
      );
      card.remove();
    });
  });

  describe("zoom_animate configuration", () => {
    it("defaults to true when not set", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({});
      expect(card._zoom.animate).toBe(true);
    });

    it("is false when configured as false", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ zoom_animate: false });
      expect(card._zoom.animate).toBe(false);
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
      card.setConfig({ zoom_animate: true, default_zoom: 3 });
      expect(parseViewBox(card).width).toBe(480);
      card.remove();
    });

    it("setConfig after the card has rendered moves the live view (issue #125)", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      document.body.appendChild(card);
      expect(card._zoom.zoomLevel).toBe(1);
      card.setConfig({ default_zoom: 3 });
      expect(card._zoom.zoomLevel).toBe(3);
      expect(parseViewBox(card).width).toBe(480);
      card.remove();
    });
  });
});
