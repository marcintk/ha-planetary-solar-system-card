import { afterEach, describe, expect, it, vi } from "vitest";
import { calculatePlanetOrbit } from "../../src/astronomy/orbital-mechanics.js";
import { EARTH } from "../../src/astronomy/planet-data.js";
import { DateNavigation } from "../../src/card/date-navigation.js";
import { calculateObserverAngle } from "../../src/renderer/observer.js";

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
    nav.navigate(-3600000, "hour");
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
    nav.navigate(3600000, "hour");
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

describe("DateNavigation replay observer stability", () => {
  // The reason day/month replay steps whole units (#128). calculateObserverAngle adds
  // Earth's daily spin — a full turn per 24h — on top of the orbital angle, so any
  // sub-day step would swing the visibility cone and needle wildly between frames.
  // Sampling that spin term alone across a whole replay must show no movement at all.
  function spinSpreadDeg(unit: "day" | "month"): number {
    vi.useFakeTimers({ now: new Date("2026-02-15T09:30:00Z") });
    const nav = new DateNavigation(() => {}, new Date("2026-02-15T09:30:00Z"));
    if (unit === "month") nav.navigateMonths(-1);
    else nav.navigate(0, unit);
    nav.toggleReplay();
    const spins: number[] = [];
    for (let i = 0; i <= 36; i++) {
      const date = nav.currentDate;
      const orbital = calculatePlanetOrbit(EARTH, date).angle;
      // Denton, TX — the longitude (true solar time) path the card uses whenever HA has
      // a location configured, which is also the path sensitive to DST.
      const spin = calculateObserverAngle(orbital, date, undefined, -97.13) - orbital;
      spins.push(((((spin * 180) / Math.PI) % 360) + 360) % 360);
      vi.advanceTimersByTime(138);
    }
    return Math.max(...spins) - Math.min(...spins);
  }

  it("holds the observer cone still for the whole day replay", () => {
    expect(spinSpreadDeg("day")).toBe(0);
  });

  it("holds the observer cone still for the whole month replay, DST included", () => {
    // The 180-day span crosses a DST boundary; anything but whole-day steps in UTC would
    // show a 15° (one hour) flicker here.
    expect(spinSpreadDeg("month")).toBe(0);
  });
});

describe("DateNavigation.replayLabel", () => {
  it("names the window for each navigation unit", () => {
    const nav = new DateNavigation(() => {}, new Date("2026-03-15T12:00:00Z"));
    expect(nav.replayLabel).toBe("12h");
    nav.navigate(-86400000, "day");
    expect(nav.replayLabel).toBe("36d");
    nav.navigateMonths(-1);
    expect(nav.replayLabel).toBe("6mo");
    nav.navigate(-3600000, "hour");
    expect(nav.replayLabel).toBe("12h");
  });
});

describe("DateNavigation replay", () => {
  it("jumps to 12h before the current date, steps forward, and resumes prior mode", () => {
    vi.useFakeTimers({ now: new Date("2026-02-15T12:00:00Z") });
    const onChange = vi.fn();
    const nav = new DateNavigation(onChange);
    nav.toggleReplay();
    expect(nav.isReplaying).toBe(true);
    expect(nav.currentDate.toISOString()).toBe(new Date("2026-02-15T00:00:00Z").toISOString());

    vi.advanceTimersByTime(138); // one step
    expect(nav.currentDate.toISOString()).toBe(new Date("2026-02-15T00:20:00Z").toISOString());

    vi.advanceTimersByTime(138 * 35); // remaining steps
    expect(nav.isReplaying).toBe(false);
    expect(nav.isLiveMode).toBe(true);
    expect(nav.currentDate.toISOString()).toBe(new Date("2026-02-15T12:00:00Z").toISOString());
  });

  it("steps one whole day per frame after a day-unit navigation", () => {
    vi.useFakeTimers({ now: new Date("2026-02-15T12:00:00Z") });
    const nav = new DateNavigation(() => {}, new Date("2026-02-15T12:00:00Z"));
    nav.navigate(-86400000, "day");
    nav.toggleReplay();
    // 14 Feb minus 36 whole days
    expect(nav.currentDate.toISOString()).toBe(new Date("2026-01-09T12:00:00Z").toISOString());
    vi.advanceTimersByTime(138);
    expect(nav.currentDate.toISOString()).toBe(new Date("2026-01-10T12:00:00Z").toISOString());
    vi.advanceTimersByTime(138);
    expect(nav.currentDate.toISOString()).toBe(new Date("2026-01-11T12:00:00Z").toISOString());
  });

  it("holds the time of day fixed across every day-replay frame", () => {
    // The observer needle and visibility cone carry Earth's daily spin (observer.ts
    // calculateObserverAngle adds a full turn per 24h). Whole-day steps keep that term
    // constant so the cone stays put and only orbital motion shows (#128).
    vi.useFakeTimers({ now: new Date("2026-02-15T09:30:00Z") });
    const nav = new DateNavigation(() => {}, new Date("2026-02-15T09:30:00Z"));
    nav.navigate(0, "day");
    nav.toggleReplay();
    const seen = new Set([nav.currentDate.getTime() % 86400000]);
    for (let i = 0; i < 36; i++) {
      vi.advanceTimersByTime(138);
      seen.add(nav.currentDate.getTime() % 86400000);
    }
    expect([...seen]).toEqual([(9 * 60 + 30) * 60 * 1000]);
  });

  it("steps whole 5-day blocks across 180 days after a month-unit navigation", () => {
    vi.useFakeTimers({ now: new Date("2024-07-15T12:00:00Z") });
    const nav = new DateNavigation(() => {}, new Date("2024-07-15T12:00:00Z"));
    nav.navigateMonths(-1); // now viewing 15 Jun 2024
    nav.toggleReplay();
    // 180 days back — roughly six months — reached in 36 frames of 5 whole days each.
    // Whole days (not calendar months) are what hold the time of day fixed.
    expect(nav.currentDate.toISOString()).toBe(new Date("2023-12-18T12:00:00Z").toISOString());

    vi.advanceTimersByTime(138);
    expect(nav.currentDate.toISOString()).toBe(new Date("2023-12-23T12:00:00Z").toISOString());
  });

  it("goLive resets the window back to hours", () => {
    vi.useFakeTimers({ now: new Date("2026-02-15T12:00:00Z") });
    const nav = new DateNavigation(() => {}, new Date("2026-02-15T12:00:00Z"));
    nav.navigateMonths(-1);
    nav.goLive();
    nav.toggleReplay();
    expect(nav.currentDate.toISOString()).toBe(new Date("2026-02-15T00:00:00Z").toISOString());
  });

  it("resumes paused mode, not live, when replay was started from a paused date", () => {
    vi.useFakeTimers({ now: new Date("2026-02-15T12:00:00Z") });
    const nav = new DateNavigation(() => {});
    nav.navigate(0, "hour"); // pauses without moving the date
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
