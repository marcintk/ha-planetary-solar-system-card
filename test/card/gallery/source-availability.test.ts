import { describe, expect, it } from "vitest";
import type { ImageResolver } from "../../../src/card/gallery/image-resolver.js";
import { SourceAvailability } from "../../../src/card/gallery/source-availability.js";
import type { ImageSource } from "../../../src/card/gallery/sources.js";
import type { SourcedImage } from "../../../src/card/gallery/url-cache.js";

type Resolver = Pick<ImageResolver, "failureCount" | "isPermanentlyUnavailable">;

function setup(
  options: {
    failures?: Partial<Record<ImageSource, number>>;
    permanent?: ImageSource[];
    images?: Partial<Record<ImageSource, SourcedImage>>;
  } = {}
) {
  const failures = { ...options.failures };
  const permanent = new Set(options.permanent ?? []);
  const images = { ...options.images };
  const resolver: Resolver = {
    failureCount: (source) => failures[source] ?? 0,
    isPermanentlyUnavailable: (source) => permanent.has(source),
  };
  const availability = new SourceAvailability(resolver, () => images);
  return { availability, failures, permanent, images };
}

const image: SourcedImage = { url: "https://example.test/x.jpg", date: new Date(0) };

describe("SourceAvailability.isUnavailable", () => {
  it("is false at zero failures with no image", () => {
    expect(setup().availability.isUnavailable("earth")).toBe(false);
  });

  it("is true once the source has failed once", () => {
    expect(setup({ failures: { earth: 1 } }).availability.isUnavailable("earth")).toBe(true);
  });

  it("is true after several failures", () => {
    expect(setup({ failures: { sun: 4 } }).availability.isUnavailable("sun")).toBe(true);
  });

  it("is true when permanently unavailable even at zero failures", () => {
    expect(setup({ permanent: ["moon"] }).availability.isUnavailable("moon")).toBe(true);
  });

  it("is false when an image is present despite failures", () => {
    const { availability } = setup({ failures: { earth: 3 }, images: { earth: image } });
    expect(availability.isUnavailable("earth")).toBe(false);
  });

  it("is false when an image is present despite being permanently unavailable", () => {
    const { availability } = setup({ permanent: ["sun"], images: { sun: image } });
    expect(availability.isUnavailable("sun")).toBe(false);
  });

  it("only considers the asked source", () => {
    const { availability } = setup({ failures: { earth: 1 } });
    expect(availability.isUnavailable("sun")).toBe(false);
  });

  it("reads images on every call", () => {
    const { availability, images } = setup({ failures: { earth: 1 } });
    expect(availability.isUnavailable("earth")).toBe(true);
    images.earth = image;
    expect(availability.isUnavailable("earth")).toBe(false);
    delete images.earth;
    expect(availability.isUnavailable("earth")).toBe(true);
  });
});

describe("SourceAvailability.nothingDrawable", () => {
  it("is true when every source is unavailable", () => {
    const { availability } = setup({ failures: { earth: 1 }, permanent: ["sun"] });
    expect(availability.nothingDrawable(["earth", "sun"])).toBe(true);
  });

  it("is false when any source is available", () => {
    const { availability } = setup({ failures: { earth: 1 } });
    expect(availability.nothingDrawable(["earth", "sun"])).toBe(false);
  });

  it("is false when a failed source has an image", () => {
    const { availability } = setup({ failures: { earth: 1, sun: 1 }, images: { sun: image } });
    expect(availability.nothingDrawable(["earth", "sun"])).toBe(false);
  });

  it("is vacuously true for an empty list", () => {
    expect(setup().availability.nothingDrawable([])).toBe(true);
  });
});

describe("SourceAvailability.recoveredFromNothingDrawable", () => {
  const sources: ImageSource[] = ["earth", "sun"];

  it("is false on the first call while drawable", () => {
    expect(setup().availability.recoveredFromNothingDrawable(sources)).toBe(false);
  });

  it("stays false while continuously drawable", () => {
    const { availability } = setup();
    availability.recoveredFromNothingDrawable(sources);
    expect(availability.recoveredFromNothingDrawable(sources)).toBe(false);
  });

  it("stays false while still nothing drawable", () => {
    const { availability } = setup({ failures: { earth: 1, sun: 1 } });
    expect(availability.recoveredFromNothingDrawable(sources)).toBe(false);
    expect(availability.recoveredFromNothingDrawable(sources)).toBe(false);
  });

  it("is true exactly once on the transition to drawable", () => {
    const { availability, images } = setup({ failures: { earth: 1, sun: 1 } });
    expect(availability.recoveredFromNothingDrawable(sources)).toBe(false);
    images.earth = image;
    expect(availability.recoveredFromNothingDrawable(sources)).toBe(true);
    expect(availability.recoveredFromNothingDrawable(sources)).toBe(false);
  });

  it("fires again after a second outage and recovery", () => {
    const { availability, images } = setup({ failures: { earth: 1, sun: 1 } });
    availability.recoveredFromNothingDrawable(sources);
    images.earth = image;
    expect(availability.recoveredFromNothingDrawable(sources)).toBe(true);
    delete images.earth;
    expect(availability.recoveredFromNothingDrawable(sources)).toBe(false);
    images.sun = image;
    expect(availability.recoveredFromNothingDrawable(sources)).toBe(true);
  });
});

describe("SourceAvailability.reset", () => {
  const sources: ImageSource[] = ["earth", "sun"];

  it("remembers nothing-drawable so a later image counts as recovery", () => {
    const { availability, images } = setup({ failures: { earth: 1, sun: 1 } });
    availability.reset(sources);
    images.earth = image;
    expect(availability.recoveredFromNothingDrawable(sources)).toBe(true);
  });

  it("remembers drawable so no recovery fires", () => {
    const { availability } = setup();
    availability.reset(sources);
    expect(availability.recoveredFromNothingDrawable(sources)).toBe(false);
  });

  it("overwrites a previously remembered nothing-drawable state", () => {
    const { availability, images } = setup({ failures: { earth: 1, sun: 1 } });
    availability.recoveredFromNothingDrawable(sources);
    images.earth = image;
    availability.reset(sources);
    expect(availability.recoveredFromNothingDrawable(sources)).toBe(false);
  });
});
