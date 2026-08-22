import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_GALLERY_SOURCES,
  GalleryController,
} from "../../../src/card/gallery/gallery-controller.js";
import { EARTH_CACHE_TTL_MS } from "../../../src/card/gallery/source-resolver-dscovr-earth.js";
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

// Fails the first decode whose URL matches, and only that one — the four sources resolve
// concurrently, so "the first decode overall" is no longer a way to name one of them.
function failFirstDecodeFor(urlFragment: string) {
  let failed = false;
  vi.stubGlobal(
    "Image",
    class {
      src = "";
      decode() {
        if (!failed && this.src.includes(urlFragment)) {
          failed = true;
          return Promise.reject(new Error("decode failed"));
        }
        return Promise.resolve();
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
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    expect(gallery.isOpen).toBe(false);
    expect(gallery.panelMode).toBe("none");
    expect(gallery.mode).toBe("off");
    expect(gallery.images).toEqual({});
  });
});

describe("GalleryController remount", () => {
  // Regression: a fresh GalleryController (e.g. HA rebuilding the card element) used to
  // start with no known URL, so the URL-identity gate always missed on its first tick and
  // forced a redundant preload/decode of bytes each source's own cache already held.
  it("hydrates known images from each source's cache instead of starting empty", async () => {
    const first = new GalleryController(
      () => {},
      () => "UTC"
    );
    first.configure("open", DEFAULT_GALLERY_SOURCES, 60000);
    first.start();
    await vi.waitFor(() => expect(first.images.earth).toBeDefined());
    await vi.waitFor(() => expect(first.images.sun).toBeDefined());

    const remounted = new GalleryController(
      () => {},
      () => "UTC"
    );
    expect(remounted.images.earth?.url).toBe(first.images.earth?.url);
    expect(remounted.images.sun?.url).toBe(first.images.sun?.url);

    remounted.configure("open", DEFAULT_GALLERY_SOURCES, 60000);
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
  it("opens for open/slide, stays collapsed for off", () => {
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("open", DEFAULT_GALLERY_SOURCES, 60000);
    expect(gallery.isOpen).toBe(true);
    gallery.configure("off", DEFAULT_GALLERY_SOURCES, 60000);
    expect(gallery.isOpen).toBe(false);
    gallery.configure("slide", DEFAULT_GALLERY_SOURCES, 60000);
    expect(gallery.isOpen).toBe(true);
  });

  // The strip is fixed now: sky Moon, object Moon, Earth, Sun, in that order. `gallery.sources`
  // is gone, so there is no configuration that can change this.
  it("displaySources is the whole strip, in render order", () => {
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("open", DEFAULT_GALLERY_SOURCES, 60000);
    expect(gallery.displaySources).toEqual(["mymoon", "moon", "earth", "sun"]);
  });
});

describe("GalleryController moon sources", () => {
  it("fetches both moon tiles alongside earth and sun", async () => {
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("open", DEFAULT_GALLERY_SOURCES, 60000);
    gallery.start();
    await vi.waitFor(() => expect(gallery.images.moon).toBeDefined());
    await vi.waitFor(() => expect(gallery.images.mymoon).toBeDefined());
    expect(gallery.images.moon?.url).toContain("svs.gsfc.nasa.gov");
  });

  // Same NASA product, different instants — the object tile follows the current hour, the sky
  // tile pins to 22:00 local — so each holds its own cache entry rather than sharing one.
  it("gives each moon tile its own image entry", async () => {
    const gallery = new GalleryController(
      () => {},
      () => "America/Chicago"
    );
    gallery.configure("open", DEFAULT_GALLERY_SOURCES, 60000);
    gallery.start();
    await vi.waitFor(() => expect(gallery.images.moon).toBeDefined());
    await vi.waitFor(() => expect(gallery.images.mymoon).toBeDefined());
    expect(gallery.images.mymoon?.date).not.toEqual(gallery.images.moon?.date);
  });

  it("carries url and date onto both moon thumbnails once resolved", async () => {
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("open", DEFAULT_GALLERY_SOURCES, 60000);
    gallery.start();
    await vi.waitFor(() => expect(gallery.images.moon).toBeDefined());
    const tiles = gallery.viewModel().thumbnails;
    for (const source of ["moon", "mymoon"]) {
      const tile = tiles.find((t) => t.source === source);
      expect(tile?.url).toBeTruthy();
      expect(tile?.date).toBeInstanceOf(Date);
    }
  });
});

describe("GalleryController.start / tick", () => {
  it("fetches every source the mode needs when started open", async () => {
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("open", DEFAULT_GALLERY_SOURCES, 60000);
    gallery.start();
    await vi.waitFor(() => expect(gallery.images.earth).toBeDefined());
    expect(gallery.images.sun).toBeDefined();
  });

  it("does not fetch when started closed", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
    vi.stubGlobal("fetch", fetchMock);
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("off", DEFAULT_GALLERY_SOURCES, 60000);
    gallery.start();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tick refreshes only while open", async () => {
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("open", DEFAULT_GALLERY_SOURCES, 60000);
    gallery.tick();
    await vi.waitFor(() => expect(gallery.images.earth).toBeDefined());
  });

  it("tick is a no-op while closed", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
    vi.stubGlobal("fetch", fetchMock);
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("off", DEFAULT_GALLERY_SOURCES, 60000);
    gallery.tick();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("GalleryController.toggle", () => {
  it("opening clears any error and triggers a refresh", async () => {
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("open", DEFAULT_GALLERY_SOURCES, 60000);
    gallery.toggle(); // configure() opens by default; close first
    expect(gallery.isOpen).toBe(false);
    gallery.toggle(); // reopen
    expect(gallery.isOpen).toBe(true);
    await vi.waitFor(() => expect(gallery.images.earth).toBeDefined());
  });

  it("closing closes any open panel", () => {
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("open", DEFAULT_GALLERY_SOURCES, 60000);
    gallery.toggle(); // closes
    expect(gallery.isOpen).toBe(false);
    expect(gallery.panelMode).toBe("none");
  });
});

describe("GalleryController.openPanel / closePanel", () => {
  it("shows instantly when the source is already known", async () => {
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("open", DEFAULT_GALLERY_SOURCES, 60000);
    gallery.start();
    await vi.waitFor(() => expect(gallery.images.earth).toBeDefined());

    gallery.openPanel("earth");
    expect(gallery.panelMode).toBe("earth");
    expect(gallery.imageLoaded).toBe(true);
    expect(gallery.imageUrl).toBe(gallery.images.earth?.url);
  });

  it("fetches when the source isn't known yet", async () => {
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("open", DEFAULT_GALLERY_SOURCES, 60000); // open, but start() not called — nothing fetched yet
    gallery.openPanel("earth");
    expect(gallery.panelMode).toBe("earth");
    expect(gallery.imageLoaded).toBe(false);
    await vi.waitFor(() => expect(gallery.imageLoaded).toBe(true));
  });

  it("closePanel resets panel state", () => {
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("open", DEFAULT_GALLERY_SOURCES, 60000);
    gallery.openPanel("earth");
    gallery.closePanel();
    expect(gallery.panelMode).toBe("none");
    expect(gallery.imageUrl).toBeNull();
    expect(gallery.imageDate).toBeNull();
  });
});

describe("GalleryController image event handlers", () => {
  it("onImageLoad marks the current image loaded", () => {
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.onImageLoad();
    expect(gallery.imageLoaded).toBe(true);
  });

  it("onImageLoadError surfaces the error banner and closes the panel", () => {
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("open", DEFAULT_GALLERY_SOURCES, 60000);
    gallery.openPanel("earth");
    gallery.onImageLoadError();
    expect(gallery.panelMode).toBe("none");
    expect(gallery.error).toContain("unavailable");
  });

  it("onImageLoadError is a no-op when no panel is open", () => {
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.onImageLoadError();
    expect(gallery.error).toBeNull();
  });

  it("onSunThumbError drops the sun thumbnail", async () => {
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("open", DEFAULT_GALLERY_SOURCES, 60000);
    gallery.start();
    await vi.waitFor(() => expect(gallery.images.sun).toBeDefined());
    gallery.onSunThumbError();
    expect(gallery.images.sun).toBeUndefined();
  });
});

describe("GalleryController failed fetch", () => {
  it("surfaces the error banner when the open panel's source fails to resolve", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("open", DEFAULT_GALLERY_SOURCES, 60000);
    gallery.openPanel("earth");
    await vi.waitFor(() => expect(gallery.panelMode).toBe("none"));
    expect(gallery.error).toContain("unavailable");
  });
});

describe("GalleryController slide auto-switch", () => {
  it("flips the displayed source on each interval while mode is slide", async () => {
    vi.useFakeTimers();
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("slide", DEFAULT_GALLERY_SOURCES, 1000);
    gallery.start();
    expect(gallery.displaySources).toEqual(["mymoon"]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(gallery.displaySources).toEqual(["moon"]);
  });

  it("rotates through the whole strip and wraps", async () => {
    vi.useFakeTimers();
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("slide", DEFAULT_GALLERY_SOURCES, 1000);
    gallery.start();
    const seen = [gallery.displaySources[0]];
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(1000);
      seen.push(gallery.displaySources[0]);
    }
    expect(seen).toEqual(["mymoon", "moon", "earth", "sun", "mymoon"]);
  });

  // Reconfiguring to a shorter list while the rotation sits past its new end would leave
  // displaySources reading undefined until the next tick happened to wrap it.
  it("reconfiguring a shorter list cannot leave the slide index out of bounds", async () => {
    vi.useFakeTimers();
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("slide", DEFAULT_GALLERY_SOURCES, 1000);
    gallery.start();
    await vi.advanceTimersByTimeAsync(2000);
    expect(gallery.displaySources).toEqual(["earth"]);

    gallery.configure("slide", ["moon"], 1000);
    expect(gallery.displaySources).toEqual(["moon"]);
  });

  it("stop() clears the auto-switch interval", async () => {
    vi.useFakeTimers();
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("slide", DEFAULT_GALLERY_SOURCES, 1000);
    gallery.start();
    gallery.stop();
    const before = gallery.displaySources;
    await vi.advanceTimersByTimeAsync(5000);
    expect(gallery.displaySources).toEqual(before);
  });

  it("reconfiguring away from slide stops future auto-switches", async () => {
    vi.useFakeTimers();
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("slide", DEFAULT_GALLERY_SOURCES, 1000);
    gallery.start();
    gallery.configure("open", DEFAULT_GALLERY_SOURCES, 1000);
    const before = gallery.displaySources;
    await vi.advanceTimersByTimeAsync(5000);
    expect(gallery.displaySources).toEqual(before);
  });

  it("switching onto a source never re-resolves its URL from cache/network", async () => {
    vi.useFakeTimers();
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("slide", DEFAULT_GALLERY_SOURCES, 1000);
    gallery.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(gallery.images.sun).toBeDefined();
    const cacheHitsAfterFetch = gallery.debugStats.sun.cacheHits;

    // The slide timer flips displaySources purely as a local state change — it never touches
    // the resolver, so cacheHits stays exactly where refresh() left it.
    const before = gallery.displaySources;
    await vi.advanceTimersByTimeAsync(1000);
    expect(gallery.displaySources).not.toEqual(before);
    expect(gallery.debugStats.sun.cacheHits).toBe(cacheHitsAfterFetch);
  });
});

describe("GalleryController.viewModel", () => {
  it("reflects the error state", () => {
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("open", DEFAULT_GALLERY_SOURCES, 60000);
    gallery.openPanel("earth");
    (gallery as unknown as { _error: string | null })._error = "Earth image unavailable";
    expect(gallery.viewModel().error).toBe("Earth image unavailable");
  });

  it("reflects no panel open, strip closed", () => {
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("open", DEFAULT_GALLERY_SOURCES, 60000);
    gallery.toggle(); // configure() opens by default; close it
    const vm = gallery.viewModel();
    expect(vm.error).toBeNull();
    expect(vm.panelSource).toBe("none");
  });

  it("reflects an open strip with no panel", () => {
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("open", DEFAULT_GALLERY_SOURCES, 60000);
    const vm = gallery.viewModel();
    expect(vm.showStrip).toBe(true);
    expect(vm.panelSource).toBe("none");
    expect(vm.thumbnails.map((t) => t.source)).toEqual(["mymoon", "moon", "earth", "sun"]);
  });

  it("reflects an open panel with image data, and hides the strip", async () => {
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("open", DEFAULT_GALLERY_SOURCES, 60000);
    gallery.openPanel("earth");
    await vi.waitFor(() => expect(gallery.imageLoaded).toBe(true));
    const vm = gallery.viewModel();
    expect(vm.panelSource).toBe("earth");
    expect(vm.imageUrl).toBe(gallery.imageUrl);
    expect(vm.imageDate).toBe(gallery.imageDate);
    expect(vm.imageLoaded).toBe(true);
    expect(vm.showStrip).toBe(false);
  });

  it("thumbnails carry null url/date for sources not yet fetched", () => {
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("open", DEFAULT_GALLERY_SOURCES, 60000);
    expect(gallery.viewModel().thumbnails).toEqual([
      { source: "mymoon", url: null, date: null },
      { source: "moon", url: null, date: null },
      { source: "earth", url: null, date: null },
      { source: "sun", url: null, date: null },
    ]);
  });

  it("hides the strip while collapsed but still reports its thumbnails", () => {
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("off", DEFAULT_GALLERY_SOURCES, 60000);
    const vm = gallery.viewModel();
    expect(vm.showStrip).toBe(false);
    expect(vm.thumbnails.map((t) => t.source)).toEqual(["mymoon", "moon", "earth", "sun"]);
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

  it("starts at zero for every source", () => {
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    expect(gallery.debugStats).toEqual({
      moon: zeroStats,
      mymoon: zeroStats,
      sun: zeroStats,
      "earth-url": zeroStats,
      "earth-img": zeroStats,
    });
  });

  it("skips a source entirely on the next tick while its own cache is still current", async () => {
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("open", DEFAULT_GALLERY_SOURCES, 60000);
    gallery.start();
    await vi.waitFor(() => expect(gallery.images.earth).toBeDefined());

    const afterFirstTick = gallery.debugStats;
    expect(afterFirstTick["earth-url"].fetches).toBe(1);
    expect(afterFirstTick["earth-img"].fetches).toBe(1);
    expect(afterFirstTick.sun.fetches).toBe(1);

    gallery.tick();
    await Promise.resolve();
    await Promise.resolve();

    // Both sources are still within their own TTL/publish window and already confirmed to
    // decode, so resolveAll() never even calls resolve() for them this tick — every counter
    // is untouched, not just the network-facing ones. This is the whole point of isFresh():
    // a tick with nothing new to do should leave no trace, not just skip the real fetch.
    expect(gallery.debugStats).toEqual(afterFirstTick);
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
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("open", DEFAULT_GALLERY_SOURCES, 60000);
    gallery.start();
    await vi.waitFor(() => expect(gallery.debugStats["earth-url"].refreshes).toBe(1));

    // First fetch is still in flight (unresolved) — a second tick must not start another.
    gallery.tick();
    await Promise.resolve();
    expect(gallery.debugStats["earth-url"].refreshes).toBe(1);

    resolveFetch({ ok: true, json: () => Promise.resolve([{ identifier: "20260810234950" }]) });
    await vi.waitFor(() => expect(gallery.images.earth).toBeDefined());

    // Now that it settled, earth is confirmed and within its own 1-hour TTL — isFresh() skips
    // it, same as any other still-current source, regardless of the in-flight guard clearing.
    gallery.tick();
    await Promise.resolve();
    expect(gallery.debugStats["earth-url"].refreshes).toBe(1);

    // Only once its TTL has actually elapsed does a tick attempt it again.
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + EARTH_CACHE_TTL_MS + 1);
    gallery.tick();
    await vi.waitFor(() => expect(gallery.debugStats["earth-url"].refreshes).toBe(2));
  });

  it("counts a failed image preload as a fetch distinct from the EPIC API call", async () => {
    stubImagePreload(false);
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("open", DEFAULT_GALLERY_SOURCES, 60000);
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
    // One probe: the search starts one slot back and that frame loads, so there is no gap
    // left to narrow and nothing further to ask.
    failFirstDecodeFor("sdo.gsfc.nasa.gov");
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("open", DEFAULT_GALLERY_SOURCES, 60000);
    gallery.start();
    await vi.waitFor(() => expect(gallery.debugStats.sun.retries).toBe(1));

    expect(gallery.debugStats.sun.fetches).toBe(2);
    expect(gallery.debugStats.sun.failures).toBe(1);
  });

  // Every source is fetched now, including while "slide" shows one at a time — rotating onto
  // a tile must never be the moment its image starts loading.
  it("counts a refresh for every source, even the ones slide mode is not showing", async () => {
    const gallery = new GalleryController(
      () => {},
      () => "UTC"
    );
    gallery.configure("slide", DEFAULT_GALLERY_SOURCES, 60000);
    gallery.start();
    await vi.waitFor(() => expect(gallery.debugStats["earth-url"].refreshes).toBe(1));
    expect(gallery.debugStats.sun.refreshes).toBe(1);
    expect(gallery.debugStats.moon.refreshes).toBe(1);
    expect(gallery.debugStats.mymoon.refreshes).toBe(1);
  });
});
