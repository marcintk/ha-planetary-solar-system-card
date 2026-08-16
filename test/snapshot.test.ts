import { snapHtml } from "ha-card-shared/test-utils";
import { render, type TemplateResult } from "lit";
import { describe, expect, it } from "vitest";
import { cardStyles } from "../src/card/card-styles.js";
import { buildStatusBar } from "../src/card/card-template.js";
import { renderSolarSystem } from "../src/renderer/index.js";

function doc(result: TemplateResult): string {
  const div = document.createElement("div");
  render(result, div);
  return snapHtml(div.innerHTML);
}

describe("cardStyles", () => {
  it("matches snapshot", () => {
    expect(cardStyles.cssText).toMatchSnapshot();
  });
});

describe("buildStatusBar snapshots", () => {
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
        buildStatusBar({ lat: 0, lon: 0, timezone: "UTC" }, null, new Date("2026-03-20T12:00:00Z"))
      )
    ).toMatchSnapshot();
  });
});

describe("renderSolarSystem snapshot", () => {
  it("full solar system SVG at a fixed date (coarse tripwire for renderer changes)", () => {
    const { svg } = renderSolarSystem(
      new Date("2026-02-14T12:00:00Z"),
      "north",
      { lat: 51.5, lon: -0.1, timezone: "Europe/London" },
      {},
      false
    );
    expect(snapHtml(svg.outerHTML)).toMatchSnapshot();
  });
});
