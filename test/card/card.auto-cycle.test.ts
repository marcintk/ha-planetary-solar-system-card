import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDate } from "../../src/card/card-template.js";
import { createAndMount, setupCardTest } from "./helpers.js";

setupCardTest();

// auto_cycle: the refresh timer itself, and the date following now on each tick while the card
// is in live mode. The zoom half of the same timer lives in card.auto-zoom.test.ts, and the
// contract between the two in card.auto-behaviour.test.ts.
describe("SolarViewCard auto_cycle", () => {
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
      card._dateNav.currentDate = new Date("2026-02-15T10:00:00");
      document.body.appendChild(card);
      const dateBefore = formatDate(card._dateNav.currentDate);
      // At 60s nothing should have changed yet (interval is 120s)
      vi.advanceTimersByTime(60000);
      expect(formatDate(card._dateNav.currentDate)).toBe(dateBefore);
      // At 120s the timer should fire
      vi.advanceTimersByTime(60000);
      expect(formatDate(card._dateNav.currentDate)).toContain("26-02-15");
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
      card._dateNav.currentDate = new Date("2026-02-15T10:00:00");
      document.body.appendChild(card);
      vi.advanceTimersByTime(60000);
      // Date should have been updated to "now" (still Feb 15)
      expect(formatDate(card._dateNav.currentDate)).toContain("26-02-15");
      card.remove();
    });

    it("syncs to current time on visibilitychange when in live mode", () => {
      vi.useFakeTimers({ now: new Date("2026-02-15T10:00:00") });
      const card = document.createElement("ha-planetary-solar-system-card-test");
      document.body.appendChild(card);
      // Simulate time passing while tab was hidden (timer throttled)
      vi.setSystemTime(new Date("2026-02-15T10:45:00"));
      // Card still shows stale time — timer never fired
      expect(formatDate(card._dateNav.currentDate)).toContain("10:00");
      // Tab becomes visible
      Object.defineProperty(document, "hidden", { value: false, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
      // Card should now show current time
      expect(formatDate(card._dateNav.currentDate)).toContain("10:45");
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
      expect(formatDate(card._dateNav.currentDate)).not.toContain("26-02-15");
      card.remove();
    });

    it("does not sync on visibilitychange while the tab is still hidden", () => {
      vi.useFakeTimers({ now: new Date("2026-02-15T10:00:00") });
      const card = document.createElement("ha-planetary-solar-system-card-test");
      document.body.appendChild(card);
      vi.setSystemTime(new Date("2026-02-15T10:45:00"));
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
      expect(formatDate(card._dateNav.currentDate)).toContain("10:00");
      Object.defineProperty(document, "hidden", { value: false, configurable: true });
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
      expect(formatDate(card._dateNav.currentDate)).not.toContain("26-02-15");
      card.remove();
    });
  });
});
