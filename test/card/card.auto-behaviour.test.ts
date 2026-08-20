import { afterEach, describe, expect, it, vi } from "vitest";
import { clickButton, dragView, setupCardTest } from "./helpers.js";

setupCardTest();

// The contract *between* the two automatic behaviours: which user action stops which. Each
// behaviour's own tests live in card.auto-cycle.test.ts and card.auto-zoom.test.ts; this file
// exists because every case here asserts both at once and splitting the table would hide half.
describe("SolarViewCard automatic behaviour", () => {
  // Locks in the full "which user action stops which automatic behaviour" contract:
  //   auto_cycle = the date following now on each refresh tick (DateNavigation._isLiveMode)
  //   auto_zoom  = the periodic zoom cycle on each refresh tick (periodic_zoom_change)
  // The gallery's refresh and slide timers are a separate concern and are covered elsewhere.
  describe("what each user action stops", () => {
    const START = new Date("2026-02-15T12:00:00Z");
    const TICK_MS = 60000;

    afterEach(() => {
      vi.useRealTimers();
    });

    function mountCycling() {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ periodic_zoom_change: true });
      document.body.appendChild(card);
      return card;
    }

    // Both behaviours are observed through what one refresh tick does, never through a flag:
    // auto_cycle is alive if the tick pulled the date to now, auto_zoom if it moved the level.
    function runOneTick(card) {
      const zoomBefore = card._zoomLevel;
      vi.advanceTimersByTime(TICK_MS);
      return {
        autoCycleAlive: card._dateNav.currentDate.getTime() === Date.now(),
        autoZoomAlive: card._zoomLevel !== zoomBefore,
      };
    }

    it("a fresh card has both running", () => {
      vi.useFakeTimers({ now: START });
      const card = mountCycling();
      expect(runOneTick(card)).toEqual({ autoCycleAlive: true, autoZoomAlive: true });
      card.remove();
    });

    // zoom-out at level 1 can't move the view, but it's still a deliberate press: intent
    // suspends the cycle, not movement.
    const MATRIX = [
      { action: "zoom-in", stopsAutoCycle: false, stopsAutoZoom: true },
      { action: "zoom-out", stopsAutoCycle: false, stopsAutoZoom: true },
      { action: "hour-back", stopsAutoCycle: true, stopsAutoZoom: true },
      { action: "hour-forward", stopsAutoCycle: true, stopsAutoZoom: true },
      { action: "day-back", stopsAutoCycle: true, stopsAutoZoom: true },
      { action: "day-forward", stopsAutoCycle: true, stopsAutoZoom: true },
      { action: "month-back", stopsAutoCycle: true, stopsAutoZoom: true },
      { action: "month-forward", stopsAutoCycle: true, stopsAutoZoom: true },
    ];

    for (const { action, stopsAutoCycle, stopsAutoZoom } of MATRIX) {
      it(`${action} stops auto_cycle: ${stopsAutoCycle}, auto_zoom: ${stopsAutoZoom}`, () => {
        vi.useFakeTimers({ now: START });
        const card = mountCycling();
        clickButton(card, action);
        expect(runOneTick(card)).toEqual({
          autoCycleAlive: !stopsAutoCycle,
          autoZoomAlive: !stopsAutoZoom,
        });
        card.remove();
      });
    }

    it("dragging the view stops auto_zoom only", () => {
      vi.useFakeTimers({ now: START });
      const card = mountCycling();
      dragView(card, 50, -20);

      expect(runOneTick(card)).toEqual({ autoCycleAlive: true, autoZoomAlive: false });
      card.remove();
    });

    it("a tap that never moves the view stops neither", () => {
      vi.useFakeTimers({ now: START });
      const card = mountCycling();
      dragView(card);

      expect(runOneTick(card)).toEqual({ autoCycleAlive: true, autoZoomAlive: true });
      card.remove();
    });

    it("Now restarts both after an action that stopped both", () => {
      vi.useFakeTimers({ now: START });
      const card = mountCycling();
      clickButton(card, "day-forward");
      expect(runOneTick(card)).toEqual({ autoCycleAlive: false, autoZoomAlive: false });

      clickButton(card, "today");
      expect(runOneTick(card)).toEqual({ autoCycleAlive: true, autoZoomAlive: true });
      card.remove();
    });

    describe("replay", () => {
      // Replay runs 36 steps inside 5s, so with the default 60s refresh a tick lands mid-replay
      // roughly 8% of the time. Start it 3s before the tick to hit that window deterministically.
      function startReplayJustBeforeATick(card) {
        vi.advanceTimersByTime(57000);
        clickButton(card, "replay");
        vi.advanceTimersByTime(3100);
      }

      it("a tick during a replay moves neither the date nor the zoom", () => {
        vi.useFakeTimers({ now: START });
        const card = mountCycling();
        startReplayJustBeforeATick(card);

        expect(card._dateNav.isReplaying).toBe(true);
        expect(card._zoomLevel).toBe(1); // the cycle must not zoom mid-animation
        // The date belongs to the replay while it runs, not to the refresh tick.
        expect(card._dateNav.currentDate.getTime()).toBeLessThan(START.getTime());
        card.remove();
      });

      it("both resume on the first tick after the replay finishes", () => {
        vi.useFakeTimers({ now: START });
        const card = mountCycling();
        startReplayJustBeforeATick(card);

        vi.advanceTimersByTime(59900); // lands exactly on the next tick, replay long finished
        expect(card._dateNav.isReplaying).toBe(false);
        expect(card._dateNav.currentDate.getTime()).toBe(Date.now());
        expect(card._zoomLevel).not.toBe(1);
        card.remove();
      });
    });
  });
});
