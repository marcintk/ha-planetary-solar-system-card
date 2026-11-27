import { afterEach, describe, expect, it, vi } from "vitest";
import { UrlCache } from "../../../src/card/gallery/url-cache.js";

describe("UrlCache", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null for a key that was never set", () => {
    const cache = new UrlCache();
    expect(cache.get("earth", 60000)).toBeNull();
  });

  it("returns the stored image while within maxAgeMs", () => {
    const cache = new UrlCache();
    const image = { url: "https://example.com/a.jpg", date: new Date() };
    vi.spyOn(Date, "now").mockReturnValue(1000);
    cache.set("earth", image);

    vi.spyOn(Date, "now").mockReturnValue(1000 + 59999);
    expect(cache.get("earth", 60000)).toEqual(image);
  });

  it("returns null once maxAgeMs has elapsed", () => {
    const cache = new UrlCache();
    const image = { url: "https://example.com/a.jpg", date: new Date() };
    vi.spyOn(Date, "now").mockReturnValue(1000);
    cache.set("earth", image);

    vi.spyOn(Date, "now").mockReturnValue(1000 + 60000);
    expect(cache.get("earth", 60000)).toBeNull();
  });

  it("keys are independent of each other", () => {
    const cache = new UrlCache();
    cache.set("earth", { url: "https://example.com/earth.jpg", date: new Date() });
    expect(cache.get("sun", 60000)).toBeNull();
  });

  it("clear empties every key", () => {
    const cache = new UrlCache();
    cache.set("earth", { url: "https://example.com/a.jpg", date: new Date() });
    cache.set("sun", { url: "https://example.com/b.jpg", date: new Date() });
    cache.clear();
    expect(cache.get("earth", 60000)).toBeNull();
    expect(cache.get("sun", 60000)).toBeNull();
  });

  it("isDecoded is false until markDecoded is called for that key and url", () => {
    const cache = new UrlCache();
    expect(cache.isDecoded("earth", "https://example.com/a.jpg")).toBe(false);
    cache.markDecoded("earth", "https://example.com/a.jpg");
    expect(cache.isDecoded("earth", "https://example.com/a.jpg")).toBe(true);
  });

  it("isDecoded is false for a different url on the same key", () => {
    const cache = new UrlCache();
    cache.markDecoded("earth", "https://example.com/a.jpg");
    expect(cache.isDecoded("earth", "https://example.com/b.jpg")).toBe(false);
  });

  it("decode state is independent per key", () => {
    const cache = new UrlCache();
    cache.markDecoded("earth", "https://example.com/a.jpg");
    expect(cache.isDecoded("sun", "https://example.com/a.jpg")).toBe(false);
  });

  it("clear also resets decode state", () => {
    const cache = new UrlCache();
    cache.markDecoded("earth", "https://example.com/a.jpg");
    cache.clear();
    expect(cache.isDecoded("earth", "https://example.com/a.jpg")).toBe(false);
  });

  // Cooldown/backoff behavior itself is Backoff's responsibility (backoff.test.ts) — these
  // just confirm UrlCache actually delegates to it rather than owning parallel state.
  describe("cooldown/backoff delegation", () => {
    it("getStale ignores a set() candidate that was never confirmed via recordSuccess", () => {
      // Regression: sun's resolver optimistically writes a computed candidate to the TTL
      // cache (set()) before it's confirmed to load — getStale must not treat that as a
      // known-good fallback during a cooldown.
      const cache = new UrlCache();
      cache.set("sun", { url: "https://example.com/unconfirmed.jpg", date: new Date() });
      expect(cache.getStale("sun")).toBeNull();
    });

    it("recordFailure puts a source in cooldown, recordSuccess clears it", () => {
      const cache = new UrlCache();
      cache.recordFailure("sun");
      expect(cache.inCooldown("sun")).toBe(true);

      cache.recordSuccess("sun", { url: "https://example.com/x.jpg", date: new Date() });
      expect(cache.inCooldown("sun")).toBe(false);
      expect(cache.getStale("sun")).toEqual({
        url: "https://example.com/x.jpg",
        date: expect.any(Date),
      });
    });

    it("clear also resets cooldown/backoff state", () => {
      const cache = new UrlCache();
      cache.recordFailure("sun");
      cache.clear();
      expect(cache.inCooldown("sun")).toBe(false);
    });
  });

  describe("getEntry", () => {
    it("returns null for a key that was never set", () => {
      expect(new UrlCache().getEntry("earth")).toBeNull();
    });

    it("returns the image with its fetch instant, bypassing the TTL", () => {
      const cache = new UrlCache();
      const image = { url: "https://example.com/a.jpg", date: new Date() };
      vi.spyOn(Date, "now").mockReturnValue(1000);
      cache.set("earth", image);

      vi.spyOn(Date, "now").mockReturnValue(1000 + 10_000_000);
      expect(cache.getEntry("earth")).toEqual({ image, fetchedAt: 1000 });
    });
  });

  describe("lastChecked", () => {
    it("is undefined until recordChecked stamps the key", () => {
      const cache = new UrlCache();
      expect(cache.getLastCheckedAt("sun")).toBeUndefined();
      vi.spyOn(Date, "now").mockReturnValue(5000);
      cache.recordChecked("sun");
      expect(cache.getLastCheckedAt("sun")).toBe(5000);
      expect(cache.getLastCheckedAt("earth")).toBeUndefined();
    });

    it("is not written by set()", () => {
      const cache = new UrlCache();
      cache.set("sun", { url: "https://example.com/a.jpg", date: new Date() });
      expect(cache.getLastCheckedAt("sun")).toBeUndefined();
    });

    it("clear resets it", () => {
      const cache = new UrlCache();
      cache.recordChecked("sun");
      cache.clear();
      expect(cache.getLastCheckedAt("sun")).toBeUndefined();
    });
  });

  describe("failureCount delegation", () => {
    it("counts consecutive failures per key, resets on success and clear", () => {
      const cache = new UrlCache();
      expect(cache.failureCount("sun")).toBe(0);
      cache.recordFailure("sun");
      cache.recordFailure("sun");
      expect(cache.failureCount("sun")).toBe(2);
      expect(cache.failureCount("earth")).toBe(0);

      cache.recordSuccess("sun", { url: "https://example.com/x.jpg", date: new Date() });
      expect(cache.failureCount("sun")).toBe(0);

      cache.recordFailure("sun");
      cache.clear();
      expect(cache.failureCount("sun")).toBe(0);
    });
  });
});
