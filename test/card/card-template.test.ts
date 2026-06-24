import { describe, expect, it } from "vitest";
import { buildStatusBarHtml } from "../../src/card/card-template.js";

// Helper: parse an HTML string into a DOM node
function parse(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div;
}

describe("buildStatusBarHtml", () => {
  it("returns empty string when locationData is null", () => {
    expect(buildStatusBarHtml(null, null, new Date())).toBe("");
  });

  it("returns a non-empty string when locationData is provided", () => {
    const result = buildStatusBarHtml(
      { lat: 51.5, lon: -0.1, timezone: "Europe/London" },
      "London",
      new Date("2026-03-05T12:00:00Z")
    );
    expect(result).toBeTruthy();
  });

  it("contains a .status-bar element when locationData is provided", () => {
    const html = buildStatusBarHtml(
      { lat: 51.5, lon: -0.1, timezone: "Europe/London" },
      "London",
      new Date("2026-03-05T12:00:00Z")
    );
    const root = parse(html);
    expect(root.querySelector(".status-bar")).not.toBeNull();
  });

  it("left span includes location name, sky mode, and elevation", () => {
    const html = buildStatusBarHtml(
      { lat: 51.5, lon: -0.1, timezone: "Europe/London" },
      "London",
      new Date("2026-03-05T12:00:00Z")
    );
    const root = parse(html);
    const leftSpan = root.querySelector(".status-bar span:first-child");
    expect(leftSpan.textContent).toMatch(/London \| .+ \(-?\d+°\)/);
  });

  it("includes Next: span when a transition exists within 24h", () => {
    // London at noon on a normal day — next transition (sunset) should exist
    const html = buildStatusBarHtml(
      { lat: 51.5, lon: -0.1, timezone: "Europe/London" },
      "London",
      new Date("2026-03-05T12:00:00Z")
    );
    const root = parse(html);
    const spans = root.querySelectorAll(".status-bar span");
    expect(spans.length).toBe(2);
    expect(spans[1].textContent).toMatch(/^Next: .+ \(\d{2}:\d{2}\)$/);
  });

  it("renders only one span when no transition found (polar night)", () => {
    // Far north in deep winter — sun stays below -18° all day
    const html = buildStatusBarHtml(
      { lat: 89, lon: 0, timezone: "UTC" },
      "Arctic",
      new Date("2026-12-21T12:00:00Z")
    );
    const root = parse(html);
    const spans = root.querySelectorAll(".status-bar span");
    expect(spans.length).toBe(1);
  });

  it("works with null locationName (empty name before pipe)", () => {
    const html = buildStatusBarHtml(
      { lat: 0, lon: 0, timezone: "UTC" },
      null,
      new Date("2026-03-20T12:00:00Z")
    );
    expect(html).not.toBe("");
    const root = parse(html);
    const leftSpan = root.querySelector(".status-bar span:first-child");
    // Name segment is empty string, still has pipe separator
    expect(leftSpan.textContent).toContain("|");
  });

  it("formats the Next span using UTC when timezone is null", () => {
    // Exercises the `locationData.timezone || "UTC"` fallback branch:
    // next transition exists but no timezone is provided.
    const html = buildStatusBarHtml(
      { lat: 51.5, lon: -0.1, timezone: null },
      "Somewhere",
      new Date("2026-03-05T12:00:00Z")
    );
    const root = parse(html);
    const spans = root.querySelectorAll(".status-bar span");
    // Should still render two spans (left info + right Next:)
    expect(spans.length).toBe(2);
    expect(spans[1].textContent).toMatch(/^Next: .+ \(\d{2}:\d{2}\)$/);
  });
});
