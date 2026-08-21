import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyDebugAccumulator } from "../../../src/card/gallery/debug.js";
import {
  fullSizeMoonUrl,
  getMoonFrameImage,
  MOON_FRAME_MS,
  MOON_FULL_SIZE,
  MOON_PRODUCT_IDS,
  MOON_THUMB_SIZE,
  moonFrameUrl,
  SVS_BASE_URL,
  SvsMoonResolver,
} from "../../../src/card/gallery/source-resolver-svs-moon.js";
import { UrlCache } from "../../../src/card/gallery/url-cache.js";

function stubImageDecode(succeeds = true) {
  vi.stubGlobal(
    "Image",
    class {
      src = "";
      decode() {
        return succeeds ? Promise.resolve() : Promise.reject(new Error("decode failed"));
      }
    }
  );
}

describe("source-resolver-svs-moon", () => {
  let cache: UrlCache;

  beforeEach(() => {
    cache = new UrlCache();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("moonFrameUrl", () => {
    // Ground truth: every one of these URLs was fetched from NASA and returned 200 with a
    // real frame. The frame number is the 1-based hour of the year, which is how SVS names
    // the 8,760 pre-rendered frames of its annual "Moon Phase and Libration" product.
    const FRAMES: [string, string][] = [
      ["2026-08-21T12:00:00Z", "moon.5581.jpg"],
      ["2026-01-05T03:00:00Z", "moon.0100.jpg"],
      ["2026-12-30T18:00:00Z", "moon.8731.jpg"],
    ];

    it.each(FRAMES)("names the frame for %s", (utc, filename) => {
      expect(moonFrameUrl(new Date(utc), MOON_THUMB_SIZE)).toContain(filename);
    });

    it("uses the first hour of the year for its first instant", () => {
      expect(moonFrameUrl(new Date("2026-01-01T00:00:00Z"), MOON_THUMB_SIZE)).toContain(
        "moon.0001.jpg"
      );
    });

    it("builds the full SVS path, grouping the product id by hundreds", () => {
      // Product 5587 (2026) lives under a005500/a005587 — the group is the id floored to 100.
      expect(moonFrameUrl(new Date("2026-08-21T12:00:00Z"), MOON_THUMB_SIZE)).toBe(
        `${SVS_BASE_URL}/a005500/a005587/frames/${MOON_THUMB_SIZE}/moon.5581.jpg`
      );
    });

    it("serves the same frame at full-screen resolution", () => {
      expect(moonFrameUrl(new Date("2026-08-21T12:00:00Z"), MOON_FULL_SIZE)).toBe(
        `${SVS_BASE_URL}/a005500/a005587/frames/${MOON_FULL_SIZE}/moon.5581.jpg`
      );
    });

    // Every frame for a mapped year is pre-published, so a miss can only mean the year has no
    // product constant yet. Failing loudly is the point: SVS answers an out-of-range date with
    // the last frame of the current product rather than a 404, so a silent fallback would show
    // a confidently wrong Moon.
    it("throws for a year with no published product", () => {
      expect(() => moonFrameUrl(new Date("2019-06-01T00:00:00Z"), MOON_THUMB_SIZE)).toThrow(/2019/);
    });

    it("maps every product id it knows to a distinct year", () => {
      const years = Object.keys(MOON_PRODUCT_IDS);
      const ids = Object.values(MOON_PRODUCT_IDS);
      expect(new Set(ids).size).toBe(ids.length);
      expect(years.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("fullSizeMoonUrl", () => {
    it("swaps the thumbnail resolution for the full-screen one", () => {
      const thumb = moonFrameUrl(new Date("2026-08-21T12:00:00Z"), MOON_THUMB_SIZE);
      expect(fullSizeMoonUrl(thumb)).toBe(
        moonFrameUrl(new Date("2026-08-21T12:00:00Z"), MOON_FULL_SIZE)
      );
    });

    // The panel must open the frame the tile was showing, never a freshly computed one — a
    // click that lands either side of the hour boundary would otherwise change the picture.
    it("keeps the frame number the thumbnail resolved", () => {
      const thumb = moonFrameUrl(new Date("2026-03-04T07:00:00Z"), MOON_THUMB_SIZE);
      expect(fullSizeMoonUrl(thumb)).toContain("moon.1496.jpg");
    });

    it("leaves a non-moon URL alone", () => {
      const earth = "https://epic.gsfc.nasa.gov/archive/natural/2026/08/19/jpg/epic_1b_x.jpg";
      expect(fullSizeMoonUrl(earth)).toBe(earth);
    });
  });

  describe("getMoonFrameImage", () => {
    it("dates the image by the frame's own hour, not the query instant", () => {
      const { date } = getMoonFrameImage(new Date("2026-08-21T12:42:30Z"));
      expect(date.toISOString()).toBe("2026-08-21T12:00:00.000Z");
    });
  });

  describe("SvsMoonResolver", () => {
    const NOW = Date.UTC(2026, 7, 21, 12, 42, 30);

    it("resolves the current hour's frame", async () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      stubImageDecode();
      const resolver = new SvsMoonResolver("moon", () => new Date(Date.now()), cache);
      const image = await resolver.resolve(emptyDebugAccumulator(), emptyDebugAccumulator());
      expect(image.url).toContain("moon.5581.jpg");
    });

    // The sky tile asks for a different instant than the object tile, so the two hold their
    // own cache entries under their own keys rather than fighting over one.
    it("keeps its own cache entry per source key", async () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      stubImageDecode();
      const object = new SvsMoonResolver("moon", () => new Date(Date.now()), cache);
      const sky = new SvsMoonResolver("mymoon", () => new Date("2026-08-22T03:00:00Z"), cache);
      await object.resolve(emptyDebugAccumulator(), emptyDebugAccumulator());
      await sky.resolve(emptyDebugAccumulator(), emptyDebugAccumulator());
      expect(cache.getStale("moon")?.url).toContain("moon.5581.jpg");
      expect(cache.getStale("mymoon")?.url).toContain("moon.5596.jpg");
    });

    // Freshness is URL identity, so every card holding a frame drops it at the same instant —
    // the moment the reference time crosses into the next hour — without a TTL to anchor.
    it("serves from cache until the frame's own hour is over", async () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      stubImageDecode();
      const resolver = new SvsMoonResolver("moon", () => new Date(Date.now()), cache);
      const debug = emptyDebugAccumulator();
      await resolver.resolve(debug, emptyDebugAccumulator());
      const fetchesAfterFirst = debug.fetches;

      vi.spyOn(Date, "now").mockReturnValue(NOW + 10 * 60000); // same hour
      await resolver.resolve(debug, emptyDebugAccumulator());
      expect(debug.fetches).toBe(fetchesAfterFirst);
      expect(debug.cacheHits).toBeGreaterThan(0);
    });

    it("moves to the next frame once the hour rolls over", async () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      stubImageDecode();
      const resolver = new SvsMoonResolver("moon", () => new Date(Date.now()), cache);
      await resolver.resolve(emptyDebugAccumulator(), emptyDebugAccumulator());

      vi.spyOn(Date, "now").mockReturnValue(NOW + MOON_FRAME_MS);
      const next = await resolver.resolve(emptyDebugAccumulator(), emptyDebugAccumulator());
      expect(next.url).toContain("moon.5582.jpg");
    });

    // No recover() override: every frame is pre-published, so a failure is not publish lag and
    // stepping backwards cannot help. It falls into the shared cooldown like any other source.
    it("propagates a failed decode rather than hunting earlier frames", async () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      stubImageDecode(false);
      const resolver = new SvsMoonResolver("moon", () => new Date(Date.now()), cache);
      await expect(
        resolver.resolve(emptyDebugAccumulator(), emptyDebugAccumulator())
      ).rejects.toThrow();
    });

    it("hydrates from a still-fresh cache after a remount", async () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      stubImageDecode();
      const first = new SvsMoonResolver("moon", () => new Date(Date.now()), cache);
      await first.resolve(emptyDebugAccumulator(), emptyDebugAccumulator());

      const remounted = new SvsMoonResolver("moon", () => new Date(Date.now()), cache);
      expect(remounted.hydrate()?.url).toContain("moon.5581.jpg");
    });
  });
});
