import { nothing, render } from "lit";
import { describe, expect, it } from "vitest";
import {
  buildImageStatusBar,
  buildStatusBar,
  buildStatusBarView,
  discStyle,
} from "../../src/card/card-template.js";
import type { SourceDebugStats } from "../../src/card/gallery/debug-stats.js";
import type { GalleryViewModel } from "../../src/card/gallery/gallery-controller.js";
import { formatDate } from "../../src/card/relative-time.js";

const zeroDebugStats: SourceDebugStats = {
  gets: 0,
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
      { lat: 51.5, lon: -0.1, timezone: "Europe/London", zoneOverride: false },
      "London",
      new Date("2026-03-05T12:00:00Z")
    );
    expect(result).toBeTruthy();
  });

  it("contains a .status-bar element when locationData is provided", () => {
    const root = renderToDOM(
      buildStatusBar(
        { lat: 51.5, lon: -0.1, timezone: "Europe/London", zoneOverride: false },
        "London",
        new Date("2026-03-05T12:00:00Z")
      )
    );
    expect(root.querySelector(".status-bar")).not.toBeNull();
  });

  it("left span includes location name, sky mode, and elevation", () => {
    const root = renderToDOM(
      buildStatusBar(
        { lat: 51.5, lon: -0.1, timezone: "Europe/London", zoneOverride: false },
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
        { lat: 51.5, lon: -0.1, timezone: "Europe/London", zoneOverride: false },
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
        { lat: 30, lon: -90, timezone: "Etc/GMT+6", zoneOverride: true },
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
        { lat: 51.5, lon: -0.1, timezone: "Europe/London", zoneOverride: false },
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
        { lat: 89, lon: 0, timezone: "UTC", zoneOverride: false },
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
        { lat: 0, lon: 0, timezone: "UTC", zoneOverride: false },
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
        { lat: 51.5, lon: -0.1, timezone: null, zoneOverride: false },
        "Somewhere",
        new Date("2026-03-05T12:00:00Z")
      )
    );
    const spans = root.querySelectorAll(".status-bar span");
    expect(spans.length).toBe(2);
    expect(spans[1].textContent).toMatch(/^Next: .+ \(\d{2}:\d{2}\)$/);
  });
});

