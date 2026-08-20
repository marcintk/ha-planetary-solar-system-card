import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GalleryController } from "../../../src/card/gallery/gallery-controller.js";
import { urlCache } from "../../../src/card/gallery/url-cache.js";

// Every fetch path preloads a candidate off-DOM via `new Image()` before ever assigning it,
// so a real network call and a real Image decode both need stubbing (same pattern as
// card.test.ts's stubImagePreload).
function stubImagePreload(...results: boolean[]) {
  let calls = 0;
  vi.stubGlobal(
    "Image",
    class {
      src = "";
      decode() {
        const succeeds = results.length ? results[Math.min(calls, results.length - 1)] : true;
        calls++;
        return succeeds ? Promise.resolve() : Promise.reject(new Error("decode failed"));
      }
    }
  );
}

function stubFetch(identifier = "20260810234950") {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ identifier }]),
    })
  );
}

beforeEach(() => {
  stubFetch();
  stubImagePreload();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  urlCache.clear();
});

describe("GalleryController defaults", () => {
  it("starts closed with no panel and no known images", () => {
    const gallery = new GalleryController(() => {});
    expect(gallery.isOpen).toBe(false);
    expect(gallery.panelMode).toBe("none");
    expect(gallery.mode).toBe("none");
    expect(gallery.images).toEqual({});
  });
});

describe("GalleryController remount", () => {
  // Regression: a fresh GalleryController (e.g. HA rebuilding the card element) used to
  // start with no known URL, so the URL-identity gate always missed on its first tick and
  // forced a redundant preload/decode of bytes each source's own cache already held.
  it("hydrates known images from each source's cache instead of starting empty", async () => {
    const first = new GalleryController(() => {});
    first.configure("both", 60000);
    first.start();
    await vi.waitFor(() => expect(first.images.earth).toBeDefined());
    await vi.waitFor(() => expect(first.images.sun).toBeDefined());

    const remounted = new GalleryController(() => {});
    expect(remounted.images.earth?.url).toBe(first.images.earth?.url);
    expect(remounted.images.sun?.url).toBe(first.images.sun?.url);

    remounted.configure("both", 60000);
    remounted.start();
    await Promise.resolve();
    await Promise.resolve();

    // Nothing was known to have changed, so the URL-identity gate should skip the preload
    // for both sources entirely rather than re-attempting it.
    expect(remounted.debugStats["earth-url"].fetches).toBe(0);
    expect(remounted.debugStats["earth-img"].fetches).toBe(0);
    expect(remounted.debugStats.sun.fetches).toBe(0);
  });
});

describe("GalleryController.configure", () => {
  it("opens when mode is not none, closes when it is", () => {
    const gallery = new GalleryController(() => {});
    gallery.configure("both", 60000);
    expect(gallery.isOpen).toBe(true);
    gallery.configure("none", 60000);
    expect(gallery.isOpen).toBe(false);
  });

  it("displaySources reflects the configured mode", () => {
    const gallery = new GalleryController(() => {});
    gallery.configure("earth", 60000);
    expect(gallery.displaySources).toEqual(["earth"]);
    gallery.configure("both", 60000);
    expect(gallery.displaySources).toEqual(["earth", "sun"]);
  });
});

