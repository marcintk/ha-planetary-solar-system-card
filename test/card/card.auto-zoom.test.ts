import { afterEach, describe, expect, it, vi } from "vitest";
import { clickButton, dragView, setupCardTest } from "./helpers.js";

setupCardTest();

// auto_zoom: the periodic zoom cycle driven by periodic_zoom_change, and everything that
// suspends it until Home. The timer that drives it lives in card.auto-cycle.test.ts, and the
// contract between the two in card.auto-behaviour.test.ts.
describe("SolarViewCard auto_zoom", () => {
  describe("periodic_zoom_change configuration", () => {
    it("defaults to false when not set", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({});
      expect(card._zoom.periodicZoomChange).toBe(false);
    });

    it("is true when configured as true", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ periodic_zoom_change: true });
      expect(card._zoom.periodicZoomChange).toBe(true);
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
      expect(card._zoom.zoomLevel).toBe(1);
      vi.advanceTimersByTime(60000);
      expect(card._zoom.zoomLevel).toBe(1);
      card.remove();
    });

    it("advances zoom by one level per tick", () => {
      vi.useFakeTimers();
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ periodic_zoom_change: true });
      document.body.appendChild(card);
      expect(card._zoom.zoomLevel).toBe(1);
      vi.advanceTimersByTime(60000);
      expect(card._zoom.zoomLevel).toBe(2);
      vi.advanceTimersByTime(60000);
      expect(card._zoom.zoomLevel).toBe(3);
      card.remove();
    });

    it("wraps from MAX_ZOOM back to level 1", () => {
      vi.useFakeTimers();
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ periodic_zoom_change: true, default_zoom: 4 });
      document.body.appendChild(card);
      expect(card._zoom.zoomLevel).toBe(4);
      vi.advanceTimersByTime(60000);
      expect(card._zoom.zoomLevel).toBe(1);
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

    it("a refresh tick leaves a hand-set zoom level alone", () => {
      vi.useFakeTimers();
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ periodic_zoom_change: true });
      document.body.appendChild(card);
      clickButton(card, "zoom-in");
      expect(card._zoom.zoomLevel).toBe(2);

      vi.advanceTimersByTime(60000);
      expect(card._zoom.zoomLevel).toBe(2);
      vi.advanceTimersByTime(60000);
      expect(card._zoom.zoomLevel).toBe(2);
      card.remove();
    });

    it("Now button resumes the auto-cycle from the default zoom", () => {
      vi.useFakeTimers();
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ periodic_zoom_change: true });
      document.body.appendChild(card);
      clickButton(card, "zoom-in");
      clickButton(card, "zoom-in");
      vi.advanceTimersByTime(60000);
      expect(card._zoom.zoomLevel).toBe(3); // suspended by the manual zooms

      clickButton(card, "today");
      expect(card._zoom.zoomLevel).toBe(1);
      vi.advanceTimersByTime(60000);
      expect(card._zoom.zoomLevel).toBe(2);
      card.remove();
    });
  });

  describe("manual interaction suspends the periodic zoom cycle", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    function mountCycling() {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ periodic_zoom_change: true });
      document.body.appendChild(card);
      return card;
    }

    for (const action of [
      "hour-back",
      "hour-forward",
      "day-back",
      "day-forward",
      "month-back",
      "month-forward",
    ]) {
      it(`${action} suspends the cycle until Home`, () => {
        vi.useFakeTimers();
        const card = mountCycling();
        clickButton(card, action);
        vi.advanceTimersByTime(60000);
        expect(card._zoom.zoomLevel).toBe(1);

        clickButton(card, "today");
        vi.advanceTimersByTime(60000);
        expect(card._zoom.zoomLevel).toBe(2);
        card.remove();
      });
    }

    it("dragging the view suspends the cycle", () => {
      vi.useFakeTimers();
      const card = mountCycling();
      dragView(card, 50, 0);

      vi.advanceTimersByTime(60000);
      expect(card._zoom.zoomLevel).toBe(1);
      card.remove();
    });

    it("replay does not suspend the cycle", () => {
      vi.useFakeTimers();
      const card = mountCycling();
      clickButton(card, "replay");
      vi.advanceTimersByTime(60000);
      expect(card._zoom.zoomLevel).toBe(2);
      card.remove();
    });

    it("opening the gallery does not suspend the cycle", () => {
      vi.useFakeTimers();
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ periodic_zoom_change: true, gallery: { mode: "both" } });
      document.body.appendChild(card);
      clickButton(card, "gallery");
      vi.advanceTimersByTime(60000);
      expect(card._zoom.zoomLevel).toBe(2);
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
      expect(card._zoom.zoomLevel).toBe(1);
      vi.advanceTimersByTime(60000);
      expect(card._zoom.zoomLevel).toBe(2);
      vi.advanceTimersByTime(60000);
      expect(card._zoom.zoomLevel).toBe(3);
      vi.advanceTimersByTime(60000);
      expect(card._zoom.zoomLevel).toBe(1);
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
      expect(card._zoom.zoomLevel).toBe(4);
      vi.advanceTimersByTime(60000);
      expect(card._zoom.zoomLevel).toBe(1);
      card.remove();
    });

    it("defaults to MAX_ZOOM for invalid periodic_zoom_max values", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ periodic_zoom_max: "abc" });
      expect(card._zoom.periodicZoomMax).toBe(4);
      card.setConfig({ periodic_zoom_max: 2.5 });
      expect(card._zoom.periodicZoomMax).toBe(4);
      card.setConfig({ periodic_zoom_max: 1 });
      expect(card._zoom.periodicZoomMax).toBe(4);
      card.setConfig({ periodic_zoom_max: 5 });
      expect(card._zoom.periodicZoomMax).toBe(4);
    });

    it("has no effect when periodic_zoom_change is false", () => {
      vi.useFakeTimers();
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ periodic_zoom_change: false, periodic_zoom_max: 3 });
      document.body.appendChild(card);
      expect(card._zoom.zoomLevel).toBe(1);
      vi.advanceTimersByTime(60000);
      expect(card._zoom.zoomLevel).toBe(1);
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
});
