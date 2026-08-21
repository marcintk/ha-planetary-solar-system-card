import { afterEach, describe, expect, it, vi } from "vitest";
import { EPIC_BASE_URL } from "../../src/card/gallery/source-resolver-dscovr-earth.js";
import { getSunImageUrl } from "../../src/card/gallery/source-resolver-sdo-sun.js";
import { UrlCache } from "../../src/card/gallery/url-cache.js";
import { clickButton, createAndMount, setupCardTest, stubImagePreload } from "./helpers.js";

// Fails the first decode whose URL matches, and only that one. The strip resolves four
// sources concurrently now, so a positional stub can no longer name one of them.
function hangDecodeFor(urlFragment) {
  vi.stubGlobal(
    "Image",
    class {
      src = "";
      decode() {
        // Never settles — simulates a hung image load, but only for the source under test.
        return this.src.includes(urlFragment) ? new Promise(() => {}) : Promise.resolve();
      }
    }
  );
}

function failFirstDecodeFor(urlFragment) {
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

setupCardTest();

// The image gallery: strip, panel, source resolution, retries, and its own auto-switch timer.
describe("SolarViewCard gallery", () => {
  describe("gallery", () => {
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

    // gallery.mode: "both" by default in this suite — mode-specific behavior is covered
    // separately below, everything else here tests the gallery feature itself. Any mode
    // other than "none" auto-opens the strip on connect, so most tests here don't need to
    // click the gallery button to open it — only to close/reopen it.
    // Not the shared createAndMount: every test here needs the gallery switched on.
    function mountWithGallery(config) {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ gallery: { mode: "both" }, ...config });
      document.body.appendChild(card);
      return card;
    }

    function stubEarthFetch(identifier = "20260810234950") {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ identifier }]),
      });
      vi.stubGlobal("fetch", fetchMock);
      return fetchMock;
    }

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    });

    // Moon costs no network and cannot fail, so the button is always offered — the default
    // "closed" mode keeps the strip itself out of the way until the user asks for it.
    it("gallery button shows by default with the strip collapsed (no config)", () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      document.body.appendChild(card);
      expect(card.shadowRoot.querySelector('button[data-action="gallery"]')).toBeTruthy();
      expect(card.shadowRoot.querySelector(".gallery")).toBeNull();
      card.remove();
    });

    it("opening the default gallery shows the whole strip", async () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      document.body.appendChild(card);
      clickButton(card, "gallery");
      await flush();

      const tiles = [...card.shadowRoot.querySelectorAll(".gallery > *")];
      expect(tiles.map((t) => t.getAttribute("data-source"))).toEqual([
        "mymoon",
        "moon",
        "earth",
        "sun",
      ]);
      card.remove();
    });

    // The drawn disc is a diagram, not a photograph — opt-in by name, and debug: true has
    // nothing to do with it now that it is a source like any other.
    it("shows the drawn moon disc only when listed in sources", async () => {
      const card = createAndMount({ gallery: { mode: "open" }, debug: true });
      expect(card.shadowRoot.querySelector("svg.moon-phase-disc")).toBeNull();
      card.remove();

      const listed = createAndMount({ gallery: { mode: "open", sources: ["drawnmoon"] } });
      const drawn = listed.shadowRoot.querySelector('[data-source="drawnmoon"]');
      expect(drawn).toBeTruthy();
      expect(drawn.querySelector("svg.moon-phase-disc")).toBeTruthy();
      listed.remove();
    });

    // Position is the user's, not ours: sources[0] renders leftmost whatever it is.
    it("renders tiles in the order sources lists them", () => {
      const card = createAndMount({
        gallery: { mode: "open", sources: ["sun", "drawnmoon", "mymoon"] },
      });
      const order = [...card.shadowRoot.querySelectorAll(".gallery > *")].map((t) =>
        t.getAttribute("data-source")
      );
      expect(order).toEqual(["sun", "drawnmoon", "mymoon"]);
      card.remove();
    });

    it("gives the drawn tile a tooltip", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-25T18:00:00Z")); // Full Moon
      const card = createAndMount({ gallery: { mode: "open", sources: ["drawnmoon"] } });
      expect(card.shadowRoot.querySelector('[data-source="drawnmoon"]').getAttribute("title")).toBe(
        "Tonight's Moon — Full Moon, 100% illuminated"
      );
      card.remove();
      vi.useRealTimers();
    });

    // Every NASA tile opens full-screen, including both moons — they are fetched images now,
    // so the pointer affordance promises something a click can actually deliver.
    it("makes every strip tile a button", () => {
      const card = createAndMount({ gallery: { mode: "open" } });
      const tiles = [...card.shadowRoot.querySelectorAll(".gallery > *")];
      expect(tiles.map((t) => t.tagName)).toEqual(["BUTTON", "BUTTON", "BUTTON", "BUTTON"]);
      // Order matters: the drawn debug plate leads the strip when it is present.
      card.remove();
    });

    // The sky tile is the only one that can say the body it shows is not in view. That is not
    // a failure and not a dark Moon — the frame still shows a normally lit one — it means the
    // Earth is in the way from here, which is true on roughly half of all nights at every
    // latitude. Denton on 8 Sep 2026: the Moon is 35 degrees below the horizon at 22:00 local.
    // Note the caption describes the *reference hour*, not the moment the card is rendered.
    it("says so when the Moon is below the horizon at the reference hour", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-08T20:00:00Z")); // 15:00 CDT the same local day
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({
        gallery: { mode: "open" },
        location: { latitude: 33.2148, longitude: -97.1331, timezone: "America/Chicago" },
      });
      document.body.appendChild(card);
      card._render();
      expect(card.shadowRoot.querySelector('[data-source="mymoon"] .gallery-age').textContent).toBe(
        "below horizon"
      );
      card.remove();
      vi.useRealTimers();
    });

    // Same location, a reference hour the Moon is actually up for: the caption goes back to
    // pointing at 22:00 instead.
    it("counts towards the reference hour when the Moon will be up", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-22T01:00:00Z")); // 20:00 CDT, Moon up at 22:00
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({
        gallery: { mode: "open" },
        location: { latitude: 33.2148, longitude: -97.1331, timezone: "America/Chicago" },
      });
      document.body.appendChild(card);
      card._render();
      expect(card.shadowRoot.querySelector('[data-source="mymoon"] .gallery-age').textContent).toBe(
        "in 2h"
      );
      card.remove();
      vi.useRealTimers();
    });

    // Every fetched tile is cropped to the body itself, so the frame's black surround drops
    // out and the card shows through. Only the sky tile also rotates — that rotation is what
    // makes it the observer's view rather than NASA's, so the two moons must not match.
    it("crops every fetched tile to the disc, and rotates only the sky one", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-22T01:00:00Z"));
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({
        gallery: { mode: "open", shape: "circle" },
        location: { latitude: 33.2148, longitude: -97.1331, timezone: "America/Chicago" },
      });
      document.body.appendChild(card);
      card._render();
      const styleOf = (source) =>
        card.shadowRoot.querySelector(`[data-source="${source}"] img`).getAttribute("style");
      for (const source of ["mymoon", "moon", "earth", "sun"]) {
        expect(styleOf(source)).toMatch(/^clip-path: circle\(\d+(\.\d+)?%\); transform: /);
      }
      expect(styleOf("mymoon")).toMatch(/rotate\(-?\d+(\.\d+)?deg\) scale\(/);
      expect(styleOf("moon")).toMatch(/transform: scale\(/);
      expect(styleOf("moon")).not.toContain("rotate");
      card.remove();
      vi.useRealTimers();
    });

    // Thumbnails are 216 px; the full-screen view is the same frame at 730. Swapping the size
    // segment keeps the panel on the exact frame the tile showed.
    it("opens the moon full-screen at the larger resolution", async () => {
      const card = createAndMount({ gallery: { mode: "open" } });
      await flush();
      card.shadowRoot.querySelector('[data-source="moon"]').click();
      await flush();
      const src = card.shadowRoot.querySelector("#image-view").getAttribute("src");
      expect(src).toContain("730x730_1x1_30p");
      expect(src).not.toContain("216x216");
      card.remove();
    });

    // Opening the sky tile must not snap back to the geocentric frame.
    it("carries the sky rotation into the full-screen view", async () => {
      const card = createAndMount({
        gallery: { mode: "open" },
        location: { latitude: 33.2148, longitude: -97.1331, timezone: "America/Chicago" },
      });
      await flush();
      card.shadowRoot.querySelector('[data-source="mymoon"]').click();
      await flush();
      expect(card.shadowRoot.querySelector("#image-view").getAttribute("style")).toMatch(
        /transform: rotate\(-?\d+(\.\d+)?deg\)/
      );
      card.remove();
    });

    // gallery.shape flips the whole strip between the cropped body and the published frame.
    it("shows the published frame when gallery.shape is square", () => {
      const card = createAndMount({ gallery: { mode: "open", shape: "square" } });
      const styleOf = (source) =>
        card.shadowRoot.querySelector(`[data-source="${source}"] img`).getAttribute("style");
      for (const source of ["moon", "earth", "sun"]) {
        expect(styleOf(source)).toBeNull();
      }
      card.remove();
    });

    // The sky tile's own frame cannot survive rotation, so in square mode the tile supplies the
    // black square instead and the image is clipped to a circle inside it. Net effect: it is
    // framed exactly like its neighbours, with a rotated body inside.
    it("boxes the sky tile in square mode so it matches its neighbours", () => {
      const card = createAndMount({
        gallery: { mode: "open", shape: "square" },
        location: { latitude: 33.2148, longitude: -97.1331, timezone: "America/Chicago" },
      });
      const classOf = (source) =>
        card.shadowRoot.querySelector(`[data-source="${source}"]`).className;
      expect(classOf("mymoon")).toContain("gallery-thumb-boxed");
      expect(classOf("moon")).not.toContain("gallery-thumb-boxed");
      card.remove();
    });

    // Circle mode needs no backdrop: every tile is cropped to its body, so there is no square
    // for the sky tile to match.
    it("does not box the sky tile in circle mode", () => {
      const card = createAndMount({
        gallery: { mode: "open", shape: "circle" },
        location: { latitude: 33.2148, longitude: -97.1331, timezone: "America/Chicago" },
      });
      expect(card.shadowRoot.querySelector('[data-source="mymoon"]').className).not.toContain(
        "gallery-thumb-boxed"
      );
      card.remove();
    });

    it("keeps the sky tile's image clipped even in square mode", () => {
      const card = createAndMount({
        gallery: { mode: "open", shape: "square" },
        location: { latitude: 33.2148, longitude: -97.1331, timezone: "America/Chicago" },
      });
      const style = card.shadowRoot
        .querySelector('[data-source="mymoon"] img')
        .getAttribute("style");
      expect(style).toContain("clip-path: circle(50%)");
      expect(style).toMatch(/rotate\(-?\d+(\.\d+)?deg\)/);
      expect(style).not.toContain("scale");
      card.remove();
    });

    it("labels the two moon tiles apart", () => {
      const card = createAndMount({ gallery: { mode: "open" } });
      const labelOf = (source) =>
        card.shadowRoot.querySelector(`[data-source="${source}"] .gallery-label`).textContent;
      expect(labelOf("moon")).toBe("MOON");
      expect(labelOf("mymoon")).toBe("MY SKY");
      card.remove();
    });

    // The caption is what makes the tiles read as one strip. Comparing the shapes rather
    // than eyeballing each one means a future divergence fails here instead of shipping.
    // Order is load-bearing now: the caption is a centred column, so the label span is the
    // line above the body and the age span the line below it.
    it("gives every tile the same caption structure", () => {
      const card = createAndMount({
        gallery: {
          mode: "open",
          sources: ["drawnmoon", "mymoon", "moon", "earth", "sun"],
        },
      });
      const shapes = [...card.shadowRoot.querySelectorAll(".gallery-info")].map((info) =>
        [...info.children].map((el) => `${el.tagName}.${el.className}`)
      );
      expect(shapes).toHaveLength(5);
      expect(new Set(shapes.map((s) => s.join(","))).size).toBe(1);
      expect(shapes[0]).toEqual(["SPAN.gallery-label", "SPAN.gallery-age"]);
      card.remove();
    });

    it("gallery button shows and strip is open by default when gallery.mode: both", () => {
      const card = mountWithGallery();
      expect(card.shadowRoot.querySelector('button[data-action="gallery"]')).toBeTruthy();
      expect(card.shadowRoot.querySelector(".gallery")).toBeTruthy();
      card.remove();
    });

    it("shows all four thumbnails as soon as the card connects", async () => {
      stubEarthFetch();
      const card = mountWithGallery();
      await flush();
      const thumbs = [...card.shadowRoot.querySelectorAll(".gallery-thumb")];
      expect(thumbs.map((t) => t.dataset.source)).toEqual(["mymoon", "moon", "earth", "sun"]);
      const labels = thumbs.map((t) => t.querySelector(".gallery-label").textContent);
      expect(labels).toEqual(["MY SKY", "MOON", "DSCOVR/E", "SDO/S"]);

      // Each candidate is preloaded off-DOM before it's ever assigned to the thumbnail, so
      // by the time the fetch/preload chain settles the age is already known — no separate
      // on-<img> "load" event needed. The sky tile is the one that can point forwards, at
      // 22:00 local, or say the Moon is not up at all.
      for (const thumb of thumbs) {
        const age = thumb.querySelector(".gallery-age").textContent;
        expect(age).toMatch(/^(in \d+[mh]|\d+[mh] ago|just now|below horizon)$/);
      }
      card.remove();
    });

    it("a sun thumbnail preload failure retries with a doubled publish buffer", async () => {
      failFirstDecodeFor("sdo.gsfc.nasa.gov");
      const card = mountWithGallery();
      await flush();

      // Retried once, on an earlier slot — thumbnail shows the fallback.
      const sunImg = card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"] img');
      expect(sunImg.getAttribute("src")).not.toBe("");
      // The primary guess uses the 30-min buffer floor; the first retry doubles it to 60,
      // which is two 15-min slots earlier. Recompute against a scratch cache so this reads
      // the primary slot instead of the retried one the card just cached into the shared
      // default.
      const primarySlot = getSunImageUrl(new UrlCache()).date.getTime();
      expect(card._gallery.images.sun.date.getTime()).toBe(primarySlot - 30 * 60000);
      card.remove();
    });

    it("drops the sun thumbnail if both the candidate and its retry fail to preload", async () => {
      stubImagePreload(false, false);
      const card = mountWithGallery();
      await flush();

      const sunImg = card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"] img');
      expect(sunImg.getAttribute("src")).toBeNull();
      expect(
        card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"] .gallery-age').textContent
      ).toBe("loading…");
      card.remove();
    });

    it("fetches all thumbnails as soon as the card connects", async () => {
      const fetchMock = stubEarthFetch();
      const card = mountWithGallery();
      await flush();
      expect(fetchMock).toHaveBeenCalled();
      const thumbs = card.shadowRoot.querySelectorAll(".gallery-thumb img");
      for (const img of thumbs) {
        expect(img.src).not.toBe("");
      }
      card.remove();
    });

    it("clicking the gallery button closes the strip; clicking again reopens it", async () => {
      const card = mountWithGallery();
      await flush();
      expect(card.shadowRoot.querySelector(".gallery")).toBeTruthy();
      clickButton(card, "gallery");
      await flush();
      expect(card.shadowRoot.querySelector(".gallery")).toBeNull();
      clickButton(card, "gallery");
      await flush();
      expect(card.shadowRoot.querySelector(".gallery")).toBeTruthy();
      card.remove();
    });

    it("clicking a thumbnail shows the full image and hides the strip and solar view", async () => {
      const card = mountWithGallery();
      await flush();
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
      await flush();
      expect(card._gallery.panelMode).toBe("sun");
      expect(card.shadowRoot.querySelector(".status-bar").textContent).toContain("SUN · SDO HMI");
      const img = card.shadowRoot.querySelector("#image-view");
      expect(img.classList.contains("visible")).toBe(true);
      expect(card.shadowRoot.querySelector(".gallery")).toBeNull();
      expect(card.shadowRoot.querySelector("#solar-view").classList.contains("hidden")).toBe(true);
      card.remove();
    });

    it("full-screen status bar shows the already-loaded image instantly — no fetch, no loading step", async () => {
      const card = mountWithGallery();
      await flush(); // background fetch already resolved and cached the sun thumbnail
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
      // Pure view switch, synchronous — no async gap at all.
      expect(card.shadowRoot.querySelector(".status-bar").textContent).toContain("captured");
      expect(card.shadowRoot.querySelector(".status-bar").textContent).not.toContain("loading…");
      card.remove();
    });

    it("full-screen status bar shows 'loading…' if opened before the background fetch has landed", () => {
      const card = mountWithGallery();
      // Click immediately — the mount's own background fetch is still in flight.
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
      expect(card.shadowRoot.querySelector(".status-bar").textContent).toContain("loading…");
      card.remove();
    });

    it("opens on the retried slot when the primary sun candidate fails to preload", async () => {
      failFirstDecodeFor("sdo.gsfc.nasa.gov");
      const card = mountWithGallery();
      // The background fetch retries once and lands before the click — clicking then just
      // displays what it already resolved.
      await flush();
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();

      expect(card._gallery.panelMode).toBe("sun");
      const primarySlot = getSunImageUrl(new UrlCache()).date.getTime();
      expect(card._gallery.imageDate.getTime()).toBe(primarySlot - 30 * 60000);
      card.remove();
    });

    it("falls back to the unavailable banner when both the sun candidate and its retry fail to preload", async () => {
      stubImagePreload(false, false);
      const card = mountWithGallery();
      // The background fetch fails outright, so the sun thumbnail never populates —
      // clicking it falls into the "not known yet" path, which retries and fails again.
      await flush();
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
      await flush();

      expect(card._gallery.panelMode).toBe("none");
      expect(card.shadowRoot.querySelector(".status-bar").textContent).toContain(
        "SDO HMI Continuum image unavailable"
      );
      card.remove();
    });

    it("a background refresh does not replace the shown image if the new candidate fails to preload", async () => {
      stubImagePreload(true);
      vi.useFakeTimers();
      const card = mountWithGallery({ refresh_mins: 1 });
      await vi.advanceTimersByTimeAsync(0);
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
      await vi.advanceTimersByTimeAsync(0);
      const firstSrc = card.shadowRoot.querySelector("#image-view").src;

      // Cross the 15-min slot boundary so the next refresh computes a genuinely different
      // candidate URL, then make the preload probe fail for it.
      stubImagePreload(false);
      await vi.advanceTimersByTimeAsync(16 * 60000);

      expect(card.shadowRoot.querySelector("#image-view").src).toBe(firstSrc);
      expect(card._gallery.panelMode).toBe("sun");
      expect(card._gallery.error).toBeNull();
      card.remove();
      vi.useRealTimers();
    });

    it("a background refresh replaces the shown image once the new candidate is confirmed to preload", async () => {
      stubImagePreload(true);
      vi.useFakeTimers();
      const card = mountWithGallery({ refresh_mins: 1 });
      await vi.advanceTimersByTimeAsync(0);
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
      await vi.advanceTimersByTimeAsync(0);
      const firstSrc = card.shadowRoot.querySelector("#image-view").src;

      await vi.advanceTimersByTimeAsync(16 * 60000);

      expect(card.shadowRoot.querySelector("#image-view").src).not.toBe(firstSrc);
      expect(card._gallery.panelMode).toBe("sun");
      card.remove();
      vi.useRealTimers();
    });

    it("an image load error while no panel is open is a no-op", async () => {
      const card = mountWithGallery();
      await flush();
      card.shadowRoot.querySelector("#image-view").dispatchEvent(new Event("error"));
      await flush();
      expect(card._gallery.panelMode).toBe("none");
      expect(card._gallery.error).toBeNull();
      card.remove();
    });

    // ImageResolver.resolve() already confirmed this exact URL loads once, but the real <img>
    // still fires its own load/error events once mounted in the DOM — an unrelated later
    // failure (e.g. the browser's cache evicting the entry) has no retry left to fall back
    // on, unlike the preload-time retry covered elsewhere.
    it("an unexpected error on the already-resolved full image shows the unavailable banner", async () => {
      const card = mountWithGallery();
      await flush();
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
      await flush();
      expect(card._gallery.panelMode).toBe("sun");

      card.shadowRoot.querySelector("#image-view").dispatchEvent(new Event("error"));
      await flush();
      expect(card._gallery.panelMode).toBe("none");
      expect(card.shadowRoot.querySelector(".status-bar").textContent).toContain(
        "SDO HMI Continuum image unavailable"
      );
      card.remove();
    });

    it("the full image's own load event is harmless once already preloaded", async () => {
      const card = mountWithGallery();
      await flush();
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
      await flush();

      card.shadowRoot.querySelector("#image-view").dispatchEvent(new Event("load"));
      await flush();
      expect(card.shadowRoot.querySelector(".status-bar").textContent).toContain("captured");
      card.remove();
    });

    it("an unexpected error on an already-resolved sun thumbnail drops it", async () => {
      const card = mountWithGallery();
      await flush();

      const sunImg = card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"] img');
      sunImg.dispatchEvent(new Event("error"));
      await flush();
      expect(
        card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"] img').getAttribute("src")
      ).toBeNull();
      card.remove();
    });

    it("switching to earth while the sun preload is still resolving discards the stale sun result", async () => {
      const card = mountWithGallery();
      await flush();
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
      // Don't await — switch away before the sun candidate's preload settles.
      card.shadowRoot.querySelector("#image-view").click(); // back to gallery ("none")
      await flush();

      expect(card._gallery.panelMode).toBe("none");
      card.remove();
    });

    it("an earth candidate that fails to preload shows the unavailable banner with no retry", async () => {
      stubEarthFetch();
      stubImagePreload(false);
      const card = mountWithGallery();
      await flush();
      card.shadowRoot.querySelector('.gallery-thumb[data-source="earth"]').click();
      await flush();

      expect(card._gallery.panelMode).toBe("none");
      expect(card.shadowRoot.querySelector(".status-bar").textContent).toContain(
        "DSCOVR Earth image unavailable"
      );
      card.remove();
    });

    it("clicking the full image restores the solar view and the strip reappears", async () => {
      const card = mountWithGallery();
      await flush();
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
      await flush();
      card.shadowRoot.querySelector("#image-view").click();
      await flush();
      expect(card._gallery.panelMode).toBe("none");
      expect(card.shadowRoot.querySelector(".gallery")).toBeTruthy();
      card.remove();
    });

    it("clicking the gallery button while a full image is shown closes both", async () => {
      const card = mountWithGallery();
      await flush();
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
      await flush();
      clickButton(card, "gallery");
      await flush();
      expect(card._gallery.panelMode).toBe("none");
      expect(card.shadowRoot.querySelector(".gallery")).toBeNull();
      card.remove();
    });

    it("clicking a sun thumbnail again reuses the already-loaded image within the 15-min cache", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-12T12:00:00Z"));
      const card = mountWithGallery();
      await vi.advanceTimersByTimeAsync(0);

      const clickSun = () =>
        card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();

      clickSun();
      await vi.advanceTimersByTimeAsync(0);
      const firstSrc = card.shadowRoot.querySelector("#image-view").src;

      card.shadowRoot.querySelector("#image-view").click(); // back to gallery
      await vi.advanceTimersByTimeAsync(0);
      vi.setSystemTime(new Date("2026-08-12T12:00:30Z")); // 30s later, well within the 15-min cache
      clickSun();
      await vi.advanceTimersByTimeAsync(0);
      const secondSrc = card.shadowRoot.querySelector("#image-view").src;

      // A click is a pure view switch — it never fetches on its own, just shows whatever
      // the background timer already resolved, so re-opening shows the same image.
      expect(secondSrc).toBe(firstSrc);
      card.remove();
    });

    it("auto-update ticks refresh the open full image every 15 minutes while it stays open", async () => {
      stubImagePreload(true);
      vi.useFakeTimers();
      const card = mountWithGallery({ refresh_mins: 16 });
      await vi.advanceTimersByTimeAsync(0);
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
      await vi.advanceTimersByTimeAsync(0);
      const firstSrc = card.shadowRoot.querySelector("#image-view").src;

      // A single tick timed just past the 15-min TTL.
      await vi.advanceTimersByTimeAsync(16 * 60000);
      const secondSrc = card.shadowRoot.querySelector("#image-view").src;

      expect(secondSrc).not.toBe(firstSrc);
      card.remove();
      vi.useRealTimers();
    });

    it("auto-update ticks also refresh the open earth full image hourly", async () => {
      vi.useFakeTimers();
      const fetchMock = stubEarthFetch();
      const card = mountWithGallery({ refresh_mins: 61 });
      await vi.advanceTimersByTimeAsync(0);
      card.shadowRoot.querySelector('.gallery-thumb[data-source="earth"]').click();
      await vi.advanceTimersByTimeAsync(0);
      const callsAfterOpen = fetchMock.mock.calls.length;

      await vi.advanceTimersByTimeAsync(61 * 60000);
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterOpen);

      card.remove();
      vi.useRealTimers();
    });

    it("does not refresh the open full image before the 15-minute TTL elapses", async () => {
      vi.useFakeTimers();
      // Pinned to the start of a sun slot's publish-buffer window (slot 00:00 plus the
      // 30-min buffer floor) so a 10-min advance stays safely inside the 15-min hold
      // regardless of real wall-clock time at test run.
      vi.setSystemTime(Date.UTC(2026, 0, 1, 0, 30, 0));
      const card = mountWithGallery({ refresh_mins: 10 });
      await vi.advanceTimersByTimeAsync(0);
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
      await vi.advanceTimersByTimeAsync(0);
      const firstSrc = card.shadowRoot.querySelector("#image-view").src;

      await vi.advanceTimersByTimeAsync(10 * 60000); // one tick, still within the 15-min TTL
      const secondSrc = card.shadowRoot.querySelector("#image-view").src;

      expect(secondSrc).toBe(firstSrc);
      card.remove();
      vi.useRealTimers();
    });

    it("clicking the earth thumbnail fetches the latest EPIC image and shows it", async () => {
      stubEarthFetch();
      const card = mountWithGallery();
      await flush();
      card.shadowRoot.querySelector('.gallery-thumb[data-source="earth"]').click();
      await flush();
      const img = card.shadowRoot.querySelector("#image-view");
      expect(img.classList.contains("visible")).toBe(true);
      expect(img.src).toBe(
        `${EPIC_BASE_URL}/archive/natural/2026/08/10/jpg/epic_1b_20260810234950.jpg`
      );
      expect(card.shadowRoot.querySelector(".status-bar").textContent).toContain("EARTH · DSCOVR");
      card.remove();
    });

    it("falls back to the solar view with a visible error when the earth image fetch fails", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
      const card = mountWithGallery();
      await flush();
      card.shadowRoot.querySelector('.gallery-thumb[data-source="earth"]').click();
      await flush();
      const img = card.shadowRoot.querySelector("#image-view");
      expect(img.classList.contains("visible")).toBe(false);
      expect(card._gallery.panelMode).toBe("none");
      expect(card.shadowRoot.querySelector(".status-bar").textContent).toContain(
        "DSCOVR Earth image unavailable"
      );
      card.remove();
    });

    it("clears the error banner when the gallery is reopened", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
      const card = mountWithGallery();
      card.hass = { config: { latitude: 41.8781, longitude: -87.6298 } };
      await flush();
      card.shadowRoot.querySelector('.gallery-thumb[data-source="earth"]').click();
      await flush();
      expect(card.shadowRoot.querySelector(".status-bar").textContent).toContain("unavailable");
      clickButton(card, "gallery"); // close
      clickButton(card, "gallery"); // reopen
      expect(card.shadowRoot.querySelector(".status-bar").textContent).not.toContain("unavailable");
      card.remove();
    });

    it("falls back to the solar view with a visible error when the earth image response is empty", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })
      );
      const card = mountWithGallery();
      await flush();
      card.shadowRoot.querySelector('.gallery-thumb[data-source="earth"]').click();
      await flush();
      const img = card.shadowRoot.querySelector("#image-view");
      expect(img.classList.contains("visible")).toBe(false);
      expect(card._gallery.panelMode).toBe("none");
      expect(card.shadowRoot.querySelector(".status-bar").textContent).toContain(
        "DSCOVR Earth image unavailable"
      );
      card.remove();
    });

    it("falls back to the solar view with a visible error when the earth image load hangs past the timeout", async () => {
      vi.useFakeTimers();
      stubEarthFetch();
      // Hangs earth's preload only. The strip fetches every source now, so hanging all of
      // them would also stall sun through its whole buffer ladder worth of 15s waits before
      // the shared Promise.allSettled settles — unrelated to what this test is checking.
      hangDecodeFor("epic.gsfc.nasa.gov");
      const card = mountWithGallery();
      await vi.advanceTimersByTimeAsync(0);
      card.shadowRoot.querySelector('.gallery-thumb[data-source="earth"]').click();
      await vi.advanceTimersByTimeAsync(15000); // FETCH_TIMEOUT_MS in source-resolver.ts
      const img = card.shadowRoot.querySelector("#image-view");
      expect(img.classList.contains("visible")).toBe(false);
      expect(card._gallery.panelMode).toBe("none");
      expect(card.shadowRoot.querySelector(".status-bar").textContent).toContain(
        "DSCOVR Earth image unavailable"
      );
      card.remove();
      vi.useRealTimers();
    });

    it("falls back to the unavailable banner when the sun image load hangs on the primary attempt and all retries", async () => {
      vi.useFakeTimers();
      vi.stubGlobal(
        "Image",
        class {
          src = "";
          decode() {
            return new Promise(() => {}); // never settles on any attempt
          }
        }
      );
      const card = mountWithGallery({ gallery: { mode: "sun" } });
      await vi.advanceTimersByTimeAsync(0);
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
      // Primary attempt times out, then every widened buffer (60/120/240) also hangs and
      // times out — 4 sequential 15s bounds before the banner surfaces.
      await vi.advanceTimersByTimeAsync(60000);
      const img = card.shadowRoot.querySelector("#image-view");
      expect(img.classList.contains("visible")).toBe(false);
      expect(card._gallery.panelMode).toBe("none");
      expect(card.shadowRoot.querySelector(".status-bar").textContent).toContain(
        "SDO HMI Continuum image unavailable"
      );
      card.remove();
      vi.useRealTimers();
    });

    it("auto-update ticks refresh gallery thumbnails while the gallery stays open", async () => {
      vi.useFakeTimers();
      const fetchMock = stubEarthFetch();
      // A single tick timed just past the 1-hour cache TTL, rather than 1-min ticks
      // advanced 61x over — many overlapping fetch/render cycles under fake timers
      // leave dangling promises that can resolve after the test tears down.
      const card = mountWithGallery({ refresh_mins: 61 });
      await vi.advanceTimersByTimeAsync(0);
      const callsAfterOpen = fetchMock.mock.calls.length;

      await vi.advanceTimersByTimeAsync(61 * 60000);
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterOpen);

      card.remove();
      vi.useRealTimers();
    });

    it("auto-update ticks do not fetch gallery thumbnails once the gallery is manually closed", async () => {
      vi.useFakeTimers();
      const fetchMock = stubEarthFetch();
      const card = mountWithGallery({ refresh_mins: 1 });
      await vi.advanceTimersByTimeAsync(0);
      fetchMock.mockClear();
      clickButton(card, "gallery"); // close
      await vi.advanceTimersByTimeAsync(6 * 60000);
      expect(fetchMock).not.toHaveBeenCalled();

      card.remove();
      vi.useRealTimers();
    });

    it("skips a failed source's thumbnail but still populates the others", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
      const card = mountWithGallery();
      await flush();
      const sunThumb = card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"] img');
      const earthThumb = card.shadowRoot.querySelector('.gallery-thumb[data-source="earth"] img');
      expect(sunThumb.getAttribute("src")).not.toBe("");
      expect(earthThumb.getAttribute("src")).toBeNull(); // earth fetch failed, thumbnail stays empty
      card.remove();
    });

    // The legacy source-picking modes still open the strip, they just no longer prune it —
    // an unmigrated dashboard gains the tiles it never asked for rather than breaking.
    it.each(["earth", "sun", "both"])(
      "legacy gallery.mode: %s opens the whole strip",
      async (mode) => {
        const card = mountWithGallery({ gallery: { mode } });
        await flush();
        const thumbs = card.shadowRoot.querySelectorAll(".gallery-thumb");
        expect([...thumbs].map((t) => t.dataset.source)).toEqual([
          "mymoon",
          "moon",
          "earth",
          "sun",
        ]);
        card.remove();
      }
    );

    it("gallery strip refreshes the sun thumbnail every 15 minutes, not 1 hour", async () => {
      vi.useFakeTimers();
      const card = mountWithGallery({ gallery: { mode: "sun" }, refresh_mins: 16 });
      await vi.advanceTimersByTimeAsync(0);
      const firstSrc = card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"] img').src;

      await vi.advanceTimersByTimeAsync(16 * 60000);
      const secondSrc = card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"] img').src;

      expect(secondSrc).not.toBe(firstSrc);
      card.remove();
      vi.useRealTimers();
    });

    it("gallery.mode: slide shows one thumbnail, fetches both sources, and flips on its own interval", async () => {
      vi.useFakeTimers();
      const fetchMock = stubEarthFetch();
      const card = mountWithGallery({ gallery: { mode: "slide", slide_interval_secs: 120 } });
      await vi.advanceTimersByTimeAsync(0);

      expect(fetchMock).toHaveBeenCalled(); // both sources fetched in the background
      let thumbs = card.shadowRoot.querySelectorAll(".gallery-thumb");
      expect(thumbs.length).toBe(1);
      expect(thumbs[0].dataset.source).toBe("mymoon");

      await vi.advanceTimersByTimeAsync(120 * 1000);
      thumbs = card.shadowRoot.querySelectorAll(".gallery-thumb");
      expect(thumbs.length).toBe(1);
      expect(thumbs[0].dataset.source).toBe("moon");

      card.remove();
      vi.useRealTimers();
    });

    it("reconfiguring the slide interval while slide mode stays active restarts the timer", async () => {
      vi.useFakeTimers();
      const card = mountWithGallery({ gallery: { mode: "slide", slide_interval_secs: 120 } });
      await vi.advanceTimersByTimeAsync(0);

      card.setConfig({ gallery: { mode: "slide", slide_interval_secs: 180 } });
      await vi.advanceTimersByTimeAsync(120 * 1000); // past the old interval, before the new one
      expect(card.shadowRoot.querySelector(".gallery-thumb").dataset.source).toBe("mymoon");

      await vi.advanceTimersByTimeAsync(60000); // now past the new 3-min interval
      expect(card.shadowRoot.querySelector(".gallery-thumb").dataset.source).toBe("moon");

      await vi.advanceTimersByTimeAsync(180 * 1000); // flips again
      expect(card.shadowRoot.querySelector(".gallery-thumb").dataset.source).toBe("earth");

      card.remove();
      vi.useRealTimers();
    });

    // Legacy "none" maps to "off": the strip stays shut, so the background
    // refresh has nothing to fetch — the whole point of leaving it collapsed by default.
    it("a collapsed gallery never fetches, however long it ticks", async () => {
      vi.useFakeTimers();
      const fetchMock = stubEarthFetch();
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({ gallery: { mode: "none" }, refresh_mins: 1 });
      document.body.appendChild(card);
      await vi.advanceTimersByTimeAsync(6 * 60000);
      expect(card.shadowRoot.querySelector(".gallery")).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
      card.remove();
      vi.useRealTimers();
    });
  });
});
