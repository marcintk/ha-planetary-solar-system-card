import { describe, expect, it } from "vitest";
import { buildCardHtml, buildStatusBarHtml } from "../../src/card/card-template.js";

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
});

describe("buildCardHtml", () => {
  it("includes a <style> tag", () => {
    const root = parse(buildCardHtml("", "26-03-07 12:00", 1));
    expect(root.querySelector("style")).not.toBeNull();
  });

  it("includes a .card wrapper", () => {
    const root = parse(buildCardHtml("", "26-03-07 12:00", 1));
    expect(root.querySelector(".card")).not.toBeNull();
  });

  it("includes a .solar-view-wrapper with overflow: hidden in style", () => {
    const html = buildCardHtml("", "26-03-07 12:00", 1);
    const root = parse(html);
    expect(root.querySelector(".solar-view-wrapper")).not.toBeNull();
    expect(root.querySelector("style").textContent).toContain("overflow: hidden");
  });

  it("includes #solar-view container for the SVG", () => {
    const root = parse(buildCardHtml("", "26-03-07 12:00", 1));
    expect(root.querySelector("#solar-view")).not.toBeNull();
  });

  it("includes all seven navigation buttons in correct order", () => {
    const root = parse(buildCardHtml("", "26-03-07 12:00", 1));
    const actions = Array.from(root.querySelectorAll(".nav button")).map((b) => b.dataset.action);
    expect(actions).toContain("month-back");
    expect(actions).toContain("day-back");
    expect(actions).toContain("hour-back");
    expect(actions).toContain("today");
    expect(actions).toContain("hour-forward");
    expect(actions).toContain("day-forward");
    expect(actions).toContain("month-forward");
  });

  it("includes zoom-out and zoom-in buttons", () => {
    const root = parse(buildCardHtml("", "26-03-07 12:00", 1));
    expect(root.querySelector('button[data-action="zoom-out"]')).not.toBeNull();
    expect(root.querySelector('button[data-action="zoom-in"]')).not.toBeNull();
  });

  it("displays the formatted date in .date span", () => {
    const root = parse(buildCardHtml("", "26-03-07 14:30", 1));
    const dateSpan = root.querySelector(".date");
    expect(dateSpan).not.toBeNull();
    expect(dateSpan.textContent).toBe("26-03-07 14:30");
  });

  it("displays the current zoom level in .zoom-level span", () => {
    const root = parse(buildCardHtml("", "26-03-07 12:00", 3));
    const levelSpan = root.querySelector(".zoom-level");
    expect(levelSpan).not.toBeNull();
    expect(levelSpan.textContent).toBe("3");
  });

  it("injects statusBarHtml inside .solar-view-wrapper", () => {
    const statusHtml = '<div class="status-bar"><span>Test | Day (45°)</span></div>';
    const root = parse(buildCardHtml(statusHtml, "26-03-07 12:00", 1));
    const wrapper = root.querySelector(".solar-view-wrapper");
    expect(wrapper.querySelector(".status-bar")).not.toBeNull();
  });

  it("has two .btn-group spans (nav and zoom)", () => {
    const root = parse(buildCardHtml("", "26-03-07 12:00", 1));
    const groups = root.querySelectorAll(".btn-group");
    expect(groups.length).toBe(2);
  });
});