describe("discStyle", () => {
  const SOURCES = ["moon", "mymoon", "earth", "sun"] as const;

  // The invariant the two numbers exist to satisfy. clip-path resolves in the element's own
  // coordinates and transform applies to the result, so clip radius x scale must land exactly
  // on the source's target — any more and the circle escapes the tile. Sun's target is lower
  // than the rest (see TARGET_FRACTION) — it's the one source whose real apparent size barely
  // varies, so without its own lower target it would render at full size on nearly every frame
  // while Moon and Earth, pinned to their rarely-hit maximum, mostly don't.
  const EXPECTED_TARGET: Record<(typeof SOURCES)[number], number> = {
    moon: 44.5,
    mymoon: 44.5,
    earth: 43.5,
    sun: 40,
  };
  it.each(SOURCES)("clips %s so the scaled circle lands on its own target size", (source) => {
    const style = discStyle(source, "circle");
    const radius = Number(/circle\((\d+(?:\.\d+)?)%\)/.exec(style)?.[1]);
    const scale = Number(/scale\((\d+(?:\.\d+)?)\)/.exec(style)?.[1]);
    // Not exact: both numbers are rounded for legible CSS output. 0.2% of a 104px tile is a
    // fifth of a pixel — tight enough to catch a decoupled pair, loose enough for rounding.
    expect(Math.abs(radius * scale - EXPECTED_TARGET[source])).toBeLessThan(0.2);
  });

  // Each source leaves a different margin around its body, so a single shared constant would
  // either crop a limb or leave a black ring.
  it("scales each source by its own measured disc fraction", () => {
    const scaleOf = (source: (typeof SOURCES)[number]) =>
      Number(/scale\((\d+(?:\.\d+)?)\)/.exec(discStyle(source, "circle"))?.[1]);
    // Earth is framed much more loosely by DSCOVR than the Moon is by SVS.
    expect(scaleOf("earth")).toBeGreaterThan(scaleOf("moon"));
    // Never enough to crop: every source's body fits inside its own frame.
    for (const source of SOURCES) expect(scaleOf(source)).toBeLessThan(1.3);
  });

  it("folds the sky rotation in ahead of the scale, and omits it otherwise", () => {
    expect(discStyle("mymoon", "circle", 17.1)).toContain("transform: rotate(17.1deg) scale(");
    expect(discStyle("mymoon", "circle", 0)).not.toContain("rotate");
  });

  describe("square", () => {
    // Same target size as circle mode, but a square clip instead of a round one — so the
    // shape setting changes the puck's outline, not its size. mymoon is the one exception
    // (see its own test below).
    it("crops to an inset square and scales to the shared target", () => {
      for (const source of SOURCES.filter((s) => s !== "mymoon")) {
        const style = discStyle(source, "square");
        expect(style).toMatch(/^clip-path: inset\(\d+(\.\d+)?%\); transform: scale\(/);
      }
    });

    // mymoon ignores gallery.shape entirely and always circle-crops: its clip rotates with the
    // image, and a rotated inset() square still shows the source JPEG's own black square canvas
    // inside that rotated shape at every angle but 0/90/180/270 — a circle is the one shape
    // rotation-invariant, so it's the only crop that gives an exact Moon disc with nothing but
    // the tile's own backdrop around it.
    it("still circle-crops the sky tile even when shape is square", () => {
      const style = discStyle("mymoon", "square", 17.1);
      expect(style).toMatch(
        /^clip-path: circle\(\d+(\.\d+)?%\); transform: rotate\(17\.1deg\) scale\(/
      );
    });

    // The point of this session's change: same object size in both shapes, only the crop
    // around it differs.
    it("scales identically to circle mode for the same source", () => {
      const scale = (style: string) => Number(/scale\((\d+(?:\.\d+)?)\)/.exec(style)?.[1] ?? "0");
      for (const source of SOURCES) {
        expect(scale(discStyle(source, "square"))).toBeCloseTo(scale(discStyle(source, "circle")));
      }
    });
  });
});

describe("buildImageStatusBar", () => {
  const now = new Date("2026-08-12T12:00:00Z");

  it("labels the earth source with EARTH · NOAA DSCOVR EPIC, target body first, probe name after", () => {
    const root = renderToDOM(
      buildImageStatusBar("earth", "26-08-10 18:49", new Date("2026-08-10T18:49:00Z"), now, true)
    );
    expect(root.querySelector(".status-bar span").textContent).toContain(
      "EARTH · NOAA DSCOVR EPIC"
    );
  });

  it("labels the sun source with SUN · NASA SDO HMI, target body first, probe name after", () => {
    const root = renderToDOM(
      buildImageStatusBar("sun", "26-08-12 11:55", new Date("2026-08-12T11:55:00Z"), now, true)
    );
    expect(root.querySelector(".status-bar span").textContent).toContain("SUN · NASA SDO HMI");
  });

  it("includes the absolute date text and relative age, verb 'captured' for earth", () => {
    const root = renderToDOM(
      buildImageStatusBar("earth", "26-08-11 06:00", new Date("2026-08-11T06:00:00Z"), now, true)
    );
    expect(root.querySelector(".status-bar span").textContent).toBe(
      "EARTH · NOAA DSCOVR EPIC · captured 26-08-11 06:00 · 30h ago"
    );
  });

  // The Moon tiles are renders, not photographs, and the sky one is normally for an hour
  // that has not happened yet — so it takes both a different verb and a forward tense.
  it("says 'rendered' for the geocentric moon", () => {
    const root = renderToDOM(
      buildImageStatusBar("moon", "26-08-12 11:00", new Date("2026-08-12T11:00:00Z"), now, true)
    );
    expect(root.querySelector(".status-bar span").textContent).toBe(
      "MOON · NASA SVS · rendered 26-08-12 11:00 · 1h ago"
    );
  });

  it("labels the sky moon the same as the object tile — same frame, same verb", () => {
    const root = renderToDOM(
      buildImageStatusBar("mymoon", "26-08-12 11:00", new Date("2026-08-12T11:00:00Z"), now, true)
    );
    expect(root.querySelector(".status-bar span").textContent).toBe(
      "MOON · NASA SVS · rendered 26-08-12 11:00 · 1h ago"
    );
  });

  it("uses verb 'captured' for sun too, now that its URL carries a real timestamp", () => {
    const root = renderToDOM(
      buildImageStatusBar("sun", "26-08-12 11:55", new Date("2026-08-12T11:55:00Z"), now, true)
    );
    expect(root.querySelector(".status-bar span").textContent).toBe(
      "SUN · NASA SDO HMI · captured 26-08-12 11:55 · 5m ago"
    );
  });

  it("shows 'loading…' instead of the date until the image has actually loaded", () => {
    const root = renderToDOM(
      buildImageStatusBar("sun", "26-08-12 11:55", new Date("2026-08-12T11:55:00Z"), now, false)
    );
    expect(root.querySelector(".status-bar span").textContent).toBe(
      "SUN · NASA SDO HMI · loading…"
    );
  });
});

describe("buildStatusBarView", () => {
  const locationData = { lat: 51.5, lon: -0.1, timezone: "Europe/London", zoneOverride: false };
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
    expect(root.querySelector(".status-bar span").textContent).toBe(
      "SUN · NASA SDO HMI · loading…"
    );
  });
});
