import { afterEach, describe, expect, it, vi } from "vitest";
import { DateNavigation } from "../../src/card/date-navigation.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("DateNavigation constructor", () => {
  it("defaults to now and live mode", () => {
    const nav = new DateNavigation(() => {});
    expect(nav.isLiveMode).toBe(true);
    expect(nav.isReplaying).toBe(false);
  });

  it("accepts an initial date", () => {
    const date = new Date("2026-03-15T12:00:00Z");
    const nav = new DateNavigation(() => {}, date);
    expect(nav.currentDate).toBe(date);
  });
});

describe("DateNavigation.tick", () => {
  it("advances to now and notifies while live", () => {
    vi.useFakeTimers({ now: new Date("2026-02-15T10:00:00Z") });
    const onChange = vi.fn();
    const nav = new DateNavigation(onChange);
    vi.setSystemTime(new Date("2026-02-15T10:45:00Z"));
    nav.tick();
    expect(nav.currentDate.toISOString()).toBe(new Date("2026-02-15T10:45:00Z").toISOString());
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("does nothing once paused", () => {
    const onChange = vi.fn();
    const nav = new DateNavigation(onChange, new Date("2026-01-01T00:00:00Z"));
    nav.navigate(-3600000);
    onChange.mockClear();
    nav.tick();
    expect(onChange).not.toHaveBeenCalled();
    expect(nav.currentDate.toISOString()).toBe(new Date("2025-12-31T23:00:00Z").toISOString());
  });
});

describe("DateNavigation.goLive", () => {
  it("resumes live mode at now and notifies", () => {
    vi.useFakeTimers({ now: new Date("2026-02-15T10:00:00Z") });
    const onChange = vi.fn();
    const nav = new DateNavigation(onChange, new Date("2020-01-01T00:00:00Z"));
    nav.goLive();
    expect(nav.isLiveMode).toBe(true);
    expect(nav.currentDate.toISOString()).toBe(new Date("2026-02-15T10:00:00Z").toISOString());
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("DateNavigation.navigate", () => {
  it("shifts the date by the given delta and pauses", () => {
    const onChange = vi.fn();
    const nav = new DateNavigation(onChange, new Date("2026-03-15T12:00:00Z"));
    nav.navigate(3600000);
    expect(nav.currentDate.toISOString()).toBe(new Date("2026-03-15T13:00:00Z").toISOString());
    expect(nav.isLiveMode).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("DateNavigation.navigateMonths", () => {
  it("shifts by whole months and pauses", () => {
    const nav = new DateNavigation(() => {}, new Date("2026-03-15T12:00:00Z"));
    nav.navigateMonths(-1);
    expect(nav.currentDate.getMonth()).toBe(1); // February
    expect(nav.isLiveMode).toBe(false);
  });
});

describe("DateNavigation replay", () => {
  it("jumps to 6h before the current date, steps forward, and resumes prior mode", () => {
    vi.useFakeTimers({ now: new Date("2026-02-15T12:00:00Z") });
    const onChange = vi.fn();
    const nav = new DateNavigation(onChange);
    nav.toggleReplay();
    expect(nav.isReplaying).toBe(true);
    expect(nav.currentDate.toISOString()).toBe(new Date("2026-02-15T06:00:00Z").toISOString());

    vi.advanceTimersByTime(138); // one step
    expect(nav.currentDate.toISOString()).toBe(new Date("2026-02-15T06:10:00Z").toISOString());

    vi.advanceTimersByTime(138 * 35); // remaining steps
    expect(nav.isReplaying).toBe(false);
    expect(nav.isLiveMode).toBe(true);
    expect(nav.currentDate.toISOString()).toBe(new Date("2026-02-15T12:00:00Z").toISOString());
  });

  it("resumes paused mode, not live, when replay was started from a paused date", () => {
    vi.useFakeTimers({ now: new Date("2026-02-15T12:00:00Z") });
    const nav = new DateNavigation(() => {});
    nav.navigate(0); // pauses without moving the date
    nav.toggleReplay();
    vi.advanceTimersByTime(138 * 36);
    expect(nav.isLiveMode).toBe(false);
    expect(nav.isReplaying).toBe(false);
  });

  it("toggling again mid-flight cancels and freezes the date", () => {
    vi.useFakeTimers({ now: new Date("2026-02-15T12:00:00Z") });
    const nav = new DateNavigation(() => {});
    nav.toggleReplay();
    vi.advanceTimersByTime(138 * 10);
    const midDate = nav.currentDate.toISOString();
    nav.toggleReplay(); // cancels
    expect(nav.isReplaying).toBe(false);
    vi.advanceTimersByTime(138 * 26);
    expect(nav.currentDate.toISOString()).toBe(midDate);
  });

  it("stop() clears the running interval without restoring the pre-replay date", () => {
    vi.useFakeTimers({ now: new Date("2026-02-15T12:00:00Z") });
    const nav = new DateNavigation(() => {});
    nav.toggleReplay();
    const timersBefore = vi.getTimerCount();
    expect(timersBefore).toBeGreaterThan(0);
    nav.stop();
    expect(vi.getTimerCount()).toBe(0);
    expect(nav.isReplaying).toBe(true); // stop() only clears the interval, not the flag
  });
});
