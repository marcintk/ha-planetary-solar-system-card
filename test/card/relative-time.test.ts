import { describe, expect, it } from "vitest";
import { formatRelativeAge, formatRelativeWhen } from "../../src/card/relative-time.js";

describe("formatRelativeAge", () => {
  const now = new Date("2026-08-12T12:00:00Z");

  it("returns 'just now' for under a minute", () => {
    expect(formatRelativeAge(new Date("2026-08-12T11:59:30Z"), now)).toBe("just now");
  });

  it("formats minutes", () => {
    expect(formatRelativeAge(new Date("2026-08-12T11:55:00Z"), now)).toBe("5m ago");
  });

  it("formats hours", () => {
    expect(formatRelativeAge(new Date("2026-08-12T06:00:00Z"), now)).toBe("6h ago");
  });

  it("floors partial hours instead of rounding", () => {
    expect(formatRelativeAge(new Date("2026-08-12T06:30:00Z"), now)).toBe("5h ago");
  });

  it("keeps counting hours past a day rather than switching to days", () => {
    expect(formatRelativeAge(new Date("2026-08-11T06:00:00Z"), now)).toBe("30h ago");
  });

  it("treats a future date as 'just now'", () => {
    expect(formatRelativeAge(new Date("2026-08-12T12:05:00Z"), now)).toBe("just now");
  });
});

describe("formatRelativeWhen", () => {
  const NOW = new Date("2026-08-21T20:00:00Z");

  it("counts down to an instant still ahead", () => {
    expect(formatRelativeWhen(new Date("2026-08-21T22:00:00Z"), NOW)).toBe("in 2h");
  });

  it("counts down in minutes inside the last hour", () => {
    expect(formatRelativeWhen(new Date("2026-08-21T20:30:00Z"), NOW)).toBe("in 30m");
  });

  it("says just now within a minute either side", () => {
    expect(formatRelativeWhen(new Date("2026-08-21T20:00:30Z"), NOW)).toBe("just now");
    expect(formatRelativeWhen(new Date("2026-08-21T19:59:30Z"), NOW)).toBe("just now");
  });

  it("falls back to the past wording once the instant has gone by", () => {
    expect(formatRelativeWhen(new Date("2026-08-21T19:00:00Z"), NOW)).toBe("1h ago");
    expect(formatRelativeWhen(new Date("2026-08-21T19:30:00Z"), NOW)).toBe("30m ago");
  });

  it("agrees with formatRelativeAge for every past instant", () => {
    for (const minutes of [1, 5, 59, 60, 61, 300]) {
      const past = new Date(NOW.getTime() - minutes * 60000);
      expect(formatRelativeWhen(past, NOW)).toBe(formatRelativeAge(past, NOW));
    }
  });
});
