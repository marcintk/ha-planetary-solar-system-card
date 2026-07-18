import { render, type TemplateResult } from "lit";
import { describe, expect, it } from "vitest";
import { cardStyles } from "../src/card/card-styles.js";
import { buildStatusBar } from "../src/card/card-template.js";

function renderToDOM(result: TemplateResult): HTMLElement {
  const div = document.createElement("div");
  render(result, div);
  return div;
}

// Lit injects comment markers like <!--?lit$013215205$--> and binding ids
// whose numbers change between module loads. Strip the ids so the snapshot
// is stable across runs while still capturing structure, classes, and text.
function doc(result: TemplateResult): string {
  return renderToDOM(result)
    .innerHTML.replace(/<!--\?lit\$\d+\$-->/g, "<!--?-->")
    .replace(/lit\$\d+\$/g, "lit$$$$");
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
