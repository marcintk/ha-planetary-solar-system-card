import { afterEach, describe, expect, it, vi } from "vitest";
import { EPIC_BASE_URL } from "../../src/card/gallery/source-resolver-dscovr-earth.js";
import { clickButton, createAndMount, setupCardTest } from "./helpers.js";

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
    function mountWithGallery(config = {}) {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      const { gallery, ...rest } = config;
      card.setConfig({
        gallery: { mode: "both", mymoon: true, moon: true, earth: true, sun: true, ...gallery },
        ...rest,
      });
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

    it("opening the default gallery shows only mymoon, the one tile enabled by default", async () => {
      const card = document.createElement("ha-planetary-solar-system-card-test");
      document.body.appendChild(card);
      clickButton(card, "gallery");
      await flush();

      const tiles = [...card.shadowRoot.querySelectorAll(".gallery > *")];
      expect(tiles.map((t) => t.getAttribute("data-source"))).toEqual(["mymoon"]);
      card.remove();
    });

    // Order is fixed (mymoon, moon, earth, sun) now that individual booleans replace the old
    // ordered sources list — there is no longer a list position to render tiles by.
    it("renders enabled tiles in the fixed mymoon/moon/earth/sun order regardless of config order", () => {
      const card = createAndMount({
        gallery: { mode: "open", sun: true, moon: true, mymoon: true },
      });
      const order = [...card.shadowRoot.querySelectorAll(".gallery > *")].map((t) =>
        t.getAttribute("data-source")
      );
      expect(order).toEqual(["mymoon", "moon", "sun"]);
      card.remove();
    });

    // Every NASA tile opens full-screen, including both moons — they are fetched images, so
    // the pointer affordance promises something a click can actually deliver.
    it("makes every strip tile a button", () => {
      const card = createAndMount({
        gallery: { mode: "open", mymoon: true, moon: true, earth: true, sun: true },
      });
      const tiles = [...card.shadowRoot.querySelectorAll(".gallery > *")];
      expect(tiles.map((t) => t.tagName)).toEqual(["BUTTON", "BUTTON", "BUTTON", "BUTTON"]);
      card.remove();
    });

    // The sky tile is the only one that can leave its image out entirely: below the horizon
    // there's nothing to show, rather than a Moon that isn't actually in view — but the tile
    // stays a button (still clickable, see "carries the sky rotation into the full-screen
    // view"), and its caption still reads the frame's own age like every other tile, never a
    // "below horizon" placeholder. Denton, 22 Aug 2026 05:00 CDT: the Moon is well below the
    // horizon.
    it("renders no image, but a normal age caption, when the Moon is below the horizon", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-22T10:15:00Z"));
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({
        gallery: { mode: "open" },
        location: { latitude: 33.2148, longitude: -97.1331, timezone: "America/Chicago" },
      });
      document.body.appendChild(card);
      await vi.advanceTimersByTimeAsync(0);
      expect(card.shadowRoot.querySelector('[data-source="mymoon"] img')).toBeNull();
      expect(card.shadowRoot.querySelector('[data-source="mymoon"] .gallery-age').textContent).toBe(
        "15m ago"
      );
      card.remove();
      vi.useRealTimers();
    });

    // Below the horizon there is no Moon to show, but an empty black square reads as a tile
    // that failed to load. The text says which of the two it is.
    describe("no moon in the sky", () => {
      const DOWN = "2026-08-22T10:15:00Z"; // Denton, Moon well below the horizon
      const UP = "2026-08-22T02:15:00Z"; // same place, Moon up

      function mountAt(iso) {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(iso));
        const card = document.createElement("ha-planetary-solar-system-card-test");
        card.setConfig({
          gallery: { mode: "open" },
          location: { latitude: 33.2148, longitude: -97.1331, timezone: "America/Chicago" },
        });
        document.body.appendChild(card);
        return card;
      }

      it("names the empty sky in the tile instead of leaving it blank", async () => {
        const card = mountAt(DOWN);
        await vi.advanceTimersByTimeAsync(0);
        const tile = card.shadowRoot.querySelector('[data-source="mymoon"]');
        expect(tile.querySelector("img")).toBeNull();
        expect(tile.querySelector(".no-sky").textContent.trim()).toBe("No MoonSky");
        card.remove();
        vi.useRealTimers();
      });

      // The caption is the tile's own line and stays put — the message replaces the image, not
      // the label or the frame age every other tile also carries.
      it("keeps the normal caption underneath it", async () => {
        const card = mountAt(DOWN);
        await vi.advanceTimersByTimeAsync(0);
        const tile = card.shadowRoot.querySelector('[data-source="mymoon"]');
        expect(tile.querySelector(".gallery-label").textContent).toBe("MY MOON");
        expect(tile.getAttribute("title")).toBe("Moon from your sky · NASA SVS render");
        expect(tile.querySelector(".gallery-age").textContent).toBe("15m ago");
        card.remove();
        vi.useRealTimers();
      });

      it("says the same thing full-screen, rather than the geocentric render", async () => {
        const card = mountAt(DOWN);
        await vi.advanceTimersByTimeAsync(0);
        card.shadowRoot.querySelector('[data-source="mymoon"]').click();
        await vi.advanceTimersByTimeAsync(0);

        expect(card.shadowRoot.querySelector("#image-view")).toBeNull();
        expect(card.shadowRoot.querySelector(".image-view-frame .no-sky").textContent.trim()).toBe(
          "No MoonSky"
        );
        card.remove();
        vi.useRealTimers();
      });

      // The image it replaces was the way back out of the panel, so the message has to be too.
      it("closes the panel when the message is clicked", async () => {
        const card = mountAt(DOWN);
        await vi.advanceTimersByTimeAsync(0);
        card.shadowRoot.querySelector('[data-source="mymoon"]').click();
        await vi.advanceTimersByTimeAsync(0);
        expect(card._gallery.panelMode).toBe("mymoon");

        card.shadowRoot.querySelector(".image-view-frame .no-sky").click();
        await vi.advanceTimersByTimeAsync(0);
        expect(card._gallery.panelMode).toBe("none");
        card.remove();
        vi.useRealTimers();
      });

      it("shows the Moon, and no message, once it is up", async () => {
        const card = mountAt(UP);
        await vi.advanceTimersByTimeAsync(0);
        const tile = card.shadowRoot.querySelector('[data-source="mymoon"]');
        expect(tile.querySelector("img")).not.toBeNull();
        expect(tile.querySelector(".no-sky")).toBeNull();

        tile.click();
        await vi.advanceTimersByTimeAsync(0);
        expect(card.shadowRoot.querySelector("#image-view")).not.toBeNull();
        expect(card.shadowRoot.querySelector(".no-sky")).toBeNull();
        card.remove();
        vi.useRealTimers();
      });

      // Every other source is a photograph of a body that is always there to photograph.
      it("never appears on a source that is not the observer's own sky", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(DOWN));
        const card = document.createElement("ha-planetary-solar-system-card-test");
        card.setConfig({
          gallery: { mode: "open", moon: true, earth: true, sun: true },
          location: { latitude: 33.2148, longitude: -97.1331, timezone: "America/Chicago" },
        });
        document.body.appendChild(card);
        await vi.advanceTimersByTimeAsync(0);
        for (const source of ["moon", "earth", "sun"]) {
          expect(card.shadowRoot.querySelector(`[data-source="${source}"] .no-sky`)).toBeNull();
        }
        card.remove();
        vi.useRealTimers();
      });
    });

    // Same location, an instant the Moon is actually up for: the caption falls back to the
    // normal frame-age phrasing, same as every other tile — it needs the resolved image date,
    // so unlike the below-horizon case this waits for the background fetch to land.
    it("shows the normal age caption when the Moon is up", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-22T02:15:00Z"));
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({
        gallery: { mode: "open" },
        location: { latitude: 33.2148, longitude: -97.1331, timezone: "America/Chicago" },
      });
      document.body.appendChild(card);
      await vi.advanceTimersByTimeAsync(0);
      expect(card.shadowRoot.querySelector('[data-source="mymoon"] .gallery-age').textContent).toBe(
        "15m ago"
      );
      card.remove();
      vi.useRealTimers();
    });

    // The sky tile's day/twilight/night color washes over the Moon photo itself (a
    // .gallery-thumb-tint layer), not the tile behind it — solid colors, not the visibility
    // cone's translucent tints, since a wash needs to actually show up against the photo.
    it("tints the sky tile's photo by the observer's own day/night, not the Moon's", () => {
      vi.useFakeTimers();
      const config = {
        gallery: { mode: "open" },
        location: { latitude: 33.2148, longitude: -97.1331, timezone: "America/Chicago" },
      };
      const tintOf = (card) =>
        card.shadowRoot
          .querySelector('[data-source="mymoon"] .gallery-thumb-tint')
          ?.getAttribute("style");

      vi.setSystemTime(new Date("2026-08-22T22:00:00Z")); // 17:00 CDT: Sun up, Moon just risen
      const dayCard = document.createElement("ha-planetary-solar-system-card-test");
      dayCard.setConfig(config);
      document.body.appendChild(dayCard);
      expect(tintOf(dayCard)).toContain("background: #d0d0d0");
      dayCard.remove();

      vi.setSystemTime(new Date("2026-08-22T03:00:00Z")); // 22:00 CDT: deep night, Moon still up
      const nightCard = document.createElement("ha-planetary-solar-system-card-test");
      nightCard.setConfig(config);
      document.body.appendChild(nightCard);
      expect(tintOf(nightCard)).toContain("background: #06050a");
      nightCard.remove();
      vi.useRealTimers();
    });

    // gallery.mymoon_tint defaults to false (beta flag) — the altitude-extinction layer stays
    // off unless a user opts in, so the sky-elevation wash is the only tint layer by default.
    it("omits the altitude extinction tint layer by default", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-22T03:00:00Z")); // 22:00 CDT: Moon up at this site
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({
        gallery: { mode: "open" },
        location: { latitude: 33.2148, longitude: -97.1331, timezone: "America/Chicago" },
      });
      document.body.appendChild(card);
      const tints = card.shadowRoot.querySelectorAll('[data-source="mymoon"] .gallery-thumb-tint');
      expect(tints.length).toBe(1);
      card.remove();
      vi.useRealTimers();
    });

    // #178: a second, independent tint layer stacked on the sky-elevation one — the Moon's own
    // altitude (extinction), not just what the sky looks like. High altitude, low horizon
    // strength: rgba alpha should be near 0 rather than the near-full-strength it'd be low down.
    it("stacks a second tint layer for the Moon's own altitude extinction when gallery.mymoon_tint is enabled", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-22T03:00:00Z")); // 22:00 CDT: Moon up at this site
      const card = document.createElement("ha-planetary-solar-system-card-test");
      card.setConfig({
        gallery: { mode: "open", mymoon_tint: true },
        location: { latitude: 33.2148, longitude: -97.1331, timezone: "America/Chicago" },
      });
      document.body.appendChild(card);
      const tints = card.shadowRoot.querySelectorAll('[data-source="mymoon"] .gallery-thumb-tint');
      expect(tints.length).toBe(2);
      expect(tints[1].getAttribute("style")).toMatch(/background: rgba\(255, 102, 26, 0\.\d\d\)/);
      card.remove();
      vi.useRealTimers();
    });

    // No location means no observer to light the tint for, same reasoning as the unrotated
    // frame: the honest default, not a guess.
    it("falls back to a black tint with no location known", () => {
      const card = createAndMount({ gallery: { mode: "open" } });
      const style = card.shadowRoot
        .querySelector('[data-source="mymoon"] .gallery-thumb-tint')
        .getAttribute("style");
      expect(style).toContain("background: #000");
      card.remove();
    });

    // The tile itself stays plain black like every other tile — the color lives on the Moon's
    // own photo (the tint layer), not the button behind it.
    it("keeps the tile's own background plain, unlike the tint on its photo", () => {
      const card = createAndMount({
        gallery: { mode: "open" },
        location: { latitude: 33.2148, longitude: -97.1331, timezone: "America/Chicago" },
      });
      expect(card.shadowRoot.querySelector('[data-source="mymoon"]').getAttribute("style")).toBe(
        null
      );
      card.remove();
    });

    // Unlike the thumbnail, the full-screen panel never washes its backdrop by Sun elevation —
    // the corners a rotated square swings away from are a much bigger share of a full-screen
    // frame than of a 104px tile, and a colored fill across that much of the screen reads as a
    // wash over the view rather than a detail on a photo. Plain black, same as every other panel.
    it("keeps the full-screen panel's own background plain black, even for the sky tile", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-22T18:00:00Z")); // Sun well up (irrelevant to the panel)
      const card = createAndMount({
        gallery: { mode: "open" },
        location: { latitude: 33.2148, longitude: -97.1331, timezone: "America/Chicago" },
      });
      await vi.advanceTimersByTimeAsync(0);
      card.shadowRoot.querySelector('[data-source="mymoon"]').click();
      await vi.advanceTimersByTimeAsync(0);
      expect(card.shadowRoot.querySelector(".image-view-frame").getAttribute("style")).toBe(null);
      card.remove();
      vi.useRealTimers();
    });

    // gallery.mymoon_tint defaults to false — the full-screen panel gets the same gating as the
    // thumbnail, so no extinction layer appears until a user opts in.
    it("omits the full-screen panel's altitude extinction tint by default", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-22T03:00:00Z")); // 22:00 CDT: Moon up at this site
      const card = createAndMount({
        gallery: { mode: "open" },
        location: { latitude: 33.2148, longitude: -97.1331, timezone: "America/Chicago" },
      });
      await vi.advanceTimersByTimeAsync(0);
      card.shadowRoot.querySelector('[data-source="mymoon"]').click();
      await vi.advanceTimersByTimeAsync(0);
      expect(card.shadowRoot.querySelector(".image-view-tint")).toBeNull();
      card.remove();
      vi.useRealTimers();
    });

    // #178: unlike the elevation wash above, the Moon's own altitude-extinction tint does extend
    // to the full-screen panel — it's usually near-zero strength, so it doesn't carry the same
    // "wash over the whole view" risk the elevation color does.
    it("tints the full-screen panel by the Moon's own altitude extinction when gallery.mymoon_tint is enabled", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-22T03:00:00Z")); // 22:00 CDT: Moon up at this site
      const card = createAndMount({
        gallery: { mode: "open", mymoon_tint: true },
        location: { latitude: 33.2148, longitude: -97.1331, timezone: "America/Chicago" },
      });
      await vi.advanceTimersByTimeAsync(0);
      card.shadowRoot.querySelector('[data-source="mymoon"]').click();
      await vi.advanceTimersByTimeAsync(0);
      expect(card.shadowRoot.querySelector(".image-view-tint").getAttribute("style")).toMatch(
        /background: rgba\(255, 102, 26, 0\.\d\d\)/
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
        gallery: {
          mode: "open",
          shape: "circle",
          mymoon: true,
          moon: true,
          earth: true,
          sun: true,
        },
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
      const card = createAndMount({ gallery: { mode: "open", moon: true } });
      await flush();
      card.shadowRoot.querySelector('[data-source="moon"]').click();
      await flush();
      const src = card.shadowRoot.querySelector("#image-view").getAttribute("src");
      expect(src).toContain("730x730_1x1_30p");
      expect(src).not.toContain("216x216");
      card.remove();
    });

    // "below" makes the strip a normal-flow sibling of the view, growing the card by its own
    // height — unlike "overlay", which floats over the view and legitimately must yield when
    // a panel opens. Regression: opening a panel used to hide the strip regardless of position,
    // which shrank the whole card back down the moment a below-position thumbnail was clicked.
    it("keeps the strip visible below the view after opening a panel", async () => {
      const card = createAndMount({ gallery: { mode: "open", position: "below", moon: true } });
      await flush();
      card.shadowRoot.querySelector('[data-source="moon"]').click();
      await flush();
      expect(card.shadowRoot.querySelector(".gallery-below")).not.toBeNull();
      card.remove();
    });

    // In "below" position the just-clicked tile stays visible next to its own full-screen
    // view, so clicking it again is reachable — and reads as "close", not "reopen".
    it("closes the panel when the open tile is clicked again in below position", async () => {
      const card = createAndMount({ gallery: { mode: "open", position: "below", moon: true } });
      await flush();
      card.shadowRoot.querySelector('[data-source="moon"]').click();
      await flush();
      expect(card.shadowRoot.querySelector(".image-view-frame").className).toContain("visible");
      card.shadowRoot.querySelector('[data-source="moon"]').click();
      await flush();
      expect(card.shadowRoot.querySelector(".image-view-frame").className).not.toContain("visible");
      card.remove();
    });

    // Opening the sky tile must not snap back to the geocentric frame.
    //
    // Pinned to an instant the Moon is actually up: the panel only holds an image while it is,
    // so on real wall-clock time this asserted against whichever sky the suite happened to run
    // under, and would have started failing roughly half the day.
    it("carries the sky rotation into the full-screen view", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-22T02:15:00Z"));
      const card = createAndMount({
        gallery: { mode: "open" },
        location: { latitude: 33.2148, longitude: -97.1331, timezone: "America/Chicago" },
      });
      await vi.advanceTimersByTimeAsync(0);
      card.shadowRoot.querySelector('[data-source="mymoon"]').click();
      await vi.advanceTimersByTimeAsync(0);
      expect(card.shadowRoot.querySelector("#image-view").getAttribute("style")).toMatch(
        /transform: rotate\(-?\d+(\.\d+)?deg\)/
      );
      card.remove();
      vi.useRealTimers();
    });

    // gallery.shape flips the crop between a round puck and a square one — both are scaled
    // to the same shared target size.
    it("crops to a square puck when gallery.shape is square", () => {
      const card = createAndMount({
        gallery: { mode: "open", shape: "square", moon: true, earth: true, sun: true },
      });
      const styleOf = (source) =>
        card.shadowRoot.querySelector(`[data-source="${source}"] img`).getAttribute("style");
      for (const source of ["moon", "earth", "sun"]) {
        expect(styleOf(source)).toMatch(/^clip-path: inset\(/);
      }
      card.remove();
    });

    // The sky tile follows gallery.shape exactly like every other tile now: same inset/circle
    // clip, same scale to the shared target size, rotation just applies on top of it. Any
    // corners the rotation swings outside the tile are cut by the tile's own overflow:hidden,
    // mymoon ignores gallery.shape and always circle-crops, even in square mode: a rotated
    // inset() square would still show the source JPEG's own black square canvas at every angle
    // but 0/90/180/270, and a circle is the one shape rotation can't do that to.
    it("keeps circle-cropping the sky tile even when gallery.shape is square", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-22T02:15:00Z")); // Moon up, see "shows the normal age..."
      const card = createAndMount({
        gallery: { mode: "open", shape: "square" },
        location: { latitude: 33.2148, longitude: -97.1331, timezone: "America/Chicago" },
      });
      const style = card.shadowRoot
        .querySelector('[data-source="mymoon"] img')
        .getAttribute("style");
      expect(style).toMatch(/^clip-path: circle\(/);
      expect(style).toMatch(/rotate\(-?\d+(\.\d+)?deg\) scale\(/);
      card.remove();
      vi.useRealTimers();
    });

    it("labels the two moon tiles apart", () => {
      const card = createAndMount({ gallery: { mode: "open", moon: true } });
      const labelOf = (source) =>
        card.shadowRoot.querySelector(`[data-source="${source}"] .gallery-label`).textContent;
      expect(labelOf("moon")).toBe("MOON");
      expect(labelOf("mymoon")).toBe("MY MOON");
      card.remove();
    });

    // The caption is what makes the tiles read as one strip. Comparing the shapes rather
    // than eyeballing each one means a future divergence fails here instead of shipping.
    // Order is load-bearing now: the caption is a centred column, so the label span is the
    // line above the body and the age span the line below it.
    it("gives every tile the same caption structure", () => {
      const card = createAndMount({
        gallery: { mode: "open", mymoon: true, moon: true, earth: true, sun: true },
      });
      const shapes = [...card.shadowRoot.querySelectorAll(".gallery-info")].map((info) =>
        [...info.children].map((el) => `${el.tagName}.${el.className}`)
      );
      expect(shapes).toHaveLength(4);
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
      expect(labels).toEqual(["MY MOON", "MOON", "EARTH", "SUN"]);

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
      expect(card.shadowRoot.querySelector(".status-bar").textContent).toContain(
        "SUN · NASA SDO HMI"
      );
      const img = card.shadowRoot.querySelector("#image-view");
      expect(img.parentElement.classList.contains("visible")).toBe(true);
      expect(card.shadowRoot.querySelector(".gallery")).toBeNull();
      expect(card.shadowRoot.querySelector("#solar-view").classList.contains("hidden")).toBe(true);
      card.remove();
    });
    it("full-screen status bar shows 'loading…' if opened before the background fetch has landed", () => {
      const card = mountWithGallery();
      // Click immediately — the mount's own background fetch is still in flight.
      card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
      expect(card.shadowRoot.querySelector(".status-bar").textContent).toContain("loading…");
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

    // The <img> load/error handlers are the card's own wiring: what each one *does* is
    // GalleryController's, and tested there. These only prove the template's @load/@error
    // bindings reach the right method — the piece no controller test can see.
    describe("image event wiring", () => {
      it("routes the panel image's error event to the controller", async () => {
        const card = mountWithGallery();
        await flush();
        card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
        await flush();
        expect(card._gallery.panelMode).toBe("sun");

        card.shadowRoot.querySelector("#image-view").dispatchEvent(new Event("error"));
        await flush();
        expect(card._gallery.panelMode).toBe("none");
        expect(card._gallery.error).toContain("unavailable");
        card.remove();
      });

      it("routes the panel image's load event to the controller", async () => {
        const card = mountWithGallery();
        await flush();
        card.shadowRoot.querySelector('.gallery-thumb[data-source="sun"]').click();
        await flush();

        card.shadowRoot.querySelector("#image-view").dispatchEvent(new Event("load"));
        await flush();
        expect(card._gallery.imageLoaded).toBe(true);
        card.remove();
      });

      it("routes a sun thumbnail's error event to the controller", async () => {
        const card = mountWithGallery();
        await flush();
        expect(card._gallery.images.sun).toBeDefined();

        card.shadowRoot
          .querySelector('.gallery-thumb[data-source="sun"] img')
          .dispatchEvent(new Event("error"));
        await flush();
        expect(card._gallery.images.sun).toBeUndefined();
        card.remove();
      });
    });

    it("clicking the earth thumbnail fetches the latest EPIC image and shows it", async () => {
      stubEarthFetch();
      const card = mountWithGallery();
      await flush();
      card.shadowRoot.querySelector('.gallery-thumb[data-source="earth"]').click();
      await flush();
      const img = card.shadowRoot.querySelector("#image-view");
      expect(img.parentElement.classList.contains("visible")).toBe(true);
      expect(img.src).toBe(
        `${EPIC_BASE_URL}/archive/natural/2026/08/10/jpg/epic_1b_20260810234950.jpg`
      );
      expect(card.shadowRoot.querySelector(".status-bar").textContent).toContain(
        "EARTH · NOAA DSCOVR EPIC"
      );
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
    it("gallery.mode: slide shows one thumbnail at a time, flipping on its own interval", async () => {
      vi.useFakeTimers();
      stubEarthFetch();
      const card = mountWithGallery({ gallery: { mode: "slide", slide_interval_secs: 120 } });
      await vi.advanceTimersByTimeAsync(0);

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
  });
});
