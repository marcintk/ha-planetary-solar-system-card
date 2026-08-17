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
});