describe("GalleryController.start / tick", () => {
  it("fetches every source the mode needs when started open", async () => {
    const gallery = new GalleryController(() => {});
    gallery.configure("both", 60000);
    gallery.start();
    await vi.waitFor(() => expect(gallery.images.earth).toBeDefined());
    expect(gallery.images.sun).toBeDefined();
  });

  it("does not fetch when started closed", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
    vi.stubGlobal("fetch", fetchMock);
    const gallery = new GalleryController(() => {});
    gallery.configure("none", 60000);
    gallery.start();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tick refreshes only while open", async () => {
    const gallery = new GalleryController(() => {});
    gallery.configure("earth", 60000);
    gallery.tick();
    await vi.waitFor(() => expect(gallery.images.earth).toBeDefined());
  });

  it("tick is a no-op while closed", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
    vi.stubGlobal("fetch", fetchMock);
    const gallery = new GalleryController(() => {});
    gallery.configure("none", 60000);
    gallery.tick();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("GalleryController.toggle", () => {
  it("opening clears any error and triggers a refresh", async () => {
    const gallery = new GalleryController(() => {});
    gallery.configure("earth", 60000);
    gallery.toggle(); // configure() opens by default; close first
    expect(gallery.isOpen).toBe(false);
    gallery.toggle(); // reopen
    expect(gallery.isOpen).toBe(true);
    await vi.waitFor(() => expect(gallery.images.earth).toBeDefined());
  });

  it("closing closes any open panel", () => {
    const gallery = new GalleryController(() => {});
    gallery.configure("earth", 60000);
    gallery.toggle(); // closes
    expect(gallery.isOpen).toBe(false);
    expect(gallery.panelMode).toBe("none");
  });
});

describe("GalleryController.openPanel / closePanel", () => {
  it("shows instantly when the source is already known", async () => {
    const gallery = new GalleryController(() => {});
    gallery.configure("earth", 60000);
    gallery.start();
    await vi.waitFor(() => expect(gallery.images.earth).toBeDefined());

    gallery.openPanel("earth");
    expect(gallery.panelMode).toBe("earth");
    expect(gallery.imageLoaded).toBe(true);
    expect(gallery.imageUrl).toBe(gallery.images.earth?.url);
  });

  it("fetches when the source isn't known yet", async () => {
    const gallery = new GalleryController(() => {});
    gallery.configure("earth", 60000); // open, but start() not called — nothing fetched yet
    gallery.openPanel("earth");
    expect(gallery.panelMode).toBe("earth");
    expect(gallery.imageLoaded).toBe(false);
    await vi.waitFor(() => expect(gallery.imageLoaded).toBe(true));
  });

  it("closePanel resets panel state", () => {
    const gallery = new GalleryController(() => {});
    gallery.configure("earth", 60000);
    gallery.openPanel("earth");
    gallery.closePanel();
    expect(gallery.panelMode).toBe("none");
    expect(gallery.imageUrl).toBeNull();
    expect(gallery.imageDate).toBeNull();
  });
});

describe("GalleryController image event handlers", () => {
  it("onImageLoad marks the current image loaded", () => {
    const gallery = new GalleryController(() => {});
    gallery.onImageLoad();
    expect(gallery.imageLoaded).toBe(true);
  });

  it("onImageLoadError surfaces the error banner and closes the panel", () => {
    const gallery = new GalleryController(() => {});
    gallery.configure("earth", 60000);
    gallery.openPanel("earth");
    gallery.onImageLoadError();
    expect(gallery.panelMode).toBe("none");
    expect(gallery.error).toContain("unavailable");
  });

  it("onImageLoadError is a no-op when no panel is open", () => {
    const gallery = new GalleryController(() => {});
    gallery.onImageLoadError();
    expect(gallery.error).toBeNull();
  });

  it("onSunThumbError drops the sun thumbnail", async () => {
    const gallery = new GalleryController(() => {});
    gallery.configure("sun", 60000);
    gallery.start();
    await vi.waitFor(() => expect(gallery.images.sun).toBeDefined());
    gallery.onSunThumbError();
    expect(gallery.images.sun).toBeUndefined();
  });
});

describe("GalleryController failed fetch", () => {
  it("surfaces the error banner when the open panel's source fails to resolve", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const gallery = new GalleryController(() => {});
    gallery.configure("earth", 60000);
    gallery.openPanel("earth");
    await vi.waitFor(() => expect(gallery.panelMode).toBe("none"));
    expect(gallery.error).toContain("unavailable");
  });
});

describe("GalleryController slide auto-switch", () => {
  it("flips the displayed source on each interval while mode is slide", async () => {
    vi.useFakeTimers();
    const gallery = new GalleryController(() => {});
    gallery.configure("slide", 1000);
    gallery.start();
    expect(gallery.displaySources).toEqual(["earth"]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(gallery.displaySources).toEqual(["sun"]);
  });

  it("stop() clears the auto-switch interval", async () => {
    vi.useFakeTimers();
    const gallery = new GalleryController(() => {});
    gallery.configure("slide", 1000);
    gallery.start();
    gallery.stop();
    const before = gallery.displaySources;
    await vi.advanceTimersByTimeAsync(5000);
    expect(gallery.displaySources).toEqual(before);
  });

  it("reconfiguring away from slide stops future auto-switches", async () => {
    vi.useFakeTimers();
    const gallery = new GalleryController(() => {});
    gallery.configure("slide", 1000);
    gallery.start();
    gallery.configure("earth", 1000);
    const before = gallery.displaySources;
    await vi.advanceTimersByTimeAsync(5000);
    expect(gallery.displaySources).toEqual(before);
  });

  it("switching onto a source never re-resolves its URL from cache/network", async () => {
    vi.useFakeTimers();
    const gallery = new GalleryController(() => {});
    gallery.configure("slide", 1000);
    gallery.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(gallery.images.sun).toBeDefined();
    const cacheHitsAfterFetch = gallery.debugStats.sun.cacheHits;

    // The slide timer flips displaySources purely as a local state change — it never touches
    // the resolver, so cacheHits stays exactly where refresh() left it.
    await vi.advanceTimersByTimeAsync(1000);
    expect(gallery.displaySources).toEqual(["sun"]);
    expect(gallery.debugStats.sun.cacheHits).toBe(cacheHitsAfterFetch);
  });
});

describe("GalleryController.viewModel", () => {
  it("reflects the error state", () => {
    const gallery = new GalleryController(() => {});
    gallery.configure("earth", 60000);
    gallery.openPanel("earth");
    (gallery as unknown as { _error: string | null })._error = "Earth image unavailable";
    expect(gallery.viewModel().error).toBe("Earth image unavailable");
  });

  it("reflects no panel open, strip closed", () => {
    const gallery = new GalleryController(() => {});
    gallery.configure("earth", 60000);
    gallery.toggle(); // configure() opens by default; close it
    const vm = gallery.viewModel();
    expect(vm.error).toBeNull();
    expect(vm.panelSource).toBe("none");
    expect(vm.navButtonVisible).toBe(true);
  });

  it("reflects an open strip with no panel", () => {
    const gallery = new GalleryController(() => {});
    gallery.configure("both", 60000);
    const vm = gallery.viewModel();
    expect(vm.showStrip).toBe(true);
    expect(vm.panelSource).toBe("none");
    expect(vm.thumbnails.map((t) => t.source)).toEqual(["earth", "sun"]);
  });

  it("reflects an open panel with image data, and hides the strip", async () => {
    const gallery = new GalleryController(() => {});
    gallery.configure("both", 60000);
    gallery.openPanel("earth");
    await vi.waitFor(() => expect(gallery.imageLoaded).toBe(true));
    const vm = gallery.viewModel();
    expect(vm.panelSource).toBe("earth");
    expect(vm.imageUrl).toBe(gallery.imageUrl);
    expect(vm.imageDate).toBe(gallery.imageDate);
    expect(vm.imageLoaded).toBe(true);
    expect(vm.showStrip).toBe(false);
  });

  it("thumbnails carry url/date from images for sources not yet fetched", () => {
    const gallery = new GalleryController(() => {});
    gallery.configure("sun", 60000);
    const vm = gallery.viewModel();
    expect(vm.thumbnails).toEqual([{ source: "sun", url: null, date: null }]);
  });

  it("navButtonVisible is false when gallery mode is none", () => {
    const gallery = new GalleryController(() => {});
    gallery.configure("none", 60000);
    expect(gallery.viewModel().navButtonVisible).toBe(false);
  });
});

describe("GalleryController.debugStats", () => {
  const zeroStats = {
    refreshes: 0,
    cacheHits: 0,
    fetches: 0,
    failures: 0,
    retries: 0,
    expired: 0,
    elapsed: null,
    lastAttemptAt: null,
  };

  it("starts at zero for both sources", () => {
    const gallery = new GalleryController(() => {});
    expect(gallery.debugStats).toEqual({
      sun: zeroStats,
      "earth-url": zeroStats,
      "earth-img": zeroStats,
    });
  });

  it("gates the image preload on URL identity, skipping it once the URL is unchanged", async () => {
    const gallery = new GalleryController(() => {});
    gallery.configure("both", 60000);
    gallery.start();
    await vi.waitFor(() => expect(gallery.images.earth).toBeDefined());

    gallery.tick();
    // Second tick's URL is unchanged for both sources, so cacheHits is the one signal
    // guaranteed to still move once the second refresh() has fully settled — unlike
    // `fetches` (which no longer climbs on a same-URL tick — see below) or `refreshes`
    // (which increments synchronously before the awaited work even starts).
    await vi.waitFor(() => expect(gallery.debugStats["earth-url"].cacheHits).toBe(1));

    // Earth's EPIC API lookup (url row) and image preload (img row) are counted separately.
    // The second tick's EPIC lookup hits url-cache.ts's own TTL cache (no real fetch, so it
    // isn't counted), and its preload is gated out since the URL is unchanged — so each row
    // only ever sees 1 real fetch across both ticks. Sun (no metadata API, just the preload)
    // is gated to 1 fetch across both ticks too.
    expect(gallery.debugStats["earth-url"].fetches).toBe(1);
    expect(gallery.debugStats["earth-img"].fetches).toBe(1);
    expect(gallery.debugStats["earth-url"].refreshes).toBe(2);
    // img's own refreshes only counts ticks that actually needed a real preload — the first
    // tick's brand-new URL, not the second tick's gated (unchanged-URL) one.
    expect(gallery.debugStats["earth-img"].refreshes).toBe(1);
    expect(gallery.debugStats.sun.refreshes).toBe(2);
    expect(gallery.debugStats.sun.fetches).toBe(1);
    expect(gallery.debugStats["earth-url"].elapsed).not.toBeNull();
    expect(gallery.debugStats["earth-img"].elapsed).not.toBeNull();
    expect(gallery.debugStats["earth-img"].lastAttemptAt).not.toBeNull();

    // First tick found nothing cached (0 cache hits); the second tick's cache is still fresh
    // for both sources (checked before any fetch is attempted), so it's the direct signal
    // that TTL gating is actually working — unlike `fetches`, this can't be zero by luck.
    expect(gallery.debugStats["earth-url"].cacheHits).toBe(1);
    expect(gallery.debugStats.sun.cacheHits).toBe(1);
  });

  it("skips a source still mid-fetch instead of stacking a second overlapping request", async () => {
    let resolveFetch!: (value: { ok: true; json: () => Promise<unknown> }) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
      )
    );
    const gallery = new GalleryController(() => {});
    gallery.configure("earth", 60000);
    gallery.start();
    await vi.waitFor(() => expect(gallery.debugStats["earth-url"].refreshes).toBe(1));

    // First fetch is still in flight (unresolved) — a second tick must not start another.
    gallery.tick();
    await Promise.resolve();
    expect(gallery.debugStats["earth-url"].refreshes).toBe(1);

    resolveFetch({ ok: true, json: () => Promise.resolve([{ identifier: "20260810234950" }]) });
    await vi.waitFor(() => expect(gallery.images.earth).toBeDefined());

    // Now that it settled, a subsequent tick is free to fetch again.
    gallery.tick();
    await vi.waitFor(() => expect(gallery.debugStats["earth-url"].refreshes).toBe(2));
  });

  it("counts a failed image preload as a fetch distinct from the EPIC API call", async () => {
    stubImagePreload(false);
    const gallery = new GalleryController(() => {});
    gallery.configure("earth", 60000);
    gallery.start();
    await vi.waitFor(() => expect(gallery.debugStats["earth-img"].failures).toBe(1));

    // Each phase is its own row now: 1 fetch on the url row (EPIC API lookup, succeeded),
    // 1 fetch on the img row (image preload, failed) — and the img row's own refreshes
    // still moved, since a new URL genuinely needed a preload attempt regardless of outcome.
    expect(gallery.debugStats["earth-url"].fetches).toBe(1);
    expect(gallery.debugStats["earth-url"].failures).toBe(0);
    expect(gallery.debugStats["earth-url"].elapsed).not.toBeNull();
    expect(gallery.debugStats["earth-img"].fetches).toBe(1);
    expect(gallery.debugStats["earth-img"].refreshes).toBe(1);
  });

  it("counts a retry when sun's primary slot guess fails and falls back", async () => {
    stubImagePreload(false, true);
    const gallery = new GalleryController(() => {});
    gallery.configure("sun", 60000);
    gallery.start();
    await vi.waitFor(() => expect(gallery.debugStats.sun.retries).toBe(1));

    expect(gallery.debugStats.sun.fetches).toBe(2);
    expect(gallery.debugStats.sun.failures).toBe(1);
  });

  it("does not count sources outside the configured mode", async () => {
    const gallery = new GalleryController(() => {});
    gallery.configure("earth", 60000);
    gallery.start();
    await vi.waitFor(() => expect(gallery.debugStats["earth-url"].refreshes).toBe(1));
    expect(gallery.debugStats.sun.refreshes).toBe(0);
  });
});
