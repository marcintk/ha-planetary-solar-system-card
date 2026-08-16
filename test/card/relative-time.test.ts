import { describe, expect, it } from "vitest";
import { formatRelativeAge } from "../../src/card/relative-time.js";

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
