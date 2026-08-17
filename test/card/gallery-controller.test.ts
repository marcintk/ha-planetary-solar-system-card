import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GalleryController } from "../../src/card/gallery-controller.js";
import { imageCache } from "../../src/card/image-cache.js";

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
  imageCache.clear();
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
  // forced a redundant preload/decode of bytes image-sources.ts's own cache already held.
  it("hydrates known images from image-sources.ts's cache instead of starting empty", async () => {
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
    expect(remounted.debugStats.earth.attempts).toBe(0);
    expect(remounted.debugStats.sun.attempts).toBe(0);
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
    expect(vm.navButtonActive).toBe(false);
  });

  it("reflects an open strip with no panel", () => {
    const gallery = new GalleryController(() => {});
    gallery.configure("both", 60000);
    const vm = gallery.viewModel();
    expect(vm.showStrip).toBe(true);
    expect(vm.panelSource).toBe("none");
    expect(vm.navButtonActive).toBe(true);
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
    ticks: 0,
    cacheHits: 0,
    attempts: 0,
    network: 0,
    failures: 0,
    retries: 0,
    redundant: 0,
    elapsed: null,
    lastAttemptAt: null,
  };

  it("starts at zero for both sources", () => {
    const gallery = new GalleryController(() => {});
    expect(gallery.debugStats).toEqual({ earth: zeroStats, sun: zeroStats });
  });

  it("gates the image preload on URL identity, skipping it once the URL is unchanged", async () => {
    const gallery = new GalleryController(() => {});
    gallery.configure("both", 60000);
    gallery.start();
    await vi.waitFor(() => expect(gallery.images.earth).toBeDefined());

    gallery.tick();
    // Second tick's URL is unchanged for both sources, so it's the one signal guaranteed to
    // still move: `redundant` only increments once the second refresh() has fully settled,
    // unlike `network` (which no longer climbs on a same-URL tick — see below) or `ticks`
    // (which increments synchronously before the awaited work even starts).
    await vi.waitFor(() => expect(gallery.debugStats.earth.redundant).toBe(1));

    // Earth counts 2 network calls total: the first tick's EPIC API lookup plus its image
    // preload. The second tick's EPIC lookup hits image-sources.ts's own TTL cache (no real
    // fetch, so it isn't counted), and its preload is gated out since the URL is unchanged.
    // Sun (no metadata API, just the preload) is gated to 1 call across both ticks.
    expect(gallery.debugStats.earth.network).toBe(2);
    expect(gallery.debugStats.earth.ticks).toBe(2);
    expect(gallery.debugStats.sun.ticks).toBe(2);
    expect(gallery.debugStats.sun.network).toBe(1);
    expect(gallery.debugStats.earth.elapsed).not.toBeNull();
    expect(gallery.debugStats.sun.redundant).toBe(1);
    expect(gallery.debugStats.earth.lastAttemptAt).not.toBeNull();

    // First tick found nothing cached (0 cache hits); the second tick's cache is still fresh
    // for both sources (checked before any fetch is attempted), so it's the direct signal
    // that TTL gating is actually working — unlike `network`, this can't be zero by luck.
    expect(gallery.debugStats.earth.cacheHits).toBe(1);
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
    await vi.waitFor(() => expect(gallery.debugStats.earth.ticks).toBe(1));

    // First fetch is still in flight (unresolved) — a second tick must not start another.
    gallery.tick();
    await Promise.resolve();
    expect(gallery.debugStats.earth.ticks).toBe(1);

    resolveFetch({ ok: true, json: () => Promise.resolve([{ identifier: "20260810234950" }]) });
    await vi.waitFor(() => expect(gallery.images.earth).toBeDefined());

    // Now that it settled, a subsequent tick is free to fetch again.
    gallery.tick();
    await vi.waitFor(() => expect(gallery.debugStats.earth.ticks).toBe(2));
  });

  it("counts a failed image preload as an attempt distinct from the EPIC API call", async () => {
    stubImagePreload(false);
    const gallery = new GalleryController(() => {});
    gallery.configure("earth", 60000);
    gallery.start();
    await vi.waitFor(() => expect(gallery.debugStats.earth.failures).toBe(1));

    // 2 attempts (EPIC API lookup + image preload), only the API call succeeded.
    expect(gallery.debugStats.earth.attempts).toBe(2);
    expect(gallery.debugStats.earth.network).toBe(1);
    expect(gallery.debugStats.earth.elapsed).not.toBeNull();
  });

  it("counts a retry when sun's primary slot guess fails and falls back", async () => {
    stubImagePreload(false, true);
    const gallery = new GalleryController(() => {});
    gallery.configure("sun", 60000);
    gallery.start();
    await vi.waitFor(() => expect(gallery.debugStats.sun.retries).toBe(1));

    expect(gallery.debugStats.sun.attempts).toBe(2);
    expect(gallery.debugStats.sun.network).toBe(1);
    expect(gallery.debugStats.sun.failures).toBe(1);
  });

  it("does not count sources outside the configured mode", async () => {
    const gallery = new GalleryController(() => {});
    gallery.configure("earth", 60000);
    gallery.start();
    await vi.waitFor(() => expect(gallery.debugStats.earth.ticks).toBe(1));
    expect(gallery.debugStats.sun.ticks).toBe(0);
  });
});
