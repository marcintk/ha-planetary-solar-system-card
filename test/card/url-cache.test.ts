import { afterEach, describe, expect, it, vi } from "vitest";
import { UrlCache } from "../../src/card/url-cache.js";

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
});
