import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DebugAccumulator } from "../../../src/card/gallery/debug-stats.js";
import { emptyDebugAccumulator } from "../../../src/card/gallery/debug-stats.js";
import { SourceResolver } from "../../../src/card/gallery/source-resolver.js";
import type { SourcedImage, UrlCache } from "../../../src/card/gallery/url-cache.js";
import { UrlCache as UrlCacheClass } from "../../../src/card/gallery/url-cache.js";

// A synthetic tile: every hook is a plain field the test sets directly, so each test drives
// resolve()'s shared engine through one specific branch without any real NASA-specific logic
// (slot math, EPIC JSON, product-id tables) getting in the way of what's actually under test.
class MockResolver extends SourceResolver {
  readonly source = "sun" as const;
  getCachedResult: SourcedImage | null = null;
  fetchCandidateUrlImpl: (debug: DebugAccumulator) => Promise<SourcedImage> = () =>
    Promise.reject(new Error("fetchCandidateUrl not configured"));
  recoverImpl:
    | ((err: unknown, candidate: SourcedImage, debug: DebugAccumulator) => Promise<SourcedImage>)
    | null = null;

  protected getCached(): SourcedImage | null {
    return this.getCachedResult;
  }

  protected fetchCandidateUrl(debug: DebugAccumulator): Promise<SourcedImage> {
    return this.fetchCandidateUrlImpl(debug);
  }

  protected recover(
    err: unknown,
    candidate: SourcedImage,
    debug: DebugAccumulator
  ): Promise<SourcedImage> {
    return this.recoverImpl
      ? this.recoverImpl(err, candidate, debug)
      : super.recover(err, candidate, debug);
  }
}

function image(url: string): SourcedImage {
  return { url, date: new Date("2026-01-01T00:00:00Z") };
}

// Stubs the global Image constructor resolve() ends up calling via timedPreload — resolves
// decode() for any URL in `okUrls`, rejects (onerror) for everything else.
function stubImageDecode(okUrls: Set<string>): void {
  vi.stubGlobal(
    "Image",
    class {
      src = "";
      onerror: (() => void) | null = null;
      decode(): Promise<void> {
        return okUrls.has(this.src)
          ? Promise.resolve()
          : Promise.reject(new Error("decode failed"));
      }
    }
  );
}

