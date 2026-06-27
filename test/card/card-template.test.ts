import { nothing, render } from "lit";
import { describe, expect, it } from "vitest";
import { buildStatusBar } from "../../src/card/card-template.js";

function renderToDOM(result) {
  const div = document.createElement("div");
  render(result, div);
  return div;
}

// Lit injects comment markers like <!--?lit$013215205$--> and binding ids
// whose numbers change between module loads. Strip the ids so the snapshot
// is stable across runs while still capturing structure, classes, and text.
function doc(result) {
  return renderToDOM(result)
    .innerHTML.replace(/<!--\?lit\$\d+\$-->/g, "<!--?-->")
    .replace(/lit\$\d+\$/g, "lit$$$$");
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

  // Snapshots capture the full rendered structure (element nesting, classes,
  // text) for each variant — anything the targeted asserts above don't pin.
  describe("rendered structure snapshots", () => {
    it("full status bar with Next transition", () => {
      expect(
        doc(
          buildStatusBar(
            { lat: 51.5, lon: -0.1, timezone: "Europe/London" },
            "London",
            new Date("2026-03-05T12:00:00Z")
          )
        )
      ).toMatchSnapshot();
    });

    it("single span (polar night, no transition)", () => {
      expect(
        doc(
          buildStatusBar(
            { lat: 89, lon: 0, timezone: "UTC" },
            "Arctic",
            new Date("2026-12-21T12:00:00Z")
          )
        )
      ).toMatchSnapshot();
    });

    it("null location name (empty before pipe)", () => {
      expect(
        doc(
          buildStatusBar(
            { lat: 0, lon: 0, timezone: "UTC" },
            null,
            new Date("2026-03-20T12:00:00Z")
          )
        )
      ).toMatchSnapshot();
    });
  });
});
