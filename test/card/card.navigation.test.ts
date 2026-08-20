import { afterEach, describe, expect, it, vi } from "vitest";
import { clickButton, createAndMount, setupCardTest } from "./helpers.js";

setupCardTest();

// Moving the displayed date by hand: hour/day/month steps, the 6h replay, button labels, and
// the rendered date readout. The date following now on its own lives in card.auto-cycle.test.ts.
describe("SolarViewCard date navigation", () => {
  describe("day navigation", () => {
    it("day-back rewinds by 1 day", () => {
      const card = createAndMount();
      card._dateNav.currentDate = new Date("2026-03-15T12:00:00");
      card._render();
      clickButton(card, "day-back");
      expect(card._dateNav.currentDate.getDate()).toBe(14);
      card.remove();
    });
  });

  describe("hour navigation", () => {
    it("hour-forward advances by 1 hour", () => {
      const card = createAndMount();
      card._dateNav.currentDate = new Date("2026-03-15T14:00:00");
      card._render();
      clickButton(card, "hour-forward");
      expect(card._dateNav.currentDate.getHours()).toBe(15);
      expect(card._dateNav.currentDate.getDate()).toBe(15);
      card.remove();
    });

    it("hour-back rewinds by 1 hour", () => {
      const card = createAndMount();
      card._dateNav.currentDate = new Date("2026-03-15T14:00:00");
      card._render();
      clickButton(card, "hour-back");
      expect(card._dateNav.currentDate.getHours()).toBe(13);
      expect(card._dateNav.currentDate.getDate()).toBe(15);
      card.remove();
    });

    it("hour-forward crosses day boundary", () => {
      const card = createAndMount();
      card._dateNav.currentDate = new Date("2026-03-15T23:00:00");
      card._render();
      clickButton(card, "hour-forward");
      expect(card._dateNav.currentDate.getHours()).toBe(0);
      expect(card._dateNav.currentDate.getDate()).toBe(16);
      card.remove();
    });

    it("hour-back crosses day boundary backward", () => {
      const card = createAndMount();
      card._dateNav.currentDate = new Date("2026-03-15T00:00:00");
      card._render();
      clickButton(card, "hour-back");
      expect(card._dateNav.currentDate.getHours()).toBe(23);
      expect(card._dateNav.currentDate.getDate()).toBe(14);
      card.remove();
    });
  });

  describe("month-back navigation", () => {
    it("month-back rewinds by one month", () => {
      const card = createAndMount();
      card._dateNav.currentDate = new Date("2026-03-15T12:00:00");
      card._render();
      clickButton(card, "month-back");
      expect(card._dateNav.currentDate.getMonth()).toBe(1); // February (0-indexed)
      expect(card._dateNav.currentDate.getFullYear()).toBe(2026);
      card.remove();
    });

    it("month-back crosses year boundary", () => {
      const card = createAndMount();
      card._dateNav.currentDate = new Date("2026-01-15T12:00:00");
      card._render();
      clickButton(card, "month-back");
      expect(card._dateNav.currentDate.getMonth()).toBe(11); // December
      expect(card._dateNav.currentDate.getFullYear()).toBe(2025);
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
      expect(card._dateNav.currentDate.toISOString()).toBe(
        new Date("2026-02-15T06:00:00Z").toISOString()
      );
      expect(card._dateNav.isLiveMode).toBe(false);
      card.remove();
    });

    it("steps forward in 10-minute increments", () => {
      vi.useFakeTimers({ now: new Date("2026-02-15T12:00:00Z") });
      const card = createAndMount();
      clickButton(card, "replay");
      vi.advanceTimersByTime(138); // one interval tick
      expect(card._dateNav.currentDate.toISOString()).toBe(
        new Date("2026-02-15T06:10:00Z").toISOString()
      );
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
      expect(card._dateNav.isReplaying).toBe(false);
      expect(card._dateNav.isLiveMode).toBe(true);
      // Live mode resumes, but the displayed date lands back on where the user
      // was before replay started, not on real "now".
      expect(card._dateNav.currentDate.toISOString()).toBe(now.toISOString());
      card.remove();
    });

    it("replays the 6h ending at the currently displayed date, not real now", () => {
      // Real "now" is Feb 15, but the user has navigated to a past date and paused there.
      vi.useFakeTimers({ now: new Date("2026-02-15T12:00:00Z") });
      const card = createAndMount();
      card._dateNav.currentDate = new Date("2026-01-01T06:00:00Z");
      card._dateNav.isLiveMode = false;
      card._render();

      clickButton(card, "replay");
      expect(card._dateNav.currentDate.toISOString()).toBe(
        new Date("2026-01-01T00:00:00Z").toISOString()
      );

      vi.advanceTimersByTime(138 * 36);
      // Lands back exactly on the pre-replay date, not real now, and stays paused.
      expect(card._dateNav.currentDate.toISOString()).toBe(
        new Date("2026-01-01T06:00:00Z").toISOString()
      );
      expect(card._dateNav.isLiveMode).toBe(false);
      card.remove();
    });

    it("clicking replay again cancels it mid-flight", () => {
      vi.useFakeTimers({ now: new Date("2026-02-15T12:00:00Z") });
      const card = createAndMount();
      clickButton(card, "replay");
      vi.advanceTimersByTime(138 * 10);
      const midDate = card._dateNav.currentDate.toISOString();
      clickButton(card, "replay"); // second click cancels
      expect(card._dateNav.isReplaying).toBe(false);
      vi.advanceTimersByTime(138 * 26);
      expect(card._dateNav.currentDate.toISOString()).toBe(midDate);
      card.remove();
    });

    it("cleans up the replay timer on disconnect", () => {
      vi.useFakeTimers({ now: new Date("2026-02-15T12:00:00Z") });
      const card = createAndMount();
      const timersBeforeReplay = vi.getTimerCount();
      clickButton(card, "replay");
      expect(vi.getTimerCount()).toBe(timersBeforeReplay + 1);
      card.remove();
      expect(vi.getTimerCount()).toBe(0);
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
});
