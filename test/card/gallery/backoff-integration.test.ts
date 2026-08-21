import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SolarViewCard } from "../../../src/card/card.js";
import { urlCache } from "../../../src/card/gallery/url-cache.js";

// End-to-end companion to backoff.test.ts's unit coverage: drives the real card, its
// refresh_mins timer, and gallery-controller/resolve() plumbing through a sustained outage,
// rather than calling Backoff or SourceResolver directly — confirms the cooldown actually
// suppresses network calls at the boundary a user's browser would hit, not just at the
// class-under-test boundary.
describe("gallery backoff integration", () => {
  beforeAll(() => {
    if (!customElements.get("ha-planetary-solar-system-card-test")) {
      customElements.define("ha-planetary-solar-system-card-test", SolarViewCard);
    }
  });

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fetch not stubbed for this test")));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    urlCache.clear();
  });

  function createAndMount(config) {
    const card = document.createElement("ha-planetary-solar-system-card-test");
    card.setConfig({ gallery: { mode: "both" }, ...config });
    document.body.appendChild(card);
    return card;
  }

  // Explicit timeout: this drives 360 simulated timer ticks through the real card, which
  // reliably finishes in ~1.5s alone but can cross vitest's 5s default under full-suite
  // parallel load (many other test files' workers competing for CPU).
  it("a sustained sun-source outage backs off instead of retrying every refresh_mins tick", async () => {
    // Real network attempts only, not decode-gate hits: every Image() construction is one
    // real probe of a candidate URL (the primary guess plus, on failure, each widened
    // publish buffer up to the ceiling) — the number backoff exists to bound.
    let imageAttempts = 0;
    vi.stubGlobal(
      "Image",
      class {
        src = "";
        constructor() {
          imageAttempts++;
        }
        decode() {
          return Promise.reject(new Error("decode failed"));
        }
      }
    );
    vi.useFakeTimers();
    const card = createAndMount({ refresh_mins: 1 });
    await vi.advanceTimersByTimeAsync(0); // mount's own background fetch fails

    const attemptsAfterMount = imageAttempts;
    expect(attemptsAfterMount).toBeGreaterThan(0);

    // 6 hours of 1-minute ticks (360 of them). Without backoff, each tick re-attempts
    // (primary + retries) — hundreds of probes. With it, cooldown skips ticks that land
    // inside the current backoff window, so this stays a small, capped number.
    await vi.advanceTimersByTimeAsync(6 * 3600000);

    expect(imageAttempts).toBeGreaterThan(attemptsAfterMount); // it did keep trying...
    expect(imageAttempts).toBeLessThan(80); // ...but nowhere near the ~2500 a naive per-tick
    // retry would have produced: four sources probing on every one of the 360 ticks, sun
    // costing its primary guess plus its three widened buffers each time. Each source backs
    // off on its own cooldown, so the ceiling scales with source count, not tick count.
    expect(urlCache.inCooldown("sun")).toBe(true); // still backed off at the end of the outage

    card.remove();
    vi.useRealTimers();
  }, 15000);
});
