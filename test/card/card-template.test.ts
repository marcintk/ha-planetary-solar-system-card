import { nothing, render } from "lit";
import { describe, expect, it } from "vitest";
import { buildImageStatusBar, buildStatusBar } from "../../src/card/card-template.js";

function renderToDOM(result) {
  const div = document.createElement("div");
  render(result, div);
  return div;
}

describe("buildStatusBar", () => {
  it("returns nothing when locationData is null", () => {
    expect(buildStatusBar(null, null, new Date())).toBe(nothing);
  });

  it("returns a truthy value when locationData is provided", () => {
    const result = buildStatusBar(
      { lat: 51.5, lon: -0.1, timezone: "Europe/London" },
      "London",
      new Date("2026-03-05T12:00:00Z")
    );
    expect(result).toBeTruthy();
  });

  it("contains a .status-bar element when locationData is provided", () => {
    const root = renderToDOM(
      buildStatusBar(
        { lat: 51.5, lon: -0.1, timezone: "Europe/London" },
        "London",
        new Date("2026-03-05T12:00:00Z")
      )
    );
    expect(root.querySelector(".status-bar")).not.toBeNull();
  });

  it("left span includes location name, sky mode, and elevation", () => {
    const root = renderToDOM(
      buildStatusBar(
        { lat: 51.5, lon: -0.1, timezone: "Europe/London" },
        "London",
        new Date("2026-03-05T12:00:00Z")
      )
    );
    const leftSpan = root.querySelector(".status-bar span:first-child");
    expect(leftSpan.textContent).toMatch(/London \| .+ \(-?\d+°\)/);
  });

  it("includes Next: span when a transition exists within 24h", () => {
    const root = renderToDOM(
      buildStatusBar(
        { lat: 51.5, lon: -0.1, timezone: "Europe/London" },
        "London",
        new Date("2026-03-05T12:00:00Z")
      )
    );
    const spans = root.querySelectorAll(".status-bar span");
    expect(spans.length).toBe(2);
    expect(spans[1].textContent).toMatch(/^Next: .+ \(\d{2}:\d{2}\)$/);
  });

  it("renders only one span when no transition found (polar night)", () => {
    const root = renderToDOM(
      buildStatusBar(
        { lat: 89, lon: 0, timezone: "UTC" },
        "Arctic",
        new Date("2026-12-21T12:00:00Z")
      )
    );
    const spans = root.querySelectorAll(".status-bar span");
    expect(spans.length).toBe(1);
  });

  it("works with null locationName (empty name before pipe)", () => {
    const root = renderToDOM(
      buildStatusBar({ lat: 0, lon: 0, timezone: "UTC" }, null, new Date("2026-03-20T12:00:00Z"))
    );
    const leftSpan = root.querySelector(".status-bar span:first-child");
    expect(leftSpan.textContent).toContain("|");
  });

  it("formats the Next span using UTC when timezone is null", () => {
    const root = renderToDOM(
      buildStatusBar(
        { lat: 51.5, lon: -0.1, timezone: null },
        "Somewhere",
        new Date("2026-03-05T12:00:00Z")
      )
    );
    const spans = root.querySelectorAll(".status-bar span");
    expect(spans.length).toBe(2);
    expect(spans[1].textContent).toMatch(/^Next: .+ \(\d{2}:\d{2}\)$/);
  });
});

describe("buildImageStatusBar", () => {
  const now = new Date("2026-08-12T12:00:00Z");

  it("labels the earth source with L1→EARTH · DSCOVR, matching the gallery thumbnail", () => {
    const root = renderToDOM(
      buildImageStatusBar("earth", "26-08-10 18:49", new Date("2026-08-10T18:49:00Z"), now, true)
    );
    expect(root.querySelector(".status-bar span").textContent).toContain("L1→EARTH · DSCOVR");
  });

  it("labels the sun source with GEO→SUN · SDO HMI, matching the gallery thumbnail", () => {
    const root = renderToDOM(
      buildImageStatusBar("sun", "26-08-12 11:55", new Date("2026-08-12T11:55:00Z"), now, true)
    );
    expect(root.querySelector(".status-bar span").textContent).toContain("GEO→SUN · SDO HMI");
  });

  it("includes the absolute date text and relative age, verb 'captured' for earth", () => {
    const root = renderToDOM(
      buildImageStatusBar("earth", "26-08-11 06:00", new Date("2026-08-11T06:00:00Z"), now, true)
    );
    expect(root.querySelector(".status-bar span").textContent).toBe(
      "L1→EARTH · DSCOVR · captured 26-08-11 06:00 · 30h ago"
    );
  });

  it("uses verb 'captured' for sun too, now that its URL carries a real timestamp", () => {
    const root = renderToDOM(
      buildImageStatusBar("sun", "26-08-12 11:55", new Date("2026-08-12T11:55:00Z"), now, true)
    );
    expect(root.querySelector(".status-bar span").textContent).toBe(
      "GEO→SUN · SDO HMI · captured 26-08-12 11:55 · 5m ago"
    );
  });

  it("shows 'loading…' instead of the date until the image has actually loaded", () => {
    const root = renderToDOM(
      buildImageStatusBar("sun", "26-08-12 11:55", new Date("2026-08-12T11:55:00Z"), now, false)
    );
    expect(root.querySelector(".status-bar span").textContent).toBe("GEO→SUN · SDO HMI · loading…");
  });
});
