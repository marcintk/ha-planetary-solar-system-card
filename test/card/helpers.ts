import { afterEach, beforeAll, beforeEach, vi } from "vitest";
import { SolarViewCard } from "../../src/card/card.js";
import { urlCache } from "../../src/card/gallery/url-cache.js";

const TEST_CARD_TAG = "ha-planetary-solar-system-card-test";

// Any mounted card with gallery.mode != "none" fetches in the background from
// connectedCallback, even in describes that never stub fetch. Left unstubbed, that's a real
// network call — works in CI (real internet) but not locally, and a slow one can resolve
// after its own test ends and pollute url-cache.ts's module-level cache for a later
// test. Default fetch to a safe rejection for every test; individual tests override it with
// their own vi.stubGlobal("fetch", ...) when they want specific behavior.
//
// Every image path (initial open, gallery thumbnail, background refresh) preloads a
// candidate off-DOM (ImageResolver.resolve()) before it's ever assigned to a visible <img>, via
// `new Image()`. Left unstubbed, that never resolves in jsdom (no real network), hanging
// every await. Default it to succeed on the next microtask for every test; pass one boolean
// per attempt to control retries (e.g. stubImagePreload(false, true) — first attempt fails,
// the sun retry succeeds); the last value repeats for any further attempt.
export function stubImagePreload(...results) {
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

/**
 * Call once at the top of every card test file. Registers the element (each file gets its own
 * jsdom, so each has to) and installs the safe-by-default network/image environment below.
 */
export function setupCardTest() {
  beforeAll(() => {
    if (!customElements.get(TEST_CARD_TAG)) {
      customElements.define(TEST_CARD_TAG, SolarViewCard);
    }
  });
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fetch not stubbed for this test")));
    stubImagePreload();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    urlCache.clear();
  });
}

export function createAndMount(config) {
  const card = document.createElement(TEST_CARD_TAG);
  if (config) card.setConfig(config);
  document.body.appendChild(card);
  return card;
}

export function clickButton(card, action) {
  const btn = card.shadowRoot.querySelector(`button[data-action="${action}"]`);
  btn.click();
}

// Drives a real pointer drag across the SVG. A zero delta taps without moving — pointerdown
// fires on every tap (planet clicks included), which must not count as taking the view over.
export function dragView(card, dx = 0, dy = 0) {
  const svg = card.shadowRoot.querySelector("#solar-view svg");
  svg.setPointerCapture = () => {};
  svg.releasePointerCapture = () => {};
  svg.dispatchEvent(new PointerEvent("pointerdown", { clientX: 200, clientY: 200 }));
  if (dx || dy) {
    svg.dispatchEvent(new PointerEvent("pointermove", { clientX: 200 + dx, clientY: 200 + dy }));
  }
  svg.dispatchEvent(new PointerEvent("pointerup", { clientX: 200 + dx, clientY: 200 + dy }));
}

export function getSvgViewBox(card) {
  const svg = card.shadowRoot.querySelector("#solar-view svg");
  return svg.getAttribute("viewBox");
}

export function parseViewBox(card) {
  const parts = getSvgViewBox(card).split(" ").map(Number);
  return { minX: parts[0], minY: parts[1], width: parts[2], height: parts[3] };
}
