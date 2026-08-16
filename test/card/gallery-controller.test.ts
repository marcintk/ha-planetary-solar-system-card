import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GalleryController } from "../../src/card/gallery-controller.js";
import { clearImageCache } from "../../src/card/image-sources.js";

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
  clearImageCache();
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
