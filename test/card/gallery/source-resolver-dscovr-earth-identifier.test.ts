import { describe, expect, it } from "vitest";
import {
  buildEpicImage,
  EPIC_BASE_URL,
} from "../../../src/card/gallery/source-resolver-dscovr-earth.js";

// Pure identifier → SourcedImage math, no fetch mock — see buildEpicImage's own comment for why
// this was split out of fetchLatestEarthImageUrl.
describe("buildEpicImage", () => {
  it("builds the archive URL from the identifier's own date segments", () => {
    const image = buildEpicImage("20260810234950");
    expect(image.url).toBe(
      `${EPIC_BASE_URL}/archive/natural/2026/08/10/jpg/epic_1b_20260810234950.jpg`
    );
  });

  it("parses the identifier as a UTC timestamp, not local time", () => {
    const image = buildEpicImage("20260810234950");
    expect(image.date.toISOString()).toBe("2026-08-10T23:49:50.000Z");
  });

  it("keeps the zero-padded segments distinct (midnight, single-digit month/day)", () => {
    const image = buildEpicImage("20260105000003");
    expect(image.date.toISOString()).toBe("2026-01-05T00:00:03.000Z");
    expect(image.url).toContain("/archive/natural/2026/01/05/jpg/epic_1b_20260105000003.jpg");
  });
});
