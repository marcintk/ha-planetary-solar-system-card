import { nothing, render } from "lit";
import { describe, expect, it } from "vitest";
import {
  buildImageStatusBar,
  buildStatusBar,
  buildStatusBarView,
  formatDate,
} from "../../src/card/card-template.js";
import type { SourceDebugStats } from "../../src/card/gallery/debug.js";
import type { GalleryViewModel } from "../../src/card/gallery/gallery-controller.js";

const zeroDebugStats: SourceDebugStats = {
  refreshes: 0,
  fetches: 0,
  failures: 0,
  retries: 0,
  expired: 0,
  elapsed: null,
  lastAttemptAt: null,
};

function galleryViewModel(overrides: Partial<GalleryViewModel> = {}): GalleryViewModel {
  return {
    error: null,
    panelSource: "none",
    imageUrl: null,
    imageDate: null,
    imageLoaded: false,
    showStrip: false,
    thumbnails: [],
    navButtonVisible: false,
    navButtonActive: false,
    debugStats: { earth: zeroDebugStats, sun: zeroDebugStats },
    debugStartedAt: Date.now(),
    ...overrides,
  };
}

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
      { lat: 51.5, lon: -0.1, timezone: "Europe/London", zoneDerived: false },
      "London",
      new Date("2026-03-05T12:00:00Z")
    );
    expect(result).toBeTruthy();
  });

  it("contains a .status-bar element when locationData is provided", () => {
    const root = renderToDOM(
      buildStatusBar(
        { lat: 51.5, lon: -0.1, timezone: "Europe/London", zoneDerived: false },
        "London",
        new Date("2026-03-05T12:00:00Z")
      )
    );
    expect(root.querySelector(".status-bar")).not.toBeNull();
  });

  it("left span includes location name, sky mode, and elevation", () => {
    const root = renderToDOM(
      buildStatusBar(
        { lat: 51.5, lon: -0.1, timezone: "Europe/London", zoneDerived: false },
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
        { lat: 51.5, lon: -0.1, timezone: "Europe/London", zoneDerived: false },
        "London",
        new Date("2026-03-05T12:00:00Z")
      )
    );
    const spans = root.querySelectorAll(".status-bar span");
    expect(spans.length).toBe(2);
    expect(spans[1].textContent).toMatch(/^Next: .+ \(\d{2}:\d{2}\)$/);
  });

  it("appends the zone offset to the Next span when the zone is longitude-derived", () => {
    const root = renderToDOM(
      buildStatusBar(
        { lat: 30, lon: -90, timezone: "Etc/GMT+6", zoneDerived: true },
        "New Orleans",
        new Date("2026-03-05T12:00:00Z")
      )
    );
    const spans = root.querySelectorAll(".status-bar span");
    expect(spans[1].textContent).toMatch(/^Next: .+ \(\d{2}:\d{2} GMT-6\)$/);
  });

  it("omits the zone offset when the zone came from HA config", () => {
    const root = renderToDOM(
      buildStatusBar(
        { lat: 51.5, lon: -0.1, timezone: "Europe/London", zoneDerived: false },
        "London",
        new Date("2026-03-05T12:00:00Z")
      )
    );
    const spans = root.querySelectorAll(".status-bar span");
    expect(spans[1].textContent).toMatch(/^Next: .+ \(\d{2}:\d{2}\)$/);
  });

  it("renders only one span when no transition found (polar night)", () => {
    const root = renderToDOM(
      buildStatusBar(
        { lat: 89, lon: 0, timezone: "UTC", zoneDerived: false },
        "Arctic",
        new Date("2026-12-21T12:00:00Z")
      )
    );
    const spans = root.querySelectorAll(".status-bar span");
    expect(spans.length).toBe(1);
  });

  it("works with null locationName (empty name before pipe)", () => {
    const root = renderToDOM(
      buildStatusBar(
        { lat: 0, lon: 0, timezone: "UTC", zoneDerived: false },
        null,
        new Date("2026-03-20T12:00:00Z")
      )
    );
    const leftSpan = root.querySelector(".status-bar span:first-child");
    expect(leftSpan.textContent).toContain("|");
  });

  it("formats the Next span using UTC when timezone is null", () => {
    const root = renderToDOM(
      buildStatusBar(
        { lat: 51.5, lon: -0.1, timezone: null, zoneDerived: false },
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

  it("labels the earth source with EARTH · DSCOVR, target body first, probe name after", () => {
    const root = renderToDOM(
      buildImageStatusBar("earth", "26-08-10 18:49", new Date("2026-08-10T18:49:00Z"), now, true)
    );
    expect(root.querySelector(".status-bar span").textContent).toContain("EARTH · DSCOVR");
  });

  it("labels the sun source with SUN · SDO HMI, target body first, probe name after", () => {
    const root = renderToDOM(
      buildImageStatusBar("sun", "26-08-12 11:55", new Date("2026-08-12T11:55:00Z"), now, true)
    );
    expect(root.querySelector(".status-bar span").textContent).toContain("SUN · SDO HMI");
  });

  it("includes the absolute date text and relative age, verb 'captured' for earth", () => {
    const root = renderToDOM(
      buildImageStatusBar("earth", "26-08-11 06:00", new Date("2026-08-11T06:00:00Z"), now, true)
    );
    expect(root.querySelector(".status-bar span").textContent).toBe(
      "EARTH · DSCOVR · captured 26-08-11 06:00 · 30h ago"
    );
  });

  it("uses verb 'captured' for sun too, now that its URL carries a real timestamp", () => {
    const root = renderToDOM(
      buildImageStatusBar("sun", "26-08-12 11:55", new Date("2026-08-12T11:55:00Z"), now, true)
    );
    expect(root.querySelector(".status-bar span").textContent).toBe(
      "SUN · SDO HMI · captured 26-08-12 11:55 · 5m ago"
    );
  });

  it("shows 'loading…' instead of the date until the image has actually loaded", () => {
    const root = renderToDOM(
      buildImageStatusBar("sun", "26-08-12 11:55", new Date("2026-08-12T11:55:00Z"), now, false)
    );
    expect(root.querySelector(".status-bar span").textContent).toBe("SUN · SDO HMI · loading…");
  });
});

describe("formatDate", () => {
  it("formats as YY-MM-DD HH:MM with zero-padding", () => {
    expect(formatDate(new Date(2026, 1, 5, 9, 3))).toBe("26-02-05 09:03");
  });
});

describe("buildStatusBarView", () => {
  const locationData = { lat: 51.5, lon: -0.1, timezone: "Europe/London", zoneDerived: false };
  const currentDate = new Date("2026-03-05T12:00:00Z");

  it("shows the gallery error when one is present, regardless of panelSource", () => {
    const root = renderToDOM(
      buildStatusBarView(
        galleryViewModel({ error: "Feed unavailable", panelSource: "earth" }),
        locationData,
        "London",
        currentDate
      )
    );
    expect(root.querySelector(".status-bar span").textContent).toBe("Feed unavailable");
  });

  it("delegates to buildStatusBar when panelSource is 'none'", () => {
    const root = renderToDOM(
      buildStatusBarView(galleryViewModel(), locationData, "London", currentDate)
    );
    expect(root.querySelector(".status-bar span:first-child").textContent).toMatch(/^London \|/);
  });

  it("delegates to buildImageStatusBar with a formatted date when panelSource is an image source", () => {
    const imageDate = new Date("2026-08-10T18:49:00Z");
    const root = renderToDOM(
      buildStatusBarView(
        galleryViewModel({ panelSource: "earth", imageDate, imageLoaded: true }),
        locationData,
        "London",
        currentDate
      )
    );
    expect(root.querySelector(".status-bar span").textContent).toContain(formatDate(imageDate));
  });

  it("passes an empty date text to buildImageStatusBar when imageDate is null", () => {
    const root = renderToDOM(
      buildStatusBarView(
        galleryViewModel({ panelSource: "sun", imageDate: null, imageLoaded: false }),
        locationData,
        "London",
        currentDate
      )
    );
    expect(root.querySelector(".status-bar span").textContent).toBe("SUN · SDO HMI · loading…");
  });
});