describe("SourceResolver engine", () => {
  let cache: UrlCache;

  beforeEach(() => {
    cache = new UrlCacheClass();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("a cache hit skips fetchCandidateUrl entirely and counts cacheHits, not fetches", async () => {
    const resolver = new MockResolver(cache);
    const cached = image("https://example.test/cached.jpg");
    resolver.getCachedResult = cached;
    cache.markDecoded("sun", cached.url); // already known to decode, so isDecoded() short-circuits too
    const debug = emptyDebugAccumulator();

    const result = await resolver.resolve(debug, debug);

    expect(result).toEqual(cached);
    expect(debug.cacheHits).toBe(1);
    expect(debug.fetches).toBe(0);
    expect(debug.expired).toBe(0);
    expect(debug.gets).toBe(1);
  });

  it("a cache miss that resolves to an already-decoded URL counts expired, not cacheHits", async () => {
    const resolver = new MockResolver(cache);
    const known = image("https://example.test/known.jpg");
    cache.markDecoded("sun", known.url);
    resolver.fetchCandidateUrlImpl = () => Promise.resolve(known);
    const debug = emptyDebugAccumulator();

    const result = await resolver.resolve(debug, debug);

    expect(result).toEqual(known);
    expect(debug.cacheHits).toBe(0);
    expect(debug.expired).toBe(1);
    expect(debug.fetches).toBe(0); // MockResolver's own fetchCandidateUrl is free, like sun/moon
  });

  it("a new URL preloads, decodes, and commits — markDecoded + recordSuccess", async () => {
    const resolver = new MockResolver(cache);
    const fresh = image("https://example.test/fresh.jpg");
    resolver.fetchCandidateUrlImpl = () => Promise.resolve(fresh);
    stubImageDecode(new Set([fresh.url]));
    const debug = emptyDebugAccumulator();

    const result = await resolver.resolve(debug, debug);

    expect(result).toEqual(fresh);
    expect(debug.fetches).toBe(1);
    expect(debug.failures).toBe(0);
    expect(cache.isDecoded("sun", fresh.url)).toBe(true);
    expect(cache.getStale("sun")).toEqual(fresh);
  });

  it("splits refreshes across urlDebug/imgDebug when they're different accumulators (earth's shape)", async () => {
    const resolver = new MockResolver(cache);
    const fresh = image("https://example.test/fresh.jpg");
    resolver.fetchCandidateUrlImpl = () => Promise.resolve(fresh);
    stubImageDecode(new Set([fresh.url]));
    const urlDebug = emptyDebugAccumulator();
    const imgDebug = emptyDebugAccumulator();

    await resolver.resolve(urlDebug, imgDebug);

    expect(urlDebug.gets).toBe(1);
    expect(imgDebug.gets).toBe(1);
    expect(imgDebug.fetches).toBe(1); // the preload cost lands on imgDebug, not urlDebug
  });

  it("does not double-count refreshes when urlDebug and imgDebug are the same accumulator (sun's shape)", async () => {
    const resolver = new MockResolver(cache);
    const fresh = image("https://example.test/fresh.jpg");
    resolver.fetchCandidateUrlImpl = () => Promise.resolve(fresh);
    stubImageDecode(new Set([fresh.url]));
    const debug = emptyDebugAccumulator();

    await resolver.resolve(debug, debug);

    expect(debug.gets).toBe(1);
  });

  it("a decode failure with the default recover() rethrows, arming backoff", async () => {
    const resolver = new MockResolver(cache);
    const bad = image("https://example.test/bad.jpg");
    resolver.fetchCandidateUrlImpl = () => Promise.resolve(bad);
    stubImageDecode(new Set()); // nothing decodes
    const debug = emptyDebugAccumulator();

    await expect(resolver.resolve(debug, debug)).rejects.toThrow();

    expect(debug.failures).toBe(1);
    expect(cache.inCooldown("sun")).toBe(true);
  });

  it("a custom recover() that returns a replacement image commits it like a normal success", async () => {
    const resolver = new MockResolver(cache);
    const bad = image("https://example.test/bad.jpg");
    const recovered = image("https://example.test/recovered.jpg");
    resolver.fetchCandidateUrlImpl = () => Promise.resolve(bad);
    resolver.recoverImpl = () => Promise.resolve(recovered);
    stubImageDecode(new Set()); // bad.jpg never decodes; recover() bypasses it directly
    const debug = emptyDebugAccumulator();

    const result = await resolver.resolve(debug, debug);

    expect(result).toEqual(recovered);
    expect(cache.isDecoded("sun", recovered.url)).toBe(true);
    expect(cache.getStale("sun")).toEqual(recovered);
    expect(cache.inCooldown("sun")).toBe(false);
  });

  it("a custom recover() that also throws still arms backoff via the outer catch", async () => {
    const resolver = new MockResolver(cache);
    const bad = image("https://example.test/bad.jpg");
    resolver.fetchCandidateUrlImpl = () => Promise.resolve(bad);
    resolver.recoverImpl = () => Promise.reject(new Error("nothing left to try"));
    stubImageDecode(new Set());
    const debug = emptyDebugAccumulator();

    await expect(resolver.resolve(debug, debug)).rejects.toThrow("nothing left to try");

    expect(cache.inCooldown("sun")).toBe(true);
  });

  describe("cooldown", () => {
    it("in cooldown with a confirmed image serves it, counts backoffs, and skips getCached/fetchCandidateUrl entirely", async () => {
      const resolver = new MockResolver(cache);
      const confirmed = image("https://example.test/confirmed.jpg");
      resolver.fetchCandidateUrlImpl = () => Promise.resolve(confirmed);
      stubImageDecode(new Set([confirmed.url]));
      const seed = emptyDebugAccumulator();
      await resolver.resolve(seed, seed); // establishes a confirmed image via recordSuccess

      cache.recordFailure("sun"); // arms cooldown
      resolver.getCachedResult = { url: "should-be-unreachable", date: new Date() };
      resolver.fetchCandidateUrlImpl = () => Promise.reject(new Error("must not be called"));
      const debug = emptyDebugAccumulator();

      const result = await resolver.resolve(debug, debug);

      expect(result).toEqual(confirmed);
      expect(debug.backoffs).toBe(1);
      expect(debug.cacheHits).toBe(0);
      expect(debug.fetches).toBe(0);
    });

    it("in cooldown with nothing ever confirmed throws, without re-recording another failure", async () => {
      const resolver = new MockResolver(cache);
      cache.recordFailure("sun");
      const failuresBefore = cache.inCooldown("sun");
      const debug = emptyDebugAccumulator();

      await expect(resolver.resolve(debug, debug)).rejects.toThrow(/cooldown/);

      expect(debug.backoffs).toBe(1);
      expect(failuresBefore).toBe(true); // cooldown was already armed going in, from the one recordFailure above
    });
  });
});
